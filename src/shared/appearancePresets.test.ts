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
import { isComplete, isDefaultContents } from './completeContents'
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

  it('reads «OverLap» only while the widgets show what they show on a new install too', () => {
    // «Completo»'s widgets under OverLap's look: «Personalizado», not «OverLap».
    const s = withStyle('complete')
    Object.assign(s.appearance, presetValues('overlap'))
    expect(matchingPreset(s)).toBeNull()
    // One column of yours hidden: «Personalizado» too.
    const mine = createDefaultSettings()
    mine.relative.columns = mine.relative.columns.map((c, i) =>
      i === 0 ? { ...c, visible: !c.visible } : c
    )
    expect(matchingPreset(mine)).toBeNull()
    // Limpio and Compacto are looks alone: the widgets' contents never change which one it is.
    Object.assign(mine.appearance, presetValues('clean'))
    expect(matchingPreset(mine)).toBe('clean')
    Object.assign(mine.appearance, presetValues('compact'))
    expect(matchingPreset(mine)).toBe('compact')
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

  it('says it touches the contents only when it does (the dialog then names the layout)', () => {
    const s = createDefaultSettings()
    s.appearance.backgroundOpacity = 0.55
    // A look tuned by hand, the contents as they come: OverLap asks, but only about the look.
    const plan = planStyle(s, 'overlap')
    expect(plan.confirm).toBe(true)
    expect(plan.contents).toBe(false)
    expect(planStyle(s, 'complete').contents).toBe(true)
    // Once complete, «Completo» again over a hand-tuned look: the look alone.
    const complete = applySettingsPatch(s, planStyle(s, 'complete').patch)
    complete.appearance.backgroundOpacity = 0.55
    expect(planStyle(complete, 'complete').contents).toBe(false)
    expect(planStyle(complete, 'overlap').contents).toBe(true)
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

  it('«OverLap» after «Completo»: everything back as it comes, asked first, counted', () => {
    const complete = withStyle('complete')
    const plan = planStyle(complete, 'overlap')
    expect(plan.confirm).toBe(true)
    expect(plan.changes).toContainEqual({
      kind: 'look',
      field: 'backgroundOpacity',
      from: 0.9,
      to: 0.8
    })
    // The five columns «Completo» showed go away again.
    expect(plan.changes).toContainEqual({
      kind: 'widget',
      widget: 'standings',
      what: 'columnsHidden',
      count: 5
    })
    expect(plan.changes).toContainEqual({
      kind: 'widget',
      widget: 'fuel',
      what: 'elementsHidden',
      count: 2
    })
    expect(plan.changes.some((c) => c.kind === 'widget' && c.what === 'barsOff')).toBe(true)
    expect(plan.changes.some((c) => c.kind === 'widget' && c.what === 'optionsDefault')).toBe(true)
    // «Completo» never adds a «less» line, «OverLap» never a «more» one.
    const more: readonly string[] = ['columns', 'elements', 'bars', 'barItems', 'options']
    expect(plan.changes.some((c) => c.kind === 'widget' && more.includes(c.what))).toBe(false)
    const gained = planStyle(createDefaultSettings(), 'complete').changes
    expect(gained.some((c) => c.kind === 'widget' && !more.includes(c.what))).toBe(false)
    const after = applySettingsPatch(complete, plan.patch)
    const fresh = createDefaultSettings()
    for (const key of [
      'appearance',
      'relative',
      'standings',
      'fuel',
      'lights',
      'widgets'
    ] as const) {
      expect(after[key], key).toEqual(fresh[key])
    }
    expect(isDefaultContents(after)).toBe(true)
    expect(matchingPreset(after)).toBe('overlap')
  })

  it('«OverLap» puts a reordered list back in its order, and says so', () => {
    const s = createDefaultSettings()
    s.standings.columns = [...s.standings.columns].reverse()
    const plan = planStyle(s, 'overlap')
    expect(plan.confirm).toBe(true)
    expect(plan.changes).toEqual([{ kind: 'widget', widget: 'standings', what: 'order', count: 1 }])
    const after = applySettingsPatch(s, plan.patch)
    expect(after.standings.columns).toEqual(createDefaultSettings().standings.columns)
  })

  it('«OverLap» keeps the accent, Accesibilidad, SIM tag, language, units and places', () => {
    const s = withStyle('complete')
    Object.assign(s.appearance, { accent: '#33ccff', colorBlind: true, largeLabels: true })
    Object.assign(s.appearance, { showSimPill: false, language: 'en', units: 'imperial' })
    s.widgets.radar.visible = false
    s.widgets.standings.bounds = { x: 5, y: 6, width: 600, height: 500 }
    const after = applySettingsPatch(s, planStyle(s, 'overlap').patch)
    expect(after.appearance).toMatchObject({ accent: '#33ccff', colorBlind: true })
    expect(after.appearance).toMatchObject({ largeLabels: true, showSimPill: false })
    expect(after.appearance).toMatchObject({ language: 'en', units: 'imperial' })
    expect(after.widgets.radar.visible).toBe(false)
    expect(after.widgets.standings.bounds).toEqual(s.widgets.standings.bounds)
  })

  it('"Deshacer" after «OverLap» brings «Completo» back as it was', () => {
    const complete = withStyle('complete')
    complete.widgets.fuel.autoHeight = false
    const plan = planStyle(complete, 'overlap')
    const after = applySettingsPatch(complete, plan.patch)
    const back = applySettingsPatch(after, undoPatch(complete, plan.patch))
    for (const key of [
      'appearance',
      'relative',
      'standings',
      'battle',
      'fuel',
      'widgets'
    ] as const) {
      expect(back[key], key).toEqual(complete[key])
    }
    expect(back.widgets.fuel.autoHeight).toBe(false)
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
