import { z } from 'zod'

export const ImportWorkflowResultSchema = z.object({
  ok: z.boolean(),
  kind: z.string(),
  label: z.string(),
  file_path: z.string().optional(),
})
export type ImportWorkflowResult = z.infer<typeof ImportWorkflowResultSchema>
export const ApiSidecarResultSchema = z.object({
  ok: z.boolean(),
  label: z.string(),
  node_count: z.number(),
  sidecar: z.string(),
})
export type ApiSidecarResult = z.infer<typeof ApiSidecarResultSchema>
export const LINK_TYPE_MANAGED = 0
export const LINK_TYPE_NATIVE = 1
export const NativeWorkflowSchema = z.object({
  path: z.string(),
  name: z.string(),
  mtime: z.number(),
  size: z.number(),
  is_linked: z.boolean(),
  linked_id: z.number().nullable().optional(),
})
export type NativeWorkflow = z.infer<typeof NativeWorkflowSchema>
export const ListNativeWorkflowsSchema = z.object({
  workflows: z.array(NativeWorkflowSchema),
})
export const LinkWorkflowResultSchema = z.object({
  ok: z.boolean(),
  kind: z.string(),
  label: z.string(),
  id: z.number(),
  file_path: z.string().optional(),
  link_type: z.number().optional(),
})
export type LinkWorkflowResult = z.infer<typeof LinkWorkflowResultSchema>
export const UnlinkWorkflowResultSchema = z.object({
  ok: z.boolean(),
  kind: z.string().optional(),
  label: z.string().optional(),
})
export const WorkflowOverviewSchema = z.object({
  id: z.number(),
  builtin: z.boolean().optional(),
  kind: z.string(),
  label: z.string(),
  order: z.number(),
  description: z.string().nullable().optional(),
  link_type: z.number(),
  file_path: z.string(),
  file_exists: z.boolean(),
  file_mtime: z.number().nullable().optional(),
  has_api: z.boolean(),
  gui_valid: z.boolean().nullable().optional(),
})
export type WorkflowOverview = z.infer<typeof WorkflowOverviewSchema>
export const WorkflowRefSchema = z.object({
  kind: z.string(),
  label: z.string(),
})
export type WorkflowRef = z.infer<typeof WorkflowRefSchema>
export const ListWorkflowOverviewSchema = z.object({
  kinds: z.array(z.string()),
  workflows: z.array(WorkflowOverviewSchema),
  recent_added: z.array(WorkflowRefSchema).default([]),
})
export type ListWorkflowOverview = z.infer<typeof ListWorkflowOverviewSchema>
export const RescanResultSchema = z.object({
  ok: z.boolean(),
  added: z.array(WorkflowRefSchema),
  pruned: z.number(),
  total: z.number(),
})
export type RescanResult = z.infer<typeof RescanResultSchema>
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
export const GuiNodeSchema = z.object({
  id: z.string(),
  type: z.string(),
  title: z.string().nullable().optional(),
  is_output: z.boolean().nullable().optional(),
  out_type: z.string().nullable().optional(),
}).passthrough()
export const WorkflowConfigSchema = z.object({
  id: z.number(),
  kind: z.string(),
  label: z.string(),
  link_type: z.number().optional(),
  file_exists: z.boolean().optional(),
  has_api: z.boolean(),
  description: z.string().nullable(),
  gui_notes: z.array(z.object({ type: z.string(), text: z.string() })),
  exposed_widgets: z.array(ExposedWidgetSchema),
  gui_nodes: z.array(GuiNodeSchema).optional(),
  result_type: z.string().nullable().optional(),
  result_node: z.string().nullable().optional(),
}).passthrough()
export type WorkflowConfig = z.infer<typeof WorkflowConfigSchema>
const WorkflowUsageEntrySchema = z.object({
  uses: z.record(z.string(), z.boolean()),
  requires: z.record(z.string(), z.boolean()),
  required_slots: z.record(z.string(), z.array(z.number())).optional(),
  max_inputs: z.record(z.string(), z.number().nullable()),
})
export const WorkflowInfoSchema = z.record(
  z.string(),
  z.record(z.string(), WorkflowUsageEntrySchema),
)
export type WorkflowInfo = z.infer<typeof WorkflowInfoSchema>
export const StageDefaultsSchema = z.object({
  defaults: z.record(z.string(), z.unknown()),
})
export type StageDefaultsResponse = z.infer<typeof StageDefaultsSchema>
