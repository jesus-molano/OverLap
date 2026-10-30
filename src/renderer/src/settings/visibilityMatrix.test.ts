import { describe, expect, it } from 'vitest'
import { messagesFor } from '@shared/i18n'
import { createDefaultSettings } from '@shared/settings'
import { WIDGET_LIST_ORDER, type WidgetId } from '@shared/widgets'
import { MATRIX_COLUMNS, matrixRows, type MatrixRow } from './visibilityMatrix'

const es = messagesFor('es')

function rowOf(groups: ReturnType<typeof matrixRows>, id: WidgetId): MatrixRow {
  const r = groups.flatMap((g) => g.rows).find((x) => x.id === id)
  if (!r) throw new Error(id)
  return r
}

const ticks = (r: MatrixRow): Record<string, boolean> =>
  Object.fromEntries(r.cells.map((c) => [c.col, c.current]))

describe('matrixRows (R34)', () => {
  it('has every widget once, in its group, with every column', () => {
    const s = createDefaultSettings()
    const groups = matrixRows(es, s, s.visibility)
    expect(groups.map((g) => g.title)).toEqual(['Pista y rivales', 'Tu vuelta', 'Estado del coche'])
    expect(groups.flatMap((g) => g.rows.map((r) => r.id))).toEqual(WIDGET_LIST_ORDER)
    for (const r of groups.flatMap((g) => g.rows)) {
      expect(r.cells.map((c) => c.col)).toEqual([...MATRIX_COLUMNS])
    }
  })

  it('shows the defaults a new user does not see: battle and fuel in races only', () => {
    const s = createDefaultSettings()
    const groups = matrixRows(es, s, s.visibility)
    expect(ticks(rowOf(groups, 'battle'))).toMatchObject({
      practice: false,
      qualify: false,
      race: true
    })
    expect(ticks(rowOf(groups, 'fuel'))).toMatchObject({
      practice: false,
      qualify: false,
      race: true
    })
    expect(ticks(rowOf(groups, 'relative'))).toMatchObject({ practice: true, race: true })
  })

  it('reads the pits as the page does («Ocultar en boxes»), fixed for the alerts with why', () => {
    const s = createDefaultSettings()
    s.widgets.relative.hideInPits = true
    s.widgets.standings.hideInPits = false
    const groups = matrixRows(es, s, s.visibility)
    expect(ticks(rowOf(groups, 'relative')).pits).toBe(true)
    expect(ticks(rowOf(groups, 'standings')).pits).toBe(false)
    const alerts = rowOf(groups, 'alerts').cells.find((c) => c.col === 'pits')
    expect(alerts).toMatchObject({ current: false, disabled: true })
    expect(alerts?.hint).toContain('Avisos')
  })

  it('takes the session screen from the widget page rule, disabled where it means nothing', () => {
    const s = createDefaultSettings()
    const groups = matrixRows(es, s, s.visibility)
    expect(rowOf(groups, 'radar').cells.find((c) => c.col === 'session')).toMatchObject({
      current: false,
      disabled: true
    })
    expect(rowOf(groups, 'standings').cells.find((c) => c.col === 'session')?.label).toBe(
      'Posiciones: Pantalla de sesión'
    )
  })

  it('follows the eye and the lock', () => {
    const s = createDefaultSettings()
    s.widgets.delta.visible = false
    s.widgets.delta.locked = true
    const r = rowOf(matrixRows(es, s, s.visibility), 'delta')
    expect(r.on).toBe(false)
    expect(ticks(r)).toMatchObject({ visible: false, locked: true })
  })
})
