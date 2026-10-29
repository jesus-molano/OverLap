<script setup lang="ts">
import './settings.css'
import { computed, shallowRef, useId } from 'vue'
import { useI18n, useLanguage } from '../composables/useI18n'
import { useOverlayState } from '../composables/useOverlay'
import StatusChip from './StatusChip.vue'
import { updateFailed } from './editor'
import EditModeButton from './layout/EditModeButton.vue'
import OverlayHiddenNote from './layout/OverlayHiddenNote.vue'
import SettingsFooter from './layout/SettingsFooter.vue'
import SettingsSidebar from './layout/SettingsSidebar.vue'
import {
  SETTINGS_PAGES,
  browserStorage,
  isSettingsPage,
  loadPage,
  pageTitle,
  savePage,
  type SettingsPage
} from './nav'
import AppearancePage from './pages/AppearancePage.vue'
import ShortcutsPage from './pages/ShortcutsPage.vue'
import WidgetPage from './pages/WidgetPage.vue'

// Main is the source of truth: these follow its broadcasts (and the replies to our updates).
const { editMode, settings } = useOverlayState()
const t = useI18n()
const lang = useLanguage()

const storage = browserStorage()
const page = shallowRef<SettingsPage>(loadPage(storage))
const selectId = useId()
const pageOptions = computed(() =>
  SETTINGS_PAGES.map((p) => ({ page: p, title: pageTitle(t.value, p) }))
)

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
            <option v-for="o in pageOptions" :key="o.page" :value="o.page">{{ o.title }}</option>
          </select>
          <StatusChip />
          <EditModeButton compact />
        </div>

        <p v-if="editMode" class="banner" role="status">
          {{ t.settings.app.editBanner.before }} <kbd>Alt</kbd>
          {{ t.settings.app.editBanner.after }}
        </p>
        <OverlayHiddenNote />
        <p v-if="updateFailed" class="banner banner-error" role="alert">
          {{ t.settings.app.updateError }}
        </p>
      </div>

      <main class="content">
        <div v-if="settings === null" class="st-band st-scroll loading">
          <p class="loading-text">{{ t.settings.app.loading }}</p>
          <SettingsFooter />
        </div>
        <AppearancePage v-else-if="page === 'appearance'"><SettingsFooter /></AppearancePage>
        <ShortcutsPage v-else-if="page === 'shortcuts'"><SettingsFooter /></ShortcutsPage>
        <WidgetPage v-else :key="page" :widget-id="page"><SettingsFooter /></WidgetPage>
      </main>
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
