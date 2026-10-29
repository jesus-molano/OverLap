<script setup lang="ts">
import { computed, useTemplateRef } from 'vue'
import { alertToggleOf, type AlertKind } from '@shared/alerts'
import { isElementVisible } from '@shared/elements'
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
import { injectSampleHost } from '@renderer/composables/widgetContext'
import Icon from '@renderer/ui/Icon.vue'
import PreviewTag from '@renderer/ui/PreviewTag.vue'
import WidgetPanel from '@renderer/ui/WidgetPanel.vue'
import { reuseView } from '@renderer/view/reuse'
import { incidentLineView, type IncidentLineView } from './incident'
import IncidentLine from './IncidentLine.vue'
import { PREVIEW_ALERTS, PREVIEW_GALLERY } from './preview'
import {
  MAX_CHIPS,
  alertFilter,
  hasAlerts,
  incidentHero,
  layoutKey,
  limiterHero,
  limiterView,
  previewFilter,
  toFlagsView,
  type AlertFill,
  type AlertFilter,
  type FlagsView,
  type LimiterView
} from './view'

const NO_CHIPS: FlagsView['secondary'] = Object.freeze([])

const options = useOptions('alerts')
const prefs = useWidgetSettings('alerts')
const appearance = useAppearance()
const autoHeight = useAutoHeight()
const { surfaceStyle, halo } = useWidgetSurface()
const t = useI18n()

/**
 * The settings page's live sample shows every alert there is, all the chips included, so each
 * option shows what it adds; edit mode over the game, the usual tallest content.
 */
const gallery = injectSampleHost() !== null
const sample = gallery ? PREVIEW_GALLERY : PREVIEW_ALERTS
const maxChips = gallery ? Number.POSITIVE_INFINITY : MAX_CHIPS

/** The options the banner reads, one object while they are equal (holdS is the provider's). */
const filter = computed<AlertFilter>((prev) => reuseView(prev, alertFilter(options.value)))

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
  () => sample
)
/** Frozen with the content while hidden, so nothing re-renders behind the fade. */
const shownFilter = computed<AlertFilter>((prev) => {
  if (phase.value === 'preview') return previewFilter(sample, filter.value)
  if (phase.value === 'live') return filter.value
  return prev ?? filter.value
})

// Both keep their objects while equal: a speed change on pit road re-renders the limiter only.
// The flag views are frozen per language: a new language swaps them all at once.
const flags = computed<FlagsView>((prev) =>
  toFlagsView(content.value ?? { flags: [] }, shownFilter.value, t.value, prev, maxChips)
)
const limiter = computed<LimiterView | null>((prev) => {
  const d = content.value
  return reuseView(
    prev,
    d === null ? null : limiterView(d, shownFilter.value, appearance.value.units, t.value)
  )
})

const incident = computed<IncidentLineView | null>((prev) =>
  reuseView(
    prev,
    incidentLineView(content.value?.incident, shownFilter.value.showIncidents, t.value)
  )
)

// The band's extras (alerts.parts): what to do after each alert, the other flags as chips.
const showNotes = computed(() => isElementVisible(options.value.parts, 'notes'))
const chips = computed(() =>
  isElementVisible(options.value.parts, 'chips') ? flags.value.secondary : NO_CHIPS
)

const hero = computed(() => limiterHero(flags.value, limiter.value))
/**
 * Each alert's element for the settings page's preview (R12): a click hides it as its eye in
 * Avisos › Personalizar does ('alerts.alerts.showBlue'). The limiter over the limit without it is
 * the overspeed's.
 */
const alertEl = (kind: AlertKind): string => `alerts.alerts.${alertToggleOf(kind)}`
const limiterEl = computed(() =>
  limiter.value?.state === 'offSpeeding'
    ? 'alerts.alerts.showPitOverspeed'
    : 'alerts.alerts.showPitLimiter'
)
const incidentBig = computed(() => incidentHero(flags.value, incident.value, limiter.value))

/** The panel has a row to draw (live, the sample, or the last ones kept while hidden). */
const hasRows = computed(
  () => flags.value.primary !== null || limiter.value !== null || incident.value !== null
)
const wanted = computed(
  () => (phase.value === 'live' || phase.value === 'preview') && hasRows.value
)
/**
 * Where the VISTA PREVIA tag goes: the chips row, else the limiter line, else the incident line,
 * else the flag band.
 */
const previewTag = computed<'flag' | 'chips' | 'limiter' | 'incident' | null>(() => {
  if (!preview.value) return null
  if (chips.value.length > 0) return 'chips'
  if (limiter.value !== null) return 'limiter'
  return incident.value !== null ? 'incident' : 'flag'
})

const shown = useReveal(
  () => wanted.value,
  () => layoutKey(flags.value, limiter.value, incident.value),
  { fit: () => autoHeight.value }
)

// The panel is as tall as its rows, whatever the widget's height: its overlay panel fits to it.
// It only exists once there is something to show (and then keeps the last rows while hidden),
// so the first height measured is the real one, never that of an empty panel.
const panel = useTemplateRef('panel')
useContentSize(panel, { enabled: () => autoHeight.value && wanted.value })

/** The window grows upwards: the panel hugs the bottom edge while the window waits to shrink. */
const bottomAnchored = computed(() => autoHeight.value && prefs.value.anchor === 'bottom')

/** A quiet band (warn / info): the glass with a rail, not a solid fill. */
const isQuiet = (fill: AlertFill): boolean => fill === 'warn' || fill === 'info'
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
        v-memo="[flags.primary, previewTag === 'flag', showNotes]"
        class="flag"
        :data-el="alertEl(flags.primary.kind)"
        :class="[
          `al-fill-${flags.primary.fill}`,
          `al-ink-${flags.primary.ink}`,
          {
            'ov-solid': !isQuiet(flags.primary.fill),
            'flag--quiet ov-state': isQuiet(flags.primary.fill)
          }
        ]"
      >
        <span v-if="flags.primary.icon" class="flag__mark flag__mark--icon"
          ><Icon :name="flags.primary.icon"
        /></span>
        <span v-else class="flag__mark al-tile" :class="`al-tile--${flags.primary.mark}`" />
        <span class="flag__text">
          <span class="flag__label" :class="{ 'flag__label--long': flags.primary.short }">{{
            flags.primary.label
          }}</span>
          <span v-if="flags.primary.short" class="flag__label flag__label--short">{{
            flags.primary.short
          }}</span>
          <span
            v-if="showNotes && flags.primary.note"
            class="flag__note"
            data-el="alerts.parts.notes"
            >{{ flags.primary.note }}</span
          >
        </span>
        <PreviewTag v-if="previewTag === 'flag'" class="alerts__preview" />
      </div>

      <div
        v-if="chips.length > 0"
        v-memo="[chips, previewTag === 'chips']"
        class="chips"
        data-el="alerts.parts.chips"
      >
        <span v-for="f in chips" :key="f.kind" class="chip" :data-el="alertEl(f.kind)">
          <span class="chip__mark al-tile" :class="[`al-fill-${f.fill}`, `al-tile--${f.mark}`]" />
          <span class="chip__text">{{ f.chip }}</span>
        </span>
        <PreviewTag v-if="previewTag === 'chips'" class="alerts__preview" />
      </div>

      <IncidentLine
        v-if="incident"
        data-el="alerts.alerts.showIncidents"
        :view="incident"
        :hero="incidentBig"
        :preview="previewTag === 'incident'"
      />

      <div
        v-if="limiter"
        class="limiter"
        :data-el="limiterEl"
        :class="[
          `limiter--${limiter.state}`,
          {
            'limiter--hero': hero,
            'ov-solid': limiter.state !== 'on',
            'ov-state': limiter.state === 'on'
          }
        ]"
      >
        <span class="limiter__mark"><Icon :name="limiter.icon" class="limiter__icon" /></span>
        <span class="limiter__label">{{ limiter.label }}</span>
        <span v-if="showNotes && limiter.note" class="limiter__note" data-el="alerts.parts.notes">{{
          limiter.note
        }}</span>
        <span class="limiter__speed"
          >{{ limiter.speed
          }}<span class="limiter__unit ov-unit">&nbsp;{{ limiter.unit }}</span></span
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
 *
 * The panel is a stack of full-bleed bands (the main flag, the secondary flags, the limiter)
 * split by the dark keyline: no pill inside the panel, so no double frame.
 */
.alerts {
  /* The real flags' colours (theme.css), the same in every mode. */
  --al-black: var(--ov-flag-black);
  --al-white: var(--ov-flag-white);
  --al-yellow: var(--ov-flag-yellow);
  --al-red: var(--ov-flag-red);
  --al-blue: var(--ov-flag-blue);
  --al-green: var(--ov-flag-green);
  --al-orange: var(--ov-flag-orange);
  --al-ink-dark: #0b0c0e;
  --al-ink-light: #ffffff;
  /* Limiter off / over the limit: the overlay's alarm red, deepened a little so its white text
     reads at 4.6:1 (the plain token gives 3.4:1). */
  --al-alarm: color-mix(in srgb, var(--ov-alert) 85%, #000000);
  --al-alarm-ink: var(--al-ink-light);
}

/* Colour-blind palette: the alarm is the theme's alert orange as it is, with dark text. */
:root[data-cvd='on'] .alerts {
  --al-alarm: var(--ov-alert);
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
  gap: 0;
  padding: 0;
}

/* Band separators: the panel's dark keyline between two bands (IncidentLine draws its own). */
.flag + .chips,
.flag + .limiter,
.chips + .limiter,
.al-incident + .limiter {
  box-shadow: inset 0 1px 0 var(--ov-edge-out);
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
/* The alerts that are not flags: the overlay's own tones, colour-blind palette included. */
.al-fill-alarm {
  --al-fill: var(--al-alarm);
}
.al-fill-warn {
  --al-fill: var(--ov-warn);
}
.al-fill-info {
  --al-fill: var(--ov-info);
}
.al-ink-dark {
  --al-ink: var(--al-ink-dark);
}
.al-ink-light {
  --al-ink: var(--al-ink-light);
}
.al-ink-alarm {
  --al-ink: var(--al-alarm-ink);
}

/* A small flag drawn like the real one: the plain flags are their fill, the others a pattern. */
.al-tile {
  display: block;
  flex: none;
  border-radius: var(--ov-radius-chip);
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

/*
 * Furled black flag (a warning): black and white halves, like the warning flag, split the way
 * the standings and relative badge is (icons.ts 'flag-warning': black below the diagonal).
 */
.al-tile--halves {
  background: linear-gradient(to top right, var(--al-black) 0 50%, var(--al-white) 50%);
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

/* ---- Main flag: a full-bleed band in the flag's colour ------------------------------ */

/*
 * One column for every band: each starts on the panel's content line (after the rail), the
 * flag's mark and the limiter's icon share one 2.1em slot, so the flag label and the limiter
 * label line up, and the secondary-flag cells start on the same line.
 */
.flag {
  display: flex;
  align-items: center;
  gap: 0.6em;
  min-width: 0;
  padding: 0.45em 0.6em 0.45em calc(var(--ov-bar-w) + 0.35em);
  border-radius: 0;
  background: var(--al-fill);
  color: var(--al-ink);
  contain: layout paint style;
}

/* Black flags on a dark panel (or the game): a light ring keeps the band's edge. */
.flag.al-fill-black {
  box-shadow: inset 0 0 0 max(1px, 0.08em) rgba(255, 255, 255, 0.34);
}

/*
 * Warn / info alerts (tow, laps to go, the engine trend): a quiet band on the glass tinted in the
 * tone (theme.css .ov-state) and with it on the icon, like the limiter when it is on. Never a
 * solid block: those are the flags and the alarms.
 */
.flag.flag--quiet {
  --al-ink: var(--ov-fg);
  --ov-state: var(--al-fill);
  position: relative;
  background: var(--ov-chip-faint);
}

.flag--quiet .flag__mark--icon {
  color: var(--al-fill);
}

.flag__mark {
  width: 2.1em;
  height: 1.5em;
  border-radius: var(--ov-radius-chip);
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
  /* Room for the label's accents inside this clip box too (see .flag__label). */
  padding-block: 0.2em;
  margin-block: -0.2em;
}

/* It never shrinks for the note (a pixel less already cuts it with an ellipsis): only past the
   whole row ('SENTIDO CONTRARIO' in a narrow window before the short label takes over). */
.flag__label {
  flex: 0 0 auto;
  max-width: 100%;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  font-family: var(--ov-font-num);
  font-size: var(--ov-t-display);
  font-weight: var(--ov-w-solid);
  line-height: 1.15;
  letter-spacing: 0.03em;
  /* The clip box reaches past the tight line box, so accented capitals ('REPARACIÓN',
     'ÚLTIMA VUELTA') keep their accents; the negative margins leave the layout as it was. */
  padding-block: 0.12em;
  margin-block: -0.12em;
}

/* The short label replaces a long one in narrow windows (see the end). */
.flag__label--short {
  display: none;
}

/* The note gives way first; the gap alone sets it apart. Dimmed by its colour, not opacity. */
.flag__note {
  flex: 0 100 auto;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: var(--ov-t-body);
  font-weight: var(--ov-w-strong);
  color: color-mix(in srgb, var(--al-ink) 80%, transparent);
}

.alerts__preview {
  margin-left: auto;
}

/* ---- Other flags: recessed cells with a mini flag ------------------------------------ */

.chips {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.3em;
  min-width: 0;
  padding: 0.35em 0.6em 0.35em calc(var(--ov-bar-w) + 0.35em);
}

.chip {
  display: inline-flex;
  align-items: center;
  gap: 0.4em;
  min-width: 0;
  height: var(--ov-plate-h);
  padding: 0 0.5em 0 0.3em;
  border-radius: var(--ov-radius-chip);
  background: var(--ov-well);
  box-shadow: inset 0 1px 0 rgba(0, 0, 0, 0.35);
  font-size: var(--ov-t-plate);
  font-weight: var(--ov-w-strong);
  line-height: 1;
  letter-spacing: var(--ov-track-tag);
  white-space: nowrap;
}

.chip__mark {
  width: 1.2em;
  height: 0.85em;
  border-radius: 1px;
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.35);
}

/* Line height above 1: the clip box must hold the accents of capitals ('ÚLTIMA'). */
.chip__text {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  line-height: 1.3;
}

/* ---- Pit limiter: a band like the flag ---------------------------------------------- */

.limiter {
  position: relative;
  display: flex;
  align-items: center;
  gap: 0.6em;
  min-width: 0;
  padding: 0.3em 0.6em 0.3em calc(var(--ov-bar-w) + 0.35em);
  border-radius: 0;
  font-weight: var(--ov-w-strong);
  line-height: 1.25;
  letter-spacing: var(--ov-track-tag);
  white-space: nowrap;
  contain: layout paint style;
}

/* On: a quiet band tinted in the "for you" tone (theme.css .ov-state) with the check; state is a
   tint, never a block. */
.limiter--on {
  --ov-state: var(--ov-good);
  background: var(--ov-chip-faint);
}

.limiter--on .limiter__icon {
  color: var(--ov-good);
}

.limiter--on .limiter__label {
  color: var(--ov-fg);
}

/* Off or over the limit: a full-bleed alarm band, the loudest thing the overlay draws. */
.limiter--off,
.limiter--offSpeeding,
.limiter--speeding {
  background: var(--al-alarm);
  color: var(--al-alarm-ink);
  font-weight: var(--ov-w-solid);
}

/* The flag mark's slot, so the limiter label starts where the flag label does. */
.limiter__mark {
  display: flex;
  flex: none;
  align-items: center;
  justify-content: center;
  width: 2.1em;
}

.limiter__icon {
  font-size: 1.15em;
}

/* Like the flag label: the note and the speed give way before it loses a letter. */
.limiter__label {
  flex: 0 0 auto;
  max-width: 100%;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: var(--ov-t-lead);
}

/* 'EXCESO · LIMITADOR OFF': the second half at the lead size, after a dot; gone when narrow. */
.limiter__note {
  flex: 0 10 auto;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: var(--ov-t-lead);
}

.limiter__note::before {
  content: '·';
  margin-right: 0.45em;
}

/* The speed gives way before the words (and its unit before the numbers, see the end). */
.limiter__speed {
  flex: 0 100 auto;
  min-width: 0;
  margin-left: auto;
  overflow: hidden;
  text-overflow: ellipsis;
  font-family: var(--ov-font-num);
  font-size: var(--ov-t-lead);
  font-weight: var(--ov-w-strong);
  letter-spacing: 0;
}

/* .ov-unit (theme.css) gives the face, weight and dim colour; on the alarm it takes the ink. */
.limiter__unit {
  font-size: max(var(--ov-min-text), var(--ov-t-unit));
}

.limiter--off .ov-unit,
.limiter--offSpeeding .ov-unit,
.limiter--speeding .ov-unit {
  color: inherit;
}

.limiter__preview {
  margin-left: 0.2em;
}

/* The limiter alone, or an alarm: as large as the flag. */
.limiter--hero {
  padding: 0.42em 0.6em 0.42em calc(var(--ov-bar-w) + 0.35em);
}

.limiter--hero .limiter__icon,
.limiter--hero .limiter__label,
.limiter--hero .limiter__speed {
  font-size: var(--ov-t-display);
}

/* ---- Narrow windows: the words that matter keep their room ---------------------------- */

@container alerts (max-width: 28em) {
  .limiter--hero .limiter__unit {
    display: none;
  }
}

/*
 * Over the limit without the limiter, when "EXCESO · LIMITADOR OFF 68 / 60" no longer fits:
 * "LIMITADOR OFF 68 / 60", what to do and a speed that says the rest (like 'off').
 */
@container alerts (max-width: 26em) {
  .limiter--offSpeeding .limiter__label {
    display: none;
  }

  .limiter--offSpeeding .limiter__note {
    flex: 0 0 auto;
    max-width: 100%;
  }

  .limiter--offSpeeding .limiter__note::before {
    content: none;
  }

  .limiter--hero.limiter--offSpeeding .limiter__note {
    font-size: var(--ov-t-display);
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

  /* "LIMITADOR OFF" is the whole message, also over the limit: switching it on slows you. */
  .limiter--off .limiter__speed,
  .limiter--offSpeeding .limiter__speed {
    display: none;
  }

  .limiter--hero.limiter--offSpeeding .limiter__note {
    font-size: 1.2em;
  }
}
</style>
