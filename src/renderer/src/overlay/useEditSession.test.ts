import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick, shallowRef, type ShallowRef } from 'vue'
import { DRAG_HEARTBEAT_MS, type DragStateMessage, type EditChipsMessage } from '@shared/ipc'
import {
  FakeFrames,
  createFakeRegistry,
  createFakeSlot,
  type FakeRegistry
} from './testing/fakeEdit'
import { createEditSession, type DragOwner, type EditSessionHandle } from './useEditSession'

let sent: DragStateMessage[]

beforeEach(() => {
  vi.useFakeTimers()
  sent = []
})

afterEach(() => {
  vi.useRealTimers()
})

interface Setup {
  edit: ShallowRef<boolean>
  registry: FakeRegistry
  session: EditSessionHandle
}

function setup(editing = true): Setup {
  const edit = shallowRef(editing)
  const registry = createFakeRegistry([
    createFakeSlot('radar', { x: 0, y: 0, width: 200, height: 200 })
  ])
  const session = createEditSession({
    registry,
    editing: edit,
    session: () => 3,
    sendDragState: (msg) => void sent.push(msg)
  })
  return { edit, registry, session }
}

/** An owner that ends its drag when cancelled, like a panel's. */
function owner(session: { endDrag(o: DragOwner): void }): DragOwner & { cancels: number } {
  const o = {
    cancels: 0,
    cancel(): void {
      o.cancels++
      session.endDrag(o)
    }
  }
  return o
}

describe('createEditSession', () => {
  it('runs one drag at a time in the window', () => {
    const { session } = setup()
    const a = owner(session)
    const b = owner(session)
    expect(session.beginDrag(a)).toBe(true)
    expect(session.dragging.value).toBe(true)
    expect(session.beginDrag(b)).toBe(false)
    session.endDrag(b) // not the running drag: ignored
    expect(session.dragging.value).toBe(true)
    session.endDrag(a)
    expect(session.dragging.value).toBe(false)
    expect(session.beginDrag(b)).toBe(true)
    session.dispose()
  })

  it('holds the lease while a drag runs, echoing the session', () => {
    const { session } = setup()
    const a = owner(session)
    session.beginDrag(a)
    expect(sent).toEqual([{ session: 3, dragging: true }])
    vi.advanceTimersByTime(DRAG_HEARTBEAT_MS * 2)
    expect(sent).toHaveLength(3)
    session.endDrag(a)
    expect(sent.at(-1)).toEqual({ session: 3, dragging: false })
    expect(vi.getTimerCount()).toBe(0)
    session.dispose()
  })

  it('starts no drag while edit mode is off', () => {
    const { session } = setup(false)
    expect(session.beginDrag(owner(session))).toBe(false)
    expect(sent).toEqual([])
    session.dispose()
  })

  it('cancels the drag when edit mode turns off, and tells main it ended', async () => {
    const { edit, session } = setup()
    const a = owner(session)
    session.beginDrag(a)
    edit.value = false
    await nextTick()
    expect(a.cancels).toBe(1)
    expect(session.dragging.value).toBe(false)
    expect(sent).toEqual([
      { session: 3, dragging: true },
      { session: 3, dragging: false }
    ])
    expect(vi.getTimerCount()).toBe(0)
    session.dispose()
  })

  it('cancels the drag when the display goes away', async () => {
    const { registry, session } = setup()
    const a = owner(session)
    session.beginDrag(a)
    registry.display.value = null
    await nextTick()
    expect(a.cancels).toBe(1)
    expect(session.dragging.value).toBe(false)
    session.dispose()
  })

  it('ends the lease even when an owner does not end itself on cancel', () => {
    const { session } = setup()
    const stubborn: DragOwner = { cancel: () => {} }
    session.beginDrag(stubborn)
    session.cancelDrag()
    expect(session.dragging.value).toBe(false)
    expect(sent.at(-1)).toEqual({ session: 3, dragging: false })
    session.dispose()
  })

  it('cancels on dispose and leaves no timers or watchers', async () => {
    const { edit, session } = setup()
    const a = owner(session)
    session.beginDrag(a)
    session.dispose()
    expect(a.cancels).toBe(1)
    expect(sent.at(-1)).toEqual({ session: 3, dragging: false })
    expect(vi.getTimerCount()).toBe(0)
    expect(session.beginDrag(owner(session))).toBe(false)
    edit.value = false
    await nextTick()
    expect(a.cancels).toBe(1)
    session.dispose()
  })
})

describe('createEditSession chips', () => {
  function withChips(sessionId = 3): {
    edit: ShallowRef<boolean>
    session: EditSessionHandle
    frames: FakeFrames
    out: EditChipsMessage[]
    current: { id: number }
  } {
    const edit = shallowRef(true)
    const frames = new FakeFrames()
    const out: EditChipsMessage[] = []
    const current = { id: sessionId }
    const session = createEditSession({
      registry: createFakeRegistry([]),
      editing: edit,
      session: () => current.id,
      sendDragState: () => {},
      sendChips: (msg) => void out.push(msg),
      frames
    })
    return { edit, session, frames, out, current }
  }

  const CHIP = { x: 140, y: 4, width: 180, height: 20 }

  it('sends every chip of the window once per frame, in paint order, only when one changed', () => {
    const { session, frames, out } = withChips()
    session.reportChip('radar', CHIP)
    session.reportChip('alerts', { ...CHIP, x: 100 })
    expect(out).toEqual([])
    frames.run()
    expect(out).toEqual([
      {
        session: 3,
        chips: [
          { widget: 'alerts', rect: { ...CHIP, x: 100 } },
          { widget: 'radar', rect: CHIP }
        ]
      }
    ])
    // The same rect again: nothing to send.
    session.reportChip('radar', { ...CHIP })
    expect(frames.pending.size).toBe(0)
    session.reportChip('radar', null)
    frames.run()
    expect(out.at(-1)).toEqual({
      session: 3,
      chips: [{ widget: 'alerts', rect: { ...CHIP, x: 100 } }]
    })
    session.dispose()
  })

  it('waits for the first layout, sends nothing outside edit mode and leaves no frame behind', () => {
    const { edit, session, frames, out, current } = withChips(0)
    session.reportChip('radar', CHIP)
    frames.run()
    expect(out).toEqual([])
    current.id = 5
    frames.run()
    expect(out).toEqual([{ session: 5, chips: [{ widget: 'radar', rect: CHIP }] }])
    edit.value = false
    session.reportChip('radar', null)
    frames.run()
    expect(out).toHaveLength(1)
    session.reportChip('alerts', CHIP)
    session.dispose()
    expect(frames.pending.size).toBe(0)
  })
})
