import { describe, expect, it, vi } from 'vitest'
import { ConditionsFeed } from './conditions'
import { FuelTracker } from './fuel/tracker'
import { InfoFeed, NO_INFO, fastestLapOf, infoBarDataEqual, simMinutesOf } from './infoFeed'
import { EMPTY_RACE_VIEW } from './race/emptyRaceView'
import type { RaceCarState, RaceView } from './race/raceView'
import { PRACTICE, makeDriver, makeFrame, makeSession } from './race/testing/raceSim'
import type { InfoBarData, InfoItemId } from './types'

function carState(carIdx: number, o: Partial<RaceCarState> = {}): RaceCarState {
  return {
    carIdx,
    distance: 5.5,
    classPosition: carIdx + 1,
    overallPosition: carIdx + 1,
    inWorld: true,
    inPits: false,
    offTrack: false,
    disconnected: false,
    finished: false,
    pitStops: 0,
    towStops: 0,
    towed: false,
    towedAt: Number.NaN,
    lastPitLap: null,
    outLap: false,
    stintLaps: 5,
    lastLapTime: null,
    bestLapTime: null,
    laps: [],
    pace: 30,
    speed: 1 / 30,
    stoppedForS: 0,
    sessionFlags: 0,
    ...o
  }
}

/** You (car 0, P1 of class 1) and two others: car 1 in your class, car 2 in another one. */
function world(o: { best?: [number | null, number | null, number | null] } = {}): {
  race: RaceView
  frame: ReturnType<typeof makeFrame>
  session: ReturnType<typeof makeSession>
} {
  const best = o.best ?? [61.5, 61.234, 59]
  const cars = [
    carState(0, { classPosition: 1, bestLapTime: best[0] }),
    carState(1, { classPosition: 2, bestLapTime: best[1] }),
    carState(2, { classPosition: 1, bestLapTime: best[2] })
  ]
  const race: RaceView = {
    ...EMPTY_RACE_VIEW,
    racing: true,
    playerCarIdx: 0,
    car: (i) => cars[i],
    cars: () => cars,
    lapsRemaining: () => 7.3,
    timeRemainingS: 1234.6
  }
  const drivers = [
    makeDriver(0, { iRating: 2000 }),
    makeDriver(1, { iRating: 1800, carNumber: '9', userName: 'Lars Eriksen' }),
    makeDriver(2, { iRating: 2500, classId: 2 })
  ]
  const session = makeSession(3, {}, drivers)
  const frame = makeFrame()
  frame.PlayerCarIdx[0] = 0
  frame.PlayerCarMyIncidentCount[0] = 3
  frame.FuelLevel[0] = 20
  return { race, frame, session }
}

function feedWith(): { feed: InfoFeed; conditions: ConditionsFeed; fuel: FuelTracker } {
  const conditions = new ConditionsFeed()
  const fuel = new FuelTracker()
  return { feed: new InfoFeed(conditions, fuel), conditions, fuel }
}

const get = (items: InfoItemId[], known = {}): InfoBarData | null => {
  const { feed } = feedWith()
  const w = world()
  return feed.get(w.frame, w.session, w.race, items, 5, known)
}

describe('InfoFeed', () => {
  it('is null while the bars draw nothing it computes (the name, the clock)', () => {
    expect(get([])).toBeNull()
    expect(get(['title', 'clock'])).toBeNull()
  })

  it('fills only what the items read: the session and what is left, whole', () => {
    const d = get(['session', 'remaining'])
    expect(d).toEqual({
      ...NO_INFO,
      sessionType: 'Race',
      lapsRemaining: 8,
      timeRemainingS: 1234,
      finished: false
    })
  })

  it('your class: its SoF and entries (the other class left out)', () => {
    const d = get(['sof', 'carCount'])
    expect(d?.carCount).toBe(2)
    expect(d?.sof).toBeGreaterThan(1800)
    expect(d?.sof).toBeLessThan(2000)
    expect(d?.iRating).toBeNull()
  })

  it('your incidents, and none for a car a replay follows', () => {
    expect(get(['incidents'])?.incidents).toMatchObject({ mine: 3 })
    const { feed } = feedWith()
    const w = world()
    w.frame.PlayerCarIdx[0] = 1
    const race = { ...w.race, playerCarIdx: 0 }
    expect(feed.get(w.frame, w.session, race, ['incidents'], 5)?.incidents).toBeNull()
  })

  it('your projections in a rated race, with your class position', () => {
    const d = get(['iRating', 'safetyRating'])
    expect(d?.iRating).not.toBeNull()
    expect(d?.classPosition).toBe(1)
    expect(d?.safetyRating).not.toBeNull()
    // Outside races no iRating moves.
    const { feed } = feedWith()
    const w = world()
    w.frame.SessionNum[0] = PRACTICE
    expect(feed.get(w.frame, w.session, w.race, ['iRating'], 5)?.iRating).toBeNull()
  })

  it('takes what the asking provider computed already, as it is', () => {
    const iRating = {
      iRatingDelta: 7,
      perPosition: 9,
      breakEvenPosition: 3,
      ifGainOne: null,
      ifLoseOne: -2
    }
    const d = get(['iRating', 'remaining'], { iRating, lapsRemaining: 2, sessionType: 'Race' })
    expect(d?.iRating).toBe(iRating)
    expect(d?.lapsRemaining).toBe(2)
  })

  it('the fastest lap of your class, by number and name', () => {
    expect(get(['fastestLap'])?.fastestLap).toEqual({
      lapTime: 61.234,
      carIdx: 1,
      carNumber: '9',
      driverName: 'Lars Eriksen',
      isPlayer: false
    })
  })

  it('asks the conditions feed only for a weather item, and shares its reading', () => {
    const { feed, conditions } = feedWith()
    const spy = vi.spyOn(conditions, 'get')
    const w = world()
    feed.get(w.frame, w.session, w.race, ['session', 'incidents'], 5)
    expect(spy).not.toHaveBeenCalled()
    const a = feed.get(w.frame, w.session, w.race, ['trackTemp'], 5)
    expect(spy).toHaveBeenCalledTimes(1)
    expect(a?.conditions).not.toBeNull()
  })

  it('the laps of fuel at your average, null while measuring', () => {
    const { feed, fuel } = feedWith()
    const w = world()
    expect(feed.get(w.frame, w.session, w.race, ['fuelLaps'], 5)?.fuelLaps).toBeNull()
    vi.spyOn(fuel, 'samples', 'get').mockReturnValue({ laps: [2.5, 2.5], carried: false })
    expect(feed.get(w.frame, w.session, w.race, ['fuelLaps'], 5)?.fuelLaps).toBe(8)
  })
})

describe('the sim time (simClock)', () => {
  it('reads SessionTimeOfDay in whole minutes, only for that item', () => {
    const { feed } = feedWith()
    const w = world()
    w.frame.SessionTimeOfDay[0] = 14 * 3600 + 32 * 60 + 59.9
    expect(feed.get(w.frame, w.session, w.race, ['simClock'], 5)).toEqual({
      ...NO_INFO,
      simMinutes: 14 * 60 + 32
    })
    expect(feed.get(w.frame, w.session, w.race, ['clock', 'sof'], 5)?.simMinutes).toBeNull()
  })

  it('wraps at midnight and is null when unknown', () => {
    expect(simMinutesOf(0)).toBe(0)
    expect(simMinutesOf(86399)).toBe(1439)
    expect(simMinutesOf(86400 + 61)).toBe(1)
    expect(simMinutesOf(undefined)).toBeNull()
    expect(simMinutesOf(Number.NaN)).toBeNull()
    expect(simMinutesOf(-5)).toBeNull()
  })
})

describe('fastestLapOf', () => {
  it('any class with -1; null when nobody has a lap; yours marked', () => {
    const w = world({ best: [58, null, 59] })
    expect(fastestLapOf(w.session, w.race, -1, 0)).toMatchObject({ carIdx: 0, isPlayer: true })
    expect(fastestLapOf(w.session, w.race, 2, 0)).toMatchObject({ carIdx: 2, lapTime: 59 })
    const none = world({ best: [null, null, null] })
    expect(fastestLapOf(none.session, none.race, 1, 0)).toBeNull()
  })
})

describe('infoBarDataEqual', () => {
  it('compares every field', () => {
    const base: InfoBarData = { ...NO_INFO, sessionType: 'Race', lapsRemaining: 3 }
    expect(infoBarDataEqual(base, { ...base })).toBe(true)
    expect(infoBarDataEqual(null, null)).toBe(true)
    expect(infoBarDataEqual(base, null)).toBe(false)
    for (const change of [
      { sessionType: 'Practice' },
      { lapsRemaining: 2 },
      { timeRemainingS: 10 },
      { finished: true },
      { sof: 2000 },
      { carCount: 4 },
      { incidents: { mine: 1, team: null, limit: null } },
      { classPosition: 2 },
      { fuelLaps: 4.2 },
      { simMinutes: 600 },
      {
        fastestLap: { lapTime: 60, carIdx: 1, carNumber: '9', driverName: '', isPlayer: false }
      }
    ] as Partial<InfoBarData>[]) {
      expect(infoBarDataEqual(base, { ...base, ...change }), JSON.stringify(change)).toBe(false)
    }
  })
})
