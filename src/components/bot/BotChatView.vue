<template>
  <div class="ctv:flex ctv:flex-col ctv:flex-1 ctv:min-h-0">
    <div
      ref="scroller"
      class="ctv:flex-1 ctv:min-h-0 ctv:overflow-y-auto ctv:px-3 ctv:py-3"
    >
      <div
        v-if="!store.messages.length && !store.loading"
        class="ctv:flex ctv:h-full ctv:items-center ctv:justify-center ctv:text-sm ctv:text-muted-foreground"
      >
        {{ $t('bot.emptyChat') }}
      </div>
      <div class="ctv:flex ctv:flex-col ctv:gap-3">
        <div
          v-for="msg in store.messages"
          :key="msg.id"
          class="ctv:flex ctv:flex-col ctv:gap-1"
          :class="msg.role === 'user' ? 'ctv:items-end' : 'ctv:items-stretch'"
        >
          <div
            v-if="msg.role === 'user'"
            class="ctv:max-w-[85%] ctv:rounded-xl ctv:rounded-br-sm ctv:bg-interface-menu-component-surface-hovered ctv:px-3 ctv:py-2 ctv:text-sm ctv:whitespace-pre-wrap ctv:break-words"
          >{{ userText(msg) }}</div>
          <template v-else>
            <BotMessageBlocks :blocks="msg.blocks" />
            <div
              v-if="msg.status === 'streaming'"
              class="ctv:flex ctv:items-center ctv:gap-1.5 ctv:text-xs ctv:text-muted-foreground"
            >
              <i class="pi pi-spin pi-spinner ctv:text-[11px]" />
              {{ $t('bot.thinking') }}
            </div>
            <div
              v-else-if="msg.status === 'aborted'"
              class="ctv:text-xs ctv:text-muted-foreground ctv:italic"
            >
              {{ $t('bot.aborted') }}
            </div>
            <div
              v-else-if="msg.status === 'error'"
              class="ctv:text-xs ctv:text-node-stroke-error"
            >
              {{ $t('bot.turnError') }}
            </div>
          </template>
        </div>
      </div>
    </div>

    <div class="ctv:shrink-0 ctv:border-t ctv:border-border-subtle ctv:p-2">
      <div
        class="ctv:flex ctv:flex-col ctv:gap-1.5 ctv:rounded-lg ctv:border ctv:border-border-subtle ctv:bg-secondary-background ctv:px-2 ctv:py-1.5 ctv:focus-within:border-border"
      >
        <textarea
          ref="input"
          v-model="draft"
          rows="1"
          class="ctv:max-h-40 ctv:w-full ctv:resize-none ctv:border-none ctv:bg-transparent ctv:text-sm ctv:text-base-foreground ctv:outline-none ctv:[font-family:inherit]"
          :placeholder="$t('bot.inputPlaceholder')"
          :disabled="store.busy"
          @input="autoGrow"
          @keydown.enter.exact.prevent="submit"
        />
        <div class="ctv:flex ctv:items-center ctv:justify-end ctv:gap-1.5">
          <button
            v-if="store.busy"
            class="ctv-bot-send ctv:flex ctv:items-center ctv:gap-1 ctv:rounded-md ctv:border-none ctv:bg-node-stroke-error/80 ctv:px-2.5 ctv:py-1 ctv:text-xs ctv:text-white ctv:cursor-pointer"
            @click="store.stop()"
          >
            <i class="pi pi-stop-circle ctv:text-[11px]" />
            {{ $t('bot.stop') }}
          </button>
          <button
            v-else
            class="ctv-bot-send ctv:flex ctv:items-center ctv:gap-1 ctv:rounded-md ctv:border-none ctv:bg-interface-menu-component-surface-hovered ctv:px-2.5 ctv:py-1 ctv:text-xs ctv:text-base-foreground ctv:cursor-pointer ctv:disabled:opacity-40 ctv:disabled:cursor-default"
            :disabled="!draft.trim()"
            @click="submit"
          >
            <i class="pi pi-send ctv:text-[11px]" />
            {{ $t('bot.send') }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { nextTick, onMounted, ref, watch } from 'vue'

import BotMessageBlocks from '@/components/bot/BotMessageBlocks.vue'
import { type BotChatMessage, useBotStore } from '@/stores/botStore'

const store = useBotStore()
const draft = ref('')
const scroller = ref<HTMLElement | null>(null)
const input = ref<HTMLTextAreaElement | null>(null)

function userText(msg: BotChatMessage): string {
  return msg.blocks.map(b => b.text ?? '').join('')
}

function autoGrow() {
  const el = input.value
  if (!el) return
  el.style.height = 'auto'
  el.style.height = `${Math.min(el.scrollHeight, 160)}px`
}

function scrollToBottom(force = false) {
  const el = scroller.value
  if (!el) return
  const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80
  if (force || nearBottom) el.scrollTop = el.scrollHeight
}

async function submit() {
  const text = draft.value.trim()
  if (!text || store.busy) return
  draft.value = ''
  await nextTick()
  autoGrow()
  await store.send(text)
  await nextTick()
  scrollToBottom(true)
}

watch(() => store.messages, async () => {
  await nextTick()
  scrollToBottom()
}, { deep: false })

watch(() => store.activeChatId, async () => {
  await nextTick()
  scrollToBottom(true)
})

onMounted(async () => {
  await nextTick()
  scrollToBottom(true)
})
</script>

<style scoped>
@media (hover: hover) {
  .ctv-bot-send:hover:not(:disabled) {
    filter: brightness(1.15);
  }
}
</style>
