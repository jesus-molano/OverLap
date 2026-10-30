<script setup lang="ts">
import { computed, nextTick, onMounted, shallowRef, useTemplateRef } from 'vue'
import { isWidgetId } from '@shared/widgets'
import { useI18n } from '../../composables/useI18n'
import { SETTINGS_PAGES, pageTitle } from '../nav'
import AppearancePage from '../pages/AppearancePage.vue'
import LayoutsPage from '../pages/LayoutsPage.vue'
import ShortcutsPage from '../pages/ShortcutsPage.vue'
import VisibilityPage from '../pages/VisibilityPage.vue'
import WidgetPage from '../pages/WidgetPage.vue'
import { harvest, type SearchEntry } from './settingsSearch'

/**
 * Renders every settings page once, one after another, out of sight and inert (nothing in it
 * can take the focus or a click), and harvests what each shows (settingsSearch.harvest): the
 * index of «Buscar ajuste» always names what the pages say, in the window's language (R33).
 * SettingsApp mounts it the first time the search box gets the focus, and drops it when done.
 */
const emit = defineEmits<{ done: [entries: SearchEntry[]] }>()

const t = useI18n()
const box = useTemplateRef<HTMLElement>('box')
const at = shallowRef(0)
const page = computed(() => SETTINGS_PAGES[at.value] ?? null)
const component = computed(() => {
  const p = page.value
  if (p === 'appearance') return AppearancePage
  if (p === 'visibility') return VisibilityPage
  if (p === 'shortcuts') return ShortcutsPage
  if (p === 'layouts') return LayoutsPage
  return WidgetPage
})
const props = computed(() =>
  page.value !== null && isWidgetId(page.value) ? { widgetId: page.value } : {}
)

/** A frame's wait, also where frames are not painted (a window in the background). */
const frame = (): Promise<void> => new Promise((r) => setTimeout(r, 16))

onMounted(async () => {
  const entries: SearchEntry[] = []
  for (let i = 0; i < SETTINGS_PAGES.length; i++) {
    at.value = i
    await nextTick()
    // Editors teleport into their page after it mounts: two frames, then it is all there.
    await frame()
    await frame()
    const p = SETTINGS_PAGES[i]
    if (p !== undefined && box.value) entries.push(...harvest(box.value, p, pageTitle(t.value, p)))
  }
  emit('done', entries)
})
</script>

<template>
  <div ref="box" class="search-indexer" aria-hidden="true" inert>
    <component :is="component" v-if="page !== null" :key="page" v-bind="props" />
  </div>
</template>

<style scoped>
/* Out of sight, out of the way: never painted where you look, never focused, never clicked. */
.search-indexer {
  position: fixed;
  top: 0;
  left: -20000px;
  display: flex;
  flex-direction: column;
  width: 900px;
  height: 800px;
  overflow: hidden;
  visibility: hidden;
  pointer-events: none;
}
</style>
