<script setup lang="ts">
import { useDraft } from '../useDraft'

/**
 * One cell of the overview of where each widget shows (VisibilityPage, R34): a checkbox that
 * sets the same value as the control on the widget's own page, at once (useDraft). `label` is
 * its accessible name ('Batalla: Práctica'); `hint` its tooltip (why it is disabled).
 */
const props = withDefaults(
  defineProps<{
    label: string
    current: boolean
    apply: (value: boolean) => Promise<unknown>
    disabled?: boolean
    hint?: string
  }>(),
  { disabled: false, hint: undefined }
)

const { value, commit } = useDraft(
  () => props.current,
  (v) => props.apply(v)
)
</script>

<template>
  <label class="st-check cell" :title="hint">
    <input
      type="checkbox"
      :checked="value"
      :disabled="disabled"
      :aria-label="label"
      :aria-description="hint"
      @change="commit(!value)"
    />
  </label>
</template>

<style scoped>
.cell {
  justify-content: center;
  padding: 4px;
}
</style>
