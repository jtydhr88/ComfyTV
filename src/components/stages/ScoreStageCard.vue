<template>
  <div class="ctv:flex ctv:flex-col ctv:gap-1.5 ctv:w-full ctv:grow" @contextmenu.stop.prevent>
    <div
      class="ctv:flex ctv:items-center ctv:gap-1.5 ctv:text-2xs"
      @pointerdown.stop @pointermove.stop @pointerup.stop
    >
      <button type="button" :class="btn" @click="engrave.zoomBy(-0.1)">−</button>
      <span class="ctv:font-mono ctv:text-muted-foreground ctv:min-w-9 ctv:text-center">{{ Math.round(engrave.zoom.value * 100) }}%</span>
      <button type="button" :class="btn" @click="engrave.zoomBy(0.1)">+</button>
      <span v-if="engrave.rendering.value" class="ctv:text-muted-foreground">{{ $t('music.engraving') }}</span>
      <button
        type="button"
        class="ctv:ml-auto ctv:py-0.5 ctv:px-1.5 ctv:text-2xs ctv:rounded ctv:cursor-pointer ctv:border ctv:transition-colors"
        :class="showEditor
          ? 'ctv:bg-secondary-background-selected ctv:border-primary-background ctv:text-primary-background'
          : 'ctv:bg-secondary-background ctv:border-border-subtle ctv:text-base-foreground ctv:hover:border-primary-background'"
        @click="showEditor = !showEditor"
      ><i class="pi pi-code" /> XML</button>
    </div>

    <div class="ctv:relative ctv:flex-1 ctv:min-h-48">
    <div
      class="ctv-scroll-thin ctv:absolute ctv:inset-0 ctv:overflow-y-auto ctv:overflow-x-auto ctv:rounded ctv:border ctv:border-border-subtle ctv:bg-white"
      style="overscroll-behavior: contain;"
      @pointerdown.stop @pointermove.stop @pointerup.stop @wheel.stop
    >
      <div ref="sheetEl" class="ctv:min-w-full ctv:p-2" />
      <div
        v-if="engrave.empty.value && !engrave.error.value"
        class="ctv:absolute ctv:inset-0 ctv:flex ctv:items-center ctv:justify-center ctv:text-2xs ctv:text-neutral-400"
      >{{ $t('music.noScoreYet') }}</div>
      <div
        v-if="engrave.error.value"
        class="ctv:absolute ctv:inset-x-0 ctv:bottom-0 ctv:bg-black/70 ctv:px-2 ctv:py-1 ctv:text-2xs ctv:text-red-300"
      >{{ engrave.error.value }}</div>
    </div>
    </div>

    <div
      v-if="showEditor"
      class="ctv:flex ctv:flex-col ctv:gap-1"
      @pointerdown.stop @pointermove.stop @pointerup.stop
    >
      <textarea
        v-model="musicxml"
        rows="8"
        spellcheck="false"
        class="ctv:w-full ctv:resize-y ctv:rounded ctv:border ctv:border-border-subtle ctv:bg-secondary-background ctv:px-1.5 ctv:py-1 ctv:font-mono ctv:text-2xs ctv:text-base-foreground ctv:outline-none ctv:focus:border-primary-background"
        :placeholder="$t('music.scorePlaceholder')"
        :disabled="hasTextInput"
        @keydown.stop
      />
    </div>
    <div class="ctv:text-2xs ctv:text-muted-foreground ctv:leading-snug" @pointerdown.stop>
      {{ hasTextInput ? $t('music.scoreFromInput') : $t('music.scoreHint') }}
    </div>

    <div class="ctv:text-2xs ctv:text-center ctv:py-0.5 ctv:tracking-wide">
      <span v-if="state.running" class="ctv:text-muted-foreground">{{ $t('fx.processing') }}</span>
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
import { computed, ref } from 'vue'
import type { LGraphNode } from '@/lib/comfyApp'
import type { StageState } from '@/stores/stageStore'
import StageCard from '@/components/stages/StageCard.vue'
import { pickSourceImageUrl } from '@/composables/stages/stageInputs'
import { useScoreEngrave } from '@/composables/stages/useScoreEngrave'
import { useStrWidget } from '@/composables/widgets/useWidgetModel'

const props = defineProps<{
  state: StageState
  onRunRequest: () => void
  onCancelRequest: () => void
  onDisconnect: (slot: string) => void
  onAction: (id: string) => void
  node: LGraphNode
}>()

const btn = 'ctv:inline-flex ctv:items-center ctv:gap-1 ctv:py-1 ctv:px-2.5 ctv:rounded-lg ctv:border ctv:border-border-subtle ctv:bg-secondary-background ctv:text-base-foreground ctv:cursor-pointer ctv:hover:border-primary-background/60'

const musicxml = useStrWidget(props.node, 'musicxml', '')
const inputText = computed(() => pickSourceImageUrl(props.state.inputs, 'text') ?? '')
const hasTextInput = computed(() => !!inputText.value)
const activeXml = computed(() => hasTextInput.value ? inputText.value : musicxml.value)

const showEditor = ref(false)
const sheetEl = ref<HTMLElement | null>(null)
const engrave = useScoreEngrave({ xml: activeXml, container: sheetEl })
</script>
