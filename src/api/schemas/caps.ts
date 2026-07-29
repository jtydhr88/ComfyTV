import { z } from 'zod'

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
export const CapabilityResourceSchema = z.object({
  filename: z.string(),
  sha256: z.string().nullable().optional(),
})
export type CapabilityResource = z.infer<typeof CapabilityResourceSchema>
export const CapabilitiesSchema = z.object({
  version: z.string(),
  node_ids: z.array(z.string()),
  resources: z.record(z.string(), z.array(CapabilityResourceSchema)),
  resource_fields: z.record(z.string(), z.record(z.string(), z.string())).default({}),
})
export type Capabilities = z.infer<typeof CapabilitiesSchema>
export type RemoteCapabilityProbe =
  | { installed: false; error: string }
  | { installed: true; capabilities: Capabilities }
