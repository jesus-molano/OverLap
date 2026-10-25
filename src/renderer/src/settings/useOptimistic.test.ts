import { describe, expect, it } from 'vitest'
import { shallowRef } from 'vue'
import { useOptimistic } from './useOptimistic'

function deferred(): { promise: Promise<void>; resolve: () => void; reject: () => void } {
  let resolve!: () => void
  let reject!: () => void
  const promise = new Promise<void>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

const flush = async (): Promise<void> => {
  for (let i = 0; i < 5; i++) await Promise.resolve()
}

describe('useOptimistic', () => {
  it('shows the sent value until its reply, then the source again', async () => {
    const source = shallowRef('a')
    const o = useOptimistic(() => source.value)
    const d = deferred()
    o.run('b', () => d.promise)
    expect(o.value.value).toBe('b')
    source.value = 'b' // main's broadcast
    d.resolve()
    await flush()
    expect(o.value.value).toBe('b')
    source.value = 'c'
    expect(o.value.value).toBe('c')
  })

  it('sends every action at once and keeps the newest until its own reply', async () => {
    const source = shallowRef(0)
    const o = useOptimistic(() => source.value)
    const sent: number[] = []
    const first = deferred()
    const second = deferred()
    o.run(1, () => (sent.push(1), first.promise))
    o.run(2, () => (sent.push(2), second.promise))
    expect(sent).toEqual([1, 2])
    first.resolve()
    await flush()
    expect(o.value.value).toBe(2)
    second.resolve()
    await flush()
    expect(o.value.value).toBe(0)
  })

  it('falls back to the source when sending fails', async () => {
    const source = shallowRef('kept')
    const o = useOptimistic(() => source.value)
    const d = deferred()
    o.run('lost', () => d.promise)
    d.reject()
    await flush()
    expect(o.value.value).toBe('kept')
    o.run('thrown', () => {
      throw new Error('boom')
    })
    await flush()
    expect(o.value.value).toBe('kept')
  })
})
