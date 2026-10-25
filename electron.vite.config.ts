import { resolve } from 'path'
import { defineConfig } from 'electron-vite'
import vue from '@vitejs/plugin-vue'

const alias = { '@shared': resolve('src/shared') }

export default defineConfig({
  // The telemetry utilityProcess is bundled from src/main via
  // `import telemetryEntry from '../telemetry/index?modulePath'`.
  main: {
    resolve: { alias }
  },
  preload: {
    resolve: { alias }
  },
  renderer: {
    resolve: {
      alias: {
        ...alias,
        '@renderer': resolve('src/renderer/src')
      }
    },
    plugins: [vue()]
  }
})
