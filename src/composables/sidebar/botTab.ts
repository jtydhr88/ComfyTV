import { createApp } from 'vue'
import { getActivePinia } from 'pinia'

import BotPanel from '@/components/bot/BotPanel.vue'
import { i18n } from '@/i18n'

let registered = false
let botApp: ReturnType<typeof createApp> | null = null

export function isBotTabRegistered(): boolean {
  return registered
}

export function syncBotTab(a: any, enabled: boolean): void {
  const manager = a?.extensionManager
  if (!manager?.registerSidebarTab) return
  if (enabled && !registered) {
    manager.registerSidebarTab({
      id:      'comfytv-bot',
      title:   'ComfyTV Bot',
      icon:    'pi pi-sparkles',
      tooltip: i18n.global.t('menu.botSidebarTooltip'),
      type:    'custom',
      render: (container: HTMLElement) => {
        if (botApp) { botApp.unmount(); botApp = null }
        Object.assign(container.style, {
          width: '100%', height: '100%',
          display: 'flex', flexDirection: 'column',
          overflow: 'hidden',
        })
        botApp = createApp(BotPanel)
        const pinia = getActivePinia()
        if (pinia) botApp.use(pinia)
        botApp.use(i18n)
        botApp.mount(container)
      },
      destroy: () => {
        botApp?.unmount()
        botApp = null
      },
    })
    registered = true
  } else if (!enabled && registered) {
    botApp?.unmount()
    botApp = null
    manager.unregisterSidebarTab?.('comfytv-bot')
    registered = false
  }
}
