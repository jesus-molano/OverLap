<script setup lang="ts">
import { computed } from 'vue'
import { brandInfo, type BrandId } from '@shared/carBrands'
import { useAppearance } from '../composables/useAppearance'
import { brandDrawing, type BrandLogoStyle, type BrandSurface } from './brandDrawing'

/**
 * The make of a car at row height: its logo in its own colours (settings.appearance.brandLogos),
 * or in one ink, or its three-letter badge ('RAY') when it has no logo. An unknown make keeps
 * the slot empty, so a table column stays aligned.
 */
const props = withDefaults(
  defineProps<{
    brand: BrandId
    /** The text badge even when the brand has a logo. */
    text?: boolean
    /** Colour or monochrome; defaults to appearance.brandLogos. */
    logos?: BrandLogoStyle
    /** The background: the widgets' dark glass unless said otherwise. */
    surface?: BrandSurface
  }>(),
  { text: false, logos: undefined, surface: 'dark' }
)

const appearance = useAppearance()
const info = computed(() => brandInfo(props.brand))
const style = computed(() => props.logos ?? appearance.value.brandLogos)
const logo = computed(() =>
  props.text ? null : brandDrawing(props.brand, style.value, props.surface)
)
</script>

<template>
  <span
    class="ov-brand"
    :class="info ? (logo ? 'ov-brand--logo' : 'ov-brand--badge') : 'ov-brand--none'"
    :role="info ? 'img' : undefined"
    :aria-label="info?.name"
    :aria-hidden="info ? undefined : 'true'"
    :title="info?.name"
  >
    <svg
      v-if="logo"
      class="ov-brand__logo"
      :viewBox="logo.viewBox"
      focusable="false"
      aria-hidden="true"
    >
      <path
        v-for="(p, i) in logo.paths"
        :key="i"
        :d="p.d"
        :fill="p.fill"
        :fill-rule="p.fillRule"
        :opacity="p.opacity"
      />
    </svg>
    <span v-else-if="info" class="ov-brand__badge">{{ info.badge }}</span>
  </span>
</template>

<style>
/*
 * One slot per make, as tall as the widget's plates and a little wider (most logos are wider
 * than tall), so logos, badges and empty slots line up in a column.
 */
.ov-brand {
  display: inline-flex;
  flex: none;
  align-items: center;
  justify-content: center;
  width: 1.75em;
  height: var(--ov-plate-h);
  overflow: hidden;
  line-height: 1;
  white-space: nowrap;
}

/*
 * Fitted inside the slot (wide logos to its width, tall ones to 85 % of its height). A colour
 * logo's paths carry their own fills; the monochrome path takes the text colour.
 */
.ov-brand__logo {
  display: block;
  width: 100%;
  height: 85%;
  fill: currentColor;
}

.ov-brand__badge {
  font-family: var(--ov-font-small);
  font-size: var(--ov-t-tag);
  font-weight: var(--ov-w-strong);
  letter-spacing: var(--ov-track-tag);
}
</style>
