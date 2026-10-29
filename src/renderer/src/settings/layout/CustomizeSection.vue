<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, useId } from 'vue'
import { useI18n } from '../../composables/useI18n'
import { injectCustomizeHost } from './customize'
import { isZoneOpen, provideZoneRegistry, setZonesOpen } from './zonesOpen'

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
 * `no-bars`: the page of a widget without info bars (infoBar.ts NO_BAR_SECTIONS) says so and why,
 * under the heading.
 */
const props = withDefaults(defineProps<{ noBars?: boolean }>(), { noBars: false })
const t = useI18n()
const host = injectCustomizeHost()
const titleId = useId()
const registry = provideZoneRegistry()

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
        <p class="cz-note">{{ t.settings.common.customizeNote }}</p>
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
      <p v-if="props.noBars" class="cz-nobars">{{ t.settings.common.noBars }}</p>
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

/* A quiet line, the page's own note: no box, no rule. */
.cz-nobars {
  margin: -6px 0 14px;
  color: var(--ov-fg-dim);
  font-size: 12px;
}

.cz-body {
  min-width: 0;
}
</style>
