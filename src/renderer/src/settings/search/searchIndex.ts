import { shallowRef } from 'vue'
import type { OverlaySettings } from '@shared/types'
import type { SearchEntry } from './settingsSearch'

/** Every page's searchable things, once harvested (null: not yet, or the language changed). */
export const searchIndex = shallowRef<SearchEntry[] | null>(null)
/** SettingsApp renders the pages out of sight to harvest them while this is on. */
export const indexing = shallowRef(false)

/** The settings the index was harvested with (null: none yet, or the language changed). */
let harvestedWith: string | null = null
let startedWith = ''

/**
 * What a page can show depends on (a mode, a list item shown, a layout's name): the settings
 * without the widgets' places, which change on every drag and every fitted height.
 */
export function settingsKey(s: OverlaySettings | null): string {
  return JSON.stringify(s, (k, v: unknown) => (k === 'bounds' ? undefined : v))
}

/** The language changed: the pages say other words; the old index is not shown meanwhile. */
export function dropIndex(key: string): void {
  searchIndex.value = null
  harvestedWith = null
  // A harvest under way starts again in the new language (SettingsApp keys it by language).
  if (indexing.value) startedWith = key
}

/**
 * The search box got the focus: the pages harvested again when the settings (`key`,
 * settingsKey) changed since, the old index answering meanwhile.
 */
export function wantIndex(key: string): void {
  if (indexing.value || harvestedWith === key) return
  startedWith = key
  indexing.value = true
}

/** A harvest ended: its entries answer from now on. */
export function indexDone(entries: SearchEntry[]): void {
  indexing.value = false
  searchIndex.value = entries
  harvestedWith = startedWith
}

/** For the tests: as when the window opened. */
export function resetIndexForTests(): void {
  searchIndex.value = null
  indexing.value = false
  harvestedWith = null
  startedWith = ''
}
