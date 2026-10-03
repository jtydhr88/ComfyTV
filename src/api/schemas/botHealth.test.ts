import { describe, expect, it } from 'vitest'
import { BotProviderStatusSchema } from './bot'

import { providerFixture, healthFixture } from './botHealth.fixture'

describe('optional provider health contract', () => {
  it('accepts RFC3339 UTC offset spelling without dropping evidence', () => {
    expect(BotProviderStatusSchema.safeParse({ ...providerFixture, health: { ...healthFixture, checked_at: '2026-10-03T00:00:00+00:00' } }).success).toBe(true)
  })
  it('drops noncontract data and rejects invalid evidence without changing legacy provider validity', () => {
    const parsed = BotProviderStatusSchema.parse({ ...providerFixture, health: { ...healthFixture, raw_error: 'SECRET', api: { ...healthFixture.api, token: 'SECRET' } } })
    expect(JSON.stringify(parsed)).not.toContain('SECRET')
    for (const invalid of [{ age_ms: -1 }, { schema_version: 2 }, { limits: { work: 3, control: 2, status: 2 } }, { api: { ...healthFixture.api, broker_auth: 'true' } }]) {
      expect(BotProviderStatusSchema.safeParse({ ...providerFixture, health: { ...healthFixture, ...invalid } }).success).toBe(false)
    }
  })
  it('preserves agreed health and existing optional capabilities while allowing old providers', () => {
    expect(BotProviderStatusSchema.parse(providerFixture).health).toBeUndefined()
    const parsed = BotProviderStatusSchema.parse({ ...providerFixture, attachment_transport: 'asset_refs', attachment_media_types: ['image'], health: healthFixture })
    expect(parsed).toMatchObject({ attachment_transport: 'asset_refs', attachment_media_types: ['image'], health: healthFixture })
  })
})
