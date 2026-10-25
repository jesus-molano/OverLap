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
  /** `--lic` / `--lic-fg` / `--lic-soft` / `--lic-ink` (DriverStyles.lic). */
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
/*
 * Licence at plate height, as large as the iR beside it. The ink (`--lic-ink`) is the licence
 * colour lifted until it reads on the glass over a bright sky as well as over dark asphalt.
 */
.ov-lic {
  display: inline-flex;
  flex: none;
  align-items: center;
  max-width: 100%;
  height: var(--ov-plate-h);
  overflow: hidden;
  padding: 0 0.3em;
  border-radius: var(--ov-radius-chip);
  font-family: var(--ov-font-small);
  font-size: var(--ov-t-chip);
  font-weight: var(--ov-w-strong);
  line-height: 1;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
  text-overflow: clip;
}

.ov-lic__sr {
  margin-left: 0.3em;
}

/* Quiet default for tables: coloured text, no box. The letter in the ink, the SR in grey. */
.ov-lic--soft {
  padding: 0;
  background: none;
  color: var(--lic-ink, var(--lic-soft));
}

.ov-lic--soft .ov-lic__sr {
  font-weight: var(--ov-w-text);
  color: var(--ov-fg-muted);
}

/* iRacing's own look: a plate. */
.ov-lic--solid {
  background: var(--lic);
  color: var(--lic-fg);
  font-weight: var(--ov-w-solid);
  text-shadow: none;
}

/* Just the coloured class letter. */
.ov-lic--letter {
  padding: 0;
  border-radius: 0;
  color: var(--lic-ink, var(--lic-soft));
}
</style>
