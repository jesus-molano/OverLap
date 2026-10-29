/**
 * TrafficData to the slots of the traffic widget: one caption line per group and one line per
 * car, flat and keyed by index, so an unchanged slot keeps its object (`reuseViews`) for v-memo
 * and no DOM node is ever reordered. Pure.
 *
 * Groups go in traffic.groups' order, by default top to bottom as on track: what is ahead
 * (hazards, slower cars), then the faster cars behind. Urgency (by ETA) always comes with the kind icon and words, never colour alone.
 * A car passing you at about your pace (TrafficEntry.passing) reads how far behind it is, its
 * urgency by that gap under the blue flag. Words come from the dictionary `m` (messagesFor(lang)).
 */
import type { Messages } from '@shared/i18n'
import type { HazardKind, NameFormat, TrafficData, TrafficEntry, TrafficKind } from '@shared/types'
import type { Tone } from '@renderer/ui/tones'
import { toDriverCell } from '@renderer/view/driverCell'
import { perDictionary } from '@renderer/view/perDictionary'
import type { DriverStyles, InlineStyle } from '@renderer/view/styles'

/** bad: meeting in under URGENT_S; warn: under SOON_S; idle: not converging. */
export type Urgency = 'bad' | 'warn' | 'normal' | 'idle'

export const URGENT_S = 3
export const SOON_S = 8

/**
 * A car passing you (TrafficEntry.passing) reads how far behind it is, not when it gets to you,
 * this close (s of road: alongside, the ETA counts down the pass itself)...
 */
export const PASSING_GAP_S = 3
/** ...or when it closes in this slowly (s: same-class pace, the ETA reads minutes). */
export const PASSING_ETA_S = 30
/** Under the blue flag a car passing you is urgent by its gap: closer than 1 s bad, 2 s warn. */
export const BLUE_BAD_S = 1
export const BLUE_WARN_S = 2

/** The default order, top to bottom: what is ahead of you first, the faster cars behind last. */
export const GROUP_ORDER: readonly TrafficKind[] = ['hazard', 'slower', 'faster']

/** Caption of a group ('PELIGRO', 'DELANTE', 'POR DETRÁS'). */
export function groupCaption(group: TrafficKind, m: Messages): string {
  return m.widgets.traffic[group]
}

/** A hazard is never calm: at least a warning. */
export type HazardTone = 'bad' | 'warn'

interface HazardBadge {
  readonly text: string
  readonly tone: HazardTone
}

interface HazardBadges {
  readonly kinds: Readonly<Record<HazardKind, HazardBadge>>
  /** A hazard without a kind (not expected from the provider): drawn rather than dropped. */
  readonly unknown: HazardBadge
}

/** Badge of each hazard kind (Badge uppercases it) and its tone, per language. */
const hazardBadges = perDictionary((m): HazardBadges => {
  const t = m.widgets.traffic
  return {
    kinds: {
      stopped: { text: t.stopped, tone: 'bad' },
      slow: { text: t.slow, tone: 'warn' },
      'off-track': { text: t.offTrack, tone: 'warn' }
    },
    unknown: { text: t.hazardUnknown, tone: 'warn' }
  }
})

/** What the widget draws of each group (display side; the provider applies them too). */
export interface TrafficViewOptions {
  /** The groups drawn, top to bottom (traffic.groups' shown ids, in order). */
  readonly groups: readonly TrafficKind[]
  /** A caption line above each group (traffic.header 'captions'). */
  readonly captions: boolean
  /** Lines per group, already clamped to the option's range. */
  readonly maxEntries: number
  readonly nameFormat: NameFormat
}

/** The number on the right, split from its unit ('6' + 's', '3.2' + 's', '2' + 'min'). */
export interface ValueParts {
  readonly num: string
  readonly unit: string
}

export interface CaptionSlotView {
  readonly kind: 'caption'
  readonly group: TrafficKind
  readonly css: string
  readonly text: string
}

export interface RowSlotView {
  readonly kind: 'row'
  readonly group: TrafficKind
  /** Class attribute of the line: group, stripe and urgency classes. */
  readonly css: string
  /** By the ETA; a hazard line's is its one tone (hazardTone), never calmer than a warning. */
  readonly urgency: Urgency
  /** `--cls` / `--cls-fg` of the car's class (one shared object per colour). */
  readonly clsStyle: InlineStyle
  /** Class name shown before the car ('GT3' from 'GT3 Class'), '' when unknown or one class. */
  readonly cls: string
  /** Car number, '' when unknown. */
  readonly number: string
  /** Formatted with the widget's name format (DriverCellView.name). */
  readonly name: string
  /** `name` is the 'Piloto #7' placeholder: drawn dim. */
  readonly nameUnknown: boolean
  /** Name colour of a car on another lap (as in the relative), null on your lap. */
  readonly lap: 'ahead' | 'behind' | null
  /** 'Te dobla' / 'Doblado' after the name, '' on your lap. */
  readonly lapBadge: string
  /** Hazard badge ('Parado'), '' for traffic. */
  readonly hazard: string
  /** The badge's fill: the line's tone (the same as its rail, icon and number). */
  readonly hazardTone: Tone
  /** Words before the number ('te alcanza en', 'le alcanzas en', 'a'); hidden when narrow. */
  readonly lead: string
  readonly num: string
  readonly unit: string
  /** Where you meet ('S2'), '' when unknown. */
  readonly sector: string
}

export type TrafficSlotView = CaptionSlotView | RowSlotView

const finite = (v: number | null | undefined): v is number =>
  typeof v === 'number' && Number.isFinite(v)

/** Urgency of an ETA: under 3 s bad, under 8 s warn; idle when not converging. */
export function urgency(etaS: number | null): Urgency {
  if (!finite(etaS)) return 'idle'
  if (etaS < URGENT_S) return 'bad'
  if (etaS < SOON_S) return 'warn'
  return 'normal'
}

/** Urgency of a car passing you under the blue flag, by the road gap to it. */
export function blueUrgency(gapS: number): Urgency {
  const s = Math.abs(gapS)
  if (!Number.isFinite(s)) return 'normal'
  if (s < BLUE_BAD_S) return 'bad'
  if (s < BLUE_WARN_S) return 'warn'
  return 'normal'
}

const SEVERITY: Readonly<Record<Urgency, number>> = { idle: 0, normal: 1, warn: 2, bad: 3 }

/** The more urgent of two. */
export function worseUrgency(a: Urgency, b: Urgency): Urgency {
  return SEVERITY[b] > SEVERITY[a] ? b : a
}

/**
 * Whether a faster line shows the road gap rather than the ETA: a car passing you that is
 * close (PASSING_GAP_S) or closing slowly (PASSING_ETA_S, or not at all).
 */
export function showsPassingGap(e: Pick<TrafficEntry, 'passing' | 'gapS' | 'etaS'>): boolean {
  if (e.passing === null) return false
  if (!finite(e.etaS) || e.etaS > PASSING_ETA_S) return true
  return finite(e.gapS) && Math.abs(e.gapS) < PASSING_GAP_S
}

/**
 * The one tone of a hazard line (rail, icon, number and tag alike): the worse of how soon you
 * reach it and what it is. A stopped car is red even far away; anything under URGENT_S is red
 * whatever it is; an off-track car with no ETA still gets its warning rail.
 */
export function hazardTone(u: Urgency, kind: HazardTone): HazardTone {
  return u === 'bad' || kind === 'bad' ? 'bad' : 'warn'
}

/**
 * An ETA in whole seconds, rounded down (it never reads later than it is, and '2 s' is always
 * under 3 s, so the number and its colour agree): '<1 s', '6 s', from a minute on '2 min'.
 */
export function etaParts(etaS: number): ValueParts {
  const s = Math.max(0, etaS)
  if (s < 1) return { num: '<1', unit: 's' }
  if (s < 60) return { num: String(Math.floor(s)), unit: 's' }
  return { num: String(Math.round(s / 60)), unit: 'min' }
}

/** A distance in seconds of road: '3.2 s' below 10 s, '14 s', from a minute on '2 min'. */
export function gapParts(gapS: number): ValueParts {
  const s = Math.abs(gapS)
  const tenths = Math.round(s * 10) / 10
  if (tenths < 10) return { num: tenths.toFixed(1), unit: 's' }
  if (s < 59.5) return { num: String(Math.round(s)), unit: 's' }
  return { num: String(Math.max(1, Math.round(s / 60))), unit: 'min' }
}

/** Class name of a line: the short name without a trailing 'Class' ('GT3 Class' -> 'GT3'). */
export function classLabel(name: string): string {
  const t = name.trim()
  const short = t.replace(/\s+class$/i, '')
  return short === '' ? t : short
}

/** 'S2' for a 1-based sector (common.sector, like the battle and delta cells), '' when unknown. */
export function sectorLabel(sector: number | null, m: Messages): string {
  return finite(sector) && sector >= 1 ? m.widgets.common.sector(Math.round(sector)) : ''
}

/**
 * The line of one car of `group` (the array it came in, whatever its own `kind` says). `breaks`:
 * the first line of a group below another one with no caption between them (a rule above it).
 */
export function toRowSlot(
  e: TrafficEntry,
  group: TrafficKind,
  index: number,
  styles: DriverStyles,
  nameFormat: NameFormat,
  m: Messages,
  breaks = false
): RowSlotView {
  const t = m.widgets.traffic
  const driver = toDriverCell(e.driver, styles, nameFormat, m)
  const badges = hazardBadges(m)
  const hazard =
    group !== 'hazard' ? null : e.hazard === null ? badges.unknown : badges.kinds[e.hazard]
  // A hazard line has one tone, its tag's included (never a red tag on an orange rail).
  const tone = hazard === null ? null : hazardTone(urgency(e.etaS), hazard.tone)
  const passing = hazard === null && group === 'faster' ? e.passing : null
  let u = tone ?? urgency(e.etaS)
  if (passing === 'blue') u = worseUrgency(u, blueUrgency(e.gapS))
  // A hazard reads 'a 3.2 s' (how far); traffic reads when you meet, or how far while not closing
  // or while a car passing you is close.
  const roadGap = passing !== null && showsPassingGap({ passing, gapS: e.gapS, etaS: e.etaS })
  const eta = hazard === null && finite(e.etaS) && !roadGap ? e.etaS : null
  const value = eta !== null ? etaParts(eta) : gapParts(finite(e.gapS) ? e.gapS : 0)
  const lap = hazard !== null || !e.lapping ? null : group === 'faster' ? 'ahead' : 'behind'
  let css = `tr-row tr-row--${group}`
  if (index % 2 === 1) css += ' is-alt'
  if (breaks) css += ' is-break'
  if (u !== 'normal') css += ` is-${u}`
  return {
    kind: 'row',
    group,
    css,
    urgency: u,
    clsStyle: driver.clsStyle,
    cls: classLabel(e.className),
    number: driver.number,
    name: driver.name,
    nameUnknown: driver.nameUnknown,
    lap,
    lapBadge: lap === 'ahead' ? t.lapping : lap === 'behind' ? t.lapped : '',
    hazard: hazard?.text ?? '',
    hazardTone: tone ?? 'neutral',
    lead: eta === null ? t.at : group === 'faster' ? t.reachesYou : t.youReach,
    num: value.num,
    unit: value.unit,
    sector: sectorLabel(e.meetSector, m)
  }
}

function groupEntries(d: TrafficData, group: TrafficKind): readonly TrafficEntry[] {
  return group === 'faster' ? d.faster : group === 'slower' ? d.slower : d.hazards
}

export interface VisibleGroup {
  readonly group: TrafficKind
  readonly entries: readonly TrafficEntry[]
}

/** The entries of each group the widget draws, in the options' order (empty groups left out). */
export function visibleGroups(d: TrafficData, o: TrafficViewOptions): VisibleGroup[] {
  const out: VisibleGroup[] = []
  if (!d.visible) return out
  const max = Math.max(1, Math.floor(o.maxEntries))
  for (const group of o.groups) {
    if (out.some((g) => g.group === group)) continue
    const entries = groupEntries(d, group)
    if (entries.length > 0) out.push({ group, entries: entries.slice(0, max) })
  }
  return out
}

/** Whether a payload has anything to draw with these options. */
export function hasTraffic(d: TrafficData, o: TrafficViewOptions): boolean {
  return visibleGroups(d, o).length > 0
}

/** The caption of a group as the first line (no separator) and below another group. */
function captionPair(group: TrafficKind, m: Messages): readonly [CaptionSlotView, CaptionSlotView] {
  const base = `tr-cap tr-cap--${group}`
  const text = groupCaption(group, m)
  const make = (css: string): CaptionSlotView =>
    Object.freeze({ kind: 'caption', group, css, text })
  return [make(`${base} is-first`), make(base)]
}

type Captions = Readonly<Record<TrafficKind, readonly [CaptionSlotView, CaptionSlotView]>>

/** Shared caption slots: an unchanged caption is the same object on every update (per language). */
const captions = perDictionary((m): Captions => ({
  hazard: captionPair('hazard', m),
  slower: captionPair('slower', m),
  faster: captionPair('faster', m)
}))

/**
 * Every line, top to bottom: each group's caption (when shown) followed by its cars. Without
 * captions a group's first line below another group carries the separator instead.
 */
export function toSlots(
  d: TrafficData,
  o: TrafficViewOptions,
  styles: DriverStyles,
  m: Messages
): TrafficSlotView[] {
  const out: TrafficSlotView[] = []
  const caps = captions(m)
  for (const { group, entries } of visibleGroups(d, o)) {
    const later = out.length > 0
    if (o.captions) out.push(caps[group][later ? 1 : 0])
    entries.forEach((e, i) =>
      out.push(toRowSlot(e, group, i, styles, o.nameFormat, m, !o.captions && later && i === 0))
    )
  }
  return out
}

/** Everything the panel height depends on besides the width and the font: the line kinds. */
export function layoutKey(slots: readonly TrafficSlotView[]): string {
  let key = ''
  for (const s of slots) key += s.kind === 'caption' ? 'c' : 'r'
  return key
}

/** Whether any line names a class (otherwise the column is dropped: a single-class session). */
export function hasClasses(slots: readonly TrafficSlotView[]): boolean {
  return slots.some((s) => s.kind === 'row' && s.cls !== '')
}

/** Whether any line shows a sector (otherwise the column is dropped). */
export function hasSectors(slots: readonly TrafficSlotView[]): boolean {
  return slots.some((s) => s.kind === 'row' && s.sector !== '')
}
