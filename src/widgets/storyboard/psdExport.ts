import type { Layer, Psd } from 'ag-psd'

import { boardDurationMs, boardImageUrl, type StoryboardDoc } from './boardDoc'

export interface StoryboardPsdGuides {
  center: boolean
  thirds: boolean
  grid: boolean
}

const ARTBOARD_GAP = 64
const MAX_PSD_DIM = 30000

function loadImage(url: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => resolve(null)
    img.src = url
  })
}

function boardCanvas(img: HTMLImageElement | null, w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const g = c.getContext('2d')!
  g.fillStyle = '#ffffff'
  g.fillRect(0, 0, w, h)
  if (img) g.drawImage(img, 0, 0, w, h)
  return c
}

async function loadBoardCanvases(doc: StoryboardDoc): Promise<HTMLCanvasElement[]> {
  const images = await Promise.all(
    doc.boards.map((b) => {
      const url = boardImageUrl(b)
      return url ? loadImage(url) : Promise.resolve(null)
    })
  )
  return images.map((img) => boardCanvas(img, doc.width, doc.height))
}

function guideLocations(size: number, offset: number, guides: StoryboardPsdGuides): number[] {
  const out = new Set<number>()
  if (guides.center) out.add(offset + size / 2)
  if (guides.thirds) {
    out.add(offset + size / 3)
    out.add(offset + (size * 2) / 3)
  }
  if (guides.grid) {
    for (let i = 1; i < 8; i++) out.add(offset + (size * i) / 8)
  }
  return [...out].map((v) => Math.round(v))
}

function applyGuides(psd: Psd, doc: StoryboardDoc, guides: StoryboardPsdGuides, offsets: number[]): void {
  if (!guides.center && !guides.thirds && !guides.grid) return
  const horizontal = guideLocations(doc.height, 0, guides)
  const vertical = offsets.flatMap((x) => guideLocations(doc.width, x, guides))
  if (!horizontal.length && !vertical.length) return
  psd.imageResources = {
    ...psd.imageResources,
    gridAndGuidesInformation: {
      guides: [
        ...horizontal.map((location) => ({ location, direction: 'horizontal' as const })),
        ...vertical.map((location) => ({ location, direction: 'vertical' as const })),
      ],
    },
  }
}

async function writeBlob(psd: Psd): Promise<Blob> {
  const { writePsd } = await import('ag-psd')
  const psb = psd.width > MAX_PSD_DIM || psd.height > MAX_PSD_DIM
  const buffer = writePsd(psd, psb ? { psb: true } : undefined)
  return new Blob([buffer], { type: 'image/vnd.adobe.photoshop' })
}

export async function exportStoryboardArtboardsPsd(
  doc: StoryboardDoc,
  labels: string[],
  guides: StoryboardPsdGuides = { center: false, thirds: false, grid: false }
): Promise<Blob> {
  if (!doc.boards.length) throw new Error('no boards')
  const canvases = await loadBoardCanvases(doc)
  const w = doc.width
  const h = doc.height
  const totalW = doc.boards.length * w + (doc.boards.length - 1) * ARTBOARD_GAP

  const composite = document.createElement('canvas')
  composite.width = totalW
  composite.height = h
  const g = composite.getContext('2d')!
  const offsets: number[] = []
  const children: Layer[] = []
  for (let i = 0; i < doc.boards.length; i++) {
    const x = i * (w + ARTBOARD_GAP)
    offsets.push(x)
    g.drawImage(canvases[i], x, 0)
    const name = labels[i] || `Board ${i + 1}`
    children.push({
      name,
      opened: true,
      artboard: { rect: { top: 0, left: x, bottom: h, right: x + w } },
      children: [
        {
          name,
          canvas: canvases[i],
          left: x,
          top: 0,
          right: x + w,
          bottom: h,
        },
      ],
    })
  }

  const psd: Psd = { width: totalW, height: h, canvas: composite, children }
  applyGuides(psd, doc, guides, offsets)
  return writeBlob(psd)
}

export async function exportStoryboardAnimationPsd(
  doc: StoryboardDoc,
  labels: string[],
  guides: StoryboardPsdGuides = { center: false, thirds: false, grid: false }
): Promise<Blob> {
  if (!doc.boards.length) throw new Error('no boards')
  const canvases = await loadBoardCanvases(doc)
  const frameIds = doc.boards.map((_, i) => i + 1)

  const children: Layer[] = doc.boards.map((board, i) => {
    const own = frameIds[i]
    const others = frameIds.filter((id) => id !== own)
    const animationFrames = [{ frames: [own], enable: true }]
    if (others.length) animationFrames.push({ frames: others, enable: false })
    return {
      name: labels[i] || `Board ${i + 1}`,
      canvas: canvases[i],
      left: 0,
      top: 0,
      right: doc.width,
      bottom: doc.height,
      hidden: i !== 0,
      animationFrames,
    }
  })

  const psd: Psd = {
    width: doc.width,
    height: doc.height,
    canvas: canvases[0],
    children,
    imageResources: {
      animations: {
        frames: doc.boards.map((board, i) => ({
          id: frameIds[i],
          delay: boardDurationMs(doc, board) / 1000,
          dispose: 'none',
        })),
        animations: [{ id: 1, frames: frameIds, repeats: 0, activeFrame: 0 }],
      },
    },
  }
  applyGuides(psd, doc, guides, [0])
  return writeBlob(psd)
}
