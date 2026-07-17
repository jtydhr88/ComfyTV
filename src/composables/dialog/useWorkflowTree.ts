import { computed, ref } from 'vue'

import { linkWorkflow, listNativeWorkflows, unlinkWorkflow } from '@/api'
import type { NativeWorkflow } from '@/api'
import { removeOptionEverywhere } from '@/composables/stages/workflowCombo'
import { app } from '@/lib/comfyApp'
import { i18n } from '@/i18n'

export interface WorkflowLeafNode {
  type: 'leaf'
  key: string
  wf: NativeWorkflow
}

export interface WorkflowFolderNode {
  type: 'folder'
  key: string
  label: string
  children: WorkflowTreeNode[]
  leafCount: number
}

export type WorkflowTreeNode = WorkflowFolderNode | WorkflowLeafNode

export interface WorkflowTreeRow {
  node: WorkflowTreeNode
  depth: number
}

export function filterWorkflows(items: NativeWorkflow[], query: string): NativeWorkflow[] {
  const q = query.trim().toLowerCase()
  if (!q) return items
  return items.filter(
    (w) => w.name.toLowerCase().includes(q) || w.path.toLowerCase().includes(q),
  )
}

function sortFolder(node: WorkflowFolderNode) {
  const subFolders = node.children.filter((c): c is WorkflowFolderNode => c.type === 'folder')
  const leaves = node.children.filter((c): c is WorkflowLeafNode => c.type === 'leaf')
  subFolders.sort((a, b) => a.label.localeCompare(b.label))
  leaves.sort((a, b) => a.wf.name.localeCompare(b.wf.name))
  subFolders.forEach(sortFolder)
  node.children = [...subFolders, ...leaves]
}

function countLeaves(node: WorkflowFolderNode): number {
  node.leafCount = node.children.reduce(
    (n, c) => n + (c.type === 'leaf' ? 1 : countLeaves(c)),
    0,
  )
  return node.leafCount
}

export function buildWorkflowTree(list: NativeWorkflow[]): WorkflowFolderNode {
  const root: WorkflowFolderNode = { type: 'folder', key: 'root', label: '', children: [], leafCount: 0 }
  const folders = new Map<string, WorkflowFolderNode>([['root', root]])
  for (const wf of list) {
    const parts = wf.path.split('/')
    let parent = root
    for (let i = 0; i < parts.length - 1; i++) {
      const key = `${parent.key}/${parts[i]}`
      let node = folders.get(key)
      if (!node) {
        node = { type: 'folder', key, label: parts[i], children: [], leafCount: 0 }
        folders.set(key, node)
        parent.children.push(node)
      }
      parent = node
    }
    parent.children.push({ type: 'leaf', key: `${parent.key}/${parts[parts.length - 1]}`, wf })
  }
  sortFolder(root)
  countLeaves(root)
  return root
}

export function flattenWorkflowTree(
  root: WorkflowFolderNode,
  expandAll: boolean,
  expandedKeys: ReadonlySet<string>,
): WorkflowTreeRow[] {
  const out: WorkflowTreeRow[] = []
  const walk = (folder: WorkflowFolderNode, depth: number) => {
    for (const child of folder.children) {
      out.push({ node: child, depth })
      if (child.type === 'folder' && (expandAll || expandedKeys.has(child.key))) {
        walk(child, depth + 1)
      }
    }
  }
  walk(root, 0)
  return out
}

export interface UseWorkflowTreeOptions {
  kind: string
  onLinked: (result: { label: string }) => void
}

function toast(severity: string, summary: string, detail = '') {
  ;(app as any)?.extensionManager?.toast?.add?.({ severity, summary, detail, life: 5000 })
}

export function useWorkflowTree(opts: UseWorkflowTreeOptions) {
  const t = i18n.global.t
  const items = ref<NativeWorkflow[]>([])
  const loading = ref(true)
  const error = ref<string | null>(null)
  const filter = ref('')
  const busyPath = ref<string | null>(null)
  const expandedKeys = ref(new Set<string>())

  const filtered = computed(() => filterWorkflows(items.value, filter.value))
  const tree = computed(() => buildWorkflowTree(filtered.value))
  const searching = computed(() => filter.value.trim().length > 0)
  const rows = computed<WorkflowTreeRow[]>(() =>
    flattenWorkflowTree(tree.value, searching.value, expandedKeys.value),
  )

  function isExpanded(node: WorkflowFolderNode) {
    return searching.value || expandedKeys.value.has(node.key)
  }

  function setExpandedRecursive(node: WorkflowFolderNode, open: boolean) {
    if (open) expandedKeys.value.add(node.key)
    else expandedKeys.value.delete(node.key)
    for (const child of node.children) {
      if (child.type === 'folder') setExpandedRecursive(child, open)
    }
  }

  function toggleFolder(node: WorkflowFolderNode, e: MouseEvent) {
    const open = !expandedKeys.value.has(node.key)
    if (e.ctrlKey) {
      setExpandedRecursive(node, open)
    } else if (open) {
      expandedKeys.value.add(node.key)
    } else {
      expandedKeys.value.delete(node.key)
    }
    expandedKeys.value = new Set(expandedKeys.value)
  }

  async function load() {
    loading.value = true
    error.value = null
    try {
      items.value = await listNativeWorkflows(opts.kind)
    } catch (e: any) {
      error.value = t('workflowLink.loadFailed', { detail: String(e?.message || e) })
    } finally {
      loading.value = false
    }
  }

  async function onLink(wf: NativeWorkflow) {
    if (busyPath.value) return
    busyPath.value = wf.path
    try {
      const res = await linkWorkflow(opts.kind, wf.path)
      toast('success', t('workflowLink.linkedToast', { label: res.label }))
      opts.onLinked({ label: res.label })
      const it = items.value.find((x) => x.path === wf.path)
      if (it) { it.is_linked = true; it.linked_id = res.id }
    } catch (e: any) {
      toast('error', t('workflowLink.linkFailed'), String(e?.message || e))
    } finally {
      busyPath.value = null
    }
  }

  async function onUnlink(wf: NativeWorkflow) {
    if (busyPath.value || wf.linked_id == null) return
    busyPath.value = wf.path
    try {
      const res = await unlinkWorkflow(wf.linked_id)
      if (res.label) removeOptionEverywhere(opts.kind, res.label)
      toast('success', t('workflowLink.unlinkedToast', { label: res.label ?? wf.name }))
      const it = items.value.find((x) => x.path === wf.path)
      if (it) { it.is_linked = false; it.linked_id = null }
    } catch (e: any) {
      toast('error', t('workflowLink.unlinkFailed'), String(e?.message || e))
    } finally {
      busyPath.value = null
    }
  }

  return {
    items,
    loading,
    error,
    filter,
    busyPath,
    expandedKeys,
    rows,
    isExpanded,
    toggleFolder,
    load,
    onLink,
    onUnlink,
  }
}
