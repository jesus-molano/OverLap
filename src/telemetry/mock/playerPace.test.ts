import { describe, expect, it } from 'vitest'
import {
  LEARNING_SESSIONS,
  PLAYER_GAIN_PER_SESSION,
  PLAYER_STINT_SWING,
  PUSH_LAP_EVERY,
  PUSH_LAP_GAIN,
  STINT_LAPS,
  playerLapPace
} from './playerPace'

const laps = (n: number): number[] => Array.from({ length: n }, (_, i) => i + 1)

describe('playerLapPace', () => {
  it('gets quicker through the stint, the same as the base pace on average', () => {
    const pace = (lap: number): number => playerLapPace(0, lap, 0)
    expect(pace(0)).toBeCloseTo(1 + PLAYER_STINT_SWING / 2, 9)
    const regular = laps(STINT_LAPS).filter((l) => l % PUSH_LAP_EVERY !== 0)
    for (let k = 1; k < regular.length; k++) {
      expect(pace(regular[k] ?? 0)).toBeLessThan(pace(regular[k - 1] ?? 0))
    }
    // Then it holds: tyres and fuel do not keep giving.
    expect(pace(STINT_LAPS + 1)).toBeCloseTo(1 - PLAYER_STINT_SWING / 2, 9)
    expect(pace(STINT_LAPS + 5)).toBe(pace(STINT_LAPS + 1))
    const stint = [0, ...laps(STINT_LAPS)].map(
      (l) => playerLapPace(0, l, 0) + (l > 0 && l % PUSH_LAP_EVERY === 0 ? PUSH_LAP_GAIN : 0)
    )
    const mean = stint.reduce((a, b) => a + b, 0) / stint.length
    expect(mean).toBeCloseTo(1, 9)
  })

  it('throws in a push lap every few laps', () => {
    for (const lap of laps(12)) {
      const push = lap % PUSH_LAP_EVERY === 0
      const neighbour = playerLapPace(0, lap - 1, 0)
      const gain = neighbour - playerLapPace(0, lap, 0)
      expect(gain > PUSH_LAP_GAIN, `lap ${lap}`).toBe(push)
    }
  })

  it('starts later sessions a little quicker, up to a limit', () => {
    const at = (session: number): number => playerLapPace(0, 3, session)
    expect(at(0) - at(1)).toBeCloseTo(PLAYER_GAIN_PER_SESSION, 9)
    expect(at(0) - at(LEARNING_SESSIONS)).toBeCloseTo(
      PLAYER_GAIN_PER_SESSION * LEARNING_SESSIONS,
      9
    )
    expect(at(LEARNING_SESSIONS + 10)).toBe(at(LEARNING_SESSIONS))
    expect(at(-3)).toBe(at(0))
  })

  it('adds the jitter as given and is deterministic', () => {
    expect(playerLapPace(0.002, 5, 1) - playerLapPace(0, 5, 1)).toBeCloseTo(0.002, 12)
    expect(playerLapPace(-0.001, 7, 2)).toBe(playerLapPace(-0.001, 7, 2))
    expect(playerLapPace(0, 2.7, 0)).toBe(playerLapPace(0, 2, 0))
    expect(playerLapPace(0, -4, 0)).toBe(playerLapPace(0, 0, 0))
  })
})
