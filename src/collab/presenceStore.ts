import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

export type IdleState = 'active' | 'idle' | 'away'

export interface CollabPeer {
  connId: string
  peerId: string
  name: string
  color: string
  projectId: string
  cursor: { x: number; y: number } | null
  selected: string[]
  idle: IdleState
}

export interface DriverCanvas {
  projectId: string
  stages: any[]
  receivedAt: number
  fromConn: string
}

interface PeerWire {
  conn_id: string
  peer_id: string
  name: string
  color: string
  project_id: string
  presence?: Record<string, unknown>
}

function fromWire(raw: PeerWire): CollabPeer {
  const presence = raw.presence ?? {}
  return {
    connId: raw.conn_id,
    peerId: raw.peer_id,
    name: raw.name,
    color: raw.color,
    projectId: raw.project_id,
    cursor: (presence.cursor as CollabPeer['cursor']) ?? null,
    selected: Array.isArray(presence.selected) ? presence.selected.map(String) : [],
    idle: (presence.idle as IdleState) ?? 'active',
  }
}

export const usePresenceStore = defineStore('comfytv-presence', () => {
  const peers = ref<Record<string, CollabPeer>>({})
  const featureEnabled = ref(false)
  const selfConnId = ref('')
  const selfPeerId = ref('')
  const selfName = ref('')
  const selfColor = ref('')
  const connected = ref(false)
  const driverCanvas = ref<DriverCanvas | null>(null)
  const coEditing = ref(false)
  const docs = ref<Record<string, number>>({})
  const remoteExec = ref<Record<string, { node: string; value: number; max: number }>>({})

  const peerList = computed(() => Object.values(peers.value))
  const peerCount = computed(() => peerList.value.length)

  function reset() {
    peers.value = {}
    selfConnId.value = ''
    connected.value = false
    driverCanvas.value = null
    coEditing.value = false
    docs.value = {}
    remoteExec.value = {}
  }

  function setRemoteExec(connId: string, value: { node: string; value: number; max: number } | null) {
    const next = { ...remoteExec.value }
    if (value) next[connId] = value
    else delete next[connId]
    remoteExec.value = next
  }

  function applyMessage(msg: Record<string, any>) {
    switch (msg.type) {
      case 'welcome': {
        selfConnId.value = String(msg.conn_id ?? '')
        selfPeerId.value = String(msg.peer_id ?? '')
        connected.value = true
        const next: Record<string, CollabPeer> = {}
        for (const raw of msg.peers ?? []) next[raw.conn_id] = fromWire(raw)
        peers.value = next
        const nextDocs: Record<string, number> = {}
        for (const [pid, clock] of Object.entries(msg.docs ?? {})) {
          nextDocs[pid] = Number(clock) || 0
        }
        docs.value = nextDocs
        break
      }
      case 'edit_state': {
        const pid = String(msg.project_id ?? '')
        if (pid) docs.value = { ...docs.value, [pid]: Number(msg.clock) || 0 }
        break
      }
      case 'peer-canvas': {
        driverCanvas.value = {
          projectId: String(msg.project_id ?? ''),
          stages: Array.isArray(msg.stages) ? msg.stages : [],
          receivedAt: Date.now(),
          fromConn: String(msg.conn_id ?? ''),
        }
        break
      }
      case 'peer-join':
      case 'peer-update': {
        const raw = msg.peer
        if (!raw?.conn_id) break
        const prev = peers.value[raw.conn_id]
        const peer = fromWire(raw)
        if (prev && msg.type === 'peer-update') {
          peer.cursor = prev.cursor
          peer.selected = prev.selected
          peer.idle = prev.idle
        }
        peers.value = { ...peers.value, [raw.conn_id]: peer }
        break
      }
      case 'peer-leave': {
        if (!msg.conn_id) break
        setRemoteExec(String(msg.conn_id), null)
        if (!(msg.conn_id in peers.value)) break
        const next = { ...peers.value }
        delete next[msg.conn_id]
        peers.value = next
        break
      }
      case 'peer-presence': {
        const prev = peers.value[msg.conn_id]
        if (!prev) break
        peers.value = {
          ...peers.value,
          [msg.conn_id]: {
            ...prev,
            projectId: typeof msg.project_id === 'string' ? msg.project_id : prev.projectId,
            cursor: msg.cursor ?? null,
            selected: Array.isArray(msg.selected) ? msg.selected.map(String) : prev.selected,
            idle: (msg.idle as IdleState) ?? prev.idle,
          },
        }
        break
      }
    }
  }

  return {
    peers, featureEnabled, selfConnId, selfPeerId, selfName, selfColor, connected,
    driverCanvas, coEditing, docs,
    remoteExec,
    peerList, peerCount,
    setRemoteExec,
    reset, applyMessage,
  }
})
