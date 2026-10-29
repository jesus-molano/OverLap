import { describe, expect, it } from 'vitest'
import {
  parseBoundsCommit,
  parseDragState,
  parseEditChips,
  parseScaleStep,
  parseOpenWidgetPage,
  parseWidgetToggle
} from './overlayMessages'

const RECT = { x: 10, y: -20, width: 300, height: 200 }
const HEAD = { session: 2, seq: 5, widget: 'radar' }

describe('parseBoundsCommit', () => {
  it('accepts drags and wheel notches with a sane rect and a revision, dropping extra fields', () => {
    expect(parseBoundsCommit({ ...HEAD, kind: 'drag', revision: 9, rect: RECT, x: 1 })).toEqual({
      ...HEAD,
      kind: 'drag',
      revision: 9,
      rect: RECT
    })
    expect(
      parseBoundsCommit({ ...HEAD, kind: 'wheel', revision: 0, rect: { ...RECT, extra: 1 } })
    ).toEqual({ ...HEAD, kind: 'wheel', revision: 0, rect: RECT })
  })

  it('accepts fits and drops, clamping the grab into the size', () => {
    expect(parseBoundsCommit({ ...HEAD, kind: 'fit', height: 296.5 })).toEqual({
      ...HEAD,
      kind: 'fit',
      height: 296.5
    })
    expect(
      parseBoundsCommit({
        ...HEAD,
        kind: 'drop-outside',
        grab: { x: -5, y: 900 },
        size: { width: 220, height: 260 }
      })
    ).toEqual({
      ...HEAD,
      kind: 'drop-outside',
      grab: { x: 0, y: 260 },
      size: { width: 220, height: 260 }
    })
  })

  it('rejects a bad session, sequence number or widget', () => {
    const ok = { ...HEAD, kind: 'fit', height: 100 }
    for (const raw of [
      { ...ok, session: 0 },
      { ...ok, session: 1.5 },
      { ...ok, session: '2' },
      { ...ok, seq: 0 },
      { ...ok, seq: Number.MAX_SAFE_INTEGER + 2 },
      { ...ok, seq: -1 },
      { ...ok, widget: 'pitboard' },
      { ...ok, widget: 'toString' },
      { ...ok, session: undefined }
    ]) {
      expect(parseBoundsCommit(raw), JSON.stringify(raw)).toBeNull()
    }
  })

  it('rejects anything that is not a sane rect, height, grab or size', () => {
    for (const raw of [
      null,
      'drag',
      [],
      { ...HEAD },
      { ...HEAD, kind: 'teleport', rect: RECT, revision: 1 },
      { ...HEAD, kind: 'drag', rect: RECT },
      { ...HEAD, kind: 'drag', rect: RECT, revision: -1 },
      { ...HEAD, kind: 'drag', rect: RECT, revision: 1.5 },
      { ...HEAD, kind: 'drag', revision: 1 },
      { ...HEAD, kind: 'drag', revision: 1, rect: { ...RECT, x: Number.NaN } },
      { ...HEAD, kind: 'drag', revision: 1, rect: { ...RECT, y: 100_001 } },
      { ...HEAD, kind: 'drag', revision: 1, rect: { ...RECT, width: 0 } },
      { ...HEAD, kind: 'drag', revision: 1, rect: { ...RECT, height: 10_001 } },
      { ...HEAD, kind: 'wheel', revision: 1, rect: { ...RECT, width: '300' } },
      { ...HEAD, kind: 'fit', height: 0 },
      { ...HEAD, kind: 'fit', height: 10_001 },
      { ...HEAD, kind: 'fit', height: Infinity },
      { ...HEAD, kind: 'fit' },
      { ...HEAD, kind: 'drop-outside', grab: { x: 0, y: 0 } },
      { ...HEAD, kind: 'drop-outside', size: { width: 10, height: 10 } },
      { ...HEAD, kind: 'drop-outside', grab: { x: Number.NaN, y: 0 }, size: RECT },
      { ...HEAD, kind: 'drop-outside', grab: { x: 0, y: 0 }, size: { width: 0, height: 10 } }
    ]) {
      expect(parseBoundsCommit(raw), JSON.stringify(raw)).toBeNull()
    }
  })
})

describe('parseScaleStep', () => {
  it('accepts one notch up or down', () => {
    expect(parseScaleStep({ session: 1, widget: 'standings', step: 1 })).toEqual({
      session: 1,
      widget: 'standings',
      step: 1
    })
    expect(parseScaleStep({ session: 3, widget: 'battle', step: -1, x: 2 })).toEqual({
      session: 3,
      widget: 'battle',
      step: -1
    })
  })

  it('rejects anything else', () => {
    for (const raw of [
      null,
      { session: 1, widget: 'standings', step: 2 },
      { session: 1, widget: 'standings', step: '1' },
      { session: 1, widget: 'standings', step: 0 },
      { session: 0, widget: 'standings', step: 1 },
      { session: 1, widget: 'nope', step: 1 },
      { widget: 'standings', step: 1 }
    ]) {
      expect(parseScaleStep(raw), JSON.stringify(raw)).toBeNull()
    }
  })
})

describe('parseDragState', () => {
  it('accepts a session and a boolean', () => {
    expect(parseDragState({ session: 4, dragging: true })).toEqual({ session: 4, dragging: true })
    expect(parseDragState({ session: 4, dragging: false, y: 1 })).toEqual({
      session: 4,
      dragging: false
    })
  })

  it('rejects anything else', () => {
    for (const raw of [
      null,
      true,
      { session: 4, dragging: 1 },
      { session: 4 },
      { session: 0, dragging: true },
      { session: -1, dragging: true },
      { dragging: true }
    ]) {
      expect(parseDragState(raw), JSON.stringify(raw)).toBeNull()
    }
  })
})

describe('parseOpenWidgetPage (R25)', () => {
  it('accepts one widget of a document, dropping extra fields', () => {
    expect(parseOpenWidgetPage({ session: 2, widget: 'fuel', x: 1 })).toEqual({
      session: 2,
      widget: 'fuel'
    })
  })

  it('rejects anything else', () => {
    for (const raw of [
      null,
      [],
      { session: 2 },
      { session: 0, widget: 'fuel' },
      { session: 2, widget: 'x' }
    ]) {
      expect(parseOpenWidgetPage(raw)).toBeNull()
    }
  })
})

describe('parseWidgetToggle', () => {
  it('accepts the eye and the padlock of a widget, dropping extra fields', () => {
    expect(
      parseWidgetToggle({ session: 3, widget: 'radar', field: 'visible', value: false })
    ).toEqual({ session: 3, widget: 'radar', field: 'visible', value: false })
    expect(
      parseWidgetToggle({ session: 3, widget: 'alerts', field: 'locked', value: true, x: 1 })
    ).toEqual({ session: 3, widget: 'alerts', field: 'locked', value: true })
  })

  it('rejects anything else', () => {
    for (const raw of [
      null,
      [],
      { session: 3, widget: 'radar', field: 'visible' },
      { session: 3, widget: 'radar', field: 'visible', value: 'false' },
      { session: 3, widget: 'radar', field: 'bounds', value: true },
      { session: 3, widget: 'nope', field: 'locked', value: true },
      { session: 0, widget: 'radar', field: 'locked', value: true },
      { widget: 'radar', field: 'locked', value: true }
    ]) {
      expect(parseWidgetToggle(raw), JSON.stringify(raw)).toBeNull()
    }
  })
})

describe('parseEditChips', () => {
  const CHIP = { x: 120, y: 4, width: 180, height: 20 }

  it('accepts one chip per widget with a sane rect, dropping extra fields', () => {
    expect(
      parseEditChips({
        session: 2,
        chips: [
          { widget: 'radar', rect: CHIP, extra: 1 },
          { widget: 'alerts', rect: { ...CHIP, x: -3 } }
        ]
      })
    ).toEqual({
      session: 2,
      chips: [
        { widget: 'radar', rect: CHIP },
        { widget: 'alerts', rect: { ...CHIP, x: -3 } }
      ]
    })
    expect(parseEditChips({ session: 2, chips: [] })).toEqual({ session: 2, chips: [] })
  })

  it('rejects the whole message for any bad entry', () => {
    for (const raw of [
      null,
      { session: 2 },
      { session: 2, chips: {} },
      { session: 0, chips: [] },
      { session: 2, chips: [{ widget: 'nope', rect: CHIP }] },
      { session: 2, chips: [{ widget: 'radar' }] },
      { session: 2, chips: [{ widget: 'radar', rect: { ...CHIP, width: 0 } }] },
      { session: 2, chips: [{ widget: 'radar', rect: { ...CHIP, x: Number.NaN } }] },
      { session: 2, chips: [{ widget: 'radar', rect: { ...CHIP, y: 50_000 } }] },
      {
        session: 2,
        chips: [
          { widget: 'radar', rect: CHIP },
          { widget: 'radar', rect: CHIP }
        ]
      },
      { session: 2, chips: Array.from({ length: 20 }, () => ({ widget: 'radar', rect: CHIP })) }
    ]) {
      expect(parseEditChips(raw), JSON.stringify(raw)).toBeNull()
    }
  })
})
