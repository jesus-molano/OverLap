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
 *
 * The sample also says what it draws without room (its width drops it: an info bar's item, a
 * column, a layout): its widgets report those `data-el`s (useNoRoomReport) and the lists mark
 * them «No cabe» (NoRoomTag), so an eye or a choice that seems to do nothing says why.
 */
import {
  computed,
  inject,
  onBeforeUnmount,
  provide,
  shallowRef,
  watch,
  type ComputedRef,
  type InjectionKey,
  type ShallowRef
} from 'vue'
import type { OptionSection } from '@shared/settingsSchema'
import type { CustomizeZoneId, ElementEntry } from '@shared/types'
import { useOptions } from '../../composables/useWidgetSettings'
import type { List, SpecRules } from '../elements/listOps'
import {
  ghostZones,
  quietAfterLit,
  sameEl,
  withGhosts,
  type ElRef,
  type PreviewZoneId,
  type QuietEl
} from './previewEdit'

/** One zone's editor, as the sample acts on it (ElementEditor registers it). */
export interface ZoneHandle {
  readonly zone: PreviewZoneId
  readonly spec: SpecRules<string>
  /** An info bar's side marker. */
  readonly split: string | undefined
  /** The zone's name ('Cabecera'). */
  title(): string
  /** The list as the editor shows it (its optimistic value). */
  list(): List<string>
  label(id: string): string
  /** The zone is switched off (an info bar that is not shown): its editor shows no list. */
  off(): boolean
  /** Shows or hides `id` as its eye does (the rules, the announcement, the patch). */
  setVisible(id: string, visible: boolean): void
  /** Sends a reordered list as a drag of the list would (the announcement, the patch). */
  commit(next: ElementEntry<string>[], id: string): void
  /** Sends `next`, where hidden `id` is shown at a new place: a ghost dropped (one patch). */
  showAt(next: ElementEntry<string>[], id: string): void
  /** Opens the zone's accordion and brings `id`'s row into view. */
  reveal(id: string): void
  /**
   * `id` is shown or hidden by another control (the «Piloto» block: ElementEditor's `linked`
   * rows, request 11): the sample only moves it. Absent: none is.
   */
  linked?(id: string): boolean
  /** Brings that control into view, pointed out (a click on such an element in the sample). */
  revealLinked?(id: string): void
}

export interface PreviewEdit {
  readonly section: OptionSection
  readonly zones: ShallowRef<ReadonlyMap<PreviewZoneId, ZoneHandle>>
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
  /**
   * `el` was just hidden from its list row (its eye): not ghosted while the list stays on its
   * zone, so the sample shows it gone (previewEdit.ts quietAfterLit says until when).
   */
  hiddenFromList(el: ElRef): void
  /** The `data-el`s the sample draws ghosted now. */
  readonly ghosts: ComputedRef<readonly string[]>
  /** `options` of `section` as the sample draws them now (the ghosts shown). */
  viewOptions<T extends object>(section: string, options: T): T
  /** The `data-el`s the sample has no room for now ('standings.columns.tyre'), from all parts. */
  readonly noRoom: ComputedRef<ReadonlySet<string>>
  /** One part of the sample (`source`) has no room for `els` now ([] once it has or is gone). */
  reportNoRoom(source: object, els: readonly string[]): void
}

/** Every part's report as one set: what the sample has no room for. */
export function noRoomOf(reports: ReadonlyMap<object, readonly string[]>): ReadonlySet<string> {
  const out = new Set<string>()
  for (const els of reports.values()) for (const el of els) out.add(el)
  return out
}

const KEY: InjectionKey<PreviewEdit> = Symbol('preview-edit')

/** How long a list row stays lit after the pointer or the focus left it (ms). */
const LIST_GRACE_MS = 140
/** How long the ghosts stay after the pointer left the stage (ms): no flicker at its edge. */
const LEAVE_GRACE_MS = 260

export function providePreviewEdit(section: OptionSection): PreviewEdit {
  const zones = shallowRef<ReadonlyMap<PreviewZoneId, ZoneHandle>>(new Map())
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

  /** An element just hidden from its row: left hidden, not ghosted (see hiddenFromList). */
  const quiet = shallowRef<QuietEl | null>(null)
  watch(lit, (next) => (quiet.value = quietAfterLit(quiet.value, next)), { flush: 'sync' })
  /** The `data-el`s kept out of the ghosts: none while you edit in the stage (or drag). */
  const except = computed<readonly string[]>((prev) => {
    const q = quiet.value
    const next =
      q === null || inside.value || dragged.value !== null ? [] : [`${q.el.zone}.${q.el.id}`]
    return prev !== undefined && prev.length === next.length && prev[0] === next[0] ? prev : next
  })

  const ghosts = computed<readonly string[]>(
    () => withGhosts(raw.value, ghosted.value, except.value).ghosts
  )

  const reports = shallowRef<ReadonlyMap<object, readonly string[]>>(new Map())
  const noRoom = computed<ReadonlySet<string>>((prev) => {
    const next = noRoomOf(reports.value)
    return prev !== undefined && prev.size === next.size && [...next].every((el) => prev.has(el))
      ? prev
      : next
  })

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
    hiddenFromList(el) {
      quiet.value = { el, left: false }
    },
    ghosts,
    viewOptions(s, options) {
      if (s !== section) return options
      return withGhosts(options, ghosted.value, except.value).options
    },
    noRoom,
    reportNoRoom(source, els) {
      const before = reports.value.get(source) ?? []
      if (before.length === els.length && before.every((el, i) => el === els[i])) return
      const next = new Map(reports.value)
      if (els.length === 0) next.delete(source)
      else next.set(source, [...els])
      reports.value = next
    }
  }
  provide(KEY, edit)
  return edit
}

/** The page's coordinator; null outside a widget page (the Apariencia samples). */
export function injectPreviewEdit(): PreviewEdit | null {
  return inject(KEY, null)
}
