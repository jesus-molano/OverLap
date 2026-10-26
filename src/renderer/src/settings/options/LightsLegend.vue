<script setup lang="ts">
import { computed } from 'vue'
import { LIGHT_ORDER, LIT_LEVEL } from '@shared/lights'
import { ENGINE_TREND } from '@shared/notices/engineTrend'
import type { LightLevel } from '@shared/types'
import type { EngineIconName } from '@renderer/ui/engineIcons'
import { LIGHT_ICONS } from '@renderer/widgets/lights/view'
import LightTile from '@renderer/widgets/lights/LightTile.vue'
import { useI18n } from '../../composables/useI18n'
import PageSection from '../layout/PageSection.vue'

/**
 * The warning lights' legend: what each lit look says, then every light lit as on the strip
 * with what it means and what to do. Read-only.
 */
const t = useI18n()

const LOOKS = ['alarm', 'warn', 'caution', 'info'] as const satisfies readonly LightLevel[]
/** A light to show each look with. */
const LOOK_ICONS: Readonly<Record<(typeof LOOKS)[number], EngineIconName>> = {
  alarm: 'oil-pressure',
  warn: 'water-temp',
  caution: 'water-temp',
  info: 'pit-limiter'
}

interface Row {
  readonly key: string
  readonly icon: EngineIconName
  readonly level: LightLevel
  readonly name: string
  readonly meaning: string
  readonly action: string
}

/** Every light in the strip's order, the trend after the two temperatures. */
const rows = computed<readonly Row[]>(() => {
  const w = t.value.widgets.lights
  const s = t.value.settings.lights
  const out: Row[] = []
  for (const kind of LIGHT_ORDER) {
    const e = s.entries[kind]
    out.push({
      key: kind,
      icon: LIGHT_ICONS[kind],
      level: LIT_LEVEL[kind],
      name: w.names[kind],
      meaning: e.meaning,
      action: e.action
    })
    if (kind === 'oilTemp') {
      out.push({
        key: 'trend',
        icon: LIGHT_ICONS.water,
        level: 'caution',
        name: s.trend,
        meaning: s.entries.trend.meaning(ENGINE_TREND.sustainS),
        action: s.entries.trend.action
      })
    }
  }
  return out
})
</script>

<template>
  <PageSection :title="t.settings.lights.legend" :note="t.settings.lights.legendNote">
    <ul class="looks wl-tones" role="list">
      <li v-for="look in LOOKS" :key="look" class="look">
        <LightTile :icon="LOOK_ICONS[look]" :level="look" class="tile" />
        <span class="st-help">{{ t.settings.lights.looks[look] }}</span>
      </li>
    </ul>
    <ul class="entries wl-tones" role="list">
      <li v-for="row in rows" :key="row.key" class="entry">
        <LightTile :icon="row.icon" :level="row.level" class="tile" />
        <span class="entry-text">
          <span class="st-label">{{ row.name }}</span>
          <span class="st-help">{{ row.meaning }}</span>
          <span class="action">{{ row.action }}</span>
        </span>
      </li>
    </ul>
  </PageSection>
</template>

<style scoped>
.looks {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
  gap: 10px 16px;
  margin: 0;
  padding: 12px 0;
  list-style: none;
}

.look {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.entries {
  margin: 0;
  padding: 0;
  list-style: none;
}

.entry {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 10px 0;
  border-top: 1px solid var(--st-border);
}

/* The lights at the size of the page's text, a little larger than over the game. */
.tile {
  font-size: 15px;
}

.entry-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

/* What to do: the line to remember, in the page's own text colour. */
.action {
  color: var(--ov-fg);
  font-size: 12.5px;
  line-height: 1.4;
}
</style>
