<script setup lang="ts">
import { computed, shallowRef, watch } from 'vue'
import { GLOBAL_FLAG } from '@shared/countries'
import { useI18n, useLanguage } from '../composables/useI18n'
import { countryLabel, flagUriNow, hasFlag, loadFlag } from './flags'

/**
 * A driver's country flag at row height (3:2, a hairline around it so white flags read on the
 * glass), named for screen readers ('España'). An empty code, or one without a flag, keeps the
 * slot empty, so a column of flags stays aligned. The SVG is loaded once per code and window
 * (flags.ts); until then the slot is empty too. GLOBAL_FLAG (no country) is a globe of our own,
 * drawn inline in the muted ink on a faint plate: there, but quieter than a country.
 */
const props = defineProps<{
  /** countries.ts flag code ('ES', 'GB-SCT'), GLOBAL_FLAG for no country, '' for none. */
  code: string
}>()

const t = useI18n()
const lang = useLanguage()
const global = computed(() => props.code === GLOBAL_FLAG)
const known = computed(() => global.value || (props.code !== '' && hasFlag(props.code)))
const label = computed(() =>
  global.value
    ? t.value.widgets.common.noCountry
    : known.value
      ? countryLabel(props.code, lang.value, t.value)
      : ''
)
const uri = shallowRef<string | null>(flagUriNow(props.code))

watch(
  () => props.code,
  (code) => {
    uri.value = flagUriNow(code)
    if (uri.value !== null || !known.value || global.value) return
    void loadFlag(code).then((loaded) => {
      if (props.code === code) uri.value = loaded
    })
  },
  { immediate: true }
)
</script>

<template>
  <span
    class="ov-flag"
    :class="{ 'ov-flag--none': !known, 'ov-flag--global': global }"
    :role="known ? 'img' : undefined"
    :aria-label="known ? label : undefined"
    :aria-hidden="known ? undefined : 'true'"
    :title="known ? label : undefined"
  >
    <svg v-if="global" class="ov-flag__img" viewBox="0 0 30 20" aria-hidden="true">
      <g fill="none" stroke="currentColor" stroke-width="1.2">
        <circle cx="15" cy="10" r="7" />
        <ellipse cx="15" cy="10" rx="3" ry="7" />
        <path d="M8 10h14M9.2 6.5h11.6M9.2 13.5h11.6" />
      </g>
    </svg>
    <img v-else-if="uri" class="ov-flag__img" :src="uri" alt="" draggable="false" />
  </span>
</template>

<style>
/*
 * A touch under the plate height by default (a widget may set --cf-h), 3:2 like the artwork,
 * centred on the row: beside the number plate and the make it reads as a detail, not a plate.
 */
.ov-flag {
  --cf-h-used: var(--cf-h, calc(var(--ov-plate-h) * 0.82));
  position: relative;
  display: inline-flex;
  flex: none;
  width: calc(var(--cf-h-used) * 1.5);
  height: var(--cf-h-used);
  overflow: hidden;
  border-radius: 1px;
}

/* Over the artwork, so a white flag still has an edge on the glass. */
.ov-flag::after {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: inherit;
  box-shadow: inset 0 0 0 1px var(--ov-tick);
  pointer-events: none;
}

/* No country: a faint plate with the globe in the muted ink. */
.ov-flag--global {
  background: rgba(255, 255, 255, 0.07);
  color: var(--ov-fg-muted);
}

.ov-flag--none::after {
  content: none;
}

.ov-flag__img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}
</style>
