import { computed, onUnmounted, ref, watch } from 'vue'

import { t } from '@/i18n'
import type { LGraphNode } from '@/lib/comfyApp'
import { LOCAL_SERVER, useServerStore } from '@/stores/serverStore'
import { isPoolPickerKind, type StageState } from '@/stores/stageStore'

export function useStageServerSelect(
  getState: () => StageState,
  getNode: () => LGraphNode | undefined,
) {
  const serverStore = useServerStore()
  void serverStore.load()

  const showServerSelect = computed(() => {
    const s = getState()
    return s.variant !== 'loader'
      && s.variant !== 'transform'
      && !isPoolPickerKind(s.kind)
      && !!getNode()
      && serverStore.hasRemotes
  })

  function remoteLabel(id: number, label: string): string {
    const st = serverStore.statusFor(id)
    if (!st) return label
    if (!st.online) return `${label} · ${t('servers.status.offline')}`
    const total = st.running + st.pending
    return total > 0 ? `${label} · ${t('servers.status.queueShort', { n: total })}` : label
  }

  const serverOptions = computed(() => [
    { value: LOCAL_SERVER, label: t('servers.local') },
    ...serverStore.enabledServers.map(s => ({
      value: String(s.id),
      label: remoteLabel(s.id, s.label),
    })),
  ])

  let releaseStatus: (() => void) | null = null
  watch(showServerSelect, (on) => {
    if (on && !releaseStatus) {
      releaseStatus = serverStore.subscribeStatus()
    } else if (!on && releaseStatus) {
      releaseStatus()
      releaseStatus = null
    }
  }, { immediate: true })
  onUnmounted(() => {
    releaseStatus?.()
    releaseStatus = null
  })

  const serverSelectionTick = ref(0)
  const serverSelection = computed(() => {
    void serverSelectionTick.value
    const raw = (getNode() as any)?.properties?.comfytv_server
    if (raw == null || raw === '' || raw === LOCAL_SERVER) return LOCAL_SERVER
    const id = Number(raw)
    const server = Number.isFinite(id) ? serverStore.byId(id) : undefined
    return server?.enabled ? String(id) : LOCAL_SERVER
  })

  function onServerPick(v: string | number): void {
    const n = getNode() as any
    if (!n) return
    n.properties = n.properties || {}
    n.properties.comfytv_server = String(v)
    serverSelectionTick.value++
  }

  return { showServerSelect, serverOptions, serverSelection, onServerPick }
}
