export type PresetCategory = 'imageVariant' | 'imageEdit' | 'videoChange'

export function actionNamespace(kind: string): string {
  if (kind === 'image-picker' || kind === 'image-batch') return 'image'
  return kind
}

export function actionLabelKey(kind: string, actionId: string): string {
  return `actions.${actionNamespace(kind)}.${actionId}.label`
}

export function actionTooltipKey(kind: string, actionId: string): string {
  return `actions.${actionNamespace(kind)}.${actionId}.tooltip`
}

export function presetLabelKey(category: PresetCategory, presetId: string): string {
  return `presets.${category}.${presetId}.label`
}

export function presetTooltipKey(category: PresetCategory, presetId: string): string {
  return `presets.${category}.${presetId}.tooltip`
}
