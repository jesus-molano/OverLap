<script setup lang="ts">
import { computed, watch } from 'vue'
import { STANDINGS_CLASS_ORDERS } from '@shared/settings'
import type { ElementEntry, StandingsClassOrder } from '@shared/types'
import { useI18n } from '../../composables/useI18n'
import { useOptions } from '../../composables/useWidgetSettings'
import {
  PREVIEW_CLASS_NAMES,
  previewClassOrder,
  previewField
} from '../../widgets/standings/preview'
import {
  classEntries,
  classOrderNames,
  classSpec,
  classTexts,
  drawnFirst,
  namesOf
} from '../classOrderList'
import ChoiceControl from '../controls/ChoiceControl.vue'
import { choiceOptions } from '../controls/choice'
import { updateSection, type Setter } from '../editor'
import ElementEditor from '../elements/ElementEditor.vue'
import type { ElementChange } from '../elements/listOps'
import { injectPreviewEdit, type ZoneHandle } from '../preview/usePreviewEdit'
import { useSessionClasses } from '../sessionClasses'
import { offerRestore } from '../undo/restore'

/**
 * «Orden de las clases» of the standings (9): the choice, and under «A mano» the list of class
 * names to drag (classOrderList.ts), with ↑ ↓ on its rows as the keyboard's way. The sample's
 * class names are handles too (9b): a class block dragged by its name reorders the classes, as a
 * column is dragged; with «A mano» the drag goes through the list (its «Deshacer»), with another
 * order it switches to «A mano» (the toast says so, «Deshacer» puts both back).
 */
const emit = defineEmits<{ changed: [] }>()

const opts = useOptions('standings')
const t = useI18n()
const live = useSessionClasses()
const s = computed(() => t.value.settings.standings)

const choices = computed(() => choiceOptions(STANDINGS_CLASS_ORDERS, s.value.classOrderChoices))
const manual = computed(() => opts.value.classOrder === 'manual')

const names = computed(() => classOrderNames(opts.value.classList, live.value, PREVIEW_CLASS_NAMES))
const items = computed(() => classEntries(names.value))
// The sample draws its classes in the list's order, also before anything is saved.
watch(names, (classList) => (previewField.value = { ...previewField.value, classList }), {
  immediate: true
})
const spec = computed(() =>
  classSpec(names.value, classOrderNames([], live.value, PREVIEW_CLASS_NAMES))
)
const labels = computed(() =>
  classTexts(names.value, opts.value.classList, live.value, {
    inSession: s.value.classInSession,
    inPreview: s.value.classInPreview
  })
)

const setOrder: Setter<StandingsClassOrder> = (classOrder) => {
  emit('changed')
  return updateSection('standings', { classOrder })
}

/** An edit of the list saves it whole (a reset forgets it: the classes by speed again). */
function applyList(next: ElementEntry<string>[], change: ElementChange<string>): Promise<void> {
  emit('changed')
  return updateSection('standings', { classList: change.kind === 'reset' ? [] : namesOf(next) })
}

// ---- The sample, while another order is chosen ---------------------------------------------

const preview = injectPreviewEdit()

/** The sample's classes as it draws them now, then the rest of the list. */
const drawnNames = computed(() =>
  drawnFirst(
    previewClassOrder(opts.value, previewField.value).map((c) => c.block.className),
    names.value
  )
)
const drawnList = computed(() => classEntries(drawnNames.value))
const drawnSpec = computed(() => classSpec(drawnNames.value, drawnNames.value))

/** A class dropped in the sample: «A mano», in the order the drop made, then «Deshacer». */
function commitFromSample(next: ElementEntry<string>[], id: string): void {
  const before = { classOrder: opts.value.classOrder, classList: [...opts.value.classList] }
  const label = labels.value[id]?.label ?? id
  emit('changed')
  void updateSection('standings', { classOrder: 'manual', classList: namesOf(next) })
  offerRestore(
    (m) => m.settings.standings.classMovedManual(label),
    () => void updateSection('standings', before)
  )
}

const handle: ZoneHandle = {
  zone: 'standings.classOrder',
  get spec() {
    return drawnSpec.value
  },
  split: undefined,
  title: () => s.value.classOrder,
  list: () => drawnList.value,
  label: (id) => labels.value[id]?.label ?? id,
  off: () => false,
  // Every class is drawn: nothing to show or hide.
  setVisible: () => undefined,
  commit: commitFromSample,
  showAt: commitFromSample,
  reveal: () => undefined
}

// «A mano» has its list, which the sample edits through (the editor's preview zone).
watch(
  manual,
  (isManual, _prev, onCleanup) => {
    if (preview === null || isManual) return
    onCleanup(preview.register(handle))
  },
  { immediate: true }
)
</script>

<template>
  <ChoiceControl
    :label="s.classOrder"
    :help="s.classOrderHelp"
    :current="opts.classOrder"
    :options="choices"
    :apply="setOrder"
  />
  <fieldset v-if="manual" class="st-fieldset class-list">
    <legend class="st-label">{{ s.classList }}</legend>
    <p class="st-help class-list-help">{{ s.classListHelp }}</p>
    <ElementEditor
      :title="s.classList"
      :items="items"
      :spec="spec"
      :labels="labels"
      :apply="applyList"
      preview-zone="standings.classOrder"
      embedded
      order-only
      quiet-empty
    />
  </fieldset>
</template>

<style scoped>
.class-list-help {
  display: block;
  margin-bottom: 8px;
}
</style>
