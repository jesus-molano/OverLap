import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope, nextTick } from 'vue'
import type { InitialState, OverlayLayout, OverlayPanel } from '@shared/ipc'
import type { BattleData, StandingsData } from '@shared/types'
import { SETTINGS_VERSION, createDefaultSettings } from '@shared/settings'
import type { WidgetId } from '@shared/widgets'
import {
  LIVE_STATUS,
  WAITING_STATUS,
  createFakeOverlay,
  flush,
  settingsWith,
  type FakeOverlay
} from './testing/fakeOverlay'

type Module = typeof import('./useOverlay')

let fake: FakeOverlay
let mod: Module

const STANDINGS: StandingsData = {
  header: {
    sessionType: 'Race',
    lapsRemaining: 10,
    timeRemainingS: null,
    iRating: null,
    safetyRating: null,
    incidents: null
  },
  classes: [],
  info: null,
  multiBrand: false
}

const BATTLE: BattleData = {
  visible: true,
  lapsRemaining: null,
  playerLastLaps: [],
  ahead: null,
  behind: null,
  multiBrand: false
}

function panel(widget: WidgetId): OverlayPanel {
  return { widget, rect: { x: 10, y: 20, width: 300, height: 200 }, placement: 0 }
}

function layout(revision: number, widgets: WidgetId[]): OverlayLayout {
  return {
    revision,
    session: 1,
    ackSeq: 0,
    display: {
      id: 7,
      index: 1,
      bounds: { x: 0, y: 0, width: 1920, height: 1080 },
      workArea: { x: 0, y: 0, width: 1920, height: 1040 },
      scaleFactor: 1
    },
    panels: widgets.map(panel)
  }
}

async function load(init: Partial<InitialState> = {}): Promise<void> {
  vi.resetModules()
  fake = createFakeOverlay(init)
  vi.stubGlobal('window', { overlay: fake })
  mod = await import('./useOverlay')
}

beforeEach(async () => {
  await load()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('useOverlayState', () => {
  it('registers the listeners once per window', async () => {
    const a = mod.useOverlayState()
    const b = mod.useOverlayState()
    expect(a).toBe(b)
    expect(a).toBe(mod.overlayState)
    expect(fake.listenerCount()).toBe(9)
    await flush()
    expect(a.status.value).toEqual(LIVE_STATUS)
    expect(a.settings.value?.version).toBe(SETTINGS_VERSION)
  })

  it('keeps events newer than the initial state', async () => {
    const s = mod.useOverlayState()
    fake.status.emit(WAITING_STATUS)
    fake.editMode.emit(true)
    fake.overlayHidden.emit(true)
    fake.shortcutStatus.emit({
      actions: {
        toggleOverlay: 'unavailable',
        toggleEditMode: 'ok',
        cycleDeltaReference: 'disabled',
        nextLayout: 'disabled',
        openSettings: 'disabled'
      },
      unavailable: ['Ctrl+Shift+H']
    })
    await flush()
    expect(s.status.value).toEqual(WAITING_STATUS)
    expect(s.editMode.value).toBe(true)
    expect(s.overlayHidden.value).toBe(true)
    expect(s.shortcutStatus.value).toEqual({
      actions: {
        toggleOverlay: 'unavailable',
        toggleEditMode: 'ok',
        cycleDeltaReference: 'disabled',
        nextLayout: 'disabled',
        openSettings: 'disabled'
      },
      unavailable: ['Ctrl+Shift+H']
    })
  })

  it('takes the hidden overlay and the shortcuts status from the initial state', async () => {
    await load({
      overlayHidden: true,
      shortcutStatus: {
        actions: {
          toggleOverlay: 'ok',
          toggleEditMode: 'disabled',
          cycleDeltaReference: 'disabled',
          nextLayout: 'disabled',
          openSettings: 'disabled'
        },
        unavailable: []
      }
    })
    const s = mod.useOverlayState()
    expect(s.overlayHidden.value).toBe(false)
    expect(s.shortcutStatus.value).toBeNull()
    await flush()
    expect(s.overlayHidden.value).toBe(true)
    expect(s.shortcutStatus.value).toEqual({
      actions: {
        toggleOverlay: 'ok',
        toggleEditMode: 'disabled',
        cycleDeltaReference: 'disabled',
        nextLayout: 'disabled',
        openSettings: 'disabled'
      },
      unavailable: []
    })
    fake.overlayHidden.emit(false)
    expect(s.overlayHidden.value).toBe(false)
  })

  it('takes the hidden cursor from the initial state, unless a push came first', async () => {
    await load({ cursorHidden: true })
    const s = mod.useOverlayState()
    expect(s.cursorHidden.value).toBe(false)
    await flush()
    expect(s.cursorHidden.value).toBe(true)
    fake.cursorHidden.emit(false)
    expect(s.cursorHidden.value).toBe(false)

    await load({ cursorHidden: false })
    const t = mod.useOverlayState()
    fake.cursorHidden.emit(true)
    await flush()
    expect(t.cursorHidden.value).toBe(true)
  })
})

describe('auto-hidden states', () => {
  it('tracks each widget and ignores repeats', () => {
    const s = mod.useOverlayState()
    expect(s.autoHiddenOf.standings.value).toBe(mod.NOT_AUTO_HIDDEN)
    fake.autoHidden.emit({ widget: 'standings', hidden: true, reason: 'practice' })
    const first = s.autoHiddenOf.standings.value
    expect(first).toEqual({ hidden: true, reason: 'practice' })
    expect(Object.isFrozen(first)).toBe(true)
    // Another widget's state is its own.
    expect(s.autoHiddenOf.battle.value).toBe(mod.NOT_AUTO_HIDDEN)
    fake.autoHidden.emit({ widget: 'standings', hidden: true, reason: 'practice' })
    expect(s.autoHiddenOf.standings.value).toBe(first)
    fake.autoHidden.emit({ widget: 'standings', hidden: false, reason: null })
    expect(s.autoHiddenOf.standings.value).toBe(mod.NOT_AUTO_HIDDEN)
    expect(mod.useAutoHidden('standings')).toBe(s.autoHiddenOf.standings)
    expect(Object.isFrozen(s.autoHiddenOf)).toBe(true)
  })

  it('takes the initial map, unless a push for that widget came first', async () => {
    await load({
      autoHidden: {
        battle: { hidden: true, reason: 'practice' },
        standings: { hidden: true, reason: 'pits' }
      }
    })
    const s = mod.useOverlayState()
    fake.autoHidden.emit({ widget: 'standings', hidden: false, reason: null })
    await flush()
    expect(s.autoHiddenOf.battle.value).toEqual({ hidden: true, reason: 'practice' })
    expect(s.autoHiddenOf.standings.value).toBe(mod.NOT_AUTO_HIDDEN)
    expect(s.autoHiddenOf.radar.value).toBe(mod.NOT_AUTO_HIDDEN)
  })
})

describe('layout', () => {
  it('keeps the highest revision, from the initial state or a push', async () => {
    await load({ view: { kind: 'overlay' }, layout: layout(5, ['radar']) })
    const s = mod.useOverlayState()
    const pushed = layout(6, ['radar', 'inputs'])
    fake.layout.emit(pushed)
    await flush()
    // The initial state resolved after the push: its older layout is ignored.
    expect(s.layout.value).toBe(pushed)
    fake.layout.emit(layout(4, []))
    expect(s.layout.value).toBe(pushed)
    const next = layout(9, ['radar'])
    fake.layout.emit(next)
    expect(s.layout.value).toBe(next)
  })

  it('holds a layout applied until its settings arrive, then takes both in one go', async () => {
    await load({ view: { kind: 'overlay' }, layout: layout(5, ['radar']) })
    const s = mod.useOverlayState()
    await flush()
    const first = s.layout.value
    // The places come first, a widget shown by the same change next, then the options.
    fake.layout.emit({ ...layout(6, ['radar']), settingsFollow: true })
    const shown = layout(7, ['radar', 'inputs'])
    fake.layout.emit(shown)
    expect(s.layout.value).toBe(first)
    const settings = settingsWith(createDefaultSettings(), (x) => (x.radar.rangeM = 12))
    fake.settings.emit(settings)
    expect(s.settings.value).toBe(settings)
    expect(s.layout.value).toBe(shown)
    // Anything later is taken at once again.
    const after = layout(8, ['radar'])
    fake.layout.emit(after)
    expect(s.layout.value).toBe(after)
  })

  it('takes a held layout anyway when its settings never come', async () => {
    vi.useFakeTimers()
    try {
      await load({ view: { kind: 'overlay' }, layout: layout(5, ['radar']) })
      const s = mod.useOverlayState()
      await vi.advanceTimersByTimeAsync(0)
      const held = { ...layout(6, ['inputs']), settingsFollow: true as const }
      fake.layout.emit(held)
      expect(s.layout.value?.revision).toBe(5)
      vi.advanceTimersByTime(mod.SETTINGS_FOLLOW_WAIT_MS)
      expect(s.layout.value).toBe(held)
    } finally {
      vi.useRealTimers()
    }
  })

  it('takes the initial layout when nothing newer came', async () => {
    const init = layout(3, ['standings'])
    await load({ view: { kind: 'overlay' }, layout: init })
    const s = mod.useOverlayState()
    expect(s.layout.value).toBeNull()
    await flush()
    expect(s.layout.value).toBe(init)
  })
})

describe('useWidgetData', () => {
  it('keeps the payload of its own widget only', async () => {
    const scope = effectScope()
    const data = scope.run(() => mod.useWidgetData('standings'))!
    await flush()
    fake.data.emit({ widget: 'standings', payload: STANDINGS })
    expect(data.value).toBe(STANDINGS)
    fake.data.emit({ widget: 'inputs', payload: {} as never })
    expect(data.value).toBe(STANDINGS)
    scope.stop()
  })

  it('drops every payload when the connection stops being live', async () => {
    const scope = effectScope()
    const data = scope.run(() => mod.useWidgetData('standings'))!
    await flush()
    fake.data.emit({ widget: 'standings', payload: STANDINGS })
    fake.data.emit({ widget: 'battle', payload: BATTLE })
    fake.status.emit(WAITING_STATUS)
    await nextTick()
    expect(data.value).toBeNull()
    expect(mod.overlayState.latest.battle.value).toBeNull()
    scope.stop()
  })

  it('drops only the payload of the widget a visibility rule hides', async () => {
    const scope = effectScope()
    const data = scope.run(() => mod.useWidgetData('standings'))!
    await flush()
    fake.data.emit({ widget: 'standings', payload: STANDINGS })
    fake.data.emit({ widget: 'battle', payload: BATTLE })
    fake.autoHidden.emit({ widget: 'standings', hidden: true, reason: 'pits' })
    await nextTick()
    expect(data.value).toBeNull()
    expect(mod.overlayState.latest.battle.value).toBe(BATTLE)
    scope.stop()
  })

  it('drops the payload of a widget the window no longer hosts', async () => {
    await load({ view: { kind: 'overlay' }, layout: layout(1, ['standings', 'battle']) })
    const s = mod.useOverlayState()
    await flush()
    fake.data.emit({ widget: 'standings', payload: STANDINGS })
    fake.data.emit({ widget: 'battle', payload: BATTLE })
    fake.layout.emit(layout(2, ['battle']))
    expect(s.latest.standings.value).toBeNull()
    expect(s.latest.battle.value).toBe(BATTLE)
  })

  it('drops the payload of a widget the window now hosts as a ghost (disabled)', async () => {
    await load({ view: { kind: 'overlay' }, layout: layout(1, ['standings', 'battle']) })
    const s = mod.useOverlayState()
    await flush()
    fake.data.emit({ widget: 'standings', payload: STANDINGS })
    fake.data.emit({ widget: 'battle', payload: BATTLE })
    const next = layout(2, ['standings', 'battle'])
    next.panels[0] = { ...panel('standings'), ghost: true }
    fake.layout.emit(next)
    expect(s.latest.standings.value).toBeNull()
    expect(s.latest.battle.value).toBe(BATTLE)
  })

  it('drops the payload of a widget the initial map hides', async () => {
    await load({ autoHidden: { standings: { hidden: true, reason: 'pits' } } })
    const s = mod.useOverlayState()
    fake.data.emit({ widget: 'standings', payload: STANDINGS })
    await flush()
    expect(s.latest.standings.value).toBeNull()
  })

  it('keeps a payload handed over before any widget or the initial state exists', async () => {
    mod.useOverlayState()
    fake.status.emit(LIVE_STATUS)
    fake.data.emit({ widget: 'standings', payload: STANDINGS })
    await flush()
    // The widget component is created later (async chunk): the payload is still there.
    const data = mod.useWidgetData('standings')
    expect(data.value).toBe(STANDINGS)
    // A reconnection is a new stream: nothing from before survives it.
    fake.status.emit(WAITING_STATUS)
    fake.data.emit({ widget: 'standings', payload: STANDINGS })
    fake.status.emit(LIVE_STATUS)
    expect(data.value).toBeNull()
  })

  it('unsubscribes when its scope stops (no leaked IPC listener)', () => {
    mod.useOverlayState()
    const base = fake.listenerCount()
    for (let i = 0; i < 50; i++) {
      const scope = effectScope()
      scope.run(() => {
        mod.useWidgetData('standings')
        mod.useAutoHidden('standings')
      })
      scope.stop()
    }
    expect(fake.listenerCount()).toBe(base)
  })
})

describe('isLive', () => {
  it('is true for connected and mock only', () => {
    expect(mod.isLive(LIVE_STATUS)).toBe(true)
    expect(mod.isLive({ ...LIVE_STATUS, state: 'connected' })).toBe(true)
    expect(mod.isLive(WAITING_STATUS)).toBe(false)
    expect(mod.isLive(null)).toBe(false)
  })
})
