/** Texts of the widgets themselves (headers, labels, empty states, previews). */
import type { Dict } from '../dict'

/**
 * Between two parts of one reading ('38:19  ≈19 v'): an en space, no separator glyph (the
 * standings' META_SEP).
 */
const SEP = '\u2002'
/** No-break space between a number and its unit (shared/format.ts NBSP). */
const NB = ' '

export const widgetsEs = {
  /** Shared by every widget. */
  common: {
    /** Edit-mode tag on sample content (ui/PreviewTag.vue). */
    preview: 'VISTA PREVIA',
    /** Pill while the data is simulated (ui/SimPill.vue) and its tooltip. */
    sim: 'SIM',
    simTitle: 'Datos simulados',
    /** Badges: in the pits, on an out lap. */
    pit: 'PIT',
    out: 'OUT',
    /** Sector chip ('S2') and the one placeholder chip while the sectors are unknown. */
    sector: (n: number) => `S${n}`,
    sectors: 'Sectores',
    /**
     * A driver whose name the session info lost (all '?': not in Windows-1252), by car number
     * ('Piloto #7'); just 'Piloto' without one.
     */
    unknownDriver: (car: string) => (car === '' ? 'Piloto' : `Piloto #${car}`)
  },
  /** Session captions from SessionType (headers of the relative and the standings). */
  session: {
    race: 'CARRERA',
    qualify: 'CLASIF.',
    practice: 'PRÁCTICA',
    warmup: 'WARMUP',
    testing: 'PRUEBAS'
  },
  /** Lap counts (shared/format.ts). */
  laps: {
    /** '~6 v': about n laps. */
    about: (n: number) => `~${n}${NB}v`,
    /** Under a lap. */
    underOne: `<${NB}1${NB}v`,
    /** A timed session with its estimated laps: '38:19  ≈19 v'. */
    timed: (clock: string, laps: number) => `${clock}${SEP}≈${laps}${NB}v`,
    /** Laps left in a session by laps. */
    left: (n: number) => (n === 1 ? `Queda 1${NB}v` : `Quedan ${n}${NB}v`)
  },
  standings: {
    /** The 'gap' column of the class leader. */
    leader: 'LÍDER',
    /** Instead of what is left once the chequered flag is out. */
    finished: 'Final',
    sof: (sof: string) => `SoF ${sof}`,
    cars: (n: number) => (n === 1 ? '1 coche' : `${n} coches`),
    /** A class the session info gives no name, by its id. */
    unnamedClass: (id: number) => `Clase ${id}`,
    /** Session best lap outside races, with the car number when known ('Mejor 2:07.579  #29'). */
    best: (time: string) => `Mejor ${time}`,
    bestBy: (time: string, car: string) => `Mejor ${time}${SEP}${car}`,
    irKey: 'iR',
    srKey: 'SR',
    /** iRating per position gained or lost. */
    perPosition: (n: number) => `±${n}/pos`,
    /** Finishing position where your iRating does not move. */
    breakEven: (pos: number) => `neutro P${pos}`,
    incidents: (n: number) => `${n}x`,
    /** Incidents left before the SR goes down. */
    budget: (n: number) => `margen ${n}x`,
    noBudget: 'sin margen',
    budgetUnknown: 'margen —'
  },
  battle: {
    ahead: 'DELANTE',
    behind: 'DETRÁS',
    /** Trend notes: good is in your favour on both sides. */
    aheadGood: 'le recortas',
    aheadBad: 'se escapa',
    behindGood: 'te escapas',
    behindBad: 'te alcanza',
    measuring: 'midiendo…',
    steady: 'estable',
    /** A pace in seconds per lap ('+0.15 s/v'). */
    perLap: (v: string) => `${v}${NB}s/v`,
    /** Laps left of the race, after a prediction. */
    ofLaps: (n: number) => `de${NB}${n}`,
    /** You catch the car ahead before the end ('~4 v'). */
    catchIn: (laps: string) => `Le alcanzas en ${laps}`,
    /** The car behind catches you before the end. */
    caughtIn: (laps: string) => `Te alcanza en ${laps}`,
    /** Closing, but not before the end. */
    noCatch: 'No le alcanzas',
    noCaught: 'No te alcanza',
    /** The pace you need to catch the car ahead. */
    need: (pace: string) => `Necesitas ${pace}`,
    /** How long it would take at the current pace. */
    atThisPace: (laps: string) => `a este ritmo ${laps}`,
    lastLap: 'Última vuelta',
    /** Lap delta chips: V-1 is the last lap. */
    lapChip: (n: number) => `V-${n}`,
    /** The last lap's delta, at the end of the sector chips. */
    lastChip: 'Últ',
    /** After the iRating at stake ('±17 iR'). */
    stake: 'iR'
  },
  traffic: {
    /** Group captions, top to bottom. */
    hazard: 'PELIGRO',
    slower: 'DELANTE',
    faster: 'POR DETRÁS',
    /** Hazard badges (Badge upper-cases them). */
    stopped: 'Parado',
    slow: 'Lento',
    offTrack: 'Fuera',
    /** A hazard of unknown kind. */
    hazardUnknown: 'Peligro',
    /** A faster car a lap up on you / a slower car a lap down. */
    lapping: 'Te dobla',
    lapped: 'Doblado',
    /** Words before the number: when you meet, or how far ('a 3.2 s'). */
    reachesYou: 'te alcanza en',
    youReach: 'le alcanzas en',
    at: 'a'
  },
  alerts: {
    /**
     * Per flag: the pill label, a shorter one for narrow windows ('' when the label fits 13
     * characters), what to do after it ('' when the label says it all) and the chip text of a
     * secondary flag ('' = the label).
     */
    flags: {
      disqualified: { label: 'DESCALIFICADO', short: '', note: '', chip: '' },
      black: { label: 'BANDERA NEGRA', short: '', note: 'entra en boxes', chip: 'NEGRA' },
      meatball: { label: 'REPARACIÓN', short: '', note: 'entra en boxes', chip: '' },
      red: { label: 'BANDERA ROJA', short: '', note: 'sesión detenida', chip: 'ROJA' },
      // Passing under a full-course caution is penalised.
      caution: { label: 'SAFETY CAR', short: '', note: 'no adelantes', chip: '' },
      yellow: { label: 'AMARILLA', short: '', note: 'precaución', chip: '' },
      debris: { label: 'RESTOS', short: '', note: 'en pista', chip: '' },
      blue: { label: 'AZUL', short: '', note: 'déjale pasar', chip: '' },
      white: { label: 'ÚLTIMA VUELTA', short: '', note: '', chip: '' },
      checkered: {
        label: 'BANDERA A CUADROS',
        short: 'A CUADROS',
        note: '',
        chip: 'A CUADROS'
      },
      green: { label: 'VERDE', short: '', note: 'pista libre', chip: '' }
    },
    /** The pit limiter line. */
    limiterOn: 'LIMITADOR',
    limiterOff: 'LIMITADOR OFF',
    speeding: 'EXCESO'
  },
  inputs: {
    /** Pedal bar keys. */
    clutch: 'E',
    brake: 'F',
    throttle: 'A',
    abs: 'ABS'
  },
  delta: {
    gaining: 'ganando',
    losing: 'perdiendo',
    invalid: 'vuelta inválida',
    /** Before the predicted lap time. */
    predicted: 'Prev.',
    /** The reference the delta is against. */
    pb: 'Récord personal',
    session: 'Mejor vuelta',
    /** Your best sectors of the session, joined. */
    optimal: 'Vuelta óptima',
    /** The class best is your own lap. */
    self: 'Tú',
    /** The class best of a driver not in the session info any more. */
    classBest: 'Mejor de la clase',
    /** The best sectors of your class, joined (nobody's lap). */
    classOptimal: 'Óptima de la clase'
  }
} as const

export const widgetsEn: Dict<typeof widgetsEs> = {
  common: {
    preview: 'PREVIEW',
    sim: 'SIM',
    simTitle: 'Simulated data',
    pit: 'PIT',
    out: 'OUT',
    sector: (n) => `S${n}`,
    sectors: 'Sectors',
    unknownDriver: (car) => (car === '' ? 'Driver' : `Driver #${car}`)
  },
  session: {
    race: 'RACE',
    qualify: 'QUALIFY',
    practice: 'PRACTICE',
    warmup: 'WARMUP',
    testing: 'TESTING'
  },
  laps: {
    about: (n) => `~${n}${NB}L`,
    underOne: `<${NB}1${NB}L`,
    timed: (clock, laps) => `${clock}${SEP}≈${laps}${NB}L`,
    left: (n) => (n === 1 ? `1${NB}lap left` : `${n}${NB}laps left`)
  },
  standings: {
    leader: 'LEADER',
    finished: 'Finished',
    sof: (sof) => `SoF ${sof}`,
    cars: (n) => (n === 1 ? '1 car' : `${n} cars`),
    unnamedClass: (id) => `Class ${id}`,
    best: (time) => `Best ${time}`,
    bestBy: (time, car) => `Best ${time}${SEP}${car}`,
    irKey: 'iR',
    srKey: 'SR',
    perPosition: (n) => `±${n}/pos`,
    breakEven: (pos) => `break-even P${pos}`,
    incidents: (n) => `${n}x`,
    budget: (n) => `margin ${n}x`,
    noBudget: 'no margin',
    budgetUnknown: 'margin —'
  },
  battle: {
    ahead: 'AHEAD',
    behind: 'BEHIND',
    aheadGood: 'closing in',
    aheadBad: 'losing ground',
    behindGood: 'pulling away',
    behindBad: 'catching you',
    measuring: 'measuring…',
    steady: 'steady',
    perLap: (v) => `${v}${NB}s/lap`,
    ofLaps: (n) => `of${NB}${n}`,
    catchIn: (laps) => `Catching in ${laps}`,
    caughtIn: (laps) => `Catches you in ${laps}`,
    noCatch: 'Out of reach',
    noCaught: 'Safe to the flag',
    need: (pace) => `Need ${pace}`,
    atThisPace: (laps) => `at this pace ${laps}`,
    lastLap: 'Last lap',
    lapChip: (n) => `L-${n}`,
    lastChip: 'Last',
    stake: 'iR'
  },
  traffic: {
    hazard: 'HAZARD',
    slower: 'AHEAD',
    faster: 'BEHIND',
    stopped: 'Stopped',
    slow: 'Slow',
    offTrack: 'Off track',
    hazardUnknown: 'Hazard',
    lapping: 'Lapping',
    lapped: 'Lapped',
    reachesYou: 'catches you in',
    youReach: 'you catch it in',
    at: 'at'
  },
  alerts: {
    flags: {
      disqualified: { label: 'DISQUALIFIED', short: '', note: '', chip: '' },
      black: { label: 'BLACK FLAG', short: '', note: 'pit now', chip: 'BLACK' },
      meatball: { label: 'MEATBALL', short: '', note: 'pit for repairs', chip: '' },
      red: { label: 'RED FLAG', short: '', note: 'session stopped', chip: 'RED' },
      // iRacing's own name for a full-course yellow.
      caution: { label: 'CAUTION', short: '', note: 'no overtaking', chip: '' },
      yellow: { label: 'YELLOW FLAG', short: '', note: 'hazard ahead', chip: 'YELLOW' },
      debris: { label: 'DEBRIS', short: '', note: 'on track', chip: '' },
      blue: { label: 'BLUE FLAG', short: '', note: 'let them pass', chip: 'BLUE' },
      white: { label: 'LAST LAP', short: '', note: '', chip: '' },
      checkered: { label: 'CHECKERED FLAG', short: 'CHECKERED', note: '', chip: 'CHECKERED' },
      green: { label: 'GREEN FLAG', short: '', note: 'track clear', chip: 'GREEN' }
    },
    limiterOn: 'PIT LIMITER',
    limiterOff: 'LIMITER OFF',
    speeding: 'SPEEDING'
  },
  inputs: {
    clutch: 'C',
    brake: 'B',
    throttle: 'T',
    abs: 'ABS'
  },
  delta: {
    gaining: 'gaining',
    losing: 'losing',
    invalid: 'invalid lap',
    predicted: 'Pred.',
    pb: 'Personal best',
    session: 'Session best',
    optimal: 'Optimal lap',
    self: 'You',
    classBest: 'Class best',
    classOptimal: 'Class optimal'
  }
}
