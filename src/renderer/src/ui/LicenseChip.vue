<script setup lang="ts">
import { computed } from 'vue'
import type { AppearanceSettings } from '@shared/types'
import { useAppearance } from '../composables/useAppearance'
import { vInlineStyle } from '../directives/inlineStyle'
import { splitLicense } from '../view/driverCell'
import type { InlineStyle } from '../view/styles'

const props = defineProps<{
  /** Short licence, 'A 4.9'. */
  text: string
  /** `--lic` / `--lic-fg` / `--lic-soft` (DriverStyles.lic). */
  colors: InlineStyle
  /** Defaults to appearance.licenseStyle. */
  variant?: AppearanceSettings['licenseStyle']
}>()

const appearance = useAppearance()
const style = computed(() => props.variant ?? appearance.value.licenseStyle)
const parts = computed(() => splitLicense(props.text))
</script>

<template>
  <span v-inline-style="colors" class="ov-lic" :class="`ov-lic--${style}`"
    >{{ parts[0]
    }}<span v-if="style !== 'letter' && parts[1]" class="ov-lic__sr">{{ parts[1] }}</span></span
  >
</template>

<style>
.ov-lic {
  display: inline-block;
  flex: none;
  max-width: 100%;
  overflow: hidden;
  padding: 0.05em 0.3em;
  border-radius: var(--ov-radius-chip);
  font-family: var(--ov-font);
  font-size: var(--ov-t-chip);
  font-weight: 700;
  line-height: 1.3;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
  text-overflow: clip;
}

.ov-lic__sr {
  margin-left: 0.25em;
}

/* Quiet default for tables: a tinted chip with a ring in the licence colour. */
.ov-lic--soft {
  background: color-mix(in srgb, var(--lic-soft) 26%, transparent);
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--lic-soft) 75%, transparent);
  color: var(--ov-fg);
}

/* iRacing's own look. */
.ov-lic--solid {
  background: var(--lic);
  color: var(--lic-fg);
  text-shadow: none;
}

/* Just the coloured class letter. */
.ov-lic--letter {
  padding: 0;
  border-radius: 0;
  color: var(--lic-soft);
}
</style>
