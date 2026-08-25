<template>
  <div class="ctv:flex ctv:flex-col ctv:size-full ctv:overflow-hidden ctv:text-base-foreground">
    <div
      v-if="!store.availableProviders.length"
      class="ctv:flex ctv:flex-1 ctv:flex-col ctv:items-center ctv:justify-center ctv:gap-3 ctv:px-6 ctv:text-center"
    >
      <i class="pi pi-sparkles ctv:text-2xl ctv:text-muted-foreground" />
      <div class="ctv:text-sm ctv:font-semibold">{{ $t('bot.noProviderTitle') }}</div>
      <div class="ctv:text-xs ctv:text-muted-foreground ctv:leading-relaxed">
        {{ $t('bot.noProviderBody') }}
      </div>
      <code class="ctv:rounded ctv:bg-secondary-background ctv:px-2 ctv:py-1 ctv:text-xs">npm install -g {{ '@' }}anthropic-ai/claude-code</code>
      <button
        class="ctv:mt-1 ctv:rounded-md ctv:border ctv:border-border-subtle ctv:bg-transparent ctv:px-3 ctv:py-1.5 ctv:text-xs ctv:text-base-foreground ctv:cursor-pointer"
        @click="store.refreshStatus()"
      >
        {{ $t('bot.recheck') }}
      </button>
    </div>

    <template v-else-if="store.activeChatId">
      <div class="ctv:flex ctv:shrink-0 ctv:items-center ctv:gap-1.5 ctv:border-b ctv:border-border-subtle ctv:px-2 ctv:py-1.5">
        <button
          class="ctv-bot-iconbtn"
          :title="$t('bot.backToList')"
          @click="store.closeChat()"
        >
          <i class="pi pi-arrow-left ctv:text-xs" />
        </button>
        <span class="ctv:flex-1 ctv:truncate ctv:text-sm ctv:font-semibold">
          {{ store.activeChat?.title || $t('bot.untitled') }}
        </span>
        <button
          class="ctv-bot-iconbtn"
          :title="$t('bot.newChat')"
          @click="openNew()"
        >
          <i class="pi pi-plus ctv:text-xs" />
        </button>
      </div>
      <div
        v-if="providerMenuOpen"
        class="ctv:flex ctv:shrink-0 ctv:items-center ctv:gap-1.5 ctv:border-b ctv:border-border-subtle ctv:px-3 ctv:py-1.5"
      >
        <span class="ctv:text-xs ctv:text-muted-foreground">{{ $t('bot.newChatWith') }}</span>
        <button
          v-for="p in store.availableProviders"
          :key="p.id"
          class="ctv:rounded-md ctv:border ctv:border-border-subtle ctv:bg-transparent ctv:px-2 ctv:py-0.5 ctv:text-xs ctv:text-base-foreground ctv:cursor-pointer"
          @click="openNew(p.id)"
        >{{ p.label }}</button>
        <button class="ctv-bot-iconbtn ctv:ml-auto" @click="providerMenuOpen = false">
          <i class="pi pi-times ctv:text-[10px]" />
        </button>
      </div>
      <BotChatView />
    </template>

    <template v-else>
      <div
        v-if="selectMode"
        class="ctv:flex ctv:shrink-0 ctv:items-center ctv:gap-2 ctv:border-b ctv:border-border-subtle ctv:px-3 ctv:py-2"
      >
        <input
          type="checkbox"
          class="ctv:m-0 ctv:cursor-pointer"
          :checked="allSelected"
          :title="$t('bot.selectAll')"
          @change="toggleSelectAll"
        />
        <span class="ctv:flex-1 ctv:text-sm">
          {{ $t('bot.selectedCount', { count: selectedIds.size }) }}
        </span>
        <button
          class="ctv-bot-iconbtn"
          :disabled="!selectedIds.size"
          :class="{ 'ctv:opacity-40 ctv:cursor-default': !selectedIds.size }"
          :title="$t('bot.deleteSelected')"
          @click="confirmDeleteSelected()"
        >
          <i class="pi pi-trash ctv:text-xs" />
        </button>
        <button
          class="ctv-bot-iconbtn"
          :title="$t('bot.cancelSelect')"
          @click="exitSelectMode()"
        >
          <i class="pi pi-times ctv:text-xs" />
        </button>
      </div>
      <div
        v-else
        class="ctv:flex ctv:shrink-0 ctv:items-center ctv:gap-1.5 ctv:border-b ctv:border-border-subtle ctv:px-3 ctv:py-2"
      >
        <span class="ctv:flex-1 ctv:text-sm ctv:font-semibold">{{ $t('bot.title') }}</span>
        <button
          v-if="store.chats.length"
          class="ctv-bot-iconbtn"
          :title="$t('bot.multiSelect')"
          @click="selectMode = true"
        >
          <i class="pi pi-check-square ctv:text-xs" />
        </button>
        <button
          class="ctv-bot-iconbtn"
          :title="$t('bot.newChat')"
          @click="openNew()"
        >
          <i class="pi pi-plus ctv:text-xs" />
        </button>
      </div>
      <div
        v-if="providerMenuOpen"
        class="ctv:flex ctv:shrink-0 ctv:items-center ctv:gap-1.5 ctv:border-b ctv:border-border-subtle ctv:px-3 ctv:py-1.5"
      >
        <span class="ctv:text-xs ctv:text-muted-foreground">{{ $t('bot.newChatWith') }}</span>
        <button
          v-for="p in store.availableProviders"
          :key="p.id"
          class="ctv:rounded-md ctv:border ctv:border-border-subtle ctv:bg-transparent ctv:px-2 ctv:py-0.5 ctv:text-xs ctv:text-base-foreground ctv:cursor-pointer"
          @click="openNew(p.id)"
        >{{ p.label }}</button>
        <button class="ctv-bot-iconbtn ctv:ml-auto" @click="providerMenuOpen = false">
          <i class="pi pi-times ctv:text-[10px]" />
        </button>
      </div>
      <div class="ctv:flex-1 ctv:min-h-0 ctv:overflow-y-auto">
        <div
          v-if="!store.chats.length"
          class="ctv:flex ctv:h-full ctv:flex-col ctv:items-center ctv:justify-center ctv:gap-2 ctv:px-6 ctv:text-center"
        >
          <div class="ctv:text-xs ctv:text-muted-foreground">{{ $t('bot.noChats') }}</div>
          <button
            class="ctv:rounded-md ctv:border ctv:border-border-subtle ctv:bg-transparent ctv:px-3 ctv:py-1.5 ctv:text-xs ctv:text-base-foreground ctv:cursor-pointer"
            @click="openNew()"
          >
            {{ $t('bot.startFirst') }}
          </button>
        </div>
        <div
          v-for="chat in store.chats"
          :key="chat.id"
          class="ctv-bot-row ctv:group ctv:flex ctv:cursor-pointer ctv:items-center ctv:gap-2 ctv:border-b ctv:border-border-subtle ctv:px-3 ctv:py-2"
          @click="selectMode ? toggleSelected(chat.id) : store.openChat(chat.id)"
        >
          <input
            v-if="selectMode"
            type="checkbox"
            class="ctv:m-0 ctv:shrink-0 ctv:cursor-pointer"
            :checked="selectedIds.has(chat.id)"
            @click.stop="toggleSelected(chat.id)"
          />
          <i
            v-else
            class="pi ctv:text-xs"
            :class="chat.busy ? 'pi-spin pi-spinner' : (chat.pinned ? 'pi-star-fill ctv:text-amber-400' : 'pi-comment ctv:text-muted-foreground')"
          />
          <div class="ctv:flex ctv:min-w-0 ctv:flex-1 ctv:flex-col">
            <template v-if="renamingId === chat.id">
              <input
                :ref="el => renameInput = (el as HTMLInputElement | null)"
                v-model="renameDraft"
                class="ctv:w-full ctv:rounded ctv:border ctv:border-border-subtle ctv:bg-secondary-background ctv:px-1.5 ctv:py-0.5 ctv:text-sm ctv:text-base-foreground ctv:outline-none"
                @click.stop
                @keydown.enter.prevent="commitRename(chat.id)"
                @keydown.esc.prevent="renamingId = null"
                @blur="commitRename(chat.id)"
              />
            </template>
            <span v-else class="ctv:truncate ctv:text-sm">
              {{ chat.title || $t('bot.untitled') }}
            </span>
            <span class="ctv:truncate ctv:text-[11px] ctv:text-muted-foreground">
              {{ formatTime(chat.updated_at) }}
            </span>
          </div>
          <div v-if="!selectMode" class="ctv-bot-row-actions ctv:flex ctv:shrink-0 ctv:gap-0.5">
            <button
              class="ctv-bot-iconbtn"
              :title="$t('bot.rename')"
              @click.stop="startRename(chat)"
            >
              <i class="pi pi-pencil ctv:text-[11px]" />
            </button>
            <button
              class="ctv-bot-iconbtn"
              :title="chat.pinned ? $t('bot.unpin') : $t('bot.pin')"
              @click.stop="store.togglePinned(chat)"
            >
              <i class="pi ctv:text-[11px]" :class="chat.pinned ? 'pi-star-fill' : 'pi-star'" />
            </button>
            <button
              class="ctv-bot-iconbtn"
              :title="$t('bot.delete')"
              @click.stop="confirmDelete(chat)"
            >
              <i class="pi pi-trash ctv:text-[11px]" />
            </button>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import BotChatView from '@/components/bot/BotChatView.vue'
import { type BotChat } from '@/api/schemas'
import { useBotStore } from '@/stores/botStore'

const store = useBotStore()
const { t } = useI18n()

const renamingId = ref<string | null>(null)
const renameDraft = ref('')
const renameInput = ref<HTMLInputElement | null>(null)

onMounted(() => {
  void store.ensureHydrated()
})

const providerMenuOpen = ref(false)

async function openNew(providerId?: string) {
  providerMenuOpen.value = false
  if (providerId === undefined && store.availableProviders.length > 1) {
    providerMenuOpen.value = true
    return
  }
  await store.newChat(providerId)
}

function startRename(chat: BotChat) {
  renamingId.value = chat.id
  renameDraft.value = chat.title
  void nextTick(() => renameInput.value?.focus())
}

function commitRename(chatId: string) {
  if (renamingId.value !== chatId) return
  const title = renameDraft.value.trim()
  renamingId.value = null
  if (title) void store.renameChat(chatId, title)
}

function confirmDelete(chat: BotChat) {
  if (window.confirm(t('bot.deleteConfirm', { title: chat.title || t('bot.untitled') }))) {
    void store.deleteChat(chat.id)
  }
}

const selectMode = ref(false)
const selectedIds = ref(new Set<string>())

const allSelected = computed(() =>
  store.chats.length > 0 && store.chats.every(c => selectedIds.value.has(c.id)))

function toggleSelected(chatId: string) {
  const next = new Set(selectedIds.value)
  if (next.has(chatId)) next.delete(chatId)
  else next.add(chatId)
  selectedIds.value = next
}

function toggleSelectAll() {
  selectedIds.value = allSelected.value
    ? new Set()
    : new Set(store.chats.map(c => c.id))
}

function exitSelectMode() {
  selectMode.value = false
  selectedIds.value = new Set()
}

async function confirmDeleteSelected() {
  const ids = store.chats.filter(c => selectedIds.value.has(c.id)).map(c => c.id)
  if (!ids.length) return
  if (!window.confirm(t('bot.batchDeleteConfirm', { count: ids.length }))) return
  await store.deleteChats(ids)
  exitSelectMode()
}

function formatTime(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleString(undefined, {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}
</script>

<style scoped>
.ctv-bot-iconbtn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--p-text-muted-color, #9ca3af);
  cursor: pointer;
}
.ctv-bot-row-actions {
  opacity: 0;
}
@media (hover: hover) {
  .ctv-bot-iconbtn:hover {
    background: color-mix(in srgb, currentColor 12%, transparent);
  }
  .ctv-bot-row:hover {
    background: color-mix(in srgb, currentColor 4%, transparent);
  }
  .ctv-bot-row:hover .ctv-bot-row-actions {
    opacity: 1;
  }
}
@media (hover: none) {
  .ctv-bot-row-actions {
    opacity: 1;
  }
}
</style>
