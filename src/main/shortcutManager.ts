/**
 * The global shortcuts: the key combinations (Windows RegisterHotKey through Electron's
 * globalShortcut), every binding of every configured action (settings.shortcuts and
 * settings.shortcutsMore: up to three each) plus Escape and the arrows (nudge.ts) while editing,
 * and the controllers'
 * buttons, whose presses the input process reports (inputHost.ts).
 * Electron is injected, so tests pass a double and never touch the operating system's shortcuts.
 *
 * A registered combination is taken from every other program while the app runs (iRacing
 * included): that is how a shortcut works over a focused game without touching its process. A
 * button is only read: iRacing still gets it.
 */
import type { GlobalShortcut } from 'electron'
import { buttonBinding, isButtonBinding, parseButtonBinding } from '@shared/controllers'
import { SHORTCUT_CAPTURE_LEASE_MS } from '@shared/ipc'
import { EDIT_KEYS } from '@shared/nudge'
import {
  EXIT_EDIT_ACCELERATOR,
  SHORTCUT_ACTIONS,
  sameBindings,
  shortcutBindings,
  type MoreShortcuts,
  type ShortcutAction,
  type ShortcutBindings,
  type ShortcutSettings,
  type ShortcutStatusMap,
  type ShortcutStatusReport
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
  /**
   * An edit-mode key was pressed while editing (R38: EDIT_KEYS, its canonical spelling: the
   * arrows, Tab and Shift+Tab, Ctrl+Z). Without it, none is ever taken. Held down, it repeats:
   * no burst guard.
   */
  onNudge?(key: string): void
  /**
   * Some binding's status changed (registered, removed, refused by Windows, unplugged): per
   * action, and which bindings do not work.
   */
  onStatus(status: ShortcutStatusReport): void
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

type Binding = ShortcutAction | 'exitEdit' | `nudge:${string}`

/**
 * Registers what the settings ask for and changes only what differs on every change. While
 * the settings page records a combination (a capture), every shortcut is suspended so the
 * page receives the keys; whatever changes meanwhile is applied when the capture ends.
 */
export class ShortcutManager {
  /** Every binding of each action, as configured (unique across all of them). */
  private config: ShortcutBindings | null = null
  private editing = false
  /** The settings window is in front: the arrows stay its own (they move its controls). */
  private nudgeBlocked = false
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
   * Per action: 'disabled' without a binding; 'unavailable' when one of its bindings does not
   * work (unavailableBindings); else 'ok'.
   */
  get status(): ShortcutStatusMap {
    const off = new Set(this.unavailableBindings)
    const out = {} as ShortcutStatusMap
    for (const action of SHORTCUT_ACTIONS) {
      const list = this.config?.[action] ?? []
      out[action] =
        list.length === 0 ? 'disabled' : list.some((b) => off.has(b)) ? 'unavailable' : 'ok'
    }
    return out
  }

  /**
   * The bindings that do not work, in priority order: a combination Windows refused, a button
   * whose controller is not connected (none while the connected controllers are not known yet).
   */
  get unavailableBindings(): string[] {
    const out: string[] = []
    for (const action of SHORTCUT_ACTIONS) {
      for (const binding of this.config?.[action] ?? []) {
        const button = parseButtonBinding(binding)
        const off = button
          ? this.controllers !== null && !this.controllers.has(button.device)
          : this.refused.has(binding)
        if (off) out.push(binding)
      }
    }
    return out
  }

  /** What onStatus reports. */
  get report(): ShortcutStatusReport {
    return { actions: this.status, unavailable: this.unavailableBindings }
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
    const action = SHORTCUT_ACTIONS.find((a) => this.config?.[a].includes(binding))
    if (action === undefined) return null
    this.fire(action)
    return action
  }

  /**
   * The settings' shortcuts (already normalised: canonical and unique): the first binding of
   * each action and the others. Same ones: no-op.
   */
  configure(shortcuts: Readonly<ShortcutSettings>, more?: Readonly<MoreShortcuts>): void {
    if (this.disposed) return
    const next = shortcutBindings(shortcuts, more)
    if (this.config && sameBindings(this.config, next)) return
    this.config = next
    this.apply()
  }

  /** Escape leaves edit mode, but it is only taken from the other programs while editing. */
  setEditing(on: boolean): void {
    if (this.disposed || this.editing === on) return
    this.editing = on
    this.apply()
  }

  /**
   * While the settings window is in front (`blocked`), the arrows are not taken in edit mode:
   * its sliders, lists and fields keep them.
   */
  setNudgeBlocked(blocked: boolean): void {
    if (this.disposed || this.nudgeBlocked === blocked) return
    this.nudgeBlocked = blocked
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
      for (const accelerator of this.config?.[action] ?? []) {
        if (isButtonBinding(accelerator)) continue
        if (!out.has(accelerator)) out.set(accelerator, action)
      }
    }
    if (this.editing) out.set(EXIT_EDIT_ACCELERATOR, 'exitEdit')
    // After every configured shortcut: a combination of yours stays yours.
    if (this.editing && !this.nudgeBlocked && this.opts.onNudge !== undefined) {
      for (const key of EDIT_KEYS) if (!out.has(key)) out.set(key, `nudge:${key}`)
    }
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
      this.capturingNow ||
      SHORTCUT_ACTIONS.some((a) => this.config?.[a].some((b) => isButtonBinding(b)) === true)
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
    // A held arrow repeats on purpose: each repeat moves the widget one more step.
    if (binding.startsWith('nudge:')) {
      this.opts.onNudge?.(binding.slice('nudge:'.length))
      return
    }
    const now = performance.now()
    const last = this.lastPress.get(binding)
    this.lastPress.set(binding, now)
    if (last !== undefined && now - last < REPEAT_GUARD_MS) return
    if (binding === 'exitEdit') this.opts.onExitEdit()
    else this.opts.onAction(binding as ShortcutAction)
  }

  private publishStatus(): void {
    const status = this.report
    const key = JSON.stringify(status)
    if (key === this.lastStatus) return
    this.lastStatus = key
    this.opts.onStatus(status)
  }
}
