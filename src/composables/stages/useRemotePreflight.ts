import type { Capabilities, RemoteCapabilityProbe } from '@/api'
import { askConfirm } from '@/composables/dialog/useConfirmDialog'
import { t } from '@/i18n'
import { app } from '@/lib/comfyApp'
import { useServerStore } from '@/stores/serverStore'

export type PreflightDecision =
  | { action: 'block'; message: string }
  | { action: 'warn'; messages: string[] }
  | { action: 'pass' }

export function missingNodeIds(
  local: Capabilities | null,
  probe: RemoteCapabilityProbe | null | undefined,
): string[] {
  if (!local || !probe?.installed) return []
  const remote = new Set(probe.capabilities.node_ids)
  return local.node_ids.filter(id => !remote.has(id))
}

function resourceBasename(value: string): string {
  const parts = value.split(/[\\/]/)
  return parts[parts.length - 1] ?? value
}

export function decidePreflight(input: {
  serverLabel: string
  comfyClass: string
  probe: RemoteCapabilityProbe
  local: Capabilities | null
  widgetValues: Record<string, unknown>
}): PreflightDecision {
  const { serverLabel, comfyClass, probe, local, widgetValues } = input
  if (!probe.installed) {
    return {
      action: 'block',
      message: t('servers.preflight.noComfyTV', { label: serverLabel }),
    }
  }
  if (!probe.capabilities.node_ids.includes(comfyClass)) {
    return {
      action: 'block',
      message: t('servers.preflight.missingNode', { label: serverLabel, node: comfyClass }),
    }
  }
  const warnings: string[] = []
  const fields = local?.resource_fields[comfyClass]
  if (fields) {
    for (const [widget, kind] of Object.entries(fields)) {
      const raw = widgetValues[widget]
      if (typeof raw !== 'string' || raw.trim() === '') continue
      const filename = resourceBasename(raw.trim())
      const remoteRow = (probe.capabilities.resources[kind] ?? [])
        .find(r => r.filename === filename)
      if (!remoteRow) {
        warnings.push(t('servers.preflight.missingResource', {
          label: serverLabel, file: filename,
        }))
        continue
      }
      const localSha = (local?.resources[kind] ?? [])
        .find(r => r.filename === filename)?.sha256
      if (localSha && remoteRow.sha256 && localSha !== remoteRow.sha256) {
        warnings.push(t('servers.preflight.resourceMismatch', {
          label: serverLabel, file: filename,
        }))
      }
    }
  }
  if (warnings.length > 0) return { action: 'warn', messages: warnings }
  return { action: 'pass' }
}

export function useRemotePreflight() {
  const serverStore = useServerStore()

  async function ensureRemotePreflight(
    serverId: number,
    comfyClass: string,
    widgetValues: Record<string, unknown>,
  ): Promise<boolean> {
    const server = serverStore.byId(serverId)
    if (!server) return true
    const [local, probe] = await Promise.all([
      serverStore.loadLocalCapabilities(),
      serverStore.probeCapabilities(serverId),
    ])
    const decision = decidePreflight({
      serverLabel: server.label,
      comfyClass,
      probe,
      local,
      widgetValues,
    })
    if (decision.action === 'block') {
      ;(app as any)?.extensionManager?.toast?.add?.({
        severity: 'error',
        summary: t('servers.preflight.blockedTitle'),
        detail: decision.message,
        life: 6000,
      })
      return false
    }
    if (decision.action === 'warn') {
      return askConfirm({
        title: t('servers.preflight.warnTitle'),
        message: decision.messages.join('\n'),
        confirmText: t('servers.preflight.runAnyway'),
      })
    }
    return true
  }

  return { ensureRemotePreflight }
}
