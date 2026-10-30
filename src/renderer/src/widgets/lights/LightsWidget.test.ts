/**
 * The strip's spacing, read from the SFC's styles (the test runner lays nothing out): a reading
 * ('42 s', '+6°') must group with its own light, not float between two.
 */
import { describe, expect, it } from 'vitest'
import SOURCE from './LightsWidget.vue?raw'

/** The em figure the first capture group of `re` finds in the styles. */
function em(re: RegExp): number {
  const m = SOURCE.match(re)
  if (m?.[1] === undefined) throw new Error(`no match for ${re}`)
  return Number(m[1])
}

describe('the warning lights strip', () => {
  it('keeps a reading closer to its own light than to the next one', () => {
    const own = em(/\.wl-light \{[^}]*?gap: ([\d.]+)em;/)
    const between = em(/\.wl-strip \{[^}]*?gap: ([\d.]+)em;/)
    const afterReading = em(
      /\.wl-strip:not\(\.wl-strip--column\) > \.wl-light:has\(> \.wl-text\):not\(:last-child\) \{\s*margin-right: ([\d.]+)em;/
    )
    // At least twice the room before the next light as between a light and its reading.
    expect(between + afterReading).toBeGreaterThanOrEqual(2 * own)
    // The reading's trailing letter spacing does not add to it.
    expect(SOURCE).toMatch(/\.wl-text \{[^}]*margin-right: calc\(-1 \* var\(--ov-track-tag\)\);/)
  })

  it('puts the texts left of the icons in a column with labelSide left (A.10), not in a row', () => {
    expect(SOURCE).toMatch(
      /textsLeft = computed\(\(\) => column\.value && options\.value\.labelSide === 'left'\)/
    )
    expect(SOURCE).toMatch(/\.wl-strip--left > \.wl-light \{\s*flex-direction: row-reverse;/)
    expect(SOURCE).toMatch(/\.wl-strip--left \{\s*align-items: flex-end;/)
  })

  it('draws the unlit lights translucent in the settings sample with «Solo encendidos» only', () => {
    // Only in the settings page's sample (a sample host), never over the game or its edit mode.
    expect(SOURCE).toMatch(
      /unlitShown = computed\(\s*\(\) => inSample && phase\.value === 'preview' && shownFilter\.value\.onlyWhenLit\s*\)/
    )
    expect(SOURCE).toMatch(/'wl-light--unlit': unlitShown && light\.level === 'off'/)
    // As the preview's ghosts are drawn (previewEdit.ts marksCss).
    expect(SOURCE).toMatch(/\.wl-light--unlit \{\s*opacity: 0\.42;/)
  })
})
