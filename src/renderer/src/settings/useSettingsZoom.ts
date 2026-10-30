import { onBeforeUnmount, watch } from 'vue'
import { nextZoom, zoomStepOf, type ZoomStep } from '@shared/settingsZoom'
import { useAppearance } from '../composables/useAppearance'
import { optionSetter } from './editor'

/** One wheel step per this long (ms): a flick of the wheel is one step, not five. */
const WHEEL_STEP_MS = 120

/**
 * The settings window's zoom keys (R29): Ctrl + / Ctrl − / Ctrl 0 and Ctrl with the wheel change
 * Apariencia › Accesibilidad › «Tamaño de esta ventana», which main applies to the window. A
 * key the shortcut recorder took (it stops it in the capture phase) never gets here. Mounted
 * once, by the window's root.
 */
export function useSettingsZoom(target: Window = window): void {
  const appearance = useAppearance()
  const set = optionSetter('appearance')('settingsZoom')
  // The value last asked for: several steps before main answers build on each other.
  let asked = appearance.value.settingsZoom
  watch(
    () => appearance.value.settingsZoom,
    (z) => (asked = z)
  )
  const step = (s: ZoomStep): void => {
    const next = nextZoom(asked, s)
    if (next === asked) return
    asked = next
    void set(next)
  }
  const onKey = (e: KeyboardEvent): void => {
    if (e.defaultPrevented) return
    const s = zoomStepOf(e)
    if (s === null) return
    e.preventDefault()
    step(s)
  }
  let wheelAt = -Infinity
  const onWheel = (e: WheelEvent): void => {
    if (!e.ctrlKey || e.deltaY === 0) return
    e.preventDefault()
    if (e.timeStamp - wheelAt < WHEEL_STEP_MS) return
    wheelAt = e.timeStamp
    step(e.deltaY < 0 ? 'in' : 'out')
  }
  target.addEventListener('keydown', onKey)
  target.addEventListener('wheel', onWheel, { passive: false })
  onBeforeUnmount(() => {
    target.removeEventListener('keydown', onKey)
    target.removeEventListener('wheel', onWheel)
  })
}
