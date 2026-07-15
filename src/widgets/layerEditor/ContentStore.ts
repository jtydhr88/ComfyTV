import { generateId } from './stateSerde'

export interface ContentEntry {
  id: string
  canvas: HTMLCanvasElement
  width: number
  height: number
  uploadedUrl: string | null
}
export class ContentStore {
  private entries = new Map<string, ContentEntry>()

  register(canvas: HTMLCanvasElement, opts?: { id?: string; uploadedUrl?: string }): string {
    const id = opts?.id ?? generateId('content')
    this.entries.set(id, {
      id,
      canvas,
      width: canvas.width,
      height: canvas.height,
      uploadedUrl: opts?.uploadedUrl ?? null,
    })
    return id
  }

  get(id: string): ContentEntry | undefined {
    return this.entries.get(id)
  }

  has(id: string): boolean {
    return this.entries.has(id)
  }

  markUploaded(id: string, url: string): void {
    const e = this.entries.get(id)
    if (e) e.uploadedUrl = url
  }

  dirtyIds(): string[] {
    const out: string[] = []
    for (const e of this.entries.values()) {
      if (!e.uploadedUrl) out.push(e.id)
    }
    return out
  }
  collectGarbage(liveIds: Set<string>): void {
    for (const id of this.entries.keys()) {
      if (!liveIds.has(id)) this.entries.delete(id)
    }
  }

  totalBytes(): number {
    let total = 0
    for (const e of this.entries.values()) total += e.width * e.height * 4
    return total
  }

  clear(): void {
    this.entries.clear()
  }
}
