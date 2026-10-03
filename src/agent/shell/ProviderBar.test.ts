import { mount, flushPromises } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import { beforeEach, expect, it, vi } from 'vitest'
import { DropdownMenuRoot } from 'reka-ui'
import ProviderBar from './ProviderBar.vue'
import { agentProviders } from '../status'
import { providerFixture } from '@/api/schemas/botHealth.fixture'
import en from '../locales/en.json'
import zh from '../locales/zh.json'
const { fetchApi } = vi.hoisted(() => ({ fetchApi: vi.fn() }))
vi.mock('@agent/scripts/api', () => ({ api: { fetchApi } }))
vi.mock('@agent/scripts/app', () => ({ app: {} }))
vi.mock('../mount', () => ({ setAgentPanelEnabled: vi.fn() }))

beforeEach(() => { fetchApi.mockReset() })

it.each(['en', 'zh'] as const)('failed provider persistence preserves saved label/model and fixed localized feedback (%s)', async locale => {
  agentProviders.value = [providerFixture, { ...providerFixture, id: 'codex', label: 'Codex' }]
  fetchApi.mockResolvedValueOnce(new Response(JSON.stringify({ settings: [
    { key: 'bot-provider', value: 'hermes' }, { key: 'bot-model-hermes', value: 'saved-hermes' }, { key: 'bot-model-codex', value: 'saved-codex' },
  ] })))
  const i18n = createI18n({ legacy: false, locale, messages: { en, zh } })
  const w = mount(ProviderBar, { global: { plugins: [i18n] } })
  await flushPromises()
  for (const failure of [new Response('SECRET-save', { status: 503 }), new Error('SECRET-transport')]) {
    if (failure instanceof Error) fetchApi.mockRejectedValueOnce(failure)
    else fetchApi.mockResolvedValueOnce(failure)
    await (w.vm as any).setProvider('codex')
    expect(w.findAll('button')[0]!.text()).toContain('Hermes')
    expect(w.findAll('button').map(b => b.text()).join(' ')).toContain('saved-hermes')
    expect(w.text()).not.toContain('saved-codex')
    expect(w.find('[role="alert"]').text()).toBe(locale === 'en' ? 'Could not save provider selection. Saved provider and model are unchanged.' : '提供商选择保存失败。已保存的提供商和模型保持不变。')
    expect(w.text()).not.toContain('SECRET')
  }
  expect(fetchApi.mock.calls.filter(c => c[0].includes('/bot/'))).toHaveLength(0)
  w.unmount()
})


it('retains ordinary-provider fallback selection and model suggestions from shared data', async () => {
  agentProviders.value = [{ ...providerFixture, id: 'codex', label: 'Codex', models: ['ordinary-model'] }]
  fetchApi.mockResolvedValue(new Response(JSON.stringify({ settings: [] })))
  const w = mount(ProviderBar, { global: { plugins: [createI18n({ legacy: false, locale: 'en', messages: { en } })] } })
  await flushPromises()
  expect(w.find('[aria-label="Provider for new chats"]').text()).toContain('Codex')
  w.unmount()
})

it('does not label rejected model edits as saved configuration', async () => {
  agentProviders.value = [providerFixture]
  fetchApi.mockResolvedValueOnce(new Response(JSON.stringify({ settings: [{ key: 'bot-provider', value: 'hermes' }, { key: 'bot-model-hermes', value: 'saved-model' }] })))
  const w = mount(ProviderBar, { global: { plugins: [createI18n({ legacy: false, locale: 'en', messages: { en } })] } })
  await flushPromises()
  fetchApi.mockResolvedValueOnce(new Response('', { status: 503 }))
  await (w.vm as any).setModel('rejected-edit')
  expect(w.find('[aria-label="Saved model selection"]').text()).toContain('saved-model')
  expect(w.find('[aria-label="Saved model selection"]').text()).not.toContain('rejected-edit')
  w.unmount()
})

it('uses shared providers without bar cascade or model menu probes and exposes saved/new-chat scope', async () => {
  agentProviders.value = [providerFixture]
  fetchApi.mockImplementation(async (path: string) => new Response(JSON.stringify(path.endsWith('settings') ? { settings: [{ key: 'bot-provider', value: 'hermes' }] } : { enabled: true, providers: [providerFixture] })))
  const w = mount(ProviderBar, { global: { plugins: [createI18n({ legacy: false, locale: 'en', messages: { en } })] } })
  await flushPromises()
  expect(fetchApi.mock.calls.map(c => c[0])).toEqual(['/comfytv/settings'])
  agentProviders.value = [{ ...providerFixture, available: false }]
  await flushPromises()
  w.findAllComponents(DropdownMenuRoot)[1]!.vm.$emit('update:open', true)
  await flushPromises()
  expect(fetchApi).toHaveBeenCalledTimes(1)
  expect(w.text()).toContain('Hermes diagnostics')
  expect(w.find('[aria-label="Provider for new chats"]').exists()).toBe(true)
  w.unmount()
})
