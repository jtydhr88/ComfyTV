<template>
  <div
    class="ctv:flex ctv:flex-col ctv:gap-1.5 ctv:size-full ctv:p-2 ctv:box-border ctv:text-xs ctv:text-base-foreground"
    @contextmenu.stop.prevent
  >
    <div class="ctv:group ctv:relative ctv:w-full ctv:h-[calc(100%-320px)] ctv:min-h-[240px] ctv:shrink-0 ctv:rounded-md ctv:overflow-hidden ctv:bg-black">
      <img
        v-if="showResult && resultUrl"
        :src="assetUrl(resultUrl)"
        :alt="$t('lineArt.result')"
        class="ctv:block ctv:size-full ctv:object-contain"
      />
      <ModelPreview
        v-else-if="sourceUrl"
        ref="previewEl"
        :src="sourceUrl"
        channel="clay"
      />
      <div v-else
           class="ctv:h-full ctv:flex ctv:flex-col ctv:items-center ctv:justify-center ctv:gap-1.5 ctv:text-white/50">
        <IconPenTool class="ctv:size-8 ctv:opacity-60" />
        <div class="ctv:text-xs">{{ $t('lineArt.noInputModel') }}</div>
      </div>

      <div v-if="sourceUrl && resultUrl"
           class="ctv:absolute ctv:top-1 ctv:left-1 ctv:z-10 ctv:flex ctv:gap-1">
        <button type="button" :class="chipClass(!showResult)" @click.stop="showResult = false">
          {{ $t('lineArt.model') }}
        </button>
        <button type="button" :class="chipClass(showResult)" @click.stop="showResult = true">
          {{ $t('lineArt.result') }}
        </button>
      </div>

      <div v-if="showResult && resultUrl"
           class="ctv:absolute ctv:top-1 ctv:right-1 ctv:z-10 ctv:flex ctv:gap-1 ctv:opacity-0
                  ctv:group-hover:opacity-100 ctv:transition-opacity">
        <button type="button" :class="downloadBtnClass"
                :title="$t('stage.action.download')"
                @click.stop="onDownloadResult"><i class="pi pi-download" /></button>
        <button type="button" :class="tagBtnClass"
                :title="$t('stage.action.addTag')"
                @click.stop="tagMenuEl?.open(resultUrl!, $event, 'image')"><i class="pi pi-tag" /></button>
      </div>

      <div v-if="!showResult && sourceUrl"
           class="ctv:absolute ctv:bottom-1 ctv:left-1 ctv:z-10 ctv:px-1.5 ctv:py-0.5 ctv:rounded-sm
                  ctv:bg-black/60 ctv:text-3xs ctv:text-white/70 ctv:pointer-events-none">
        {{ $t('lineArt.orbitHint') }}
      </div>
    </div>

    <div class="ctv-scroll-thin ctv:flex-1 ctv:min-h-0 ctv:overflow-y-auto ctv:flex ctv:flex-col ctv:gap-1"
         @pointerdown.stop @mousedown.stop @wheel.stop>
      <template v-for="c in visibleControls" :key="c.widget">
        <div class="ctv:flex ctv:items-center ctv:gap-1.5">
          <span class="ctv:w-28 ctv:shrink-0 ctv:truncate ctv:text-2xs ctv:text-muted-foreground"
                :title="$t(c.labelKey)">{{ $t(c.labelKey) }}</span>

          <template v-if="c.type === 'bool'">
            <button
              type="button"
              :class="chipClass(Boolean(values[c.widget]))"
              @click="setValue(c, !values[c.widget])"
            >{{ Boolean(values[c.widget]) ? $t('lineArt.on') : $t('lineArt.off') }}</button>
          </template>

          <template v-else>
            <input
              type="range"
              class="ctv:flex-1 ctv:min-w-0 ctv:accent-[var(--ctv-primary-background,#4ea8ff)]"
              :min="c.min" :max="c.max" :step="c.step"
              :value="Number(values[c.widget])"
              @input="setValue(c, ($event.target as HTMLInputElement).value)"
            />
            <input
              type="number"
              class="ctv:w-20 ctv:shrink-0 ctv:py-0.5 ctv:px-1 ctv:rounded-sm ctv:outline-none ctv:box-border
                     ctv:text-2xs ctv:text-right ctv:[font-family:inherit]
                     ctv:bg-secondary-background ctv:text-base-foreground
                     ctv:border ctv:border-border-default ctv:focus:border-primary-background"
              :min="c.min" :max="c.max" :step="c.step"
              :value="Number(values[c.widget])"
              @change="setValue(c, ($event.target as HTMLInputElement).value)"
            />
          </template>
        </div>
      </template>
    </div>

    <div class="ctv:text-2xs ctv:text-center ctv:py-0.5 ctv:tracking-wide ctv:shrink-0">
      <span v-if="!sourceUrl" class="ctv:text-muted-foreground">{{ $t('lineArt.noInputModel') }}</span>
      <span v-else-if="state.running" class="ctv:text-muted-foreground">{{ $t('lineArt.processing') }}</span>
      <span v-else-if="state.output" class="ctv:text-success-background">{{ $t('lineArt.done') }}</span>
      <span v-else class="ctv:text-muted-foreground">{{ $t('lineArt.frameThenRun') }}</span>
    </div>

    <div class="ctv:shrink-0">
      <StageCard
        :state="state"
        :node="node"
        :on-run-request="onRun"
        :on-cancel-request="onCancelRequest"
        :on-disconnect="onDisconnect"
        :on-action="onAction"
        hide-output
      />
    </div>

    <AssetTagMenu ref="tagMenuEl" />
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'

import IconPenTool from '~icons/lucide/pen-tool'

import type { LGraphNode } from '@/lib/comfyApp'
import AssetTagMenu from '@/components/stages/AssetTagMenu.vue'
import ModelPreview from '@/components/stages/ModelPreview.vue'
import StageCard from '@/components/stages/StageCard.vue'
import type { StageState } from '@/stores/stageStore'
import { useLineArt } from '@/composables/stages/useLineArt'

const props = defineProps<{
  state: StageState
  onRunRequest: () => void
  onCancelRequest: () => void
  onDisconnect: (slot: string) => void
  onAction: (id: string, context?: { imageUrl?: string }) => void
  node: LGraphNode
}>()

const {
  values,
  visibleControls,
  setValue,
  writeCamera,
  sourceUrl,
  resultUrl,
  showResult,
  assetUrl,
  onDownloadResult
} = useLineArt(props.node, props.state)

const previewEl = ref<InstanceType<typeof ModelPreview> | null>(null)

function onRun(): void {
  writeCamera(previewEl.value?.cameraState() ?? null)
  props.onRunRequest()
}

function chipClass(active: boolean): string {
  return 'ctv:inline-flex ctv:items-center ctv:gap-1 ctv:cursor-pointer ctv:[font-family:inherit]'
    + ' ctv:rounded-sm ctv:border ctv:px-1.5 ctv:py-0.5 ctv:text-2xs ctv:transition-colors'
    + (active
      ? ' ctv:border-primary-background ctv:bg-primary-background/20 ctv:text-base-foreground'
      : ' ctv:border-border-subtle ctv:bg-secondary-background ctv:text-muted-foreground'
        + ' ctv:hover:bg-secondary-background-hover ctv:hover:text-base-foreground')
}

const PREVIEW_BTN_BASE =
  'ctv:relative ctv:inline-flex ctv:items-center ctv:justify-center ctv:cursor-pointer ctv:appearance-none'
  + ' ctv:border-none ctv:transition-colors ctv:size-5 ctv:p-0 ctv:rounded-sm ctv:text-sm'
const downloadBtnClass = PREVIEW_BTN_BASE + ' ctv:bg-white ctv:text-gray-600 ctv:hover:bg-white/90'

const tagMenuEl = ref<InstanceType<typeof AssetTagMenu> | null>(null)
const tagBtnClass = computed(() => PREVIEW_BTN_BASE
  + (resultUrl.value && tagMenuEl.value?.isSaved(resultUrl.value)
    ? ' ctv:bg-primary-background ctv:text-white ctv:hover:bg-primary-background/90'
    : ' ctv:bg-white ctv:text-gray-600 ctv:hover:bg-white/90'))
</script>
