import type { ExposedWidget, GuiNode } from '@/composables/sidebar/workflowConfigCatalog'

export type MediaKind = 'image' | 'video' | 'audio' | 'model'
export type InputKind = MediaKind | 'text' | 'param'
export type OutputKind = 'image' | 'images' | 'video' | 'audio' | 'text' | 'model'

export interface CustomIoInput {
  node: string
  input: string
  kind: InputKind
  label: string
  key?: string
  slot?: number
  required?: boolean
  ptype?: string
  props?: Record<string, unknown>
  default?: unknown
  prompt?: boolean
}

export interface CustomIoOutput {
  node: string
  kind: OutputKind
  label: string
}

export interface CustomIo {
  inputs: CustomIoInput[]
  outputs: CustomIoOutput[]
}

export const OUTPUT_SLOTS: readonly OutputKind[] = ['image', 'images', 'video', 'audio', 'text', 'model']

export const SLOT_GROUPS: Record<MediaKind | 'text', [group: string, prefix: string]> = {
  image: ['images', 'image'],
  video: ['videos', 'video'],
  audio: ['audio', 'audio'],
  model: ['models', 'model'],
  text: ['texts', 'text'],
}

const UPLOAD_KIND: Array<[string, MediaKind]> = [
  ['image_upload', 'image'],
  ['video_upload', 'video'],
  ['audio_upload', 'audio'],
  ['file_upload', 'model'],
]

const OUTPUT_NODE_KIND: Record<string, OutputKind> = {
  SaveImage: 'image',
  PreviewImage: 'image',
  SaveAnimatedWEBP: 'image',
  SaveAnimatedPNG: 'image',
  SaveVideo: 'video',
  SaveWEBM: 'video',
  VHS_VideoCombine: 'video',
  SaveAudio: 'audio',
  SaveAudioMP3: 'audio',
  SaveAudioOpus: 'audio',
  SaveAudioAdvanced: 'audio',
  SaveGLB: 'model',
  PreviewAny: 'text',
  ShowText: 'text',
  SaveText: 'text',
  DisplayAny: 'text',
}

export function inputKey(node: string, input: string): string {
  return 'cio_' + `${node}_${input}`.replace(/[^A-Za-z0-9_]+/g, '_').replace(/^_+|_+$/g, '')
}

export function classifyWidget(w: ExposedWidget): InputKind | null {
  const props = w.widget_props ?? {}
  for (const [flag, kind] of UPLOAD_KIND) if (props[flag]) return kind
  switch (String(w.widget_type).toUpperCase()) {
    case 'STRING': return 'text'
    case 'INT':
    case 'FLOAT':
    case 'BOOLEAN':
    case 'COMBO': return 'param'
    default: return null
  }
}

export function outputKindOf(n: GuiNode): OutputKind | null {
  const byType = OUTPUT_NODE_KIND[n.type]
  if (byType) return byType
  if (n.is_output) return n.out_type === 'STRING' ? 'text' : null
  return n.out_type === 'STRING' ? 'text' : null
}

export function emptyCustomIo(): CustomIo {
  return { inputs: [], outputs: [] }
}

export function parseCustomIo(meta: unknown): CustomIo {
  const raw = (meta as any)?.custom_io
  const out = emptyCustomIo()
  if (!raw || typeof raw !== 'object') return out
  for (const it of Array.isArray(raw.inputs) ? raw.inputs : []) {
    if (!it?.node || !it?.input || !it?.kind) continue
    out.inputs.push({
      node: String(it.node), input: String(it.input), kind: it.kind,
      label: String(it.label ?? it.input), key: it.key ? String(it.key) : inputKey(String(it.node), String(it.input)),
      slot: typeof it.slot === 'number' ? it.slot : undefined,
      required: it.required == null ? undefined : Boolean(it.required),
      ptype: it.ptype ? String(it.ptype).toUpperCase() : undefined,
      props: it.props && typeof it.props === 'object' ? it.props : {},
      default: it.default,
      prompt: it.kind === 'text' ? Boolean(it.prompt) : undefined,
    })
  }
  for (const it of Array.isArray(raw.outputs) ? raw.outputs : []) {
    if (!it?.node || !it?.kind) continue
    out.outputs.push({ node: String(it.node), kind: it.kind, label: String(it.label ?? it.kind) })
  }
  return assignSlots(out)
}

export function assignSlots(io: CustomIo): CustomIo {
  const counters: Record<string, number> = {}
  for (const it of io.inputs) {
    if (it.kind === 'param') { it.slot = undefined; continue }
    it.slot = counters[it.kind] ?? 0
    counters[it.kind] = it.slot + 1
    it.key = inputKey(it.node, it.input)
  }
  for (const it of io.inputs) if (it.kind === 'param') it.key = inputKey(it.node, it.input)
  return io
}

export function slotName(kind: MediaKind | 'text', idx: number): string {
  const [group, prefix] = SLOT_GROUPS[kind]
  return `${group}.${prefix}${idx}`
}

export function inputBySlot(io: CustomIo, slot: string): CustomIoInput | undefined {
  return io.inputs.find(it => it.kind !== 'param' && slotName(it.kind, it.slot ?? 0) === slot)
}

export function primaryOutput(io: CustomIo): CustomIoOutput | undefined {
  return io.outputs[0]
}

export function previewKindOf(kind: OutputKind | undefined): 'image' | 'video' | 'audio' | 'text' | 'model' {
  if (!kind) return 'image'
  return kind === 'images' ? 'image' : kind
}

interface SlotLike { name: string; label?: string | null }

export function applySlotLabels(node: { inputs?: SlotLike[]; outputs?: SlotLike[] }, io: CustomIo): void {
  for (const inp of node.inputs ?? []) {
    const hit = inputBySlot(io, inp.name)
    inp.label = hit ? hit.label : undefined as unknown as string
  }
  for (const out of node.outputs ?? []) {
    const hit = io.outputs.find(o => o.kind === out.name)
    out.label = hit ? hit.label : undefined as unknown as string
  }
}

export function toggleInput(io: CustomIo, w: ExposedWidget, kind: InputKind): CustomIo {
  const idx = io.inputs.findIndex(it => it.node === w.node_id && it.input === w.widget_name)
  const inputs = [...io.inputs]
  if (idx >= 0) inputs.splice(idx, 1)
  else inputs.push({
    node: w.node_id, input: w.widget_name, kind,
    label: w.node_title && w.node_title !== w.node_type ? w.node_title : `${w.node_title}.${w.widget_name}`,
    required: kind === 'param' || kind === 'text' ? undefined : true,
    ptype: kind === 'param' || kind === 'text' ? String(w.widget_type).toUpperCase() : undefined,
    props: kind === 'param' ? pickProps(w.widget_props) : {},
    default: kind === 'param' || kind === 'text' ? w.current_value : undefined,
  })
  return assignSlots({ inputs, outputs: io.outputs })
}

function pickProps(props: Record<string, unknown> | undefined): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const k of ['min', 'max', 'step', 'values', 'multiline', 'round']) {
    if (props && props[k] !== undefined) out[k] = props[k]
  }
  return out
}

export function toggleOutput(io: CustomIo, n: GuiNode, kind: OutputKind): CustomIo {
  const id = String(n.id)
  const idx = io.outputs.findIndex(o => o.node === id)
  const outputs = [...io.outputs]
  if (idx >= 0) outputs.splice(idx, 1)
  else {
    const taken = (k: OutputKind) => outputs.some(o => o.kind === k)
    const sibling: Partial<Record<OutputKind, OutputKind>> = { image: 'images', images: 'image' }
    const alt = sibling[kind]
    if (taken(kind) && alt && !taken(alt)) kind = alt
    const dup = outputs.findIndex(o => o.kind === kind)
    if (dup >= 0) outputs.splice(dup, 1)
    outputs.push({ node: id, kind, label: n.title && n.title !== n.type ? n.title : n.type })
  }
  return { inputs: io.inputs, outputs }
}

export function hasPromptInput(io: CustomIo): boolean {
  return io.inputs.some(it => it.kind === 'text' && it.prompt)
}

export function exposedRefTypes(io: CustomIo): Array<'image' | 'video' | 'audio'> {
  const out: Array<'image' | 'video' | 'audio'> = []
  for (const k of ['image', 'video', 'audio'] as const) {
    if (io.inputs.some(it => it.kind === k)) out.push(k)
  }
  return out
}

export function moveItem<T>(arr: T[], from: number, to: number): T[] {
  if (from === to || from < 0 || to < 0 || from >= arr.length || to >= arr.length) return arr
  const out = [...arr]
  const [it] = out.splice(from, 1)
  out.splice(to, 0, it)
  return out
}

export function isInputExposed(io: CustomIo, w: ExposedWidget): boolean {
  return io.inputs.some(it => it.node === w.node_id && it.input === w.widget_name)
}

export function isOutputExposed(io: CustomIo, n: GuiNode): boolean {
  return io.outputs.some(o => o.node === String(n.id))
}

export function parseMultiOutputs(raw: unknown): Partial<Record<OutputKind, string>> {
  let data = raw
  if (typeof raw === 'string') {
    try { data = JSON.parse(raw) } catch { return {} }
  }
  const out: Partial<Record<OutputKind, string>> = {}
  if (!data || typeof data !== 'object') return out
  for (const k of OUTPUT_SLOTS) {
    const v = (data as any)[k]
    if (typeof v === 'string' && v) out[k] = v
  }
  return out
}
