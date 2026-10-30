/**
 * Edit-mode sample of the traffic widget: a GT3 driver's view of a multiclass race with every
 * kind of line (urgent and calm ETAs, lapping both ways, a stopped car), so the window is placed
 * and sized on realistic content. Invented drivers; gaps and ETAs are consistent with real
 * closing rates (a GTP gains ~0.1 s of road per second on a GT3).
 */
import { shallowRef } from 'vue'
import type { BrandId } from '@shared/carBrands'
import type { DriverIdentity } from '@shared/driver'
import type { TrafficData, TrafficEntry, TrafficKind, TrafficOptions } from '@shared/types'
import { PREVIEW_INFO } from '@renderer/view/infoBar'
import { GROUP_ORDER, type TrafficViewOptions } from './view'

const GTP = '#ff5888'
const GT3 = '#ffda59'
const GT4 = '#53ff77'

function driver(
  carIdx: number,
  carNumber: string,
  driverName: string,
  classColor: string,
  brand: BrandId,
  country: string
): DriverIdentity {
  return Object.freeze({
    carIdx,
    carNumber,
    driverName,
    classColor,
    iRating: 2850,
    licString: 'A 3.12',
    licColor: '#0153db',
    brand,
    country
  })
}

const entry = (e: TrafficEntry): TrafficEntry => Object.freeze(e)
/** Frozen at run time; typed as the payload's mutable array (nothing writes to it). */
const list = (entries: TrafficEntry[]): TrafficEntry[] => Object.freeze(entries) as TrafficEntry[]

export const PREVIEW_TRAFFIC: TrafficData = Object.freeze({
  visible: true,
  hazards: list([
    entry({
      driver: driver(-1, '12', 'Lucas Moreau', GT3, 'porsche', 'FR'),
      kind: 'hazard',
      className: 'GT3 Class',
      gapS: 3.2,
      etaS: 3.4,
      meetPct: 0.38,
      meetSector: 2,
      lapping: false,
      passing: null,
      hazard: 'stopped',
      penalty: null
    })
  ]),
  slower: list([
    entry({
      driver: driver(-2, '45', 'Hannah Schmidt', GT4, 'bmw', 'DE'),
      kind: 'slower',
      className: 'GT4 Class',
      gapS: 0.6,
      etaS: 5.6,
      meetPct: 0.17,
      meetSector: 1,
      lapping: false,
      passing: null,
      hazard: null,
      penalty: null
    }),
    entry({
      driver: driver(-3, '72', 'Tomás Herrera', GT4, 'ford', 'ES'),
      kind: 'slower',
      className: 'GT4 Class',
      gapS: 1.5,
      etaS: 14.2,
      meetPct: 0.71,
      meetSector: 3,
      lapping: true,
      passing: null,
      hazard: null,
      penalty: null
    })
  ]),
  faster: list([
    entry({
      driver: driver(-4, '6', 'Jules Laurent', GTP, 'cadillac', 'FR'),
      kind: 'faster',
      className: 'GTP',
      gapS: -0.25,
      etaS: 2.6,
      meetPct: 0.41,
      meetSector: 2,
      lapping: false,
      passing: null,
      hazard: null,
      penalty: null
    }),
    entry({
      driver: driver(-5, '31', 'Daniel Okafor', GTP, 'acura', 'GB'),
      kind: 'faster',
      className: 'GTP',
      gapS: -1.1,
      etaS: 10.8,
      meetPct: 0.66,
      meetSector: 3,
      lapping: true,
      passing: null,
      hazard: null,
      penalty: null
    })
  ]),
  // Several makes: the marks show on 'auto', as on a multiclass grid.
  multiBrand: true,
  // The info bars' sample (every item has something to show).
  info: PREVIEW_INFO
})

/**
 * The options the sample is drawn with: the widget's own, or every group in the list's order
 * when all of them are off (there would be nothing to place otherwise).
 */
export function previewOptions(
  o: TrafficViewOptions,
  every: readonly TrafficKind[] = GROUP_ORDER
): TrafficViewOptions {
  if (o.groups.length > 0) return o
  return { ...o, groups: every }
}

/**
 * Which field the settings page's sample draws, as the option you changed last needs it (as
 * Delta's previewSession): `spread`, the sample above plus cars further away (outside the
 * default look windows, so a longer window brings them in); `busy`, five cars a group close by,
 * so «Entradas por grupo» shows its count (in the spread field a group never holds more than
 * the default count). Per window: the overlay's edit mode keeps `spread`.
 */
export type TrafficPreviewField = 'spread' | 'busy'
export const previewTrafficField = shallowRef<TrafficPreviewField>('spread')

/** The look windows the provider applies (TrafficOptions): the sample applies them too. */
export type PreviewWindows = Pick<TrafficOptions, 'behindS' | 'aheadS' | 'hazardS'>

const far = (e: Omit<TrafficEntry, 'passing' | 'penalty'>): TrafficEntry =>
  entry({ ...e, passing: null, penalty: null })
const NAMES_SLOWER = ['Ravi Menon', 'Sara Lindgren', 'Paolo Conti'] as const
const NAMES_FASTER = ['Felix Wagner', 'Noor Haddad', 'Owen Price'] as const
const BUSY_NAMES = ['', 'Mila Novak', 'Arjun Rao', 'Lea Fischer', 'Yuki Mori'] as const

/** Further away than the default windows (8 s ahead, 12 s behind, hazards 8 s). */
const SPREAD_EXTRA: Readonly<Record<TrafficKind, readonly TrafficEntry[]>> = {
  hazard: [
    far({
      driver: driver(-6, '27', 'Ines Varga', GT4, 'aston-martin', 'HU'),
      kind: 'hazard',
      className: 'GT4 Class',
      gapS: 12.4,
      etaS: 12.9,
      meetPct: 0.92,
      meetSector: 3,
      lapping: false,
      hazard: 'slow'
    })
  ],
  slower: [10.2, 17.5, 25.8].map((gapS, i) =>
    far({
      driver: driver(
        -7 - i,
        ['58', '83', '94'][i] ?? '58',
        NAMES_SLOWER[i] ?? '',
        GT4,
        'toyota',
        ''
      ),
      kind: 'slower',
      className: 'GT4 Class',
      gapS,
      etaS: Math.round(gapS * 9.5 * 10) / 10,
      meetPct: (0.2 + i * 0.25) % 1,
      meetSector: (i % 3) + 1,
      lapping: i === 2,
      hazard: null
    })
  ),
  faster: [-15.3, -21.7, -28.4].map((gapS, i) =>
    far({
      driver: driver(
        -10 - i,
        ['2', '10', '25'][i] ?? '2',
        NAMES_FASTER[i] ?? '',
        GTP,
        'porsche',
        ''
      ),
      kind: 'faster',
      className: 'GTP',
      gapS,
      etaS: Math.round(-gapS * 9.8 * 10) / 10,
      meetPct: (0.3 + i * 0.25) % 1,
      meetSector: ((i + 1) % 3) + 1,
      lapping: false,
      hazard: null
    })
  )
}

/** The busy field's invented cars, per group: indexes, numbers, names, makes. */
const BUSY: Readonly<
  Record<
    TrafficKind,
    { idx: number; numbers: readonly string[]; names: readonly string[]; brands: BrandId[] }
  >
> = {
  hazard: {
    idx: -20,
    numbers: ['', '33', '4', '17', '50'],
    names: BUSY_NAMES,
    brands: ['porsche', 'bmw', 'ferrari', 'audi', 'lamborghini']
  },
  slower: {
    idx: -30,
    numbers: ['', '21', '39', '66', '80'],
    names: ['', 'Chloé Martin', 'Bruno Costa', 'Erik Holm', 'Aiko Sato'],
    brands: ['bmw', 'toyota', 'mercedes-amg', 'aston-martin', 'mclaren']
  },
  faster: {
    idx: -40,
    numbers: ['', '01', '5', '38', '93'],
    names: ['', 'Victor Lemaire', 'Kai Becker', 'Rafael Díaz', 'Tom Ellis'],
    brands: ['cadillac', 'bmw', 'porsche', 'acura', 'porsche']
  }
}
/** A pile-up after a crash: stopped, slow and off-track cars together. */
const BUSY_HAZARDS: readonly NonNullable<TrafficEntry['hazard']>[] = [
  'stopped',
  'off-track',
  'slow',
  'stopped',
  'slow'
]

/** Five cars a group, all within the narrowest windows (2 s); the first is the sample's own. */
function busy(kind: TrafficKind, first: TrafficEntry): TrafficEntry[] {
  const sign = kind === 'faster' ? -1 : 1
  const b = BUSY[kind]
  return [0.3, 0.7, 1.1, 1.5, 1.9].map((g, i) =>
    i === 0
      ? { ...first, gapS: sign * g }
      : far({
          driver: driver(
            b.idx - i,
            b.numbers[i] ?? '',
            b.names[i] ?? '',
            first.driver.classColor,
            b.brands[i] ?? first.driver.brand,
            ''
          ),
          kind,
          className: first.className,
          gapS: sign * g,
          etaS: first.etaS === null ? null : Math.round((first.etaS + i * 1.7) * 10) / 10,
          meetPct: first.meetPct === null ? null : (first.meetPct + i * 0.07) % 1,
          meetSector: first.meetSector,
          lapping: false,
          hazard: kind === 'hazard' ? (BUSY_HAZARDS[i] ?? 'stopped') : null
        })
  )
}

/** Within its window, the closest first (the provider's rule, before the per-group count). */
function within(entries: readonly TrafficEntry[], windowS: number): TrafficEntry[] {
  return entries
    .filter((e) => Math.abs(e.gapS) <= windowS)
    .sort((a, b) => Math.abs(a.gapS) - Math.abs(b.gapS))
}

/**
 * The sample payload in `field`, with the look windows applied as the provider applies them (a
 * fresh object: the caller memoises). The default windows draw PREVIEW_TRAFFIC's cars.
 */
export function previewTraffic(
  w: PreviewWindows,
  field: TrafficPreviewField = 'spread'
): TrafficData {
  const pool = (kind: TrafficKind, base: readonly TrafficEntry[]): TrafficEntry[] => {
    if (field === 'busy') {
      const first = base[0]
      return first === undefined ? [] : busy(kind, first)
    }
    return [...base, ...SPREAD_EXTRA[kind]]
  }
  return {
    ...PREVIEW_TRAFFIC,
    hazards: within(pool('hazard', PREVIEW_TRAFFIC.hazards), w.hazardS),
    slower: within(pool('slower', PREVIEW_TRAFFIC.slower), w.aheadS),
    faster: within(pool('faster', PREVIEW_TRAFFIC.faster), w.behindS)
  }
}
