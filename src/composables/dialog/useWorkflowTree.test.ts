import { beforeEach, describe, expect, it, vi } from 'vitest'

import { app } from '@/lib/comfyApp'

const listNativeWorkflows = vi.fn()
const linkWorkflow = vi.fn()
const unlinkWorkflow = vi.fn()
vi.mock('@/api', () => ({
  listNativeWorkflows: (...a: any[]) => listNativeWorkflows(...a),
  linkWorkflow: (...a: any[]) => linkWorkflow(...a),
  unlinkWorkflow: (...a: any[]) => unlinkWorkflow(...a),
}))

const removeOptionEverywhere = vi.fn()
vi.mock('@/composables/stages/workflowCombo', () => ({
  removeOptionEverywhere: (...a: any[]) => removeOptionEverywhere(...a),
}))

vi.mock('@/i18n', () => {
  const t = (key: string, args?: Record<string, unknown>) =>
    args ? `${key}:${JSON.stringify(args)}` : key
  return { i18n: { global: { t } }, t }
})

import {
  buildWorkflowTree,
  filterWorkflows,
  flattenWorkflowTree,
  useWorkflowTree,
  type WorkflowFolderNode,
} from './useWorkflowTree'

function wf(path: string, over: Record<string, unknown> = {}) {
  return {
    name: path.split('/').pop()!,
    path,
    is_linked: false,
    linked_id: null as number | null,
    ...over,
  } as any
}

const toastAdd = vi.fn()

beforeEach(() => {
  vi.clearAllMocks()
  ;(app as any).extensionManager = { toast: { add: toastAdd } }
})

describe('filterWorkflows', () => {
  it('returns all items for a blank query', () => {
    const items = [wf('a.json'), wf('sub/b.json')]
    expect(filterWorkflows(items, '  ')).toEqual(items)
  })

  it('matches on name or path, case-insensitive', () => {
    const items = [wf('Flux/gen.json'), wf('video/Other.json')]
    expect(filterWorkflows(items, 'flux')).toEqual([items[0]])
    expect(filterWorkflows(items, 'OTHER')).toEqual([items[1]])
    expect(filterWorkflows(items, 'nope')).toEqual([])
  })
})

describe('buildWorkflowTree', () => {
  it('nests folders by path segments and counts leaves', () => {
    const root = buildWorkflowTree([
      wf('a/x.json'),
      wf('a/b/y.json'),
      wf('top.json'),
    ])
    expect(root.leafCount).toBe(3)
    const folderA = root.children.find(c => c.type === 'folder') as WorkflowFolderNode
    expect(folderA.label).toBe('a')
    expect(folderA.leafCount).toBe(2)
    const folderB = folderA.children.find(c => c.type === 'folder') as WorkflowFolderNode
    expect(folderB.label).toBe('b')
    expect(folderB.leafCount).toBe(1)
  })

  it('sorts folders before leaves, each alphabetically', () => {
    const root = buildWorkflowTree([
      wf('z.json'),
      wf('a.json'),
      wf('beta/x.json'),
      wf('alpha/y.json'),
    ])
    expect(root.children.map(c => c.type === 'folder' ? c.label : c.wf.name))
      .toEqual(['alpha', 'beta', 'a.json', 'z.json'])
  })
})

describe('flattenWorkflowTree', () => {
  const root = buildWorkflowTree([wf('a/x.json'), wf('a/b/y.json'), wf('top.json')])

  it('shows only top-level rows when nothing is expanded', () => {
    const rows = flattenWorkflowTree(root, false, new Set())
    expect(rows.map(r => r.depth)).toEqual([0, 0])
  })

  it('descends into expanded folders with increasing depth', () => {
    const rows = flattenWorkflowTree(root, false, new Set(['root/a']))
    expect(rows).toHaveLength(4)
    expect(rows.filter(r => r.depth === 1)).toHaveLength(2)
  })

  it('expands everything while searching', () => {
    const rows = flattenWorkflowTree(root, true, new Set())
    expect(rows).toHaveLength(5)
  })
})

describe('useWorkflowTree', () => {
  const onLinked = vi.fn()

  function make() {
    return useWorkflowTree({ kind: 'image', onLinked })
  }

  it('load fetches workflows for the kind', async () => {
    listNativeWorkflows.mockResolvedValueOnce([wf('a.json')])
    const tree = make()
    expect(tree.loading.value).toBe(true)
    await tree.load()
    expect(listNativeWorkflows).toHaveBeenCalledWith('image')
    expect(tree.items.value).toHaveLength(1)
    expect(tree.loading.value).toBe(false)
    expect(tree.error.value).toBeNull()
  })

  it('load failure surfaces a translated error', async () => {
    listNativeWorkflows.mockRejectedValueOnce(new Error('boom'))
    const tree = make()
    await tree.load()
    expect(tree.error.value).toContain('workflowLink.loadFailed')
    expect(tree.error.value).toContain('boom')
    expect(tree.loading.value).toBe(false)
  })

  it('rows reflect the filter and expanded state', async () => {
    listNativeWorkflows.mockResolvedValueOnce([wf('a/x.json'), wf('a/y.json'), wf('top.json')])
    const tree = make()
    await tree.load()
    expect(tree.rows.value).toHaveLength(2)
    tree.filter.value = 'x'
    expect(tree.rows.value.map(r => r.node.type)).toEqual(['folder', 'leaf'])
  })

  it('toggleFolder expands and collapses; ctrl toggles recursively', async () => {
    listNativeWorkflows.mockResolvedValueOnce([wf('a/b/x.json')])
    const tree = make()
    await tree.load()
    const folderA = tree.rows.value[0].node as WorkflowFolderNode
    tree.toggleFolder(folderA, { ctrlKey: false } as MouseEvent)
    expect(tree.isExpanded(folderA)).toBe(true)
    expect(tree.rows.value).toHaveLength(2)
    tree.toggleFolder(folderA, { ctrlKey: false } as MouseEvent)
    expect(tree.isExpanded(folderA)).toBe(false)
    tree.toggleFolder(folderA, { ctrlKey: true } as MouseEvent)
    expect(tree.rows.value).toHaveLength(3)
  })

  it('onLink calls the api, notifies, and flips the item state', async () => {
    listNativeWorkflows.mockResolvedValueOnce([wf('a.json')])
    linkWorkflow.mockResolvedValueOnce({ id: 9, label: 'A' })
    const tree = make()
    await tree.load()
    await tree.onLink(tree.items.value[0])
    expect(linkWorkflow).toHaveBeenCalledWith('image', 'a.json')
    expect(onLinked).toHaveBeenCalledWith({ label: 'A' })
    expect(tree.items.value[0].is_linked).toBe(true)
    expect(tree.items.value[0].linked_id).toBe(9)
    expect(tree.busyPath.value).toBeNull()
    expect(toastAdd).toHaveBeenCalledWith(expect.objectContaining({ severity: 'success' }))
  })

  it('onLink failure toasts an error and clears busy state', async () => {
    listNativeWorkflows.mockResolvedValueOnce([wf('a.json')])
    linkWorkflow.mockRejectedValueOnce(new Error('nope'))
    const tree = make()
    await tree.load()
    await tree.onLink(tree.items.value[0])
    expect(tree.items.value[0].is_linked).toBe(false)
    expect(tree.busyPath.value).toBeNull()
    expect(toastAdd).toHaveBeenCalledWith(expect.objectContaining({ severity: 'error' }))
  })

  it('onUnlink removes the combo option and resets the item', async () => {
    listNativeWorkflows.mockResolvedValueOnce([wf('a.json', { is_linked: true, linked_id: 9 })])
    unlinkWorkflow.mockResolvedValueOnce({ label: 'A' })
    const tree = make()
    await tree.load()
    await tree.onUnlink(tree.items.value[0])
    expect(unlinkWorkflow).toHaveBeenCalledWith(9)
    expect(removeOptionEverywhere).toHaveBeenCalledWith('image', 'A')
    expect(tree.items.value[0].is_linked).toBe(false)
    expect(tree.items.value[0].linked_id).toBeNull()
  })

  it('onUnlink is a no-op without a linked_id', async () => {
    listNativeWorkflows.mockResolvedValueOnce([wf('a.json')])
    const tree = make()
    await tree.load()
    await tree.onUnlink(tree.items.value[0])
    expect(unlinkWorkflow).not.toHaveBeenCalled()
  })
})
