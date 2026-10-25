import { describe, expect, it } from 'vitest'
import type { IncidentKind } from '../types'
import {
  IncidentPenalty,
  IncidentReport,
  SURFACE_RANK,
  TrackMaterial,
  decodeIncident,
  encodeIncident,
  incidentBits,
  incidentSurface
} from './decode'

describe('decodeIncident', () => {
  it('reads the report byte as the type and the penalty byte as the points', () => {
    const cases: [number, number, IncidentKind, number][] = [
      [IncidentReport.OutOfControl, IncidentPenalty.TwoX, 'loss-of-control', 2],
      [IncidentReport.OffTrack, IncidentPenalty.OneX, 'off-track', 1],
      [IncidentReport.ContactWithWorld, IncidentPenalty.ZeroX, 'contact-world', 0],
      [IncidentReport.CollisionWithWorld, IncidentPenalty.TwoX, 'collision-world', 2],
      [IncidentReport.ContactWithCar, IncidentPenalty.ZeroX, 'contact-car', 0],
      [IncidentReport.CollisionWithCar, IncidentPenalty.FourX, 'collision-car', 4],
      // Not currently sent: read as their plain kind.
      [IncidentReport.OffTrackOngoing, IncidentPenalty.OneX, 'off-track', 1],
      [IncidentReport.CollisionWithWorldOngoing, IncidentPenalty.TwoX, 'collision-world', 2]
    ]
    for (const [report, penalty, kind, points] of cases) {
      expect(decodeIncident(report | penalty), kind).toEqual({ kind, points })
    }
  })

  it('has no points for a penalty byte it does not know, and nothing without a report', () => {
    expect(decodeIncident(IncidentReport.OffTrack)).toEqual({ kind: 'off-track', points: null })
    expect(decodeIncident(IncidentReport.OffTrack | 0x0900)).toEqual({
      kind: 'off-track',
      points: null
    })
    for (const raw of [0, IncidentPenalty.TwoX, 0x09, 0xff, undefined, Number.NaN]) {
      expect(decodeIncident(raw), String(raw)).toBeNull()
    }
  })

  it('normalises the signed Int32 the SDK sends', () => {
    // A high bit set makes the value negative; the low bytes still read.
    const signed = 0x80000000 | IncidentReport.OutOfControl | IncidentPenalty.TwoX | 0
    expect(signed).toBeLessThan(0)
    expect(incidentBits(signed)).toBe(0x80000301)
    expect(decodeIncident(signed)).toEqual({ kind: 'loss-of-control', points: 2 })
  })

  it('encodes what it decodes (the mock writes reports with it)', () => {
    const raw = encodeIncident(IncidentReport.CollisionWithCar, IncidentPenalty.FourX)
    expect(raw).toBe(0x0408)
    expect(decodeIncident(raw)).toEqual({ kind: 'collision-car', points: 4 })
  })
})

describe('incidentSurface', () => {
  it('names what is off the racing surface', () => {
    expect(incidentSurface(TrackMaterial.Rumble1)).toBe('kerb')
    expect(incidentSurface(TrackMaterial.Rumble4)).toBe('kerb')
    expect(incidentSurface(TrackMaterial.Grass1)).toBe('grass')
    expect(incidentSurface(TrackMaterial.Grass4)).toBe('grass')
    expect(incidentSurface(TrackMaterial.Grasscrete)).toBe('grass')
    expect(incidentSurface(TrackMaterial.Dirt1)).toBe('dirt')
    expect(incidentSurface(TrackMaterial.Dirt4)).toBe('dirt')
    expect(incidentSurface(TrackMaterial.Sand)).toBe('sand')
    expect(incidentSurface(TrackMaterial.Gravel1)).toBe('gravel')
    expect(incidentSurface(TrackMaterial.Gravel2)).toBe('gravel')
    expect(incidentSurface(TrackMaterial.Astroturf)).toBe('astroturf')
  })

  it('is null on the track itself (asphalt, concrete, racing dirt, paint) and when unknown', () => {
    // irsdk_TrkSurf 1..10, NotInWorld (-1) and Undefined (0).
    for (const m of [-1, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 28, 1.5, undefined]) {
      expect(incidentSurface(m), String(m)).toBeNull()
    }
  })

  it('ranks the gravel trap above the grass, and both above the kerb', () => {
    expect(SURFACE_RANK.gravel).toBeGreaterThan(SURFACE_RANK.grass)
    expect(SURFACE_RANK.grass).toBeGreaterThan(SURFACE_RANK.kerb)
  })
})
