<template>
  <div class="v2-ed" @pointerdown.stop>
    <div class="v2-ed__canvas">
      <div class="v2-ed__fit">
        <canvas v-show="sourceImageUrl" ref="previewCanvas" />
      </div>
      <div v-if="!sourceImageUrl" class="v2-ed__empty">{{ $t('colorGrade.noInputImage') }}</div>
    </div>

    <div class="v2-ed__panel">
      <div class="v2-ed__row v2-grade__effectrow">
        <span class="v2-ed__label">{{ $t('colorGrade.effect') }}</span>
        <ComfyTVSelect
          :model-value="effectId"
          :options="effectOptions"
          @update:model-value="(v) => onEffectChange(String(v))"
        />
      </div>

      <template v-if="curveUniforms.length">
        <div class="v2-ed__chips">
          <button
            v-for="cu in curveUniforms"
            :key="cu.key"
            type="button"
            class="v2-ed__chip"
            :data-on="cu.key === activeCurveKey ? '1' : ''"
            :style="{ borderLeft: `3px solid ${cu.curveColor}` }"
            @click="activeCurveKey = cu.key"
          >{{ $t(cu.labelKey) }}</button>
          <button type="button" class="v2-ed__chip v2-grade__reset" @click="resetActiveCurve">
            {{ $t('colorGrade.resetCurve') }}
          </button>
        </div>
        <CurveEditor
          v-if="activeCurveUniform"
          v-model="activeCurvePoints"
          :curve-color="activeCurveUniform.curveColor"
          @pointerup="commitNow"
        />
      </template>

      <div
        v-for="u in scalarUniforms"
        :key="u.key"
        class="v2-ed__row v2-grade__paramrow"
      >
        <span class="v2-ed__label">{{ $t(u.labelKey) }}</span>

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

      <div class="v2-ed__chips">
        <span class="v2-ed__spacer" />
        <button type="button" class="v2-ed__chip v2-grade__reset" @click="resetEffect">
          {{ $t('colorGrade.reset') }}
        </button>
      </div>
    </div>

    <div class="v2-ed__status">
      <span class="v2-ed__spacer" />
      <span v-if="renderError" class="v2-grade__error">{{ renderError }}</span>
      <span v-else-if="!sourceImageUrl">{{ $t('colorGrade.noInputImage') }}</span>
      <span v-else-if="computing" class="v2-ed__busy">{{ $t('v2.applying') }}</span>
      <span v-else-if="state.output" class="v2-ed__ok">{{ $t('v2.appliedLive') }}</span>
      <span v-else>{{ $t('colorGrade.adjustToApply') }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import ComfyTVSelect from '@/components/widgets/ComfyTVSelect.vue'
import ComfyTVSlider from '@/components/widgets/ComfyTVSlider.vue'
import ComfyTVToggle from '@/components/widgets/ComfyTVToggle.vue'
import GradientSlider from '@/components/widgets/GradientSlider.vue'
import CurveEditor from '@/components/widgets/curve/CurveEditor.vue'
import { pickSourceImageUrl } from '@/composables/stages/stageInputs'
import { useColorGradeState } from '@/composables/stages/useColorGradeState'
import { useGradePreview } from '@/composables/stages/useGradePreview'
import { useTransformPipeline } from '@/composables/widgets/useTransformPipeline'
import type { LGraphNode } from '@/lib/comfyApp'
import type { StageState } from '@/stores/stageStore'
import { COLOR_GRADE_EFFECTS, type GradeUniform } from '@/widgets/glsl/effects'

const props = defineProps<{
  node: LGraphNode
  state: StageState
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
  subfolder: 'comfytv/colorgrade',
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

<style scoped>
.v2-grade__effectrow,
.v2-grade__paramrow {
  grid-template-columns: 88px 1fr;
}
.v2-grade__reset {
  flex: none;
  color: var(--v2-text-muted);
}
.v2-grade__error {
  color: var(--destructive-background, #ef4444);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
