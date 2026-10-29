<script setup lang="ts">
import { computed, useId } from 'vue'
import { keycaps } from '@shared/i18n'
import { EXIT_EDIT_ACCELERATOR } from '@shared/shortcuts'
import { useI18n } from '../../composables/useI18n'
import { useOverlayState } from '../../composables/useOverlay'
import { useShortcuts } from '../../composables/useShortcuts'
import HelpText from '../controls/HelpText.vue'
import { resetShortcuts } from '../editor'
import ConfirmButton from '../layout/ConfirmButton.vue'
import Keycaps from '../layout/Keycaps.vue'
import PageFrame from '../layout/PageFrame.vue'
import PageSection from '../layout/PageSection.vue'
import ShortcutRow from '../layout/ShortcutRow.vue'
import { buttonBindingCount, shortcutRows } from '../shortcutsView'
import { useShortcutCapture, windowCaptureDeps } from '../useShortcutCapture'

/**
 * The global shortcuts (settings.shortcuts and settings.shortcutsMore): one row per action with
 * up to three bindings, each recorded by pressing the combination or a controller's button,
 * then the fixed Esc and how shortcuts behave over the game. Recording ends whenever this page
 * goes away (the capture's scope is the page's). No live preview: there is
 * nothing to draw.
 */
const t = useI18n()
const titleId = useId()
const shortcuts = useShortcuts()
const { settings, shortcutStatus } = useOverlayState()
const capture = useShortcutCapture(windowCaptureDeps())

/** The controllers' names: the saved ones, and those of the buttons just pressed here. */
const names = computed(() => ({
  ...settings.value?.buttonDeviceNames,
  ...capture.pressedNames.value
}))
const rows = computed(() =>
  shortcutRows(t.value, capture.bindings.value, shortcutStatus.value, names.value)
)
const escapeCaps = computed(() => keycaps(t.value, EXIT_EDIT_ACCELERATOR))

/**
 * The reset removes every button and every extra binding (none is a default): its description
 * and confirmation say so for the buttons.
 */
const buttonCount = computed(() => buttonBindingCount(shortcuts.value))
const resetDescription = computed(() => {
  const r = t.value.settings.shortcuts.resetAll
  return buttonCount.value > 0 ? r.descriptionButtons(buttonCount.value) : r.description
})
const resetConfirm = computed(() =>
  buttonCount.value > 0
    ? t.value.settings.shortcuts.resetAll.confirmButtons(buttonCount.value)
    : t.value.settings.confirm.reset
)
</script>

<template>
  <PageFrame :labelledby="titleId">
    <template #top>
      <header class="page-head">
        <h1 :id="titleId" class="page-title">{{ t.settings.nav.shortcuts }}</h1>
        <HelpText
          tag="p"
          class="page-sub"
          :text="t.settings.shortcuts.sub"
          :more="t.settings.shortcuts.subMore"
        />
      </header>
    </template>

    <!-- The actions, and the notes beside them in a wide window (settings.css .st-cols). -->
    <div class="st-cols">
      <PageSection :title="t.settings.shortcuts.section">
        <ShortcutRow
          v-for="row in rows"
          :key="row.action"
          :row="row"
          :capture="capture"
          :names="names"
        />
        <div class="st-row st-row-stack">
          <div class="st-row-text">
            <span class="st-label">{{ t.settings.shortcuts.escape.label }}</span>
            <span class="st-help">{{ t.settings.shortcuts.escape.help }}</span>
          </div>
          <div class="fixed">
            <span class="fixed-keys"><Keycaps :keys="escapeCaps" /></span>
            <span class="fixed-tag">{{ t.settings.shortcuts.escape.tag }}</span>
          </div>
        </div>
      </PageSection>

      <PageSection :title="t.settings.shortcuts.notes.title">
        <p class="st-row st-help note">{{ t.settings.shortcuts.notes.focus }}</p>
        <HelpText
          tag="p"
          class="st-row st-help note"
          :text="t.settings.shortcuts.notes.several"
          :more="t.settings.shortcuts.notes.severalMore"
        />
        <HelpText
          tag="p"
          class="st-row st-help note"
          :text="t.settings.shortcuts.notes.exclusive"
          :more="t.settings.shortcuts.notes.exclusiveMore"
        />
        <HelpText
          tag="p"
          class="st-row st-help note"
          :text="t.settings.shortcuts.notes.buttons"
          :more="t.settings.shortcuts.notes.buttonsMore"
        />
        <p class="st-row st-help note">{{ t.settings.shortcuts.notes.buttonBox }}</p>
      </PageSection>
    </div>

    <footer class="page-foot">
      <ConfirmButton
        :label="t.settings.shortcuts.resetAll.label"
        :confirm-label="resetConfirm"
        :description="resetDescription"
        :action="resetShortcuts"
      />
    </footer>

    <template #foot>
      <slot />
    </template>
  </PageFrame>
</template>

<style scoped>
.page-head {
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin-bottom: 14px;
}

.page-title {
  font-family: var(--ov-font-num);
  font-size: 22px;
  font-weight: var(--ov-w-strong);
  line-height: 1.2;
}

.page-sub {
  max-width: 46em;
  color: var(--ov-fg-muted);
  font-size: 12.5px;
}

.fixed {
  display: flex;
  align-items: center;
  gap: 10px;
}

/* The same well as a configurable row's keys (ShortcutRow), without a field's fill: fixed. */
.fixed-keys {
  display: inline-flex;
  align-items: center;
  min-width: 15em;
  min-height: 34px;
  padding: 3px 8px;
  border: 1px solid var(--st-border);
  border-radius: var(--st-radius-sm);
}

.fixed-tag {
  color: var(--ov-fg-dim);
  font-family: var(--ov-font-small);
  font-size: 11px;
  font-weight: var(--ov-w-strong);
  letter-spacing: var(--ov-track-caps);
  text-transform: uppercase;
}

/* Prose in the card: the help colour, at reading size. */
.note {
  display: block;
  font-size: 12.5px;
  line-height: 1.5;
}

.page-foot {
  display: flex;
  justify-content: flex-end;
  margin-top: 24px;
  padding-top: 16px;
  border-top: 1px solid var(--st-border);
}
</style>
