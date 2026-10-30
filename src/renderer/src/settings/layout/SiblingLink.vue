<script setup lang="ts">
import { useI18n } from '../../composables/useI18n'
import { pageTitle, type SettingsPage } from '../nav'
import { useNavigate } from '../navigate'
import NavIcon from './NavIcon.vue'

/**
 * A line that says what another page has of the same thing, with a button to it (R39: the
 * events Avisos and Testigos share). The button names the page with its sidebar icon.
 */
defineProps<{ text: string; page: SettingsPage }>()

const t = useI18n()
const navigate = useNavigate()
</script>

<template>
  <p class="sib">
    <span class="st-help sib-text">{{ text }}</span>
    <button type="button" class="st-btn st-btn-sm st-btn-ghost sib-go" @click="navigate(page)">
      <NavIcon :page="page" />
      <span>{{ t.settings.elements.goTo(pageTitle(t, page)) }}</span>
    </button>
  </p>
</template>

<style scoped>
.sib {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 4px 12px;
  margin-top: 8px;
}

.sib-text {
  flex: 1 1 20em;
  min-width: 0;
}

.sib-go {
  gap: 8px;
}
</style>
