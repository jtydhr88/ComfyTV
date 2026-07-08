import type { z } from 'zod'

import { app } from '@/lib/comfyApp'

import {
  ApiSidecarResultSchema,
  CapsPayloadSchema,
  ImportWorkflowResultSchema,
  LinkWorkflowResultSchema,
  ListNativeWorkflowsSchema,
  ListRemoteJobsSchema,
  ListServerStatusSchema,
  ListServersSchema,
  ListWorkflowOverviewSchema,
  MutateServerSchema,
  OkSchema,
  RemoteRunResultSchema,
  RescanResultSchema,
  TestServerResultSchema,
  UnlinkWorkflowResultSchema,
} from './schemas'
import type {
  ApiSidecarResult,
  CapsPayload,
  ImportWorkflowResult,
  LinkWorkflowResult,
  ListWorkflowOverview,
  NativeWorkflow,
  RescanResult,
  TestServerResult,
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

export function listWorkflowOverview(kind?: string): Promise<ListWorkflowOverview> {
  const q = kind ? `?kind=${encodeURIComponent(kind)}` : ''
  return apiFetch(`/comfytv/workflows${q}`, ListWorkflowOverviewSchema)
}

export function rescanWorkflows(): Promise<RescanResult> {
  return apiSend('/comfytv/workflows/rescan', 'POST', RescanResultSchema)
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

export function listServers(): Promise<z.infer<typeof ListServersSchema>> {
  return apiFetch('/comfytv/servers', ListServersSchema)
}

export function listServerStatus(): Promise<z.infer<typeof ListServerStatusSchema>> {
  return apiFetch('/comfytv/servers/status', ListServerStatusSchema)
}

export function createServer(
  input: { label: string; host: string; port: number },
): Promise<z.infer<typeof MutateServerSchema>> {
  return apiSend('/comfytv/servers', 'POST', MutateServerSchema, input)
}

export function updateServer(
  id: number,
  patch: Partial<{ label: string; host: string; port: number; enabled: boolean }>,
): Promise<z.infer<typeof MutateServerSchema>> {
  return apiSend(`/comfytv/servers/${id}`, 'PATCH', MutateServerSchema, patch)
}

export function deleteServer(id: number): Promise<z.infer<typeof OkSchema>> {
  return apiSend(`/comfytv/servers/${id}`, 'DELETE', OkSchema)
}

export function testServer(
  input: { host: string; port: number },
): Promise<TestServerResult> {
  return apiSend('/comfytv/servers/test', 'POST', TestServerResultSchema, input)
}

export function remoteRun(input: {
  server_id: number
  prompt: Record<string, unknown>
  target_node_id: string
  project_id: string
  stage_uid?: string | null
}): Promise<z.infer<typeof RemoteRunResultSchema>> {
  return apiSend('/comfytv/remote_run', 'POST', RemoteRunResultSchema, input)
}

export function listRemoteJobs(status?: string): Promise<z.infer<typeof ListRemoteJobsSchema>> {
  const q = status ? `?status=${encodeURIComponent(status)}` : ''
  return apiFetch(`/comfytv/remote_jobs${q}`, ListRemoteJobsSchema)
}

export function cancelRemoteJob(jobId: string): Promise<z.infer<typeof OkSchema>> {
  return apiSend(`/comfytv/remote_jobs/${encodeURIComponent(jobId)}/cancel`, 'POST', OkSchema)
}

export * from './schemas'
