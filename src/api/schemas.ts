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
  stage_uid: z.string().nullable().optional(),
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

export const AssetCategorySchema = z.object({
  id:         z.number(),
  name:       z.string(),
  created_at: z.string().nullable().optional(),
  updated_at: z.string().nullable().optional(),
})
export type AssetCategory = z.infer<typeof AssetCategorySchema>

export const ListAssetCategoriesSchema = z.object({
  categories: z.array(AssetCategorySchema),
})

export const MutateAssetCategorySchema = z.object({
  ok: z.literal(true),
  category: AssetCategorySchema,
})

export const AssetSchema = z.object({
  id:          z.number(),
  category_ids: z.array(z.number()).default([]),
  name:        z.string(),
  media_type:  z.string(),
  payload_url: z.string(),
  mime_type:   z.string().nullable().optional(),
  width:       z.number().nullable().optional(),
  height:      z.number().nullable().optional(),
  size_bytes:  z.number().nullable().optional(),
  source:      z.string().nullable().optional(),
  metadata:    z.record(z.string(), z.unknown()).default({}),
  created_at:  z.string().nullable().optional(),
  updated_at:  z.string().nullable().optional(),
})
export type Asset = z.infer<typeof AssetSchema>

export const ListAssetsSchema = z.object({
  assets: z.array(AssetSchema),
})

export const MutateAssetSchema = z.object({
  ok: z.literal(true),
  asset: AssetSchema,
})

export const DeleteAssetSchema = z.object({
  ok: z.literal(true),
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

export const CapsSchema = z.object({
  upstream_kinds: z.array(z.string()),
  option_keys:    z.array(z.string()),
  computed_keys:  z.array(z.string()),
})
export type CapsResponse = z.infer<typeof CapsSchema>

export const CapsPayloadSchema = z.object({
  caps_by_kind:  z.record(z.string(), CapsSchema),
  fallback_caps: CapsSchema,
  option_labels: z.record(z.string(), z.string()).default({}),
})
export type CapsPayload = z.infer<typeof CapsPayloadSchema>

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

export const ComfyServerSchema = z.object({
  id:         z.number(),
  label:      z.string(),
  host:       z.string(),
  port:       z.number(),
  enabled:    z.boolean(),
  created_at: z.string().nullable().optional(),
  updated_at: z.string().nullable().optional(),
})
export type ComfyServer = z.infer<typeof ComfyServerSchema>

export const ListServersSchema = z.object({
  servers: z.array(ComfyServerSchema),
})

export const MutateServerSchema = z.object({
  server: ComfyServerSchema,
})

export const ServerStatusSchema = z.object({
  id:      z.number(),
  online:  z.boolean(),
  running: z.number(),
  pending: z.number(),
  jobs:    z.number().optional(),
  error:   z.string().optional(),
})
export type ServerStatus = z.infer<typeof ServerStatusSchema>

export const ListServerStatusSchema = z.object({
  statuses: z.array(ServerStatusSchema),
})

export const TestServerResultSchema = z.object({
  ok: z.boolean(),
  version: z.string().optional(),
  os: z.string().optional(),
  devices: z.array(z.string()).optional(),
  error: z.string().optional(),
})
export type TestServerResult = z.infer<typeof TestServerResultSchema>

export const RemoteJobSchema = z.object({
  id:               z.string(),
  server_id:        z.number().nullable().optional(),
  server_label:     z.string(),
  project_id:       z.string(),
  stage_node_id:    z.string(),
  stage_uid:        z.string().nullable().optional(),
  status:           z.string(),
  remote_prompt_id: z.string().nullable().optional(),
  error_text:       z.string().nullable().optional(),
  output_id:        z.number().nullable().optional(),
  created_at:       z.string().nullable().optional(),
  updated_at:       z.string().nullable().optional(),
})
export type RemoteJob = z.infer<typeof RemoteJobSchema>

export const ListRemoteJobsSchema = z.object({
  jobs: z.array(RemoteJobSchema),
})

export const RemoteRunResultSchema = z.object({
  job_id: z.string(),
})

export const ExecutedPayloadSchema = z.object({
  output: z.union([z.string(), z.array(z.unknown())]).optional(),
  picked: z.union([z.string(), z.array(z.unknown())]).optional(),
  picked_index: z.union([z.string(), z.number(), z.array(z.unknown())]).optional(),
  output_id: z.union([z.string(), z.number(), z.array(z.unknown())]).optional(),
}).passthrough()
export type ExecutedPayload = z.infer<typeof ExecutedPayloadSchema>
