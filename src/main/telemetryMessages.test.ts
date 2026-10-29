import { describe, expect, it } from 'vitest'
import { parseBestList, parseStatus, parseTelemetryMessage } from './telemetryMessages'

describe('parseTelemetryMessage', () => {
  it('accepts valid status, data and log messages', () => {
    const status = { state: 'connected', source: 'iracing', note: 'none', detail: '' }
    expect(parseTelemetryMessage({ type: 'status', status })).toEqual({ type: 'status', status })
    expect(parseTelemetryMessage({ type: 'data', widget: 'radar', payload: { cars: [] } })).toEqual(
      { type: 'data', widget: 'radar', payload: { cars: [] } }
    )
    expect(parseTelemetryMessage({ type: 'log', level: 'warn', message: 'x' })).toEqual({
      type: 'log',
      level: 'warn',
      message: 'x'
    })
  })

  it('accepts auto-hidden messages and drops extra fields', () => {
    const msg = {
      type: 'auto-hidden',
      widget: 'battle',
      hidden: true,
      reason: 'practice'
    }
    expect(parseTelemetryMessage({ ...msg, extra: 1 })).toEqual(msg)
    expect(
      parseTelemetryMessage({ type: 'auto-hidden', widget: 'radar', hidden: false, reason: null })
    ).toEqual({ type: 'auto-hidden', widget: 'radar', hidden: false, reason: null })
    for (const reason of [
      'qualify',
      'race',
      'pits',
      'garage',
      'ui-hidden',
      'replay',
      'replay-player'
    ]) {
      expect(parseTelemetryMessage({ ...msg, reason })).toEqual({ ...msg, reason })
    }
    expect(parseTelemetryMessage({ ...msg, reason: 'replays' })).toBeNull()
  })

  it('accepts the personal-best list, dropping extra fields', () => {
    const entry = {
      key: '67@219/Grand Prix',
      car: 'Porsche 911 GT3 R',
      track: 'Spa',
      layout: 'Grand Prix',
      lapTime: 137.5,
      recordedAt: '2026-10-25T10:00:00.000Z'
    }
    const current = { key: entry.key, car: entry.car, track: entry.track, layout: entry.layout }
    expect(
      parseTelemetryMessage({
        type: 'bests',
        list: { entries: [{ ...entry, profile: [0, 1] }], current: { ...current, extra: 1 } }
      })
    ).toEqual({ type: 'bests', list: { entries: [entry], current } })
    expect(parseBestList({ entries: [], current: null })).toEqual({ entries: [], current: null })

    for (const bad of [
      null,
      { entries: [] },
      { entries: {}, current: null },
      { entries: [{ ...entry, lapTime: -1 }], current: null },
      { entries: [{ ...entry, lapTime: Number.NaN }], current: null },
      { entries: [{ ...entry, key: '' }], current: null },
      { entries: [{ ...entry, car: 3 }], current: null },
      { entries: [{ ...entry, recordedAt: 'x'.repeat(201) }], current: null },
      { entries: [], current: { ...current, layout: undefined } },
      { entries: new Array(1001).fill(entry), current: null }
    ]) {
      expect(parseBestList(bad)).toBeNull()
      expect(parseTelemetryMessage({ type: 'bests', list: bad })).toBeNull()
    }
  })

  it('parses the kind of session, null included, and nothing else', () => {
    for (const kind of ['practice', 'qualify', 'race', null]) {
      expect(parseTelemetryMessage({ type: 'session-kind', kind })).toEqual({
        type: 'session-kind',
        kind
      })
    }
    for (const kind of ['Race', 'warmup', 1, undefined, {}]) {
      expect(parseTelemetryMessage({ type: 'session-kind', kind })).toBeNull()
    }
  })

  it('parses the player car, null included, and nothing malformed', () => {
    expect(
      parseTelemetryMessage({ type: 'player-car', car: { carId: 67, carName: 'Mazda', x: 1 } })
    ).toEqual({ type: 'player-car', car: { carId: 67, carName: 'Mazda' } })
    expect(parseTelemetryMessage({ type: 'player-car', car: null })).toEqual({
      type: 'player-car',
      car: null
    })
    for (const car of [undefined, {}, { carId: 0 }, { carId: -3 }, { carId: 1.5 }, 'Mazda']) {
      expect(parseTelemetryMessage({ type: 'player-car', car })).toBeNull()
    }
  })

  it('drops extra fields from status', () => {
    expect(
      parseStatus({ state: 'mock', source: 'mock', note: 'none', detail: '', message: 'x' })
    ).toEqual({ state: 'mock', source: 'mock', note: 'none', detail: '' })
  })

  it('accepts every status note and an error detail', () => {
    for (const note of ['none', 'restarting', 'native-missing']) {
      const status = { state: 'error', source: 'iracing', note, detail: 'boom' }
      expect(parseStatus(status)).toEqual(status)
    }
  })

  it('rejects malformed messages', () => {
    for (const raw of [
      null,
      'status',
      42,
      {},
      { type: 'nope' },
      { type: 'status' },
      { type: 'status', status: { state: 'flying', source: 'mock', note: 'none', detail: '' } },
      { type: 'status', status: { state: 'mock', source: 'rf2', note: 'none', detail: '' } },
      { type: 'status', status: { state: 'mock', source: 'mock', note: 'none', detail: 3 } },
      { type: 'status', status: { state: 'mock', source: 'mock', note: 'oops', detail: '' } },
      { type: 'status', status: { state: 'mock', source: 'mock', detail: '' } },
      // The old shape, with a sentence.
      { type: 'status', status: { state: 'mock', source: 'mock', message: 'Simulado' } },
      { type: 'data', widget: 'pitboard', payload: {} },
      { type: 'data', widget: 'radar', payload: null },
      { type: 'data', widget: 'radar' },
      { type: 'log', level: 'debug', message: 'x' },
      { type: 'log', level: 'info' },
      { type: 'auto-hidden', widget: 'pitboard', hidden: true, reason: 'race' },
      { type: 'auto-hidden', widget: 'battle', hidden: 1, reason: 'race' },
      { type: 'auto-hidden', widget: 'battle', hidden: true },
      { type: 'auto-hidden', widget: 'battle', hidden: false, reason: '' },
      { type: 'auto-hidden', widget: 'battle', hidden: true, reason: 'Oculto en práctica' },
      { type: 'auto-hidden', widget: 'battle', reason: 'x' }
    ]) {
      expect(parseTelemetryMessage(raw)).toBeNull()
    }
  })
})
