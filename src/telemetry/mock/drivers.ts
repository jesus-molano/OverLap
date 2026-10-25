/**
 * Static roster of the mock race. CarIdx 0 is the pace car, 1-12 GT3, 13-20
 * LMP2 and 63 a spectator (sparse, like the real DriverInfo.Drivers). All
 * names are fictional. Later sessions seat the same drivers in other CarIdx
 * (rosterForSession), as iRacing assigns them per subsession; UserID stays.
 */

export interface MockCarClass {
  readonly id: number
  readonly shortName: string
  /** 0xRRGGBB, as js-yaml parses CarClassColor. */
  readonly color: number
  /** CarClassEstLapTime in seconds on the 7 km mock track. */
  readonly estLapTimeS: number
  /** CarClassRelSpeed: bigger = faster class. */
  readonly relSpeed: number
  /** DriverInfo CarID (car model; one model per mock class), 0 when there is no car. */
  readonly carId: number
}

export const MOCK_CLASSES = {
  GT3: { id: 4029, shortName: 'GT3', color: 0xffda59, estLapTimeS: 138, relSpeed: 54, carId: 67 },
  LMP2: {
    id: 2523,
    shortName: 'LMP2',
    color: 0x33ceff,
    estLapTimeS: 126,
    relSpeed: 72,
    carId: 128
  },
  /** Real sessions report colour 0 for the pace car class. */
  PACE: { id: 11, shortName: '', color: 0, estLapTimeS: 160, relSpeed: 0, carId: 30 },
  /** Spectators have no car. */
  NONE: { id: 0, shortName: '', color: 0xffffff, estLapTimeS: 0, relSpeed: 0, carId: 0 }
} as const satisfies Record<string, MockCarClass>

export type MockClassKey = keyof typeof MOCK_CLASSES

export interface MockDriver {
  readonly carIdx: number
  /** DriverInfo UserID: stable per person across sessions (-1 for the pace car). */
  readonly userId: number
  readonly userName: string
  /** Derived as "Surname, F" when omitted. */
  readonly abbrevName?: string
  readonly carNumber: string
  readonly classKey: MockClassKey
  readonly carScreenNameShort: string
  readonly iRating: number
  readonly licString: string
  readonly isPaceCar?: boolean
  readonly isSpectator?: boolean
}

export const MOCK_PACE_CAR_IDX = 0
export const MOCK_SPECTATOR_CAR_IDX = 63
export const DEFAULT_PLAYER_CAR_IDX = 7

/** LicColor by licence letter, numbers as js-yaml parses them. */
const LIC_COLORS: Readonly<Record<string, number>> = {
  R: 0xfc0706,
  D: 0xfc8a27,
  C: 0xfeec04,
  B: 0x00c702,
  A: 0x0153db,
  P: 0x000000
}

export function licColorOf(licString: string): number {
  return LIC_COLORS[licString.charAt(0)] ?? 0xffffff
}

const LIC_CLASSES = 'RDCBAP'

function srOf(licString: string): number {
  const sr = Number.parseFloat(licString.slice(1))
  return Number.isFinite(sr) ? sr : 0
}

/**
 * DriverInfo LicLevel (1..24) for a licence string: 4 levels per class (R, D,
 * C, B, A, P), one per whole SR band 1..4 (an SR below 1 still counts as band 1).
 */
export function licLevelOf(licString: string): number {
  const letter = licString.charAt(0)
  const cls = letter === '' ? -1 : LIC_CLASSES.indexOf(letter)
  if (cls < 0) return 0
  const band = Math.min(4, Math.max(1, Math.floor(srOf(licString))))
  return cls * 4 + band
}

/** DriverInfo LicSubLevel: SR x 100 ('B 3.27' -> 327). */
export function licSubLevelOf(licString: string): number {
  return Math.round(srOf(licString) * 100)
}

/** UserID of the driver first seated at `carIdx`. */
function userIdFor(carIdx: number): number {
  return 300000 + carIdx * 1371
}

export const MOCK_DRIVERS: readonly MockDriver[] = [
  {
    carIdx: MOCK_PACE_CAR_IDX,
    userId: -1,
    userName: 'Pace Car',
    abbrevName: '',
    carNumber: '0',
    classKey: 'PACE',
    carScreenNameShort: 'Safety Car',
    iRating: 0,
    licString: 'R 0.01',
    isPaceCar: true
  },
  // GT3
  gt3(1, 'Martín Echeverría', '12', 'Ferrari 296 GT3', 3120, 'A 3.41'),
  gt3(2, 'Lukas Brandt', '3', 'BMW M4 GT3', 1980, 'B 2.10'),
  gt3(3, 'Sofía Quintana', '27', 'Porsche 911 GT3 R', 1450, 'C 4.02'),
  gt3(4, 'Jonas Lindqvist', '44', 'Mercedes-AMG GT3', 2650, 'A 2.75'),
  gt3(5, 'Kenji Watanabe', '8', 'Audi R8 LMS GT3', 2210, 'B 3.88'),
  gt3(6, 'Pierre-Étienne Duvalier', '19', 'McLaren 720S GT3', 3480, 'A 4.12'),
  gt3(7, 'Alejandro Ruiz', '07', 'Porsche 911 GT3 R', 2380, 'B 3.27'),
  gt3(8, 'Matteo Bianchi', '51', 'Ferrari 296 GT3', 2470, 'A 1.85'),
  gt3(9, 'Ólafur Gunnarsson', '66', 'BMW M4 GT3', 980, 'D 1.50'),
  gt3(
    10,
    'Hiroshi Nakamura-Fitzgerald Montenegro',
    '113',
    'Lamborghini Huracán GT3',
    1620,
    'C 2.33'
  ),
  gt3(11, 'Chloé Martineau', '9', 'Mercedes-AMG GT3', 1120, 'R 2.00'),
  gt3(12, 'Diego Fernández', '31', 'Audi R8 LMS GT3', 1840, 'C 3.10'),
  // LMP2
  lmp2(13, 'Anders Kjærgaard', '22', 5200, 'P 4.99'),
  lmp2(14, 'Rafael Ibáñez', '38', 4310, 'A 4.60'),
  lmp2(15, 'Noah Whitfield', '5', 3870, 'A 3.95'),
  lmp2(16, 'Zoë van der Berg', '29', 3340, 'A 2.80'),
  lmp2(17, 'Tomasz Wiśniewski', '41', 2780, 'B 3.15'),
  lmp2(18, 'Gabriel Antunes', '10', 2950, 'A 1.92'),
  lmp2(19, 'Élodie Rousseau', '83', 2490, 'B 4.40'),
  lmp2(20, 'Mikael Saarinen', '2', 4720, 'P 3.70'),
  {
    carIdx: MOCK_SPECTATOR_CAR_IDX,
    userId: userIdFor(MOCK_SPECTATOR_CAR_IDX),
    userName: 'Valentina Correa',
    carNumber: '',
    classKey: 'NONE',
    carScreenNameShort: '',
    iRating: 1385,
    licString: 'D 2.30',
    isSpectator: true
  }
]

function gt3(
  carIdx: number,
  userName: string,
  carNumber: string,
  carScreenNameShort: string,
  iRating: number,
  licString: string
): MockDriver {
  return {
    carIdx,
    userId: userIdFor(carIdx),
    userName,
    carNumber,
    classKey: 'GT3',
    carScreenNameShort,
    iRating,
    licString
  }
}

function lmp2(
  carIdx: number,
  userName: string,
  carNumber: string,
  iRating: number,
  licString: string
): MockDriver {
  return {
    carIdx,
    userId: userIdFor(carIdx),
    userName,
    carNumber,
    classKey: 'LMP2',
    carScreenNameShort: 'Dallara P217',
    iRating,
    licString
  }
}

export function isRaceDriver(d: MockDriver): boolean {
  return !d.isPaceCar && !d.isSpectator
}

/** CarIdx of the driver with `userId` in `roster`, undefined when absent. */
export function seatOf(roster: readonly MockDriver[], userId: number): number | undefined {
  return roster.find((d) => d.userId === userId)?.carIdx
}

/** Race cars' CarIdx, ascending. */
const RACE_SLOTS = MOCK_DRIVERS.filter(isRaceDriver)
  .map((d) => d.carIdx)
  .sort((a, b) => a - b)
/** Seats move this many race slots per session (coprime with the 20 slots: every seat changes). */
const SEAT_SHIFT = 7

/**
 * Roster of session `n` (0 = MOCK_DRIVERS): the race cars' CarIdx rotate by
 * SEAT_SHIFT slots per session; pace car and spectator keep theirs. Sorted by
 * CarIdx, like DriverInfo.Drivers.
 */
export function rosterForSession(n: number): readonly MockDriver[] {
  const count = RACE_SLOTS.length
  const shift = (((Math.trunc(n) * SEAT_SHIFT) % count) + count) % count
  if (shift === 0) return MOCK_DRIVERS
  return MOCK_DRIVERS.map((d) => {
    const k = RACE_SLOTS.indexOf(d.carIdx)
    const carIdx = k < 0 ? undefined : RACE_SLOTS[(k + shift) % count]
    return carIdx === undefined ? d : { ...d, carIdx }
  }).sort((a, b) => a.carIdx - b.carIdx)
}
