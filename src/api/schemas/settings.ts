import { z } from 'zod'

export const SettingValueSchema = z.union([z.boolean(), z.number(), z.string()])
export type SettingValue = z.infer<typeof SettingValueSchema>

export const SettingRowSchema = z.object({
  key:     z.string(),
  type:    z.enum(['boolean', 'int', 'string']),
  value:   SettingValueSchema,
  default: SettingValueSchema,
})
export type SettingRow = z.infer<typeof SettingRowSchema>

export const ListSettingsSchema = z.object({
  settings: z.array(SettingRowSchema),
})
export const MutateSettingsSchema = z.object({
  ok: z.literal(true),
  settings: z.array(SettingRowSchema),
})

export const BackupResultSchema = z.object({
  ok:       z.boolean(),
  path:     z.string().optional(),
  snapshot: z.string().optional(),
  error:    z.string().optional(),
})
export type BackupResult = z.infer<typeof BackupResultSchema>
