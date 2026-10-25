/**
 * Sample standings for edit mode (ux §4.7): an invented multiclass race with every row state
 * (you at P5, PIT, OUT, a lapped car, class best and personal best laps, off-track, meatball),
 * names that exercise every name format, and the ratings and incidents header. Rows are picked
 * with the same rules as the provider (top rows, rows around you, other class leaders), so the
 * window is sized on what the current options really show. Pure.
 */
import { clampOption, OPTION_SCHEMA } from '@shared/settingsSchema'
import { PREVIEW_INCIDENTS } from '@renderer/view/incidents'
import type {
  GapValue,
  StandingsClassBlock,
  StandingsData,
  StandingsHeader,
  StandingsOptions,
  StandingsRow
} from '@shared/types'

export type PreviewOptions = Pick<
  StandingsOptions,
  'mode' | 'topRows' | 'aroundRows' | 'otherClassLeaders' | 'headerIRating' | 'headerSafetyRating'
>

const LIC = {
  A: '#0153db',
  B: '#00c702',
  C: '#feec04',
  D: '#fc8a27',
  R: '#fc0706'
} as const

const s = (seconds: number): GapValue => ({ kind: 'time', seconds })
const laps = (n: number): GapValue => ({ kind: 'laps', laps: n })

type RowSeed = Partial<StandingsRow> &
  Pick<StandingsRow, 'carNumber' | 'driverName' | 'iRating' | 'licString'>

function makeRows(classColor: string, seeds: readonly RowSeed[], firstIdx: number): StandingsRow[] {
  return seeds.map((seed, i) => ({
    carIdx: firstIdx + i,
    isPlayer: false,
    classPosition: i + 1,
    positionsGained: 0,
    classColor,
    licColor: LIC[(seed.licString?.[0] ?? 'R') as keyof typeof LIC] ?? null,
    interval: null,
    gapToLeader: null,
    lastLap: null,
    lastLapKind: 'normal',
    bestLap: null,
    pitStops: 0,
    lastPitLap: null,
    outLap: false,
    status: 'running',
    penalty: null,
    iRatingDelta: null,
    ...seed
  }))
}

const GT3 = '#33ceff'
const LMP2 = '#ff5888'

const GT3_ROWS = makeRows(
  GT3,
  [
    {
      carNumber: '44',
      driverName: 'Jonas Lindqvist',
      iRating: 2712,
      licString: 'A 2.71',
      lastLap: 136.225,
      lastLapKind: 'class-best',
      bestLap: 136.225,
      iRatingDelta: 41
    },
    {
      carNumber: '3',
      driverName: 'Lukas Brandt',
      iRating: 2034,
      licString: 'B 2.12',
      positionsGained: 1,
      interval: s(3.2),
      gapToLeader: s(3.2),
      lastLap: 136.91,
      bestLap: 136.48,
      iRatingDelta: 30
    },
    {
      carNumber: '12',
      driverName: 'Mateo Echeverría',
      iRating: 3105,
      licString: 'A 3.40',
      positionsGained: -1,
      interval: s(1.4),
      gapToLeader: s(4.6),
      lastLap: 138.579,
      bestLap: 136.89,
      penalty: 'meatball',
      iRatingDelta: 18
    },
    {
      carNumber: '19',
      driverName: 'Pierre-Étienne Duvalier',
      iRating: 3488,
      licString: 'A 4.12',
      interval: s(0.9),
      gapToLeader: s(5.5),
      lastLap: 151.402,
      bestLap: 136.701,
      pitStops: 1,
      lastPitLap: 15,
      outLap: true,
      iRatingDelta: 4
    },
    {
      carNumber: '7',
      driverName: 'Alejandro Ruiz',
      iRating: 2391,
      licString: 'B 3.27',
      isPlayer: true,
      positionsGained: 4,
      interval: s(0.7),
      gapToLeader: s(6.2),
      lastLap: 136.734,
      bestLap: 136.612,
      iRatingDelta: 13
    },
    {
      carNumber: '51',
      driverName: 'Marco Bianchi',
      iRating: 2488,
      licString: 'A 1.84',
      positionsGained: 2,
      interval: s(1.1),
      gapToLeader: s(7.3),
      lastLap: 139.711,
      bestLap: 136.955,
      status: 'off-track',
      iRatingDelta: -2
    },
    {
      carNumber: '9',
      driverName: 'Camille Martineau',
      iRating: 1104,
      licString: 'R 2.03',
      positionsGained: -2,
      interval: s(2.6),
      gapToLeader: s(9.9),
      lastLap: 136.512,
      lastLapKind: 'personal-best',
      bestLap: 136.512,
      iRatingDelta: -9
    },
    {
      carNumber: '8',
      driverName: 'Kenji Watanabe',
      iRating: 2203,
      licString: 'B 3.81',
      positionsGained: -2,
      interval: laps(1),
      gapToLeader: laps(1),
      lastLap: 145.934,
      bestLap: 137.33,
      pitStops: 1,
      status: 'pits',
      iRatingDelta: -15
    },
    {
      carNumber: '23',
      driverName: 'John Smith Jr',
      iRating: 1876,
      licString: 'C 3.55',
      positionsGained: 3,
      interval: s(4.3),
      gapToLeader: laps(1),
      lastLap: 137.802,
      bestLap: 137.41,
      pitStops: 1,
      lastPitLap: 9,
      iRatingDelta: -21
    },
    {
      carNumber: '61',
      driverName: 'Tomasz Nowak',
      iRating: 1630,
      licString: 'C 2.94',
      positionsGained: -1,
      interval: s(6.8),
      gapToLeader: laps(1),
      lastLap: 138.25,
      bestLap: 137.96,
      iRatingDelta: -30
    },
    {
      carNumber: '88',
      driverName: 'Emma Larsen',
      iRating: 1422,
      licString: 'D 3.10',
      interval: s(12.4),
      gapToLeader: laps(1),
      lastLap: 139.09,
      bestLap: 138.4,
      iRatingDelta: -38
    },
    {
      carNumber: '14',
      driverName: 'Diego Fernández Ortega',
      iRating: 1290,
      licString: 'D 2.48',
      positionsGained: -4,
      interval: laps(1),
      gapToLeader: laps(2),
      lastLap: null,
      bestLap: 139.88,
      status: 'disconnected',
      iRatingDelta: -47
    }
  ],
  0
)

const LMP2_ROWS = makeRows(
  LMP2,
  [
    {
      carNumber: '29',
      driverName: 'Zoë van der Berg',
      iRating: 3320,
      licString: 'A 2.88',
      lastLap: 127.729,
      lastLapKind: 'class-best',
      bestLap: 127.729
    },
    {
      carNumber: '31',
      driverName: 'Hugo Lefèvre',
      iRating: 2950,
      licString: 'A 3.66',
      interval: s(5.1),
      gapToLeader: s(5.1),
      lastLap: 128.204,
      bestLap: 127.98
    },
    {
      carNumber: '5',
      driverName: 'Sofia Rossi',
      iRating: 2610,
      licString: 'B 4.02',
      interval: s(8.7),
      gapToLeader: s(13.8),
      lastLap: 128.66,
      bestLap: 128.1
    },
    {
      carNumber: '36',
      driverName: 'Liam O’Connor',
      iRating: 2240,
      licString: 'B 2.77',
      interval: s(2.2),
      gapToLeader: s(16),
      lastLap: 129.01,
      bestLap: 128.55
    },
    {
      carNumber: '77',
      driverName: 'Ana Sousa',
      iRating: 1985,
      licString: 'C 3.05',
      interval: laps(1),
      gapToLeader: laps(1),
      lastLap: 130.4,
      bestLap: 129.2
    }
  ],
  20
)

interface PreviewClass {
  block: Omit<StandingsClassBlock, 'rows'>
  rows: readonly StandingsRow[]
}

const CLASSES: readonly PreviewClass[] = [
  {
    block: {
      classId: 1,
      className: 'GT3',
      classColor: GT3,
      sof: 2240,
      carCount: GT3_ROWS.length,
      isPlayerClass: true
    },
    rows: GT3_ROWS
  },
  {
    block: {
      classId: 2,
      className: 'LMP2',
      classColor: LMP2,
      sof: 2690,
      carCount: LMP2_ROWS.length,
      isPlayerClass: false
    },
    rows: LMP2_ROWS
  }
]

const HEADER: Readonly<StandingsHeader> = {
  sessionType: 'Race',
  lapsRemaining: 19,
  timeRemainingS: 2299,
  iRating: {
    iRatingDelta: 13,
    perPosition: 17,
    breakEvenPosition: 6,
    ifGainOne: 31,
    ifLoseOne: -5
  },
  safetyRating: {
    current: 3.27,
    projected: 3.31,
    licClass: 'B',
    projectedLicClass: 'B',
    incidents: PREVIEW_INCIDENTS.mine,
    corners: 112,
    incidentBudget: 2
  },
  // The header option hides it in the view (headerIncidents is display only).
  incidents: PREVIEW_INCIDENTS
}

type DisplayRow = StandingsClassBlock['rows'][number]

/** Compact selection of the player's class: the top rows, then the rows around you. */
function compactRows(rows: readonly StandingsRow[], top: number, around: number): DisplayRow[] {
  const p = rows.findIndex((r) => r.isPlayer)
  const out: DisplayRow[] = []
  let prev = -1
  rows.forEach((row, i) => {
    const near = p >= 0 && Math.abs(i - p) <= around
    if (i >= top && !near) return
    out.push({ ...row, gapBefore: i > prev + 1 })
    prev = i
  })
  return out
}

/** The sample payload for these options (a fresh object: the caller memoises). */
export function previewStandings(o: PreviewOptions): StandingsData {
  const full = o.mode === 'full'
  const top = clampOption(OPTION_SCHEMA.standings.topRows, o.topRows)
  const around = clampOption(OPTION_SCHEMA.standings.aroundRows, o.aroundRows)
  const classes: StandingsClassBlock[] = []
  for (const c of CLASSES) {
    let rows: DisplayRow[]
    if (full) rows = c.rows.map((r) => ({ ...r, gapBefore: false }))
    else if (c.block.isPlayerClass) rows = compactRows(c.rows, top, around)
    else if (o.otherClassLeaders && c.rows[0]) rows = [{ ...c.rows[0], gapBefore: false }]
    else continue
    classes.push({ ...c.block, rows })
  }
  return {
    header: {
      ...HEADER,
      iRating: o.headerIRating ? HEADER.iRating : null,
      safetyRating: o.headerSafetyRating ? HEADER.safetyRating : null
    },
    classes
  }
}
