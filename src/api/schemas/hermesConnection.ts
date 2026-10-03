import { z } from 'zod'
// Strict public wire only. Never surface Zod issues or raw backend responses.
export const connectionStatusSchema = z.strictObject({
  schema_version: z.literal(1),
  source: z.enum(['secure_store', 'environment', 'none', 'disabled']),
  configured: z.boolean(), endpoint: z.string().max(2048), mcp_server: z.string().max(256),
  credential_id: z.string().max(256).nullable(),
  secure_storage: z.strictObject({ available: z.boolean(), backend: z.string().max(128), reason: z.string().max(256).nullable() }),
  migration: z.strictObject({ legacy_dpapi: z.boolean(), environment: z.boolean() }),
  can_manage: z.boolean(),
})
export type ConnectionStatus = z.infer<typeof connectionStatusSchema>
export const connectionMutationSchema = z.strictObject({ schema_version: z.literal(1), status: z.enum(['configured', 'disconnected']), connection: connectionStatusSchema })
export const connectionTestSchema = z.strictObject({ schema_version: z.literal(1), status: z.literal('ok'), authenticated: z.literal(true) })
export const connectionErrorSchema = z.strictObject({ error: z.string().min(1).max(128) })
