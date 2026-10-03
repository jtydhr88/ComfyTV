export const providerFixture = { id: 'hermes', label: 'Hermes', available: true, version: '', logged_in: true, detail: '', stateful: true }
export const healthFixture = {
  schema_version: 1, checked_at: '2026-10-03T00:00:00Z', age_ms: 0, stale: false,
  api: { broker_auth: true, upstream_reachable: true, upstream_auth: true, contract: true },
  gateway: { state: 'ok', codes: [] },
  mcp: { server: 'comfytv', configured: true, enabled: true, platform_enabled: true, connection_state: 'connected_cached', reachable: null, observed_at: null,
    required_tools: Object.fromEntries(['server_info', 'get_canvas', 'inspect_image_asset', 'task_context_read'].map(k => [k, { registered: true, usable: true }])) },
  media: { image: { gate_enabled: true, transport: 'asset_refs', preview_tool: true, vision_tool: null, context_tool: true, vision_route: 'unknown', inference: 'not_tested' }, unsupported: ['video', 'audio', 'document'] },
  model: { selection_mode: 'inherit_default', authorized_override: null, configured_default: { provider: null, model: 'configured-model', observed_at: null }, last_served: null },
  inference: { state: 'not_tested' }, limits: { work: 1, control: 2, status: 2 }, errors: [],
}
