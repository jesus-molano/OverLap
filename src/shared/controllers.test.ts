import { describe, expect, it } from 'vitest'
import {
  MAX_DEVICE_NAME,
  MAX_DEVICE_NAMES,
  boundControllers,
  buttonBinding,
  cleanControllerName,
  controllerId,
  fallbackControllerName,
  isButtonBinding,
  isControllerId,
  normalizeDeviceNames,
  parseButtonBinding,
  updateDeviceNames
} from './controllers'

const G29_PATH =
  '\\\\?\\HID#VID_046D&PID_C24F&MI_00#8&17280a47&0&0000#{4d1e55b2-f16f-11cf-88cb-001111000030}'

describe('controllerId', () => {
  it('is the vendor, product and interface of the device path, lowercase', () => {
    expect(controllerId(0x046d, 0xc24f, G29_PATH)).toBe('joy:046d:c24f:0')
    expect(controllerId(0x046d, 0xc24f, G29_PATH.replace('MI_00', 'MI_02'))).toBe(
      'joy:046d:c24f:02'
    )
    expect(controllerId(0x0eb7, 0x0e05, '\\\\?\\HID#VID_0EB7&PID_0E05&MI_01&COL02#a&1#{x}')).toBe(
      'joy:0eb7:0e05:0102'
    )
    expect(controllerId(0x0eb7, 0x0e05, '\\\\?\\HID#VID_0EB7&PID_0E05&Col03#a&1#{x}')).toBe(
      'joy:0eb7:0e05:0003'
    )
  })

  it('is 0 without an interface or a collection, and ignores the USB instance', () => {
    expect(controllerId(0x1dd2, 0x2201, '\\\\?\\HID#VID_1DD2&PID_2201#7&2a1&0&0000#{x}')).toBe(
      'joy:1dd2:2201:0'
    )
    // Another port: same id.
    expect(controllerId(0x1dd2, 0x2201, '\\\\?\\HID#VID_1DD2&PID_2201#7&99&0&0000#{x}')).toBe(
      'joy:1dd2:2201:0'
    )
    expect(isControllerId(controllerId(0x1dd2, 0x2201, ''))).toBe(true)
  })
})

describe('button bindings', () => {
  it('are a controller and a button from 1', () => {
    expect(buttonBinding('joy:046d:c24f:0', 7)).toBe('joy:046d:c24f:0:7')
    expect(parseButtonBinding('joy:046d:c24f:0:7')).toEqual({
      device: 'joy:046d:c24f:0',
      button: 7
    })
    expect(parseButtonBinding('joy:0eb7:0e05:0102:128')).toEqual({
      device: 'joy:0eb7:0e05:0102',
      button: 128
    })
    expect(isButtonBinding('joy:046d:c24f:0:65535')).toBe(true)
  })

  it('refuse anything else', () => {
    for (const bad of [
      'joy:046d:c24f:0:0',
      'joy:046d:c24f:0:07',
      'joy:046d:c24f:0:65536',
      'joy:046D:c24f:0:7',
      'joy:46d:c24f:0:7',
      'joy:046d:c24f:7',
      'joy:046d:c24f:0:7 ',
      'Ctrl+Shift+H',
      '',
      7,
      null
    ]) {
      expect(isButtonBinding(bad), String(bad)).toBe(false)
    }
  })

  it('name the controllers they use', () => {
    expect([
      ...boundControllers(['Ctrl+Shift+H', 'joy:046d:c24f:0:7', 'joy:046d:c24f:0:8', '', 'x'])
    ]).toEqual(['joy:046d:c24f:0'])
  })
})

describe('controller names', () => {
  it('fall back to the vendor and product ids', () => {
    expect(fallbackControllerName('joy:046d:c24f:0')).toBe('VID 046D PID C24F')
  })

  it('are cleaned: no control characters, trimmed, cut short', () => {
    expect(cleanControllerName('  G29\u0000 Racing\n ')).toBe('G29 Racing')
    expect(cleanControllerName('   ')).toBeNull()
    expect(cleanControllerName(42)).toBeNull()
    expect(cleanControllerName('x'.repeat(200))).toHaveLength(MAX_DEVICE_NAME)
  })

  it('normalise to valid ids with a name, at most MAX_DEVICE_NAMES, only the bound ones', () => {
    expect(
      normalizeDeviceNames({
        'joy:046d:c24f:0': 'G29',
        'joy:bad': 'x',
        'joy:1dd2:2201:0': '',
        'joy:1dd2:2202:0': 5
      })
    ).toEqual({ 'joy:046d:c24f:0': 'G29' })
    expect(normalizeDeviceNames(['G29'])).toEqual({})
    expect(normalizeDeviceNames(null)).toEqual({})
    const many: Record<string, string> = {}
    for (let i = 0; i < 50; i++) many[`joy:046d:${i.toString(16).padStart(4, '0')}:0`] = `D${i}`
    expect(Object.keys(normalizeDeviceNames(many))).toHaveLength(MAX_DEVICE_NAMES)
    expect(
      normalizeDeviceNames(
        { 'joy:046d:c24f:0': 'G29', 'joy:1dd2:2201:0': 'Box' },
        new Set(['joy:1dd2:2201:0'])
      )
    ).toEqual({ 'joy:1dd2:2201:0': 'Box' })
  })

  it('keep the last name seen of each bound controller and drop the others', () => {
    const names = { 'joy:046d:c24f:0': 'G29 old', 'joy:1dd2:2201:0': 'Box' }
    const bound = new Set(['joy:046d:c24f:0', 'joy:0eb7:0e05:0'])
    const next = updateDeviceNames(names, bound, [
      { id: 'joy:046d:c24f:0', name: 'G29 Driving Force Racing Wheel', buttons: 25 },
      { id: 'joy:0eb7:0e05:0', name: 'Podium', buttons: 64 },
      { id: 'joy:1dd2:2201:0', name: 'Box new', buttons: 32 }
    ])
    expect(next).toEqual({
      'joy:046d:c24f:0': 'G29 Driving Force Racing Wheel',
      'joy:0eb7:0e05:0': 'Podium'
    })
    // Unplugged: its name stays; nothing changed gives the same object.
    expect(updateDeviceNames(next, bound, [])).toBe(next)
  })
})
