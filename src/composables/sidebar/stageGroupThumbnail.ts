export const THUMB_WIDTH = 320
export const THUMB_HEIGHT = 200

const SCALE = 2
const PAD = 14
const TITLE_H = 30
const SLOT_H = 22
const NODE_FILL = '#3a3a3f'
const HEADER_FILL = '#55555c'
const LINK_STROKE = '#8a8a94'

interface ThumbNode {
  id: number | string
  type?: string
  title?: string
  pos: [number, number]
  size: [number, number]
  color?: string
  bgcolor?: string
}

interface ThumbLink {
  origin_id: number | string
  origin_slot: number
  target_id: number | string
  target_slot: number
}

type Rect = { x: number; y: number; w: number; h: number }

export function renderStageGroupThumbnail(
  data: Record<string, unknown>,
  labelOf: (type: string) => string,
): string | null {
  const nodes = (data.nodes as ThumbNode[] | undefined)?.filter((n) => n?.pos && n?.size) ?? []
  if (!nodes.length) return null

  const boxes = new Map<string, Rect>()
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const n of nodes) {
    const r = { x: n.pos[0], y: n.pos[1] - TITLE_H, w: n.size[0], h: n.size[1] + TITLE_H }
    boxes.set(String(n.id), r)
    minX = Math.min(minX, r.x); minY = Math.min(minY, r.y)
    maxX = Math.max(maxX, r.x + r.w); maxY = Math.max(maxY, r.y + r.h)
  }
  const scale = Math.min((THUMB_WIDTH - PAD * 2) / (maxX - minX), (THUMB_HEIGHT - PAD * 2) / (maxY - minY))
  const ox = (THUMB_WIDTH - (maxX - minX) * scale) / 2
  const oy = (THUMB_HEIGHT - (maxY - minY) * scale) / 2
  const place = (r: Rect): Rect => ({
    x: ox + (r.x - minX) * scale, y: oy + (r.y - minY) * scale, w: r.w * scale, h: r.h * scale,
  })

  const canvas = document.createElement('canvas')
  canvas.width = THUMB_WIDTH * SCALE
  canvas.height = THUMB_HEIGHT * SCALE
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  ctx.scale(SCALE, SCALE)

  ctx.strokeStyle = LINK_STROKE
  ctx.lineWidth = 1.5
  for (const link of (data.links as ThumbLink[] | undefined) ?? []) {
    const a = boxes.get(String(link.origin_id))
    const b = boxes.get(String(link.target_id))
    if (!a || !b) continue
    const pa = place(a), pb = place(b)
    const x1 = pa.x + pa.w, y1 = pa.y + (TITLE_H + (link.origin_slot + 0.5) * SLOT_H) * scale
    const x2 = pb.x, y2 = pb.y + (TITLE_H + (link.target_slot + 0.5) * SLOT_H) * scale
    const bend = Math.max(12, Math.abs(x2 - x1) / 2)
    ctx.beginPath()
    ctx.moveTo(x1, y1)
    ctx.bezierCurveTo(x1 + bend, y1, x2 - bend, y2, x2, y2)
    ctx.stroke()
  }

  const header = Math.max(16, TITLE_H * scale)
  const font = Math.min(13, header * 0.62)
  for (const n of nodes) {
    const r = place(boxes.get(String(n.id))!)
    const radius = Math.min(6, r.w / 6)
    ctx.fillStyle = n.bgcolor || NODE_FILL
    ctx.beginPath()
    ctx.roundRect(r.x, r.y, r.w, r.h, radius)
    ctx.fill()
    ctx.fillStyle = n.color || HEADER_FILL
    ctx.beginPath()
    ctx.roundRect(r.x, r.y, r.w, Math.min(header, r.h), [radius, radius, 0, 0])
    ctx.fill()

    ctx.save()
    ctx.beginPath()
    ctx.rect(r.x + 4, r.y, r.w - 8, header)
    ctx.clip()
    ctx.fillStyle = '#ececf0'
    ctx.font = `600 ${font}px sans-serif`
    ctx.textBaseline = 'middle'
    ctx.fillText(n.title || labelOf(n.type ?? ''), r.x + 5, r.y + header / 2)
    ctx.restore()
  }

  return canvas.toDataURL('image/png')
}
