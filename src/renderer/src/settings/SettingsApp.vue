<script setup lang="ts">
import './settings.css'
import { computed, shallowRef, useId } from 'vue'
import { useI18n, useLanguage } from '../composables/useI18n'
import { useOverlayState } from '../composables/useOverlay'
import StatusChip from './StatusChip.vue'
import { sendCommand, updateFailed } from './editor'
import EditModeButton from './layout/EditModeButton.vue'
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

function select(next: SettingsPage): void {
  if (next === page.value) return
  page.value = next
  savePage(storage, next)
  window.scrollTo({ top: 0 })
}

function onSelectChange(e: Event): void {
  const v = e.target instanceof HTMLSelectElement ? e.target.value : null
  if (isSettingsPage(v)) select(v)
}

function openSettingsFolder(): void {
  sendCommand({ type: 'open-settings-folder' })
}
</script>

<template>
  <div class="app" :lang="lang">
    <SettingsSidebar class="side" :page="page" @select="select" />

    <div class="main-col">
      <!-- Narrow windows: the sidebar becomes this bar. -->
      <div class="topbar">
        <label :for="selectId" class="st-sr-only">{{ t.settings.app.pageSelect }}</label>
        <select :id="selectId" class="st-field page-select" :value="page" @change="onSelectChange">
          <option v-for="o in pageOptions" :key="o.page" :value="o.page">{{ o.title }}</option>
        </select>
        <StatusChip />
        <EditModeButton compact />
      </div>

      <p v-if="editMode" class="banner" role="status">
        {{ t.settings.app.editBanner.before }} <kbd>Alt</kbd>
        {{ t.settings.app.editBanner.after }}
      </p>
      <p v-if="updateFailed" class="banner banner-error" role="alert">
        {{ t.settings.app.updateError }}
      </p>

      <main class="content">
        <p v-if="settings === null" class="loading">{{ t.settings.app.loading }}</p>
        <AppearancePage v-else-if="page === 'appearance'" />
        <WidgetPage v-else :key="page" :widget-id="page" />
      </main>

      <footer class="foot">
        <p class="foot-note">{{ t.settings.app.footNote }}</p>
        <button
          type="button"
          class="st-btn st-btn-ghost st-btn-sm narrow-only"
          @click="openSettingsFolder"
        >
          {{ t.settings.app.openFolder }}
        </button>
      </footer>
    </div>
  </div>
</template>

<style scoped>
.app {
  display: grid;
  grid-template-columns: 212px minmax(0, 1fr);
  min-height: 100vh;
}

.main-col {
  display: flex;
  flex-direction: column;
  min-width: 0;
  padding: 22px 28px 20px;
}

.main-col > * {
  width: 100%;
  max-width: 780px;
}

.topbar {
  display: none;
}

.banner {
  margin-bottom: 14px;
  padding: 9px 12px;
  border: 1px solid color-mix(in srgb, var(--ov-edit) 45%, transparent);
  border-radius: 8px;
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
  flex: 1 0 auto;
}

.loading {
  margin: 48px 0;
  color: var(--ov-fg-muted);
  text-align: center;
}

.foot {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 8px 16px;
  margin-top: 20px;
}

.foot-note {
  color: var(--ov-fg-dim);
  font-size: 12px;
}

.foot .narrow-only {
  display: none;
}

@media (max-width: 639px) {
  .app {
    grid-template-columns: minmax(0, 1fr);
  }

  .side {
    display: none;
  }

  .main-col {
    padding: 0 16px 16px;
  }

  .topbar {
    position: sticky;
    top: 0;
    z-index: 1;
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

  .foot .narrow-only {
    display: inline-flex;
  }
}
</style>
