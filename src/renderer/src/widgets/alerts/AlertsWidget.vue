<script setup lang="ts">
import { computed, useTemplateRef } from 'vue'
import { useAppearance } from '@renderer/composables/useAppearance'
import { useContentSize } from '@renderer/composables/useContentSize'
import { useI18n } from '@renderer/composables/useI18n'
import { useReveal } from '@renderer/composables/useReveal'
import { useShownContent, useWidgetPhase } from '@renderer/composables/useWidgetPhase'
import {
  useAutoHeight,
  useOptions,
  useWidgetSettings
} from '@renderer/composables/useWidgetSettings'
import { useWidgetSurface } from '@renderer/composables/useWidgetSurface'
import Icon from '@renderer/ui/Icon.vue'
import PreviewTag from '@renderer/ui/PreviewTag.vue'
import WidgetPanel from '@renderer/ui/WidgetPanel.vue'
import { reuseView } from '@renderer/view/reuse'
import { PREVIEW_ALERTS } from './preview'
import {
  hasAlerts,
  layoutKey,
  limiterHero,
  limiterView,
  previewFilter,
  toFlagsView,
  type AlertFilter,
  type FlagsView,
  type LimiterView
} from './view'

const options = useOptions('alerts')
const prefs = useWidgetSettings('alerts')
const appearance = useAppearance()
const autoHeight = useAutoHeight()
const { surfaceStyle, halo } = useWidgetSurface()
const t = useI18n()

/** The options the banner reads, one object while they are equal (holdS is the provider's). */
const filter = computed<AlertFilter>((prev) =>
  reuseView(prev, {
    showFlags: options.value.showFlags,
    showBlue: options.value.showBlue,
    showPitLimiter: options.value.showPitLimiter
  })
)

// Payloads come only when they change (SKIP_EMIT), so there is no freshness timer: a lost
// connection hides the banner through the phase.
const { data, phase } = useWidgetPhase('alerts', {
  showsOffline: false,
  hasContent: (d) => hasAlerts(d, filter.value)
})

const preview = computed(() => phase.value === 'preview')
/** Live data, the sample in edit mode, or what was shown last (kept through the fade-out). */
const content = useShownContent(
  () => phase.value,
  () => data.value,
  () => PREVIEW_ALERTS
)
/** Frozen with the content while hidden, so nothing re-renders behind the fade. */
const shownFilter = computed<AlertFilter>((prev) => {
  if (phase.value === 'preview') return previewFilter(PREVIEW_ALERTS, filter.value)
  if (phase.value === 'live') return filter.value
  return prev ?? filter.value
})

// Both keep their objects while equal: a speed change on pit road re-renders the limiter only.
// The flag views are frozen per language: a new language swaps them all at once.
const flags = computed<FlagsView>((prev) =>
  toFlagsView(content.value?.flags ?? [], shownFilter.value, t.value, prev)
)
const limiter = computed<LimiterView | null>((prev) => {
  const d = content.value
  return reuseView(
    prev,
    d === null ? null : limiterView(d, shownFilter.value, appearance.value.units, t.value)
  )
})

const hero = computed(() => limiterHero(flags.value, limiter.value))

/** The panel has a row to draw (live, the sample, or the last ones kept while hidden). */
const hasRows = computed(() => flags.value.primary !== null || limiter.value !== null)
const wanted = computed(
  () => (phase.value === 'live' || phase.value === 'preview') && hasRows.value
)
/** Where the VISTA PREVIA tag goes: the chips row, else the limiter line, else the pill. */
const previewTag = computed<'flag' | 'chips' | 'limiter' | null>(() => {
  if (!preview.value) return null
  if (flags.value.secondary.length > 0) return 'chips'
  return limiter.value !== null ? 'limiter' : 'flag'
})

const shown = useReveal(
  () => wanted.value,
  () => layoutKey(flags.value, limiter.value),
  { fit: () => autoHeight.value }
)

// The panel is as tall as its rows, whatever the window height: main fits the window to it.
// It only exists once there is something to show (and then keeps the last rows while hidden),
// so the first height measured is the real one, never that of an empty panel.
const panel = useTemplateRef('panel')
useContentSize(panel, { enabled: () => autoHeight.value && wanted.value })

/** The window grows upwards: the panel hugs the bottom edge while the window waits to shrink. */
const bottomAnchored = computed(() => autoHeight.value && prefs.value.anchor === 'bottom')
</script>

<template>
  <div class="alerts ov-root ov-fade" :class="{ 'is-shown': shown, 'is-bottom': bottomAnchored }">
    <WidgetPanel
      v-if="hasRows"
      ref="panel"
      class="alerts__panel"
      :class="{ 'alerts__panel--fixed': !autoHeight }"
      :surface="surfaceStyle"
      :halo="halo"
      :fill="!autoHeight"
    >
      <div
        v-if="flags.primary"
        v-memo="[flags.primary, previewTag === 'flag']"
        class="flag ov-solid"
        :class="[`al-fill-${flags.primary.fill}`, `al-ink-${flags.primary.ink}`]"
      >
        <span v-if="flags.primary.mark === 'flag'" class="flag__mark flag__mark--icon"
          ><Icon name="flag"
        /></span>
        <span v-else class="flag__mark al-tile" :class="`al-tile--${flags.primary.mark}`" />
        <span class="flag__text">
          <span class="flag__label" :class="{ 'flag__label--long': flags.primary.short }">{{
            flags.primary.label
          }}</span>
          <span v-if="flags.primary.short" class="flag__label flag__label--short">{{
            flags.primary.short
          }}</span>
          <span v-if="flags.primary.note" class="flag__note">{{ flags.primary.note }}</span>
        </span>
        <PreviewTag v-if="previewTag === 'flag'" class="alerts__preview" />
      </div>

      <div
        v-if="flags.secondary.length > 0"
        v-memo="[flags.secondary, previewTag === 'chips']"
        class="chips"
      >
        <span v-for="f in flags.secondary" :key="f.kind" class="chip">
          <span class="chip__mark al-tile" :class="[`al-fill-${f.fill}`, `al-tile--${f.mark}`]" />
          <span class="chip__text">{{ f.chip }}</span>
        </span>
        <PreviewTag v-if="previewTag === 'chips'" class="alerts__preview" />
      </div>

      <div
        v-if="limiter"
        class="limiter"
        :class="[
          `limiter--${limiter.state}`,
          { 'limiter--hero': hero, 'ov-solid': limiter.state !== 'on' }
        ]"
      >
        <Icon :name="limiter.icon" class="limiter__icon" />
        <span class="limiter__label">{{ limiter.label }}</span>
        <span class="limiter__speed"
          >{{ limiter.speed }}<span class="limiter__unit">&nbsp;{{ limiter.unit }}</span></span
        >
        <PreviewTag v-if="previewTag === 'limiter'" class="limiter__preview" />
      </div>
    </WidgetPanel>
  </div>
</template>

<style scoped>
/*
 * Nothing here depends on the window height (no cqh, no height: 100%, font from the scale
 * setting): the content-to-window loop of the auto height cannot exist. Only with the auto
 * height off does the panel fill the window (rows centred). Static emphasis only: no blinking,
 * every pattern is a static gradient painted once.
 */
.alerts {
  /* Flag palette (the theme has none): the real flags' colours, the same in every mode. */
  --al-black: #0b0c0e;
  --al-white: #f3f5f8;
  --al-yellow: #ffd21f;
  --al-red: #e3242b;
  --al-blue: #1f66e0;
  --al-green: #19b04f;
  --al-orange: #ff7a00;
  --al-ink-dark: #0b0c0e;
  --al-ink-light: #ffffff;
  /* Limiter off / over the limit: the red flag's red, white text. */
  --al-alarm: var(--al-red);
  --al-alarm-ink: var(--al-ink-light);
}

/* Colour-blind palette: the alarm takes the theme's "against you" (orange), the "on" its blue. */
:root[data-cvd='on'] .alerts {
  --al-alarm: var(--ov-bad);
  --al-alarm-ink: var(--al-ink-dark);
}

/* With the bottom edge anchored the panel hugs it while the window waits to shrink. */
.alerts.is-bottom {
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
}

.alerts__panel {
  flex: none;
  container: alerts / inline-size;
  gap: 0.35em;
  padding: 0.4em;
}

.alerts__panel--fixed {
  justify-content: center;
}

/* ---- Fills and tiles ----------------------------------------------------------- */

.al-fill-black {
  --al-fill: var(--al-black);
}
.al-fill-yellow {
  --al-fill: var(--al-yellow);
}
.al-fill-red {
  --al-fill: var(--al-red);
}
.al-fill-blue {
  --al-fill: var(--al-blue);
}
.al-fill-white {
  --al-fill: var(--al-white);
}
.al-fill-green {
  --al-fill: var(--al-green);
}
.al-ink-dark {
  --al-ink: var(--al-ink-dark);
}
.al-ink-light {
  --al-ink: var(--al-ink-light);
}

/* A small flag drawn like the real one: the plain flags are their fill, the others a pattern. */
.al-tile {
  display: block;
  flex: none;
  border-radius: 2px;
  background: var(--al-fill, transparent);
}

/* Disqualified: a white cross on black. */
.al-tile--cross {
  background:
    linear-gradient(45deg, transparent 41%, var(--al-white) 41% 59%, transparent 59%),
    linear-gradient(-45deg, transparent 41%, var(--al-white) 41% 59%, transparent 59%),
    var(--al-black);
}

/* Meatball: an orange disc on black. */
.al-tile--disc {
  background:
    radial-gradient(circle closest-side, var(--al-orange) 0 72%, transparent 78%), var(--al-black);
}

/* Full-course caution: hazard stripes. */
.al-tile--hazard {
  background: repeating-linear-gradient(
    -45deg,
    var(--al-black) 0 0.2em,
    var(--al-yellow) 0.2em 0.4em
  );
}

/* Debris (surface) flag: yellow with red vertical stripes. */
.al-tile--stripes {
  background: repeating-linear-gradient(
    90deg,
    var(--al-yellow) 0 0.25em,
    var(--al-red) 0.25em 0.5em
  );
}

/* Blue flag: blue with a yellow diagonal stripe. */
.al-tile--diagonal {
  background: linear-gradient(
    135deg,
    var(--al-blue) 0 34%,
    var(--al-yellow) 34% 66%,
    var(--al-blue) 66%
  );
}

/* Chequered flag. */
.al-tile--checker {
  background: repeating-conic-gradient(var(--al-white) 0 25%, var(--al-black) 0 50%) 0 0 / 0.5em
    0.5em;
}

/* ---- Main flag: the pill ----------------------------------------------------------- */

.flag {
  display: flex;
  align-items: center;
  gap: 0.6em;
  min-width: 0;
  padding: 0.38em 0.75em 0.38em 0.45em;
  border-radius: 5px;
  background: var(--al-fill);
  color: var(--al-ink);
  contain: layout paint style;
}

/* Black flags on a dark panel (or the game): a light ring keeps the pill's edge. */
.flag.al-fill-black {
  box-shadow: inset 0 0 0 max(1px, 0.08em) rgba(255, 255, 255, 0.34);
}

.flag__mark {
  width: 2.1em;
  height: 1.5em;
  border-radius: 3px;
}

/* The pattern tiles get a ring in the ink, so they sit on any fill. */
.flag__mark.al-tile {
  box-shadow: inset 0 0 0 max(1px, 0.07em) color-mix(in srgb, var(--al-ink) 45%, transparent);
}

.flag__mark--icon {
  display: flex;
  flex: none;
  align-items: center;
  justify-content: center;
  font-size: 1.5em;
  width: calc(2.1em / 1.5);
  height: calc(1.5em / 1.5);
}

.flag__text {
  display: flex;
  flex: 1 1 auto;
  align-items: baseline;
  gap: 0.45em;
  min-width: 0;
  overflow: hidden;
  white-space: nowrap;
}

.flag__label {
  flex: 0 1 auto;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  font-family: var(--ov-font-num);
  font-size: 1.45em;
  font-weight: 800;
  line-height: 1.15;
  letter-spacing: 0.03em;
}

/* The short label replaces a long one in narrow windows (see the end). */
.flag__label--short {
  display: none;
}

/* The note gives way first. */
.flag__note {
  flex: 0 100 auto;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: max(var(--ov-min-text), 0.92em);
  font-weight: 600;
  opacity: 0.8;
}

.flag__note::before {
  content: '·';
  margin-right: 0.45em;
}

.alerts__preview {
  margin-left: auto;
}

/* ---- Other flags: chips ----------------------------------------------------------- */

.chips {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.3em;
  min-width: 0;
}

.chip {
  display: inline-flex;
  align-items: center;
  gap: 0.4em;
  min-width: 0;
  padding: 0.15em 0.5em 0.15em 0.3em;
  border-radius: var(--ov-radius-chip);
  background: var(--ov-chip);
  font-size: max(var(--ov-min-text), 0.8em);
  font-weight: 700;
  line-height: 1.3;
  letter-spacing: 0.06em;
  white-space: nowrap;
}

.chip__mark {
  width: 1.2em;
  height: 0.85em;
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.35);
}

.chip__text {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* ---- Pit limiter ------------------------------------------------------------------- */

.limiter {
  display: flex;
  align-items: center;
  gap: 0.5em;
  min-width: 0;
  padding: 0.3em 0.7em 0.3em 0.55em;
  border-radius: 5px;
  font-weight: 800;
  line-height: 1.25;
  letter-spacing: 0.04em;
  white-space: nowrap;
  contain: layout paint style;
}

/* On: a quiet ring in the "for you" tone, with the check. */
.limiter--on {
  background: var(--ov-chip-faint);
  box-shadow: inset 0 0 0 max(1px, 0.08em) color-mix(in srgb, var(--ov-good) 55%, transparent);
}

.limiter--on .limiter__icon,
.limiter--on .limiter__label {
  color: var(--ov-good);
}

/* Off or over the limit: a solid alarm, the loudest thing the overlay draws. */
.limiter--off,
.limiter--speeding {
  background: var(--al-alarm);
  color: var(--al-alarm-ink);
}

.limiter__icon {
  font-size: 1.15em;
}

.limiter__label {
  flex: 0 1 auto;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 1.1em;
}

/* The speed gives way before the words (and its unit before the numbers, see the end). */
.limiter__speed {
  flex: 0 100 auto;
  min-width: 0;
  margin-left: auto;
  overflow: hidden;
  text-overflow: ellipsis;
  font-family: var(--ov-font-num);
  font-size: 1.1em;
  font-weight: 700;
  letter-spacing: 0;
}

.limiter__unit {
  font-size: max(var(--ov-min-text), 0.8em);
  font-weight: 600;
}

.limiter__preview {
  margin-left: 0.2em;
}

/* The limiter alone, or an alarm: as large as the pill. */
.limiter--hero {
  padding: 0.42em 0.8em 0.42em 0.6em;
}

.limiter--hero .limiter__icon,
.limiter--hero .limiter__label,
.limiter--hero .limiter__speed {
  font-size: 1.45em;
}

/* ---- Narrow windows: the words that matter keep their room ---------------------------- */

@container alerts (max-width: 28em) {
  .limiter--hero .limiter__unit {
    display: none;
  }
}

@container alerts (max-width: 22em) {
  .flag__note,
  .flag__label--long,
  .limiter__unit {
    display: none;
  }

  .flag__label--short {
    display: block;
  }
}

@container alerts (max-width: 17em) {
  .flag__label,
  .limiter--hero .limiter__icon,
  .limiter--hero .limiter__label,
  .limiter--hero .limiter__speed {
    font-size: 1.2em;
  }

  /* "LIMITADOR OFF" is the whole message. */
  .limiter--off .limiter__speed {
    display: none;
  }
}
</style>
