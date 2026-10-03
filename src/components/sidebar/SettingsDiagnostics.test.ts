import { mount, flushPromises } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import { expect, it, vi } from 'vitest'
import SettingsPanel from './SettingsPanel.vue'
import ProviderDiagnostics from '@/agent/shell/ProviderDiagnostics.vue'
import HermesConnection from './HermesConnection.vue'
import en from '@/agent/locales/en.json'
import main from '../../../locales/en/main.json'
const { fetchApi, saveSettings } = vi.hoisted(() => ({ fetchApi: vi.fn(), saveSettings: vi.fn() }))
vi.mock('@agent/scripts/api', () => ({ api: { fetchApi } }))
vi.mock('@/agent/mount', () => ({ setAgentPanelEnabled: vi.fn() }))
vi.mock('@/api', () => ({ fetchSettings: async () => ({ settings: [{ key: 'enable-mcp', type: 'boolean', value: false, default: false }] }), saveSettings }))
vi.mock('@/api/eagle', () => ({ fetchEagleStatus: async () => ({ online: false }) }))
vi.mock('@/api/blender', () => ({ fetchBlenderStatus: async () => ({ online: false }) }))

it('keeps diagnostics reachable with disabled/collapsed master; refresh does not save settings', async () => {
  fetchApi.mockImplementation(async (route: string) => {
    if (route === '/comfytv/hermes/connection') return new Response(JSON.stringify({ schema_version: 1, source: 'none', configured: false, endpoint: '', mcp_server: '', credential_id: null, secure_storage: { available: false, backend: 'none', reason: null }, migration: { legacy_dpapi: false, environment: false }, can_manage: false }))
    if (route.endsWith('/channel')) return new Response('{}', { status: 403 })
    return new Response('{"enabled":false,"providers":[]}')
  })
  const wrapper = mount(SettingsPanel, { props: { active: true }, global: { plugins: [createI18n({ legacy: false, locale: 'en', messages: { en: { ...main, ...en } } })], stubs: { SkillsSection: true } } })
  await flushPromises()
  expect(wrapper.findComponent(HermesConnection).exists()).toBe(true)
  const diagnostics = wrapper.findComponent(ProviderDiagnostics)
  expect(diagnostics.exists()).toBe(true)
  // VTU incorrectly treats summaries of closed details as hidden; native keyboard behavior is covered in the browser fixture.
  diagnostics.find('details').element.setAttribute('open', '')
  expect(diagnostics.find('summary').isVisible()).toBe(true)
  fetchApi.mockResolvedValueOnce(new Response('{"enabled":false,"provider":null}'))
  await diagnostics.find('button').trigger('click')
  await flushPromises()
  expect(saveSettings).not.toHaveBeenCalled()
  expect(fetchApi.mock.calls.map(c => c[0]).filter(route => route.startsWith('/comfytv/bot/'))).toEqual(['/comfytv/bot/status', '/comfytv/bot/providers/hermes/health'])
  wrapper.unmount()
})
