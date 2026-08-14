<template>
  <div class="ctv:flex ctv:flex-col ctv:gap-1.5">
    <template v-for="(block, i) in blocks" :key="i">
      <div
        v-if="block.type === 'text' && (block.text ?? '').trim()"
        class="ctv-bot-md ctv:text-sm ctv:leading-relaxed ctv:break-words"
        v-html="renderMarkdownToHtml(block.text ?? '')"
      />
      <div
        v-else-if="block.type === 'tool_use'"
        class="ctv:rounded-md ctv:border ctv:border-border-subtle ctv:bg-secondary-background ctv:text-xs"
      >
        <button
          class="ctv:flex ctv:w-full ctv:items-center ctv:gap-1.5 ctv:border-none ctv:bg-transparent ctv:px-2 ctv:py-1.5 ctv:text-left ctv:text-muted-foreground ctv:cursor-pointer"
          @click="toggle(i)"
        >
          <i class="pi pi-wrench ctv:text-[10px]" />
          <span class="ctv:truncate ctv:font-mono">{{ toolLabel(block) }}</span>
          <i
            class="pi ctv:ml-auto ctv:text-[10px]"
            :class="expanded.has(i) ? 'pi-chevron-up' : 'pi-chevron-down'"
          />
        </button>
        <pre
          v-if="expanded.has(i)"
          class="ctv:m-0 ctv:max-h-40 ctv:overflow-auto ctv:border-t ctv:border-border-subtle ctv:px-2 ctv:py-1.5 ctv:font-mono ctv:text-[11px] ctv:whitespace-pre-wrap ctv:break-all"
        >{{ formatInput(block) }}</pre>
      </div>
      <div
        v-else-if="block.type === 'tool_result'"
        class="ctv:rounded-md ctv:border ctv:border-border-subtle ctv:text-xs"
      >
        <button
          class="ctv:flex ctv:w-full ctv:items-center ctv:gap-1.5 ctv:border-none ctv:bg-transparent ctv:px-2 ctv:py-1.5 ctv:text-left ctv:text-muted-foreground ctv:cursor-pointer"
          @click="toggle(i)"
        >
          <i class="pi pi-reply ctv:text-[10px]" />
          <span class="ctv:truncate">{{ $t('bot.toolResult') }}</span>
          <i
            class="pi ctv:ml-auto ctv:text-[10px]"
            :class="expanded.has(i) ? 'pi-chevron-up' : 'pi-chevron-down'"
          />
        </button>
        <pre
          v-if="expanded.has(i)"
          class="ctv:m-0 ctv:max-h-40 ctv:overflow-auto ctv:border-t ctv:border-border-subtle ctv:px-2 ctv:py-1.5 ctv:font-mono ctv:text-[11px] ctv:whitespace-pre-wrap ctv:break-all"
        >{{ block.text }}</pre>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

import type { BotBlock } from '@/stores/botStore'
import { renderMarkdownToHtml } from '@/utils/markdown'

defineProps<{ blocks: BotBlock[] }>()

const expanded = ref<Set<number>>(new Set())

function toggle(i: number) {
  const next = new Set(expanded.value)
  if (next.has(i)) next.delete(i)
  else next.add(i)
  expanded.value = next
}

function toolLabel(block: BotBlock): string {
  const name = block.name ?? ''
  return name.replace(/^mcp__comfytv__/, '')
}

function formatInput(block: BotBlock): string {
  try {
    return JSON.stringify(block.input ?? {}, null, 1)
  } catch {
    return String(block.input)
  }
}
</script>

<style scoped>
.ctv-bot-md :deep(p) {
  margin: 0 0 0.5em;
}
.ctv-bot-md :deep(p:last-child) {
  margin-bottom: 0;
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
</style>
