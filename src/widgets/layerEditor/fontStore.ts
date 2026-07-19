import Typr, { type TyprFont } from '@/vendor/typr'

import type { FontRef } from './types'

export interface BuiltinFontInfo {
  id: string
  name: string
  url: string
}

const MANIFEST_URL = '/comfytv/fonts/manifest.json'

export const DEFAULT_FONT_REF: FontRef = { kind: 'builtin', id: 'inter' }

function fontKey(ref: FontRef): string {
  return ref.kind === 'builtin' ? `builtin:${ref.id}` : ref.url
}
function pickRegularInstance(fonts: TyprFont[]): TyprFont {
  const regular = fonts.find((f) => {
    const name = f.name as Record<string, unknown> | undefined
    return name?.fontSubfamily === 'Regular' || name?.typoSubfamilyName === 'Regular'
  })
  return regular ?? fonts[0]
}

class FontStore {
  private fonts = new Map<string, TyprFont>()
  private pending = new Map<string, Promise<TyprFont>>()
  private failed = new Set<string>()
  private manifest: BuiltinFontInfo[] | null = null
  private manifestPromise: Promise<BuiltinFontInfo[]> | null = null
  private readyListeners = new Set<() => void>()

  async ensureBuiltins(): Promise<BuiltinFontInfo[]> {
    if (this.manifest) return this.manifest
    if (!this.manifestPromise) {
      this.manifestPromise = fetch(MANIFEST_URL)
        .then((r) => (r.ok ? r.json() : []))
        .then((rows: unknown) => {
          this.manifest = Array.isArray(rows)
            ? rows.filter((r): r is BuiltinFontInfo =>
                !!r && typeof (r as BuiltinFontInfo).id === 'string'
                && typeof (r as BuiltinFontInfo).url === 'string')
            : []
          this.notifyReady()
          return this.manifest
        })
        .catch(() => {
          this.manifest = []
          return this.manifest
        })
    }
    return this.manifestPromise
  }

  builtins(): BuiltinFontInfo[] {
    void this.ensureBuiltins()
    return this.manifest ?? []
  }

  async loadFont(ref: FontRef): Promise<TyprFont> {
    const key = fontKey(ref)
    const cached = this.fonts.get(key)
    if (cached) return cached
    const pending = this.pending.get(key)
    if (pending) return pending

    const promise = (async () => {
      let url: string
      if (ref.kind === 'builtin') {
        const builtins = await this.ensureBuiltins()
        const info = builtins.find((b) => b.id === ref.id) ?? builtins[0]
        if (!info) throw new Error(`no builtin fonts available (wanted "${ref.id}")`)
        url = info.url
      } else {
        url = ref.url
      }
      const resp = await fetch(url)
      if (!resp.ok) throw new Error(`font fetch ${resp.status} for ${url}`)
      const buf = await resp.arrayBuffer()
      const fonts = Typr.parse(buf)
      if (!fonts.length) throw new Error(`Typr could not parse font at ${url}`)
      const font = pickRegularInstance(fonts)
      this.fonts.set(key, font)
      this.notifyReady()
      return font
    })()

    this.pending.set(key, promise)
    promise
      .catch(() => this.failed.add(key))
      .finally(() => this.pending.delete(key))
    return promise
  }
  getFontSync(ref: FontRef): TyprFont | null {
    const key = fontKey(ref)
    const cached = this.fonts.get(key)
    if (cached) return cached
    if (!this.failed.has(key)) {
      void this.loadFont(ref).catch(() => undefined)
    }
    return null
  }

  getFontSyncWithFallback(ref: FontRef): TyprFont | null {
    const font = this.getFontSync(ref)
    if (font) return font
    if (ref.kind === 'url' && this.failed.has(fontKey(ref))) {
      return this.getFontSync(DEFAULT_FONT_REF)
    }
    return null
  }

  hasFailed(ref: FontRef): boolean {
    return this.failed.has(fontKey(ref))
  }

  onFontReady(cb: () => void): () => void {
    this.readyListeners.add(cb)
    return () => this.readyListeners.delete(cb)
  }

  private notifyReady(): void {
    for (const cb of this.readyListeners) cb()
  }
}

let store: FontStore | null = null
export function getFontStore(): FontStore {
  if (!store) store = new FontStore()
  return store
}
