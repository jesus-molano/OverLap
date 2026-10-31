<script setup lang="ts">
import { computed } from 'vue'
import type { LicenseStyle } from '@shared/types'
import { useAppearance } from '../composables/useAppearance'
import { vInlineStyle } from '../directives/inlineStyle'
import type { InlineStyle } from '../view/styles'

/**
 * A driver's iRating (request 10). Without `colors`, today's text: the cell around it gives it
 * its grey. With them (the «Piloto» block's «iRating con el color de la licencia»), the same
 * plate as the driver's LicenseChip: its licence colours (`--lic*`, DriverCellView.licStyle) in
 * the licence style (Contorno, Suave, Sólida, Solo letra), so the Licencia column can go and the
 * class still reads. One look for every widget that draws an iRating (Relativo, Posiciones,
 * Batalla).
 */
const props = defineProps<{
  /** '2.5k' or '2.520' (formatIRating). */
  text: string
  /** The driver's licence colours; absent, the plain figure. */
  colors?: InlineStyle | null
  /** Defaults to appearance.licenseStyle. */
  variant?: LicenseStyle
}>()

const appearance = useAppearance()
const style = computed(() => props.variant ?? appearance.value.licenseStyle)
</script>

<template>
  <span v-if="colors" v-inline-style="colors" class="ov-lic ov-ir" :class="`ov-lic--${style}`">{{
    text
  }}</span
  ><template v-else>{{ text }}</template>
</template>

<style>
/*
 * LicenseChip's plate (.ov-lic and its style), at the size of the iR around it: the cell already
 * sets the secondary size the chip's own 0.82em would apply twice.
 */
.ov-ir.ov-lic {
  font-size: inherit;
  vertical-align: middle;
}
</style>
