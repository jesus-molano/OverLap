import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope } from 'vue'
import type { PersonalBestList, PersonalBestSummary } from '@shared/delta/references'
import { messagesFor } from '@shared/i18n'
import { createFakeOverlay, type FakeOverlay } from '../composables/testing/fakeOverlay'

type Module = typeof import('./personalBests')

const es = messagesFor('es')
const en = messagesFor('en')

let fake: FakeOverlay
let mod: Module

beforeEach(async () => {
  vi.resetModules()
  fake = createFakeOverlay({ view: { kind: 'settings' } })
  vi.stubGlobal('window', { overlay: fake })
  mod = await import('./personalBests')
})

afterEach(() => {
  vi.unstubAllGlobals()
})

const SPA: PersonalBestSummary = {
  key: '67@219/Grand Prix',
  car: 'Porsche 911 GT3 R',
  track: 'Circuit de Spa-Francorchamps',
  layout: 'Grand Prix',
  lapTime: 137.512,
  recordedAt: '2026-10-25T10:00:00.000Z'
}
const OKAYAMA: PersonalBestSummary = {
  key: '80@166/',
  car: 'Mazda MX-5 Cup',
  track: 'Okayama',
  layout: '',
  lapTime: 99.1,
  recordedAt: '2026-10-20T10:00:00.000Z'
}
const NURB: PersonalBestSummary = {
  ...OKAYAMA,
  key: '80@252/Nordschleife',
  track: 'Nürburgring',
  layout: 'Nordschleife'
}

function listOf(
  entries: PersonalBestSummary[],
  current: PersonalBestList['current'] = null
): PersonalBestList {
  return { entries, current }
}

describe('row text', () => {
  it('names the car and the place, falling back when unknown', () => {
    expect(mod.toRow(SPA, es, 'es')).toEqual({
      key: SPA.key,
      car: 'Porsche 911 GT3 R',
      place: 'Circuit de Spa-Francorchamps · Grand Prix',
      time: '2:17.512',
      date: '25 oct 2026'
    })
    expect(mod.placeText(es, OKAYAMA)).toBe('Okayama')
    expect(
      mod.toRow({ ...SPA, car: '', track: '', layout: '', recordedAt: '' }, es, 'es')
    ).toMatchObject({
      car: 'Coche sin nombre',
      place: 'Circuito sin nombre',
      date: ''
    })
  })

  it('formats only valid dates', () => {
    expect(mod.formatRecordDate('nope', 'es')).toBe('')
    expect(mod.formatRecordDate('', 'en')).toBe('')
    expect(mod.formatRecordDate('2026-01-05T12:00:00.000Z', 'es')).toBe('5 ene 2026')
  })

  it('words the row in English with the English dictionary and locale', () => {
    expect(mod.formatRecordDate('2026-01-05T12:00:00.000Z', 'en')).toBe('5 Jan 2026')
    expect(mod.toRow(SPA, en, 'en')).toMatchObject({
      car: 'Porsche 911 GT3 R',
      place: 'Circuit de Spa-Francorchamps · Grand Prix',
      date: '25 Oct 2026'
    })
    expect(
      mod.toRow({ ...SPA, car: '', track: '', layout: '', recordedAt: '' }, en, 'en')
    ).toMatchObject({ car: 'Unnamed car', place: 'Unnamed track', date: '' })
    expect(mod.carText(en, NURB)).toBe('Mazda MX-5 Cup')
  })

  it('counts and confirms in both languages', () => {
    const pbEs = es.settings.personalBests
    const pbEn = en.settings.personalBests
    expect(pbEs.count(1)).toBe('1 récord guardado')
    expect(pbEs.count(3)).toBe('3 récords guardados')
    expect(pbEs.deleteAll.confirm(1)).toBe('¿Borrarlo? Pulsa otra vez')
    expect(pbEs.deleteAll.confirm(4)).toBe('¿Borrar los 4? Pulsa otra vez')
    expect(pbEs.noMatch('spa')).toBe('Ningún récord coincide con «spa».')
    expect(pbEn.count(1)).toBe('1 personal best saved')
    expect(pbEn.count(3)).toBe('3 personal bests saved')
    expect(pbEn.deleteAll.confirm(4)).toBe('Delete all 4? Click again')
    expect(pbEn.record('2:17.512')).toBe('PB 2:17.512')
  })

  it('searches every word in car, track and layout, without case or accents', () => {
    expect(mod.matchesQuery(NURB, 'nurbur')).toBe(true)
    expect(mod.matchesQuery(NURB, 'MX-5 norDS')).toBe(true)
    expect(mod.matchesQuery(NURB, 'mx-5 spa')).toBe(false)
    expect(mod.matchesQuery(SPA, '  ')).toBe(true)
  })
})

describe('usePersonalBests', () => {
  it('asks main for the list once and follows it until its scope ends', () => {
    const scope = effectScope()
    const bests = scope.run(() => mod.usePersonalBests())
    if (!bests) throw new Error('no scope')
    expect(fake.sent.commands).toEqual([{ type: 'refresh-personal-bests' }])
    expect(bests.list.value).toBeNull()
    expect(bests.entries.value).toEqual([])

    fake.personalBests.emit(listOf([SPA, OKAYAMA], { ...SPA }))
    expect(bests.entries.value).toEqual([SPA, OKAYAMA])
    expect(bests.currentBest.value).toEqual(SPA)

    scope.stop()
    expect(fake.listenerCount()).toBe(0)
  })

  it('has no current best when the car + layout being driven has none', () => {
    const scope = effectScope()
    const bests = scope.run(() => mod.usePersonalBests())
    fake.personalBests.emit(listOf([OKAYAMA], { ...SPA }))
    expect(bests?.currentBest.value).toBeNull()
    fake.personalBests.emit(listOf([OKAYAMA]))
    expect(bests?.currentBest.value).toBeNull()
    scope.stop()
  })

  it('hides what it deletes at once; the next list settles it', () => {
    const scope = effectScope()
    const bests = scope.run(() => mod.usePersonalBests())
    if (!bests) throw new Error('no scope')
    fake.personalBests.emit(listOf([SPA, OKAYAMA], { ...SPA }))

    bests.remove([SPA.key])
    expect(fake.sent.commands.at(-1)).toEqual({ type: 'delete-personal-bests', keys: [SPA.key] })
    expect(bests.entries.value).toEqual([OKAYAMA])
    expect(bests.currentBest.value).toBeNull()

    // The telemetry process could not do it: main sends the unchanged list back.
    fake.personalBests.emit(listOf([SPA, OKAYAMA], { ...SPA }))
    expect(bests.entries.value).toEqual([SPA, OKAYAMA])

    bests.removeAll()
    expect(fake.sent.commands.at(-1)).toEqual({ type: 'clear-personal-bests' })
    expect(bests.entries.value).toEqual([])
    fake.personalBests.emit(listOf([]))
    expect(bests.entries.value).toEqual([])

    const sent = fake.sent.commands.length
    bests.remove([])
    expect(fake.sent.commands).toHaveLength(sent)
    scope.stop()
  })
})
