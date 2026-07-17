import { computed, reactive, ref, watch } from 'vue'
import type { LGraphNode } from '@/lib/comfyApp'
import { identityCurve, type CurvePoint } from '@/components/widgets/curve/types'
import { isCurveData } from '@/components/widgets/curve/curveUtils'
import { bindWidgetCallback, onNodeConfigure, readWidgetStr, writeWidget } from '@/utils/widget'
import {
  DEFAULT_EFFECT_ID,
  cloneGradeValue,
  defaultValues,
  getEffect,
  type ColorGradeEffect,
} from '@/widgets/glsl/effects'
import type { GradeValues } from '@/widgets/glsl/renderGrade'

export const GRADE_STATE_WIDGET = 'grade_state'

export interface ParsedGradeState {
  effect: string | null
  all: Record<string, GradeValues>
}

export function serializeGradeState(effect: string, all: Record<string, GradeValues>): string {
  return JSON.stringify({ effect, all })
}

export function parseGradeState(raw: string): ParsedGradeState {
  const out: ParsedGradeState = { effect: null, all: {} }
  if (!raw) return out
  try {
    const parsed = JSON.parse(raw) as { effect?: string; all?: Record<string, GradeValues> }
    if (parsed.all && typeof parsed.all === 'object') {
      for (const [id, vals] of Object.entries(parsed.all)) {
        out.all[id] = { ...defaultValues(getEffect(id)), ...vals }
      }
    }
    if (parsed.effect && getEffect(parsed.effect).id === parsed.effect) {
      out.effect = parsed.effect
    }
  } catch {
    void 0
  }
  return out
}

export interface UseColorGradeStateOptions {
  widgetName?: string
  onChange?: () => void
  onCommit?: () => void
}

export function useColorGradeState(node: LGraphNode, opts: UseColorGradeStateOptions = {}) {
  const widgetName = opts.widgetName ?? GRADE_STATE_WIDGET

  const effectId = ref<string>(DEFAULT_EFFECT_ID)
  const allValues = reactive<Record<string, GradeValues>>({})

  const effect = computed<ColorGradeEffect>(() => getEffect(effectId.value))
  const values = computed<GradeValues>(() => ensureEffect(effectId.value))

  const scalarUniforms = computed(() => effect.value.uniforms.filter((u) => u.kind !== 'curve'))
  const curveUniforms = computed(() => effect.value.uniforms.filter((u) => u.kind === 'curve'))

  function ensureEffect(id: string): GradeValues {
    if (!allValues[id]) allValues[id] = defaultValues(getEffect(id))
    return allValues[id]
  }

  function num(key: string): number {
    const v = values.value[key]
    return typeof v === 'number' ? v : 0
  }

  function bool(key: string): boolean {
    return Boolean(values.value[key])
  }

  const activeCurveKey = ref<string>('')
  const activeCurveUniform = computed(() => curveUniforms.value.find((u) => u.key === activeCurveKey.value) ?? null)

  watch(curveUniforms, (list) => {
    if (!list.some((u) => u.key === activeCurveKey.value)) {
      activeCurveKey.value = list[0]?.key ?? ''
    }
  }, { immediate: true })

  const activeCurvePoints = computed<CurvePoint[]>({
    get() {
      const v = values.value[activeCurveKey.value]
      return isCurveData(v) ? v.points : identityCurve().points
    },
    set(points) {
      const key = activeCurveKey.value
      const cur = values.value[key]
      const interpolation = isCurveData(cur) ? cur.interpolation : 'monotone_cubic'
      setValueByKey(key, { points, interpolation })
    },
  })

  function resetActiveCurve(): void {
    if (activeCurveKey.value) setValueCommit(activeCurveKey.value, identityCurve())
  }

  function serialize(): string {
    return serializeGradeState(effectId.value, allValues)
  }

  function persist(): void {
    writeWidget(node, widgetName, serialize())
  }

  function loadFromWidget(): void {
    const raw = readWidgetStr(node, widgetName, '')
    if (raw) {
      const parsed = parseGradeState(raw)
      for (const [id, vals] of Object.entries(parsed.all)) {
        allValues[id] = vals
      }
      if (parsed.effect) effectId.value = parsed.effect
    }
    ensureEffect(effectId.value)
  }

  loadFromWidget()

  bindWidgetCallback(node, widgetName, () => loadFromWidget())
  onNodeConfigure(node, () => loadFromWidget())

  function setValueByKey(key: string, v: GradeValues[string]): void {
    ensureEffect(effectId.value)[key] = cloneGradeValue(v)
    persist()
    opts.onChange?.()
  }

  function commitNow(): void {
    opts.onCommit?.()
  }

  function setValueCommit(key: string, v: GradeValues[string]): void {
    setValueByKey(key, v)
    commitNow()
  }

  function onEffectChange(id: string): void {
    effectId.value = id
    ensureEffect(id)
    persist()
    opts.onChange?.()
    commitNow()
  }

  function resetEffect(): void {
    allValues[effectId.value] = defaultValues(effect.value)
    persist()
    opts.onChange?.()
    commitNow()
  }

  return {
    effectId,
    allValues,
    effect,
    values,
    scalarUniforms,
    curveUniforms,
    num,
    bool,
    activeCurveKey,
    activeCurveUniform,
    activeCurvePoints,
    resetActiveCurve,
    serialize,
    loadFromWidget,
    setValueByKey,
    setValueCommit,
    commitNow,
    onEffectChange,
    resetEffect,
  }
}
