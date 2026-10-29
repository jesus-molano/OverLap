<script setup lang="ts" generic="Id extends string">
import { computed, nextTick, onBeforeUnmount, shallowRef, useId, watch } from 'vue'
import type { CustomizeZoneId, ElementEntry } from '@shared/types'
import { useI18n } from '../../composables/useI18n'
import Icon from '../../ui/Icon.vue'
import AccordionSection from '../layout/AccordionSection.vue'
import PageSection from '../layout/PageSection.vue'
import { injectZoneRegistry, isZoneOpen, setZonesOpen, zoneOfSpec } from '../layout/zonesOpen'
import { useOptimistic } from '../useOptimistic'
import {
  blockedBy,
  defaults,
  dropIndex,
  isDefault,
  isRequired,
  keyAction,
  movedAcross,
  movedBy,
  movedTo,
  movedMessage,
  shownCount,
  sideMessage,
  sideOf,
  sides,
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
    /** The accordion's summary instead of the count ('Normal · 4 elementos'). */
    summary?: string
    /** The zone is switched off: its list is greyed out (still editable, for when it is on). */
    dim?: boolean
  }>(),
  {
    emptyHides: false,
    fixedBefore: () => [],
    fixedAfter: () => [],
    note: undefined,
    split: undefined,
    omit: () => [],
    summary: undefined,
    dim: false
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

const boxes = computed<readonly Box[]>(() => {
  const list = shown.value
  if (props.split !== undefined) {
    const { left, right } = sides(list, props.split)
    return [
      { side: 'left', rows: left },
      { side: 'right', rows: right }
    ]
  }
  const rows = list
    .map((entry, index) => ({ entry, index }))
    .filter((r) => !props.omit.includes(r.entry.id))
  return [{ side: null, rows }]
})

/** The rows drawn (no marker, nothing omitted): what the count counts. */
const rowEntries = computed(() => boxes.value.flatMap((b) => b.rows.map((r) => r.entry)))
const countNote = computed(() =>
  t.value.settings.elements.count(shownCount(rowEntries.value), rowEntries.value.length)
)
const empty = computed(() => shownCount(rowEntries.value) === 0)
const atDefault = computed(() => isDefault(props.spec, current.value))

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
function say(text: string): void {
  message.value = text
}

const labelOf = (id: Id): string => props.labels[id]?.label ?? id

function setVisible(id: Id, visible: boolean): void {
  if (!visible && isRequired(props.spec, id)) return
  void send(toggled(props.spec, current.value, id, visible), { kind: 'visible', id, visible })
  say(visibilityMessage(t.value, labelOf(id), visible))
}

type FocusTarget = 'handle' | 'up' | 'down' | 'side'

/** Keeps keyboard focus on the moved row's control (its buttons may have become disabled). */
async function refocus(id: Id, target: FocusTarget): Promise<void> {
  await nextTick()
  const row = listEl.value?.querySelector<HTMLElement>(`li[data-row="${id}"]`)
  const want = row?.querySelector<HTMLButtonElement>(`[data-focus="${target}"]`)
  const el =
    want && !want.disabled ? want : row?.querySelector<HTMLElement>('[data-focus="handle"]')
  el?.focus()
}

/** 'iRating: posición 3 de 8.', or the new side when it changed ('SoF: a la derecha.'). */
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
  const to = next.findIndex((e) => e.id === id)
  say(movedMessage(t.value, labelOf(id), to, next.length))
}

function move(id: Id, delta: number, target: FocusTarget): void {
  const before = current.value
  const next = movedBy(props.spec, before, id, delta)
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

function reset(): void {
  void send(defaults(props.spec), { kind: 'reset' })
  say(t.value.settings.elements.resetDone(props.title))
}

function onHandleKey(e: KeyboardEvent, id: Id, index: number): void {
  const action = keyAction(e.key, index, current.value.length)
  if (action === null) return
  e.preventDefault()
  if (action.kind === 'by') move(id, action.delta, 'handle')
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
  from: number
  to: number
  centres: number[]
  base: ElementEntry<Id>[]
}
let drag: Drag | null = null

/**
 * Each entry's slot centre (px) in list order: its row, or for the marker the heading of the
 * right box, which sits where the marker is in the list.
 */
function slotCentres(lists: HTMLElement, base: readonly ElementEntry<Id>[]): number[] {
  return base.map((e) => {
    const el = lists.querySelector<HTMLElement>(`[data-row="${e.id}"]`)
    if (el === null) return Number.NaN
    const r = el.getBoundingClientRect()
    return r.top + r.height / 2
  })
}

function onHandleDown(e: PointerEvent, id: Id): void {
  const lists = listEl.value
  if (e.button !== 0 || lists === null || drag !== null || !sortable.value) return
  const base = current.value.map((c) => ({ id: c.id, visible: c.visible }))
  const from = base.findIndex((c) => c.id === id)
  if (from < 0) return
  const centres = slotCentres(lists, base)
  e.preventDefault()
  try {
    lists.setPointerCapture(e.pointerId)
  } catch {
    // Without capture, leaving the list cancels (pointerleave).
  }
  drag = { pointerId: e.pointerId, id, from, to: from, centres, base }
  dragId.value = id
  dragOrder.value = base
}

function onMove(e: PointerEvent): void {
  if (drag === null || e.pointerId !== drag.pointerId) return
  const to = dropIndex(drag.centres, drag.from, e.clientY)
  if (to === drag.to) return
  drag.to = to
  dragOrder.value = movedTo(props.spec, drag.base, drag.id, to)
}

function endDrag(): void {
  drag = null
  dragId.value = null
  dragOrder.value = null
}

function onUp(e: PointerEvent): void {
  if (drag === null || e.pointerId !== drag.pointerId) return
  const { id, from, to, base } = drag
  endDrag()
  if (to === from) return
  const next = movedTo(props.spec, base, id, to)
  void send(next, { kind: 'move', id, to })
  announceMove(id, base, next)
}

function onCancel(e: PointerEvent): void {
  if (drag !== null && e.pointerId === drag.pointerId) endDrag()
}
</script>

<template>
  <component :is="frame.is" v-bind="frame.props">
    <div class="ed" :class="{ 'in-acc': zone !== null, 'is-dim': dim }">
      <div v-if="$slots.head" class="ed-head">
        <slot name="head" />
      </div>

      <p :id="helpId" class="st-help ed-intro">
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
          <div v-if="box.side" class="ed-side" :data-row="box.side === 'right' ? split : undefined">
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
                'is-blocked': blockedBy(spec, shown, r.entry.id) !== null
              }"
              :data-row="r.entry.id"
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
                :aria-pressed="r.entry.visible"
                :aria-label="
                  r.entry.visible
                    ? t.settings.elements.hide(labelOf(r.entry.id))
                    : t.settings.elements.show(labelOf(r.entry.id))
                "
                @click="setVisible(r.entry.id, !r.entry.visible)"
              >
                <Icon :name="r.entry.visible ? 'eye' : 'eye-off'" />
              </button>
              <span class="ed-text">
                <span class="ed-name">{{ labelOf(r.entry.id) }}</span>
                <span v-if="blockedBy(spec, shown, r.entry.id) !== null" class="ed-hint">{{
                  t.settings.elements.needsParent(labelOf(blockedBy(spec, shown, r.entry.id) as Id))
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
                  :disabled="r.index === 0 || dragId !== null"
                  @click="move(r.entry.id, -1, 'up')"
                >
                  ↑
                </button>
                <button
                  type="button"
                  class="st-btn st-btn-icon st-btn-ghost"
                  data-focus="down"
                  :aria-label="t.settings.elements.moveDown(labelOf(r.entry.id))"
                  :disabled="r.index === shown.length - 1 || dragId !== null"
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

/* Switched off: the list stays editable, quieter. */
.ed.is-dim .ed-lists,
.ed.is-dim .ed-intro {
  opacity: 0.55;
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
