import { hasInjectionContext, inject, provide, type InjectionKey, type Ref } from 'vue'
import type { Size } from '@shared/types'
import type { WidgetId } from '@shared/widgets'

const WIDGET_ID: InjectionKey<WidgetId> = Symbol('widget-id')

/** WidgetSlot (overlay panel), WidgetSample: the widget drawn below, for every composable. */
export function provideWidgetId(id: WidgetId): void {
  provide(WIDGET_ID, id)
}

/** The widget this component belongs to (setup only). Throws outside a widget. */
export function injectWidgetId(): WidgetId {
  const id = inject(WIDGET_ID, null)
  if (id === null) throw new Error('injectWidgetId(): no widget id provided (not inside a widget)')
  return id
}

/**
 * A widget drawn as the live sample of its settings page instead of over the game: it always
 * shows its preview content, receives no payloads and reports its content height here.
 */
export interface SampleHost {
  /** Desired content height (px) of an auto-height widget: sizes the sample box. */
  reportHeight(px: number): void
  /** Name format and density follow the appearance whatever the widget's own option. */
  readonly globalAppearance: boolean
}

const SAMPLE_HOST: InjectionKey<SampleHost> = Symbol('sample-host')

/** The settings window's sample box, for the widget component below it. */
export function provideSampleHost(host: SampleHost): void {
  provide(SAMPLE_HOST, host)
}

/** The sample host the widget is drawn in; null over the game (or outside setup). */
export function injectSampleHost(): SampleHost | null {
  return hasInjectionContext() ? inject(SAMPLE_HOST, null) : null
}

/**
 * The panel of an overlay window a widget is drawn in (overlay/WidgetSlot.vue): it fits an
 * auto-height widget's panel to the height its content reports.
 */
export interface PanelHost {
  /**
   * Desired content height (px) of an auto-height widget. Growth is drawn on the next frame, a
   * smaller height after a pause (overlay/heightGate.ts).
   */
  reportHeight(px: number): void
  /**
   * Resolves once the next fitted height is drawn, or after `timeoutMs` when none comes: lets a
   * widget report a new height and wait for its panel before fading in (ux §3.2 step 4).
   */
  waitForFit(timeoutMs: number): Promise<void>
  /** The panel's drawn size (CSS px). */
  readonly size: Readonly<Ref<Size>>
}

const PANEL_HOST: InjectionKey<PanelHost> = Symbol('panel-host')

/** WidgetSlot: the panel of the widget below it. */
export function providePanelHost(host: PanelHost): void {
  provide(PANEL_HOST, host)
}

/** The overlay panel the widget is drawn in; null elsewhere (settings sample, outside setup). */
export function injectPanelHost(): PanelHost | null {
  return hasInjectionContext() ? inject(PANEL_HOST, null) : null
}
