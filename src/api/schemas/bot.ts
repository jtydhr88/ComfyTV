import { z } from 'zod'

const unknownBoolean = z.boolean().nullable()
const identifier = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._:/-]{0,127}$/).refine(value =>
  !value.includes('://') && !value.includes('..') &&
  !/^(?:sk[-_]|bearer|token[:_]|password[:_]|api_key[:_]|api-key[:_]|apikey[:_]|access_token[:_]|refresh_token[:_]|github_pat_|gh[pousr]_)/i.test(value) &&
  !value.startsWith('eyJ'))
const utcTimestamp = z.string().max(40).datetime({ offset: true }).regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|\+00:00)$/).refine(value => !value.startsWith('0000-'))
const futureDiagnostic = z.string().min(1).max(128)
const timestamp = utcTimestamp.nullable()
const selectionMode = z.enum(['inherit_default', 'broker_override'])
const toolState = z.object({ registered: unknownBoolean, usable: unknownBoolean })

export const HEALTH_CODES = ['broker_config_missing', 'broker_auth_rejected', 'broker_unreachable', 'upstream_unreachable', 'upstream_timeout', 'upstream_auth_rejected', 'upstream_contract_invalid', 'gateway_degraded', 'health_stale', 'mcp_binding_mismatch', 'mcp_runtime_introspection_unavailable', 'mcp_disabled', 'mcp_not_platform_enabled', 'mcp_connection_failed', 'mcp_required_tool_missing', 'image_gate_disabled', 'vision_unverified', 'model_override_not_authorized', 'model_default_unknown', 'diagnostics_unsupported'] as const
export const HEALTH_ACTIONS = ['check_connection', 'check_main_api', 'check_mcp_config', 'check_tool_filters', 'check_media_config', 'check_model_policy', 'retry_later', 'none'] as const

export const ProviderHealthSchema = z.object({
  schema_version: z.literal(1), checked_at: timestamp, age_ms: z.number().int().min(0).max(2147483647), stale: z.boolean(),
  api: z.object({ broker_auth: unknownBoolean, upstream_reachable: unknownBoolean, upstream_auth: unknownBoolean, contract: unknownBoolean }),
  gateway: z.object({ state: z.enum(['ok', 'degraded', 'unknown']), codes: z.array(futureDiagnostic).max(32) }),
  mcp: z.object({
    server: z.string().regex(/^[A-Za-z0-9_-]{1,100}$/), configured: unknownBoolean, enabled: unknownBoolean, platform_enabled: unknownBoolean,
    connection_state: z.enum(['disabled', 'configured', 'lazy', 'connecting', 'connected_cached', 'failed', 'unknown']),
    reachable: unknownBoolean, observed_at: timestamp,
    required_tools: z.object({ server_info: toolState, get_canvas: toolState, inspect_image_asset: toolState, task_context_read: toolState }),
  }),
  media: z.object({ image: z.object({
    gate_enabled: unknownBoolean, transport: z.literal('asset_refs'), preview_tool: unknownBoolean, vision_tool: unknownBoolean, context_tool: unknownBoolean,
    vision_route: z.enum(['native', 'auxiliary', 'unknown']), inference: z.literal('not_tested'),
  }), unsupported: z.array(z.enum(['video', 'audio', 'document'])).max(32) }),
  model: z.object({ selection_mode: selectionMode, authorized_override: identifier.nullable(),
    configured_default: z.object({ provider: identifier.nullable(), model: identifier, observed_at: timestamp }).nullable(),
    last_served: z.object({ provider: identifier, model: identifier, completed_at: utcTimestamp, selection_mode_at_run: selectionMode }).nullable(),
  }),
  inference: z.object({ state: z.enum(['not_tested', 'last_success']) }),
  limits: z.object({ work: z.union([z.literal(1), z.literal(2)]), control: z.literal(2), status: z.literal(2) }),
  // Future codes/actions are accepted but are never rendered without localization allowlisting.
  errors: z.array(z.object({ code: futureDiagnostic, layer: z.enum(['api', 'gateway', 'mcp', 'media', 'model']), retryable: z.boolean(), action: futureDiagnostic })).max(32),
})
export type ProviderHealth = z.infer<typeof ProviderHealthSchema>

export const BotProviderStatusSchema = z.object({
  id:          z.string(),
  label:       z.string(),
  available:   z.boolean(),
  version:     z.string(),
  logged_in:   z.boolean().nullable(),
  detail:      z.string(),
  stateful:    z.boolean(),
  attachments: z.boolean().optional(),
  attachment_transport: z.string().optional(),
  attachment_media_types: z.array(z.string()).optional(),
  health: ProviderHealthSchema.optional(),
  models:      z.array(z.string()).optional(),
  model_options: z
    .array(
      z.object({
        value: z.string(),
        label: z.string(),
        group: z.string().optional(),
      }),
    )
    .optional(),
})
export type BotProviderStatus = z.infer<typeof BotProviderStatusSchema>

export const BotStatusSchema = z.object({
  enabled: z.boolean().optional(),
  providers: z.array(BotProviderStatusSchema),
})

export const HermesHealthResponseSchema = z.object({
  enabled: z.boolean(), provider: BotProviderStatusSchema.nullable(),
}).refine(data => data.enabled ? data.provider?.id === 'hermes' : data.provider === null)

export const BotChatSchema = z.object({
  id:           z.string(),
  title:        z.string(),
  provider:     z.string(),
  resume_token: z.string().nullable(),
  run_mode:     z.string().optional(),
  prefs:        z.array(z.string()).optional(),
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
  usage:              z.record(z.string(), z.number()).nullable().optional(),
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
  assistant_message: BotMessageSchema.optional(),
  queued: z.boolean().optional(),
})
export const BotOkSchema = z.object({
  ok: z.boolean(),
})
