<script setup lang="ts">
import { computed } from 'vue'
import { LOCALES, hiddenText, widgetTitle } from '@shared/i18n'
import { WIDGET_GROUPS, WIDGET_IDS, type WidgetId } from '@shared/widgets'
import { useI18n, useLanguage } from '../../composables/useI18n'
import { useOverlayState } from '../../composables/useOverlay'
import { useDeviceNames, useShortcuts } from '../../composables/useShortcuts'
import Icon from '../../ui/Icon.vue'
import StatusChip from '../StatusChip.vue'
import SettingsSearch from '../search/SettingsSearch.vue'
import { sendCommand } from '../editor'
import { setWidgetVisible } from '../undo/restore'
import { GLOBAL_PAGES, pageTitle, type SettingsPage } from '../nav'
import { sidebarKeys } from '../shortcutsView'
import EditModeButton from './EditModeButton.vue'
import NavIcon from './NavIcon.vue'
import VisibilityDot from './VisibilityDot.vue'

defineProps<{ page: SettingsPage }>()
const emit = defineEmits<{ select: [page: SettingsPage] }>()

const { settings, autoHiddenOf } = useOverlayState()
const t = useI18n()
const lang = useLanguage()
const shortcuts = useShortcuts()
const deviceNames = useDeviceNames()
const globalItems = computed(() =>
  GLOBAL_PAGES.map((page) => ({ page, title: pageTitle(t.value, page) }))
)
/** The shortcuts at the foot, as configured (one turned off is left out). */
const keys = computed(() => sidebarKeys(t.value, shortcuts.value, deviceNames.value))
// A string, so dragging a widget (a settings broadcast per frame) re-renders nothing here.
const visibleKey = computed(() =>
  WIDGET_IDS.map((id) => (settings.value?.widgets[id].visible === false ? '0' : '1')).join('')
)
/** On but hidden now by a rule: why, in lower case as in the tray ('oculto en práctica'). */
function heldOf(id: WidgetId): string | null {
  const a = autoHiddenOf[id].value
  if (!a.hidden) return null
  const caption = hiddenText(t.value, a.reason)
  return caption.charAt(0).toLocaleLowerCase(LOCALES[lang.value]) + caption.slice(1)
}

/** The widgets in their groups (R42): the track and rivals, your lap, your car. */
const groups = computed(() =>
  WIDGET_GROUPS.map((g) => ({
    id: g.id,
    title: t.value.core.widgetGroups[g.id],
    items: g.widgets.map((id) => ({
      id,
      title: widgetTitle(t.value, id),
      visible: visibleKey.value[WIDGET_IDS.indexOf(id)] === '1',
      held: heldOf(id),
      setVisible: (on: boolean) => setWidgetVisible(id, on)
    }))
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
    <SettingsSearch class="side-search" />

    <nav class="nav" :aria-label="t.settings.nav.sections">
      <button
        v-for="item in globalItems"
        :key="item.page"
        type="button"
        class="nav-item"
        :aria-current="page === item.page ? 'page' : undefined"
        @click="emit('select', item.page)"
      >
        <NavIcon :page="item.page" />
        <span class="nav-text">{{ item.title }}</span>
      </button>

      <template v-for="group in groups" :key="group.id">
        <h2 class="nav-group">{{ group.title }}</h2>
        <ul class="nav-list" :aria-label="group.title">
          <li v-for="item in group.items" :key="item.id" class="nav-li">
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
            <VisibilityDot
              :title="item.title"
              :current="item.visible"
              :held="item.held"
              :apply="item.setVisible"
            />
          </li>
        </ul>
      </template>
    </nav>

    <div class="foot">
      <EditModeButton />
      <dl class="keys">
        <template v-for="k in keys" :key="k.id">
          <dt>
            <span v-if="k.button" class="key-button" :title="k.title">
              <Icon name="wheel" class="key-button-icon" />
              <span class="key-button-text">{{ k.keys }}</span>
            </span>
            <kbd v-else>{{ k.keys }}</kbd>
          </dt>
          <dd>{{ k.label }}</dd>
        </template>
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
  gap: 14px;
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

.side-search {
  margin: -6px 0 -4px;
}

.nav {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.nav-group {
  margin: 10px 8px 2px;
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
  min-height: 32px;
  padding: 5px 10px;
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

.keys dt {
  min-width: 0;
}

/* A controller's button: the wheel glyph, not a key; its controller cut to the column. */
.key-button {
  display: flex;
  align-items: center;
  gap: 4px;
  max-width: 8em;
  color: var(--ov-fg-muted);
}

.key-button-icon {
  flex: none;
}

.key-button-text {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.folder {
  align-self: flex-start;
  margin-left: -4px;
}
</style>
