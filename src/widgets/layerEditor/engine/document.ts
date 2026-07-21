import type { ChannelData, GroupData, NodeBase, SceneNode } from './node'

export interface Document {
  version: 2
  width: number
  height: number
  root: GroupData
  channels: ChannelData[]
  selectionId?: string
}

export interface NodeLocation {
  node: SceneNode
  parent: GroupData
  index: number
}

export function walk(
  root: GroupData,
  fn: (node: SceneNode, parent: GroupData, depth: number) => boolean | void,
  depth = 0
): void {
  for (const child of root.children) {
    const recurse = fn(child, root, depth)
    if (recurse !== false && child.kind === 'group') {
      walk(child as GroupData, fn, depth + 1)
    }
  }
}

export function findNode(root: GroupData, id: string): NodeLocation | null {
  let found: NodeLocation | null = null
  walk(root, (node, parent, _d) => {
    if (found) return false
    if (node.id === id) {
      found = { node, parent, index: parent.children.indexOf(node) }
      return false
    }
  })
  return found
}

export function parentOf(root: GroupData, id: string): GroupData | null {
  return findNode(root, id)?.parent ?? null
}

export function flattenTree(root: GroupData): SceneNode[] {
  const out: SceneNode[] = []
  walk(root, (n) => {
    out.push(n)
  })
  return out
}

export function allContentRefs(doc: Document, refsOf: (n: NodeBase) => string[]): Set<string> {
  const set = new Set<string>()
  walk(doc.root, (n) => {
    for (const id of refsOf(n)) set.add(id)
  })
  for (const ch of doc.channels) set.add(ch.contentId)
  return set
}
