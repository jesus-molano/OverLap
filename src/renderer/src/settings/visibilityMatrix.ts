/**
 * The overview of where each widget shows («Visibilidad › Dónde se ve cada widget», R34): one row
 * per widget, in its group, one cell per rule, each the same value as the row on the widget's own
 * page («Ventana y visibilidad»). Pure: the page attaches the setters.
 */
import { widgetTitle, type Messages } from '@shared/i18n'
import { SHOW_IN_KINDS } from '@shared/settingsSchema'
import type { OverlaySettings, VisibilityOptions } from '@shared/types'
import { WIDGET_GROUPS, canHideInPits, type WidgetGroupId, type WidgetId } from '@shared/widgets'
import { sessionScreenSwitch } from './replayWidgets'

export const MATRIX_COLUMNS = ['visible', ...SHOW_IN_KINDS, 'pits', 'session', 'locked'] as const

export type MatrixColumn = (typeof MATRIX_COLUMNS)[number]

export interface MatrixCellView {
  col: MatrixColumn
  /** Its accessible name: 'Batalla: Práctica'. */
  label: string
  /**
   * Ticked: on, shown in that session, hidden in the pits, kept on the session screen or locked:
   * each the same meaning as its row on the widget's page («Ocultar en boxes» included).
   */
  current: boolean
  disabled: boolean
  /** Why it cannot change (its tooltip), when it cannot. */
  hint: string | undefined
}

export interface MatrixRow {
  id: WidgetId
  name: string
  on: boolean
  cells: MatrixCellView[]
}

export interface MatrixGroup {
  id: WidgetGroupId
  title: string
  rows: MatrixRow[]
}

export function matrixRows(
  m: Messages,
  s: OverlaySettings,
  visibility: Pick<VisibilityOptions, 'hideOnSessionScreen' | 'replays' | 'showWhen'>
): MatrixGroup[] {
  const v = m.settings.visibilityPage
  const row = (id: WidgetId): MatrixRow => {
    const w = s.widgets[id]
    const name = widgetTitle(m, id)
    const session = sessionScreenSwitch(m, id, visibility, w.showOnSessionScreen)
    const pitsFixed = !canHideInPits(id)
    const cell = (col: MatrixColumn, current: boolean, hint?: string): MatrixCellView => ({
      col,
      label: v.cell(name, v.cols[col]),
      current,
      disabled: hint !== undefined,
      hint
    })
    return {
      id,
      name,
      on: w.visible,
      cells: [
        cell('visible', w.visible),
        ...SHOW_IN_KINDS.map((kind) => cell(kind, w.showIn[kind])),
        cell('pits', !pitsFixed && w.hideInPits, pitsFixed ? v.pitsAlways(name) : undefined),
        cell('session', session.on, session.disabled ? session.help : undefined),
        cell('locked', w.locked)
      ]
    }
  }
  return WIDGET_GROUPS.map((g) => ({
    id: g.id,
    title: m.core.widgetGroups[g.id],
    rows: g.widgets.map(row)
  }))
}
