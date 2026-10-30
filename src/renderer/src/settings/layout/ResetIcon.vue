<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from '../../composables/useI18n'
import Icon from '../../ui/Icon.vue'

/**
 * The reset of one part of a page, as an icon (↺) at the end of its head: a section, a zone, a
 * shortcut. One click; what it did is undone from the toast ("Deshacer"). `label` names what it
 * resets (its tooltip and its name for screen readers). Dimmed when that part is as it comes
 * (R47), saying so as the lists' «Restablecer» do: «Nada que restablecer…».
 */
const props = defineProps<{ label: string; disabled?: boolean }>()
defineEmits<{ reset: [] }>()

const t = useI18n()
const tip = computed(() =>
  props.disabled === true ? `${props.label}. ${t.value.settings.elements.atDefault}` : props.label
)
</script>

<template>
  <button
    type="button"
    class="st-reset-icon"
    :aria-label="tip"
    :title="tip"
    :disabled="disabled"
    @click="$emit('reset')"
  >
    <Icon name="reset" />
  </button>
</template>
