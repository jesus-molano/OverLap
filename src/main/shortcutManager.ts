/**
 * The global shortcuts: the key combinations (Windows RegisterHotKey through Electron's
 * globalShortcut), one per configured action (settings.shortcuts) plus Escape while editing,
 * and the controllers' buttons, whose presses the input process reports (inputHost.ts).
 * Electron is injected, so tests pass a double and never touch the operating system's shortcuts.
 *
 * A registered combination is taken from every other program while the app runs (iRacing
 * included): that is how a shortcut works over a focused game without touching its process. A
 * button is only read: iRacing still gets it.
 */
import type { GlobalShortcut } from 'electron'
import { buttonBinding, isButtonBinding, parseButtonBinding } from '@shared/controllers'
import { SHORTCUT_CAPTURE_LEASE_MS } from '@shared/ipc'
import {
  EXIT_EDIT_ACCELERATOR,
  SHORTCUT_ACTIONS,
  type ShortcutAction,
  type ShortcutSettings,
  type ShortcutStatusMap
} from '@shared/shortcuts'

/**
 * Presses of one shortcut that keep coming less than this apart are one press: Windows
 * repeats a hot key while it is held (and a button box's switch may bounce), so only the
 * first of a burst counts and a held Ctrl+Shift+H does not make the overlay flicker.
 */
export const REPEAT_GUARD_MS = 300

/** What the manager needs from Electron's globalShortcut. */
export type ShortcutRegistry = Pick<
  GlobalShortcut,
  'register' | 'unregister' | 'unregisterAll' | 'setSuspended'
>

export interface ShortcutManagerOptions {
  registry: ShortcutRegistry
  /** A configured shortcut was pressed. */
  onAction(action: ShortcutAction): void
  /** Escape was pressed while editing. */
  onExitEdit(): void
  /** Some action's status changed (registered, turned off, refused by Windows, unplugged). */
  onStatus(status: ShortcutStatusMap): void
  /**
   * Whether the controllers must be read now (some action has a button, or the settings page
   * records one), on change: main starts or stops the input process.
   */
  onButtonsWanted?(wanted: boolean): void
  /**
   * A capture started (after onButtonsWanted): main lets a reader that stopped trying (it kept
   * crashing, or controllers could not be read) try again.
   */
  onCaptureStart?(): void
}

type Binding = ShortcutAction | 'exitEdit'

/**
 * Registers what the settings ask for and changes only what differs on every change. While
 * the settings page records a combination (a capture), every shortcut is suspended so the
 * page receives the keys; whatever changes meanwhile is applied when the capture ends.
 */
export class ShortcutManager {
  private config: ShortcutSettings | null = null
  private editing = false
  private capturingNow = false
  private leaseTimer: ReturnType<typeof setTimeout> | null = null
  /** What is registered now, by combination. */
  private readonly registered = new Map<string, Binding>()
  /** Combinations Windows refused (another application holds them); retried on every apply. */
  private readonly refused = new Set<string>()
  /** performance.now() of each binding's last press, counted or not (the burst goes on). */
  private readonly lastPress = new Map<Binding, number>()
  private lastStatus = ''
  private disposed = false
  /** The controllers connected now; null while unknown (the input process starting). */
  private controllers: ReadonlySet<string> | null = null
  private buttonsWanted = false

  constructor(private readonly opts: ShortcutManagerOptions) {}

  /**
   * 'disabled' without a binding; 'unavailable' when Windows refused the combination, or the
   * button's controller is not connected; else 'ok' (a button too while the connected
   * controllers are not known yet).
   */
  get status(): ShortcutStatusMap {
    const out = {} as ShortcutStatusMap
    for (const action of SHORTCUT_ACTIONS) {
      const binding = this.config?.[action] ?? ''
      const button = parseButtonBinding(binding)
      out[action] =
        binding === ''
          ? 'disabled'
          : button
            ? this.controllers === null || this.controllers.has(button.device)
              ? 'ok'
              : 'unavailable'
            : this.refused.has(binding)
              ? 'unavailable'
              : 'ok'
    }
    return out
  }

  /** The settings page records a binding: button presses go to it instead (main forwards them). */
  get capturing(): boolean {
    return this.capturingNow
  }

  /** Whether the controllers must be read (see onButtonsWanted). */
  get wantsButtons(): boolean {
    return this.buttonsWanted
  }

  /**
   * The controllers connected now (their ids), as the input process reports them; null when
   * not known (no process): every button counts as working then. [] when they cannot be read.
   */
  setControllers(ids: readonly string[] | null): void {
    if (this.disposed) return
    this.controllers = ids === null ? null : new Set(ids)
    this.publishStatus()
  }

  /**
   * A controller's button went down (not while held: the input process reports each press
   * once). Runs the action bound to it, through the same burst guard as a hot key (a switch
   * that bounces). Nothing while the settings page records a binding. The action bound to it
   * (for the log; the burst guard may still have swallowed it), or null.
   */
  pressButton(device: string, button: number): ShortcutAction | null {
    if (this.disposed || this.capturingNow) return null
    const binding = buttonBinding(device, button)
    const action = SHORTCUT_ACTIONS.find((a) => this.config?.[a] === binding)
    if (action === undefined) return null
    this.fire(action)
    return action
  }

  /** The settings' shortcuts (already normalised: canonical and unique). Same ones: no-op. */
  configure(shortcuts: Readonly<ShortcutSettings>): void {
    if (this.disposed) return
    const prev = this.config
    if (prev && SHORTCUT_ACTIONS.every((a) => prev[a] === shortcuts[a])) return
    this.config = { ...shortcuts }
    this.apply()
  }

  /** Escape leaves edit mode, but it is only taken from the other programs while editing. */
  setEditing(on: boolean): void {
    if (this.disposed || this.editing === on) return
    this.editing = on
    this.apply()
  }

  /**
   * The settings page starts (or renews) recording a combination: every shortcut is
   * suspended until stopCapture, or SHORTCUT_CAPTURE_LEASE_MS after the last call.
   */
  startCapture(): void {
    if (this.disposed) return
    if (this.leaseTimer) clearTimeout(this.leaseTimer)
    this.leaseTimer = setTimeout(() => {
      this.leaseTimer = null
      console.warn('[shortcuts] the settings page stopped renewing its capture: resuming')
      this.stopCapture()
    }, SHORTCUT_CAPTURE_LEASE_MS)
    if (this.capturingNow) return
    this.capturingNow = true
    this.opts.registry.setSuspended(true)
    this.updateButtonsWanted()
    this.opts.onCaptureStart?.()
  }

  /** Resumes the shortcuts and applies whatever changed while suspended. */
  stopCapture(): void {
    if (this.leaseTimer) clearTimeout(this.leaseTimer)
    this.leaseTimer = null
    if (!this.capturingNow || this.disposed) return
    this.capturingNow = false
    this.opts.registry.setSuspended(false)
    this.apply()
  }

  /** On quit: resumed (if suspended), then every shortcut of this app unregistered. */
  dispose(): void {
    if (this.disposed) return
    if (this.leaseTimer) clearTimeout(this.leaseTimer)
    this.leaseTimer = null
    if (this.capturingNow) this.opts.registry.setSuspended(false)
    this.capturingNow = false
    this.disposed = true
    this.opts.registry.unregisterAll()
    this.registered.clear()
    this.refused.clear()
    if (this.buttonsWanted) {
      this.buttonsWanted = false
      this.opts.onButtonsWanted?.(false)
    }
  }

  /** Combination -> what it does, as the settings and edit mode ask for now (no buttons). */
  private wanted(): Map<string, Binding> {
    const out = new Map<string, Binding>()
    for (const action of SHORTCUT_ACTIONS) {
      const accelerator = this.config?.[action] ?? ''
      if (accelerator === '' || isButtonBinding(accelerator)) continue
      if (!out.has(accelerator)) out.set(accelerator, action)
    }
    if (this.editing) out.set(EXIT_EDIT_ACCELERATOR, 'exitEdit')
    return out
  }

  /**
   * Unregisters what is no longer wanted (or does something else now) and registers what is
   * missing, retrying what Windows refused before. Nothing while suspended: registering fails
   * then, so the whole diff (unregistering too, to keep it one consistent step) waits for
   * stopCapture.
   */
  private apply(): void {
    if (this.disposed) return
    const wanted = this.wanted()
    for (const accelerator of [...this.refused]) {
      if (!wanted.has(accelerator)) this.refused.delete(accelerator)
    }
    if (!this.capturingNow) {
      for (const [accelerator, binding] of [...this.registered]) {
        if (wanted.get(accelerator) === binding) continue
        this.opts.registry.unregister(accelerator)
        this.registered.delete(accelerator)
      }
      for (const [accelerator, binding] of wanted) {
        if (this.registered.has(accelerator)) continue
        if (this.register(accelerator, binding)) {
          this.registered.set(accelerator, binding)
          this.refused.delete(accelerator)
        } else if (!this.refused.has(accelerator)) {
          this.refused.add(accelerator)
          console.warn(`[shortcuts] ${accelerator} is already used by another application`)
        }
      }
    }
    this.publishStatus()
    this.updateButtonsWanted()
  }

  private updateButtonsWanted(): void {
    if (this.disposed) return
    const wanted =
      this.capturingNow || SHORTCUT_ACTIONS.some((a) => isButtonBinding(this.config?.[a]))
    if (wanted === this.buttonsWanted) return
    this.buttonsWanted = wanted
    this.opts.onButtonsWanted?.(wanted)
  }

  private register(accelerator: string, binding: Binding): boolean {
    try {
      return this.opts.registry.register(accelerator, () => this.fire(binding))
    } catch (err) {
      console.error(`[shortcuts] could not register ${accelerator}:`, err)
      return false
    }
  }

  private fire(binding: Binding): void {
    if (this.disposed) return
    const now = performance.now()
    const last = this.lastPress.get(binding)
    this.lastPress.set(binding, now)
    if (last !== undefined && now - last < REPEAT_GUARD_MS) return
    if (binding === 'exitEdit') this.opts.onExitEdit()
    else this.opts.onAction(binding)
  }

  private publishStatus(): void {
    const status = this.status
    const key = JSON.stringify(status)
    if (key === this.lastStatus) return
    this.lastStatus = key
    this.opts.onStatus(status)
  }
}
