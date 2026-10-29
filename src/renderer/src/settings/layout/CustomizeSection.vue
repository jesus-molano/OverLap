<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, useId } from 'vue'
import { useI18n } from '../../composables/useI18n'
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
 * editors join its registry, so "Expandir todo / Contraer todo" opens or closes them all.
 * The heading says once how the lists are edited (dragging, ↑ ↓, the sides of the info bars, the
 * eye), for the zones the page has (pageIntro); the lists themselves no longer repeat it.
 */
const t = useI18n()
const host = injectCustomizeHost()
const titleId = useId()
const registry = provideZoneRegistry()

const intro = computed(() => pageIntro(registry.zones.value))
const anyClosed = computed(() => registry.zones.value.some((z) => !isZoneOpen(z)))
const anyOpen = computed(() => registry.zones.value.some((z) => isZoneOpen(z)))
// With nothing to do a button says so (aria-disabled) but keeps the focus it has: a disabled
// one would drop it to the top of the page right after the click.
const expandAll = (): void => {
  if (anyClosed.value) void setZonesOpen(registry.zones.value, true)
}
const collapseAll = (): void => {
  if (anyOpen.value) void setZonesOpen(registry.zones.value, false)
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
            <span class="cz-glyph" aria-hidden="true">⠿</span>
            {{ t.settings.elements.introSides.middle }}
            <span class="cz-glyph" aria-hidden="true">← →</span>
            {{ t.settings.elements.introSides.after }}
          </template>
          <template v-else-if="intro === 'sortable'">
            {{ t.settings.elements.intro.before }}
            <span class="cz-glyph" aria-hidden="true">⠿</span>
            {{ t.settings.elements.intro.after }}
          </template>
          <template v-else>{{ t.settings.elements.introFixed }}</template>
        </p>
        <span v-if="registry.zones.value.length > 1" class="cz-all">
          <button
            type="button"
            class="st-btn st-btn-sm st-btn-ghost"
            :aria-disabled="!anyClosed"
            @click="expandAll"
          >
            {{ t.settings.common.expandAll }}
          </button>
          <button
            type="button"
            class="st-btn st-btn-sm st-btn-ghost"
            :aria-disabled="!anyOpen"
            @click="collapseAll"
          >
            {{ t.settings.common.collapseAll }}
          </button>
        </span>
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
  margin-bottom: 14px;
  padding-top: 12px;
  border-top: 1px solid var(--st-border-hi);
}

.cz-title {
  font-family: var(--ov-font-num);
  font-size: 15px;
  font-weight: var(--ov-w-strong);
  letter-spacing: 0.01em;
}

.cz-note {
  color: var(--ov-fg-dim);
  font-size: 12px;
}

/* Every accordion at once, at the far end of the heading. */
.cz-all {
  display: inline-flex;
  gap: 2px;
  margin-left: auto;
  align-self: center;
}

.cz-glyph {
  color: var(--ov-fg);
}

.cz-body {
  min-width: 0;
}
</style>
