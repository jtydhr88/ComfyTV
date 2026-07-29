import { z } from 'zod'

export const OutputSchema = z.object({
  id: z.number(),
  project_id: z.string(),
  stage_class: z.string(),
  stage_node_id: z.string().nullable().optional(),
  stage_uid: z.string().nullable().optional(),
  output_type: z.string(),
  payload_url: z.string(),
  payload_json: z.unknown().nullable().optional(),
  params_json: z.unknown().nullable().optional(),
  parent_output_id: z.number().nullable().optional(),
  duration_ms: z.number().nullable().optional(),
  created_at: z.string().nullable().optional(),
})
export type Output = z.infer<typeof OutputSchema>
export const ListOutputsSchema = z.object({
  outputs: z.array(OutputSchema),
})
export const LatestOutputSchema = z.object({
  output: OutputSchema.nullable(),
})
export const ExecutedPayloadSchema = z.object({
  output: z.union([z.string(), z.array(z.unknown())]).optional(),
  picked: z.union([z.string(), z.array(z.unknown())]).optional(),
  picked_index: z.union([z.string(), z.number(), z.array(z.unknown())]).optional(),
  output_id: z.union([z.string(), z.number(), z.array(z.unknown())]).optional(),
}).passthrough()
export type ExecutedPayload = z.infer<typeof ExecutedPayloadSchema>
