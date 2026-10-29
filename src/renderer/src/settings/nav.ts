/**
 * Pages of the settings window: appearance, keyboard shortcuts, saved layouts, then one per
 * widget. Pure.
 */
import { widgetTitle, type Messages } from '@shared/i18n'
import { WIDGET_IDS, isWidgetId, type WidgetId } from '@shared/widgets'

/** The pages that are not a widget's, in sidebar order. */
export const GLOBAL_PAGES = ['appearance', 'shortcuts', 'layouts'] as const

export type GlobalPage = (typeof GLOBAL_PAGES)[number]

export type SettingsPage = GlobalPage | WidgetId

export const SETTINGS_PAGES: readonly SettingsPage[] = Object.freeze([
  ...GLOBAL_PAGES,
  ...WIDGET_IDS
])

export const DEFAULT_PAGE: SettingsPage = 'appearance'

/** localStorage key of the page shown last (a convenience: losing it only opens the default). */
export const PAGE_STORAGE_KEY = 'ov-settings:page'

export function isSettingsPage(value: unknown): value is SettingsPage {
  return (GLOBAL_PAGES as readonly unknown[]).includes(value) || isWidgetId(value)
}

/** 'Apariencia', 'Atajos', 'Disposiciones' or the widget's name, in `m`'s language. */
export function pageTitle(m: Messages, page: SettingsPage): string {
  if (page === 'appearance') return m.settings.nav.appearance
  if (page === 'shortcuts') return m.settings.nav.shortcuts
  if (page === 'layouts') return m.settings.nav.layouts
  return widgetTitle(m, page)
}

/** The storage the page is remembered in; anything that can throw (private mode, sandbox). */
export type PageStorage = Pick<Storage, 'getItem' | 'setItem'>

/** The remembered page, or the default when there is none, it is unknown or storage fails. */
export function loadPage(storage: PageStorage | null): SettingsPage {
  try {
    const raw = storage?.getItem(PAGE_STORAGE_KEY)
    return isSettingsPage(raw) ? raw : DEFAULT_PAGE
  } catch {
    return DEFAULT_PAGE
  }
}

/**
 * The page to open on: the one main asked for in the URL (`?page=`, the tray's "Más…"), else the
 * remembered one. `search` is location.search.
 */
export function initialPage(search: string, storage: PageStorage | null): SettingsPage {
  const asked = new URLSearchParams(search).get('page')
  return isSettingsPage(asked) ? asked : loadPage(storage)
}

/**
 * `search` without its `page` (the rest kept, '' when nothing is left): it is read once on
 * opening, so a reload of the window shows the page you were on, not that one again.
 */
export function searchWithoutPage(search: string): string {
  const params = new URLSearchParams(search)
  params.delete('page')
  const rest = params.toString()
  return rest === '' ? '' : `?${rest}`
}

/** Remembers the page; a storage failure is ignored (it only affects the next opening). */
export function savePage(storage: PageStorage | null, page: SettingsPage): void {
  try {
    storage?.setItem(PAGE_STORAGE_KEY, page)
  } catch {
    // Not worth surfacing.
  }
}

/** window.localStorage, or null where reading the accessor itself throws. */
export function browserStorage(): PageStorage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage
  } catch {
    return null
  }
}
