<script setup lang="ts">
import type { ClassLineView } from './view'

/**
 * Class header line: class name (in the class ink) and SoF / car count (multi-root, see the
 * parent). The class colour is the line's 2 px bottom key, drawn by the parent: horizontal means
 * identity, so the class never goes on a rail.
 */
defineProps<{ line: ClassLineView }>()
</script>

<template>
  <span class="sd-cname">{{ line.name }}</span>
  <span v-if="line.meta" class="sd-cmeta">{{ line.meta }}</span>
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
