import type { BotMessage } from '@/api/schemas'

export interface BotAskOption {
  id: string
  label: string
  description?: string
}

export interface BotBlock {
  type: 'text' | 'tool_use' | 'tool_result' | 'image' | 'video' | 'audio'
    | 'skill' | 'notice' | 'ask' | 'ref'
  text?: string
  name?: string
  input?: Record<string, unknown>
  url?: string
  asset_id?: number
  id?: string
  status?: string
  duration_ms?: number
  level?: 'info' | 'warning' | 'error'
  uid?: string
  graph_node_id?: string
  stage_class?: string
  title?: string
  media_type?: string
  ask_id?: string
  prompt?: string
  options?: BotAskOption[]
  min_selections?: number
  max_selections?: number
  allow_other?: boolean
  selected?: string[]
  other_text?: string
  kind?: string
}

export type BotUsage = Record<string, number>

export interface BotAttachment {
  asset_id: number
  url: string
  name: string
  media_type: 'image' | 'video' | 'audio'
}

export interface BotChatMessage {
  id: string
  role: string
  status: string
  blocks: BotBlock[]
  usage?: BotUsage | null
}

export function parseBlocks(content: string): BotBlock[] {
  try {
    const parsed = JSON.parse(content)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function toChatMessage(m: BotMessage): BotChatMessage {
  return {
    id: m.id,
    role: m.role,
    status: m.status,
    blocks: parseBlocks(m.content),
    usage: m.usage ?? null,
  }
}

export function applyDelta(msg: BotChatMessage, text: string): void {
  const last = msg.blocks[msg.blocks.length - 1]
  if (last && last.type === 'text') last.text = (last.text ?? '') + text
  else msg.blocks.push({ type: 'text', text })
}
