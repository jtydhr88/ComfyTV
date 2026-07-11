import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'
import cssInjectedByJs from 'vite-plugin-css-injected-by-js'
import Icons from 'unplugin-icons/vite'
import { resolve } from 'path'
import { existsSync, cpSync } from 'fs'

function copyNodeDocs() {
  return {
    name: 'copy-node-docs',
    closeBundle() {
      const src = resolve(__dirname, 'node-docs')
      const dest = resolve(__dirname, 'js/docs')
      if (existsSync(src)) {
        cpSync(src, dest, { recursive: true })
      }
    }
  }
}

export default defineConfig({
  plugins: [
    vue(),
    tailwindcss(),
    Icons({ compiler: 'vue3', autoInstall: false }),
    cssInjectedByJs(),
    copyNodeDocs()
  ],
  resolve: {
    alias: { '@': resolve(__dirname, './src') }
  },
  build: {
    lib: {
      entry: resolve(__dirname, './src/main.ts'),
      formats: ['es'],
      fileName: 'main'
    },
    rollupOptions: {
      external: ['../../../scripts/app.js'],
      output: {
        dir: 'js',
        entryFileNames: 'main.js',
        chunkFileNames: 'assets/[name]-[hash].mjs',
        assetFileNames: 'assets/[name]-[hash][extname]'
      }
    },
    sourcemap: true,
    minify: false
  },
  define: {
    'process.env.NODE_ENV': JSON.stringify('production')
  }
})
