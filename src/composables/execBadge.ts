import { effectScope, watch } from 'vue'

import { useExecutionStore } from '@/stores/executionStore'
import { i18n } from '@/i18n'

export const execTopbarBadge: { text: string; variant: 'info'; tooltip?: string } = {
  text: '',
  variant: 'info',
}

export function installExecBadge(): () => void {
  const scope = effectScope(true)
  scope.run(() => {
    const store = useExecutionStore()
    watch(
      () => [store.isBusy, store.currentNodeId, store.queueRemaining] as const,
      ([busy, nodeId, remaining]) => {
        const t = i18n.global.t
        if (!busy) {
          execTopbarBadge.text = ''
          return
        }
        execTopbarBadge.text = nodeId
          ? t('execution.running', { nodeId })
          : t('execution.queued')
        if (remaining > 1) execTopbarBadge.text += ` +${remaining - 1}`
      },
      { immediate: true },
    )
  })
  return () => scope.stop()
}
