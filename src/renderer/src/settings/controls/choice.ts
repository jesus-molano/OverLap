/** One option of a ChoiceControl. */
export interface ChoiceOption<T extends string> {
  readonly value: T
  readonly label: string
  /** Tooltip with more detail. */
  readonly hint?: string
}

/** Options for a boolean shown as a choice ('Automático' / 'Fijo'). */
export type BoolChoice = 'on' | 'off'

export const toChoice = (on: boolean): BoolChoice => (on ? 'on' : 'off')
export const fromChoice = (v: BoolChoice): boolean => v === 'on'

/** A choice group of the dictionary: label and optional hint per value. */
export type ChoiceTexts<T extends string> = {
  readonly [K in T]: { readonly label: string; readonly hint?: string }
}

/** The options of `values`, in that order, worded by `texts` (a dictionary choice group). */
export function choiceOptions<T extends string>(
  values: readonly T[],
  texts: ChoiceTexts<T>
): ChoiceOption<T>[] {
  return values.map((value) => {
    const { label, hint } = texts[value]
    return hint === undefined ? { value, label } : { value, label, hint }
  })
}
