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

export const OutputSchema = z.object({
  id: z.number(),
  project_id: z.string(),
  stage_class: z.string(),
  stage_node_id: z.string().nullable().optional(),
  output_type: z.string(),
  payload_url: z.string(),
  payload_json: z.unknown().nullable().optional(),
  params_json: z.unknown().nullable().optional(),
  parent_output_id: z.number().nullable().optional(),
  created_at: z.string().nullable().optional(),
})
export type Output = z.infer<typeof OutputSchema>

export const ListOutputsSchema = z.object({
  outputs: z.array(OutputSchema),
})

export const LatestOutputSchema = z.object({
  output: OutputSchema.nullable(),
})

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

export const WorkflowStateSchema = z.object({
  has_api: z.boolean(),
  file_path: z.string(),
  file_mtime: z.number().nullable(),
  file_exists: z.boolean(),
})
export type WorkflowState = z.infer<typeof WorkflowStateSchema>

export const ExposedWidgetSchema = z.object({
  node_id: z.string(),
  node_title: z.string(),
  node_type: z.string(),
  group_title: z.string().nullable(),
  widget_name: z.string(),
  widget_type: z.string(),
  widget_props: z.record(z.string(), z.unknown()),
  current_value: z.unknown(),
  stage_binding: z.string().nullable(),
  override_value: z.string().nullable(),
  cast: z.string().nullable(),
})

export const WorkflowConfigSchema = z.object({
  id: z.number(),
  kind: z.string(),
  label: z.string(),
  has_api: z.boolean(),
  description: z.string().nullable(),
  gui_notes: z.array(z.object({ type: z.string(), text: z.string() })),
  exposed_widgets: z.array(ExposedWidgetSchema),
}).passthrough()
export type WorkflowConfig = z.infer<typeof WorkflowConfigSchema>

const WorkflowUsageEntrySchema = z.object({
  uses: z.record(z.string(), z.boolean()),
  requires: z.record(z.string(), z.boolean()),
  requires_count: z.record(z.string(), z.number()).optional(),
  max_inputs: z.record(z.string(), z.number().nullable()),
})

export const WorkflowInfoSchema = z.record(
  z.string(),
  z.record(z.string(), WorkflowUsageEntrySchema),
)
export type WorkflowInfo = z.infer<typeof WorkflowInfoSchema>

export const CapsSchema = z.object({
  upstream_kinds: z.array(z.string()),
  option_keys:    z.array(z.string()),
  computed_keys:  z.array(z.string()),
})
export type CapsResponse = z.infer<typeof CapsSchema>

export const CapsPayloadSchema = z.object({
  caps_by_kind:  z.record(z.string(), CapsSchema),
  fallback_caps: CapsSchema,
})
export type CapsPayload = z.infer<typeof CapsPayloadSchema>

export const ExecutedPayloadSchema = z.object({
  output: z.union([z.string(), z.array(z.unknown())]).optional(),
  picked: z.union([z.string(), z.array(z.unknown())]).optional(),
  picked_index: z.union([z.string(), z.number(), z.array(z.unknown())]).optional(),
  output_id: z.union([z.string(), z.number(), z.array(z.unknown())]).optional(),
}).passthrough()
export type ExecutedPayload = z.infer<typeof ExecutedPayloadSchema>
