import type { ShortcutStatusReport } from '@shared/shortcuts'
import type { HiddenReason, OverlaySettings, OverlayStatus, Rect } from '@shared/types'
import { WIDGET_IDS, type WidgetId } from '@shared/widgets'

/** Everything «Copiar diagnóstico» reads (main gathers it; this only words it). */
export interface DiagnosticsInput {
  version: string
  /** process.versions: electron, chrome, node. */
  versions: Partial<Record<string, string>>
  /** 'Windows_NT 10.0.26200 x64'. */
  os: string
  status: OverlayStatus
  editMode: boolean
  overlayHidden: boolean
  settings: OverlaySettings
  /** Why each widget a rule hides right now is hidden (null: no known reason). */
  autoHidden: Partial<Record<WidgetId, HiddenReason | null>>
  shortcuts: ShortcutStatusReport
  displays: { bounds: Rect; scaleFactor: number; primary: boolean }[]
  saveFailing: boolean
  settingsFile: string
  logFile: string
  /** The user's home folder, written as %USERPROFILE% in the paths (no user name). */
  home: string
}

/**
 * The text «Copiar diagnóstico» puts on the clipboard (R35): one fact per line, in English and
 * with the program's own codes (it is for a bug report, whatever the interface language), and
 * nothing personal: no driver names, no car or track, no layout names, no user name in the paths.
 * Pure.
 */
export function diagnosticsText(d: DiagnosticsInput): string {
  const s = d.settings
  const v = d.versions
  const st = d.status
  const widgets = WIDGET_IDS.map((id) => {
    const w = s.widgets[id]
    const hidden = d.autoHidden[id]
    const rule = hidden === undefined ? '' : ` hidden-now=${hidden ?? 'unknown'}`
    const b = w.bounds
    return `  ${id}: ${w.visible ? 'on' : 'off'}${w.locked ? ' locked' : ''} at ${b.x},${b.y} ${b.width}x${b.height}${rule}`
  })
  const failing = Object.entries(d.shortcuts.actions)
    .filter(([, status]) => status === 'unavailable')
    .map(([action]) => action)
  const displays = d.displays.map((x, i) => {
    const b = x.bounds
    return `  ${i + 1}: ${b.width}x${b.height} at ${b.x},${b.y} scale ${x.scaleFactor}${x.primary ? ' primary' : ''}`
  })
  return [
    `OverLap ${d.version} (Electron ${v.electron ?? '?'}, Chrome ${v.chrome ?? '?'}, Node ${v.node ?? '?'})`,
    `OS: ${d.os}`,
    `Status: ${st.state} source=${st.source} note=${st.note}${st.detail ? ` detail=${anonymous(st.detail, d.home)}` : ''}`,
    `Overlay hidden by the user: ${d.overlayHidden ? 'yes' : 'no'}; edit mode: ${d.editMode ? 'on' : 'off'}`,
    `Show when: ${s.visibility.showWhen}; replays: ${s.visibility.replays}`,
    `Language: ${s.appearance.language}; layouts: ${s.savedLayouts.list.length}; auto switch: ${s.layouts.autoSwitch ? 'on' : 'off'}`,
    `Saving: ${d.saveFailing ? 'FAILING' : 'ok'}`,
    `Shortcuts not working: ${failing.length === 0 ? 'none' : failing.join(', ')} (${d.shortcuts.unavailable.length} bindings)`,
    'Widgets:',
    ...widgets,
    'Displays:',
    ...displays,
    `Settings: ${anonymous(d.settingsFile, d.home)}`,
    `Log: ${anonymous(d.logFile, d.home)}`
  ].join('\n')
}

/**
 * `text` with every `home` in it (any case, either slash, doubled backslashes too) written as
 * %USERPROFILE%: a path, or an error message that holds one ("ENOENT: open 'C:\Users\…'").
 */
export function anonymous(text: string, home: string): string {
  const parts = home.split(/[\\/]+/).filter((p) => p !== '')
  if (parts.length === 0) return text
  const escaped = parts.map((p) => p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  // Only the whole folder: 'C:\Users\Ana' is not the start of 'C:\Users\Anabel'.
  const re = new RegExp(`${escaped.join('[\\\\/]+')}(?=$|[\\\\/\\s'"\`),;:])`, 'gi')
  return text.replace(re, '%USERPROFILE%')
}
