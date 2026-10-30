import { describe, expect, it } from 'vitest'
import { WIDGET_IDS } from '@shared/widgets'
import { WELCOME_STEPS, WELCOME_WIDGETS, welcomeCanGoOn, welcomeWidgetsPatch } from './welcome'

describe('welcome (R07)', () => {
  it('starts with the core widgets ticked, not all ten', () => {
    expect(WELCOME_WIDGETS).toEqual(['relative', 'standings', 'delta', 'fuel', 'alerts', 'inputs'])
    expect(WELCOME_WIDGETS.length).toBeLessThan(WIDGET_IDS.length)
    expect(WELCOME_STEPS).toEqual(['start', 'widgets', 'where'])
  })

  it('turns every widget on or off as ticked, in one patch', () => {
    const patch = welcomeWidgetsPatch(new Set(['relative', 'radar']))
    expect(Object.keys(patch.widgets ?? {}).sort()).toEqual([...WIDGET_IDS].sort())
    expect(patch.widgets?.relative).toEqual({ visible: true })
    expect(patch.widgets?.radar).toEqual({ visible: true })
    expect(patch.widgets?.fuel).toEqual({ visible: false })
  })

  it('does not go on from the widgets step with none ticked', () => {
    expect(welcomeCanGoOn('widgets', new Set())).toBe(false)
    expect(welcomeCanGoOn('widgets', new Set(['fuel']))).toBe(true)
    expect(welcomeCanGoOn('start', new Set())).toBe(true)
    expect(welcomeCanGoOn('where', new Set())).toBe(true)
  })
})
