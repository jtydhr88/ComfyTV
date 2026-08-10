import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
import Icons from 'unplugin-icons/vite'
import { resolve } from 'path'

export default defineConfig({
  plugins: [vue(), Icons({ compiler: 'vue3', autoInstall: false })],
  resolve: {
    alias: {
      '@jtydhr88/pentrado': resolve(__dirname, './packages/pentrado/src'),
      '@': resolve(__dirname, './src')
    }
  },
  test: {
    environment: 'happy-dom',
    globals: true,
    include: ['src/**/*.test.ts', 'src/**/*.spec.ts', 'packages/*/src/**/*.test.ts'],
    setupFiles: ['./src/__tests__/setup.ts'],
    retry: process.env.CI ? 2 : 0,
    silent: 'passed-only',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/**/*.ts', 'src/**/*.vue', 'packages/*/src/**/*.ts'],
      exclude: [
        'packages/*/src/**/*.vue',
        'packages/pentrado/src/vendor/**',
        'src/widgets/three/**',
        'src/widgets/glsl/**',
        'src/composables/widgets/useLightBall.ts',
        'src/components/widgets/curve/useCurveEditor.ts',
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
        'src/composables/stages/useCurrentViewCapture.ts',
        'src/composables/stages/useMultiViewCapture.ts',
        'src/composables/stages/useMentionSuggestion.ts',
        'src/main.ts',
        'src/i18n.ts',
        'src/lib/comfyApp.ts',
        'src/__tests__/**',
        'src/composables/stages/useStageNode.ts',
        'src/api/schemas.ts',
        'src/components/**/*.vue',
        'src/widgets/storyboard/pdfExport.ts',
        'src/widgets/storyboard/psdExport.ts',
        'src/lib/pentradoHost.ts',
        'src/lib/shared2d/transformMath.ts',
      ],
      thresholds: {
        statements: 77,
        branches:   70,
        functions:  82,
        lines:      79,
      },
    },
  },
})
