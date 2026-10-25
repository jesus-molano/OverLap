<script setup lang="ts">
import ClassStripe from '@renderer/ui/ClassStripe.vue'
import type { ClassLineView } from './view'

/** Class header line: colour stripe, class name, SoF and car count (multi-root, see the parent). */
defineProps<{ line: ClassLineView }>()
</script>

<template>
  <ClassStripe class="sd-cbar" />
  <span class="sd-cname">{{ line.name }}</span>
  <span v-if="line.meta" class="sd-cmeta">{{ line.meta }}</span>
</template>

<style scoped>
/* As tall as the line allows, whatever the density. */
.sd-cbar {
  min-height: 0;
  margin: 0.25em 0;
}

.sd-cname {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: var(--ov-t-caption);
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.sd-cmeta {
  flex: none;
  margin-left: auto;
  font-size: var(--ov-t-caption);
  color: var(--ov-fg-muted);
}
</style>
