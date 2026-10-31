<script setup lang="ts">
import { computed } from 'vue'
import type { BrandId } from '@shared/carBrands'
import type { DriverPartId } from '@shared/rowHead'
import type { AppearanceSettings, CarPenalty } from '@shared/types'
import { useAppearance } from '../composables/useAppearance'
import BrandMark from './BrandMark.vue'
import ClassStripe from './ClassStripe.vue'
import CountryFlag from './CountryFlag.vue'
import NumberBadge from './NumberBadge.vue'
import PenaltyIcon from './PenaltyIcon.vue'

/**
 * One of the driver's parts at the start of a table row (request 11, shared/rowHead.ts), drawn
 * the same in the name's cell (DriverCell's `before`, a widget's parts after the name) and in a
 * column of its own: the number (with the class stripe in the stripe style, the stripe alone with
 * no number: a narrow table), the make's logo, the driver's flag, or the penalty flag in a slot
 * one badge wide (empty without one, so what follows lines up).
 */
const props = withDefaults(
  defineProps<{
    part: DriverPartId
    number?: string
    /** Defaults to appearance.numberStyle. */
    numberStyle?: AppearanceSettings['numberStyle']
    lap?: 'ahead' | 'behind' | null
    brand?: BrandId
    country?: string
    penalty?: CarPenalty | null
  }>(),
  { number: '', lap: null, penalty: null }
)

const appearance = useAppearance()
const numStyle = computed(() => props.numberStyle ?? appearance.value.numberStyle)
</script>

<template>
  <span v-if="part === 'number'" class="ov-dpart ov-dpart--number"
    ><ClassStripe v-if="numStyle === 'stripe'" /><NumberBadge
      v-if="number"
      :number="number"
      :variant="numStyle === 'stripe' ? 'plain' : 'filled'"
      :lap="lap"
  /></span>
  <BrandMark v-else-if="part === 'brand' && brand !== undefined" :brand="brand" />
  <CountryFlag v-else-if="part === 'country' && country !== undefined" :code="country" />
  <span v-else-if="part === 'flags'" class="ov-dpart ov-dpart--flags"
    ><PenaltyIcon v-if="penalty" :penalty="penalty"
  /></span>
</template>

<style>
/* The stripe and the number with the driver cell's own gap, as they were side by side in it. */
.ov-dpart {
  display: inline-flex;
  flex: none;
  align-items: center;
  gap: 0.35em;
}

/* One flag badge wide (the flags' column), the badge at the icons' 0.85em, centred. */
.ov-dpart--flags {
  justify-content: center;
  width: 1.3em;
}

.ov-dpart--flags > .ov-icon {
  font-size: 0.85em;
}
</style>
