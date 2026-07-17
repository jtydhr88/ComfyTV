export interface ColorPreviewValues {
  exposure: number
  saturation: number
  hue: number
  temperature: number
}

export function colorPreviewStyle(v: ColorPreviewValues): Record<string, string> {
  const parts: string[] = []
  if (v.exposure) parts.push(`brightness(${Math.pow(2, v.exposure).toFixed(3)})`)
  if (v.saturation) parts.push(`saturate(${(1 + v.saturation).toFixed(3)})`)
  if (v.hue) parts.push(`hue-rotate(${v.hue}deg)`)
  if (v.temperature !== 6500) {
    const d = (v.temperature - 6500) / 5500
    if (d < 0) parts.push(`sepia(${Math.min(0.5, -d * 0.4).toFixed(3)})`)
    else parts.push(`hue-rotate(${(-d * 18).toFixed(1)}deg)`)
  }
  const style: Record<string, string> = {}
  if (parts.length) style.filter = parts.join(' ')
  return style
}
