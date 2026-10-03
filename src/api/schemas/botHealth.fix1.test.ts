import { expect, it } from 'vitest'
import { ProviderHealthSchema } from './bot'
import { healthFixture } from './botHealth.fixture'
const withId = (id: string) => ({ ...healthFixture, model: { ...healthFixture.model, authorized_override: id } })
it('rejects header-only eyJ identifiers consistently with both Python validators', () => {
  for (const id of ['eyJsingle', 'eyJ']) expect(ProviderHealthSchema.safeParse(withId(id)).success, id).toBe(false)
  expect(ProviderHealthSchema.safeParse(withId('EYJsingle')).success).toBe(true)
})
it('rejects unsafe model/provider identifiers under frozen FIX1 semantics', () => {
  const prefixes = ['sk-', 'sk_', 'bearer', 'token:', 'token_', 'password:', 'password_', 'api_key:', 'api_key_', 'api-key:', 'api-key_', 'apikey:', 'apikey_', 'access_token:', 'access_token_', 'refresh_token:', 'refresh_token_', 'github_pat_', 'ghp_', 'gho_', 'ghu_', 'ghs_', 'ghr_']
  for (const id of [...prefixes.flatMap(p => [p + 'CANARY', p.toUpperCase() + 'CANARY']), 'eyJabc.def.ghi', 'https://example.invalid', 'a..b', 'white space', '模型', 'a\n', 'x'.repeat(129)]) {
    expect(ProviderHealthSchema.safeParse(withId(id)).success, id).toBe(false)
    expect(ProviderHealthSchema.safeParse({ ...healthFixture, model: { ...healthFixture.model, configured_default: { provider: id, model: 'valid', observed_at: null } } }).success, id).toBe(false)
    expect(ProviderHealthSchema.safeParse({ ...healthFixture, model: { ...healthFixture.model, last_served: { provider: 'valid', model: id, completed_at: '2026-10-03T00:00:00Z', selection_mode_at_run: 'inherit_default' } } }).success, id).toBe(false)
  }
  for (const id of ['openai-codex', 'gpt-6.1-sol', 'anthropic/claude-sonnet-4.6', 'Qwen/Qwen3:latest', 'x'.repeat(128)]) expect(ProviderHealthSchema.safeParse(withId(id)).success, id).toBe(true)
})

it('enforces exact shared timestamp, age and health-array bounds while retaining future localization fallback', () => {
  for (const checked_at of ['2026-10-03T00:00:00.1234567Z', '2026-02-30T00:00:00Z', '0000-01-01T00:00:00Z', '2026-10-03T24:00:00Z', '2026-10-03T00:00:60Z', '2026-10-03T00:00:00+01:00']) expect(ProviderHealthSchema.safeParse({ ...healthFixture, checked_at }).success, checked_at).toBe(false)
  for (const checked_at of ['2026-10-03T00:00:00Z', '2024-02-29T00:00:00.123456+00:00']) expect(ProviderHealthSchema.safeParse({ ...healthFixture, checked_at }).success).toBe(true)
  for (const age_ms of [-1, 0.5, 2147483648]) expect(ProviderHealthSchema.safeParse({ ...healthFixture, age_ms }).success).toBe(false)
  expect(ProviderHealthSchema.safeParse({ ...healthFixture, age_ms: 2147483647 }).success).toBe(true)
  for (const count of [32, 33]) {
    const accepted = count === 32
    expect(ProviderHealthSchema.safeParse({ ...healthFixture, gateway: { state: 'ok', codes: Array(count).fill('health_stale') } }).success).toBe(accepted)
    expect(ProviderHealthSchema.safeParse({ ...healthFixture, media: { ...healthFixture.media, unsupported: Array(count).fill('video') } }).success).toBe(accepted)
    expect(ProviderHealthSchema.safeParse({ ...healthFixture, errors: Array(count).fill({ code: 'future', layer: 'api', action: 'future', retryable: false }) }).success).toBe(accepted)
  }
  expect(ProviderHealthSchema.safeParse({ ...healthFixture, media: { ...healthFixture.media, unsupported: ['future'] } }).success).toBe(false)
  for (const key of ['code', 'action']) for (const value of ['', 'x'.repeat(129)]) expect(ProviderHealthSchema.safeParse({ ...healthFixture, errors: [{ code: 'future', action: 'future', layer: 'api', retryable: false, [key]: value }] }).success).toBe(false)
  expect(ProviderHealthSchema.safeParse({ ...healthFixture, errors: [{ code: 'future', action: 'future', layer: 'api', retryable: false }] }).success).toBe(true)
})
