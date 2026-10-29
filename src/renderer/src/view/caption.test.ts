import { describe, expect, it } from 'vitest'
import { LOCALES, messagesFor } from '@shared/i18n'
import { widgetCaption } from './caption'

describe('widgetCaption', () => {
  it('upper-cases the widget name in the language, accents included', () => {
    expect(widgetCaption(messagesFor('es'), 'standings', LOCALES.es)).toBe('POSICIONES')
    expect(widgetCaption(messagesFor('es'), 'traffic', LOCALES.es)).toBe('TRÁFICO')
    expect(widgetCaption(messagesFor('en'), 'standings', LOCALES.en)).toBe('STANDINGS')
    expect(widgetCaption(messagesFor('en'), 'relative', LOCALES.en)).toBe('RELATIVE')
  })
})
