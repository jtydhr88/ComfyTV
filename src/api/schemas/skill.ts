import { z } from 'zod'

export const SkillSchema = z.object({
  name:              z.string(),
  description:       z.string(),
  display_name:      z.string().default(''),
  source:            z.string(),
  valid:             z.boolean(),
  enabled:           z.boolean(),
  error:             z.string().default(''),
  overrides_builtin: z.boolean().optional(),
})
export type Skill = z.infer<typeof SkillSchema>
export const ListSkillsSchema = z.object({
  enabled: z.boolean(),
  skills:  z.array(SkillSchema),
})
export const ImportSkillSchema = z.object({
  ok:    z.literal(true),
  skill: SkillSchema,
})
