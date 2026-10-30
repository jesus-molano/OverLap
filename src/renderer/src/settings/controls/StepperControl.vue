<script setup lang="ts">
import Icon from '../../ui/Icon.vue'
import { useId } from 'vue'
import { useI18n } from '../../composables/useI18n'
import { useDraft } from '../useDraft'
import { clampInt, parseIntInRange } from '../values'
import PreviewNote from './PreviewNote.vue'
import type { PreviewNoteSpec } from './previewNote'

const props = withDefaults(
  defineProps<{
    label: string
    help?: string
    current: number
    min: number
    max: number
    apply: (value: number) => Promise<unknown>
    disabled?: boolean
    /** Why the preview does not show it (PreviewNote: no room, or the session only). */
    note?: PreviewNoteSpec
  }>(),
  { help: undefined, disabled: false, note: undefined }
)

const t = useI18n()
const id = useId()
const labelId = `${id}-label`
const helpId = `${id}-help`
const { value, commit } = useDraft(
  () => props.current,
  (v) => props.apply(v)
)

function step(delta: number): void {
  const next = clampInt(value.value + delta, props.min, props.max)
  if (next !== value.value) commit(next)
}

function onChange(e: Event): void {
  const el = e.target
  if (!(el instanceof HTMLInputElement)) return
  const next = parseIntInRange(el.value, props.min, props.max)
  // Written back by hand: when the clamped value equals the current one, Vue sees no change
  // and would leave the typed text (e.g. "15" with a maximum of 10) in the field.
  el.value = String(next ?? value.value)
  if (next !== null && next !== value.value) commit(next)
}
</script>

<template>
  <div class="st-row">
    <span class="st-row-text" :class="{ 'st-disabled': disabled }">
      <label :id="labelId" :for="id" class="st-label">{{ label }}</label>
      <span v-if="help" :id="helpId" class="st-help">{{ help }}</span>
      <PreviewNote :note="note" />
    </span>
    <div class="st-stepper" role="group" :aria-labelledby="labelId">
      <button
        type="button"
        class="st-btn st-step"
        :aria-label="t.settings.controls.decrease"
        :disabled="disabled || value <= min"
        @click="step(-1)"
      >
        <Icon name="minus" />
      </button>
      <input
        :id="id"
        type="number"
        inputmode="numeric"
        class="st-number"
        :min="min"
        :max="max"
        step="1"
        :value="value"
        :disabled="disabled"
        :aria-describedby="help ? helpId : undefined"
        @keydown.up.prevent="step(1)"
        @keydown.down.prevent="step(-1)"
        @change="onChange"
      />
      <button
        type="button"
        class="st-btn st-step"
        :aria-label="t.settings.controls.increase"
        :disabled="disabled || value >= max"
        @click="step(1)"
      >
        <Icon name="plus" />
      </button>
    </div>
  </div>
</template>
