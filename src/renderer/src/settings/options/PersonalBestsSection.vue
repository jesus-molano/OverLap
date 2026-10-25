<script setup lang="ts">
import { computed, shallowRef, useId } from 'vue'
import { formatLapTime } from '@shared/format'
import { useI18n, useLanguage } from '../../composables/useI18n'
import { useOverlayState } from '../../composables/useOverlay'
import ConfirmButton from '../layout/ConfirmButton.vue'
import PageSection from '../layout/PageSection.vue'
import {
  carText,
  matchesQuery,
  placeText,
  toRow,
  usePersonalBests,
  type BestRow
} from '../personalBests'

/** Above this many records a search field helps find one. */
const SEARCH_FROM = 8

const { status } = useOverlayState()
const t = useI18n()
const lang = useLanguage()
const { list, entries, currentBest, remove, removeAll } = usePersonalBests()

const query = shallowRef('')
const searchId = useId()

const current = computed(() => list.value?.current ?? null)
const currentCar = computed(() => (current.value ? carText(t.value, current.value) : ''))
/** 'Spa-Francorchamps · Grand Prix · récord 2:17.512', or the no-record note. */
const currentDetail = computed(() => {
  const c = current.value
  if (!c) return ''
  const pb = t.value.settings.personalBests
  const best = currentBest.value
  const state = best ? pb.record(formatLapTime(best.lapTime)) : pb.noRecord
  return `${placeText(t.value, c)} · ${state}`
})
const rows = computed<BestRow[]>(() => {
  const q = query.value
  const m = t.value
  const l = lang.value
  return entries.value.filter((e) => matchesQuery(e, q)).map((e) => toRow(e, m, l))
})
const count = computed(() => entries.value.length)
const countText = computed(() => t.value.settings.personalBests.count(count.value))
const mock = computed(() => status.value?.source === 'mock')

function removeCurrent(): void {
  const best = currentBest.value
  if (best) remove([best.key])
}
</script>

<template>
  <PageSection :title="t.settings.personalBests.title" :note="t.settings.personalBests.note">
    <p v-if="mock" class="st-row st-help">
      {{ t.settings.personalBests.mock }}
    </p>

    <div v-if="current" class="st-row st-row-wrap">
      <div class="st-row-text">
        <span class="st-label">
          <span class="now">{{ t.settings.personalBests.now }}</span>
          {{ currentCar }}
        </span>
        <span class="st-help">{{ currentDetail }}</span>
      </div>
      <ConfirmButton
        v-if="currentBest"
        :label="t.settings.personalBests.deleteCurrent.label"
        :confirm-label="t.settings.personalBests.deleteCurrent.confirm"
        :description="t.settings.personalBests.deleteCurrent.description"
        :action="removeCurrent"
      />
    </div>

    <p v-if="list === null" class="st-row st-help">{{ t.settings.personalBests.loading }}</p>
    <p v-else-if="count === 0" class="st-row st-help">
      {{ t.settings.personalBests.empty }}
    </p>

    <template v-else>
      <div v-if="count > SEARCH_FROM" class="st-row">
        <label :for="searchId" class="st-label">{{ t.settings.personalBests.search }}</label>
        <input
          :id="searchId"
          v-model="query"
          type="search"
          class="st-field search"
          :placeholder="t.settings.personalBests.searchPlaceholder"
          autocomplete="off"
          spellcheck="false"
        />
      </div>

      <ul class="list" :aria-label="t.settings.personalBests.list">
        <li
          v-for="r in rows"
          :key="r.key"
          class="item"
          :class="{ 'is-now': r.key === current?.key }"
        >
          <div class="st-row-text">
            <span class="st-label car">{{ r.car }}</span>
            <span class="st-help place"
              >{{ r.place }}<template v-if="r.date"> · {{ r.date }}</template></span
            >
          </div>
          <span class="st-value time">{{ r.time }}</span>
          <ConfirmButton
            small
            :label="t.settings.personalBests.deleteOne.label"
            :confirm-label="t.settings.personalBests.deleteOne.confirm"
            :description="t.settings.personalBests.deleteOne.description(r.car, r.place)"
            :action="() => remove([r.key])"
          />
        </li>
        <li v-if="rows.length === 0" class="st-help empty">
          {{ t.settings.personalBests.noMatch(query) }}
        </li>
      </ul>

      <div class="st-row">
        <span class="st-help">{{ countText }}</span>
        <ConfirmButton
          :label="t.settings.personalBests.deleteAll.label"
          :confirm-label="t.settings.personalBests.deleteAll.confirm(count)"
          :description="t.settings.personalBests.deleteAll.description"
          :action="removeAll"
        />
      </div>
    </template>
  </PageSection>
</template>

<style scoped>
/* «AHORA» is you (the car you are driving now), so it keeps the accent: a solid tag. */
.now {
  margin-right: 6px;
  padding: 1px 6px;
  border-radius: var(--ov-radius-chip);
  background: var(--ov-accent);
  color: var(--ov-accent-fg);
  font-family: var(--ov-font-small);
  font-size: 11px;
  font-weight: var(--ov-w-solid);
  letter-spacing: var(--ov-track-tag);
  text-transform: uppercase;
}

.search {
  flex: 0 1 18em;
  min-width: 0;
}

.list {
  display: flex;
  flex-direction: column;
  max-height: 340px;
  margin: 0;
  padding: 0;
  overflow-y: auto;
  list-style: none;
}

.item {
  display: flex;
  align-items: center;
  gap: 12px;
  min-height: 48px;
  padding: 6px 0;
}

.item + .item {
  border-top: 1px solid var(--st-border);
}

/* Your current car's record: the accent rail, as your row in the widgets. */
.item.is-now {
  padding-left: 10px;
  box-shadow: inset var(--ov-bar-w) 0 0 var(--ov-accent);
}

.item.is-now .car {
  color: var(--ov-fg);
}

.car,
.place {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.time {
  flex: none;
}

/* Wide enough for «¿Seguro?»: arming it must not shift the times. */
.item :deep(.st-btn) {
  flex: none;
  min-width: 6.2em;
}

.empty {
  padding: 12px 0;
}
</style>
