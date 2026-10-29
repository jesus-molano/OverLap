/**
 * The "Personalizar" part of a widget page: where each page's element editors go (one per zone:
 * the widget's columns, its info bars, then its other lists). WidgetPage provides the host, an
 * element of its own after the window and content options; a page's options component wraps its
 * editors in <CustomizeSection>, which moves them there (a deferred Teleport) and tells the host
 * it has content, so a wide window can give them a column of their own. Pure apart from the
 * injection helpers.
 */
import { inject, provide, shallowRef, type InjectionKey, type ShallowRef } from 'vue'
import {
  elementFields,
  isLayoutSection,
  type ElementField,
  type OptionSection
} from '@shared/settingsSchema'

export interface CustomizeHost {
  /** The id of the element the editors are moved into. */
  readonly targetId: string
  /** The id of the element reference sections go into, after the editors (PageAppendix). */
  readonly appendixId: string
  /** How many CustomizeSections are mounted (0: the page has no editors). */
  readonly count: ShallowRef<number>
}

const HOST: InjectionKey<CustomizeHost> = Symbol('customize-host')

/** An id usable as a `#id` selector: Vue's ids are letters, digits and dashes already. */
export function customizeTargetId(base: string): string {
  return `st-customize-${base.replace(/[^\w-]/g, '')}`
}

/** The same for the reference sections that follow the editors (PageAppendix). */
export function customizeAppendixId(base: string): string {
  return customizeTargetId(base).replace(/^st-customize-/, 'st-appendix-')
}

export function provideCustomizeHost(base: string): CustomizeHost {
  const host: CustomizeHost = {
    targetId: customizeTargetId(base),
    appendixId: customizeAppendixId(base),
    count: shallowRef(0)
  }
  provide(HOST, host)
  return host
}

/** The page's host, or null outside a widget page (the section then stays where it is). */
export function injectCustomizeHost(): CustomizeHost | null {
  return inject(HOST, null)
}

/**
 * The zones that lead a page's editors, in this order (requirements A.1/A.2): the columns, the
 * header bar, its second line, the footer bar. Every other list follows in schema order.
 */
export const LEADING_ZONES = ['columns', 'headerBar', 'subheaderBar', 'footerBar'] as const

/**
 * The element-list fields of `section` in the order their editors go on its page:
 * `customizeZones('standings')` is columns, headerBar, subheaderBar, footerBar, classLine. None
 * for a section that is no widget's (the settings window's own lists are no zone).
 */
export function customizeZones<S extends OptionSection>(section: S): ElementField<S>[] {
  if (!isLayoutSection(section)) return []
  const fields = elementFields()
    .filter(([s]) => s === section)
    .map(([, field]) => field as ElementField<S>)
  const rank = (field: string): number => {
    const i = (LEADING_ZONES as readonly string[]).indexOf(field)
    return i < 0 ? LEADING_ZONES.length : i
  }
  // Stable: the fields that do not lead keep the schema's order.
  return fields
    .map((field, index) => ({ field, index }))
    .sort((a, b) => rank(a.field) - rank(b.field) || a.index - b.index)
    .map((e) => e.field)
}
