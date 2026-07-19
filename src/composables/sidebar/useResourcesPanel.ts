import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { deleteResource, listResources, renameResource, uploadResource } from '@/api'
import { RESOURCE_KINDS } from '@/api'
import type { Resource, ResourceKind } from '@/api'
import { askConfirm } from '@/composables/dialog/useConfirmDialog'
import { askText } from '@/composables/dialog/useTextInputDialog'

export const RESOURCE_ACCEPT: Record<ResourceKind, string> = {
  lut: '.cube,.3dl,.dat,.m3d,.csp',
  font: '.ttf,.otf,.woff,.woff2',
}

export interface ResourceGroup {
  kind: ResourceKind
  label: string
  accept: string
  resources: Resource[]
}

export function formatResourceSize(bytes: number | null | undefined): string {
  if (typeof bytes !== 'number' || !Number.isFinite(bytes) || bytes < 0) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 ** 2).toFixed(1)} MB`
}

export function useResourcesPanel(isActive: () => boolean | undefined) {
  const { t } = useI18n()

  const resources = ref<Resource[]>([])
  const loading = ref(false)
  const collapsed = ref<Set<string>>(new Set())

  const groups = computed<ResourceGroup[]>(() =>
    RESOURCE_KINDS.map((kind) => ({
      kind,
      label: t(`resources.kind.${kind}`),
      accept: RESOURCE_ACCEPT[kind],
      resources: resources.value.filter((r) => r.kind === kind),
    })),
  )

  async function load(): Promise<void> {
    loading.value = true
    try {
      resources.value = (await listResources()).resources
    } catch {
      resources.value = []
    } finally {
      loading.value = false
    }
  }

  function isCollapsed(kind: string): boolean {
    return collapsed.value.has(kind)
  }

  function toggleGroup(kind: string): void {
    const next = new Set(collapsed.value)
    if (next.has(kind)) next.delete(kind)
    else next.add(kind)
    collapsed.value = next
  }

  async function onRename(resource: Resource): Promise<void> {
    const name = (await askText({
      title: t('resources.renameTitle'),
      label: t('resources.nameLabel'),
      initialValue: resource.name,
    }))?.trim()
    if (!name || name === resource.name) return
    try {
      await renameResource(resource.id, name)
    } catch {
      return
    }
    await load()
  }

  async function onRemove(resource: Resource): Promise<void> {
    const ok = await askConfirm({
      title: t('resources.removeTitle'),
      message: t('resources.removeConfirm', { name: resource.name }),
      danger: true,
    })
    if (!ok) return
    try {
      await deleteResource(resource.id)
    } catch {
      return
    }
    await load()
  }

  async function onUpload(kind: ResourceKind, e: Event): Promise<void> {
    const input = e.target as HTMLInputElement
    const file = input.files?.[0]
    if (!file) return
    try {
      await uploadResource(kind, file)
      await load()
    } catch {
    } finally {
      input.value = ''
    }
  }

  watch(isActive, (active) => {
    if (active) void load()
  }, { immediate: true })

  return {
    resources,
    loading,
    groups,
    load,
    isCollapsed,
    toggleGroup,
    onRename,
    onRemove,
    onUpload,
  }
}
