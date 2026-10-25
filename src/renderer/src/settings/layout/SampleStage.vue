<script setup lang="ts">
/**
 * Backdrop of the live previews: a static picture of sky, kerb and asphalt, so the panel's
 * background opacity and the text halo read as they would over the game. Painted once.
 */
import { useI18n } from '../../composables/useI18n'

/** `caption`: the figure caption (default: the sample-data note in the current language). */
withDefaults(defineProps<{ caption?: string }>(), { caption: undefined })

const t = useI18n()
</script>

<template>
  <figure class="stage">
    <div class="scene" aria-hidden="true" />
    <div class="content">
      <slot />
    </div>
    <figcaption class="caption">{{ caption ?? t.settings.sample.caption }}</figcaption>
  </figure>
</template>

<style scoped>
.stage {
  position: relative;
  margin: 0;
  overflow: hidden;
  border: 1px solid var(--st-border);
  border-radius: var(--st-radius);
  background: #2f353f;
  isolation: isolate;
}

.scene {
  position: absolute;
  inset: 0;
  z-index: -1;
  background:
    linear-gradient(180deg, transparent 0 58%, rgba(0, 0, 0, 0.28) 100%),
    linear-gradient(180deg, transparent 0 41%, #d6dbe2 41% 42%, transparent 42% 100%),
    repeating-linear-gradient(90deg, #c8352e 0 18px, #e9ecef 18px 36px) 0 40% / 100% 6px no-repeat,
    linear-gradient(
      180deg,
      #7aa4d1 0%,
      #b9cde2 34%,
      #5c8a4c 34%,
      #4b7440 40%,
      #3b414b 42%,
      #2a2f37 100%
    );
}

.content {
  display: flex;
  justify-content: center;
  overflow-x: auto;
  padding: 22px 16px 30px;
}

.caption {
  position: absolute;
  right: 10px;
  bottom: 6px;
  color: rgba(255, 255, 255, 0.72);
  font-size: 11px;
  letter-spacing: 0.02em;
  text-shadow: 0 1px 0 rgba(0, 0, 0, 0.5);
  pointer-events: none;
}
</style>
