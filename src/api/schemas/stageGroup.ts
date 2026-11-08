import { z } from 'zod'

export const StageGroupSchema = z.object({
  id:         z.number(),
  name:       z.string(),
  data:       z.record(z.string(), z.unknown()),
  created_at: z.string().nullable().optional(),
})
export type StageGroup = z.infer<typeof StageGroupSchema>
export const ListStageGroupsSchema = z.object({
  groups: z.array(StageGroupSchema),
})
export const MutateStageGroupSchema = z.object({
  ok: z.literal(true),
  group: StageGroupSchema,
})
