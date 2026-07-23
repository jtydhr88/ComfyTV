<template>
  <FxCardShell :node="node">
    <template #player>
      <VideoPlayerLite ref="playerRef" :source-video-url="sourceVideoUrl">
        <template #overlay>
          <canvas
            v-show="supported"
            ref="previewCanvas"
            class="ctv:absolute ctv:inset-0 ctv:size-full ctv:object-contain ctv:pointer-events-none"
          />
        </template>
      </VideoPlayerLite>
    </template>

    <div
      class="ctv:flex ctv:flex-col ctv:gap-1"
      @pointerdown.stop
      @pointermove.stop
      @pointerup.stop
    >
      <FxChips v-model="emitter" :options="EMITTER_OPTS" />
      <div
        class="ctv:h-56 ctv:shrink-0 ctv:overflow-y-auto ctv-scroll-thin ctv:flex ctv:flex-col ctv:gap-1"
        @wheel.stop
      >
        <FxSlider v-model="ex0" label="X0" :min="0" :max="1" :step="0.005" :reset-to="0.5" />
        <FxSlider v-model="ey0" label="Y0" :min="0" :max="1" :step="0.005" :reset-to="0.85" />
        <template v-if="emitter !== 'point'">
          <FxSlider v-model="ex1" label="X1" :min="0" :max="1" :step="0.005" :reset-to="0.5" />
          <FxSlider v-model="ey1" label="Y1" :min="0" :max="1" :step="0.005" :reset-to="0.85" />
        </template>
        <FxSlider v-model="rate" label="Rate" :min="0" :max="2000" :step="1" :decimals="0" :reset-to="120" />
        <FxSlider v-model="lifetime" label="Lifetime" :min="0.1" :max="10" :step="0.1" unit="s" :reset-to="2" />
        <FxSlider v-model="speed" label="Speed" :min="0" :max="1200" :step="1" :decimals="0" :reset-to="120" />
        <FxSlider v-model="direction" label="Direction" :min="-180" :max="180" :step="1" :decimals="0" :reset-to="-90" />
        <FxSlider v-model="spread" label="Spread" :min="0" :max="180" :step="1" :decimals="0" :reset-to="30" />
        <FxSlider v-model="gravity" label="Gravity" :min="-600" :max="600" :step="1" :decimals="0" :reset-to="60" />
        <FxSlider v-model="wind" label="Wind" :min="-600" :max="600" :step="1" :decimals="0" :reset-to="0" />
        <FxSlider v-model="turbulence" label="Turbulence" :min="0" :max="600" :step="1" :decimals="0" :reset-to="60" />
        <FxSlider v-model="turbScale" label="Turb Scale" :min="8" :max="600" :step="1" :decimals="0" :reset-to="120" />
        <FxSlider v-model="drag" label="Drag" :min="0" :max="0.99" :step="0.01" :reset-to="0.1" />

        <span :class="lbl">Attractor</span>
        <FxSlider v-model="attractStrength" label="Strength" :min="-600" :max="600" :step="1" :decimals="0" :reset-to="0" />
        <FxSlider v-model="attractX" label="X" :min="0" :max="1" :step="0.005" :reset-to="0.5" />
        <FxSlider v-model="attractY" label="Y" :min="0" :max="1" :step="0.005" :reset-to="0.5" />
        <FxSlider v-model="attractRadius" label="Radius" :min="0.05" :max="1.5" :step="0.01" :reset-to="0.5" />
        <FxSlider v-model="swirl" label="Swirl" :min="-600" :max="600" :step="1" :decimals="0" :reset-to="0" />

        <span :class="lbl">Collision</span>
        <FxChips v-model="collide" :options="COLLIDE_OPTS" />
        <template v-if="collide !== 'none'">
          <FxSlider v-model="floorY" label="Floor" :min="0" :max="1" :step="0.005" :reset-to="0.9" />
          <FxSlider v-if="collide === 'bounce'" v-model="bounce" label="Bounce" :min="0" :max="1" :step="0.01" :reset-to="0.5" />
        </template>

        <span :class="lbl">Sub-emitter</span>
        <FxChips v-model="subMode" :options="SUB_OPTS" />
        <template v-if="subMode !== 'none'">
          <FxSlider v-model="subCount" label="Count" :min="0" :max="30" :step="1" :decimals="0" :reset-to="8" />
          <FxSlider v-model="subSpeed" label="Speed" :min="0" :max="600" :step="1" :decimals="0" :reset-to="120" />
          <FxSlider v-model="subLifetime" label="Lifetime" :min="0.1" :max="5" :step="0.1" unit="s" :reset-to="0.6" />
          <FxSlider v-model="subSizeRatio" label="Size ×" :min="0.1" :max="2" :step="0.05" :reset-to="0.5" />
          <label class="ctv:flex ctv:items-center ctv:gap-1 ctv:text-2xs ctv:text-muted-foreground">
            Color <input type="color" v-model="subColor" class="ctv:h-5 ctv:w-8 ctv:cursor-pointer ctv:border-0 ctv:bg-transparent ctv:p-0" />
          </label>
        </template>

        <span :class="lbl">Look</span>
        <FxSlider v-model="size" label="Size" :min="1" :max="64" :step="0.5" :reset-to="12" />
        <FxSlider v-model="sizeEndRatio" label="End Size ×" :min="0" :max="3" :step="0.05" :reset-to="0.4" />
        <FxSlider v-model="opacityStart" label="Opacity In" :min="0" :max="1" :step="0.01" :reset-to="1" />
        <FxSlider v-model="opacityEnd" label="Opacity Out" :min="0" :max="1" :step="0.01" :reset-to="0" />
        <FxSlider v-model="stretch" v-if="renderer === 'stretched'" label="Stretch" :min="0" :max="3" :step="0.05" :reset-to="1" />
        <FxSlider v-model="trailLen" v-if="renderer === 'trail'" label="Trail" :min="2" :max="5" :step="1" :decimals="0" :reset-to="4" />
        <FxSlider v-model="warmup" label="Warmup" :min="0" :max="10" :step="0.1" unit="s" :reset-to="1" />
        <FxSlider v-model="seed" label="Seed" :min="0" :max="99999" :step="1" :decimals="0" :reset-to="7" />
      </div>
      <div class="ctv:flex ctv:items-center ctv:gap-2">
        <label class="ctv:flex ctv:items-center ctv:gap-1 ctv:text-2xs ctv:text-muted-foreground">
          A <input type="color" v-model="color0" class="ctv:h-5 ctv:w-8 ctv:cursor-pointer ctv:border-0 ctv:bg-transparent ctv:p-0" />
        </label>
        <label class="ctv:flex ctv:items-center ctv:gap-1 ctv:text-2xs ctv:text-muted-foreground">
          B <input type="color" v-model="color1" class="ctv:h-5 ctv:w-8 ctv:cursor-pointer ctv:border-0 ctv:bg-transparent ctv:p-0" />
        </label>
        <FxChips v-model="sprite" :options="SPRITE_OPTS" class="ctv:flex-1" />
      </div>
      <FxChips v-model="renderer" :options="RENDERER_OPTS" />
      <FxChips v-model="blend" :options="BLEND_OPTS" />
    </div>

    <div class="ctv:text-2xs ctv:text-center ctv:py-0.5 ctv:tracking-wide">
      <span v-if="!sourceVideoUrl" class="ctv:text-muted-foreground">{{ $t('videoTrim.noInputVideo') }}</span>
      <span v-else-if="hasMask" class="ctv:text-muted-foreground">{{ $t('fx.adjustThenRun') }}</span>
      <span v-else class="ctv:text-muted-foreground">{{ $t('fx.chainMode') }}</span>
    </div>

    <StageCard
      :state="state"
      :node="node"
      :hide-run-button="!hasMask"
      :on-run-request="onRunRequest"
      :on-cancel-request="onCancelRequest"
      :on-disconnect="onDisconnect"
      :on-action="onAction"
    />
  </FxCardShell>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import type { LGraphNode } from '@/lib/comfyApp'
import type { StageState } from '@/stores/stageStore'
import StageCard from '@/components/stages/StageCard.vue'
import FxCardShell from '@/components/stages/FxCardShell.vue'
import VideoPlayerLite from '@/components/widgets/VideoPlayerLite.vue'
import FxSlider from '@/components/widgets/fx/FxSlider.vue'
import FxChips from '@/components/widgets/fx/FxChips.vue'
import { pickSourceImageUrl } from '@/composables/stages/stageInputs'
import { useChainedFxPreview } from '@/composables/stages/useChainedFxPreview'
import { ParticlesPreviewRenderer } from '@/composables/stages/particlesPreviewRenderer'
import { useNumWidget, useStrWidget } from '@/composables/widgets/useWidgetModel'

const props = defineProps<{
  state: StageState
  onRunRequest: () => void
  onCancelRequest: () => void
  onDisconnect: (slot: string) => void
  onAction: (id: string) => void
  node: LGraphNode
}>()

const EMITTER_OPTS = [
  { value: 'point', label: 'Point' },
  { value: 'line', label: 'Line' },
  { value: 'rect', label: 'Rect' },
  { value: 'circle', label: 'Circle' },
]
const SPRITE_OPTS = [
  { value: 'glow', label: 'Glow' },
  { value: 'spark', label: 'Spark' },
  { value: 'star', label: 'Star' },
]
const RENDERER_OPTS = [
  { value: 'sprite', label: 'Sprite' },
  { value: 'stretched', label: 'Stretched' },
  { value: 'trail', label: 'Trail' },
]
const BLEND_OPTS = [
  { value: 'additive', label: 'Additive' },
  { value: 'over', label: 'Over' },
]
const COLLIDE_OPTS = [
  { value: 'none', label: 'None' },
  { value: 'bounce', label: 'Bounce' },
  { value: 'die', label: 'Die' },
]
const SUB_OPTS = [
  { value: 'none', label: 'None' },
  { value: 'on_death', label: 'On Death' },
  { value: 'on_collide', label: 'On Collide' },
]

const lbl = 'ctv:text-2xs ctv:uppercase ctv:tracking-wide ctv:opacity-60'
const sourceVideoUrl = computed(() => pickSourceImageUrl(props.state.inputs, 'video'))
const hasMask = computed(() =>
  !!pickSourceImageUrl(props.state.inputs, 'mask_video')
  || !!pickSourceImageUrl(props.state.inputs, 'mask_image'))
const emitter = useStrWidget(props.node, 'emitter', 'point')
const ex0 = useNumWidget(props.node, 'e_x0', 0.5)
const ey0 = useNumWidget(props.node, 'e_y0', 0.85)
const ex1 = useNumWidget(props.node, 'e_x1', 0.5)
const ey1 = useNumWidget(props.node, 'e_y1', 0.85)
const rate = useNumWidget(props.node, 'rate', 120)
const lifetime = useNumWidget(props.node, 'lifetime', 2)
const speed = useNumWidget(props.node, 'speed', 120)
const direction = useNumWidget(props.node, 'direction', -90)
const spread = useNumWidget(props.node, 'spread', 30)
const gravity = useNumWidget(props.node, 'gravity', 60)
const wind = useNumWidget(props.node, 'wind', 0)
const turbulence = useNumWidget(props.node, 'turbulence', 60)
const turbScale = useNumWidget(props.node, 'turb_scale', 120)
const drag = useNumWidget(props.node, 'drag', 0.1)
const attractStrength = useNumWidget(props.node, 'attract_strength', 0)
const attractX = useNumWidget(props.node, 'attract_x', 0.5)
const attractY = useNumWidget(props.node, 'attract_y', 0.5)
const attractRadius = useNumWidget(props.node, 'attract_radius', 0.5)
const swirl = useNumWidget(props.node, 'swirl', 0)
const collide = useStrWidget(props.node, 'collide', 'none')
const floorY = useNumWidget(props.node, 'floor_y', 0.9)
const bounce = useNumWidget(props.node, 'bounce', 0.5)
const subMode = useStrWidget(props.node, 'sub_mode', 'none')
const subCount = useNumWidget(props.node, 'sub_count', 8)
const subSpeed = useNumWidget(props.node, 'sub_speed', 120)
const subLifetime = useNumWidget(props.node, 'sub_lifetime', 0.6)
const subSizeRatio = useNumWidget(props.node, 'sub_size_ratio', 0.5)
const subColor = useStrWidget(props.node, 'sub_color', '#FFF2B0')
const size = useNumWidget(props.node, 'size', 12)
const sizeEndRatio = useNumWidget(props.node, 'size_end_ratio', 0.4)
const opacityStart = useNumWidget(props.node, 'opacity_start', 1)
const opacityEnd = useNumWidget(props.node, 'opacity_end', 0)
const stretch = useNumWidget(props.node, 'stretch', 1)
const trailLen = useNumWidget(props.node, 'trail_len', 4)
const warmup = useNumWidget(props.node, 'warmup', 1)
const seed = useNumWidget(props.node, 'seed', 7)
const color0 = useStrWidget(props.node, 'color0', '#FFD27A')
const color1 = useStrWidget(props.node, 'color1', '#FF5A2A')
const sprite = useStrWidget(props.node, 'sprite', 'glow')
const renderer = useStrWidget(props.node, 'renderer', 'sprite')
const blend = useStrWidget(props.node, 'blend', 'additive')

const playerRef = ref<InstanceType<typeof VideoPlayerLite> | null>(null)
const videoEl = computed<HTMLVideoElement | null>(() => playerRef.value?.videoEl ?? null)
const previewCanvas = ref<HTMLCanvasElement | null>(null)

const { supported } = useChainedFxPreview({
  videoEl,
  canvasEl: previewCanvas,
  nodeId: String(props.node.id),
  node: props.node,
  params: () => ({
    emitter: emitter.value, e_x0: ex0.value, e_y0: ey0.value,
    e_x1: ex1.value, e_y1: ey1.value, rate: rate.value,
    lifetime: lifetime.value, speed: speed.value,
    direction: direction.value, spread: spread.value,
    gravity: gravity.value, wind: wind.value,
    turbulence: turbulence.value, turb_scale: turbScale.value,
    drag: drag.value,
    attract_strength: attractStrength.value, attract_x: attractX.value,
    attract_y: attractY.value, attract_radius: attractRadius.value,
    swirl: swirl.value, collide: collide.value, floor_y: floorY.value,
    bounce: bounce.value, sub_mode: subMode.value,
    sub_count: subCount.value, sub_speed: subSpeed.value,
    sub_lifetime: subLifetime.value, sub_size_ratio: subSizeRatio.value,
    sub_color: subColor.value, size: size.value,
    size_end_ratio: sizeEndRatio.value,
    opacity_start: opacityStart.value, opacity_end: opacityEnd.value,
    color0: color0.value, color1: color1.value, sprite: sprite.value,
    renderer: renderer.value, stretch: stretch.value,
    trail_len: trailLen.value, blend: blend.value,
    warmup: warmup.value, seed: seed.value,
  }),
  createRenderer: () => new ParticlesPreviewRenderer(),
})
</script>
