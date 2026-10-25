import { describe, expect, it } from 'vitest'
import { messagesFor } from '@shared/i18n'
import { WIDGET_IDS } from '@shared/widgets'
import {
  DEFAULT_PAGE,
  PAGE_STORAGE_KEY,
  SETTINGS_PAGES,
  isSettingsPage,
  loadPage,
  pageTitle,
  savePage,
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
  it('lists the appearance first, then every widget once', () => {
    expect(SETTINGS_PAGES[0]).toBe('appearance')
    expect(SETTINGS_PAGES.slice(1)).toEqual(WIDGET_IDS)
    expect(new Set(SETTINGS_PAGES).size).toBe(SETTINGS_PAGES.length)
  })

  it('titles pages in Spanish', () => {
    const es = messagesFor('es')
    expect(pageTitle(es, 'appearance')).toBe('Apariencia')
    expect(pageTitle(es, 'standings')).toBe('Clasificación')
    expect(pageTitle(es, 'inputs')).toBe('Pedales')
  })

  it('titles pages in English', () => {
    const en = messagesFor('en')
    expect(pageTitle(en, 'appearance')).toBe('Appearance')
    expect(pageTitle(en, 'standings')).toBe('Standings')
    expect(pageTitle(en, 'relative')).toBe('Relative')
    expect(pageTitle(en, 'inputs')).toBe('Inputs')
  })

  it('recognises only known pages', () => {
    expect(isSettingsPage('battle')).toBe(true)
    expect(isSettingsPage('appearance')).toBe(true)
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
  })

  it('falls back to the default for unknown, missing or failing storage', () => {
    expect(loadPage(memoryStorage({ [PAGE_STORAGE_KEY]: 'lapTimer' }))).toBe(DEFAULT_PAGE)
    expect(loadPage(memoryStorage())).toBe(DEFAULT_PAGE)
    expect(loadPage(null)).toBe(DEFAULT_PAGE)
    expect(loadPage(throwing)).toBe(DEFAULT_PAGE)
    expect(() => savePage(throwing, 'radar')).not.toThrow()
  })
})
