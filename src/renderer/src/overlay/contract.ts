/**
 * Contract between the overlay host (OverlayApp, WidgetSlot) and the edit layer (EditFrame,
 * useEditSession). Every rect is window-local CSS px (= DIP at zoom 1), integers, in the
 * coordinates of `OverlayLayout`.
 */
import { inject, provide, type InjectionKey, type Ref } from 'vue'
import type { AutoHiddenState, OverlayDisplay } from '@shared/ipc'
import type { Point, Rect } from '@shared/types'
import type { WidgetId } from '@shared/widgets'

/** One widget's panel in this overlay window. */
export interface SlotHandle {
  readonly id: WidgetId
  /**
   * What is drawn now: the drag rect, else the rect awaiting main's acknowledgement, else the
   * layout rect; the fitted height applied to auto-height widgets.
   */
  readonly rect: Readonly<Ref<Rect>>
  /** Height follows the content (auto-height model, option on): side handles only. */
  readonly autoHeight: Readonly<Ref<boolean>>
  readonly locked: Readonly<Ref<boolean>>
  /**
   * Disabled by the user, hosted only in edit mode (`OverlayPanel.ghost`): an outline with its
   * chip at its saved place, never the widget; it does not move or fit.
   */
  readonly ghost: Readonly<Ref<boolean>>
  /** Edit mode: the arrows apply to it (`OverlayPanel.touched`, R38); its chip is marked. */
  readonly touched: Readonly<Ref<boolean>>
  /** The widget is rendered right now (edit mode previews rule-hidden widgets; never a ghost). */
  readonly shown: Readonly<Ref<boolean>>
  /** A visibility rule hides it outside edit mode (the edit chip says why). */
  readonly autoHidden: Readonly<Ref<AutoHiddenState>>
  /**
   * `OverlayPanel.placement`: changes only when main moves this panel on its own (reset,
   * display change, arrival from another display). An interaction in progress is cancelled.
   */
  readonly placement: Readonly<Ref<number>>
  /** Draws `rect` while an interaction is in progress; null cancels it. Never sent to main. */
  setDragRect(rect: Rect | null): void
  /**
   * Ends the interaction: sends what is drawn now to main ('drag': saved at once; 'wheel':
   * saved after a pause) and keeps drawing it until main acknowledges it. No-op without a
   * drag rect.
   */
  commit(kind: 'drag' | 'wheel'): void
  /**
   * Ends a move whose pointer was released outside this window's display: main places the
   * widget, as drawn, with its top-left `grab` px up and left of the cursor, on the display
   * under it.
   */
  dropOutside(grab: Point): void
}

/** The slots of this window and its display (OverlayApp hands it to `useEditSession`). */
export interface SlotRegistry {
  /** Mounted slots, PAINT_ORDER (later ones on top). */
  readonly slots: Readonly<Ref<readonly SlotHandle[]>>
  /** This window's display, window-local; null until the first layout. */
  readonly display: Readonly<Ref<OverlayDisplay | null>>
  slot(id: WidgetId): SlotHandle | undefined
}

/**
 * The window's chip layer (OverlayApp), above every panel: each EditFrame draws its chips there,
 * over its own panel, so a panel painted later never covers them.
 */
export const CHIP_LAYER = '[data-ov-chips]'

const SLOT: InjectionKey<SlotHandle> = Symbol('overlay-slot')

/** WidgetSlot: the slot of the widget below it. */
export function provideSlot(slot: SlotHandle): void {
  provide(SLOT, slot)
}

/** The slot this component belongs to (setup only). Throws outside a WidgetSlot. */
export function injectSlot(): SlotHandle {
  const slot = inject(SLOT, null)
  if (slot === null) throw new Error('injectSlot(): not inside a WidgetSlot')
  return slot
}
