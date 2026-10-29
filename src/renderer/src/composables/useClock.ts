/**
 * Your computer's local time for the info bars' `clock` item ('21:07'): one ticking source per
 * window, running only while some bar shows it (reference counted), and updated on the minute,
 * not every frame.
 */
import { computed, onScopeDispose, shallowRef, watch, type ComputedRef } from 'vue'
import { useLocale } from './useI18n'

const now = shallowRef(Date.now())
let users = 0
let timer: ReturnType<typeof setTimeout> | null = null

function schedule(): void {
  const t = Date.now()
  now.value = t
  // The next minute boundary, a hair after it so the minute has changed.
  timer = setTimeout(schedule, 60_000 - (t % 60_000) + 20)
}

function acquire(): void {
  if (users++ === 0) schedule()
}

function release(): void {
  if (--users > 0 || timer === null) return
  clearTimeout(timer)
  timer = null
}

/** 'HH:MM' in the interface language's 24-hour style (minutes resolution). */
export function clockText(ms: number, locale: string): string {
  try {
    return new Date(ms).toLocaleTimeString(locale, {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    })
  } catch {
    const d = new Date(ms)
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  }
}

/** The local time while `enabled()` (a bar shows the clock); '' otherwise. */
export function useClock(enabled: () => boolean): ComputedRef<string> {
  const locale = useLocale()
  let held = false
  const stop = watch(
    enabled,
    (on) => {
      if (on === held) return
      held = on
      if (on) acquire()
      else release()
    },
    { immediate: true }
  )
  onScopeDispose(() => {
    stop()
    if (held) release()
    held = false
  })
  return computed(() => (enabled() ? clockText(now.value, locale.value) : ''))
}
