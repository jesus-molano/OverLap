<script setup lang="ts">
import { computed } from 'vue'
import type { StandingsClassLineId } from '@shared/types'
import { CLASS_META_SEP, type ClassLineView } from './view'

/**
 * Class header line: class name (in the class ink) and SoF / car count (multi-root, see the
 * parent). The class colour is the line's 2 px bottom key, drawn by the parent: horizontal means
 * identity, so the class never goes on a rail. Each part of the meta is its own span (data-el
 * for the settings preview), the text the same as one string. The line itself (the parent's) is
 * the class's handle in the settings page's sample: dragged, it reorders the classes (9b).
 */
const props = defineProps<{ line: ClassLineView }>()

const parts = computed<readonly { id: StandingsClassLineId; text: string }[]>(() => {
  const l = props.line
  const sof = { id: 'sof' as const, text: l.metaSof }
  const cars = { id: 'carCount' as const, text: l.metaCars }
  return (l.metaCarsFirst ? [cars, sof] : [sof, cars]).filter((p) => p.text !== '')
})
</script>

<template>
  <span class="sd-cname">{{ line.name }}</span>
  <span v-if="line.meta" class="sd-cmeta"
    ><template v-for="(p, i) in parts" :key="p.id"
      >{{ i > 0 ? CLASS_META_SEP : ''
      }}<span :data-el="`standings.classLine.${p.id}`">{{ p.text }}</span></template
    ></span
  >
</template>

<style scoped>
.sd-cname {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  font-family: var(--ov-font-small);
  font-size: var(--ov-t-caption);
  font-weight: var(--ov-w-strong);
  letter-spacing: var(--ov-track-caps);
  text-transform: uppercase;
  color: var(--cls-ink, var(--ov-fg));
}

.sd-cmeta {
  flex: none;
  margin-left: auto;
  font-family: var(--ov-font-small);
  font-size: var(--ov-t-caption);
  font-weight: var(--ov-w-text);
  color: var(--ov-fg-muted);
}
</style>
