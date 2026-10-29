/**
 * Main's side of the saved layouts: the settings window's layout commands, the tray's and the
 * shortcut's switch, and the automatic layout (the player's car from the telemetry process).
 * Electron-free: main injects the store, the windows and the file dialogs.
 *
 * Applying a layout takes the same path as resetting a widget's bounds: pending wheel and fit
 * saves written first (into the layout being left), then one store change with the places and
 * the options (applyLayout), every widget moved to its saved bounds (a drag in progress
 * cancelled), then windows, telemetry, renderers and tray follow, with one broadcast. It works in
 * edit mode too (it is what you asked for); only the automatic switch waits for edit mode to end.
 */
import type { LayoutNotice, SettingsCommand } from '@shared/ipc'
import { LayoutAutoSwitch } from '@shared/layoutAuto'
import {
  applyLayout,
  applyWidgetOptionsToAll,
  deleteLayout,
  duplicateLayout,
  type DeletedLayout,
  findLayout,
  hasLayout,
  importLayout,
  linkCar,
  moveLayout,
  nextLayoutAfterActive,
  normalizeCarRef,
  noteSeenCar,
  renameLayout,
  restoreLayout,
  saveLayoutAs,
  setLayoutMode,
  sharedOptions,
  snapshotWidgets
} from '@shared/layouts'
import { settingsDraft } from '@shared/settings'
import type { CarRef, LayoutMode, OverlaySettings } from '@shared/types'
import { WIDGET_IDS, type WidgetId } from '@shared/widgets'
import { exportLayout, readLayoutFile, type LayoutFileDeps } from './layoutFiles'

/** The settings window's commands about layouts. */
export type LayoutCommand = Extract<SettingsCommand, { type: `layout-${string}` }>

export function isLayoutCommand(cmd: SettingsCommand): cmd is LayoutCommand {
  return cmd.type.startsWith('layout-')
}

export interface LayoutControlDeps {
  getSettings(): OverlaySettings
  /** Changes the store only (SettingsStore.update): the caller syncs. */
  update(mutate: (draft: OverlaySettings) => void): void
  /** Brings everything in line with the store after a change from `prev` (main's syncSettings). */
  sync(prev: OverlaySettings): void
  /** OverlayWindows.reloadBoundsOf. */
  reloadBounds(ids: readonly WidgetId[]): void
  /** OverlayWindows.flushPendingSaves: pending wheel and fit saves into the store (synced). */
  flushPendingSaves(): void
  isEditing(): boolean
  /** To the settings window (IPC.layoutNotice). */
  notify(notice: LayoutNotice): void
  /** To the settings window (IPC.currentCar). */
  carChanged(car: CarRef | null): void
  /** The file dialogs, built when needed (their parent is the settings window). */
  files(): LayoutFileDeps
  /** Name of an imported layout whose file has none, in the interface language. */
  importedName(): string
  /** The clock a layout that becomes the one in use is stamped with (Date.now by default). */
  now?(): number
  log?(message: string): void
}

export class LayoutControl {
  private readonly auto = new LayoutAutoSwitch()
  /** The layout deleted last, for its "Deshacer" ('layout-restore'); one at a time. */
  private lastDeleted: DeletedLayout | null = null

  constructor(private readonly deps: LayoutControlDeps) {}

  /** The car you are in now (null: none). */
  get car(): CarRef | null {
    return this.auto.car
  }

  /** The tray, the shortcut and the settings window: a layout chosen by hand (and saved). */
  choose(id: string): boolean {
    this.auto.onManualSwitch()
    return this.apply(id)
  }

  /** The 'next layout' shortcut: the one after the layout in use, wrapping around. */
  next(): boolean {
    const id = nextLayoutAfterActive(this.deps.getSettings().savedLayouts)
    return id !== null && this.choose(id)
  }

  /** The telemetry process told the player's car (null: none). */
  onCar(car: CarRef | null): void {
    if (car !== null) {
      const probe = settingsDraft(this.deps.getSettings())
      if (noteSeenCar(probe, car)) this.change((s) => void noteSeenCar(s, car))
    }
    const id = this.auto.onCar(car, this.context())
    this.deps.carChanged(this.auto.car)
    if (id !== null) this.apply(id, 'auto')
  }

  /** Edit mode ended: an automatic switch that waited for it. */
  onEditEnd(): void {
    const id = this.auto.onEditEnd(this.context())
    if (id !== null) this.apply(id, 'auto')
  }

  /** After any settings change from `prev`: turning the automatic mode on applies at once. */
  afterChange(prev: OverlaySettings): void {
    const next = this.deps.getSettings()
    if (prev.layouts.autoSwitch || !next.layouts.autoSwitch) return
    this.reevaluate()
  }

  /** One of the settings window's layout commands (already validated by isSettingsCommand). */
  async command(cmd: LayoutCommand): Promise<void> {
    switch (cmd.type) {
      case 'layout-save': {
        // The new one is in use: nothing moves, and nothing pending should replace it.
        this.auto.onManualSwitch()
        const car = cmd.car === undefined ? null : normalizeCarRef(cmd.car)
        let switchedOn = false
        this.change((s) => {
          const id = saveLayoutAs(s, cmd.name, this.now(), cmd.mode ?? 'full')
          // «Vincular a …» ticked (R26): the car you are in gets it, the switch goes on.
          if (id !== null && car !== null && linkCar(s, car, id) && !s.layouts.autoSwitch) {
            s.layouts.autoSwitch = true
            switchedOn = true
          }
        })
        if (switchedOn && car !== null) {
          this.deps.notify({ kind: 'auto-switch-on', carName: car.carName })
        }
        break
      }
      case 'layout-set-mode':
        // The one in use turning 'position' takes the shared options: what waits is written
        // first, as before applying a layout.
        if (cmd.id === this.deps.getSettings().savedLayouts.activeId) {
          this.deps.flushPendingSaves()
        }
        this.change((s) => void setLayoutMode(s, cmd.id, cmd.mode))
        break
      case 'layout-options-to-all':
        this.optionsToAll(cmd.widgetId, cmd.layoutId)
        break
      case 'layout-apply':
        this.choose(cmd.id)
        break
      case 'layout-duplicate':
        this.change((s) => void duplicateLayout(s, cmd.id, cmd.name))
        break
      case 'layout-rename':
        this.change((s) => void renameLayout(s, cmd.id, cmd.name))
        break
      case 'layout-delete':
        this.change((s) => {
          this.lastDeleted = deleteLayout(s, cmd.id)
        })
        break
      case 'layout-restore': {
        const gone = this.lastDeleted
        if (gone?.layout.id !== cmd.id) return
        this.lastDeleted = null
        this.change((s) => void restoreLayout(s, gone))
        break
      }
      case 'layout-move':
        this.change((s) => void moveLayout(s, cmd.id, cmd.step, cmd.aroundActive === true))
        break
      case 'layout-link-car': {
        const car = normalizeCarRef(cmd.car)
        if (car === null) return
        // Linking means "use this one in that car": «Según el coche» on too (R26), said once.
        let switchedOn = false
        this.change((s) => {
          if (linkCar(s, car, cmd.layoutId) && cmd.layoutId !== null && !s.layouts.autoSwitch) {
            s.layouts.autoSwitch = true
            switchedOn = true
          }
        })
        if (switchedOn) this.deps.notify({ kind: 'auto-switch-on', carName: car.carName })
        // Linking the car you are in: its layout now, if the automatic mode is on.
        if (this.auto.car?.carId === car.carId) this.reevaluate()
        break
      }
      case 'layout-export':
        await this.exportOne(cmd.id)
        break
      case 'layout-import':
        await this.importOne(cmd.mode ?? 'full')
        break
    }
  }

  /**
   * The options shown when the button was armed are layout `layoutId`'s: another one
   * applied since (the tray, a shortcut, the car) copies nothing, and the page says so.
   */
  private optionsToAll(widgetId: WidgetId, layoutId: string): void {
    let result: 'copied' | 'unchanged' | 'stale' = 'stale'
    if (layoutId === this.deps.getSettings().savedLayouts.activeId) {
      let changed = false
      this.change((s) => {
        changed = applyWidgetOptionsToAll(s, widgetId)
      })
      result = changed ? 'copied' : 'unchanged'
    }
    this.deps.notify({ kind: 'options-copied', widgetId, result })
  }

  private async exportOne(id: string): Promise<void> {
    const layout = findLayout(this.deps.getSettings().savedLayouts, id)
    if (!layout) return
    const notice = await exportLayout(structuredClone(layout), this.deps.files())
    if (notice) this.deps.notify(notice)
  }

  private async importOne(mode: LayoutMode): Promise<void> {
    const settings = this.deps.getSettings()
    const fallback = {
      widgets: snapshotWidgets(settings.widgets),
      options: sharedOptions(settings)
    }
    const result = await readLayoutFile(fallback, this.deps.files())
    if (result === null) return
    if (!result.ok) {
      this.deps.notify({ kind: 'import-failed', error: result.error })
      return
    }
    let added: string | null = null
    this.change((s) => {
      added = importLayout(s, result, this.deps.importedName(), mode)
    })
    const layout =
      added === null ? undefined : findLayout(this.deps.getSettings().savedLayouts, added)
    this.deps.notify(
      layout ? { kind: 'imported', name: layout.name } : { kind: 'import-failed', error: 'full' }
    )
  }

  private reevaluate(): void {
    const id = this.auto.reevaluate(this.context())
    if (id !== null) this.apply(id, 'auto')
  }

  private now(): number {
    return this.deps.now?.() ?? Date.now()
  }

  private context(): { settings: OverlaySettings; editing: boolean } {
    return { settings: this.deps.getSettings(), editing: this.deps.isEditing() }
  }

  private change(mutate: (draft: OverlaySettings) => void): void {
    const prev = this.deps.getSettings()
    this.deps.update(mutate)
    this.deps.sync(prev)
  }

  /** The store, then every widget to its saved bounds, then the rest (see the file's comment). */
  private apply(id: string, how: 'manual' | 'auto' = 'manual'): boolean {
    const before = this.deps.getSettings()
    if (!hasLayout(before.savedLayouts, id) || id === before.savedLayouts.activeId) return false
    // A wheel resize still waiting belongs to the layout in use: into the store (so into that
    // layout) before the widgets take the next one's fields.
    this.deps.flushPendingSaves()
    const prev = this.deps.getSettings()
    if (!hasLayout(prev.savedLayouts, id) || id === prev.savedLayouts.activeId) return false
    this.deps.update((s) => void applyLayout(s, id, this.now()))
    this.deps.reloadBounds(WIDGET_IDS)
    this.deps.sync(prev)
    const name = findLayout(this.deps.getSettings().savedLayouts, id)?.name ?? id
    this.deps.log?.(`[main] layout '${name}' applied (${how})`)
    return true
  }
}
