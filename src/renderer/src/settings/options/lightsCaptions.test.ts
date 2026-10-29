import { describe, expect, it } from 'vitest'
import { captionsChoice, captionsPatch, captionsValues } from './lightsCaptions'

describe('the lights captions choice', () => {
  it('offers No / Derecha / Izquierda in a column, No / Sí in a row', () => {
    expect(captionsValues('column')).toEqual(['off', 'right', 'left'])
    expect(captionsValues('row')).toEqual(['off', 'on'])
  })

  it('reads the switch and the side as one choice', () => {
    expect(captionsChoice({ layout: 'column', showCaptions: false, labelSide: 'left' })).toBe('off')
    expect(captionsChoice({ layout: 'column', showCaptions: true, labelSide: 'left' })).toBe('left')
    expect(captionsChoice({ layout: 'row', showCaptions: true, labelSide: 'left' })).toBe('on')
  })

  it('stores the same two fields as before, the side only when chosen', () => {
    expect(captionsPatch('off')).toEqual({ showCaptions: false })
    expect(captionsPatch('on')).toEqual({ showCaptions: true })
    expect(captionsPatch('right')).toEqual({ showCaptions: true, labelSide: 'right' })
  })
})
