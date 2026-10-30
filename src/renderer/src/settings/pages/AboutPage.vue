<script setup lang="ts">
import { computed, onMounted, shallowRef, useId, watch } from 'vue'
import { useI18n } from '../../composables/useI18n'
import HelpText from '../controls/HelpText.vue'
import { sendCommand, updateSettings } from '../editor'
import ConfirmButton from '../layout/ConfirmButton.vue'
import NavIcon from '../layout/NavIcon.vue'
import PageFrame from '../layout/PageFrame.vue'
import PageSection from '../layout/PageSection.vue'
import { useLayoutState } from '../layoutsView'
import { pageTitle, type SettingsPage } from '../nav'
import { useNavigate } from '../navigate'
import { offerRestore } from '../undo/restore'

/**
 * «Acerca de y ayuda» (R40): the version and the guide, quick help that leads to the page that
 * answers each question, a backup of everything (every setting and the personal bests to one
 * file and back), the settings folder, the log and the diagnostics, the welcome again and
 * «Restablecer todo». Main runs the commands; an import and a reset come with «Deshacer», as
 * main keeps it (the tray has it too).
 */
const t = useI18n()
const titleId = useId()
const navigate = useNavigate()
const { layoutNotice } = useLayoutState()

const version = shallowRef('')
onMounted(() => {
  void window.overlay.getInitialState().then((init) => (version.value = init.appVersion ?? ''))
})

/** Each question, and the page that answers it. */
const HELP: readonly {
  key: 'visibility' | 'edit' | 'search' | 'layouts'
  page: SettingsPage | null
}[] = [
  { key: 'visibility', page: 'visibility' },
  { key: 'edit', page: null },
  { key: 'search', page: null },
  { key: 'layouts', page: 'layouts' }
]
const helpRows = computed(() =>
  HELP.map((h) => ({
    ...h,
    ...t.value.settings.about.help.items[h.key],
    go: h.page === null ? null : t.value.settings.about.help.go(pageTitle(t.value, h.page))
  }))
)

/** What the last backup command did, under its buttons. */
const backupText = computed(() => {
  const n = layoutNotice.value
  const b = t.value.settings.about.backup
  if (n === null) return null
  switch (n.kind) {
    case 'backup-exported':
      return { text: b.exported(n.file), error: false }
    case 'backup-export-failed':
      return { text: b.exportFailed, error: true }
    case 'backup-imported':
      return { text: n.bests ? b.importedBests : b.imported, error: false }
    case 'backup-import-failed':
      return { text: b.errors[n.error], error: true }
    default:
      return null
  }
})
const resetText = computed(() =>
  layoutNotice.value?.kind === 'reset-all' ? t.value.settings.about.reset.done : null
)

// Main keeps what «Deshacer» undoes (the settings as they were): offered here as every undo is.
watch(layoutNotice, (n) => {
  if (n === null || (n.kind !== 'backup-imported' && n.kind !== 'reset-all') || n.undo === null) {
    return
  }
  const id = n.undo
  const reset = n.kind === 'reset-all'
  offerRestore(
    (m) => (reset ? m.settings.about.reset.undo : m.settings.about.backup.undoImport),
    () => sendCommand({ type: 'undo-notice', id })
  )
})

const help = (page: 'guide' | 'issues'): void => sendCommand({ type: 'open-help', page })
const showWelcome = (): Promise<void> => updateSettings({ settingsWindow: { welcome: true } })
</script>

<template>
  <PageFrame :labelledby="titleId">
    <template #top>
      <header class="page-head">
        <div class="page-titles">
          <h1 :id="titleId" class="page-title">{{ t.settings.nav.about }}</h1>
          <p class="page-sub">{{ t.settings.about.sub }}</p>
        </div>
      </header>
    </template>

    <div class="st-cols">
      <PageSection :title="t.settings.about.app.title">
        <div class="st-row st-row-wrap">
          <div class="st-row-text">
            <span class="st-label ab-version">{{ t.settings.about.app.version(version) }}</span>
            <span class="st-help">{{ t.settings.about.app.versionHelp }}</span>
          </div>
        </div>
        <div class="st-row st-row-wrap">
          <span class="st-help">{{ t.settings.about.app.external }}</span>
          <div class="ab-buttons">
            <button type="button" class="st-btn" @click="help('guide')">
              {{ t.settings.about.app.guide }}
            </button>
            <button type="button" class="st-btn st-btn-ghost" @click="help('issues')">
              {{ t.settings.about.app.issues }}
            </button>
          </div>
        </div>
      </PageSection>

      <PageSection :title="t.settings.about.help.title">
        <div v-for="h in helpRows" :key="h.key" class="st-row st-row-wrap">
          <div class="st-row-text">
            <span class="st-label">{{ h.q }}</span>
            <span class="st-help">{{ h.a }}</span>
          </div>
          <button
            v-if="h.page !== null && h.go !== null"
            type="button"
            class="st-btn st-btn-sm st-btn-ghost ab-go"
            @click="navigate(h.page)"
          >
            <NavIcon :page="h.page" />
            <span>{{ h.go }}</span>
          </button>
        </div>
      </PageSection>

      <PageSection :title="t.settings.about.backup.title">
        <div class="st-row st-row-wrap">
          <div class="st-row-text">
            <span class="st-label">{{ t.settings.about.backup.exportLabel }}</span>
            <HelpText class="st-help" :text="t.settings.about.backup.exportHelp" />
          </div>
          <button type="button" class="st-btn" @click="sendCommand({ type: 'backup-export' })">
            {{ t.settings.about.backup.export }}
          </button>
        </div>
        <div class="st-row st-row-wrap">
          <div class="st-row-text">
            <span class="st-label">{{ t.settings.about.backup.importLabel }}</span>
            <HelpText class="st-help" :text="t.settings.about.backup.importHelp" />
          </div>
          <button type="button" class="st-btn" @click="sendCommand({ type: 'backup-import' })">
            {{ t.settings.about.backup.import }}
          </button>
        </div>
        <p
          v-if="backupText"
          class="st-row st-help"
          :class="{ 'st-help-warn': backupText.error }"
          role="status"
        >
          {{ backupText.text }}
        </p>
      </PageSection>

      <PageSection :title="t.settings.about.files.title">
        <div class="st-row st-row-wrap">
          <div class="st-row-text">
            <span class="st-label">{{ t.settings.about.files.folderLabel }}</span>
            <span class="st-help">{{ t.settings.about.files.folderHelp }}</span>
          </div>
          <div class="ab-buttons">
            <button
              type="button"
              class="st-btn"
              @click="sendCommand({ type: 'open-settings-folder' })"
            >
              {{ t.settings.about.files.folder }}
            </button>
            <button
              type="button"
              class="st-btn st-btn-ghost"
              @click="sendCommand({ type: 'open-log' })"
            >
              {{ t.settings.about.files.log }}
            </button>
          </div>
        </div>
        <div class="st-row st-row-wrap">
          <div class="st-row-text">
            <span class="st-label">{{ t.settings.about.files.diagnosticsLabel }}</span>
            <span class="st-help">{{ t.settings.about.files.diagnosticsHelp }}</span>
          </div>
          <button type="button" class="st-btn" @click="sendCommand({ type: 'copy-diagnostics' })">
            {{ t.settings.about.files.diagnostics }}
          </button>
        </div>
      </PageSection>

      <PageSection :title="t.settings.about.restart.title">
        <div class="st-row st-row-wrap">
          <div class="st-row-text">
            <span class="st-label">{{ t.settings.about.restart.welcomeLabel }}</span>
            <span class="st-help">{{ t.settings.about.restart.welcomeHelp }}</span>
          </div>
          <button type="button" class="st-btn" @click="showWelcome">
            {{ t.settings.about.restart.welcome }}
          </button>
        </div>
        <div class="st-row st-row-wrap">
          <div class="st-row-text">
            <span class="st-label">{{ t.settings.about.reset.rowLabel }}</span>
            <span class="st-help">{{ t.settings.about.reset.help }}</span>
          </div>
          <ConfirmButton
            :label="t.settings.about.reset.label"
            :confirm-label="t.settings.about.reset.confirm"
            :description="t.settings.about.reset.description"
            :action="() => sendCommand({ type: 'reset-all' })"
          />
        </div>
        <p v-if="resetText" class="st-row st-help" role="status">{{ resetText }}</p>
      </PageSection>
    </div>

    <template #foot>
      <slot />
    </template>
  </PageFrame>
</template>

<style scoped>
.page-head {
  margin-bottom: 16px;
}

.page-titles {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.page-title {
  font-family: var(--ov-font-num);
  font-size: var(--st-t-page);
  font-weight: var(--ov-w-strong);
  line-height: 1.2;
}

.page-sub {
  color: var(--ov-fg-muted);
  font-size: var(--st-t-help);
}

.ab-version {
  font-variant-numeric: tabular-nums;
}

.ab-buttons {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.ab-go {
  gap: 8px;
}
</style>
