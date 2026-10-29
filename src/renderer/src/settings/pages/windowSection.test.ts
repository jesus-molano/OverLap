/** "Ventana y visibilidad": the same order on every widget page (requirement R04). */
import { describe, expect, it } from 'vitest'
import SOURCE from './WindowSection.vue?raw'

describe('WindowSection', () => {
  it('orders its rows: size, background, when it shows, then the lock (the same on every page)', () => {
    const template = SOURCE.slice(SOURCE.indexOf('<template>'))
    const at = (s: string): number => {
      const i = template.indexOf(s)
      expect(i, s).toBeGreaterThan(-1)
      return i
    }
    const order = [
      at('t.settings.window.scale'),
      at('t.settings.window.height'),
      at('t.settings.window.opacity'),
      at('t.settings.window.showIn'),
      at('t.settings.window.hideInPits'),
      at('t.settings.window.locked')
    ]
    expect([...order].sort((a, b) => a - b)).toEqual(order)
  })

  it('gives every widget the scale and height rows (R09): free ones scale their window', () => {
    const template = SOURCE.slice(SOURCE.indexOf('<template>'))
    // No row only for one size model: the height is shown off, with its reason.
    expect(template).not.toMatch(/v-if="autoModel"/)
    expect(template).toContain(':disabled="!autoModel"')
    expect(template).toContain(`:apply="autoModel ? set('scale') : setFreeScale"`)
    expect(SOURCE).toMatch(/type: 'set-widget-bounds'/)
  })
})
