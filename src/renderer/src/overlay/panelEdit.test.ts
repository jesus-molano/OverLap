import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick, shallowRef, type ShallowRef } from 'vue'
import type { DragStateMessage, ScaleStepMessage } from '@shared/ipc'
import type { Rect } from '@shared/types'
import type { WidgetId } from '@shared/widgets'
import { createPanelEdit, type PanelEdit } from './panelEdit'
import {
  FakeDragElement,
  FakeFrames,
  createFakeRegistry,
  createFakeSlot,
  pointer,
  pointerDown,
  wheelEvent,
  type FakeSlot,
  type LogEntry
} from './testing/fakeEdit'
import { createEditSession, type EditSessionHandle } from './useEditSession'

const RADAR: Rect = { x: 400, y: 300, width: 200, height: 200 }
const STANDINGS: Rect = { x: 700, y: 100, width: 300, height: 400 }

interface Setup {
  log: LogEntry[]
  editing: ShallowRef<boolean>
  session: EditSessionHandle
  radar: FakeSlot
  standings: FakeSlot
  frames: FakeFrames
  dragState: DragStateMessage[]
  scaleSteps: ScaleStepMessage[]
  edit(id: WidgetId): PanelEdit
  dispose(): void
}

let s: Setup

beforeEach(() => {
  vi.useFakeTimers()
  const log: LogEntry[] = []
  const editing = shallowRef(true)
  const radar = createFakeSlot('radar', RADAR, log)
  const standings = createFakeSlot('standings', STANDINGS, log)
  standings.autoHeight.value = true
  const registry = createFakeRegistry([radar, standings])
  const dragState: DragStateMessage[] = []
  const scaleSteps: ScaleStepMessage[] = []
  const session = createEditSession({
    registry,
    editing,
    session: () => 5,
    sendDragState: (msg) => void dragState.push(msg)
  })
  const frames = new FakeFrames()
  const edits: PanelEdit[] = []
  s = {
    log,
    editing,
    session,
    radar,
    standings,
    frames,
    dragState,
    scaleSteps,
    edit(id) {
      const slot = id === 'radar' ? radar : standings
      const e = createPanelEdit({
        slot,
        session,
        minSize: id === 'radar' ? { width: 120, height: 140 } : { width: 240, height: 60 },
        sizeModel: id === 'radar' ? 'free' : 'auto-height',
        sendScaleStep: (msg) => void scaleSteps.push(msg),
        frames
      })
      edits.push(e)
      return e
    },
    dispose() {
      for (const e of edits) e.dispose()
      session.dispose()
    }
  }
})

afterEach(() => {
  s.dispose()
  expect(vi.getTimerCount()).toBe(0)
  vi.useRealTimers()
})

const commits = (): LogEntry[] => s.log.filter((e) => e[0] === 'commit')

describe('createPanelEdit: drags', () => {
  it('starts a move on the primary button, holds the lease and commits on release', () => {
    const edit = s.edit('radar')
    const el = new FakeDragElement(s.log)
    const down = pointerDown(450, 350)
    expect(edit.pointerDown(down, el, 'move')).toBe(true)
    expect(down.defaultPrevented).toBe(true)
    expect(edit.dragging.value).toBe(true)
    expect(s.dragState).toEqual([{ session: 5, dragging: true }])
    el.dispatch('pointermove', pointer('pointermove', 470, 360))
    s.frames.run()
    el.dispatch('pointerup', pointer('pointerup', 470, 360))
    expect(commits()).toEqual([['commit', 'radar', 'drag', { ...RADAR, x: 420, y: 310 }]])
    expect(edit.dragging.value).toBe(false)
    expect(s.dragState.at(-1)).toEqual({ session: 5, dragging: false })
  })

  it('starts nothing outside edit mode, when locked, or for another button', () => {
    const edit = s.edit('radar')
    const el = new FakeDragElement()
    expect(edit.pointerDown(pointerDown(450, 350, { button: 2 }), el, 'move')).toBe(false)
    expect(edit.pointerDown(pointerDown(450, 350, { isPrimary: false }), el, 'move')).toBe(false)
    s.radar.locked.value = true
    const down = pointerDown(450, 350)
    expect(edit.pointerDown(down, el, 'move')).toBe(false)
    expect(down.defaultPrevented).toBe(false)
    s.radar.locked.value = false
    s.editing.value = false
    expect(edit.pointerDown(pointerDown(450, 350), el, 'move')).toBe(false)
    expect(s.dragState).toEqual([])
    expect(el.captured.size).toBe(0)
  })

  it('lets an auto-height panel be dragged by its sides only', () => {
    const edit = s.edit('standings')
    const el = new FakeDragElement()
    expect(edit.pointerDown(pointerDown(700, 300), el, 's')).toBe(false)
    expect(edit.pointerDown(pointerDown(700, 300), el, 'se')).toBe(false)
    expect(edit.pointerDown(pointerDown(700, 300), el, 'w')).toBe(true)
  })

  it('allows one drag per window', () => {
    const radar = s.edit('radar')
    const standings = s.edit('standings')
    expect(radar.pointerDown(pointerDown(450, 350), new FakeDragElement(), 'move')).toBe(true)
    expect(standings.pointerDown(pointerDown(800, 200), new FakeDragElement(), 'move')).toBe(false)
  })

  it('snaps to the other shown panels', () => {
    const edit = s.edit('radar')
    const el = new FakeDragElement()
    edit.pointerDown(pointerDown(450, 350), el, 'move')
    // Right edge 600 + 95 = 695, 5 px from the standings' left edge (700).
    el.dispatch('pointermove', pointer('pointermove', 545, 350))
    s.frames.run()
    expect(s.radar.dragRect.value).toEqual({ ...RADAR, x: 500 })
  })

  it('ignores hidden panels as snap targets', () => {
    s.standings.shown.value = false
    const edit = s.edit('radar')
    const el = new FakeDragElement()
    edit.pointerDown(pointerDown(450, 350), el, 'move')
    el.dispatch('pointermove', pointer('pointermove', 545, 350))
    s.frames.run()
    expect(s.radar.dragRect.value).toEqual({ ...RADAR, x: 495 })
  })

  it('cancels when the panel gets locked, sending no commit', async () => {
    const edit = s.edit('radar')
    const el = new FakeDragElement()
    edit.pointerDown(pointerDown(450, 350), el, 'move')
    el.dispatch('pointermove', pointer('pointermove', 470, 360))
    s.frames.run()
    s.radar.locked.value = true
    await nextTick()
    expect(edit.dragging.value).toBe(false)
    expect(s.radar.dragRect.value).toBeNull()
    expect(commits()).toEqual([])
    expect(s.dragState.at(-1)).toEqual({ session: 5, dragging: false })
    expect(el.listenerCount()).toBe(0)
  })

  it('cancels when main moves the panel on its own (placement)', async () => {
    const edit = s.edit('radar')
    const el = new FakeDragElement()
    edit.pointerDown(pointerDown(450, 350), el, 'move')
    s.radar.placement.value = 2
    await nextTick()
    expect(edit.dragging.value).toBe(false)
    el.dispatch('pointerup', pointer('pointerup', 600, 600))
    expect(commits()).toEqual([])
  })

  it('cancels when edit mode turns off', async () => {
    const edit = s.edit('radar')
    const el = new FakeDragElement()
    edit.pointerDown(pointerDown(450, 350), el, 'move')
    el.dispatch('pointermove', pointer('pointermove', 470, 360))
    s.editing.value = false
    await nextTick()
    expect(edit.dragging.value).toBe(false)
    expect(s.frames.pending.size).toBe(0)
    expect(commits()).toEqual([])
    expect(s.dragState.at(-1)).toEqual({ session: 5, dragging: false })
  })

  it('shows the crossing state while a move is off the display', () => {
    const edit = s.edit('radar')
    const el = new FakeDragElement()
    edit.pointerDown(pointerDown(450, 350), el, 'move')
    el.dispatch('pointermove', pointer('pointermove', 2000, 350))
    s.frames.run()
    expect(edit.crossing.value).toBe(true)
    el.dispatch('pointerup', pointer('pointerup', 2000, 350))
    expect(edit.crossing.value).toBe(false)
    expect(s.log.filter((e) => e[0] === 'dropOutside')).toEqual([
      ['dropOutside', 'radar', { x: 50, y: 50 }]
    ])
  })

  it('cancels on dispose', () => {
    const edit = s.edit('radar')
    const el = new FakeDragElement()
    edit.pointerDown(pointerDown(450, 350), el, 'move')
    edit.dispose()
    expect(s.session.dragging.value).toBe(false)
    expect(el.listenerCount()).toBe(0)
    expect(edit.pointerDown(pointerDown(450, 350), el, 'move')).toBe(false)
  })
})

describe('createPanelEdit: wheel', () => {
  it('steps the scale of an auto-height widget, echoing the session', () => {
    const edit = s.edit('standings')
    const up = wheelEvent(-100, 1000)
    edit.wheel(up)
    expect(up.defaultPrevented).toBe(true)
    edit.wheel(wheelEvent(100, 1010)) // within 50 ms: dropped
    edit.wheel(wheelEvent(100, 1060))
    expect(s.scaleSteps).toEqual([
      { session: 5, widget: 'standings', step: 1 },
      { session: 5, widget: 'standings', step: -1 }
    ])
  })

  it('resizes a free widget around its centre and commits it as a wheel change', () => {
    const edit = s.edit('radar')
    edit.wheel(wheelEvent(-100, 1000))
    expect(commits()).toEqual([
      ['commit', 'radar', 'wheel', { x: 395, y: 295, width: 210, height: 210 }]
    ])
    // The next notch starts from what is drawn now (awaiting main's acknowledgement).
    edit.wheel(wheelEvent(100, 1100))
    expect(commits().at(-1)).toEqual(['commit', 'radar', 'wheel', RADAR])
    expect(s.scaleSteps).toEqual([])
  })

  it('does nothing when the size would not change', () => {
    s.radar.layoutRect.value = { x: 0, y: 0, width: 120, height: 140 }
    const edit = s.edit('radar')
    edit.wheel(wheelEvent(100, 1000))
    expect(commits()).toEqual([])
  })

  it('ignores the wheel when locked, outside edit mode, during a drag or without motion', () => {
    const edit = s.edit('radar')
    const flat = wheelEvent(0, 1000)
    edit.wheel(flat)
    expect(flat.defaultPrevented).toBe(false)
    s.radar.locked.value = true
    edit.wheel(wheelEvent(-100, 2000))
    s.radar.locked.value = false
    s.editing.value = false
    edit.wheel(wheelEvent(-100, 3000))
    s.editing.value = true
    s.edit('standings').pointerDown(pointerDown(800, 200), new FakeDragElement(), 'move')
    edit.wheel(wheelEvent(-100, 4000))
    expect(commits()).toEqual([])
  })

  it('never lets Ctrl+wheel zoom, even when it does nothing else', () => {
    s.radar.locked.value = true
    const edit = s.edit('radar')
    const e = wheelEvent(-100, 1000, true)
    edit.wheel(e)
    expect(e.defaultPrevented).toBe(true)
    expect(commits()).toEqual([])
  })
})
