<script setup lang="ts">
import { computed, nextTick, shallowRef, useId, useTemplateRef, watch } from 'vue'
import { modifierCaps } from '@shared/accelerator'
import { useI18n } from '../../composables/useI18n'
import Icon from '../../ui/Icon.vue'
import { focusAfter, rowMessages, type DeviceNames, type ShortcutRowView } from '../shortcutsView'
import type { ShortcutCapture } from '../useShortcutCapture'
import Keycaps from './Keycaps.vue'

/**
 * One configurable shortcut: the label (with a badge when it is off, or one of its bindings
 * does not work) and Reset at the end of that line, then its bindings side by side as chips
 * (up to three: keycaps, or a button and its controller), each one a button that records over
 * it and a × that removes it, then "+ Añadir", which records one more and wraps like a chip.
 * While recording, the chip recorded over keeps its width (a short prompt, its × a Cancel), or
 * a new one after the others shows the keys being pressed. The button that started the
 * recording keeps the focus (it turns into Cancel when it is "+ Añadir"): leaving it (Tab, a
 * click elsewhere) cancels. A change that takes the focused button away (a chip removed or
 * recorded over, the row full, Reset done) moves the focus to the chip now in its place, or to
 * "+ Añadir".
 */
const props = defineProps<{ row: ShortcutRowView; capture: ShortcutCapture; names: DeviceNames }>()

const t = useI18n()
const msgId = useId()
const rowEl = useTemplateRef<HTMLElement>('rowEl')
/** The slot recorded on this row, null when none is. */
const recording = computed(() => {
  const a = props.capture.active.value
  return a !== null && a.action === props.row.action ? a.slot : null
})
const adding = computed(() => recording.value === props.row.bindings.length)
const heldCaps = computed(() =>
  recording.value !== null ? modifierCaps(props.capture.held.value) : []
)
const messages = computed(() =>
  rowMessages(t.value, props.row, props.capture.feedback.value, recording.value, props.names)
)
/** The width of the chip recorded over, as it was: it keeps it while recording. */
const lockedWidth = shallowRef<number | null>(null)

function onRecorderBlur(): void {
  if (recording.value !== null) props.capture.cancel()
}

function onChip(evt: MouseEvent, slot: number): void {
  const chip = (evt.currentTarget as HTMLElement | null)?.closest('li')
  lockedWidth.value = recording.value === slot ? null : (chip?.offsetWidth ?? null)
  props.capture.toggle(props.row.action, slot)
}

function chipStyle(slot: number): Record<string, string> | undefined {
  if (recording.value !== slot || lockedWidth.value === null) return undefined
  return { minWidth: `${lockedWidth.value}px` }
}

/** The focused button went away with a change on this row: the focus goes to what replaced it. */
watch(
  () => props.capture.feedback.value,
  (feedback) => {
    void nextTick(() => {
      const target = focusAfter(feedback, props.row)
      const el = rowEl.value
      const lost = document.activeElement === null || document.activeElement === document.body
      if (target === null || el === null || !lost) return
      const chips = el.querySelectorAll<HTMLElement>('button.sc-chip-main')
      const next = target === 'add' ? el.querySelector<HTMLElement>('.sc-add') : chips[target.slot]
      next?.focus()
    })
  }
)
</script>

<template>
  <div ref="rowEl" class="sc-item">
    <div class="st-row st-row-stack">
      <div class="sc-head">
        <div class="st-row-text">
          <span class="sc-title">
            <span class="st-label">{{ row.label }}</span>
            <span v-if="row.status === 'unavailable'" class="sc-badge-unavailable">{{
              row.badge
            }}</span>
          </span>
          <span class="st-help">{{ row.help }}</span>
        </div>
        <button
          v-if="row.canReset"
          type="button"
          class="st-btn st-btn-ghost st-btn-sm sc-reset"
          :disabled="recording !== null"
          :aria-label="t.settings.shortcuts.resetLabel(row.label, row.defaultKeys)"
          :title="row.defaultKeys"
          @click="capture.reset(row.action)"
        >
          {{ t.settings.shortcuts.reset }}
        </button>
      </div>
      <ul class="sc-chips" :aria-label="row.label">
        <li
          v-for="b in row.bindings"
          :key="b.accelerator"
          class="sc-chip"
          :class="{
            'is-recording': recording === b.slot,
            'is-off': b.off && recording !== b.slot,
            'is-button': b.button !== null && recording !== b.slot
          }"
          :style="chipStyle(b.slot)"
        >
          <button
            type="button"
            class="sc-chip-main"
            :aria-label="
              recording === b.slot
                ? t.settings.shortcuts.cancelLabel(row.label)
                : t.settings.shortcuts.changeLabel(b.text, row.label)
            "
            :aria-describedby="msgId"
            :title="b.off ? row.badge : undefined"
            @click="onChip($event, b.slot)"
            @blur="onRecorderBlur"
          >
            <template v-if="recording === b.slot">
              <Keycaps v-if="heldCaps.length > 0" :keys="heldCaps" pending />
              <span v-else class="sc-prompt">{{ t.settings.shortcuts.capture.promptShort }}</span>
            </template>
            <span
              v-else-if="b.button"
              class="sc-button"
              :aria-label="t.settings.shortcuts.buttonAria(b.button.button, b.button.device)"
            >
              <Icon name="wheel" class="sc-button-icon" />
              <span class="sc-button-text">
                <span class="sc-button-name">{{ b.button.button }}</span>
                <span class="sc-button-device" :title="b.button.device">{{ b.button.device }}</span>
              </span>
            </span>
            <Keycaps v-else :keys="b.keys" />
            <Icon v-if="b.off && recording !== b.slot" name="warning" class="sc-off-icon" />
          </button>
          <!-- Recording over it, its × cancels (pressing it keeps the focus on the chip). -->
          <button
            v-if="recording === b.slot"
            type="button"
            class="sc-chip-x sc-chip-cancel"
            tabindex="-1"
            :aria-label="t.settings.shortcuts.cancelLabel(row.label)"
            :title="t.settings.shortcuts.cancel"
            @mousedown.prevent
            @click="capture.cancel()"
          >
            <Icon name="close" />
          </button>
          <button
            v-else
            type="button"
            class="sc-chip-x"
            :aria-label="t.settings.shortcuts.removeLabel(b.text, row.label)"
            :title="t.settings.shortcuts.removeLabel(b.text, row.label)"
            @click="capture.remove(row.action, b.slot)"
          >
            <Icon name="close" />
          </button>
        </li>
        <li v-if="adding" class="sc-chip is-recording is-new">
          <span class="sc-chip-main">
            <Keycaps v-if="heldCaps.length > 0" :keys="heldCaps" pending />
            <span v-else class="sc-prompt">{{ t.settings.shortcuts.capture.prompt }}</span>
          </span>
        </li>
        <li v-if="row.bindings.length === 0 && !adding" class="sc-off">{{ row.badge }}</li>
        <li v-if="row.canAdd" class="sc-add-li">
          <button
            type="button"
            class="st-btn st-btn-sm sc-add"
            :aria-label="
              adding
                ? t.settings.shortcuts.cancelLabel(row.label)
                : t.settings.shortcuts.addLabel(row.label)
            "
            :aria-describedby="msgId"
            @click="capture.toggle(row.action, row.bindings.length)"
            @blur="onRecorderBlur"
          >
            <template v-if="adding">{{ t.settings.shortcuts.cancel }}</template>
            <template v-else>
              <Icon name="plus" class="sc-add-icon" />{{ t.settings.shortcuts.add }}
            </template>
          </button>
        </li>
      </ul>
    </div>
    <!-- Always in the page (a live region must exist before it speaks); empty, it has no height. -->
    <p :id="msgId" class="sc-msg" aria-live="polite">
      <span
        v-for="(line, i) in messages"
        :key="i"
        class="st-help"
        :class="{ 'st-help-warn': line.tone === 'warn', 'sc-error': line.tone === 'error' }"
        >{{ line.text }}</span
      >
    </p>
    <!-- Said once when recording starts: the prompt itself is drawn where the keys are. -->
    <span class="st-sr-only" aria-live="polite">{{
      recording !== null ? t.settings.shortcuts.capture.prompt : ''
    }}</span>
  </div>
</template>

<style scoped>
/* The name and its help, Reset at the end of the line: the same place on every row. */
.sc-head {
  display: flex;
  align-items: flex-start;
  gap: 12px;
}

.sc-reset {
  flex: none;
}

/* The bindings side by side, then "+ Añadir", wrapping together in a narrow window. */
.sc-chips {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  min-width: 0;
  margin: 0;
  padding: 0;
  list-style: none;
}

/* One binding: a well like a field, the chip itself the button that records over it. */
.sc-chip {
  display: inline-flex;
  align-items: stretch;
  min-width: 0;
  max-width: 100%;
  min-height: 34px;
  border: 1px solid var(--st-border-hi);
  border-radius: var(--st-radius-sm);
  background: var(--st-field);
}

.sc-chip-main {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  padding: 3px 4px 3px 8px;
  border: 0;
  border-radius: var(--st-radius-sm) 0 0 var(--st-radius-sm);
  background: transparent;
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
}

.sc-chip-main:hover {
  background: var(--st-hover);
}

/* The × to remove it, a quiet square at the end of the chip. */
.sc-chip-x {
  display: inline-flex;
  flex: none;
  align-items: center;
  justify-content: center;
  width: 26px;
  padding: 0;
  border: 0;
  border-radius: 0 var(--st-radius-sm) var(--st-radius-sm) 0;
  background: transparent;
  color: var(--ov-fg-dim);
  font-size: 12px;
  cursor: pointer;
}

.sc-chip-x:hover {
  background: var(--st-hover);
  color: var(--ov-fg);
}

/* Recording over it, or a new one: dashed in the focus colour, the prompt inside. */
.sc-chip.is-recording {
  border-style: dashed;
  border-color: color-mix(in srgb, var(--st-focus) 70%, transparent);
  background: color-mix(in srgb, var(--st-focus) 8%, var(--st-field));
}

/* Recorded over: the chip keeps its width (set while recording), the prompt short in it. */
.sc-chip.is-recording .sc-chip-main {
  flex: 1 1 auto;
  justify-content: flex-start;
}

/* One more: room for the full prompt. */
.sc-chip.is-new .sc-chip-main {
  min-width: 13em;
  padding-right: 8px;
  border-radius: var(--st-radius-sm);
  cursor: default;
}

.sc-prompt {
  color: var(--ov-fg);
  font-size: 12.5px;
}

/* A button's chip: its controller cut on the second line, so three still fit side by side. */
.sc-chip.is-button {
  max-width: min(15em, 100%);
}

/* A controller's button: the wheel glyph, the button, and its controller under it. */
.sc-button {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  font-size: 12.5px;
}

.sc-button-text {
  display: flex;
  flex-direction: column;
  min-width: 0;
  line-height: 1.25;
}

.sc-button-icon {
  flex: none;
  color: var(--ov-fg-muted);
  font-size: 14px;
}

.sc-button-name {
  color: var(--ov-fg);
  font-family: var(--ov-font-num);
  font-weight: var(--ov-w-strong);
  white-space: nowrap;
}

/* A long controller name is cut (its full name is in the title and the saved line). */
.sc-button-device {
  min-width: 0;
  overflow: hidden;
  color: var(--ov-fg-muted);
  font-size: 11.5px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* Not working (unplugged, or held by another application): kept, dimmed, outlined in warning. */
.sc-chip.is-off {
  border-color: color-mix(in srgb, var(--ov-warn) 45%, transparent);
}

.sc-chip.is-off .sc-button-name,
.sc-chip.is-off .sc-button-device,
.sc-chip.is-off .sc-button-icon,
.sc-chip.is-off :deep(.cap) {
  color: var(--ov-fg-dim);
}

.sc-off-icon {
  flex: none;
  color: var(--ov-warn);
  font-size: 13px;
}

/* No binding: what an empty field would say. */
.sc-off {
  display: inline-flex;
  align-items: center;
  min-height: 34px;
  padding: 0 2px;
  color: var(--ov-fg-dim);
  font-size: 12.5px;
  white-space: nowrap;
}

.sc-title {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px 10px;
}

/* A binding does not work: a warning chip beside the name (the chip itself says which). */
.sc-badge-unavailable {
  padding: 0 8px;
  border: 1px solid color-mix(in srgb, var(--ov-warn) 55%, transparent);
  border-radius: var(--st-radius-sm);
  color: var(--ov-warn);
  font-size: 11.5px;
  line-height: 1.5;
  white-space: nowrap;
}

.sc-add-li {
  display: inline-flex;
  align-items: center;
}

.sc-add {
  gap: 5px;
}

.sc-add-icon {
  font-size: 11px;
}

.sc-msg {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.sc-msg:not(:empty) {
  margin-top: -4px;
  padding-bottom: 11px;
}

/* Above the specificity of settings.css's .st-help colour. */
.sc-msg .sc-error {
  color: var(--ov-danger);
}
</style>
