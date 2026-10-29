/**
 * Test double of `window.overlay` (the preload API) for composable tests in the node
 * environment: records what the renderer sends and lets a test push what main would.
 */
import type {
  AutoHiddenMessage,
  BoundsCommit,
  DragStateMessage,
  EditChipsMessage,
  InitialState,
  LayoutNotice,
  OverlayApi,
  OverlayLayout,
  ScaleStepMessage,
  SettingsCommand,
  SettingsWindowPage,
  WidgetToggleMessage
} from '@shared/ipc'
import type { PersonalBestList } from '@shared/delta/references'
import type { ShortcutStatusMap } from '@shared/shortcuts'
import { createDefaultSettings } from '@shared/settings'
import type { CarRef, OverlaySettings, OverlayStatus, WidgetDataMessage } from '@shared/types'

type Listener<T> = (value: T) => void

class Channel<T> {
  readonly listeners = new Set<Listener<T>>()
  on(cb: Listener<T>): () => void {
    this.listeners.add(cb)
    return () => {
      this.listeners.delete(cb)
    }
  }
  emit(value: T): void {
    for (const cb of [...this.listeners]) cb(value)
  }
}

export const LIVE_STATUS: OverlayStatus = {
  state: 'mock',
  source: 'mock',
  note: 'none',
  detail: ''
}
export const WAITING_STATUS: OverlayStatus = {
  state: 'waiting',
  source: 'iracing',
  note: 'none',
  detail: ''
}

export interface FakeOverlay extends OverlayApi {
  readonly data: Channel<WidgetDataMessage>
  readonly status: Channel<OverlayStatus>
  readonly editMode: Channel<boolean>
  readonly settings: Channel<OverlaySettings>
  readonly autoHidden: Channel<AutoHiddenMessage>
  readonly layout: Channel<OverlayLayout>
  readonly personalBests: Channel<PersonalBestList>
  readonly overlayHidden: Channel<boolean>
  readonly shortcutStatus: Channel<ShortcutStatusMap>
  readonly cursorHidden: Channel<boolean>
  readonly currentCar: Channel<CarRef | null>
  readonly layoutNotice: Channel<LayoutNotice>
  readonly settingsPage: Channel<SettingsWindowPage>
  readonly sent: {
    commitBounds: BoundsCommit[]
    scaleStep: ScaleStepMessage[]
    dragState: DragStateMessage[]
    widgetToggle: WidgetToggleMessage[]
    editChips: EditChipsMessage[]
    commands: SettingsCommand[]
  }
  /** Registered listeners over every channel (leak checks). */
  listenerCount(): number
}

export function createFakeOverlay(init: Partial<InitialState> = {}): FakeOverlay {
  const data = new Channel<WidgetDataMessage>()
  const status = new Channel<OverlayStatus>()
  const editMode = new Channel<boolean>()
  const settings = new Channel<OverlaySettings>()
  const autoHidden = new Channel<AutoHiddenMessage>()
  const layout = new Channel<OverlayLayout>()
  const personalBests = new Channel<PersonalBestList>()
  const overlayHidden = new Channel<boolean>()
  const shortcutStatus = new Channel<ShortcutStatusMap>()
  const cursorHidden = new Channel<boolean>()
  const currentCar = new Channel<CarRef | null>()
  const layoutNotice = new Channel<LayoutNotice>()
  const settingsPage = new Channel<SettingsWindowPage>()
  const sent: FakeOverlay['sent'] = {
    commitBounds: [],
    scaleStep: [],
    dragState: [],
    widgetToggle: [],
    editChips: [],
    commands: []
  }
  const initial: InitialState = {
    view: { kind: 'overlay' },
    editMode: false,
    status: LIVE_STATUS,
    settings: createDefaultSettings(),
    layout: null,
    autoHidden: {},
    overlayHidden: false,
    shortcutStatus: {
      toggleOverlay: 'ok',
      toggleEditMode: 'ok',
      cycleDeltaReference: 'disabled',
      nextLayout: 'disabled',
      openSettings: 'disabled'
    },
    cursorHidden: false,
    currentCar: null,
    ...init
  }
  return {
    data,
    status,
    editMode,
    settings,
    autoHidden,
    layout,
    personalBests,
    overlayHidden,
    shortcutStatus,
    cursorHidden,
    currentCar,
    layoutNotice,
    settingsPage,
    sent,
    listenerCount: () =>
      data.listeners.size +
      status.listeners.size +
      editMode.listeners.size +
      settings.listeners.size +
      autoHidden.listeners.size +
      layout.listeners.size +
      personalBests.listeners.size +
      overlayHidden.listeners.size +
      shortcutStatus.listeners.size +
      cursorHidden.listeners.size +
      currentCar.listeners.size +
      layoutNotice.listeners.size +
      settingsPage.listeners.size,
    getInitialState: () => Promise.resolve(initial),
    onData: (cb) => data.on(cb),
    onStatus: (cb) => status.on(cb),
    onEditMode: (cb) => editMode.on(cb),
    onSettings: (cb) => settings.on(cb),
    onAutoHidden: (cb) => autoHidden.on(cb),
    onLayout: (cb) => layout.on(cb),
    onPersonalBests: (cb) => personalBests.on(cb),
    onOverlayHidden: (cb) => overlayHidden.on(cb),
    onShortcutStatus: (cb) => shortcutStatus.on(cb),
    onCursorHidden: (cb) => cursorHidden.on(cb),
    onCurrentCar: (cb) => currentCar.on(cb),
    onLayoutNotice: (cb) => layoutNotice.on(cb),
    onSettingsPage: (cb) => settingsPage.on(cb),
    commitBounds: (msg) => void sent.commitBounds.push(msg),
    scaleStep: (msg) => void sent.scaleStep.push(msg),
    dragState: (msg) => void sent.dragState.push(msg),
    widgetToggle: (msg) => void sent.widgetToggle.push(msg),
    editChips: (msg) => void sent.editChips.push(msg),
    updateSettings: () => Promise.resolve(initial.settings),
    command: (cmd) => void sent.commands.push(cmd)
  }
}

/** Settings with some fields changed (a fresh object, like every broadcast from main). */
export function settingsWith(
  base: OverlaySettings,
  change: (s: OverlaySettings) => void
): OverlaySettings {
  const next = structuredClone(base)
  change(next)
  return next
}

/** Lets pending promise callbacks and Vue's pre-flush jobs run. */
export async function flush(): Promise<void> {
  for (let i = 0; i < 3; i++) await Promise.resolve()
}
