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
/* Vertical bar in the class colour, as tall as its line. */
.ov-strip {
  flex: none;
  align-self: stretch;
  width: var(--ov-bar-w);
  min-height: 1em;
  margin: 0.2em 0;
  border-radius: 1px;
  background: var(--cls);
}
</style>
