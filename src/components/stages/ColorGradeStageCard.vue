<template>
  <div class="ctv:flex ctv:flex-col ctv:gap-1.5 ctv:size-full">
    <div class="ctv:grid ctv:grid-cols-[64px_1fr] ctv:items-center ctv:gap-1.5 ctv:text-xs">
      <span class="ctv:text-2xs ctv:uppercase ctv:tracking-wider ctv:text-muted-foreground">{{ $t('colorGrade.effect') }}</span>
      <ComfyTVSelect
        :model-value="effectId"
        :options="effectOptions"
        @update:model-value="(v) => onEffectChange(String(v))"
      />
    </div>

    <div class="ctv:relative ctv:w-full ctv:h-[260px] ctv:rounded-md ctv:overflow-hidden ctv:border ctv:border-border-subtle
                ctv:bg-black ctv:flex ctv:items-center ctv:justify-center">
      <div v-if="!sourceImageUrl" class="ctv:flex ctv:flex-col ctv:items-center ctv:justify-center ctv:gap-1.5 ctv:text-white/50">
        <div class="ctv:text-[32px] ctv:opacity-60">⊟</div>
        <div class="ctv:text-xs">{{ $t('colorGrade.noInputImage') }}</div>
      </div>
      <canvas
        v-show="sourceImageUrl"
        ref="previewCanvas"
        class="ctv:max-w-full ctv:max-h-full ctv:object-contain ctv:select-none ctv:pointer-events-none"
      />
    </div>

    <div class="ctv:text-2xs ctv:text-center ctv:py-0.5 ctv:tracking-wide">
      <span v-if="renderError" class="ctv:text-error-background">{{ renderError }}</span>
      <span v-else-if="!sourceImageUrl" class="ctv:text-muted-foreground">{{ $t('colorGrade.noInputImage') }}</span>
      <span v-else-if="computing" class="ctv:text-muted-foreground">{{ $t('colorGrade.applying') }}</span>
      <span v-else-if="state.output" class="ctv:text-success-background">{{ $t('colorGrade.applied') }}</span>
      <span v-else class="ctv:text-muted-foreground">{{ $t('colorGrade.adjustToApply') }}</span>
    </div>

    <div v-if="curveUniforms.length" class="ctv:flex ctv:flex-col ctv:gap-1">
      <div class="ctv:flex ctv:items-center ctv:gap-1">
        <button
          v-for="cu in curveUniforms"
          :key="cu.key"
          type="button"
          class="ctv:flex-1 ctv:py-0.5 ctv:rounded ctv:text-2xs ctv:cursor-pointer ctv:border"
          :class="cu.key === activeCurveKey
            ? 'ctv:bg-secondary-background-hover ctv:border-border-subtle ctv:text-base-foreground'
            : 'ctv:bg-secondary-background ctv:border-transparent ctv:text-muted-foreground ctv:hover:bg-secondary-background-hover'"
          :style="{ borderLeft: `3px solid ${cu.curveColor}` }"
          @click="activeCurveKey = cu.key"
        >{{ $t(cu.labelKey) }}</button>
        <button
          type="button"
          class="ctv:py-0.5 ctv:px-1.5 ctv:rounded ctv:text-2xs ctv:cursor-pointer
                 ctv:bg-secondary-background ctv:border ctv:border-border-subtle ctv:text-base-foreground ctv:hover:bg-secondary-background-hover"
          @click="resetActiveCurve"
        >{{ $t('colorGrade.resetCurve') }}</button>
      </div>
      <CurveEditor
        v-if="activeCurveUniform"
        v-model="activeCurvePoints"
        :curve-color="activeCurveUniform.curveColor"
        @pointerup="commitNow"
      />
    </div>

    <div class="ctv:flex ctv:flex-col ctv:gap-1">
      <div
        v-for="u in scalarUniforms"
        :key="u.key"
        class="ctv:grid ctv:grid-cols-[88px_1fr] ctv:items-center ctv:gap-1.5 ctv:text-xs"
      >
        <span class="ctv:text-2xs ctv:uppercase ctv:tracking-wider ctv:text-muted-foreground ctv:truncate">{{ $t(u.labelKey) }}</span>

        <ComfyTVSelect
          v-if="u.options"
          :model-value="String(num(u.key))"
          :options="optionList(u)"
          @update:model-value="(v) => setValueCommit(u.key, Number(v))"
        />

        <ComfyTVToggle
          v-else-if="u.kind === 'bool'"
          :model-value="bool(u.key)"
          @update:model-value="(v) => setValueCommit(u.key, v)"
        />

        <GradientSlider
          v-else-if="u.gradient"
          :model-value="num(u.key)"
          :stops="u.gradient"
          :min="u.min ?? 0"
          :max="u.max ?? 100"
          :step="u.step ?? 1"
          :precision="(u.step ?? 1) < 1 ? undefined : 0"
          @update:model-value="(v) => setValueByKey(u.key, v)"
          @commit="commitNow"
        />

        <ComfyTVSlider
          v-else
          :model-value="num(u.key)"
          :min="u.min ?? 0"
          :max="u.max ?? 100"
          :step="u.step ?? 1"
          :precision="(u.step ?? 1) < 1 ? undefined : 0"
          @update:model-value="(v) => setValueByKey(u.key, v)"
          @commit="commitNow"
        />
      </div>

      <button
        type="button"
        class="ctv:mt-0.5 ctv:py-1 ctv:px-1.5 ctv:rounded ctv:text-2xs ctv:cursor-pointer ctv:self-end
               ctv:bg-secondary-background ctv:border ctv:border-border-subtle ctv:text-base-foreground ctv:hover:bg-secondary-background-hover"
        @click="resetEffect"
      >{{ $t('colorGrade.reset') }}</button>
    </div>

    <StageCard
      :state="state"
      :node="node"
      :on-run-request="onRunRequest"
      :on-cancel-request="onCancelRequest"
      :on-disconnect="onDisconnect"
      :on-action="onAction"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, onUnmounted, reactive, ref, watch } from 'vue'
import type { LGraphNode } from '@/lib/comfyApp'
import type { StageState } from '@/stores/stageStore'
import StageCard from '@/components/stages/StageCard.vue'
import ComfyTVSlider from '@/components/widgets/ComfyTVSlider.vue'
import ComfyTVSelect from '@/components/widgets/ComfyTVSelect.vue'
import ComfyTVToggle from '@/components/widgets/ComfyTVToggle.vue'
import GradientSlider from '@/components/widgets/GradientSlider.vue'
import CurveEditor from '@/components/widgets/curve/CurveEditor.vue'
import { identityCurve, type CurvePoint } from '@/components/widgets/curve/types'
import { isCurveData } from '@/components/widgets/curve/curveUtils'
import { pickSourceImageUrl } from '@/composables/stages/stageInputs'
import { useTransformPipeline } from '@/composables/widgets/useTransformPipeline'
import { useI18n } from 'vue-i18n'
import { bindWidgetCallback, onNodeConfigure, readWidgetStr, writeWidget } from '@/utils/widget'
import {
  COLOR_GRADE_EFFECTS,
  DEFAULT_EFFECT_ID,
  cloneGradeValue,
  defaultValues,
  getEffect,
  type ColorGradeEffect,
  type GradeUniform,
} from '@/widgets/glsl/effects'
import { GradeRenderer, type GradeValues } from '@/widgets/glsl/renderGrade'

const props = defineProps<{
  state: StageState
  onRunRequest: () => void
  onCancelRequest: () => void
  onDisconnect: (slot: string) => void
  onAction: (id: string) => void
  node: LGraphNode
}>()

const { t } = useI18n()
const WIDGET = 'grade_state'

const sourceImageUrl = computed(() => pickSourceImageUrl(props.state.inputs))

const effectId = ref<string>(DEFAULT_EFFECT_ID)
const allValues = reactive<Record<string, GradeValues>>({})

const effect = computed<ColorGradeEffect>(() => getEffect(effectId.value))
const values = computed<GradeValues>(() => ensureEffect(effectId.value))

const effectOptions = computed(() =>
  COLOR_GRADE_EFFECTS.map((e) => ({ value: e.id, label: t(e.labelKey) }))
)

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
function optionList(u: GradeUniform) {
  return (u.options ?? []).map((o) => ({ value: String(o.value), label: t(o.labelKey) }))
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

function resetActiveCurve() {
  if (activeCurveKey.value) setValueCommit(activeCurveKey.value, identityCurve())
}

function serialize(): string {
  return JSON.stringify({ effect: effectId.value, all: allValues })
}

function persist(): void {
  writeWidget(props.node, WIDGET, serialize())
}

function loadFromWidget(): void {
  const raw = readWidgetStr(props.node, WIDGET, '')
  if (!raw) {
    ensureEffect(effectId.value)
    return
  }
  try {
    const parsed = JSON.parse(raw) as { effect?: string; all?: Record<string, GradeValues> }
    if (parsed.all && typeof parsed.all === 'object') {
      for (const [id, vals] of Object.entries(parsed.all)) {
        allValues[id] = { ...defaultValues(getEffect(id)), ...vals }
      }
    }
    if (parsed.effect && getEffect(parsed.effect).id === parsed.effect) {
      effectId.value = parsed.effect
    }
  } catch {
    void 0
  }
  ensureEffect(effectId.value)
}

loadFromWidget()

bindWidgetCallback(props.node, WIDGET, () => loadFromWidget())
onNodeConfigure(props.node, () => loadFromWidget())

function setValueByKey(key: string, v: GradeValues[string]): void {
  ensureEffect(effectId.value)[key] = cloneGradeValue(v)
  persist()
  renderPreview()
}

function commitNow(): void {
  requestRecompute()
}

function setValueCommit(key: string, v: GradeValues[string]): void {
  setValueByKey(key, v)
  commitNow()
}

function onEffectChange(id: string): void {
  effectId.value = id
  ensureEffect(id)
  persist()
  renderPreview()
  commitNow()
}

function resetEffect(): void {
  allValues[effectId.value] = defaultValues(effect.value)
  persist()
  renderPreview()
  commitNow()
}

const previewCanvas = ref<HTMLCanvasElement | null>(null)
const renderError = ref<string | null>(null)
const grade = new GradeRenderer()

let previewImg: HTMLImageElement | null = null
let previewImgUrl: string | null = null
let previewTimer: number | null = null

function loadPreviewImage(url: string): Promise<HTMLImageElement> {
  if (previewImg && previewImgUrl === url && previewImg.complete) {
    return Promise.resolve(previewImg)
  }
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      previewImg = img
      previewImgUrl = url
      resolve(img)
    }
    img.onerror = (e) => reject(e)
    img.src = url
  })
}

function renderPreview(): void {
  if (previewTimer != null) window.clearTimeout(previewTimer)
  previewTimer = window.setTimeout(() => {
    previewTimer = null
    const url = sourceImageUrl.value
    const canvas = previewCanvas.value
    if (!url || !canvas) return
    void loadPreviewImage(url)
      .then((img) => {
        const ok = grade.renderToCanvas(img, effect.value, values.value, canvas)
        renderError.value = ok ? null : grade.error
      })
      .catch(() => {
        renderError.value = 'Failed to load image'
      })
  }, 30)
}

const { computing, requestRecompute } = useTransformPipeline({
  sourceImageUrl,
  state: props.state,
  nodeId: props.node?.id ?? 'unknown',
  filenamePrefix: 'comfytv-grade',
  subfolder: 'colorgrade',
  compute: (img) => {
    const out = document.createElement('canvas')
    const ok = grade.renderToCanvas(img, effect.value, values.value, out)
    if (!ok) throw new Error(grade.error ?? 'Grade render failed')
    return out
  },
})

watch(sourceImageUrl, (url) => {
  if (url) {
    renderPreview()
    requestRecompute()
  }
}, { immediate: true })

onUnmounted(() => {
  if (previewTimer != null) window.clearTimeout(previewTimer)
  grade.dispose()
})
</script>
