/**
 * Sample standings for edit mode (ux §4.7): an invented multiclass race with every row state
 * (you at P5, PIT, OUT, a lapped car, class best and personal best laps, off-track, meatball, a
 * warning), stints and stops, tyres known for your car model only, names that exercise every
 * name format, flags for most drivers, and the info bars' data of your class (its SoF, entries
 * and fastest lap, your projections, the conditions). Rows are picked with the same rules as the provider (top rows, rows
 * around you, the first cars of the other classes), so the window is sized on what the current options really
 * show. A field of several makes (the LMP2s are all Dallaras), so the brand marks show in 'auto'
 * mode. Pure.
 */
import { shallowRef } from 'vue'
import type { BrandId } from '@shared/carBrands'
import { orderClasses } from '@shared/classOrder'
import { clampOption, OPTION_SCHEMA } from '@shared/settingsSchema'
import { PREVIEW_INFO } from '@renderer/view/infoBar'
import { PREVIEW_INCIDENTS } from '@renderer/view/incidents'
import type {
  GapValue,
  InfoBarData,
  StandingsClassBlock,
  StandingsData,
  StandingsHeader,
  StandingsOptions,
  StandingsRow
} from '@shared/types'

export type PreviewOptions = Pick<
  StandingsOptions,
  'mode' | 'topRows' | 'aroundRows' | 'otherClassRows' | 'classOrder' | 'classList'
>

/**
 * The field the settings page's sample draws, as the option you changed last needs it (as
 * Delta's previewSession): `deep`, you further down your class (DEEP_POSITION), so the top rows
 * and the rows around you are two blocks and each count shows (the default P5 makes them one);
 * `singleClass`, your class alone, so the SoF and the car count go in the info bars (with
 * several classes they are the class lines'); `threeClasses`, a third class (GTP, the fastest)
 * after the other two, so «Orden de las clases» has an order to show (9: the settings page's
 * sample always has it). Per window: the overlay's edit mode keeps the default.
 */
export interface PreviewField {
  readonly deep: boolean
  readonly singleClass: boolean
  readonly threeClasses: boolean
  /**
   * «A mano»: the list as the settings page shows it (the saved names, then this session's and
   * the sample's), so the sample draws its classes in the list's order before anything is saved.
   * Absent: the saved list.
   */
  readonly classList?: readonly string[]
}
export const PREVIEW_FIELD_DEFAULT: PreviewField = Object.freeze({
  deep: false,
  singleClass: false,
  threeClasses: false
})
export const previewField = shallowRef<PreviewField>(PREVIEW_FIELD_DEFAULT)

/** Your class position in the `deep` field. */
export const DEEP_POSITION = 10

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

/** Laps the leaders have completed: a stint without a stop is this long. */
const RACE_LAPS = 16
/** The GT3s' makes by car number (the LMP2s are Dallaras); a Porsche when not listed. */
const GT3_MAKES: Readonly<Record<string, BrandId>> = {
  '44': 'mercedes-amg',
  '3': 'bmw',
  '12': 'ferrari',
  '19': 'porsche',
  '7': 'mercedes-amg',
  '51': 'lamborghini',
  '9': 'aston-martin',
  '8': 'mclaren',
  '23': 'ford',
  '61': 'audi',
  '88': 'chevrolet',
  '14': 'acura'
}

/** Where the sample drivers race from, by car number (some chose no flag: none drawn). */
const FLAGS: Readonly<Record<string, string>> = {
  '7': 'DE',
  '19': 'FR',
  '12': 'IT',
  '3': 'GB',
  '44': 'SE',
  '61': 'ES',
  '51': 'IT',
  '8': 'GB-SCT',
  '9': 'GLOBAL',
  '23': 'US',
  '88': 'BR',
  '14': 'JP',
  '40': 'NL',
  '66': 'AU',
  '2': 'ES',
  '5': 'BE'
}

/**
 * `tyre`: the compound of a class of your car model, null for another model (no name). The
 * fastest best lap of the class gets its purple plate.
 */
function makeRows(
  classColor: string,
  tyre: string | null,
  seeds: readonly RowSeed[],
  firstIdx: number
): StandingsRow[] {
  const rows = seeds.map((seed, i): StandingsRow => ({
    carIdx: firstIdx + i,
    isPlayer: false,
    classPosition: i + 1,
    positionsGained: 0,
    classColor,
    licColor: LIC[(seed.licString?.[0] ?? 'R') as keyof typeof LIC] ?? null,
    brand: classColor === LMP2 ? 'dallara' : (GT3_MAKES[seed.carNumber] ?? 'porsche'),
    country: FLAGS[seed.carNumber] ?? '',
    interval: null,
    gapToLeader: null,
    lastLap: null,
    lastLapKind: 'normal',
    bestLap: null,
    bestLapKind: 'normal',
    pitStops: 0,
    lastPitLap: null,
    outLap: false,
    towed: false,
    stintLaps: RACE_LAPS,
    tyre,
    status: 'running',
    penalty: null,
    iRatingDelta: null,
    ...seed
  }))
  const best = Math.min(...rows.map((r) => r.bestLap ?? Infinity))
  return rows.map((r) => (r.bestLap === best ? { ...r, bestLapKind: 'class-best' } : r))
}

const GT3 = '#33ceff'
const LMP2 = '#ff5888'

const GT3_ROWS = makeRows(
  GT3,
  'Hard',
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
      // A drive-through to serve.
      penalty: 'black',
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
      // Just out on wets: rain is coming.
      stintLaps: 0,
      tyre: 'Wet',
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
      // Warned for leaving the track.
      penalty: 'furled',
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
      // Another GT3 model: its compound has no name.
      tyre: null,
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
      stintLaps: RACE_LAPS - 1,
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
      stintLaps: RACE_LAPS - 1 - 9,
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
      stintLaps: RACE_LAPS - 1,
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
      stintLaps: RACE_LAPS - 1,
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
      stintLaps: RACE_LAPS - 2,
      status: 'disconnected',
      iRatingDelta: -47
    }
  ],
  0
)

const LMP2_ROWS = makeRows(
  LMP2,
  null,
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

/** The prototypes, all fast: a third class only the settings page's sample draws (9). */
const GTP = '#ffc400'

const GTP_ROWS = makeRows(
  GTP,
  null,
  [
    {
      carNumber: '01',
      driverName: 'Rafael Domínguez',
      iRating: 4120,
      licString: 'A 4.51',
      brand: 'cadillac',
      lastLap: 121.904,
      bestLap: 121.377
    },
    {
      carNumber: '6',
      driverName: 'Nora Halvorsen',
      iRating: 3860,
      licString: 'A 3.92',
      brand: 'porsche',
      interval: s(2.4),
      gapToLeader: s(2.4),
      lastLap: 121.62,
      bestLap: 121.211
    },
    {
      carNumber: '10',
      driverName: 'Theo Marchetti',
      iRating: 3455,
      licString: 'A 2.60',
      brand: 'acura',
      interval: s(6.9),
      gapToLeader: s(9.3),
      lastLap: 122.48,
      bestLap: 121.95
    }
  ],
  40
)

interface PreviewClass {
  block: Omit<StandingsClassBlock, 'rows'>
  rows: readonly StandingsRow[]
  /** iRacing's relative speed of the class (the sample's order by speed: GTP, LMP2, GT3). */
  relSpeed: number
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
    rows: GT3_ROWS,
    relSpeed: 70
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
    rows: LMP2_ROWS,
    relSpeed: 85
  },
  {
    block: {
      classId: 3,
      className: 'GTP',
      classColor: GTP,
      sof: 3810,
      carCount: GTP_ROWS.length,
      isPlayerClass: false
    },
    rows: GTP_ROWS,
    relSpeed: 100
  }
]

/** The third class: only in the `threeClasses` field. */
const THIRD_CLASS = 3

/** The sample's classes as the table draws them («Orden de las clases»), in `field`. */
export function previewClassOrder(
  o: Pick<PreviewOptions, 'classOrder' | 'classList'>,
  field: PreviewField = PREVIEW_FIELD_DEFAULT
): readonly PreviewClass[] {
  const shown = CLASSES.filter(
    (c) =>
      (field.threeClasses || c.block.classId !== THIRD_CLASS) &&
      !(field.singleClass && !c.block.isPlayerClass)
  ).map((c) => ({ c, classId: c.block.classId, name: c.block.className, relSpeed: c.relSpeed }))
  const player = shown.find((x) => x.c.block.isPlayerClass)
  return orderClasses(shown, player, o.classOrder, field.classList ?? o.classList).map((x) => x.c)
}

/** The short names of the sample's classes, the fastest first (the class order's list has them). */
export const PREVIEW_CLASS_NAMES: readonly string[] = [...CLASSES]
  .sort((a, b) => b.relSpeed - a.relSpeed)
  .map((c) => c.block.className)

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
  // The header list hides it in the view (its 'incidents' is display only).
  incidents: PREVIEW_INCIDENTS
}

/** Your class's fastest lap (the row with the purple plate), for the info bars' item. */
function fastestOf(rows: readonly StandingsRow[]): InfoBarData['fastestLap'] {
  const r = rows.find((x) => x.bestLapKind === 'class-best')
  if (r === undefined || r.bestLap === null) return null
  return {
    lapTime: r.bestLap,
    carIdx: r.carIdx,
    carNumber: r.carNumber,
    driverName: r.driverName,
    isPlayer: r.isPlayer
  }
}

/**
 * The info bars' data: the shared sample (time left, the conditions), with the standings' own
 * figures so the bars and the table agree: your class's SoF, entries and fastest lap, your
 * position, the header's projections.
 */
const INFO: Readonly<InfoBarData> = Object.freeze({
  ...PREVIEW_INFO,
  sessionType: HEADER.sessionType,
  lapsRemaining: HEADER.lapsRemaining,
  timeRemainingS: HEADER.timeRemainingS,
  sof: CLASSES[0]?.block.sof ?? null,
  carCount: CLASSES[0]?.block.carCount ?? null,
  incidents: HEADER.incidents,
  iRating: HEADER.iRating,
  classPosition: GT3_ROWS.find((r) => r.isPlayer)?.classPosition ?? null,
  safetyRating: HEADER.safetyRating,
  fastestLap: fastestOf(GT3_ROWS)
})

type DisplayRow = StandingsClassBlock['rows'][number]

/**
 * Your class with you at `at` (1-based): the drivers in the same order, you moved there; each
 * place keeps its gaps (the table still reads leader to last), each driver the rest of his row.
 */
function withPlayerAt(rows: readonly StandingsRow[], at: number): StandingsRow[] {
  const player = rows.find((r) => r.isPlayer)
  if (player === undefined) return [...rows]
  const order = rows.filter((r) => r !== player)
  order.splice(Math.min(Math.max(at - 1, 0), order.length), 0, player)
  return order.map((r, i) => ({
    ...r,
    classPosition: i + 1,
    interval: rows[i]?.interval ?? null,
    gapToLeader: rows[i]?.gapToLeader ?? null
  }))
}

const GT3_DEEP = withPlayerAt(GT3_ROWS, DEEP_POSITION)
const INFO_DEEP: Readonly<InfoBarData> = Object.freeze({ ...INFO, classPosition: DEEP_POSITION })

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

/**
 * The sample payload for these options (a fresh object: the caller memoises), in the default
 * field or the one `field` asks for (previewField).
 */
export function previewStandings(
  o: PreviewOptions,
  field: PreviewField = PREVIEW_FIELD_DEFAULT
): StandingsData {
  const full = o.mode === 'full'
  const top = clampOption(OPTION_SCHEMA.standings.topRows, o.topRows)
  const around = clampOption(OPTION_SCHEMA.standings.aroundRows, o.aroundRows)
  const others = clampOption(OPTION_SCHEMA.standings.otherClassRows, o.otherClassRows)
  const classes: StandingsClassBlock[] = []
  for (const c of previewClassOrder(o, field)) {
    const all = field.deep && c.block.isPlayerClass ? GT3_DEEP : c.rows
    let rows: DisplayRow[]
    if (full) rows = all.map((r) => ({ ...r, gapBefore: false }))
    else if (c.block.isPlayerClass) rows = compactRows(all, top, around)
    else if (others > 0 && c.rows[0])
      rows = c.rows.slice(0, others).map((r) => ({ ...r, gapBefore: false }))
    else continue
    classes.push({ ...c.block, rows })
  }
  return {
    header: HEADER,
    classes,
    info: field.deep ? INFO_DEEP : INFO,
    multiBrand: true
  }
}
