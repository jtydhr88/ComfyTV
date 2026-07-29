import { z } from 'zod'

export const RESOURCE_KINDS = ['lut', 'font', 'soundfont'] as const
export type ResourceKind = (typeof RESOURCE_KINDS)[number]
export const ResourceSchema = z.object({
  id:         z.number(),
  kind:       z.string(),
  name:       z.string(),
  filename:   z.string(),
  subfolder:  z.string(),
  size:       z.number().nullable().optional(),
  sha256:     z.string().nullable().optional(),
  created_at: z.string().nullable().optional(),
  url:        z.string(),
  missing:    z.boolean().default(false),
})
export type Resource = z.infer<typeof ResourceSchema>
export const ListResourcesSchema = z.object({
  resources: z.array(ResourceSchema),
})
export const MutateResourceSchema = z.object({
  ok: z.literal(true),
  resource: ResourceSchema,
})
