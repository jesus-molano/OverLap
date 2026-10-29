<script setup lang="ts" generic="Id extends string">
import { computed, nextTick, shallowRef, useId } from 'vue'
import type { ElementEntry } from '@shared/types'
import { useI18n } from '../../composables/useI18n'
import Icon from '../../ui/Icon.vue'
import PageSection from '../layout/PageSection.vue'
import { useOptimistic } from '../useOptimistic'
import {
  blockedBy,
  defaults,
  dropIndex,
  isDefault,
  isRequired,
  keyAction,
  movedBy,
  movedTo,
  movedMessage,
  shownCount,
  toggled,
  visibilityMessage,
  type ElementChange,
  type ElementText,
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
  }>(),
  { emptyHides: false, fixedBefore: () => [], fixedAfter: () => [] }
)

defineSlots<{
  /** Options of one row after its label (the trend arrow of 'trackTemp'...). */
  extra?(p: { id: Id; visible: boolean }): unknown
  /** Below the list (the zone's own options: size, logos...). */
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
const countNote = computed(() =>
  t.value.settings.elements.count(shownCount(shown.value), shown.value.length)
)
const empty = computed(() => shownCount(current.value) === 0)
const atDefault = computed(() => isDefault(props.spec, current.value))

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

type FocusTarget = 'handle' | 'up' | 'down'

/** Keeps keyboard focus on the moved row's control (its buttons may have become disabled). */
async function refocus(id: Id, target: FocusTarget): Promise<void> {
  await nextTick()
  const row = listEl.value?.querySelector<HTMLElement>(`[data-el="${id}"]`)
  const want = row?.querySelector<HTMLButtonElement>(`[data-focus="${target}"]`)
  const el =
    want && !want.disabled ? want : row?.querySelector<HTMLElement>('[data-focus="handle"]')
  el?.focus()
}

function announceMove(id: Id, next: readonly Readonly<ElementEntry<Id>>[]): void {
  const to = next.findIndex((e) => e.id === id)
  say(movedMessage(t.value, labelOf(id), to, next.length))
}

function move(id: Id, delta: number, target: FocusTarget): void {
  const next = movedBy(props.spec, current.value, id, delta)
  const to = next.findIndex((e) => e.id === id)
  if (to === current.value.findIndex((e) => e.id === id)) return
  void send(next, { kind: 'move', id, to })
  announceMove(id, next)
  void refocus(id, target)
}

function moveTo(id: Id, index: number): void {
  const next = movedTo(props.spec, current.value, id, index)
  void send(next, { kind: 'move', id, to: index })
  announceMove(id, next)
  void refocus(id, 'handle')
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

// ---- Pointer drag (captured by the list, which never moves) ------------------------------

interface Drag {
  pointerId: number
  id: Id
  from: number
  to: number
  centres: number[]
  base: ElementEntry<Id>[]
}
let drag: Drag | null = null

function onHandleDown(e: PointerEvent, id: Id): void {
  const list = listEl.value
  if (e.button !== 0 || list === null || drag !== null || !sortable.value) return
  const base = current.value.map((c) => ({ id: c.id, visible: c.visible }))
  const from = base.findIndex((c) => c.id === id)
  if (from < 0) return
  const rows = Array.from(list.querySelectorAll<HTMLElement>('[data-el]'))
  const centres = rows.map((el) => {
    const r = el.getBoundingClientRect()
    return r.top + r.height / 2
  })
  e.preventDefault()
  try {
    list.setPointerCapture(e.pointerId)
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
  announceMove(id, next)
}

function onCancel(e: PointerEvent): void {
  if (drag !== null && e.pointerId === drag.pointerId) endDrag()
}
</script>

<template>
  <PageSection :title="title" :card="false" :note="countNote">
    <div class="ed">
      <p :id="helpId" class="st-help ed-intro">
        <template v-if="sortable">
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

      <ol
        ref="listEl"
        class="ed-list"
        :class="{ dragging: dragId !== null }"
        :aria-label="title"
        @pointermove="onMove"
        @pointerup="onUp"
        @pointercancel="onCancel"
        @lostpointercapture="onCancel"
        @pointerleave="onCancel"
      >
        <li
          v-for="(e, i) in shown"
          :key="e.id"
          class="ed-row"
          :class="{
            'is-dragged': dragId === e.id,
            'is-off': !e.visible,
            'is-blocked': blockedBy(spec, shown, e.id) !== null
          }"
          :data-el="e.id"
        >
          <button
            v-if="sortable"
            type="button"
            class="ed-handle"
            data-focus="handle"
            :aria-label="t.settings.elements.move(labelOf(e.id))"
            :aria-describedby="helpId"
            @pointerdown="onHandleDown($event, e.id)"
            @keydown="onHandleKey($event, e.id, i)"
          >
            <span aria-hidden="true">⠿</span>
          </button>
          <span v-if="sortable" class="ed-pos" aria-hidden="true">{{ i + 1 }}</span>
          <span
            v-if="isRequired(spec, e.id)"
            class="ed-eye is-locked"
            :title="t.settings.elements.required"
          >
            <Icon name="lock" :label="t.settings.elements.required" />
          </span>
          <button
            v-else
            type="button"
            class="ed-eye"
            :aria-pressed="e.visible"
            :aria-label="
              e.visible
                ? t.settings.elements.hide(labelOf(e.id))
                : t.settings.elements.show(labelOf(e.id))
            "
            @click="setVisible(e.id, !e.visible)"
          >
            <Icon :name="e.visible ? 'eye' : 'eye-off'" />
          </button>
          <span class="ed-text">
            <span class="ed-name">{{ labelOf(e.id) }}</span>
            <span v-if="blockedBy(spec, shown, e.id) !== null" class="ed-hint">{{
              t.settings.elements.needsParent(labelOf(blockedBy(spec, shown, e.id) as Id))
            }}</span>
            <span v-else-if="labels[e.id]?.hint" class="ed-hint">{{ labels[e.id]?.hint }}</span>
          </span>
          <span v-if="$slots.extra" class="ed-extra"
            ><slot :id="e.id" name="extra" :visible="e.visible"
          /></span>
          <span v-if="sortable" class="ed-arrows">
            <button
              type="button"
              class="st-btn st-btn-icon st-btn-ghost"
              data-focus="up"
              :aria-label="t.settings.elements.moveUp(labelOf(e.id))"
              :disabled="i === 0 || dragId !== null"
              @click="move(e.id, -1, 'up')"
            >
              ↑
            </button>
            <button
              type="button"
              class="st-btn st-btn-icon st-btn-ghost"
              data-focus="down"
              :aria-label="t.settings.elements.moveDown(labelOf(e.id))"
              :disabled="i === shown.length - 1 || dragId !== null"
              @click="move(e.id, 1, 'down')"
            >
              ↓
            </button>
          </span>
        </li>
      </ol>

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

      <slot name="footer" />

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
  </PageSection>
</template>

<style scoped>
.ed {
  padding: 12px 14px 10px;
  border: 1px solid var(--st-border);
  border-radius: var(--st-radius);
  background: var(--st-surface);
  box-shadow: var(--st-lit);
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

.ed-list + .ed-list,
.ed-after {
  margin-top: 4px;
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

.ed-list.dragging,
.ed-list.dragging * {
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

.ed-foot {
  display: flex;
  justify-content: flex-end;
  margin-top: 8px;
}
</style>
