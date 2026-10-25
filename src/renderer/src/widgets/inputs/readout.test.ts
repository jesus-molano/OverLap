import { describe, expect, it } from 'vitest'
import {
  ClassSlot,
  PREVIEW_READOUT,
  TextSlot,
  TransformSlot,
  WHEEL_LOCK_DEG,
  barTransform,
  fillPreview,
  gearKind,
  gearLabel,
  pedalPercent,
  previewSample,
  speedLabel,
  steerTransform,
  wheelTransform
} from './readout'
import { CH_ABS, CH_BRAKE, CH_CLUTCH, CH_THROTTLE, SampleRing } from './trace'

describe('formatting', () => {
  it('pedalPercent rounds and clamps', () => {
    expect(pedalPercent(0)).toBe(0)
    expect(pedalPercent(0.854)).toBe(85)
    expect(pedalPercent(1.2)).toBe(100)
    expect(pedalPercent(-0.1)).toBe(0)
    expect(pedalPercent(NaN)).toBe(0)
  })

  it('gearLabel and how the gear is drawn', () => {
    expect(gearLabel(-1)).toBe('R')
    expect(gearLabel(0)).toBe('N')
    expect(gearLabel(4)).toBe('4')
    expect(gearLabel(NaN)).toBe('N')
    expect(gearKind(-1)).toBe('reverse')
    expect(gearKind(0)).toBe('neutral')
    expect(gearKind(NaN)).toBe('neutral')
    expect(gearKind(3)).toBe('forward')
  })

  it('speedLabel in the chosen units', () => {
    expect(speedLabel(142.6)).toBe('143')
    expect(speedLabel(160.9, 'imperial')).toBe('100')
    expect(speedLabel(-3)).toBe('0')
    expect(speedLabel(NaN, 'imperial')).toBe('0')
  })

  it('barTransform quantises to hundredths', () => {
    expect(barTransform(0.85)).toBe('scaleY(0.85)')
    expect(barTransform(0.0712)).toBe('scaleY(0.07)')
    expect(barTransform(2)).toBe('scaleY(1)')
    expect(barTransform(0)).toBe('scaleY(0)')
  })

  it('steerTransform mirrors (left = positive steering grows to the left)', () => {
    expect(steerTransform(0.5)).toBe('scaleX(-0.5)')
    expect(steerTransform(-0.25)).toBe('scaleX(0.25)')
    expect(steerTransform(0)).toBe('scaleX(0)')
    expect(steerTransform(3)).toBe('scaleX(-1)')
    expect(steerTransform(NaN)).toBe('scaleX(0)')
  })

  it('wheelTransform turns left (positive) anticlockwise, whole degrees, clamped', () => {
    expect(wheelTransform(0.35)).toBe(`rotate(${-Math.round(0.35 * WHEEL_LOCK_DEG)}deg)`)
    expect(wheelTransform(-0.5)).toBe(`rotate(${0.5 * WHEEL_LOCK_DEG}deg)`)
    expect(wheelTransform(0)).toBe('rotate(0deg)')
    expect(wheelTransform(-0.001)).toBe('rotate(0deg)')
    expect(wheelTransform(5)).toBe(`rotate(${-WHEEL_LOCK_DEG}deg)`)
    expect(wheelTransform(NaN)).toBe('rotate(0deg)')
  })
})

describe('DOM slots', () => {
  it('TextSlot writes only on change or on a new element', () => {
    const slot = new TextSlot()
    let writes = 0
    const make = (): { textContent: string | null } => {
      let v: string | null = null
      return {
        get textContent() {
          return v
        },
        set textContent(next) {
          writes++
          v = next
        }
      }
    }
    const a = make()
    slot.set(a, '10')
    slot.set(a, '10')
    expect(writes).toBe(1)
    slot.set(a, '11')
    expect(writes).toBe(2)
    const b = make()
    slot.set(b, '11')
    expect(writes).toBe(3)
    expect(b.textContent).toBe('11')
    slot.set(null, '12')
    expect(writes).toBe(3)
  })

  it('a removed element is let go: the next one is always written', () => {
    const slot = new TransformSlot()
    const el = { style: { transform: '' } }
    slot.set(el, 'rotate(10deg)')
    slot.set(null, 'rotate(10deg)')
    el.style.transform = ''
    slot.set(el, 'rotate(10deg)')
    expect(el.style.transform).toBe('rotate(10deg)')
    const cls = new ClassSlot('on')
    let toggles = 0
    const target = { classList: { toggle: () => (toggles++, true) } }
    cls.set(target, true)
    cls.set(null, true)
    cls.set(target, true)
    expect(toggles).toBe(2)
  })

  it('TransformSlot writes only on change', () => {
    const slot = new TransformSlot()
    const el = { style: { transform: '' } }
    slot.set(el, 'scaleY(0.5)')
    el.style.transform = 'tampered'
    slot.set(el, 'scaleY(0.5)')
    expect(el.style.transform).toBe('tampered')
    slot.set(el, 'scaleY(0.6)')
    expect(el.style.transform).toBe('scaleY(0.6)')
  })

  it('ClassSlot toggles its token only on change', () => {
    const slot = new ClassSlot('on')
    const toggles: [string, boolean | undefined][] = []
    const el = {
      classList: {
        toggle(token: string, force?: boolean) {
          toggles.push([token, force])
          return force === true
        }
      }
    }
    slot.set(el, false)
    slot.set(el, true)
    slot.set(el, true)
    slot.set(el, false)
    // The first call writes too: the element is new to the slot.
    expect(toggles).toEqual([
      ['on', false],
      ['on', true],
      ['on', false]
    ])
  })
})

describe('preview', () => {
  it('ends on the preview readout and stays in range', () => {
    const end = previewSample(1)
    expect(end.throttle).toBeCloseTo(PREVIEW_READOUT.throttle)
    expect(end.brake).toBeCloseTo(PREVIEW_READOUT.brake)
    expect(end.clutch).toBeCloseTo(PREVIEW_READOUT.clutch)
    expect(end.abs).toBe(PREVIEW_READOUT.abs)
    for (let i = 0; i <= 100; i++) {
      const s = previewSample(i / 100)
      for (const v of [s.throttle, s.brake, s.clutch]) {
        expect(v).toBeGreaterThanOrEqual(0)
        expect(v).toBeLessThanOrEqual(1)
      }
    }
  })

  it('shows a braking zone with ABS and a downshift', () => {
    const ts = Array.from({ length: 101 }, (_, i) => previewSample(i / 100))
    expect(ts[0]?.throttle).toBe(1)
    expect(Math.max(...ts.map((s) => s.brake))).toBeGreaterThan(0.85)
    expect(ts.some((s) => s.abs)).toBe(true)
    expect(Math.max(...ts.map((s) => s.clutch))).toBeGreaterThan(0.5)
  })

  it('fillPreview replaces the ring content with evenly timed samples', () => {
    const r = new SampleRing(400)
    r.push(99, 0.3, 0.3, 0.3, true)
    fillPreview(r, 5, 60)
    expect(r.length).toBe(301)
    expect(r.timeAt(0)).toBe(PREVIEW_READOUT.t)
    expect(r.timeAt(300)).toBeCloseTo(PREVIEW_READOUT.t - 5)
    expect(r.timeAt(0) - r.timeAt(1)).toBeCloseTo(1 / 60)
    expect(r.at(0, CH_THROTTLE)).toBeCloseTo(PREVIEW_READOUT.throttle)
    expect(r.at(0, CH_BRAKE)).toBeCloseTo(PREVIEW_READOUT.brake)
    expect(r.at(300, CH_THROTTLE)).toBe(1)
    expect(r.at(300, CH_CLUTCH)).toBe(0)
    expect(r.at(300, CH_ABS)).toBe(0)
    const small = new SampleRing(50)
    fillPreview(small, 5, 60)
    expect(small.length).toBe(50)
  })
})
