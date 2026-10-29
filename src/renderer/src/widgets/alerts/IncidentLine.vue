<script setup lang="ts">
import Icon from '@renderer/ui/Icon.vue'
import PreviewTag from '@renderer/ui/PreviewTag.vue'
import type { IncidentLineView } from './incident'

/**
 * Your last incident in the alerts banner: '+2x Pérdida de control · V5 · S3 · grava', a band
 * like the limiter's (the "for you" rail, the mark in the flag's slot, the label on the flags'
 * line). Shown for a few seconds by the provider; as large as a flag when it is alone (hero).
 */
defineProps<{ view: IncidentLineView; hero: boolean; preview: boolean }>()
</script>

<template>
  <div
    class="al-incident ov-state"
    :class="[`ov-tone-${view.tone}`, { 'al-incident--hero': hero }]"
  >
    <span class="al-incident__mark"><Icon name="warning" class="al-incident__icon" /></span>
    <span class="al-incident__points">{{ view.points }}</span>
    <span v-if="view.label" class="al-incident__label">{{ view.label }}</span>
    <span v-if="view.detail" class="al-incident__detail">{{ view.detail }}</span>
    <PreviewTag v-if="preview" class="al-incident__preview" />
  </div>
</template>

<style scoped>
/*
 * A quiet band (the limiter's when it is on), tinted in the tone (theme.css .ov-state): an incident is
 * news about you, not an order like a flag. The tone (warn, bad from 4x) only repeats what the
 * points say, and the colour-blind palette redefines both tokens.
 */
.al-incident {
  position: relative;
  display: flex;
  align-items: baseline;
  gap: 0.5em;
  min-width: 0;
  padding: 0.3em 0.6em 0.3em calc(var(--ov-bar-w) + 0.35em);
  background: var(--ov-chip-faint);
  color: var(--ov-fg);
  line-height: 1.25;
  white-space: nowrap;
  contain: layout paint style;
}

/* The band before it (flag, chips) ends at the panel's dark keyline. */
* + .al-incident {
  box-shadow: inset 0 1px 0 var(--ov-edge-out);
}

.al-incident {
  --ov-state: var(--ov-tone);
}

/* The flag mark's slot, so the label starts where a flag's does. */
.al-incident__mark {
  display: flex;
  flex: none;
  align-self: center;
  align-items: center;
  justify-content: center;
  width: 2.1em;
}

.al-incident__icon {
  font-size: 1.15em;
  color: var(--ov-tone);
}

/* The points read first: the numeral face in the tone. */
.al-incident__points {
  flex: none;
  font-family: var(--ov-font-num);
  font-size: var(--ov-t-lead);
  font-weight: var(--ov-w-solid);
  color: var(--ov-tone);
}

.al-incident__label {
  flex: 0 1 auto;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: var(--ov-t-lead);
  font-weight: var(--ov-w-strong);
  /* Room for accented capitals and descenders inside the clip box. */
  padding-block: 0.1em;
  margin-block: -0.1em;
}

/* Where it happened gives way first; dimmed by its colour, not opacity. */
.al-incident__detail {
  flex: 0 100 auto;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: var(--ov-t-body);
  font-weight: var(--ov-w-strong);
  color: var(--ov-fg-muted);
  padding-block: 0.1em;
  margin-block: -0.1em;
}

.al-incident__preview {
  align-self: center;
  margin-left: auto;
}

/* Alone in the banner: as large as a flag. */
.al-incident--hero {
  padding: 0.42em 0.6em 0.42em calc(var(--ov-bar-w) + 0.35em);
}

.al-incident--hero .al-incident__icon,
.al-incident--hero .al-incident__points,
.al-incident--hero .al-incident__label {
  font-size: var(--ov-t-display);
}

.al-incident--hero .al-incident__detail {
  font-size: var(--ov-t-lead);
}

/* Narrow windows: the points and what it was keep their room. */
@container alerts (max-width: 22em) {
  .al-incident__detail {
    display: none;
  }
}

@container alerts (max-width: 17em) {
  .al-incident--hero .al-incident__icon,
  .al-incident--hero .al-incident__points,
  .al-incident--hero .al-incident__label {
    font-size: 1.2em;
  }
}
</style>
