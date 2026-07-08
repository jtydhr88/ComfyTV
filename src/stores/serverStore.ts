import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

import {
  type ComfyServer,
  type ServerStatus,
  type TestServerResult,
  createServer as apiCreateServer,
  deleteServer as apiDeleteServer,
  listServers as apiListServers,
  listServerStatus as apiListServerStatus,
  testServer as apiTestServer,
  updateServer as apiUpdateServer,
} from '@/api'

export const LOCAL_SERVER = 'local'
const STATUS_POLL_MS = 5000

export const useServerStore = defineStore('servers', () => {
  const servers = ref<ComfyServer[]>([])
  const loaded = ref(false)
  const loading = ref(false)

  const statuses = ref<Record<number, ServerStatus>>({})
  let pollTimer: ReturnType<typeof setInterval> | null = null
  let statusSubscribers = 0

  const enabledServers = computed(() => servers.value.filter(s => s.enabled))
  const hasRemotes = computed(() => enabledServers.value.length > 0)

  function statusFor(id: number): ServerStatus | undefined {
    return statuses.value[id]
  }

  async function pollStatus(): Promise<void> {
    try {
      const data = await apiListServerStatus()
      const next: Record<number, ServerStatus> = {}
      for (const st of data.statuses) next[st.id] = st
      statuses.value = next
    } catch (e) {
      console.warn('[ComfyTV/servers] status poll failed', e)
    }
  }

  function subscribeStatus(): () => void {
    statusSubscribers++
    if (statusSubscribers === 1) {
      void pollStatus()
      pollTimer = setInterval(() => { void pollStatus() }, STATUS_POLL_MS)
    }
    let released = false
    return () => {
      if (released) return
      released = true
      statusSubscribers = Math.max(0, statusSubscribers - 1)
      if (statusSubscribers === 0 && pollTimer != null) {
        clearInterval(pollTimer)
        pollTimer = null
      }
    }
  }

  async function load(force = false): Promise<void> {
    if (loading.value || (loaded.value && !force)) return
    loading.value = true
    try {
      const data = await apiListServers()
      servers.value = data.servers
      loaded.value = true
    } catch (e) {
      console.warn('[ComfyTV/servers] load failed', e)
    } finally {
      loading.value = false
    }
  }

  function byId(id: number): ComfyServer | undefined {
    return servers.value.find(s => s.id === id)
  }

  async function create(input: { label: string; host: string; port: number }): Promise<ComfyServer | null> {
    try {
      const data = await apiCreateServer(input)
      servers.value = [...servers.value, data.server]
      return data.server
    } catch (e) {
      console.warn('[ComfyTV/servers] create failed', e)
      return null
    }
  }

  async function update(
    id: number,
    patch: Partial<{ label: string; host: string; port: number; enabled: boolean }>,
  ): Promise<ComfyServer | null> {
    try {
      const data = await apiUpdateServer(id, patch)
      const i = servers.value.findIndex(s => s.id === id)
      if (i >= 0) servers.value.splice(i, 1, data.server)
      return data.server
    } catch (e) {
      console.warn('[ComfyTV/servers] update failed', id, e)
      return null
    }
  }

  async function remove(id: number): Promise<boolean> {
    try {
      await apiDeleteServer(id)
      servers.value = servers.value.filter(s => s.id !== id)
      return true
    } catch (e) {
      console.warn('[ComfyTV/servers] delete failed', id, e)
      return false
    }
  }

  async function testConnection(host: string, port: number): Promise<TestServerResult> {
    try {
      return await apiTestServer({ host, port })
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) }
    }
  }

  function resolveSelection(value: unknown): number | null {
    if (value == null || value === '' || value === LOCAL_SERVER) return null
    const id = Number(value)
    if (!Number.isFinite(id)) return null
    const server = byId(id)
    return server && server.enabled ? id : null
  }

  return {
    servers,
    loaded,
    loading,
    statuses,
    enabledServers,
    hasRemotes,
    load,
    byId,
    statusFor,
    pollStatus,
    subscribeStatus,
    create,
    update,
    remove,
    testConnection,
    resolveSelection,
  }
})
