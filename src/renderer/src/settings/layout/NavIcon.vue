<script setup lang="ts">
import type { SettingsPage } from '../nav'
import { NAV_ICONS } from './navIcons'

defineProps<{ page: SettingsPage }>()
</script>

<template>
  <svg class="nav-icon" viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
    <path v-for="(s, i) in NAV_ICONS[page]" :key="i" :d="s.d" :class="s.fill ? 'fill' : 'stroke'" />
  </svg>
</template>

<style scoped>
.nav-icon {
  flex: none;
  width: 16px;
  height: 16px;
  overflow: visible;
}

.stroke {
  fill: none;
  stroke: currentColor;
  stroke-width: 1.5;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.fill {
  fill: currentColor;
  opacity: 0.9;
}
</style>
