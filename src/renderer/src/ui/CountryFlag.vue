<script setup lang="ts">
import { computed, shallowRef, watch } from 'vue'
import { useI18n, useLanguage } from '../composables/useI18n'
import { countryLabel, flagUriNow, hasFlag, loadFlag } from './flags'

/**
 * A driver's country flag at row height (3:2, a hairline around it so white flags read on the
 * glass), named for screen readers ('España'). An empty code, or one without a flag, keeps the
 * slot empty, so a column of flags stays aligned. The SVG is loaded once per code and window
 * (flags.ts); until then the slot is empty too.
 */
const props = defineProps<{
  /** countries.ts flag code ('ES', 'GB-SCT'), '' for none. */
  code: string
}>()

const t = useI18n()
const lang = useLanguage()
const known = computed(() => props.code !== '' && hasFlag(props.code))
const label = computed(() => (known.value ? countryLabel(props.code, lang.value, t.value) : ''))
const uri = shallowRef<string | null>(flagUriNow(props.code))

watch(
  () => props.code,
  (code) => {
    uri.value = flagUriNow(code)
    if (uri.value !== null || !known.value) return
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
    :class="{ 'ov-flag--none': !known }"
    :role="known ? 'img' : undefined"
    :aria-label="known ? label : undefined"
    :aria-hidden="known ? undefined : 'true'"
    :title="known ? label : undefined"
  >
    <img v-if="uri" class="ov-flag__img" :src="uri" alt="" draggable="false" />
  </span>
</template>

<style>
/*
 * Row height by default (a widget may set --cf-h smaller), 3:2 like the artwork.
 */
.ov-flag {
  --cf-h-used: var(--cf-h, var(--ov-plate-h));
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
