<script setup lang="ts">
import { vInlineStyle } from '../directives/inlineStyle'
import type { InlineStyle } from '../view/styles'

defineProps<{
  /** `--cls`; inherited from the row when omitted. */
  clsStyle?: InlineStyle
}>()
</script>

<template>
  <span v-inline-style="clsStyle" class="ov-strip" aria-hidden="true" />
</template>

<style>
/*
 * A short bar in the class colour beside the number (number style 'stripe', or 'bare' in a
 * narrow table). One text line tall, never on the row edge, so it never reads as a rail.
 */
.ov-strip {
  flex: none;
  align-self: center;
  width: var(--ov-bar-w);
  height: 1em;
  margin: 0;
  border-radius: 1px;
  background: var(--cls);
}
</style>
