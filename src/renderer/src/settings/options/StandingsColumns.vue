<script setup lang="ts">
import { computed, nextTick, shallowRef, useId } from 'vue'
import { STANDINGS_COLUMN_IDS } from '@shared/settingsSchema'
import type { StandingsColumn, StandingsColumnId, StandingsOptions } from '@shared/types'
import { useI18n } from '../../composables/useI18n'
import { useOptions } from '../../composables/useWidgetSettings'
import Icon from '../../ui/Icon.vue'
import {
  columnHint,
  columnLabel,
  columnVisiblePatch,
  defaultOrder,
  dropIndex,
  fixedColumns,
  moveColumn,
  movedMessage,
  sameOrder,
  visibilityMessage
} from '../columns'
import ToggleControl from '../controls/ToggleControl.vue'
import { updateSection, type Setter } from '../editor'
import PageSection from '../layout/PageSection.vue'
import { useOptimistic } from '../useOptimistic'

/**
 * Order and visibility of the standings' right-hand columns. Reorder by dragging the handle
 * (pointer events, captured by the list so the rows can move under the pointer), with the
 * ↑/↓ buttons, or with the arrow keys on the handle. Moves are announced to screen readers.
 */
const opts = useOptions('standings')
const t = useI18n()
const listEl = shallowRef<HTMLElement | null>(null)
const helpId = `${useId()}-help`

// Discrete edits: each one goes out at once, built from what is shown (see useOptimistic).
const optimistic = useOptimistic<StandingsColumn[]>(() => opts.value.columns)
const columns = optimistic.value

/** Shows `next` at once and sends it with any options that go with it. */
function send(next: StandingsColumn[], extra: Partial<StandingsOptions> = {}): Promise<void> {
  return optimistic.run(next, () => updateSection('standings', { ...extra, columns: next }))
}

/** Live order while a drag is in progress (sent on drop only). */
const dragOrder = shallowRef<StandingsColumn[] | null>(null)
const dragId = shallowRef<StandingsColumnId | null>(null)
const shown = computed(() => dragOrder.value ?? columns.value)
const visibleCount = computed(() => shown.value.filter((c) => c.visible).length)
const isDefaultOrder = computed(() => sameOrder(columns.value, defaultOrder(columns.value)))

/** Per-column texts, worded again only when the language changes (not while dragging). */
interface ColumnTexts {
  readonly label: string
  readonly hint: string | undefined
  readonly move: string
  readonly up: string
  readonly down: string
}
const texts = computed(() => {
  const m = t.value
  const c = m.settings.columns
  const out = {} as Record<StandingsColumnId, ColumnTexts>
  for (const id of STANDINGS_COLUMN_IDS) {
    const label = columnLabel(m, id)
    out[id] = {
      label,
      hint: columnHint(m, id),
      move: c.move(label),
      up: c.moveUp(label),
      down: c.moveDown(label)
    }
  }
  return out
})
const fixed = computed(() => fixedColumns(t.value))
const countNote = computed(() =>
  t.value.settings.columns.count(visibleCount.value, shown.value.length)
)

const message = shallowRef('')
function say(text: string): void {
  message.value = text
}

// One stable setter per column (ToggleControl's apply), routed through columnVisiblePatch.
const visibilitySetters = Object.fromEntries(
  STANDINGS_COLUMN_IDS.map((id) => [
    id,
    ((visible: boolean) => {
      say(visibilityMessage(t.value, id, visible))
      const patch = columnVisiblePatch({ ...opts.value, columns: columns.value }, id, visible)
      return send(patch.columns ?? columns.value, patch)
    }) satisfies Setter<boolean>
  ])
) as Record<StandingsColumnId, Setter<boolean>>

type FocusTarget = 'handle' | 'up' | 'down'

/** Keeps keyboard focus on the moved row's control (its buttons may have become disabled). */
async function refocus(id: StandingsColumnId, target: FocusTarget): Promise<void> {
  await nextTick()
  const row = listEl.value?.querySelector<HTMLElement>(`[data-col="${id}"]`)
  const want = row?.querySelector<HTMLButtonElement>(`[data-focus="${target}"]`)
  const el =
    want && !want.disabled ? want : row?.querySelector<HTMLElement>('[data-focus="handle"]')
  el?.focus()
}

function move(id: StandingsColumnId, delta: number, target: FocusTarget): void {
  const cols = columns.value
  const from = cols.findIndex((c) => c.id === id)
  const to = from + delta
  if (from < 0 || to < 0 || to >= cols.length) return
  void send(moveColumn(cols, from, to))
  say(movedMessage(t.value, id, to, cols.length))
  void refocus(id, target)
}

function resetOrder(): void {
  void send(defaultOrder(columns.value))
  say(t.value.settings.columns.reordered)
}

// ---- Pointer drag ----------------------------------------------------------

interface Drag {
  pointerId: number
  id: StandingsColumnId
  from: number
  to: number
  /** Row centres (client px) when the drag started: one slot per row. */
  centres: number[]
  base: StandingsColumn[]
}
let drag: Drag | null = null

function onHandleDown(e: PointerEvent, id: StandingsColumnId): void {
  const list = listEl.value
  if (e.button !== 0 || list === null || drag !== null) return
  const base = columns.value.map((c) => ({ ...c }))
  const from = base.findIndex((c) => c.id === id)
  if (from < 0) return
  const rows = Array.from(list.querySelectorAll<HTMLElement>('[data-col]'))
  const centres = rows.map((el) => {
    const r = el.getBoundingClientRect()
    return r.top + r.height / 2
  })
  e.preventDefault()
  // Captured by the list, which never moves: a row that the reorder moves in the DOM would
  // lose the capture. Without capture (pointer no longer active) leaving the list cancels.
  try {
    list.setPointerCapture(e.pointerId)
  } catch {
    // Handled by pointerleave.
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
  dragOrder.value = moveColumn(drag.base, drag.from, to)
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
  void send(moveColumn(base, from, to))
  say(movedMessage(t.value, id, to, base.length))
}

function onCancel(e: PointerEvent): void {
  if (drag !== null && e.pointerId === drag.pointerId) endDrag()
}

function onHandleKey(e: KeyboardEvent, id: StandingsColumnId): void {
  if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
    e.preventDefault()
    move(id, e.key === 'ArrowUp' ? -1 : 1, 'handle')
  }
}
</script>

<template>
  <PageSection :title="t.settings.columns.title" :card="false" :note="countNote">
    <div class="editor">
      <p :id="helpId" class="st-help intro">
        {{ t.settings.columns.intro.before }}
        <span class="grip-inline" aria-hidden="true">⠿</span>
        {{ t.settings.columns.intro.after }}
      </p>

      <ul class="fixed" :aria-label="t.settings.columns.fixedList">
        <li v-for="f in fixed" :key="f.key" class="row is-fixed">
          <span class="lock" aria-hidden="true"><Icon name="lock" /></span>
          <span class="name">{{ f.label }}</span>
          <span class="tag">{{ t.settings.columns.fixedTag }}</span>
        </li>
      </ul>

      <ol
        ref="listEl"
        class="list"
        :class="{ dragging: dragId !== null }"
        :aria-label="t.settings.columns.list"
        @pointermove="onMove"
        @pointerup="onUp"
        @pointercancel="onCancel"
        @lostpointercapture="onCancel"
        @pointerleave="onCancel"
      >
        <li
          v-for="(c, i) in shown"
          :key="c.id"
          class="row"
          :class="{ 'is-dragged': dragId === c.id, 'is-off': !c.visible }"
          :data-col="c.id"
        >
          <button
            type="button"
            class="handle"
            data-focus="handle"
            :aria-label="texts[c.id].move"
            :aria-describedby="helpId"
            @pointerdown="onHandleDown($event, c.id)"
            @keydown="onHandleKey($event, c.id)"
          >
            <span aria-hidden="true">⠿</span>
          </button>
          <span class="pos" aria-hidden="true">{{ i + 1 }}</span>
          <div class="check">
            <ToggleControl
              :label="texts[c.id].label"
              :help="texts[c.id].hint"
              :current="c.visible"
              :apply="visibilitySetters[c.id]"
            />
          </div>
          <span class="arrows">
            <button
              type="button"
              class="st-btn st-btn-icon st-btn-ghost"
              data-focus="up"
              :aria-label="texts[c.id].up"
              :disabled="i === 0 || dragId !== null"
              @click="move(c.id, -1, 'up')"
            >
              ↑
            </button>
            <button
              type="button"
              class="st-btn st-btn-icon st-btn-ghost"
              data-focus="down"
              :aria-label="texts[c.id].down"
              :disabled="i === shown.length - 1 || dragId !== null"
              @click="move(c.id, 1, 'down')"
            >
              ↓
            </button>
          </span>
        </li>
      </ol>

      <div class="foot">
        <button
          type="button"
          class="st-btn st-btn-sm st-btn-ghost"
          :disabled="isDefaultOrder"
          @click="resetOrder"
        >
          {{ t.settings.columns.defaultOrder }}
        </button>
      </div>
      <p class="st-sr-only" aria-live="polite">{{ message }}</p>
    </div>
  </PageSection>
</template>

<style scoped>
.editor {
  padding: 12px 14px 10px;
  border: 1px solid var(--st-border);
  border-radius: var(--st-radius);
  background: var(--st-surface);
  box-shadow: var(--st-lit);
}

.intro {
  margin-bottom: 10px;
}

.grip-inline {
  color: var(--ov-fg);
}

.fixed,
.list {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.fixed {
  margin-bottom: 4px;
}

.row {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 44px;
  padding: 4px 6px;
  border: 1px solid var(--st-border);
  border-radius: var(--st-radius-sm);
  background: var(--st-surface-hi);
}

.row.is-fixed {
  min-height: 34px;
  border-style: dashed;
  background: transparent;
  color: var(--ov-fg-dim);
}

.row.is-off .pos {
  color: var(--ov-fg-dim);
}

/* Picked up: lifted and outlined in neutral ink (the accent means you). */
.row.is-dragged {
  border-color: var(--st-border-strong);
  background: var(--st-hover);
}

.row.is-dragged .handle {
  color: var(--ov-fg);
}

.list.dragging,
.list.dragging * {
  cursor: grabbing;
}

.lock {
  display: inline-flex;
  justify-content: center;
  width: 28px;
  font-size: 13px;
}

.name {
  flex: 1 1 auto;
}

.tag {
  margin-right: 6px;
  font-family: var(--ov-font-small);
  font-size: 11px;
  font-weight: var(--ov-w-strong);
  letter-spacing: var(--ov-track-tag);
  text-transform: uppercase;
}

.handle {
  display: inline-flex;
  flex: none;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 32px;
  padding: 0;
  border: 0;
  border-radius: var(--st-radius-sm);
  background: transparent;
  color: var(--ov-fg-muted);
  font-size: 16px;
  cursor: grab;
  touch-action: none;
}

.handle:hover {
  background: var(--st-hover);
  color: var(--ov-fg);
}

.pos {
  flex: none;
  width: 1.4em;
  color: var(--ov-fg-muted);
  font-family: var(--ov-font-num);
  font-size: 12px;
  font-weight: var(--ov-w-strong);
  font-variant-numeric: tabular-nums;
  text-align: right;
}

.check {
  flex: 1 1 auto;
  min-width: 0;
}

.arrows {
  display: inline-flex;
  flex: none;
  gap: 2px;
}

.foot {
  display: flex;
  justify-content: flex-end;
  margin-top: 8px;
}
</style>
