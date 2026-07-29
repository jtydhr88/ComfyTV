import { z } from 'zod'

export const StagePresetSchema = z.object({
  id:         z.union([z.number(), z.string()]),
  kind:       z.string(),
  name:       z.string(),
  config:     z.record(z.string(), z.unknown()).default({}),
  builtin:    z.boolean().default(false),
  created_at: z.string().nullable().optional(),
})
export type StagePreset = z.infer<typeof StagePresetSchema>
export const ListStagePresetsSchema = z.object({
  presets: z.array(StagePresetSchema),
})
export const MutateStagePresetSchema = z.object({
  ok: z.literal(true),
  preset: StagePresetSchema,
})
