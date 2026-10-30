import { inject, provide, shallowRef, type InjectionKey, type ShallowRef } from 'vue'

/**
 * The factor a stage's sample is drawn at by its own width fit (WidgetSample, sampleBox), told to
 * the stage around it (SampleStage), so that the stage's height fit and the width fit together
 * never go below SAMPLE_MIN_SCALE (R53).
 */
const SAMPLE_SCALE: InjectionKey<ShallowRef<number>> = Symbol('sampleScale')

/** For SampleStage: the ref its sample writes (1 until it does). */
export function provideSampleScale(): ShallowRef<number> {
  const scale = shallowRef(1)
  provide(SAMPLE_SCALE, scale)
  return scale
}

/** For WidgetSample: the stage's ref, null outside a stage. */
export function injectSampleScale(): ShallowRef<number> | null {
  return inject(SAMPLE_SCALE, null)
}
