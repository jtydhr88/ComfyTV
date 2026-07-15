<template>
  <div
    v-if="layer"
    class="ctv:absolute ctv:top-2 ctv:left-2 ctv:z-20 ctv:flex ctv:w-64 ctv:flex-col ctv:gap-1.5 ctv:rounded-lg
           ctv:border ctv:border-border-default ctv:bg-interface-menu-surface ctv:p-2 ctv:text-xs ctv:shadow-lg"
    @pointerdown.stop
    @keydown.stop
    @keydown.escape="close"
  >
    <div class="ctv:flex ctv:items-center ctv:gap-1">
      <span class="ctv:flex-1 ctv:text-3xs ctv:uppercase ctv:tracking-wide ctv:text-muted-foreground">
        {{ $t('layerEditor.sectionText') }}
      </span>
      <button type="button" :class="miniBtnClass" :title="$t('layerEditor.close')" @click="close">
        <IconX class="ctv:size-3.5" />
      </button>
    </div>

    <textarea
      ref="textareaEl"
      :value="layer.text"
      rows="2"
      :placeholder="$t('layerEditor.textPlaceholder')"
      class="ctv:w-full ctv:resize-y ctv:rounded ctv:border ctv:border-border-subtle ctv:bg-secondary-background
             ctv:box-border ctv:px-1.5 ctv:py-1 ctv:text-xs ctv:text-base-foreground ctv:outline-none
             ctv:[font-family:inherit] ctv:focus:border-primary-background"
      @input="(e) => patch({ text: (e.target as HTMLTextAreaElement).value })"
    />

    <div class="ctv:flex ctv:items-center ctv:gap-1.5">
      <span :class="labelClass">{{ $t('layerEditor.font') }}</span>
      <div class="ctv:min-w-0 ctv:flex-1">
        <ComfyTVSelect
          :model-value="fontValue"
          :options="fontOptions"
          @update:model-value="onFontChange"
        />
      </div>
    </div>
    <div v-if="fontFailed" class="ctv:text-2xs ctv:text-red-400">
      {{ $t('layerEditor.loadFontFailed') }}
    </div>

    <div class="ctv:flex ctv:items-center ctv:gap-1.5">
      <span :class="labelClass">{{ $t('layerEditor.fontSize') }}</span>
      <input
        type="number" min="4" max="2048" step="1"
        :class="numInputClass"
        :value="Math.round(layer.fontSize)"
        @change="(e) => patch({ fontSize: clampNum(e, 4, 2048) })"
      />
      <span :class="labelClass">{{ $t('layerEditor.textColor') }}</span>
      <input
        type="color"
        class="ctv:h-5 ctv:w-7 ctv:cursor-pointer ctv:rounded ctv:border-0 ctv:bg-transparent ctv:p-0"
        :value="layer.color"
        @input="(e) => patch({ color: (e.target as HTMLInputElement).value })"
      />
    </div>

    <div class="ctv:flex ctv:items-center ctv:gap-1.5">
      <span :class="labelClass">{{ $t('layerEditor.letterSpacing') }}</span>
      <input
        type="number" min="-50" max="200" step="1"
        :class="numInputClass"
        :value="layer.letterSpacing"
        @change="(e) => patch({ letterSpacing: clampNum(e, -50, 200) })"
      />
      <span :class="labelClass">{{ $t('layerEditor.lineHeight') }}</span>
      <input
        type="number" min="0.5" max="4" step="0.1"
        :class="numInputClass"
        :value="layer.lineHeight"
        @change="(e) => patch({ lineHeight: clampNum(e, 0.5, 4) })"
      />
    </div>

    <div class="ctv:flex ctv:items-center ctv:gap-1.5">
      <span :class="labelClass">{{ $t('layerEditor.align') }}</span>
      <div class="ctv:flex ctv:gap-0.5 ctv:rounded ctv:bg-secondary-background ctv:p-0.5">
        <button
          v-for="a in ALIGNS"
          :key="a.value"
          type="button"
          :class="alignBtnClass(layer.align === a.value)"
          :title="$t(a.labelKey)"
          @click="patch({ align: a.value })"
        >
          <component :is="a.icon" class="ctv:size-3.5" />
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import IconAlignCenter from '~icons/lucide/align-center'
import IconAlignLeft from '~icons/lucide/align-left'
import IconAlignRight from '~icons/lucide/align-right'
import IconX from '~icons/lucide/x'

import ComfyTVSelect from '@/components/widgets/ComfyTVSelect.vue'
import type { LayerEditorController } from '@/composables/widgets/useLayerEditorStage'
import type { FontRef, TextLayer } from '@/widgets/layerEditor/types'

const props = defineProps<{
  editor: LayerEditorController
}>()

const editor = props.editor
const textareaEl = ref<HTMLTextAreaElement | null>(null)

const layer = computed<TextLayer | null>(() => {
  const id = editor.editingTextId.value
  const l = id ? editor.state.value.layers.find((x) => x.id === id) : null
  return l?.type === 'text' ? l : null
})

watch(() => editor.editingTextId.value, async (id) => {
  if (!id) return
  await nextTick()
  textareaEl.value?.focus()
})

function close(): void {
  editor.editingTextId.value = null
}

function patch(p: Partial<TextLayer>): void {
  const l = layer.value
  if (l) editor.updateTextLayer(l.id, p)
}

function clampNum(e: Event, min: number, max: number): number {
  const v = Number((e.target as HTMLInputElement).value)
  return Math.min(max, Math.max(min, Number.isFinite(v) ? v : min))
}

const fontOptions = computed(() =>
  editor.fontStore.builtins().map((b) => ({
    label: b.name,
    value: `builtin:${b.id}`,
  })),
)

const fontValue = computed(() => {
  const l = layer.value
  if (!l) return ''
  return l.fontRef.kind === 'builtin' ? `builtin:${l.fontRef.id}` : `url:${l.fontRef.url}`
})

const fontFailed = computed(() => {
  const l = layer.value
  return l ? editor.fontStore.hasFailed(l.fontRef) : false
})

function onFontChange(v: unknown): void {
  const s = String(v ?? '')
  if (!s.startsWith('builtin:')) return
  const ref: FontRef = { kind: 'builtin', id: s.slice('builtin:'.length) }
  patch({ fontRef: ref })
}

const ALIGNS = [
  { value: 'left' as const, labelKey: 'layerEditor.alignLeft', icon: IconAlignLeft },
  { value: 'center' as const, labelKey: 'layerEditor.alignCenter', icon: IconAlignCenter },
  { value: 'right' as const, labelKey: 'layerEditor.alignRight', icon: IconAlignRight },
]

const labelClass = 'ctv:shrink-0 ctv:text-2xs ctv:uppercase ctv:tracking-wide ctv:text-muted-foreground'
const numInputClass =
  'ctv-num-input ctv:w-14 ctv:min-w-0 ctv:rounded ctv:border ctv:border-border-subtle ctv:bg-secondary-background ' +
  'ctv:px-1 ctv:py-0.5 ctv:text-[11px] ctv:font-mono ctv:text-base-foreground'
const miniBtnClass =
  'ctv:inline-flex ctv:size-5 ctv:items-center ctv:justify-center ctv:rounded ctv:border-0 ' +
  'ctv:bg-transparent ctv:p-0 ctv:text-muted-foreground ctv:cursor-pointer ' +
  'ctv:hover:bg-secondary-background ctv:hover:text-base-foreground'

function alignBtnClass(active: boolean): string {
  return [
    'ctv:inline-flex ctv:size-6 ctv:items-center ctv:justify-center ctv:rounded-sm ctv:border-0 ctv:cursor-pointer',
    active
      ? 'ctv:bg-secondary-background-selected ctv:text-primary-background'
      : 'ctv:bg-transparent ctv:text-muted-foreground ctv:hover:text-base-foreground',
  ].join(' ')
}
</script>
