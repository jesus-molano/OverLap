<script setup lang="ts">
import { useId } from 'vue'

/** A titled block of a settings page: caps caption, optional note, rows in a card. */
withDefaults(
  defineProps<{
    title: string
    note?: string
    /** Rows go straight into a card (default); off for custom content (column editor). */
    card?: boolean
  }>(),
  { note: undefined, card: true }
)

const titleId = useId()
</script>

<template>
  <section class="st-section" :aria-labelledby="titleId">
    <div class="st-section-head">
      <h2 :id="titleId" class="st-section-title">{{ title }}</h2>
      <span v-if="note" class="st-section-note">{{ note }}</span>
    </div>
    <div :class="{ 'st-card': card }">
      <slot />
    </div>
  </section>
</template>
