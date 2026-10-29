/**
 * Edit-mode sample of the traffic widget: a GT3 driver's view of a multiclass race with every
 * kind of line (urgent and calm ETAs, lapping both ways, a stopped car), so the window is placed
 * and sized on realistic content. Invented drivers; gaps and ETAs are consistent with real
 * closing rates (a GTP gains ~0.1 s of road per second on a GT3).
 */
import type { DriverIdentity } from '@shared/driver'
import type { TrafficData, TrafficEntry, TrafficKind } from '@shared/types'
import { PREVIEW_INFO } from '@renderer/view/infoBar'
import { GROUP_ORDER, type TrafficViewOptions } from './view'

const GTP = '#ff5888'
const GT3 = '#ffda59'
const GT4 = '#53ff77'

function driver(
  carIdx: number,
  carNumber: string,
  driverName: string,
  classColor: string
): DriverIdentity {
  return Object.freeze({
    carIdx,
    carNumber,
    driverName,
    classColor,
    iRating: 2850,
    licString: 'A 3.12',
    licColor: '#0153db',
    brand: 'unknown',
    country: ''
  })
}

const entry = (e: TrafficEntry): TrafficEntry => Object.freeze(e)
/** Frozen at run time; typed as the payload's mutable array (nothing writes to it). */
const list = (entries: TrafficEntry[]): TrafficEntry[] => Object.freeze(entries) as TrafficEntry[]

export const PREVIEW_TRAFFIC: TrafficData = Object.freeze({
  visible: true,
  hazards: list([
    entry({
      driver: driver(-1, '12', 'Lucas Moreau', GT3),
      kind: 'hazard',
      className: 'GT3 Class',
      gapS: 3.2,
      etaS: 3.4,
      meetPct: 0.38,
      meetSector: 2,
      lapping: false,
      passing: null,
      hazard: 'stopped'
    })
  ]),
  slower: list([
    entry({
      driver: driver(-2, '45', 'Hannah Schmidt', GT4),
      kind: 'slower',
      className: 'GT4 Class',
      gapS: 0.6,
      etaS: 5.6,
      meetPct: 0.17,
      meetSector: 1,
      lapping: false,
      passing: null,
      hazard: null
    }),
    entry({
      driver: driver(-3, '72', 'Tomás Herrera', GT4),
      kind: 'slower',
      className: 'GT4 Class',
      gapS: 1.5,
      etaS: 14.2,
      meetPct: 0.71,
      meetSector: 3,
      lapping: true,
      passing: null,
      hazard: null
    })
  ]),
  faster: list([
    entry({
      driver: driver(-4, '6', 'Jules Laurent', GTP),
      kind: 'faster',
      className: 'GTP',
      gapS: -0.25,
      etaS: 2.6,
      meetPct: 0.41,
      meetSector: 2,
      lapping: false,
      passing: null,
      hazard: null
    }),
    entry({
      driver: driver(-5, '31', 'Daniel Okafor', GTP),
      kind: 'faster',
      className: 'GTP',
      gapS: -1.1,
      etaS: 10.8,
      meetPct: 0.66,
      meetSector: 3,
      lapping: true,
      passing: null,
      hazard: null
    })
  ]),
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
