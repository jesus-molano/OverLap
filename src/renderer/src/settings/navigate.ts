import { inject, provide, type InjectionKey } from 'vue'
import type { SettingsPage } from './nav'
import type { SearchEntry } from './search/settingsSearch'

/**
 * Going to another page from inside one (the status panel's «Ver Atajos», a search result, the
 * overview's widget names): SettingsApp provides it, anything below asks for it. `target`, when
 * given, is what to reveal there (search/reveal.ts).
 */
export type Navigate = (
  page: SettingsPage,
  target?: Pick<SearchEntry, 'text' | 'context' | 'kind'>
) => void

const NAVIGATE: InjectionKey<Navigate> = Symbol('navigate')

export function provideNavigate(go: Navigate): void {
  provide(NAVIGATE, go)
}

/** The window's navigation; outside SettingsApp (a test), a no-op. */
export function useNavigate(): Navigate {
  return inject(NAVIGATE, () => undefined)
}
