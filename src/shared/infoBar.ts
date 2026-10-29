/**
 * The info bars: the configurable headers and footers of the relative, the standings and the
 * fuel. One catalog of data items (InfoItemId), each with where its data comes from, how
 * important it is when the bar is short of room, and how wide it is at least; every bar is an
 * element list of those items (plus the `split` marker: what follows it lines up at the far end)
 * and a size. Pure.
 *
 * Legibility rules (renderer view/infoBar.ts and ui/InfoBar.vue apply them):
 * - One line per bar, its height fixed by the size (INFO_BAR_LINE_EM x INFO_BAR_SCALE), so the
 *   panels' height maths never depend on the content.
 * - Text never below the minimum text size (--ov-min-text): a bar too narrow for its items drops
 *   whole items, the least important first (INFO_ITEMS[id].priority, then the later one), never
 *   shrinks them or cuts a word.
 * - An item with nothing to say (no data yet, a dry track for `wet`) takes no room at all.
 */
import type {
  ElementEntry,
  InfoBarEntryId,
  InfoBarSize,
  InfoItemId,
  OverlaySettings
} from './types'

/** Where an item's data comes from (InfoFeed in infoFeed.ts fills each one). */
export type InfoSource =
  /** Nothing from the telemetry process: the widget's name, the local clock. */
  | 'renderer'
  /** Session type, what is left, your flag. */
  | 'session'
  /** Your class: its strength of field and its entries. */
  | 'field'
  | 'incidents'
  /** Your projected iRating (with your position) and safety rating. */
  | 'ratings'
  | 'fastestLap'
  /** The weather (ConditionsFeed). */
  | 'conditions'
  /** The fuel tracker's laps of fuel. */
  | 'fuel'

export interface InfoItemSpec {
  readonly source: InfoSource
  /** 1 = kept longest; a bar short of room drops the highest numbers first. */
  readonly priority: number
  /**
   * Width (em of the bar's text, separator gap not included) the item takes at most in its usual
   * form: what the fit counts, so the set of items shown never changes with the values.
   */
  readonly em: number
}

/** Every item, in the catalog's order (the editor lists the hidden ones in it). */
export const INFO_ITEM_IDS = [
  'title',
  'session',
  'remaining',
  'clock',
  'sof',
  'carCount',
  'incidents',
  'iRating',
  'safetyRating',
  'fastestLap',
  'fuelLaps',
  'trackTemp',
  'wet',
  'wind',
  'airTemp',
  'rubber'
] as const satisfies readonly InfoItemId[]

export const INFO_ITEMS: { readonly [K in InfoItemId]: InfoItemSpec } = {
  title: { source: 'renderer', priority: 3, em: 7 },
  session: { source: 'session', priority: 1, em: 5.5 },
  remaining: { source: 'session', priority: 1, em: 6.5 },
  clock: { source: 'renderer', priority: 4, em: 3.2 },
  sof: { source: 'field', priority: 5, em: 4.5 },
  carCount: { source: 'field', priority: 6, em: 4.5 },
  incidents: { source: 'incidents', priority: 2, em: 6.5 },
  // 'iR +13 ▲ P4 +31 P6 −5 break-even P6' / 'SR B 3.98 → A 4.02 ▲ margen 4x', as drawn.
  iRating: { source: 'ratings', priority: 2, em: 16 },
  safetyRating: { source: 'ratings', priority: 2, em: 13.5 },
  fastestLap: { source: 'fastestLap', priority: 4, em: 7.5 },
  fuelLaps: { source: 'fuel', priority: 3, em: 5 },
  trackTemp: { source: 'conditions', priority: 3, em: 5.5 },
  wet: { source: 'conditions', priority: 2, em: 9 },
  wind: { source: 'conditions', priority: 5, em: 5 },
  airTemp: { source: 'conditions', priority: 6, em: 5 },
  rubber: { source: 'conditions', priority: 7, em: 8 }
}

/** Every entry of a bar's list: the items, then the marker. */
export const INFO_BAR_ENTRY_IDS = [
  ...INFO_ITEM_IDS,
  'split'
] as const satisfies readonly InfoBarEntryId[]

export function isInfoItem(id: InfoBarEntryId): id is InfoItemId {
  return id !== 'split'
}

/** Bar sizes in UI order ('off' first: it hides the bar). */
export const INFO_BAR_SIZES = [
  'off',
  'small',
  'normal',
  'large'
] as const satisfies readonly InfoBarSize[]

/** Text scale of each size against the widget's own text (min text size still applies). */
export const INFO_BAR_SCALE: { readonly [K in Exclude<InfoBarSize, 'off'>]: number } = {
  small: 0.85,
  normal: 1,
  large: 1.2
}

/** Height of a bar's line at 'normal' (em of the widget's text), its 1 px rule apart. */
export const INFO_BAR_LINE_EM = 1.6

/**
 * Height of the panel's own header, the topmost head bar (the one with the SIM tag): the header
 * band the panels had before the bars (a tag plate of 1.15 em and 0.35 em above and below), so
 * the relative, the standings and the fuel keep their look. Its 1 px rule apart.
 */
export const INFO_BAR_TOP_EM = 1.85

/** Room between two items (em of the bar's text). */
export const INFO_ITEM_GAP_EM = 0.85

/** The same on the panel's own header (INFO_BAR_TOP_EM): as tight as the header band set it. */
export const INFO_TOP_GAP_EM = 0.5

/**
 * The bars of each section that has some, as [list field, size field], top to bottom: the
 * relative's header and footer, the standings' header lines and footer, the fuel's header.
 */
export const INFO_BARS = {
  relative: [
    ['headerBar', 'headerBarSize'],
    ['footerBar', 'footerBarSize']
  ],
  standings: [
    ['headerBar', 'headerBarSize'],
    ['subheaderBar', 'subheaderBarSize'],
    ['footerBar', 'footerBarSize']
  ],
  fuel: [['headerBar', 'headerBarSize']]
} as const

export type InfoBarSection = keyof typeof INFO_BARS
export type InfoBarField<S extends InfoBarSection> = (typeof INFO_BARS)[S][number][0]

type List = readonly Readonly<ElementEntry<InfoBarEntryId>>[]

/** The items a bar draws, in order: none when its size is 'off' (`split` is not an item). */
export function barItems(list: List | null | undefined, size: InfoBarSize): InfoItemId[] {
  if (size === 'off' || !Array.isArray(list)) return []
  const out: InfoItemId[] = []
  for (const e of list) {
    if (e.visible === true && isInfoItem(e.id) && !out.includes(e.id)) out.push(e.id)
  }
  return out
}

/** Per options object (the telemetry config's are stable between two configs). */
const ITEMS_OF = new WeakMap<object, readonly InfoItemId[]>()

/**
 * Every item some bar of `section` draws (each once), memoised per options object: the
 * providers ask on every tick.
 */
export function sectionInfoItems<S extends InfoBarSection>(
  section: S,
  options: Readonly<OverlaySettings[S]>
): readonly InfoItemId[] {
  const hit = ITEMS_OF.get(options)
  if (hit !== undefined) return hit
  const out: InfoItemId[] = []
  const o = options as unknown as Readonly<Record<string, unknown>>
  for (const [list, size] of INFO_BARS[section]) {
    for (const id of barItems(o[list] as List, o[size] as InfoBarSize)) {
      if (!out.includes(id)) out.push(id)
    }
  }
  Object.freeze(out)
  ITEMS_OF.set(options, out)
  return out
}

/** Whether some bar of `section` draws `id`. */
export function infoItemShown<S extends InfoBarSection>(
  section: S,
  options: Readonly<OverlaySettings[S]>,
  id: InfoItemId
): boolean {
  return sectionInfoItems(section, options).includes(id)
}

/** The data sources the items need (the renderer's own left out). */
export function infoSources(items: readonly InfoItemId[]): Set<InfoSource> {
  const out = new Set<InfoSource>()
  for (const id of items) {
    const s = INFO_ITEMS[id].source
    if (s !== 'renderer') out.add(s)
  }
  return out
}

/** The items whose data the telemetry process computes (an 'elements' spec's `computed`). */
export const COMPUTED_INFO_ITEMS: readonly InfoItemId[] = Object.freeze(
  INFO_ITEM_IDS.filter((id) => INFO_ITEMS[id].source !== 'renderer')
)

const NO_ITEMS: ReadonlySet<InfoItemId> = new Set()

/**
 * Which of `items` (in order, with their widths) fit `widthEm` of bar: all of them while they
 * fit, else the least important dropped one at a time (the highest priority number; between
 * equals the later one) until the rest does. `widthEm` <= 0 (not measured yet) keeps them all.
 * `dropAtLeast` drops that many more the same way, beyond the ones the estimates need (the bar
 * measured that what is drawn is still wider than they say: a long value, the SIM or preview
 * tag), so each step drops one more item; one item always stays. The items of `dropFirst` go
 * before any other (the settings preview's ghosts: what is really shown is drawn as without them).
 */
export function fitInfoItems(
  items: readonly InfoItemId[],
  widthEm: number,
  gapEm = INFO_ITEM_GAP_EM,
  dropAtLeast = 0,
  dropFirst: ReadonlySet<InfoItemId> = NO_ITEMS
): InfoItemId[] {
  const kept = [...items]
  if (!(widthEm > 0)) return kept
  const width = (ids: readonly InfoItemId[]): number =>
    ids.reduce((sum, id, i) => sum + INFO_ITEMS[id].em + (i > 0 ? gapEm : 0), 0)
  const rank = (id: InfoItemId): number =>
    dropFirst.has(id) ? Number.POSITIVE_INFINITY : INFO_ITEMS[id].priority
  const dropOne = (): void => {
    let drop = 0
    for (let i = 1; i < kept.length; i++) {
      const a = kept[i]
      const b = kept[drop]
      if (a !== undefined && b !== undefined && rank(a) >= rank(b)) {
        drop = i
      }
    }
    kept.splice(drop, 1)
  }
  while (kept.length > 1 && width(kept) > widthEm) dropOne()
  for (let n = 0; n < dropAtLeast && kept.length > 1; n++) dropOne()
  return kept
}
