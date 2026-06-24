import { app } from '@/lib/comfyApp'

const HEADLESS_PARAM = 'comfytvHeadless'
const MSG = '__comfytvHeadless'
const VERSION = 'ctv-headless-1'

const DEFAULT_BOOT_TIMEOUT_MS = 90_000
const DEFAULT_CONVERT_TIMEOUT_MS = 60_000
const DEFAULT_IDLE_TEARDOWN_MS = 60_000

export function isHeadlessConvertMode(): boolean {
  try {
    return new URLSearchParams(window.location.search).get(HEADLESS_PARAM) != null
  } catch {
    return false
  }
}

const LS_PROTECT = /^Comfy\.Workflow\.|^Comfy\.PreviousWorkflow|^Comfy\.OpenWorkflows|litegrapheditor_clipboard|workflow/i

function snapshotProtectedLS(): Record<string, string | null> {
  const snap: Record<string, string | null> = {}
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)
      if (k && LS_PROTECT.test(k)) snap[k] = localStorage.getItem(k)
    }
  } catch {}
  return snap
}

function restoreProtectedLS(snap: Record<string, string | null>): void {
  try {
    const toCheck: string[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)
      if (k && LS_PROTECT.test(k)) toCheck.push(k)
    }
    for (const k of toCheck) if (!(k in snap)) localStorage.removeItem(k)
    for (const [k, v] of Object.entries(snap)) {
      if (v == null) localStorage.removeItem(k)
      else localStorage.setItem(k, v)
    }
  } catch {}
}

async function _realConvert(guiJson: any): Promise<any> {
  const a = app as any
  if (typeof a.loadGraphData !== 'function' || typeof a.graphToPrompt !== 'function') {
    throw new Error('headless: app.loadGraphData / graphToPrompt unavailable')
  }
  await a.loadGraphData(guiJson, true, false, null, {
    skipAssetScans: true,
    deferWarnings: true,
    silentAssetErrors: true,
  })
  const res = await a.graphToPrompt()
  return JSON.parse(JSON.stringify(res?.output ?? res))
}

export function runHeadlessConvertWorker(): void {
  const origin = window.location.origin
  const post = (msg: any) => {
    try { window.parent?.postMessage({ [MSG]: true, version: VERSION, ...msg }, origin) }
    catch (e) { console.warn('[ComfyTV/headless] postMessage failed', e) }
  }

  window.addEventListener('message', async (ev: MessageEvent) => {
    const d = ev.data
    if (!d || d[MSG] !== true || d.type !== 'convert') return
    const reqId = d.reqId
    const snap = snapshotProtectedLS()
    try {
      console.info('[ComfyTV/headless] converting (reqId=' + reqId + ')')
      const output = await _realConvert(d.guiJson)
      post({ type: 'convert-result', reqId, output })
    } catch (e: any) {
      console.error('[ComfyTV/headless] convert failed', e)
      post({ type: 'convert-error', reqId, error: String(e?.message || e) })
    } finally {
      restoreProtectedLS(snap)
    }
  })

  requestAnimationFrame(() => {
    console.info('[ComfyTV/headless] worker ready (' + VERSION + ')')
    post({ type: 'ready' })
  })
}

export interface HeadlessConvertOpts {
  timeoutMs?: number
  bootTimeoutMs?: number
  idleTeardownMs?: number
}

interface Pending {
  resolve: (v: any) => void
  reject: (e: any) => void
  timer: ReturnType<typeof setTimeout>
}

class HeadlessConvertManager {
  private iframe: HTMLIFrameElement | null = null
  private ready: Promise<void> | null = null
  private resolveReady: (() => void) | null = null
  private rejectReady: ((e: any) => void) | null = null
  private bootTimer: ReturnType<typeof setTimeout> | null = null
  private idleTimer: ReturnType<typeof setTimeout> | null = null
  private listening = false
  private seq = 0
  private active = 0
  private queue: Promise<unknown> = Promise.resolve()
  private pending = new Map<string, Pending>()

  private get win(): Window | null {
    return this.iframe?.contentWindow ?? null
  }

  private ensureListener() {
    if (this.listening) return
    this.listening = true
    window.addEventListener('message', this.onMessage)
  }

  private onMessage = (ev: MessageEvent) => {
    if (!this.iframe || ev.source !== this.iframe.contentWindow) return
    const d = ev.data
    if (!d || d[MSG] !== true) return
    if (d.type === 'ready') {
      if (this.bootTimer) { clearTimeout(this.bootTimer); this.bootTimer = null }
      this.resolveReady?.()
      this.resolveReady = null
      this.rejectReady = null
    } else if (d.type === 'convert-result') {
      const p = this.pending.get(d.reqId)
      if (p) { this.pending.delete(d.reqId); clearTimeout(p.timer); p.resolve(d.output) }
    } else if (d.type === 'convert-error') {
      const p = this.pending.get(d.reqId)
      if (p) { this.pending.delete(d.reqId); clearTimeout(p.timer); p.reject(new Error(d.error || 'headless convert failed')) }
    }
  }

  private clearIdle() {
    if (this.idleTimer) { clearTimeout(this.idleTimer); this.idleTimer = null }
  }

  private scheduleIdle(ms: number) {
    this.clearIdle()
    this.idleTimer = setTimeout(() => this.teardown(), ms)
  }

  teardown() {
    this.clearIdle()
    if (this.bootTimer) { clearTimeout(this.bootTimer); this.bootTimer = null }
    this.resolveReady = null
    this.rejectReady = null
    this.ready = null
    const f = this.iframe
    this.iframe = null
    if (f) { try { f.remove() } catch {} }
  }

  private boot(bootTimeoutMs: number): Promise<void> {
    this.ensureListener()
    this.clearIdle()
    if (this.ready && this.iframe?.isConnected && this.win) return this.ready

    this.teardown()

    this.ready = new Promise<void>((resolve, reject) => {
      this.resolveReady = resolve
      this.rejectReady = reject
    })

    let iframe: HTMLIFrameElement
    try {
      iframe = document.createElement('iframe')
      const url = new URL(window.location.href)
      url.searchParams.set(HEADLESS_PARAM, '1')
      url.hash = ''
      iframe.src = url.toString()
      Object.assign(iframe.style, {
        position: 'fixed', left: '-99999px', top: '0',
        width: '1280px', height: '720px',
        opacity: '0', border: '0', pointerEvents: 'none', visibility: 'hidden',
      })
      iframe.setAttribute('aria-hidden', 'true')
      iframe.setAttribute('tabindex', '-1')
      this.iframe = iframe
      document.body.appendChild(iframe)
    } catch (e) {
      const r = this.rejectReady
      this.teardown()
      r?.(e)
      return Promise.reject(e)
    }

    this.bootTimer = setTimeout(() => {
      const r = this.rejectReady
      this.teardown()
      r?.(new Error(`headless iframe boot timed out after ${bootTimeoutMs}ms`))
    }, bootTimeoutMs)

    return this.ready
  }

  private runOne(guiJson: any, timeoutMs: number, bootTimeoutMs: number): Promise<any> {
    return this.boot(bootTimeoutMs).then(() => {
      const cw = this.win
      if (!cw) throw new Error('headless iframe unavailable after boot')
      const reqId = `ctv-${Date.now().toString(36)}-${this.seq++}`
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          this.pending.delete(reqId)
          reject(new Error(`headless convert timed out after ${timeoutMs}ms`))
        }, timeoutMs)
        this.pending.set(reqId, { resolve, reject, timer })
        cw.postMessage({ [MSG]: true, type: 'convert', reqId, guiJson }, window.location.origin)
      })
    })
  }

  convert(guiJson: any, opts: HeadlessConvertOpts = {}): Promise<any> {
    const timeoutMs = opts.timeoutMs ?? DEFAULT_CONVERT_TIMEOUT_MS
    const bootTimeoutMs = opts.bootTimeoutMs ?? DEFAULT_BOOT_TIMEOUT_MS
    const idleMs = opts.idleTeardownMs ?? DEFAULT_IDLE_TEARDOWN_MS

    this.active++
    this.clearIdle()

    const prev = this.queue
    let release!: () => void
    this.queue = new Promise<void>(r => { release = r })

    const result = (async () => {
      try { await prev } catch {}
      return await this.runOne(guiJson, timeoutMs, bootTimeoutMs)
    })()

    const settle = () => {
      release()
      this.active--
      if (this.active === 0) this.scheduleIdle(idleMs)
    }
    result.then(settle, settle)
    return result
  }
}

const _manager = new HeadlessConvertManager()

export function convertGuiToApiHeadless(
  guiJson: any,
  opts: HeadlessConvertOpts = {},
): Promise<any> {
  return _manager.convert(guiJson, opts)
}

export function shutdownHeadlessConvert(): void {
  _manager.teardown()
}
