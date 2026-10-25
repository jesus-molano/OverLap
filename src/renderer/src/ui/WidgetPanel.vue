<script setup lang="ts">
import { vInlineStyle } from '../directives/inlineStyle'
import type { InlineStyle } from '../view/styles'

/**
 * Panel chrome of a widget: glass scaled by `--ov-bg-alpha` in a two-tone edge (dark outer
 * keyline, light inner ring) with a lit top edge, and the radius; header slot on top. It is the
 * `.ov-surface`, so every surface token inside follows this widget's opacity, and it fixes the
 * widget's plate height (`--ov-plate-h`). Height follows the content unless `fill` (free-size
 * widgets). The `.ov-panel` rules live in theme.css, so a widget can also use the classes on its
 * own element.
 */
withDefaults(
  defineProps<{
    /** useWidgetSurface().surfaceStyle: `--ov-bg-alpha` (and `--ov-fs`). */
    surface?: InlineStyle
    /** useWidgetSurface().halo. */
    halo?: boolean
    /** Fill the window (free-size widgets); otherwise as tall as the content. */
    fill?: boolean
  }>(),
  { halo: false, fill: false }
)
</script>

<template>
  <div
    v-inline-style="surface"
    class="ov-panel ov-surface"
    :class="{ 'ov-halo': halo, 'ov-panel--fill': fill }"
  >
    <slot name="header" />
    <slot />
  </div>
</template>
