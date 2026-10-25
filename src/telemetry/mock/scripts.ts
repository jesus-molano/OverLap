/**
 * Scripted motion of the cast around the player: radar encounters (escorts),
 * the two battles and the starting slots of everybody else.
 */

/** Width of one lane next to the racing line (m). */
export const LANE_M = 3.6
const L1 = -LANE_M
const L2 = -2 * LANE_M
const R1 = LANE_M
const R2 = 2 * LANE_M

/** Gap in metres to the player (+ = ahead) and lateral offset in metres (- = left). */
export type Keyframe = readonly [timeS: number, gapM: number, latM: number]

/**
 * Encounter director: two cars of the other class orbit the player on a fixed
 * cycle, eased with smoothstep between keyframes (every keyframe is a rest
 * point relative to the player, so the cars settle alongside before moving
 * on). A car that ended up ahead is later passed back by the player, which
 * closes the cycle without teleporting anybody. Lane changes only happen at
 * |gap| >= 40 m. Timeline (overlap windows):
 *   ~3-8 s CarLeft (A passes on the left), ~21-26 s CarRight (B on the right),
 *   ~39-44 s CarLeftRight (the player splits A and B), ~58-63 s Cars2Left (A
 *   and B pass three-wide), ~77-82 s Cars2Right (the player passes both),
 *   ~94-102 s A follows 6-11 m behind in the same line (Clear).
 */
export const CYCLE_S = 106
export const SCRIPT_A: readonly Keyframe[] = [
  [0, -25, L1],
  [3, -4, L1],
  [8, 4, L1],
  [13, 40, L1],
  [33, 40, L1],
  [39, 4, L1],
  [44, -4, L1],
  [49, -40, L1],
  [52, -40, L1],
  [58, -3, L1],
  [63, 4, L1],
  [68, 40, L1],
  [72, 40, R1],
  [77, 3, R1],
  [82, -4, R1],
  [87, -40, R1],
  [89, -40, 0],
  [94, -10, 0],
  [98, -6.5, 0],
  [102, -11, 0],
  [CYCLE_S, -25, L1]
]
export const SCRIPT_B: readonly Keyframe[] = [
  [0, -50, R1],
  [15, -50, R1],
  [21, -4, R1],
  [26, 4, R1],
  [31, 50, R1],
  [33, 50, R1],
  [39, 3, R1],
  [44, -3, R1],
  [49, -50, R1],
  [53, -50, L2],
  [58, -4, L2],
  [63, 3, L2],
  [68, 50, L2],
  [72, 50, R2],
  [77, 4, R2],
  [82, -3, R2],
  [87, -50, R2],
  [95, -50, R1],
  [CYCLE_S, -50, R1]
]

/**
 * The escorts orbit for ORBIT_CYCLES cycles, then move ahead of the player in
 * their lanes, past the radar's longest range, wait there and drop back to the
 * start of the orbit: real traffic gets the radar and the traffic widget to
 * itself in between (a faster car ahead of you is no traffic). Every lap of an
 * escort stays within ~3 s of the player's.
 */
export const ORBIT_CYCLES = 1
const ESCORT_MOVE_S = 30
const ESCORT_WAIT_S = 150
export const ESCORT_PERIOD_S = ORBIT_CYCLES * CYCLE_S + 2 * ESCORT_MOVE_S + ESCORT_WAIT_S
/** Where the escorts wait (m ahead of the player): beyond the radar's 100 m. */
export const ESCORT_PARK_M = 104

/** Battle gap (s) by laps the player drove since the start; cyclic, linear in between. */
export type GapKey = readonly [laps: number, gapS: number]
/** Ahead: the player catches it at ~0.15 s/lap, gets stuck in its dirty air, then it pulls away. */
export const BATTLE_AHEAD: readonly GapKey[] = [
  [0, 0.8],
  [2.4, 0.44],
  [4.4, 0.42],
  [9, 0.8]
]
/** Behind: closes in at ~0.1 s/lap, sits there, then drops back. */
export const BATTLE_BEHIND: readonly GapKey[] = [
  [0, 1.2],
  [6, 0.6],
  [8.5, 0.55],
  [13, 1.2]
]
/** Lap-to-lap wobble of the battle gaps (s), two slow sines per car. */
const BATTLE_NOISE_S = 0.025
const BATTLE_NOISE2_S = 0.012

/** Starting track offset (lap fraction, wrapped) and lap relation to the player. */
export type Slot = readonly [offset: number, laps: number]

// Other cars by class relative to the player's. Nothing free starts within
// ~450 m, so in the first cycle only the scripted cars come alongside; the
// LMP2 at -0.12 laps the player a little later.
export const FASTER_SLOTS: readonly Slot[] = [
  [0.07, 1],
  [0.16, 1],
  [-0.12, 1],
  [0.27, 2],
  [0.38, 1],
  [0.47, 1],
  [-0.42, 1],
  [-0.27, 2]
]
// The lapped classmates are slow backmarkers: four ~9, 22, 35 and 50 s up the road, which the
// player catches every ~6 min (slower traffic for the traffic widget even without a slower
// class), and one just lapped, behind.
export const SAME_SLOTS: readonly Slot[] = [
  [0.11, 0],
  [0.21, 0],
  [0.065, -1],
  [0.43, 0],
  [0.36, -1],
  [0.16, -1],
  [-0.22, 0],
  [-0.07, -1]
]
export const SLOWER_SLOTS: readonly Slot[] = [
  [0.08, -1],
  [0.14, -1],
  [0.2, -2],
  [0.26, -1],
  [0.32, -1],
  [0.38, -2],
  [0.44, -1],
  [-0.46, -1],
  [-0.38, -1],
  [-0.3, -2],
  [-0.2, -1],
  [-0.1, -1]
]

/** Smoothstep-eased value (1 = gap, 2 = lateral) of a cyclic script at `tS`. */
export function sampleScript(keys: readonly Keyframe[], tS: number, field: 1 | 2): number {
  const tc = tS % CYCLE_S
  let prev: Keyframe | undefined
  for (const key of keys) {
    if (prev && tc <= key[0]) {
      const s = (tc - prev[0]) / (key[0] - prev[0])
      return prev[field] + (key[field] - prev[field]) * s * s * (3 - 2 * s)
    }
    prev = key
  }
  return prev ? prev[field] : 0
}

/**
 * Gap (1) or lateral offset (2) of an escort following the orbit `keys` at `tS`
 * seconds since the start, through the whole schedule (orbits, away, back).
 */
export function sampleEscort(keys: readonly Keyframe[], tS: number, field: 1 | 2): number {
  const t = tS % ESCORT_PERIOD_S
  const orbitS = ORBIT_CYCLES * CYCLE_S
  if (t < orbitS) return sampleScript(keys, t, field)
  // The orbit ends where it starts: away from there and back, in the same lane.
  const start = keys[0]
  if (!start) return 0
  if (field === 2) return start[2]
  const away = t - orbitS
  const s =
    away < ESCORT_MOVE_S
      ? away / ESCORT_MOVE_S
      : away < ESCORT_MOVE_S + ESCORT_WAIT_S
        ? 1
        : Math.max(0, 1 - (away - ESCORT_MOVE_S - ESCORT_WAIT_S) / ESCORT_MOVE_S)
  return start[1] + (ESCORT_PARK_M - start[1]) * s * s * (3 - 2 * s)
}

/** Battle gap (s, > 0) after `laps` of the player, plus a slow wobble at `tS`. */
export function battleGapS(
  keys: readonly GapKey[],
  laps: number,
  tS: number,
  w1: number,
  ph1: number,
  w2: number,
  ph2: number
): number {
  const cycle = keys.at(-1)?.[0] ?? 1
  const lc = ((laps % cycle) + cycle) % cycle
  let gap = keys[0]?.[1] ?? 1
  let prev: GapKey | undefined
  for (const key of keys) {
    if (prev && lc <= key[0]) {
      gap = prev[1] + ((key[1] - prev[1]) * (lc - prev[0])) / (key[0] - prev[0])
      break
    }
    prev = key
  }
  return gap + BATTLE_NOISE_S * Math.sin(w1 * tS + ph1) + BATTLE_NOISE2_S * Math.sin(w2 * tS + ph2)
}
