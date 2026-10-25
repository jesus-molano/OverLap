/**
 * Line view models of the standings widget: every value already formatted and flat (strings,
 * booleans and shared style objects only), so an unchanged line compares equal field by field
 * and keeps its previous object (`reuseViews`) for v-memo. Pure. Words come from the
 * dictionary `m` (messagesFor(lang)); the examples are the Spanish ones.
 */
import {
  formatBestLapGap,
  formatGained,
  formatGapValue,
  formatIRating,
  formatIRatingDelta,
  formatLapTime,
  signAt
} from '@shared/format'
import type { Messages } from '@shared/i18n'
import type {
  CarPenalty,
  GapValue,
  NameFormat,
  StandingsClassBlock,
  StandingsOptions,
  StandingsRow
} from '@shared/types'
import { stintCell, tyreCell } from '@renderer/view/carExtras'
import { toDriverCell, type DriverCellView } from '@renderer/view/driverCell'
import type { DriverStyles, InlineStyle } from '@renderer/view/styles'
import type { IconName } from '@renderer/ui/icons'
import { signTone, type Tone } from '@renderer/ui/tones'
import type { DisplayRow, PlannedLine } from './layout'

/** |iRating change| below this is noise: drawn dim. */
const DELTA_DIM_BELOW = 5
/** Between the parts of a line of meta ('SoF 2.1k', '12 coches'): an en space, no glyph. */
export const META_SEP = '\u2002'

export type GapKind = 'time' | 'laps' | 'leader' | 'none'
/** 'best' = fastest of the class (purple plate), 'pb' = the driver's own best (green key). */
export type LapKind = 'normal' | 'pb' | 'best' | 'none'
/** What the pit cell shows: a badge (in the pits, out lap), the stop count, or the flag. */
export type PitKind = 'pit' | 'out' | 'stops' | 'finished' | 'none'
/** Triangle in front of the positions gained (up: gained, down: lost). */
export type GainedIcon = Extract<IconName, 'arrow-up' | 'arrow-down'>

export interface CarLineView extends DriverCellView {
  /** 'leader': another class's leader on one line, its class tag in front. */
  kind: 'car' | 'leader'
  /** Class attribute of the line element, state classes included. */
  css: string
  /** Class short name of a one-line leader ('LMP2'), else ''. */
  classTag: string
  player: boolean
  /** Class position ('5'), '' when unclassified. */
  pos: string
  /** Off track: the position chip gets the warning ring. */
  posWarn: boolean
  penalty: CarPenalty | null
  disconnected: boolean
  /** Places gained or lost, digits only ('4', after gainedIcon); '' for none or unknown. */
  gained: string
  gainedIcon: GainedIcon | null
  gainedTone: Tone
  /** '+13', '' when not shown on this row. */
  delta: string
  deltaTone: Tone
  /** The 'gap' column: per gap mode, 'LÍDER' for the class leader, '—' when unknown. */
  gap: string
  gapKind: GapKind
  /** The 'gapLeader' column ('' for the leader). */
  gapLeader: string
  gapLeaderKind: GapKind
  /** Last lap in races, best lap in practice and qualifying. */
  lap: string
  lapKind: LapKind
  /** The 'best' column (races only): the best lap, 'best' kind for the class's fastest. */
  best: string
  bestKind: LapKind
  pit: PitKind
  /** Pit stops so far ('2'), '' when none or unknown (a replay). */
  pitStops: string
  /** Lap of the last stop ('V12'), '' before the first one. */
  pitLap: string
  /** Laps of the stint ('7', then stintUnit 'v'); both '' when unknown. */
  stint: string
  stintUnit: string
  /** Tyre compound letter ('H'), '—' when unknown (another car model, or not reported). */
  tyre: string
}

export interface ClassLineView {
  kind: 'class'
  css: string
  clsStyle: InlineStyle
  name: string
  /** 'SoF 2.1k', '12 coches' (en-spaced), per the SoF / car count options; '' if nothing to say. */
  meta: string
}

export type LineView = CarLineView | ClassLineView

export interface LineContext {
  gapMode: StandingsOptions['gapMode']
  /** Race session (otherwise gaps and laps are about best laps). */
  race: boolean
  /** iRating change on every row (otherwise only on yours). */
  deltaAll: boolean
  nameFormat: NameFormat
  showSof: boolean
  showCarCount: boolean
  /** The flag badge after the name (black, meatball, furled). */
  showFlags: boolean
  styles: DriverStyles
  m: Messages
}

// ---------------------------------------------------------------------------
// Cells
// ---------------------------------------------------------------------------

const NO_GAP = { text: '—', kind: 'none' } as const

function gapText(gap: GapValue, race: boolean): string {
  if (gap.kind === 'time' && !race) return formatBestLapGap(gap.seconds)
  return formatGapValue(gap)
}

/**
 * The 'gap' column. Interval or gap to the leader per `gapMode` (in practice and qualifying
 * 'interval' means the gap to the best lap, as on every timing screen); when the chosen value
 * is missing for a classified car, the other one stands in, so a mode switch never blanks the
 * column. The class leader reads 'LÍDER'; anything else unknown '—'.
 */
export function gapCell(
  row: StandingsRow,
  gapMode: StandingsOptions['gapMode'],
  race: boolean,
  m: Messages
): { text: string; kind: GapKind } {
  const toLeader = gapMode === 'leader' || (!race && gapMode === 'interval')
  const first = toLeader ? row.gapToLeader : row.interval
  const gap = first ?? (toLeader ? row.interval : row.gapToLeader)
  if (gap === null) {
    return row.classPosition === 1 ? { text: m.widgets.standings.leader, kind: 'leader' } : NO_GAP
  }
  const text = gapText(gap, race)
  return text === '' ? NO_GAP : { text, kind: gap.kind }
}

/** The 'gapLeader' column: always the gap to the class leader; blank on the leader itself. */
export function gapLeaderCell(row: StandingsRow, race: boolean): { text: string; kind: GapKind } {
  const gap = row.gapToLeader
  if (gap === null) return row.classPosition === 1 ? { text: '', kind: 'leader' } : NO_GAP
  const text = gapText(gap, race)
  return text === '' ? NO_GAP : { text, kind: gap.kind }
}

export function pitKind(row: StandingsRow): PitKind {
  if (row.status === 'finished') return 'finished'
  if (row.status === 'pits') return 'pit'
  if (row.outLap) return 'out'
  return (row.pitStops ?? 0) > 0 ? 'stops' : 'none'
}

/** Race: the last lap and its kind. Elsewhere: the best lap, filled for the class's best. */
export function lapCell(row: StandingsRow, race: boolean): { text: string; kind: LapKind } {
  if (!race) {
    const text = formatLapTime(row.bestLap)
    if (text === '—') return { text, kind: 'none' }
    return { text, kind: row.classPosition === 1 ? 'best' : 'normal' }
  }
  const text = formatLapTime(row.lastLap)
  if (text === '—') return { text, kind: 'none' }
  const kind: LapKind =
    row.lastLapKind === 'class-best'
      ? 'best'
      : row.lastLapKind === 'personal-best'
        ? 'pb'
        : 'normal'
  return { text, kind }
}

/** The 'best' column (races only): the best lap, filled when it is the class's fastest. */
export function bestCell(row: StandingsRow): { text: string; kind: LapKind } {
  const text = formatLapTime(row.bestLap)
  if (text === '—') return { text, kind: 'none' }
  return { text, kind: row.bestLapKind === 'class-best' ? 'best' : 'normal' }
}

/**
 * The 'pitLap' column: the lap of the last stop ('V12'); '' before the first one, also for a
 * pit-lane start (it left the pits, but that was no stop).
 */
export function pitLapCell(row: StandingsRow, m: Messages): string {
  const lap = row.lastPitLap
  if ((row.pitStops ?? 0) <= 0 || lap === null || !Number.isFinite(lap) || lap < 0) return ''
  return m.widgets.laps.number(lap)
}

const NO_GAIN = Object.freeze({ text: '', icon: null })

/**
 * Positions gained since the start: the count without sign ('4', formatGained) and a triangle
 * for its direction. None (rounds to 0) or unknown: an empty cell, no placeholder glyph.
 */
export function gainedCell(n: number | null): {
  readonly text: string
  readonly icon: GainedIcon | null
} {
  const sign = signAt(n, 0)
  if (sign === null || sign === 0) return NO_GAIN
  return { text: formatGained(n), icon: sign > 0 ? 'arrow-up' : 'arrow-down' }
}

function deltaTone(delta: number | null): Tone {
  if (delta === null || !Number.isFinite(delta) || Math.abs(delta) < DELTA_DIM_BELOW) return 'dim'
  return signTone(delta)
}

function carCss(row: StandingsRow, alt: boolean, sep: boolean, leader: boolean): string {
  let css = leader ? 'sd-line sd-car sd-leader' : 'sd-line sd-car'
  if (alt) css += ' is-alt'
  if (sep) css += ' is-sep'
  if (row.isPlayer) css += ' ov-player'
  if (row.status !== 'running') css += ` is-${row.status}`
  return css
}

function toCarView(
  row: DisplayRow,
  ctx: LineContext,
  o: { alt: boolean; sep: boolean; classTag: string }
): CarLineView {
  const gap = gapCell(row, ctx.gapMode, ctx.race, ctx.m)
  const gapLeader = gapLeaderCell(row, ctx.race)
  const lap = lapCell(row, ctx.race)
  const best = bestCell(row)
  const stint = stintCell(row.stintLaps, ctx.m)
  const gained = ctx.race ? gainedCell(row.positionsGained) : NO_GAIN
  const showDelta = ctx.race && (ctx.deltaAll || row.isPlayer)
  const leader = o.classTag !== ''
  return {
    ...toDriverCell(row, ctx.styles, ctx.nameFormat, ctx.m),
    kind: leader ? 'leader' : 'car',
    css: carCss(row, o.alt, o.sep, leader),
    classTag: o.classTag,
    player: row.isPlayer,
    pos: row.classPosition > 0 ? String(row.classPosition) : '',
    posWarn: row.status === 'off-track',
    penalty: ctx.showFlags ? row.penalty : null,
    disconnected: row.status === 'disconnected',
    gained: gained.text,
    gainedIcon: gained.icon,
    gainedTone: signTone(row.positionsGained),
    delta: showDelta ? formatIRatingDelta(row.iRatingDelta) : '',
    deltaTone: showDelta ? deltaTone(row.iRatingDelta) : 'dim',
    gap: gap.text,
    gapKind: gap.kind,
    gapLeader: gapLeader.text,
    gapLeaderKind: gapLeader.kind,
    lap: lap.text,
    lapKind: lap.kind,
    best: best.text,
    bestKind: best.kind,
    pit: pitKind(row),
    pitStops: row.pitStops !== null && row.pitStops > 0 ? String(row.pitStops) : '',
    pitLap: pitLapCell(row, ctx.m),
    stint: stint.text,
    stintUnit: stint.unit,
    tyre: tyreCell(row.tyre)
  }
}

/** 'SoF 2.1k', '12 coches' (either part optional), en-spaced; '' when both are off or unknown. */
export function classMeta(
  block: Pick<StandingsClassBlock, 'sof' | 'carCount'>,
  showSof: boolean,
  showCarCount: boolean,
  m: Messages
): string {
  const t = m.widgets.standings
  const parts: string[] = []
  const sof = showSof ? formatIRating(block.sof) : ''
  if (sof !== '') parts.push(t.sof(sof))
  if (showCarCount && block.carCount > 0) parts.push(t.cars(block.carCount))
  return parts.join(META_SEP)
}

/** The class's short name, or 'Clase 30' when the session info gives it none. */
export function className(
  block: Pick<StandingsClassBlock, 'classId' | 'className'>,
  m: Messages
): string {
  return block.className.trim() || m.widgets.standings.unnamedClass(block.classId)
}

function toClassView(block: StandingsClassBlock, ctx: LineContext): ClassLineView {
  return {
    kind: 'class',
    css: block.isPlayerClass ? 'sd-line sd-class is-own' : 'sd-line sd-class',
    clsStyle: ctx.styles.cls(block.classColor),
    name: className(block, ctx.m),
    meta: classMeta(block, ctx.showSof, ctx.showCarCount, ctx.m)
  }
}

export function toLineViews(lines: readonly PlannedLine[], ctx: LineContext): LineView[] {
  return lines.map((l) => {
    if (l.kind === 'class') return toClassView(l.block, ctx)
    if (l.kind === 'leader') {
      const tag = className(l.block, ctx.m)
      return toCarView(l.row, ctx, { alt: false, sep: false, classTag: tag })
    }
    return toCarView(l.row, ctx, { alt: l.alt, sep: l.gapBefore, classTag: '' })
  })
}
