<template>
  <button
    v-for="item in textItems"
    :key="item.action"
    type="button"
    class="v2-toolbar__btn"
    :title="item.tooltip"
    @pointerdown.stop
    @click.stop="fire(item.action)"
  >
    <StageIcon :name="item.icon" class="v2-vtb__icon" />
    <span>{{ item.label }}</span>
  </button>
  <div class="v2-toolbar__sep" />
  <button
    v-for="item in iconItems"
    :key="item.action"
    type="button"
    class="v2-toolbar__btn v2-toolbar__btn--icononly"
    :title="item.tooltip"
    @pointerdown.stop
    @click.stop="fire(item.action)"
  >
    <StageIcon :name="item.icon" class="v2-vtb__icon" />
  </button>
  <button
    type="button"
    class="v2-toolbar__btn v2-toolbar__btn--icononly"
    :title="t('stage.action.download')"
    @pointerdown.stop
    @click.stop="downloadUrl(String(state.output ?? ''))"
  >
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7">
      <path d="M12 3.5V15M7 10.5l5 5 5-5M4 19.5h16" />
    </svg>
  </button>
  <button
    ref="moreBtn"
    type="button"
    class="v2-toolbar__btn v2-toolbar__btn--icononly"
    :title="t('v2.moreActions')"
    @pointerdown.stop
    @click.stop="toggleMore"
  >
    <i class="pi pi-chevron-down v2-vtb__chev" />
  </button>
  <Teleport to="body">
    <div v-if="moreOpen" class="v2-vtb__backdrop" @click="moreOpen = false" @wheel.stop>
      <div class="v2-vtb__menu" :style="menuStyle" @click.stop>
        <button
          v-for="p in set.presets"
          :key="p.id"
          type="button"
          class="v2-vtb__item"
          :title="t(presetTooltipKey(set.category, p.id))"
          @click.stop="fireFromMenu(`change:${p.id}`)"
        >
          <StageIcon :name="p.icon" class="v2-vtb__icon" />
          <span>{{ t(presetLabelKey(set.category, p.id)) }}</span>
        </button>
      </div>
    </div>
  </Teleport>
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
  type PresetCategory,
} from '@/composables/stages/actionLabels'
import { AUDIO_CHANGE_PRESETS } from '@/composables/stages/audioChangePresets'
import type { ImagePreset } from '@/composables/stages/imagePresets'
import { VIDEO_CHANGE_PRESETS } from '@/composables/stages/videoChangePresets'
import { downloadUrl } from '@/v2/imageToolbar'
import type { StageState } from '@/stores/stageStore'

export type MediaToolbarFlavor = 'video' | 'vfx' | 'audio'

const { t } = useI18n()

const props = defineProps<{
  state: StageState
  flavor: MediaToolbarFlavor
  onAction: (id: string, context?: unknown) => void
}>()

interface FlavorSet {
  category: PresetCategory
  presets: ImagePreset[]
  text: string[]
  icons: string[]
}

const SETS: Record<MediaToolbarFlavor, FlavorSet> = {
  video: {
    category: 'videoChange', presets: VIDEO_CHANGE_PRESETS,
    text: ['extend', 'clip', 'split', 'speed', 'interpolate', 'stabilize', 'fx-chain'],
    icons: ['extract-frame', 'concat', 'demux'],
  },
  vfx: {
    category: 'videoChange', presets: VIDEO_CHANGE_PRESETS,
    text: ['color', 'curves', 'lut', 'keyer', 'glow', 'blur-sharpen', 'fx-chain'],
    icons: ['scopes', 'matte-monitor', 'extract-frame'],
  },
  audio: {
    category: 'audioChange', presets: AUDIO_CHANGE_PRESETS,
    text: ['clip', 'split', 'dynamics', 'eq', 'denoise', 'muse-reverb', 'stem-split'],
    icons: ['mix', 'visualize', 'analyze'],
  },
}

const set = computed(() => SETS[props.flavor])

interface Item { action: string; icon: string; label: string; tooltip: string }

function item(id: string): Item | null {
  if (id === 'extend') {
    return {
      action: 'extend',
      icon: 'pi pi-arrow-right',
      label: t(actionLabelKey('video', 'extend')),
      tooltip: t(actionTooltipKey('video', 'extend')),
    }
  }
  const p = set.value.presets.find(x => x.id === id)
  if (!p) return null
  return {
    action: `change:${p.id}`,
    icon: p.icon,
    label: t(presetLabelKey(set.value.category, p.id)),
    tooltip: t(presetTooltipKey(set.value.category, p.id)),
  }
}

const textItems = computed(() => set.value.text.map(item).filter((x): x is Item => !!x))
const iconItems = computed(() => set.value.icons.map(item).filter((x): x is Item => !!x))

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
</script>

<style scoped>
.v2-vtb__icon {
  font-size: 12px;
  width: 14px;
  display: inline-flex;
  justify-content: center;
}
.v2-vtb__chev { font-size: 9px; opacity: 0.7; }
.v2-vtb__backdrop {
  position: fixed;
  inset: 0;
  z-index: 9999;
}
.v2-vtb__menu {
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
.v2-vtb__item {
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
.v2-vtb__item span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.v2-vtb__item:hover { background: var(--v2-hover-bg); }
</style>
