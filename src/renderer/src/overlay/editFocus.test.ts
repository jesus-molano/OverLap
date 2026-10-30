import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { EDIT_FOCUS_MS, EditFocusState } from './editFocus'

describe('EditFocusState (R25)', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('points a widget out for the pulses only (reduced motion too)', () => {
    const s = new EditFocusState()
    s.point('fuel')
    expect(s.focus.value).toEqual({ widget: 'fuel', n: 1 })
    vi.advanceTimersByTime(EDIT_FOCUS_MS - 1)
    expect(s.focus.value).not.toBeNull()
    vi.advanceTimersByTime(1)
    expect(s.focus.value).toBeNull()
  })

  it('a new request is a new one, and restarts the time', () => {
    const s = new EditFocusState()
    s.point('fuel')
    vi.advanceTimersByTime(EDIT_FOCUS_MS - 100)
    s.point('fuel')
    expect(s.focus.value?.n).toBe(2)
    vi.advanceTimersByTime(EDIT_FOCUS_MS - 100)
    expect(s.focus.value).not.toBeNull()
  })

  it('leaving edit mode forgets it: the next session points nothing out', () => {
    const s = new EditFocusState()
    s.point('relative')
    // Edit mode ends (EditFrame clears it), then it is entered again without a focus.
    s.clear()
    expect(s.focus.value).toBeNull()
    expect(vi.getTimerCount()).toBe(0)
  })
})
