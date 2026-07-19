import { computed, onMounted, onUnmounted, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import type { ComfyServer, RemoteCapabilityProbe, TestServerResult } from '@/api'
import { fetchRemoteCapabilities } from '@/api'
import { askConfirm } from '@/composables/dialog/useConfirmDialog'
import { missingNodeIds } from '@/composables/stages/useRemotePreflight'
import { useServerStore } from '@/stores/serverStore'

export interface ServerForm {
  id: number | null
  label: string
  host: string
  port: string
}

export type ServerStatusKind = 'unknown' | 'offline' | 'busy' | 'idle'

export interface ServerCapsInfo {
  kind: 'comfytv' | 'comfyOnly'
  label: string
  missing: string[]
}

export function useServersPanel() {
  const { t } = useI18n()
  const store = useServerStore()

  const form = ref<ServerForm | null>(null)
  const formTest = ref<TestServerResult | null>(null)
  const formCaps = ref<RemoteCapabilityProbe | null>(null)
  const formError = ref('')
  const testing = ref(false)
  const saving = ref(false)
  const testingId = ref<number | null>(null)
  const rowTests = reactive<Record<number, TestServerResult>>({})
  const expandedCapsId = ref<number | null>(null)

  const formValid = computed(() => {
    if (!form.value) return false
    const port = Number(form.value.port)
    return form.value.label.trim() !== ''
      && form.value.host.trim() !== ''
      && Number.isInteger(port) && port > 0 && port < 65536
  })

  function openForm(server?: ComfyServer) {
    formTest.value = null
    formCaps.value = null
    formError.value = ''
    form.value = server
      ? { id: server.id, label: server.label, host: server.host, port: String(server.port) }
      : { id: null, label: '', host: '', port: '8188' }
  }

  function closeForm() {
    form.value = null
    formTest.value = null
    formCaps.value = null
    formError.value = ''
  }

  async function onTestForm() {
    if (!form.value || !formValid.value) return
    testing.value = true
    formTest.value = null
    formCaps.value = null
    try {
      const host = form.value.host.trim()
      const port = Number(form.value.port)
      formTest.value = await store.testConnection(host, port)
      formCaps.value = await fetchRemoteCapabilities(`http://${host}:${port}`)
    } finally {
      testing.value = false
    }
  }

  async function onTestRow(server: ComfyServer) {
    testingId.value = server.id
    try {
      rowTests[server.id] = await store.testConnection(server.host, server.port)
      await store.probeCapabilities(server.id, true)
    } finally {
      testingId.value = null
    }
  }

  async function onSave() {
    if (!form.value || !formValid.value || saving.value) return
    saving.value = true
    formError.value = ''
    try {
      const payload = {
        label: form.value.label.trim(),
        host: form.value.host.trim(),
        port: Number(form.value.port),
      }
      const result = form.value.id == null
        ? await store.create(payload)
        : await store.update(form.value.id, payload)
      if (result) closeForm()
      else formError.value = t('servers.form.saveFailed')
    } finally {
      saving.value = false
    }
  }

  async function onToggle(server: ComfyServer) {
    await store.update(server.id, { enabled: !server.enabled })
  }

  async function onDelete(server: ComfyServer) {
    const ok = await askConfirm({
      title: t('servers.delete'),
      message: t('servers.deleteConfirm', { label: server.label }),
      danger: true,
    })
    if (ok) await store.remove(server.id)
  }

  function statusKind(server: ComfyServer): ServerStatusKind {
    const st = store.statusFor(server.id)
    if (!st) return 'unknown'
    if (!st.online) return 'offline'
    return st.running + st.pending > 0 ? 'busy' : 'idle'
  }

  function statusBadge(server: ComfyServer): string {
    const st = store.statusFor(server.id)
    if (!st || !st.online) return ''
    const total = st.running + st.pending
    return total > 0 ? t('servers.status.queueShort', { n: total }) : ''
  }

  function statusTitle(server: ComfyServer): string {
    const st = store.statusFor(server.id)
    if (!st) return t('servers.status.unknown')
    if (!st.online) {
      return st.error
        ? `${t('servers.status.offline')} — ${st.error}`
        : t('servers.status.offline')
    }
    const total = st.running + st.pending
    const parts = [
      total > 0
        ? t('servers.status.queueDetail', { running: st.running, pending: st.pending })
        : t('servers.status.idle'),
    ]
    if (st.jobs) parts.push(t('servers.status.fromComfyTV', { n: st.jobs }))
    return `${t('servers.status.online')} · ${parts.join(' · ')}`
  }

  function capsFromProbe(
    probe: RemoteCapabilityProbe | null | undefined,
    pingOk: boolean,
  ): ServerCapsInfo | null {
    if (!probe) return null
    if (!probe.installed) {
      return pingOk
        ? { kind: 'comfyOnly', label: t('servers.caps.comfyOnly'), missing: [] }
        : null
    }
    return {
      kind: 'comfytv',
      label: t('servers.caps.badge', { version: probe.capabilities.version }),
      missing: missingNodeIds(store.localCapabilities, probe),
    }
  }

  function capsInfo(server: ComfyServer): ServerCapsInfo | null {
    const pingOk = rowTests[server.id]?.ok === true
      || store.statusFor(server.id)?.online === true
    return capsFromProbe(store.capabilityProbeFor(server.id), pingOk)
  }

  const formCapsInfo = computed(() =>
    capsFromProbe(formCaps.value, formTest.value?.ok === true))

  function toggleCapsExpand(server: ComfyServer) {
    expandedCapsId.value = expandedCapsId.value === server.id ? null : server.id
  }

  let releaseStatus: (() => void) | null = null

  onMounted(() => {
    void store.load()
    void store.loadLocalCapabilities()
    releaseStatus = store.subscribeStatus()
  })

  onUnmounted(() => {
    releaseStatus?.()
    releaseStatus = null
  })

  return {
    store,
    form,
    formTest,
    formCaps,
    formCapsInfo,
    formError,
    formValid,
    testing,
    saving,
    testingId,
    rowTests,
    expandedCapsId,
    openForm,
    closeForm,
    onTestForm,
    onTestRow,
    onSave,
    onToggle,
    onDelete,
    statusKind,
    statusBadge,
    statusTitle,
    capsInfo,
    toggleCapsExpand,
  }
}
