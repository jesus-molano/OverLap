import { describe, expect, it } from 'vitest'
import { messagesFor } from '@shared/i18n'
import { WIDGET_LIST_ORDER } from '@shared/widgets'
import {
  DEFAULT_PAGE,
  PAGE_STORAGE_KEY,
  SETTINGS_PAGES,
  initialPage,
  isSettingsPage,
  loadPage,
  pageTitle,
  savePage,
  searchWithoutPage,
  type PageStorage
} from './nav'

function memoryStorage(init: Record<string, string> = {}): PageStorage & { data: typeof init } {
  const data = { ...init }
  return {
    data,
    getItem: (k) => data[k] ?? null,
    setItem: (k, v) => void (data[k] = v)
  }
}

const throwing: PageStorage = {
  getItem: () => {
    throw new Error('denied')
  },
  setItem: () => {
    throw new Error('denied')
  }
}

describe('settings pages', () => {
  it('lists the appearance, the visibility, the shortcuts, the layouts, then the widgets by group', () => {
    expect(SETTINGS_PAGES.slice(0, 4)).toEqual(['appearance', 'visibility', 'shortcuts', 'layouts'])
    expect(SETTINGS_PAGES.slice(4)).toEqual(WIDGET_LIST_ORDER)
    expect(new Set(SETTINGS_PAGES).size).toBe(SETTINGS_PAGES.length)
  })

  it('titles pages in Spanish', () => {
    const es = messagesFor('es')
    expect(pageTitle(es, 'appearance')).toBe('Apariencia')
    expect(pageTitle(es, 'shortcuts')).toBe('Atajos')
    expect(pageTitle(es, 'layouts')).toBe('Disposiciones')
    expect(pageTitle(es, 'standings')).toBe('Posiciones')
    expect(pageTitle(es, 'inputs')).toBe('Pedales')
  })

  it('titles pages in English', () => {
    const en = messagesFor('en')
    expect(pageTitle(en, 'appearance')).toBe('Appearance')
    expect(pageTitle(en, 'shortcuts')).toBe('Shortcuts')
    expect(pageTitle(en, 'standings')).toBe('Standings')
    expect(pageTitle(en, 'relative')).toBe('Relative')
    expect(pageTitle(en, 'inputs')).toBe('Inputs')
  })

  it('recognises only known pages', () => {
    expect(isSettingsPage('battle')).toBe(true)
    expect(isSettingsPage('appearance')).toBe(true)
    expect(isSettingsPage('shortcuts')).toBe(true)
    expect(isSettingsPage('toString')).toBe(false)
    expect(isSettingsPage(null)).toBe(false)
  })
})

describe('remembered page', () => {
  it('round-trips through storage', () => {
    const s = memoryStorage()
    savePage(s, 'radar')
    expect(s.data[PAGE_STORAGE_KEY]).toBe('radar')
    expect(loadPage(s)).toBe('radar')
    savePage(s, 'shortcuts')
    expect(loadPage(s)).toBe('shortcuts')
  })

  it('falls back to the default for unknown, missing or failing storage', () => {
    expect(loadPage(memoryStorage({ [PAGE_STORAGE_KEY]: 'lapTimer' }))).toBe(DEFAULT_PAGE)
    expect(loadPage(memoryStorage())).toBe(DEFAULT_PAGE)
    expect(loadPage(null)).toBe(DEFAULT_PAGE)
    expect(loadPage(throwing)).toBe(DEFAULT_PAGE)
    expect(() => savePage(throwing, 'radar')).not.toThrow()
  })

  it('opens on the page main asks for in the URL, else the remembered one', () => {
    const s = memoryStorage({ [PAGE_STORAGE_KEY]: 'radar' })
    expect(initialPage('?view=settings&page=layouts', s)).toBe('layouts')
    expect(initialPage('?view=settings', s)).toBe('radar')
    expect(initialPage('?view=settings&page=toString', s)).toBe('radar')
    expect(initialPage('', null)).toBe(DEFAULT_PAGE)
  })

  it('drops the page asked for from the URL, keeping the rest', () => {
    expect(searchWithoutPage('?view=settings&page=layouts')).toBe('?view=settings')
    expect(searchWithoutPage('?page=layouts&view=settings')).toBe('?view=settings')
    expect(searchWithoutPage('?view=settings')).toBe('?view=settings')
    expect(searchWithoutPage('?page=layouts')).toBe('')
    expect(searchWithoutPage('')).toBe('')
  })
})
