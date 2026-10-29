<script setup lang="ts">
import { shallowRef, useId } from 'vue'
import { useI18n } from '../../composables/useI18n'

/**
 * A help line, one line long (about 90 characters, R31), and behind its ⓘ the rest (`more`),
 * shown under it on demand. The element (`tag`) takes the caller's id and class, so a control's
 * aria-describedby reads the line and, while open, the rest. The ⓘ is a real button: inside a
 * control's <label> its click toggles the text only, never the control.
 */
withDefaults(defineProps<{ text: string; more?: string; tag?: 'span' | 'p' }>(), {
  more: undefined,
  tag: 'span'
})

const t = useI18n()
const open = shallowRef(false)
const moreId = `${useId()}-more`

function toggle(e: Event): void {
  e.preventDefault()
  e.stopPropagation()
  open.value = !open.value
}
</script>

<template>
  <component :is="tag"
    >{{ text
    }}<template v-if="more"
      >{{ ' '
      }}<button
        type="button"
        class="st-more"
        :aria-expanded="open"
        :aria-controls="moreId"
        :title="t.settings.controls.moreInfo"
        @click="toggle"
      >
        <span aria-hidden="true">ⓘ</span
        ><span class="st-sr-only">{{ t.settings.controls.moreInfo }}</span></button
      ><span v-show="open" :id="moreId" class="st-more-text">{{ more }}</span></template
    ></component
  >
</template>
