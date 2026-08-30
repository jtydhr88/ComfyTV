import { useEventListener, useThrottleFn } from '@vueuse/core'

import { usePresenceStore } from '@/collab/presenceStore'

const PROGRESS_THROTTLE_MS = 250

export interface ExecRelayDeps {
  a: any
  send: (data: string) => boolean | void
  resolveProjectId: () => string
}

function detailNode(detail: any): string {
  if (detail == null) return ''
  if (typeof detail === 'object') {
    return String(detail.display_node ?? detail.node ?? '')
  }
  return String(detail)
}

export function installExecRelay(deps: ExecRelayDeps): { onPeerExec: (msg: Record<string, any>) => void } {
  const store = usePresenceStore()

  const sendExec = (payload: Record<string, unknown>) => {
    if (!store.coEditing) return
    deps.send(JSON.stringify({
      type: 'exec', project_id: deps.resolveProjectId(), ...payload,
    }))
  }
  const throttledProgress = useThrottleFn((node: string, value: number, max: number) => {
    sendExec({ event: 'progress', node, value, max })
  }, PROGRESS_THROTTLE_MS, true)

  const api = deps.a?.api
  if (api?.addEventListener) {
    useEventListener(api, 'executing', (e: any) => {
      const node = detailNode(e?.detail)
      if (!node) sendExec({ event: 'idle' })
      else sendExec({ event: 'running', node })
    })
    useEventListener(api, 'progress', (e: any) => {
      const d = e?.detail ?? {}
      const node = detailNode(d)
      if (node) void throttledProgress(node, Number(d.value) || 0, Number(d.max) || 0)
    })
    useEventListener(api, 'executed', (e: any) => {
      const d = e?.detail ?? {}
      const node = detailNode(d)
      if (node && d.output != null) sendExec({ event: 'output', node, output: d.output })
    })
    useEventListener(api, 'execution_error', () => sendExec({ event: 'idle' }))
  }

  function onPeerExec(msg: Record<string, any>) {
    const conn = String(msg.conn_id ?? '')
    switch (msg.event) {
      case 'running':
        store.setRemoteExec(conn, { node: String(msg.node ?? ''), value: 0, max: 0 })
        break
      case 'progress':
        store.setRemoteExec(conn, {
          node: String(msg.node ?? ''),
          value: Number(msg.value) || 0,
          max: Number(msg.max) || 0,
        })
        break
      case 'idle':
        store.setRemoteExec(conn, null)
        break
      case 'output': {
        if (!store.coEditing) break
        const nodeId = String(msg.node ?? '')
        const graph = deps.a?.graph
        const node = graph?.getNodeById?.(/^\d+$/.test(nodeId) ? Number(nodeId) : nodeId)
        if (!node) break
        try {
          if (deps.a.nodeOutputs) deps.a.nodeOutputs[nodeId] = msg.output
          node.onExecuted?.(msg.output)
          graph?.setDirtyCanvas?.(true, true)
        } catch (e) {
          console.warn('[ComfyTV/collab] remote output apply failed', e)
        }
        break
      }
    }
  }

  return { onPeerExec }
}
