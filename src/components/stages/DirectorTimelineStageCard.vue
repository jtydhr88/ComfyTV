<template>
  <div ref="rootEl" class="flex flex-col gap-1.5 size-full">
    <div class="flex flex-col gap-1">
      <span class="text-2xs uppercase tracking-wide text-muted-foreground">{{ $t('timeline.keyframes') }}</span>
      <div v-if="keyframes.length === 0" class="text-xs text-muted-foreground/60 p-1">
        {{ $t('timeline.connectImages') }}
      </div>
      <div v-else class="flex gap-1 flex-wrap">
        <button
          v-for="(url, i) in keyframes"
          :key="i"
          type="button"
          class="relative w-12 h-9 p-0 rounded border border-border-subtle overflow-hidden cursor-pointer
                 bg-black hover:border-primary-background"
          :title="$t('timeline.addSegment')"
          @click="addSegment(i)"
        >
          <img :src="url" :alt="`#${i + 1}`" class="w-full h-full object-cover" />
          <span class="absolute bottom-px left-0.5 text-3xs py-0 px-0.5 rounded-sm
                       bg-black/70 text-white/90">{{ i + 1 }}</span>
        </button>
      </div>
    </div>

    <div class="shrink-0 overflow-x-auto overflow-y-hidden rounded-md border border-border-subtle bg-black">
      <div class="relative min-h-[116px]" :style="{ width: `${trackWidthPx}px` }">
        <div class="relative h-4 border-b border-white/10">
          <div
            v-for="tick in ruler"
            :key="tick.frame"
            class="absolute top-0 h-4 border-l border-white/15"
            :style="{ left: `${tick.frame * ppf}px` }"
          >
            <span class="text-[8px] text-white/40 ml-0.5">{{ tick.label }}</span>
          </div>
        </div>

        <div class="relative h-11 m-1 rounded bg-primary-background/5">
          <div
            v-for="(seg, idx) in segments"
            :key="seg.id"
            class="absolute top-0.5 h-10 rounded border overflow-hidden flex items-center
                   border-primary-background/50 bg-primary-background/15"
            :class="[
              seg.id === selectedId ? 'border-primary-background shadow-[0_0_0_1px_var(--primary-background)]' : '',
              drag?.id === seg.id ? 'opacity-80 cursor-grabbing z-[5]' : 'cursor-grab',
            ]"
            :style="segStyle(idx)"
            @pointerdown="onSegPointerDown($event, seg, idx)"
          >
            <img v-if="seg.imageUrl" :src="seg.imageUrl"
                 class="h-full w-auto object-cover pointer-events-none" draggable="false" />
            <span class="absolute bottom-px right-[14px] text-3xs py-0 px-0.5 rounded-sm
                         bg-black/60 text-white pointer-events-none">{{ seg.length }}f</span>
            <div
              class="absolute top-0 right-0 w-2 h-full cursor-ew-resize bg-white/10 hover:bg-white/30"
              @pointerdown.stop="onResizePointerDown($event, seg)"
            />
          </div>
          <div v-if="segments.length === 0" class="text-xs text-white/40 p-1">
            {{ $t('timeline.clickKeyframe') }}
          </div>
        </div>
        <div class="relative h-7 m-1 rounded bg-success-background/5">
          <div
            v-if="audioSeg"
            class="absolute top-0.5 h-6 rounded border flex items-center pl-1.5
                   border-success-background/50 bg-success-background/20"
            :class="audioDrag ? 'opacity-80 cursor-grabbing' : 'cursor-grab'"
            :style="{ left: `${audioSeg.start * ppf}px`, width: `${audioSeg.length * ppf}px` }"
            @pointerdown="onAudioPointerDown($event)"
          >
            <span class="text-2xs text-success-background pointer-events-none">🎵 {{ audioSeg.length }}f</span>
            <div
              class="absolute top-0 right-0 w-2 h-full cursor-ew-resize bg-white/10 hover:bg-white/30"
              @pointerdown.stop="onAudioResizePointerDown($event)"
            />
          </div>
          <button
            v-else-if="audioUrl"
            type="button"
            class="m-0.5 py-0.5 px-2 text-xs rounded border cursor-pointer
                   bg-success-background/10 border-success-background/30 text-success-background"
            @click="addAudio"
          >🎵 {{ $t('timeline.addAudio') }}</button>
          <div v-else class="text-xs text-white/30 p-1">{{ $t('timeline.noAudio') }}</div>
        </div>
      </div>
    </div>

    <div v-if="selectedSeg" class="flex flex-col gap-1">
      <div class="flex items-center gap-1.5">
        <span class="text-2xs uppercase tracking-wide text-muted-foreground">{{ $t('timeline.segmentPrompt') }}</span>
        <button
          type="button"
          class="ml-auto bg-transparent border-0 cursor-pointer text-[13px]"
          @click="removeSegment(selectedSeg.id)"
        >🗑</button>
      </div>
      <textarea
        class="w-full min-h-11 resize-y py-1 px-1.5 rounded text-xs box-border
               bg-secondary-background text-base-foreground border border-border-subtle"
        :value="selectedSeg.prompt"
        :placeholder="$t('timeline.promptPlaceholder')"
        @input="(e) => updatePrompt((e.target as HTMLTextAreaElement).value)"
      />
      <div class="flex items-center gap-1.5">
        <span class="text-2xs uppercase tracking-wide text-muted-foreground">{{ $t('timeline.length') }}</span>
        <input
          type="number" min="1" max="600" step="1"
          class="w-14 py-0.5 px-1 rounded text-xs font-mono
                 bg-secondary-background text-base-foreground border border-border-subtle"
          :value="selectedSeg.length"
          @change="(e) => setLength(selectedSeg!.id, Number((e.target as HTMLInputElement).value))"
        />
        <span class="text-2xs text-muted-foreground">f ≈ {{ (selectedSeg.length / frameRate).toFixed(2) }}s</span>
      </div>
    </div>

    <div class="flex items-center gap-2.5">
      <div class="flex items-center gap-1">
        <span class="text-2xs uppercase tracking-wide text-muted-foreground">{{ $t('timeline.fps') }}</span>
        <input
          type="number" min="1" max="120" step="1"
          class="w-14 py-0.5 px-1 rounded text-xs font-mono
                 bg-secondary-background text-base-foreground border border-border-subtle"
          :value="frameRate"
          @change="(e) => setFrameRate(Number((e.target as HTMLInputElement).value))"
        />
      </div>
      <span class="ml-auto text-2xs font-mono text-muted-foreground">
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
