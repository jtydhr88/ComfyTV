<template>
  <div
    class="ctv:relative ctv:flex ctv:flex-col ctv:flex-1 ctv:min-h-0"
    @dragenter="fileDrop.onDragEnter"
    @dragover="fileDrop.onDragOver"
    @dragleave="fileDrop.onDragLeave"
    @drop="fileDrop.onDrop"
  >
    <div
      v-if="fileDrop.dragActive.value"
      class="ctv:pointer-events-none ctv:absolute ctv:inset-1 ctv:z-10 ctv:flex ctv:items-center ctv:justify-center ctv:rounded-xl ctv:border-2 ctv:border-dashed ctv:border-border ctv:bg-secondary-background/80 ctv:text-sm ctv:text-muted-foreground"
    >
      {{ $t('bot.dropHint') }}
    </div>

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
          class="ctv-bot-msg ctv:flex ctv:flex-col ctv:gap-1"
          :class="msg.role === 'user' ? 'ctv:items-end' : 'ctv:items-stretch'"
        >
          <template v-if="msg.role === 'user'">
            <div
              v-if="userRefs(msg).length"
              class="ctv:flex ctv:max-w-[85%] ctv:flex-wrap ctv:justify-end ctv:gap-1"
            >
              <span
                v-for="(r, i) in userRefs(msg)"
                :key="i"
                class="ctv:inline-flex ctv:items-center ctv:gap-1 ctv:rounded-full ctv:border ctv:border-border-subtle ctv:bg-secondary-background ctv:px-2 ctv:py-0.5 ctv:text-2xs ctv:text-muted-foreground"
              >
                <i class="pi ctv:text-[9px]" :class="refIcon(r)" />
                @{{ refLabel(r) }}
              </span>
            </div>
            <div
              v-if="userSkill(msg)"
              class="ctv:inline-flex ctv:items-center ctv:gap-1 ctv:rounded-full ctv:border ctv:border-border-subtle ctv:bg-secondary-background ctv:px-2 ctv:py-0.5 ctv:text-2xs ctv:font-mono ctv:text-muted-foreground"
            >
              <i class="pi pi-bolt ctv:text-[9px]" />
              /{{ userSkill(msg) }}
            </div>
            <div
              v-if="userMedia(msg).length"
              class="ctv:flex ctv:max-w-[85%] ctv:flex-wrap ctv:justify-end ctv:gap-1"
            >
              <template v-for="(m, i) in userMedia(msg)" :key="i">
                <img
                  v-if="m.type === 'image'"
                  :src="m.url"
                  class="ctv:h-20 ctv:max-w-40 ctv:rounded-lg ctv:border ctv:border-border-subtle ctv:object-cover"
                >
                <video
                  v-else-if="m.type === 'video'"
                  :src="m.url"
                  controls
                  preload="metadata"
                  class="ctv:h-28 ctv:max-w-full ctv:rounded-lg ctv:border ctv:border-border-subtle"
                />
                <audio
                  v-else
                  :src="m.url"
                  controls
                  preload="metadata"
                  class="ctv:h-9 ctv:w-60 ctv:max-w-full"
                />
              </template>
            </div>
            <div
              v-if="userText(msg)"
              class="ctv:max-w-[85%] ctv:rounded-xl ctv:rounded-br-sm ctv:bg-interface-menu-component-surface-hovered ctv:px-3 ctv:py-2 ctv:text-sm ctv:whitespace-pre-wrap ctv:break-words"
            >{{ userText(msg) }}</div>
            <div
              v-if="msg.status === 'queued'"
              class="ctv:flex ctv:items-center ctv:gap-1 ctv:text-2xs ctv:text-muted-foreground ctv:italic"
            >
              <i class="pi pi-clock ctv:text-[9px]" />
              {{ $t('bot.queuedHint') }}
            </div>
          </template>
          <template v-else>
            <BotMessageBlocks
              :blocks="msg.blocks"
              :streaming="msg.status === 'streaming'"
              :usage="msg.usage"
            />
            <button
              v-if="msg.status === 'done' && !store.busy"
              class="ctv-bot-branch ctv:self-start ctv:flex ctv:cursor-pointer ctv:items-center ctv:gap-1 ctv:rounded-md ctv:border-none ctv:bg-transparent ctv:p-0.5 ctv:text-2xs ctv:text-muted-foreground ctv:opacity-0"
              :title="$t('bot.branchFrom')"
              @click="store.branchChat(msg.id)"
            >
              <i class="pi pi-share-alt ctv:text-[9px]" />
              {{ $t('bot.branch') }}
            </button>
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

    <BotComposer ref="composer" @sent="onSent" />
  </div>
</template>

<script setup lang="ts">
import { nextTick, onMounted, ref, watch } from 'vue'

import type { Asset } from '@/api/schemas'
import BotComposer from '@/components/bot/BotComposer.vue'
import BotMessageBlocks from '@/components/bot/BotMessageBlocks.vue'
import { useLoaderFileDrop } from '@/composables/stages/useLoaderFileDrop'
import { type BotChatMessage, useBotStore } from '@/stores/botStore'
import { type BotRef, refIcon, refLabel } from '@/utils/botRefs'

const store = useBotStore()
const scroller = ref<HTMLElement | null>(null)
const composer = ref<InstanceType<typeof BotComposer> | null>(null)

function userText(msg: BotChatMessage): string {
  return msg.blocks
    .filter(b => b.type === 'text')
    .map(b => b.text ?? '')
    .join('')
}

function userSkill(msg: BotChatMessage): string {
  return msg.blocks.find(b => b.type === 'skill')?.name ?? ''
}

const ATTACHABLE = ['image', 'video', 'audio'] as const

function userMedia(msg: BotChatMessage): Array<{ type: string; url: string }> {
  return msg.blocks
    .filter(b => (ATTACHABLE as readonly string[]).includes(b.type) && b.url)
    .map(b => ({ type: b.type, url: b.url! }))
}

function userRefs(msg: BotChatMessage): BotRef[] {
  return msg.blocks.filter(b => b.type === 'ref') as BotRef[]
}

const fileDrop = useLoaderFileDrop({
  kind: () => ['image', 'video', 'audio'],
  onAsset: (asset: Asset) => composer.value?.addAsset(asset),
  onFiles: (files: File[]) => void composer.value?.importFiles(files),
})

function scrollToBottom(force = false) {
  const el = scroller.value
  if (!el) return
  const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80
  if (force || nearBottom) el.scrollTop = el.scrollHeight
}

async function onSent() {
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
.ctv-bot-msg:hover .ctv-bot-branch,
.ctv-bot-branch:focus-visible {
  opacity: 1;
}
</style>
