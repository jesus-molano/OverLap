import { describe, expect, it } from 'vitest'
import { NativeSdkMissingError, errorMessage, isNativeSdkMissing } from './errors'

describe('errorMessage', () => {
  it('reads errors and stringifies anything else', () => {
    expect(errorMessage(new Error('boom'))).toBe('boom')
    expect(errorMessage('plain')).toBe('plain')
    expect(errorMessage(42)).toBe('42')
  })

  it('never throws, whatever was thrown', () => {
    expect(errorMessage(Object.create(null))).toBe('unknown error')
    const hostile = {
      toString(): string {
        throw new Error('no')
      }
    }
    expect(errorMessage(hostile)).toBe('unknown error')
  })
})

describe('NativeSdkMissingError', () => {
  it('is recognised by class or by name, with an English message for the logs', () => {
    const err = new NativeSdkMissingError()
    expect(isNativeSdkMissing(err)).toBe(true)
    expect(err.message).toBe('The iRacing SDK native module could not be loaded')
    const copy = new Error('from another module copy')
    copy.name = 'NativeSdkMissingError'
    expect(isNativeSdkMissing(copy)).toBe(true)
  })

  it('is not any other error, and never throws', () => {
    expect(isNativeSdkMissing(new Error('No se pudo cargar el módulo nativo'))).toBe(false)
    expect(isNativeSdkMissing('NativeSdkMissingError')).toBe(false)
    expect(isNativeSdkMissing(null)).toBe(false)
    const hostile = new Error('x')
    Object.defineProperty(hostile, 'name', {
      get(): string {
        throw new Error('no')
      }
    })
    expect(isNativeSdkMissing(hostile)).toBe(false)
  })
})
