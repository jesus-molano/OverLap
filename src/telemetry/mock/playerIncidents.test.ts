import { describe, expect, it } from 'vitest'
import { TrackMaterial, decodeIncident, incidentSurface } from '@shared/incidents/decode'
import { parseSessionMeta } from '@shared/session'
import { MockFrameBuffer } from './frameBuffer'
import { MOCK_INCIDENT_LIMITS, MockPlayerIncidents } from './playerIncidents'
import { MockRace } from './race'

interface Sample {
  s: number
  count: number
  report: ReturnType<typeof decodeIncident>
  material: number
}

/** Publishes at 60 Hz from 0 to `untilS`, the car off track during `off` ([from, to] s). */
function drive(
  incidents: MockPlayerIncidents,
  untilS: number,
  off: readonly [number, number][] = []
): Sample[] {
  const v = new MockFrameBuffer().vars
  const out: Sample[] = []
  for (let k = 0; k <= untilS * 60; k++) {
    const s = k / 60
    incidents.publish(
      v,
      s,
      off.some(([a, b]) => s >= a && s <= b)
    )
    out.push({
      s,
      count: v.PlayerCarMyIncidentCount[0] ?? -1,
      report: decodeIncident(v.PlayerIncidents[0]),
      material: v.PlayerTrackSurfaceMaterial[0] ?? -1
    })
    expect(v.PlayerCarTeamIncidentCount[0]).toBe(v.PlayerCarMyIncidentCount[0])
    expect(v.IsReplayPlaying[0]).toBe(false)
  }
  return out
}

describe('MockPlayerIncidents', () => {
  it('1x: an off-track onto the grass, its report for a moment', () => {
    const m = new MockPlayerIncidents()
    m.add(2, 1)
    const run = drive(m, 4, [[2, 3]])
    expect(run.filter((x) => x.s < 2).every((x) => x.count === 0 && x.report === null)).toBe(true)
    const reported = run.filter((x) => x.report !== null)
    expect(reported[0]?.s).toBeCloseTo(2, 5)
    expect(reported.at(-1)?.s).toBeLessThan(2.45)
    expect(reported.every((x) => x.report?.kind === 'off-track' && x.report.points === 1)).toBe(
      true
    )
    expect(run.at(-1)?.count).toBe(1)
    // Asphalt, the grass while off track, asphalt again.
    expect([...new Set(run.map((x) => incidentSurface(x.material)))]).toEqual([null, 'grass'])
    expect(run.find((x) => x.s === 2.5)?.material).toBe(TrackMaterial.Grass1)
    expect(run.at(-1)?.material).toBe(TrackMaterial.Asphalt1)
  })

  it('2x: an off-track into the gravel, upgraded a moment later to a loss of control', () => {
    const m = new MockPlayerIncidents()
    m.add(1, 2)
    const run = drive(m, 3, [[1, 2.5]])
    const counts = [...new Set(run.map((x) => x.count))]
    expect(counts).toEqual([0, 1, 2])
    const kinds = [...new Set(run.flatMap((x) => (x.report ? [x.report.kind] : [])))]
    expect(kinds).toEqual(['off-track', 'loss-of-control'])
    const upgrade = run.find((x) => x.count === 2)
    expect(upgrade?.report).toEqual({ kind: 'loss-of-control', points: 2 })
    expect(upgrade?.s).toBeCloseTo(1.8, 1)
    expect(incidentSurface(run.find((x) => x.s === 2)?.material)).toBe('gravel')
  })

  it('4x: a car contact; other points: a rise with no report', () => {
    const m = new MockPlayerIncidents()
    m.add(1, 4)
    m.add(2, 3)
    const run = drive(m, 3)
    expect(run.find((x) => x.report !== null)?.report).toEqual({ kind: 'collision-car', points: 4 })
    expect(run.at(-1)?.count).toBe(7)
    expect(run.filter((x) => x.s >= 2).every((x) => x.report === null)).toBe(true)
  })

  it('in the mock race: the timeline incidents, deterministic', () => {
    const counts = (): number[] => {
      const race = new MockRace()
      const out: number[] = []
      for (let k = 0; k < 320 * 20; k++) {
        race.step(1 / 20)
        out.push(race.frame().PlayerCarMyIncidentCount[0] ?? -1)
      }
      return out
    }
    const a = counts()
    expect(a).toEqual(counts())
    expect(a.at(-1)).toBe(3)
  })

  it('the session states a penalty at 17x, every 8x after, the DQ at 25x', () => {
    const meta = parseSessionMeta(new MockRace().sessionInfo())
    expect(MOCK_INCIDENT_LIMITS).toMatchObject({ IncidentLimit: 25 })
    expect(meta.incidentLimits).toEqual({ dq: 25, penalty: 17, penaltyEvery: 8 })
  })
})
