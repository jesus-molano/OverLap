<script setup lang="ts">
/**
 * Class position chip. Filled with the accent means "you"; a warn ring means off-track. The
 * two never collide: your own off-track chip keeps the fill and gets the ring outside.
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
  <span class="ov-pos" :class="{ 'ov-pos--player': player, 'ov-pos--warn': warn }">{{ pos }}</span>
</template>

<style>
.ov-pos {
  display: inline-block;
  flex: none;
  min-width: 1.8em;
  padding: 0 0.2em;
  border-radius: var(--ov-radius-chip);
  background: var(--ov-chip);
  font-size: max(var(--ov-min-text), 0.82em);
  font-weight: 700;
  line-height: 1.35;
  font-variant-numeric: tabular-nums;
  text-align: center;
  white-space: nowrap;
}

.ov-pos--player {
  background: var(--ov-accent);
  color: var(--ov-accent-fg);
  text-shadow: none;
}

.ov-pos--warn {
  background: transparent;
  box-shadow: inset 0 0 0 1.5px var(--ov-warn);
  color: var(--ov-warn);
}

.ov-pos--player.ov-pos--warn {
  background: var(--ov-accent);
  box-shadow: 0 0 0 1.5px var(--ov-warn);
  color: var(--ov-accent-fg);
}
</style>
