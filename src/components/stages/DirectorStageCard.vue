<template>
  <div ref="rootEl" class="ctv:flex ctv:flex-col ctv:gap-1.5 ctv:size-full">
    <MainPromptInput :node="node" />

    <div class="ctv:flex ctv:flex-col ctv:gap-0.5">
      <ImageReferences :node="node" :force-types="['image', 'video', 'audio']" />
      <span class="ctv:text-3xs ctv:text-muted-foreground/70">
        {{ $t('director.sharedRefsHint') }}
      </span>
    </div>

    <div class="ctv:flex ctv:items-center ctv:gap-2">
      <span class="ctv:text-2xs ctv:uppercase ctv:tracking-wide ctv:text-muted-foreground">
        {{ $t('director.clips') }}
      </span>
      <span class="ctv:text-2xs ctv:font-mono ctv:text-muted-foreground">
        {{ clips.length }} · {{ totalSeconds }}s
      </span>
      <button
        type="button" class="icon-btn"
        :disabled="!previewCanPlay"
        :title="!previewCanPlay ? $t('director.playDisabled')
          : previewPlaying ? $t('director.pause') : $t('director.play')"
        @click="togglePlay"
      ><i :class="['pi', previewPlaying ? 'pi-pause' : 'pi-play']" /></button>
      <label class="ctv:ml-auto ctv:flex ctv:items-center ctv:gap-1 ctv:text-2xs ctv:text-muted-foreground"
             :title="$t('director.chainTooltip')">
        {{ $t('director.chain') }}
        <select
          class="ctv:py-0.5 ctv:px-1 ctv:rounded ctv:text-2xs
                 ctv:bg-secondary-background ctv:text-base-foreground ctv:border ctv:border-border-subtle"
          :value="settings.chain"
          @change="(e) => setChainMode((e.target as HTMLSelectElement).value as ChainMode)"
        >
          <option v-for="m in CHAIN_MODES" :key="m" :value="m">{{ $t(`director.chainMode.${m}`) }}</option>
        </select>
      </label>
    </div>

    <div ref="trackScrollEl" class="ctv:shrink-0 ctv:overflow-x-auto ctv:overflow-y-hidden ctv:rounded-md ctv:border ctv:border-border-subtle ctv:bg-black">
      <div class="ctv:relative ctv:m-1" :style="{ width: `${trackWidthPx}px` }">
        <div
          class="ctv:relative ctv:h-4 ctv:border-b ctv:border-white/10 ctv:touch-none"
          :class="previewCanPlay ? 'ctv:cursor-pointer' : ''"
          @pointerdown="onRulerPointerDown"
        >
          <div
            v-for="(tick, i) in rulerTicks"
            :key="i"
            class="ctv:absolute ctv:top-0 ctv:border-l ctv:pointer-events-none"
            :class="tick.major ? 'ctv:h-4 ctv:border-white/30' : 'ctv:h-1.5 ctv:border-white/15'"
            :style="{ left: `${tick.px}px` }"
          >
            <span v-if="tick.label" class="ctv:text-[8px] ctv:text-white/40 ctv:ml-0.5">{{ tick.label }}</span>
          </div>
        </div>
        <div class="ctv:relative ctv:h-[72px] ctv:mt-0.5">
        <div
          v-for="(clip, idx) in clips"
          :key="clip.id"
          class="ctv:absolute ctv:top-0.5 ctv:h-16 ctv:rounded ctv:border ctv:overflow-hidden
                 ctv:flex ctv:flex-col ctv:justify-between ctv:py-0.5 ctv:px-1 ctv:select-none"
          :class="[
            clip.enabled ? 'ctv:border-primary-background/50 ctv:bg-primary-background/15'
                         : 'ctv:border-border-subtle ctv:bg-white/5 ctv:opacity-50',
            clip.id === selectedId ? 'ctv:border-primary-background ctv:shadow-[0_0_0_1px_var(--primary-background)]' : '',
            drag?.id === clip.id && drag?.active ? 'ctv:opacity-80 ctv:cursor-grabbing ctv:z-[5]' : 'ctv:cursor-grab',
          ]"
          :style="clipStyle(idx)"
          @pointerdown="onClipPointerDown($event, clip, idx)"
        >
          <div class="ctv:flex ctv:items-center ctv:gap-1 ctv:pointer-events-none">
            <i v-if="idx > 0 && clip.transition !== 'cut'"
               class="pi pi-arrow-right-arrow-left ctv:text-3xs ctv:text-white/60"
               :title="clip.transition" />
            <span class="ctv:text-3xs ctv:font-mono ctv:text-white/50">#{{ idx + 1 }}</span>
            <span class="ctv:text-3xs ctv:truncate ctv:text-white/80">
              {{ clip.workflow || $t('director.workflowDefault') }}
            </span>
          </div>
          <div class="ctv:text-2xs ctv:truncate ctv:text-white/60 ctv:pointer-events-none">
            {{ clip.prompt || $t('director.promptPlaceholder') }}
          </div>
          <div class="ctv:flex ctv:items-center ctv:gap-1 ctv:pointer-events-none">
            <span class="ctv:text-3xs ctv:font-mono ctv:py-0 ctv:px-0.5 ctv:rounded-sm ctv:bg-black/60 ctv:text-white/90">
              {{ clip.duration_s }}s
            </span>
            <i v-if="statuses.get(clip.id)?.cached" class="pi pi-check-circle ctv:text-3xs ctv:text-success-background"
               :title="$t('director.cached')" />
            <i v-else-if="statuses.get(clip.id)" class="pi pi-circle-fill ctv:text-3xs ctv:text-primary-background"
               :title="$t('director.generated')" />
            <span v-if="refCount(clip)" class="ctv:text-3xs ctv:text-white/50">
              <i class="pi pi-paperclip ctv:text-3xs" /> {{ refCount(clip) }}
            </span>
          </div>
          <div
            class="ctv:absolute ctv:top-0 ctv:right-0 ctv:w-2 ctv:h-full ctv:cursor-ew-resize ctv:bg-white/10 clip-resize"
            @pointerdown.stop="onResizePointerDown($event, clip)"
          />
        </div>
        <button
          type="button"
          class="ctv:absolute ctv:top-0.5 ctv:h-16 ctv:w-8 ctv:rounded ctv:border ctv:border-dashed ctv:border-border-subtle
                 ctv:bg-transparent ctv:text-muted-foreground ctv:cursor-pointer add-clip"
          :style="{ left: `${trackWidthPx - 36}px` }"
          :title="$t('director.addClip')"
          @click="addClip"
        ><i class="pi pi-plus" /></button>
        </div>
        <div
          v-if="previewActive"
          class="ctv:absolute ctv:top-0 ctv:bottom-0 ctv:w-px ctv:bg-primary-background ctv:pointer-events-none ctv:z-10"
          :style="{ left: `${playheadPx}px` }"
        >
          <div class="playhead-cap" />
        </div>
      </div>
    </div>

    <div v-if="previewActive" class="ctv:flex ctv:flex-col ctv:gap-1">
      <div class="ctv:flex ctv:items-center ctv:gap-2">
        <span class="ctv:text-2xs ctv:uppercase ctv:tracking-wide ctv:text-muted-foreground">
          {{ previewMode === 'film' ? $t('director.filmPreview') : $t('director.clipsPreview') }}
        </span>
        <span class="ctv:text-2xs ctv:font-mono ctv:text-muted-foreground">
          {{ playheadS.toFixed(1) }}s / {{ previewTotalS }}s
        </span>
        <button type="button" class="icon-btn ctv:ml-auto" :title="$t('stage.action.close')" @click="closePreview">
          <i class="pi pi-times" />
        </button>
      </div>
      <div ref="previewWrapEl">
        <ValuePreview
          type="COMFYTV_VIDEO"
          :content="previewSrc || null"
          :empty-label="$t('stage.empty.no_output')"
        />
      </div>
    </div>

    <div v-if="selectedClip" class="ctv:flex ctv:flex-col ctv:gap-1.5 ctv:rounded-md ctv:border ctv:border-border-subtle ctv:p-1.5">
      <div class="ctv:flex ctv:items-center ctv:gap-1.5">
        <label class="ctv:flex ctv:items-center ctv:gap-1 ctv:text-2xs ctv:text-muted-foreground ctv:cursor-pointer">
          <input type="checkbox" :checked="selectedClip.enabled"
                 @change="(e) => updateClip(selectedClip!.id, { enabled: (e.target as HTMLInputElement).checked })" />
          {{ $t('director.enabled') }}
        </label>
        <span class="ctv:text-2xs ctv:text-muted-foreground">{{ $t('director.workflow') }}</span>
        <select
          class="ctv:flex-1 ctv:min-w-0 ctv:py-0.5 ctv:px-1 ctv:rounded ctv:text-xs
                 ctv:bg-secondary-background ctv:text-base-foreground ctv:border ctv:border-border-subtle"
          :value="selectedClip.workflow"
          @change="(e) => updateClip(selectedClip!.id, { workflow: (e.target as HTMLSelectElement).value })"
        >
          <option value="">{{ $t('director.workflowDefault') }}</option>
          <option v-for="w in workflowOptions" :key="w" :value="w">{{ w }}</option>
        </select>
        <button
          v-if="statuses.get(selectedClip.id)"
          type="button" class="icon-btn"
          :disabled="state.running"
          :title="$t('director.rerunClip')"
          @click="rerunClip(selectedClip.id)"
        ><i class="pi pi-replay" /></button>
        <button type="button" class="icon-btn" :title="$t('director.duplicateClip')"
                @click="duplicateClip(selectedClip.id)"><i class="pi pi-clone" /></button>
        <button type="button" class="icon-btn" :title="$t('director.deleteClip')"
                @click="removeClip(selectedClip.id)"><i class="pi pi-trash" /></button>
      </div>

      <div class="ctv:flex ctv:flex-col ctv:gap-1">
        <span class="ctv:text-2xs ctv:text-muted-foreground">{{ $t('director.clipPrompt') }}</span>
        <ClipPromptEditor
          :key="selectedClip.id"
          :model-value="selectedClip.prompt"
          :placeholder="$t('director.promptPlaceholder')"
          :source="clipSource"
          @update:model-value="(v) => updateClip(selectedClip!.id, { prompt: v })"
        />
      </div>

      <div v-if="selectedIndex > 0" class="ctv:flex ctv:items-center ctv:gap-2">
        <span class="ctv:text-2xs ctv:text-muted-foreground" :title="$t('director.transitionTooltip')">
          {{ $t('director.transition') }}
        </span>
        <select
          class="ctv:py-0.5 ctv:px-1 ctv:rounded ctv:text-xs
                 ctv:bg-secondary-background ctv:text-base-foreground ctv:border ctv:border-border-subtle"
          :value="selectedClip.transition"
          @change="(e) => updateClip(selectedClip!.id, { transition: (e.target as HTMLSelectElement).value })"
        >
          <option v-for="tr in TRANSITIONS" :key="tr" :value="tr">{{ tr }}</option>
        </select>
        <template v-if="selectedClip.transition !== 'cut'">
          <input
            type="number" min="0.1" max="5" step="0.1"
            class="ctv:w-14 ctv:py-0.5 ctv:px-1 ctv:rounded ctv:text-xs ctv:font-mono
                   ctv:bg-secondary-background ctv:text-base-foreground ctv:border ctv:border-border-subtle"
            :value="selectedClip.transition_s"
            @change="(e) => updateClip(selectedClip!.id, { transition_s: Number((e.target as HTMLInputElement).value) })"
          />
          <span class="ctv:text-2xs ctv:text-muted-foreground">s</span>
        </template>
      </div>

      <div class="ctv:flex ctv:items-center ctv:gap-2">
        <span class="ctv:text-2xs ctv:text-muted-foreground">{{ $t('director.duration') }}</span>
        <input
          type="number" min="1" max="120" step="1"
          class="ctv:w-14 ctv:py-0.5 ctv:px-1 ctv:rounded ctv:text-xs ctv:font-mono
                 ctv:bg-secondary-background ctv:text-base-foreground ctv:border ctv:border-border-subtle"
          :value="selectedClip.duration_s"
          @change="(e) => updateClip(selectedClip!.id, { duration_s: Number((e.target as HTMLInputElement).value) })"
        />
        <button
          v-if="statuses.get(selectedClip.id)?.url"
          type="button" class="icon-btn ctv:ml-auto" :title="$t('director.previewClip')"
          @click="previewUrl = statuses.get(selectedClip!.id)!.url"
        ><i class="pi pi-play-circle" /></button>
      </div>

      <div ref="refsEl" class="ctv:relative ctv:flex ctv:flex-col ctv:gap-1">
        <div class="ctv:flex ctv:items-center ctv:gap-2">
          <span class="ctv:text-[11px] ctv:font-semibold">{{ $t('imageRefs.title') }}</span>
          <span class="ctv:text-3xs ctv:text-muted-foreground ctv:font-mono">{{ refCount(selectedClip) || '' }}</span>
          <button
            type="button"
            class="icon-btn ctv:ml-auto"
            :title="pickerOpen ? $t('stage.action.close') : $t('imageRefs.add')"
            @click.stop="openPicker()"
          ><i :class="['pi', pickerOpen ? 'pi-times' : 'pi-plus']" /></button>
        </div>

        <AssetPickerPopup
          v-if="pickerOpen"
          :added-ids="pickerAddedIds"
          :media-types="['image', 'video', 'audio']"
          :batch-groups="batchGroups"
          :added-batch-keys="pickerAddedBatchKeys"
          @select="onPickAsset"
          @select-batch="onPickBatchImage"
          @refresh-batch="onRefreshBatch"
          @unpin-batch="onUnpinBatch"
          @close="pickerOpen = false"
        />

        <div v-if="refCount(selectedClip)" class="ctv:flex ctv:flex-wrap ctv:gap-1.5">
          <div
            v-for="entry in allRefs"
            :key="`${entry.kind}-${entry.url}`"
            class="imgref-tile ctv-hover-host ctv:relative ctv:w-[76px] ctv:h-[76px] ctv:rounded-sm ctv:overflow-hidden ctv:cursor-pointer
                   ctv:bg-black/30 ctv:border"
            :style="{ borderColor: slotColor(entry.m) }"
            :title="refTooltip(entry.kind, entry.m)"
            @click="openRefSlotPicker(entry, $event)"
          >
            <video
              v-if="entry.kind === 'videos'"
              :src="entry.url"
              muted
              playsinline
              preload="metadata"
              class="ctv:block ctv:size-full ctv:object-cover ctv:bg-black ctv:pointer-events-none"
            />
            <div
              v-else-if="entry.kind === 'audio'"
              class="ctv:flex ctv:items-center ctv:justify-center ctv:size-full ctv:text-muted-foreground"
            ><i class="pi pi-volume-up ctv:text-lg" /></div>
            <img
              v-else
              :src="entry.url"
              class="ctv:block ctv:size-full ctv:object-cover"
              draggable="false"
            />
            <span
              class="ctv:absolute ctv:bottom-0 ctv:inset-x-0 ctv:py-0.5 ctv:px-1 ctv:text-3xs ctv:font-semibold
                     ctv:overflow-hidden ctv:whitespace-nowrap ctv:text-ellipsis ctv:pointer-events-none
                     ctv:bg-linear-to-b ctv:from-transparent ctv:to-black/75"
              :style="{ color: slotColor(entry.m) }"
            >{{ entry.kind === 'videos' ? `V${entry.m}` : entry.kind === 'audio' ? `A${entry.m}` : `#${entry.m}` }}</span>
            <button
              type="button"
              class="imgref-remove ctv:absolute ctv:top-0.5 ctv:right-0.5 ctv:flex ctv:items-center ctv:justify-center
                     ctv:size-4 ctv:rounded-sm ctv:cursor-pointer ctv:text-2xs ctv:leading-none ctv:[font-family:inherit]
                     ctv:bg-black/60 ctv:text-white ctv:border ctv:border-white/30 ctv:hover:bg-destructive-background/80"
              :title="$t('imageRefs.remove')"
              @click.stop="removeRef(selectedClip!.id, entry.kind, entry.url)"
            ><i class="pi pi-times" /></button>
            <ViewFullButton
              v-if="entry.kind !== 'videos' && entry.kind !== 'audio'"
              class="ctv:top-0.5 ctv:left-0.5"
              :items="refLightboxItems"
              :index="refLightboxIndex(entry)"
            />
          </div>
        </div>
        <div v-else class="ctv:text-2xs ctv:italic ctv:text-muted-foreground/60">
          {{ $t('imageRefs.empty') }}
        </div>

        <div
          v-if="refWarnings.length"
          class="ctv:flex ctv:flex-col ctv:gap-0.5 ctv:py-1 ctv:px-1.5 ctv:rounded ctv:text-2xs
                 ctv:bg-warning-background/10 ctv:border ctv:border-warning-background/40 ctv:text-warning-background"
        >
          <div v-for="(w, i) in refWarnings" :key="i"><i class="pi pi-exclamation-triangle" /> {{ w }}</div>
        </div>

        <MentionSlotPopover
          v-if="refSlotPicker"
          :x="refSlotPicker.x"
          :y="refSlotPicker.y"
          :loading="false"
          :error="null"
          :options="refSlotPicker.options"
          :current-slot="refSlotPicker.current"
          :wired-slots="[]"
          :claimed-slots="[]"
          @pick="onRefSlotPick"
          @close="refSlotPicker = null"
        />
      </div>
    </div>
    <div v-else-if="clips.length === 0" class="ctv:text-xs ctv:text-muted-foreground/70 ctv:p-1">
      {{ $t('director.empty') }}
    </div>

    <div v-if="previewUrl" class="ctv:flex ctv:flex-col ctv:gap-1">
      <div class="ctv:flex ctv:items-center">
        <span class="ctv:text-2xs ctv:uppercase ctv:tracking-wide ctv:text-muted-foreground">
          {{ $t('director.clipPreview') }}
        </span>
        <button type="button" class="icon-btn ctv:ml-auto" @click="previewUrl = ''">
          <i class="pi pi-times" />
        </button>
      </div>
      <video :src="previewUrl" controls class="ctv:w-full ctv:max-h-48 ctv:rounded ctv:bg-black" />
    </div>

    <StageCard
      :state="state"
      :node="node"
      :on-run-request="onDirectorRun"
      :on-cancel-request="onCancelRequest"
      :on-disconnect="onDisconnect"
      :on-action="onAction"
      hide-context
      hide-prompt
      hide-output
    />
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch, watchEffect } from 'vue'
import { useI18n } from 'vue-i18n'

import AssetPickerPopup from '@/components/stages/AssetPickerPopup.vue'
import ClipPromptEditor from '@/components/stages/ClipPromptEditor.vue'
import ImageReferences from '@/components/stages/ImageReferences.vue'
import MainPromptInput from '@/components/stages/MainPromptInput.vue'
import MentionSlotPopover from '@/components/stages/MentionSlotPopover.vue'
import ViewFullButton from '@/components/ViewFullButton.vue'
import StageCard from '@/components/stages/StageCard.vue'
import ValuePreview from '@/components/stages/ValuePreview.vue'
import {
  fetchImageSlotOptionsCached,
  type ImageSlotOption,
} from '@/composables/stages/assetSlots'
import { citedSlots, clipMentionSource } from '@/composables/stages/directorMentions'
import { useDirectorPlayback } from '@/composables/stages/useDirectorPlayback'
import { readImageRefs, refType } from '@/composables/stages/imageRefs'
import { slotColor } from '@/composables/stages/imageSlotMentions'
import {
  CHAIN_MODES,
  TRANSITIONS,
  useDirectorTimeline,
  type ChainMode,
  type DirectorClip,
} from '@/composables/stages/useDirectorTimeline'
import { loadWorkflowInfo } from '@/composables/stages/useWorkflowValidator'
import { app, type LGraphNode } from '@/lib/comfyApp'
import { useAssetStore } from '@/stores/assetStore'
import { usePinnedBatchStore } from '@/stores/pinnedBatchStore'
import { useProjectStore } from '@/stores/projectStore'
import { useSelectionStore } from '@/stores/selectionStore'
import { bindWidgetCallback, onNodeConfigure, readWidgetStr } from '@/utils/widget'
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
const previewUrl = ref('')

const { t } = useI18n()

function rerunClip(id: string) {
  if (props.state.running) return
  rerollSeed(id)
  props.onRunRequest()
}

function runFingerprint(): string {
  return JSON.stringify([
    readWidgetStr(props.node, 'timeline_data', ''),
    defaultWorkflow.value,
    readWidgetStr(props.node, 'resolution', ''),
    readWidgetStr(props.node, 'aspect_ratio', ''),
    String((props.node as any)?.widgets?.find((w: any) => w.name === 'generate_audio')?.value ?? ''),
    readWidgetStr(props.node, 'main_prompt', ''),
    sharedUrls.value,
  ])
}

let lastSuccessFingerprint = ''

watch(() => props.state.directorClips, () => {
  if (props.state.directorClips && !props.state.error) {
    lastSuccessFingerprint = runFingerprint()
  }
})

function onDirectorRun() {
  if (!props.state.running
      && lastSuccessFingerprint
      && !props.state.error
      && runFingerprint() === lastSuccessFingerprint) {
    rerollAllSeeds()
  }
  props.onRunRequest()
}

const {
  clips, settings, selectedId, drag,
  selectedClip, selectedIndex, totalSeconds, statuses, workflowOptions,
  trackWidthPx,
  clipStyle,
  addClip, removeClip, duplicateClip, updateClip, rerollSeed,
  rerollAllSeeds,
  setChainMode,
  addRef, removeRef, moveRefTo,
  onClipPointerDown, onResizePointerDown,
} = useDirectorTimeline(props.node, props.state, rootEl)

const clipSource = clipMentionSource(
  () => selectedClip.value,
  () => sharedUrls.value,
)

const trackScrollEl = ref<HTMLElement | null>(null)
const previewWrapEl = ref<HTMLElement | null>(null)

const {
  active: previewActive,
  playing: previewPlaying,
  playheadS,
  playheadPx,
  ticks: rulerTicks,
  totalS: previewTotalS,
  canPlay: previewCanPlay,
  mode: previewMode,
  currentSrc: previewSrc,
  open: openPreview,
  close: closePreview,
  togglePlay,
  onRulerPointerDown,
  onLoadedMetadata: onPreviewLoadedMetadata,
  onTimeUpdate: onPreviewTimeUpdate,
  onEnded: onPreviewEnded,
  onPlay: onPreviewPlay,
  onPause: onPreviewPause,
} = useDirectorPlayback({
  clips,
  statuses: () => statuses.value,
  filmUrl: () => String(props.state.output ?? ''),
  video: () => previewWrapEl.value?.querySelector('video') ?? null,
})

watch([previewActive, previewWrapEl], (_, __, onCleanup) => {
  const el = previewWrapEl.value?.querySelector('video')
  if (!previewActive.value || !el) return
  const pairs: Array<[string, EventListener]> = [
    ['loadedmetadata', onPreviewLoadedMetadata],
    ['timeupdate', onPreviewTimeUpdate],
    ['ended', onPreviewEnded],
    ['play', onPreviewPlay],
    ['pause', onPreviewPause],
  ]
  pairs.forEach(([t, h]) => el.addEventListener(t, h))
  onCleanup(() => pairs.forEach(([t, h]) => el.removeEventListener(t, h)))
}, { flush: 'post' })

watch(() => props.state.output, (v) => {
  if (String(v ?? '').trim()) openPreview()
}, { immediate: true })

watch(playheadPx, (px) => {
  if (!previewPlaying.value) return
  const el = trackScrollEl.value
  if (!el || el.scrollWidth <= el.clientWidth) return
  const lo = el.scrollLeft + 24
  const hi = el.scrollLeft + el.clientWidth - 24
  if (px < lo || px > hi) el.scrollLeft = Math.max(0, px - el.clientWidth / 2)
})

const REF_KINDS = [
  { key: 'images' as const, mention: 'image', media: 'image', info: 'image' as const },
  { key: 'videos' as const, mention: 'video', media: 'video', info: 'video' as const },
  { key: 'audio' as const, mention: 'audio', media: 'audio', info: 'audio' as const },
]

function refCount(clip: DirectorClip): number {
  return clip.images.length + clip.videos.length + clip.audio.length
}

const defaultWorkflow = ref(readWidgetStr(props.node, 'workflow', ''))
bindWidgetCallback(props.node, 'workflow', (v) => {
  defaultWorkflow.value = String(v ?? '')
})
onNodeConfigure(props.node, () => {
  defaultWorkflow.value = readWidgetStr(props.node, 'workflow', '')
})

const clipWorkflowLabel = computed(() =>
  selectedClip.value?.workflow || defaultWorkflow.value,
)

const imageSlotOptions = ref<ImageSlotOption[]>([])
const clipUsage = ref<any>(null)

watchEffect(() => {
  const label = clipWorkflowLabel.value
  imageSlotOptions.value = []
  clipUsage.value = null
  if (!label) return
  void fetchImageSlotOptionsCached('video', label)
    .then((opts) => {
      if (clipWorkflowLabel.value === label) imageSlotOptions.value = opts
    })
    .catch(() => {})
  void loadWorkflowInfo().then((info) => {
    if (clipWorkflowLabel.value === label) {
      clipUsage.value = (info as any)?.video?.[label] ?? null
    }
  })
})

function slotAnnotation(kind: 'images' | 'videos' | 'audio', i: number): string {
  if (kind !== 'images') return ''
  return imageSlotOptions.value.find(o => o.slot === i)?.nodeTitles.join(', ') ?? ''
}

function refTooltip(kind: 'images' | 'videos' | 'audio', i: number): string {
  const mention = REF_KINDS.find(k => k.key === kind)!.mention
  const note = slotAnnotation(kind, i)
  return note ? `@${mention}_${i} · ${note}` : `@${mention}_${i}`
}

const sharedUrls = computed(() => {
  void selectionStore.bindingsVersion
  const out = { images: [] as string[], videos: [] as string[], audio: [] as string[] }
  const bucket = { image: 'images', video: 'videos', audio: 'audio' } as const
  for (const r of [...readImageRefs(props.node)].sort((a, b) => a.slot - b.slot)) {
    const url = r.batch_index != null
      ? (r.batch_id ? pinnedStore.byId(projectId.value, r.batch_id)?.urls[r.batch_index] : undefined)
      : (r.asset_id != null ? assetStore.byId(r.asset_id)?.payload_url : undefined)
    if (url) out[bucket[refType(r)]].push(url)
  }
  return out
})

const sharedCounts = computed<Record<'image' | 'video' | 'audio', number>>(() => {
  void selectionStore.bindingsVersion
  const out = { image: 0, video: 0, audio: 0 }
  for (const r of readImageRefs(props.node)) out[refType(r)] += 1
  return out
})

const refWarnings = computed<string[]>(() => {
  const clip = selectedClip.value
  const usage = clipUsage.value
  if (!clip || !usage) return []
  const cited = {
    image: citedSlots(clip.prompt, 'image'),
    video: citedSlots(clip.prompt, 'video'),
    audio: citedSlots(clip.prompt, 'audio'),
  }
  const manual = cited.image.length + cited.video.length + cited.audio.length > 0
  const out: string[] = []
  for (const k of REF_KINDS) {
    const media = k.media as 'image' | 'video' | 'audio'
    const poolCount = clip[k.key].length + sharedCounts.value[media]
    const count = manual
      ? cited[media].filter(slot => slot < poolCount).length
      : poolCount
    if (count === 0) continue
    const max = usage.max_inputs?.[k.info]
    if (usage.uses?.[k.info] === false || max === 0) {
      out.push(t('director.refNotConsumed', {
        kind: t(`director.kind.${k.mention}`),
        workflow: clipWorkflowLabel.value,
      }))
    } else if (max != null && count > max) {
      out.push(t('director.refOverLimit', { n: max }))
    }
  }
  return out
})

const assetStore = useAssetStore()
const pinnedStore = usePinnedBatchStore()
const projectStore = useProjectStore()
const selectionStore = useSelectionStore()
const projectId = computed(() => projectStore.currentProjectId || '')

const refsEl = ref<HTMLElement | null>(null)
const pickerOpen = ref(false)

function openPicker() {
  assetStore.ensureHydrated()
  pickerOpen.value = !pickerOpen.value
}

const batchGroups = computed(() =>
  pinnedStore.list(projectId.value).map(b => ({
    id: b.id, label: b.label, urls: b.urls, canRefresh: !!b.source_uid,
  })),
)

interface ClipRefEntry {
  kind: 'images' | 'videos' | 'audio'
  url: string
  i: number
  m: number
}

const allRefs = computed<ClipRefEntry[]>(() => {
  const clip = selectedClip.value
  if (!clip) return []
  return REF_KINDS.flatMap(k =>
    clip[k.key].map((url, i) => ({
      kind: k.key, url, i,
      m: i + sharedUrls.value[k.key].length,
    })))
})

const refLightboxItems = computed(() => allRefs.value
  .filter(e => e.kind !== 'videos' && e.kind !== 'audio')
  .map(e => ({ url: e.url, label: `#${e.m}` })))

function refLightboxIndex(entry: ClipRefEntry): number {
  return Math.max(0, refLightboxItems.value.findIndex(it => it.url === entry.url))
}

const pickerAddedIds = computed<number[]>(() =>
  allRefs.value
    .map(r => assetStore.byPayloadUrl(r.url)?.id)
    .filter((id): id is number => id != null),
)

const pickerAddedBatchKeys = computed<string[]>(() => {
  const clip = selectedClip.value
  if (!clip) return []
  const out: string[] = []
  for (const g of batchGroups.value) {
    g.urls.forEach((url, i) => {
      if (clip.images.includes(url)) out.push(`${g.id}:${i}`)
    })
  }
  return out
})

function onPickAsset(a: { payload_url: string; media_type: string }) {
  if (!selectedClip.value) return
  const kind = a.media_type === 'video' ? 'videos'
    : a.media_type === 'audio' ? 'audio'
    : 'images'
  addRef(selectedClip.value.id, kind, a.payload_url)
}

const refSlotPicker = ref<{
  entry: ClipRefEntry
  current: number
  x: number
  y: number
  options: ImageSlotOption[]
} | null>(null)

function openRefSlotPicker(entry: ClipRefEntry, e: MouseEvent) {
  const clip = selectedClip.value
  const rootRect = refsEl.value?.getBoundingClientRect()
  if (!clip || !rootRect) return
  const tile = (e.currentTarget as HTMLElement).getBoundingClientRect()
  const count = clip[entry.kind].length
  const base = sharedUrls.value[entry.kind].length
  refSlotPicker.value = {
    entry,
    current: entry.m,
    x: Math.max(0, Math.min(tile.left - rootRect.left, rootRect.width - 260)),
    y: tile.bottom - rootRect.top + 4,
    options: Array.from({ length: count }, (_, own) => ({
      slot: base + own,
      nodeTitles: entry.kind === 'images'
        ? imageSlotOptions.value.find(o => o.slot === base + own)?.nodeTitles ?? []
        : [],
    })),
  }
}

function onRefSlotPick(slot: number) {
  const picker = refSlotPicker.value
  refSlotPicker.value = null
  if (!picker || !selectedClip.value) return
  const base = sharedUrls.value[picker.entry.kind].length
  moveRefTo(selectedClip.value.id, picker.entry.kind, picker.entry.i, slot - base)
}

function onPickBatchImage(groupId: string, index: number) {
  if (!selectedClip.value) return
  const url = pinnedStore.byId(projectId.value, groupId)?.urls[index]
  if (url) addRef(selectedClip.value.id, 'images', url)
}

function onRefreshBatch(id: string) {
  const ok = pinnedStore.refresh(projectId.value, id, app as any)
  if (!ok) {
    ;(app as any)?.extensionManager?.toast?.add?.({
      severity: 'warn',
      summary: t('imageRefs.refreshFailed'),
      life: 4000,
    })
  }
}

function onUnpinBatch(id: string) {
  pinnedStore.unpin(projectId.value, id)
}
</script>

<style scoped>
.icon-btn {
  background: transparent;
  border: 0;
  cursor: pointer;
  color: var(--muted-foreground, #999);
  padding: 2px 4px;
  border-radius: 4px;
  font-size: 12px;
}
.icon-btn:hover,
.icon-btn:focus-visible {
  color: var(--base-foreground, #eee);
  background: rgba(255, 255, 255, 0.08);
}
.icon-btn:disabled {
  opacity: 0.4;
  cursor: default;
  pointer-events: none;
}
.chip-x {
  background: transparent;
  border: 0;
  cursor: pointer;
  color: inherit;
  padding: 0 1px;
}
.clip-resize:hover {
  background: rgba(255, 255, 255, 0.3);
}
.imgref-remove {
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.15s ease;
}
.imgref-tile:hover .imgref-remove,
.imgref-tile:focus-within .imgref-remove {
  opacity: 1;
  pointer-events: auto;
}
@media (hover: none), (pointer: coarse) {
  .imgref-remove {
    opacity: 1;
    pointer-events: auto;
  }
}
.add-clip:hover {
  color: var(--base-foreground, #eee);
  border-color: var(--primary-background, #4a9);
}
.playhead-cap {
  position: absolute;
  top: 0;
  left: -4px;
  width: 0;
  height: 0;
  border-left: 4px solid transparent;
  border-right: 4px solid transparent;
  border-top: 6px solid var(--primary-background, #4a9);
}
</style>
