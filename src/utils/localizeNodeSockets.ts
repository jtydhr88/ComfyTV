import { app, type ComfyNode } from '@/lib/comfyApp'

/** Match ComfyUI frontend normalizeI18nKey (dots → underscores). */
export function normalizeI18nKey(key: string): string {
  return key.replace(/\./g, '_')
}

function comfyTranslate(key: string, fallback: string): string {
  const i18n = (app as any)?.vueApp?.config?.globalProperties?.$i18n?.global
  if (!i18n?.te?.(key)) return fallback
  const value = i18n.t(key)
  return typeof value === 'string' ? value : fallback
}

/** Apply nodeDefs input/output socket labels (incl. autogrow slots like texts.text0). */
export function localizeNodeSockets(node: ComfyNode) {
  if (!node.comfyClass?.startsWith('ComfyTV.')) return

  const nodeKey = normalizeI18nKey(node.comfyClass)

  for (const input of node.inputs ?? []) {
    if (!input?.name) continue
    const nameKey = `nodeDefs.${nodeKey}.inputs.${normalizeI18nKey(input.name)}.name`
    const fallback = input.label ?? input.localized_name ?? input.name
    const translated = comfyTranslate(nameKey, fallback)
    input.label = translated
    input.localized_name = translated
  }

  for (let i = 0; i < (node.outputs?.length ?? 0); i++) {
    const output = node.outputs![i]
    const nameKey = `nodeDefs.${nodeKey}.outputs.${i}.name`
    const fallback = output.label ?? output.localized_name ?? output.name
    const translated = comfyTranslate(nameKey, fallback)
    output.label = translated
    output.localized_name = translated
  }
}
