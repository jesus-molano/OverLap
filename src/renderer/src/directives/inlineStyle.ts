import type { ObjectDirective } from 'vue'
import type { InlineStyle } from '../view/styles'

/** The part of an element `patchInline` touches (a fake in tests). */
export interface StyleTarget {
  readonly style: Pick<CSSStyleDeclaration, 'setProperty' | 'removeProperty'>
}

/**
 * Writes the difference between two inline styles: removes the properties `next` no longer has
 * and sets only the ones whose value changed. Custom properties ('--cls') and plain ones
 * ('background') alike, by their CSS name.
 */
export function patchInline(
  el: StyleTarget,
  prev: InlineStyle | null | undefined,
  next: InlineStyle | null | undefined
): void {
  if (prev === next) return
  if (prev) {
    for (const k in prev) if (next?.[k] === undefined) el.style.removeProperty(k)
  }
  if (next) {
    for (const k in next) {
      const v = next[k]
      if (v !== undefined && v !== prev?.[k]) el.style.setProperty(k, v)
    }
  }
}

/**
 * `v-inline-style`: like `:style`, but writes only what changed. `:style` re-sets every
 * property on every render; with shared style objects (see `styleCache`) an unchanged colour
 * costs one identity check.
 */
export const vInlineStyle: ObjectDirective<HTMLElement, InlineStyle | null | undefined> = {
  beforeMount: (el, { value }) => patchInline(el, null, value),
  updated: (el, { value, oldValue }) => patchInline(el, oldValue, value)
}
