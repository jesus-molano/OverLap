/**
 * Semantic tones of chips, badges and text (theme.css `.ov-tone-*`): good / bad = for or
 * against you, best = fastest of the class, warn = attention, info = neutral information,
 * accent = you, dim = unknown or not applicable.
 */
export type Tone = 'neutral' | 'good' | 'bad' | 'best' | 'warn' | 'info' | 'accent' | 'dim'

/** Tone of a signed value in your favour (+) or against you (-); dim when unknown or zero. */
export function signTone(v: number | null): Tone {
  if (v === null || !Number.isFinite(v) || v === 0) return 'dim'
  return v > 0 ? 'good' : 'bad'
}
