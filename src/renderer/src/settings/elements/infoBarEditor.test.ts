/** An info bar's editor: one choice for whether and how big the bar is (R20). */
import { describe, expect, it } from 'vitest'
import { messagesFor } from '@shared/i18n'
import { INFO_BAR_SIZES } from '@shared/infoBar'
import { choiceOptions } from '../controls/choice'
import SOURCE from './InfoBarEditor.vue?raw'

describe('InfoBarEditor', () => {
  it('offers "No / Pequeña / Normal / Grande" as one choice, no switch beside a size', () => {
    const es = messagesFor('es').settings.infoBar.sizeChoices
    expect(choiceOptions(INFO_BAR_SIZES, es).map((o) => o.label)).toEqual([
      'No',
      'Pequeña',
      'Normal',
      'Grande'
    ])
    const template = SOURCE.slice(SOURCE.indexOf('<template>'))
    expect(template).not.toContain('kind="switch"')
    expect(template.match(/<ChoiceControl/g)).toHaveLength(1)
  })

  it('shows the trend and wind options only while their item and the bar are shown', () => {
    expect(SOURCE).not.toContain(':disabled=')
    expect(SOURCE).toContain(`id === 'trackTemp' && visible && !off`)
  })
})
