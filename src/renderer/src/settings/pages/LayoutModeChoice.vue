<script setup lang="ts">
import { useId } from 'vue'
import { LAYOUT_MODES } from '@shared/layouts'
import type { LayoutMode } from '@shared/types'
import { useI18n } from '../../composables/useI18n'

/**
 * What a layout restores ("Posición y opciones" / "Solo posición"), as a segmented control of
 * native radios: when saving, importing and editing one. `labelledby`: the id of its label.
 */
defineProps<{ labelledby: string; disabled?: boolean }>()
const mode = defineModel<LayoutMode>({ required: true })

const t = useI18n()
const name = useId()
</script>

<template>
  <div class="st-seg" role="radiogroup" :aria-labelledby="labelledby">
    <label
      v-for="m in LAYOUT_MODES"
      :key="m"
      class="st-seg-item"
      :title="t.settings.layouts.modeHints[m]"
    >
      <input
        v-model="mode"
        type="radio"
        class="st-seg-input"
        :name="name"
        :value="m"
        :disabled="disabled"
      />
      <span class="st-seg-text">{{ t.settings.layouts.modes[m] }}</span>
    </label>
  </div>
</template>
