<script setup lang="ts">
import { computed, watch } from 'vue'
import { STANDINGS_CLASS_ORDERS } from '@shared/settings'
import { OPTION_SCHEMA } from '@shared/settingsSchema'
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
  namesOf,
  namesToSave
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
/** The most class names «A mano» keeps (settingsSchema's classList). */
const CLASS_LIST_MAX = OPTION_SCHEMA.standings.classList.max
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

/**
 * What an edit saves: the list in its new order, but the names at its end nobody saved (the
 * sample's) and, over the cap, the lowest of no class running now (namesToSave).
 */
function toSave(
  next: ElementEntry<string>[],
  movedId: string | undefined,
  known: readonly string[]
): string[] {
  const all = namesOf(next, known)
  const moved =
    movedId === undefined ? undefined : namesOf([{ id: movedId, visible: true }], known)[0]
  return namesToSave(all, {
    saved: opts.value.classList,
    live: live.value,
    moved,
    max: CLASS_LIST_MAX
  })
}

/** An edit of the list saves it (a reset forgets it: the classes by speed again). */
function applyList(next: ElementEntry<string>[], change: ElementChange<string>): Promise<void> {
  emit('changed')
  if (change.kind === 'reset') return updateSection('standings', { classList: [] })
  const moved = change.kind === 'move' ? change.id : undefined
  return updateSection('standings', { classList: toSave(next, moved, names.value) })
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
  void updateSection('standings', {
    classOrder: 'manual',
    classList: toSave(next, id, drawnNames.value)
  })
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
