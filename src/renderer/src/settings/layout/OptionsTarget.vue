<script setup lang="ts">
import { computed } from 'vue'
import { DEFAULT_SETTINGS } from '@shared/settings'
import type { WidgetId } from '@shared/widgets'
import { useI18n } from '../../composables/useI18n'
import { useOverlayState } from '../../composables/useOverlay'
import { layoutCommands, optionsTarget } from '../layoutsView'
import ConfirmButton from './ConfirmButton.vue'

/**
 * The top of a widget page: where its changes are kept, the layout in use ("Guardando en:
 * Mazda MX-5", a 'full' one) or the shared options (a 'position' one in use), and "Aplicar a
 * todas las disposiciones", which copies this widget's options into every layout that has its
 * own and into the shared ones (with a second click to confirm).
 */
const props = defineProps<{ widgetId: WidgetId }>()

const t = useI18n()
const { settings } = useOverlayState()
const target = computed(() =>
  optionsTarget(settings.value?.savedLayouts ?? DEFAULT_SETTINGS.savedLayouts)
)
const text = computed(() => t.value.settings.widgetPage.target)

function toAll(): void {
  layoutCommands.optionsToAll(props.widgetId)
}
</script>

<template>
  <div class="target" role="note">
    <p class="where">
      <span class="label">{{ text.savingIn }}</span>
      <strong class="name" :title="target.shared ? text.shared : target.name">{{
        target.shared ? text.shared : target.name
      }}</strong>
      <span class="st-help help">{{
        target.shared ? text.sharedHelp(target.name) : text.layoutHelp
      }}</span>
    </p>
    <ConfirmButton
      v-if="target.canApplyToAll"
      small
      :label="text.toAll.label"
      :confirm-label="text.toAll.confirm"
      :description="text.toAll.description"
      :action="toAll"
    />
  </div>
</template>

<style scoped>
/* A plain bar, lined all round like the page's other notes: no coloured edge. */
.target {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 6px 14px;
  margin-bottom: 12px;
  padding: 6px 8px 6px 12px;
  border: 1px solid var(--st-border);
  border-radius: var(--st-radius);
  background: var(--st-surface);
}

.where {
  display: flex;
  flex: 1 1 20em;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 2px 8px;
  min-width: 0;
  font-size: 13px;
}

.label {
  color: var(--ov-fg-muted);
}

.name {
  overflow: hidden;
  max-width: 24em;
  font-weight: var(--ov-w-strong);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.help {
  flex: 1 1 16em;
  min-width: 0;
}
</style>
