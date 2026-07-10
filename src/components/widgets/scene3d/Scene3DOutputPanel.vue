<template>

  <div class="ctv:flex ctv:flex-col ctv:gap-1.5 ctv:rounded-lg ctv:bg-node-background ctv:p-1.5 ctv:text-xs">
    <div class="ctv:flex ctv:items-center ctv:gap-2">
      <label class="ctv:flex ctv:flex-1 ctv:items-center ctv:gap-1.5">
        <span class="ctv:shrink-0 ctv:text-muted-foreground">{{ $t('scene3d.width') }}</span>
        <ComfyTVNumber
          class="ctv:flex-1 ctv:min-w-0"
          :model-value="width"
          :min="64"
          :max="4096"
          :step="8"
          :precision="0"
          :show-buttons="false"
          @update:model-value="(v) => emit('setSize', v, null)"
        />
      </label>
      <label class="ctv:flex ctv:flex-1 ctv:items-center ctv:gap-1.5">
        <span class="ctv:shrink-0 ctv:text-muted-foreground">{{ $t('scene3d.height') }}</span>
        <ComfyTVNumber
          class="ctv:flex-1 ctv:min-w-0"
          :model-value="height"
          :min="64"
          :max="4096"
          :step="8"
          :precision="0"
          :show-buttons="false"
          @update:model-value="(v) => emit('setSize', null, v)"
        />
      </label>
    </div>

    <label class="ctv:flex ctv:items-center ctv:gap-1.5">
      <span class="ctv:shrink-0 ctv:text-muted-foreground">{{ $t('scene3d.channel') }}</span>
      <ComfyTVSelect
        class="ctv:flex-1 ctv:min-w-0"
        :model-value="channel"
        :options="channelOptions"
        @update:model-value="(v) => emit('setChannel', String(v) as SceneChannel)"
      />
    </label>

    <label v-if="cameras.length > 1" class="ctv:flex ctv:items-center ctv:gap-1.5">
      <span class="ctv:shrink-0 ctv:text-muted-foreground">{{ $t('scene3d.outputCamera') }}</span>
      <ComfyTVSelect
        class="ctv:flex-1 ctv:min-w-0"
        :model-value="cameraId"
        :options="cameras"
        @update:model-value="(v) => emit('setCamera', String(v))"
      />
    </label>

    <div class="ctv:flex ctv:items-center ctv:gap-2">
      <label class="ctv:flex ctv:flex-1 ctv:items-center ctv:gap-1.5">
        <span class="ctv:shrink-0 ctv:text-muted-foreground">{{ $t('scene3d.fps') }}</span>
        <ComfyTVNumber
          class="ctv:flex-1 ctv:min-w-0"
          :model-value="fps"
          :min="1"
          :max="120"
          :step="1"
          :precision="0"
          :show-buttons="false"
          @update:model-value="(v) => emit('setFps', v)"
        />
      </label>
      <label class="ctv:flex ctv:flex-1 ctv:items-center ctv:gap-1.5">
        <span class="ctv:shrink-0 ctv:text-muted-foreground">{{ $t('scene3d.frameCount') }}</span>
        <ComfyTVNumber
          class="ctv:flex-1 ctv:min-w-0"
          :model-value="frameCount"
          :min="0"
          :max="10000"
          :step="1"
          :precision="0"
          :show-buttons="false"
          @update:model-value="(v) => emit('setFrameCount', v)"
        />
      </label>
    </div>

  </div>
</template>

<script setup lang="ts">

import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import ComfyTVNumber from '@/components/widgets/ComfyTVNumber.vue'
import ComfyTVSelect from '@/components/widgets/ComfyTVSelect.vue'
import type { SceneChannel } from '@/widgets/three/scene3d/capture/channelRender'
import { SCENE_CHANNELS } from '@/widgets/three/scene3d/capture/channelRender'

defineProps<{
  width: number
  height: number
  channel: SceneChannel
  fps: number
  frameCount: number
  cameras: Array<{ value: string; label: string }>
  cameraId: string
}>()

const emit = defineEmits<{
  setSize: [width: number | null, height: number | null]
  setChannel: [channel: SceneChannel]
  setFps: [fps: number | null]
  setFrameCount: [frameCount: number | null]
  setCamera: [id: string]
}>()

const { t } = useI18n()

const channelOptions = computed(() =>
  SCENE_CHANNELS.map((value) => ({
    value,
    label: t(`scene3d.channelOption.${value}`)
  }))
)
</script>
