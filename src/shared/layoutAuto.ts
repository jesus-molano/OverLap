/**
 * The automatic layout (settings.layouts.autoSwitch): getting in a car model linked to a layout
 * applies it; a car without a link keeps the last one used. Pure: main feeds it the player's car
 * (from the telemetry process), edit mode and the settings, and applies what it returns.
 *
 * - It acts on getting in a car: a different car model than the last one seen. A session
 *   change, a reconnect or the menus in between (no car) do not count again, so a layout you
 *   chose by hand while in that car stays until you get in another one.
 * - Never while editing: what you are moving is not swapped under the mouse. The switch waits,
 *   and happens when edit mode ends (unless you chose a layout meanwhile).
 * - Turning the mode on, or linking the car you are in, applies its layout at once.
 */
import { findLayout, linkedLayoutId } from './layouts'
import type { CarRef, OverlaySettings } from './types'

export interface AutoContext {
  settings: OverlaySettings
  editing: boolean
}

export class LayoutAutoSwitch {
  /** The car model last got in (null: none yet). Kept across the gaps without a car. */
  private lastCarId: number | null = null
  private current: CarRef | null = null
  /** A layout to apply when edit mode ends. */
  private pending: string | null = null

  /** The car you are in now (null: none, or no session). */
  get car(): CarRef | null {
    return this.current
  }

  /** Waiting for edit mode to end (tests, logs). */
  get pendingId(): string | null {
    return this.pending
  }

  /**
   * The player's car changed (null: out of any session). Returns the layout to apply now, or
   * null.
   */
  onCar(car: CarRef | null, ctx: AutoContext): string | null {
    this.current = car === null ? null : { carId: car.carId, carName: car.carName }
    if (car === null || car.carId === this.lastCarId) return null
    this.lastCarId = car.carId
    this.pending = null
    return this.decide(ctx)
  }

  /**
   * The mode was turned on, or the links changed: the car you are in now takes its layout
   * (none in a car without a link).
   */
  reevaluate(ctx: AutoContext): string | null {
    this.pending = null
    return this.current === null ? null : this.decide(ctx)
  }

  /** Edit mode ended: the switch that waited for it, if still wanted. */
  onEditEnd(ctx: AutoContext): string | null {
    const id = this.pending
    this.pending = null
    if (id === null || !ctx.settings.layouts.autoSwitch) return null
    const lib = ctx.settings.savedLayouts
    return findLayout(lib, id) && id !== lib.activeId ? id : null
  }

  /** A layout was chosen by hand: nothing waiting overrides it. */
  onManualSwitch(): void {
    this.pending = null
  }

  private decide(ctx: AutoContext): string | null {
    const car = this.current
    if (car === null || !ctx.settings.layouts.autoSwitch) return null
    const lib = ctx.settings.savedLayouts
    const id = linkedLayoutId(lib, car.carId)
    if (id === null || id === lib.activeId) return null
    if (ctx.editing) {
      this.pending = id
      return null
    }
    return id
  }
}
