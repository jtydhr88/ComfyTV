import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'

export default defineConfig({
  root: fileURLToPath(new URL('./e2e/harness', import.meta.url)),
  base: './',
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  build: {
    outDir: fileURLToPath(new URL('./e2e/dist', import.meta.url)),
    emptyOutDir: true,
    target: 'es2022',
    rollupOptions: {
      input: fileURLToPath(new URL('./e2e/harness/index.html', import.meta.url)),
    },
  },
})
