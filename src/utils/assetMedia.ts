export const PSD_MIME = 'image/vnd.adobe.photoshop'

export interface AssetMediaInfo {
  payload_url: string
  name?: string | null
  mime_type?: string | null
  metadata?: Record<string, unknown>
}

export function isPsdAsset(asset: AssetMediaInfo): boolean {
  if (asset.mime_type === PSD_MIME) return true
  const name = (asset.name ?? '').toLowerCase()
  if (name.endsWith('.psd') || name.endsWith('.psb')) return true
  const url = asset.payload_url.toLowerCase()
  return /\.(psd|psb)([?&#]|$)/.test(url) || /filename=[^&]*\.(psd|psb)/.test(url)
}

export function assetPreviewUrl(asset: AssetMediaInfo): string {
  const preview = asset.metadata?.preview_url
  return typeof preview === 'string' && preview ? preview : asset.payload_url
}
