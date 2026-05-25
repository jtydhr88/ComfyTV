import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: { '@': resolve(__dirname, './src') }
  },
  test: {
    environment: 'happy-dom',
    globals: true,
    include: ['src/**/*.test.ts', 'src/**/*.spec.ts'],
    setupFiles: ['./src/__tests__/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/**/*.ts', 'src/**/*.vue'],
      exclude: [
        'src/widgets/three/**',
        'src/widgets/painter/*Canvas*',
        'src/widgets/painter/types.ts',
        'src/components/widgets/*Canvas*.vue',
        'src/components/widgets/PainterCanvas.vue',
        'src/components/widgets/PanoramaCanvas.vue',
        'src/components/widgets/CropCanvas.vue',
        'src/components/widgets/SceneCanvas.vue',
        'src/components/widgets/ImageCompare.vue',
        'src/composables/widgets/useCameraWidget.ts',
        'src/composables/widgets/useImageCrop.ts',
        'src/composables/widgets/useImagePanZoom.ts',
        'src/composables/widgets/usePainter.ts',
        'src/composables/widgets/useTransformPipeline.ts',
        'src/main.ts',
        'src/i18n.ts',
        'src/lib/comfyApp.ts',
        'src/__tests__/**',
        'src/composables/stages/useStageNode.ts',
        'src/api/schemas.ts',
        'src/components/**/*.vue',
      ],
      thresholds: {
        statements: 80,
        branches:   75,
        functions:  80,
        lines:      80,
      },
    },
  },
})
