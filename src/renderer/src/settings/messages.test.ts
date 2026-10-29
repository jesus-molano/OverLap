import { describe, expect, it } from 'vitest'
import { messagesFor } from '@shared/i18n'
import { OPTION_SCHEMA } from '@shared/settingsSchema'
import { choiceOptions } from './controls/choice'

/** Every leaf of a dictionary group as [path, text]; functions are called with sample values. */
function leaves(node: unknown, path = ''): [string, string][] {
  if (typeof node === 'string') return [[path, node]]
  if (typeof node === 'function') {
    const args = Array.from({ length: node.length }, (_, i) => (i === 0 ? 'X' : 2))
    return [[`${path}()`, String((node as (...a: unknown[]) => unknown)(...args))]]
  }
  if (typeof node === 'object' && node !== null) {
    return Object.entries(node).flatMap(([k, v]) => leaves(v, path ? `${path}.${k}` : k))
  }
  return [[path, '']]
}

const es = messagesFor('es').settings
const en = messagesFor('en').settings

describe('settings dictionary', () => {
  it('has the same keys in both languages and no empty text', () => {
    const esLeaves = leaves(es)
    const enLeaves = leaves(en)
    expect(enLeaves.map(([p]) => p)).toEqual(esLeaves.map(([p]) => p))
    for (const [path, text] of [...esLeaves, ...enLeaves]) expect(text.trim(), path).not.toBe('')
  })

  it('translates every sentence (only names and short codes may match)', () => {
    const enText = new Map(leaves(en))
    const same = leaves(es)
      .filter(([path, text]) => text.length > 12 && enText.get(path) === text)
      .map(([path]) => path)
    expect(same).toEqual([])
  })

  it('words the window chrome in English', () => {
    expect(en.nav.title).toBe('Settings')
    expect(en.app.loading).toBe('Loading settings…')
    expect(en.editMode.enter).toBe('Edit mode')
    expect(en.visibility.hide('Radar')).toBe('Hide Radar')
    expect(en.widgetPage.sizeAuto(460, '100%')).toBe('Auto height · 460 px wide · 100%')
    expect(es.widgetPage.sizeAuto(460, '100 %')).toBe('Alto automático · 460 px de ancho · 100 %')
  })

  it('offers the language choice in Spanish and English', () => {
    expect(es.appearance.language.title).toBe('Idioma')
    expect(en.appearance.language.title).toBe('Language')
    expect(en.appearance.language.help).toBe(
      'Language of the widgets, the settings and the tray menu'
    )
  })

  it('words a choice group in each language', () => {
    const values = OPTION_SCHEMA.delta.referenceRace.values
    expect(choiceOptions(values, es.delta.references).map((o) => o.label)).toEqual([
      'Récord personal',
      'Mejor vuelta de la sesión',
      'Vuelta óptima',
      'Mejor de tu clase',
      'Óptima de tu clase'
    ])
    expect(choiceOptions(values, en.delta.references).map((o) => o.label)).toEqual([
      'Personal best',
      'Session best',
      'Optimal lap',
      'Class best',
      'Class optimal'
    ])
    expect(
      choiceOptions(['top', 'bottom'] as const, en.window.anchorChoices).map((o) => o.label)
    ).toEqual(['Down', 'Up'])
  })
})
