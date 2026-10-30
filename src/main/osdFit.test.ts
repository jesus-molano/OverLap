import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { messagesFor } from '@shared/i18n'
import { textWidthPx } from '@shared/textWidth'
import { OSD_SIZE } from './osdPlace'

const OSD_CSS = readFileSync(new URL('../renderer/src/osd/osd.css', import.meta.url), 'utf8')

/**
 * The confirmation over the game (R37, R38) says each thing on one line in both languages: its
 * text at 19 px fits the pill's room in the window (its margin and its padding off).
 */
const px = (prop: string, rule: string): number => {
  const block = new RegExp(`\\.${rule}\\s*\\{([^}]*)\\}`).exec(OSD_CSS)?.[1] ?? ''
  return Number(new RegExp(`${prop}:\\s*(\\d+)px`).exec(block)?.[1] ?? NaN)
}

describe('the OSD texts', () => {
  const textPx = px('font-size', 'osd-text')
  const detailPx = px('font-size', 'osd-detail')
  // The pill: 8 px from each side of its window, 20 px of padding and its 1 px border inside.
  const room = OSD_SIZE.width - 16 - 40 - 2

  it('reads its sizes from the stylesheet', () => {
    expect(textPx).toBe(19)
    expect(detailPx).toBe(13)
  })

  for (const lang of ['es', 'en'] as const) {
    it(`${lang}: every text fits on one line, every detail too`, () => {
      const osd = messagesFor(lang).core.osd as Readonly<Record<string, unknown>>
      for (const [key, value] of Object.entries(osd)) {
        // A message with a name: with a typical one (the widget, the layout, the car).
        const text =
          typeof value === 'function'
            ? String((value as (a: unknown, b: unknown) => unknown)('Posiciones', 'Principal'))
            : String(value)
        const size = key.endsWith('Detail') ? detailPx : textPx
        expect(Math.round(textWidthPx(text, size)), `${lang} ${key}: ${text}`).toBeLessThanOrEqual(
          room
        )
      }
    })
  }
})
