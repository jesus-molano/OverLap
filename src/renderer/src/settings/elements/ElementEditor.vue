<script setup lang="ts" generic="Id extends string">
import { computed, nextTick, onBeforeUnmount, shallowRef, useId, watch } from 'vue'
import type { OptionSection } from '@shared/settingsSchema'
import type { CustomizeZoneId, ElementEntry } from '@shared/types'
import { useI18n } from '../../composables/useI18n'
import Icon from '../../ui/Icon.vue'
import AccordionSection from '../layout/AccordionSection.vue'
import PageSection from '../layout/PageSection.vue'
import { injectZoneRegistry, isZoneOpen, setZonesOpen, zoneOfSpec } from '../layout/zonesOpen'
import type { ElRef } from '../preview/previewEdit'
import { injectPreviewEdit, type ZoneHandle } from '../preview/usePreviewEdit'
import { offerSectionRestore } from '../undo/restore'
import { undoSlot, type UndoKind } from '../undo/undo'
import { useOptimistic } from '../useOptimistic'
import {
  barRows,
  barStop,
  blockedBy,
  boxBounds,
  boxPosition,
  defaults,
  dropIndex,
  isDefault,
  isRequired,
  keyAction,
  movedAcross,
  movedBy,
  movedPast,
  movedTo,
  movedMessage,
  placeOfSlot,
  placedAt,
  shownAtSideEnd,
  shownCount,
  sideMessage,
  sideOf,
  toggled,
  visibilityMessage,
  type ElementChange,
  type ElementText,
  type IndexedEntry,
  type Side,
  type SpecRules
} from './listOps'

/**
 * The one editor of every element list (a widget's columns, rows, info bars...): drag the handle
 * or use ↑ ↓ (arrow keys, Home, End on the handle) to reorder, the eye to show or hide an
 * element in the widget, "Restablecer" for the default. Required elements show a lock; a child
 * whose parent is hidden greys its eye out; a fixed-order list has no handles. Every change is
 * shown at once (useOptimistic) and announced to screen readers; the widget's live sample on the
 * page shows it too. Coupled options are the page's: `apply` gets the new list and the change.
 *
 * A list that is a page's zone (its spec is one of CUSTOMIZE_ZONE_IDS) is an accordion of
 * "Personalizar" (AccordionSection, open state in zonesOpen.ts), its summary the count of what is
 * shown; any other list is a plain section. With `split` (an info bar's marker) the list is two
 * boxes, "Izquierda" and "Derecha": the marker is no row; an element changes side by a drag, by
 * ↑ ↓ over the boundary or by its ← → button, and the stored list keeps the marker as it was.
 * The boxes hold the shown items; the hidden ones (of either side) wait in a collapsed
 * "Ocultos (N)" group under them, and one shown from there goes to the end of its side.
 *
 * On a widget page the zone also joins the page's preview editing (usePreviewEdit): the sample
 * acts on it through the same edits as its rows, and a row and its element light each other.
 *
 *   <ElementEditor
 *     :title="zoneTitle(t, 'relative', 'columns')"
 *     :items="opts.columns"
 *     :spec="OPTION_SCHEMA.relative.columns"
 *     :labels="elementTexts(t, 'relative', 'columns')"
 *     :apply="(next) => updateSection('relative', { columns: next })"
 *   />
 */
const props = withDefaults(
  defineProps<{
    /** The zone's name ('Columnas'): the section's title and the reset's object. */
    title: string
    /** The list as the settings have it. */
    items: readonly Readonly<ElementEntry<Id>>[]
    /** Its 'elements' spec (order rules, required ids, parents, default). */
    spec: SpecRules<Id>
    labels: Readonly<Record<Id, ElementText>>
    /** Sends the new list (and whatever goes with it); settles when main has answered. */
    apply: (next: ElementEntry<Id>[], change: ElementChange<Id>) => Promise<unknown>
    /** With nothing shown the whole widget hides (a stronger warning). */
    emptyHides?: boolean
    /** Fixed parts of the widget listed for context above / below the list. */
    fixedBefore?: readonly { readonly key: string; readonly label: string }[]
    fixedAfter?: readonly { readonly key: string; readonly label: string }[]
    /** A short note about the whole list, under it. */
    note?: string
    /** The marker that splits the list into two sides (an info bar's 'split'). */
    split?: Id
    /** Ids that are no row (the zone's switch in the `head` slot shows them). */
    omit?: readonly Id[]
    /** The accordion's summary instead of the count ('Normal · 4 de 15 visibles'). */
    summary?: string
    /** The zone is switched off: only its head (the switch) and the reset show, no list. */
    off?: boolean
    /**
     * Whether what the page resets along with the list (the reset's change goes to `apply`) is
     * at its default too: an info bar's switch and size. "Restablecer" is on while either is not.
     */
    restAtDefault?: boolean
  }>(),
  {
    emptyHides: false,
    fixedBefore: () => [],
    fixedAfter: () => [],
    note: undefined,
    split: undefined,
    omit: () => [],
    summary: undefined,
    off: false,
    restAtDefault: true
  }
)

defineSlots<{
  /** Above the list: the zone's switch (an info bar's "Mostrar cabecera" and its size). */
  head?(): unknown
  /** Options of one row after its label (the trend arrow of 'trackTemp'...). */
  extra?(p: { id: Id; visible: boolean }): unknown
  /** Below the list (the zone's own options: size, logos...), ruled off from it, one per row. */
  footer?(): unknown
}>()

const t = useI18n()
const listEl = shallowRef<HTMLElement | null>(null)
const helpId = `${useId()}-help`

const optimistic = useOptimistic<readonly Readonly<ElementEntry<Id>>[]>(() => props.items)
const current = optimistic.value

function send(next: ElementEntry<Id>[], change: ElementChange<Id>): Promise<void> {
  return optimistic.run(next, () => props.apply(next, change))
}

/** Live order while a drag is in progress (sent on drop only). */
const dragOrder = shallowRef<ElementEntry<Id>[] | null>(null)
const dragId = shallowRef<Id | null>(null)
const shown = computed<readonly Readonly<ElementEntry<Id>>[]>(
  () => dragOrder.value ?? current.value
)
const sortable = computed(() => !props.spec.fixedOrder && shown.value.length > 1)

/** One box of rows: the whole list, or one side of the marker. */
interface Box {
  readonly side: Side | null
  readonly rows: readonly IndexedEntry<Id>[]
}

/** An info bar's rows: its shown items by side, its hidden ones apart (barRows). */
const bar = computed(() => (props.split === undefined ? null : barRows(shown.value, props.split)))

const boxes = computed<readonly Box[]>(() => {
  const list = shown.value
  if (bar.value !== null) {
    return [
      { side: 'left', rows: bar.value.left },
      { side: 'right', rows: bar.value.right }
    ]
  }
  const rows = list
    .map((entry, index) => ({ entry, index }))
    .filter((r) => !props.omit.includes(r.entry.id))
  return [{ side: null, rows }]
})

/** An info bar's hidden items, under the boxes ("Ocultos (N)", closed until you open it). */
const hiddenRows = computed(() => bar.value?.hidden ?? [])
const hiddenOpen = shallowRef(false)
const hiddenListId = `${useId()}-hidden`

/** The rows drawn (no marker, nothing omitted): what the count counts. */
const rowEntries = computed(() => [
  ...boxes.value.flatMap((b) => b.rows.map((r) => r.entry)),
  ...hiddenRows.value.map((r) => r.entry)
])

/**
 * The entries a drag or ↑ ↓ steps over: the rows drawn in the boxes (an info bar's shown items
 * and its marker, the right box's heading); hidden entries between them never matter.
 */
function isStop(e: Readonly<ElementEntry<Id>>): boolean {
  if (props.split !== undefined) return barStop(props.split)(e)
  return !props.omit.includes(e.id)
}

/** Whether ↑ (-1) or ↓ (1) can move `id` (an info bar: past the next row drawn). */
function canStep(id: Id, index: number, delta: -1 | 1): boolean {
  if (props.split === undefined) return delta < 0 ? index > 0 : index < shown.value.length - 1
  return movedPast(props.spec, shown.value, id, delta, isStop) !== null
}
const countNote = computed(() =>
  t.value.settings.elements.count(shownCount(rowEntries.value), rowEntries.value.length)
)
// The omitted ids count (the traffic's title, shown by its switch): the widget draws them.
const empty = computed(() => shownCount(current.value.filter((e) => e.id !== props.split)) === 0)
const atDefault = computed(() => props.restAtDefault && isDefault(props.spec, current.value))

// ---- The accordion ---------------------------------------------------------------------

const zone = computed<CustomizeZoneId | null>(() => zoneOfSpec(props.spec))
const open = computed(() => zone.value === null || isZoneOpen(zone.value))
const registry = injectZoneRegistry()
watch(
  zone,
  (next, prev) => {
    if (prev) registry?.remove(prev)
    if (next) registry?.add(next)
  },
  { immediate: true }
)
onBeforeUnmount(() => {
  if (zone.value) registry?.remove(zone.value)
})

function toggleOpen(next: boolean): void {
  if (zone.value) void setZonesOpen([zone.value], next)
}

const frame = computed(() =>
  zone.value === null
    ? { is: PageSection, props: { title: props.title, card: false, note: countNote.value } }
    : {
        is: AccordionSection,
        props: {
          title: props.title,
          summary: props.summary ?? countNote.value,
          open: open.value,
          onToggle: toggleOpen
        }
      }
)

// ---- Edits -----------------------------------------------------------------------------

const message = shallowRef('')
let saying = 0
/**
 * Announces `text`, the same words again too (emptied first): a hide the toast announced leaves
 * the last words here as they were, and its undo can say them again ('SoF visible.').
 */
function say(text: string): void {
  const n = ++saying
  if (message.value !== text) {
    message.value = text
    return
  }
  message.value = ''
  void nextTick(() => {
    if (n === saying) message.value = text
  })
}

const labelOf = (id: Id): string => props.labels[id]?.label ?? id

/**
 * Shows or hides `id`. An info bar's hidden item shown from its list goes to the end of its
 * side (shownAtSideEnd); `inPlace` (the preview, where its ghost is drawn) keeps it where it is.
 */
function setVisible(id: Id, visible: boolean, inPlace = false): void {
  if (!visible && isRequired(props.spec, id)) return
  const list = current.value
  const next =
    visible && !inPlace && props.split !== undefined
      ? shownAtSideEnd(props.spec, list, id, props.split)
      : toggled(props.spec, list, id, visible)
  void send(next, { kind: 'visible', id, visible })
  // A hide offers "Deshacer" (a misclick); the toast then announces it.
  if (visible || !offerUndo('hide', id, list, next)) {
    say(visibilityMessage(t.value, labelOf(id), visible))
  }
}

// ---- Undo (the window's toast: undo/undo.ts) -------------------------------------------

/** This editor, as the owner of its offers: they go when it does (another page). */
const undoOwner = {}
onBeforeUnmount(() => undoSlot.withdraw(undoOwner))

/**
 * Offers to undo the change of `id` from `before` to `after`; false when no toast shows it (the
 * caller announces the change then). Undone, it goes back through `send` as the opposite edit.
 */
function offerUndo(
  kind: UndoKind,
  id: Id,
  before: readonly Readonly<ElementEntry<Id>>[],
  after: readonly Readonly<ElementEntry<Id>>[]
): boolean {
  return undoSlot.offer({
    owner: undoOwner,
    kind,
    id,
    label: labelOf(id),
    before,
    after,
    current: () => current.value,
    apply: (next) => undoTo(kind, id, next as ElementEntry<Id>[])
  })
}

function undoTo(kind: UndoKind, id: Id, next: ElementEntry<Id>[]): void {
  const before = current.value
  if (kind === 'hide') {
    void send(next, { kind: 'visible', id, visible: true, undo: true })
    say(visibilityMessage(t.value, labelOf(id), true))
    return
  }
  void send(next, { kind: 'move', id, to: next.findIndex((e) => e.id === id) })
  announceMove(id, before, next)
}

/** The eye of a row: in an info bar the row changes group, so the focus follows it. */
function onEye(id: Id, visible: boolean): void {
  setVisible(id, visible)
  if (props.split !== undefined) void refocusEye(id)
}

type FocusTarget = 'handle' | 'up' | 'down' | 'side'

const rootEl = shallowRef<HTMLElement | null>(null)
const rowOf = (id: Id): HTMLElement | null =>
  rootEl.value?.querySelector<HTMLElement>(`li[data-row="${id}"]`) ?? null

/** Keeps keyboard focus on the moved row's control (its buttons may have become disabled). */
async function refocus(id: Id, target: FocusTarget): Promise<void> {
  await nextTick()
  const row = rowOf(id)
  const want = row?.querySelector<HTMLButtonElement>(`[data-focus="${target}"]`)
  const el =
    want && !want.disabled ? want : row?.querySelector<HTMLElement>('[data-focus="handle"]')
  el?.focus()
}

/** The focus on the eye of `id`'s row wherever it went, else on the "Ocultos" button. */
async function refocusEye(id: Id): Promise<void> {
  await nextTick()
  const eye = rowOf(id)?.querySelector<HTMLElement>('[data-focus="eye"]')
  if (eye && eye.offsetParent !== null) eye.focus()
  else rootEl.value?.querySelector<HTMLElement>('[data-focus="hidden"]')?.focus()
}

/**
 * 'iRating: posición 3 de 8.' (as its box numbers it), or the new side when it changed ('SoF: a la
 * derecha.').
 */
function announceMove(
  id: Id,
  before: readonly Readonly<ElementEntry<Id>>[],
  next: readonly Readonly<ElementEntry<Id>>[]
): void {
  if (props.split !== undefined) {
    const side = sideOf(next, id, props.split)
    if (side !== sideOf(before, id, props.split)) {
      say(sideMessage(t.value, labelOf(id), side))
      return
    }
  }
  const at = boxPosition(next, id, props.split)
  say(movedMessage(t.value, labelOf(id), at.index, at.total))
}

function move(id: Id, delta: -1 | 1, target: FocusTarget): void {
  const before = current.value
  const next =
    props.split !== undefined
      ? movedPast(props.spec, before, id, delta, isStop)
      : movedBy(props.spec, before, id, delta)
  if (next === null) return
  const to = next.findIndex((e) => e.id === id)
  if (to === before.findIndex((e) => e.id === id)) return
  void send(next, { kind: 'move', id, to })
  announceMove(id, before, next)
  void refocus(id, target)
}

function moveTo(id: Id, index: number): void {
  const before = current.value
  const next = movedTo(props.spec, before, id, index)
  void send(next, { kind: 'move', id, to: index })
  announceMove(id, before, next)
  void refocus(id, 'handle')
}

/** To the other side of the marker, at its nearest end. */
function moveAcross(id: Id): void {
  if (props.split === undefined) return
  const before = current.value
  const next = movedAcross(props.spec, before, id, props.split)
  void send(next, { kind: 'move', id, to: next.findIndex((e) => e.id === id) })
  announceMove(id, before, next)
  void refocus(id, 'side')
}

/**
 * Back to the default list (and what goes with it): one click, then "Deshacer" (R11), which puts
 * back what the reset changed in the zone's section. Without a toast (a zone off a widget
 * page), it is announced.
 */
function reset(): void {
  const section = zone.value?.split('.')[0] as OptionSection | undefined
  const offer = section === undefined ? null : offerSectionRestore(section, props.title)
  void send(defaults(props.spec), { kind: 'reset' })
  if (offer === null || !offer()) say(t.value.settings.elements.resetDone(props.title))
}

function onHandleKey(e: KeyboardEvent, id: Id, index: number): void {
  const list = current.value
  const action = keyAction(e.key, index, list.length, boxBounds(list, index, props.split))
  if (action === null) return
  e.preventDefault()
  if (action.kind === 'by') move(id, action.delta < 0 ? -1 : 1, 'handle')
  else moveTo(id, action.index)
}

/** The words of a row's ← → button. */
function sideLabel(id: Id, side: Side): string {
  const e = t.value.settings.elements
  return side === 'left' ? e.toRight(labelOf(id)) : e.toLeft(labelOf(id))
}

// ---- Pointer drag (captured by the lists, which never move) ------------------------------

interface Drag {
  pointerId: number
  id: Id
  /** The rows drawn (isStop), in list order, and the dragged one's place among them. */
  stops: Id[]
  from: number
  to: number
  centres: number[]
  base: ElementEntry<Id>[]
}
let drag: Drag | null = null

/**
 * Each stop's slot centre (px) in list order: its row, or for the marker the heading of the
 * right box, which sits where the marker is in the list.
 */
function slotCentres(lists: HTMLElement, stops: readonly Id[]): number[] {
  return stops.map((id) => {
    const el = lists.querySelector<HTMLElement>(`[data-row="${id}"]`)
    if (el === null) return Number.NaN
    const r = el.getBoundingClientRect()
    return r.top + r.height / 2
  })
}

/** The list a drag to slot `to` makes (the base itself for its own slot). */
function dragged(d: Drag, to: number): ElementEntry<Id>[] {
  const place = to === d.from ? null : placeOfSlot(d.stops, d.id, to)
  return place === null ? d.base : placedAt(props.spec, d.base, d.id, place)
}

function onHandleDown(e: PointerEvent, id: Id): void {
  const lists = listEl.value
  if (e.button !== 0 || lists === null || drag !== null || !sortable.value) return
  const base = current.value.map((c) => ({ id: c.id, visible: c.visible }))
  const stops = base.filter(isStop).map((c) => c.id)
  const from = stops.indexOf(id)
  if (from < 0) return
  const centres = slotCentres(lists, stops)
  e.preventDefault()
  try {
    lists.setPointerCapture(e.pointerId)
  } catch {
    // Without capture, leaving the list cancels (pointerleave).
  }
  drag = { pointerId: e.pointerId, id, stops, from, to: from, centres, base }
  dragId.value = id
  dragOrder.value = base
}

function onMove(e: PointerEvent): void {
  if (drag === null || e.pointerId !== drag.pointerId) return
  const to = dropIndex(drag.centres, drag.from, e.clientY)
  if (to === drag.to) return
  drag.to = to
  dragOrder.value = dragged(drag, to)
}

function endDrag(): void {
  drag = null
  dragId.value = null
  dragOrder.value = null
}

function onUp(e: PointerEvent): void {
  if (drag === null || e.pointerId !== drag.pointerId) return
  const d = drag
  endDrag()
  if (d.to === d.from) return
  const next = dragged(d, d.to)
  void send(next, { kind: 'move', id: d.id, to: next.findIndex((c) => c.id === d.id) })
  announceMove(d.id, d.base, next)
}

// ---- The preview (the sample acts on this zone; a row and its element light each other) -----

const preview = injectPreviewEdit()

/** The element of this zone the sample points at, or the list lights: its row is lit. */
const litId = computed<string | null>(() => {
  const z = zone.value
  if (preview === null || z === null) return null
  for (const el of [preview.hover.value, preview.lit.value]) if (el?.zone === z) return el.id
  return null
})
const hiddenLit = computed(() => hiddenRows.value.some((r) => r.entry.id === litId.value))

function lightRow(id: Id | null): void {
  const z = zone.value
  if (preview === null || z === null) return
  preview.lightFromList(id === null ? null : ({ zone: z, id } satisfies ElRef))
}

/** Opens the accordion and brings `id`'s row into view (the sample acted on it). */
function reveal(id: Id): void {
  if (zone.value !== null) void setZonesOpen([zone.value], true)
  if (hiddenRows.value.some((r) => r.entry.id === id)) hiddenOpen.value = true
  // After the accordion's short opening.
  setTimeout(() => {
    const smooth = !matchMedia('(prefers-reduced-motion: reduce)').matches
    rowOf(id)?.scrollIntoView({ block: 'nearest', behavior: smooth ? 'smooth' : 'auto' })
  }, 220)
}

if (preview !== null) {
  watch(
    zone,
    (z, _prev, onCleanup) => {
      if (z === null) return
      const handle: ZoneHandle = {
        zone: z,
        spec: props.spec as SpecRules<string>,
        split: props.split,
        title: () => props.title,
        list: () => current.value,
        label: (id) => labelOf(id as Id),
        off: () => props.off,
        setVisible: (id, visible) => setVisible(id as Id, visible, true),
        commit: (next, id) => {
          const before = current.value
          void send(next as ElementEntry<Id>[], {
            kind: 'move',
            id: id as Id,
            to: next.findIndex((e) => e.id === id)
          })
          // A drag in the sample offers "Deshacer" too (a drop in the wrong place).
          if (!offerUndo('move', id as Id, before, next as ElementEntry<Id>[])) {
            announceMove(id as Id, before, next as ElementEntry<Id>[])
          }
        },
        showAt: (next, id) => {
          void send(next as ElementEntry<Id>[], { kind: 'visible', id: id as Id, visible: true })
          say(visibilityMessage(t.value, labelOf(id as Id), true))
        },
        reveal: (id) => reveal(id as Id)
      }
      onCleanup(preview.register(handle))
    },
    { immediate: true }
  )
}

function onCancel(e: PointerEvent): void {
  if (drag !== null && e.pointerId === drag.pointerId) endDrag()
}
</script>

<template>
  <component
    :is="frame.is"
    v-bind="frame.props"
    :class="{ 'is-zone-lit': litId !== null && !open }"
  >
    <div ref="rootEl" class="ed" :class="{ 'in-acc': zone !== null }">
      <div v-if="$slots.head" class="ed-head">
        <slot name="head" />
      </div>

      <!-- Switched off: nothing under the switch but the reset (R20: hide what does not apply). -->
      <template v-if="!off">
        <!-- In "Personalizar" the page says it once: here only for screen readers. -->
        <p :id="helpId" class="st-help ed-intro" :class="{ 'st-sr-only': registry !== null }">
          <template v-if="sortable && split !== undefined">
            {{ t.settings.elements.introSides.before }}
            <span class="ed-grip-inline" aria-hidden="true">⠿</span>
            {{ t.settings.elements.introSides.middle }}
            <span class="ed-grip-inline" aria-hidden="true">← →</span>
            {{ t.settings.elements.introSides.after }}
          </template>
          <template v-else-if="sortable">
            {{ t.settings.elements.intro.before }}
            <span class="ed-grip-inline" aria-hidden="true">⠿</span>
            {{ t.settings.elements.intro.after }}
          </template>
          <template v-else>{{ t.settings.elements.introFixed }}</template>
        </p>

        <ul v-if="fixedBefore.length > 0" class="ed-list">
          <li v-for="f in fixedBefore" :key="f.key" class="ed-row is-fixed">
            <span class="ed-lock" aria-hidden="true"><Icon name="lock" /></span>
            <span class="ed-name">{{ f.label }}</span>
            <span class="ed-tag">{{ t.settings.elements.fixedTag }}</span>
          </li>
        </ul>

        <div
          ref="listEl"
          class="ed-lists"
          :class="{ dragging: dragId !== null, 'has-sides': split !== undefined }"
          @pointermove="onMove"
          @pointerup="onUp"
          @pointercancel="onCancel"
          @lostpointercapture="onCancel"
          @pointerleave="onCancel"
        >
          <div
            v-for="box in boxes"
            :key="box.side ?? 'all'"
            class="ed-box"
            :class="box.side ? `ed-box--${box.side}` : undefined"
          >
            <!-- The right box's heading is the marker's slot: a drag measures it as one. -->
            <div
              v-if="box.side"
              class="ed-side"
              :data-row="box.side === 'right' ? split : undefined"
            >
              <span class="ed-side-name">{{ t.settings.elements.sides[box.side] }}</span>
              <span class="ed-side-help">{{ t.settings.elements.sidesHelp[box.side] }}</span>
            </div>
            <ol
              class="ed-list"
              :aria-label="box.side ? `${title}: ${t.settings.elements.sides[box.side]}` : title"
            >
              <li
                v-for="(r, n) in box.rows"
                :key="r.entry.id"
                class="ed-row"
                :class="{
                  'is-dragged': dragId === r.entry.id,
                  'is-off': !r.entry.visible,
                  'is-blocked': blockedBy(spec, shown, r.entry.id) !== null,
                  'is-lit': litId === r.entry.id && dragId === null
                }"
                :data-row="r.entry.id"
                @pointerenter="lightRow(r.entry.id)"
                @pointerleave="lightRow(null)"
                @focusin="lightRow(r.entry.id)"
                @focusout="lightRow(null)"
              >
                <button
                  v-if="sortable"
                  type="button"
                  class="ed-handle"
                  data-focus="handle"
                  :aria-label="t.settings.elements.move(labelOf(r.entry.id))"
                  :aria-describedby="helpId"
                  @pointerdown="onHandleDown($event, r.entry.id)"
                  @keydown="onHandleKey($event, r.entry.id, r.index)"
                >
                  <span aria-hidden="true">⠿</span>
                </button>
                <span v-if="sortable" class="ed-pos" aria-hidden="true">{{ n + 1 }}</span>
                <span
                  v-if="isRequired(spec, r.entry.id)"
                  class="ed-eye is-locked"
                  :title="t.settings.elements.required"
                >
                  <Icon name="lock" :label="t.settings.elements.required" />
                </span>
                <button
                  v-else
                  type="button"
                  class="ed-eye"
                  data-focus="eye"
                  :aria-pressed="r.entry.visible"
                  :aria-label="
                    r.entry.visible
                      ? t.settings.elements.hide(labelOf(r.entry.id))
                      : t.settings.elements.show(labelOf(r.entry.id))
                  "
                  @click="onEye(r.entry.id, !r.entry.visible)"
                >
                  <Icon :name="r.entry.visible ? 'eye' : 'eye-off'" />
                </button>
                <span class="ed-text">
                  <span class="ed-name">{{ labelOf(r.entry.id) }}</span>
                  <span v-if="blockedBy(spec, shown, r.entry.id) !== null" class="ed-hint">{{
                    t.settings.elements.needsParent(
                      labelOf(blockedBy(spec, shown, r.entry.id) as Id)
                    )
                  }}</span>
                  <span v-else-if="labels[r.entry.id]?.hint" class="ed-hint">{{
                    labels[r.entry.id]?.hint
                  }}</span>
                </span>
                <span v-if="$slots.extra" class="ed-extra"
                  ><slot :id="r.entry.id" name="extra" :visible="r.entry.visible"
                /></span>
                <span v-if="sortable" class="ed-arrows">
                  <button
                    v-if="box.side"
                    type="button"
                    class="st-btn st-btn-icon st-btn-ghost"
                    data-focus="side"
                    :aria-label="sideLabel(r.entry.id, box.side)"
                    :title="sideLabel(r.entry.id, box.side)"
                    :disabled="dragId !== null"
                    @click="moveAcross(r.entry.id)"
                  >
                    {{ box.side === 'left' ? '→' : '←' }}
                  </button>
                  <button
                    type="button"
                    class="st-btn st-btn-icon st-btn-ghost"
                    data-focus="up"
                    :aria-label="t.settings.elements.moveUp(labelOf(r.entry.id))"
                    :disabled="!canStep(r.entry.id, r.index, -1) || dragId !== null"
                    @click="move(r.entry.id, -1, 'up')"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    class="st-btn st-btn-icon st-btn-ghost"
                    data-focus="down"
                    :aria-label="t.settings.elements.moveDown(labelOf(r.entry.id))"
                    :disabled="!canStep(r.entry.id, r.index, 1) || dragId !== null"
                    @click="move(r.entry.id, 1, 'down')"
                  >
                    ↓
                  </button>
                </span>
              </li>
              <li v-if="box.side && box.rows.length === 0" class="ed-row is-empty">
                {{ t.settings.elements.sideEmpty }}
              </li>
            </ol>
          </div>
        </div>

        <!-- An info bar's hidden items: out of the boxes, in a group of their own. -->
        <div v-if="hiddenRows.length > 0" class="ed-hidden" :class="{ 'is-open': hiddenOpen }">
          <button
            type="button"
            class="ed-hidden-btn"
            :class="{ 'is-lit': hiddenLit && !hiddenOpen }"
            data-focus="hidden"
            :aria-expanded="hiddenOpen"
            :aria-controls="hiddenListId"
            @click="hiddenOpen = !hiddenOpen"
          >
            <span class="ed-hidden-chev" aria-hidden="true"><Icon name="chevron" /></span>
            <span class="ed-hidden-name">{{
              t.settings.elements.hiddenGroup(hiddenRows.length)
            }}</span>
            <span class="ed-hidden-help">{{ t.settings.elements.hiddenGroupHelp }}</span>
          </button>
          <ul
            v-show="hiddenOpen"
            :id="hiddenListId"
            class="ed-list ed-hidden-list"
            :aria-label="`${title}: ${t.settings.elements.hiddenGroup(hiddenRows.length)}`"
          >
            <li
              v-for="r in hiddenRows"
              :key="r.entry.id"
              class="ed-row is-off"
              :class="{ 'is-lit': litId === r.entry.id }"
              :data-row="r.entry.id"
              @pointerenter="lightRow(r.entry.id)"
              @pointerleave="lightRow(null)"
              @focusin="lightRow(r.entry.id)"
              @focusout="lightRow(null)"
            >
              <button
                type="button"
                class="ed-eye"
                data-focus="eye"
                :aria-pressed="false"
                :aria-label="t.settings.elements.show(labelOf(r.entry.id))"
                @click="onEye(r.entry.id, true)"
              >
                <Icon name="eye-off" />
              </button>
              <span class="ed-text">
                <span class="ed-name">{{ labelOf(r.entry.id) }}</span>
                <span v-if="labels[r.entry.id]?.hint" class="ed-hint">{{
                  labels[r.entry.id]?.hint
                }}</span>
              </span>
              <span class="ed-tag ed-side-tag">{{ t.settings.elements.hiddenSide[r.side] }}</span>
            </li>
          </ul>
        </div>

        <ul v-if="fixedAfter.length > 0" class="ed-list ed-after">
          <li v-for="f in fixedAfter" :key="f.key" class="ed-row is-fixed">
            <span class="ed-lock" aria-hidden="true"><Icon name="lock" /></span>
            <span class="ed-name">{{ f.label }}</span>
            <span class="ed-tag">{{ t.settings.elements.fixedTag }}</span>
          </li>
        </ul>

        <p v-if="empty" class="st-help ed-warn">
          {{ emptyHides ? t.settings.elements.emptyHides : t.settings.elements.empty }}
        </p>

        <p v-if="note" class="st-help ed-note">{{ note }}</p>

        <div v-if="$slots.footer" class="ed-zone">
          <slot name="footer" />
        </div>
      </template>

      <div class="ed-foot">
        <button
          type="button"
          class="st-btn st-btn-sm st-btn-ghost"
          :aria-label="t.settings.elements.resetLabel(title)"
          :disabled="atDefault"
          @click="reset"
        >
          {{ t.settings.elements.reset }}
        </button>
      </div>
      <p class="st-sr-only" aria-live="polite">{{ message }}</p>
    </div>
  </component>
</template>

<style scoped>
.ed {
  padding: 12px 14px 10px;
  border: 1px solid var(--st-border);
  border-radius: var(--st-radius);
  background: var(--st-surface);
  box-shadow: var(--st-lit);
}

/* In an accordion the accordion is the card. */
.ed.in-acc {
  border: 0;
  border-radius: 0;
  background: transparent;
  box-shadow: none;
}

/* The zone's switch (and its size): ruled rows above the list, ruled off from it. */
.ed-head {
  display: flex;
  flex-direction: column;
  margin: -6px 0 10px;
  border-bottom: 1px solid var(--st-border);
}

.ed-head > :deep(* + *) {
  border-top: 1px solid var(--st-border);
}

.ed-intro {
  margin-bottom: 10px;
}

.ed-grip-inline {
  color: var(--ov-fg);
}

.ed-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin: 0;
  padding: 0;
  list-style: none;
}

/* Measured by the rows' narrow layout (below). */
.ed-lists {
  container: ed-lists / inline-size;
}

.ed-list + .ed-lists,
.ed-lists + .ed-list,
.ed-after {
  margin-top: 4px;
}

/* Two sides: a box each, its heading in caps (said, not tinted). */
.ed-lists.has-sides {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.has-sides .ed-box {
  min-width: 0;
  padding: 8px;
  border: 1px solid var(--st-border-hi);
  border-radius: var(--st-radius);
  background: var(--st-field);
}

.ed-side {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 2px 10px;
  margin: 2px 4px 8px;
}

.ed-side-name {
  color: var(--ov-fg);
  font-family: var(--ov-font-small);
  font-size: 11px;
  font-weight: var(--ov-w-strong);
  letter-spacing: var(--ov-track-caps);
  text-transform: uppercase;
}

.ed-side-help {
  color: var(--ov-fg-dim);
  font-size: 12px;
}

.ed-row {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 44px;
  padding: 4px 6px;
  border: 1px solid var(--st-border);
  border-radius: var(--st-radius-sm);
  background: var(--st-surface-hi);
}

.ed-row.is-fixed {
  min-height: 34px;
  border-style: dashed;
  background: transparent;
  color: var(--ov-fg-dim);
}

/* An empty side: where a dragged element can go. */
.ed-row.is-empty {
  justify-content: center;
  border-style: dashed;
  background: transparent;
  color: var(--ov-fg-dim);
  font-size: 12.5px;
}

.ed-row.is-off .ed-name,
.ed-row.is-off .ed-pos {
  color: var(--ov-fg-dim);
}

.ed-row.is-blocked .ed-eye {
  opacity: 0.5;
}

/* Picked up: lifted and outlined in neutral ink (the accent means you). */
.ed-row.is-dragged {
  border-color: var(--st-border-strong);
  background: var(--st-hover);
}

.ed-lists.dragging,
.ed-lists.dragging * {
  cursor: grabbing;
}

/* Its element is pointed at in the preview (or the other way round): an outline, no tint. */
.ed-row.is-lit,
.ed-hidden-btn.is-lit {
  border-color: var(--st-border-strong);
  outline: 1px solid var(--st-border-strong);
  outline-offset: -1px;
}

/* A closed zone whose element the preview points at. */
.is-zone-lit {
  outline: 1px solid var(--st-border-strong);
  outline-offset: -1px;
}

/* An info bar's hidden items: a quiet disclosure under the two boxes. */
.ed-hidden {
  margin-top: 10px;
}

.ed-hidden-btn {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 2px 10px;
  width: 100%;
  min-height: 34px;
  padding: 6px 8px;
  border: 1px dashed var(--st-border-hi);
  border-radius: var(--st-radius-sm);
  background: transparent;
  color: var(--ov-fg-muted);
  font: inherit;
  text-align: left;
  cursor: pointer;
}

.ed-hidden-btn:hover {
  background: var(--st-hover);
  color: var(--ov-fg);
}

.ed-hidden-btn:focus-visible {
  outline: 2px solid var(--st-focus, var(--ov-fg));
  outline-offset: 1px;
}

.ed-hidden-chev {
  display: inline-flex;
  align-self: center;
  font-size: 12px;
  transform: rotate(-90deg);
}

.ed-hidden.is-open .ed-hidden-chev {
  transform: none;
}

@media (prefers-reduced-motion: no-preference) {
  .ed-hidden-chev {
    transition: transform 0.12s ease-out;
  }
}

.ed-hidden-name {
  color: var(--ov-fg);
  font-family: var(--ov-font-small);
  font-size: 11px;
  font-weight: var(--ov-w-strong);
  letter-spacing: var(--ov-track-caps);
  text-transform: uppercase;
}

.ed-hidden-help {
  font-size: 12px;
}

.ed-hidden-list {
  margin-top: 6px;
}

.ed-side-tag {
  flex: none;
  color: var(--ov-fg-dim);
}

.ed-handle,
.ed-eye {
  display: inline-flex;
  flex: none;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  padding: 0;
  border: 0;
  border-radius: var(--st-radius-sm);
  background: transparent;
  color: var(--ov-fg-muted);
  font-size: 16px;
}

.ed-handle {
  width: 28px;
  cursor: grab;
  touch-action: none;
}

.ed-eye {
  cursor: pointer;
}

.ed-eye[aria-pressed='true'] {
  color: var(--ov-fg);
}

.ed-eye.is-locked {
  font-size: 13px;
  color: var(--ov-fg-dim);
  cursor: default;
}

.ed-handle:hover,
.ed-eye:not(.is-locked):hover {
  background: var(--st-hover);
  color: var(--ov-fg);
}

.ed-handle:focus-visible,
.ed-eye:focus-visible {
  outline: 2px solid var(--st-focus, var(--ov-fg));
  outline-offset: 1px;
}

.ed-pos {
  flex: none;
  width: 1.4em;
  color: var(--ov-fg-muted);
  font-family: var(--ov-font-num);
  font-size: 12px;
  font-weight: var(--ov-w-strong);
  font-variant-numeric: tabular-nums;
  text-align: right;
}

.ed-lock {
  display: inline-flex;
  justify-content: center;
  width: 28px;
  font-size: 13px;
}

.ed-text {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  min-width: 0;
}

.ed-name {
  flex: 1 1 auto;
  min-width: 0;
}

.ed-hint {
  color: var(--ov-fg-muted);
  font-size: 12px;
}

.ed-tag {
  margin-right: 6px;
  font-family: var(--ov-font-small);
  font-size: 11px;
  font-weight: var(--ov-w-strong);
  letter-spacing: var(--ov-track-tag);
  text-transform: uppercase;
}

.ed-extra {
  display: inline-flex;
  flex: none;
  align-items: center;
}

/*
 * A narrow list (a narrow window, or a column of a wide one): a row's own option goes on a line
 * of its own under the name, so the name keeps its width and the arrows stay in the row.
 */
@container ed-lists (max-width: 520px) {
  .ed-row:has(.ed-extra) {
    flex-wrap: wrap;
    row-gap: 2px;
  }

  .ed-row:has(.ed-extra) .ed-text {
    flex-basis: 0;
  }

  .ed-extra {
    flex: 1 1 100%;
    order: 1;
    min-width: 0;
    padding: 0 0 4px 36px;
  }
}

.ed-arrows {
  display: inline-flex;
  flex: none;
  gap: 2px;
}

.ed-warn {
  margin-top: 8px;
  color: var(--ov-warn);
}

.ed-note {
  margin-top: 8px;
}

/* The zone's own options: one per row, ruled off from the list and from each other. */
.ed-zone {
  display: flex;
  flex-direction: column;
  margin-top: 10px;
  border-top: 1px solid var(--st-border);
}

.ed-zone > :deep(* + *) {
  border-top: 1px solid var(--st-border);
}

.ed-foot {
  display: flex;
  justify-content: flex-end;
  margin-top: 8px;
}
</style>
