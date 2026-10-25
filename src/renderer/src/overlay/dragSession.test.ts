import { describe, expect, it } from 'vitest'
import type { Rect } from '@shared/types'
import type { DragContext, DragMode } from './dragMath'
import { DragSession } from './dragSession'
import {
  DISPLAY,
  FakeDragElement,
  FakeFrames,
  createFakeSlot,
  pointer,
  type FakeSlot,
  type LogEntry,
  type PointerInit
} from './testing/fakeEdit'

const START: Rect = { x: 400, y: 300, width: 200, height: 100 }
const CTX: DragContext = {
  minSize: { width: 120, height: 60 },
  display: DISPLAY.bounds,
  workArea: DISPLAY.workArea,
  targets: []
}

interface Setup {
  log: LogEntry[]
  el: FakeDragElement
  frames: FakeFrames
  slot: FakeSlot
  drag: DragSession
  move(x: number, y: number, more?: PointerInit): void
  up(x: number, y: number): void
}

function setup(
  mode: DragMode = 'move',
  downAt = { x: 450, y: 320 },
  init: PointerInit = {}
): Setup {
  const log: LogEntry[] = []
  const el = new FakeDragElement(log)
  const frames = new FakeFrames()
  const slot = createFakeSlot('radar', START, log)
  const drag = new DragSession({
    el,
    down: pointer('pointerdown', downAt.x, downAt.y, init),
    mode,
    start: START,
    ctx: CTX,
    slot,
    frames,
    onCrossing: (on) => void log.push(['crossing', on]),
    onDone: () => void log.push(['done'])
  })
  drag.start()
  const move = (x: number, y: number, more: PointerInit = {}): void =>
    el.dispatch('pointermove', pointer('pointermove', x, y, more))
  const up = (x: number, y: number): void => el.dispatch('pointerup', pointer('pointerup', x, y))
  return { log, el, frames, slot, drag, move, up }
}

const at = (x: number, y: number): Rect => ({ ...START, x, y })

describe('DragSession', () => {
  it('captures the pointer and redraws at most once per frame, at the last position', () => {
    const { log, el, frames, move } = setup()
    expect(el.captured.has(1)).toBe(true)
    expect(el.listenerCount()).toBe(4)
    move(460, 330)
    move(470, 340)
    move(480, 350)
    expect(frames.pending.size).toBe(1)
    expect(log.filter((e) => e[0] === 'setDragRect')).toEqual([])
    frames.run()
    expect(log.filter((e) => e[0] === 'setDragRect')).toEqual([
      ['setDragRect', 'radar', at(430, 330)]
    ])
    // A frame with no movement redraws nothing.
    frames.run()
    expect(log.filter((e) => e[0] === 'setDragRect')).toHaveLength(1)
  })

  it('commits on pointerup, before releasing the capture and ending the lease', () => {
    const { log, el, frames, drag, move, up } = setup()
    move(470, 330)
    frames.run()
    up(500, 340)
    expect(drag.active).toBe(false)
    expect(log).toEqual([
      ['capture', 1],
      ['setDragRect', 'radar', at(420, 310)],
      ['setDragRect', 'radar', at(450, 320)],
      ['commit', 'radar', 'drag', at(450, 320)],
      ['release', 1, 0],
      ['done']
    ])
    expect(el.listenerCount()).toBe(0)
    expect(frames.pending.size).toBe(0)
  })

  it('runs the pending frame on release instead of dropping it', () => {
    const { log, frames, move, up } = setup()
    move(470, 330)
    up(470, 330)
    expect(frames.pending.size).toBe(0)
    expect(log.filter((e) => e[0] === 'commit')).toEqual([
      ['commit', 'radar', 'drag', at(420, 310)]
    ])
  })

  it('sends nothing for a click without movement', () => {
    const { log, up } = setup()
    up(450, 320)
    expect(log).toEqual([
      ['capture', 1],
      ['setDragRect', 'radar', null],
      ['release', 1, 0],
      ['done']
    ])
  })

  it('sends nothing when the panel came back to where it started', () => {
    const { log, frames, move, up } = setup()
    move(500, 400)
    frames.run()
    up(450, 320)
    expect(log.filter((e) => e[0] === 'commit')).toEqual([])
    expect(log.at(-3)).toEqual(['setDragRect', 'radar', null])
  })

  it('ends on a move with the primary button already up (lost pointerup)', () => {
    const { log, el, frames, drag, move } = setup()
    move(470, 330)
    frames.run()
    // Released elsewhere; this move is after the release, so its position is not used.
    move(900, 900, { buttons: 0 })
    expect(drag.active).toBe(false)
    expect(log.filter((e) => e[0] === 'commit')).toEqual([
      ['commit', 'radar', 'drag', at(420, 310)]
    ])
    expect(el.listenerCount()).toBe(0)
  })

  it('also ends on pointercancel and on a lost capture', () => {
    for (const type of ['pointercancel', 'lostpointercapture'] as const) {
      const { log, el, frames, drag, move } = setup()
      move(470, 330)
      frames.run()
      el.captured.clear()
      el.dispatch(type, pointer(type, 0, 0))
      expect(drag.active).toBe(false)
      // The event's own coordinates are not used.
      expect(log.filter((e) => e[0] === 'commit')).toEqual([
        ['commit', 'radar', 'drag', at(420, 310)]
      ])
      expect(log.at(-1)).toEqual(['done'])
    }
  })

  it('ignores other pointers', () => {
    const { log, frames, drag, move, el } = setup()
    move(600, 600, { pointerId: 2 })
    el.dispatch('pointerup', pointer('pointerup', 600, 600, { pointerId: 2 }))
    expect(frames.pending.size).toBe(0)
    expect(drag.active).toBe(true)
    expect(log).toEqual([['capture', 1]])
  })

  it('does not snap while Alt or Shift is held', () => {
    const near = { ...CTX, targets: [{ x: 700, y: 0, width: 50, height: 50 }] }
    const log: LogEntry[] = []
    const el = new FakeDragElement(log)
    const frames = new FakeFrames()
    const slot = createFakeSlot('radar', START, log)
    new DragSession({
      el,
      down: pointer('pointerdown', 450, 320),
      mode: 'move',
      start: START,
      ctx: near,
      slot,
      frames,
      onCrossing: () => {},
      onDone: () => {}
    }).start()
    // Right edge 600 + 95 = 695, 5 px from the target's left edge.
    el.dispatch('pointermove', pointer('pointermove', 545, 320))
    frames.run()
    expect(slot.dragRect.value).toEqual(at(500, 300))
    el.dispatch('pointermove', pointer('pointermove', 545, 320, { altKey: true }))
    frames.run()
    expect(slot.dragRect.value).toEqual(at(495, 300))
    el.dispatch('pointermove', pointer('pointermove', 546, 320, { shiftKey: true }))
    frames.run()
    expect(slot.dragRect.value).toEqual(at(496, 300))
  })

  it('resizes by the handle it started on', () => {
    const { slot, frames, move, up } = setup('se')
    move(500, 400)
    frames.run()
    expect(slot.dragRect.value).toEqual({ x: 400, y: 300, width: 250, height: 180 })
    up(500, 400)
    expect(slot.pendingRect.value).toEqual({ x: 400, y: 300, width: 250, height: 180 })
  })

  it('drops on another display when a move is released off this one', () => {
    const { log, frames, move, up } = setup('move', { x: 450, y: 320 })
    move(1950, 500)
    frames.run()
    // Kept at the edge of this display while the pointer is off it.
    expect(log.slice(1)).toEqual([
      ['setDragRect', 'radar', at(1720, 480)],
      ['crossing', true]
    ])
    move(1900, 500)
    frames.run()
    expect(log.at(-1)).toEqual(['crossing', false])
    move(2100, 520)
    up(2100, 520)
    expect(log.slice(-5)).toEqual([
      ['crossing', true],
      ['dropOutside', 'radar', { x: 50, y: 20 }],
      ['release', 1, 0],
      ['crossing', false],
      ['done']
    ])
  })

  it('never drops a resize on another display', () => {
    const { log, frames, move, up } = setup('e')
    move(2500, 320)
    frames.run()
    up(2500, 320)
    expect(log.some((e) => e[0] === 'crossing' || e[0] === 'dropOutside')).toBe(false)
    expect(log.filter((e) => e[0] === 'commit')).toEqual([
      ['commit', 'radar', 'drag', { ...START, width: 1520 }]
    ])
  })

  it('cancels without sending: listeners off before the capture is released', () => {
    const { log, el, frames, drag, move } = setup()
    move(470, 330)
    frames.run()
    move(480, 340)
    drag.cancel()
    expect(drag.active).toBe(false)
    expect(frames.pending.size).toBe(0)
    // The fake fires lostpointercapture on release: with listeners still on it would commit.
    expect(log.slice(2)).toEqual([['setDragRect', 'radar', null], ['release', 1, 0], ['done']])
    expect(el.listenerCount()).toBe(0)
    drag.cancel()
    drag.end()
    expect(log.at(-1)).toEqual(['done'])
    expect(log.filter((e) => e[0] === 'done')).toHaveLength(1)
  })

  it('clears the crossing state when cancelled off the display', () => {
    const { log, frames, drag, move } = setup()
    move(-50, 300)
    frames.run()
    drag.cancel()
    expect(log.slice(-3)).toEqual([['release', 1, 0], ['crossing', false], ['done']])
    expect(log.some((e) => e[0] === 'dropOutside')).toBe(false)
  })

  it('cancels at once when the pointer cannot be captured', () => {
    const log: LogEntry[] = []
    const el = new FakeDragElement(log)
    el.failCapture = true
    const slot = createFakeSlot('radar', START, log)
    const drag = new DragSession({
      el,
      down: pointer('pointerdown', 450, 320),
      mode: 'move',
      start: START,
      ctx: CTX,
      slot,
      frames: new FakeFrames(),
      onCrossing: () => {},
      onDone: () => void log.push(['done'])
    })
    expect(drag.active).toBe(false)
    drag.start()
    expect(drag.active).toBe(false)
    expect(el.listenerCount()).toBe(0)
    expect(log).toEqual([['setDragRect', 'radar', null], ['done']])
  })
})
