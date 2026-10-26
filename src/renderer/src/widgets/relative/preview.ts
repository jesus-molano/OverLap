/**
 * Sample relative for edit mode: invented drivers around you, with a car lapping you, a lapped
 * car, one in the pits, two classes and every flag badge, so name format, licence style and
 * columns are judged on realistic rows. Tyres are named for your car model (the GT3s) only. As
 * many cars as the options ask for, your incident count and the conditions footer's readings
 * (drawn only with the footer on). Pure.
 */
import type { CarPenalty, LapRelation, RelativeData, RelativeRow } from '@shared/types'
import { PREVIEW_CONDITIONS } from '@renderer/view/conditions'
import { PREVIEW_INCIDENTS } from '@renderer/view/incidents'

const GT3 = '#33ceff'
const LMP2 = '#ff5888'
const LIC = { A: '#0153db', B: '#00c702', C: '#feec04', D: '#fc8a27', R: '#fc0706' } as const
/** Laps of a stint without a stop. */
const STINT = 16

interface Seed {
  num: string
  name: string
  cls?: string
  pos: number
  ir: number
  lic: keyof typeof LIC
  sr: string
  gap: number
  lap?: LapRelation
  pits?: boolean
  /** Defaults to STINT. */
  stint?: number
  /** Defaults to 'Hard' for a GT3 (your model), no name for the others. */
  tyre?: string | null
  penalty?: CarPenalty
}

function row(s: Seed, i: number, isPlayer = false): RelativeRow {
  return {
    carIdx: i,
    isPlayer,
    classPosition: s.pos,
    carNumber: s.num,
    driverName: s.name,
    classShortName: s.cls === LMP2 ? 'LMP2' : 'GT3',
    classColor: s.cls ?? GT3,
    iRating: s.ir,
    licString: `${s.lic} ${s.sr}`,
    licColor: LIC[s.lic],
    gapS: s.gap,
    lapRelation: s.lap ?? 'same',
    inPits: s.pits === true,
    towed: false,
    stintLaps: s.stint ?? STINT,
    tyre: s.tyre !== undefined ? s.tyre : s.cls === LMP2 ? null : 'Hard',
    penalty: s.penalty ?? null
  }
}

/** Closest first. */
const AHEAD: readonly Seed[] = [
  {
    num: '19',
    name: 'Pierre-Étienne Duvalier',
    pos: 4,
    ir: 3488,
    lic: 'A',
    sr: '4.12',
    gap: 0.9,
    // Just out of the pits on wets.
    stint: 0,
    tyre: 'Wet'
  },
  {
    num: '29',
    name: 'Zoë van der Berg',
    cls: LMP2,
    pos: 1,
    ir: 3320,
    lic: 'A',
    sr: '2.88',
    gap: 2.4,
    lap: 'ahead',
    stint: STINT + 1,
    penalty: 'black'
  },
  {
    num: '12',
    name: 'Mateo Echeverría',
    pos: 3,
    ir: 3105,
    lic: 'A',
    sr: '3.40',
    gap: 4.6,
    penalty: 'meatball'
  },
  { num: '3', name: 'Lukas Brandt', pos: 2, ir: 2034, lic: 'B', sr: '2.12', gap: 7.8 },
  {
    num: '31',
    name: 'Hugo Lefèvre',
    cls: LMP2,
    pos: 2,
    ir: 2950,
    lic: 'A',
    sr: '3.66',
    gap: 11.2,
    lap: 'ahead'
  },
  { num: '44', name: 'Jonas Lindqvist', pos: 1, ir: 2712, lic: 'A', sr: '2.71', gap: 14.9 },
  {
    num: '5',
    name: 'Sofia Rossi',
    cls: LMP2,
    pos: 3,
    ir: 2610,
    lic: 'B',
    sr: '4.02',
    gap: 19.3,
    lap: 'ahead'
  },
  {
    num: '36',
    name: 'Liam O’Connor',
    cls: LMP2,
    pos: 4,
    ir: 2240,
    lic: 'B',
    sr: '2.77',
    gap: 24.1,
    lap: 'ahead'
  },
  {
    num: '77',
    name: 'Ana Sousa',
    cls: LMP2,
    pos: 5,
    ir: 1985,
    lic: 'C',
    sr: '3.05',
    gap: 30.6,
    lap: 'ahead'
  },
  {
    num: '61',
    name: 'Tomasz Nowak',
    pos: 10,
    ir: 1630,
    lic: 'C',
    sr: '2.94',
    gap: 37.2,
    lap: 'behind'
  }
]

/** Closest first. */
const BEHIND: readonly Seed[] = [
  {
    num: '51',
    name: 'Marco Bianchi',
    pos: 6,
    ir: 2488,
    lic: 'A',
    sr: '1.84',
    gap: -1.1,
    // Warned for leaving the track.
    penalty: 'furled'
  },
  {
    num: '8',
    name: 'Kenji Watanabe',
    pos: 8,
    ir: 2203,
    lic: 'B',
    sr: '3.81',
    gap: -3.5,
    lap: 'behind',
    pits: true,
    stint: STINT - 1
  },
  {
    num: '9',
    name: 'Camille Martineau',
    pos: 7,
    ir: 1104,
    lic: 'R',
    sr: '2.03',
    gap: -5.2,
    // Another GT3 model: its compound has no name.
    tyre: null
  },
  {
    num: '23',
    name: 'John Smith Jr',
    pos: 9,
    ir: 1876,
    lic: 'C',
    sr: '3.55',
    gap: -9.4,
    lap: 'behind',
    stint: 6
  },
  {
    num: '88',
    name: 'Emma Larsen',
    pos: 11,
    ir: 1422,
    lic: 'D',
    sr: '3.10',
    gap: -13.8,
    lap: 'behind'
  },
  {
    num: '14',
    name: 'Diego Fernández Ortega',
    pos: 12,
    ir: 1290,
    lic: 'D',
    sr: '2.48',
    gap: -18.0,
    lap: 'behind'
  },
  {
    num: '2',
    name: 'Nora Lindgren',
    pos: 13,
    ir: 1210,
    lic: 'D',
    sr: '1.95',
    gap: -22.7,
    lap: 'behind'
  },
  {
    num: '17',
    name: 'Rafael Costa',
    pos: 14,
    ir: 1150,
    lic: 'R',
    sr: '2.60',
    gap: -27.4,
    lap: 'behind'
  },
  {
    num: '40',
    name: 'Yuki Tanaka',
    pos: 15,
    ir: 1066,
    lic: 'R',
    sr: '1.41',
    gap: -31.9,
    lap: 'behind'
  },
  {
    num: '66',
    name: 'Oscar Berg',
    pos: 16,
    ir: 987,
    lic: 'R',
    sr: '2.05',
    gap: -36.3,
    lap: 'behind'
  }
]

const PLAYER: Seed = {
  num: '7',
  name: 'Alejandro Ruiz',
  pos: 5,
  ir: 2391,
  lic: 'B',
  sr: '3.27',
  gap: 0
}

/** Sample payload with up to `ahead` / `behind` cars (already clamped by the caller). */
export function previewRelative(ahead: number, behind: number): RelativeData {
  const a = AHEAD.slice(0, Math.max(0, ahead)).reverse()
  const b = BEHIND.slice(0, Math.max(0, behind))
  const rows = [
    ...a.map((s, i) => row(s, i + 1)),
    row(PLAYER, 0, true),
    ...b.map((s, i) => row(s, i + 21))
  ]
  return {
    rows,
    playerRow: a.length,
    slotsAhead: ahead,
    slotsBehind: behind,
    sessionType: 'Race',
    incidents: PREVIEW_INCIDENTS,
    conditions: PREVIEW_CONDITIONS
  }
}
