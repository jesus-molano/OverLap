/**
 * Editing a widget page's element lists in its live sample: one coordinator per page
 * (WidgetPage provides it), joined by the page's element editors (each registers its zone: its
 * list, its rules and the same edits its rows make) and by the sample (WidgetSample draws the
 * ghosts through its host, PreviewEditLayer handles the pointer). It holds what the two sides
 * light for each other: the element the pointer is on in the sample (`hover`), the row the
 * pointer or the focus is on in a list (`lit`) and the element being dragged.
 *
 * While you edit (the pointer over the stage, a drag, or a row of a ghosted zone lit in its
 * list) the sample draws the hidden elements of the ghosted zones (previewEdit.ts GHOST_ZONES)
 * where they would go, ghosted. Preview only: the overlay windows have no sample host, so they
 * never see any of this.
 */
import {
  computed,
  inject,
  onBeforeUnmount,
  provide,
  shallowRef,
  type ComputedRef,
  type InjectionKey,
  type ShallowRef
} from 'vue'
import type { OptionSection } from '@shared/settingsSchema'
import type { CustomizeZoneId, ElementEntry } from '@shared/types'
import { useOptions } from '../../composables/useWidgetSettings'
import type { List, SpecRules } from '../elements/listOps'
import { ghostZones, sameEl, withGhosts, type ElRef } from './previewEdit'

/** One zone's editor, as the sample acts on it (ElementEditor registers it). */
export interface ZoneHandle {
  readonly zone: CustomizeZoneId
  readonly spec: SpecRules<string>
  /** An info bar's side marker. */
  readonly split: string | undefined
  /** The zone's name ('Cabecera'). */
  title(): string
  /** The list as the editor shows it (its optimistic value). */
  list(): List<string>
  label(id: string): string
  /** The zone is switched off (an info bar that is not shown). */
  dim(): boolean
  /** Shows or hides `id` as its eye does (the rules, the announcement, the patch). */
  setVisible(id: string, visible: boolean): void
  /** Sends a reordered list as a drag of the list would (the announcement, the patch). */
  commit(next: ElementEntry<string>[], id: string): void
  /** Sends `next`, where hidden `id` is shown at a new place: a ghost dropped (one patch). */
  showAt(next: ElementEntry<string>[], id: string): void
  /** Opens the zone's accordion and brings `id`'s row into view. */
  reveal(id: string): void
}

export interface PreviewEdit {
  readonly section: OptionSection
  readonly zones: ShallowRef<ReadonlyMap<CustomizeZoneId, ZoneHandle>>
  register(handle: ZoneHandle): () => void
  /** The element under the pointer in the sample. */
  readonly hover: ShallowRef<ElRef | null>
  /** The row under the pointer (or with the focus) in a list. */
  readonly lit: ShallowRef<ElRef | null>
  readonly dragged: ShallowRef<ElRef | null>
  /** The pointer is over the stage. */
  setInside(inside: boolean): void
  /** A list row is lit (`el`) or not (null): debounced, so moving between rows never flickers. */
  lightFromList(el: ElRef | null): void
  /** The `data-el`s the sample draws ghosted now. */
  readonly ghosts: ComputedRef<readonly string[]>
  /** `options` of `section` as the sample draws them now (the ghosts shown). */
  viewOptions<T extends object>(section: string, options: T): T
}

const KEY: InjectionKey<PreviewEdit> = Symbol('preview-edit')

/** How long a list row stays lit after the pointer or the focus left it (ms). */
const LIST_GRACE_MS = 140
/** How long the ghosts stay after the pointer left the stage (ms): no flicker at its edge. */
const LEAVE_GRACE_MS = 260

export function providePreviewEdit(section: OptionSection): PreviewEdit {
  const zones = shallowRef<ReadonlyMap<CustomizeZoneId, ZoneHandle>>(new Map())
  const hover = shallowRef<ElRef | null>(null)
  const lit = shallowRef<ElRef | null>(null)
  const dragged = shallowRef<ElRef | null>(null)
  const inside = shallowRef(false)
  const raw = useOptions(section)

  let leaveTimer: ReturnType<typeof setTimeout> | undefined
  let listTimer: ReturnType<typeof setTimeout> | undefined
  onBeforeUnmount(() => {
    clearTimeout(leaveTimer)
    clearTimeout(listTimer)
  })

  /** Which zones are ghosted: all of them while you edit in the stage, else the lit row's. */
  const ghosted = computed<readonly CustomizeZoneId[]>((prev) => {
    const all = ghostZones(section, raw.value as unknown as Readonly<Record<string, unknown>>)
    let next: readonly CustomizeZoneId[] = []
    if (inside.value || dragged.value !== null) next = all
    else if (lit.value !== null) next = all.filter((z) => z === lit.value?.zone)
    return prev !== undefined && prev.length === next.length && prev.every((z, i) => z === next[i])
      ? prev
      : next
  })

  const ghosts = computed<readonly string[]>(() => withGhosts(raw.value, ghosted.value).ghosts)

  const edit: PreviewEdit = {
    section,
    zones,
    register(handle) {
      const next = new Map(zones.value)
      next.set(handle.zone, handle)
      zones.value = next
      return () => {
        if (zones.value.get(handle.zone) !== handle) return
        const rest = new Map(zones.value)
        rest.delete(handle.zone)
        zones.value = rest
      }
    },
    hover,
    lit,
    dragged,
    setInside(next) {
      clearTimeout(leaveTimer)
      if (next) inside.value = true
      else leaveTimer = setTimeout(() => (inside.value = false), LEAVE_GRACE_MS)
    },
    lightFromList(el) {
      clearTimeout(listTimer)
      if (el !== null) {
        if (!sameEl(lit.value, el)) lit.value = el
      } else {
        listTimer = setTimeout(() => (lit.value = null), LIST_GRACE_MS)
      }
    },
    ghosts,
    viewOptions(s, options) {
      if (s !== section) return options
      return withGhosts(options, ghosted.value).options
    }
  }
  provide(KEY, edit)
  return edit
}

/** The page's coordinator; null outside a widget page (the Apariencia samples). */
export function injectPreviewEdit(): PreviewEdit | null {
  return inject(KEY, null)
}
