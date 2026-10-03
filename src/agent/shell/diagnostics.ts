import { HEALTH_ACTIONS, HEALTH_CODES, type ProviderHealth } from '@/api/schemas/bot'

type Translate = (key: string) => string
export interface DiagnosticRow { label: string; value: string }

export function diagnosticSummary(h: ProviderHealth | undefined, t: Translate): string {
  const verified = h && Object.values(h.api).every(value => value === true)
  return t(verified ? 'diagnostics.apiVerified' : 'diagnostics.incomplete')
}

// Only agreed, typed evidence is formatted. Never render detail, arbitrary code/action,
// gateway code strings, or media names supplied by a future/untrusted backend.
export function diagnosticRows(h: ProviderHealth | undefined, t: Translate): DiagnosticRow[] {
  const text = (key: string) => t(`diagnostics.${key}`)
  const bool = (v: boolean | null | undefined) => text(v == null ? 'unknown' : v ? 'yes' : 'no')
  const unknown = text('unknown')
  const model = (v: { provider: string | null; model: string } | null | undefined) => v ? `${v.provider ?? unknown} / ${v.model}` : unknown
  const rows: DiagnosticRow[] = []
  const add = (label: string, value: string) => rows.push({ label: text(label), value })
  add('brokerAuth', bool(h?.api.broker_auth))
  add('upstreamReachable', bool(h?.api.upstream_reachable))
  add('upstreamAuth', bool(h?.api.upstream_auth))
  add('contract', bool(h?.api.contract))
  add('gateway', text(`states.${h?.gateway.state ?? 'unknown'}`))
  add('server', h?.mcp.server ?? unknown)
  for (const key of ['configured', 'enabled', 'platform_enabled'] as const) add(key, bool(h?.mcp[key]))
  add('connection', text(`states.${h?.mcp.connection_state ?? 'unknown'}`))
  add('reachable', bool(h?.mcp.reachable))
  add('observed', h?.mcp.observed_at ?? unknown)
  for (const key of ['server_info', 'get_canvas', 'inspect_image_asset', 'task_context_read'] as const) {
    const tool = h?.mcp.required_tools[key]
    rows.push({ label: key, value: `${text('registered')}: ${bool(tool?.registered)} · ${text('usable')}: ${bool(tool?.usable)}` })
  }
  add('gate', bool(h?.media.image.gate_enabled))
  add('transport', h ? 'asset_refs' : unknown)
  add('preview', bool(h?.media.image.preview_tool))
  add('vision', bool(h?.media.image.vision_tool))
  add('context', bool(h?.media.image.context_tool))
  add('route', text(`states.${h?.media.image.vision_route ?? 'unknown'}`))
  add('unsupportedMedia', h ? h.media.unsupported.filter(v => ['video', 'audio', 'document'].includes(v)).map(v => text(v)).join(', ') || unknown : unknown)
  add('selection', h ? text(`states.${h.model.selection_mode}`) : unknown)
  add('override', h?.model.authorized_override ?? text('noOverride'))
  add('configuredModel', model(h?.model.configured_default))
  add('configObserved', h?.model.configured_default?.observed_at ?? unknown)
  add('served', model(h?.model.last_served))
  add('completed', h?.model.last_served?.completed_at ?? unknown)
  add('servedSelection', h?.model.last_served ? text(`states.${h.model.last_served.selection_mode_at_run}`) : unknown)
  add('inference', text('notTested'))
  add('historicalInference', h?.inference.state === 'last_success' ? text('lastSuccess') : unknown)
  add('limits', h ? `${h.limits.work} / ${h.limits.control} / ${h.limits.status}` : unknown)
  return rows
}

export function diagnosticRepairs(h: ProviderHealth | undefined, t: Translate): string[] {
  return [...(h?.errors ?? []), ...(h?.gateway.codes ?? []).map(code => ({ code, action: 'none' }))].map(error => {
    const code = (HEALTH_CODES as readonly string[]).includes(error.code) ? error.code : 'unknown'
    const action = (HEALTH_ACTIONS as readonly string[]).includes(error.action) ? error.action : 'unknown'
    return `${t(`diagnostics.codes.${code}`)} ${t(`diagnostics.actions.${action}`)}`.trim()
  })
}
