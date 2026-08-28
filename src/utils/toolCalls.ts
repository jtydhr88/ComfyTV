import type { BotBlock } from '@/stores/botStore'

export interface ToolCallView {
  key: string
  name: string
  label: string
  input: Record<string, unknown>
  resultText: string | null
  status: 'running' | 'success' | 'error'
  durationMs: number | null
}

const TOOL_ICONS: Record<string, string> = {
  run_stage: 'pi-play',
  graph_run: 'pi-play',
  wait_stage: 'pi-clock',
  cancel_stage: 'pi-stop-circle',
  get_canvas: 'pi-eye',
  canvas_focus: 'pi-search-plus',
  canvas_command: 'pi-desktop',
  add_stage: 'pi-plus-circle',
  set_stage: 'pi-sliders-h',
  stage_params: 'pi-sliders-v',
  connect_stages: 'pi-link',
  remove_stage: 'pi-trash',
  view_image: 'pi-image',
  media_frame: 'pi-image',
  fx_preview: 'pi-image',
  media_probe: 'pi-video',
  outputs: 'pi-images',
  pick_output: 'pi-check-square',
  assets: 'pi-folder',
  asset_edit: 'pi-folder-open',
  server_info: 'pi-info-circle',
  node_info: 'pi-info-circle',
  stage_catalog: 'pi-list',
  list_workflows: 'pi-list',
  workflow_create: 'pi-file',
  workflow_get: 'pi-file',
  workflow_edit: 'pi-file-edit',
  graph_get: 'pi-share-alt',
  graph_edit: 'pi-share-alt',
  skill: 'pi-book',
}

export function toolLabel(name: string): string {
  return name.replace(/^mcp__comfytv__/, '').replace(/^mcp__comfy__/, 'comfy:')
}

export function toolGlyph(call: ToolCallView): string {
  if (call.status === 'running') return 'pi-spin pi-spinner'
  if (call.status === 'error') return 'pi-times-circle'
  return TOOL_ICONS[call.label] ?? 'pi-wrench'
}

export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  const seconds = ms / 1000
  if (seconds < 60) return `${seconds.toFixed(1)}s`
  return `${Math.floor(seconds / 60)}m ${Math.round(seconds % 60)}s`
}

interface OpenCall {
  view: ToolCallView
  id: string
}

export function pairToolCalls(blocks: BotBlock[], streaming: boolean): ToolCallView[] {
  const calls: ToolCallView[] = []
  const open: OpenCall[] = []

  const claim = (block: BotBlock): ToolCallView | null => {
    const id = String(block.id ?? '')
    let index = -1
    if (id) index = open.findIndex(o => o.id === id)
    if (index < 0 && block.name) {
      index = open.findIndex(o => o.view.name === block.name)
    }
    if (index < 0 && !id) index = 0
    if (index < 0 || index >= open.length) return null
    return open.splice(index, 1)[0]?.view ?? null
  }

  for (const [i, block] of blocks.entries()) {
    if (block.type === 'tool_use') {
      const name = String(block.name ?? '')
      const view: ToolCallView = {
        key: String(block.id || `call-${i}`),
        name,
        label: toolLabel(name),
        input: block.input ?? {},
        resultText: null,
        status: streaming ? 'running' : 'success',
        durationMs: null,
      }
      calls.push(view)
      open.push({ view, id: String(block.id ?? '') })
      continue
    }
    if (block.type !== 'tool_result') continue
    const view = claim(block)
    if (view === null) continue
    view.resultText = String(block.text ?? '')
    view.status = block.status === 'error' ? 'error' : 'success'
    view.durationMs = typeof block.duration_ms === 'number' ? block.duration_ms : null
  }
  return calls
}
