import { computed, type ComputedRef } from 'vue'
import { isElementVisible, setElementVisible } from '@shared/elements'
import type { ElementEntry } from '@shared/types'
import { useI18n } from '../../composables/useI18n'

type List<Id extends string> = readonly Readonly<ElementEntry<Id>>[]

/** Whether `next` shows an element `before` did not: the change asks to see something. */
export function showsMore<Id extends string>(before: List<Id>, next: List<Id>): boolean {
  return next.some((e) => e.visible && !isElementVisible(before, e.id))
}

/**
 * A list drawn inside an element of another list, its parent: Pedales' «Coche» items in the
 * «Coche» block, Delta's lap times in their line. While the parent is hidden nothing of the list
 * shows, so the list says so (`note`, the same words on every page) and an edit that shows one
 * of its elements shows the parent too (`apply`: the list, then the parent's list).
 *
 *   const car = useParentGate({
 *     parents: () => opts.value.sections, parent: 'car', setParents: setSections,
 *     items: () => opts.value.car, set: setCar,
 *     parentLabel: () => sectionTexts.value.car.label,
 *     zoneLabel: () => zoneTitle(t.value, 'inputs', 'sections')
 *   })
 *   <ElementEditor … :apply="car.apply" :note="car.note.value" />
 */
export function useParentGate<P extends string, Id extends string>(o: {
  parents: () => List<P>
  parent: P
  setParents: (next: ElementEntry<P>[]) => Promise<unknown>
  items: () => List<Id>
  set: (next: ElementEntry<Id>[]) => Promise<unknown>
  parentLabel: () => string
  zoneLabel: () => string
}): {
  note: ComputedRef<string | undefined>
  apply: (next: ElementEntry<Id>[]) => Promise<unknown>
} {
  const t = useI18n()
  const shown = computed(() => isElementVisible(o.parents(), o.parent))
  const note = computed(() =>
    shown.value ? undefined : t.value.settings.elements.parentOff(o.parentLabel(), o.zoneLabel())
  )
  async function apply(next: ElementEntry<Id>[]): Promise<unknown> {
    const opening = !shown.value && showsMore(o.items(), next)
    const done = o.set(next)
    if (opening) await o.setParents(setElementVisible(o.parents(), o.parent, true))
    return done
  }
  return { note, apply }
}
