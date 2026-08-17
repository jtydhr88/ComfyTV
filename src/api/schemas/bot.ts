import { z } from 'zod'

export const BotProviderStatusSchema = z.object({
  id:          z.string(),
  label:       z.string(),
  available:   z.boolean(),
  version:     z.string(),
  logged_in:   z.boolean().nullable(),
  detail:      z.string(),
  stateful:    z.boolean(),
  attachments: z.boolean().optional(),
  models:      z.array(z.string()).optional(),
})
export type BotProviderStatus = z.infer<typeof BotProviderStatusSchema>

export const BotStatusSchema = z.object({
  enabled: z.boolean().optional(),
  providers: z.array(BotProviderStatusSchema),
})

export const BotChatSchema = z.object({
  id:           z.string(),
  title:        z.string(),
  provider:     z.string(),
  resume_token: z.string().nullable(),
  pinned:       z.boolean(),
  archived:     z.boolean(),
  created_at:   z.string().nullable(),
  updated_at:   z.string().nullable(),
  busy:         z.boolean().optional(),
})
export type BotChat = z.infer<typeof BotChatSchema>

export const BotMessageSchema = z.object({
  id:                 z.string(),
  chat_id:            z.string(),
  parent_id:          z.string().nullable(),
  role:               z.string(),
  content:            z.string(),
  status:             z.string(),
  resume_token_after: z.string().nullable(),
  created_at:         z.string().nullable(),
})
export type BotMessage = z.infer<typeof BotMessageSchema>

export const ListBotChatsSchema = z.object({
  chats: z.array(BotChatSchema),
})
export const MutateBotChatSchema = z.object({
  chat: BotChatSchema,
})
export const GetBotChatSchema = z.object({
  chat: BotChatSchema,
  messages: z.array(BotMessageSchema),
})
export const BotSendSchema = z.object({
  user_message: BotMessageSchema,
  assistant_message: BotMessageSchema,
})
export const BotOkSchema = z.object({
  ok: z.boolean(),
})
