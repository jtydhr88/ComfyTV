import type { ContentStore } from '../content'
import { Dirty, type Command, type Direction } from '../history'

export interface ContentSlot {
  contentId: string
  url?: string
}

export class SetContentCommand implements Command {
  readonly dirtyMask = Dirty.DRAWABLE

  constructor(
    readonly label: string,
    private readonly slot: ContentSlot,
    private readonly before: string,
    private readonly after: string,
    private readonly store: ContentStore,
    private readonly beforeUrl?: string
  ) {}

  apply(dir: Direction): void {
    if (dir === 'undo') {
      this.slot.contentId = this.before
      this.slot.url = this.beforeUrl
    } else {
      this.slot.contentId = this.after
      this.slot.url = this.store.get(this.after)?.uploadedUrl ?? undefined
    }
  }

  sizeBytes(): number {
    let n = 0
    for (const id of [this.before, this.after]) {
      const e = this.store.get(id)
      if (e) n += e.width * e.height * 4
    }
    return n
  }

  contentRefs(): string[] {
    return [this.before, this.after].filter(Boolean)
  }
}
