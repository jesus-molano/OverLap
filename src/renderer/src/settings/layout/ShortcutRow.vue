<script setup lang="ts">
import { computed, useId } from 'vue'
import { modifierCaps } from '@shared/accelerator'
import { useI18n } from '../../composables/useI18n'
import { rowMessages, type ShortcutRowView } from '../shortcutsView'
import type { ShortcutCapture } from '../useShortcutCapture'
import Keycaps from './Keycaps.vue'

/**
 * One configurable shortcut: the label (with a badge when another application holds the
 * combination), then a field with its keys (the keys being pressed while recording, "Off"
 * when it has none) and Change / Disable / Reset beside it. The field has one width in every
 * row, so the buttons line up. The Change button keeps the focus while recording: leaving it
 * (Tab, a click elsewhere) cancels.
 */
const props = defineProps<{ row: ShortcutRowView; capture: ShortcutCapture }>()

const t = useI18n()
const msgId = useId()
const recording = computed(() => props.capture.active.value === props.row.action)
const heldCaps = computed(() => (recording.value ? modifierCaps(props.capture.held.value) : []))
const messages = computed(() =>
  rowMessages(t.value, props.row, props.capture.feedback.value, recording.value)
)

function onChangeBlur(): void {
  if (recording.value) props.capture.cancel()
}
</script>

<template>
  <div class="sc-item">
    <div class="st-row st-row-stack">
      <div class="st-row-text">
        <span class="sc-title">
          <span class="st-label">{{ row.label }}</span>
          <span v-if="row.status === 'unavailable'" class="sc-badge-unavailable">{{
            row.badge
          }}</span>
        </span>
        <span class="st-help">{{ row.help }}</span>
      </div>
      <div class="sc-bind">
        <div class="sc-keys" :class="{ 'is-recording': recording }">
          <template v-if="recording">
            <Keycaps v-if="heldCaps.length > 0" :keys="heldCaps" pending />
            <span v-else class="sc-prompt">{{ t.settings.shortcuts.capture.prompt }}</span>
          </template>
          <Keycaps v-else-if="row.keys.length > 0" :keys="row.keys" />
          <span v-else class="sc-off">{{ row.badge }}</span>
        </div>
        <div class="sc-actions">
          <button
            type="button"
            class="st-btn st-btn-sm"
            :aria-label="
              recording
                ? t.settings.shortcuts.cancelLabel(row.label)
                : t.settings.shortcuts.changeLabel(row.label)
            "
            :aria-describedby="msgId"
            @click="capture.toggle(row.action)"
            @blur="onChangeBlur"
          >
            {{ recording ? t.settings.shortcuts.cancel : t.settings.shortcuts.change }}
          </button>
          <button
            v-if="row.canDisable && !recording"
            type="button"
            class="st-btn st-btn-ghost st-btn-sm"
            :aria-label="t.settings.shortcuts.disableLabel(row.label)"
            @click="capture.assign(row.action, '')"
          >
            {{ t.settings.shortcuts.disable }}
          </button>
          <button
            v-if="row.canReset && !recording"
            type="button"
            class="st-btn st-btn-ghost st-btn-sm"
            :aria-label="t.settings.shortcuts.resetLabel(row.label, row.defaultKeys)"
            :title="row.defaultKeys"
            @click="capture.assign(row.action, row.defaultAccelerator)"
          >
            {{ t.settings.shortcuts.reset }}
          </button>
        </div>
      </div>
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
      recording ? t.settings.shortcuts.capture.prompt : ''
    }}</span>
  </div>
</template>

<style scoped>
.sc-bind {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 10px;
}

/* The keys, in a well like a field; while recording, dashed in the focus colour. */
.sc-keys {
  display: inline-flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px 10px;
  min-width: 15em;
  min-height: 34px;
  padding: 3px 8px;
  border: 1px solid var(--st-border-hi);
  border-radius: var(--st-radius-sm);
  background: var(--st-field);
}

.sc-keys.is-recording {
  border-style: dashed;
  border-color: color-mix(in srgb, var(--st-focus) 70%, transparent);
  background: color-mix(in srgb, var(--st-focus) 8%, var(--st-field));
}

.sc-prompt {
  color: var(--ov-fg);
  font-size: 12.5px;
}

/* Turned off: what an empty field would say. */
.sc-off {
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

/* Taken by another application: a warning chip beside the name, so the fields stay aligned. */
.sc-badge-unavailable {
  padding: 0 8px;
  border: 1px solid color-mix(in srgb, var(--ov-warn) 55%, transparent);
  border-radius: var(--st-radius-sm);
  color: var(--ov-warn);
  font-size: 11.5px;
  line-height: 1.5;
  white-space: nowrap;
}

.sc-actions {
  display: inline-flex;
  flex-wrap: wrap;
  gap: 4px;
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
