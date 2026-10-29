/**
 * The page's preview coordinator as the list drives it: a row lit ghosts its zone's hidden
 * elements, except one its eye just hid (until the list leaves it). Outside a component here, so
 * provide and the unmount hook are stubbed; the options are a stand-in ref.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope, shallowRef } from 'vue'
import type { ElementEntry } from '@shared/types'

const options = shallowRef<{ lines: ElementEntry<string>[] }>({ lines: [] })

vi.mock('vue', async (original) => ({
  ...(await original<typeof import('vue')>()),
  provide: () => undefined,
  onBeforeUnmount: () => undefined
}))
vi.mock('../../composables/useWidgetSettings', () => ({ useOptions: () => options }))

const { providePreviewEdit } = await import('./usePreviewEdit')

const row = (id: string): { zone: 'fuel.lines'; id: string } => ({ zone: 'fuel.lines', id })

describe('providePreviewEdit ghosts', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    options.value = {
      lines: [
        { id: 'hero', visible: true },
        { id: 'perLap', visible: true },
        { id: 'finish', visible: false }
      ]
    }
  })

  function edit(): ReturnType<typeof providePreviewEdit> {
    const scope = effectScope()
    const e = scope.run(() => providePreviewEdit('fuel'))
    if (!e) throw new Error('no coordinator')
    return e
  }

  it('does not ghost the line its eye just hid while the pointer stays on its row', () => {
    const e = edit()
    e.lightFromList(row('perLap'))
    expect(e.ghosts.value).toEqual(['fuel.lines.finish'])
    // The eye: hidden, and drawn gone, not as a ghost under the pointer.
    e.hiddenFromList(row('perLap'))
    options.value = { lines: options.value.lines.map((l) => ({ ...l, visible: l.id === 'hero' })) }
    expect(e.ghosts.value).toEqual(['fuel.lines.finish'])
    expect(e.viewOptions('fuel', options.value).lines.find((l) => l.id === 'perLap')?.visible).toBe(
      false
    )
    // Another row of the list: still gone; back on its row: its ghost shows where it would go.
    e.lightFromList(row('hero'))
    expect(e.ghosts.value).toEqual(['fuel.lines.finish'])
    e.lightFromList(row('perLap'))
    expect(e.ghosts.value).toEqual(['fuel.lines.perLap', 'fuel.lines.finish'])
  })

  it('forgets it once the pointer leaves the list', () => {
    const e = edit()
    e.lightFromList(row('perLap'))
    e.hiddenFromList(row('perLap'))
    options.value = { lines: options.value.lines.map((l) => ({ ...l, visible: l.id === 'hero' })) }
    e.lightFromList(null)
    vi.runAllTimers()
    expect(e.ghosts.value).toEqual([])
    e.lightFromList(row('hero'))
    expect(e.ghosts.value).toEqual(['fuel.lines.perLap', 'fuel.lines.finish'])
  })

  it('ghosts it while you edit in the stage', () => {
    const e = edit()
    e.lightFromList(row('perLap'))
    e.hiddenFromList(row('perLap'))
    options.value = { lines: options.value.lines.map((l) => ({ ...l, visible: l.id === 'hero' })) }
    e.setInside(true)
    expect(e.ghosts.value).toEqual(['fuel.lines.perLap', 'fuel.lines.finish'])
  })
})
