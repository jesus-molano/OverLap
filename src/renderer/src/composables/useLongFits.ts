import { computed, type ComputedRef, type Ref } from 'vue'
import { useElementSize, type ElementSize, type MaybeElement } from './useElementSize'

/**
 * Full words only where they fit (R50): a line that has a long wording ('PRESIÓN ACEITE') and a
 * short one ('P. ACEITE') draws the long one only while a hidden copy of the line in those words
 * (`probe`: absolutely placed, max-content wide) is no wider than the room the line has (`box`'s
 * content box). The widget never grows or wraps for them: where they do not fit, it keeps the
 * short words it always drew. Until both are measured, the short words.
 */
export function longFits(probe: ElementSize, box: ElementSize): boolean {
  // Half a pixel of layout rounding.
  return probe.w > 0 && box.w > 0 && probe.w <= box.w + 0.5
}

export function useLongFits(
  probe: Readonly<Ref<MaybeElement>>,
  box: Readonly<Ref<MaybeElement>>
): ComputedRef<boolean> {
  const p = useElementSize(probe, { box: 'border-box' })
  const b = useElementSize(box)
  return computed(() => longFits(p.value, b.value))
}
