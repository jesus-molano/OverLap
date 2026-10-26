import { describe, expect, it } from 'vitest'
import {
  HINT_LONG_PX,
  HINT_SHORT_PX,
  hintTier,
  radarClashes,
  rectsOverlap,
  relativeRect,
  toggleMessage
} from './editChip'
import { createFakeSlot } from './testing/fakeEdit'

describe('hintTier', () => {
  it('the longest hover hint that fits the panel width', () => {
    expect(hintTier(HINT_LONG_PX)).toBe('long')
    expect(hintTier(HINT_LONG_PX - 1)).toBe('short')
    expect(hintTier(HINT_SHORT_PX)).toBe('short')
    expect(hintTier(HINT_SHORT_PX - 1)).toBe('tiny')
    expect(hintTier(120)).toBe('tiny')
  })
})

describe('toggleMessage', () => {
  it('asks for the opposite of what the panel is now', () => {
    const slot = createFakeSlot('radar', { x: 0, y: 0, width: 220, height: 260 })
    expect(toggleMessage(slot, 'visible', 4, true)).toEqual({
      session: 4,
      widget: 'radar',
      field: 'visible',
      value: false
    })
    expect(toggleMessage(slot, 'locked', 4, true)?.value).toBe(true)
    slot.ghost.value = true
    slot.locked.value = true
    expect(toggleMessage(slot, 'visible', 4, true)?.value).toBe(true)
    expect(toggleMessage(slot, 'locked', 4, true)?.value).toBe(false)
  })

  it('sends nothing outside edit mode or before the first layout', () => {
    const slot = createFakeSlot('radar', { x: 0, y: 0, width: 220, height: 260 })
    expect(toggleMessage(slot, 'visible', 4, false)).toBeNull()
    expect(toggleMessage(slot, 'visible', 0, true)).toBeNull()
    expect(toggleMessage(slot, 'visible', Number.NaN, true)).toBeNull()
  })
})

describe('relativeRect', () => {
  it('is the chip relative to its panel, grown to whole px', () => {
    const panel = { left: 600.4, top: 300.2, right: 820, bottom: 560 }
    const chip = { left: 640.9, top: 304.6, right: 780.1, bottom: 324.3 }
    expect(relativeRect(panel, chip)).toEqual({ x: 40, y: 4, width: 140, height: 21 })
  })

  it('is null without area or with garbage', () => {
    const panel = { left: 0, top: 0, right: 100, bottom: 100 }
    expect(relativeRect(panel, { left: 10, top: 10, right: 10, bottom: 30 })).toBeNull()
    expect(relativeRect(panel, { left: Number.NaN, top: 0, right: 10, bottom: 10 })).toBeNull()
  })
})

describe('radarClashes', () => {
  // The race layout (report B05): alerts 802,349 reach into the radar at 883,234.
  const radar = createFakeSlot('radar', { x: 883, y: 234, width: 220, height: 260 })
  const alerts = createFakeSlot('alerts', { x: 802, y: 349, width: 400, height: 70 })
  const delta = createFakeSlot('delta', { x: 760, y: 500, width: 400, height: 80 })
  const relative = createFakeSlot('relative', { x: 60, y: 260, width: 460, height: 252 })
  const slots = [relative, alerts, delta, radar]

  it('lists on the radar the panels it covers, and flags each of them', () => {
    expect(radarClashes('radar', slots)).toEqual(['alerts'])
    expect(radarClashes('alerts', slots)).toEqual(['radar'])
    expect(radarClashes('delta', slots)).toEqual([])
    expect(radarClashes('relative', slots)).toEqual([])
  })

  it('ignores touching edges, ghosts, hidden panels and a window without the radar', () => {
    expect(
      rectsOverlap({ x: 0, y: 0, width: 10, height: 10 }, { x: 10, y: 0, width: 5, height: 5 })
    ).toBe(false)
    const ghostAlerts = createFakeSlot('alerts', { x: 802, y: 349, width: 400, height: 70 })
    ghostAlerts.shown.value = false
    expect(radarClashes('radar', [ghostAlerts, radar])).toEqual([])
    expect(radarClashes('alerts', [alerts])).toEqual([])
    const hiddenRadar = createFakeSlot('radar', { x: 883, y: 234, width: 220, height: 260 })
    hiddenRadar.shown.value = false
    expect(radarClashes('alerts', [alerts, hiddenRadar])).toEqual([])
  })
})
