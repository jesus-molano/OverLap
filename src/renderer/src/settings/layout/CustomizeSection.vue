<script setup lang="ts">
import Icon from '../../ui/Icon.vue'
import { computed, inject, onBeforeUnmount, onMounted, useId } from 'vue'
import { widgetTitle } from '@shared/i18n'
import { useI18n } from '../../composables/useI18n'
import { WIDGET_PAGE, resetWidget } from '../undo/restore'
import ResetIcon from './ResetIcon.vue'
import { injectCustomizeHost } from './customize'
import { isZoneOpen, pageIntro, provideZoneRegistry, setZonesOpen } from './zonesOpen'

/**
 * "Personalizar": a widget page's element editors (ElementEditor, one per zone, in the order of
 * customizeZones), each an accordion. A page's options component puts them here after its
 * "Contenido":
 *
 *   <PageSection :title="t.settings.common.content">…</PageSection>
 *   <CustomizeSection>
 *     <ElementEditor … />
 *   </CustomizeSection>
 *
 * On a widget page they move to the page's own place for them (WidgetPage: below the options,
 * or a column of their own in a wide window); anywhere else they stay where they are. The
 * editors join its registry, so one button opens them all («Expandir todo») while one is closed,
 * and closes them all («Contraer todo») once every one is open (R47: never a dimmed button).
 * The heading says once how the lists are edited (dragging, ↑ ↓, the sides of the info bars, the
 * eye), for the zones the page has (pageIntro); the lists themselves no longer repeat it. On a
 * widget page its ↺ resets every list and what goes with them (R24), as its "Restablecer…" item.
 */
const t = useI18n()
const host = injectCustomizeHost()
const titleId = useId()
const registry = provideZoneRegistry()
const widget = inject(WIDGET_PAGE, null)
const resetLabel = computed(() => {
  if (widget === null) return null
  const r = t.value.settings.widgetPage.reset
  return r.sectionLabel(r.customize.label, widgetTitle(t.value, widget))
})
function onReset(): void {
  if (widget !== null) resetWidget(widget, 'customize')
}

const intro = computed(() => pageIntro(registry.zones.value))
const anyClosed = computed(() => registry.zones.value.some((z) => !isZoneOpen(z)))
// One button that always does something: it keeps the focus as its label turns over.
const toggleAll = (): void => {
  void setZonesOpen(registry.zones.value, anyClosed.value)
}

onMounted(() => {
  if (host) host.count.value += 1
})
onBeforeUnmount(() => {
  if (host) host.count.value -= 1
})
</script>

<template>
  <!-- Deferred: the host's element is the page's, mounted after its options. -->
  <Teleport defer :to="host ? `#${host.targetId}` : 'body'" :disabled="host === null">
    <section class="cz" :aria-labelledby="titleId">
      <header class="cz-head">
        <h2 :id="titleId" class="cz-title">{{ t.settings.common.customize }}</h2>
        <!-- The page's one drag and eye explanation (each list keeps it for screen readers). -->
        <p class="cz-note">
          <template v-if="intro === 'sides'">
            {{ t.settings.elements.introSides.before }}
            <Icon name="grip" class="cz-glyph" />
            {{ t.settings.elements.introSides.use }}
            <Icon name="step-up" class="cz-glyph" /><Icon name="step-down" class="cz-glyph" />
            {{ t.settings.elements.introSides.middle }}
            <Icon name="swap-h" class="cz-glyph" />
            {{ t.settings.elements.introSides.after }}
          </template>
          <template v-else-if="intro === 'sortable'">
            {{ t.settings.elements.intro.before }}
            <Icon name="grip" class="cz-glyph" />
            {{ t.settings.elements.intro.use }}
            <Icon name="step-up" class="cz-glyph" /><Icon name="step-down" class="cz-glyph" />
            {{ t.settings.elements.intro.after }}
          </template>
          <template v-else>{{ t.settings.elements.introFixed }}</template>
        </p>
        <span v-if="registry.zones.value.length > 1" class="cz-all">
          <button type="button" class="st-btn st-btn-sm st-btn-ghost" @click="toggleAll">
            {{ anyClosed ? t.settings.common.expandAll : t.settings.common.collapseAll }}
          </button>
        </span>
        <ResetIcon v-if="resetLabel" class="cz-reset" :label="resetLabel" @reset="onReset" />
      </header>
      <div class="cz-body">
        <slot />
      </div>
    </section>
  </Teleport>
</template>

<style scoped>
/* A group above the zones' own captions: a rule, a title in the Display face, a short note. */
.cz {
  min-width: 0;
}

.cz-head {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 2px 12px;
  margin-bottom: 16px;
  padding-top: 12px;
  border-top: 1px solid var(--st-border-hi);
}

.cz-title {
  font-family: var(--ov-font-num);
  font-size: var(--st-t-body);
  font-weight: var(--ov-w-strong);
  letter-spacing: 0.01em;
}

.cz-note {
  color: var(--ov-fg-dim);
  font-size: var(--st-t-help);
}

/* Every accordion at once, at the far end of the heading. */
.cz-all {
  display: inline-flex;
  gap: 2px;
  margin-left: auto;
  align-self: center;
}

/* Its ↺ at the very end, after "Expandir todo" when there is one. */
.cz-reset {
  margin-left: auto;
  align-self: center;
}

.cz-all + .cz-reset {
  margin-left: 0;
}

.cz-glyph {
  color: var(--ov-fg);
}

.cz-body {
  min-width: 0;
}
</style>
