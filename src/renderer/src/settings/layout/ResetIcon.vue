<script setup lang="ts">
import Icon from '../../ui/Icon.vue'

/**
 * The reset of one part of a page, as an icon (↺) at the end of its head: a section, a zone, a
 * shortcut. One click; what it did is undone from the toast ("Deshacer"). `label` names what it
 * resets (its tooltip and its name for screen readers).
 */
defineProps<{ label: string; disabled?: boolean }>()
defineEmits<{ reset: [] }>()
</script>

<template>
  <button
    type="button"
    class="st-reset-icon"
    :aria-label="label"
    :title="label"
    :disabled="disabled"
    @click="$emit('reset')"
  >
    <Icon name="reset" />
  </button>
</template>
