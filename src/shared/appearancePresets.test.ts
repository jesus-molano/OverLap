import { describe, expect, it } from 'vitest'
import {
  APPEARANCE_PRESETS,
  PRESET_FIELDS,
  matchingPreset,
  presetFieldsOf,
  presetValues
} from './appearancePresets'
import { createDefaultSettings } from './settings'
import { validateOption } from './settings/fields'
import { OPTION_SCHEMA } from './settingsSchema'

describe('Apariencia presets (R56)', () => {
  it('sets valid values only, each one a look of its own', () => {
    const seen = new Set<string>()
    for (const p of APPEARANCE_PRESETS) {
      const v = presetValues(p)
      expect(Object.keys(v).sort()).toEqual([...PRESET_FIELDS].sort())
      for (const f of PRESET_FIELDS) {
        const spec = OPTION_SCHEMA.appearance[f]
        expect(validateOption(spec, v[f], Symbol('invalid')), `${p}.${f}`).toBe(v[f])
      }
      seen.add(JSON.stringify(v))
    }
    expect(seen.size).toBe(APPEARANCE_PRESETS.length)
  })

  it('never touches what is yours or a need: accent, colour-blind palette, language, units', () => {
    for (const f of ['accent', 'colorBlind', 'language', 'units']) {
      expect(PRESET_FIELDS as readonly string[]).not.toContain(f)
    }
  })

  it('reads a new install as «OverLap», a hand-tuned look as none', () => {
    const a = createDefaultSettings().appearance
    expect(matchingPreset(a)).toBe('overlap')
    // The accent or the units never change which one it is.
    expect(matchingPreset({ ...a, accent: '#33ccff', units: 'imperial' })).toBe('overlap')
    expect(matchingPreset({ ...a, ...presetValues('clean') })).toBe('clean')
    expect(matchingPreset({ ...a, ...presetValues('clean'), stripes: true })).toBeNull()
  })

  it('copies the look as it is, for "Deshacer"', () => {
    const a = { ...createDefaultSettings().appearance, density: 'compact' as const }
    const before = presetFieldsOf(a)
    expect(before.density).toBe('compact')
    expect('accent' in before).toBe(false)
  })
})
