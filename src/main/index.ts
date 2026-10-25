import { Menu, app, globalShortcut, ipcMain, session, shell, type WebContents } from 'electron'
import { join } from 'node:path'
import type { PersonalBestList } from '@shared/delta/references'
import { IPC, type InitialState, type RendererView } from '@shared/ipc'
import {
  applySettingsPatch,
  rectsEqual,
  resetWidgetBounds,
  resetWidgetOptions,
  toTelemetryConfig
} from '@shared/settings'
import type { OverlaySettings, OverlayStatus, SourceKind } from '@shared/types'
import type { WidgetId } from '@shared/widgets'
import { SettingsStore } from './settingsStore'
import { diffSettings, isSettingsCommand, viewOfSender } from './settingsSync'
import {
  destroySettingsWindow,
  isSettingsSender,
  openSettingsWindow,
  sendToSettingsWindow,
  setSettingsWindowLanguage
} from './settingsWindow'
import { resolveSource } from './sourceFlag'
import { TelemetryHost } from './telemetryHost'
import { EDIT_MODE_ACCELERATOR, createTray, destroyTray, updateTray, type TrayState } from './tray'
import { WidgetWindows } from './widgetWindows'
import { stepScale } from './windowMath'

/*
 * Anti-cheat note: this app never touches the game process. It only reads the
 * iRacing SDK memory map (in the telemetry utilityProcess) and draws its own
 * separate, non-focusable windows on top. Only the settings window, opened
 * from the tray, is a normal focusable window.
 */

const APP_USER_MODEL_ID = 'dev.local.overlap'
/** Registered only while editing: non-focusable windows never get key events. */
const EXIT_EDIT_ACCELERATOR = 'Escape'
/** Backstop for before-quit: telemetry.stop() resolves within ~2 s on its own. */
const FORCE_EXIT_AFTER_MS = 5_000

// When the terminal that launched the app goes away, console writes fail with
// EPIPE; an 'error' event without a listener would become an uncaught
// exception on every log line. Logging must never take the app down.
process.stdout.on('error', () => {})
process.stderr.on('error', () => {})

function safeLog(...args: unknown[]): void {
  try {
    console.error(...args)
  } catch {
    // stdout/stderr unusable: nothing else to report to.
  }
}

// Electron shows a modal dialog for uncaught main-process errors, which would
// steal focus from the sim. Log instead.
process.on('uncaughtException', (err) => safeLog('[main] uncaught exception:', err))
process.on('unhandledRejection', (reason) => safeLog('[main] unhandled rejection:', reason))

// The packaged app is named after productName ("OverLap"), dev after
// package.json name: pin userData so both share settings.json. Must run before
// the single-instance lock, which lives in userData.
app.setPath('userData', join(app.getPath('appData'), 'iracing-overlay'))

if (!app.requestSingleInstanceLock()) {
  console.log('[main] another instance is already running, exiting')
  app.quit()
} else {
  app.setAppUserModelId(APP_USER_MODEL_ID)
  // No window has a menu bar; skip building the default one.
  Menu.setApplicationMenu(null)
  // Launching the app again while it runs (an explicit user action) opens the
  // settings window, like most tray apps. Nothing else ever takes focus.
  app.on('second-instance', () => {
    if (app.isReady()) openSettingsWindow()
  })
  // Tray app: closing every window does not quit.
  app.on('window-all-closed', () => {})
  app
    .whenReady()
    .then(start)
    .catch((err: unknown) => {
      console.error('[main] startup failed:', err)
      app.exit(1)
    })
}

/** Codes only: each window words it ('Iniciando telemetría simulada…' for the mock). */
function initialStatus(source: SourceKind): OverlayStatus {
  return { state: 'starting', source, note: 'none', detail: '' }
}

function sameStatus(a: OverlayStatus, b: OverlayStatus): boolean {
  return a.state === b.state && a.source === b.source && a.note === b.note && a.detail === b.detail
}

function start(): void {
  // Widgets need no permission at all (camera, notifications, ...).
  session.defaultSession.setPermissionRequestHandler((_wc, _permission, callback) =>
    callback(false)
  )

  const userData = app.getPath('userData')
  const store = SettingsStore.load(join(userData, 'settings.json'))
  const source = resolveSource(process.argv, process.env)
  let status = initialStatus(source)
  /** The telemetry process's latest list, for the settings window's Delta page. */
  let personalBests: PersonalBestList | null = null
  console.log(`[main] source: ${source}, settings: ${store.file}`)
  setSettingsWindowLanguage(store.settings.appearance.language)

  const windows = new WidgetWindows({
    getSettings: () => store.settings,
    onBoundsCommitted: (id, bounds) => {
      changeSettings((s) => {
        s.widgets[id].bounds = bounds
      })
    },
    // Through the normal settings path: the settings window's slider follows the wheel.
    onScaleStep: (id, step) => {
      changeSettings((s) => {
        s.widgets[id].scale = stepScale(s.widgets[id].scale, step)
      })
    }
  })

  const telemetry = new TelemetryHost({
    source,
    getConfig: () => toTelemetryConfig(store.settings),
    onStatus: (next) => setStatus(next),
    onData: (msg) => windows.sendData(msg),
    onAutoHidden: (id, state) => {
      windows.setAutoHidden(id, state)
      refreshTray()
    },
    onBests: (list) => {
      personalBests = list
      sendToSettingsWindow(IPC.personalBests, list)
    }
  })

  /** The settings window gets the list again (and drops whatever it showed as deleting). */
  function sendPersonalBests(): void {
    if (personalBests) sendToSettingsWindow(IPC.personalBests, personalBests)
  }

  function trayState(): TrayState {
    return {
      status,
      settings: store.settings,
      editMode: windows.editMode,
      autoHidden: windows.autoHiddenReasons()
    }
  }

  function refreshTray(): void {
    updateTray(trayState())
  }

  function setStatus(next: OverlayStatus): void {
    if (sameStatus(status, next)) return
    status = next
    windows.broadcastStatus(next)
    sendToSettingsWindow(IPC.status, next)
    refreshTray()
  }

  /** Every settings change (tray, settings window, drags) goes through here. */
  function changeSettings(mutate: (draft: OverlaySettings) => void): OverlaySettings {
    const prev = store.settings
    store.update(mutate)
    syncSettings(prev)
    return store.settings
  }

  /**
   * Brings windows, telemetry, renderers and tray in line with the store after
   * a change from `prev`. Re-entrant: hiding or locking a widget mid-drag
   * commits that drag (another change) before this returns, so the broadcast
   * reads the store again instead of using `next`.
   */
  function syncSettings(prev: OverlaySettings): void {
    const next = store.settings
    const diff = diffSettings(prev, next)
    if (!diff.changed) return
    for (const id of diff.visibilityChanged) windows.setVisible(id, next.widgets[id].visible)
    // Hidden widgets are not computed by the telemetry process either.
    if (diff.telemetryConfigChanged) telemetry.sendConfig(toTelemetryConfig(store.settings))
    // A new interface language: window titles here, the tray below, every renderer on its own.
    setSettingsWindowLanguage(store.settings.appearance.language)
    windows.applySettings(store.settings)
    windows.broadcastSettings(store.settings)
    sendToSettingsWindow(IPC.settings, store.settings)
    refreshTray()
  }

  function setWidgetVisible(id: WidgetId, visible: boolean): void {
    changeSettings((s) => {
      s.widgets[id].visible = visible
    })
  }

  function setRadarRange(rangeM: number): void {
    changeSettings((s) => {
      s.radar.rangeM = rangeM
    })
  }

  function resetBounds(id: WidgetId): void {
    const prev = store.settings
    store.update((s) => {
      Object.assign(s, resetWidgetBounds(s, id))
    })
    // Move the window first: this also drops a drag of it, so the reset wins.
    windows.reloadBounds(id)
    syncSettings(prev)
  }

  /** Back to the widget's default options; bounds only move if the reset touched them. */
  function resetOptions(id: WidgetId): void {
    const before = store.settings.widgets[id].bounds
    changeSettings((s) => {
      Object.assign(s, resetWidgetOptions(s, id))
    })
    if (!rectsEqual(before, store.settings.widgets[id].bounds)) windows.reloadBounds(id)
  }

  function openSettingsFolder(): void {
    void shell.openPath(userData).then((err) => {
      if (err) console.warn(`[main] could not open ${userData}: ${err}`)
    })
  }

  function setEditMode(on: boolean): void {
    if (on === windows.editMode) return
    windows.setEditMode(on)
    sendToSettingsWindow(IPC.editMode, on)
    if (on) {
      // Steals Escape from every app, but only while editing.
      if (!globalShortcut.register(EXIT_EDIT_ACCELERATOR, () => setEditMode(false))) {
        console.warn('[main] could not register Escape to leave edit mode')
      }
    } else {
      globalShortcut.unregister(EXIT_EDIT_ACCELERATOR)
      // Drags already went through onBoundsCommitted. Saving every window's
      // current bounds here would persist the fallback position of a widget
      // whose monitor is disconnected, so it would never return there.
      store.flush()
    }
    console.log(`[main] edit mode ${on ? 'on' : 'off'}`)
    refreshTray()
  }

  const viewOf = (sender: WebContents): RendererView | null =>
    viewOfSender(sender, { widgetOf: (wc) => windows.widgetOf(wc), isSettings: isSettingsSender })

  // Registered before any window loads. Widget and settings windows share the
  // preload, so every handler checks which kind of window is asking.
  ipcMain.handle(IPC.init, (event): InitialState => {
    const view = viewOf(event.sender)
    if (!view) throw new Error(`${IPC.init} from an unknown window`)
    return { view, editMode: windows.editMode, status, settings: store.settings }
  })
  ipcMain.handle(IPC.updateSettings, (event, patch: unknown): OverlaySettings => {
    if (!isSettingsSender(event.sender)) {
      throw new Error(`${IPC.updateSettings} is only accepted from the settings window`)
    }
    return changeSettings((s) => {
      Object.assign(s, applySettingsPatch(s, patch))
    })
  })
  ipcMain.on(IPC.command, (event, raw: unknown) => {
    if (!isSettingsSender(event.sender) || !isSettingsCommand(raw)) return
    switch (raw.type) {
      case 'set-edit-mode':
        setEditMode(raw.on)
        break
      case 'reset-widget-bounds':
        resetBounds(raw.widgetId)
        break
      case 'reset-widget-options':
        resetOptions(raw.widgetId)
        break
      case 'open-settings-folder':
        openSettingsFolder()
        break
      case 'refresh-personal-bests':
        sendPersonalBests()
        break
      // The telemetry process owns the file; it answers with the new list.
      // Not running (restarting): the unchanged list tells the window nothing happened.
      case 'delete-personal-bests':
        if (!telemetry.deleteBests(raw.keys)) sendPersonalBests()
        break
      case 'clear-personal-bests':
        if (!telemetry.clearBests()) sendPersonalBests()
        break
    }
  })

  windows.start()
  telemetry.start()
  createTray(trayState(), {
    openSettings: openSettingsWindow,
    setWidgetVisible,
    setRadarRange,
    setEditMode,
    openSettingsFolder,
    quit: () => app.quit()
  })
  // `--settings` (e.g. a desktop shortcut) opens the settings window on start.
  if (process.argv.includes('--settings')) openSettingsWindow()

  if (!globalShortcut.register(EDIT_MODE_ACCELERATOR, () => setEditMode(!windows.editMode))) {
    console.warn(
      `[main] ${EDIT_MODE_ACCELERATOR} is already used by another application; ` +
        'use the tray menu to toggle edit mode'
    )
  }

  // Quit in two steps: clean up synchronously, then wait (max ~2 s) for the
  // telemetry process to release the SDK before letting Electron quit. Each step
  // is isolated so one failure cannot leave the app unable to quit.
  let quitting: 'no' | 'stopping' | 'done' = 'no'
  app.on('before-quit', (event) => {
    if (quitting === 'done') return
    event.preventDefault()
    if (quitting === 'stopping') return
    quitting = 'stopping'
    const forceExit = setTimeout(() => {
      safeLog('[main] shutdown did not finish in time, forcing exit')
      app.exit(0)
    }, FORCE_EXIT_AFTER_MS)
    safe('leave edit mode', () => setEditMode(false))
    safe('close settings window', () => destroySettingsWindow())
    safe('unregister shortcuts', () => globalShortcut.unregisterAll())
    safe('dispose windows', () => windows.dispose())
    safe('flush settings', () => store.flush())
    safe('destroy tray', () => destroyTray())
    let stopped: Promise<void>
    try {
      stopped = telemetry.stop()
    } catch (err) {
      safeLog('[main] stop telemetry failed:', err)
      stopped = Promise.resolve()
    }
    void stopped
      .catch((err: unknown) => safeLog('[main] stop telemetry failed:', err))
      .finally(() => {
        clearTimeout(forceExit)
        quitting = 'done'
        app.quit()
      })
  })
}

function safe(step: string, fn: () => void): void {
  try {
    fn()
  } catch (err) {
    safeLog(`[main] ${step} failed:`, err)
  }
}
