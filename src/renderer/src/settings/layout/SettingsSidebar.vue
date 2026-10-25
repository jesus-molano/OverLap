<script setup lang="ts">
import { computed } from 'vue'
import { widgetTitle } from '@shared/i18n'
import { WIDGET_IDS } from '@shared/widgets'
import { useI18n } from '../../composables/useI18n'
import { useOverlayState } from '../../composables/useOverlay'
import StatusChip from '../StatusChip.vue'
import { sendCommand, widgetSetter } from '../editor'
import type { SettingsPage } from '../nav'
import EditModeButton from './EditModeButton.vue'
import NavIcon from './NavIcon.vue'
import VisibilityDot from './VisibilityDot.vue'

defineProps<{ page: SettingsPage }>()
const emit = defineEmits<{ select: [page: SettingsPage] }>()

const { settings } = useOverlayState()
const t = useI18n()
// A string, so dragging a widget (a settings broadcast per frame) re-renders nothing here.
const visibleKey = computed(() =>
  WIDGET_IDS.map((id) => (settings.value?.widgets[id].visible === false ? '0' : '1')).join('')
)
const items = computed(() =>
  WIDGET_IDS.map((id, i) => ({
    id,
    title: widgetTitle(t.value, id),
    visible: visibleKey.value[i] === '1',
    setVisible: widgetSetter(id)('visible')
  }))
)

function openSettingsFolder(): void {
  sendCommand({ type: 'open-settings-folder' })
}
</script>

<template>
  <aside class="sidebar">
    <div class="brand">
      <h1 class="title">{{ t.settings.nav.title }}</h1>
      <StatusChip />
    </div>

    <nav class="nav" :aria-label="t.settings.nav.sections">
      <button
        type="button"
        class="nav-item"
        :aria-current="page === 'appearance' ? 'page' : undefined"
        @click="emit('select', 'appearance')"
      >
        <NavIcon page="appearance" />
        <span class="nav-text">{{ t.settings.nav.appearance }}</span>
      </button>

      <h2 class="nav-group">{{ t.settings.nav.widgets }}</h2>
      <ul class="nav-list">
        <li v-for="item in items" :key="item.id" class="nav-li">
          <button
            type="button"
            class="nav-item"
            :class="{ 'is-hidden': !item.visible }"
            :aria-current="page === item.id ? 'page' : undefined"
            @click="emit('select', item.id)"
          >
            <NavIcon :page="item.id" />
            <span class="nav-text">{{ item.title }}</span>
          </button>
          <VisibilityDot :title="item.title" :current="item.visible" :apply="item.setVisible" />
        </li>
      </ul>
    </nav>

    <div class="foot">
      <EditModeButton />
      <dl class="keys">
        <dt><kbd>Ctrl+Shift+E</kbd></dt>
        <dd>{{ t.settings.nav.keyToggle }}</dd>
        <dt><kbd>Esc</kbd></dt>
        <dd>{{ t.settings.nav.keyExit }}</dd>
      </dl>
      <button
        type="button"
        class="st-btn st-btn-ghost st-btn-sm folder"
        @click="openSettingsFolder"
      >
        {{ t.settings.app.openFolder }}
      </button>
    </div>
  </aside>
</template>

<style scoped>
.sidebar {
  position: sticky;
  top: 0;
  display: flex;
  flex-direction: column;
  gap: 18px;
  height: 100vh;
  overflow-y: auto;
  padding: 18px 12px 14px;
  border-right: 1px solid var(--st-border);
  background: var(--st-sidebar);
}

.brand {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 8px;
  padding: 0 6px;
}

.title {
  font-family: var(--ov-font-num);
  font-size: 18px;
  font-weight: var(--ov-w-strong);
  line-height: 1.2;
  letter-spacing: 0.005em;
}

.nav {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.nav-group {
  margin: 12px 8px 4px;
  color: var(--ov-fg-dim);
  font-family: var(--ov-font-small);
  font-size: 11px;
  font-weight: var(--ov-w-strong);
  letter-spacing: var(--ov-track-caps);
  text-transform: uppercase;
}

.nav-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.nav-li {
  display: flex;
  align-items: center;
  gap: 2px;
}

.nav-item {
  position: relative;
  display: flex;
  flex: 1 1 auto;
  align-items: center;
  gap: 10px;
  min-width: 0;
  min-height: 34px;
  padding: 6px 10px;
  border: 0;
  border-radius: var(--st-radius-sm);
  background: transparent;
  color: var(--ov-fg-muted);
  font-size: 13.5px;
  text-align: left;
  cursor: pointer;
}

.nav-item:hover {
  background: var(--st-surface-hi);
  color: var(--ov-fg);
}

.nav-item[aria-current='page'] {
  background: var(--st-surface-hi);
  color: var(--ov-fg);
  font-weight: var(--ov-w-strong);
}

/* The current page: a square rail in ink (a rail means state, as in the widgets). */
.nav-item[aria-current='page']::before {
  content: '';
  position: absolute;
  inset: 8px auto 8px 0;
  width: var(--ov-bar-w);
  border-radius: 0;
  background: var(--st-sel);
}

.nav-item.is-hidden .nav-text {
  opacity: 0.6;
}

.nav-text {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.foot {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 8px;
  margin-top: auto;
  padding: 12px 4px 0;
  border-top: 1px solid var(--st-border);
}

.keys {
  display: grid;
  grid-template-columns: auto 1fr;
  align-items: center;
  gap: 4px 8px;
  margin: 0;
  color: var(--ov-fg-dim);
  font-size: 11.5px;
}

.keys dd {
  margin: 0;
}

.folder {
  align-self: flex-start;
  margin-left: -4px;
}
</style>
