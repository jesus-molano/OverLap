import { onBeforeUnmount, onMounted, shallowRef, watch, type Ref } from 'vue'
import { readKeyboardEvent } from '@shared/accelerator'
import { sendCommand } from './editor'
import { forwardsEditKey, targetKind } from './editKeys'
import { undoSlot } from './undo/undo'

/** Just after «Editar posición»: Tab goes to edit mode too, until the page takes the focus. */
const aimed = shallowRef(false)

/**
 * «Editar posición» was clicked (R25): its button lets the focus go, so the arrows, Tab and
 * Ctrl+Z of the banner reach edit mode at once (editKeys.ts).
 */
export function aimEditKeys(): void {
  aimed.value = true
  const el = document.activeElement
  if (el instanceof HTMLElement) el.blur()
}

/**
 * The settings window passes edit mode's keys on to main while it is in front and the focus is
 * free (editKeys.ts), so they do what its banner says. SettingsApp calls it once.
 */
export function useEditKeys(editMode: Readonly<Ref<boolean>>): void {
  function onKey(e: KeyboardEvent): void {
    if (!editMode.value || e.defaultPrevented) return
    if (e.key === 'Escape') {
      aimed.value = false
      return
    }
    const reading = readKeyboardEvent(e)
    if (reading.kind !== 'key') return
    const state = { aimed: aimed.value, undoShown: undoSlot.shown.value !== null }
    if (!forwardsEditKey(reading.accelerator, targetKind(document.activeElement), state)) return
    e.preventDefault()
    sendCommand({ type: 'edit-key', key: reading.accelerator })
  }
  const settle = (): void => {
    aimed.value = false
  }
  watch(editMode, (on) => {
    if (!on) settle()
  })
  onMounted(() => {
    window.addEventListener('keydown', onKey)
    window.addEventListener('focusin', settle)
    window.addEventListener('pointerdown', settle)
  })
  onBeforeUnmount(() => {
    window.removeEventListener('keydown', onKey)
    window.removeEventListener('focusin', settle)
    window.removeEventListener('pointerdown', settle)
  })
}
