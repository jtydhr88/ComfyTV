import { describe, it, expect, vi } from 'vitest'
import { createInteractionChannel } from './agentInteractionChannel'
describe('memory-only native channel (synthetic backend)', () => {
 it('authorizes only the exact connection status and five management routes', async () => {
  const fetcher = vi.fn(async () => new Response(JSON.stringify({ schema_version: 1, channel_id: 'fixture', csrf_token: 'fixture-token', expires_at: '2099-01-01T00:00:00Z', can_respond: true })))
  const channel = createInteractionChannel(fetcher, 'http://localhost:8188')
  await channel.open()
  for (const suffix of ['', '/pair', '/import', '/migrate', '/test', '/disconnect']) expect(channel.headers('/comfytv/hermes/connection' + suffix)['X-ComfyTV-Interaction-CSRF']).toBe('fixture-token')
  for (const suffix of ['/other', '/pair/extra', '?x=1', '#x', '/test?x=1']) expect(channel.headers('/comfytv/hermes/connection' + suffix)).toEqual({})
  expect(channel.headers('https://evil.test/comfytv/hermes/connection/pair')).toEqual({})
  channel.close()
 })
 it('handshakes and attaches only exact same-origin native routes, drops expired lease', async () => {
  const fetcher = vi.fn(async () => new Response(JSON.stringify({ schema_version: 1, channel_id: 'channel-fixture', csrf_token: 'csrf-fixture', expires_at: '2099-01-01T00:00:00Z', can_respond: true })))
  const channel = createInteractionChannel(fetcher, 'http://localhost:8188')
  await channel.open()
  expect(fetcher).toHaveBeenCalledWith('/comfytv/agent/interactions/channel', expect.objectContaining({ credentials: 'same-origin', redirect: 'error' }))
  expect(channel.headers('/comfytv/agent/threads/a/messages')['X-ComfyTV-Interaction-CSRF']).toBe('csrf-fixture')
  for (const route of ['https://evil.test/comfytv/agent/threads/a/messages', '//evil.test/comfytv/agent/threads/a/messages', '/upload/image', '/comfytv/agent/run-mode']) expect(channel.headers(route)).toEqual({})
  channel.close()
  expect(channel.headers('/comfytv/agent/threads/a/messages')).toEqual({})
 })
 it('reads renew under same-channel CSRF and never renews an expired lease', async () => {
  vi.useFakeTimers(); vi.setSystemTime(new Date('2026-01-01T00:00:00Z'))
  let expiry = '2026-01-01T00:02:00Z'
  const fetcher = vi.fn(async () => new Response(JSON.stringify({ schema_version: 1, channel_id: 'fixture', csrf_token: 'fixture-token', expires_at: expiry, can_respond: true })))
  const channel = createInteractionChannel(fetcher,'http://[::1]:8188'); await channel.open()
  expiry = '2026-01-01T00:02:30Z'; await channel.renew()
  expect(fetcher.mock.calls[1]).toEqual(['/comfytv/agent/interactions/channel/renew', expect.objectContaining({ headers: expect.objectContaining({ 'X-ComfyTV-Interaction-CSRF': 'fixture-token', 'X-ComfyTV-Interaction-Channel': 'fixture' }), body: JSON.stringify({ channel_id: 'fixture' }) })])
  vi.setSystemTime(new Date('2026-01-01T00:03:00Z')); await channel.renew();expect(fetcher).toHaveBeenCalledTimes(2)
  expect(channel.headers('/comfytv/agent/threads/a/messages')).toEqual({})
  channel.close();vi.useRealTimers()
 })
 it('never issues a channel on LAN host', async () => {
  const fetcher = vi.fn()
  const channel = createInteractionChannel(fetcher, 'http://192.168.1.1:8188')
  await channel.open()
  expect(fetcher).not.toHaveBeenCalled()
 })
})
