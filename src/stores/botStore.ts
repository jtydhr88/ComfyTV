import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

import { apiFetch, apiSend } from '@/api'
import {
  type BotChat,
  type BotMessage,
  type BotProviderStatus,
  BotOkSchema,
  BotSendSchema,
  BotStatusSchema,
  GetBotChatSchema,
  ListBotChatsSchema,
  MutateBotChatSchema,
} from '@/api/schemas'
import { app } from '@/lib/comfyApp'
import {
  type BotAttachment,
  type BotChatMessage,
  applyDelta,
  parseBlocks,
  toChatMessage,
} from '@/utils/botMessages'
import type { BotRef } from '@/utils/botRefs'

export {
  applyDelta,
  parseBlocks,
  toChatMessage,
} from '@/utils/botMessages'
export type {
  BotAskOption,
  BotAttachment,
  BotBlock,
  BotChatMessage,
  BotUsage,
} from '@/utils/botMessages'

export const useBotStore = defineStore('bot', () => {
  const providers = ref<BotProviderStatus[]>([])
  const enabled = ref(false)
  const chats = ref<BotChat[]>([])
  const activeChatId = ref<string | null>(null)
  const messages = ref<BotChatMessage[]>([])
  const loading = ref(false)

  let hydrated = false
  let wsInstalled = false

  const activeChat = computed(() =>
    chats.value.find(c => c.id === activeChatId.value) ?? null)
  const availableProviders = computed(() =>
    providers.value.filter(p => p.available))
  const busy = computed(() => activeChat.value?.busy === true)
  const activeProviderCaps = computed(() =>
    providers.value.find(p => p.id === activeChat.value?.provider) ?? null)
  const canAttach = computed(() =>
    activeProviderCaps.value?.attachments !== false)

  async function refreshStatus(): Promise<void> {
    try {
      const data = await apiFetch('/comfytv/bot/status', BotStatusSchema)
      providers.value = data.providers
      enabled.value = data.enabled !== false
    } catch (e) {
      console.warn('[ComfyTV/bot] status failed', e)
      providers.value = []
      enabled.value = false
    }
  }

  async function refreshChats(): Promise<void> {
    try {
      const data = await apiFetch('/comfytv/bot/chats', ListBotChatsSchema)
      chats.value = data.chats
    } catch (e) {
      console.warn('[ComfyTV/bot] chat list failed', e)
    }
  }

  async function ensureHydrated(): Promise<void> {
    installWebSocketSync()
    if (hydrated) return
    hydrated = true
    await Promise.all([refreshStatus(), refreshChats()])
  }

  async function openChat(chatId: string): Promise<void> {
    activeChatId.value = chatId
    loading.value = true
    try {
      const data = await apiFetch(`/comfytv/bot/chats/${chatId}`, GetBotChatSchema)
      if (activeChatId.value !== chatId) return
      messages.value = data.messages.map(toChatMessage)
      upsertChat(data.chat)
    } catch (e) {
      console.warn('[ComfyTV/bot] open chat failed', chatId, e)
    } finally {
      loading.value = false
    }
  }

  function closeChat(): void {
    activeChatId.value = null
    messages.value = []
  }

  async function newChat(providerId?: string): Promise<BotChat | null> {
    const provider = providerId
      ? availableProviders.value.find(p => p.id === providerId)
      : availableProviders.value[0]
    if (!provider) return null
    try {
      const data = await apiSend('/comfytv/bot/chats', 'POST',
        MutateBotChatSchema, { provider: provider.id })
      chats.value = [data.chat, ...chats.value]
      activeChatId.value = data.chat.id
      messages.value = []
      return data.chat
    } catch (e) {
      console.warn('[ComfyTV/bot] create chat failed', e)
      return null
    }
  }

  async function send(text: string, attachments: BotAttachment[] = [],
                      skill?: string, refs: BotRef[] = []): Promise<boolean> {
    const chatId = activeChatId.value
    if (!chatId || (!text.trim() && attachments.length === 0)) return false
    try {
      const data = await apiSend(`/comfytv/bot/chats/${chatId}/send`, 'POST',
        BotSendSchema, {
          text,
          ...(attachments.length
            ? { attachments: attachments.map(a => ({ asset_id: a.asset_id })) }
            : {}),
          ...(skill ? { skill } : {}),
          ...(refs.length ? { refs } : {}),
        })
      if (activeChatId.value === chatId) {
        const ids = new Set(messages.value.map(m => m.id))
        const additions = [data.user_message, data.assistant_message]
          .filter((m): m is BotMessage => !!m && !ids.has(m.id))
          .map(toChatMessage)
        if (additions.length) messages.value = [...messages.value, ...additions]
      }
      if (!data.queued) setChatBusy(chatId, true)
      return true
    } catch (e) {
      console.warn('[ComfyTV/bot] send failed', e)
      return false
    }
  }

  async function stop(): Promise<void> {
    const chatId = activeChatId.value
    if (!chatId) return
    try {
      await apiSend(`/comfytv/bot/chats/${chatId}/stop`, 'POST', BotOkSchema)
    } catch (e) {
      console.warn('[ComfyTV/bot] stop failed', e)
    }
  }

  async function branchChat(messageId: string): Promise<boolean> {
    const chatId = activeChatId.value
    if (!chatId) return false
    try {
      const data = await apiSend(`/comfytv/bot/chats/${chatId}/branch`,
        'POST', GetBotChatSchema, { message_id: messageId })
      upsertChat(data.chat)
      activeChatId.value = data.chat.id
      messages.value = data.messages.map(toChatMessage)
      return true
    } catch (e) {
      console.warn('[ComfyTV/bot] branch failed', e)
      return false
    }
  }

  async function answerAsk(askId: string, selected: string[],
                           otherText = ''): Promise<boolean> {
    const chatId = activeChatId.value
    if (!chatId) return false
    try {
      await apiSend(`/comfytv/bot/chats/${chatId}/asks/${askId}/answer`,
        'POST', BotOkSchema, {
          selected,
          ...(otherText ? { other_text: otherText } : {}),
        })
      return true
    } catch (e) {
      console.warn('[ComfyTV/bot] answer ask failed', e)
      return false
    }
  }

  async function setRunMode(mode: 'auto' | 'ask'): Promise<void> {
    const chatId = activeChatId.value
    if (!chatId) return
    try {
      const data = await apiSend(`/comfytv/bot/chats/${chatId}`, 'PATCH',
        MutateBotChatSchema, { run_mode: mode })
      upsertChat(data.chat)
    } catch (e) {
      console.warn('[ComfyTV/bot] run mode update failed', e)
    }
  }

  async function renameChat(chatId: string, title: string): Promise<void> {
    try {
      const data = await apiSend(`/comfytv/bot/chats/${chatId}`, 'PATCH',
        MutateBotChatSchema, { title })
      upsertChat(data.chat)
    } catch (e) {
      console.warn('[ComfyTV/bot] rename failed', e)
    }
  }

  async function togglePinned(chat: BotChat): Promise<void> {
    try {
      const data = await apiSend(`/comfytv/bot/chats/${chat.id}`, 'PATCH',
        MutateBotChatSchema, { pinned: !chat.pinned })
      upsertChat(data.chat)
      sortChats()
    } catch (e) {
      console.warn('[ComfyTV/bot] pin failed', e)
    }
  }

  async function deleteChat(chatId: string): Promise<void> {
    try {
      await apiSend(`/comfytv/bot/chats/${chatId}`, 'DELETE', BotOkSchema)
      chats.value = chats.value.filter(c => c.id !== chatId)
      if (activeChatId.value === chatId) closeChat()
    } catch (e) {
      console.warn('[ComfyTV/bot] delete failed', e)
    }
  }

  async function deleteChats(chatIds: string[]): Promise<void> {
    const results = await Promise.allSettled(chatIds.map(id =>
      apiSend(`/comfytv/bot/chats/${id}`, 'DELETE', BotOkSchema)))
    const deleted = new Set(
      chatIds.filter((_, i) => results[i].status === 'fulfilled'))
    if (deleted.size) {
      chats.value = chats.value.filter(c => !deleted.has(c.id))
      if (activeChatId.value && deleted.has(activeChatId.value)) closeChat()
    }
    const failed = results.filter(r => r.status === 'rejected')
    if (failed.length) {
      console.warn('[ComfyTV/bot] batch delete failed for',
                   failed.length, 'chats', failed[0])
    }
  }

  function upsertChat(chat: BotChat): void {
    const idx = chats.value.findIndex(c => c.id === chat.id)
    if (idx >= 0) chats.value[idx] = { ...chats.value[idx], ...chat }
    else chats.value = [chat, ...chats.value]
  }

  function sortChats(): void {
    chats.value = [...chats.value].sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1
      return (b.updated_at ?? '').localeCompare(a.updated_at ?? '')
    })
  }

  function setChatBusy(chatId: string, value: boolean): void {
    const idx = chats.value.findIndex(c => c.id === chatId)
    if (idx >= 0) chats.value[idx] = { ...chats.value[idx], busy: value }
  }

  function findMessage(chatId: string, messageId: string): BotChatMessage | null {
    if (activeChatId.value !== chatId) return null
    return messages.value.find(m => m.id === messageId) ?? null
  }

  function handleBotEvent(detail: any): void {
    if (!detail || typeof detail !== 'object') return
    const event = detail.event
    if (event === 'chat_created' || event === 'chat_updated') {
      if (detail.chat) upsertChat(detail.chat)
      return
    }
    if (event === 'chat_deleted') {
      chats.value = chats.value.filter(c => c.id !== detail.chat_id)
      if (activeChatId.value === detail.chat_id) closeChat()
      return
    }
    if (event === 'turn_start') {
      setChatBusy(detail.chat_id, true)
      if (activeChatId.value === detail.chat_id && detail.assistant_message) {
        const byId = new Map(messages.value.map(m => [m.id, m]))
        let changed = false
        for (const raw of [detail.user_message, detail.assistant_message]) {
          if (!raw) continue
          const existing = byId.get(raw.id)
          if (existing) {
            if (existing.status !== raw.status) {
              existing.status = String(raw.status)
              changed = true
            }
          } else {
            messages.value = [...messages.value, toChatMessage(raw)]
            changed = false
          }
        }
        if (changed) messages.value = [...messages.value]
      }
      return
    }
    if (event === 'message_queued') {
      if (activeChatId.value === detail.chat_id && detail.user_message) {
        const ids = new Set(messages.value.map(m => m.id))
        if (!ids.has(detail.user_message.id)) {
          messages.value = [...messages.value,
                            toChatMessage(detail.user_message)]
        }
      }
      return
    }
    if (event === 'turn_delta') {
      const msg = findMessage(detail.chat_id, detail.message_id)
      if (msg) {
        applyDelta(msg, String(detail.text ?? ''))
        messages.value = [...messages.value]
      }
      return
    }
    if (event === 'turn_tool_use') {
      const msg = findMessage(detail.chat_id, detail.message_id)
      if (msg) {
        msg.blocks.push({
          type: 'tool_use',
          name: String(detail.name ?? ''),
          input: detail.input ?? {},
          ...(detail.id ? { id: String(detail.id) } : {}),
        })
        messages.value = [...messages.value]
      }
      return
    }
    if (event === 'turn_tool_result') {
      const msg = findMessage(detail.chat_id, detail.message_id)
      if (msg) {
        msg.blocks.push({
          type: 'tool_result',
          name: String(detail.name ?? ''),
          text: String(detail.text ?? ''),
          status: detail.status === 'error' ? 'error' : 'success',
          ...(detail.id ? { id: String(detail.id) } : {}),
          ...(typeof detail.duration_ms === 'number'
            ? { duration_ms: detail.duration_ms } : {}),
        })
        messages.value = [...messages.value]
      }
      return
    }
    if (event === 'turn_ask') {
      const msg = findMessage(detail.chat_id, detail.message_id)
      if (msg && !msg.blocks.some(b => b.ask_id === detail.ask_id)) {
        msg.blocks.push({
          type: 'ask',
          ask_id: String(detail.ask_id ?? ''),
          status: 'pending',
          prompt: String(detail.prompt ?? ''),
          options: Array.isArray(detail.options) ? detail.options : [],
          min_selections: Number(detail.min_selections ?? 1),
          max_selections: Number(detail.max_selections ?? 1),
          allow_other: detail.allow_other === true,
          ...(detail.kind ? { kind: String(detail.kind) } : {}),
        })
        messages.value = [...messages.value]
      }
      return
    }
    if (event === 'turn_ask_resolved') {
      const msg = findMessage(detail.chat_id, detail.message_id)
      const block = msg?.blocks.find(b => b.ask_id === detail.ask_id)
      if (msg && block) {
        block.status = String(detail.status ?? 'answered')
        if (Array.isArray(detail.selected)) block.selected = detail.selected
        if (detail.other_text) block.other_text = String(detail.other_text)
        messages.value = [...messages.value]
      }
      return
    }
    if (event === 'turn_done') {
      setChatBusy(detail.chat_id, false)
      if (detail.title) {
        const idx = chats.value.findIndex(c => c.id === detail.chat_id)
        if (idx >= 0) chats.value[idx] = { ...chats.value[idx], title: detail.title }
      }
      const msg = findMessage(detail.chat_id, detail.message_id)
      if (msg) {
        msg.status = String(detail.status ?? 'done')
        if (detail.error && !msg.blocks.some(b => b.type === 'notice')) {
          msg.blocks.push({ type: 'notice', level: 'error',
                            text: String(detail.error) })
        }
        if (detail.usage && typeof detail.usage === 'object') {
          msg.usage = detail.usage
        }
        messages.value = [...messages.value]
      }
      return
    }
  }

  function installWebSocketSync(): void {
    if (wsInstalled) return
    const api = (app as any)?.api
    if (!api?.addEventListener) return
    wsInstalled = true
    api.addEventListener('comfytv-bot', (ev: CustomEvent) => {
      handleBotEvent(ev.detail)
    })
  }

  return {
    providers,
    enabled,
    chats,
    activeChatId,
    activeChat,
    availableProviders,
    canAttach,
    messages,
    loading,
    busy,
    ensureHydrated,
    refreshStatus,
    refreshChats,
    openChat,
    closeChat,
    newChat,
    send,
    stop,
    branchChat,
    answerAsk,
    setRunMode,
    renameChat,
    togglePinned,
    deleteChat,
    deleteChats,
    handleBotEvent,
    installWebSocketSync,
  }
})
