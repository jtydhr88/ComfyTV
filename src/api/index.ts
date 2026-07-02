import type { z } from 'zod'

import { app } from '@/lib/comfyApp'

import {
  ApiSidecarResultSchema,
  CapsPayloadSchema,
  ImportWorkflowResultSchema,
  LinkWorkflowResultSchema,
  ListNativeWorkflowsSchema,
  UnlinkWorkflowResultSchema,
} from './schemas'
import type {
  ApiSidecarResult,
  CapsPayload,
  ImportWorkflowResult,
  LinkWorkflowResult,
  NativeWorkflow,
} from './schemas'

export class ApiError extends Error {
  constructor(public path: string, public status: number, message: string) {
    super(`${path} failed [${status}]: ${message}`)
    this.name = 'ApiError'
  }
}

export class ApiValidationError extends Error {
  constructor(public path: string, public zodError: any) {
    super(`${path}: response did not match schema:\n${JSON.stringify(zodError, null, 2)}`)
    this.name = 'ApiValidationError'
  }
}

export async function apiFetch<T extends z.ZodType>(
  path: string,
  schema: T,
  init?: RequestInit,
): Promise<z.infer<T>> {
  const r: Response = await app.api.fetchApi(path, init)
  if (!r.ok) {
    const text = await r.text().catch(() => '')
    throw new ApiError(path, r.status, text || r.statusText)
  }
  const data = await r.json()
  const result = schema.safeParse(data)
  if (!result.success) {
    console.error(`[ComfyTV/api] ${path} schema mismatch`, result.error.format(), 'raw:', data)
    throw new ApiValidationError(path, result.error.format())
  }
  return result.data
}

export async function apiSend<T extends z.ZodType>(
  path: string,
  method: 'POST' | 'PATCH' | 'PUT' | 'DELETE',
  schema: T,
  body?: unknown,
): Promise<z.infer<T>> {
  return apiFetch(path, schema, {
    method,
    headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
}

export function fetchCaps(): Promise<CapsPayload> {
  return apiFetch('/comfytv/caps', CapsPayloadSchema)
}

export function importWorkflow(
  kind: string, filename: string, content: string,
): Promise<ImportWorkflowResult> {
  return apiSend('/comfytv/workflows/import', 'POST', ImportWorkflowResultSchema, {
    kind, filename, content,
  })
}

export function uploadApiSidecar(
  kind: string, label: string, content: string,
): Promise<ApiSidecarResult> {
  return apiSend('/comfytv/workflows/api_sidecar', 'POST', ApiSidecarResultSchema, {
    kind, label, content,
  })
}

export async function listNativeWorkflows(kind?: string): Promise<NativeWorkflow[]> {
  const q = kind ? `?kind=${encodeURIComponent(kind)}` : ''
  const res = await apiFetch(`/comfytv/workflows/native${q}`, ListNativeWorkflowsSchema)
  return res.workflows
}

export function linkWorkflow(
  kind: string, path: string, label?: string,
): Promise<LinkWorkflowResult> {
  return apiSend('/comfytv/workflows/link', 'POST', LinkWorkflowResultSchema, {
    kind, path, label,
  })
}

export function unlinkWorkflow(id: number): Promise<z.infer<typeof UnlinkWorkflowResultSchema>> {
  return apiSend(`/comfytv/workflows/${id}/unlink`, 'POST', UnlinkWorkflowResultSchema)
}

export * from './schemas'
