import {
  Menu,
  app,
  dialog,
  globalShortcut,
  ipcMain,
  screen,
  session,
  shell,
  type WebContents
} from 'electron'
import { readFileSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

import {
  boundControllers,
  buttonBinding,
  fallbackControllerName,
  updateDeviceNames,
  type ControllerInfo
} from '@shared/controllers'
import type { PersonalBestList } from '@shared/delta/references'
import { messagesFor } from '@shared/i18n'
import { IPC, type InitialState, type RendererView } from '@shared/ipc'
import { deepEqual } from '@shared/equal'
import { LAYOUT_FILE_EXTENSION, applySettingsPatchFor, rendererSettings } from '@shared/layouts'
import { stepScale } from '@shared/panelGeometry'
import {
  defaultLayoutOffsetX,
  placeDefaultLayout,
  rectsEqual,
  resetWidgetBounds,
  resetWidgetOptions,
  toTelemetryConfig
} from '@shared/settings'
import type { SessionKind } from '@shared/sessionInfo'
import { everyBinding, shortcutBindings } from '@shared/shortcuts'
import type { OverlaySettings, OverlayStatus, ShowWhen, SourceKind } from '@shared/types'
import type { WidgetId } from '@shared/widgets'
import { createCursorProbe } from './cursorProbe'
import { InputHost } from './inputHost'
import { LayoutControl, isLayoutCommand } from './layoutControl'
import type { LayoutFileDeps } from './layoutFiles'
import { SettingsStore } from './settingsStore'
import { diffSettings, isSettingsCommand, viewOfSender } from './settingsSync'
import {
  destroySettingsWindow,
  isSettingsSender,
  isSettingsWindowFocused,
  onSettingsWindowInactive,
  openSettingsWindow,
  openSettingsWindowHandle,
  sendToSettingsWindow,
  setSettingsWindowLanguage
} from './settingsWindow'
import { installLogFile } from './logFile'
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
 * sent to the game. Shortcuts on a controller's button are read in the input
 * utilityProcess through Raw Input, only while one is configured: shared with
 * iRacing (its own copy of each report), no device acquired, opened for I/O
 * or written to, no hook (src/input/rawInput.ts).
 */

const APP_USER_MODEL_ID = 'io.github.jesus-molano.overlap'
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
  // Next to settings.json: what went wrong in a session started from the desktop (no console).
  installLogFile(join(app.getPath('userData'), 'overlap.log'))
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
  // Changes that only live in memory: the settings window says so until a write works again.
  store.onSaveFailing = (failing) => sendToSettingsWindow(IPC.saveFailing, failing)
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
  /** The overlays' copy of the settings last broadcast (syncSettings). */
  let overlaySettingsSent: OverlaySettings | null = null
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

  // The saved layouts: the tray, the shortcut, the settings window and the automatic switch.
  const layouts = new LayoutControl({
    getSettings: () => store.settings,
    update: (mutate) => void store.update(mutate),
    sync: (prev) => syncSettings(prev),
    // The settings with the layout's options follow at once (sync): shown together.
    reloadBounds: (ids) => windows.reloadBoundsOf(ids, true),
    flushPendingSaves: () => windows.flushPendingSaves(),
    isEditing: () => windows.editMode,
    notify: (notice) => sendToSettingsWindow(IPC.layoutNotice, notice),
    carChanged: (car) => {
      sendToSettingsWindow(IPC.currentCar, car)
      refreshTray()
    },
    files: layoutFileDeps,
    importedName: () =>
      messagesFor(store.settings.appearance.language).core.layoutFiles.importedName,
    log: (message) => console.log(message)
  })

  /** The system's file dialogs for a layout export or import, over the settings window. */
  function layoutFileDeps(): LayoutFileDeps {
    const parent = openSettingsWindowHandle()
    const t = messagesFor(store.settings.appearance.language).core.layoutFiles
    const filters = [{ name: t.filter, extensions: [LAYOUT_FILE_EXTENSION] }]
    return {
      pickSavePath: async (name) => {
        const options = { defaultPath: join(app.getPath('documents'), name), filters }
        const r = parent
          ? await dialog.showSaveDialog(parent, options)
          : await dialog.showSaveDialog(options)
        return r.canceled || !r.filePath ? null : r.filePath
      },
      pickOpenPath: async () => {
        const options = {
          defaultPath: app.getPath('documents'),
          filters,
          properties: ['openFile' as const]
        }
        const r = parent
          ? await dialog.showOpenDialog(parent, options)
          : await dialog.showOpenDialog(options)
        return r.canceled ? null : (r.filePaths[0] ?? null)
      },
      writeText: (path, text) => writeFileSync(path, text, 'utf8'),
      sizeOf: (path) => statSync(path).size,
      readText: (path) => readFileSync(path, 'utf8')
    }
  }

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
    },
    onPlayerCar: (car) => layouts.onCar(car)
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

  /** The controllers connected now (the input process's list); null when not known. */
  let controllersNow: readonly ControllerInfo[] | null = null
  // Runs only while some shortcut is a button or the shortcuts page records one
  // (onButtonsWanted below): otherwise no process, nothing read.
  const input = new InputHost({
    onDevices: (list) => {
      // Only on a change (the input process sends a list when one is plugged or unplugged).
      if (list !== null) {
        const text = list.map((c) => `${c.name} (${c.id}, ${c.buttons} buttons)`).join(', ')
        console.log(`[input] controllers: ${text === '' ? 'none' : text}`)
      }
      controllersNow = list
      shortcuts.setControllers(list === null ? null : list.map((c) => c.id))
      rememberControllerNames()
    },
    onPress: (device, button, first) => {
      const binding = buttonBinding(device, button)
      // While the page records a binding, the press is for it (no action runs).
      if (!shortcuts.capturing) {
        const action = shortcuts.pressButton(device, button)
        console.log(`[input] press ${binding}${first ? ' (first)' : ''} -> ${action ?? 'nothing'}`)
        return
      }
      console.log(`[input] press ${binding}${first ? ' (first)' : ''} -> recording`)
      const name = controllersNow?.find((c) => c.id === device)?.name
      sendToSettingsWindow(IPC.controllerPress, {
        binding,
        name: name ?? fallbackControllerName(device),
        first
      })
    }
  })

  /**
   * Keeps the name of each controller a button shortcut uses (the page shows it while it is
   * unplugged) and forgets the others'. Re-entrant through changeSettings: the second pass
   * finds nothing to change.
   */
  function rememberControllerNames(): void {
    const s = store.settings
    const next = updateDeviceNames(
      s.buttonDeviceNames,
      boundControllers(everyBinding(shortcutBindings(s.shortcuts, s.shortcutsMore))),
      controllersNow ?? []
    )
    if (next === s.buttonDeviceNames) return
    changeSettings((draft) => {
      draft.buttonDeviceNames = { ...next }
    })
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
        case 'nextLayout':
          layouts.next()
          break
        case 'openSettings':
          openSettingsWindow()
          break
      }
    },
    onExitEdit: () => setEditMode(false),
    onStatus: (next) => sendToSettingsWindow(IPC.shortcutStatus, next),
    onButtonsWanted: (wanted) => input.setWanted(wanted),
    // A reader that gave up (or could not read controllers) gets another go.
    onCaptureStart: () => input.retry()
  })
  // Whatever takes the keys away from the settings page ends a capture there.
  onSettingsWindowInactive(() => shortcuts.stopCapture())

  function trayState(): TrayState {
    return {
      status,
      settings: store.settings,
      editMode: windows.editMode,
      overlayHidden: windows.userHidden,
      autoHidden: windows.autoHiddenReasons(),
      carId: layouts.car?.carId ?? null
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
    // The renderers' copies leave out the layouts' options (rendererSettings); the overlays'
    // is not sent again when none of it changed (a rename, a car link, another layout's options).
    const forOverlays = rendererSettings(store.settings, 'overlay')
    if (!deepEqual(forOverlays, overlaySettingsSent)) {
      overlaySettingsSent = forOverlays
      windows.broadcastSettings(forOverlays)
    }
    sendToSettingsWindow(IPC.settings, rendererSettings(store.settings, 'settings'))
    shortcuts.configure(store.settings.shortcuts, store.settings.shortcutsMore)
    rememberControllerNames()
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
      // A car's layout that waited for the editing to end.
      if (!editing) layouts.onEditEnd()
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
      settings: rendererSettings(store.settings, view.kind),
      layout: overlay ? windows.layoutFor(event.sender) : null,
      autoHidden: overlay ? windows.autoHiddenMap() : {},
      overlayHidden: windows.userHidden,
      shortcutStatus: shortcuts.report,
      cursorHidden: windows.cursorHidden,
      currentCar: layouts.car,
      saveFailing: store.saveFailing
    }
  })
  ipcMain.handle(IPC.updateSettings, (event, patch: unknown, forLayout: unknown) => {
    if (!isSettingsSender(event.sender)) {
      throw new Error(`${IPC.updateSettings} is only accepted from the settings window`)
    }
    const prev = store.settings
    // Made for a layout no longer in use (switched while it was on its way): kept in that one.
    changeSettings((s) => {
      Object.assign(s, applySettingsPatchFor(s, patch, forLayout))
    })
    // Turning the automatic layout on applies the car's at once.
    layouts.afterChange(prev)
    return rendererSettings(store.settings, 'settings')
  })
  ipcMain.on(IPC.command, (event, raw: unknown) => {
    if (!isSettingsSender(event.sender) || !isSettingsCommand(raw)) return
    if (isLayoutCommand(raw)) {
      layouts.command(raw).catch((err: unknown) => console.error('[main] layout command:', err))
      return
    }
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
    applyLayout: (id) => void layouts.choose(id),
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
  shortcuts.configure(store.settings.shortcuts, store.settings.shortcutsMore)

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
    safe('stop reading controllers', () => input.dispose())
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
