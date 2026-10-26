/**
 * The conditions footer of a table widget (the relative, the standings): its options, the
 * readings its payloads carry and the view the footer draws, each kept while equal. The
 * readings ride on every table payload (the relative's 10 Hz) but change about once a second
 * at most, so the view is only rebuilt, and the footer only rendered, when what it shows moves.
 */
import { computed, type ComputedRef } from 'vue'
import { conditionsEqual } from '@shared/conditions'
import { CONDITIONS_FOOTER_FIELDS, type OptionSection } from '@shared/settingsSchema'
import type { ConditionsData, ConditionsFooterOptions, OverlaySettings } from '@shared/types'
import { footerView, reuseFooter, type FooterView } from '../view/conditions'
import { reuseView } from '../view/reuse'
import { useAppearance } from './useAppearance'
import { useI18n } from './useI18n'
import { useOptions } from './useWidgetSettings'

/** Option sections with a conditions footer. */
export type FooterSection = {
  [K in OptionSection]: OverlaySettings[K] extends ConditionsFooterOptions ? K : never
}[OptionSection]

/** Only the footer's fields of a section's options (the table's own do not concern it). */
export function footerOptionsOf(o: ConditionsFooterOptions): ConditionsFooterOptions {
  const out: Record<string, boolean> = {}
  for (const f of CONDITIONS_FOOTER_FIELDS) out[f] = o[f]
  return out as unknown as ConditionsFooterOptions
}

/** `next`, or `prev` when it reads the same (null and null included). */
export function stableReadings(
  prev: ConditionsData | null | undefined,
  next: ConditionsData | null
): ConditionsData | null {
  if (prev === undefined || prev === null || next === null) return next
  return conditionsEqual(prev, next) ? prev : next
}

/** The footer view of `section`'s table, from the readings `readings()` returns. */
export function useConditionsFooter(
  section: FooterSection,
  readings: () => ConditionsData | null
): ComputedRef<FooterView> {
  const options = useOptions(section)
  const opts = computed<ConditionsFooterOptions>((prev) =>
    reuseView(prev, footerOptionsOf(options.value))
  )
  const appearance = useAppearance()
  const units = computed(() => appearance.value.units)
  const t = useI18n()
  const data = computed<ConditionsData | null>((prev) => stableReadings(prev, readings()))
  return computed<FooterView>((prev) =>
    reuseFooter(prev, footerView(data.value, opts.value, units.value, t.value))
  )
}
