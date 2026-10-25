import { describe, expect, it } from 'vitest'
import { EMPTY_RACE_VIEW } from './emptyRaceView'

describe('EMPTY_RACE_VIEW', () => {
  it('has no cars and no timing, and hands out the same frozen arrays', () => {
    const v = EMPTY_RACE_VIEW
    expect(v.racing).toBe(false)
    expect(v.playerCarIdx).toBe(-1)
    expect(v.car(0)).toBeUndefined()
    expect(v.cars()).toHaveLength(0)
    expect(v.cars()).toBe(v.cars())
    expect(Object.isFrozen(v.cars())).toBe(true)
    expect(v.timeGap(1, 0)).toBeNull()
    expect(v.lapsBehind(1, 0)).toBe(0)
    expect(v.gapHistory(1, 0, 3)).toHaveLength(0)
    expect(v.lastLapSectors(0)).toBeNull()
    expect(v.lapSectors(0, 3)).toBeNull()
    expect(v.lapsRemaining(0)).toBeNull()
    expect(v.currentLap(0)).toBeNull()
    expect(v.lapProfile(0, 'best')).toBeNull()
    expect(v.lapProfile(0, 'last')).toBeNull()
    expect(v.timeRemainingS).toBeNull()
    expect(v.playerDistanceDriven).toBe(0)
    expect(v.playerIncidents).toBe(0)
    expect(Object.isFrozen(v)).toBe(true)
  })
})
