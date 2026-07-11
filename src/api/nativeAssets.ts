import { app } from '@/lib/comfyApp'

interface NativeAsset {
  id: string
  name: string
  hash?: string
  preview_url?: string
  preview_id?: string | null
}

function comfyApi(): any {
  return (app as any).api
}

let supportedPromise: Promise<boolean> | null = null

export function nativeAssetsSupported(): Promise<boolean> {
  supportedPromise ??= (async () => {
    try {
      const api = comfyApi()
      const flag = api?.getServerFeature?.('assets')
      if (typeof flag === 'boolean') return flag
      const res = await api.fetchApi('/assets?limit=1')
      return !!res?.ok
    } catch {
      return false
    }
  })()
  return supportedPromise
}

async function fetchAssets(params: Record<string, string>): Promise<NativeAsset[]> {
  const query = new URLSearchParams(params)
  const res = await comfyApi().fetchApi(`/assets?${query}`)
  if (!res.ok) return []
  const data = await res.json()
  return Array.isArray(data?.assets) ? data.assets : []
}

async function findNativeAssetByName(name: string): Promise<NativeAsset | undefined> {
  const matches = await fetchAssets({ name_contains: name })
  return matches.find((a) => a.name === name)
}

function resolvePreviewUrl(asset: NativeAsset): string {
  const api = comfyApi()
  if (asset.preview_url) return api.apiURL(asset.preview_url)
  return api.apiURL(`/assets/${asset.preview_id ?? asset.id}/content`)
}

export function modelLookupName(urlOrPath: string): string {
  if (!urlOrPath) return ''
  let name = urlOrPath
  try {
    const params = new URL(urlOrPath, window.location.origin).searchParams
    name = params.get('filename') ?? urlOrPath
  } catch {
  }
  const slash = Math.max(name.lastIndexOf('/'), name.lastIndexOf('\\'))
  return slash >= 0 ? name.slice(slash + 1) : name
}

const previewCache = new Map<string, Promise<string | null>>()

export function findModelPreviewUrl(urlOrPath: string): Promise<string | null> {
  const name = modelLookupName(urlOrPath)
  if (!name) return Promise.resolve(null)
  let pending = previewCache.get(name)
  if (!pending) {
    pending = (async () => {
      if (!(await nativeAssetsSupported())) return null
      try {
        const asset = await findNativeAssetByName(name)
        if (!asset?.preview_id) return null
        return resolvePreviewUrl(asset)
      } catch {
        return null
      }
    })()
    previewCache.set(name, pending)
  }
  return pending
}

type PreviewListener = (name: string, url: string) => void
const previewListeners = new Set<PreviewListener>()

export function onModelPreviewChanged(listener: PreviewListener): () => void {
  previewListeners.add(listener)
  return () => previewListeners.delete(listener)
}

export async function persistModelThumbnail(urlOrPath: string, blob: Blob): Promise<void> {
  const name = modelLookupName(urlOrPath)
  if (!name) return
  if (!(await nativeAssetsSupported())) return
  try {
    const asset = await findNativeAssetByName(name)
    if (!asset || asset.preview_id) return

    const api = comfyApi()
    const previewFilename = `${asset.name}_preview.png`
    const form = new FormData()
    form.append('file', blob, previewFilename)
    form.append('tags', 'output')
    form.append('name', previewFilename)
    form.append('user_metadata', JSON.stringify({ filename: previewFilename }))
    const uploadRes = await api.fetchApi('/assets', { method: 'POST', body: form })
    if (!uploadRes.ok) return
    const uploaded = await uploadRes.json()
    if (!uploaded?.id) return

    const linkRes = await api.fetchApi(`/assets/${asset.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ preview_id: uploaded.id }),
    })
    if (!linkRes.ok) return

    const url = api.apiURL(`/assets/${uploaded.id}/content`)
    previewCache.set(name, Promise.resolve(url))
    for (const listener of previewListeners) listener(name, url)
  } catch {
  }
}
