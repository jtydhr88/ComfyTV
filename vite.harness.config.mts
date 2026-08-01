import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'
import Icons from 'unplugin-icons/vite'

export default defineConfig({
  root: fileURLToPath(new URL('./e2e/harness', import.meta.url)),
  base: './',
  plugins: [vue(), tailwindcss(), Icons({ compiler: 'vue3', autoInstall: false })],
  resolve: {
    alias: {
      '@/lib/comfyApp': fileURLToPath(new URL('./e2e/harness/stubs/comfyApp.ts', import.meta.url)),
      '@/utils/uploadCanvas': fileURLToPath(new URL('./e2e/harness/stubs/uploadCanvas.ts', import.meta.url)),
      '@/components/stages/StageCard.vue': fileURLToPath(new URL('./e2e/harness/stubs/StageCardStub.vue', import.meta.url)),
      '@jtydhr88/pentrado': fileURLToPath(new URL('./packages/pentrado/src', import.meta.url)),
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  build: {
    outDir: fileURLToPath(new URL('./e2e/dist', import.meta.url)),
    emptyOutDir: true,
    target: 'es2022',
    rollupOptions: {
      input: {
        index: fileURLToPath(new URL('./e2e/harness/index.html', import.meta.url)),
        ui: fileURLToPath(new URL('./e2e/harness/ui.html', import.meta.url)),
        midiroll: fileURLToPath(new URL('./e2e/harness/midiroll.html', import.meta.url)),
        storyboard: fileURLToPath(new URL('./e2e/harness/storyboard.html', import.meta.url)),
        score: fileURLToPath(new URL('./e2e/harness/score.html', import.meta.url)),
        scene3d: fileURLToPath(new URL('./e2e/harness/scene3d.html', import.meta.url)),
        material: fileURLToPath(new URL('./e2e/harness/material.html', import.meta.url)),
      },
    },
  },
})
