<script setup lang="ts">
import { computed } from 'vue'
import { formatDriverName } from '@shared/format'
import type { AppearanceSettings, NameFormat } from '@shared/types'
import { useAppearance } from '../composables/useAppearance'
import { vInlineStyle } from '../directives/inlineStyle'
import type { InlineStyle } from '../view/styles'
import type { BrandId } from '@shared/carBrands'
import BrandMark from './BrandMark.vue'
import ClassStripe from './ClassStripe.vue'
import CountryFlag from './CountryFlag.vue'
import LicenseChip from './LicenseChip.vue'
import NumberBadge from './NumberBadge.vue'

/**
 * `[number] [make] [flag] Name [icons] [iR] [licence]`. Prop names match DriverCellView, so a
 * view's driver cell binds with `v-bind="view.driver"`. Tables put iR and licence in their own
 * grid cells; inline layouts (battle) turn them on here. The make and the flag are drawn only
 * when given (the widget's brandMarks / countryFlags on): 'unknown' and '' keep an empty slot,
 * so a column of them stays aligned.
 */
const props = withDefaults(
  defineProps<{
    number: string
    /** Shown as is, unless `format` is given. */
    name: string
    /** `name` is a placeholder ('Piloto #7': the session info lost the name): drawn dim. */
    nameUnknown?: boolean
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
    /** The car's make (BrandMark); undefined: no slot. */
    brand?: BrandId
    /** The driver's flag code (CountryFlag); undefined: no slot. */
    country?: string
  }>(),
  { nameUnknown: false, lap: null, player: false, withRating: false, withLicense: false }
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
      'ov-driver--unknown': nameUnknown,
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
    <BrandMark v-if="brand !== undefined" :brand="brand" />
    <CountryFlag v-if="country !== undefined" :code="country" />
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

/*
 * The name on the plate digits' baseline. Both are centred, but Blink puts a line's baseline at
 * round(ascent) + floor(half-leading) from its top, so the 1em name (line-height inherited) and
 * the plate's text (--ov-t-plate, line-height 1) land on different baselines: the name sat 0.5
 * to 1.5 px low, depending on the font size. `top` raises it by exactly that difference, with
 * Segoe UI's ascent (1.0791em) and descent (.251em) rounded as Blink rounds them: no layout,
 * the name moves alone and the plate stays level with the position plate. Resolved once per
 * font size, never per frame.
 */
.ov-driver__name {
  --dc-name-a: round(1.0791em, 1px);
  --dc-name-d: round(0.251em, 1px);
  --dc-plate: var(--ov-t-plate);
  --dc-plate-a: round(1.0791 * var(--dc-plate), 1px);
  --dc-plate-d: round(0.251 * var(--dc-plate), 1px);
  position: relative;
  top: calc(
    (
        var(--dc-plate-a) +
          round(down, (var(--dc-plate) - var(--dc-plate-a) - var(--dc-plate-d)) / 2, 1px) -
          var(--dc-plate) / 2
      ) -
      (var(--dc-name-a) + round(down, (1lh - var(--dc-name-a) - var(--dc-name-d)) / 2, 1px) - 0.5lh)
  );
  flex: 1 1 auto;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  font-weight: var(--ov-w-name);
}

/* Your name a step heavier; the row's bracket says the rest. */
.ov-driver--player .ov-driver__name {
  font-weight: var(--ov-w-you);
}

/* A placeholder for a name the session info lost: secondary text. A lap colour still wins. */
.ov-driver--unknown .ov-driver__name {
  color: var(--ov-fg-muted);
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
  font-weight: var(--ov-w-text);
  color: var(--ov-fg-muted);
}
</style>
