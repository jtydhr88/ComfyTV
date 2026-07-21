import { Dirty, type Command, type Direction } from '../history'
import type { Transform } from '../node'

export interface TransformSlot {
  transform: Transform
}

export class SetTransformCommand implements Command {
  readonly dirtyMask = Dirty.META

  constructor(
    readonly label: string,
    private readonly slot: TransformSlot,
    private readonly before: Transform,
    private after: Transform
  ) {}

  apply(dir: Direction): void {
    this.slot.transform = dir === 'undo' ? this.before : this.after
  }

  sizeBytes(): number {
    return 80
  }

  tryMerge(prev: Command): boolean {
    if (prev instanceof SetTransformCommand && prev.slot === this.slot) {
      prev.after = this.after
      return true
    }
    return false
  }
}
