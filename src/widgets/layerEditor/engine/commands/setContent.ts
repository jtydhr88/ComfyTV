import type { ContentStore } from '../content'
import { Dirty, type Command, type Direction } from '../history'

export interface ContentSlot {
  contentId: string
}

export class SetContentCommand implements Command {
  readonly dirtyMask = Dirty.DRAWABLE

  constructor(
    readonly label: string,
    private readonly slot: ContentSlot,
    private readonly before: string,
    private readonly after: string,
    private readonly store: ContentStore
  ) {}

  apply(dir: Direction): void {
    this.slot.contentId = dir === 'undo' ? this.before : this.after
  }

  sizeBytes(): number {
    const e = this.store.get(this.after)
    return e ? e.width * e.height * 4 : 0
  }
}
