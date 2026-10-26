<script setup lang="ts">
/**
 * Class position. Plain figures for everyone; filled with the accent means "you"; a warn ring
 * means off-track. On your own off-track cell the warning wins (ring, no fill): the row's
 * bracket still says it is you. Without a position (qualifying before your first time) there is
 * no number to fill: an empty accent box would read as a missing number, so no fill either.
 */
withDefaults(
  defineProps<{
    /** '5', '' when unknown. */
    pos: string
    player?: boolean
    /** Off-track (or any warning on the car). */
    warn?: boolean
  }>(),
  { player: false, warn: false }
)
</script>

<template>
  <span class="ov-pos" :class="{ 'ov-pos--player': player && pos !== '', 'ov-pos--warn': warn }">{{
    pos
  }}</span>
</template>

<style>
.ov-pos {
  display: inline-flex;
  flex: none;
  align-items: center;
  justify-content: safe center;
  min-width: 1.8em;
  height: var(--ov-plate-h);
  padding: 0 0.2em;
  border-radius: var(--ov-radius-chip);
  background: transparent;
  font-size: var(--ov-t-plate);
  font-weight: var(--ov-w-strong);
  line-height: 1;
  font-variant-numeric: tabular-nums;
  color: var(--ov-fg);
  white-space: nowrap;
}

.ov-pos--player {
  background: var(--ov-accent);
  color: var(--ov-accent-fg);
  font-weight: var(--ov-w-solid);
  text-shadow: none;
}

.ov-pos--warn,
.ov-pos--player.ov-pos--warn {
  background: transparent;
  box-shadow: inset 0 0 0 1.5px var(--ov-warn);
  color: var(--ov-warn);
  font-weight: var(--ov-w-strong);
}
</style>
