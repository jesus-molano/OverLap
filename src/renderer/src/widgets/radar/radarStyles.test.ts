/**
 * The radar's colours are CSS only (so the colour-blind palette needs no JS): every proximity
 * step has its fill rule, and no red is hard-coded in the drawing.
 */
import { describe, expect, it } from 'vitest'
import { BUCKET_CLASSES } from './geometry'

const RAW = import.meta.glob(['./RadarWidget.vue', './RadarSideAlert.vue'], {
  query: '?raw',
  import: 'default',
  eager: true
}) as Record<string, string>

const widget = RAW['./RadarWidget.vue'] ?? ''
const sources = Object.values(RAW).join('\n')

describe('radar colours', () => {
  it('finds the sources', () => {
    expect(widget).toContain('<svg')
    expect(Object.keys(RAW)).toHaveLength(2)
  })

  it('fills every proximity step from its theme token', () => {
    BUCKET_CLASSES.forEach((cls, i) => {
      const rule = new RegExp(`\\.${cls}\\s*\\{\\s*fill:\\s*var\\(--ov-prox-${i}\\);\\s*\\}`)
      expect(widget).toMatch(rule)
    })
  })

  it('draws every alert red from --ov-alert, with no colour in the markup', () => {
    expect(widget).toMatch(/\.radar-stop\s*\{\s*stop-color:\s*var\(--ov-alert\);\s*\}/)
    expect(sources).not.toMatch(/stop-color="/)
    expect(sources).not.toMatch(/#ff3b30|#ff453a|#f42525/i)
  })

  it('never draws another car in its class colour: body by proximity, class as the glass', () => {
    // Halo and body take their fill from the proximity class, never from a bound colour.
    expect(widget).not.toMatch(/class="radar__(car|halo-inner)"[^>]*:(fill|stroke)=/)
    expect(widget).not.toMatch(/:stroke="car\./)
    // The body's outline is the neutral dark keyline of your own car, not a class-colour ring.
    const keyline = /stroke:\s*rgba\(0, 0, 0, 0\.6\);\s*stroke-width:\s*0\.5;/
    expect(widget).toMatch(new RegExp(`\\.radar__car\\s*\\{[^}]*${keyline.source}`))
    expect(widget).toMatch(new RegExp(`\\.radar__player-body\\s*\\{[^}]*${keyline.source}`))
    // The only per-car colour binding: the class-colour windshield.
    expect(widget.match(/:fill="car\.[a-zA-Z]+"/g)).toEqual([':fill="car.classColor"'])
    expect(widget).toMatch(/class="radar__cls" v-bind="CAR_GLASS" :fill="car\.classColor"/)
  })
})
