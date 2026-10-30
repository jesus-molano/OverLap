import { shallowRef } from 'vue'
import type { SearchEntry } from './settingsSearch'

/** Every page's searchable things, once harvested (null: not yet, or the language changed). */
export const searchIndex = shallowRef<SearchEntry[] | null>(null)
/** The search was used: SettingsApp renders the pages out of sight once to harvest them. */
export const indexWanted = shallowRef(false)

/** The search box got the focus: harvest the pages if it is not done. */
export function wantIndex(): void {
  indexWanted.value = true
}
