import { inject, provide, type InjectionKey } from 'vue'
import type { OptionSection } from '@shared/settingsSchema'

/**
 * How the options read under it are seen instead of as they are (useOptions): the search's
 * indexer (R33) renders each page a second time with every list item and switch on, so the
 * controls another setting hides now («Primeros puestos» with Posiciones in «Completo») are found
 * too. Nothing else provides it.
 */
export type OptionsView = (section: OptionSection, own: unknown) => unknown

const SEARCH_UNLOCK: InjectionKey<OptionsView> = Symbol('search-unlock')

export function provideOptionsView(view: OptionsView): void {
  provide(SEARCH_UNLOCK, view)
}

export function injectOptionsView(): OptionsView | null {
  return inject(SEARCH_UNLOCK, null)
}
