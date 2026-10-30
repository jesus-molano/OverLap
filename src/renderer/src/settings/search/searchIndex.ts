import { shallowRef } from 'vue'
import type { SearchEntry } from './settingsSearch'

/** Every page's searchable things, once harvested (null: not yet, or the language changed). */
export const searchIndex = shallowRef<SearchEntry[] | null>(null)
/** SettingsApp renders the pages out of sight to harvest them while this is on. */
export const indexing = shallowRef(false)

/**
 * The index no longer matches the pages when `changes` passed what was harvested: a setting
 * changed what they show (a mode, a list item shown), or there is none yet. Counted, so a change
 * during a harvest keeps it stale for the next search.
 */
let changes = 1
let harvested = 0
let startedAt = 0

/** The settings changed since the harvest: the next search harvests again. */
export function markIndexStale(): void {
  changes++
}

/** The language changed: the pages say other words; the old index is not shown meanwhile. */
export function dropIndex(): void {
  searchIndex.value = null
  changes++
  // A harvest under way starts again in the new language (SettingsApp keys it by language).
  if (indexing.value) startedAt = changes
}

/**
 * The search box got the focus: the pages harvested again when anything changed since (the
 * old index answers meanwhile).
 */
export function wantIndex(): void {
  if (indexing.value || harvested === changes) return
  startedAt = changes
  indexing.value = true
}

/** A harvest ended: its entries answer from now on. */
export function indexDone(entries: SearchEntry[]): void {
  indexing.value = false
  searchIndex.value = entries
  harvested = startedAt
}

/** For the tests: as when the window opened. */
export function resetIndexForTests(): void {
  searchIndex.value = null
  indexing.value = false
  changes = 1
  harvested = 0
  startedAt = 0
}
