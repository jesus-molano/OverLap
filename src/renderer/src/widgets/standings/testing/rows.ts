/** Standings payload fixtures for the widget's unit tests. */
import type { StandingsClassBlock, StandingsColumn, StandingsColumnId } from '@shared/types'
import { OPTION_SCHEMA } from '@shared/settingsSchema'
import type { DisplayRow } from '../layout'

export function makeRow(over: Partial<DisplayRow> = {}): DisplayRow {
  return {
    carIdx: 1,
    isPlayer: false,
    classPosition: 1,
    positionsGained: null,
    carNumber: '1',
    driverName: 'Driver One',
    classColor: '#ff0000',
    iRating: 1500,
    licString: 'B 3.41',
    licColor: '#00c702',
    interval: null,
    gapToLeader: null,
    lastLap: null,
    lastLapKind: 'normal',
    bestLap: null,
    pitStops: 0,
    lastPitLap: null,
    outLap: false,
    status: 'running',
    penalty: null,
    iRatingDelta: null,
    gapBefore: false,
    ...over
  }
}

/** A class block with rows at the given class positions; `player` marks one of them. */
export function block(
  positions: readonly number[],
  over: Partial<Omit<StandingsClassBlock, 'rows'>> = {},
  player?: number
): StandingsClassBlock {
  return {
    classId: 1,
    className: 'GT3',
    classColor: '#ff0000',
    sof: 2100,
    carCount: positions.length,
    isPlayerClass: player !== undefined,
    ...over,
    rows: positions.map((p) =>
      makeRow({ carIdx: p, classPosition: p, carNumber: String(p), isPlayer: p === player })
    )
  }
}

/** The default standings column list (schema order and visibility). */
export function defaultColumns(): StandingsColumn[] {
  return OPTION_SCHEMA.standings.columns.default.map((c) => ({ ...c }))
}

/** Every column visible, in the given order (default order when omitted). */
export function allColumns(order?: readonly StandingsColumnId[]): StandingsColumn[] {
  const ids = order ?? defaultColumns().map((c) => c.id)
  return ids.map((id) => ({ id, visible: true }))
}
