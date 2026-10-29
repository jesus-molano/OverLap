<script setup lang="ts">
import { computed, provide, useId } from 'vue'
import { LOCALES, hiddenText, widgetTitle } from '@shared/i18n'
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
import { freeScalePercent } from '../freeScale'
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
 * wide window (settings.css: two option columns from 1380 px) they get the second column, beside
 * the content options; a page without editors spreads its options over both columns. Reference
 * sections (a legend, the saved records) follow the editors (PageAppendix moves them).
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

const { settings, autoHiddenOf } = useOverlayState()
const lang = useLanguage()
/** On, but a rule hides it now: why, in lower case ('oculto en práctica'), as the sidebar's eye. */
const held = computed(() => {
  const a = autoHiddenOf[props.widgetId].value
  if (!a.hidden) return null
  const caption = hiddenText(t.value, a.reason)
  return caption.charAt(0).toLocaleLowerCase(LOCALES[lang.value]) + caption.slice(1)
})
const bounds = computed(
  () => settings.value?.widgets[props.widgetId].bounds ?? def.value.defaultBounds
)
const subtitle = computed(() => {
  const w = t.value.settings.widgetPage
  if (def.value.sizeModel === 'free') {
    return w.sizeFree(
      size.value,
      formatPercent(t.value, freeScalePercent(bounds.value, def.value.defaultBounds))
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

    <div class="opts" :class="{ 'has-custom': hasCustom }">
      <div class="opts-main st-cols">
        <component :is="options" v-if="options" />
      </div>
      <div :id="customize.targetId" class="opts-custom" />
    </div>
    <div :id="customize.appendixId" class="opts-appendix" />
    <div class="opts-window st-cols">
      <WindowSection :widget-id="widgetId" />
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
  gap: 8px 20px;
  margin-bottom: 14px;
}

.page-titles {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.page-title {
  font-family: var(--ov-font-num);
  font-size: 22px;
  font-weight: var(--ov-w-strong);
  line-height: 1.2;
}

.page-sub {
  color: var(--ov-fg-muted);
  font-size: 12.5px;
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
  padding: 6px 0;
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
  font-size: 13px;
}

.stage {
  margin-bottom: 22px;
}

/* The editors: after the options in one column, the second column when the window is wide. */
.has-custom .opts-custom {
  margin-top: 26px;
}

@media (min-width: 1380px) {
  .opts.has-custom {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    align-items: start;
    gap: 0 var(--st-col-gap);
  }

  /* Its own column: no spreading of the options into two more. */
  .has-custom .opts-main {
    columns: auto;
  }

  .has-custom .opts-custom {
    margin-top: 0;
  }

  /* A column's top rule would sit above nothing: the column itself sets the group apart. */
  .has-custom .opts-custom :deep(.cz-head) {
    padding-top: 0;
    border-top: 0;
  }
}

/* Reference sections after the editors, over the whole width. */
.opts-appendix:not(:empty) {
  margin-top: 26px;
}

/* The window and its visibility rules close the options, over the whole width. */
.opts-window {
  margin-top: 26px;
}

/* "Restablecer…" beside "Visible", at the end of the title line. */
.reset {
  margin-left: auto;
  align-self: center;
}
</style>
