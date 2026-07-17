<template>
  <div class="ctv:flex ctv:flex-col ctv:gap-1.5 ctv:size-full">
    <div
      class="ctv:flex ctv:flex-col ctv:gap-1"
      @pointerdown.stop
      @pointermove.stop
      @pointerup.stop
    >
      <div
        v-if="clips.length === 0"
        class="ctv:flex ctv:flex-col ctv:items-center ctv:justify-center ctv:gap-1.5 ctv:h-24
               ctv:rounded-md ctv:bg-black/40 ctv:border ctv:border-dashed ctv:border-border-subtle ctv:text-white/50"
      >
        <i class="pi pi-video ctv:text-[24px] ctv:opacity-60" />
        <div class="ctv:text-xs">{{ $t('videoConcat.noInputs') }}</div>
      </div>

      <div
        v-else
        ref="stripEl"
        class="ctv:flex ctv:gap-1.5 ctv:p-1.5 ctv:rounded-md ctv:overflow-x-auto ctv:bg-black/40
               ctv:border ctv:border-border-subtle ctv:select-none"
      >
        <div
          v-for="(clip, idx) in orderedClips"
          :key="clip.key"
          class="ctv:relative ctv:shrink-0 ctv:w-32 ctv:rounded-md ctv:overflow-hidden ctv:bg-black
                 ctv:border-2 ctv:touch-none"
          :class="dragKey === clip.key
            ? 'ctv:border-dashed ctv:opacity-40 ctv:cursor-grabbing'
            : 'ctv:cursor-grab'"
          :style="{ borderColor: clip.color }"
          @pointerdown="(e) => onTileDown(e, idx)"
          @pointermove="onTileMove"
          @pointerup="onTileUp"
          @pointercancel="onTileUp"
        >
          <video
            :src="clip.url"
            class="ctv:block ctv:w-full ctv:h-18 ctv:object-cover ctv:pointer-events-none"
            muted playsinline preload="metadata"
          />
          <span class="ctv:absolute ctv:top-0.5 ctv:left-0.5 ctv:py-px ctv:px-1.5 ctv:text-3xs ctv:font-bold
                       ctv:rounded ctv:text-black ctv:pointer-events-none"
                :style="{ background: clip.color }">
            {{ idx + 1 }}
          </span>
          <span class="ctv:absolute ctv:bottom-0.5 ctv:right-0.5 ctv:py-px ctv:px-1 ctv:text-3xs ctv:font-bold
                       ctv:rounded ctv:bg-black/70 ctv:pointer-events-none"
                :style="{ color: clip.color }">
            {{ clip.key.replace('video', '#') }}
          </span>
        </div>
      </div>

      <div v-if="clips.length > 1" class="ctv:text-3xs ctv:text-center ctv:text-muted-foreground ctv:tracking-wide">
        {{ $t('videoConcat.dragToReorder') }}
      </div>
    </div>

    <div class="ctv:text-2xs ctv:text-center ctv:py-0.5 ctv:tracking-wide">
      <span v-if="clips.length < 2" class="ctv:text-muted-foreground">{{ $t('videoConcat.needTwo') }}</span>
      <span v-else-if="state.running" class="ctv:text-muted-foreground">{{ $t('videoConcat.concatenating') }}</span>
      <span v-else-if="state.output" class="ctv:text-success-background">{{ $t('videoConcat.done') }}</span>
      <span v-else class="ctv:text-muted-foreground">{{ $t('videoConcat.readyToRun', { n: clips.length }) }}</span>
    </div>

    <StageCard
      :state="state"
      :node="node"
      :on-run-request="onRunRequest"
      :on-cancel-request="onCancelRequest"
      :on-disconnect="onDisconnect"
      :on-action="onAction"
    />

    <Teleport to="body">
      <div
        v-if="dragClip"
        class="ctv:fixed ctv:z-[9999] ctv:rounded-md ctv:overflow-hidden ctv:bg-black ctv:border-2
               ctv:pointer-events-none ctv:shadow-[0_8px_24px_rgb(0_0_0/0.6)] ctv:rotate-2"
        :style="{
          left: `${cloneX}px`,
          top: `${cloneY}px`,
          width: `${cloneW}px`,
          height: `${cloneH}px`,
          borderColor: dragClip.color,
        }"
      >
        <video
          :src="dragClip.url"
          class="ctv:block ctv:size-full ctv:object-cover"
          muted playsinline preload="metadata"
        />
        <span class="ctv:absolute ctv:top-0.5 ctv:left-0.5 ctv:py-px ctv:px-1.5 ctv:text-3xs ctv:font-bold
                     ctv:rounded ctv:text-black"
              :style="{ background: dragClip.color }">
          {{ dragTargetIdx + 1 }}
        </span>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import type { LGraphNode } from '@/lib/comfyApp'
import type { StageState } from '@/stores/stageStore'
import StageCard from '@/components/stages/StageCard.vue'
import { useClipReorder } from '@/composables/stages/useClipReorder'
import { videoClipsFromInputs } from '@/composables/stages/videoClipInputs'

const props = defineProps<{
  state: StageState
  onRunRequest: () => void
  onCancelRequest: () => void
  onDisconnect: (slot: string) => void
  onAction: (id: string) => void
  node: LGraphNode
}>()

const clips = computed(() => videoClipsFromInputs(props.state.inputs))

const stripEl = ref<HTMLDivElement | null>(null)

const {
  orderedClips, dragKey, dragClip, dragTargetIdx,
  cloneX, cloneY, cloneW, cloneH,
  onTileDown, onTileMove, onTileUp,
} = useClipReorder(props.node, { clips, stripEl })
</script>
