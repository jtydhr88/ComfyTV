<template>
  <div class="flex flex-col gap-1.5 size-full">
    <PanoramaCanvas
      :panorama-url="visibleUrl"
      :manual-source="manualSource"
      @manual-source-changed="onManualSourceChanged"
      @manual-source-cleared="onManualSourceCleared"
    />

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
import { computed, ref, watch } from 'vue'
import { useStageStore, type StageState } from '@/stores/stageStore'
import StageCard from '@/components/stages/StageCard.vue'
import PanoramaCanvas from '@/components/widgets/PanoramaCanvas.vue'

const props = defineProps<{
  state: StageState
  onRunRequest: () => void
  onCancelRequest: () => void
  onDisconnect: (slot: string) => void
  onAction: (id: string) => void
  node: any
}>()

const store = useStageStore()

function getWidget(name: string): any | null {
  return props.node?.widgets?.find((w: any) => w.name === name) ?? null
}

const manualSource = ref<string>(String(getWidget('manual_source')?.value ?? ''))

const localPreviewUrl = ref<string | null>(null)

const visibleUrl = computed<string | null>(
  () => localPreviewUrl.value || props.state.output || null,
)

function writeManualSource(value: string) {
  const w = getWidget('manual_source')
  if (!w) return
  if (w.value !== value) {
    w.value = value
    w.callback?.(value)
  }
  manualSource.value = value
}

const msWidget = getWidget('manual_source')
if (msWidget) {
  const orig = msWidget.callback
  msWidget.callback = (v: unknown) => {
    orig?.call(msWidget, v)
    manualSource.value = String(v ?? '')
  }
}

if (props.node) {
  const origOnConfigure = props.node.onConfigure
  props.node.onConfigure = function (info: any) {
    origOnConfigure?.call(this, info)
    const v = String(getWidget('manual_source')?.value ?? '')
    if (v && v !== manualSource.value) manualSource.value = v
  }
}

function onManualSourceChanged(viewUrl: string) {
  writeManualSource(viewUrl)
  localPreviewUrl.value = viewUrl
  store.applyExecutedPayload(props.state, { output: [viewUrl] })
}

function onManualSourceCleared() {
  writeManualSource('')
  localPreviewUrl.value = null
}

watch(
  [() => props.state.output, manualSource],
  ([out, manual]) => {
    if (!out && manual) {
      store.applyExecutedPayload(props.state, { output: [manual] })
    }
  },
  { immediate: true },
)
</script>
