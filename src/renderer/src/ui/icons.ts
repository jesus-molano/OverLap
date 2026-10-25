/**
 * Inline SVG icon set, 16 x 16 user units, drawn in currentColor (rendered by Icon.vue). No
 * sprite file, no <use> across documents: each icon is a few static paths.
 */

export interface IconShape {
  readonly d: string
  /** 'fill' (default) or a 1.6 unit round stroke. */
  readonly kind?: 'fill' | 'stroke'
  /** Holes where subpaths overlap (letters cut out of a shape). */
  readonly evenodd?: true
  /** A fixed tint instead of currentColor (see Icon.vue). */
  readonly tint?: 'orange' | 'ink'
}

const ROUND_SQUARE = 'M3 1h10a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V3a2 2 0 0 1 2-2z'
const POLE = 'M2 1.5h1.5V15H2z'

export const ICONS = {
  /** Pit lane / in the stall: a rounded square with a P cut out. */
  pit: [
    {
      d:
        ROUND_SQUARE +
        'M5.5 4v8h1.75V9.5H9a2.75 2.75 0 0 0 0-5.5H5.5z' +
        'M7.25 5.5H9a1.25 1.25 0 0 1 0 2.5H7.25V5.5z',
      evenodd: true
    }
  ],
  /** Out lap: an arrow leaving a bracket. */
  out: [{ d: 'M7 2.5H3.5a1 1 0 0 0-1 1v9a1 1 0 0 0 1 1H7M6.5 8h7M10.5 5l3 3-3 3', kind: 'stroke' }],
  /** Black flag (penalty). */
  flag: [{ d: POLE }, { d: 'M3.5 2.5H14l-2.25 3.25L14 9H3.5z' }],
  /** Meatball (repair) flag: black square with an orange disc. */
  meatball: [
    { d: ROUND_SQUARE, tint: 'ink' },
    {
      d: 'M3.25 1.75h9.5a1.5 1.5 0 0 1 1.5 1.5v9.5a1.5 1.5 0 0 1-1.5 1.5h-9.5a1.5 1.5 0 0 1-1.5-1.5v-9.5a1.5 1.5 0 0 1 1.5-1.5z',
      kind: 'stroke'
    },
    { d: 'M8 4.25a3.75 3.75 0 1 1 0 7.5 3.75 3.75 0 0 1 0-7.5z', tint: 'orange' }
  ],
  /** Chequered flag (finished). */
  chequered: [
    { d: POLE },
    {
      d:
        'M4 2h2.5v2H4zM9 2h2.5v2H9zM6.5 4H9v2H6.5zM11.5 4H14v2h-2.5z' +
        'M4 6h2.5v2H4zM9 6h2.5v2H9zM6.5 8H9v2H6.5zM11.5 8H14v2h-2.5z'
    },
    { d: 'M4.5 2.5h9v7h-9z', kind: 'stroke' }
  ],
  /** Locked widget. */
  lock: [
    { d: 'M5.25 7V5.25a2.75 2.75 0 0 1 5.5 0V7', kind: 'stroke' },
    {
      d: 'M4.6 7h6.8A1.6 1.6 0 0 1 13 8.6v4.3a1.6 1.6 0 0 1-1.6 1.6H4.6A1.6 1.6 0 0 1 3 12.9V8.6A1.6 1.6 0 0 1 4.6 7z'
    }
  ],
  /** Warning / off-track: a triangle with an exclamation mark cut out. */
  warning: [
    {
      d:
        'M8 1.5a1.2 1.2 0 0 1 1.04.6l6.3 11.1A1.2 1.2 0 0 1 14.3 15H1.7a1.2 1.2 0 0 1-1.04-1.8l6.3-11.1A1.2 1.2 0 0 1 8 1.5z' +
        'M7.25 5.5h1.5v4.5h-1.5zM7.25 11.25h1.5v1.5h-1.5z',
      evenodd: true
    }
  ],
  /** Being caught / attention: a disc with an exclamation mark cut out. */
  alert: [
    {
      d: 'M8 1a7 7 0 1 1 0 14A7 7 0 0 1 8 1z' + 'M7.25 4h1.5v5h-1.5zM7.25 10.5h1.5V12h-1.5z',
      evenodd: true
    }
  ],
  /** Will catch / done. */
  check: [{ d: 'M3 8.5l3.2 3.2L13 4.8', kind: 'stroke' }],
  /** Won't reach. */
  minus: [{ d: 'M3.5 8h9', kind: 'stroke' }],
  /** Gaining / up (replaces the ▲ glyph next to other icons). */
  'arrow-up': [{ d: 'M8 3.5l5.5 7h-11z' }],
  /** Losing / down. */
  'arrow-down': [{ d: 'M8 12.5l-5.5-7h11z' }],
  /** Time remaining. */
  clock: [
    { d: 'M8 1.75a6.25 6.25 0 1 1 0 12.5 6.25 6.25 0 0 1 0-12.5z', kind: 'stroke' },
    { d: 'M8 4.75V8l2.25 1.5', kind: 'stroke' }
  ],
  /** Disconnected car. */
  plug: [{ d: 'M6 1.5v3M10 1.5v3M4.5 4.5h7V7a3.5 3.5 0 0 1-7 0zM8 10.5v4', kind: 'stroke' }],
  /** Hidden by a "Mostrar en" / "Ocultar en boxes" rule: a struck-through eye. */
  'eye-off': [
    { d: 'M1.5 8s2.4-4.25 6.5-4.25S14.5 8 14.5 8s-2.4 4.25-6.5 4.25S1.5 8 1.5 8z', kind: 'stroke' },
    { d: 'M8 6a2 2 0 1 1 0 4 2 2 0 0 1 0-4z' },
    { d: 'M2.5 13.5l11-11', kind: 'stroke' }
  ],
  /** Steering wheel. */
  wheel: [
    { d: 'M8 1.75a6.25 6.25 0 1 1 0 12.5 6.25 6.25 0 0 1 0-12.5z', kind: 'stroke' },
    { d: 'M1.9 7.25 6 8.25h4l4.1-1M8 10v4.2', kind: 'stroke' }
  ]
} as const satisfies Record<string, readonly IconShape[]>

export type IconName = keyof typeof ICONS

export const ICON_NAMES = Object.keys(ICONS) as IconName[]
