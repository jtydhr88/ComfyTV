import type { z } from 'zod'

import { app } from '@/lib/comfyApp'

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

export * from './schemas'
