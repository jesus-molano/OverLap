import { describe, expect, it } from 'vitest'
import { AlertsProvider } from '../alerts'
import { createMemoryStore } from '../delta/references'
import { createProviders } from '../providers'
import { EMPTY_RACE_VIEW } from '../race/emptyRaceView'
import { makeFrame, makeSession } from '../race/testing/raceSim'
import { createDefaultSettings, toTelemetryConfig } from '../settings'
import type { AlertsData, AlertsOptions } from '../types'
import { INCIDENT_ALERT, incidentAlert } from './alert'
import { IncidentPenalty, IncidentReport, encodeIncident } from './decode'
import type { IncidentEvent } from './tracker'

const EV: IncidentEvent = {
  points: 2,
  kind: 'loss-of-control',
  lap: 5,
  sector: 3,
  surface: 'gravel',
  startT: 100,
  lastT: 101
}

describe('incidentAlert', () => {
  it('shows the incident from its first point until minS after its last', () => {
    const alert = { points: 2, kind: 'loss-of-control', lap: 5, sector: 3, surface: 'gravel' }
    expect(incidentAlert(EV, 100, 0)).toEqual(alert)
    expect(incidentAlert(EV, 101 + INCIDENT_ALERT.minS - 0.1, 0)).toEqual(alert)
    expect(incidentAlert(EV, 101 + INCIDENT_ALERT.minS, 0)).toBeNull()
    expect(incidentAlert(null, 100, 0)).toBeNull()
  })

  it('keeps the alerts hold when it is longer, never less than minS', () => {
    expect(incidentAlert(EV, 101 + 8.5, 9)).not.toBeNull()
    expect(incidentAlert(EV, 101 + 9, 9)).toBeNull()
    expect(incidentAlert(EV, 101 + INCIDENT_ALERT.minS - 0.1, Number.NaN)).not.toBeNull()
  })

  it('is not shown before it happened (a replay rewound the clock)', () => {
    expect(incidentAlert(EV, 99, 3)).toBeNull()
    expect(incidentAlert(EV, Number.NaN, 3)).toBeNull()
  })
})

/** The alerts provider as the loop drives it: observe() at 60 Hz, compute() at 10 Hz. */
class Loop {
  readonly frame = makeFrame()
  readonly session = makeSession(2)
  readonly p = new AlertsProvider()
  private n = 0
  last: AlertsData | null = null

  constructor(private readonly opts: Partial<AlertsOptions> = {}) {
    this.frame.PlayerCarMyIncidentCount[0] = 0
  }

  run(seconds: number): AlertsData | null {
    const o = { ...toTelemetryConfig(createDefaultSettings()).alerts, ...this.opts }
    for (let k = 0; k < Math.round(seconds * 60); k++) {
      this.n++
      this.frame.SessionTime[0] = 200 + this.n / 60
      this.p.observe(this.frame, this.session, EMPTY_RACE_VIEW)
      if (this.n % 6 === 0) this.last = this.p.compute(this.frame, this.session, EMPTY_RACE_VIEW, o)
    }
    return this.last
  }
}

describe('AlertsProvider: incidents', () => {
  const report = encodeIncident(IncidentReport.OffTrack, IncidentPenalty.OneX)

  it('sees a one-tick report between two computes, and shows it on its own', () => {
    const l = new Loop()
    l.run(2)
    l.frame.PlayerCarMyIncidentCount[0] = 1
    l.frame.PlayerIncidents[0] = report
    l.run(1 / 60)
    l.frame.PlayerIncidents[0] = 0
    const shown = l.run(0.5)
    expect(shown).toMatchObject({ visible: true, flags: [], incident: { points: 1 } })
    expect(shown?.incident?.kind).toBe('off-track')
    // Gone after minS (default holdS 3 < minS).
    expect(l.run(INCIDENT_ALERT.minS)?.incident).toBeNull()
    expect(l.last?.visible).toBe(false)
  })

  it('follows showIncidents, and reset() forgets the incident', () => {
    const off = new Loop({ showIncidents: false })
    off.run(2)
    off.frame.PlayerCarMyIncidentCount[0] = 2
    expect(off.run(0.5)).toMatchObject({ visible: false, incident: null })

    const l = new Loop()
    l.run(2)
    l.frame.PlayerCarMyIncidentCount[0] = 2
    expect(l.run(0.5)?.incident?.points).toBe(2)
    l.p.reset()
    expect(l.run(0.5)?.incident).toBeNull()
  })

  it('is fed by the provider set: observe() on every tick, the widget at its own rate', () => {
    const set = createProviders()
    const frame = makeFrame()
    const session = makeSession(2)
    const config = toTelemetryConfig(createDefaultSettings())
    const ctx = { frame, session, config, race: EMPTY_RACE_VIEW, bests: createMemoryStore() }
    frame.PlayerCarMyIncidentCount[0] = 0
    for (let k = 1; k <= 180; k++) {
      frame.SessionTime[0] = 300 + k / 60
      // A one-tick report with the count, between two 10 Hz runs of the widget.
      frame.PlayerCarMyIncidentCount[0] = k >= 121 ? 1 : 0
      frame.PlayerIncidents[0] = k === 121 ? report : 0
      set.observe?.(frame, session, EMPTY_RACE_VIEW)
    }
    expect(set.run.alerts(ctx, null).incident).toMatchObject({ points: 1, kind: 'off-track' })
    set.reset()
    expect(set.run.alerts(ctx, null).incident).toBeNull()
  })
})
