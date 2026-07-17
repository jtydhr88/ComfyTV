import { ref, type Ref } from 'vue'
import type { LGraphNode } from '@/lib/comfyApp'
import { normalizeMarks, parseMarks, uniformMarks } from '@/composables/stages/videoFrameMarks'
import { bindWidgetCallback, onNodeConfigure, readWidgetStr, writeWidget } from '@/utils/widget'

export function clampUniformN(raw: unknown): number {
  return Math.min(48, Math.max(2, Math.round(Number(raw) || 2)))
}

export function useFrameMarks(
  node: LGraphNode,
  opts: { duration: Ref<number>; currentTime: Ref<number> },
) {
  const { duration, currentTime } = opts

  const marks = ref<number[]>(parseMarks(readWidgetStr(node, 'marks', '')))
  const uniformN = ref(6)

  function writeMarks(v: number[]): void {
    marks.value = v
    writeWidget(node, 'marks', JSON.stringify(v))
  }

  function addMarkAtPlayhead(): void {
    if (duration.value <= 0) return
    writeMarks(normalizeMarks([...marks.value, currentTime.value]))
  }

  function addUniform(): void {
    if (duration.value <= 0) return
    writeMarks(uniformMarks(uniformN.value, duration.value))
  }

  function removeMark(i: number): void {
    writeMarks(marks.value.filter((_, idx) => idx !== i))
  }

  function clearMarks(): void {
    writeMarks([])
  }

  function setUniformN(raw: unknown): void {
    uniformN.value = clampUniformN(raw)
  }

  bindWidgetCallback(node, 'marks', (value) => {
    const parsed = parseMarks(String(value ?? ''))
    if (parsed.join() !== marks.value.join()) marks.value = parsed
  })

  onNodeConfigure(node, () => {
    const restored = parseMarks(readWidgetStr(node, 'marks', ''))
    if (restored.join() !== marks.value.join()) marks.value = restored
  })

  return {
    marks,
    uniformN,
    setUniformN,
    addMarkAtPlayhead,
    addUniform,
    removeMark,
    clearMarks,
  }
}
