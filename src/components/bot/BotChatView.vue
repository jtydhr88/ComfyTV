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
          class="ctv:flex ctv:flex-col ctv:gap-1"
          :class="msg.role === 'user' ? 'ctv:items-end' : 'ctv:items-stretch'"
        >
          <template v-if="msg.role === 'user'">
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
          </template>
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
      <AssetPickerPopup
        v-if="pickerOpen"
        class="ctv:mb-1.5"
        :added-ids="pending.map(a => a.asset_id)"
        :media-types="['image', 'video', 'audio']"
        @select="addAsset"
        @close="pickerOpen = false"
      />
      <div
        class="ctv:flex ctv:flex-col ctv:gap-1.5 ctv:rounded-lg ctv:border ctv:border-border-subtle ctv:bg-secondary-background ctv:px-2 ctv:py-1.5 ctv:focus-within:border-border"
      >
        <div v-if="pending.length" class="ctv:flex ctv:flex-wrap ctv:gap-1.5">
          <div
            v-for="att in pending"
            :key="att.asset_id"
            class="ctv:group ctv:relative"
            :class="att.media_type === 'image' ? 'ctv:h-14 ctv:w-14' : ''"
          >
            <img
              v-if="att.media_type === 'image'"
              :src="att.url"
              :title="att.name"
              class="ctv:h-14 ctv:w-14 ctv:rounded-md ctv:border ctv:border-border-subtle ctv:object-cover"
            >
            <div
              v-else
              :title="att.name"
              class="ctv:flex ctv:h-14 ctv:max-w-36 ctv:items-center ctv:gap-1.5 ctv:rounded-md ctv:border ctv:border-border-subtle ctv:px-2"
            >
              <i
                class="pi ctv:shrink-0 ctv:text-sm ctv:text-muted-foreground"
                :class="att.media_type === 'video' ? 'pi-video' : 'pi-volume-up'"
              />
              <span class="ctv:truncate ctv:text-[11px]">{{ att.name }}</span>
            </div>
            <button
              class="ctv-bot-chip-x"
              :title="$t('bot.removeAttachment')"
              @click="removePending(att.asset_id)"
            >
              <i class="pi pi-times ctv:text-[9px]" />
            </button>
          </div>
          <div
            v-if="uploading"
            class="ctv:flex ctv:h-14 ctv:w-14 ctv:items-center ctv:justify-center ctv:rounded-md ctv:border ctv:border-dashed ctv:border-border-subtle"
          >
            <i class="pi pi-spin pi-spinner ctv:text-xs ctv:text-muted-foreground" />
          </div>
        </div>
        <textarea
          ref="input"
          v-model="draft"
          rows="1"
          class="ctv:max-h-40 ctv:w-full ctv:resize-none ctv:border-none ctv:bg-transparent ctv:text-sm ctv:text-base-foreground ctv:outline-none ctv:[font-family:inherit]"
          :placeholder="$t('bot.inputPlaceholder')"
          :disabled="store.busy"
          @input="autoGrow"
          @paste="onPaste"
          @keydown.enter.exact.prevent="submit"
        />
        <div class="ctv:flex ctv:items-center ctv:gap-1.5">
          <button
            class="ctv-bot-attach"
            :title="$t('bot.attachImage')"
            :disabled="store.busy || uploading"
            @click="filePicker?.click()"
          >
            <i class="pi pi-image ctv:text-xs" />
          </button>
          <button
            class="ctv-bot-attach"
            :class="pickerOpen ? 'ctv-bot-attach-active' : ''"
            :title="$t('bot.attachFromLibrary')"
            :disabled="store.busy"
            @click="togglePicker"
          >
            <i class="pi ctv:text-xs" :class="pickerOpen ? 'pi-times' : 'pi-images'" />
          </button>
          <input
            ref="filePicker"
            type="file"
            accept="image/*,video/*,audio/*"
            multiple
            class="ctv:hidden"
            @change="onPick"
          >
          <div class="ctv:flex-1" />
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
            :disabled="!draft.trim() && !pending.length"
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

import type { Asset } from '@/api/schemas'
import AssetPickerPopup from '@/components/stages/AssetPickerPopup.vue'
import BotMessageBlocks from '@/components/bot/BotMessageBlocks.vue'
import { importAssetFiles } from '@/composables/sidebar/assetImport'
import {
  toastLoaderUploadFailed,
  useLoaderFileDrop,
} from '@/composables/stages/useLoaderFileDrop'
import { useAssetStore } from '@/stores/assetStore'
import { type BotAttachment, type BotChatMessage, useBotStore } from '@/stores/botStore'

const store = useBotStore()
const draft = ref('')
const pending = ref<BotAttachment[]>([])
const uploading = ref(false)
const pickerOpen = ref(false)
const scroller = ref<HTMLElement | null>(null)
const input = ref<HTMLTextAreaElement | null>(null)
const filePicker = ref<HTMLInputElement | null>(null)

function userText(msg: BotChatMessage): string {
  return msg.blocks
    .filter(b => b.type === 'text')
    .map(b => b.text ?? '')
    .join('')
}

const ATTACHABLE = ['image', 'video', 'audio'] as const

function userMedia(msg: BotChatMessage): Array<{ type: string; url: string }> {
  return msg.blocks
    .filter(b => (ATTACHABLE as readonly string[]).includes(b.type) && b.url)
    .map(b => ({ type: b.type, url: b.url! }))
}

function addAsset(asset: Asset): void {
  if (!(ATTACHABLE as readonly string[]).includes(asset.media_type)) return
  if (pending.value.some(a => a.asset_id === asset.id)) return
  pending.value = [...pending.value, {
    asset_id: asset.id, url: asset.payload_url, name: asset.name,
    media_type: asset.media_type as BotAttachment['media_type'],
  }]
}

function removePending(assetId: number): void {
  pending.value = pending.value.filter(a => a.asset_id !== assetId)
}

function togglePicker(): void {
  pickerOpen.value = !pickerOpen.value
  if (pickerOpen.value) {
    const assets = useAssetStore()
    assets.ensureHydrated()
    assets.installWebSocketSync()
  }
}

async function importFiles(files: File[]): Promise<void> {
  uploading.value = true
  try {
    const created = await importAssetFiles(files)
    created.forEach(addAsset)
  } catch (e) {
    console.error('[ComfyTV/bot] attachment upload failed', e)
    toastLoaderUploadFailed(e)
  } finally {
    uploading.value = false
  }
}

const fileDrop = useLoaderFileDrop({
  kind: () => ['image', 'video', 'audio'],
  onAsset: addAsset,
  onFiles: importFiles,
})

function onPick(e: Event): void {
  const el = e.target as HTMLInputElement
  const files = Array.from(el.files ?? [])
  el.value = ''
  if (files.length) void importFiles(files)
}

function onPaste(e: ClipboardEvent): void {
  const files = Array.from(e.clipboardData?.files ?? [])
    .filter(f => ['image/', 'video/', 'audio/'].some(p => f.type.startsWith(p)))
  if (!files.length) return
  e.preventDefault()
  void importFiles(files)
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
  if ((!text && !pending.value.length) || store.busy || uploading.value) return
  const attachments = pending.value
  draft.value = ''
  pending.value = []
  await nextTick()
  autoGrow()
  await store.send(text, attachments)
  await nextTick()
  scrollToBottom(true)
}

watch(() => store.messages, async () => {
  await nextTick()
  scrollToBottom()
}, { deep: false })

watch(() => store.activeChatId, async () => {
  pending.value = []
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
  .ctv-bot-attach:hover:not(:disabled) {
    background: color-mix(in srgb, currentColor 12%, transparent);
  }
  .ctv-bot-chip-x:hover {
    filter: brightness(1.4);
  }
}
.ctv-bot-attach {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--p-text-muted-color, #9ca3af);
  cursor: pointer;
}
.ctv-bot-attach:disabled {
  opacity: 0.4;
  cursor: default;
}
.ctv-bot-attach-active {
  background: color-mix(in srgb, currentColor 14%, transparent);
  color: var(--input-text, #e0e0e0);
}
.ctv-bot-chip-x {
  position: absolute;
  top: -5px;
  right: -5px;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  border: none;
  border-radius: 999px;
  background: color-mix(in srgb, black 55%, transparent);
  color: white;
  cursor: pointer;
}
</style>
