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
