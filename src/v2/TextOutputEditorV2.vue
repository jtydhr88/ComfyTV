<template>
  <div ref="root" class="v2-tedit" @pointerdown.stop @wheel.stop>
    <textarea
      ref="area"
      v-model="draft"
      class="v2-tedit__area"
      @blur="finish(true)"
      @copy.stop
      @paste.stop
      @cut.stop
      @keydown.stop="onKeydown"
    />
  </div>
</template>

<script setup lang="ts">
import { useEventListener } from '@vueuse/core'
import { onMounted, ref, watch } from 'vue'

import { useTextOutputEdit } from '@/composables/stages/useTextOutputEdit'
import type { StageState } from '@/stores/stageStore'

const props = defineProps<{ state: StageState }>()

const { saveText } = useTextOutputEdit(props.state)

const root = ref<HTMLElement | null>(null)
const area = ref<HTMLTextAreaElement | null>(null)
const draft = ref(String(props.state.output ?? ''))

function finish(save: boolean) {
  if (!props.state.textEditing) return
  props.state.textEditing = false
  if (save) void saveText(draft.value)
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') finish(false)
  else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) finish(true)
}

useEventListener(document, 'pointerdown', (e: PointerEvent) => {
  if (!root.value?.contains(e.target as Node)) finish(true)
}, { capture: true })

watch(() => props.state.running, (running) => { if (running) finish(false) })

onMounted(() => area.value?.focus())
</script>

<style scoped>
.v2-tedit {
  position: absolute;
  inset: 0;
  border-radius: 12px;
  overflow: hidden;
  background: var(--v2-media-bg);
  border: 1px solid var(--v2-text-muted);
  box-sizing: border-box;
}
.v2-tedit__area {
  display: block;
  width: 100%;
  height: 100%;
  padding: 12px 14px;
  box-sizing: border-box;
  border: none;
  outline: none;
  resize: none;
  background: transparent;
  color: var(--v2-text-mid);
  font: 400 12px/1.7 system-ui, sans-serif;
}
</style>
