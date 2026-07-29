import { z } from 'zod'

export const STAGE_PARAM_TYPES = ['boolean', 'int', 'float', 'string', 'combo'] as const
export type StageParamType = (typeof STAGE_PARAM_TYPES)[number]
export const StageParamSchema = z.object({
  id:      z.number(),
  kind:    z.string(),
  key:     z.string(),
  label:   z.string(),
  type:    z.string(),
  default: z.unknown().nullable().optional(),
  config:  z.record(z.string(), z.unknown()).default({}),
  origin:  z.number(),
  order:   z.number(),
})
export type StageParam = z.infer<typeof StageParamSchema>
export const ListStageParamsSchema = z.object({
  params: z.array(StageParamSchema),
})
export const MutateStageParamSchema = z.object({
  ok: z.literal(true),
  param: StageParamSchema,
})
