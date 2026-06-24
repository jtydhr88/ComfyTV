import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('@/lib/comfyApp', () => ({ app: {} }))

import {
  isHeadlessConvertMode,
  convertGuiToApiHeadless,
  shutdownHeadlessConvert,
} from './headlessConvert'

const MSG = '__comfytvHeadless'

function setSearch(search: string) {
  window.history.replaceState({}, '', `/${search}`)
}

describe('isHeadlessConvertMode', () => {
  afterEach(() => setSearch(''))

  it('false without the param', () => {
    setSearch('')
    expect(isHeadlessConvertMode()).toBe(false)
  })

  it('true when comfytvHeadless param present', () => {
    setSearch('?comfytvHeadless=1')
    expect(isHeadlessConvertMode()).toBe(true)
  })
})

function installFakeIframes(opts: { neverReady?: boolean; output?: any } = {}) {
  const output = opts.output ?? { '1': { class_type: 'X', inputs: {} } }
  const realAppend = document.body.appendChild.bind(document.body)
  const created: HTMLIFrameElement[] = []
  vi.spyOn(document.body, 'appendChild').mockImplementation(((node: any) => {
    if (node?.tagName !== 'IFRAME') return realAppend(node)
    const fakeWin = {
      postMessage: (data: any) => {
        if (data?.[MSG] && data.type === 'convert') {
          queueMicrotask(() => {
            window.dispatchEvent(new MessageEvent('message', {
              source: fakeWin as any,
              data: { [MSG]: true, type: 'convert-result', reqId: data.reqId, output },
            }))
          })
        }
      },
    }
    Object.defineProperty(node, 'contentWindow', { value: fakeWin, configurable: true })
    Object.defineProperty(node, 'isConnected', { value: true, configurable: true })
    created.push(node)
    if (!opts.neverReady) {
      queueMicrotask(() => {
        window.dispatchEvent(new MessageEvent('message', {
          source: fakeWin as any,
          data: { [MSG]: true, type: 'ready' },
        }))
      })
    }
    return node
  }) as any)
  return { created }
}

describe('convertGuiToApiHeadless (reused iframe manager)', () => {
  beforeEach(() => setSearch(''))
  afterEach(() => {
    shutdownHeadlessConvert()
    vi.restoreAllMocks()
  })

  it('completes the ready → convert → result handshake', async () => {
    const { created } = installFakeIframes({ output: { '7': { class_type: 'K', inputs: {} } } })
    const out = await convertGuiToApiHeadless({ nodes: [] }, { timeoutMs: 2000 })
    expect(out).toEqual({ '7': { class_type: 'K', inputs: {} } })
    expect(created).toHaveLength(1)
  })

  it('reuses a single iframe across sequential conversions', async () => {
    const { created } = installFakeIframes()
    const a = await convertGuiToApiHeadless({ nodes: [{ id: 1 }] }, { timeoutMs: 2000 })
    const b = await convertGuiToApiHeadless({ nodes: [{ id: 2 }] }, { timeoutMs: 2000 })
    expect(a).toBeTruthy()
    expect(b).toBeTruthy()
    expect(created).toHaveLength(1)
  })

  it('boots a fresh iframe after shutdown', async () => {
    const { created } = installFakeIframes()
    await convertGuiToApiHeadless({ nodes: [] }, { timeoutMs: 2000 })
    shutdownHeadlessConvert()
    await convertGuiToApiHeadless({ nodes: [] }, { timeoutMs: 2000 })
    expect(created).toHaveLength(2)
  })

  it('rejects on boot timeout when the worker never signals ready', async () => {
    installFakeIframes({ neverReady: true })
    await expect(
      convertGuiToApiHeadless({ nodes: [] }, { bootTimeoutMs: 40, timeoutMs: 1000 }),
    ).rejects.toThrow(/boot timed out/)
  })

  it('serialises conversions through the queue', async () => {
    let inFlight = 0
    let maxInFlight = 0
    const realAppend = document.body.appendChild.bind(document.body)
    vi.spyOn(document.body, 'appendChild').mockImplementation(((node: any) => {
      if (node?.tagName !== 'IFRAME') return realAppend(node)
      const fakeWin = {
        postMessage: (data: any) => {
          if (data?.[MSG] && data.type === 'convert') {
            inFlight++
            maxInFlight = Math.max(maxInFlight, inFlight)
            setTimeout(() => {
              inFlight--
              window.dispatchEvent(new MessageEvent('message', {
                source: fakeWin as any,
                data: { [MSG]: true, type: 'convert-result', reqId: data.reqId, output: {} },
              }))
            }, 10)
          }
        },
      }
      Object.defineProperty(node, 'contentWindow', { value: fakeWin, configurable: true })
      Object.defineProperty(node, 'isConnected', { value: true, configurable: true })
      queueMicrotask(() => window.dispatchEvent(new MessageEvent('message', {
        source: fakeWin as any, data: { [MSG]: true, type: 'ready' },
      })))
      return node
    }) as any)

    await Promise.all([
      convertGuiToApiHeadless({ nodes: [] }, { timeoutMs: 2000 }),
      convertGuiToApiHeadless({ nodes: [] }, { timeoutMs: 2000 }),
      convertGuiToApiHeadless({ nodes: [] }, { timeoutMs: 2000 }),
    ])
    expect(maxInFlight).toBe(1)
  })
})
