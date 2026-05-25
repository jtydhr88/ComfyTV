import { z } from 'zod'

export const ProjectSchema = z.object({
  id: z.string(),
  name: z.string(),
  blueprint: z.string().nullable().optional(),
  created_at: z.string().nullable().optional(),
  updated_at: z.string().nullable().optional(),
})
export type Project = z.infer<typeof ProjectSchema>

export const ListProjectsSchema = z.object({
  projects: z.array(ProjectSchema),
})

export const GetProjectSchema = z.object({
  project: ProjectSchema,
})

export const MutateProjectSchema = z.object({
  ok: z.literal(true),
  project: ProjectSchema.optional(),
})

export const DeleteProjectSchema = z.object({
  ok: z.literal(true),
})

export const OutputSchema = z.object({
  id: z.number(),
  project_id: z.string(),
  stage_class: z.string(),
  stage_node_id: z.string().nullable().optional(),
  output_type: z.string(),
  payload_url: z.string(),
  payload_json: z.any().nullable().optional(),
  params_json: z.any().nullable().optional(),
  parent_output_id: z.number().nullable().optional(),
  created_at: z.string().nullable().optional(),
})
export type Output = z.infer<typeof OutputSchema>

export const ListOutputsSchema = z.object({
  outputs: z.array(OutputSchema),
})

export const LatestOutputSchema = z.object({
  output: OutputSchema.nullable(),
})

export const StageMetaEntrySchema = z.object({
  node_id: z.string(),
  kind: z.string(),
  variant: z.union([
    z.literal('loader'),
    z.literal('generator'),
    z.literal('transform'),
  ]).nullable().optional(),
  workflow_kind: z.string().nullable().optional(),
})
export type StageMetaEntry = z.infer<typeof StageMetaEntrySchema>

export const StageMetaResponseSchema = z.object({
  stages: z.array(StageMetaEntrySchema),
})

export const EntrySchema = z.object({
  id:         z.number(),
  kind:       z.string(),
  label:      z.string(),
  content:    z.string(),
  metadata:   z.record(z.string(), z.any()).default({}),
  updated_at: z.string().nullable().optional(),
})
export type Entry = z.infer<typeof EntrySchema>

export const ListEntriesSchema = z.object({
  entries: z.array(EntrySchema),
})

export const UpsertEntrySchema = z.object({
  ok: z.literal(true),
  entry: EntrySchema,
})

export const DeleteEntrySchema = z.object({
  ok: z.literal(true),
})
