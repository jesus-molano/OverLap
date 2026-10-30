import {
  hasInjectionContext,
  inject,
  onBeforeUnmount,
  provide,
  watch,
  type InjectionKey,
  type Ref
} from 'vue'
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
  /**
   * Editing in the sample (settings/preview): an option section as the sample draws it (its
   * hidden elements shown, to be ghosted), and the `data-el`s drawn ghosted (an info bar drops
   * those first when it has no room). Absent: the options as they are.
   */
  readonly viewOptions?: <T extends object>(section: string, options: T) => T
  readonly ghosts?: Readonly<Ref<readonly string[]>>
  /**
   * What a part of the sample (`source`) draws without room now, as `data-el`s: the settings
   * lists mark them «No cabe» (useNoRoomReport). Absent outside a widget page.
   */
  readonly reportNoRoom?: (source: object, els: readonly string[]) => void
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
 * Reports to the sample host what this component draws without room (`els()`: `data-el`s such
 * as 'standings.columns.tyre') whenever it changes, and nothing once it is unmounted. Over the
 * game (no host) it does nothing. Setup only.
 */
export function useNoRoomReport(els: () => readonly string[]): void {
  const report = injectSampleHost()?.reportNoRoom
  if (report === undefined) return
  const source = {}
  watch(els, (next) => report(source, next), { immediate: true })
  onBeforeUnmount(() => report(source, []))
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
