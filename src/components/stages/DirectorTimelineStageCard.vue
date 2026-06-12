<template>
  <div ref="rootEl" class="timeline-stage">
    <div class="palette">
      <span class="palette-label">{{ $t('timeline.keyframes') }}</span>
      <div v-if="keyframes.length === 0" class="palette-empty">
        {{ $t('timeline.connectImages') }}
      </div>
      <div v-else class="palette-thumbs">
        <button
          v-for="(url, i) in keyframes"
          :key="i"
          type="button"
          class="thumb"
          :title="$t('timeline.addSegment')"
          @click="addSegment(i)"
        >
          <img :src="url" :alt="`#${i + 1}`" />
          <span class="thumb-no">{{ i + 1 }}</span>
        </button>
      </div>
    </div>

    <div class="tracks-scroll">
      <div class="tracks" :style="{ width: `${trackWidthPx}px` }">
        <div class="ruler">
          <div
            v-for="tick in ruler"
            :key="tick.frame"
            class="tick"
            :style="{ left: `${tick.frame * ppf}px` }"
          >
            <span class="tick-label">{{ tick.label }}</span>
          </div>
        </div>

        <div class="track video-track">
          <div
            v-for="(seg, idx) in segments"
            :key="seg.id"
            class="segment"
            :class="{ selected: seg.id === selectedId, dragging: drag?.id === seg.id }"
            :style="segStyle(idx)"
            @pointerdown="onSegPointerDown($event, seg, idx)"
          >
            <img v-if="seg.imageUrl" :src="seg.imageUrl" class="seg-thumb" draggable="false" />
            <span class="seg-len">{{ seg.length }}f</span>
            <div class="seg-resize" @pointerdown.stop="onResizePointerDown($event, seg)" />
          </div>
          <div v-if="segments.length === 0" class="track-empty">{{ $t('timeline.clickKeyframe') }}</div>
        </div>
        <div class="track audio-track">
          <div
            v-if="audioSeg"
            class="audio-segment"
            :class="{ dragging: audioDrag }"
            :style="{ left: `${audioSeg.start * ppf}px`, width: `${audioSeg.length * ppf}px` }"
            @pointerdown="onAudioPointerDown($event)"
          >
            <span class="audio-label">🎵 {{ audioSeg.length }}f</span>
            <div class="seg-resize" @pointerdown.stop="onAudioResizePointerDown($event)" />
          </div>
          <button
            v-else-if="audioUrl"
            type="button"
            class="add-audio"
            @click="addAudio"
          >🎵 {{ $t('timeline.addAudio') }}</button>
          <div v-else class="track-empty muted">{{ $t('timeline.noAudio') }}</div>
        </div>
      </div>
    </div>

    <div v-if="selectedSeg" class="seg-editor">
      <div class="row">
        <span class="label">{{ $t('timeline.segmentPrompt') }}</span>
        <button type="button" class="del-btn" @click="removeSegment(selectedSeg.id)">🗑</button>
      </div>
      <textarea
        class="prompt-area"
        :value="selectedSeg.prompt"
        :placeholder="$t('timeline.promptPlaceholder')"
        @input="(e) => updatePrompt((e.target as HTMLTextAreaElement).value)"
      />
      <div class="row len-row">
        <span class="label">{{ $t('timeline.length') }}</span>
        <input
          type="number" min="1" max="600" step="1"
          :value="selectedSeg.length"
          @change="(e) => setLength(selectedSeg!.id, Number((e.target as HTMLInputElement).value))"
        />
        <span class="unit">f ≈ {{ (selectedSeg.length / frameRate).toFixed(2) }}s</span>
      </div>
    </div>

    <div class="meta-row">
      <div class="ctl">
        <span class="label">{{ $t('timeline.fps') }}</span>
        <input
          type="number" min="1" max="120" step="1"
          :value="frameRate"
          @change="(e) => setFrameRate(Number((e.target as HTMLInputElement).value))"
        />
      </div>
      <span class="total">{{ totalFrames }}f · {{ (totalFrames / frameRate).toFixed(1) }}s · {{ segments.length }} {{ $t('timeline.shots') }}</span>
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
import type { StageState } from '@/stores/stageStore'

const props = defineProps<{
  state: StageState
  onRunRequest: () => void
  onCancelRequest: () => void
  onDisconnect: (slot: string) => void
  onAction: (id: string) => void
  node: any
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

<style scoped>
.timeline-stage {
  display: flex;
  flex-direction: column;
  gap: 6px;
  width: 100%;
  height: 100%;
}

.palette { display: flex; flex-direction: column; gap: 4px; }
.palette-label, .label {
  font-size: 10px; color: rgba(255,255,255,0.55);
  text-transform: uppercase; letter-spacing: 0.4px;
}
.palette-empty, .track-empty {
  font-size: 11px; color: rgba(255,255,255,0.4); padding: 4px;
}
.track-empty.muted { color: rgba(255,255,255,0.3); }
.palette-thumbs { display: flex; gap: 4px; flex-wrap: wrap; }
.thumb {
  position: relative; width: 48px; height: 36px; padding: 0;
  border: 1px solid rgba(255,255,255,0.15); border-radius: 4px;
  overflow: hidden; cursor: pointer; background: #000;
}
.thumb:hover { border-color: rgba(233,61,130,0.6); }
.thumb img { width: 100%; height: 100%; object-fit: cover; }
.thumb-no {
  position: absolute; bottom: 1px; left: 2px; font-size: 9px;
  background: rgba(0,0,0,0.7); color: #ffb0d8; padding: 0 3px; border-radius: 3px;
}

.tracks-scroll { flex: 0 0 auto; overflow-x: auto; overflow-y: hidden; background: #0a0a0f; border-radius: 6px; border: 1px solid rgba(255,255,255,0.08); }
.tracks { position: relative; min-height: 116px; }
.ruler { position: relative; height: 16px; border-bottom: 1px solid rgba(255,255,255,0.08); }
.tick { position: absolute; top: 0; height: 16px; border-left: 1px solid rgba(255,255,255,0.15); }
.tick-label { font-size: 8px; color: rgba(255,255,255,0.4); margin-left: 2px; }

.track { position: relative; height: 44px; margin: 4px; border-radius: 4px; background: rgba(255,255,255,0.03); }
.video-track { background: rgba(78,168,255,0.05); }
.audio-track { background: rgba(120,200,120,0.05); height: 28px; }

.segment {
  position: absolute; top: 2px; height: 40px;
  border: 1px solid rgba(78,168,255,0.5); border-radius: 4px;
  background: rgba(78,168,255,0.15); overflow: hidden; cursor: grab;
  display: flex; align-items: center;
}
.segment.selected { border-color: #4ea8ff; box-shadow: 0 0 0 1px #4ea8ff; }
.segment.dragging { opacity: 0.8; cursor: grabbing; z-index: 5; }
.seg-thumb { height: 100%; width: auto; object-fit: cover; pointer-events: none; }
.seg-len { position: absolute; bottom: 1px; right: 14px; font-size: 9px; color: #fff; background: rgba(0,0,0,0.6); padding: 0 3px; border-radius: 3px; pointer-events: none; }
.seg-resize { position: absolute; top: 0; right: 0; width: 8px; height: 100%; cursor: ew-resize; background: rgba(255,255,255,0.12); }
.seg-resize:hover { background: rgba(255,255,255,0.3); }

.audio-segment {
  position: absolute; top: 2px; height: 24px;
  border: 1px solid rgba(120,200,120,0.5); border-radius: 4px;
  background: rgba(120,200,120,0.2); cursor: grab;
  display: flex; align-items: center; padding-left: 6px;
}
.audio-segment.dragging { opacity: 0.8; cursor: grabbing; }
.audio-label { font-size: 10px; color: #b5e3a5; pointer-events: none; }
.add-audio {
  margin: 2px; padding: 3px 8px; font-size: 11px;
  background: rgba(120,200,120,0.12); border: 1px solid rgba(120,200,120,0.3);
  border-radius: 4px; color: #b5e3a5; cursor: pointer;
}

.seg-editor { display: flex; flex-direction: column; gap: 4px; }
.row { display: flex; align-items: center; gap: 6px; }
.del-btn { margin-left: auto; background: none; border: none; cursor: pointer; font-size: 13px; }
.prompt-area {
  width: 100%; min-height: 44px; resize: vertical;
  background: rgba(0,0,0,0.3); color: var(--input-text,#ddd);
  border: 1px solid rgba(255,255,255,0.15); border-radius: 4px;
  padding: 4px 6px; font-size: 11px; box-sizing: border-box;
}
.len-row input, .meta-row input {
  width: 56px; background: rgba(255,255,255,0.04); color: rgba(255,255,255,0.9);
  border: 1px solid rgba(255,255,255,0.15); border-radius: 4px; padding: 2px 4px;
  font-size: 11px; font-family: ui-monospace, monospace;
}
.unit { font-size: 10px; color: rgba(255,255,255,0.5); }

.meta-row { display: flex; align-items: center; gap: 10px; }
.ctl { display: flex; align-items: center; gap: 4px; }
.total { margin-left: auto; font-size: 10px; color: rgba(255,255,255,0.55); font-family: ui-monospace, monospace; }
</style>
