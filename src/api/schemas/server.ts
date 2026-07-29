import { z } from 'zod'

export const ComfyServerSchema = z.object({
  id:         z.number(),
  label:      z.string(),
  host:       z.string(),
  port:       z.number(),
  enabled:    z.boolean(),
  created_at: z.string().nullable().optional(),
  updated_at: z.string().nullable().optional(),
})
export type ComfyServer = z.infer<typeof ComfyServerSchema>
export const ListServersSchema = z.object({
  servers: z.array(ComfyServerSchema),
})
export const MutateServerSchema = z.object({
  server: ComfyServerSchema,
})
export const ServerStatusSchema = z.object({
  id:      z.number(),
  online:  z.boolean(),
  running: z.number(),
  pending: z.number(),
  jobs:    z.number().optional(),
  error:   z.string().optional(),
})
export type ServerStatus = z.infer<typeof ServerStatusSchema>
export const ListServerStatusSchema = z.object({
  statuses: z.array(ServerStatusSchema),
})
export const TestServerResultSchema = z.object({
  ok: z.boolean(),
  version: z.string().optional(),
  os: z.string().optional(),
  devices: z.array(z.string()).optional(),
  error: z.string().optional(),
})
export type TestServerResult = z.infer<typeof TestServerResultSchema>
export const RemoteJobSchema = z.object({
  id:               z.string(),
  server_id:        z.number().nullable().optional(),
  server_label:     z.string(),
  project_id:       z.string(),
  stage_node_id:    z.string(),
  stage_uid:        z.string().nullable().optional(),
  status:           z.string(),
  remote_prompt_id: z.string().nullable().optional(),
  error_text:       z.string().nullable().optional(),
  output_id:        z.number().nullable().optional(),
  created_at:       z.string().nullable().optional(),
  updated_at:       z.string().nullable().optional(),
})
export type RemoteJob = z.infer<typeof RemoteJobSchema>
export const ListRemoteJobsSchema = z.object({
  jobs: z.array(RemoteJobSchema),
})
export const RemoteRunResultSchema = z.object({
  job_id: z.string(),
})
