import { fetchSettings } from '@/api'

const LS_KEY = 'comfytv.v2Enabled'

let enabled = false
try {
  enabled = localStorage.getItem(LS_KEY) === '1'
} catch { }

export function isV2Enabled(): boolean {
  return enabled
}

export async function hydrateV2Flag(): Promise<void> {
  try {
    const rows = (await fetchSettings()).settings
    const row = rows.find((r) => r.key === 'enable-v2')
    enabled = row?.value === true
    try {
      localStorage.setItem(LS_KEY, enabled ? '1' : '0')
    } catch { }
  } catch (e) {
    console.warn('[ComfyTV/v2] settings fetch failed — using cached flag', e)
  }
}
