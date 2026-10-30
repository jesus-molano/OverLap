<script setup lang="ts">
import { computed, onBeforeUnmount, shallowRef, useId, useTemplateRef } from 'vue'
import type { HiddenReason } from '@shared/types'
import { WIDGET_IDS, type WidgetId } from '@shared/widgets'
import { useI18n } from '../composables/useI18n'
import { useOverlayState } from '../composables/useOverlay'
import { useDeviceNames, useShortcuts } from '../composables/useShortcuts'
import { sendCommand, setOverlayHidden } from './editor'
import { useNavigate } from './navigate'
import { useSaveFailing } from './saveFailing'
import { bindingsText } from './shortcutsView'
import { statusSummary } from './statusSummary'

/**
 * The status chip (R35): the connection and, under it, what is hidden or failing now ('Oculto:
 * fuera del coche', '2 widgets ocultos ahora'). A click opens its panel: the whole status line
 * and what it means, the overlay hidden by you (with «Mostrar»), which widgets a rule hides now
 * and why, the shortcuts that do not work, «Copiar diagnóstico» and «Abrir registro». The panel
 * is a popover (top layer: never cut by the sidebar), placed under the chip.
 */
const { status, overlayHidden, settings, shortcutStatus, autoHiddenOf } = useOverlayState()
const t = useI18n()
const shortcuts = useShortcuts()
const deviceNames = useDeviceNames()
const saveFailing = useSaveFailing()
const navigate = useNavigate()

const hidden = computed(() => {
  const out: Partial<Record<WidgetId, HiddenReason | null>> = {}
  for (const id of WIDGET_IDS) {
    const a = autoHiddenOf[id].value
    if (a.hidden) out[id] = a.reason
  }
  return out
})
const summary = computed(() =>
  statusSummary(t.value, {
    status: status.value,
    overlayHidden: overlayHidden.value,
    settings: settings.value,
    hidden: hidden.value,
    shortcuts: shortcutStatus.value,
    saveFailing: saveFailing.value
  })
)
const overlayKeys = computed(() =>
  bindingsText(t.value, shortcuts.value.toggleOverlay, deviceNames.value)
)

const panelId = useId()
const titleId = useId()
const chip = useTemplateRef<HTMLButtonElement>('chip')
const panel = useTemplateRef<HTMLElement>('panel')
const open = shallowRef(false)
const copied = shallowRef(false)
let copiedTimer: ReturnType<typeof setTimeout> | undefined

/** Under the chip, kept inside the window (the narrow top bar has it at the right). */
function place(): void {
  const c = chip.value
  const p = panel.value
  if (!c || !p) return
  const r = c.getBoundingClientRect()
  const w = p.offsetWidth
  const left = Math.max(8, Math.min(r.left, window.innerWidth - w - 8))
  p.style.left = `${Math.round(left)}px`
  p.style.top = `${Math.round(r.bottom + 6)}px`
}

function onToggle(e: Event): void {
  open.value = 'newState' in e && e.newState === 'open'
  if (open.value) place()
}

function close(): void {
  panel.value?.hidePopover()
}

function copy(): void {
  sendCommand({ type: 'copy-diagnostics' })
  copied.value = true
  clearTimeout(copiedTimer)
  copiedTimer = setTimeout(() => (copied.value = false), 2500)
}

function openLog(): void {
  sendCommand({ type: 'open-log' })
}

function goShortcuts(): void {
  close()
  navigate('shortcuts')
}

function show(): void {
  setOverlayHidden(false)
}

onBeforeUnmount(() => clearTimeout(copiedTimer))
</script>

<template>
  <button
    ref="chip"
    type="button"
    class="chip"
    :class="`tone-${summary.tone}`"
    :popovertarget="panelId"
    :aria-label="t.settings.status.chipAria(summary.label)"
    :aria-expanded="open"
    :title="summary.connection"
  >
    <span class="dot" aria-hidden="true" />
    <span class="texts">
      <span class="label">{{ summary.label }}</span>
      <span v-if="summary.sub" class="sub">{{ summary.sub }}</span>
    </span>
  </button>
  <!-- The live part stays in the page: what a screen reader hears when it changes. -->
  <span class="st-sr-only" role="status">{{ summary.sub ?? '' }}</span>

  <div
    :id="panelId"
    ref="panel"
    popover="auto"
    class="panel"
    role="dialog"
    :aria-labelledby="titleId"
    @toggle="onToggle"
  >
    <h2 :id="titleId" class="panel-title">{{ t.settings.status.title }}</h2>
    <section class="block">
      <p class="line strong">
        <span class="dot" :class="`tone-${summary.tone}`" aria-hidden="true" />
        {{ summary.connection }}
      </p>
      <p class="help">{{ summary.advice }}</p>
    </section>

    <section v-if="overlayHidden" class="block row">
      <p class="line">
        {{ t.settings.status.overlayHidden }}
        <template v-if="overlayKeys">{{ t.settings.status.overlayKeys(overlayKeys) }}</template>
      </p>
      <button type="button" class="st-btn st-btn-sm" @click="show">
        {{ t.settings.status.show }}
      </button>
    </section>

    <section class="block">
      <p class="line">{{ summary.enabled }}</p>
      <h3 class="block-title">
        {{ overlayHidden ? t.settings.status.hiddenNowTitle : t.settings.status.hiddenTitle }}
      </h3>
      <p v-if="overlayHidden" class="help">{{ t.settings.status.allByYou }}</p>
      <ul v-else-if="summary.hiddenLines.length > 0" class="list">
        <li v-for="l in summary.hiddenLines" :key="l">{{ l }}</li>
      </ul>
      <p v-else class="help">{{ t.settings.status.noneHidden }}</p>
    </section>

    <section v-if="summary.shortcutsFailing > 0" class="block row">
      <p class="line warn">{{ t.settings.status.shortcutsFailing(summary.shortcutsFailing) }}</p>
      <button type="button" class="st-btn st-btn-sm" @click="goShortcuts">
        {{ t.settings.status.openShortcuts }}
      </button>
    </section>

    <section v-if="saveFailing" class="block">
      <p class="line warn">{{ t.settings.status.saveFailing }}</p>
    </section>

    <footer class="actions">
      <button
        type="button"
        class="st-btn st-btn-sm"
        :title="t.settings.status.copyHelp"
        @click="copy"
      >
        {{ copied ? t.settings.status.copied : t.settings.status.copy }}
      </button>
      <button
        type="button"
        class="st-btn st-btn-sm st-btn-ghost"
        :title="t.settings.status.openLogHelp"
        @click="openLog"
      >
        {{ t.settings.status.openLog }}
      </button>
    </footer>
  </div>
</template>

<style scoped>
.chip {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  max-width: 100%;
  padding: 3px 12px;
  border: 1px solid var(--st-border-hi);
  border-radius: var(--st-radius-sm);
  background: var(--st-surface);
  color: var(--ov-fg);
  font-size: var(--st-t-help);
  line-height: 1.4;
  text-align: left;
  cursor: pointer;
}

.chip:hover,
.chip[aria-expanded='true'] {
  background: var(--st-surface-hi);
}

.texts {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.label,
.sub {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sub {
  color: var(--ov-fg-muted);
  font-size: var(--st-t-help);
}

/* Grey until there is something to say: the accent means you, never a state. */
.dot {
  flex: none;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--ov-fg-dim);
}

.tone-ok .dot,
.dot.tone-ok {
  background: var(--st-ok);
}

.tone-sim .dot,
.dot.tone-sim {
  background: var(--ov-edit);
}

.tone-warn .dot,
.dot.tone-warn {
  background: var(--ov-warn);
}

.chip.tone-error {
  border-color: color-mix(in srgb, var(--ov-danger) 50%, transparent);
}

.tone-error .dot,
.dot.tone-error {
  background: var(--ov-danger);
}

/* The panel: in the top layer, placed by place() under the chip. */
.panel {
  position: fixed;
  inset: auto;
  width: min(340px, calc(100vw - 16px));
  margin: 0;
  padding: 12px 16px;
  border: 1px solid var(--st-border-strong);
  border-radius: var(--st-radius);
  background: var(--st-surface-hi);
  box-shadow:
    var(--st-lit),
    0 0 0 1px rgb(0 0 0 / 35%);
  color: var(--ov-fg);
  font-size: var(--st-t-ui);
  line-height: 1.45;
}

.panel-title {
  margin-bottom: 8px;
  color: var(--ov-fg-dim);
  font-family: var(--ov-font-small);
  font-size: var(--st-t-caption);
  font-weight: var(--ov-w-strong);
  letter-spacing: var(--ov-track-caps);
  text-transform: uppercase;
}

.block {
  padding: 8px 0;
  border-top: 1px solid var(--st-border);
}

.block.row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.block.row .line {
  flex: 1 1 auto;
}

.block-title {
  margin-top: 8px;
  color: var(--ov-fg-muted);
  font-size: var(--st-t-help);
  font-weight: var(--ov-w-strong);
}

.line {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px 8px;
}

.strong {
  font-weight: var(--ov-w-strong);
}

.warn {
  color: var(--ov-warn);
}

.help {
  color: var(--ov-fg-muted);
  font-size: var(--st-t-ui);
}

.list {
  margin: 4px 0 0;
  padding-left: 16px;
  color: var(--ov-fg-muted);
  font-size: var(--st-t-ui);
}

.actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding-top: 12px;
  border-top: 1px solid var(--st-border);
}
</style>
