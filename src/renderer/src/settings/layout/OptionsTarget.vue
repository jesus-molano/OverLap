<script setup lang="ts">
import { computed, onBeforeUnmount, watch } from 'vue'
import { DEFAULT_SETTINGS } from '@shared/settings'
import type { WidgetId } from '@shared/widgets'
import { useI18n } from '../../composables/useI18n'
import { useOverlayState } from '../../composables/useOverlay'
import { layoutCommands, optionsTarget, useLayoutState } from '../layoutsView'
import Icon from '../../ui/Icon.vue'
import ConfirmButton from './ConfirmButton.vue'

/**
 * The top of a widget page's options: where its changes are kept, the layout in use ("Guardando
 * en: Mazda MX-5", a 'full' one) or the shared options (a 'position' one in use), and "Copiar
 * estas opciones a todas", which copies this widget's options into every layout that has its own
 * and into the shared ones (with a second click to confirm), then says how it went.
 *
 * The button is keyed by the layout in use: another one applied (the tray, a shortcut, the car)
 * disarms it, and main copies nothing for a click armed on the layout left (layoutId).
 */
const props = defineProps<{ widgetId: WidgetId }>()

const t = useI18n()
const { settings } = useOverlayState()
const { layoutNotice } = useLayoutState()
const target = computed(() =>
  optionsTarget(settings.value?.savedLayouts ?? DEFAULT_SETTINGS.savedLayouts)
)
const text = computed(() => t.value.settings.widgetPage.target)

/** Main's answer to this page's copy, worded; '' for none. */
const done = computed(() => {
  const n = layoutNotice.value
  if (n?.kind !== 'options-copied' || n.widgetId !== props.widgetId) return ''
  return text.value.toAll.done[n.result]
})

function clearDone(): void {
  if (layoutNotice.value?.kind === 'options-copied') layoutNotice.value = null
}

// What it said was about the layout in use then, and about this page.
watch(() => target.value.id, clearDone)
onBeforeUnmount(clearDone)

function toAll(): void {
  layoutCommands.optionsToAll(props.widgetId, target.value.id)
}
</script>

<template>
  <div class="target" :class="{ 'is-shared': target.shared }" role="note">
    <Icon name="save" class="icon" />
    <div class="where">
      <span class="label">{{ text.savingIn }}</span>
      <strong class="name" :title="target.shared ? text.shared : target.name">{{
        target.shared ? text.shared : target.name
      }}</strong>
      <span class="st-help help">{{
        target.shared ? text.sharedHelp(target.name) : text.layoutHelp
      }}</span>
    </div>
    <div v-if="target.canApplyToAll" class="to-all">
      <ConfirmButton
        :key="target.id"
        small
        :label="text.toAll.label"
        :confirm-label="text.toAll.confirm"
        :description="text.toAll.description"
        :action="toAll"
      />
      <span class="st-help done" aria-live="polite">{{ done }}</span>
    </div>
  </div>
</template>

<style scoped>
/*
 * Lined all round a step lighter than the cards, with a faint light wash from the top: it stands
 * out from the cards below as information, never as a warning (no accent, which is yellow by
 * default; no amber; no coloured edge). The shared options, not one layout's, are quieter still.
 */
.target {
  --tg-tone: var(--ov-fg);
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px 14px;
  margin-bottom: 14px;
  padding: 10px 12px;
  border: 1px solid color-mix(in srgb, var(--tg-tone) 22%, var(--st-border));
  border-radius: var(--st-radius);
  background:
    linear-gradient(180deg, color-mix(in srgb, var(--tg-tone) 6%, transparent), transparent 85%),
    var(--st-surface);
}

.target.is-shared {
  --tg-tone: var(--ov-fg-muted);
}

.target.is-shared .icon {
  color: var(--ov-fg-muted);
}

.icon {
  flex: none;
  align-self: flex-start;
  margin-top: 2px;
  font-size: 18px;
  color: var(--ov-fg);
}

/* Label, name and help each on their own line. */
.where {
  display: flex;
  flex: 1 1 18em;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.label {
  font-size: 11px;
  font-weight: var(--ov-w-strong);
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--ov-fg-muted);
}

.name {
  overflow: hidden;
  font-size: 14px;
  font-weight: var(--ov-w-strong);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.help {
  margin: 0;
}

/* The button centred on the right; what it did, under it. Under the text when narrow. */
.to-all {
  display: flex;
  flex: none;
  flex-direction: column;
  align-items: flex-end;
  gap: 4px;
}

.done:empty {
  display: none;
}

@media (max-width: 640px) {
  .to-all {
    align-items: flex-start;
    margin-left: 32px;
  }
}
</style>
