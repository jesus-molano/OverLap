import { describe, expect, it } from 'vitest'
import type { ElementEntry } from '@shared/types'
import type { List } from '../elements/listOps'
import {
  countdown,
  createUndoSlot,
  isTextTarget,
  isUndoKey,
  sameList,
  undoneList,
  type Timers,
  type UndoOffer
} from './undo'

const L = (spec: string): ElementEntry<string>[] =>
  spec.split(' ').map((s) => ({ id: s.replace('-', ''), visible: !s.startsWith('-') }))

/** Timers driven by hand: `tick(ms)` moves the clock and fires what is due. */
function fakeTimers(): Timers & { tick(ms: number): void; pending(): number } {
  let now = 0
  let next = 1
  const due = new Map<number, { at: number; fn: () => void }>()
  return {
    now: () => now,
    set(fn, ms) {
      const h = next++
      due.set(h, { at: now + ms, fn })
      return h
    },
    clear(h) {
      due.delete(h as number)
    },
    tick(ms) {
      const end = now + ms
      for (;;) {
        const first = [...due.entries()]
          .filter(([, d]) => d.at <= end)
          .sort((a, b) => a[1].at - b[1].at)[0]
        if (first === undefined) break
        due.delete(first[0])
        now = first[1].at
        first[1].fn()
      }
      now = end
    },
    pending: () => due.size
  }
}

describe('undoneList', () => {
  const hide = {
    kind: 'hide',
    id: 'sof',
    before: L('pos sof gap'),
    after: L('pos -sof gap')
  } as const

  it('gives back the list before, exactly, while nothing else changed', () => {
    expect(undoneList(hide, L('pos -sof gap'))).toEqual(L('pos sof gap'))
    const move = {
      kind: 'move',
      id: 'sof',
      before: L('pos sof -gap'),
      after: L('sof pos -gap')
    } as const
    expect(undoneList(move, L('sof pos -gap'))).toEqual(L('pos sof -gap'))
  })

  it('never returns the lists it was given', () => {
    const out = undoneList(hide, L('pos -sof gap'))
    expect(out).not.toBe(hide.before)
    expect(out?.[0]).not.toBe(hide.before[0])
  })

  it('undoes only the hide when the list changed since', () => {
    // 'gap' hidden and 'pos' moved since: 'sof' is shown where it is now, the rest stays.
    expect(undoneList(hide, L('-sof pos -gap'))).toEqual(L('sof pos -gap'))
  })

  it('has nothing to undo once the element is shown again, or gone', () => {
    expect(undoneList(hide, L('pos sof -gap'))).toBeNull()
    expect(undoneList(hide, L('pos gap'))).toBeNull()
  })

  it('puts a move back while the order is still the one it made, keeping the eyes', () => {
    const move = { kind: 'move', id: 'c', before: L('a b c'), after: L('c a b') } as const
    expect(undoneList(move, L('c -a b'))).toEqual(L('-a b c'))
  })

  it('leaves a newer order alone', () => {
    const move = { kind: 'move', id: 'c', before: L('a b c'), after: L('c a b') } as const
    expect(undoneList(move, L('a c b'))).toBeNull()
    expect(undoneList(move, L('a b c'))).toBeNull()
  })

  it('has nothing to undo for a change that changed nothing', () => {
    const same = { kind: 'move', id: 'a', before: L('a b'), after: L('a b') } as const
    expect(undoneList(same, L('a b'))).toBeNull()
  })

  it('sameList compares ids, order and eyes', () => {
    expect(sameList(L('a -b'), L('a -b'))).toBe(true)
    expect(sameList(L('a b'), L('a -b'))).toBe(false)
    expect(sameList(L('a b'), L('b a'))).toBe(false)
    expect(sameList(L('a b'), L('a'))).toBe(false)
  })
})

describe('countdown', () => {
  it('runs out after its time', () => {
    const timers = fakeTimers()
    let done = 0
    countdown(1000, () => done++, timers)
    timers.tick(999)
    expect(done).toBe(0)
    timers.tick(1)
    expect(done).toBe(1)
  })

  it('stops while held and runs on for what it had left', () => {
    const timers = fakeTimers()
    let done = 0
    const c = countdown(1000, () => done++, timers)
    timers.tick(600)
    c.hold('hover')
    expect(c.held).toBe(true)
    timers.tick(5000)
    expect(done).toBe(0)
    expect(c.remaining()).toBe(400)
    c.release('hover')
    timers.tick(399)
    expect(done).toBe(0)
    timers.tick(1)
    expect(done).toBe(1)
  })

  it('stays held until every reason lets go', () => {
    const timers = fakeTimers()
    let done = 0
    const c = countdown(1000, () => done++, timers)
    c.hold('hover')
    c.hold('focus')
    c.release('hover')
    timers.tick(2000)
    expect(done).toBe(0)
    c.release('focus')
    timers.tick(1000)
    expect(done).toBe(1)
  })

  it('ignores a release it was not held for, and anything once cancelled', () => {
    const timers = fakeTimers()
    let done = 0
    const c = countdown(1000, () => done++, timers)
    c.release('focus')
    timers.tick(500)
    c.cancel()
    c.hold('hover')
    c.release('hover')
    timers.tick(5000)
    expect(done).toBe(0)
    expect(timers.pending()).toBe(0)
    expect(c.remaining()).toBe(0)
  })
})

describe('createUndoSlot', () => {
  function offerOf(
    over: Partial<UndoOffer> & { list: { value: List<string> }; applied: List<string>[] }
  ): UndoOffer {
    const { list, applied, ...rest } = over
    return {
      owner: {},
      kind: 'hide',
      id: 'sof',
      label: 'SoF',
      before: L('pos sof'),
      after: L('pos -sof'),
      current: () => list.value,
      apply: (next) => {
        applied.push(next)
        list.value = next
      },
      ...rest
    }
  }

  it('shows nothing without a toast mounted', () => {
    const slot = createUndoSlot(fakeTimers(), 1000)
    const list = { value: L('pos -sof') }
    expect(slot.offer(offerOf({ list, applied: [] }))).toBe(false)
    expect(slot.shown.value).toBeNull()
  })

  it('undoes the offer through its apply, once', () => {
    const slot = createUndoSlot(fakeTimers(), 1000)
    slot.attach()
    const list = { value: L('pos -sof') }
    const applied: List<string>[] = []
    expect(slot.offer(offerOf({ list, applied }))).toBe(true)
    expect(slot.undo()).toBe(true)
    expect(applied).toEqual([L('pos sof')])
    expect(slot.shown.value).toBeNull()
    expect(slot.undo()).toBe(false)
    expect(applied).toHaveLength(1)
  })

  it('keeps one offer: a newer one replaces it, and undo reverts only that', () => {
    const timers = fakeTimers()
    const slot = createUndoSlot(timers, 1000)
    slot.attach()
    const list = { value: L('pos -sof gap') }
    const applied: List<string>[] = []
    slot.offer(offerOf({ list, applied, before: L('pos sof gap'), after: L('pos -sof gap') }))
    const first = slot.shown.value?.seq
    list.value = L('pos -sof -gap')
    slot.offer(
      offerOf({ list, applied, id: 'gap', before: L('pos -sof gap'), after: L('pos -sof -gap') })
    )
    expect(slot.shown.value?.seq).not.toBe(first)
    // The first offer's countdown no longer closes the second.
    timers.tick(600)
    expect(slot.shown.value?.offer.id).toBe('gap')
    slot.undo()
    expect(applied).toEqual([L('pos -sof gap')])
  })

  it('closes after its time, not while held', () => {
    const timers = fakeTimers()
    const slot = createUndoSlot(timers, 1000)
    slot.attach()
    const list = { value: L('pos -sof') }
    slot.offer(offerOf({ list, applied: [] }))
    timers.tick(500)
    slot.hold('focus')
    expect(slot.held.value).toBe(true)
    timers.tick(10_000)
    expect(slot.shown.value).not.toBeNull()
    slot.release('focus')
    expect(slot.held.value).toBe(false)
    timers.tick(500)
    expect(slot.shown.value).toBeNull()
  })

  it('applies nothing when the change is no longer there to undo', () => {
    const slot = createUndoSlot(fakeTimers(), 1000)
    slot.attach()
    const list = { value: L('pos -sof') }
    const applied: List<string>[] = []
    slot.offer(offerOf({ list, applied }))
    list.value = L('pos sof')
    expect(slot.undo()).toBe(false)
    expect(applied).toEqual([])
    expect(slot.shown.value).toBeNull()
  })

  it('closes an offer whose editor went away, and every offer with the last toast', () => {
    const slot = createUndoSlot(fakeTimers(), 1000)
    const detach = slot.attach()
    const owner = {}
    const list = { value: L('pos -sof') }
    slot.offer(offerOf({ list, applied: [], owner }))
    slot.withdraw({})
    expect(slot.shown.value).not.toBeNull()
    slot.withdraw(owner)
    expect(slot.shown.value).toBeNull()
    slot.offer(offerOf({ list, applied: [] }))
    detach()
    detach()
    expect(slot.shown.value).toBeNull()
    expect(slot.offer(offerOf({ list, applied: [] }))).toBe(false)
  })
})

describe('the undo key', () => {
  const key = (k: string, mods: Partial<KeyboardEvent> = {}): Parameters<typeof isUndoKey>[0] => ({
    key: k,
    ctrlKey: false,
    metaKey: false,
    shiftKey: false,
    altKey: false,
    ...mods
  })

  it('is Ctrl+Z or Cmd+Z alone', () => {
    expect(isUndoKey(key('z', { ctrlKey: true }))).toBe(true)
    expect(isUndoKey(key('Z', { ctrlKey: true }))).toBe(true)
    expect(isUndoKey(key('z', { metaKey: true }))).toBe(true)
    expect(isUndoKey(key('z'))).toBe(false)
    expect(isUndoKey(key('z', { ctrlKey: true, shiftKey: true }))).toBe(false)
    expect(isUndoKey(key('z', { ctrlKey: true, altKey: true }))).toBe(false)
    expect(isUndoKey(key('y', { ctrlKey: true }))).toBe(false)
  })

  it('treats no target as a text field without a DOM', () => {
    expect(isTextTarget(null)).toBe(false)
  })
})
