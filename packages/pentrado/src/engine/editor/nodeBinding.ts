import type { ContentStore } from '../content'
import { walk, type Document } from '../document'
import type { RasterData } from '../node'

export interface UploadJob {
  contentId: string
  channel: 'content' | 'mask'
  canvas: HTMLCanvasElement
  commitUrl: (url: string) => void
}

export function pendingUploads(doc: Document, content: ContentStore): UploadJob[] {
  const jobs: UploadJob[] = []

  const push = (contentId: string, channel: UploadJob['channel'], commitUrl: (u: string) => void) => {
    if (!content.has(contentId)) return
    jobs.push({
      contentId,
      channel,
      get canvas() {
        return content.exportCanvas?.(contentId) ?? content.get(contentId)!.canvas
      },
      commitUrl,
    })
  }
  walk(doc.root, (node) => {
    if (node.kind === 'raster') {
      const r = node as RasterData
      if (r.contentId && !r.url) push(r.contentId, 'content', (u) => (r.url = u))
    }
    const m = node.mask
    if (m && m.contentId && !m.url && m.enabled !== undefined) {
      push(m.contentId, 'mask', (u) => (m.url = u))
    }
  })
  for (const ch of doc.channels) {
    if (ch.contentId && !ch.url) push(ch.contentId, 'mask', (u) => (ch.url = u))
  }
  return jobs
}

export function liveContentIds(doc: Document, refsOf: (node: import('../node').NodeBase) => string[]): Set<string> {
  const set = new Set<string>()
  walk(doc.root, (node) => {
    for (const id of refsOf(node)) set.add(id)
  })
  for (const ch of doc.channels) set.add(ch.contentId)
  return set
}
