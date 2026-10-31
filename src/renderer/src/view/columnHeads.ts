/**
 * Column headers of the relative and the standings (their `columnHeads` option): the short,
 * bilingual caption of each column id, aligned like its cells, in the columns' own order (the
 * caller maps its visible cells through these). The standings' gap headers follow the gap mode
 * and the session the way its cells do (gapShowsLeader), so a header never disagrees with its
 * column. Pure; words from widgets.heads.
 */
import type { Messages } from '@shared/i18n'
import type {
  LicenseStyle,
  RelativeColumnId,
  StandingsColumnId,
  StandingsOptions
} from '@shared/types'

/** How a header sits over its column: names left, figures right, chips centred. */
export type HeadAlign = 'start' | 'center' | 'end'

export interface ColumnHead {
  /** 'POS', 'INT.', 'LÍDER'; '' for a column with no caption (the tyre ring, the flags: glyphs). */
  readonly label: string
  readonly align: HeadAlign
}

export interface StandingsHeadContext {
  gapMode: StandingsOptions['gapMode']
  /** A race session: outside races the gap is to the fastest lap and 'last' shows the best. */
  race: boolean
  licenseStyle: LicenseStyle
}

/**
 * The standings' 'gap' column shows the gap to the class leader (else to the car ahead): in
 * 'leader' mode, and outside races in 'interval' mode (the gap to the fastest lap is to the
 * leader there). The same rule as the column's cells (widgets/standings/view.ts gapCell).
 */
export function gapShowsLeader(gapMode: StandingsOptions['gapMode'], race: boolean): boolean {
  return gapMode === 'leader' || (!race && gapMode === 'interval')
}

/** The licence column's caption: its SR with the styles that show one, else the letter's. */
function licHead(style: LicenseStyle, m: Messages): string {
  return style === 'letter' ? m.widgets.heads.lic : m.widgets.heads.sr
}

/** Header of a relative column; `race` as the standings' (outside races 'last' shows the best). */
export function relativeHead(
  id: RelativeColumnId,
  licenseStyle: LicenseStyle,
  m: Messages,
  race = true
): ColumnHead {
  const h = m.widgets.heads
  switch (id) {
    case 'pos':
      return { label: h.pos, align: 'start' }
    case 'number':
      return { label: h.number, align: 'start' }
    case 'driver':
      return { label: h.driver, align: 'start' }
    // Glyphs: no caption.
    case 'brand':
    case 'country':
      return { label: '', align: 'center' }
    case 'lic':
      return { label: licHead(licenseStyle, m), align: 'center' }
    case 'ir':
      return { label: h.ir, align: 'end' }
    case 'pit':
      return { label: h.pit, align: 'center' }
    case 'tyre':
    case 'flags':
      return { label: '', align: 'center' }
    case 'stint':
      return { label: h.stint, align: 'end' }
    case 'gap':
      return { label: h.gap, align: 'end' }
    case 'last':
      return { label: race ? h.last : h.best, align: 'end' }
  }
}

/** Header of a standings column (the row's start's as the relative's). */
export function standingsHead(
  id: StandingsColumnId,
  c: StandingsHeadContext,
  m: Messages
): ColumnHead {
  const h = m.widgets.heads
  switch (id) {
    case 'pos':
      return { label: h.pos, align: 'start' }
    case 'number':
      return { label: h.number, align: 'start' }
    case 'driver':
      return { label: h.driver, align: 'start' }
    case 'brand':
    case 'country':
    case 'flags':
      return { label: '', align: 'center' }
    case 'gained':
      return { label: h.gained, align: 'end' }
    case 'ir':
      return { label: h.ir, align: 'end' }
    case 'lic':
      return { label: licHead(c.licenseStyle, m), align: 'center' }
    case 'delta':
      return { label: h.delta, align: 'end' }
    case 'gap':
      return {
        label: gapShowsLeader(c.gapMode, c.race) ? (c.race ? h.leader : h.toBest) : h.interval,
        align: 'end'
      }
    case 'gapLeader':
      return { label: c.race ? h.leader : h.toBest, align: 'end' }
    case 'last':
      return { label: c.race ? h.last : h.best, align: 'end' }
    case 'best':
      return { label: h.best, align: 'end' }
    case 'pit':
      return { label: h.pit, align: 'center' }
    case 'pitLap':
      return { label: h.pitLap, align: 'end' }
    case 'stint':
      return { label: h.stint, align: 'end' }
    case 'tyre':
      return { label: '', align: 'center' }
  }
}
