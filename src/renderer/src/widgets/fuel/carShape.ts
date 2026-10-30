/**
 * The fuel widget's car seen from above, front up (the tyres line): a body, two axles and four
 * tyres of three tread bands each, in a fixed 44 x 60 box. Computed once at import: the widget
 * binds only each band's wear class, so a new reading re-colours paths and moves nothing.
 *
 *     ▐▌▌▌ ┌──┐ ▌▌▌▐      front left, front right
 *      ────┤  ├────
 *          │  │
 *     ▐▌▌▌ │  │ ▌▌▌▐      rear left, rear right
 *      ────┴──┴────
 *
 * The bands run left, middle, right as iRacing names them (LFwearL/M/R), which is also left to
 * right on screen: a left tyre's outer shoulder is its left band.
 */

export const CAR_VIEWBOX = '0 0 44 60'

const TYRE_W = 11
const TYRE_H = 21
const TYRE_R = 2.5
/** Top left corner of each tyre: front left, front right, rear left, rear right. */
const TYRES: readonly (readonly [number, number])[] = [
  [0, 3],
  [33, 3],
  [0, 36],
  [33, 36]
]

const n = (v: number): string => String(Math.round(v * 100) / 100)

/** A band: a rectangle with its outer corners rounded (left band: left ones, right: right). */
function bandPath(x: number, y: number, w: number, side: 'left' | 'mid' | 'right'): string {
  const r = TYRE_R
  const h = TYRE_H
  if (side === 'mid') return `M${n(x)} ${n(y)}h${n(w)}v${n(h)}h${n(-w)}z`
  if (side === 'left') {
    return (
      `M${n(x + r)} ${n(y)}h${n(w - r)}v${n(h)}h${n(-(w - r))}` +
      `a${r} ${r} 0 0 1 ${-r} ${-r}v${n(-(h - 2 * r))}a${r} ${r} 0 0 1 ${r} ${-r}z`
    )
  }
  return (
    `M${n(x)} ${n(y)}h${n(w - r)}a${r} ${r} 0 0 1 ${r} ${r}v${n(h - 2 * r)}` +
    `a${r} ${r} 0 0 1 ${-r} ${r}h${n(-(w - r))}z`
  )
}

/** Each tyre's three band paths (left, middle, right), front left first. */
export const TYRE_BANDS: readonly (readonly [string, string, string])[] = TYRES.map(([x, y]) => {
  const w = TYRE_W / 3
  return [
    bandPath(x, y, w, 'left'),
    bandPath(x + w, y, w, 'mid'),
    bandPath(x + 2 * w, y, w, 'right')
  ] as const
})

/** Each tyre's outline (over its bands), front left first. */
export const TYRE_OUTLINES: readonly string[] = TYRES.map(
  ([x, y]) =>
    `M${n(x + TYRE_R)} ${n(y)}h${n(TYRE_W - 2 * TYRE_R)}a${TYRE_R} ${TYRE_R} 0 0 1 ${TYRE_R} ${TYRE_R}` +
    `v${n(TYRE_H - 2 * TYRE_R)}a${TYRE_R} ${TYRE_R} 0 0 1 ${-TYRE_R} ${TYRE_R}h${n(-(TYRE_W - 2 * TYRE_R))}` +
    `a${TYRE_R} ${TYRE_R} 0 0 1 ${-TYRE_R} ${-TYRE_R}v${n(-(TYRE_H - 2 * TYRE_R))}` +
    `a${TYRE_R} ${TYRE_R} 0 0 1 ${TYRE_R} ${-TYRE_R}z`
)

/** The lines between the bands of every tyre, one path. */
export const TYRE_GROOVES: string = TYRES.map(([x, y]) => {
  const w = TYRE_W / 3
  return `M${n(x + w)} ${n(y + 1.5)}v${n(TYRE_H - 3)}M${n(x + 2 * w)} ${n(y + 1.5)}v${n(TYRE_H - 3)}`
}).join('')

/** The axles, under the body and the tyres. */
export const CAR_AXLES = `M${TYRE_W} ${n(3 + TYRE_H / 2)}H${44 - TYRE_W}M${TYRE_W} ${n(36 + TYRE_H / 2)}H${44 - TYRE_W}`

/** The body: a narrow nose, the cockpit, the wider sidepods and a squared tail. */
export const CAR_BODY =
  'M19 1h6q2 0 2.4 3l1.6 10q3 2 3 6v30q0 8-4 8h-12q-4 0-4-8v-30q0-4 3-6l1.6-10q.4-3 2.4-3z'

/** The cockpit opening, a hint that this is a car seen from above. */
export const CAR_COCKPIT = 'M19.5 20h5q1.5 0 1.5 2v8q0 2-1.5 2h-5q-1.5 0-1.5-2v-8q0-2 1.5-2z'
