<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, shallowRef, useTemplateRef } from 'vue'
import { isWidgetId } from '@shared/widgets'
import { provideOptionsView } from '../../composables/searchUnlock'
import { useI18n } from '../../composables/useI18n'
import { SETTINGS_PAGES, pageTitle } from '../nav'
import AppearancePage from '../pages/AppearancePage.vue'
import LayoutsPage from '../pages/LayoutsPage.vue'
import ShortcutsPage from '../pages/ShortcutsPage.vue'
import VisibilityPage from '../pages/VisibilityPage.vue'
import WidgetPage from '../pages/WidgetPage.vue'
import { harvest, mergeGated, type SearchEntry } from './settingsSearch'
import { unlockedOptions } from './unlock'

/**
 * Renders every settings page once, one after another, out of sight and inert (nothing in it
 * can take the focus or a click), and harvests what each shows (settingsSearch.harvest): the
 * index of «Buscar ajuste» always names what the pages say, in the window's language (R33).
 * Each page is rendered twice: as it is, then with every list item and switch on (unlock.ts), so
 * what another setting hides now is found too, marked `gated` (the result says so). SettingsApp
 * mounts it when the search box gets the focus and the settings changed since (keyed by the
 * language: a new one starts it again), and drops it when done.
 */
const emit = defineEmits<{ done: [entries: SearchEntry[]] }>()

const t = useI18n()
const box = useTemplateRef<HTMLElement>('box')
const at = shallowRef(0)
/** The second pass of the page: everything that can show, shown. */
const unlocked = shallowRef(false)
provideOptionsView((section, own) => (unlocked.value ? unlockedOptions(section, own) : own))
let cancelled = false
onBeforeUnmount(() => (cancelled = true))
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

/** The page `i` rendered (as it is, or unlocked) and harvested. */
async function pass(i: number, open: boolean): Promise<SearchEntry[]> {
  at.value = i
  unlocked.value = open
  await nextTick()
  // Editors teleport into their page after it mounts: two frames, then it is all there.
  await frame()
  await frame()
  const p = SETTINGS_PAGES[i]
  return p !== undefined && box.value ? harvest(box.value, p, pageTitle(t.value, p)) : []
}

onMounted(async () => {
  const entries: SearchEntry[] = []
  for (let i = 0; i < SETTINGS_PAGES.length; i++) {
    const shown = await pass(i, false)
    const all = await pass(i, true)
    if (cancelled) return
    entries.push(...mergeGated(shown, all))
  }
  if (!cancelled) emit('done', entries)
})
</script>

<template>
  <div ref="box" class="search-indexer" aria-hidden="true" inert>
    <component :is="component" v-if="page !== null" :key="`${page}:${unlocked}`" v-bind="props" />
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
