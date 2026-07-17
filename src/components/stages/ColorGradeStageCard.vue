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
        <i class="pi pi-image ctv:text-[32px] ctv:opacity-60" />
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
import { computed, ref, watch } from 'vue'
import type { LGraphNode } from '@/lib/comfyApp'
import type { StageState } from '@/stores/stageStore'
import StageCard from '@/components/stages/StageCard.vue'
import ComfyTVSlider from '@/components/widgets/ComfyTVSlider.vue'
import ComfyTVSelect from '@/components/widgets/ComfyTVSelect.vue'
import ComfyTVToggle from '@/components/widgets/ComfyTVToggle.vue'
import GradientSlider from '@/components/widgets/GradientSlider.vue'
import CurveEditor from '@/components/widgets/curve/CurveEditor.vue'
import { pickSourceImageUrl } from '@/composables/stages/stageInputs'
import { useColorGradeState } from '@/composables/stages/useColorGradeState'
import { useGradePreview } from '@/composables/stages/useGradePreview'
import { useTransformPipeline } from '@/composables/widgets/useTransformPipeline'
import { useI18n } from 'vue-i18n'
import { COLOR_GRADE_EFFECTS, type GradeUniform } from '@/widgets/glsl/effects'

const props = defineProps<{
  state: StageState
  onRunRequest: () => void
  onCancelRequest: () => void
  onDisconnect: (slot: string) => void
  onAction: (id: string) => void
  node: LGraphNode
}>()

const { t } = useI18n()

const sourceImageUrl = computed(() => pickSourceImageUrl(props.state.inputs))

const {
  effectId,
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
  setValueByKey,
  setValueCommit,
  commitNow,
  onEffectChange,
  resetEffect,
} = useColorGradeState(props.node, {
  onChange: () => renderPreview(),
  onCommit: () => requestRecompute(),
})

const effectOptions = computed(() =>
  COLOR_GRADE_EFFECTS.map((e) => ({ value: e.id, label: t(e.labelKey) }))
)

function optionList(u: GradeUniform) {
  return (u.options ?? []).map((o) => ({ value: String(o.value), label: t(o.labelKey) }))
}

const previewCanvas = ref<HTMLCanvasElement | null>(null)

const { renderError, renderer, renderPreview } = useGradePreview({
  sourceImageUrl,
  canvasEl: previewCanvas,
  effect,
  values,
})

const { computing, requestRecompute } = useTransformPipeline({
  sourceImageUrl,
  state: props.state,
  nodeId: props.node?.id ?? 'unknown',
  filenamePrefix: 'comfytv-grade',
  subfolder: 'colorgrade',
  compute: (img) => {
    const out = document.createElement('canvas')
    const ok = renderer.renderToCanvas(img, effect.value, values.value, out)
    if (!ok) throw new Error(renderer.error ?? 'Grade render failed')
    return out
  },
})

watch(sourceImageUrl, (url) => {
  if (url) {
    renderPreview()
    requestRecompute()
  }
}, { immediate: true })
</script>
