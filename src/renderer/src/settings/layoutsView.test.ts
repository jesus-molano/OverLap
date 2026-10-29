import { describe, expect, it } from 'vitest'
import { messagesFor } from '@shared/i18n'
import { linkCar, noteSeenCar, saveLayoutAs } from '@shared/layouts'
import { createDefaultSettings } from '@shared/settings'
import { carRows, layoutRows, noticeText } from './layoutsView'

const es = messagesFor('es')
const en = messagesFor('en')
const MAZDA = { carId: 67, carName: 'Mazda MX-5 Cup' }

describe('layoutRows', () => {
  it('marks the one in use, what can be deleted and moved, and the linked cars', () => {
    const s = createDefaultSettings()
    saveLayoutAs(s, 'Mazda')
    linkCar(s, MAZDA, 'layout-2')
    linkCar(s, { carId: 9, carName: '' }, 'layout-2')
    expect(layoutRows(es, s.savedLayouts)).toEqual([
      {
        id: 'layout-1',
        name: 'Principal',
        active: false,
        canDelete: true,
        canMoveUp: false,
        canMoveDown: true,
        cars: ''
      },
      {
        id: 'layout-2',
        name: 'Mazda',
        active: true,
        canDelete: false,
        canMoveUp: true,
        canMoveDown: false,
        cars: 'Coches: Mazda MX-5 Cup, Coche 9'
      }
    ])
  })
})

describe('carRows', () => {
  it('puts the car you are in first, with its link', () => {
    const s = createDefaultSettings()
    noteSeenCar(s, { carId: 132, carName: 'GT3' })
    linkCar(s, MAZDA, 'layout-1')
    const rows = carRows(es, s.savedLayouts, MAZDA)
    expect(rows.map((r) => [r.label, r.layoutId, r.current])).toEqual([
      ['Mazda MX-5 Cup', 'layout-1', true],
      ['GT3', '', false]
    ])
  })
})

describe('noticeText', () => {
  it('words every export and import result in both languages', () => {
    expect(noticeText(es, { kind: 'exported', name: 'Mazda' })).toEqual({
      text: 'Exportada: Mazda',
      error: false
    })
    expect(noticeText(en, { kind: 'imported', name: 'GT3' }).text).toBe(
      'Imported: GT3. Apply it whenever you like'
    )
    expect(noticeText(es, { kind: 'export-failed', name: 'X' }).error).toBe(true)
    for (const error of [
      'json',
      'format',
      'version',
      'empty',
      'too-big',
      'read',
      'full'
    ] as const) {
      const n = noticeText(es, { kind: 'import-failed', error })
      expect(n.error).toBe(true)
      expect(n.text.length, error).toBeGreaterThan(0)
    }
  })
})
