/**
 * ResizeObserver and Element stand-ins for the node test environment. Install with
 * `vi.stubGlobal('ResizeObserver', FakeResizeObserver)` and `vi.stubGlobal('Element', FakeElement)`.
 */

export class FakeElement {}

export class FakeResizeObserver {
  static readonly live = new Set<FakeResizeObserver>()
  readonly observed = new Set<object>()
  constructor(readonly cb: ResizeObserverCallback) {
    FakeResizeObserver.live.add(this)
  }
  observe(el: object): void {
    this.observed.add(el)
  }
  unobserve(el: object): void {
    this.observed.delete(el)
  }
  disconnect(): void {
    this.observed.clear()
    FakeResizeObserver.live.delete(this)
  }
  /** Fires the callback as the browser would after a layout change. */
  resize(el: object, width: number, height: number, border = 0): void {
    if (!this.observed.has(el)) return
    const entry = {
      target: el,
      contentRect: { width, height },
      borderBoxSize: [{ inlineSize: width + border, blockSize: height + border }],
      contentBoxSize: [{ inlineSize: width, blockSize: height }],
      devicePixelContentBoxSize: [{ inlineSize: width, blockSize: height }]
    } as unknown as ResizeObserverEntry
    this.cb([entry], this as unknown as ResizeObserver)
  }
  /** Fires on every live observer that watches `el`. */
  static resizeAll(el: object, width: number, height: number, border = 0): void {
    for (const ro of FakeResizeObserver.live) ro.resize(el, width, height, border)
  }
}
