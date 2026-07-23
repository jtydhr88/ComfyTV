import { buildPdfFromJpegPages, type JpegPage } from './pdfWriter'
import {
  boardDurationMs,
  boardImageUrl,
  totalDurationMs,
  type StoryboardDoc,
} from './boardDoc'

/** A4 landscape, in PDF points. */
export const PAGE_W = 842
export const PAGE_H = 595

export interface PdfExportOptions {
  title?: string
  cols?: number
  rows?: number
  /** Canvas pixels per PDF point. */
  scale?: number
  quality?: number
}

export function paginate(count: number, perPage: number): number[][] {
  const pages: number[][] = []
  for (let i = 0; i < count; i += perPage) {
    pages.push(Array.from({ length: Math.min(perPage, count - i) }, (_, k) => i + k))
  }
  return pages
}

export function truncateToWidth(ctx: CanvasRenderingContext2D, text: string, maxW: number): string {
  const oneLine = text.replace(/\s+/g, ' ').trim()
  if (!oneLine || ctx.measureText(oneLine).width <= maxW) return oneLine
  let lo = 0
  let hi = oneLine.length
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2)
    if (ctx.measureText(oneLine.slice(0, mid) + '…').width <= maxW) lo = mid
    else hi = mid - 1
  }
  return oneLine.slice(0, lo) + '…'
}

function loadImage(url: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => resolve(null)
    img.src = url
  })
}

function canvasToJpeg(canvas: HTMLCanvasElement, quality: number): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('toBlob null'))
          return
        }
        void blob.arrayBuffer().then((buf) => resolve(new Uint8Array(buf)))
      },
      'image/jpeg',
      quality,
    )
  })
}

export async function exportStoryboardPdf(
  doc: StoryboardDoc,
  labels: string[],
  opts?: PdfExportOptions,
): Promise<Blob> {
  const cols = Math.max(1, opts?.cols ?? 3)
  const rows = Math.max(1, opts?.rows ?? 2)
  const scale = opts?.scale ?? 2
  const quality = opts?.quality ?? 0.85
  const title = opts?.title ?? 'Storyboard'

  const images = await Promise.all(
    doc.boards.map((b) => {
      const url = boardImageUrl(b)
      return url ? loadImage(url) : Promise.resolve(null)
    }),
  )

  const margin = 24
  const headerH = 30
  const gap = 12
  const gridTop = margin + headerH
  const cellW = (PAGE_W - margin * 2 - gap * (cols - 1)) / cols
  const cellH = (PAGE_H - gridTop - margin - gap * (rows - 1)) / rows
  const textH = 46
  const imgBoxH = cellH - textH

  const pages = paginate(doc.boards.length, cols * rows)
  const jpegPages: JpegPage[] = []

  for (const pageBoards of pages) {
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(PAGE_W * scale)
    canvas.height = Math.round(PAGE_H * scale)
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('no 2d context')
    ctx.scale(scale, scale)
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, PAGE_W, PAGE_H)

    ctx.fillStyle = '#111111'
    ctx.font = 'bold 13px sans-serif'
    ctx.textBaseline = 'top'
    ctx.fillText(truncateToWidth(ctx, title, PAGE_W - margin * 2 - 220), margin, margin)
    ctx.font = '10px sans-serif'
    ctx.fillStyle = '#555555'
    const stats = `${doc.boards.length} boards · ${(totalDurationMs(doc) / 1000).toFixed(1)}s · ${doc.width}×${doc.height}`
    ctx.fillText(stats, PAGE_W - margin - ctx.measureText(stats).width, margin + 2)
    ctx.strokeStyle = '#dddddd'
    ctx.lineWidth = 0.5
    ctx.beginPath()
    ctx.moveTo(margin, margin + 20)
    ctx.lineTo(PAGE_W - margin, margin + 20)
    ctx.stroke()

    pageBoards.forEach((boardIdx, k) => {
      const board = doc.boards[boardIdx]
      const cx = margin + (k % cols) * (cellW + gap)
      const cy = gridTop + Math.floor(k / cols) * (cellH + gap)

      ctx.fillStyle = '#f4f4f4'
      ctx.fillRect(cx, cy, cellW, imgBoxH)
      const img = images[boardIdx]
      if (img && img.width > 0 && img.height > 0) {
        const s = Math.min(cellW / img.width, imgBoxH / img.height)
        const dw = img.width * s
        const dh = img.height * s
        ctx.drawImage(img, cx + (cellW - dw) / 2, cy + (imgBoxH - dh) / 2, dw, dh)
      }
      ctx.strokeStyle = '#bbbbbb'
      ctx.strokeRect(cx, cy, cellW, imgBoxH)

      let ty = cy + imgBoxH + 4
      ctx.fillStyle = '#111111'
      ctx.font = 'bold 9px sans-serif'
      const durS = (boardDurationMs(doc, board) / 1000).toFixed(1)
      ctx.fillText(`${labels[boardIdx] ?? ''} · ${durS}s`, cx, ty)
      ty += 12
      ctx.font = '8px sans-serif'
      ctx.fillStyle = '#333333'
      for (const line of [board.dialogue, board.action || board.scenePurpose, board.notes]) {
        if (!line) continue
        ctx.fillText(truncateToWidth(ctx, line, cellW), cx, ty)
        ty += 10
      }
    })

    jpegPages.push({
      data: await canvasToJpeg(canvas, quality),
      width: canvas.width,
      height: canvas.height,
    })
  }

  const bytes = buildPdfFromJpegPages(jpegPages, PAGE_W, PAGE_H)
  return new Blob([bytes.buffer as ArrayBuffer], { type: 'application/pdf' })
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000)
}
