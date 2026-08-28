<template>
  <div v-if="hasText" class="v2-corner" @pointerdown.stop>
    <button
      type="button"
      class="v2-corner__btn"
      :data-done="textCopied ? '1' : ''"
      :title="t('stage.action.copyText')"
      @click.stop="copyText"
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <rect x="9" y="9" width="11" height="11" rx="1.5" />
        <path d="M5 15H4.5A1.5 1.5 0 013 13.5v-9A1.5 1.5 0 014.5 3h9A1.5 1.5 0 0115 4.5V5" />
      </svg>
    </button>
    <button
      type="button"
      class="v2-corner__btn"
      :class="{ 'v2-corner__btn--saved': textSaved }"
      :disabled="textSaving"
      :title="t('stage.action.saveTextAsset')"
      @click.stop="saveTextAsset"
    >
      <svg viewBox="0 0 24 24" :fill="textSaved ? 'currentColor' : 'none'" stroke="currentColor" stroke-width="2">
        <path d="M6.5 3.5h11a1 1 0 011 1V21l-6.5-4-6.5 4V4.5a1 1 0 011-1z" />
      </svg>
    </button>
    <button
      type="button"
      class="v2-corner__btn"
      :title="t('stage.action.download')"
      @click.stop="downloadText"
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M12 3.5V15M7 10.5l5 5 5-5M4 19.5h16" />
      </svg>
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import { useTextOutputActions } from '@/composables/stages/useTextOutputActions'
import type { StageState } from '@/stores/stageStore'

const { t } = useI18n()

const props = defineProps<{
  state: StageState
}>()

const hasText = computed(() => !!String(props.state.output ?? '').trim())

const {
  textCopied,
  textSaved,
  textSaving,
  copyText,
  downloadText,
  saveTextAsset,
} = useTextOutputActions(() => String(props.state.output ?? ''))
</script>

<style scoped>
.v2-corner {
  display: flex;
  flex-direction: column;
  gap: 5px;
}
.v2-corner__btn {
  width: 26px;
  height: 26px;
  border: none;
  border-radius: 999px;
  background: rgba(20, 20, 24, 0.66);
  backdrop-filter: blur(4px);
  color: #ececf1;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}
.v2-corner__btn svg { width: 13px; height: 13px; }
.v2-corner__btn:hover { background: rgba(20, 20, 24, 0.9); }
.v2-corner__btn:disabled { opacity: 0.5; cursor: default; }
.v2-corner__btn--saved { color: var(--v2-accent); }
.v2-corner__btn[data-done='1'] {
  background: var(--v2-accent);
  color: var(--v2-run-fg);
}
</style>
