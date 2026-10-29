import { describe, expect, it } from 'vitest'
import { defaultOptions } from '@shared/settings'
import { migrateLists } from '@shared/settings/migrate'
import type { ElementEntry, InputsOptions } from '@shared/types'
import { WIDGET_DEFS } from '@shared/widgets'
import { inputsLayout, sameInputsLayout } from './sections'

const D = defaultOptions('inputs')
const list = <Id extends string>(...e: [Id, boolean][]): ElementEntry<Id>[] =>
  e.map(([id, visible]) => ({ id, visible }))

describe('inputsLayout', () => {
  it("the defaults draw today's pedals: trace, bars and info, clutch and every readout", () => {
    const l = inputsLayout(D)
    expect(l).toMatchObject({
      trace: true,
      clutch: true,
      gear: true,
      speed: true,
      steering: true,
      info: true
    })
    expect(l.order).toMatchObject({ trace: 0, bars: 1, info: 2, clutch: 0, brake: 1, throttle: 2 })
    expect(l.order).toMatchObject({ gear: 0, speed: 1, steering: 2 })
  })

  it('follows the order and the eyes of every list', () => {
    const o: Pick<InputsOptions, 'sections' | 'bars' | 'info' | 'car'> = {
      sections: list(['car', true], ['info', true], ['bars', true], ['trace', false]),
      bars: list(['throttle', true], ['brake', true], ['clutch', false]),
      info: list(['steering', true], ['gear', false], ['speed', true]),
      car: list(['ffb', true], ['rpm', true], ['tc', false], ['bias', true])
    }
    const l = inputsLayout(o)
    expect(l).toMatchObject({ trace: false, clutch: false, gear: false, speed: true })
    expect(l.order).toMatchObject({ car: 0, info: 1, bars: 2, throttle: 0, brake: 1, steering: 0 })
    expect(l).toMatchObject({ car: true, rpm: true, bias: true, tc: false, ffb: true })
    expect(l.order).toMatchObject({ ffb: 0, rpm: 1, tc: 2, bias: 3 })
  })

  it('a hidden info block, or one with nothing in it, draws no readout', () => {
    const off = inputsLayout({
      ...D,
      sections: list(['trace', true], ['bars', true], ['info', false])
    })
    expect(off).toMatchObject({ info: false, gear: false, speed: false, steering: false })
    const empty = inputsLayout({
      ...D,
      info: list(['gear', false], ['speed', false], ['steering', false])
    })
    expect(empty.info).toBe(false)
  })

  it('the car block: shown with its readouts, none of them with the block hidden', () => {
    expect(inputsLayout(D)).toMatchObject({ car: true, rpm: true, bias: true, tc: true, ffb: true })
    const hidden = inputsLayout({
      ...D,
      sections: list(['trace', true], ['bars', true], ['info', true], ['car', false])
    })
    expect(hidden).toMatchObject({ car: false, rpm: false, bias: false, tc: false, ffb: false })
    const empty = inputsLayout({
      ...D,
      car: list(['rpm', false], ['bias', false], ['tc', false], ['ffb', false])
    })
    expect(empty.car).toBe(false)
    expect(sameInputsLayout(inputsLayout(D), empty)).toBe(false)
    const moved = inputsLayout({
      ...D,
      car: list(['ffb', true], ['rpm', true], ['bias', true], ['tc', true])
    })
    expect(sameInputsLayout(inputsLayout(D), moved)).toBe(false)
  })

  it('the key changes with anything drawn, and only then', () => {
    const a = inputsLayout(D)
    expect(sameInputsLayout(a, inputsLayout({ ...D }))).toBe(true)
    const moved = inputsLayout({
      ...D,
      bars: list(['brake', true], ['clutch', true], ['throttle', true])
    })
    expect(sameInputsLayout(a, moved)).toBe(false)
    const clutch = inputsLayout({
      ...D,
      bars: list(['clutch', false], ['brake', true], ['throttle', true])
    })
    expect(sameInputsLayout(a, clutch)).toBe(false)
  })

  it('the old layouts read the same through the migration', () => {
    const read = (raw: Record<string, unknown>): ReturnType<typeof inputsLayout> =>
      inputsLayout({ ...D, ...(migrateLists('inputs', raw) as Partial<InputsOptions>) })
    expect(read({ layout: 'bars' })).toMatchObject({ trace: false, info: true })
    const reversed = read({ layout: 'info-bars-trace', showGearSpeed: false })
    expect(reversed.order).toMatchObject({ info: 0, bars: 1, trace: 2 })
    expect(reversed).toMatchObject({ gear: false, speed: false, steering: true })
  })

  it('is an auto-height widget (A.9): the panel fits its content', () => {
    expect(WIDGET_DEFS.inputs.sizeModel).toBe('auto-height')
  })
})
