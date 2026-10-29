<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from '../../composables/useI18n'
import { useOverlayState } from '../../composables/useOverlay'
import { useDeviceNames, useShortcuts } from '../../composables/useShortcuts'
import { sendCommand } from '../editor'
import { editModeTooltip } from '../shortcutsView'

/** Toggles edit mode in every overlay window (main is the source of truth). */
withDefaults(defineProps<{ compact?: boolean }>(), { compact: false })

const { editMode } = useOverlayState()
const t = useI18n()
const shortcuts = useShortcuts()
const deviceNames = useDeviceNames()
const tooltip = computed(() => editModeTooltip(t.value, shortcuts.value, deviceNames.value))

function toggle(): void {
  sendCommand({ type: 'set-edit-mode', on: !editMode.value })
}
</script>

<template>
  <button
    type="button"
    class="st-btn edit-btn"
    :class="{ compact }"
    :aria-pressed="editMode"
    :title="tooltip"
    @click="toggle"
  >
    <span class="edit-dot" aria-hidden="true" />
    {{ editMode ? t.settings.editMode.exit : t.settings.editMode.enter }}
  </button>
</template>

<style scoped>
.edit-btn {
  justify-content: flex-start;
  width: 100%;
  min-height: 34px;
}

.edit-btn.compact {
  width: auto;
}

.edit-dot {
  flex: none;
  width: 8px;
  height: 8px;
  border: 1.5px solid var(--ov-fg-muted);
  border-radius: 50%;
}

.edit-btn[aria-pressed='true'] {
  border-color: var(--ov-edit);
  background: color-mix(in srgb, var(--ov-edit) 18%, var(--st-surface-hi));
  color: var(--ov-fg);
}

.edit-btn[aria-pressed='true'] .edit-dot {
  border-color: var(--ov-edit);
  background: var(--ov-edit);
}
</style>
