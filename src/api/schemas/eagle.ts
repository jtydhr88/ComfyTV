import { z } from 'zod'

import { AssetSchema } from './asset'

export const EagleItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  ext: z.string(),
  width: z.number().nullish(),
  height: z.number().nullish(),
  size: z.number().nullish(),
  tags: z.array(z.string()),
  folders: z.array(z.string()),
  annotation: z.string(),
  star: z.number(),
  mtime: z.number(),
  score: z.number().optional(),
})
export type EagleItem = z.infer<typeof EagleItemSchema>

export const EagleStatusSchema = z.object({
  enabled: z.boolean(),
  mode: z.enum(['api', 'disk', 'offline', 'disabled']),
  online: z.boolean().optional(),
  version: z.string().nullish(),
  api_version: z.string().nullish(),
  ai_ready: z.boolean().optional(),
  current_library: z.string().nullish(),
  pinned_library: z.string().optional(),
  library_match: z.boolean().optional(),
  pending: z.number(),
})
export type EagleStatus = z.infer<typeof EagleStatusSchema>

export const EagleFolderSchema = z.object({
  id: z.string(),
  name: z.string(),
  parent: z.string().nullish(),
  depth: z.number(),
})
export type EagleFolder = z.infer<typeof EagleFolderSchema>

export const ListEagleItemsSchema = z.object({
  items: z.array(EagleItemSchema),
  mode: z.string(),
  total: z.number().nullish(),
})

export const ListEagleFoldersSchema = z.object({
  folders: z.array(EagleFolderSchema),
  mode: z.string(),
})

export const EaglePendingRowSchema = z.object({
  id: z.number(),
  payload_url: z.string(),
  name: z.string(),
  tags: z.array(z.string()),
  annotation: z.string().nullish(),
  folder: z.string().nullish(),
  status: z.string(),
  error: z.string().nullish(),
  created_at: z.string().nullish(),
})
export type EaglePendingRow = z.infer<typeof EaglePendingRowSchema>

export const ListEaglePendingSchema = z.object({
  pending: z.array(EaglePendingRowSchema),
})

export const EagleSendResultSchema = z.object({
  ok: z.boolean(),
  sent: z.boolean(),
  queued: z.boolean().optional(),
  pending_count: z.number(),
})
export type EagleSendResult = z.infer<typeof EagleSendResultSchema>

export const EagleFlushResultSchema = z.object({
  ok: z.boolean(),
  sent: z.number(),
  failed: z.number(),
  remaining: z.number(),
})
export type EagleFlushResult = z.infer<typeof EagleFlushResultSchema>

export const EagleImportResultSchema = z.object({
  ok: z.boolean(),
  existed: z.boolean().optional(),
  asset: AssetSchema.optional(),
  payload_url: z.string().optional(),
})
export type EagleImportResult = z.infer<typeof EagleImportResultSchema>
