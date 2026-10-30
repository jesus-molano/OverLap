/**
 * The confirmation before a style (AppearancePresets): planStyle's changes worded, grouped by
 * Apariencia and then by widget, old to new in Apariencia's own words; a long list folded after
 * the first lines. Pure.
 */
import type { PresetField, PresetValues, StyleChange } from '@shared/appearancePresets'
import { widgetTitle, type Messages } from '@shared/i18n'
import type { LayoutLibrary } from '@shared/types'
import { WIDGET_IDS, type WidgetId } from '@shared/widgets'
import { optionsTarget } from './layoutsView'
import { formatPercent, toPercent } from './values'

/**
 * One line: a sentence, or a value changed (`text` its label, then `from` and `to`, the arrow
 * between them an icon in the dialog).
 */
export interface ChangeLine {
  readonly text: string
  readonly from?: string
  readonly to?: string
}

/** One heading of the list (the look, or what the widgets show) and its lines. */
export interface ChangeGroup {
  readonly title: string
  readonly lines: readonly ChangeLine[]
}

/** Lines of each group shown before «Y n cambios más». */
export const STYLE_LINES_SHOWN = 4

/** Apariencia's label of a look field, as its control says it. */
function fieldLabel(m: Messages, field: PresetField): string {
  const s = m.settings
  const a = s.appearance
  const labels: Record<PresetField, string> = {
    backgroundOpacity: a.color.background,
    fontScale: a.text.fontScale,
    textHalo: a.text.halo,
    density: s.common.density,
    stripes: a.rows.stripes,
    licenseStyle: s.common.license,
    numberStyle: a.rows.number,
    nameFormat: s.common.nameFormat,
    brandMarks: s.driverCell.brandMarks,
    brandLogos: a.rows.brandLogos,
    countryFlags: s.driverCell.countryFlags,
    penaltyFlags: s.common.penaltyFlags
  }
  return labels[field]
}

/** A look value as its control's choice says it. */
function valueText(m: Messages, field: PresetField, value: PresetValues[PresetField]): string {
  const s = m.settings
  const a = s.appearance
  if (typeof value === 'boolean') return s.choices.onOff[value ? 'on' : 'off'].label
  if (typeof value === 'number') {
    return formatPercent(m, field === 'backgroundOpacity' ? toPercent(value) : value)
  }
  switch (field) {
    case 'textHalo':
      return a.text.haloChoices[value as PresetValues['textHalo']].label
    case 'density':
      return s.choices.density[value as PresetValues['density']].label
    case 'licenseStyle':
      return a.rows.licenseChoices[value as PresetValues['licenseStyle']].label
    case 'numberStyle':
      return a.rows.numberChoices[value as PresetValues['numberStyle']].label
    case 'nameFormat':
      return s.choices.nameFormat[value as PresetValues['nameFormat']]
    case 'brandMarks':
      return s.driverCell.brandChoices[value as PresetValues['brandMarks']].label
    case 'brandLogos':
      return a.rows.brandLogoChoices[value as PresetValues['brandLogos']].label
    default:
      return String(value)
  }
}

/**
 * The changes worded, in two groups: the look (one line a field, old → new), then what each
 * widget shows (one line a widget, in the sidebar's order: «Posiciones: se muestran 5 columnas
 * más, 1 barra de información más»); `grown`: the free widgets whose window grows (styleGrowth).
 */
export function styleChangeGroups(
  m: Messages,
  changes: readonly StyleChange[],
  grown: readonly WidgetId[] = []
): ChangeGroup[] {
  const c = m.settings.appearance.presets.confirm
  const out: ChangeGroup[] = []
  const look = changes.flatMap((ch) =>
    ch.kind === 'look'
      ? [
          {
            text: fieldLabel(m, ch.field),
            from: valueText(m, ch.field, ch.from),
            to: valueText(m, ch.field, ch.to)
          }
        ]
      : []
  )
  if (look.length > 0) out.push({ title: c.look, lines: look })
  const widgets = WIDGET_IDS.flatMap((id) => {
    const parts = changes.flatMap((ch) =>
      ch.kind === 'widget' && ch.widget === id ? [c[ch.what](ch.count)] : []
    )
    if (grown.includes(id)) parts.push(c.grows)
    return parts.length > 0 ? [{ text: c.widgetLine(widgetTitle(m, id), parts.join(', ')) }] : []
  })
  if (widgets.length > 0) out.push({ title: c.contents, lines: widgets })
  return out
}

/**
 * Each group cut after its first `shown` lines (so the widgets are never pushed out by the look),
 * and how many lines were cut in all.
 */
export function foldGroups(
  groups: readonly ChangeGroup[],
  shown = STYLE_LINES_SHOWN
): { groups: ChangeGroup[]; hidden: number } {
  let hidden = 0
  const out = groups.map((g) => {
    hidden += Math.max(0, g.lines.length - shown)
    return { title: g.title, lines: g.lines.slice(0, shown) }
  })
  return { groups: out, hidden }
}

/** Where a style is kept: the global look, and the widgets' contents of the layout in use. */
export function styleWhere(m: Messages, lib: LayoutLibrary, contents: boolean): string {
  const c = m.settings.appearance.presets.confirm
  if (!contents) return c.lookWhere
  const target = optionsTarget(lib)
  return target.shared ? c.contentsShared : c.contentsWhere(target.name)
}
