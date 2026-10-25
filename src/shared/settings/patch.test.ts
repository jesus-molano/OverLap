import { describe, expect, it } from 'vitest'
import type { OverlaySettings } from '../types'
import { WIDGET_DEFS, type WidgetId } from '../widgets'
import {
  DEFAULT_SETTINGS,
  applySettingsPatch,
  createDefaultSettings,
  defaultOptions,
  defaultWidgetSettings,
  normalizeSettings,
  resetWidgetBounds,
  resetWidgetOptions
} from '.'

/** A non-default, already normalised state to patch. */
function customSettings(): OverlaySettings {
  const s = createDefaultSettings()
  s.appearance = { ...s.appearance, accent: '#22d3ee', fontScale: 110, nameFormat: 'surname' }
  s.widgets.relative = {
    ...s.widgets.relative,
    visible: false,
    bounds: { x: -1800, y: 40, width: 500, height: 300 },
    locked: true,
    backgroundOpacity: 0.3
  }
  s.widgets.radar.bounds = { x: 100, y: 200, width: 200, height: 220 }
  s.widgets.standings = {
    ...s.widgets.standings,
    visible: false,
    bounds: { x: 1200, y: 100, width: 600, height: 500 },
    locked: true,
    backgroundOpacity: 0.6,
    scale: 130,
    autoHeight: false,
    anchor: 'bottom',
    showIn: { practice: false, qualify: true, race: true },
    hideInPits: true
  }
  s.widgets.inputs.backgroundOpacity = 0.4
  s.relative = { ...s.relative, carsAhead: 5, carsBehind: 2, showClassPosition: false }
  s.radar = { rangeM: 30, showRangeLabels: false }
  s.standings = {
    ...s.standings,
    mode: 'full',
    topRows: 5,
    gapMode: 'leader',
    columns: s.standings.columns.map((c) => ({ ...c, visible: !c.visible })),
    headerSafetyRating: false
  }
  s.battle = { ...s.battle, thresholdS: 2.5, showBehind: false, holdS: 5 }
  s.inputs = { ...s.inputs, traceSeconds: 8, showClutch: false, traceWidth: 1.5 }
  s.widgets.traffic = {
    ...s.widgets.traffic,
    bounds: { x: 900, y: 600, width: 360, height: 140 },
    anchor: 'bottom',
    hideInPits: true
  }
  s.traffic = { ...s.traffic, behindS: 18, hazardS: 5, maxEntries: 2, showSlower: false }
  s.alerts = { ...s.alerts, showBlue: false, holdS: 1.5 }
  s.widgets.delta = { ...s.widgets.delta, scale: 120, hideInPits: true }
  s.delta = { ...s.delta, reference: 'session', rangeS: 1.5, showTrend: false }
  return normalizeSettings(s)
}

describe('applySettingsPatch', () => {
  it('returns an equal, independent copy for non-object or empty patches', () => {
    const current = customSettings()
    for (const patch of [undefined, null, 42, 'x', [], true, {}]) {
      const out = applySettingsPatch(current, patch)
      expect(out).toEqual(current)
      expect(out).not.toBe(current)
      expect(out.appearance).not.toBe(current.appearance)
      expect(out.widgets.standings.bounds).not.toBe(current.widgets.standings.bounds)
      expect(out.widgets.standings.showIn).not.toBe(current.widgets.standings.showIn)
      expect(out.standings.columns).not.toBe(current.standings.columns)
      expect(out.standings.columns[0]).not.toBe(current.standings.columns[0])
      expect(out.inputs.colors).not.toBe(current.inputs.colors)
    }
  })

  it('applies only the given widget fields', () => {
    const current = customSettings()
    const out = applySettingsPatch(current, { widgets: { radar: { backgroundOpacity: 0.5 } } })
    expect(out).toEqual({
      ...current,
      widgets: { ...current.widgets, radar: { ...current.widgets.radar, backgroundOpacity: 0.5 } }
    })
    const out2 = applySettingsPatch(current, {
      widgets: {
        standings: { scale: 85, anchor: 'top', showIn: { practice: true }, hideInPits: false }
      }
    })
    expect(out2.widgets.standings).toEqual({
      ...current.widgets.standings,
      scale: 85,
      anchor: 'top',
      showIn: { practice: true, qualify: true, race: true },
      hideInPits: false
    })
    expect(out2.widgets.radar).toEqual(current.widgets.radar)
  })

  it('never turns auto height on for a free widget', () => {
    const out = applySettingsPatch(customSettings(), {
      widgets: { radar: { autoHeight: true }, standings: { autoHeight: true } }
    })
    expect(out.widgets.radar.autoHeight).toBe(false)
    expect(out.widgets.standings.autoHeight).toBe(true)
  })

  it('ignores unknown widgets and unknown keys', () => {
    const current = customSettings()
    const out = applySettingsPatch(current, {
      version: 1,
      foo: 'bar',
      widgets: { fuel: { visible: true }, radar: { color: 'red' } },
      appearance: { theme: 'light' },
      relative: { rows: 9 },
      radar: { zoom: 2 }
    })
    expect(out).toEqual(current)
    expect('fuel' in out.widgets).toBe(false)
  })

  it('never changes bounds', () => {
    const current = customSettings()
    const out = applySettingsPatch(current, {
      widgets: {
        relative: { bounds: { x: 0, y: 0, width: 999, height: 999 }, visible: true },
        radar: { bounds: null }
      }
    })
    expect(out.widgets.relative.bounds).toEqual(current.widgets.relative.bounds)
    expect(out.widgets.relative.visible).toBe(true)
    expect(out.widgets.radar.bounds).toEqual(current.widgets.radar.bounds)
  })

  it('ignores wrong types, keeping the current value (not the default)', () => {
    const current = customSettings()
    const out = applySettingsPatch(current, {
      appearance: { accent: 'blue', fontScale: '120', units: 'si', colorBlind: 'yes' },
      widgets: {
        relative: { visible: 'true', locked: 0, backgroundOpacity: '0.9' },
        standings: { scale: null, anchor: 'left', showIn: { race: 1 }, hideInPits: 'no' }
      },
      relative: { carsAhead: '7', carsBehind: null, showClassPosition: 1 },
      radar: { rangeM: Infinity, showRangeLabels: 'true' },
      standings: { mode: 'tiny', topRows: '4', gapMode: 'gap', columns: 'all', headerIRating: 0 },
      battle: { thresholdS: '2', holdS: null, layout: 'grid', showBehind: 'true' },
      inputs: { traceSeconds: Number.NaN, traceWidth: '2', colors: { brake: 'red' }, layout: 1 },
      traffic: { behindS: '20', maxEntries: null, showFaster: 'no', nameFormat: 'nick' },
      alerts: { holdS: '5', showBlue: 1, showFlags: null },
      delta: { reference: 'all', fallback: 'yes', rangeS: '2', showSectors: 0 }
    })
    expect(out).toEqual(current)
    expect(
      applySettingsPatch(current, {
        appearance: 1,
        widgets: [],
        relative: 'x',
        radar: 5,
        standings: [],
        battle: null,
        inputs: true,
        traffic: 'x',
        alerts: [],
        delta: 'pb'
      })
    ).toEqual(current)
  })

  it('applies the v2.1 traffic and alerts fields', () => {
    const current = customSettings()
    const out = applySettingsPatch(current, {
      widgets: { alerts: { anchor: 'bottom', scale: 150 }, traffic: { autoHeight: false } },
      traffic: { aheadS: 15, showHazards: false, onlyMulticlass: false, nameFormat: 'surname' },
      alerts: { showPitLimiter: false, holdS: 0 }
    })
    expect(out.traffic).toEqual({
      ...current.traffic,
      aheadS: 15,
      showHazards: false,
      onlyMulticlass: false,
      nameFormat: 'surname'
    })
    expect(out.alerts).toEqual({ ...current.alerts, showPitLimiter: false, holdS: 0 })
    expect(out.widgets.alerts).toEqual({ ...current.widgets.alerts, anchor: 'bottom', scale: 150 })
    expect(out.widgets.traffic).toEqual({ ...current.widgets.traffic, autoHeight: false })
    expect(out.widgets.traffic.bounds).toEqual(current.widgets.traffic.bounds)
  })

  it('applies the v2.2 delta fields', () => {
    const current = customSettings()
    const out = applySettingsPatch(current, {
      widgets: { delta: { backgroundOpacity: 0.4, autoHeight: true } },
      delta: { reference: 'class', fallback: false, rangeS: 0.75, showPredicted: false }
    })
    expect(out.delta).toEqual({
      ...current.delta,
      reference: 'class',
      fallback: false,
      rangeS: 0.75,
      showPredicted: false
    })
    // A free-size widget never follows its content.
    expect(out.widgets.delta).toEqual({ ...current.widgets.delta, backgroundOpacity: 0.4 })
    // The optimal references are choices like the others.
    for (const reference of ['optimal', 'classOptimal'] as const) {
      expect(applySettingsPatch(current, { delta: { reference } }).delta.reference).toBe(reference)
    }
  })

  it('applies the v4 fields', () => {
    const current = customSettings()
    const out = applySettingsPatch(current, {
      appearance: { accent: '#A3E635', density: 'compact', textHalo: 'on', showSimPill: false },
      standings: { gapMode: 'both', nameFormat: 'tv', iRatingDeltaAll: true, density: 'compact' },
      battle: { layout: 'side', detail: 'laps', holdS: 0, showPrediction: false },
      inputs: { clutchInTrace: false, steeringStyle: 'wheel', layout: 'bars' }
    })
    expect(out.appearance).toEqual({
      ...current.appearance,
      accent: '#a3e635',
      density: 'compact',
      textHalo: 'on',
      showSimPill: false
    })
    expect(out.standings).toEqual({
      ...current.standings,
      gapMode: 'both',
      nameFormat: 'tv',
      iRatingDeltaAll: true,
      density: 'compact'
    })
    expect(out.battle).toEqual({
      ...current.battle,
      layout: 'side',
      detail: 'laps',
      holdS: 0,
      showPrediction: false
    })
    expect(out.inputs).toEqual({
      ...current.inputs,
      clutchInTrace: false,
      steeringStyle: 'wheel',
      layout: 'bars'
    })
  })

  it('switches the language and keeps the current one for an invalid value', () => {
    const current = customSettings()
    expect(current.appearance.language).toBe('es')
    const en = applySettingsPatch(current, { appearance: { language: 'en' } })
    expect(en).toEqual({ ...current, appearance: { ...current.appearance, language: 'en' } })
    for (const bad of ['fr', 'EN', null, 1, {}]) {
      expect(applySettingsPatch(en, { appearance: { language: bad } }).appearance.language).toBe(
        'en'
      )
    }
    // A patch without it (the appearance reset) leaves it alone.
    const look: Record<string, unknown> = { ...DEFAULT_SETTINGS.appearance }
    delete look.language
    expect(applySettingsPatch(en, { appearance: look }).appearance).toEqual({
      ...DEFAULT_SETTINGS.appearance,
      language: 'en'
    })
    expect(applySettingsPatch(en, { appearance: { language: 'es' } }).appearance.language).toBe(
      'es'
    )
  })

  it('replaces the column list, normalised', () => {
    const current = customSettings()
    const out = applySettingsPatch(current, {
      standings: {
        columns: [
          { id: 'gap', visible: true },
          { id: 'last', visible: true },
          { id: 'gap', visible: false }
        ]
      }
    })
    expect(out.standings.columns.map((c) => c.id)).toEqual([
      'gap',
      'last',
      'gained',
      'ir',
      'lic',
      'delta',
      'gapLeader',
      'pit'
    ])
    expect(out.standings.columns.filter((c) => c.visible).map((c) => c.id)).toEqual(['gap', 'last'])
  })

  it('merges pedal colours one by one', () => {
    const current = customSettings()
    const out = applySettingsPatch(current, {
      inputs: { colors: { brake: '#F43F5E', clutch: 'x' } }
    })
    expect(out.inputs.colors).toEqual({ ...current.inputs.colors, brake: '#f43f5e' })
  })

  it('clamps numbers like normalizeSettings', () => {
    const current = customSettings()
    const out = applySettingsPatch(current, {
      appearance: { fontScale: 500 },
      widgets: { battle: { scale: 12, backgroundOpacity: 2 } },
      relative: { carsAhead: 99, carsBehind: 2.6 },
      radar: { rangeM: 1 },
      battle: { thresholdS: 0.84, holdS: 99 },
      traffic: { behindS: 45, aheadS: 1, hazardS: 7.5, maxEntries: 12 },
      alerts: { holdS: 3.24 },
      delta: { rangeS: 5 }
    })
    expect(out.appearance.fontScale).toBe(150)
    expect(out.widgets.battle.scale).toBe(60)
    expect(out.widgets.battle.backgroundOpacity).toBe(1)
    expect(out.relative.carsAhead).toBe(10)
    expect(out.relative.carsBehind).toBe(3)
    expect(out.radar.rangeM).toBe(5)
    expect(out.battle.thresholdS).toBe(0.8)
    expect(out.battle.holdS).toBe(10)
    expect(out.traffic).toMatchObject({ behindS: 30, aheadS: 2, hazardS: 8, maxEntries: 5 })
    expect(out.alerts.holdS).toBe(3.2)
    expect(out.delta.rangeS).toBe(3)
  })

  it('never mutates current, frozen or not', () => {
    const current = customSettings()
    const snapshot = JSON.parse(JSON.stringify(current))
    const patch = {
      appearance: { accent: '#ffffff' },
      widgets: { standings: { visible: true, showIn: { race: false } } },
      standings: { columns: [{ id: 'pit', visible: false }] },
      inputs: { colors: { throttle: '#000000' } }
    }
    applySettingsPatch(current, patch)
    expect(current).toEqual(snapshot)

    const out = applySettingsPatch(DEFAULT_SETTINGS, patch)
    expect(out.widgets.standings.showIn.race).toBe(false)
    expect(Object.isFrozen(out)).toBe(false)
    expect(DEFAULT_SETTINGS).toEqual(createDefaultSettings())
  })

  it('returns normalised settings', () => {
    const out = applySettingsPatch(customSettings(), {
      widgets: { radar: { backgroundOpacity: 7, scale: 1000 } },
      standings: { topRows: 0.6, columns: [{ id: 'ir', visible: true }] },
      inputs: { traceSeconds: 99.9 }
    })
    expect(normalizeSettings(out)).toEqual(out)
    expect(out.version).toBe(4)
  })
})

describe('resetWidgetBounds', () => {
  it('resets only that widget bounds', () => {
    const current = customSettings()
    const out = resetWidgetBounds(current, 'relative')
    expect(out.widgets.relative).toEqual({
      ...current.widgets.relative,
      bounds: WIDGET_DEFS.relative.defaultBounds
    })
    expect(out.widgets.radar).toEqual(current.widgets.radar)
    expect(out.relative).toEqual(current.relative)
  })

  it('is pure and does not share the default rect', () => {
    const current = customSettings()
    const snapshot = JSON.parse(JSON.stringify(current))
    const out = resetWidgetBounds(current, 'radar')
    expect(current).toEqual(snapshot)
    expect(out.widgets.radar.bounds).not.toBe(WIDGET_DEFS.radar.defaultBounds)
    expect(() => resetWidgetBounds(DEFAULT_SETTINGS, 'radar')).not.toThrow()
  })

  it('returns an unchanged copy for an unknown id', () => {
    const current = customSettings()
    const out = resetWidgetBounds(current, 'fuel' as WidgetId)
    expect(out).toEqual(current)
    expect(out).not.toBe(current)
  })
})

describe('resetWidgetOptions', () => {
  it('resets the options and look of one widget, keeping bounds, visibility and lock', () => {
    const current = customSettings()
    const out = resetWidgetOptions(current, 'standings')
    expect(out.standings).toEqual(defaultOptions('standings'))
    expect(out.widgets.standings).toEqual({
      ...defaultWidgetSettings('standings'),
      bounds: current.widgets.standings.bounds,
      visible: false,
      locked: true
    })
    // Nothing else changes, appearance included.
    expect(out).toEqual({
      ...current,
      widgets: { ...current.widgets, standings: out.widgets.standings },
      standings: out.standings
    })
  })

  it('works for every widget and shares no object with the defaults', () => {
    const current = customSettings()
    for (const id of [
      'relative',
      'radar',
      'battle',
      'inputs',
      'traffic',
      'alerts',
      'delta'
    ] as const) {
      const out = resetWidgetOptions(current, id)
      expect(out[id]).toEqual(DEFAULT_SETTINGS[id])
      expect(out.widgets[id].backgroundOpacity).toBe(WIDGET_DEFS[id].defaultBackgroundOpacity)
      expect(out.widgets[id].bounds).toEqual(current.widgets[id].bounds)
    }
    const out = resetWidgetOptions(current, 'inputs')
    out.inputs.colors.brake = '#000000'
    expect(DEFAULT_SETTINGS.inputs.colors.brake).toBe('#ff4545')
  })

  it('resets the traffic widget alone: its look back to WIDGET_DEFS, alerts untouched', () => {
    const current = customSettings()
    const out = resetWidgetOptions(current, 'traffic')
    expect(out.traffic).toEqual(defaultOptions('traffic'))
    expect(out.widgets.traffic).toEqual({
      ...defaultWidgetSettings('traffic'),
      bounds: current.widgets.traffic.bounds
    })
    expect(out.widgets.traffic.anchor).toBe('top')
    expect(out.widgets.traffic.hideInPits).toBe(false)
    expect(out.alerts).toEqual(current.alerts)
    expect(out.battle).toEqual(current.battle)
  })

  it('resets the delta widget alone, keeping its bounds', () => {
    const current = customSettings()
    const out = resetWidgetOptions(current, 'delta')
    expect(out.delta).toEqual(defaultOptions('delta'))
    expect(out.widgets.delta).toEqual({
      ...defaultWidgetSettings('delta'),
      bounds: current.widgets.delta.bounds
    })
    expect(out.alerts).toEqual(current.alerts)
  })

  it('is pure and ignores unknown ids', () => {
    const current = customSettings()
    const snapshot = JSON.parse(JSON.stringify(current))
    resetWidgetOptions(current, 'battle')
    expect(current).toEqual(snapshot)
    const out = resetWidgetOptions(current, 'fuel' as WidgetId)
    expect(out).toEqual(current)
    expect(out).not.toBe(current)
  })
})

describe('applySettingsPatch: shortcuts', () => {
  function withShortcuts(toggleOverlay: string, toggleEditMode: string): OverlaySettings {
    const s = createDefaultSettings()
    s.shortcuts = { toggleOverlay, toggleEditMode }
    return s
  }

  it('assigns a valid combination in its canonical spelling', () => {
    const out = applySettingsPatch(DEFAULT_SETTINGS, {
      shortcuts: { toggleOverlay: 'control+alt+shift+o' }
    })
    expect(out.shortcuts).toEqual({
      toggleOverlay: 'Ctrl+Alt+Shift+O',
      toggleEditMode: 'Ctrl+Shift+E'
    })
  })

  it('turns a shortcut off with an empty combination', () => {
    const out = applySettingsPatch(DEFAULT_SETTINGS, { shortcuts: { toggleEditMode: '' } })
    expect(out.shortcuts.toggleEditMode).toBe('')
  })

  it('keeps the current combination for an invalid or reserved one', () => {
    const current = withShortcuts('F13', 'Ctrl+Alt+PageUp')
    for (const bad of ['Ctrl+V', 'Alt+Tab', 'F2', 'Win+E', 'Ctrl+;', 7, null]) {
      expect(
        applySettingsPatch(current, { shortcuts: { toggleOverlay: bad } }).shortcuts,
        JSON.stringify(bad)
      ).toEqual(current.shortcuts)
    }
  })

  it("refuses another action's combination: both keep theirs", () => {
    const out = applySettingsPatch(DEFAULT_SETTINGS, {
      shortcuts: { toggleOverlay: 'Ctrl+Shift+E' }
    })
    expect(out.shortcuts).toEqual(DEFAULT_SETTINGS.shortcuts)
  })

  it('refuses giving both actions one new combination', () => {
    const out = applySettingsPatch(DEFAULT_SETTINGS, {
      shortcuts: { toggleOverlay: 'Ctrl+Alt+F9', toggleEditMode: 'Ctrl+Alt+F9' }
    })
    expect(out.shortcuts).toEqual(DEFAULT_SETTINGS.shortcuts)
  })

  it('accepts a swap, and a combination another action gives up in the same patch', () => {
    const swapped = applySettingsPatch(DEFAULT_SETTINGS, {
      shortcuts: { toggleOverlay: 'Ctrl+Shift+E', toggleEditMode: 'Ctrl+Shift+H' }
    })
    expect(swapped.shortcuts).toEqual({
      toggleOverlay: 'Ctrl+Shift+E',
      toggleEditMode: 'Ctrl+Shift+H'
    })
    const handedOver = applySettingsPatch(DEFAULT_SETTINGS, {
      shortcuts: { toggleOverlay: 'Ctrl+Shift+E', toggleEditMode: '' }
    })
    expect(handedOver.shortcuts).toEqual({ toggleOverlay: 'Ctrl+Shift+E', toggleEditMode: '' })
  })

  it('keeps the valid half of a patch whose other half collides', () => {
    const out = applySettingsPatch(DEFAULT_SETTINGS, {
      shortcuts: { toggleOverlay: 'Ctrl+Shift+E', toggleEditMode: 'Ctrl+Alt+F10' }
    })
    // toggleEditMode moved away, so toggleOverlay may take its old combination.
    expect(out.shortcuts).toEqual({ toggleOverlay: 'Ctrl+Shift+E', toggleEditMode: 'Ctrl+Alt+F10' })
    const moved = applySettingsPatch(withShortcuts('F13', 'F14'), {
      shortcuts: { toggleOverlay: 'F14', toggleEditMode: 'F15' }
    })
    expect(moved.shortcuts).toEqual({ toggleOverlay: 'F14', toggleEditMode: 'F15' })
    const half = applySettingsPatch(withShortcuts('F13', 'F14'), {
      shortcuts: { toggleOverlay: 'F14', toggleEditMode: 'Ctrl+C' }
    })
    expect(half.shortcuts).toEqual({ toggleOverlay: 'F13', toggleEditMode: 'F14' })
  })

  it('resets every shortcut at once with the defaults as one patch', () => {
    const current = withShortcuts('Ctrl+Shift+E', 'Ctrl+Shift+H')
    const out = applySettingsPatch(current, { shortcuts: { ...DEFAULT_SETTINGS.shortcuts } })
    expect(out.shortcuts).toEqual(DEFAULT_SETTINGS.shortcuts)
  })
})
