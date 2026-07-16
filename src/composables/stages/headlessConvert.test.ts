import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('@/lib/comfyApp', () => ({ app: {} }))

import { app } from '@/lib/comfyApp'
import {
  isHeadlessConvertMode,
  convertGuiToApiHeadless,
  runHeadlessConvertWorker,
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

type IframeReply =
  | { kind: 'result'; output?: any }
  | { kind: 'error'; error?: string }
  | { kind: 'silent' }

function installFakeIframes(opts: {
  neverReady?: boolean
  output?: any
  reply?: IframeReply
} = {}) {
  const output = opts.output ?? { '1': { class_type: 'X', inputs: {} } }
  const reply: IframeReply = opts.reply ?? { kind: 'result', output }
  const realAppend = document.body.appendChild.bind(document.body)
  const created: HTMLIFrameElement[] = []
  const wins: any[] = []
  vi.spyOn(document.body, 'appendChild').mockImplementation(((node: any) => {
    if (node?.tagName !== 'IFRAME') return realAppend(node)
    const fakeWin = {
      postMessage: (data: any) => {
        if (data?.[MSG] && data.type === 'convert' && reply.kind !== 'silent') {
          queueMicrotask(() => {
            const payload = reply.kind === 'error'
              ? { [MSG]: true, type: 'convert-error', reqId: data.reqId, error: reply.error }
              : { [MSG]: true, type: 'convert-result', reqId: data.reqId, output: reply.output ?? output }
            // posted twice: the second delivery hits the "no pending request" guard
            window.dispatchEvent(new MessageEvent('message', { source: fakeWin as any, data: payload }))
            window.dispatchEvent(new MessageEvent('message', { source: fakeWin as any, data: payload }))
          })
        }
      },
    }
    Object.defineProperty(node, 'contentWindow', { value: fakeWin, configurable: true })
    Object.defineProperty(node, 'isConnected', { value: true, configurable: true })
    created.push(node)
    wins.push(fakeWin)
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
  return { created, wins }
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

  it('rejects when the worker reports convert-error', async () => {
    installFakeIframes({ reply: { kind: 'error', error: 'graph exploded' } })
    await expect(
      convertGuiToApiHeadless({ nodes: [] }, { timeoutMs: 1000 }),
    ).rejects.toThrow(/graph exploded/)
  })

  it('falls back to a generic message when convert-error carries no text', async () => {
    installFakeIframes({ reply: { kind: 'error' } })
    await expect(
      convertGuiToApiHeadless({ nodes: [] }, { timeoutMs: 1000 }),
    ).rejects.toThrow(/headless convert failed/)
  })

  it('rejects on convert timeout when the worker never answers', async () => {
    installFakeIframes({ reply: { kind: 'silent' } })
    await expect(
      convertGuiToApiHeadless({ nodes: [] }, { timeoutMs: 30, bootTimeoutMs: 1000 }),
    ).rejects.toThrow(/convert timed out after 30ms/)
  })

  it('ignores handshake messages from unknown sources or with foreign payloads', async () => {
    const { wins } = installFakeIframes({ neverReady: true })
    const p = convertGuiToApiHeadless({ nodes: [] }, { bootTimeoutMs: 80, timeoutMs: 500 })
    p.catch(() => {}) // avoid unhandled rejection while we poke at the listener
    await new Promise(r => queueMicrotask(() => r(null)))
    // right shape, wrong source: must not satisfy the boot handshake
    window.dispatchEvent(new MessageEvent('message', {
      source: window as any,
      data: { [MSG]: true, type: 'ready' },
    }))
    // right source, but data missing the protocol marker: ignored too
    window.dispatchEvent(new MessageEvent('message', { source: wins[0], data: null }))
    window.dispatchEvent(new MessageEvent('message', { source: wins[0], data: { hello: 1 } }))
    await expect(p).rejects.toThrow(/boot timed out/)
  })

  it('tears the idle iframe down and boots a fresh one afterwards', async () => {
    const { created } = installFakeIframes()
    await convertGuiToApiHeadless({ nodes: [] }, { timeoutMs: 2000, idleTeardownMs: 10 })
    await new Promise(r => setTimeout(r, 80))
    // teardown happened: the next conversion has to boot a brand new iframe
    await convertGuiToApiHeadless({ nodes: [] }, { timeoutMs: 2000, idleTeardownMs: 10 })
    expect(created).toHaveLength(2)
  })
})

describe('runHeadlessConvertWorker', () => {
  // A working localStorage (Node's builtin stub is non-functional in this env).
  function installLocalStorage() {
    const store: Record<string, string> = {}
    ;(globalThis as any).localStorage = {
      getItem: (k: string) => Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null,
      setItem: (k: string, v: string) => { store[k] = String(v) },
      removeItem: (k: string) => { delete store[k] },
      clear: () => { for (const k of Object.keys(store)) delete store[k] },
      key: (i: number) => Object.keys(store)[i] ?? null,
      get length() { return Object.keys(store).length },
    }
  }

  function postedOfType(spy: any, type: string) {
    return spy.mock.calls.filter((c: any[]) => c[0]?.[MSG] === true && c[0]?.type === type)
  }

  function dispatchConvert(reqId: string, guiJson: any = { nodes: [] }) {
    window.dispatchEvent(new MessageEvent('message', {
      data: { [MSG]: true, type: 'convert', reqId, guiJson },
    }))
  }

  // The worker convert flow is a pure microtask chain (no timers), so one
  // macrotask tick guarantees every registered listener has fully settled.
  const flush = () => new Promise(r => setTimeout(r, 0))

  beforeEach(() => {
    installLocalStorage()
    vi.spyOn(console, 'info').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    delete (app as any).loadGraphData
    delete (app as any).graphToPrompt
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('announces readiness to the parent frame after a paint', () => {
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => { cb(0); return 1 })
    const post = vi.spyOn(window, 'postMessage').mockImplementation(() => {})
    runHeadlessConvertWorker()
    const ready = postedOfType(post, 'ready')
    expect(ready.length).toBeGreaterThan(0)
    expect(ready[0][0]).toMatchObject({ version: 'ctv-headless-1' })
    expect(ready[0][1]).toBe(window.location.origin)
  })

  it('converts via app.loadGraphData + graphToPrompt and posts the result', async () => {
    const post = vi.spyOn(window, 'postMessage').mockImplementation(() => {})
    const output = { '5': { class_type: 'KSampler', inputs: {} } }
    ;(app as any).loadGraphData = vi.fn(async () => {})
    ;(app as any).graphToPrompt = vi.fn(async () => ({ output, workflow: {} }))
    runHeadlessConvertWorker()

    const guiJson = { nodes: [{ id: 1 }] }
    dispatchConvert('req-ok', guiJson)
    await flush()
    expect(postedOfType(post, 'convert-result').length).toBeGreaterThan(0)

    expect((app as any).loadGraphData).toHaveBeenCalledWith(guiJson, true, false, null, {
      skipAssetScans: true,
      deferWarnings: true,
      silentAssetErrors: true,
    })
    const [msg] = postedOfType(post, 'convert-result')[0]
    expect(msg.reqId).toBe('req-ok')
    expect(msg.output).toEqual(output)
  })

  it('posts convert-error when the app cannot convert', async () => {
    const post = vi.spyOn(window, 'postMessage').mockImplementation(() => {})
    runHeadlessConvertWorker() // app has no loadGraphData/graphToPrompt here

    dispatchConvert('req-fail')
    await flush()
    expect(postedOfType(post, 'convert-error').length).toBeGreaterThan(0)
    const [msg] = postedOfType(post, 'convert-error')[0]
    expect(msg.reqId).toBe('req-fail')
    expect(msg.error).toMatch(/unavailable/)
  })

  it('ignores messages that are not convert requests', async () => {
    const post = vi.spyOn(window, 'postMessage').mockImplementation(() => {})
    runHeadlessConvertWorker()
    window.dispatchEvent(new MessageEvent('message', { data: null }))
    window.dispatchEvent(new MessageEvent('message', { data: { type: 'convert', reqId: 'x' } }))
    window.dispatchEvent(new MessageEvent('message', { data: { [MSG]: true, type: 'ready' } }))
    await new Promise(r => setTimeout(r, 10))
    expect(postedOfType(post, 'convert-result')).toHaveLength(0)
    expect(postedOfType(post, 'convert-error')).toHaveLength(0)
  })

  it('restores protected localStorage keys after a conversion', async () => {
    const post = vi.spyOn(window, 'postMessage').mockImplementation(() => {})
    localStorage.setItem('Comfy.Workflow.current', 'original')
    localStorage.setItem('somethingElse', 'untouched')
    ;(app as any).loadGraphData = vi.fn(async () => {
      // defer past the synchronous dispatch phase, like a real graph load would
      await Promise.resolve()
      localStorage.setItem('Comfy.Workflow.current', 'dirtied by iframe load')
      localStorage.setItem('Comfy.OpenWorkflows', 'left behind')
      localStorage.setItem('somethingElse', 'changed')
    })
    ;(app as any).graphToPrompt = vi.fn(async () => ({ output: {} }))
    runHeadlessConvertWorker()

    dispatchConvert('req-ls')
    await flush()
    expect(postedOfType(post, 'convert-result').length).toBeGreaterThan(0)

    expect(localStorage.getItem('Comfy.Workflow.current')).toBe('original')
    expect(localStorage.getItem('Comfy.OpenWorkflows')).toBeNull()
    expect(localStorage.getItem('somethingElse')).toBe('changed')
  })
})
