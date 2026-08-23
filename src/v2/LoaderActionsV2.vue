<template>
  <template v-if="state.output">
    <template v-if="kind === 'video'">
      <button
        v-for="p in primary"
        :key="p.id"
        type="button"
        class="v2-toolbar__btn"
        :title="t(presetTooltipKey('videoChange', p.id))"
        @pointerdown.stop
        @click.stop="fire(`change:${p.id}`)"
      >
        <StageIcon :name="p.icon" class="v2-lact__icon" />
        <span>{{ t(presetLabelKey('videoChange', p.id)) }}</span>
      </button>
      <button
        type="button"
        class="v2-toolbar__btn"
        :title="t(actionTooltipKey('video', 'extend'))"
        @pointerdown.stop
        @click.stop="fire('extend')"
      >
        <StageIcon name="pi pi-arrow-right" class="v2-lact__icon" />
        <span>{{ t(actionLabelKey('video', 'extend')) }}</span>
      </button>
      <div class="v2-toolbar__sep" />
      <button
        ref="moreBtn"
        type="button"
        class="v2-toolbar__btn"
        @pointerdown.stop
        @click.stop="toggleMore"
      >
        <span>{{ t('v2.moreActions') }}</span>
        <i class="pi pi-chevron-down v2-lact__chev" />
      </button>
    </template>
    <template v-else-if="kind === 'model'">
      <button
        type="button"
        class="v2-toolbar__btn"
        :title="t(actionTooltipKey('model', 'product-shot'))"
        @pointerdown.stop
        @click.stop="fire('product-shot')"
      >
        <StageIcon name="pi pi-camera" class="v2-lact__icon" />
        <span>{{ t(actionLabelKey('model', 'product-shot')) }}</span>
      </button>
    </template>
    <button
      v-if="kind !== 'model'"
      type="button"
      class="v2-toolbar__btn v2-toolbar__btn--icononly"
      :title="t('stage.action.download')"
      @pointerdown.stop
      @click.stop="onDownload"
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7">
        <path d="M12 3.5V15M7 10.5l5 5 5-5M4 19.5h16" />
      </svg>
    </button>
    <Teleport to="body">
      <div v-if="moreOpen" class="v2-lact__backdrop" @click="moreOpen = false" @wheel.stop>
        <div class="v2-lact__menu" :style="menuStyle" @click.stop>
          <button
            v-for="p in allPresets"
            :key="p.id"
            type="button"
            class="v2-lact__item"
            :title="t(presetTooltipKey('videoChange', p.id))"
            @click.stop="fireFromMenu(`change:${p.id}`)"
          >
            <StageIcon :name="p.icon" class="v2-lact__icon" />
            <span>{{ t(presetLabelKey('videoChange', p.id)) }}</span>
          </button>
        </div>
      </div>
    </Teleport>
  </template>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import StageIcon from '@/components/widgets/StageIcon.vue'
import {
  actionLabelKey,
  actionTooltipKey,
  presetLabelKey,
  presetTooltipKey,
} from '@/composables/stages/actionLabels'
import { VIDEO_CHANGE_PRESETS } from '@/composables/stages/videoChangePresets'
import { app } from '@/lib/comfyApp'
import type { StageState } from '@/stores/stageStore'

const { t } = useI18n()

const props = defineProps<{
  state: StageState
  kind: 'video' | 'audio' | 'model'
  onAction: (id: string, context?: unknown) => void
}>()

const PRIMARY_IDS = ['clip', 'split', 'speed', 'concat', 'extract-frame', 'demux', 'fx-chain']

const primary = computed(() =>
  PRIMARY_IDS
    .map(id => VIDEO_CHANGE_PRESETS.find(p => p.id === id))
    .filter((p): p is (typeof VIDEO_CHANGE_PRESETS)[number] => !!p))

const allPresets = VIDEO_CHANGE_PRESETS

const moreOpen = ref(false)
const moreBtn = ref<HTMLElement | null>(null)
const menuStyle = ref<Record<string, string>>({})

function toggleMore() {
  if (!moreOpen.value) {
    const r = moreBtn.value?.getBoundingClientRect()
    if (r) {
      menuStyle.value = {
        left: `${Math.max(8, Math.min(r.left, window.innerWidth - 428))}px`,
        top: `${Math.min(r.bottom + 6, window.innerHeight - 320)}px`,
      }
    }
  }
  moreOpen.value = !moreOpen.value
}

function fire(id: string) {
  props.onAction(id)
}

function fireFromMenu(id: string) {
  moreOpen.value = false
  props.onAction(id)
}

function onDownload() {
  const url = String(props.state.output ?? '')
  if (!url) return
  const a = document.createElement('a')
  a.href = (app as any).api.apiURL(url.replace(/^\/api/, ''))
  a.download = decodeURIComponent(url.split('filename=')[1]?.split('&')[0] || url.split('/').pop() || 'media')
  a.click()
}
</script>

<style scoped>
.v2-lact__icon {
  font-size: 12px;
  width: 14px;
  display: inline-flex;
  justify-content: center;
}
.v2-lact__chev { font-size: 9px; opacity: 0.7; }
.v2-lact__backdrop {
  position: fixed;
  inset: 0;
  z-index: 9999;
}
.v2-lact__menu {
  position: absolute;
  width: 420px;
  max-height: 300px;
  overflow-y: auto;
  overscroll-behavior: contain;
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 2px;
  padding: 6px;
  border-radius: 12px;
  background: var(--v2-slab-bg);
  border: 1px solid var(--v2-chip-border);
  box-shadow: var(--v2-slab-shadow);
}
.v2-lact__item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 8px;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: var(--v2-text-mid);
  font: 500 11px/1.2 system-ui, sans-serif;
  cursor: pointer;
  text-align: left;
  min-width: 0;
}
.v2-lact__item span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.v2-lact__item:hover { background: var(--v2-hover-bg); }
</style>
