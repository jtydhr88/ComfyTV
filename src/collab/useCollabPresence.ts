import { effectScope, watch } from 'vue'
import { useEventListener, useIntervalFn, useThrottleFn, useWebSocket } from '@vueuse/core'

import { i18n } from '@/i18n'
import { updateCollabBadge } from '@/collab/topbarBadge'

import { usePresenceStore } from '@/collab/presenceStore'
import type { IdleState } from '@/collab/presenceStore'
import { colorForSid, fetchCollabSession, loadName, saveName } from '@/collab/identity'
import { createCoEditEngine } from '@/collab/coedit'
import type { CoEditEngine } from '@/collab/coedit'
import { installExecRelay } from '@/collab/execRelay'
import { buildCanvasSnapshot } from '@/composables/stages/useCanvasMirror'

export const COLLAB_PROTOCOL = 1
const CURSOR_THROTTLE_MS = 33
const ROSTER_TICK_MS = 2000
const EDIT_TICK_MS = 500
const IDLE_AFTER_MS = 60_000
const FORCE_RESEND_MS = 30_000

export interface CollabPresenceDeps {
  resolveProjectId: () => string
  resolveApp: () => any
  resolveStageState: (node: any) => { output?: string | null; running?: boolean; error?: { message: string } | null } | undefined
}

let sendRef: ((data: string) => boolean | void) | null = null
let depsRef: CollabPresenceDeps | null = null
let engineRef: CoEditEngine | null = null

export function joinCoEdit(): void {
  if (!depsRef || !engineRef) return
  void engineRef.requestJoin(depsRef.resolveProjectId())
}

export function updateCollabName(name: string): void {
  const store = usePresenceStore()
  const clean = name.trim().slice(0, 40)
  if (!clean) return
  store.selfName = clean
  saveName(clean)
  sendRef?.(JSON.stringify({ type: 'update', name: clean }))
}

export function startCoEdit(): void {
  if (!depsRef || !engineRef) return
  engineRef.startHosting(depsRef.resolveProjectId())
}

function wsUrl(a: any): string {
  let path = '/comfytv/collab'
  try { path = a.api?.apiURL?.(path) ?? path } catch { /* keep default */ }
  if (/^https?:/i.test(path)) return path.replace(/^http/i, 'ws')
  const proto = location.protocol === 'https:' ? 'wss://' : 'ws://'
  return proto + location.host + path
}

function selectedIds(a: any): string[] {
  const sel = a.canvas?.selected_nodes
  if (!sel) return []
  const nodes: any[] = typeof sel[Symbol.iterator] === 'function'
    ? Array.from(sel as Iterable<any>)
    : Object.values(sel)
  return nodes.map((n) => String(n?.id ?? '')).filter(Boolean)
}

function viewportOf(a: any): Record<string, number> | null {
  const ds = a.canvas?.ds
  if (!ds?.offset) return null
  return { x: ds.offset[0], y: ds.offset[1], scale: ds.scale ?? 1 }
}

export function installCollabPresence(a: any, deps: CollabPresenceDeps): (() => void) | false {
  if (a.__comfytvCollabInstalled) return false
  a.__comfytvCollabInstalled = true

  const scope = effectScope(true)
  const store = usePresenceStore()
  depsRef = deps

  let cursor: { x: number; y: number } | null = null
  let idle: IdleState = 'active'
  let lastActivity = Date.now()
  let lastRosterProbe = ''
  let lastCanvasSent = ''
  let sendPresenceRef: (() => void) | null = null
  let execRelayRef: { onPeerExec: (msg: Record<string, any>) => void } | null = null
  const toastedDocs = new Set<string>()

  function onWelcome(_msg: Record<string, any>) {
    const pid = deps.resolveProjectId()
    if (store.docs[pid] != null && !store.coEditing) {
      engineRef?.rejoinIfRemembered(pid)
    }
  }

  void (async () => {
    try {
      const { fetchSettings } = await import('@/api')
      const res = await fetchSettings()
      const row = res.settings.find((r: any) => r.key === 'enable-collab')
      if (row?.value !== true) return
    } catch {
      return
    }
    let sid: string
    try {
      sid = await fetchCollabSession()
    } catch (e) {
      console.warn('[ComfyTV/collab] session unavailable, presence disabled', e)
      return
    }
    store.featureEnabled = true
    store.selfName = loadName()
    store.selfColor = colorForSid(sid)

    scope.run(() => {
      const { send, close } = useWebSocket(wsUrl(a), {
        autoReconnect: { retries: -1, delay: 3000 },
        onConnected: () => {
          lastCanvasSent = ''
          send(JSON.stringify({
            type: 'hello',
            protocol: COLLAB_PROTOCOL,
            name: store.selfName,
            color: store.selfColor,
            project_id: deps.resolveProjectId(),
          }))
        },
        onMessage: (_ws, event) => {
          let msg: Record<string, any>
          try {
            msg = JSON.parse(String(event.data))
          } catch { return }
          if (msg.type === 'incompatible') {
            console.warn('[ComfyTV/collab] protocol mismatch — reload the page',
              msg.server_protocol)
            close()
            return
          }
          if (typeof msg.type === 'string' && msg.type.startsWith('edit_')
              && engineRef?.onMessage(msg)) {
            return
          }
          if (msg.type === 'peer-exec') {
            execRelayRef?.onPeerExec(msg)
            return
          }
          store.applyMessage(msg)
          if (msg.type === 'welcome') onWelcome(msg)
          if (msg.type === 'peer-join') sendPresenceRef?.()
          if (msg.type === 'edit_state' && !store.coEditing
              && msg.project_id === deps.resolveProjectId()
              && !toastedDocs.has(String(msg.project_id))) {
            toastedDocs.add(String(msg.project_id))
            a.extensionManager?.toast?.add?.({
              severity: 'info',
              summary: i18n.global.t('collab.toastTitle'),
              detail: i18n.global.t('collab.someoneStarted'),
              life: 10000,
            })
          }
        },
        onDisconnected: () => {
          engineRef?.reset()
          store.reset()
        },
      })
      sendRef = send
      engineRef = createCoEditEngine({
        resolveApp: deps.resolveApp,
        send,
        resolveSelfConnId: () => store.selfConnId,
        resolveProjectId: deps.resolveProjectId,
        onEditingChange: (editing) => { store.coEditing = editing },
      })
      const throttledFastPos = useThrottleFn(() => engineRef?.fastPos(), CURSOR_THROTTLE_MS, true)
      execRelayRef = installExecRelay({
        a, send, resolveProjectId: deps.resolveProjectId,
      })

      // native snapshot undo would revert other people's work too
      useEventListener(window, 'keydown', (e: KeyboardEvent) => {
        if (!store.coEditing) return
        if (!(e.ctrlKey || e.metaKey)) return
        const t = e.target as HTMLElement | null
        if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return
        const k = e.key.toLowerCase()
        if (k === 'z' && !e.shiftKey) {
          e.preventDefault(); e.stopPropagation()
          engineRef?.undoLocal()
        } else if (k === 'y' || (k === 'z' && e.shiftKey)) {
          e.preventDefault(); e.stopPropagation()
          engineRef?.redoLocal()
        }
      }, { capture: true })

      useIntervalFn(() => {
        engineRef?.tick(deps.resolveProjectId())
      }, EDIT_TICK_MS)

      watch(() => [store.peerCount, store.coEditing] as const, ([count, editing]) => {
        updateCollabBadge(count, editing)
      }, { immediate: true })

      const sendPresence = () => {
        send(JSON.stringify({
          type: 'presence',
          project_id: deps.resolveProjectId(),
          cursor,
          selected: selectedIds(a),
          viewport: viewportOf(a),
          idle,
        }))
      }
      sendPresenceRef = sendPresence
      const throttledSend = useThrottleFn(sendPresence, CURSOR_THROTTLE_MS, true)

      const onPointerMove = (e: PointerEvent) => {
        lastActivity = Date.now()
        const conv = a.canvas?.convertEventToCanvasOffset?.(e)
        if (conv) cursor = { x: conv[0], y: conv[1] }
        if (store.peerCount > 0) void throttledSend()
        void throttledFastPos()
      }
      const onPointerLeave = () => {
        cursor = null
        if (store.peerCount > 0) sendPresence()
      }

      const attach = () => {
        if (!scope.active) return
        const el = a.canvas?.canvas as HTMLCanvasElement | undefined
        if (!el) { requestAnimationFrame(attach); return }
        scope.run(() => {
          useEventListener(el, 'pointermove', onPointerMove)
          useEventListener(el, 'pointerleave', onPointerLeave)
        })
      }
      attach()

      useIntervalFn(() => {
        const hidden = typeof document !== 'undefined' && document.visibilityState === 'hidden'
        idle = hidden ? 'away'
          : Date.now() - lastActivity > IDLE_AFTER_MS ? 'idle' : 'active'
        const pid = deps.resolveProjectId()
        const probe = JSON.stringify([selectedIds(a), idle, pid,
          Math.floor(Date.now() / FORCE_RESEND_MS)])
        if (probe !== lastRosterProbe) {
          lastRosterProbe = probe
          sendPresence()
        }
        if (engineRef?.isScribe()
            && store.peerList.some((p) => p.projectId === pid)) {
          const snapshot = buildCanvasSnapshot(deps)
          if (snapshot) {
            const serialized = JSON.stringify(snapshot.stages)
            if (serialized !== lastCanvasSent) {
              lastCanvasSent = serialized
              send(JSON.stringify({
                type: 'canvas', project_id: pid, stages: snapshot.stages,
              }))
            }
          }
        }
      }, ROSTER_TICK_MS)

      useEventListener(document, 'visibilitychange', () => {
        idle = document.visibilityState === 'hidden' ? 'away' : 'active'
        if (idle === 'active') {
          lastActivity = Date.now()
          const pid = deps.resolveProjectId()
          if (store.docs[pid] != null && !store.coEditing) {
            engineRef?.rejoinIfRemembered(pid)
          }
        }
        sendPresence()
      })
    })
  })()

  return () => {
    scope.stop()
    sendRef = null
    depsRef = null
    engineRef = null
    execRelayRef = null
    store.reset()
    a.__comfytvCollabInstalled = false
  }
}
