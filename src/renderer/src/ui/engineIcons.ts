/**
 * Engine warning-light pictograms for the warning lights strip, in the same 16 x 16 currentColor
 * format as icons.ts (rendered by Icon.vue): the standard dashboard meanings, our own drawing.
 * Every pictogram is one colour, so the strip lights it by severity alone.
 */

import type { IconShape } from './icons'

export const ENGINE_ICONS = {
  /** Oil pressure: an oil can, its spout dripping. */
  'oil-pressure': [
    { d: 'M2.5 7h6l6.5-3.25v1.25L10 9.25v3.5a.75.75 0 0 1-.75.75h-6a.75.75 0 0 1-.75-.75z' },
    { d: 'M4 4.5h4v1.25H4zM5.25 5.5h1.5V7h-1.5z' },
    { d: 'M14.25 7l1.24 2.35a1.4 1.4 0 1 1-2.48 0z' }
  ],
  /** Fuel pressure: a fuel pump with its hose. */
  'fuel-pressure': [
    { d: 'M3 2h5a1 1 0 0 1 1 1v10.5H2V3a1 1 0 0 1 1-1z' + 'M3.5 3.5h4v3h-4z', evenodd: true },
    { d: 'M1 13.25h9v1.5H1z' },
    { d: 'M9 8.5h1.25a.75.75 0 0 1 .75.75v2.5a1.5 1.5 0 0 0 3 0V4.75L12.75 3.5', kind: 'stroke' }
  ],
  /** Engine (stalled, engine fault): an engine block seen from the side. */
  engine: [
    { d: 'M5 7h7.5v6H5zM12.5 8.75h2.25v3H12.5M5 10H2.25M2.25 8v4', kind: 'stroke' },
    { d: 'M6 4h5v3.5H6zM7.75 2.5h1.5V4h-1.5zM6.75 1.25h3.5v1.25h-3.5z' }
  ],
  /** Water temperature: a thermometer standing in waves. */
  'water-temp': [
    { d: 'M8 1.75V9.5', kind: 'stroke' },
    { d: 'M9.6 2.5h2.15v1H9.6zM9.6 5h2.15v1H9.6z' },
    { d: 'M8 9.5a2 2 0 1 1 0 4 2 2 0 0 1 0-4z' },
    {
      d:
        'M.5 10.25q1-1.2 2 0t2 0M11.5 10.25q1-1.2 2 0t2 0' +
        'M.5 13.25q1-1.2 2 0t2 0M11.5 13.25q1-1.2 2 0t2 0',
      kind: 'stroke'
    }
  ],
  /** Oil temperature: a thermometer beside an oil drop. */
  'oil-temp': [
    { d: 'M5.5 1.75V9', kind: 'stroke' },
    { d: 'M7.25 2.5H9.5v1H7.25zM7.25 5H9.5v1H7.25z' },
    { d: 'M5.5 8.75a2.25 2.25 0 1 1 0 4.5 2.25 2.25 0 0 1 0-4.5z' },
    { d: 'M12 6.25l2.08 3.11a2.5 2.5 0 1 1-4.16 0z' }
  ],
  /** Repair needed: a solid wrench (a solid fill means act now). */
  repair: [
    {
      d: 'M2.87 11.36L7.82 6.41A3.25 3.25 0 0 1 12.07 2.17L10.3 3.93L12.07 5.7L13.83 3.93A3.25 3.25 0 0 1 9.59 8.18L4.64 13.13A1.25 1.25 0 0 1 2.87 11.36z'
    }
  ],
  /** Optional repair: the same wrench in line, lighter than the solid one. */
  'repair-optional': [
    { d: 'M3.4 12.6L9.06 6.94M10.96 2.67A2.5 2.5 0 1 0 13.33 5.04', kind: 'stroke' }
  ],
  /**
   * Pit limiter: a P under a speed dial's sweep. Not a P in a ring, which is the parking brake
   * on a road car's dash.
   */
  'pit-limiter': [
    { d: 'M2 9.5A6.25 6.25 0 0 1 14 7.75', kind: 'stroke' },
    {
      d: 'M5.75 6h2.75a2.4 2.4 0 0 1 0 4.8H7.25V14h-1.5z' + 'M7.25 7.4h1.25a1 1 0 0 1 0 2H7.25z',
      evenodd: true
    }
  ],
  /** Rev limiter: a rev counter, its needle in the red zone. */
  'rev-limiter': [
    { d: 'M3.76 12.74A6 6 0 0 1 6.45 2.7M8 8.5l2.55-2.55', kind: 'stroke' },
    { d: 'M9.76 1.93A6.8 6.8 0 0 1 12.81 13.31L10.97 11.47A4.2 4.2 0 0 0 9.09 4.44z' },
    { d: 'M8 7a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3z' }
  ]
} as const satisfies Record<string, readonly IconShape[]>

export type EngineIconName = keyof typeof ENGINE_ICONS

export const ENGINE_ICON_NAMES = Object.keys(ENGINE_ICONS) as EngineIconName[]
