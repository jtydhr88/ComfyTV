<template>
  <div class="ctv:flex ctv:flex-col ctv:gap-1.5">
    <div
      v-if="calls.length"
      class="ctv:rounded-md ctv:border ctv:border-border-subtle ctv:bg-secondary-background ctv:text-xs"
    >
      <button
        class="ctv:flex ctv:w-full ctv:items-center ctv:gap-1.5 ctv:border-none ctv:bg-transparent ctv:px-2 ctv:py-1.5 ctv:text-left ctv:text-muted-foreground ctv:cursor-pointer"
        @click="manualOpen = !drawerOpen"
      >
        <i class="pi ctv:text-[10px]" :class="drawerIcon" />
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
        <div
          v-for="call in calls"
          :key="call.key"
          class="ctv:rounded-md ctv:border ctv:border-border-subtle ctv:text-xs"
        >
          <button
            class="ctv:flex ctv:w-full ctv:items-center ctv:gap-1.5 ctv:border-none ctv:bg-transparent ctv:px-2 ctv:py-1.5 ctv:text-left ctv:cursor-pointer"
            :class="call.status === 'error' ? 'ctv:text-node-stroke-error' : 'ctv:text-muted-foreground'"
            @click="toggle(call.key)"
          >
            <i class="pi ctv:text-[10px]" :class="toolGlyph(call)" />
            <span class="ctv:truncate ctv:font-mono">{{ call.label }}</span>
            <span
              v-if="call.durationMs !== null"
              class="ctv:ml-auto ctv:shrink-0 ctv:font-mono ctv:text-[10px] ctv:opacity-70"
            >{{ formatDuration(call.durationMs) }}</span>
            <i
              class="pi ctv:shrink-0 ctv:text-[10px]"
              :class="[expanded.has(call.key) ? 'pi-chevron-up' : 'pi-chevron-down',
                       call.durationMs === null && 'ctv:ml-auto']"
            />
          </button>
          <div
            v-if="expanded.has(call.key)"
            class="ctv:border-t ctv:border-border-subtle"
          >
            <pre
              v-if="Object.keys(call.input).length"
              class="ctv:m-0 ctv:max-h-40 ctv:overflow-auto ctv:px-2 ctv:py-1.5 ctv:font-mono ctv:text-[11px] ctv:whitespace-pre-wrap ctv:break-all ctv:opacity-80"
            >{{ formatInput(call.input) }}</pre>
            <pre
              v-if="call.resultText !== null"
              class="ctv:m-0 ctv:max-h-40 ctv:overflow-auto ctv:border-t ctv:border-border-subtle ctv:px-2 ctv:py-1.5 ctv:font-mono ctv:text-[11px] ctv:whitespace-pre-wrap ctv:break-all"
            >{{ call.resultText || $t('bot.noResult') }}</pre>
          </div>
        </div>
      </div>
    </div>
    <template v-for="(block, i) in blocks" :key="i">
      <BotMarkdown
        v-if="block.type === 'text' && (block.text ?? '').trim()"
        :text="block.text ?? ''"
      />
      <BotMediaGroup
        v-else-if="isMediaBlock(block) && block.url"
        :refs="[{ kind: block.type as 'image' | 'video' | 'audio', url: block.url }]"
      />
      <BotAskCard v-else-if="block.type === 'ask'" :block="block" />
      <div
        v-else-if="block.type === 'notice'"
        class="ctv:flex ctv:items-start ctv:gap-1.5 ctv:rounded-md ctv:border ctv:px-2.5 ctv:py-1.5 ctv:text-xs"
        :class="block.level === 'error'
          ? 'ctv:border-node-stroke-error/40 ctv:text-node-stroke-error'
          : 'ctv:border-border-subtle ctv:text-muted-foreground'"
      >
        <i
          class="pi ctv:mt-0.5 ctv:text-[10px]"
          :class="block.level === 'error' ? 'pi-exclamation-triangle' : 'pi-info-circle'"
        />
        <span class="ctv:break-words ctv:whitespace-pre-wrap">{{ block.text }}</span>
      </div>
    </template>
    <div
      v-if="usageLabel"
      class="ctv:font-mono ctv:text-[10px] ctv:text-muted-foreground ctv:opacity-70"
    >
      {{ usageLabel }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import BotAskCard from '@/components/bot/BotAskCard.vue'
import BotMarkdown from '@/components/bot/BotMarkdown.vue'
import BotMediaGroup from '@/components/bot/BotMediaGroup.vue'
import type { BotBlock, BotUsage } from '@/stores/botStore'
import { formatDuration } from '@/utils/mediaFormat'
import {
  pairToolCalls,
  toolGlyph,
} from '@/utils/toolCalls'

const props = defineProps<{
  blocks: BotBlock[]
  streaming?: boolean
  usage?: BotUsage | null
}>()

const { t } = useI18n()

const manualOpen = ref<boolean | null>(null)
const expanded = ref<Set<string>>(new Set())

const calls = computed(() =>
  pairToolCalls(props.blocks, props.streaming === true))

const autoOpen = computed(() =>
  calls.value.some(c => c.status === 'running' || c.status === 'error'))
const drawerOpen = computed(() => manualOpen.value ?? autoOpen.value)

const drawerIcon = computed(() => {
  if (calls.value.some(c => c.status === 'running')) return 'pi-spin pi-spinner'
  if (calls.value.some(c => c.status === 'error')) return 'pi-times-circle'
  return 'pi-wrench'
})

const drawerLabel = computed(() => {
  const all = calls.value
  const running = all.find(c => c.status === 'running')
  if (running) return `${all.length} · ${running.label}…`
  const base = t('bot.activitySteps', { n: all.length })
  const totalMs = all.reduce((sum, c) => sum + (c.durationMs ?? 0), 0)
  return totalMs > 0 ? `${base} · ${formatDuration(totalMs)}` : base
})

const usageLabel = computed(() => {
  const usage = props.usage
  if (!usage || props.streaming) return ''
  const parts: string[] = []
  if (usage.input_tokens) parts.push(`${formatTokens(usage.input_tokens)} in`)
  if (usage.output_tokens) parts.push(`${formatTokens(usage.output_tokens)} out`)
  if (usage.cost_usd) parts.push(`$${usage.cost_usd.toFixed(4)}`)
  return parts.join(' · ')
})

function formatTokens(n: number): string {
  return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n)
}

function toggle(key: string) {
  const next = new Set(expanded.value)
  if (next.has(key)) next.delete(key)
  else next.add(key)
  expanded.value = next
}

function formatInput(input: Record<string, unknown>): string {
  try {
    return JSON.stringify(input, null, 1)
  } catch {
    return String(input)
  }
}

function isMediaBlock(block: BotBlock): boolean {
  return block.type === 'image' || block.type === 'video'
    || block.type === 'audio'
}
</script>
