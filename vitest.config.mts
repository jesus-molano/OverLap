import { resolve } from 'node:path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: {
      '@shared': resolve(import.meta.dirname, 'src/shared'),
      '@renderer': resolve(import.meta.dirname, 'src/renderer/src')
    }
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    restoreMocks: true,
    // Renderer stylesheets load as text (ui/styleBudget.test.ts reads them with ?raw);
    // otherwise Vitest replaces every CSS file with an empty string.
    css: { include: [/\/src\/renderer\/.+\.css/] }
  }
})
