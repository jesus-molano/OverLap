/**
 * Export and import of one saved layout as a JSON file, through the system's file dialogs.
 * The dialogs and the file system are injected (tests pass doubles); what is read is
 * validated by parseLayoutFile, which takes the layout fields only.
 */
import type { LayoutNotice } from '@shared/ipc'
import {
  MAX_LAYOUT_FILE_BYTES,
  layoutFileName,
  layoutFileText,
  parseLayoutFile,
  type LayoutImport
} from '@shared/layouts'
import type { LayoutWidget, SavedLayout } from '@shared/types'
import type { WidgetId } from '@shared/widgets'

export interface LayoutFileDeps {
  /** Asks where to save (the file name suggested); null when cancelled. */
  pickSavePath(defaultName: string): Promise<string | null>
  /** Asks which file to open; null when cancelled. */
  pickOpenPath(): Promise<string | null>
  writeText(path: string, text: string): void
  /** Size in bytes, read before the file itself. */
  sizeOf(path: string): number
  readText(path: string): string
}

/** Writes `layout` where the user chooses. Null when the dialog was cancelled. */
export async function exportLayout(
  layout: SavedLayout,
  deps: LayoutFileDeps
): Promise<LayoutNotice | null> {
  const path = await deps.pickSavePath(layoutFileName(layout.name))
  if (path === null) return null
  try {
    deps.writeText(path, layoutFileText(layout))
    return { kind: 'exported', name: layout.name }
  } catch (err) {
    console.warn(`[layouts] could not write ${path}:`, err)
    return { kind: 'export-failed', name: layout.name }
  }
}

/**
 * Reads and validates the file the user chooses. Null when the dialog was cancelled;
 * `{ ok: false, error: 'read' }` when the file could not be read.
 */
export async function readLayoutFile(
  fallback: Readonly<Record<WidgetId, LayoutWidget>>,
  deps: LayoutFileDeps
): Promise<LayoutImport | { ok: false; error: 'read' } | null> {
  const path = await deps.pickOpenPath()
  if (path === null) return null
  let text: string
  try {
    if (deps.sizeOf(path) > MAX_LAYOUT_FILE_BYTES) return { ok: false, error: 'too-big' }
    text = deps.readText(path)
  } catch (err) {
    console.warn(`[layouts] could not read ${path}:`, err)
    return { ok: false, error: 'read' }
  }
  return parseLayoutFile(text, fallback)
}
