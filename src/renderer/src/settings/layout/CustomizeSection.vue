<script setup lang="ts">
import { onBeforeUnmount, onMounted, useId } from 'vue'
import { useI18n } from '../../composables/useI18n'
import { injectCustomizeHost } from './customize'

/**
 * "Personalizar": a widget page's element editors (ElementEditor, one per zone, in the order of
 * customizeZones). A page's options component puts them here after its "Contenido":
 *
 *   <PageSection :title="t.settings.common.content">…</PageSection>
 *   <CustomizeSection>
 *     <ElementEditor … />
 *   </CustomizeSection>
 *
 * On a widget page they move to the page's own place for them (WidgetPage: below the options,
 * or a column of their own in a wide window); anywhere else they stay where they are.
 */
const t = useI18n()
const host = injectCustomizeHost()
const titleId = useId()

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

.cz-body {
  min-width: 0;
}
</style>
