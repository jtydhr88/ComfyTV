import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import { beforeEach, expect, it, vi } from 'vitest'
import en from '../locales/en.json'
import zh from '../locales/zh.json'
import { HEALTH_ACTIONS, HEALTH_CODES, ProviderHealthSchema } from '@/api/schemas/bot'
import ProviderDiagnostics from './ProviderDiagnostics.vue'
import { agentProviders, agentStatusFetchedAt } from '../status'
vi.mock('../mount', () => ({ setAgentPanelEnabled: vi.fn() }))
vi.mock('@agent/scripts/api', () => ({ api: { fetchApi: vi.fn() } }))

import { healthFixture, providerFixture } from '@/api/schemas/botHealth.fixture'
beforeEach(() => { agentProviders.value = []; agentStatusFetchedAt.value = null })

it.each(['en', 'zh'])('separates evidence and localizes repairs without raw future errors in %s', locale => {
  agentProviders.value = [{ ...providerFixture, detail: 'SECRET-detail', health: ProviderHealthSchema.parse({ ...healthFixture,
    errors: [{ code: 'SECRET-future', layer: 'api', action: 'SECRET-action', retryable: true }],
    model: { ...healthFixture.model, last_served: { provider: 'owned-provider', model: 'served-model', completed_at: '2026-10-02T00:00:00Z', selection_mode_at_run: 'broker_override' } },
  }) }]
  agentStatusFetchedAt.value = Date.now()
  const wrapper = mount(ProviderDiagnostics, { global: { plugins: [createI18n({ legacy: false, locale, messages: { en, zh } })] } })
  expect(wrapper.text()).toContain('configured-model')
  expect(wrapper.text()).toContain('served-model')
  expect(wrapper.text()).toContain(locale === 'en' ? 'Cached connection' : '缓存连接')
  expect(wrapper.text()).toContain(locale === 'en' ? 'Not tested by this check' : '本次检查未测试')
  expect(wrapper.text()).toContain(locale === 'en' ? 'Last successful owned run' : '最近成功的所属运行')
  expect(wrapper.text()).not.toMatch(/SECRET|diagnostics\./)
  for (const messages of [en, zh]) {
    const d = (messages as any).diagnostics
    for (const code of HEALTH_CODES) expect(d.codes[code]).toBeTruthy()
    for (const action of HEALTH_ACTIONS) expect(d.actions[action]).toBeTruthy()
  }
  expect(Object.keys((en as any).diagnostics).sort()).toEqual(Object.keys((zh as any).diagnostics).sort())
})

it.each(['en', 'zh'])('renders unknown saved diagnostics accessibly in %s without fetching or mutation', async locale => {
  const wrapper = mount(ProviderDiagnostics, { props: { dirty: true }, global: { plugins: [createI18n({ legacy: false, locale, messages: { en, zh } })] } })
  expect(wrapper.find('summary').text()).not.toContain('diagnostics.')
  expect(wrapper.find('button').attributes('type')).toBe('button')
  expect(wrapper.text()).toContain(locale === 'en' ? 'Showing saved configuration' : '显示已保存配置')
  expect(wrapper.text()).toContain(locale === 'en' ? 'Current chat' : '当前会话')
  expect(wrapper.text()).not.toMatch(/diagnostics\./)
})
