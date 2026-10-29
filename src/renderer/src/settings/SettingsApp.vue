<script setup lang="ts">
import './settings.css'
import { computed, onUnmounted, shallowRef, useId } from 'vue'
import { useI18n, useLanguage } from '../composables/useI18n'
import { useOverlayState } from '../composables/useOverlay'
import StatusChip from './StatusChip.vue'
import { sendCommand, updateFailed } from './editor'
import EditModeButton from './layout/EditModeButton.vue'
import OverlayHiddenNote from './layout/OverlayHiddenNote.vue'
import SettingsFooter from './layout/SettingsFooter.vue'
import SettingsSidebar from './layout/SettingsSidebar.vue'
import { WIDGET_GROUPS } from '@shared/widgets'
import {
  GLOBAL_PAGES,
  browserStorage,
  initialPage,
  isSettingsPage,
  pageTitle,
  savePage,
  searchWithoutPage,
  type SettingsPage
} from './nav'
import AppearancePage from './pages/AppearancePage.vue'
import LayoutsPage from './pages/LayoutsPage.vue'
import ShortcutsPage from './pages/ShortcutsPage.vue'
import VisibilityPage from './pages/VisibilityPage.vue'
import WidgetPage from './pages/WidgetPage.vue'
import UndoToast from './undo/UndoToast.vue'
import { provideNavigate } from './navigate'
import { useSaveFailing } from './saveFailing'

// Main is the source of truth: these follow its broadcasts (and the replies to our updates).
const { editMode, settings, status } = useOverlayState()
const t = useI18n()
const lang = useLanguage()

const storage = browserStorage()
const page = shallowRef<SettingsPage>(initialPage(location.search, storage))
savePage(storage, page.value)
// Read once: a reload (dev Ctrl+R) shows the page you are on, not the one main asked for.
const unasked = searchWithoutPage(location.search)
if (unasked !== location.search) {
  history.replaceState(history.state, '', location.pathname + unasked + location.hash)
}
const selectId = useId()
/** The narrow window's select: the general pages, then the widgets in their groups (R42). */
const pageGroups = computed(() => [
  {
    id: 'general',
    title: null,
    pages: GLOBAL_PAGES.map((p) => ({ page: p, title: pageTitle(t.value, p) }))
  },
  ...WIDGET_GROUPS.map((g) => ({
    id: g.id,
    title: t.value.core.widgetGroups[g.id],
    pages: g.widgets.map((p) => ({ page: p, title: pageTitle(t.value, p) }))
  }))
])

/** A new page is a new scroller (it is keyed), so it starts at the top. */
function select(next: SettingsPage): void {
  if (next === page.value) return
  page.value = next
  savePage(storage, next)
}

function onSelectChange(e: Event): void {
  const v = e.target instanceof HTMLSelectElement ? e.target.value : null
  if (isSettingsPage(v)) select(v)
}

// Main asks for a page when it brings the open window to the front (the tray's "Más…").
const stopPageRequests = window.overlay.onSettingsPage((p) => {
  if (isSettingsPage(p)) select(p)
})
onUnmounted(stopPageRequests)

/** Main could not write settings.json: the changes are kept in memory and retried. */
const saveFailing = useSaveFailing()
/** The telemetry cannot load the iRacing SDK module: said on every page, not only the tray (R35). */
const nativeMissing = computed(
  () => status.value?.state === 'error' && status.value.note === 'native-missing'
)
// Pages and panels go to another page through this (the status panel, a search result…).
provideNavigate((next) => select(next))

function exitEdit(): void {
  sendCommand({ type: 'set-edit-mode', on: false })
}

function copyDiagnostics(): void {
  sendCommand({ type: 'copy-diagnostics' })
}

function openLog(): void {
  sendCommand({ type: 'open-log' })
}
</script>

<template>
  <div class="app" :lang="lang">
    <SettingsSidebar class="side" :page="page" @select="select" />

    <!-- The window never scrolls: bands (settings.css), of which only the page's options scroll. -->
    <div class="main-col">
      <div class="st-band">
        <!-- Narrow windows: the sidebar becomes this bar. -->
        <div class="topbar">
          <label :for="selectId" class="st-sr-only">{{ t.settings.app.pageSelect }}</label>
          <select
            :id="selectId"
            class="st-field page-select"
            :value="page"
            @change="onSelectChange"
          >
            <template v-for="g in pageGroups" :key="g.id">
              <template v-if="g.title === null">
                <option v-for="o in g.pages" :key="o.page" :value="o.page">{{ o.title }}</option>
              </template>
              <optgroup v-else :label="g.title">
                <option v-for="o in g.pages" :key="o.page" :value="o.page">{{ o.title }}</option>
              </optgroup>
            </template>
          </select>
          <StatusChip />
          <EditModeButton compact />
        </div>

        <div v-if="editMode" class="banner banner-actions banner-edit" role="status">
          <p class="banner-text edit-keys">
            <strong>{{ t.settings.app.editBanner.title }}</strong>
            <span v-for="k in t.settings.app.editBanner.keys" :key="k.key" class="edit-key">
              <kbd>{{ k.key }}</kbd> {{ k.text }}
            </span>
            <span class="edit-chip">{{ t.settings.app.editBanner.chip }}</span>
          </p>
          <button type="button" class="st-btn st-btn-sm" @click="exitEdit">
            {{ t.settings.app.editBanner.exit }}
          </button>
        </div>
        <OverlayHiddenNote />
        <p v-if="updateFailed" class="banner banner-error" role="alert">
          {{ t.settings.app.updateError }}
        </p>
        <div v-if="nativeMissing" class="banner banner-error banner-actions" role="alert">
          <p class="banner-text">{{ t.settings.app.nativeMissing }}</p>
          <button type="button" class="st-btn st-btn-sm" @click="copyDiagnostics">
            {{ t.settings.status.copy }}
          </button>
          <button type="button" class="st-btn st-btn-sm st-btn-ghost" @click="openLog">
            {{ t.settings.status.openLog }}
          </button>
        </div>
        <div v-if="saveFailing" class="banner banner-error banner-actions" role="alert">
          <p class="banner-text">{{ t.settings.app.saveError }}</p>
          <button type="button" class="st-btn st-btn-sm st-btn-ghost" @click="openLog">
            {{ t.settings.status.openLog }}
          </button>
        </div>
      </div>

      <main class="content">
        <div v-if="settings === null" class="st-band st-scroll loading">
          <p class="loading-text">{{ t.settings.app.loading }}</p>
          <SettingsFooter />
        </div>
        <AppearancePage v-else-if="page === 'appearance'"><SettingsFooter /></AppearancePage>
        <VisibilityPage v-else-if="page === 'visibility'"><SettingsFooter /></VisibilityPage>
        <ShortcutsPage v-else-if="page === 'shortcuts'"><SettingsFooter /></ShortcutsPage>
        <LayoutsPage v-else-if="page === 'layouts'"><SettingsFooter /></LayoutsPage>
        <WidgetPage v-else :key="page" :widget-id="page"><SettingsFooter /></WidgetPage>
      </main>

      <UndoToast />
    </div>
  </div>
</template>

<style scoped>
/* The window's height, never more: the page's options scroll inside it. */
.app {
  /* Sidebar, page padding, the widest page and the scrollbar's gutter. */
  --st-app-max: calc(212px + 2 * var(--st-page-pad) + var(--st-page-max) + 14px);

  display: grid;
  grid-template-rows: minmax(0, 1fr);
  grid-template-columns: 212px minmax(0, 1fr);
  height: 100%;
}

/* No side padding of its own: each band has it, beside the scrollbar's gutter. */
.main-col {
  /* The undo toast sits over its foot. */
  position: relative;
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  padding-top: 22px;
}

.topbar {
  display: none;
}

.banner {
  margin-bottom: 14px;
  padding: 9px 12px;
  border: 1px solid color-mix(in srgb, var(--ov-edit) 45%, transparent);
  border-radius: var(--st-radius);
  background: color-mix(in srgb, var(--ov-edit) 10%, var(--st-bg));
  font-size: 13px;
  line-height: 1.5;
}

/* A banner with buttons: the text, then them at its end (they wrap under it when narrow). */
.banner-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.banner-text {
  flex: 1 1 24em;
  min-width: 0;
}

/* Edit mode: its keys on one line, each a keycap and what it does. */
.edit-keys {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px 14px;
}

.edit-key {
  white-space: nowrap;
}

.edit-chip {
  color: var(--ov-fg-muted);
}

.banner-error {
  border-color: color-mix(in srgb, var(--ov-danger) 50%, transparent);
  background: color-mix(in srgb, var(--ov-danger) 10%, var(--st-bg));
  color: var(--ov-danger);
}

.content {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  min-height: 0;
}

.loading {
  display: flex;
  flex-direction: column;
}

.loading-text {
  flex: 1 0 auto;
  margin: 48px 0;
  color: var(--ov-fg-muted);
  text-align: center;
}

/*
 * Ultrawide (21:9, 32:9, triple screens as one): past 2200 px the sidebar and the page stay
 * together, centred, as wide as the two option columns need (settings.css --st-page-max), instead
 * of the sidebar at one edge and the page lines running across the screen.
 */
@media (min-width: 2200px) {
  .app {
    max-width: var(--st-app-max);
    margin-inline: auto;
    border-inline: 1px solid var(--st-border);
  }
}

@media (max-width: 639px) {
  .app {
    grid-template-columns: minmax(0, 1fr);
  }

  .side {
    display: none;
  }

  .main-col {
    padding-top: 0;
  }

  .topbar {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
    margin-bottom: 14px;
    padding: 10px 0;
    border-bottom: 1px solid var(--st-border);
    background: var(--st-bg);
  }

  .page-select {
    flex: 1 1 10em;
    min-width: 0;
    font-weight: 600;
  }
}
</style>
