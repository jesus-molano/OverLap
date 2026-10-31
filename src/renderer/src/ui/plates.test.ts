/**
 * Plate geometry (spec §3): every plate-like element of the kit is one height per widget
 * (`--ov-plate-h`, resolved on the panel), centred, with the chip radius. Nine chip heights
 * became one; this keeps it that way.
 */
import { describe, expect, it } from 'vitest'

const RAW = import.meta.glob('./*.vue', {
  query: '?raw',
  import: 'default',
  eager: true
}) as Record<string, string>

/** Declarations of `selector` in a component's <style> blocks (comments removed). */
function declsOf(file: string, selector: string): Map<string, string> {
  const source = RAW[file] ?? ''
  const css = [...source.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)]
    .map((m) => m[1] ?? '')
    .join('\n')
    .replace(/\/\*[\s\S]*?\*\//g, '')
  const out = new Map<string, string>()
  for (const m of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const selectors = (m[1] ?? '').split(',').map((s) => s.trim())
    if (!selectors.includes(selector)) continue
    for (const d of (m[2] ?? '').matchAll(/([-\w]+)\s*:\s*([^;]+)/g)) {
      out.set((d[1] ?? '').trim(), (d[2] ?? '').replace(/\s+/g, ' ').trim())
    }
  }
  return out
}

const PLATES: ReadonlyArray<readonly [file: string, selector: string]> = [
  ['./NumberBadge.vue', '.ov-num'],
  ['./PositionChip.vue', '.ov-pos'],
  ['./LicenseChip.vue', '.ov-lic'],
  ['./Badge.vue', '.ov-badge'],
  ['./Chip.vue', '.ov-chip'],
  ['./SimPill.vue', '.ov-sim'],
  ['./PreviewTag.vue', '.ov-preview-tag'],
  ['./LapTime.vue', '.ov-laptime']
]

describe('plate geometry', () => {
  for (const [file, selector] of PLATES) {
    it(`${selector} is a plate`, () => {
      const d = declsOf(file, selector)
      expect(d.get('height')).toBe('var(--ov-plate-h)')
      expect(d.get('display')).toBe('inline-flex')
      expect(d.get('align-items')).toBe('center')
      expect(d.get('line-height')).toBe('1')
      expect(d.get('border-radius')).toBe('var(--ov-radius-chip)')
    })
  }

  it('keeps 700 for text on a solid fill', () => {
    expect(declsOf('./NumberBadge.vue', '.ov-num--filled').get('color')).toBe('var(--cls-fg)')
    expect(declsOf('./NumberBadge.vue', '.ov-num').get('font-weight')).toBe('var(--ov-w-solid)')
    expect(declsOf('./PositionChip.vue', '.ov-pos--player').get('font-weight')).toBe(
      'var(--ov-w-solid)'
    )
    expect(declsOf('./Badge.vue', '.ov-badge--solid').get('font-weight')).toBe('var(--ov-w-solid)')
    expect(declsOf('./Chip.vue', '.ov-chip--solid').get('font-weight')).toBe('var(--ov-w-solid)')
    expect(declsOf('./LicenseChip.vue', '.ov-lic--solid').get('font-weight')).toBe(
      'var(--ov-w-solid)'
    )
  })

  it('sets driver names on the baseline of the plate digits, from the plate text size', () => {
    const name = declsOf('./DriverCell.vue', '.ov-driver__name')
    const plate = declsOf('./NumberBadge.vue', '.ov-num')
    // The name's offset is computed from the plate's own size and line height: keep them in step.
    expect(name.get('position')).toBe('relative')
    expect(name.get('--dc-plate')).toBe('var(--ov-t-plate)')
    expect(name.get('top')).toMatch(/1lh/)
    expect(plate.get('font-size')).toBe('var(--ov-t-plate)')
    expect(plate.get('line-height')).toBe('1')
  })

  it('draws keys as background layers, never as box-shadows', () => {
    for (const variant of ['.ov-chip--soft', '.ov-chip--outline']) {
      const cell = declsOf('./Chip.vue', variant)
      expect(cell.get('background')).toMatch(/var\(--ov-key-w\)/)
      // Shadows only ring the cell or shade its top edge; the key is never one of them.
      const shadow = cell.get('box-shadow') ?? ''
      expect(shadow).not.toMatch(/--ov-chip-key|--ov-key-w|inset 0 -/)
    }
  })

  it('tells a lap ahead from a lap behind by shape as well as colour, inside the plate (R36)', () => {
    const ahead = declsOf('./NumberBadge.vue', '.ov-num--lap-ahead::after')
    const behind = declsOf('./NumberBadge.vue', '.ov-num--lap-behind::after')
    // A notch at the top for a lap ahead, at the bottom for a lap behind.
    expect(ahead.get('top')).toBe('0')
    expect(behind.get('bottom')).toBe('0')
    expect(ahead.get('clip-path')).not.toBe(behind.get('clip-path'))
    // In the lap colour, positioned in the plate: no width or height added.
    expect(ahead.get('background')).toBe('currentcolor')
    expect(ahead.get('position')).toBe('absolute')
    expect(declsOf('./NumberBadge.vue', '.ov-num').get('position')).toBe('relative')
  })
})
