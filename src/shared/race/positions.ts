/**
 * Debounced running order of a group of cars (one class, or all of them).
 *
 * The candidate order is re-sorted every tick. The shown order follows it
 * per segment: a run of positions holding the same set of cars in both
 * orders (the only cuts that keep `shown` a permutation). A segment that
 * differs is shown once none of its cars has moved for `holdS`, or when one
 * of them has differed from its shown place for more than `forceS`. So two
 * cars side by side somewhere in the field neither delay nor get
 * snapshotted by an unrelated pass elsewhere.
 *
 * Per-car arrays are indexed by CarIdx, so CarIdx must be < capacity.
 */
export class OrderGroup {
  /** Candidate order (carIdx), first `size` entries. */
  readonly order: Int32Array
  /** Shown order (carIdx), first `size` entries. */
  readonly shown: Int32Array
  size = 0
  /** Class id of a class group (unused for the overall group). */
  classId = 0

  /** By carIdx: index in `order` at the last settle(). */
  private readonly candAt: Int32Array
  /** By carIdx: index in `shown`. */
  private readonly shownAt: Int32Array
  /** By carIdx: SessionTime its candidate index last changed. */
  private readonly movedAt: Float64Array
  /** By carIdx: since when its candidate index differs from its shown one; NaN when equal. */
  private readonly diffSince: Float64Array
  /** By carIdx scratch of the segment scan: +1 in the shown prefix, -1 in the candidate one. */
  private readonly balance: Int8Array

  constructor(capacity: number) {
    this.order = new Int32Array(capacity)
    this.shown = new Int32Array(capacity)
    this.candAt = new Int32Array(capacity)
    this.shownAt = new Int32Array(capacity)
    this.movedAt = new Float64Array(capacity)
    this.diffSince = new Float64Array(capacity).fill(NaN)
    this.balance = new Int8Array(capacity)
  }

  clear(): void {
    this.size = 0
  }

  add(carIdx: number): void {
    this.order[this.size++] = carIdx
  }

  /**
   * Insertion sort of the candidate order: O(n) per tick, since it is
   * nearly sorted already. True when the order changed.
   */
  sort(cmp: (a: number, b: number) => number): boolean {
    const a = this.order
    let moved = false
    for (let k = 1; k < this.size; k++) {
      const v = a[k] ?? 0
      let j = k - 1
      while (j >= 0 && cmp(a[j] ?? 0, v) > 0) {
        a[j + 1] = a[j] ?? 0
        j--
      }
      if (j !== k - 1) {
        a[j + 1] = v
        moved = true
      }
    }
    return moved
  }

  /** Shows the candidate order right away (new members). */
  showNow(): void {
    for (let k = 0; k < this.size; k++) {
      const c = this.order[k] ?? 0
      this.shown[k] = c
      this.shownAt[c] = k
      this.candAt[c] = k
      this.diffSince[c] = NaN
    }
  }

  /** Applies the hold/force rules per segment after a sort() at SessionTime `now`. O(n). */
  settle(now: number, holdS: number, forceS: number): void {
    const n = this.size
    const order = this.order
    const shown = this.shown
    for (let k = 0; k < n; k++) {
      const c = order[k] ?? 0
      if (this.candAt[c] !== k) {
        this.candAt[c] = k
        this.movedAt[c] = now
      }
      if (this.shownAt[c] === k) this.diffSince[c] = NaN
      else if (Number.isNaN(this.diffSince[c] ?? NaN)) this.diffSince[c] = now
    }

    let open = 0
    let start = 0
    let differs = false
    let lastMove = -Infinity
    let firstDiff = Infinity
    for (let k = 0; k < n; k++) {
      const s = shown[k] ?? 0
      const c = order[k] ?? 0
      if (s !== c) {
        differs = true
        open += this.bump(s, 1) + this.bump(c, -1)
      }
      const moved = this.movedAt[c] ?? 0
      if (moved > lastMove) lastMove = moved
      const since = this.diffSince[c] ?? NaN
      if (since < firstDiff) firstDiff = since
      if (open !== 0) continue
      if (differs && (now - lastMove >= holdS || now - firstDiff > forceS)) this.showRange(start, k)
      start = k + 1
      differs = false
      lastMove = -Infinity
      firstDiff = Infinity
    }
    if (open !== 0) {
      // Not permutations of the same cars (a caller bug): never leave the scratch dirty.
      this.balance.fill(0)
      this.showNow()
    }
  }

  /** Adds `delta` to the balance of `carIdx`; returns the change in the count of nonzero ones. */
  private bump(carIdx: number, delta: number): number {
    const before = this.balance[carIdx] ?? 0
    const after = before + delta
    this.balance[carIdx] = after
    return (before === 0 ? 1 : 0) - (after === 0 ? 1 : 0)
  }

  private showRange(from: number, to: number): void {
    for (let k = from; k <= to; k++) {
      const c = this.order[k] ?? 0
      this.shown[k] = c
      this.shownAt[c] = k
      this.diffSince[c] = NaN
    }
  }
}
