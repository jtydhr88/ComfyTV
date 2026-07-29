import { z } from 'zod'

export const EntrySchema = z.object({
  id:         z.number(),
  kind:       z.string(),
  label:      z.string(),
  content:    z.string(),
  metadata:   z.record(z.string(), z.unknown()).default({}),
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
export const OkSchema = z.object({
  ok: z.boolean(),
})
