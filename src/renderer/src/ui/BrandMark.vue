<script setup lang="ts">
import { computed } from 'vue'
import { brandInfo, type BrandId } from '@shared/carBrands'
import { brandLogo } from './brandLogos'

/**
 * The make of a car at row height: its logo in currentColor, or its three-letter badge ('DAL')
 * when it has none. An unknown make keeps the slot empty, so a table column stays aligned.
 */
const props = withDefaults(
  defineProps<{
    brand: BrandId
    /** The text badge even when the brand has a logo. */
    text?: boolean
  }>(),
  { text: false }
)

const info = computed(() => brandInfo(props.brand))
const logo = computed(() => (props.text ? null : brandLogo(props.brand)))
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
      <path :d="logo.d" />
    </svg>
    <span v-else-if="info" class="ov-brand__badge">{{ info.badge }}</span>
  </span>
</template>

<style>
/*
 * One slot per make, as tall as the widget's plates and a little wider (most logos are wider
 * than tall), so logos, badges and empty slots line up in a column. Never narrower than a
 * three-letter badge at the minimum text size ('AMG' would be cut at 9 px).
 */
.ov-brand {
  display: inline-flex;
  flex: none;
  align-items: center;
  justify-content: center;
  width: max(1.75em, calc(var(--ov-min-text) * 2.4));
  height: var(--ov-plate-h);
  overflow: hidden;
  line-height: 1;
  white-space: nowrap;
}

/* Fitted inside the slot (wide logos to its width, tall ones to 85 % of its height). */
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
