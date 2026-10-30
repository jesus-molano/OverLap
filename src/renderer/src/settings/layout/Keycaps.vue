<script setup lang="ts">
import { computed } from 'vue'

/**
 * A key combination as separate keycaps ([Ctrl] [Shift] [E]); screen readers get it as one
 * text ('Ctrl+Shift+E'). `pending` adds an empty cap: the combination is still being pressed.
 */
const props = withDefaults(defineProps<{ keys: readonly string[]; pending?: boolean }>(), {
  pending: false
})

const text = computed(() => props.keys.join('+'))
</script>

<template>
  <span class="keycaps">
    <span class="caps" aria-hidden="true">
      <kbd v-for="(k, i) in keys" :key="i" class="cap">{{ k }}</kbd>
      <kbd v-if="pending" class="cap cap-pending">…</kbd>
    </span>
    <span class="st-sr-only">{{ text }}</span>
  </span>
</template>

<style scoped>
.keycaps {
  display: inline-flex;
}

.caps {
  display: inline-flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px;
}

/* Above the window's kbd (settings.css): a key you read at a glance, not inline text. */
.cap {
  min-width: 1.9em;
  padding: 2px 8px;
  font-family: var(--ov-font-num);
  font-size: var(--st-t-ui);
  line-height: 1.3;
  text-align: center;
}

.cap-pending {
  border-style: dashed;
  border-bottom-width: 1px;
  color: var(--ov-fg-dim);
}
</style>
