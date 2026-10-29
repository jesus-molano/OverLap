import { describe, expect, it } from 'vitest'
import { applySettingsPatch, createDefaultSettings } from '@shared/settings'
import { setElementVisible } from '@shared/elements'
import { OPTION_SCHEMA, type OptionSpec } from '@shared/settingsSchema'
import type { ElementEntry, OverlaySettings, StandingsColumn } from '@shared/types'
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
    case 'elements': {
      // An id the provider reads, when the list has any.
      const list = value as ElementEntry[]
      const id = spec.computed?.[0] ?? list[0]?.id ?? ''
      const e = list.find((x) => x.id === id)
      return setElementVisible(list, id, e === undefined ? true : !e.visible)
    }
    case 'accelerator':
      return value === 'Ctrl+Alt+F9' ? 'Ctrl+Alt+F10' : 'Ctrl+Alt+F9'
  }
  return value
}

/** `list` with `id` shown or hidden the other way round. */
function flip<Id extends string>(list: ElementEntry<Id>[], id: Id): ElementEntry<Id>[] {
  return setElementVisible(list, id, !list.some((e) => e.id === id && e.visible))
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
      { type: 'reset-widget-options', widgetId: 'pitboard' },
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

  it('validates the layout commands', () => {
    const car = { carId: 67, carName: 'Mazda' }
    for (const raw of [
      { type: 'layout-save', name: 'Mazda' },
      { type: 'layout-apply', id: 'layout-2' },
      { type: 'layout-duplicate', id: 'layout-2', name: 'Copia' },
      { type: 'layout-rename', id: 'layout-2', name: '' },
      { type: 'layout-delete', id: 'layout-2' },
      { type: 'layout-move', id: 'layout-2', step: -1 },
      { type: 'layout-export', id: 'layout-2' },
      { type: 'layout-import' },
      { type: 'layout-link-car', car, layoutId: 'layout-2' },
      { type: 'layout-link-car', car, layoutId: null }
    ]) {
      expect(isSettingsCommand(raw), raw.type).toBe(true)
    }
    for (const raw of [
      { type: 'layout-save' },
      { type: 'layout-save', name: 'x'.repeat(1001) },
      { type: 'layout-apply', id: '../x' },
      { type: 'layout-apply', id: 7 },
      { type: 'layout-duplicate', id: 'layout-2' },
      { type: 'layout-move', id: 'layout-2', step: 2 },
      { type: 'layout-link-car', car: { carId: 0 }, layoutId: null },
      { type: 'layout-link-car', car, layoutId: 'bad id' },
      { type: 'layout-link-car', car }
    ]) {
      expect(isSettingsCommand(raw), JSON.stringify(raw)).toBe(false)
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
      (s: OverlaySettings) => (s.shortcuts.toggleEditMode = ''),
      (s: OverlaySettings) => (s.shortcuts.cycleDeltaReference = 'Ctrl+Alt+D'),
      // The settings window's own preferences: nobody else reads them.
      (s: OverlaySettings) => (s.settingsWindow.stageScene = 'light')
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
    // The global ones too: when to show the overlay, garage, iRacing UI and replays.
    expect(configChanged((s) => (s.visibility.showWhen = 'race'))).toBe(true)
    expect(configChanged((s) => (s.visibility.showWhen = 'always'))).toBe(true)
    expect(configChanged((s) => (s.visibility.hideInGarage = false))).toBe(true)
    expect(configChanged((s) => (s.visibility.hideWithSimUi = false))).toBe(true)
    expect(configChanged((s) => (s.visibility.replays = 'follow'))).toBe(true)
    // The standings' session-screen exception (also on Apariencia).
    expect(configChanged((s) => (s.widgets.standings.showOnSessionScreen = false))).toBe(true)
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
    expect(
      configChanged((s) => (s.standings.subheaderBar = flip(s.standings.subheaderBar, 'iRating')))
    ).toBe(true)
    expect(
      configChanged(
        (s) => (s.standings.subheaderBar = flip(s.standings.subheaderBar, 'safetyRating'))
      )
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
    expect(DISPLAY_ONLY.traffic).toEqual(['parts', 'header', 'nameFormat'])
    expect(configChanged((s) => (s.traffic.nameFormat = 'tv'))).toBe(false)
    expect(configChanged((s) => (s.traffic.behindS = 20))).toBe(true)
    expect(configChanged((s) => (s.traffic.aheadS = 4))).toBe(true)
    expect(configChanged((s) => (s.traffic.hazardS = 12))).toBe(true)
    expect(configChanged((s) => (s.traffic.maxEntries = 1))).toBe(true)
    expect(configChanged((s) => (s.traffic.groups = flip(s.traffic.groups, 'slower')))).toBe(true)
    expect(configChanged((s) => s.traffic.groups.reverse())).toBe(false)
    expect(configChanged((s) => (s.traffic.onlyMulticlass = !s.traffic.onlyMulticlass))).toBe(true)
  })

  it('alerts: every option goes to the telemetry process', () => {
    expect(DISPLAY_ONLY.alerts).toEqual(['parts'])
    expect(configChanged((s) => (s.alerts.showBlue = !s.alerts.showBlue))).toBe(true)
    expect(configChanged((s) => (s.alerts.showPitLimiter = !s.alerts.showPitLimiter))).toBe(true)
    expect(configChanged((s) => (s.alerts.holdS = 0))).toBe(true)
  })

  it('delta: the references go to the telemetry process, the drawing options do not', () => {
    expect(DISPLAY_ONLY.delta).toEqual(['rangeS', 'rows', 'top', 'laps'])
    expect(configChanged((s) => (s.delta.referencePractice = 'class'))).toBe(true)
    expect(configChanged((s) => (s.delta.referenceQualify = 'session'))).toBe(true)
    expect(configChanged((s) => (s.delta.referenceRace = 'pb'))).toBe(true)
    expect(configChanged((s) => (s.delta.fallback = !s.delta.fallback))).toBe(true)
    expect(
      configChanged((s) => {
        s.delta.rangeS = 2.5
        s.delta.top = flip(s.delta.top, 'predicted')
        s.delta.rows = flip(s.delta.rows, 'sectors')
        s.delta.rows = flip(s.delta.rows, 'laps')
        s.delta.laps.reverse()
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
        s.inputs.bars = flip(s.inputs.bars, 'clutch')
        s.inputs.clutchInTrace = !s.inputs.clutchInTrace
        s.inputs.traceWidth = 3
        s.inputs.colors.brake = '#123456'
        s.inputs.steeringStyle = s.inputs.steeringStyle === 'bar' ? 'wheel' : 'bar'
        s.inputs.sections = flip(s.inputs.sections, 'trace')
        s.inputs.info.reverse()
      })
    ).toBe(false)
  })

  it('the info bars: the items the provider computes and the sizes go, the rest does not', () => {
    for (const section of ['relative', 'standings'] as const) {
      // The order, the renderer's own items (the name, the clock) and the items' options.
      expect(
        configChanged((s) => {
          s[section].footerBar.reverse()
          s[section].headerBar = flip(s[section].headerBar, 'clock')
          s[section].headerBar = flip(s[section].headerBar, 'title')
          s[section].conditionsTrend = !s[section].conditionsTrend
          s[section].conditionsWindDirection = !s[section].conditionsWindDirection
        }),
        section
      ).toBe(false)
      expect(
        configChanged((s) => (s[section].footerBar = flip(s[section].footerBar, 'trackTemp'))),
        section
      ).toBe(true)
      expect(
        configChanged((s) => (s[section].headerBar = flip(s[section].headerBar, 'fuelLaps'))),
        section
      ).toBe(true)
      expect(
        configChanged(
          (s) => (s[section].footerBarSize = s[section].footerBarSize === 'off' ? 'normal' : 'off')
        ),
        section
      ).toBe(true)
    }
  })

  it('the fuel lines are drawing only; the average and the margin go to the telemetry process', () => {
    expect(
      configChanged((s) => {
        s.fuel.lines = flip(s.fuel.lines, 'gauge')
        s.fuel.lines.reverse()
        s.fuel.showBox = !s.fuel.showBox
        s.fuel.headerBar = flip(s.fuel.headerBar, 'title')
      })
    ).toBe(false)
    expect(configChanged((s) => (s.fuel.avgLaps = 3))).toBe(true)
    expect(configChanged((s) => (s.fuel.marginLaps = 1))).toBe(true)
  })

  it('the warning lights: layout and captions are drawing, what is sent goes to the process', () => {
    expect(
      configChanged((s) => {
        s.lights.layout = 'column'
        s.lights.labelSide = 'left'
        s.lights.showCaptions = true
        s.lights.icons.reverse()
      })
    ).toBe(false)
    expect(configChanged((s) => (s.lights.onlyWhenLit = true))).toBe(true)
    expect(configChanged((s) => (s.lights.showTemps = true))).toBe(true)
    expect(configChanged((s) => (s.lights.icons = flip(s.lights.icons, 'revLimiter')))).toBe(true)
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
          {
            showIn: defaults.widgets[id].showIn,
            hideInPits: defaults.widgets[id].hideInPits,
            showOnSessionScreen: defaults.widgets[id].showOnSessionScreen
          }
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
