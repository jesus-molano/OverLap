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
    /** Badges: in the pits, towed to its box, on an out lap. */
    pit: 'PIT',
    tow: 'GRÚA',
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
    left: (n: number) => (n === 1 ? `Queda 1${NB}v` : `Quedan ${n}${NB}v`),
    /** After a count drawn on its own ('7' + 'v': a stint of 7 laps). */
    unit: 'v',
    /** Lap number n, as in the battle's lap chips: 'V12' (a stop on lap 12). */
    number: (n: number) => `V${n}`
  },
  /** Your incidents: the count in the relative and standings headers, the alerts' line. */
  incidents: {
    /** Your count: '3x'. */
    count: (n: number) => `${n}x`,
    /** The team's, in team races: 'eq. 7x'. */
    team: (n: number) => `eq.${NB}${n}x`,
    /** The session's next limit. */
    penaltyAt: (n: number) => `pen.${NB}a${NB}${n}x`,
    dqAt: (n: number) => `DQ${NB}a${NB}${n}x`,
    /** The points an incident added: '+2x'. */
    added: (n: number) => `+${n}x`,
    /** The lap it happened on ('V5'; the sector is common.sector). */
    lap: (n: number) => `V${n}`,
    /** What PlayerIncidents reported (iRacing's own points: 2x, 1x, 0x, 2x, 0x, 4x). */
    kinds: {
      'loss-of-control': 'Pérdida de control',
      'off-track': 'Salida de pista',
      'contact-world': 'Roce con el muro',
      'collision-world': 'Golpe contra el muro',
      'contact-car': 'Roce con un coche',
      'collision-car': 'Choque con un coche'
    },
    /** Where the car was off the asphalt, after the rest (lower case). */
    surfaces: {
      kerb: 'piano',
      grass: 'hierba',
      dirt: 'tierra',
      sand: 'arena',
      gravel: 'grava',
      astroturf: 'césped artificial'
    }
  },
  standings: {
    /** The 'gap' column of the class leader. */
    leader: 'LÍDER',
    /** Instead of what is left once you have taken the chequered flag. */
    finished: 'Final',
    /** Instead of what is left on the last lap (the flag is out, you have not crossed yet). */
    lastLap: 'Última vuelta',
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
    budgetUnknown: 'margen —',
    /** The fastest lap of the class: the row's tag (a stopwatch's word) and its full name. */
    fastestTag: 'VR',
    fastestName: 'Vuelta rápida de la clase'
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
      // The furled black flag: what race control warns about is not in the data, who does is.
      furled: { label: 'ADVERTENCIA', short: '', note: 'dirección de carrera', chip: '' },
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
    /** The alerts that are not flags, with the same four texts. */
    notices: {
      wrongWay: {
        label: 'SENTIDO CONTRARIO',
        short: 'CONTRAMANO',
        note: 'da la vuelta',
        chip: 'CONTRAMANO'
      },
      // Heading for the pit entry with the limiter off: the action, so it never reads like the
      // limiter-on line ('LIMITADOR'), not even as a chip or without its note.
      pitEntry: { label: 'PON LIMITADOR', short: '', note: 'entrada a boxes', chip: '' },
      stalled: { label: 'CALADO', short: '', note: 'arranca el motor', chip: '' },
      oilPressure: { label: 'PRESIÓN ACEITE', short: 'P. ACEITE', note: 'baja', chip: 'P. ACEITE' },
      // The pit window closes on this lap: stop at the end of it or run dry.
      boxThisLap: {
        label: 'ENTRA ESTA VUELTA',
        short: 'BOX ESTA V.',
        note: 'se cierra la ventana',
        chip: 'BOX ESTA V.'
      }
    },
    /**
     * The tow countdown ('GRÚA 0:42'). The car already sits in its box while it runs: the note
     * says what it counts down to.
     */
    tow: (clock: string) => `GRÚA${NB}${clock}`,
    towNote: 'hasta poder salir',
    /**
     * Mandatory repairs pending (the band and its note; the chip is the band): pit for them
     * before racing on (the meatball follows). Optional ones are the warning lights' alone.
     */
    damage: { label: 'DAÑO', note: 'reparación obligatoria en boxes' },
    /** Under two laps of fuel: 'COMBUSTIBLE · 1.6 V' (`laps` written with its decimal). */
    fuelLow: (laps: string) => `COMBUSTIBLE${NB}·${NB}${laps}${NB}V`,
    /** Narrow windows and the chip. */
    fuelLowShort: (laps: string) => `COMB.${NB}${laps}${NB}V`,
    fuelLowNote: 'para a repostar',
    /** Laps to the end of the race ('QUEDAN 5 V', like the headers): it says "to go" as a chip. */
    lapsToGo: (n: number) => `QUEDAN${NB}${n}${NB}V`,
    lapsToGoNote: 'para el final',
    /** The pit limiter line. */
    limiterOn: 'LIMITADOR',
    limiterOff: 'LIMITADOR OFF',
    speeding: 'EXCESO'
  },
  lights: {
    /**
     * The short word after each icon (lights.showCaptions), drawn as written. 'P.' and 'T.' tell
     * the two oil lights apart.
     */
    captions: {
      oilPressure: 'P. ACEITE',
      fuelPressure: 'GASOLINA',
      stalled: 'CALADO',
      repair: 'REPARAR',
      repairOptional: 'OPC.',
      water: 'AGUA',
      oilTemp: 'T. ACEITE',
      pitLimiter: 'LIMITADOR',
      revLimiter: 'CORTE'
    },
    /** Each light's name (its accessible name, the settings toggles and the legend). */
    names: {
      oilPressure: 'Presión de aceite',
      fuelPressure: 'Presión de gasolina',
      stalled: 'Motor calado',
      repair: 'Reparación obligatoria',
      repairOptional: 'Reparación opcional',
      water: 'Temperatura del agua',
      oilTemp: 'Temperatura del aceite',
      pitLimiter: 'Limitador de boxes',
      revLimiter: 'Corte de revoluciones'
    },
    /** How long the repairs take: '42 s' ('REPARAR · 42 s'). */
    seconds: (s: number) => `${s}${NB}s`,
    /** The trend while you spent most of it close behind another car (with the captions). */
    draft: '¿rebufo?',
    /** After the name, for the accessible name: off, lit, above your own average. */
    states: { off: 'apagado', on: 'encendido', trend: 'por encima de tu media' }
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
    /** The lap from the pit exit (it never counts). */
    outLap: 'vuelta de salida',
    /** Being towed to the pits. */
    tow: 'grúa',
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
    classOptimal: 'Óptima de la clase',
    /** The lap times line (delta.laps): short captions before each time. */
    laps: { last: 'Últ.', best: 'Mejor', optimal: 'Ópt.', pb: 'Récord' },
    /** The tag on the time the delta compares against (with an accent underline). */
    refMark: 'Δ',
    /** Its accessible name. */
    refMarkName: 'referencia del delta',
    /** For a moment after another reference is chosen: 'Vuelta óptima desde la próxima vuelta'. */
    nextLap: (reference: string) => `${reference} desde la próxima vuelta`,
    /** The tag after the reference while the cycle shortcut's choice is in force (this session only). */
    temporary: 'temporal',
    /** The cycle shortcut's choice in the brief label: 'Vuelta óptima (temporal)'. */
    temporaryRef: (reference: string) => `${reference} (temporal)`
  },
  /** The conditions footer of the relative and the standings. */
  conditions: {
    /** Captions before each reading (drawn in caps). */
    track: 'Pista',
    air: 'Aire',
    /** Only without the dial (no direction, or it is off): the dial says it is the wind. */
    wind: 'Viento',
    rain: 'Lluvia',
    rubber: 'Goma',
    /** The wetness meter's caption, where a narrow table drops its word. */
    water: 'Agua',
    /** irsdk_TrackWetness 1..7 (the asphalt: masculine). */
    wetness: [
      'Seco',
      'Casi seco',
      'Algo húmedo',
      'Poco mojado',
      'Mojado',
      'Muy mojado',
      'Encharcado'
    ],
    /** SessionTrackRubberState (the rubber: feminine); anything else is shown as iRacing writes it. */
    rubberStates: {
      clean: 'Limpia',
      low: 'Poca',
      moderateLow: 'Media-baja',
      moderate: 'Moderada',
      moderateHigh: 'Media-alta',
      high: 'Alta',
      carryOver: 'Heredada'
    },
    /** A 'carry over' resolved to an earlier session's state: 'Media-alta (heredada)'. */
    carried: (state: string) => `${state} (heredada)`,
    /** The stewards allow rain tyres (WeatherDeclaredWet): a plate. */
    declaredWet: 'DECLARADA MOJADA'
  },
  fuel: {
    /** After a number of laps ('12.9 v'). */
    laps: 'v',
    /** After litres per lap ('2.96 L/v'). */
    perLap: 'L/v',
    /** No clean lap measured yet. */
    measuring: 'midiendo…',
    /** Captions before each reading (drawn in caps). */
    left: 'Quedan',
    use: 'Consumo',
    need: 'Para meta',
    add: 'Repostar',
    spare: 'Sobran',
    /** On the last lap, the litres the fuel falls short of the flag (no stop is left). */
    short: 'Faltan',
    window: 'Ventana',
    save: 'Ahorro',
    tyres: 'Neum.',
    /** What is left of the session's fast repairs and tyre sets (iRacing's limits). */
    repairs: 'Rep. rápidas',
    sets: 'Juegos neum.',
    /** After the average ('últ. 3.02 · máx. 3.10'). */
    last: (v: string) => `últ.${NB}${v}`,
    max: (v: string) => `máx.${NB}${v}`,
    /** The average comes from the last session with this car and track. */
    carried: 'de la sesión anterior',
    /** The next stop fills the tank. */
    fill: 'LLENO',
    /** What the pit menu adds ('menú 20 L', like the option 'Menú de boxes'). */
    box: (litres: string) => `menú${NB}${litres}${NB}L`,
    /** The pit window: 'V24–V28', or 'V24' when it is one lap. */
    window1: (lap: number) => `V${lap}`,
    windowN: (from: number, to: number) => `V${from}–V${to}`,
    /** The stops still needed. */
    stops: (n: number) => (n === 1 ? '1 parada' : `${n} paradas`),
    noStop: 'sin parar',
    /** What saving that much gets you: one stop less. */
    saveFor: (n: number) => (n === 1 ? 'con 1 parada' : `con ${n} paradas`),
    /** The lap of the tyre reading ('V13'). */
    readingLap: (lap: number) => `V${lap}`,
    /** Front left, front right, rear left, rear right. */
    corners: ['DI', 'DD', 'TI', 'TD']
  },
  /**
   * Column headers of the relative and the standings (renderer view/columnHeads.ts): caps,
   * short enough for their column. 'interval' / 'leader' / 'toBest' follow the gap mode and the
   * session (outside races the gap is to the fastest lap).
   */
  heads: {
    pos: 'POS',
    driver: 'PILOTO',
    gained: '±',
    ir: 'iR',
    sr: 'SR',
    lic: 'LIC.',
    delta: 'ΔiR',
    interval: 'INT.',
    leader: 'LÍDER',
    toBest: 'DIF.',
    gap: 'DIF.',
    last: 'ÚLTIMA',
    best: 'MEJOR',
    pit: 'BOX',
    pitLap: 'PARADA',
    stint: 'STINT',
    tyre: 'NEUM.'
  },
  /** The info bars' own words (ui/InfoBar.vue); the rest come from the groups above. */
  info: {
    /** The fastest lap of your class: 'VR #9 1:01.234'. */
    fastestTag: 'VR',
    fastestLap: (car: string, time: string) => (car === '' ? time : `${car}${NB}${time}`),
    /** Laps of fuel: 'COMB. 6.4 v'. */
    fuel: 'Comb.',
    fuelLaps: (laps: string) => `${laps}${NB}v`,
    /** The local clock's accessible name. */
    clock: 'Hora local'
  },
  /**
   * Flags whose country the system's names do not cover (the home nations...); every other one
   * is named by Intl.DisplayNames in the interface language.
   */
  countries: {
    'GB-ENG': 'Inglaterra',
    'GB-NIR': 'Irlanda del Norte',
    'GB-SCT': 'Escocia',
    'GB-WLS': 'Gales',
    'ES-CT': 'Cataluña',
    EU: 'Unión Europea',
    XK: 'Kosovo'
  }
} as const

export const widgetsEn: Dict<typeof widgetsEs> = {
  common: {
    preview: 'PREVIEW',
    sim: 'SIM',
    simTitle: 'Simulated data',
    pit: 'PIT',
    tow: 'TOW',
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
    timed: (clock, laps) => `${clock}${SEP}≈${laps}${NB}laps`,
    left: (n) => (n === 1 ? `1${NB}lap left` : `${n}${NB}laps left`),
    unit: 'L',
    number: (n) => `L${n}`
  },
  incidents: {
    count: (n) => `${n}x`,
    team: (n) => `team${NB}${n}x`,
    penaltyAt: (n) => `pen.${NB}at${NB}${n}x`,
    dqAt: (n) => `DQ${NB}at${NB}${n}x`,
    added: (n) => `+${n}x`,
    lap: (n) => `L${n}`,
    kinds: {
      'loss-of-control': 'Loss of control',
      'off-track': 'Off track',
      'contact-world': 'Light wall contact',
      'collision-world': 'Wall contact',
      'contact-car': 'Light car contact',
      'collision-car': 'Car contact'
    },
    surfaces: {
      kerb: 'kerb',
      grass: 'grass',
      dirt: 'dirt',
      sand: 'sand',
      gravel: 'gravel',
      astroturf: 'astroturf'
    }
  },
  standings: {
    leader: 'LEADER',
    finished: 'Finished',
    lastLap: 'Last lap',
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
    budgetUnknown: 'margin —',
    fastestTag: 'FL',
    fastestName: 'Fastest lap of the class'
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
      furled: { label: 'WARNING', short: '', note: 'from race control', chip: '' },
      blue: { label: 'BLUE FLAG', short: '', note: 'let them pass', chip: 'BLUE' },
      white: { label: 'LAST LAP', short: '', note: '', chip: '' },
      checkered: { label: 'CHECKERED FLAG', short: 'CHECKERED', note: '', chip: 'CHECKERED' },
      green: { label: 'GREEN FLAG', short: '', note: 'track clear', chip: 'GREEN' }
    },
    notices: {
      wrongWay: { label: 'WRONG WAY', short: '', note: 'turn around', chip: '' },
      pitEntry: { label: 'LIMITER OFF', short: '', note: 'pit entry ahead', chip: '' },
      stalled: { label: 'STALLED', short: '', note: 'restart the engine', chip: '' },
      oilPressure: { label: 'OIL PRESSURE', short: '', note: 'low', chip: 'OIL PRESS.' },
      boxThisLap: { label: 'BOX THIS LAP', short: '', note: 'pit window closes', chip: '' }
    },
    tow: (clock) => `TOW${NB}${clock}`,
    towNote: 'until you can drive',
    damage: { label: 'DAMAGE', note: 'pit for mandatory repairs' },
    fuelLow: (laps) => `FUEL${NB}·${NB}${laps}${NB}LAPS`,
    fuelLowShort: (laps) => `FUEL${NB}${laps}${NB}LAPS`,
    fuelLowNote: 'pit to refuel',
    lapsToGo: (n) => `${n}${NB}TO GO`,
    lapsToGoNote: 'laps left',
    limiterOn: 'PIT LIMITER',
    limiterOff: 'LIMITER OFF',
    speeding: 'SPEEDING'
  },
  lights: {
    captions: {
      oilPressure: 'OIL P.',
      fuelPressure: 'FUEL',
      stalled: 'STALL',
      repair: 'REPAIR',
      repairOptional: 'OPT.',
      water: 'WATER',
      oilTemp: 'OIL T.',
      pitLimiter: 'LIMITER',
      revLimiter: 'REV LIM.'
    },
    names: {
      oilPressure: 'Oil pressure',
      fuelPressure: 'Fuel pressure',
      stalled: 'Engine stalled',
      repair: 'Mandatory repairs',
      repairOptional: 'Optional repairs',
      water: 'Water temperature',
      oilTemp: 'Oil temperature',
      pitLimiter: 'Pit limiter',
      revLimiter: 'Rev limiter'
    },
    seconds: (s) => `${s}${NB}s`,
    draft: 'slipstream?',
    states: { off: 'off', on: 'on', trend: 'above your average' }
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
    outLap: 'out lap',
    tow: 'tow',
    predicted: 'Pred.',
    pb: 'Personal best',
    session: 'Session best',
    optimal: 'Optimal lap',
    self: 'You',
    classBest: 'Class best',
    classOptimal: 'Class optimal',
    laps: { last: 'Last', best: 'Best', optimal: 'Opt.', pb: 'PB' },
    refMark: 'Δ',
    refMarkName: 'delta reference',
    nextLap: (reference) => `${reference} from the next lap`,
    temporary: 'temporary',
    temporaryRef: (reference) => `${reference} (temporary)`
  },
  conditions: {
    track: 'Track',
    air: 'Air',
    wind: 'Wind',
    rain: 'Rain',
    rubber: 'Rubber',
    water: 'Wet',
    wetness: [
      'Dry',
      'Mostly dry',
      'Very lightly wet',
      'Lightly wet',
      'Moderately wet',
      'Very wet',
      'Extremely wet'
    ],
    rubberStates: {
      clean: 'Clean',
      low: 'Low',
      moderateLow: 'Moderately low',
      moderate: 'Moderate',
      moderateHigh: 'Moderately high',
      high: 'High',
      carryOver: 'Carried over'
    },
    carried: (state) => `${state} (carried over)`,
    declaredWet: 'DECLARED WET'
  },
  fuel: {
    laps: 'laps',
    perLap: 'L/lap',
    measuring: 'measuring…',
    left: 'To go',
    use: 'Use',
    need: 'To finish',
    add: 'Add',
    spare: 'Spare',
    short: 'Short',
    window: 'Window',
    save: 'Save',
    tyres: 'Tyres',
    repairs: 'Fast repairs',
    sets: 'Tyre sets',
    last: (v) => `last${NB}${v}`,
    max: (v) => `max${NB}${v}`,
    carried: 'from the last session',
    fill: 'FULL',
    box: (litres) => `menu${NB}${litres}${NB}L`,
    window1: (lap) => `L${lap}`,
    windowN: (from, to) => `L${from}–L${to}`,
    stops: (n) => (n === 1 ? '1 stop' : `${n} stops`),
    noStop: 'no stop',
    saveFor: (n) => (n === 1 ? 'with 1 stop' : `with ${n} stops`),
    readingLap: (lap) => `L${lap}`,
    corners: ['FL', 'FR', 'RL', 'RR']
  },
  heads: {
    pos: 'POS',
    driver: 'DRIVER',
    gained: '±',
    ir: 'iR',
    sr: 'SR',
    lic: 'LIC',
    delta: 'ΔiR',
    interval: 'INT',
    leader: 'LEADER',
    toBest: 'GAP',
    gap: 'GAP',
    last: 'LAST',
    best: 'BEST',
    pit: 'PIT',
    pitLap: 'STOP',
    stint: 'STINT',
    tyre: 'TYRE'
  },
  info: {
    fastestTag: 'FL',
    fastestLap: (car, time) => (car === '' ? time : `${car}${NB}${time}`),
    fuel: 'Fuel',
    fuelLaps: (laps) => `${laps}${NB}laps`,
    clock: 'Local time'
  },
  countries: {
    'GB-ENG': 'England',
    'GB-NIR': 'Northern Ireland',
    'GB-SCT': 'Scotland',
    'GB-WLS': 'Wales',
    'ES-CT': 'Catalonia',
    EU: 'European Union',
    XK: 'Kosovo'
  }
}
