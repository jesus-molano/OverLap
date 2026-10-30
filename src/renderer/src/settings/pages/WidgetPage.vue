<script setup lang="ts">
import { computed, provide, useId } from 'vue'
import { widgetTitle } from '@shared/i18n'
import { WIDGET_DEFS, type WidgetId } from '@shared/widgets'
import { useI18n, useLanguage } from '../../composables/useI18n'
import Icon from '../../ui/Icon.vue'
import { useWidgetSettings } from '../../composables/useWidgetSettings'
import { hasOptionPart, type OptionPart } from '@shared/settings'
import {
  WIDGET_PAGE,
  resetBounds,
  resetWidget,
  resetWidgetAll,
  setWidgetVisible
} from '../undo/restore'
import type { ResetItem } from '../layout/resetItems'
import ResetMenu from '../layout/ResetMenu.vue'
import { provideCustomizeHost } from '../layout/customize'
import OptionsTarget from '../layout/OptionsTarget.vue'
import PageFrame from '../layout/PageFrame.vue'
import SampleStage from '../layout/SampleStage.vue'
import { WIDGET_OPTIONS } from '../options'
import PreviewHint from '../preview/PreviewHint.vue'
import { providePreviewEdit } from '../preview/usePreviewEdit'
import WidgetSample from '../samples/WidgetSample.vue'
import { useSampleWidth, useWidgetSizeText } from '../samples/useSampleWidth'
import ToggleControl from '../controls/ToggleControl.vue'
import { formatPercent } from '../values'
import { sendCommand } from '../editor'
import { freeScalePercent } from '../freeScale'
import { heldCaption } from '../statusSummary'
import { useOverlayState } from '../../composables/useOverlay'
import WindowSection from './WindowSection.vue'

/**
 * One widget's page: the live preview (fixed), then, in what scrolls, the same order on every
 * page: where its changes are kept (OptionsTarget), what the widget shows ("Contenido"), the
 * "Personalizar" editors, the reference sections and "Ventana y visibilidad". The resets are a
 * "Restablecer…" menu at the top, beside "Visible", and an icon in each section's head (R24).
 * Keyed by the id. The default slot closes the scrolling part (the window's foot).
 *
 * The editors are the options component's (CustomizeSection moves them into .opts-custom). In a
 * wide window (settings.css: two option columns from 1100 px) they get the second column, and the
 * first stacks the content options, the reference sections and «Ventana y visibilidad», each
 * column as tall as its own content (R14): the same order as one column, the window's rules last
 * in both; a page without editors spreads its options over both columns. Reference sections (a
 * legend, the saved records) follow the editors (PageAppendix moves them).
 * The live sample is editable in place for the page's element lists (settings/preview).
 */
const props = defineProps<{ widgetId: WidgetId }>()

const t = useI18n()
const def = computed(() => WIDGET_DEFS[props.widgetId])
const title = computed(() => widgetTitle(t.value, props.widgetId))
const titleId = useId()
const customize = provideCustomizeHost(useId())
// The sample edits the page's element lists in place (its editors join it).
providePreviewEdit(props.widgetId)
const hasCustom = computed(() => customize.count.value > 0)
const prefs = useWidgetSettings(props.widgetId)
const width = useSampleWidth(props.widgetId)
const size = useWidgetSizeText(props.widgetId)
/** Hiding it offers "Deshacer" (R11). */
const setVisible = (on: boolean): Promise<void> => setWidgetVisible(props.widgetId, on)
// Its sections' reset icons (PageSection) reset this widget.
provide(WIDGET_PAGE, props.widgetId)

const { settings, autoHiddenOf, overlayHidden, editMode } = useOverlayState()

/** «Editar posición» (R25): edit mode, this widget pointed out over the game (again if on). */
function editPosition(): void {
  sendCommand({ type: 'set-edit-mode', on: true, focus: props.widgetId })
}
const lang = useLanguage()
/** On, but not showing now (overlay hidden by you, or a rule): why, as the sidebar's eye says. */
const held = computed(() =>
  heldCaption(t.value, lang.value, overlayHidden.value, autoHiddenOf[props.widgetId].value)
)
const bounds = computed(
  () => settings.value?.widgets[props.widgetId].bounds ?? def.value.defaultBounds
)
const subtitle = computed(() => {
  const w = t.value.settings.widgetPage
  if (def.value.sizeModel === 'free') {
    return w.sizeFree(
      size.value,
      formatPercent(
        t.value,
        freeScalePercent(
          bounds.value,
          def.value.defaultBounds,
          settings.value?.appearance.fontScale
        )
      )
    )
  }
  const scale = formatPercent(t.value, prefs.value.scale)
  return prefs.value.autoHeight ? w.sizeAuto(width.value, scale) : w.sizeFixed(size.value, scale)
})
const options = computed(() => WIDGET_OPTIONS[props.widgetId])

/**
 * "Restablecer…": each section of the page that the widget has, in the page's order, then its
 * position and everything at once. The same resets as the ↺ in the sections' heads.
 */
const resetItems = computed<ResetItem[]>(() => {
  const r = t.value.settings.widgetPage.reset
  const id = props.widgetId
  const parts: OptionPart[] = ['content', 'driver', 'customize']
  const items: ResetItem[] = parts
    .filter((p) => hasOptionPart(id, p))
    .map((p) => ({ id: p, ...r[p], run: () => resetWidget(id, p) }))
  items.push(
    { id: 'window', ...r.window, run: () => resetWidget(id, 'window') },
    { id: 'bounds', ...r.bounds, run: () => resetBounds(id) },
    { id: 'all', ...r.all, run: () => resetWidgetAll(id) }
  )
  return items
})
</script>

<template>
  <PageFrame :labelledby="titleId">
    <template #top>
      <header class="page-head">
        <div class="page-titles">
          <h1 :id="titleId" class="page-title">{{ title }}</h1>
          <p class="page-sub">{{ subtitle }}</p>
        </div>
        <ResetMenu
          :label="t.settings.widgetPage.reset.menuLabel(title)"
          :items="resetItems"
          class="reset"
        />
        <button
          type="button"
          class="st-btn edit-pos"
          :class="{ 'is-on': editMode }"
          :title="t.settings.widgetPage.editPositionHelp(title)"
          @click="editPosition"
        >
          <span class="edit-dot" aria-hidden="true" />
          {{ t.settings.widgetPage.editPosition }}
        </button>
        <div class="visible-toggle">
          <ToggleControl
            kind="switch"
            :label="t.settings.widgetPage.visible"
            :current="prefs.visible"
            :apply="setVisible"
          />
        </div>
      </header>

      <p v-if="!prefs.visible" class="hidden-note" role="status">
        <Icon name="eye-off" class="note-eye" />
        {{ t.settings.widgetPage.hiddenNote }}
      </p>
      <p v-else-if="held" class="hidden-note" role="status">
        <Icon name="eye" class="note-eye" />
        {{ t.settings.widgetPage.heldNote(held) }}
      </p>

      <PreviewHint />
      <SampleStage class="stage">
        <WidgetSample :widget-id="widgetId" />
      </SampleStage>
    </template>

    <OptionsTarget :widget-id="widgetId" />

    <!--
      One column: Contenido, Personalizar, the reference sections, Ventana y visibilidad (R04).
      Two (settings.css, from 1100 px): Contenido, then the reference sections and Ventana y
      visibilidad down the left (the same order), Personalizar down the right, each column as
      tall as its own (R14); a page without editors spreads its sections over both.
    -->
    <div class="opts" :class="hasCustom ? 'has-custom' : 'st-cols'">
      <div class="opts-main">
        <component :is="options" v-if="options" />
      </div>
      <div :id="customize.targetId" class="opts-custom" />
      <div :id="customize.appendixId" class="opts-appendix" />
      <div class="opts-window">
        <WindowSection :widget-id="widgetId" />
      </div>
    </div>

    <template #foot>
      <slot />
    </template>
  </PageFrame>
</template>

<style scoped>
.page-head {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  justify-content: space-between;
  gap: 8px 24px;
  margin-bottom: 16px;
}

.page-titles {
  display: flex;
  flex-direction: column;
  gap: 2px;
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
  font-size: var(--st-t-ui);
}

.visible-toggle {
  flex: none;
  min-width: 132px;
  padding: 0 12px;
  border: 1px solid var(--st-border);
  border-radius: var(--st-radius);
  background: var(--st-surface);
  box-shadow: var(--st-lit);
}

.visible-toggle :deep(.st-row) {
  padding: 8px 0;
}

.hidden-note {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
  padding: 8px 12px;
  border: 1px solid var(--st-border-hi);
  border-radius: var(--st-radius);
  background: var(--st-surface);
  color: var(--ov-fg-muted);
  font-size: var(--st-t-ui);
}

.stage {
  margin-bottom: 24px;
}

/* One column: the editors after the options, then the reference sections and the window. */
.has-custom .opts-custom,
.opts-appendix:not(:empty),
.opts-window {
  margin-top: 24px;
}

/*
 * Two columns (R14): Personalizar down the right, spanning every row; the left stacks Contenido,
 * the reference sections and Ventana y visibilidad (the one-column order), sized by their own
 * content (the last row takes what Personalizar has more), so no gap opens under Contenido.
 */
@media (min-width: 1100px) {
  .opts.has-custom {
    display: grid;
    grid-template-rows: auto auto auto 1fr;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    align-items: start;
    gap: 0 var(--st-col-gap);
  }

  .has-custom .opts-main {
    grid-area: 1 / 1;
  }

  .has-custom .opts-appendix {
    grid-area: 2 / 1;
  }

  .has-custom .opts-window {
    grid-area: 3 / 1;
  }

  .has-custom .opts-custom {
    grid-area: 1 / 2 / -1 / 3;
    margin-top: 0;
  }

  /* A column's top rule would sit above nothing: the column itself sets the group apart. */
  .has-custom .opts-custom :deep(.cz-head) {
    padding-top: 0;
    border-top: 0;
  }
}

/* "Restablecer…" and «Editar posición» beside "Visible", at the end of the title line. */
.reset {
  margin-left: auto;
  align-self: center;
}

.edit-pos {
  align-self: center;
  min-height: 34px;
}

/* The same mark as the sidebar's «Modo edición»: filled with the edit colour while editing. */
.edit-dot {
  flex: none;
  width: 8px;
  height: 8px;
  border: 1.5px solid var(--ov-fg-muted);
  border-radius: 50%;
}

.edit-pos.is-on {
  border-color: var(--ov-edit);
}

.edit-pos.is-on .edit-dot {
  border-color: var(--ov-edit);
  background: var(--ov-edit);
}
</style>
