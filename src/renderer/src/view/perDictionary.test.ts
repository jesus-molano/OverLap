import { describe, expect, it } from 'vitest'
import { messagesFor } from '@shared/i18n'
import { perDictionary } from './perDictionary'

describe('perDictionary', () => {
  it('builds once per dictionary and keeps the identity', () => {
    let builds = 0
    const views = perDictionary((m) => {
      builds++
      return Object.freeze({ text: m.widgets.common.preview })
    })
    const es = views(messagesFor('es'))
    expect(views(messagesFor('es'))).toBe(es)
    expect(es.text).toBe('VISTA PREVIA')
    const en = views(messagesFor('en'))
    expect(en).not.toBe(es)
    expect(en.text).toBe('PREVIEW')
    expect(views(messagesFor('en'))).toBe(en)
    expect(builds).toBe(2)
  })
})
