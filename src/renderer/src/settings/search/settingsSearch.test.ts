import { describe, expect, it } from 'vitest'
import { messagesFor } from '@shared/i18n'
import { pageTitle, type SettingsPage } from '../nav'
import { SEARCH_LIMIT, searchSettings, type SearchEntry } from './settingsSearch'

const es = messagesFor('es')
const title = (p: SettingsPage): string => pageTitle(es, p)

const e = (
  page: SettingsPage,
  kind: SearchEntry['kind'],
  text: string,
  context = '',
  help = ''
): SearchEntry => ({ page, kind, text, context, help })

const INDEX: SearchEntry[] = [
  e('fuel', 'page', 'Combustible'),
  e('fuel', 'label', 'Vueltas para la media', 'Contenido', 'Cuántas de tus últimas vueltas'),
  e('standings', 'item', 'Vueltas de combustible', 'Pie'),
  e('relative', 'item', 'Vueltas de combustible', 'Cabecera'),
  e('standings', 'zone', 'Pie', 'Personalizar'),
  e('appearance', 'label', 'Tamaño del texto', 'Texto', 'Multiplica la escala'),
  e('visibility', 'section', 'Cuándo se ve el overlay'),
  e('relative', 'label', 'Escala', 'Ventana y visibilidad', 'Tamaño de la ventana')
]

describe('searchSettings (R33)', () => {
  it('finds a setting by its words, whatever the case and the accents', () => {
    const r = searchSettings(INDEX, 'VUELTAS combustible', title)
    expect(r.map((x) => [x.page, x.text, x.context])).toEqual([
      ['standings', 'Vueltas de combustible', 'Pie'],
      ['relative', 'Vueltas de combustible', 'Cabecera'],
      // The page's name counts too, with less weight.
      ['fuel', 'Vueltas para la media', 'Contenido']
    ])
    expect(searchSettings(INDEX, 'cuando se ve', title)[0]?.text).toBe('Cuándo se ve el overlay')
  })

  it('narrows by the section: "pie vueltas" is the footer item first', () => {
    const r = searchSettings(INDEX, 'pie vueltas', title)
    expect(r[0]).toMatchObject({
      page: 'standings',
      text: 'Vueltas de combustible',
      context: 'Pie'
    })
  })

  it('ranks the label before its help, and a page a little before a label', () => {
    const r = searchSettings(INDEX, 'escala', title)
    expect(r.map((x) => x.text)).toEqual(['Escala', 'Tamaño del texto'])
    expect(searchSettings(INDEX, 'combustible', title)[0]).toMatchObject({ kind: 'page' })
  })

  it('finds nothing for a blank query, and keeps to the limit', () => {
    expect(searchSettings(INDEX, '   ', title)).toEqual([])
    const many = Array.from({ length: 40 }, (_, i) => e('fuel', 'label', `Dato ${i}`))
    expect(searchSettings(many, 'dato', title)).toHaveLength(SEARCH_LIMIT)
  })

  it('lists one result per page, text and section', () => {
    const twice = [...INDEX, e('standings', 'item', 'Vueltas de combustible', 'Pie')]
    expect(
      searchSettings(twice, 'vueltas de combustible', title).filter((x) => x.page === 'standings')
    ).toHaveLength(1)
  })
})
