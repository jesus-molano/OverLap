/**
 * Overall and per-class running order of the active cars, written to
 * RaceCarState.overallPosition / classPosition every tick. Allocation-free
 * in steady state: groups and sort keys are reused across sessions.
 */
import { MAX_CARS } from '../telemetry'
import type { CarTrack } from './carTrack'
import { OrderGroup } from './positions'

const POSITION_HOLD_S = 0.5
const POSITION_FORCE_S = 2

/**
 * How cars are ranked: `race` by distance (finishers frozen by finishing lap,
 * then crossing time), `grid` by starting position before the green, `best`
 * by best lap (practice/qualifying).
 */
export type OrderMode = 'race' | 'grid' | 'best'

type Tracks = readonly (CarTrack | undefined)[]

export class RaceOrder {
  private readonly overall = new OrderGroup(MAX_CARS)
  private readonly classGroups: OrderGroup[] = []
  private classGroupCount = 0
  /** Sort keys by CarIdx, ascending, then CarIdx. */
  private readonly key1 = new Float64Array(MAX_CARS)
  private readonly key2 = new Float64Array(MAX_CARS)
  private readonly compare = (a: number, b: number): number =>
    (this.key1[a] ?? 0) - (this.key1[b] ?? 0) || (this.key2[a] ?? 0) - (this.key2[b] ?? 0) || a - b

  clear(): void {
    this.overall.clear()
    this.classGroupCount = 0
  }

  /** CarIdx of the overall leader as shown, -1 when there are no cars. */
  leaderIdx(): number {
    return this.overall.size > 0 ? (this.overall.shown[0] ?? -1) : -1
  }

  /**
   * Ranks the active `tracks` at SessionTime `now`. `fresh` (members changed)
   * regroups them and shows the new order at once; otherwise changes go
   * through the per-segment hold/force debounce.
   */
  update(
    tracks: Tracks,
    mode: OrderMode,
    gridPos: Float64Array,
    now: number,
    fresh: boolean
  ): void {
    if (fresh) this.rebuild(tracks)
    const n = this.overall.size
    if (n === 0) return
    const order = this.overall.order
    for (let k = 0; k < n; k++) {
      const i = order[k] ?? 0
      const track = tracks[i]
      if (track) this.setKeys(i, track, mode, gridPos[i] ?? Infinity)
    }
    this.settle(this.overall, tracks, now, fresh, true)
    for (let c = 0; c < this.classGroupCount; c++) {
      const group = this.classGroups[c]
      if (group) this.settle(group, tracks, now, fresh, false)
    }
  }

  private setKeys(i: number, track: CarTrack, mode: OrderMode, grid: number): void {
    const st = track.state
    if (mode === 'race') {
      this.key1[i] = st.finished ? -track.finishLap : -track.lastD
      this.key2[i] = st.finished ? track.finishT : Infinity
    } else if (mode === 'grid') {
      this.key1[i] = grid
      this.key2[i] = st.bestLapTime ?? Infinity
    } else if (Number.isFinite(track.officialBest)) {
      // iRacing's best (last known) first, then model-only times, then no time.
      this.key1[i] = 0
      this.key2[i] = track.officialBest
    } else {
      const model = Number.isFinite(track.bestClean)
      this.key1[i] = model ? 1 : 2
      this.key2[i] = model ? track.bestClean : 0
    }
  }

  private settle(
    group: OrderGroup,
    tracks: Tracks,
    now: number,
    fresh: boolean,
    all: boolean
  ): void {
    group.sort(this.compare)
    if (fresh) group.showNow()
    else group.settle(now, POSITION_HOLD_S, POSITION_FORCE_S)
    const shown = group.shown
    for (let k = 0; k < group.size; k++) {
      const track = tracks[shown[k] ?? 0]
      if (!track) continue
      if (all) track.state.overallPosition = k + 1
      else track.state.classPosition = k + 1
    }
  }

  private rebuild(tracks: Tracks): void {
    this.clear()
    for (let i = 0; i < tracks.length; i++) {
      const track = tracks[i]
      if (!track?.active) continue
      this.overall.add(i)
      this.classGroup(track.classId).add(i)
    }
  }

  private classGroup(classId: number): OrderGroup {
    for (let c = 0; c < this.classGroupCount; c++) {
      const group = this.classGroups[c]
      if (group && group.classId === classId) return group
    }
    let group = this.classGroups[this.classGroupCount]
    if (!group) {
      group = new OrderGroup(MAX_CARS)
      this.classGroups.push(group)
    }
    group.clear()
    group.classId = classId
    this.classGroupCount++
    return group
  }
}
