<script setup lang="ts">
import type { IncidentCountView } from '../view/incidents'
import Chip from './Chip.vue'

/**
 * Your incident count in a widget header: the count as a value cell keyed in its tone ('3x'),
 * then the team's count and the session's next limit as captions ('eq. 7x', 'pen. a 17x'), each
 * set off by a hairline. A header that runs short of room hides the extras (.ov-inc__more).
 * Flat props (view/incidents.ts), so a header view stays a flat object of strings.
 */
defineProps<{
  count: string
  team: string
  limit: string
  tone: IncidentCountView['tone']
}>()
</script>

<template>
  <span class="ov-inc">
    <Chip :tone="tone" :variant="tone === 'bad' ? 'solid' : 'soft'">{{ count }}</Chip>
    <span v-if="team" class="ov-inc__more ov-inc__team">{{ team }}</span>
    <span v-if="limit" class="ov-inc__more ov-inc__limit" :class="`is-${tone}`">{{ limit }}</span>
  </span>
</template>

<style>
.ov-inc {
  display: inline-flex;
  flex: none;
  align-items: center;
  gap: 0.45em;
  min-width: 0;
  white-space: nowrap;
}

/* Real information on the header band: muted, like the header's meta, and a 0-blur hairline
   before each piece (the standings header's dividers), so '3x' and 'eq. 7x' never run together. */
.ov-inc__more {
  padding-left: 0.45em;
  box-shadow: inset 1px 0 0 var(--ov-rule);
  font-family: var(--ov-font-small);
  font-size: var(--ov-t-caption);
  font-weight: var(--ov-w-text);
  line-height: 1.3;
  color: var(--ov-fg-muted);
}

/* Close to the limit, or the DQ reached: the words take the count's tone (never colour alone). */
.ov-inc__limit.is-warn {
  color: var(--ov-warn);
  font-weight: var(--ov-w-strong);
}

.ov-inc__limit.is-bad {
  color: var(--ov-bad);
  font-weight: var(--ov-w-strong);
}
</style>
