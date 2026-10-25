<script setup lang="ts">
import { computed } from 'vue'
import { formatDriverName } from '@shared/format'
import type { AppearanceSettings, NameFormat } from '@shared/types'
import { useAppearance } from '../composables/useAppearance'
import { vInlineStyle } from '../directives/inlineStyle'
import type { InlineStyle } from '../view/styles'
import ClassStripe from './ClassStripe.vue'
import LicenseChip from './LicenseChip.vue'
import NumberBadge from './NumberBadge.vue'

/**
 * `[number] Name [icons] [iR] [licence]`. Prop names match DriverCellView, so a view's driver
 * cell binds with `v-bind="view.driver"`. Tables put iR and licence in their own grid cells;
 * inline layouts (battle) turn them on here.
 */
const props = withDefaults(
  defineProps<{
    number: string
    /** Shown as is, unless `format` is given. */
    name: string
    clsStyle?: InlineStyle
    iRating?: string
    lic?: string
    licStyle?: InlineStyle
    /** Format `name` here (when the view did not already). */
    format?: NameFormat
    /** Defaults to appearance.numberStyle; a narrow table can force 'stripe'. */
    numberStyle?: AppearanceSettings['numberStyle']
    licenseStyle?: AppearanceSettings['licenseStyle']
    lap?: 'ahead' | 'behind' | null
    player?: boolean
    withRating?: boolean
    withLicense?: boolean
  }>(),
  { lap: null, player: false, withRating: false, withLicense: false }
)

const appearance = useAppearance()
const numStyle = computed(() => props.numberStyle ?? appearance.value.numberStyle)
const shownName = computed(() =>
  props.format === undefined ? props.name : formatDriverName(props.name, props.format)
)
</script>

<template>
  <span
    v-inline-style="clsStyle"
    class="ov-driver"
    :class="{
      'ov-driver--player': player,
      'ov-driver--lap-ahead': lap === 'ahead',
      'ov-driver--lap-behind': lap === 'behind'
    }"
  >
    <ClassStripe v-if="numStyle === 'stripe'" />
    <NumberBadge
      v-if="number"
      :number="number"
      :variant="numStyle === 'stripe' ? 'plain' : 'filled'"
      :lap="lap"
    />
    <span class="ov-driver__name">{{ shownName }}</span>
    <slot />
    <span v-if="withRating && iRating" class="ov-driver__ir">{{ iRating }}</span>
    <LicenseChip
      v-if="withLicense && lic && licStyle"
      :text="lic"
      :colors="licStyle"
      :variant="licenseStyle"
    />
  </span>
</template>

<style>
.ov-driver {
  display: flex;
  align-items: center;
  gap: 0.35em;
  min-width: 0;
  white-space: nowrap;
}

.ov-driver__name {
  flex: 1 1 auto;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  font-weight: 500;
}

.ov-driver--player .ov-driver__name {
  font-weight: 700;
}

.ov-driver--lap-ahead .ov-driver__name {
  color: var(--ov-lap-ahead);
}

.ov-driver--lap-behind .ov-driver__name {
  color: var(--ov-lap-behind);
}

.ov-driver__ir {
  flex: none;
  font-size: var(--ov-t-secondary);
  color: var(--ov-fg-muted);
}
</style>
