import { onScopeDispose, shallowRef, watch, type Ref, type ShallowRef } from 'vue'

export interface ElementSize {
  /** CSS px, or device pixels for 'device-pixel-content-box'. */
  readonly w: number
  readonly h: number
  readonly dpr: number
}

export type SizeBox = 'content-box' | 'border-box' | 'device-pixel-content-box'

/** An element, or a component instance (its root element is measured). */
export type MaybeElement = Element | { readonly $el: unknown } | null | undefined

export const NO_SIZE: ElementSize = Object.freeze({ w: 0, h: 0, dpr: 1 })

/** The parts of a ResizeObserverEntry that `entrySize` reads. */
export type ResizeEntryLike = Pick<
  ResizeObserverEntry,
  'contentRect' | 'borderBoxSize' | 'devicePixelContentBoxSize'
>

export function resolveElement(v: MaybeElement): Element | null {
  if (v === null || v === undefined) return null
  if (typeof Element !== 'undefined' && v instanceof Element) return v
  if ('$el' in v) {
    const el = v.$el
    return typeof Element !== 'undefined' && el instanceof Element ? el : null
  }
  return null
}

/** Size of one entry in the requested box; null when it has no area (detached, display: none). */
export function entrySize(e: ResizeEntryLike, box: SizeBox, dpr: number): ElementSize | null {
  let w = e.contentRect.width
  let h = e.contentRect.height
  if (box === 'border-box') {
    const b = e.borderBoxSize?.[0]
    if (b) {
      w = b.inlineSize
      h = b.blockSize
    }
  } else if (box === 'device-pixel-content-box') {
    const b = e.devicePixelContentBoxSize?.[0]
    w = b ? b.inlineSize : Math.round(w * dpr)
    h = b ? b.blockSize : Math.round(h * dpr)
  }
  return w > 0 && h > 0 ? { w, h, dpr } : null
}

export function sameSize(a: ElementSize, b: ElementSize): boolean {
  return a.w === b.w && a.h === b.h && a.dpr === b.dpr
}

function currentDpr(): number {
  return typeof devicePixelRatio === 'number' && devicePixelRatio > 0 ? devicePixelRatio : 1
}

/**
 * Size of an element, updated only when it changes (a ResizeObserver fires on resize, i.e. in
 * edit mode, never while racing). Follows the element when a v-if replaces it. `onResize` runs
 * synchronously with each change, for non-reactive work such as resizing a canvas. The
 * observer is disconnected with the component (or effect scope).
 */
export function useElementSize(
  target: Readonly<Ref<MaybeElement>>,
  o: { box?: SizeBox; onResize?: (size: ElementSize) => void } = {}
): Readonly<ShallowRef<ElementSize>> {
  const size = shallowRef<ElementSize>(NO_SIZE)
  if (typeof ResizeObserver === 'undefined') return size
  const box = o.box ?? 'content-box'
  let observed: Element | null = null
  const observer = new ResizeObserver((entries) => {
    const e = entries[entries.length - 1]
    const next = e === undefined ? null : entrySize(e, box, currentDpr())
    if (next === null || sameSize(next, size.value)) return
    size.value = next
    o.onResize?.(next)
  })
  function observe(el: Element): void {
    try {
      observer.observe(el, { box })
    } catch {
      // 'device-pixel-content-box' is not supported everywhere; entrySize scales the CSS box.
      observer.observe(el)
    }
  }
  const stop = watch(
    () => resolveElement(target.value),
    (el) => {
      if (el === observed) return
      if (observed !== null) observer.unobserve(observed)
      observed = el
      if (el !== null) observe(el)
    },
    { immediate: true, flush: 'post' }
  )
  onScopeDispose(() => {
    stop()
    observer.disconnect()
    observed = null
  })
  return size
}
