import { describe, expect, it } from 'vitest'
import { EMPTY_RACE_VIEW } from '../race/emptyRaceView'
import { Sim, V, makeSession } from '../race/testing/raceSim'
import { IncidentPenalty, IncidentReport, TrackMaterial, encodeIncident } from './decode'
import { INCIDENTS, IncidentTracker } from './tracker'

const OFF_1X = encodeIncident(IncidentReport.OffTrack, IncidentPenalty.OneX)
const LOC_2X = encodeIncident(IncidentReport.OutOfControl, IncidentPenalty.TwoX)
const CAR_4X = encodeIncident(IncidentReport.CollisionWithCar, IncidentPenalty.FourX)
const WALL_0X = encodeIncident(IncidentReport.ContactWithWorld, IncidentPenalty.ZeroX)

/**
 * The real race model at 60 Hz with the player (CarIdx 0) lapping in 30 s from lap 4.1, three
 * sectors, and the tracker fed every tick after it, like the telemetry loop does.
 */
class Drive {
  readonly sim = new Sim(makeSession(2, { sectorStarts: [0, 0.33, 0.66] }))
  readonly tracker = new IncidentTracker()
  private readonly startD = 4.1

  constructor() {
    this.sim.t = 100
  }

  get frame(): Sim['frame'] {
    return this.sim.frame
  }

  /** Sets what the next ticks read (it stays until changed, like real telemetry). */
  set(o: { count?: number; report?: number; material?: number; replay?: boolean }): this {
    const f = this.sim.frame
    if (o.count !== undefined) f.PlayerCarMyIncidentCount[0] = o.count
    if (o.report !== undefined) f.PlayerIncidents[0] = o.report
    if (o.material !== undefined) f.PlayerTrackSurfaceMaterial[0] = o.material
    if (o.replay !== undefined) f.IsReplayPlaying[0] = o.replay
    return this
  }

  /** `seconds` of 60 Hz ticks (one tick by default). */
  run(seconds = 1 / 60): this {
    const d0 = this.startD
    this.sim.run(
      seconds,
      60,
      (t) => ({ 0: { d: d0 + (t - 100) * V }, 1: { d: d0 + 0.5 } }),
      () => this.tracker.observe(this.sim.frame, this.sim.session, this.sim.view)
    )
    return this
  }

  /** A one-tick PlayerIncidents pulse with the count going up by `points` on the same tick. */
  hit(points: number, report = 0): this {
    const count = (this.frame.PlayerCarMyIncidentCount[0] ?? 0) + points
    this.set({ count, report }).run()
    return this.set({ report: 0 })
  }
}

/** A drive past the start-up settling, count 0. */
function settled(): Drive {
  return new Drive().set({ count: 0, material: TrackMaterial.Asphalt1 }).run(2)
}

describe('IncidentTracker', () => {
  it('a rise of your count is an incident, typed by the report, with lap and sector', () => {
    const d = settled()
    expect(d.tracker.latest).toBeNull()
    // At 102 s the player is at lap 4.1 + 2/30 = 4.17: lap 5, sector 1.
    d.hit(2, LOC_2X)
    expect(d.tracker.latest).toMatchObject({
      points: 2,
      kind: 'loss-of-control',
      lap: 5,
      sector: 1,
      surface: null
    })
    // Seven seconds later, a third of a lap on: sector 2.
    d.run(7).hit(1, OFF_1X)
    expect(d.tracker.latest).toMatchObject({ points: 1, kind: 'off-track', lap: 5, sector: 2 })
  })

  it('groups rises a moment apart into one incident, named by its most serious report', () => {
    const d = settled()
    d.hit(1, OFF_1X).run(0.6).hit(1, LOC_2X)
    expect(d.tracker.latest).toMatchObject({ points: 2, kind: 'loss-of-control' })
    // iRacing upgrading to 4x: more points, the worse type.
    d.run(1).hit(2, CAR_4X)
    const ev = d.tracker.latest
    expect(ev).toMatchObject({ points: 4, kind: 'collision-car' })
    expect((ev?.lastT ?? 0) - (ev?.startT ?? 0)).toBeCloseTo(1.6 + 2 / 60, 2)
    // A lesser report inside the group does not rename it.
    d.run(0.5).set({ report: WALL_0X }).run().set({ report: 0 }).run()
    expect(d.tracker.latest?.kind).toBe('collision-car')
    // Past the group window: a new incident.
    d.run(INCIDENTS.groupS + 0.5).hit(1, OFF_1X)
    expect(d.tracker.latest).toMatchObject({ points: 1, kind: 'off-track' })
  })

  it('names it by the type, not by the penalty byte, which is not the points (Q7)', () => {
    // Online the penalty byte read 0x00 for an "Off Track (1x)" and 0x04 for a 1x wall hit.
    const offTrack2xByte = encodeIncident(IncidentReport.OffTrack, IncidentPenalty.TwoX)
    const lossNoByte = encodeIncident(IncidentReport.OutOfControl, IncidentPenalty.None)
    for (const order of [
      [lossNoByte, offTrack2xByte],
      [offTrack2xByte, lossNoByte]
    ]) {
      const d = settled()
      d.hit(1, order[0]).run(0.5).hit(1, order[1])
      expect(d.tracker.latest).toMatchObject({ points: 2, kind: 'loss-of-control' })
    }
    // The race's: an off-track (0x0002) 0.25 s before the count, the wall (0x0405) 0.8 s later.
    const wall = settled()
    wall.set({ report: encodeIncident(IncidentReport.OffTrack, IncidentPenalty.None) }).run()
    wall.set({ report: 0 }).run(0.25).set({ count: 1 }).run(0.7)
    wall.set({ report: encodeIncident(IncidentReport.CollisionWithWorld, IncidentPenalty.FourX) })
    wall.run().set({ report: 0 }).run(0.1).set({ count: 2 }).run()
    expect(wall.tracker.latest).toMatchObject({ points: 2, kind: 'collision-world' })
    // Two reports before the count rises: the worse waits for it, whichever came last.
    const two = settled()
    two.set({ report: encodeIncident(IncidentReport.CollisionWithWorld, IncidentPenalty.None) })
    two.run().set({ report: offTrack2xByte }).run().set({ report: 0 }).run(0.2)
    two.set({ count: 2 }).run()
    expect(two.tracker.latest).toMatchObject({ points: 2, kind: 'collision-world' })
  })

  it('takes a report that comes a tick before or after the count', () => {
    const before = settled()
    before.set({ report: OFF_1X }).run().set({ report: 0 }).run(0.3)
    before.set({ count: 1 }).run()
    expect(before.tracker.latest).toMatchObject({ points: 1, kind: 'off-track' })

    const after = settled()
    after.set({ count: 2 }).run(0.2).set({ report: LOC_2X }).run()
    expect(after.tracker.latest).toMatchObject({ points: 2, kind: 'loss-of-control' })
  })

  it('without a report it is just the points (the pulse was never seen)', () => {
    const d = settled()
    d.set({ count: 2 }).run(3)
    expect(d.tracker.latest).toMatchObject({ points: 2, kind: null, lap: 5 })
    // A report long before the rise is not this incident's.
    const old = settled()
    old
      .set({ report: OFF_1X })
      .run()
      .set({ report: 0 })
      .run(INCIDENTS.reportWindowS + 0.5)
    old.set({ count: 1 }).run()
    expect(old.tracker.latest?.kind).toBeNull()
  })

  it('a value that never changes is no report, even if it reports something', () => {
    // PlayerIncidents sticky from an incident before we connected.
    const d = new Drive().set({ count: 4, report: LOC_2X }).run(2)
    d.set({ count: 5 }).run()
    expect(d.tracker.latest).toMatchObject({ points: 1, kind: null })
  })

  it('the first values of a connection are the baseline, not incidents', () => {
    const d = new Drive().set({ count: 11 }).run()
    expect(d.tracker.latest).toBeNull()
    // Still settling: the count catching up.
    d.run(0.5).set({ count: 13 }).run()
    expect(d.tracker.latest).toBeNull()
    d.run(INCIDENTS.settleS).set({ count: 15 }).run()
    expect(d.tracker.latest).toMatchObject({ points: 2 })
  })

  it('a lower count (the sim started a new one) is a baseline too', () => {
    const d = settled().set({ count: 9 }).run(3)
    expect(d.tracker.latest?.points).toBe(9)
    d.set({ count: 0 }).run(3)
    d.set({ count: 1 }).run()
    expect(d.tracker.latest).toMatchObject({ points: 1 })
  })

  it('never counts what happens during a replay, nor right after it', () => {
    const d = settled()
    d.set({ replay: true }).run(1)
    d.hit(2, LOC_2X).run(1)
    expect(d.tracker.latest).toBeNull()
    // Back live: the count from the replay is the baseline, and the first second settles.
    d.set({ replay: false }).run(0.5)
    d.set({ count: 3 }).run()
    expect(d.tracker.latest).toBeNull()
    d.run(INCIDENTS.settleS).hit(1, OFF_1X)
    expect(d.tracker.latest).toMatchObject({ points: 1, kind: 'off-track' })
  })

  it('a replay from before an incident brings no false one back when you go live again', () => {
    // A live 2x, then a rewind to before it: the replay's clock and count are earlier and lower.
    const d = settled().hit(2, LOC_2X).run(10)
    expect(d.tracker.latest?.points).toBe(2)
    d.sim.t -= 17
    d.set({ replay: true, count: 0 }).run(5)
    // Back live, the clock well past where the replay ended, the count where it was.
    d.sim.t += 18
    d.set({ replay: false, count: 2 }).run()
    expect(d.tracker.latest).toBeNull()
    d.run(INCIDENTS.settleS)
    expect(d.tracker.latest).toBeNull()
    // Counting again from the live count.
    d.hit(1, OFF_1X)
    expect(d.tracker.latest).toMatchObject({ points: 1, kind: 'off-track' })
  })

  it('starts over when the clock goes back, and on reset()', () => {
    const d = settled().hit(2, LOC_2X)
    expect(d.tracker.latest).not.toBeNull()
    d.sim.t -= 30
    d.set({ count: 4 }).run()
    expect(d.tracker.latest).toBeNull()
    d.run(2).hit(1)
    expect(d.tracker.latest?.points).toBe(1)
    d.tracker.reset()
    expect(d.tracker.latest).toBeNull()
    d.hit(1)
    expect(d.tracker.latest).toBeNull()
  })

  it('names the furthest surface off the asphalt around the incident', () => {
    // Over the kerb, then into the gravel after the count went up.
    const d = settled()
    d.set({ material: TrackMaterial.Rumble1 }).run(0.5)
    d.set({ material: TrackMaterial.Asphalt1 }).run(0.3)
    d.hit(1, OFF_1X)
    expect(d.tracker.latest?.surface).toBe('kerb')
    d.set({ material: TrackMaterial.Gravel1 }).run(0.5)
    expect(d.tracker.latest?.surface).toBe('gravel')
    // Back on the grass on the way out: the gravel stays.
    d.set({ material: TrackMaterial.Grass4 }).run(0.5)
    expect(d.tracker.latest?.surface).toBe('gravel')

    // Nothing off the asphalt anywhere near it: none.
    const clean = settled()
    clean.set({ material: TrackMaterial.Grass1 }).run().set({ material: TrackMaterial.Asphalt1 })
    clean
      .run(INCIDENTS.surfaceWindowS + 0.5)
      .hit(2, LOC_2X)
      .run(2)
    expect(clean.tracker.latest?.surface).toBeNull()
  })

  it('has no lap or sector without a car, and never throws on an empty frame', () => {
    const t = new IncidentTracker()
    const d = new Drive()
    const f = d.frame
    f.SessionTime[0] = 50
    f.PlayerCarMyIncidentCount[0] = 0
    t.observe(f, d.sim.session, EMPTY_RACE_VIEW)
    f.SessionTime[0] = 52
    f.PlayerCarMyIncidentCount[0] = 1
    t.observe(f, d.sim.session, EMPTY_RACE_VIEW)
    expect(t.latest).toMatchObject({ points: 1, lap: null, sector: null })
    f.SessionTime.length = 0
    expect(() => t.observe(f, d.sim.session, EMPTY_RACE_VIEW)).not.toThrow()
  })
})
