<template>
  <div class="ctv-bot-md ctv:text-sm ctv:leading-relaxed ctv:break-words">
    <template v-for="(segment, i) in segments" :key="`${segment.type}-${i}`">
      <CodeBlock
        v-if="segment.type === 'code'"
        :code="segment.code"
        :lang="segment.lang"
      />
      <template v-else>
        <div v-html="renderMarkdownToHtml(segment.raw)" />
        <BotMediaGroup v-if="segment.refs.length" :refs="segment.refs" />
      </template>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

import BotMediaGroup from '@/components/bot/BotMediaGroup.vue'
import CodeBlock from '@/components/bot/CodeBlock.vue'
import { renderMarkdownToHtml } from '@/utils/markdown'
import { extractMediaRefs, segmentMarkdown } from '@/utils/markdownSegments'

const { text } = defineProps<{ text: string }>()

const segments = computed(() =>
  segmentMarkdown(text).map(segment =>
    segment.type === 'prose'
      ? { ...segment, refs: extractMediaRefs(segment.raw) }
      : segment))
</script>

<style scoped>
.ctv-bot-md :deep(p) {
  margin: 0 0 0.5em;
}
.ctv-bot-md :deep(p:last-child) {
  margin-bottom: 0;
}
.ctv-bot-md :deep(img) {
  max-height: 14rem;
  border-radius: 8px;
}
.ctv-bot-md :deep(pre) {
  overflow-x: auto;
  border-radius: 6px;
  padding: 6px 8px;
  background: color-mix(in srgb, currentColor 8%, transparent);
}
.ctv-bot-md :deep(code) {
  font-size: 11px;
}
.ctv-bot-md :deep(ul),
.ctv-bot-md :deep(ol) {
  margin: 0 0 0.5em;
  padding-left: 1.2em;
}
.ctv-bot-md :deep(table) {
  border-collapse: collapse;
  margin: 0 0 0.5em;
}
.ctv-bot-md :deep(th),
.ctv-bot-md :deep(td) {
  border: 1px solid color-mix(in srgb, currentColor 20%, transparent);
  padding: 2px 8px;
}
</style>
