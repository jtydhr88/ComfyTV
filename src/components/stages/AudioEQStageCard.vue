<template>
  <div class="ctv:flex ctv:flex-col ctv:gap-1.5 ctv:size-full">
    <VideoPlayerLite :source-video-url="sourceUrl" :default-muted="false" />

    <div
      class="ctv:flex ctv:flex-col ctv:gap-1"
      @pointerdown.stop @pointermove.stop @pointerup.stop
    >
      <EqGraph v-model="bands" />
      <div class="ctv:text-2xs ctv:text-center ctv:text-muted-foreground">{{ $t('fx.eqHint') }}</div>

      <div class="ctv:flex ctv:items-center ctv:gap-1">
        <button
          v-for="btn in QUICK_BANDS" :key="btn.label"
          type="button"
          class="ctv:flex-1 ctv:py-0.5 ctv:text-2xs ctv:rounded ctv:cursor-pointer ctv:border
                 ctv:bg-secondary-background ctv:border-border-subtle ctv:text-base-foreground
                 ctv:hover:border-primary-background"
          @click="addBand(btn.band)"
        >{{ btn.label }}</button>
        <button
          type="button"
          class="ctv:flex-1 ctv:py-0.5 ctv:text-2xs ctv:rounded ctv:cursor-pointer ctv:border
                 ctv:bg-secondary-background ctv:border-border-subtle ctv:text-destructive-background
                 ctv:hover:border-destructive-background"
          @click="bands = []"
        ><i class="pi pi-trash" /></button>
      </div>

      <div v-if="bands.length" class="ctv-scroll-thin ctv:flex ctv:flex-col ctv:gap-0.5 ctv:max-h-20 ctv:overflow-y-auto" @wheel.stop>
        <div
          v-for="(b, i) in bands" :key="i"
          class="ctv:flex ctv:items-center ctv:gap-1.5 ctv:text-2xs ctv:font-mono ctv:text-muted-foreground"
        >
          <span class="ctv:w-14">{{ b.type }}</span>
          <span class="ctv:w-12 ctv:text-right">{{ b.f >= 1000 ? (b.f / 1000).toFixed(1) + 'k' : b.f }}Hz</span>
          <span class="ctv:w-12 ctv:text-right">{{ b.g >= 0 ? '+' : '' }}{{ b.g.toFixed(1) }}dB</span>
          <span class="ctv:w-10 ctv:text-right">Q{{ b.q.toFixed(1) }}</span>
          <button type="button" class="ctv:ml-auto ctv:cursor-pointer ctv:hover:text-destructive-background"
                  @click="removeBand(i)"><i class="pi pi-times" /></button>
        </div>
      </div>
    </div>

    <div class="ctv:text-2xs ctv:text-center ctv:py-0.5 ctv:tracking-wide">
      <span v-if="!sourceUrl" class="ctv:text-muted-foreground">{{ $t('fx.needsAudioOrVideo') }}</span>
      <span v-else-if="state.running" class="ctv:text-muted-foreground">{{ $t('fx.processing') }}</span>
      <span v-else-if="state.output" class="ctv:text-success-background">{{ $t('fx.done') }}</span>
      <span v-else class="ctv:text-muted-foreground">{{ $t('fx.adjustThenRun') }}</span>
    </div>

    <StageCard
      :state="state"
      :node="node"
      :on-run-request="onRunRequest"
      :on-cancel-request="onCancelRequest"
      :on-disconnect="onDisconnect"
      :on-action="onAction"
    />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { LGraphNode } from '@/lib/comfyApp'
import type { StageState } from '@/stores/stageStore'
import StageCard from '@/components/stages/StageCard.vue'
import VideoPlayerLite from '@/components/widgets/VideoPlayerLite.vue'
import EqGraph from '@/components/widgets/fx/EqGraph.vue'
import { pickSourceImageUrl } from '@/composables/stages/stageInputs'
import { QUICK_BANDS, useEqBands } from '@/composables/stages/useEqBands'

const props = defineProps<{
  state: StageState
  onRunRequest: () => void
  onCancelRequest: () => void
  onDisconnect: (slot: string) => void
  onAction: (id: string) => void
  node: LGraphNode
}>()

const sourceUrl = computed(() =>
  pickSourceImageUrl(props.state.inputs, 'audio')
  || pickSourceImageUrl(props.state.inputs, 'video'))

const { bands, addBand, removeBand } = useEqBands(props.node)
</script>
