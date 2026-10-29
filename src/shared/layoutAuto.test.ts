import { beforeEach, describe, expect, it } from 'vitest'
import { LayoutAutoSwitch } from './layoutAuto'
import { applyLayout, linkCar, saveLayoutAs } from './layouts'
import { createDefaultSettings } from './settings'
import type { OverlaySettings } from './types'

const MAZDA = { carId: 67, carName: 'Mazda MX-5 Cup' }
const GT3 = { carId: 132, carName: 'Porsche 911 GT3 R (992)' }
const BMW = { carId: 195, carName: 'BMW M2 CS Racing' }

/** Principal (layout-1), Mazda (layout-2), GT3 (layout-3); Principal in use; Mazda and GT3 linked. */
function settings(auto = true): OverlaySettings {
  const s = createDefaultSettings()
  saveLayoutAs(s, 'Mazda')
  saveLayoutAs(s, 'GT3')
  applyLayout(s, 'layout-1')
  linkCar(s, MAZDA, 'layout-2')
  linkCar(s, GT3, 'layout-3')
  s.layouts.autoSwitch = auto
  return s
}

describe('LayoutAutoSwitch', () => {
  let auto: LayoutAutoSwitch
  let s: OverlaySettings
  const ctx = (editing = false): { settings: OverlaySettings; editing: boolean } => ({
    settings: s,
    editing
  })
  /** What main does with an answer: applies it. */
  const apply = (id: string | null): string | null => {
    if (id !== null) applyLayout(s, id)
    return id
  }

  beforeEach(() => {
    auto = new LayoutAutoSwitch()
    s = settings()
  })

  it('applies the linked layout when you get in a car', () => {
    expect(apply(auto.onCar(MAZDA, ctx()))).toBe('layout-2')
    expect(auto.car).toEqual(MAZDA)
    expect(apply(auto.onCar(GT3, ctx()))).toBe('layout-3')
  })

  it('keeps the last layout in a car without a link', () => {
    apply(auto.onCar(MAZDA, ctx()))
    expect(auto.onCar(BMW, ctx())).toBeNull()
    expect(s.savedLayouts.activeId).toBe('layout-2')
  })

  it('does nothing while the mode is off', () => {
    s = settings(false)
    expect(auto.onCar(MAZDA, ctx())).toBeNull()
    expect(auto.onCar(GT3, ctx())).toBeNull()
  })

  it('does not apply again for the same car: a choice by hand stays', () => {
    apply(auto.onCar(MAZDA, ctx()))
    auto.onManualSwitch()
    applyLayout(s, 'layout-1')
    // Session change, reconnect, the menus: no car, then the same one again.
    expect(auto.onCar(MAZDA, ctx())).toBeNull()
    expect(auto.onCar(null, ctx())).toBeNull()
    expect(auto.car).toBeNull()
    expect(auto.onCar(MAZDA, ctx())).toBeNull()
    expect(s.savedLayouts.activeId).toBe('layout-1')
    // Another car, then back: that is getting in the Mazda again.
    expect(apply(auto.onCar(GT3, ctx()))).toBe('layout-3')
    expect(apply(auto.onCar(MAZDA, ctx()))).toBe('layout-2')
  })

  it('answers nothing when the linked layout is already in use', () => {
    applyLayout(s, 'layout-2')
    expect(auto.onCar(MAZDA, ctx())).toBeNull()
  })

  it('waits for edit mode to end, then applies', () => {
    expect(auto.onCar(MAZDA, ctx(true))).toBeNull()
    expect(auto.pendingId).toBe('layout-2')
    expect(s.savedLayouts.activeId).toBe('layout-1')
    expect(apply(auto.onEditEnd(ctx()))).toBe('layout-2')
    expect(auto.pendingId).toBeNull()
    expect(auto.onEditEnd(ctx())).toBeNull()
  })

  it('drops a waiting switch when a layout is chosen by hand, the car changes or the mode is off', () => {
    auto.onCar(MAZDA, ctx(true))
    auto.onManualSwitch()
    expect(auto.onEditEnd(ctx())).toBeNull()

    auto.onCar(GT3, ctx(true))
    expect(auto.pendingId).toBe('layout-3')
    auto.onCar(BMW, ctx(true))
    expect(auto.pendingId).toBeNull()

    auto.onCar(MAZDA, ctx(true))
    s.layouts.autoSwitch = false
    expect(auto.onEditEnd(ctx())).toBeNull()
  })

  it('drops a waiting switch to a layout that is gone or already in use', () => {
    auto.onCar(MAZDA, ctx(true))
    applyLayout(s, 'layout-2')
    expect(auto.onEditEnd(ctx())).toBeNull()

    auto.onCar(GT3, ctx(true))
    s.savedLayouts.list = s.savedLayouts.list.filter((l) => l.id !== 'layout-3')
    expect(auto.onEditEnd(ctx())).toBeNull()
  })

  it("applies the current car's layout when the mode is turned on or its link changes", () => {
    s = settings(false)
    expect(auto.onCar(MAZDA, ctx())).toBeNull()
    s.layouts.autoSwitch = true
    expect(apply(auto.reevaluate(ctx()))).toBe('layout-2')
    linkCar(s, MAZDA, 'layout-3')
    expect(apply(auto.reevaluate(ctx()))).toBe('layout-3')
    // Out of any car: nothing to reevaluate.
    auto.onCar(null, ctx())
    expect(auto.reevaluate(ctx())).toBeNull()
  })

  it('reevaluates into a wait while editing', () => {
    s = settings(false)
    auto.onCar(MAZDA, ctx())
    s.layouts.autoSwitch = true
    expect(auto.reevaluate(ctx(true))).toBeNull()
    expect(auto.onEditEnd(ctx())).toBe('layout-2')
  })
})
