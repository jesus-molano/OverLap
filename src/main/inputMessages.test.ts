import { describe, expect, it } from 'vitest'
import { MAX_CONTROLLERS, parseInputMessage } from './inputMessages'

describe('parseInputMessage', () => {
  it('accepts a press of a valid controller and button', () => {
    expect(parseInputMessage({ type: 'press', device: 'joy:046d:c24f:0', button: 7 })).toEqual({
      type: 'press',
      device: 'joy:046d:c24f:0',
      button: 7
    })
  })

  it('refuses a press with a bad controller or button', () => {
    for (const bad of [
      { type: 'press', device: 'joy:046d', button: 7 },
      { type: 'press', device: 'joy:046d:c24f:0', button: 0 },
      { type: 'press', device: 'joy:046d:c24f:0', button: 1.5 },
      { type: 'press', device: 'joy:046d:c24f:0', button: 70000 },
      { type: 'press', device: 'joy:046d:c24f:0' }
    ]) {
      expect(parseInputMessage(bad)).toBeNull()
    }
  })

  it('keeps the valid controllers of a list, named', () => {
    expect(
      parseInputMessage({
        type: 'devices',
        list: [
          { id: 'joy:046d:c24f:0', name: ' G29\n', buttons: 25 },
          { id: 'joy:1dd2:2201:0', name: '', buttons: -1 },
          { id: 'nope', name: 'x', buttons: 1 },
          'junk'
        ]
      })
    ).toEqual({
      type: 'devices',
      list: [
        { id: 'joy:046d:c24f:0', name: 'G29', buttons: 25 },
        { id: 'joy:1dd2:2201:0', name: 'VID 1DD2 PID 2201', buttons: 0 }
      ]
    })
    const many = Array.from({ length: 100 }, () => ({
      id: 'joy:046d:c24f:0',
      name: 'x',
      buttons: 1
    }))
    const parsed = parseInputMessage({ type: 'devices', list: many })
    expect(parsed?.type === 'devices' && parsed.list.length).toBe(MAX_CONTROLLERS)
    expect(parseInputMessage({ type: 'devices', list: 'x' })).toBeNull()
  })

  it('accepts unavailable and log messages, refuses the rest', () => {
    expect(parseInputMessage({ type: 'unavailable', detail: 'no Raw Input' })).toEqual({
      type: 'unavailable',
      detail: 'no Raw Input'
    })
    expect(parseInputMessage({ type: 'log', level: 'warn', message: 'm' })).toEqual({
      type: 'log',
      level: 'warn',
      message: 'm'
    })
    expect(parseInputMessage({ type: 'log', level: 'debug', message: 'm' })).toBeNull()
    expect(parseInputMessage({ type: 'what' })).toBeNull()
    expect(parseInputMessage(null)).toBeNull()
  })
})
