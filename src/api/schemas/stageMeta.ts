import { z } from 'zod'

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
