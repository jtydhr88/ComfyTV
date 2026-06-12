<template>
  <div ref="rootEl" class="ctv:flex ctv:flex-col ctv:gap-1.5 ctv:size-full">
    <div class="ctv:flex ctv:flex-col ctv:gap-1">
      <span class="ctv:text-2xs ctv:uppercase ctv:tracking-wide ctv:text-muted-foreground">{{ $t('timeline.keyframes') }}</span>
      <div v-if="keyframes.length === 0" class="ctv:text-xs ctv:text-muted-foreground/60 ctv:p-1">
        {{ $t('timeline.connectImages') }}
      </div>
      <div v-else class="ctv:flex ctv:gap-1 ctv:flex-wrap">
        <button
          v-for="(url, i) in keyframes"
          :key="i"
          type="button"
          class="ctv:relative ctv:w-12 ctv:h-9 ctv:p-0 ctv:rounded ctv:border ctv:border-border-subtle ctv:overflow-hidden ctv:cursor-pointer
                 ctv:bg-black ctv:hover:border-primary-background"
          :title="$t('timeline.addSegment')"
          @click="addSegment(i)"
        >
          <img :src="url" :alt="`#${i + 1}`" class="ctv:w-full ctv:h-full ctv:object-cover" />
          <span class="ctv:absolute ctv:bottom-px ctv:left-0.5 ctv:text-3xs ctv:py-0 ctv:px-0.5 ctv:rounded-sm
                       ctv:bg-black/70 ctv:text-white/90">{{ i + 1 }}</span>
        </button>
      </div>
    </div>

    <div class="ctv:shrink-0 ctv:overflow-x-auto ctv:overflow-y-hidden ctv:rounded-md ctv:border ctv:border-border-subtle ctv:bg-black">
      <div class="ctv:relative ctv:min-h-[116px]" :style="{ width: `${trackWidthPx}px` }">
        <div class="ctv:relative ctv:h-4 ctv:border-b ctv:border-white/10">
          <div
            v-for="tick in ruler"
            :key="tick.frame"
            class="ctv:absolute ctv:top-0 ctv:h-4 ctv:border-l ctv:border-white/15"
            :style="{ left: `${tick.frame * ppf}px` }"
          >
            <span class="ctv:text-[8px] ctv:text-white/40 ctv:ml-0.5">{{ tick.label }}</span>
          </div>
        </div>

        <div class="ctv:relative ctv:h-11 ctv:m-1 ctv:rounded ctv:bg-primary-background/5">
          <div
            v-for="(seg, idx) in segments"
            :key="seg.id"
            class="ctv:absolute ctv:top-0.5 ctv:h-10 ctv:rounded ctv:border ctv:overflow-hidden ctv:flex ctv:items-center
                   ctv:border-primary-background/50 ctv:bg-primary-background/15"
            :class="[
              seg.id === selectedId ? 'ctv:border-primary-background ctv:shadow-[0_0_0_1px_var(--primary-background)]' : '',
              drag?.id === seg.id ? 'ctv:opacity-80 ctv:cursor-grabbing ctv:z-[5]' : 'ctv:cursor-grab',
            ]"
            :style="segStyle(idx)"
            @pointerdown="onSegPointerDown($event, seg, idx)"
          >
            <img v-if="seg.imageUrl" :src="seg.imageUrl"
                 class="ctv:h-full ctv:w-auto ctv:object-cover ctv:pointer-events-none" draggable="false" />
            <span class="ctv:absolute ctv:bottom-px ctv:right-[14px] ctv:text-3xs ctv:py-0 ctv:px-0.5 ctv:rounded-sm
                         ctv:bg-black/60 ctv:text-white ctv:pointer-events-none">{{ seg.length }}f</span>
            <div
              class="ctv:absolute ctv:top-0 ctv:right-0 ctv:w-2 ctv:h-full ctv:cursor-ew-resize ctv:bg-white/10 ctv:hover:bg-white/30"
              @pointerdown.stop="onResizePointerDown($event, seg)"
            />
          </div>
          <div v-if="segments.length === 0" class="ctv:text-xs ctv:text-white/40 ctv:p-1">
            {{ $t('timeline.clickKeyframe') }}
          </div>
        </div>
        <div class="ctv:relative ctv:h-7 ctv:m-1 ctv:rounded ctv:bg-success-background/5">
          <div
            v-if="audioSeg"
            class="ctv:absolute ctv:top-0.5 ctv:h-6 ctv:rounded ctv:border ctv:flex ctv:items-center ctv:pl-1.5
                   ctv:border-success-background/50 ctv:bg-success-background/20"
            :class="audioDrag ? 'ctv:opacity-80 ctv:cursor-grabbing' : 'ctv:cursor-grab'"
            :style="{ left: `${audioSeg.start * ppf}px`, width: `${audioSeg.length * ppf}px` }"
            @pointerdown="onAudioPointerDown($event)"
          >
            <span class="ctv:text-2xs ctv:text-success-background ctv:pointer-events-none">🎵 {{ audioSeg.length }}f</span>
            <div
              class="ctv:absolute ctv:top-0 ctv:right-0 ctv:w-2 ctv:h-full ctv:cursor-ew-resize ctv:bg-white/10 ctv:hover:bg-white/30"
              @pointerdown.stop="onAudioResizePointerDown($event)"
            />
          </div>
          <button
            v-else-if="audioUrl"
            type="button"
            class="ctv:m-0.5 ctv:py-0.5 ctv:px-2 ctv:text-xs ctv:rounded ctv:border ctv:cursor-pointer
                   ctv:bg-success-background/10 ctv:border-success-background/30 ctv:text-success-background"
            @click="addAudio"
          >🎵 {{ $t('timeline.addAudio') }}</button>
          <div v-else class="ctv:text-xs ctv:text-white/30 ctv:p-1">{{ $t('timeline.noAudio') }}</div>
        </div>
      </div>
    </div>

    <div v-if="selectedSeg" class="ctv:flex ctv:flex-col ctv:gap-1">
      <div class="ctv:flex ctv:items-center ctv:gap-1.5">
        <span class="ctv:text-2xs ctv:uppercase ctv:tracking-wide ctv:text-muted-foreground">{{ $t('timeline.segmentPrompt') }}</span>
        <button
          type="button"
          class="ctv:ml-auto ctv:bg-transparent ctv:border-0 ctv:cursor-pointer ctv:text-[13px]"
          @click="removeSegment(selectedSeg.id)"
        >🗑</button>
      </div>
      <textarea
        class="ctv:w-full ctv:min-h-11 ctv:resize-y ctv:py-1 ctv:px-1.5 ctv:rounded ctv:text-xs ctv:box-border
               ctv:bg-secondary-background ctv:text-base-foreground ctv:border ctv:border-border-subtle"
        :value="selectedSeg.prompt"
        :placeholder="$t('timeline.promptPlaceholder')"
        @input="(e) => updatePrompt((e.target as HTMLTextAreaElement).value)"
      />
      <div class="ctv:flex ctv:items-center ctv:gap-1.5">
        <span class="ctv:text-2xs ctv:uppercase ctv:tracking-wide ctv:text-muted-foreground">{{ $t('timeline.length') }}</span>
        <input
          type="number" min="1" max="600" step="1"
          class="ctv:w-14 ctv:py-0.5 ctv:px-1 ctv:rounded ctv:text-xs ctv:font-mono
                 ctv:bg-secondary-background ctv:text-base-foreground ctv:border ctv:border-border-subtle"
          :value="selectedSeg.length"
          @change="(e) => setLength(selectedSeg!.id, Number((e.target as HTMLInputElement).value))"
        />
        <span class="ctv:text-2xs ctv:text-muted-foreground">f ≈ {{ (selectedSeg.length / frameRate).toFixed(2) }}s</span>
      </div>
    </div>

    <div class="ctv:flex ctv:items-center ctv:gap-2.5">
      <div class="ctv:flex ctv:items-center ctv:gap-1">
        <span class="ctv:text-2xs ctv:uppercase ctv:tracking-wide ctv:text-muted-foreground">{{ $t('timeline.fps') }}</span>
        <input
          type="number" min="1" max="120" step="1"
          class="ctv:w-14 ctv:py-0.5 ctv:px-1 ctv:rounded ctv:text-xs ctv:font-mono
                 ctv:bg-secondary-background ctv:text-base-foreground ctv:border ctv:border-border-subtle"
          :value="frameRate"
          @change="(e) => setFrameRate(Number((e.target as HTMLInputElement).value))"
        />
      </div>
      <span class="ctv:ml-auto ctv:text-2xs ctv:font-mono ctv:text-muted-foreground">
        {{ totalFrames }}f · {{ (totalFrames / frameRate).toFixed(1) }}s · {{ segments.length }} {{ $t('timeline.shots') }}
      </span>
    </div>

    <StageCard
      :state="state"
      :node="node"
      :on-run-request="onRunRequest"
      :on-cancel-request="onCancelRequest"
      :on-disconnect="onDisconnect"
      :on-action="onAction"
      hide-context
      hide-output
    />
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

import StageCard from '@/components/stages/StageCard.vue'
import { PPF as ppf, useTimelineEditor } from '@/composables/stages/useTimelineEditor'
import type { LGraphNode } from '@/lib/comfyApp'
import type { StageState } from '@/stores/stageStore'

const props = defineProps<{
  state: StageState
  onRunRequest: () => void
  onCancelRequest: () => void
  onDisconnect: (slot: string) => void
  onAction: (id: string) => void
  node: LGraphNode
}>()

const rootEl = ref<HTMLElement | null>(null)

const {
  keyframes, audioUrl,
  frameRate, segments, audioSeg, selectedId,
  drag, audioDrag,
  selectedSeg, totalFrames, trackWidthPx, ruler,
  segStyle,
  addSegment, removeSegment, updatePrompt, setLength, setFrameRate, addAudio,
  onSegPointerDown, onResizePointerDown,
  onAudioPointerDown, onAudioResizePointerDown,
} = useTimelineEditor(props.node, props.state, rootEl)
</script>
