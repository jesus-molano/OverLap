import { describe, expect, it } from 'vitest'
import { WIDGET_DEFS, WIDGET_IDS } from '../widgets'
import { DEFAULT_SETTINGS, createDefaultSettings, toTelemetryConfig } from '.'

describe('toTelemetryConfig', () => {
  it('enables only the visible widgets and copies the options', () => {
    const s = createDefaultSettings()
    for (const id of WIDGET_IDS) {
      s.widgets[id].visible = id === 'radar' || id === 'inputs' || id === 'alerts'
    }
    s.radar.rangeM = 30
    s.standings.topRows = 5
    s.battle.thresholdS = 2
    s.inputs.traceSeconds = 8
    s.traffic.behindS = 20
    s.alerts.showBlue = false
    s.delta.referenceRace = 'class'
    s.delta.rangeS = 2
    const c = toTelemetryConfig(s)
    expect(c.enabledWidgets).toEqual(['radar', 'inputs', 'alerts'])
    expect(c.relative).toEqual(DEFAULT_SETTINGS.relative)
    expect(c.radar).toEqual({ ...DEFAULT_SETTINGS.radar, rangeM: 30 })
    expect(c.standings).toEqual({ ...DEFAULT_SETTINGS.standings, topRows: 5 })
    expect(c.battle).toEqual({ ...DEFAULT_SETTINGS.battle, thresholdS: 2 })
    expect(c.inputs).toEqual({ ...DEFAULT_SETTINGS.inputs, traceSeconds: 8 })
    // Options travel whether the widget is enabled or not.
    expect(c.traffic).toEqual({ ...DEFAULT_SETTINGS.traffic, behindS: 20 })
    expect(c.alerts).toEqual({ ...DEFAULT_SETTINGS.alerts, showBlue: false })
    expect(c.delta).toEqual({ ...DEFAULT_SETTINGS.delta, referenceRace: 'class', rangeS: 2 })
    expect('appearance' in c).toBe(false)
  })

  it('carries the visibility rules of every widget, visible or not', () => {
    const s = createDefaultSettings()
    s.widgets.inputs.hideInPits = true
    s.widgets.relative.visible = false
    s.widgets.relative.showIn.qualify = false
    const c = toTelemetryConfig(s)
    expect(Object.keys(c.rules)).toEqual(WIDGET_IDS)
    expect(c.rules.inputs).toEqual({
      showIn: WIDGET_DEFS.inputs.defaultShowIn,
      hideInPits: true,
      showOnSessionScreen: false
    })
    // The session-screen exception travels too: the standings stay there by default (B06).
    expect(c.rules.standings.showOnSessionScreen).toBe(true)
    expect(c.rules.relative.showIn).toEqual({ practice: true, qualify: false, race: true })
    expect(c.rules.battle.showIn).toEqual({ practice: false, qualify: false, race: true })
  })

  it('carries the global visibility rules, as a copy', () => {
    const s = createDefaultSettings()
    // Only in the car and no replays by default.
    expect(toTelemetryConfig(s).visibility).toEqual({
      showWhen: 'car',
      hideWithSimUi: true,
      hideInGarage: true,
      hideOnSessionScreen: true,
      replays: 'hide',
      showWhileWaiting: false
    })
    s.visibility.showWhen = 'race'
    s.visibility.replays = 'follow'
    const c = toTelemetryConfig(s)
    expect(c.visibility).toMatchObject({ showWhen: 'race', replays: 'follow' })
    c.visibility.hideInGarage = false
    expect(s.visibility.hideInGarage).toBe(true)
  })

  it('shares no object with the settings', () => {
    const s = createDefaultSettings()
    const c = toTelemetryConfig(s)
    c.radar.rangeM = 10
    c.standings.columns[0]!.visible = false
    c.inputs.colors.brake = '#000000'
    c.rules.radar.showIn.race = false
    c.traffic.maxEntries = 1
    c.alerts.holdS = 0
    c.delta.referenceRace = 'session'
    c.delta.rows[0]!.visible = false
    c.relative.headerBar[0]!.visible = false
    c.rules.traffic.hideInPits = true
    expect(s.radar.rangeM).toBe(20)
    expect(s.standings.columns[0]!.visible).toBe(true)
    expect(s.inputs.colors.brake).toBe('#ff4545')
    expect(s.widgets.radar.showIn.race).toBe(true)
    expect(s.traffic.maxEntries).toBe(3)
    expect(s.alerts.holdS).toBe(3)
    expect(s.delta.referenceRace).toBe('optimal')
    expect(s.delta.rows[0]!.visible).toBe(true)
    expect(s.relative.headerBar[0]!.visible).toBe(true)
    expect(s.widgets.traffic.hideInPits).toBe(false)
  })

  it('follows WIDGET_IDS order', () => {
    expect(toTelemetryConfig(createDefaultSettings()).enabledWidgets).toEqual(
      WIDGET_IDS.filter((id) => WIDGET_DEFS[id].defaultVisible)
    )
  })
})
