import {
  Menu,
  Notification,
  app,
  clipboard,
  dialog,
  globalShortcut,
  ipcMain,
  screen,
  session,
  shell,
  type WebContents
} from 'electron'
import { readFileSync, statSync, writeFileSync } from 'node:fs'
import { basename, join } from 'node:path'
import { release as osRelease, type as osType } from 'node:os'

import {
  boundControllers,
  buttonBinding,
  fallbackControllerName,
  updateDeviceNames,
  type ControllerInfo
} from '@shared/controllers'
import type { PersonalBestList } from '@shared/delta/references'
import { messagesFor, widgetTitle, type Messages } from '@shared/i18n'
import { IPC, type InitialState, type RendererView, type UsedShortcut } from '@shared/ipc'
import { deepEqual } from '@shared/equal'
import { LAYOUT_FILE_EXTENSION, applySettingsPatchFor, rendererSettings } from '@shared/layouts'
import { EDIT_UNDO_KEY, NUDGE_KEYS, PICK_KEYS } from '@shared/nudge'
import { stepScale } from '@shared/panelGeometry'
import { projectUrl } from '@shared/projectLinks'
import {
  defaultLayoutOffsetX,
  placeDefaultLayout,
  rectsEqual,
  resetWidgetBounds,
  resetWidgetOptions,
  setWidgetBounds,
  type WidgetResetPart,
  toTelemetryConfig
} from '@shared/settings'
import type { SessionKind } from '@shared/sessionInfo'
import { everyBinding, shortcutBindings, widgetOfAction } from '@shared/shortcuts'
import type { OverlaySettings, OverlayStatus, Rect, ShowWhen, SourceKind } from '@shared/types'
import { WIDGET_IDS, type WidgetId } from '@shared/widgets'
import { createCursorProbe } from './cursorProbe'
import { diagnosticsText } from './diagnostics'
import { applyFirstRun } from './firstRun'
import { NoticeUndo } from './noticeUndo'
import { editStepText } from './editHistory'
import { gameDisplay } from './osdPlace'
import { gatherBounds, moveWidgets } from './gather'
import { InputHost } from './inputHost'
import { LayoutControl, isLayoutCommand } from './layoutControl'
import type { LayoutFileDeps } from './layoutFiles'
import { exportBackup, readBackup, type BackupDeps } from './backupFiles'
import { BACKUP_EXTENSION, factorySettings, importedSettings } from '@shared/backup'
import { PERSONAL_BESTS_FILE } from '../telemetry/store/personalBests'

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
  setSettingsWindowLanguage,
  setSettingsWindowZoom
} from './settingsWindow'
import { installLogFile } from './logFile'
import { ShortcutManager } from './shortcutManager'
import { resolveSource } from './sourceFlag'
import { TelemetryHost } from './telemetryHost'
import { OverlayWindows } from './overlayWindows'
import { commonHiddenReason, createTray, destroyTray, updateTray, type TrayState } from './tray'
import { OsdWindow } from './osdWindow'
import { shortcutConfirmation } from './shortcutFeedback'

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
  // A first run (R07): the system's language before the tray, the notification and the
  // welcome say anything, and the welcome on. An existing file keeps both as they are.
  if (store.fresh) {
    const preferred = app.getPreferredSystemLanguages()
    store.update((s) => {
      applyFirstRun(s, true, preferred)
    })
  }
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
  let sessionClasses: string[] = []
  /** The overlays' copy of the settings last broadcast (syncSettings). */
  let overlaySettingsSent: OverlaySettings | null = null
  console.log(`[main] source: ${source}, settings: ${store.file}`)
  setSettingsWindowLanguage(store.settings.appearance.language)
  setSettingsWindowZoom(store.settings.appearance.settingsZoom)

  /**
   * The «Deshacer» of a car linked, widgets brought here, an import or a reset, for the page and
   * the tray alike (before any change can reach syncSettings, which prunes it).
   */
  const noticeUndo = new NoticeUndo(() => refreshTray())
  /**
   * The settings an import's or a reset's «Deshacer» stands for (keepSettingsUndo); an auto
   * height fitting after it moves it along, any other change makes the offer go.
   */
  let settingsUndoBase: { after: OverlaySettings } | null = null

  const windows = new OverlayWindows({
    getSettings: () => store.settings,
    onBoundsCommitted: (id, bounds, fit) => {
      const prev = store.settings
      store.update((s) => {
        s.widgets[id].bounds = bounds
      })
      // An auto height following its content is no change of yours: an import's or a reset's
      // «Deshacer» stays (its widgets fit their new content right after it).
      if (fit === true && settingsUndoBase?.after === prev) settingsUndoBase.after = store.settings
      syncSettings(prev)
    },
    // Through the normal settings path: the settings window's slider follows the wheel.
    onScaleStep: (id, step) => {
      changeSettings((s) => {
        s.widgets[id].scale = stepScale(s.widgets[id].scale, step)
      })
    },
    // Ctrl+Z on a wheel step (R38): the «Escala» it had.
    onScaleSet: (id, scale) => {
      changeSettings((s) => {
        s.widgets[id].scale = scale
      })
    },
    // Edit mode's last change: the tray offers «Deshacer: mover Relativo» too (R38).
    onEditChange: (step) => {
      noticeUndo.keep(
        (m) => editStepText(m, step, windows.rectOf(step.id)),
        () => void windows.undoEdit(),
        () => windows.lastEdit() === step
      )
    },
    // An edit chip's ⚙: the widget's own page in the settings window (R25).
    onOpenWidgetPage: (id) => openSettingsWindow(id),
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
    keepUndo: (what, undo) => noticeUndo.keep(what, undo),
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
    const t = messagesFor(store.settings.appearance.language).core.layoutFiles
    return fileDeps(t.filter, LAYOUT_FILE_EXTENSION)
  }

  /** The same dialogs for «Exportar todo» / «Importar todo» (R40), with the bests' file. */
  function backupDeps(): BackupDeps {
    const t = messagesFor(store.settings.appearance.language).core.layoutFiles
    return {
      ...fileDeps(t.backupFilter, BACKUP_EXTENSION),
      // The process's memory first: a lap of the last 2 s, or one kept while writes fail, is
      // not in the file yet.
      readBests: async () => {
        const live = await telemetry.bestsText()
        if (live !== null) return live
        try {
          return readFileSync(join(userData, PERSONAL_BESTS_FILE), 'utf8')
        } catch {
          return null
        }
      },
      baseName: (path) => basename(path)
    }
  }

  /** Save and open dialogs for one kind of file (`name`, `ext`), over the settings window. */
  function fileDeps(name: string, ext: string): LayoutFileDeps {
    const parent = openSettingsWindowHandle()
    const filters = [{ name, extensions: [ext] }]
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
      // The settings window says it too: the sidebar's eye, the status chip (R35).
      sendToSettingsWindow(IPC.autoHidden, {
        widget: id,
        hidden: state.hidden,
        reason: state.hidden ? state.reason : null
      })
      refreshTray()
    },
    onBests: (list) => {
      personalBests = list
      sendToSettingsWindow(IPC.personalBests, list)
    },
    onSessionKind: (kind) => {
      sessionKindNow = kind
    },
    onPlayerCar: (car) => layouts.onCar(car),
    // The standings' «Orden de las clases» lists this session's classes (9).
    onSessionClasses: (names) => {
      sessionClasses = names
      sendToSettingsWindow(IPC.sessionClasses, names)
    },
    // An import's bests (R40): how it went, under «Importar todo».
    onBestsMerged: (taken, skipped) =>
      sendToSettingsWindow(IPC.layoutNotice, { kind: 'backup-bests-merged', taken, skipped })
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
        default: {
          // «Más acciones» (R52): the widget's «Visible», as its eye in the sidebar or the tray.
          const id = widgetOfAction(action)
          if (id !== null) setWidgetVisible(id, !store.settings.widgets[id].visible)
        }
      }
      afterShortcut(action)
    },
    // Esc: said as Ctrl+Shift+E off is, on its row and over the game (R37).
    onExitEdit: () => {
      setEditMode(false)
      afterShortcut('exitEdit')
    },
    // The arrows in edit mode (R38): the widget last touched, 1 px (Shift: 10), Ctrl: its size.
    // Tab and Shift+Tab pick the widget the arrows move, Ctrl+Z puts the last change back.
    onNudge: (key) => editKey(key),
    onStatus: (next) => {
      sendToSettingsWindow(IPC.shortcutStatus, next)
      // The tray says how many do not work (R37).
      refreshTray()
    },
    onButtonsWanted: (wanted) => input.setWanted(wanted),
    // A reader that gave up (or could not read controllers) gets another go.
    onCaptureStart: () => input.retry()
  })
  /** The confirmation over the game (made the first time a shortcut runs). */
  const osd = new OsdWindow()

  /**
   * An edit-mode key (R38): the arrows move the widget last touched, 1 px (Shift: 10), Ctrl: its
   * size; Tab and Shift+Tab pick the widget the arrows move, Ctrl+Z puts the last change back.
   * From the global shortcuts over the game, and from the settings window where its focus is free.
   */
  function editKey(key: string): void {
    const m = messagesFor(store.settings.appearance.language)
    const t = m.core.osd
    const toasts = store.settings.settingsWindow.shortcutToasts
    const dir = PICK_KEYS[key]
    if (dir !== undefined) {
      const id = windows.pick(dir)
      if (!toasts) return
      osd.show(
        id === null
          ? { text: t.pickedNone, detail: '' }
          : { text: t.picked(widgetTitle(m, id)), detail: t.pickedDetail },
        gameArea()
      )
      return
    }
    if (key === EDIT_UNDO_KEY) {
      // Said as it was made: a move or a resize, seen before it goes back.
      const last = windows.lastEdit()
      const said = last === undefined ? '' : editStepText(m, last, windows.rectOf(last.id))
      const done = windows.undoEdit()
      if (done !== null) noticeUndo.drop()
      if (!toasts) return
      osd.show(
        {
          text: done === null ? t.editUndoNone : t.editUndone(said),
          detail: done === null ? '' : t.pickedDetail
        },
        gameArea()
      )
      return
    }
    const step = NUDGE_KEYS[key]
    if (step === undefined) return
    if (windows.nudge(step) !== null || !toasts) return
    osd.show({ text: t.nudgeNone, detail: t.nudgeNoneDetail }, gameArea())
  }
  // Whatever takes the keys away from the settings page ends a capture there.
  onSettingsWindowInactive(() => shortcuts.stopCapture())
  // The arrows are the settings window's own while it is in front (its sliders, lists and
  // fields); edit mode takes them only from the other programs (R38). Where its focus is free,
  // the window passes them on ('edit-key', settings/editKeys.ts).
  app.on('browser-window-focus', () => shortcuts.setNudgeBlocked(isSettingsWindowFocused()))
  app.on('browser-window-blur', () => shortcuts.setNudgeBlocked(isSettingsWindowFocused()))

  /**
   * After a shortcut ran: its row on the shortcuts page says so, and a short confirmation over
   * the game says what it did, or why nothing changed that you can see (R37).
   */
  function afterShortcut(action: UsedShortcut): void {
    sendToSettingsWindow(IPC.shortcutUsed, action)
    const s = store.settings
    const hidden = windows.autoHiddenReasons()
    const msg = shortcutConfirmation(messagesFor(s.appearance.language), action, s, {
      overlayHidden: windows.userHidden,
      editMode: windows.editMode,
      allHiddenBy: commonHiddenReason({ settings: s, autoHidden: hidden }),
      deltaHeld: hidden.delta !== undefined,
      inSession: sessionKindNow !== null,
      autoHidden: hidden
    })
    if (msg) osd.show(msg, gameArea())
  }

  /** The work area of the display the game is on (osdPlace.gameDisplay): the widgets' one. */
  function gameArea(): Rect | undefined {
    try {
      const s = store.settings
      const displays = screen.getAllDisplays().map((d) => ({
        id: d.id,
        bounds: d.bounds,
        workArea: d.workArea,
        scaleFactor: d.scaleFactor
      }))
      const on = WIDGET_IDS.filter((id) => s.widgets[id].visible).map((id) => s.widgets[id].bounds)
      return gameDisplay(on, displays, screen.getPrimaryDisplay().id)?.workArea
    } catch {
      return undefined
    }
  }

  function trayState(): TrayState {
    return {
      status,
      settings: store.settings,
      editMode: windows.editMode,
      overlayHidden: windows.userHidden,
      autoHidden: windows.autoHiddenReasons(),
      carId: layouts.car?.carId ?? null,
      carName: layouts.car?.carName ?? '',
      shortcutsFailing: Object.values(shortcuts.report.actions).filter((a) => a === 'unavailable')
        .length,
      undo: noticeUndo.label(messagesFor(store.settings.appearance.language))
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
    setSettingsWindowZoom(store.settings.appearance.settingsZoom)
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
    // An import's or a reset's «Deshacer» goes with the first change after it.
    noticeUndo.prune()
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

  /** The tray's "Mostrar el overlay": the same setting as Visibilidad. */
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

  /** The widget's bounds set from the settings window (an undone reset, a free «Escala»). */
  function setBounds(id: WidgetId, bounds: unknown): void {
    const prev = store.settings
    store.update((s) => {
      Object.assign(s, setWidgetBounds(s, id, bounds))
    })
    windows.reloadBounds(id)
    syncSettings(prev)
  }

  /** Back to the widget's default options; bounds only move if the reset touched them. */
  function resetOptions(id: WidgetId, part?: WidgetResetPart): void {
    const before = store.settings.widgets[id].bounds
    changeSettings((s) => {
      Object.assign(s, resetWidgetOptions(s, id, part))
    })
    if (!rectsEqual(before, store.settings.widgets[id].bounds)) windows.reloadBounds(id)
  }

  function openSettingsFolder(): void {
    void shell.openPath(userData).then((err) => {
      if (err) console.warn(`[main] could not open ${userData}: ${err}`)
    })
  }

  /**
   * «Traer todos los widgets a esta pantalla» (R51): every widget on another display, or left on
   * one that is unplugged, to the display at `point` (the tray: where the cursor is; the
   * settings window: its own), at the same relative place. One change, then the windows move;
   * the settings window is told how many moved, with a «Deshacer» main keeps (the tray has it
   * too); from the tray, the confirmation over that display says it as well.
   */
  function gatherWidgets(point: { x: number; y: number }, to: 'window' | 'cursor'): void {
    const all = screen.getAllDisplays().map((d) => ({
      id: d.id,
      bounds: d.bounds,
      workArea: d.workArea,
      scaleFactor: d.scaleFactor
    }))
    const near = screen.getDisplayNearestPoint(point)
    const target = all.find((d) => d.id === near.id)
    if (!target) return
    const s = store.settings
    const moved = gatherBounds(
      Object.fromEntries(WIDGET_IDS.map((id) => [id, s.widgets[id].bounds])) as Record<
        WidgetId,
        Rect
      >,
      all,
      target
    )
    const count = Object.keys(moved).length
    let undo: number | null = null
    if (count > 0) {
      const before = placeWidgets(moved)
      const layoutId = store.settings.savedLayouts.activeId
      undo = noticeUndo.keep(
        (m) =>
          to === 'cursor' ? m.settings.layouts.screens.undoCursor : m.settings.layouts.screens.undo,
        () => {
          // Another layout since: its places are not the ones to put back.
          if (store.settings.savedLayouts.activeId === layoutId) placeWidgets(before)
        }
      )
    }
    console.log(`[main] gathered ${count} widget(s) on display ${target.id}`)
    sendToSettingsWindow(IPC.layoutNotice, { kind: 'gathered', count, to, undo })
    if (to === 'cursor' && store.settings.settingsWindow.shortcutToasts) {
      const t = messagesFor(store.settings.appearance.language).core.osd
      osd.show(
        count > 0
          ? { text: t.gathered(count), detail: t.gatheredDetail }
          : { text: t.gatheredNone, detail: '' },
        target.workArea
      )
    }
  }

  /**
   * Every setting replaced by `next` at once (an import, «Restablecer todo», their «Deshacer»):
   * what waits to be saved is written first, then every widget window takes its new place and
   * the rest follows as after any change. Returns the settings it replaced.
   */
  function replaceSettings(next: OverlaySettings): OverlaySettings {
    windows.flushPendingSaves()
    const prev = store.settings
    store.update((draft) => {
      Object.assign(draft, structuredClone(next))
    })
    windows.reloadBoundsOf(WIDGET_IDS, true)
    syncSettings(prev)
    layouts.afterChange(prev)
    return prev
  }

  /** «Exportar todo» (R40): every setting and the personal bests to the file the user picks. */
  async function exportEverything(): Promise<void> {
    const r = await exportBackup(store.settings, app.getVersion(), new Date(), backupDeps())
    if (r === null) return
    sendToSettingsWindow(
      IPC.layoutNotice,
      r.ok ? { kind: 'backup-exported', file: r.file } : { kind: 'backup-export-failed' }
    )
  }

  /**
   * «Importar todo» (R40): the file's settings in effect at once, with «Deshacer» (the settings
   * as they were; the bests merged stay: none was lost), its personal bests merged.
   */
  async function importEverything(): Promise<void> {
    const read = await readBackup(backupDeps())
    if (read === null) return
    if (!read.ok) {
      sendToSettingsWindow(IPC.layoutNotice, { kind: 'backup-import-failed', error: read.error })
      return
    }
    const before = replaceSettings(importedSettings(read))
    const undo = keepSettingsUndo(before, (m) => m.settings.about.backup.undoImport)
    // The telemetry process merges them and says how it went (onBestsMerged); none running:
    // the notice says they were not added, the file can be imported again.
    const bests =
      read.bests === null ? 'none' : telemetry.mergeBests(read.bests) ? 'merging' : 'not-merged'
    console.log(`[main] settings imported from a backup (bests: ${bests})`)
    sendToSettingsWindow(IPC.layoutNotice, { kind: 'backup-imported', bests, undo })
  }

  /**
   * The «Deshacer» of an import or a reset: `before` back, but only while nothing has changed
   * since (another change would be lost with it): the next change drops the offer
   * (noticeUndo.prune in syncSettings).
   */
  function keepSettingsUndo(before: OverlaySettings, what: (m: Messages) => string): number {
    const base = { after: store.settings }
    settingsUndoBase = base
    return noticeUndo.keep(
      what,
      () => void replaceSettings(before),
      () => store.settings === base.after
    )
  }

  /** «Restablecer todo» (R40): a new install's settings, in the language in use; «Deshacer». */
  function resetEverything(): void {
    // Placed as a first run places them: centred on an ultrawide primary screen.
    const before = replaceSettings(
      factorySettings(store.settings, screen.getPrimaryDisplay().workArea)
    )
    const undo = keepSettingsUndo(before, (m) => m.settings.about.reset.undo)
    console.log('[main] every setting reset')
    sendToSettingsWindow(IPC.layoutNotice, { kind: 'reset-all', undo })
  }

  /** Widgets to `bounds` (one change, the windows moved); what they were, to put them back. */
  function placeWidgets(bounds: Partial<Record<WidgetId, Rect>>): Partial<Record<WidgetId, Rect>> {
    const prev = store.settings
    let before: Partial<Record<WidgetId, Rect>> = {}
    store.update((draft) => {
      const r = moveWidgets(draft, bounds)
      before = r.before
      Object.assign(draft, r.settings)
    })
    windows.reloadBoundsOf(Object.keys(bounds) as WidgetId[])
    syncSettings(prev)
    return before
  }

  /** The centre of the settings window (the primary display's when it is not open). */
  function settingsWindowPoint(): { x: number; y: number } {
    const w = openSettingsWindowHandle()
    if (!w) return screen.getPrimaryDisplay().workArea
    const b = w.getBounds()
    return { x: b.x + b.width / 2, y: b.y + b.height / 2 }
  }

  /** A first run: a Windows notification says where OverLap is (no window stays open). */
  function sayInTheTray(): void {
    try {
      if (!Notification.isSupported()) return
      const t = messagesFor(store.settings.appearance.language).core.firstRun
      new Notification({ title: t.title, body: t.body, silent: true }).show()
    } catch (err) {
      console.warn('[main] first-run notification:', err)
    }
  }

  /** overlap.log, in the system's text viewer (the folder when there is no log yet). */
  function openLog(): void {
    const file = join(userData, 'overlap.log')
    void shell.openPath(file).then((err) => {
      if (!err) return
      console.warn(`[main] could not open ${file}: ${err}`)
      openSettingsFolder()
    })
  }

  /** What support needs to know, on the clipboard (the settings window's «Copiar diagnóstico»). */
  function copyDiagnostics(): void {
    clipboard.writeText(
      diagnosticsText({
        version: app.getVersion(),
        versions: process.versions,
        os: `${osType()} ${osRelease()} ${process.arch}`,
        status,
        editMode: windows.editMode,
        overlayHidden: windows.userHidden,
        settings: store.settings,
        autoHidden: windows.autoHiddenReasons(),
        shortcuts: shortcuts.report,
        displays: screen.getAllDisplays().map((d) => ({
          bounds: d.bounds,
          scaleFactor: d.scaleFactor,
          primary: d.id === screen.getPrimaryDisplay().id
        })),
        saveFailing: store.saveFailing,
        settingsFile: store.file,
        logFile: join(userData, 'overlap.log'),
        home: app.getPath('home')
      })
    )
    console.log('[main] diagnostics copied to the clipboard')
  }

  /** Tray, shortcut, settings window: entering edit mode shows a hidden overlay first. */
  function setEditMode(on: boolean): void {
    changeModes(() => windows.setEditMode(on))
    // Edit mode's «Deshacer» goes with it (its changes are forgotten, R38).
    if (!on) noticeUndo.prune()
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
      autoHidden: windows.autoHiddenMap(),
      overlayHidden: windows.userHidden,
      shortcutStatus: shortcuts.report,
      cursorHidden: windows.cursorHidden,
      currentCar: layouts.car,
      sessionClasses,
      saveFailing: store.saveFailing,
      appVersion: app.getVersion()
    }
  })
  ipcMain.handle(IPC.updateSettings, (event, patch: unknown, forLayout: unknown) => {
    // One line per change from the settings window: what it touched, and whether it was taken.
    const keys =
      patch !== null && typeof patch === 'object' ? Object.keys(patch).join(',') : typeof patch
    if (!isSettingsSender(event.sender)) {
      console.warn(`[settings] change refused (not the settings window): ${keys}`)
      throw new Error(`${IPC.updateSettings} is only accepted from the settings window`)
    }
    const prev = store.settings
    // Made for a layout no longer in use (switched while it was on its way): kept in that one.
    changeSettings((s) => {
      Object.assign(s, applySettingsPatchFor(s, patch, forLayout))
    })
    // «Tamaño del texto» resizes the free-size widgets' windows (scaleFreeWindows).
    const resized = WIDGET_IDS.filter(
      (id) => !rectsEqual(prev.widgets[id].bounds, store.settings.widgets[id].bounds)
    )
    if (resized.length > 0) windows.reloadBoundsOf(resized)
    console.log(
      `[settings] change: ${keys}${typeof forLayout === 'string' ? ` (layout ${forLayout})` : ''}`
    )
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
        // «Editar posición» on a widget's page: that panel is pointed out (R25).
        if (raw.on && raw.focus !== undefined) windows.focusWidget(raw.focus)
        break
      // The settings window in front passes them on where its focus is free (R38).
      case 'edit-key':
        if (windows.editMode) editKey(raw.key)
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
        resetOptions(raw.widgetId, raw.part)
        break
      case 'set-widget-bounds':
        setBounds(raw.widgetId, raw.bounds)
        break
      case 'open-settings-folder':
        openSettingsFolder()
        break
      case 'open-log':
        openLog()
        break
      case 'backup-export':
        exportEverything().catch((err: unknown) => console.error('[main] export:', err))
        break
      case 'backup-import':
        importEverything().catch((err: unknown) => console.error('[main] import:', err))
        break
      case 'reset-all':
        resetEverything()
        break
      // Fixed addresses (the project's, projectLinks.ts), never one the page sends.
      case 'open-help': {
        const url = projectUrl(raw.page, undefined, store.settings.appearance.language)
        if (url !== null) void shell.openExternal(url)
        break
      }
      case 'copy-diagnostics':
        copyDiagnostics()
        break
      case 'gather-widgets':
        gatherWidgets(settingsWindowPoint(), 'window')
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
      case 'undo-notice':
        noticeUndo.run(raw.id)
        break
    }
  })

  windows.start()
  telemetry.start()
  createTray(trayState(), {
    openSettings: (page) => openSettingsWindow(page),
    applyLayout: (id) => void layouts.choose(id),
    // From the tray the settings window may be closed: the confirmation over the game says what
    // it did, and the tray's «Deshacer» undoes «Según el coche» going on (R26, R37).
    linkCar: (car, layoutId) => {
      const wasAuto = store.settings.layouts.autoSwitch
      layouts
        .command({ type: 'layout-link-car', car, layoutId })
        .then(() => {
          const s = store.settings
          if (!s.settingsWindow.shortcutToasts) return
          const t = messagesFor(s.appearance.language).core.osd
          const name = s.savedLayouts.list.find((l) => l.id === layoutId)?.name ?? ''
          osd.show(
            !wasAuto && s.layouts.autoSwitch
              ? { text: t.autoOn, detail: t.linked(car.carName, name) }
              : { text: t.linked(car.carName, name), detail: '' },
            gameArea()
          )
        })
        .catch((err: unknown) => console.error('[main] link car:', err))
    },
    undo: () => void noticeUndo.run(),
    setWidgetVisible,
    setRadarRange,
    setShowWhen,
    setEditMode,
    setOverlayHidden,
    openSettingsFolder,
    gatherWidgets: () => gatherWidgets(screen.getCursorScreenPoint(), 'cursor'),
    quit: () => app.quit()
  })
  // `--settings` (e.g. a desktop shortcut) opens the settings window on start. A first run
  // opens it on the welcome (R07): language and units, which widgets, where everything is; and
  // Windows says once, in the system's language, that OverLap lives in the tray.
  if (store.fresh) sayInTheTray()
  if (store.fresh || process.argv.includes('--settings')) openSettingsWindow()

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
    safe('close the shortcut confirmation', () => osd.dispose())
    safe('forget the undo', () => noticeUndo.dispose())
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
