import {
  Menu,
  app,
  globalShortcut,
  ipcMain,
  screen,
  session,
  shell,
  type WebContents
} from 'electron'
import { join } from 'node:path'

import type { PersonalBestList } from '@shared/delta/references'
import { IPC, type InitialState, type RendererView } from '@shared/ipc'
import { stepScale } from '@shared/panelGeometry'
import {
  applySettingsPatch,
  defaultLayoutOffsetX,
  placeDefaultLayout,
  rectsEqual,
  resetWidgetBounds,
  resetWidgetOptions,
  toTelemetryConfig
} from '@shared/settings'
import type { SessionKind } from '@shared/sessionInfo'
import type { OverlaySettings, OverlayStatus, ShowWhen, SourceKind } from '@shared/types'
import type { WidgetId } from '@shared/widgets'
import { createCursorProbe } from './cursorProbe'
import { SettingsStore } from './settingsStore'
import { diffSettings, isSettingsCommand, viewOfSender } from './settingsSync'
import {
  destroySettingsWindow,
  isSettingsSender,
  isSettingsWindowFocused,
  onSettingsWindowInactive,
  openSettingsWindow,
  sendToSettingsWindow,
  setSettingsWindowLanguage
} from './settingsWindow'
import { ShortcutManager } from './shortcutManager'
import { resolveSource } from './sourceFlag'
import { TelemetryHost } from './telemetryHost'
import { OverlayWindows } from './overlayWindows'
import { createTray, destroyTray, updateTray, type TrayState } from './tray'

/*
 * Anti-cheat note: this app never touches the game process. It only reads the
 * iRacing SDK memory map (in the telemetry utilityProcess) and draws one
 * separate, transparent, non-focusable, click-through window per display on
 * top. In edit mode only, Electron's mouse forwarding installs a low-level
 * mouse hook (WH_MOUSE_LL) in this process: it observes mouse moves, never
 * injects input, and is removed when edit mode ends (FORWARD_IN_EDIT=false,
 * in mouseMode.ts, disables it); while editing, main also reads whether the
 * cursor shows (user32 GetCursorInfo, read-only, cursorProbe.ts). Only the
 * settings window, opened from the tray, is a normal focusable window. The
 * global shortcuts are Windows hot
 * keys (RegisterHotKey through globalShortcut): no keyboard hook, nothing
 * sent to the game.
 */

const APP_USER_MODEL_ID = 'dev.local.overlap'
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
  // A first run on an ultrawide screen: the default layout in its middle, not at its left edge.
  const primaryArea = screen.getPrimaryDisplay().workArea
  if (store.fresh && defaultLayoutOffsetX(primaryArea) > 0) {
    const area = primaryArea
    store.update((s) => {
      Object.assign(s, placeDefaultLayout(s, area))
    })
  }
  const source = resolveSource(process.argv, process.env)
  let status = initialStatus(source)
  /** The telemetry process's latest list, for the settings window's Delta page. */
  let personalBests: PersonalBestList | null = null
  /** The kind of session the telemetry process reports (the delta cycle shortcut acts on it). */
  let sessionKindNow: SessionKind | null = null
  console.log(`[main] source: ${source}, settings: ${store.file}`)
  setSettingsWindowLanguage(store.settings.appearance.language)

  const windows = new OverlayWindows({
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
    },
    // An edit chip's eye or padlock: the same settings as the tray and the settings window.
    onWidgetToggle: (id, field, value) => {
      changeSettings((s) => {
        s.widgets[id][field] = value
      })
    },
    cursorShowing: createCursorProbe()
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
    },
    onSessionKind: (kind) => {
      sessionKindNow = kind
    }
  })

  /**
   * The delta's cycle shortcut: a temporary reference for the current session only. The
   * telemetry process keeps it (the provider takes it at the start of the next lap, the widget
   * marks it as temporary); the settings never change, so a new session or a restart starts
   * again from the per-session choice in Settings. Outside a session there is nothing to cycle.
   */
  function cycleDeltaReference(): void {
    if (sessionKindNow === null) return
    telemetry.cycleDeltaReference()
  }

  /** The settings window gets the list again (and drops whatever it showed as deleting). */
  function sendPersonalBests(): void {
    if (personalBests) sendToSettingsWindow(IPC.personalBests, personalBests)
  }

  const shortcuts = new ShortcutManager({
    registry: globalShortcut,
    onAction: (action) => {
      switch (action) {
        case 'toggleOverlay':
          setOverlayHidden(!windows.userHidden)
          break
        case 'toggleEditMode':
          setEditMode(!windows.editMode)
          break
        case 'cycleDeltaReference':
          cycleDeltaReference()
          break
      }
    },
    onExitEdit: () => setEditMode(false),
    onStatus: (next) => sendToSettingsWindow(IPC.shortcutStatus, next)
  })
  // Whatever takes the keys away from the settings page ends a capture there.
  onSettingsWindowInactive(() => shortcuts.stopCapture())

  function trayState(): TrayState {
    return {
      status,
      settings: store.settings,
      editMode: windows.editMode,
      overlayHidden: windows.userHidden,
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
   * a change from `prev`. Re-entrant: disabling a widget writes its pending
   * wheel or auto-height save (another change) before this returns, so the
   * broadcast reads the store again instead of using `next`.
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
    shortcuts.configure(store.settings.shortcuts)
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

  /** The tray's "Mostrar el overlay": the same setting as Apariencia > Visibilidad. */
  function setShowWhen(showWhen: ShowWhen): void {
    changeSettings((s) => {
      s.visibility.showWhen = showWhen
    })
  }

  function resetBounds(id: WidgetId): void {
    const prev = store.settings
    store.update((s) => {
      Object.assign(s, resetWidgetBounds(s, id, screen.getPrimaryDisplay().workArea))
    })
    // Move the widget first: its pending saves are dropped and a drag of it is
    // cancelled, so the reset wins.
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

  /** Tray, shortcut, settings window: entering edit mode shows a hidden overlay first. */
  function setEditMode(on: boolean): void {
    changeModes(() => windows.setEditMode(on))
  }

  /** Tray, shortcut, settings window: hiding leaves edit mode first, as Escape does. */
  function setOverlayHidden(hidden: boolean): void {
    changeModes(() => windows.setUserHidden(hidden))
  }

  /**
   * Edit mode and the user's hiding depend on each other (OverlayWindows keeps them
   * consistent): whichever changed, its side effects follow here.
   */
  function changeModes(change: () => void): void {
    const wasEditing = windows.editMode
    const wasHidden = windows.userHidden
    change()
    const editing = windows.editMode
    const hidden = windows.userHidden
    if (editing !== wasEditing) {
      sendToSettingsWindow(IPC.editMode, editing)
      // Steals Escape from every app, but only while editing.
      shortcuts.setEditing(editing)
      // Drags already went through onBoundsCommitted and leaving edit mode
      // wrote the pending wheel and auto-height saves. Saving every widget's
      // current bounds here would persist the fallback position of a widget
      // whose monitor is disconnected, so it would never return there.
      if (!editing) store.flush()
      console.log(`[main] edit mode ${editing ? 'on' : 'off'}`)
    }
    if (hidden !== wasHidden) {
      sendToSettingsWindow(IPC.overlayHidden, hidden)
      console.log(`[main] overlay ${hidden ? 'hidden' : 'shown'}`)
    }
    if (editing !== wasEditing || hidden !== wasHidden) refreshTray()
  }

  const viewOf = (sender: WebContents): RendererView | null =>
    viewOfSender(sender, {
      isOverlay: (wc) => windows.isOverlaySender(wc),
      isSettings: isSettingsSender
    })

  // Registered before any window loads. Overlay and settings windows share the
  // preload, so every handler checks which kind of window is asking.
  ipcMain.handle(IPC.init, (event): InitialState => {
    const view = viewOf(event.sender)
    if (!view) throw new Error(`${IPC.init} from an unknown window`)
    const overlay = view.kind === 'overlay'
    return {
      view,
      editMode: windows.editMode,
      status,
      settings: store.settings,
      layout: overlay ? windows.layoutFor(event.sender) : null,
      autoHidden: overlay ? windows.autoHiddenMap() : {},
      overlayHidden: windows.userHidden,
      shortcutStatus: shortcuts.status,
      cursorHidden: windows.cursorHidden
    }
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
      case 'set-overlay-hidden':
        setOverlayHidden(raw.hidden)
        break
      // Only a page in front records keys: a renewal that arrives after the window lost focus
      // (the page cancels on blur too) must not suspend the shortcuts again.
      case 'capture-shortcuts':
        if (!raw.on) shortcuts.stopCapture()
        else if (isSettingsWindowFocused()) shortcuts.startCapture()
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
    setShowWhen,
    setEditMode,
    setOverlayHidden,
    openSettingsFolder,
    quit: () => app.quit()
  })
  // `--settings` (e.g. a desktop shortcut) opens the settings window on start.
  if (process.argv.includes('--settings')) openSettingsWindow()

  // A combination another application holds is reported on the shortcuts page; the tray
  // menu still does everything.
  shortcuts.configure(store.settings.shortcuts)

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
    safe('unregister shortcuts', () => shortcuts.dispose())
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
