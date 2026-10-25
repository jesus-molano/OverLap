import { hasInjectionContext, inject, provide, type InjectionKey } from 'vue'
import type { WidgetId } from '@shared/widgets'

const WIDGET_ID: InjectionKey<WidgetId> = Symbol('widget-id')

/** App.vue: the widget this window shows, for every composable below it. */
export function provideWidgetId(id: WidgetId): void {
  provide(WIDGET_ID, id)
}

/** The widget of this window (setup only). Throws outside a widget window. */
export function injectWidgetId(): WidgetId {
  const id = inject(WIDGET_ID, null)
  if (id === null) throw new Error('injectWidgetId(): no widget id provided (not a widget window)')
  return id
}

/**
 * A widget drawn as the live sample of its settings page instead of in its own window: it
 * always shows its preview content, receives no payloads and reports its content height here
 * instead of to main.
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

/** The sample host the widget is drawn in; null in a widget window (or outside setup). */
export function injectSampleHost(): SampleHost | null {
  return hasInjectionContext() ? inject(SAMPLE_HOST, null) : null
}
