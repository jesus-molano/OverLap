import { describe, expect, it } from 'vitest'
import {
  LIGHT_RELATIVE_CARS,
  LIGHT_WIDGETS,
  addExampleLayout,
  exampleShows,
  isLayoutExample
} from './layoutExamples'
import { MAX_LAYOUTS, applyLayout, findLayout, saveLayoutAs } from './layouts'
import { createDefaultSettings } from './settings'
import { WIDGET_IDS } from './widgets'

describe('example layouts (R57)', () => {
  it('adds «Ligera» with five widgets and a shorter relative, not applied', () => {
    const s = createDefaultSettings()
    s.widgets.relative.bounds = { x: 40, y: 50, width: 400, height: 300 }
    const before = s.savedLayouts.activeId
    const id = addExampleLayout(s, 'light', 'Ligera')
    expect(id).not.toBeNull()
    const l = findLayout(s.savedLayouts, id as string)
    expect(l?.name).toBe('Ligera')
    expect(l?.mode).toBe('full')
    for (const w of WIDGET_IDS) expect(l?.widgets[w].visible, w).toBe(LIGHT_WIDGETS.includes(w))
    // Your places stay.
    expect(l?.widgets.relative.bounds).toEqual({ x: 40, y: 50, width: 400, height: 300 })
    expect(l?.options?.sections.relative.carsAhead).toBe(LIGHT_RELATIVE_CARS)
    expect(l?.options?.sections.relative.carsBehind).toBe(LIGHT_RELATIVE_CARS)
    // Nothing changes on screen: the layout in use and the widgets are as they were.
    expect(s.savedLayouts.activeId).toBe(before)
    expect(s.widgets.standings.visible).toBe(true)
    expect(s.relative.carsAhead).toBe(3)
  })

  it('adds «Completa» with every widget, the options in effect', () => {
    const s = createDefaultSettings()
    s.widgets.battle.visible = false
    s.relative.carsAhead = 5
    const id = addExampleLayout(s, 'full', 'Completa') as string
    const l = findLayout(s.savedLayouts, id)
    for (const w of WIDGET_IDS) expect(l?.widgets[w].visible, w).toBe(true)
    expect(l?.options?.sections.relative.carsAhead).toBe(5)
    expect(s.widgets.battle.visible).toBe(false)
  })

  it('never gives the light relative more cars than you have', () => {
    const s = createDefaultSettings()
    s.relative.carsAhead = 1
    const id = addExampleLayout(s, 'light', 'Ligera') as string
    expect(findLayout(s.savedLayouts, id)?.options?.sections.relative.carsAhead).toBe(1)
  })

  it('names a second copy apart, and adds nothing without room or a name', () => {
    const s = createDefaultSettings()
    const a = addExampleLayout(s, 'light', 'Ligera') as string
    const b = addExampleLayout(s, 'light', 'Ligera') as string
    expect(findLayout(s.savedLayouts, b)?.name).not.toBe(findLayout(s.savedLayouts, a)?.name)
    expect(addExampleLayout(s, 'full', '')).toBeNull()
    while (s.savedLayouts.list.length < MAX_LAYOUTS) saveLayoutAs(s, 'x')
    expect(addExampleLayout(s, 'full', 'Completa')).toBeNull()
  })

  it('switches the overlay as the example says once applied', () => {
    const s = createDefaultSettings()
    const id = addExampleLayout(s, 'light', 'Ligera') as string
    expect(applyLayout(s, id)).toBe(true)
    for (const w of WIDGET_IDS) expect(s.widgets[w].visible, w).toBe(exampleShows('light', w))
    expect(s.relative.carsBehind).toBe(LIGHT_RELATIVE_CARS)
  })

  it('knows its kinds', () => {
    expect(isLayoutExample('light')).toBe(true)
    expect(isLayoutExample('full')).toBe(true)
    expect(isLayoutExample('heavy')).toBe(false)
  })
})
