import { describe, expect, it } from 'vitest'
import { planStyle, presetValues } from '@shared/appearancePresets'
import { messagesFor } from '@shared/i18n'
import { applySettingsPatch, createDefaultSettings } from '@shared/settings'
import type { LayoutLibrary } from '@shared/types'
import { trapStep } from './dialogFocus'
import { STYLE_LINES_SHOWN, foldGroups, styleChangeGroups, styleWhere } from './styleChanges'

const es = messagesFor('es')
const en = messagesFor('en')

describe('the style confirmation’s list', () => {
  it('says the look old → new in Apariencia’s own words', () => {
    const s = createDefaultSettings()
    s.appearance.backgroundOpacity = 0.55
    const groups = styleChangeGroups(es, planStyle(s, 'clean').changes)
    expect(groups[0]?.title).toBe('Aspecto de todos los widgets')
    expect(groups[0]?.lines).toContainEqual({
      text: 'Fondo de los widgets',
      from: '55 %',
      to: '0 %'
    })
    expect(groups[0]?.lines).toContainEqual({ text: 'Bandera del país', from: 'Sí', to: 'No' })
    expect(groups[0]?.lines).toContainEqual({
      text: 'Contorno del texto',
      from: 'Auto',
      to: 'Siempre'
    })
    expect(groups).toHaveLength(1)
  })

  it('then what each widget shows, one line a widget, what it gains counted', () => {
    const groups = styleChangeGroups(es, planStyle(createDefaultSettings(), 'complete').changes)
    const contents = groups.find((g) => g.title === 'Lo que muestra cada widget')
    const standings = contents?.lines.find((l) => l.text.startsWith('Posiciones: '))
    expect(standings?.text).toContain('se muestran 5 columnas más')
    expect(contents?.lines.find((l) => l.text.startsWith('Combustible: '))?.text).toContain(
      '2 elementos más'
    )
    const enGroups = styleChangeGroups(en, planStyle(createDefaultSettings(), 'complete').changes)
    const enLines = enGroups.find((g) => g.title === 'What each widget shows')?.lines ?? []
    expect(enLines.find((l) => l.text.startsWith('Standings: '))?.text).toContain(
      '5 more columns shown'
    )
  })

  it('«OverLap» after «Completo» says what goes away and the window back to its size', () => {
    const s = createDefaultSettings()
    const complete = applySettingsPatch(s, planStyle(s, 'complete').patch)
    const changes = planStyle(complete, 'overlap').changes
    const groups = styleChangeGroups(es, changes, ['relative'], 'defaultSize')
    expect(groups[0]?.lines).toContainEqual({
      text: 'Fondo de los widgets',
      from: '90 %',
      to: '80 %'
    })
    const lines = groups.find((g) => g.title === 'Lo que muestra cada widget')?.lines ?? []
    const line = (w: string): string => lines.find((l) => l.text.startsWith(`${w}: `))?.text ?? ''
    expect(line('Posiciones')).toContain('se ocultan 5 columnas')
    expect(line('Combustible')).toContain('2 elementos menos')
    expect(line('Relativo')).toContain('barra de información menos')
    expect(line('Relativo')).toContain('ventana al tamaño de serie')
    expect(line('Posiciones')).toContain('a su valor de serie')
    const enLines = styleChangeGroups(en, changes, ['delta'], 'defaultSize')[1]?.lines ?? []
    const delta = enLines.find((l) => l.text.startsWith('Delta: '))?.text
    expect(delta).toContain('the window back to its default size')
    expect(enLines.find((l) => l.text.startsWith('Standings: '))?.text).toContain(
      '5 columns hidden'
    )
  })

  it('a list put back in its order is one line, without a count', () => {
    const s = createDefaultSettings()
    s.relative.columns = [...s.relative.columns].reverse()
    const groups = styleChangeGroups(es, planStyle(s, 'overlap').changes)
    expect(groups).toEqual([
      {
        title: 'Lo que muestra cada widget',
        lines: [{ text: 'Relativo: sus listas en el orden de serie' }]
      }
    ])
  })

  it('folds each group after its first lines and says how many are left', () => {
    const s = createDefaultSettings()
    Object.assign(s.appearance, presetValues('compact'), { backgroundOpacity: 0.55 })
    const groups = styleChangeGroups(es, planStyle(s, 'complete').changes)
    expect(groups.map((g) => g.title)).toEqual([
      'Aspecto de todos los widgets',
      'Lo que muestra cada widget'
    ])
    const total = groups.reduce((n, g) => n + g.lines.length, 0)
    const folded = foldGroups(groups)
    // The widgets are never pushed out by a long look.
    expect(folded.groups.map((g) => g.lines.length)).toEqual([STYLE_LINES_SHOWN, STYLE_LINES_SHOWN])
    expect(folded.hidden).toBe(total - 2 * STYLE_LINES_SHOWN)
    expect(es.settings.appearance.presets.confirm.more(folded.hidden)).toBe(
      `Y ${folded.hidden} cambios más`
    )
    expect(foldGroups(groups, 50).hidden).toBe(0)
  })

  it('says where it is kept: the global look, and the widgets of the layout in use', () => {
    const lib: LayoutLibrary = {
      ...createDefaultSettings().savedLayouts,
      list: [
        { ...createDefaultSettings().savedLayouts.list[0]!, id: 'a', name: 'Mazda', mode: 'full' }
      ],
      activeId: 'a'
    }
    expect(styleWhere(es, lib, false)).toBe('el aspecto global')
    expect(styleWhere(es, lib, true)).toBe(
      'el aspecto global y el contenido de los widgets en «Mazda»'
    )
    const shared: LayoutLibrary = {
      ...lib,
      list: [{ ...lib.list[0]!, mode: 'position' }]
    }
    expect(styleWhere(es, shared, true)).toContain('opciones comunes')
  })
})

describe('the dialog keeps the focus inside', () => {
  it('Tab from the last control goes to the first, Shift+Tab from the first to the last', () => {
    expect(trapStep(2, 3, false)).toBe(0)
    expect(trapStep(0, 3, true)).toBe(2)
  })

  it('lets Tab go its own way inside', () => {
    expect(trapStep(0, 3, false)).toBeNull()
    expect(trapStep(2, 3, true)).toBeNull()
  })

  it('brings a focus outside its controls (the dialog itself) back in', () => {
    expect(trapStep(-1, 3, false)).toBe(0)
    expect(trapStep(-1, 3, true)).toBe(2)
    expect(trapStep(-1, 0, false)).toBeNull()
  })
})
