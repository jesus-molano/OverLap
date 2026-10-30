<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, shallowRef, useId, useTemplateRef, watch } from 'vue'
import { modifierCaps } from '@shared/accelerator'
import { useI18n } from '../../composables/useI18n'
import Icon from '../../ui/Icon.vue'
import {
  focusAfter,
  rowAnnouncement,
  rowCells,
  rowMessages,
  type DeviceNames,
  type ShortcutCell,
  type ShortcutRowView
} from '../shortcutsView'
import type { ShortcutCapture } from '../useShortcutCapture'
import { resetShortcut } from '../undo/restore'
import Keycaps from './Keycaps.vue'

/**
 * One row of the shortcuts table (ShortcutsPage .sc-table): the action and its help, one cell per
 * binding in its own column (Atajo 1 · 2 · 3) and Reset (an icon) in a column always kept, so no
 * cell moves when it comes and goes. A cell is the control: a click (or Enter) records over it,
 * its × (shown on hover or focus) or Delete / Backspace empties it. The first empty cell is
 * "+ Asignar" (records there), the ones after it "—". While recording, the cell says "Pulsa…"
 * and "Esc cancela", and shows the keys being held. A warning is the cell's own (a warning
 * outline and its second line); a sentence about one cell goes on a line under the row that
 * starts under that cell (the refusal, the AltGr warning, a combination another application
 * holds). "Saved" / "removed" are not drawn (the cell shows it, with a short flash): the row's
 * live region says them.
 *
 * The cell that started a recording keeps the focus: leaving it (Tab, a click elsewhere) cancels.
 * A change that takes the focused cell away (emptied, recorded over, Reset) moves the focus to
 * the cell now in its place, or to "+ Asignar".
 */
const props = withDefaults(
  defineProps<{
    row: ShortcutRowView
    capture: ShortcutCapture
    names: DeviceNames
    /** Seconds since its shortcut last ran, while recent (R37: «Pulsado hace 3 s»); else null. */
    used?: number | null
    /** When it last ran (performance.now() ms): each press restarts the line's flash (keyed). */
    pressedAt?: number | null
  }>(),
  { used: null, pressedAt: null }
)

const t = useI18n()
const liveId = useId()
const rowEl = useTemplateRef<HTMLElement>('rowEl')
/** The slot recorded on this row, null when none is. */
const recording = computed(() => {
  const a = props.capture.active.value
  return a !== null && a.action === props.row.action ? a.slot : null
})
const cells = computed(() => rowCells(props.row, recording.value))
const heldCaps = computed(() =>
  recording.value !== null ? modifierCaps(props.capture.held.value) : []
)
const messages = computed(() =>
  rowMessages(t.value, props.row, props.capture.feedback.value, recording.value)
)
const refused = computed(() => messages.value.some((m) => m.tone === 'error'))
const announcement = computed(() =>
  rowAnnouncement(t.value, props.row, props.capture.feedback.value, recording.value, props.names)
)
/** The cell whose binding was just saved: a short flash of its border. */
const flash = shallowRef<number | null>(null)
let flashTimer: ReturnType<typeof setTimeout> | undefined
/** The cell whose binding was just saved with a warning (AltGr): marked while it lasts. */
const warned = computed(() => {
  const f = props.capture.feedback.value
  if (f === null || f.action !== props.row.action || f.kind !== 'saved' || !f.warning) return null
  return props.row.bindings.find((b) => b.accelerator === f.accelerator)?.slot ?? null
})

function onRecorderBlur(): void {
  if (recording.value !== null) props.capture.cancel()
}

function record(slot: number): void {
  props.capture.toggle(props.row.action, slot)
}

/** Delete / Backspace on a binding's cell (not while recording: the capture has those keys). */
function onCellKey(e: KeyboardEvent, cell: ShortcutCell): void {
  if (cell.kind !== 'binding' || recording.value !== null) return
  if (e.key !== 'Delete' && e.key !== 'Backspace') return
  e.preventDefault()
  props.capture.remove(props.row.action, cell.slot)
}

/** A cell's name: 'Atajo 2 de Modo edición: Botón 3 de G29…, pulsa para cambiar'. */
function cellLabel(cell: ShortcutCell): string {
  const s = t.value.settings.shortcuts
  if (cell.kind === 'recording') return s.cancelLabel(props.row.label)
  if (cell.kind === 'binding')
    return s.changeLabel(cell.slot + 1, props.row.label, cell.binding.text)
  return s.addLabel(cell.slot + 1, props.row.label)
}

/** Its tooltip: a button in full, or why it does not work. */
function cellTitle(cell: ShortcutCell): string | undefined {
  if (cell.kind !== 'binding') return undefined
  const s = t.value.settings.shortcuts
  const b = cell.binding
  if (b.off) return b.button ? s.disconnectedHelp : s.status.unavailable
  return b.button ? b.text : undefined
}

watch(
  () => props.capture.feedback.value,
  (feedback) => {
    if (feedback?.action === props.row.action && feedback.kind === 'saved') {
      clearTimeout(flashTimer)
      flash.value = feedback.slot ?? null
      flashTimer = setTimeout(() => (flash.value = null), 600)
    }
    // The focused cell went away with a change on this row: the focus goes to what replaced it.
    void nextTick(() => {
      const target = focusAfter(feedback, props.row)
      const el = rowEl.value
      const lost = document.activeElement === null || document.activeElement === document.body
      if (target === null || el === null || !lost) return
      const slot = target === 'add' ? props.row.bindings.length : target.slot
      el.querySelector<HTMLElement>(`[data-slot="${slot}"] .sc-cell-main`)?.focus()
    })
  }
)
onBeforeUnmount(() => clearTimeout(flashTimer))
</script>

<template>
  <div ref="rowEl" class="sc-item" role="row">
    <div class="sc-act" role="rowheader">
      <span class="st-label">{{ row.label }}</span>
      <span class="st-help">{{ row.help }}</span>
      <span v-if="used !== null" :key="pressedAt ?? 0" class="sc-used">{{
        t.settings.shortcuts.used(used)
      }}</span>
    </div>

    <div
      v-for="cell in cells"
      :key="cell.slot"
      class="sc-cell"
      role="cell"
      :data-slot="cell.slot"
      :data-n="cell.slot + 1"
      :class="[
        `is-${cell.kind}`,
        {
          'is-off': cell.kind === 'binding' && cell.binding.off,
          'is-warned': warned === cell.slot,
          'is-flash': flash === cell.slot,
          'is-refused': cell.kind === 'recording' && refused
        }
      ]"
    >
      <!--
        One button per cell, whatever it holds (a binding, the recording, "+ Asignar"): the
        focus stays on it when it starts or stops recording.
      -->
      <button
        v-if="cell.kind !== 'empty'"
        type="button"
        class="sc-cell-main"
        :aria-label="cellLabel(cell)"
        :aria-describedby="liveId"
        :title="cellTitle(cell)"
        @click="record(cell.slot)"
        @blur="onRecorderBlur"
        @keydown="onCellKey($event, cell)"
      >
        <span v-if="cell.kind === 'recording'" class="sc-lines">
          <Keycaps v-if="heldCaps.length > 0" :keys="heldCaps" pending />
          <span v-else class="sc-prompt">
            <span class="sc-prompt-long">{{ t.settings.shortcuts.capture.prompt }}</span>
            <span class="sc-prompt-short">{{ t.settings.shortcuts.capture.promptShort }}</span>
          </span>
          <span class="sc-sub">{{ t.settings.shortcuts.capture.escHint }}</span>
        </span>
        <span v-else-if="cell.kind === 'assign'" class="sc-assign"
          ><Icon name="plus" />{{ t.settings.shortcuts.assign }}</span
        >
        <span v-else-if="cell.binding.button" class="sc-button">
          <Icon name="wheel" class="sc-button-icon" />
          <span class="sc-lines">
            <span class="sc-button-name">{{ cell.binding.button.button }}</span>
            <span v-if="cell.binding.off" class="sc-tag sc-tag-warn"
              ><Icon name="warning" /><span class="sc-tag-text">{{
                t.settings.shortcuts.status.disconnected
              }}</span></span
            >
            <span v-else class="sc-sub">{{ cell.binding.button.device }}</span>
          </span>
        </span>
        <span v-else class="sc-lines">
          <span class="sc-keys">
            <Keycaps :keys="cell.binding.keys" />
            <Icon v-if="warned === cell.slot" name="warning" class="sc-warn-icon" />
          </span>
          <span v-if="cell.binding.off" class="sc-tag sc-tag-warn"
            ><Icon name="warning" /><span class="sc-tag-text">{{
              t.settings.shortcuts.status.unavailableShort
            }}</span></span
          >
        </span>
      </button>
      <!-- A binding's ×: empties it (Delete or Backspace on the cell do the same). -->
      <button
        v-if="cell.kind === 'binding'"
        type="button"
        class="sc-x"
        tabindex="-1"
        :aria-label="t.settings.shortcuts.removeLabel(cell.binding.text, row.label)"
        :title="t.settings.shortcuts.removeLabel(cell.binding.text, row.label)"
        @click="capture.remove(row.action, cell.slot)"
      >
        <Icon name="close" />
      </button>
      <span v-if="cell.kind === 'empty'" class="sc-empty" aria-hidden="true">—</span>
    </div>

    <div class="sc-reset-cell" role="cell">
      <button
        v-if="row.canReset"
        type="button"
        class="sc-reset"
        :disabled="recording !== null"
        :aria-label="t.settings.shortcuts.resetLabel(row.label, row.defaultKeys)"
        :title="t.settings.shortcuts.resetLabel(row.label, row.defaultKeys)"
        @click="resetShortcut(row.action, row.label, capture.reset)"
      >
        <Icon name="reset" />
      </button>
    </div>

    <!-- A sentence about one cell: it starts under that cell. -->
    <p
      v-for="(line, i) in messages"
      :key="i"
      class="sc-msg"
      :class="[`at-${line.slot ?? 0}`, `is-${line.tone}`]"
      aria-hidden="true"
    >
      <span class="sc-msg-mark">▲</span>{{ line.text }}
    </p>
    <!-- Always in the page (a live region must exist before it speaks): all of it, in words. -->
    <span :id="liveId" class="st-sr-only" aria-live="polite">{{ announcement }}</span>
  </div>
</template>
