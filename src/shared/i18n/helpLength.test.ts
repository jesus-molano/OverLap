import { describe, expect, it } from 'vitest'
import { messagesFor } from '.'

/**
 * R31: a row's help is one line (about 90 characters); the rest goes behind its ⓘ (`…More`).
 * Checked where the rows' helps were longest: Combustible's lines, Testigos' options, Pedales.
 */
describe('one-line helps', () => {
  for (const lang of ['es', 'en'] as const) {
    it(`keeps Combustible's, Testigos' and Pedales' helps to one line (${lang})`, () => {
      const m = messagesFor(lang).settings
      const long: string[] = []
      for (const [name, section] of Object.entries({
        fuel: m.fuel,
        lights: m.lights,
        inputs: m.inputs
      })) {
        for (const [key, value] of Object.entries(section as Record<string, unknown>)) {
          if (!key.endsWith('Help') && !key.endsWith('Row')) continue
          const text = typeof value === 'function' ? (value as (n: number) => string)(10) : value
          if (typeof text === 'string' && text.length > 90) long.push(`${name}.${key}`)
        }
      }
      expect(long).toEqual([])
    })
  }
})
