import { describe, expect, it } from 'vitest'
import {
  APPEARANCE_PRESETS,
  PRESET_FIELDS,
  matchingPreset,
  planStyle,
  presetFieldsOf,
  presetValues,
  undoPatch,
  type AppearancePreset
} from './appearancePresets'
import { isComplete } from './completeContents'
import { applySettingsPatch, createDefaultSettings, normalizeSettings } from './settings'
import { validateOption } from './settings/fields'
import { OPTION_SCHEMA } from './settingsSchema'
import { messagesFor } from './i18n'
import type { OverlaySettings } from './types'

function withStyle(p: AppearancePreset, s = createDefaultSettings()): OverlaySettings {
  return applySettingsPatch(s, planStyle(s, p).patch)
}

describe('Apariencia styles (R56, redone)', () => {
  it('OverLap, Limpio, Compacto and Completo, in that order, «Como iRacing» gone', () => {
    expect(APPEARANCE_PRESETS).toEqual(['overlap', 'clean', 'compact', 'complete'])
  })

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

  it('tells the four apart at a glance: panel, size and what is drawn', () => {
    const o = presetValues('overlap')
    const clean = presetValues('clean')
    const compact = presetValues('compact')
    const complete = presetValues('complete')
    // Limpio: no panel at all, the text kept legible by its outline, no decorations.
    expect(clean).toMatchObject({ backgroundOpacity: 0, textHalo: 'on', stripes: false })
    expect(clean).toMatchObject({ brandMarks: 'off', countryFlags: false, penaltyFlags: false })
    // Compacto: smaller and tighter, never at the bottom of the text scale.
    expect(compact.fontScale).toBeLessThan(o.fontScale)
    expect(compact.fontScale).toBeGreaterThanOrEqual(85)
    expect(compact).toMatchObject({ density: 'compact', nameFormat: 'surname' })
    // Completo: comfortable rows, a more solid panel, logos always.
    expect(complete).toMatchObject({ density: 'comfortable', brandMarks: 'on' })
    expect(complete.backgroundOpacity).toBeGreaterThan(o.backgroundOpacity)
  })

  it('never touches what is yours or a need: accent, Accesibilidad, SIM tag, language, units', () => {
    for (const f of [
      'accent',
      'colorBlind',
      'largeLabels',
      'noFlashing',
      'settingsZoom',
      'showSimPill',
      'language',
      'units'
    ]) {
      expect(PRESET_FIELDS as readonly string[]).not.toContain(f)
    }
    const mine = createDefaultSettings()
    const kept = {
      accent: '#33ccff',
      colorBlind: true,
      largeLabels: true,
      noFlashing: true,
      settingsZoom: 120,
      showSimPill: false,
      language: 'en',
      units: 'imperial'
    } as const
    Object.assign(mine.appearance, kept)
    for (const p of APPEARANCE_PRESETS) {
      expect(withStyle(p, mine).appearance, p).toMatchObject(kept)
    }
  })

  it('reads a new install as «OverLap», a hand-tuned look as none', () => {
    const s = createDefaultSettings()
    expect(matchingPreset(s)).toBe('overlap')
    // The accent or the units never change which one it is.
    const a = { ...s.appearance, accent: '#33ccff', units: 'imperial' as const }
    expect(matchingPreset({ ...s, appearance: a })).toBe('overlap')
    expect(matchingPreset(withStyle('clean'))).toBe('clean')
    const tuned = withStyle('clean')
    tuned.appearance.stripes = true
    expect(matchingPreset(tuned)).toBeNull()
  })

  it('reads «Completo» only while every widget still shows everything', () => {
    const s = withStyle('complete')
    expect(isComplete(s)).toBe(true)
    expect(matchingPreset(s)).toBe('complete')
    // The look alone, with the widgets as they were, is «Personalizado».
    const lookOnly = createDefaultSettings()
    Object.assign(lookOnly.appearance, presetValues('complete'))
    expect(matchingPreset(lookOnly)).toBeNull()
    // One column hidden again by hand: «Personalizado» too.
    s.standings.columns = s.standings.columns.map((c) =>
      c.id === 'tyre' ? { ...c, visible: false } : c
    )
    expect(matchingPreset(s)).toBeNull()
  })

  it('an old file with the «Como iRacing» look loads as it was, «Personalizado»', () => {
    const old = normalizeSettings({
      version: 6,
      appearance: {
        backgroundOpacity: 0.9,
        density: 'compact',
        licenseStyle: 'solid',
        nameFormat: 'full',
        brandMarks: 'off',
        countryFlags: false
      }
    })
    expect(old.appearance).toMatchObject({ backgroundOpacity: 0.9, licenseStyle: 'solid' })
    expect(matchingPreset(old)).toBeNull()
  })

  it('copies the look as it is', () => {
    const a = { ...createDefaultSettings().appearance, density: 'compact' as const }
    const before = presetFieldsOf(a)
    expect(before.density).toBe('compact')
    expect('accent' in before).toBe(false)
  })
})

describe('planStyle: what a style changes and when it asks first', () => {
  it('lists the look changes old → new, nothing else for a look-only style', () => {
    const plan = planStyle(createDefaultSettings(), 'clean')
    expect(plan.changes).toContainEqual({
      kind: 'look',
      field: 'backgroundOpacity',
      from: 0.8,
      to: 0
    })
    expect(plan.changes).toContainEqual({
      kind: 'look',
      field: 'countryFlags',
      from: true,
      to: false
    })
    expect(plan.changes.every((c) => c.kind === 'look')).toBe(true)
    expect(Object.keys(plan.patch)).toEqual(['appearance'])
  })

  it('from one style to another of the look alone: at once, no question (Deshacer is there)', () => {
    expect(planStyle(createDefaultSettings(), 'clean').confirm).toBe(false)
    expect(planStyle(withStyle('clean'), 'compact').confirm).toBe(false)
    expect(planStyle(withStyle('compact'), 'overlap').confirm).toBe(false)
  })

  it('asks before overwriting a look tuned by hand', () => {
    const s = createDefaultSettings()
    s.appearance.backgroundOpacity = 0.55
    const plan = planStyle(s, 'clean')
    expect(plan.confirm).toBe(true)
    expect(plan.changes).toContainEqual({
      kind: 'look',
      field: 'backgroundOpacity',
      from: 0.55,
      to: 0
    })
  })

  it('asks before «Completo» changes the widgets, and counts what each one gains', () => {
    const plan = planStyle(createDefaultSettings(), 'complete')
    expect(plan.confirm).toBe(true)
    // delta, gapLeader, pitLap, stint, tyre.
    expect(plan.changes).toContainEqual({
      kind: 'widget',
      widget: 'standings',
      what: 'columns',
      count: 5
    })
    // The fuel's tyres and limits lines.
    expect(plan.changes).toContainEqual({
      kind: 'widget',
      widget: 'fuel',
      what: 'elements',
      count: 2
    })
    expect(plan.changes.some((c) => c.kind === 'widget' && c.what === 'bars')).toBe(true)
  })

  it('with nothing to change, there is nothing to do and nothing to ask', () => {
    for (const p of APPEARANCE_PRESETS) {
      const plan = planStyle(withStyle(p), p)
      expect(plan.patch, p).toEqual({})
      expect(plan.changes, p).toEqual([])
      expect(plan.confirm, p).toBe(false)
    }
  })

  it('"Deshacer" puts back the look and every widget field it changed', () => {
    const s = createDefaultSettings()
    s.appearance.backgroundOpacity = 0.55
    s.widgets.fuel.autoHeight = false
    const plan = planStyle(s, 'complete')
    const after = applySettingsPatch(s, plan.patch)
    expect(after.widgets.fuel.autoHeight).toBe(true)
    const back = applySettingsPatch(after, undoPatch(s, plan.patch))
    for (const key of [
      'appearance',
      'relative',
      'standings',
      'battle',
      'inputs',
      'fuel',
      'lights',
      'alerts',
      'widgets'
    ] as const) {
      expect(back[key], key).toEqual(s[key])
    }
  })
})

describe('the styles’ hints name what they set as the controls do', () => {
  it('«Limpio» says alternating rows, the number stripe and the letter licence, in each language', () => {
    expect(presetValues('clean')).toMatchObject({ stripes: false, numberStyle: 'stripe' })
    for (const lang of ['es', 'en'] as const) {
      const a = messagesFor(lang).settings.appearance
      const hint = a.presets.choices.clean.hint.toLowerCase()
      expect(hint).toContain(a.rows.stripes.toLowerCase())
      expect(hint).toContain(a.rows.numberChoices.stripe.label.toLowerCase())
      expect(hint).toContain(a.rows.licenseChoices.letter.label.toLowerCase())
      expect(a.presets.help.toLowerCase()).toContain(a.access.title.toLowerCase())
    }
  })

  it('«Compacto» and «Completo» say their numbers', () => {
    for (const lang of ['es', 'en'] as const) {
      const c = messagesFor(lang).settings.appearance.presets.choices
      expect(c.compact.hint).toContain(String(presetValues('compact').fontScale))
      expect(c.complete.hint).toContain(String(presetValues('complete').backgroundOpacity * 100))
    }
  })
})
