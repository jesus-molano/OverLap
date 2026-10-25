import { computed, onScopeDispose, shallowRef, type ComputedRef, type ShallowRef } from 'vue'
import type {
  PersonalBestLabel,
  PersonalBestList,
  PersonalBestSummary
} from '@shared/delta/references'
import { formatLapTime } from '@shared/format'
import { LOCALES, type Language, type Messages } from '@shared/i18n'
import { sendCommand } from './editor'

/** How a stored personal best reads in the list. */
export interface BestRow {
  key: string
  car: string
  /** 'Spa-Francorchamps · Grand Prix'. */
  place: string
  time: string
  /** '25 oct 2026' ('25 Oct 2026' in English), '' when unknown. */
  date: string
}

/** One date format per language, built the first time it is needed. */
const DATES = new Map<Language, Intl.DateTimeFormat>()

function dateFormat(lang: Language): Intl.DateTimeFormat {
  let f = DATES.get(lang)
  if (f === undefined) {
    f = new Intl.DateTimeFormat(LOCALES[lang], { day: 'numeric', month: 'short', year: 'numeric' })
    DATES.set(lang, f)
  }
  return f
}

/** '25 oct 2026' in Spanish, '25 Oct 2026' in English; '' for an empty or invalid ISO date. */
export function formatRecordDate(iso: string, lang: Language): string {
  if (iso === '') return ''
  const t = Date.parse(iso)
  // Spanish short months end in a dot ('oct.').
  return Number.isFinite(t) ? dateFormat(lang).format(t).replace('.', '') : ''
}

export function carText(m: Messages, label: PersonalBestLabel): string {
  return label.car || m.settings.personalBests.unnamedCar
}

/** Track and layout: 'Spa-Francorchamps · Grand Prix'; just the track when it has one layout. */
export function placeText(m: Messages, label: PersonalBestLabel): string {
  const track = label.track || m.settings.personalBests.unnamedTrack
  return label.layout ? `${track} · ${label.layout}` : track
}

export function toRow(e: PersonalBestSummary, m: Messages, lang: Language): BestRow {
  return {
    key: e.key,
    car: carText(m, e),
    place: placeText(m, e),
    time: formatLapTime(e.lapTime),
    date: formatRecordDate(e.recordedAt, lang)
  }
}

/** Lower case without accents: 'Nürburgring' matches 'nurbur'. */
export function foldText(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

/** Every word of the query appears in the car, track or layout name. */
export function matchesQuery(e: PersonalBestLabel, query: string): boolean {
  const words = foldText(query).split(/\s+/).filter(Boolean)
  if (words.length === 0) return true
  const hay = foldText(`${e.car} ${e.track} ${e.layout}`)
  return words.every((w) => hay.includes(w))
}

export interface PersonalBests {
  /** Null until main sent the first list. */
  readonly list: Readonly<ShallowRef<PersonalBestList | null>>
  /** The list without what is being deleted (shown gone at once). */
  readonly entries: ComputedRef<readonly PersonalBestSummary[]>
  /** The stored best of the car + layout being driven, null when none (or not driving). */
  readonly currentBest: ComputedRef<PersonalBestSummary | null>
  remove(keys: readonly string[]): void
  removeAll(): void
}

const NOTHING: ReadonlySet<string> = new Set()

/**
 * The personal bests of the telemetry process, for the settings window: asks
 * main for them once and follows every change until the owning scope ends.
 * Deleting hides the entries at once; the next list from main (the result,
 * or the unchanged one when the telemetry process could not do it) settles it.
 */
export function usePersonalBests(): PersonalBests {
  const list = shallowRef<PersonalBestList | null>(null)
  const removing = shallowRef<ReadonlySet<string>>(NOTHING)
  /** Every entry is being deleted. */
  const clearing = shallowRef(false)

  const off = window.overlay.onPersonalBests((next) => {
    list.value = next
    removing.value = NOTHING
    clearing.value = false
  })
  onScopeDispose(off)
  sendCommand({ type: 'refresh-personal-bests' })

  const entries = computed<readonly PersonalBestSummary[]>(() => {
    if (clearing.value) return []
    const all = list.value?.entries ?? []
    const gone = removing.value
    return gone.size === 0 ? all : all.filter((e) => !gone.has(e.key))
  })

  const currentBest = computed(() => {
    const key = list.value?.current?.key
    return key === undefined ? null : (entries.value.find((e) => e.key === key) ?? null)
  })

  return {
    list,
    entries,
    currentBest,
    remove(keys) {
      if (keys.length === 0) return
      const next = new Set(removing.value)
      for (const k of keys) next.add(k)
      removing.value = next
      sendCommand({ type: 'delete-personal-bests', keys: [...keys] })
    },
    removeAll() {
      clearing.value = true
      sendCommand({ type: 'clear-personal-bests' })
    }
  }
}
