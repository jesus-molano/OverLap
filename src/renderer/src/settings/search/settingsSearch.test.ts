import { describe, expect, it } from 'vitest'
import { messagesFor } from '@shared/i18n'
import { pageTitle, type SettingsPage } from '../nav'
import { SEARCH_LIMIT, isPlainOption, searchSettings, type SearchEntry } from './settingsSearch'

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

describe('everyday words (R33)', () => {
  const MORE: SearchEntry[] = [
    e('appearance', 'label', 'Tamaño de esta ventana', 'Accesibilidad'),
    e('appearance', 'label', 'Sin parpadeos', 'Accesibilidad'),
    e('appearance', 'label', 'Paleta para daltónicos', 'Accesibilidad'),
    e('relative', 'label', 'Bloqueado', 'Ventana y visibilidad'),
    e('appearance', 'item', 'Compacto', 'Estilo', 'Pequeño y legible')
  ]
  const first = (q: string): string | undefined => searchSettings(MORE, q, title)[0]?.text

  it('finds a setting by a word its label does not have', () => {
    expect(first('zoom')).toBe('Tamaño de esta ventana')
    expect(first('destello')).toBe('Sin parpadeos')
    expect(first('daltonismo')).toBe('Paleta para daltónicos')
    expect(first('fijar')).toBe('Bloqueado')
  })

  it('finds a participle by its infinitive, and a style by its name', () => {
    expect(first('bloquear')).toBe('Bloqueado')
    expect(first('compacto')).toBe('Compacto')
  })
})

describe('buttons, options and everyday phrases (five-of-five)', () => {
  const MORE: SearchEntry[] = [
    e('about', 'action', 'Exportar todo…', 'Copia de seguridad', 'Guarda todos los ajustes'),
    e('layouts', 'action', 'Exportar…', 'Disposiciones'),
    e('relative', 'action', 'Editar posición'),
    e('relative', 'action', 'Restablecer…'),
    e('about', 'option', 'Imperiales', 'General › Unidades', 'mph, °F, galones, pies'),
    e('about', 'option', 'English', 'General › Idioma'),
    e('appearance', 'option', 'Apellido', 'Filas y pilotos › Formato de nombre'),
    e('appearance', 'item', 'Compacto', 'Estilo', 'Nombre por apellido'),
    e('lights', 'label', 'Luces de cambio', 'Contenido'),
    e('layouts', 'label', 'Coche actual', 'Disposiciones'),
    e('layouts', 'label', 'Según el coche', 'Cambiar sola'),
    e(
      'shortcuts',
      'page',
      'Atajos',
      '',
      'Teclas o botones del volante que funcionan en todo Windows'
    ),
    e('shortcuts', 'label', 'Mostrar u ocultar el overlay', 'Acciones'),
    e('appearance', 'label', 'Tamaño del texto', 'Texto', 'Multiplica la escala'),
    e('appearance', 'label', 'Texto mínimo de 10 px', 'Accesibilidad', 'Para leerlo más grande'),
    e('relative', 'label', 'Banderas de penalización', 'Piloto'),
    // A label whose help alone has both words: after one that has some in its name.
    e('battle', 'label', 'Escala', 'Ventana', 'Texto y ventana más grandes o más pequeños')
  ]
  const texts = (q: string): string[] => searchSettings(MORE, q, title).map((x) => x.text)
  const first = (q: string): string | undefined => texts(q)[0]

  it('finds a button by its words', () => {
    expect(texts('exportar')).toEqual(['Exportar…', 'Exportar todo…'])
    expect(first('exportar todo')).toBe('Exportar todo…')
    expect(first('editar posicion')).toBe('Editar posición')
    expect(first('mover')).toBe('Editar posición')
    expect(first('restablecer')).toBe('Restablecer…')
    expect(first('copia')).toBe('Exportar todo…')
  })

  it("finds a segmented control's option, also by its hint", () => {
    expect(first('imperial')).toBe('Imperiales')
    expect(first('galones')).toBe('Imperiales')
    expect(first('pies')).toBe('Imperiales')
    expect(first('ingles')).toBe('English')
    // The option before the style that only names it in its help.
    expect(texts('apellido')).toEqual(['Apellido', 'Compacto'])
  })

  it('leaves out the words that tell nothing apart, and knows a few phrases', () => {
    expect(first('por coche')).toBe('Según el coche')
    expect(first('el coche')).toBe('Coche actual')
    expect(first('rpm')).toBe('Luces de cambio')
    expect(first('cambio de marcha')).toBe('Luces de cambio')
    expect(first('sanciones')).toBe('Banderas de penalización')
  })

  it('takes a key or a wheel button to Atajos', () => {
    expect(texts('tecla')).toContain('Mostrar u ocultar el overlay')
    expect(first('tecla')).toBe('Atajos')
    expect(texts('boton volante')).toContain('Mostrar u ocultar el overlay')
    expect(texts('botón del volante')).toContain('Mostrar u ocultar el overlay')
  })

  it('«letra grande»: the text size first, then the 10 px minimum', () => {
    expect(texts('letra grande').slice(0, 2)).toEqual(['Tamaño del texto', 'Texto mínimo de 10 px'])
  })

  it('never indexes the options every control has', () => {
    expect(isPlainOption('Sí')).toBe(true)
    expect(isPlainOption('No')).toBe(true)
    expect(isPlainOption('Global (80 %)')).toBe(true)
    expect(isPlainOption('Imperiales')).toBe(false)
    expect(isPlainOption('Normal')).toBe(false)
  })
})
