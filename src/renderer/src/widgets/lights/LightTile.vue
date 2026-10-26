<script setup lang="ts">
import type { LightLevel } from '@shared/types'
import Icon from '@renderer/ui/Icon.vue'
import type { EngineIconName } from '@renderer/ui/engineIcons'

/**
 * One warning light: its pictogram in a square, shaped by its level. The strip draws it over the
 * game and the settings page's legend beside what it means, so both show the same light.
 */
defineProps<{
  icon: EngineIconName
  level: LightLevel
  /** Accessible name; without it the light is decorative. */
  label?: string
}>()
</script>

<template>
  <span class="wl-tile" :class="[`wl-tile--${level}`, { 'ov-solid': level === 'alarm' }]"
    ><Icon :name="icon" :label="label" class="wl-tile__icon"
  /></span>
</template>

<style>
/*
 * A dashboard's warning lights: dim grey when off; lit, each level has its colour and its own
 * shape, so it reads without the colour (colour-blind palette or not). The colours are the real
 * warning-light ones, the same in every mode, like the flags (`.wl-tones` holds them, for the
 * text beside a light too):
 *
 *   alarm (red) ...... a solid tile, the icon in white: act now (theme: "solid fill")
 *   warn (orange) .... a ring round the tile: attention (theme: "ring")
 *   caution (yellow) . a key line under it: a value above your own average (theme: "key")
 *   info (blue) ...... a rail on its left: a state, the limiters (theme: "rail")
 */
.wl-tones {
  --wl-alarm: var(--ov-flag-red);
  --wl-warn: var(--ov-flag-orange);
  --wl-caution: var(--ov-flag-yellow);
  --wl-info: var(--ov-info);
  --wl-ink: var(--ov-flag-white);
  /* Words in the alarm's red, lifted a little to read on the dark glass. */
  --wl-alarm-text: color-mix(in srgb, var(--wl-alarm) 80%, #ffffff);
}

/* 24 px at the default 13 px, round the pictogram drawn at its own 16 px (sharp, as checked). */
.wl-tile {
  display: flex;
  flex: none;
  align-items: center;
  justify-content: center;
  width: 1.85em;
  height: 1.85em;
  border-radius: var(--ov-radius-inner);
  color: var(--ov-fg-dim);
}

.wl-tile__icon {
  font-size: 1.23em;
}

/* Off: the pictogram stays in its place, dim, with nothing round it. */
.wl-tile--off {
  opacity: 0.7;
}

.wl-tile--alarm {
  background: var(--wl-alarm);
  color: var(--wl-ink);
}

.wl-tile--warn {
  background: color-mix(in srgb, var(--wl-warn) 16%, transparent);
  box-shadow: inset 0 0 0 2px var(--wl-warn);
  color: var(--wl-warn);
}

/* A key: a background layer, never a box-shadow (theme.css), along the bottom. */
.wl-tile--caution {
  background:
    linear-gradient(var(--wl-caution), var(--wl-caution)) left bottom / 100% var(--ov-key-w)
      no-repeat,
    color-mix(in srgb, var(--wl-caution) 12%, transparent);
  color: var(--wl-caution);
}

.wl-tile--info {
  background:
    linear-gradient(var(--wl-info), var(--wl-info)) left top / var(--ov-bar-w) 100% no-repeat,
    color-mix(in srgb, var(--wl-info) 12%, transparent);
  color: var(--wl-info);
}
</style>
