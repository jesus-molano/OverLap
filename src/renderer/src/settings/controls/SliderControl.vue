<script setup lang="ts">
import { computed, useId } from 'vue'
import { useI18n } from '../../composables/useI18n'
import { useDraft } from '../useDraft'
import { snapToStep } from '../values'

const props = withDefaults(
  defineProps<{
    label: string
    help?: string
    current: number
    min: number
    max: number
    step?: number
    format: (value: number) => string
    apply: (value: number) => Promise<unknown>
    /** Quick-pick buttons under the slider. */
    presets?: readonly number[]
    disabled?: boolean
  }>(),
  { help: undefined, step: 1, presets: () => [], disabled: false }
)

const id = useId()
const helpId = `${id}-help`
// `input` while dragging (throttled to SETTINGS_THROTTLE_MS), `commit` on release / keyboard
// step / preset.
const { value, input, commit } = useDraft(
  () => props.current,
  (v) => props.apply(v)
)
const text = computed(() => props.format(value.value))
const t = useI18n()
const presetsLabel = computed(() => t.value.settings.controls.presetsLabel(props.label))

function read(e: Event): number | null {
  if (!(e.target instanceof HTMLInputElement)) return null
  const v = e.target.valueAsNumber
  return Number.isFinite(v) ? snapToStep(v, props.step, props.min) : null
}

function onInput(e: Event): void {
  const v = read(e)
  if (v !== null) input(v)
}

function onChange(e: Event): void {
  const v = read(e)
  if (v !== null) commit(v)
}
</script>

<template>
  <div class="st-row st-row-stack">
    <div class="st-row-head" :class="{ 'st-disabled': disabled }">
      <label :for="id" class="st-label">{{ label }}</label>
      <output :for="id" class="st-value">{{ text }}</output>
    </div>
    <input
      :id="id"
      type="range"
      class="st-range"
      :min="min"
      :max="max"
      :step="step"
      :value="value"
      :disabled="disabled"
      :aria-valuetext="text"
      :aria-describedby="help ? helpId : undefined"
      @input="onInput"
      @change="onChange"
    />
    <span v-if="help" :id="helpId" class="st-help" :class="{ 'st-disabled': disabled }">{{
      help
    }}</span>
    <div v-if="presets.length > 0" class="st-presets" role="group" :aria-label="presetsLabel">
      <button
        v-for="p in presets"
        :key="p"
        type="button"
        class="st-btn st-btn-sm"
        :aria-pressed="value === p"
        :disabled="disabled"
        @click="commit(p)"
      >
        {{ format(p) }}
      </button>
    </div>
  </div>
</template>
