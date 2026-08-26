import { apiFetch, apiSend } from './index'
import {
  EagleFlushResultSchema,
  EagleImportResultSchema,
  EagleSendResultSchema,
  EagleStatusSchema,
  ListEagleFoldersSchema,
  ListEagleItemsSchema,
  ListEaglePendingSchema,
  OkSchema,
} from './schemas'
import type {
  EagleFlushResult,
  EagleImportResult,
  EagleSendResult,
  EagleStatus,
} from './schemas'
import type { z } from 'zod'

export function fetchEagleStatus(fresh = false): Promise<EagleStatus> {
  return apiFetch(`/comfytv/eagle/status${fresh ? '?fresh=1' : ''}`, EagleStatusSchema)
}

export interface EagleItemsQuery {
  keyword?: string
  folder?: string
  mediaType?: string
  limit?: number
  offset?: number
  search?: 'ai'
}

export function fetchEagleItems(
  query: EagleItemsQuery = {},
): Promise<z.infer<typeof ListEagleItemsSchema>> {
  const params = new URLSearchParams()
  if (query.keyword) params.set('keyword', query.keyword)
  if (query.folder) params.set('folder', query.folder)
  if (query.mediaType) params.set('media_type', query.mediaType)
  if (query.limit != null) params.set('limit', String(query.limit))
  if (query.offset != null) params.set('offset', String(query.offset))
  if (query.search) params.set('search', query.search)
  const qs = params.toString()
  return apiFetch(`/comfytv/eagle/items${qs ? `?${qs}` : ''}`, ListEagleItemsSchema)
}

export function fetchEagleSimilar(
  id: string,
  limit = 100,
): Promise<z.infer<typeof ListEagleItemsSchema>> {
  const params = new URLSearchParams({ id, limit: String(limit) })
  return apiFetch(`/comfytv/eagle/similar?${params}`, ListEagleItemsSchema)
}

export function fetchEagleFolders(): Promise<z.infer<typeof ListEagleFoldersSchema>> {
  return apiFetch('/comfytv/eagle/folders', ListEagleFoldersSchema)
}

export function importEagleItem(id: string): Promise<EagleImportResult> {
  return apiSend('/comfytv/eagle/import', 'POST', EagleImportResultSchema, { id })
}

export function sendToEagle(body: {
  payload_url: string
  name?: string
  tags?: string[]
  annotation?: string
}): Promise<EagleSendResult> {
  return apiSend('/comfytv/eagle/send', 'POST', EagleSendResultSchema, body)
}

export function flushEagle(): Promise<EagleFlushResult> {
  return apiSend('/comfytv/eagle/flush', 'POST', EagleFlushResultSchema)
}

export function fetchEaglePending(): Promise<z.infer<typeof ListEaglePendingSchema>> {
  return apiFetch('/comfytv/eagle/pending', ListEaglePendingSchema)
}

export function deleteEaglePending(id: number): Promise<z.infer<typeof OkSchema>> {
  return apiSend(`/comfytv/eagle/pending/${id}`, 'DELETE', OkSchema)
}

export function eagleThumbUrl(id: string): string {
  return `/comfytv/eagle/thumb?id=${encodeURIComponent(id)}`
}

export function eagleFileUrl(id: string): string {
  return `/comfytv/eagle/file?id=${encodeURIComponent(id)}`
}
