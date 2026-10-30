<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, useId, useTemplateRef } from 'vue'
import { focusables, trapStep } from './dialogFocus'

/**
 * A confirmation before a big overwrite (a style today; an example layout or an import can use it
 * too): a title, what will change (the default slot), «Aplicar» and «Cancelar». Modal over the
 * whole window: the page behind is dimmed and out of reach, Tab goes round the dialog's own
 * controls, Esc or a click on the dimmed page cancels. It opens with the focus on «Cancelar»
 * (nothing is overwritten by a stray Enter) and gives it back, when it closes, to `returnFocus`
 * (or to what had it before).
 */
const props = defineProps<{
  title: string
  applyLabel: string
  cancelLabel: string
  /** Where the focus goes back to when it closes. */
  returnFocus?: HTMLElement | null
}>()

const emit = defineEmits<{ apply: []; cancel: [] }>()

const titleId = useId()
const bodyId = useId()
const box = useTemplateRef<HTMLElement>('box')
const cancelBtn = useTemplateRef<HTMLButtonElement>('cancelBtn')
let before: HTMLElement | null = null

function onKey(e: KeyboardEvent): void {
  if (e.key === 'Escape') {
    e.preventDefault()
    e.stopPropagation()
    emit('cancel')
    return
  }
  if (e.key !== 'Tab' || box.value === null) return
  const list = focusables(box.value)
  const at = list.indexOf(document.activeElement as HTMLElement)
  const to = trapStep(at, list.length, e.shiftKey)
  if (to === null) return
  e.preventDefault()
  list[to]?.focus()
}

onMounted(async () => {
  before = document.activeElement instanceof HTMLElement ? document.activeElement : null
  await nextTick()
  cancelBtn.value?.focus()
})

onBeforeUnmount(() => {
  const back = props.returnFocus ?? before
  if (back?.isConnected === true) back.focus()
})
</script>

<template>
  <Teleport to="body">
    <div class="cd-backdrop" @click.self="emit('cancel')">
      <div
        ref="box"
        class="cd"
        role="dialog"
        aria-modal="true"
        :aria-labelledby="titleId"
        :aria-describedby="bodyId"
        @keydown="onKey"
      >
        <h2 :id="titleId" class="cd-title">{{ title }}</h2>
        <div :id="bodyId" class="cd-body">
          <slot />
        </div>
        <footer class="cd-foot">
          <button ref="cancelBtn" type="button" class="st-btn" @click="emit('cancel')">
            {{ cancelLabel }}
          </button>
          <button type="button" class="st-btn cd-apply" @click="emit('apply')">
            {{ applyLabel }}
          </button>
        </footer>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
/* Over the whole window, as the welcome: the settings behind it dimmed until it is answered. */
.cd-backdrop {
  position: fixed;
  inset: 0;
  z-index: 60;
  display: grid;
  place-items: center;
  padding: 16px;
  background: rgb(6 8 10 / 72%);
}

.cd {
  display: flex;
  flex-direction: column;
  gap: 12px;
  width: min(520px, 100%);
  max-height: calc(100vh - 32px);
  padding: 24px 24px 16px;
  overflow-y: auto;
  border: 1px solid var(--st-border-strong);
  border-radius: var(--st-radius);
  background: var(--st-bg);
  color: var(--ov-fg);
  box-shadow:
    var(--st-lit),
    0 0 0 1px rgb(0 0 0 / 50%);
}

.cd-title {
  font-family: var(--ov-font-num);
  font-size: var(--st-t-page);
  font-weight: var(--ov-w-strong);
  line-height: 1.2;
}

.cd-body {
  display: flex;
  flex-direction: column;
  gap: 12px;
  font-size: var(--st-t-ui);
}

.cd-foot {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 4px;
}

/* The way on: neutral ink, raised (the accent means you, never an action), as the welcome's. */
.cd .cd-apply {
  border-color: var(--st-sel);
  background: var(--st-sel);
  color: var(--st-sel-fg);
  font-weight: var(--ov-w-strong);
}

.cd .cd-apply:hover {
  background: #ffffff;
}
</style>
