import { describe, expect, it } from 'vitest'
import { hexOr } from './color'

describe('hexOr', () => {
  it('keeps valid #rrggbb in lower case', () => {
    expect(hexOr('#FFC400', '#000000')).toBe('#ffc400')
  })

  it('falls back on anything else', () => {
    for (const bad of [null, undefined, '', 'red', '#fff', '0xffffff', '#12345g']) {
      expect(hexOr(bad, '#4b5160')).toBe('#4b5160')
    }
  })
})
