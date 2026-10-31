import { describe, expect, it } from 'vitest'
import { classOrderKey } from '@shared/classOrder'
import { DEFAULT_SETTINGS } from '@shared/settings'
import { droppedList, elAction, parseEl } from './preview/previewEdit'
import { PREVIEW_CLASS_NAMES } from '../widgets/standings/preview'
import {
  classEntries,
  classOrderNames,
  classSpec,
  classTexts,
  drawnFirst,
  namesOf,
  namesToSave
} from './classOrderList'

const key = classOrderKey
const WORDS = { inSession: 'En esta sesión', inPreview: 'En la vista previa' }

describe('the class order’s list (9)', () => {
  it('starts from nothing saved: no class order of its own for a new install', () => {
    expect(DEFAULT_SETTINGS.standings.classOrder).toBe('player')
    expect(DEFAULT_SETTINGS.standings.classList).toEqual([])
  })

  it('lists the saved classes, then this session’s, then the sample’s', () => {
    const names = classOrderNames(['GT3', 'M2'], ['GT4', 'gt3'], PREVIEW_CLASS_NAMES)
    expect(names).toEqual(['GT3', 'M2', 'GT4', 'GTP', 'LMP2'])
    const texts = classTexts(names, ['GT3', 'M2'], ['GT4', 'gt3'], WORDS)
    expect(texts[key('GT3')]).toEqual({ label: 'GT3', hint: 'En esta sesión' })
    expect(texts[key('M2')]).toEqual({ label: 'M2' })
    expect(texts[key('GT4')]).toEqual({ label: 'GT4', hint: 'En esta sesión' })
    expect(texts[key('GTP')]).toEqual({ label: 'GTP', hint: 'En la vista previa' })
  })

  it('reads the names back from the rows, and resets to nothing saved', () => {
    const names = classOrderNames(['LMP2'], [], PREVIEW_CLASS_NAMES)
    const entries = classEntries(names)
    expect(entries.every((e) => e.visible && /^[a-p]+$/.test(e.id))).toBe(true)
    expect(namesOf([...entries, { id: 'gap', visible: true }], names)).toEqual([
      'LMP2',
      'GTP',
      'GT3'
    ])
    // Without the names it was made from, as the key holds them.
    expect(namesOf(entries)).toEqual(['lmp2', 'gtp', 'gt3'])
    const spec = classSpec(names, classOrderNames([], [], PREVIEW_CLASS_NAMES))
    expect(namesOf(spec.default, names)).toEqual(['GTP', 'LMP2', 'GT3'])
    expect(spec.required).toEqual(spec.ids)
    expect(spec.fixedOrder).toBe(false)
  })

  it('lets the sample drag a class by its name, never hide it', () => {
    const names = drawnFirst(['GT3', 'GTP', 'LMP2'], ['LMP2', 'GT4'])
    expect(names).toEqual(['GT3', 'GTP', 'LMP2', 'GT4'])
    const spec = classSpec(names, names)
    const list = classEntries(names)
    expect(elAction(spec, list, key('GTP'))).toBe('move-required')
    // The sample's data-el on a class name is the preview's.
    expect(parseEl(`standings.classOrder.${key('GTP')}`)).toEqual({
      zone: 'standings.classOrder',
      id: key('GTP')
    })
    // LMP2 dropped above GT3, as the sample draws them: the order saved.
    const next = droppedList(spec, list, key('LMP2'), { kind: 'before', id: key('GT3') })
    expect(namesOf(next ?? [], names)).toEqual(['LMP2', 'GT3', 'GTP', 'GT4'])
  })

  it('saves neither the sample’s names at the end nor more than the cap, never this session’s', () => {
    // Nothing saved; LMP2 moved to the top: GT3 (this session) kept, GTP (the sample's) not.
    expect(
      namesToSave(['LMP2', 'GT3', 'GTP'], { saved: [], live: ['GT3'], moved: 'LMP2', max: 32 })
    ).toEqual(['LMP2', 'GT3'])
    // A sample name before a kept one stays: the order shown is the order saved.
    expect(
      namesToSave(['GT3', 'GTP', 'LMP2'], { saved: [], live: [], moved: 'LMP2', max: 32 })
    ).toEqual(['GT3', 'GTP', 'LMP2'])
    // Saved names stay, whatever their case.
    expect(namesToSave(['M2', 'GTP'], { saved: ['gtp'], live: [], max: 32 })).toEqual(['M2', 'GTP'])
    // 32 remembered and this session's two at the end: the lowest remembered ones go instead.
    const old = Array.from({ length: 32 }, (_, i) => `C${i}`)
    const out = namesToSave([...old, 'GT4', 'GTE'], {
      saved: old,
      live: ['GTE', 'GT4'],
      max: 32
    })
    expect(out).toHaveLength(32)
    expect(out.slice(-2)).toEqual(['GT4', 'GTE'])
    expect(out).not.toContain('C31')
    expect(out).not.toContain('C30')
  })

  it('knows a class by one id whatever its case, so a drag on either spelling finds its row', () => {
    const names = classOrderNames([], ['gt3'], PREVIEW_CLASS_NAMES)
    // The session's «gt3» and the sample's «GT3» are one row, keyed as the sample draws it.
    expect(names).toEqual(['gt3', 'GTP', 'LMP2'])
    expect(classEntries(names).map((e) => e.id)).toContain(key('GT3'))
  })
})
