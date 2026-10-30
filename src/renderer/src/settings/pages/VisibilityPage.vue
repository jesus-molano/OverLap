<script setup lang="ts">
import { computed, useId } from 'vue'
import { OPTION_SCHEMA, SHOW_WHEN } from '@shared/settingsSchema'
import type { ShowWhen } from '@shared/types'
import type { WidgetId } from '@shared/widgets'
import { useI18n, useLanguage, useLocale } from '../../composables/useI18n'
import { useOverlayState } from '../../composables/useOverlay'
import { useOptions } from '../../composables/useWidgetSettings'
import ChoiceControl from '../controls/ChoiceControl.vue'
import { choiceOptions, type ChoiceOption } from '../controls/choice'
import HelpText from '../controls/HelpText.vue'
import MatrixCell from '../controls/MatrixCell.vue'
import ToggleControl from '../controls/ToggleControl.vue'
import { optionSetter, showInSetter, widgetSetter } from '../editor'
import NavIcon from '../layout/NavIcon.vue'
import VisibilityDot from '../layout/VisibilityDot.vue'
import PageFrame from '../layout/PageFrame.vue'
import PageSection from '../layout/PageSection.vue'
import ResetMenu from '../layout/ResetMenu.vue'
import type { ResetItem } from '../layout/resetItems'
import { useNavigate } from '../navigate'
import { outOfCarHidesSessionScreen, replaysHelp as replaysHelpText } from '../replayWidgets'
import { MATRIX_COLUMNS, matrixRows, type MatrixColumn } from '../visibilityMatrix'
import { resetAppearancePart, setWidgetVisible } from '../undo/restore'
import { heldCaption } from '../statusSummary'

/**
 * «Visibilidad» (R34): when the overlay shows at all (settings.visibility, moved here from
 * Apariencia), then one table of where each widget shows: its eye, the sessions it shows in, the
 * pits, the session screen and its lock, the widgets in their groups (R42). Every cell sets the
 * same value as the row on the widget's own page («Ventana y visibilidad»), and a widget's name
 * goes to that page. A cell that cannot change says why on hover.
 */
const t = useI18n()
const locale = useLocale()
const titleId = useId()
const navigate = useNavigate()
const { settings, autoHiddenOf, overlayHidden } = useOverlayState()
const lang = useLanguage()
const visibility = useOptions('visibility')
const setVisibility = optionSetter('visibility')

/** The tray's words for each choice (core.showWhen), with this page's tooltips. */
const showWhenChoices = computed<ChoiceOption<ShowWhen>[]>(() =>
  SHOW_WHEN.map((value) => ({
    value,
    label: t.value.core.showWhen[value],
    hint: t.value.settings.appearance.screen.showWhenHints[value]
  }))
)
const showWhenHelp = computed(
  () => t.value.settings.appearance.screen.showWhenHelp[visibility.value.showWhen]
)
/**
 * Hiding on the session screen changes nothing while out of the car hides it already (the
 * overlay only for the car, replays hidden): then it is not offered.
 */
const sessionScreenOffered = computed(() => !outOfCarHidesSessionScreen(visibility.value))
const replayChoices = computed(() =>
  choiceOptions(
    OPTION_SCHEMA.visibility.replays.values,
    t.value.settings.appearance.screen.replayChoices
  )
)
const replaysHelp = computed(() => replaysHelpText(t.value, locale.value, visibility.value))

/** "Restablecer…" at the top, as on every page (R24): the rules of the overlay. */
const resetItems = computed<ResetItem[]>(() => [
  {
    id: 'screen',
    label: t.value.settings.appearance.screen.title,
    description: t.value.settings.appearance.reset.screen,
    run: () => resetAppearancePart('screen')
  }
])
const screenResetLabel = computed(() =>
  t.value.settings.appearance.reset.sectionLabel(t.value.settings.appearance.screen.title)
)

/** What a click on a cell sets: the same setters as the widget's page. */
function applyOf(id: WidgetId, col: MatrixColumn): (on: boolean) => Promise<unknown> {
  const set = widgetSetter(id)
  switch (col) {
    case 'visible':
      return (on) => setWidgetVisible(id, on)
    case 'pits':
      return set('hideInPits')
    case 'session':
      return set('showOnSessionScreen')
    case 'locked':
      return set('locked')
    default:
      return showInSetter(id, col)
  }
}

const COLUMNS = MATRIX_COLUMNS
const groups = computed(() =>
  settings.value === null
    ? []
    : matrixRows(t.value, settings.value, visibility.value).map((g) => ({
        ...g,
        rows: g.rows.map((r) => ({
          ...r,
          held: heldCaption(t.value, lang.value, overlayHidden.value, autoHiddenOf[r.id].value),
          cells: r.cells.map((c) => ({ ...c, apply: applyOf(r.id, c.col) }))
        }))
      }))
)
/** Practice and qualifying never show while the overlay is for races only: said over the table. */
const raceOnly = computed(() => visibility.value.showWhen === 'race')
</script>

<template>
  <PageFrame :labelledby="titleId">
    <template #top>
      <header class="page-head">
        <div class="page-titles">
          <h1 :id="titleId" class="page-title">{{ t.settings.nav.visibility }}</h1>
          <HelpText
            tag="p"
            class="page-sub"
            :text="t.settings.visibilityPage.sub"
            :more="t.settings.visibilityPage.subMore"
          />
        </div>
        <ResetMenu :label="t.settings.visibilityPage.resetMenu" :items="resetItems" />
      </header>
    </template>

    <PageSection
      :title="t.settings.appearance.screen.title"
      :reset-label="screenResetLabel"
      @reset="resetAppearancePart('screen')"
    >
      <ChoiceControl
        stack
        :label="t.settings.appearance.screen.showWhen"
        :help="showWhenHelp"
        :current="visibility.showWhen"
        :options="showWhenChoices"
        :apply="setVisibility('showWhen')"
      />
      <ChoiceControl
        :label="t.settings.appearance.screen.replays"
        :help="replaysHelp.help"
        :more="replaysHelp.more"
        :current="visibility.replays"
        :options="replayChoices"
        :apply="setVisibility('replays')"
      />
      <ToggleControl
        v-if="sessionScreenOffered"
        kind="switch"
        :label="t.settings.appearance.screen.sessionScreen"
        :help="t.settings.appearance.screen.sessionScreenHelp"
        :current="visibility.hideOnSessionScreen"
        :apply="setVisibility('hideOnSessionScreen')"
      />
      <ToggleControl
        kind="switch"
        :label="t.settings.appearance.screen.simUi"
        :help="t.settings.appearance.screen.simUiHelp"
        :current="visibility.hideWithSimUi"
        :apply="setVisibility('hideWithSimUi')"
      />
      <ToggleControl
        kind="switch"
        :label="t.settings.appearance.screen.garage"
        :help="t.settings.appearance.screen.garageHelp"
        :current="visibility.hideInGarage"
        :apply="setVisibility('hideInGarage')"
      />
      <ToggleControl
        kind="switch"
        :label="t.settings.appearance.screen.waiting"
        :help="t.settings.appearance.screen.waitingHelp"
        :current="visibility.showWhileWaiting"
        :apply="setVisibility('showWhileWaiting')"
      />
    </PageSection>

    <PageSection
      :title="t.settings.visibilityPage.matrixTitle"
      :note="t.settings.visibilityPage.matrixNote"
    >
      <p v-if="raceOnly" class="st-row st-help st-help-warn">
        {{ t.settings.visibilityPage.raceOnly }}
      </p>
      <div class="vm-wrap">
        <table class="vm">
          <thead>
            <tr>
              <th scope="col" class="vm-name">{{ t.settings.visibilityPage.cols.widget }}</th>
              <th
                v-for="c in COLUMNS"
                :key="c"
                scope="col"
                class="vm-col"
                :title="t.settings.visibilityPage.colHints[c]"
              >
                <span class="vm-h">{{ t.settings.visibilityPage.cols[c] }}</span>
              </th>
            </tr>
          </thead>
          <tbody v-for="g in groups" :key="g.id">
            <tr class="vm-group">
              <th scope="colgroup" :colspan="COLUMNS.length + 1">{{ g.title }}</th>
            </tr>
            <tr v-for="r in g.rows" :key="r.id" :class="{ 'is-off': !r.on }">
              <th scope="row" class="vm-name">
                <button
                  type="button"
                  class="vm-link"
                  :title="t.settings.visibilityPage.open(r.name)"
                  @click="navigate(r.id)"
                >
                  <NavIcon :page="r.id" />
                  <span>{{ r.name }}</span>
                </button>
              </th>
              <td v-for="c in r.cells" :key="c.col" class="vm-cell" :data-col="c.col">
                <!-- Visible: the sidebar's eye, the one symbol of visibility (R35). -->
                <VisibilityDot
                  v-if="c.col === 'visible'"
                  :title="r.name"
                  :current="c.current"
                  :apply="c.apply"
                  :held="r.held"
                />
                <MatrixCell
                  v-else
                  :label="c.label"
                  :current="c.current"
                  :disabled="c.disabled"
                  :hint="c.hint"
                  :apply="c.apply"
                />
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </PageSection>

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
  max-width: 46em;
  color: var(--ov-fg-muted);
  font-size: 12.5px;
}

/* The table scrolls sideways in its own box in a narrow window; the page never does. */
.vm-wrap {
  overflow-x: auto;
}

.vm {
  width: 100%;
  min-width: 600px;
  border-collapse: collapse;
  font-size: 13px;
}

.vm th,
.vm td {
  padding: 2px 6px;
  border-bottom: 1px solid var(--st-border);
}

.vm thead th {
  padding-block: 10px 8px;
  color: var(--ov-fg-dim);
  font-family: var(--ov-font-small);
  font-size: 11px;
  font-weight: var(--ov-w-strong);
  letter-spacing: var(--ov-track-caps);
  line-height: 1.25;
  text-align: center;
  text-transform: uppercase;
  vertical-align: bottom;
}

.vm thead .vm-name {
  text-align: left;
}

.vm-col {
  width: 11%;
}

.vm-group th {
  padding: 12px 6px 4px;
  color: var(--ov-fg-muted);
  font-size: 12px;
  font-weight: var(--ov-w-strong);
  text-align: left;
}

.vm-name {
  text-align: left;
  white-space: nowrap;
}

.vm-link {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-height: 30px;
  padding: 2px 6px;
  border: 0;
  border-radius: var(--st-radius-sm);
  background: transparent;
  color: var(--ov-fg);
  font-weight: var(--ov-w-strong);
  cursor: pointer;
}

.vm-link:hover {
  background: var(--st-hover);
}

/* A widget turned off: its row reads quieter; its cells still change. */
.is-off .vm-link {
  color: var(--ov-fg-muted);
}

.vm-cell {
  text-align: center;
}

/*
 * A narrow window: the column names stand on end, so the seven columns fit beside the names
 * instead of scrolling sideways.
 */
@media (max-width: 899px) {
  .vm {
    min-width: 0;
  }

  .vm thead .vm-col {
    padding-inline: 0;
    vertical-align: bottom;
  }

  .vm-h {
    display: inline-block;
    writing-mode: vertical-rl;
    transform: rotate(180deg);
    text-align: left;
    white-space: nowrap;
  }

  .vm-cell {
    padding-inline: 0;
  }
}

tbody tr:not(.vm-group):hover {
  background: var(--st-surface-hi);
}
</style>
