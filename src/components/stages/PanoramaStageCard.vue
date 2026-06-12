<template>
  <div class="ctv:flex ctv:flex-col ctv:gap-1.5 ctv:size-full">
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
import type { LGraphNode } from '@/lib/comfyApp'
import { useStageStore, type StageState } from '@/stores/stageStore'
import StageCard from '@/components/stages/StageCard.vue'
import PanoramaCanvas from '@/components/widgets/PanoramaCanvas.vue'
import { getWidget, readWidgetStr, writeWidget } from '@/utils/widget'

const props = defineProps<{
  state: StageState
  onRunRequest: () => void
  onCancelRequest: () => void
  onDisconnect: (slot: string) => void
  onAction: (id: string) => void
  node: LGraphNode
}>()

const store = useStageStore()

const manualSource = ref<string>(readWidgetStr(props.node, 'manual_source', ''))

const localPreviewUrl = ref<string | null>(null)

const visibleUrl = computed<string | null>(
  () => localPreviewUrl.value || props.state.output || null,
)

function writeManualSource(value: string) {
  if (!getWidget(props.node, 'manual_source')) return
  writeWidget(props.node, 'manual_source', value)
  manualSource.value = value
}

const msWidget = getWidget(props.node, 'manual_source')
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
    const v = readWidgetStr(props.node, 'manual_source', '')
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
