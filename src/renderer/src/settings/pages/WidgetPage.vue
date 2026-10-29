<script setup lang="ts">
import { computed, useId } from 'vue'
import { widgetTitle } from '@shared/i18n'
import { WIDGET_DEFS, type WidgetId } from '@shared/widgets'
import { useI18n } from '../../composables/useI18n'
import { useWidgetSettings } from '../../composables/useWidgetSettings'
import { resetWidgetBounds, resetWidgetOptions, widgetSetter } from '../editor'
import ConfirmButton from '../layout/ConfirmButton.vue'
import { provideCustomizeHost } from '../layout/customize'
import OptionsTarget from '../layout/OptionsTarget.vue'
import PageFrame from '../layout/PageFrame.vue'
import SampleStage from '../layout/SampleStage.vue'
import { WIDGET_OPTIONS } from '../options'
import WidgetSample from '../samples/WidgetSample.vue'
import { useSampleWidth, useWidgetSizeText } from '../samples/useSampleWidth'
import ToggleControl from '../controls/ToggleControl.vue'
import { formatPercent } from '../values'
import WindowSection from './WindowSection.vue'

/**
 * One widget's page: the live preview (fixed), then where its changes are kept (OptionsTarget,
 * first of what scrolls, so a small window keeps room for the options), the window and content
 * options, the "Personalizar" editors and the resets (they scroll).
 * Keyed by the id. The default slot closes the scrolling part (the window's foot).
 *
 * The editors are the options component's (CustomizeSection moves them into .opts-custom). In a
 * wide window (settings.css: two option columns from 1380 px) they get the second column, beside
 * the window and content options; a page without editors spreads its options over both columns.
 * Reference sections (a legend, the saved records) follow the editors (PageAppendix moves them).
 */
const props = defineProps<{ widgetId: WidgetId }>()

const t = useI18n()
const def = computed(() => WIDGET_DEFS[props.widgetId])
const title = computed(() => widgetTitle(t.value, props.widgetId))
const titleId = useId()
const customize = provideCustomizeHost(useId())
const hasCustom = computed(() => customize.count.value > 0)
const prefs = useWidgetSettings(props.widgetId)
const width = useSampleWidth(props.widgetId)
const size = useWidgetSizeText(props.widgetId)
const setVisible = widgetSetter(props.widgetId)('visible')
const resetOptions = (): void => resetWidgetOptions(props.widgetId)
const resetBounds = (): void => resetWidgetBounds(props.widgetId)

const subtitle = computed(() => {
  const w = t.value.settings.widgetPage
  if (def.value.sizeModel === 'free') return w.sizeFree(size.value)
  const scale = formatPercent(t.value, prefs.value.scale)
  return prefs.value.autoHeight ? w.sizeAuto(width.value, scale) : w.sizeFixed(size.value, scale)
})
const options = computed(() => WIDGET_OPTIONS[props.widgetId])
</script>

<template>
  <PageFrame :labelledby="titleId">
    <template #top>
      <header class="page-head">
        <div class="page-titles">
          <h1 :id="titleId" class="page-title">{{ title }}</h1>
          <p class="page-sub">{{ subtitle }}</p>
        </div>
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
        {{ t.settings.widgetPage.hiddenNote }}
      </p>

      <SampleStage class="stage">
        <WidgetSample :widget-id="widgetId" />
      </SampleStage>
    </template>

    <OptionsTarget :widget-id="widgetId" />

    <div class="opts" :class="{ 'has-custom': hasCustom }">
      <div class="opts-main st-cols">
        <WindowSection :widget-id="widgetId" />
        <component :is="options" v-if="options" />
      </div>
      <div :id="customize.targetId" class="opts-custom" />
    </div>
    <div :id="customize.appendixId" class="opts-appendix" />

    <footer class="page-foot">
      <ConfirmButton
        :label="t.settings.widgetPage.resetOptions.label"
        :confirm-label="t.settings.confirm.reset"
        :description="t.settings.widgetPage.resetOptions.description"
        :action="resetOptions"
      />
      <ConfirmButton
        :label="t.settings.widgetPage.resetBounds.label"
        :confirm-label="t.settings.widgetPage.resetBounds.confirm"
        :description="t.settings.widgetPage.resetBounds.description"
        :action="resetBounds"
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

.page-foot {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 24px;
  padding-top: 16px;
  border-top: 1px solid var(--st-border);
}
</style>
