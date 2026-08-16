<template>
  <div class="ctv:flex ctv:flex-col ctv:gap-1.5">
    <div
      v-if="activity.length"
      class="ctv:rounded-md ctv:border ctv:border-border-subtle ctv:bg-secondary-background ctv:text-xs"
    >
      <button
        class="ctv:flex ctv:w-full ctv:items-center ctv:gap-1.5 ctv:border-none ctv:bg-transparent ctv:px-2 ctv:py-1.5 ctv:text-left ctv:text-muted-foreground ctv:cursor-pointer"
        @click="drawerOpen = !drawerOpen"
      >
        <i
          v-if="streaming && !drawerOpen"
          class="pi pi-spin pi-spinner ctv:text-[10px]"
        />
        <i v-else class="pi pi-wrench ctv:text-[10px]" />
        <span class="ctv:truncate ctv:font-mono">{{ drawerLabel }}</span>
        <i
          class="pi ctv:ml-auto ctv:text-[10px]"
          :class="drawerOpen ? 'pi-chevron-up' : 'pi-chevron-down'"
        />
      </button>
      <div
        v-if="drawerOpen"
        class="ctv:flex ctv:flex-col ctv:gap-1 ctv:border-t ctv:border-border-subtle ctv:p-1.5"
      >
        <template v-for="entry in activity" :key="entry.index">
          <div
            v-if="entry.block.type === 'tool_use'"
            class="ctv:rounded-md ctv:border ctv:border-border-subtle ctv:text-xs"
          >
            <button
              class="ctv:flex ctv:w-full ctv:items-center ctv:gap-1.5 ctv:border-none ctv:bg-transparent ctv:px-2 ctv:py-1.5 ctv:text-left ctv:text-muted-foreground ctv:cursor-pointer"
              @click="toggle(entry.index)"
            >
              <i class="pi pi-wrench ctv:text-[10px]" />
              <span class="ctv:truncate ctv:font-mono">{{ toolLabel(entry.block) }}</span>
              <i
                class="pi ctv:ml-auto ctv:text-[10px]"
                :class="expanded.has(entry.index) ? 'pi-chevron-up' : 'pi-chevron-down'"
              />
            </button>
            <pre
              v-if="expanded.has(entry.index)"
              class="ctv:m-0 ctv:max-h-40 ctv:overflow-auto ctv:border-t ctv:border-border-subtle ctv:px-2 ctv:py-1.5 ctv:font-mono ctv:text-[11px] ctv:whitespace-pre-wrap ctv:break-all"
            >{{ formatInput(entry.block) }}</pre>
          </div>
          <div
            v-else
            class="ctv:rounded-md ctv:border ctv:border-border-subtle ctv:text-xs"
          >
            <button
              class="ctv:flex ctv:w-full ctv:items-center ctv:gap-1.5 ctv:border-none ctv:bg-transparent ctv:px-2 ctv:py-1.5 ctv:text-left ctv:text-muted-foreground ctv:cursor-pointer"
              @click="toggle(entry.index)"
            >
              <i class="pi pi-reply ctv:text-[10px]" />
              <span class="ctv:truncate">{{ $t('bot.toolResult') }}</span>
              <i
                class="pi ctv:ml-auto ctv:text-[10px]"
                :class="expanded.has(entry.index) ? 'pi-chevron-up' : 'pi-chevron-down'"
              />
            </button>
            <pre
              v-if="expanded.has(entry.index)"
              class="ctv:m-0 ctv:max-h-40 ctv:overflow-auto ctv:border-t ctv:border-border-subtle ctv:px-2 ctv:py-1.5 ctv:font-mono ctv:text-[11px] ctv:whitespace-pre-wrap ctv:break-all"
            >{{ entry.block.text }}</pre>
          </div>
        </template>
      </div>
    </div>
    <template v-for="(block, i) in blocks" :key="i">
      <div
        v-if="block.type === 'text' && (block.text ?? '').trim()"
        class="ctv-bot-md ctv:text-sm ctv:leading-relaxed ctv:break-words"
        v-html="renderMarkdownToHtml(block.text ?? '')"
      />
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import type { BotBlock } from '@/stores/botStore'
import { renderMarkdownToHtml } from '@/utils/markdown'

const props = defineProps<{ blocks: BotBlock[]; streaming?: boolean }>()

const { t } = useI18n()

const drawerOpen = ref(false)
const expanded = ref<Set<number>>(new Set())

const activity = computed(() =>
  props.blocks
    .map((block, index) => ({ block, index }))
    .filter(({ block }) => block.type === 'tool_use' || block.type === 'tool_result'),
)

const drawerLabel = computed(() => {
  const steps = activity.value
  if (props.streaming && !drawerOpen.value) {
    const last = steps[steps.length - 1]
    const name = toolLabel(last.block) || t('bot.toolResult')
    const suffix = last.block.type === 'tool_use' ? '…' : ' ✓'
    return `${steps.length} · ${name}${suffix}`
  }
  return t('bot.activitySteps', { n: steps.length })
})

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
