<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from '../../composables/useI18n'
import { useOverlayState } from '../../composables/useOverlay'
import { useDeviceNames, useShortcuts } from '../../composables/useShortcuts'
import Icon from '../../ui/Icon.vue'
import { setOverlayHidden } from '../editor'
import { bindingsText } from '../shortcutsView'

/**
 * While the user has the overlay hidden (tray, shortcut): one quiet line above every page, in
 * neutral ink (the edit-mode banner has the colour), with the way back: the shortcut when it
 * has one, and a button either way. Nothing otherwise.
 */
const { overlayHidden } = useOverlayState()
const t = useI18n()
const shortcuts = useShortcuts()
const deviceNames = useDeviceNames()
/** 'Ctrl+Shift+H', 'Botón 3 · G29 …' for a controller's button, 'Ctrl+Shift+H · Botón 24'. */
const keys = computed(() => bindingsText(t.value, shortcuts.value.toggleOverlay, deviceNames.value))
</script>

<template>
  <!-- The live region stays in the page; only its content comes and goes. -->
  <div class="hidden-note" role="status">
    <p v-if="overlayHidden" class="note">
      <Icon name="eye-off" class="eye" />
      <span class="text">
        <strong class="title">{{ t.settings.nav.hidden.title }}</strong>
        <template v-if="keys"> · {{ t.settings.nav.hidden.press(keys) }}</template>
      </span>
      <button type="button" class="st-btn st-btn-sm show" @click="setOverlayHidden(false)">
        {{ t.settings.nav.hidden.show }}
      </button>
    </p>
  </div>
</template>

<style scoped>
.note {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 14px;
  padding: 5px 6px 5px 12px;
  border: 1px solid var(--st-border-hi);
  border-radius: var(--st-radius);
  background: var(--st-surface);
  color: var(--ov-fg-muted);
  font-size: 13px;
  line-height: 1.4;
}

.eye {
  color: var(--ov-fg-muted);
}

.text {
  flex: 1 1 auto;
  min-width: 0;
}

.title {
  color: var(--ov-fg);
  font-weight: var(--ov-w-strong);
}
</style>
