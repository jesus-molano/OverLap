/**
 * Semantic tones of chips, badges and text (theme.css `.ov-tone-*`): good / bad = for or
 * against you, best = fastest of the class, warn = attention, info = neutral information,
 * dim = unknown or not applicable. No accent tone: the accent means you, and it is drawn only
 * by the shapes that mark you (your row's bracket and position plate, your radar car, the
 * delta's marker of your own lap).
 */
export type Tone = 'neutral' | 'good' | 'bad' | 'best' | 'warn' | 'info' | 'dim'

/** Tone of a signed value in your favour (+) or against you (-); dim when unknown or zero. */
export function signTone(v: number | null): Tone {
  if (v === null || !Number.isFinite(v) || v === 0) return 'dim'
  return v > 0 ? 'good' : 'bad'
}
