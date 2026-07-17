<template>
  <div
    class="ctv:flex ctv:flex-col ctv:gap-1.5 ctv:size-full ctv:p-2 ctv:box-border ctv:text-xs ctv:text-base-foreground"
    @contextmenu.stop.prevent
  >
    <div class="ctv:group ctv:relative ctv:w-full ctv:flex-1 ctv:min-h-[240px] ctv:rounded-md ctv:overflow-hidden ctv:bg-black">
      <ModelPreview
        v-if="previewSrc"
        ref="previewEl"
        :src="previewSrc"
        :channel="channel"
        @view-changed="scheduleCapture"
        @model-stats="onModelStats"
      />
      <div v-else
           class="ctv:h-full ctv:flex ctv:flex-col ctv:items-center ctv:justify-center ctv:gap-1.5 ctv:text-white/50">
        <IconBox class="ctv:size-8 ctv:opacity-60" />
        <div class="ctv:text-xs">{{ $t(isPrimitive ? 'meshOps.runToGenerate' : 'meshOps.noInputModel') }}</div>
      </div>

      <div v-if="sourceUrl && resultUrl"
           class="ctv:absolute ctv:top-1 ctv:left-1 ctv:z-10 ctv:flex ctv:gap-1">
        <button type="button" :class="chipClass(!showResult)" @click.stop="showResult = false">
          {{ $t('meshOps.source') }}
        </button>
        <button type="button" :class="chipClass(showResult)" @click.stop="showResult = true">
          {{ $t('meshOps.result') }}
        </button>
      </div>

      <div v-if="previewSrc"
           class="ctv:absolute ctv:top-1 ctv:right-1 ctv:z-10 ctv:flex ctv:gap-1 ctv:opacity-0
                  ctv:group-hover:opacity-100 ctv:transition-opacity">
        <button type="button" :class="downloadBtnClass"
                :title="$t('stage.action.download')"
                @click.stop="onDownloadModel"><i class="pi pi-download" /></button>
      </div>

      <div v-if="statsLine"
           class="ctv:absolute ctv:bottom-1 ctv:left-1 ctv:z-10 ctv:px-1.5 ctv:py-0.5 ctv:rounded-sm
                  ctv:bg-black/60 ctv:text-3xs ctv:font-mono ctv:text-white/80 ctv:pointer-events-none">
        {{ statsLine }}
      </div>

      <div v-if="previewSrc"
           class="ctv:absolute ctv:bottom-1 ctv:right-1 ctv:z-10 ctv:flex ctv:gap-1">
        <button v-for="ch in channels" :key="ch" type="button"
                :class="chipClass(channel === ch)"
                @click.stop="channel = ch">{{ $t(`meshOps.channel.${ch}`) }}</button>
      </div>
    </div>

    <div
      v-if="hasMapsPanel && mapsUrl"
      class="ctv:relative ctv:w-full ctv:shrink-0 ctv:rounded-md ctv:overflow-hidden ctv:bg-black"
    >
      <img :src="assetUrl(mapsUrl)" :alt="mapsPanelLabel"
           class="ctv:block ctv:w-full ctv:max-h-40 ctv:object-contain" />
      <span class="ctv:absolute ctv:top-1 ctv:left-1 ctv:px-1.5 ctv:py-0.5 ctv:rounded-sm
                   ctv:bg-black/60 ctv:text-3xs ctv:text-white/80 ctv:pointer-events-none">
        {{ mapsPanelLabel }}
      </span>
    </div>

    <div class="ctv:flex ctv:flex-col ctv:gap-1 ctv:shrink-0"
         @pointerdown.stop @mousedown.stop>
      <div v-if="isMeshOp" class="ctv:flex ctv:items-start ctv:gap-1.5">
        <span class="ctv:w-28 ctv:shrink-0 ctv:truncate ctv:text-2xs ctv:text-muted-foreground ctv:pt-0.5">
          {{ $t('meshOps.operation') }}</span>
        <div class="ctv:flex ctv:flex-wrap ctv:gap-1">
          <button v-for="op in MESH_OPERATIONS" :key="op" type="button"
                  :class="chipClass(operation === op)"
                  @click="setOperation(op)">{{ $t(`meshOps.op.${op}`) }}</button>
        </div>
      </div>

      <template v-for="c in visibleControls" :key="c.widget">
        <div class="ctv:flex ctv:items-center ctv:gap-1.5">
          <span class="ctv:w-28 ctv:shrink-0 ctv:truncate ctv:text-2xs ctv:text-muted-foreground"
                :title="$t(c.labelKey)">{{ $t(c.labelKey) }}</span>

          <template v-if="c.type === 'combo'">
            <button
              v-for="opt in c.options"
              :key="opt"
              type="button"
              :class="chipClass(values[c.widget] === opt)"
              @click="setValue(c, opt)"
            >{{ $t(`meshOps.opt.${opt}`) }}</button>
          </template>

          <template v-else-if="c.type === 'bool'">
            <button
              type="button"
              :class="chipClass(Boolean(values[c.widget]))"
              @click="setValue(c, !values[c.widget])"
            >{{ Boolean(values[c.widget]) ? $t('meshOps.on') : $t('meshOps.off') }}</button>
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
      <span v-if="!sourceUrl && !isPrimitive" class="ctv:text-muted-foreground">{{ $t('meshOps.noInputModel') }}</span>
      <span v-else-if="state.running" class="ctv:text-muted-foreground">{{ $t('meshOps.processing') }}</span>
      <span v-else-if="state.output" class="ctv:text-success-background">{{ $t('meshOps.done') }}</span>
      <span v-else class="ctv:text-muted-foreground">{{ $t('meshOps.adjustThenRun') }}</span>
    </div>

    <div class="ctv:shrink-0">
      <StageCard
        :state="state"
        :node="node"
        :on-run-request="onRunRequest"
        :on-cancel-request="onCancelRequest"
        :on-disconnect="onDisconnect"
        :on-action="onAction"
        hide-output
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import IconBox from '~icons/lucide/box'

import type { LGraphNode } from '@/lib/comfyApp'
import ModelPreview from '@/components/stages/ModelPreview.vue'
import StageCard from '@/components/stages/StageCard.vue'
import type { StageState } from '@/stores/stageStore'
import { MESH_OPERATIONS, useMeshOp } from '@/composables/stages/useMeshOp'
import {
  MODEL_VIEW_CAPTURE_SIZE,
  useModelViewCapture
} from '@/composables/stages/useModelViewCapture'

const { t } = useI18n()

const props = defineProps<{
  state: StageState
  onRunRequest: () => void
  onCancelRequest: () => void
  onDisconnect: (slot: string) => void
  onAction: (id: string, context?: { imageUrl?: string }) => void
  node: LGraphNode
}>()

const {
  isMeshOp,
  isPrimitive,
  operation,
  setOperation,
  visibleControls,
  isUnwrap,
  hasMapsPanel,
  channels,
  channel,
  values,
  setValue,
  sourceUrl,
  resultUrl,
  mapsUrl,
  showResult,
  previewSrc,
  onModelStats,
  statsLine,
  assetUrl,
  onDownloadModel
} = useMeshOp(props.node, props.state)

const mapsPanelLabel = computed(() => t(isUnwrap.value ? 'meshOps.uvAtlas' : 'meshOps.bakedMaps'))

const previewEl = ref<InstanceType<typeof ModelPreview> | null>(null)

const { scheduleCapture } = useModelViewCapture({
  getCanvas: () => previewEl.value?.captureCanvas(MODEL_VIEW_CAPTURE_SIZE, MODEL_VIEW_CAPTURE_SIZE),
  filenamePrefix: 'comfytv-mesh-op-view',
  logTag: 'mesh-op',
  onCaptured: (url) => props.onAction('model-capture-view', { imageUrl: url }),
  enabled: () => !hasMapsPanel.value
})

function chipClass(active: boolean): string {
  return 'ctv:inline-flex ctv:items-center ctv:gap-1 ctv:cursor-pointer ctv:[font-family:inherit]'
    + ' ctv:rounded-sm ctv:border ctv:px-1.5 ctv:py-0.5 ctv:text-2xs ctv:transition-colors'
    + (active
      ? ' ctv:border-primary-background ctv:bg-primary-background/20 ctv:text-base-foreground'
      : ' ctv:border-border-subtle ctv:bg-secondary-background ctv:text-muted-foreground'
        + ' ctv:hover:bg-secondary-background-hover ctv:hover:text-base-foreground')
}

const downloadBtnClass =
  'ctv:relative ctv:inline-flex ctv:items-center ctv:justify-center ctv:cursor-pointer ctv:appearance-none'
  + ' ctv:border-none ctv:transition-colors ctv:size-5 ctv:p-0 ctv:rounded-sm ctv:text-sm'
  + ' ctv:bg-white ctv:text-gray-600 ctv:hover:bg-white/90'
</script>
