import { describe, expect, it } from 'vitest'
import { applySettingsPatch, createDefaultSettings } from '@shared/settings'
import { OPTION_SCHEMA, type OptionSpec } from '@shared/settingsSchema'
import type { OverlaySettings, StandingsColumn } from '@shared/types'
import { WIDGET_DEFS, WIDGET_IDS } from '@shared/widgets'
import {
  DISPLAY_ONLY,
  computedConfig,
  diffSettings,
  isSettingsCommand,
  viewOfSender,
  type ConfigSection
} from './settingsSync'

function patched(patch: unknown, base: OverlaySettings = createDefaultSettings()): OverlaySettings {
  return applySettingsPatch(base, patch)
}

/** A mutated copy of the defaults: independent of how patches are validated. */
function mutated(mutate: (s: OverlaySettings) => void): OverlaySettings {
  const s = createDefaultSettings()
  mutate(s)
  return s
}

/** Whether a change made with `mutate` reaches the telemetry process (it must always reach the renderers). */
function configChanged(mutate: (s: OverlaySettings) => void): boolean {
  const diff = diffSettings(createDefaultSettings(), mutated(mutate))
  expect(diff.changed).toBe(true)
  expect(diff.visibilityChanged).toEqual([])
  return diff.telemetryConfigChanged
}

/** Some other valid-looking value for a field (the diff does not normalise). */
function otherValue(spec: OptionSpec, value: unknown): unknown {
  switch (spec.kind) {
    case 'bool':
      return !value
    case 'int':
    case 'number':
      return (value as number) + 1
    case 'enum':
      return spec.values.find((v) => v !== value)
    case 'color':
      return value === '#000000' ? '#ffffff' : '#000000'
    case 'colors': {
      const colors = { ...(value as Record<string, string>) }
      const key = Object.keys(colors)[0] as string
      colors[key] = colors[key] === '#000000' ? '#ffffff' : '#000000'
      return colors
    }
    case 'columns':
      return (value as StandingsColumn[]).map((c, i) =>
        i === 0 ? { ...c, visible: !c.visible } : c
      )
    case 'accelerator':
      return value === 'Ctrl+Alt+F9' ? 'Ctrl+Alt+F10' : 'Ctrl+Alt+F9'
  }
}

function columns(...visible: StandingsColumn['id'][]): StandingsColumn[] {
  const order: StandingsColumn['id'][] = [
    'gained',
    'ir',
    'lic',
    'delta',
    'gap',
    'gapLeader',
    'last',
    'pit'
  ]
  return order.map((id) => ({ id, visible: visible.includes(id) }))
}

describe('viewOfSender', () => {
  const lookup = {
    isOverlay: (s: string): boolean => s === 'overlay-wc',
    isSettings: (s: string): boolean => s === 'settings-wc'
  }

  it('tells overlay windows, the settings window and strangers apart', () => {
    expect(viewOfSender('overlay-wc', lookup)).toEqual({ kind: 'overlay' })
    expect(viewOfSender('settings-wc', lookup)).toEqual({ kind: 'settings' })
    expect(viewOfSender('devtools', lookup)).toBeNull()
  })
})

describe('isSettingsCommand', () => {
  it('accepts the known commands', () => {
    expect(isSettingsCommand({ type: 'set-edit-mode', on: true })).toBe(true)
    expect(isSettingsCommand({ type: 'set-overlay-hidden', hidden: true })).toBe(true)
    expect(isSettingsCommand({ type: 'capture-shortcuts', on: false })).toBe(true)
    expect(isSettingsCommand({ type: 'reset-widget-bounds', widgetId: 'relative' })).toBe(true)
    expect(isSettingsCommand({ type: 'reset-widget-options', widgetId: 'standings' })).toBe(true)
    expect(isSettingsCommand({ type: 'open-settings-folder' })).toBe(true)
    expect(isSettingsCommand({ type: 'refresh-personal-bests' })).toBe(true)
    expect(isSettingsCommand({ type: 'clear-personal-bests' })).toBe(true)
    expect(
      isSettingsCommand({ type: 'delete-personal-bests', keys: ['67@219/Grand Prix', '80@1/'] })
    ).toBe(true)
  })

  it('rejects malformed or unknown ones', () => {
    for (const raw of [
      null,
      'set-edit-mode',
      [],
      {},
      { type: 'set-edit-mode' },
      { type: 'set-edit-mode', on: 'yes' },
      { type: 'set-overlay-hidden' },
      { type: 'set-overlay-hidden', hidden: 1 },
      { type: 'set-overlay-hidden', on: true },
      { type: 'capture-shortcuts' },
      { type: 'capture-shortcuts', on: 'true' },
      { type: 'reset-widget-bounds', widgetId: 'toString' },
      { type: 'reset-widget-bounds' },
      { type: 'reset-widget-options', widgetId: 'fuel' },
      { type: 'reset-widget-options' },
      { type: 'delete-personal-bests' },
      { type: 'delete-personal-bests', keys: [] },
      { type: 'delete-personal-bests', keys: 'x' },
      { type: 'delete-personal-bests', keys: [7] },
      { type: 'delete-personal-bests', keys: [''] },
      { type: 'delete-personal-bests', keys: ['x'.repeat(201)] },
      { type: 'delete-personal-bests', keys: new Array<string>(1001).fill('x') },
      { type: 'quit' }
    ]) {
      expect(isSettingsCommand(raw)).toBe(false)
    }
  })
})

describe('diffSettings', () => {
  it('reports nothing for equal settings', () => {
    const a = createDefaultSettings()
    expect(diffSettings(a, structuredClone(a))).toEqual({
      changed: false,
      visibilityChanged: [],
      telemetryConfigChanged: false
    })
  })

  it('enabling or disabling a widget changes the windows and the telemetry config', () => {
    const prev = createDefaultSettings()
    for (const id of WIDGET_IDS) {
      const next = patched({ widgets: { [id]: { visible: !prev.widgets[id].visible } } }, prev)
      expect(diffSettings(prev, next)).toEqual({
        changed: true,
        visibilityChanged: [id],
        telemetryConfigChanged: true
      })
    }
  })

  it('an invalid patch changes nothing', () => {
    const prev = createDefaultSettings()
    expect(
      diffSettings(prev, patched({ widgets: { radar: { visible: 'no' } } }, prev)).changed
    ).toBe(false)
  })

  it('window, look and appearance changes only need a broadcast', () => {
    for (const mutate of [
      (s: OverlaySettings) => (s.widgets.relative.locked = true),
      (s: OverlaySettings) => (s.widgets.relative.backgroundOpacity = 0.2),
      (s: OverlaySettings) => (s.widgets.radar.bounds.x += 10),
      (s: OverlaySettings) => (s.widgets.standings.scale = 120),
      (s: OverlaySettings) => (s.widgets.standings.autoHeight = !s.widgets.standings.autoHeight),
      (s: OverlaySettings) => (s.widgets.battle.anchor = 'bottom'),
      (s: OverlaySettings) => (s.appearance.accent = '#22d3ee'),
      (s: OverlaySettings) => (s.appearance.fontScale = 120),
      (s: OverlaySettings) => (s.appearance.nameFormat = 'tv'),
      (s: OverlaySettings) => (s.appearance.colorBlind = !s.appearance.colorBlind),
      (s: OverlaySettings) => (s.appearance.units = 'imperial'),
      // Payloads carry codes: the telemetry process never needs the language.
      (s: OverlaySettings) => (s.appearance.language = 'en'),
      // Main registers the shortcuts; the telemetry process never sees them.
      (s: OverlaySettings) => (s.shortcuts.toggleOverlay = 'Ctrl+Alt+F9'),
      (s: OverlaySettings) => (s.shortcuts.toggleEditMode = '')
    ]) {
      expect(configChanged(mutate), mutate.toString()).toBe(false)
    }
  })

  it('visibility rules go to the telemetry process', () => {
    expect(configChanged((s) => (s.widgets.relative.showIn.practice = false))).toBe(true)
    expect(configChanged((s) => (s.widgets.battle.showIn.qualify = true))).toBe(true)
    expect(configChanged((s) => (s.widgets.inputs.hideInPits = !s.widgets.inputs.hideInPits))).toBe(
      true
    )
  })
})

describe('diffSettings and the widget options', () => {
  const sections = Object.keys(DISPLAY_ONLY) as ConfigSection[]

  it('a field reaches the telemetry process exactly when the schema says it is computed', () => {
    for (const section of sections) {
      const specs = OPTION_SCHEMA[section] as Record<string, OptionSpec>
      for (const [field, spec] of Object.entries(specs)) {
        const changed = configChanged((s) => {
          const options = s[section] as unknown as Record<string, unknown>
          options[field] = otherValue(spec, options[field])
        })
        expect(changed, `${section}.${field}`).toBe(spec.displayOnly !== true)
      }
    }
  })

  it('computed options the providers depend on are not display-only', () => {
    expect(configChanged((s) => (s.relative.carsAhead = 5))).toBe(true)
    expect(configChanged((s) => (s.radar.rangeM = 50))).toBe(true)
    expect(configChanged((s) => (s.standings.mode = 'full'))).toBe(true)
    // computeStandings projects iRating / SR only when one of these asks for it.
    expect(configChanged((s) => (s.standings.iRatingDeltaAll = !s.standings.iRatingDeltaAll))).toBe(
      true
    )
    expect(configChanged((s) => (s.standings.headerIRating = !s.standings.headerIRating))).toBe(
      true
    )
    expect(
      configChanged((s) => (s.standings.headerSafetyRating = !s.standings.headerSafetyRating))
    ).toBe(true)
    expect(configChanged((s) => (s.battle.thresholdS = 2))).toBe(true)
  })

  it('standings column visibility goes to the telemetry process, their order does not', () => {
    expect(configChanged((s) => s.standings.columns.reverse())).toBe(false)
    for (const id of ['delta', 'gapLeader', 'ir', 'last'] as const) {
      expect(
        configChanged((s) => {
          for (const c of s.standings.columns) if (c.id === id) c.visible = !c.visible
        }),
        id
      ).toBe(true)
    }
  })

  it('traffic: only the name format stays in the renderer', () => {
    expect(DISPLAY_ONLY.traffic).toEqual(['nameFormat'])
    expect(configChanged((s) => (s.traffic.nameFormat = 'tv'))).toBe(false)
    expect(configChanged((s) => (s.traffic.behindS = 20))).toBe(true)
    expect(configChanged((s) => (s.traffic.aheadS = 4))).toBe(true)
    expect(configChanged((s) => (s.traffic.hazardS = 12))).toBe(true)
    expect(configChanged((s) => (s.traffic.maxEntries = 1))).toBe(true)
    expect(configChanged((s) => (s.traffic.showSlower = !s.traffic.showSlower))).toBe(true)
    expect(configChanged((s) => (s.traffic.onlyMulticlass = !s.traffic.onlyMulticlass))).toBe(true)
  })

  it('alerts: every option goes to the telemetry process', () => {
    expect(DISPLAY_ONLY.alerts).toEqual([])
    expect(configChanged((s) => (s.alerts.showBlue = !s.alerts.showBlue))).toBe(true)
    expect(configChanged((s) => (s.alerts.showPitLimiter = !s.alerts.showPitLimiter))).toBe(true)
    expect(configChanged((s) => (s.alerts.holdS = 0))).toBe(true)
  })

  it('delta: the reference goes to the telemetry process, the drawing options do not', () => {
    expect(DISPLAY_ONLY.delta).toEqual(['rangeS', 'showPredicted', 'showSectors', 'showTrend'])
    expect(configChanged((s) => (s.delta.reference = 'class'))).toBe(true)
    expect(configChanged((s) => (s.delta.fallback = !s.delta.fallback))).toBe(true)
    expect(
      configChanged((s) => {
        s.delta.rangeS = 2.5
        s.delta.showPredicted = !s.delta.showPredicted
        s.delta.showSectors = !s.delta.showSectors
        s.delta.showTrend = !s.delta.showTrend
      })
    ).toBe(false)
  })

  it('the traffic, alerts and delta windows only need a broadcast', () => {
    for (const id of ['traffic', 'alerts', 'delta'] as const) {
      expect(configChanged((s) => (s.widgets[id].scale = 140))).toBe(false)
      expect(configChanged((s) => (s.widgets[id].anchor = 'bottom'))).toBe(false)
      expect(configChanged((s) => (s.widgets[id].hideInPits = true))).toBe(true)
    }
  })

  it('no inputs option goes to the telemetry process', () => {
    expect(
      configChanged((s) => {
        s.inputs.traceSeconds = 8
        s.inputs.showClutch = !s.inputs.showClutch
        s.inputs.clutchInTrace = !s.inputs.clutchInTrace
        s.inputs.traceWidth = 3
        s.inputs.colors.brake = '#123456'
        s.inputs.steeringStyle = s.inputs.steeringStyle === 'bar' ? 'wheel' : 'bar'
        s.inputs.layout = 'bars'
      })
    ).toBe(false)
  })
})

describe('DISPLAY_ONLY / computedConfig', () => {
  it('names only options that exist', () => {
    const defaults = createDefaultSettings()
    for (const section of Object.keys(DISPLAY_ONLY) as ConfigSection[]) {
      for (const key of DISPLAY_ONLY[section]) {
        expect(Object.keys(defaults[section]), `${section}.${key}`).toContain(key)
      }
    }
  })

  it('keeps only the computed options of each section, plus the rules', () => {
    const defaults = createDefaultSettings()
    const c = computedConfig(defaults)
    for (const section of Object.keys(DISPLAY_ONLY) as ConfigSection[]) {
      const expected = Object.keys(defaults[section]).filter(
        (k) => !DISPLAY_ONLY[section].includes(k)
      )
      expect(Object.keys(c[section] as object).sort(), section).toEqual(expected.sort())
    }
    expect(c.enabledWidgets).toEqual(WIDGET_IDS.filter((id) => WIDGET_DEFS[id].defaultVisible))
    expect(c.rules).toEqual(
      Object.fromEntries(
        WIDGET_IDS.map((id) => [
          id,
          { showIn: defaults.widgets[id].showIn, hideInPits: defaults.widgets[id].hideInPits }
        ])
      )
    )
  })

  it('reduces the standings columns to the sorted set of visible ids', () => {
    const at = (cols: StandingsColumn[]): unknown =>
      (
        computedConfig(mutated((s) => (s.standings.columns = cols))).standings as {
          columns: unknown
        }
      ).columns
    expect(at(columns())).toEqual([])
    expect(at(columns('gap', 'delta'))).toEqual(['delta', 'gap'])
    expect(at(columns('gap', 'delta').reverse())).toEqual(['delta', 'gap'])
  })

  it('does not mutate the settings', () => {
    const s = createDefaultSettings()
    computedConfig(s)
    expect(s).toEqual(createDefaultSettings())
  })
})
