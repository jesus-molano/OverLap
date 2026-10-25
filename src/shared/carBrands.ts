/**
 * The make of an iRacing car, from what the session YAML gives per driver (DriverInfo.Drivers[]:
 * CarScreenName, CarScreenNameShort, CarPath). A curated table covers the iRacing car list (road,
 * oval, dirt, formula): make words in the names first ('Porsche 911 GT3 Cup (992)', 'NASCAR Cup
 * Series Next Gen Chevrolet Camaro ZL1', 'Williams-Toyota FW31'), then make prefixes of the path
 * ('stockcars2 mustang2022'), then model words ('MX-5', 'Corvette', 'PM-18') and model prefixes
 * of the path ('mx5 mx52016'). Case and accents are ignored. Spec cars that no make builds (late
 * models, modifieds, sprint cars, dirt cars) are 'unknown'.
 *
 * CarID is not matched: iRacing's car ids are not published, and every car names its make (or a
 * model of it) in its name or its path.
 */

export interface BrandInfo {
  /** Display name: a proper noun, the same in every language. */
  readonly name: string
  /** Three-letter text badge for a brand drawn without a logo ('MAZ', 'POR', 'BMW'). */
  readonly badge: string
  /** Make words as the names write them ('aston martin', 'vw'): beat any model word. */
  readonly makes: readonly string[]
  /** Model or series words that name no make ('corvette', 'mx 5', 'pm 18'). */
  readonly models?: readonly string[]
  /** CarPath token prefixes of the models ('camaro' for 'stockcars2 camaro2022'). */
  readonly paths?: readonly string[]
}

/**
 * Words are normalised like the names (lower case, accents dropped, every run of other
 * characters one space: 'MX-5' -> 'mx 5', 'Huracán' -> 'huracan'). Make prefixes of the path are
 * the make words without spaces ('astonmartin').
 */
export const BRANDS = {
  acura: {
    name: 'Acura',
    badge: 'ACU',
    makes: ['acura'],
    models: ['nsx', 'arx 06', 'arx 05'],
    paths: ['nsx', 'arx06']
  },
  'aston-martin': {
    name: 'Aston Martin',
    badge: 'AST',
    makes: ['aston martin'],
    models: ['vantage', 'dbr9'],
    paths: ['amvantage', 'dbr9']
  },
  audi: {
    name: 'Audi',
    badge: 'AUD',
    makes: ['audi'],
    models: ['r8 lms', 'r18', 'rs 3', 'rs3', '90 gto'],
    paths: ['r8lms', 'rs3lms']
  },
  bmw: {
    name: 'BMW',
    badge: 'BMW',
    makes: ['bmw'],
    models: ['m hybrid', 'm2 cs', 'm4', 'm8', 'z4'],
    paths: ['m4gt', 'm8gte', 'z4gt3']
  },
  buick: { name: 'Buick', badge: 'BUI', makes: ['buick'], models: ['lesabre'], paths: ['lesabre'] },
  cadillac: {
    name: 'Cadillac',
    badge: 'CAD',
    makes: ['cadillac'],
    models: ['cts v', 'v series r', 'dpi v r'],
    paths: ['ctsv', 'vseriesr']
  },
  chevrolet: {
    name: 'Chevrolet',
    badge: 'CHE',
    makes: ['chevrolet', 'chevy'],
    models: ['corvette', 'camaro', 'silverado', 'impala', 'monte carlo', 'c6 r', 'c8 r'],
    paths: ['corvette', 'camaro', 'silverado', 'impala', 'montecarlo', 'c6r', 'c7vette', 'c8rvette']
  },
  dallara: {
    name: 'Dallara',
    badge: 'DAL',
    makes: ['dallara'],
    // The IndyCars since 2012, Super Formula (SF19, SF23) and Super Formula Lights are Dallaras.
    models: [
      'ir18',
      'ir 18',
      'dw12',
      'p217',
      'ir 01',
      'ir 05',
      'il 15',
      'indycar',
      'super formula'
    ],
    paths: ['ir18', 'dw12', 'p217', 'indycar', 'superformula']
  },
  dodge: {
    name: 'Dodge',
    badge: 'DOD',
    makes: ['dodge'],
    models: ['charger', 'challenger', 'viper'],
    paths: ['charger', 'challenger', 'viper']
  },
  ferrari: {
    name: 'Ferrari',
    badge: 'FER',
    makes: ['ferrari'],
    models: ['296', '488', '499p'],
    paths: ['f296', 'f488', '499p']
  },
  ford: {
    name: 'Ford',
    badge: 'FOR',
    makes: ['ford'],
    models: ['mustang', 'falcon', 'thunderbird', 'taurus', 'fusion', 'fiesta', 'f150', 'f 150'],
    paths: ['mustang', 'falcon', 'thunderbird', 'taurus', 'fusion', 'fiesta', 'f150']
  },
  holden: {
    name: 'Holden',
    badge: 'HOL',
    makes: ['holden'],
    models: ['commodore'],
    paths: ['commodore']
  },
  honda: {
    name: 'Honda',
    badge: 'HON',
    // HPD: Honda Performance Development (HPD ARX-01c).
    makes: ['honda', 'hpd'],
    models: ['civic', 'arx 01'],
    paths: ['civic', 'arx01']
  },
  hyundai: {
    name: 'Hyundai',
    badge: 'HYU',
    makes: ['hyundai'],
    models: ['elantra', 'veloster'],
    paths: ['elantra', 'veloster']
  },
  kia: { name: 'Kia', badge: 'KIA', makes: ['kia'], models: ['optima'], paths: ['optima'] },
  lamborghini: {
    name: 'Lamborghini',
    badge: 'LAM',
    makes: ['lamborghini', 'lambo'],
    models: ['huracan'],
    paths: ['huracan']
  },
  ligier: {
    name: 'Ligier',
    badge: 'LIG',
    makes: ['ligier'],
    models: ['js p320', 'js p3', 'p320'],
    paths: ['jsp320', 'p320']
  },
  lotus: { name: 'Lotus', badge: 'LOT', makes: ['lotus'] },
  mazda: {
    name: 'Mazda',
    badge: 'MAZ',
    makes: ['mazda'],
    models: ['mx 5', 'mx5', 'miata'],
    paths: ['mx5', 'promazda', 'starmazda', 'formulamazda']
  },
  mclaren: {
    name: 'McLaren',
    badge: 'MCL',
    makes: ['mclaren'],
    models: ['mp4', '570s', '720s'],
    paths: ['mp4', '570s', '720s']
  },
  'mercedes-amg': {
    name: 'Mercedes-AMG',
    badge: 'AMG',
    makes: ['mercedes', 'amg'],
    models: ['w12', 'w13', 'w14'],
    paths: ['w12', 'w13', 'w14']
  },
  nissan: {
    name: 'Nissan',
    badge: 'NIS',
    makes: ['nissan'],
    models: ['gtp zx t', 'zx t', 'gt r'],
    paths: ['gtpzxt', 'gtr']
  },
  pontiac: {
    name: 'Pontiac',
    badge: 'PON',
    makes: ['pontiac'],
    models: ['solstice', 'grand prix'],
    paths: ['solstice', 'grandprix']
  },
  porsche: {
    name: 'Porsche',
    badge: 'POR',
    makes: ['porsche'],
    models: ['911', '718', '919', '963', '991', '992', 'cayman', 'mission r'],
    paths: ['911', '718', '919', '963', '991', '992']
  },
  radical: {
    name: 'Radical',
    badge: 'RAD',
    makes: ['radical'],
    models: ['sr8', 'sr10'],
    paths: ['sr8', 'sr10']
  },
  ray: {
    name: 'Ray',
    badge: 'RAY',
    makes: ['ray'],
    models: ['ff1600'],
    paths: ['rayff', 'ff1600']
  },
  renault: {
    name: 'Renault',
    badge: 'REN',
    makes: ['renault'],
    models: ['clio'],
    paths: ['clio', 'formularenault', 'fr20', 'fr35']
  },
  riley: { name: 'Riley', badge: 'RIL', makes: ['riley'], models: ['mkxx', 'mk xx'] },
  ruf: {
    name: 'RUF',
    badge: 'RUF',
    makes: ['ruf'],
    models: ['rt 12r', 'rt12r'],
    paths: ['rt12r']
  },
  'skip-barber': {
    name: 'Skip Barber',
    badge: 'SKB',
    makes: ['skip barber', 'skipbarber'],
    models: ['rt2000', 'rt 2000'],
    paths: ['rt2000', 'skippy']
  },
  subaru: {
    name: 'Subaru',
    badge: 'SUB',
    makes: ['subaru'],
    models: ['wrx', 'impreza'],
    paths: ['wrx', 'impreza']
  },
  tatuus: {
    name: 'Tatuus',
    badge: 'TAT',
    makes: ['tatuus'],
    // Road to Indy: USF Juniors JR-23, USF 2000 USF-17, Indy Pro 2000 PM-18.
    models: ['jr 23', 'usf 17', 'usf 2000', 'usf2000', 'usf juniors', 'pm 18', 'pro 2000'],
    paths: ['jr23', 'usf', 'pm18', 'indypro2000']
  },
  toyota: {
    name: 'Toyota',
    badge: 'TOY',
    makes: ['toyota'],
    models: ['camry', 'supra', 'tundra', 'gr86', 'gr 86', 'corolla'],
    paths: ['camry', 'supra', 'tundra', 'gr86']
  },
  volkswagen: {
    name: 'Volkswagen',
    badge: 'VW',
    makes: ['volkswagen', 'vw'],
    models: ['jetta', 'beetle', 'golf', 'polo'],
    paths: ['jetta', 'beetle']
  },
  williams: {
    name: 'Williams',
    badge: 'WIL',
    makes: ['williams'],
    models: ['fw31'],
    paths: ['fw31']
  }
} as const satisfies Record<string, BrandInfo>

export type KnownBrandId = keyof typeof BRANDS

/** 'unknown': no make in the table (spec cars, or a car newer than the table). */
export type BrandId = KnownBrandId | 'unknown'

export const BRAND_IDS = Object.keys(BRANDS) as KnownBrandId[]

/** The table entry of `id`, null for 'unknown' (or anything else). */
export function brandInfo(id: BrandId): BrandInfo | null {
  return Object.hasOwn(BRANDS, id) ? BRANDS[id as KnownBrandId] : null
}

/** The car fields of a DriverInfo.Drivers[] entry the brand is read from. */
export interface CarIdentity {
  /** CarScreenName ('Porsche 911 GT3 Cup (992)'). */
  readonly name?: string
  /** CarScreenNameShort ('Porsche 992 Cup'). */
  readonly shortName?: string
  /** CarPath, the car's folder ('porsche992cup', 'stockcars2 camaro2022'). */
  readonly path?: string
}

/** 'MX-5 Cup' -> ' mx 5 cup ': lower case, no accents, words between single spaces. */
function normalise(s: string): string {
  const words = s
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
  return words === '' ? '' : ` ${words} `
}

/** 'stockcars2 camaro2022' -> ['stockcars2', 'camaro2022']. */
function pathTokens(path: string): string[] {
  return normalise(path).split(' ').filter(Boolean)
}

interface Matcher {
  readonly brand: KnownBrandId
  /** Normalised and padded (' aston martin '). */
  readonly word: string
}

interface PathMatcher {
  readonly brand: KnownBrandId
  readonly prefix: string
}

function wordMatchers(pick: (b: BrandInfo) => readonly string[] | undefined): Matcher[] {
  return BRAND_IDS.flatMap((brand) =>
    (pick(BRANDS[brand]) ?? []).map((w) => ({ brand, word: normalise(w) }))
  )
}

function pathMatchers(pick: (b: BrandInfo) => readonly string[] | undefined): PathMatcher[] {
  return BRAND_IDS.flatMap((brand) =>
    (pick(BRANDS[brand]) ?? []).map((p) => ({ brand, prefix: p.toLowerCase().replace(/ /g, '') }))
  )
}

const MAKE_WORDS = wordMatchers((b) => b.makes)
const MODEL_WORDS = wordMatchers((b) => b.models)
const MAKE_PATHS = pathMatchers((b) => b.makes)
const MODEL_PATHS = pathMatchers((b) => b.paths)

/**
 * The brand whose word comes first in `name` (the longer word on a tie): 'Williams-Toyota FW31'
 * is a Williams, 'Super Formula SF23 - Toyota' (with make words only) a Toyota.
 */
function byWord(name: string, matchers: readonly Matcher[]): KnownBrandId | null {
  if (name === '') return null
  let best: Matcher | null = null
  let bestAt = Infinity
  for (const m of matchers) {
    const at = name.indexOf(m.word)
    if (at < 0) continue
    if (at < bestAt || (at === bestAt && best !== null && m.word.length > best.word.length)) {
      best = m
      bestAt = at
    }
  }
  return best?.brand ?? null
}

/** The brand of the first path token that starts with one of the prefixes. */
function byPath(tokens: readonly string[], matchers: readonly PathMatcher[]): KnownBrandId | null {
  for (const t of tokens) {
    for (const m of matchers) if (t.startsWith(m.prefix)) return m.brand
  }
  return null
}

/** The make of a car; 'unknown' when neither its names nor its path give one. */
export function brandOfCar(car: CarIdentity): BrandId {
  const name = normalise(car.name ?? '')
  const shortName = normalise(car.shortName ?? '')
  const path = pathTokens(car.path ?? '')
  return (
    byWord(name, MAKE_WORDS) ??
    byWord(shortName, MAKE_WORDS) ??
    byPath(path, MAKE_PATHS) ??
    byWord(name, MODEL_WORDS) ??
    byWord(shortName, MODEL_WORDS) ??
    byPath(path, MODEL_PATHS) ??
    'unknown'
  )
}

/** YAML scalars as text: a car named '911' may arrive as a number. */
function text(v: unknown): string {
  if (typeof v === 'string') return v
  return typeof v === 'number' && Number.isFinite(v) ? String(v) : ''
}

function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

/** CarScreenName, CarScreenNameShort and CarPath of a raw DriverInfo.Drivers[] entry. */
export function carIdentityOf(driver: unknown): CarIdentity {
  if (!isObj(driver)) return {}
  return {
    name: text(driver.CarScreenName),
    shortName: text(driver.CarScreenNameShort),
    path: text(driver.CarPath)
  }
}

/**
 * Brand by CarIdx of every entry of the session YAML's DriverInfo.Drivers (pace car and
 * spectators included: the caller knows them from SessionMeta.drivers). Never throws.
 */
export function brandsByCarIdx(session: unknown): Map<number, BrandId> {
  const out = new Map<number, BrandId>()
  const driverInfo = isObj(session) ? session.DriverInfo : null
  const drivers = isObj(driverInfo) ? driverInfo.Drivers : null
  if (!Array.isArray(drivers)) return out
  for (const d of drivers) {
    if (!isObj(d)) continue
    const carIdx = d.CarIdx
    if (typeof carIdx !== 'number' || !Number.isInteger(carIdx) || carIdx < 0) continue
    if (!out.has(carIdx)) out.set(carIdx, brandOfCar(carIdentityOf(d)))
  }
  return out
}

/** The known brands among `brands`, without repeats ('unknown' is not a brand). */
export function distinctBrands(brands: Iterable<BrandId>): Set<KnownBrandId> {
  const out = new Set<KnownBrandId>()
  for (const b of brands) if (b !== 'unknown') out.add(b)
  return out
}

/**
 * More than one make on track. Cars of unknown make count as none: a field of late models, or
 * one make plus a car the table does not know, is a one-make field.
 */
export function hasMultipleBrands(brands: Iterable<BrandId>): boolean {
  let first: KnownBrandId | null = null
  for (const b of brands) {
    if (b === 'unknown') continue
    if (first === null) first = b
    else if (b !== first) return true
  }
  return false
}

/** Brand marks in Relative, Standings and Battle: never, always, or only in a multi-make field. */
export type BrandMarkMode = 'off' | 'on' | 'auto'

export const BRAND_MARK_MODES: readonly BrandMarkMode[] = ['off', 'on', 'auto']

/** Whether the widgets draw brand marks for a field whose cars have these brands. */
export function brandMarksShown(mode: BrandMarkMode, brands: Iterable<BrandId>): boolean {
  if (mode === 'on') return true
  if (mode === 'off') return false
  return hasMultipleBrands(brands)
}
