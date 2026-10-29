/**
 * One info bar of a widget (infoBar.ts INFO_BARS): its entries from the options, its view from
 * the payload's InfoBarData (view/infoBar.ts), each kept while equal, so a 10 Hz payload that
 * reads the same re-renders nothing in the bar. The local clock ticks only while the bar shows it.
 *
 *   const head = useInfoBar('relative', 'headerBar', () => source.value?.info ?? null)
 *   <InfoBar v-if="head.shown.value" :view="head.view.value" :size="head.size.value" place="head" />
 */
import { computed, type ComputedRef } from 'vue'
import type { InfoBarField, InfoBarSection } from '@shared/infoBar'
import type { ElementEntry, InfoBarData, InfoBarEntryId, InfoBarSize } from '@shared/types'
import {
  barEntries,
  hasInfoBar,
  infoBarView,
  reuseInfoBar,
  type InfoBarContext,
  type InfoBarView
} from '../view/infoBar'
import { useAppearance } from './useAppearance'
import { useClock } from './useClock'
import { useI18n } from './useI18n'
import { useOptions } from './useWidgetSettings'
import { useWidgetTitle } from './useWidgetTitle'

export interface InfoBarHandle {
  /** What the bar draws (NO_BAR with its size 'off' or nothing to show). */
  readonly view: ComputedRef<InfoBarView>
  /** Its size, never 'off' while `shown`. */
  readonly size: ComputedRef<Exclude<InfoBarSize, 'off'>>
  /** The bar is drawn (it takes its height: the panels' maths add it). */
  readonly shown: ComputedRef<boolean>
}

export interface InfoBarExtras {
  /** Shown by the `session` item while the session type is unknown (the standings: its name). */
  sessionFallback?: () => string
}

function sameEntries(a: readonly InfoBarEntryId[], b: readonly InfoBarEntryId[]): boolean {
  return a.length === b.length && a.every((id, i) => id === b[i])
}

export function useInfoBar<S extends InfoBarSection>(
  section: S,
  bar: InfoBarField<S>,
  data: () => InfoBarData | null,
  extras: InfoBarExtras = {}
): InfoBarHandle {
  const options = useOptions(section)
  const appearance = useAppearance()
  const t = useI18n()
  const title = useWidgetTitle(section)
  const sizeField = `${bar}Size`
  const rawSize = computed<InfoBarSize>(() => {
    const o = options.value as unknown as Readonly<Record<string, unknown>>
    return (o[sizeField] as InfoBarSize | undefined) ?? 'off'
  })
  const entries = computed<readonly InfoBarEntryId[]>((prev) => {
    const o = options.value as unknown as Readonly<Record<string, unknown>>
    const list = (o[bar] as readonly ElementEntry<InfoBarEntryId>[] | undefined) ?? []
    const next = barEntries(list, rawSize.value)
    return prev !== undefined && sameEntries(prev, next) ? prev : next
  })
  const clock = useClock(() => entries.value.includes('clock'))
  const ctx = computed<InfoBarContext>(() => {
    const o = options.value as unknown as Readonly<Record<string, unknown>>
    return {
      title: title.value,
      sessionFallback: extras.sessionFallback?.() ?? '',
      clock: clock.value,
      units: appearance.value.units,
      trend: o.conditionsTrend !== false,
      windDirection: o.conditionsWindDirection !== false,
      m: t.value
    }
  })
  const view = computed<InfoBarView>((prev) =>
    reuseInfoBar(prev, infoBarView(entries.value, data(), ctx.value))
  )
  const size = computed<Exclude<InfoBarSize, 'off'>>(() =>
    rawSize.value === 'off' ? 'normal' : rawSize.value
  )
  const shown = computed(() => rawSize.value !== 'off' && hasInfoBar(view.value))
  return { view, size, shown }
}
