<template>
  <Teleport to="body" :disabled="!fullscreen">
    <div
      class="ctv:flex ctv:flex-col ctv:gap-1 ctv:text-xs ctv:text-base-foreground"
      :class="fullscreen
        ? 'ctv:fixed ctv:inset-0 ctv:z-[1400] ctv:bg-base-background ctv:p-2'
        : 'ctv:size-full'"
      @pointerdown.stop
      @mousedown.stop
      @contextmenu.stop.prevent
    >

      <div class="ctv:flex ctv:h-8 ctv:shrink-0 ctv:items-center ctv:gap-2">
        <div
          class="ctv:flex ctv:h-7 ctv:items-center ctv:gap-0.5 ctv:rounded-lg ctv:bg-secondary-background ctv:p-0.5"
          :class="allGizmoDisabled ? 'ctv:opacity-40' : ''"
          :title="gizmoDisabledHint"
        >
          <button
            v-for="option in gizmoOptions"
            :key="option.value"
            type="button"
            :class="gizmoBtnClass(gizmoMode === option.value)"
            :aria-pressed="gizmoMode === option.value"
            :title="$t(option.labelKey)"
            :disabled="gizmoModeDisabled(option.value)"
            @click="setGizmoMode(option.value)"
          >
            <component :is="option.icon" class="ctv:size-3.5" />
            {{ $t(option.labelKey) }}
          </button>
        </div>

        <div class="ctv:h-5 ctv:w-px ctv:bg-border-subtle" />

        <button
          type="button"
          :class="historyBtnClass"
          :disabled="!canUndo"
          :title="$t('scene3d.undo')"
          @click="undo"
        >
          <IconUndo class="ctv:size-4" />
        </button>
        <button
          type="button"
          :class="historyBtnClass"
          :disabled="!canRedo"
          :title="$t('scene3d.redo')"
          @click="redo"
        >
          <IconRedo class="ctv:size-4" />
        </button>

        <div class="ctv:h-5 ctv:w-px ctv:bg-border-subtle" />

        <button
          type="button"
          :class="actionBtnClass"
          :disabled="capturing || recording"
          @click="capture"
        >
          <IconLoader v-if="capturing" class="ctv:size-3.5 ctv:animate-spin" />
          <IconCamera v-else class="ctv:size-3.5" />
          {{ $t('scene3d.capture') }}
        </button>
        <button
          type="button"
          :class="actionBtnClass"
          :disabled="capturing || recording || !recordingSupported || !hasRecordableDuration"
          :title="recordTitle"
          @click="record"
        >
          <IconLoader v-if="recording" class="ctv:size-3.5 ctv:animate-spin" />
          <IconVideo v-else class="ctv:size-3.5" />
          {{ recording ? recordingLabel : $t('scene3d.record') }}
        </button>

        <div class="ctv:flex-1" />

        <button
          type="button"
          :class="iconToolBtnClass"
          :title="$t(fullscreen ? 'scene3d.exitFullscreen' : 'scene3d.fullscreen')"
          @click="toggleFullscreen"
        >
          <IconMinimize v-if="fullscreen" class="ctv:size-4" />
          <IconMaximize v-else class="ctv:size-4" />
        </button>
      </div>

      <div class="ctv:flex ctv:min-h-0 ctv:flex-1 ctv:gap-1">

        <div class="ctv-scroll-thin ctv:flex ctv:w-44 ctv:shrink-0 ctv:flex-col ctv:gap-1 ctv:overflow-y-auto ctv:rounded-lg ctv:bg-node-background ctv:p-1.5" @wheel.stop>

          <div :class="groupHeaderClass">
            <span class="ctv:flex-1">{{ $t('scene3d.addCharacter') }}</span>
            <select
              v-if="availableModels.length > 0"
              value=""
              :class="addSelectClass"
              :aria-label="$t('scene3d.addCharacter')"
              @change="onAddCharacter"
            >
              <option value="" disabled>+</option>
              <option v-for="model in availableModels" :key="model.id" :value="model.id">
                {{ model.name }}
              </option>
            </select>
          </div>
          <Scene3DOutlinerRow
            v-for="(character, index) in state.characters"
            :key="character.id"
            :label="characterDisplayLabel(character)"
            :name="character.name ?? ''"
            :color="characterColor(index)"
            :selected="character.id === selectedId"
            :hidden="!!character.hidden"
            @select="selectObject(character.id)"
            @rename="(name) => renameObject(character.id, name)"
            @toggle-hide="toggleObjectHidden(character.id)"
            @remove="removeSelected"
          >
            <template #icon><IconPersonStanding class="ctv:size-3 ctv:shrink-0" />
</template>
          </Scene3DOutlinerRow>

          
          <div :class="groupHeaderClass">
            <span class="ctv:flex-1">{{ $t('scene3d.addObject') }}</span>
            <select
              value=""
              :class="addSelectClass"
              :aria-label="$t('scene3d.addObject')"
              @change="onAddPrimitive"
            >
              <option value="" disabled>+</option>
              <option v-for="shape in PRIMITIVE_SHAPES" :key="shape" :value="shape">
                {{ $t(`scene3d.${shape}`) }}
              </option>
            </select>
          </div>
          <Scene3DOutlinerRow
            v-for="primitive in state.primitives"
            :key="primitive.id"
            :label="primitiveDisplayLabel(primitive)"
            :name="primitive.name ?? ''"
            :color="primitive.color"
            :selected="primitive.id === selectedId"
            :hidden="!!primitive.hidden"
            @select="selectObject(primitive.id)"
            @rename="(name) => renameObject(primitive.id, name)"
            @toggle-hide="toggleObjectHidden(primitive.id)"
            @remove="removeSelected"
          />

          
          <template v-if="modelAssets.length >
 0 || state.models.length > 0">
            <div :class="groupHeaderClass">
              <span class="ctv:flex-1">{{ $t('scene3d.addModel') }}</span>
              <select
                v-if="modelAssets.length > 0"
                value=""
                :class="addSelectClass"
                :aria-label="$t('scene3d.addModel')"
                @change="onAddModel"
              >
                <option value="" disabled>+</option>
                <option v-for="asset in modelAssets" :key="asset.id" :value="String(asset.id)">
                  {{ asset.name || `#${asset.id}` }}
                </option>
              </select>
            </div>
            <Scene3DOutlinerRow
              v-for="(model, index) in state.models"
              :key="model.id"
              :label="model.name || model.id"
              :name="model.name"
              :color="modelColor(index)"
              :selected="model.id === selectedId"
              :hidden="!!model.hidden"
              @select="selectObject(model.id)"
              @rename="(name) => renameObject(model.id, name)"
              @toggle-hide="toggleObjectHidden(model.id)"
              @remove="removeSelected"
            >
              <template #icon><IconBox class="ctv:size-3 ctv:shrink-0" />
</template>
            </Scene3DOutlinerRow>
          </template>

          
          <div :class="groupHeaderClass">
            <span class="ctv:flex-1">{{ $t('scene3d.addLight') }}</span>
            <select
              value=""
              :class="addSelectClass"
              :aria-label="$t('scene3d.lightPresets')"
              :title="$t('scene3d.lightPresets')"
              @change="onApplyLightPreset"
            >
              <option value="" disabled>☀</option>
              <option v-for="preset in LIGHT_PRESET_NAMES" :key="preset" :value="preset">
                {{ $t(`scene3d.preset_${preset}`) }}
              </option>
            </select>
            <select
              value=""
              :class="addSelectClass"
              :aria-label="$t('scene3d.addLight')"
              @change="onAddLight"
            >
              <option value="" disabled>+</option>
              <option v-for="type in LIGHT_TYPES" :key="type" :value="type">
                {{ $t(`scene3d.${type}`) }}
              </option>
            </select>
          </div>
          <Scene3DOutlinerRow
            v-for="light in state.lights"
            :key="light.id"
            :label="lightDisplayLabel(light)"
            :name="light.name ?? ''"
            :selected="light.id === selectedId"
            :hidden="!!light.hidden"
            @select="selectObject(light.id)"
            @rename="(name) => renameObject(light.id, name)"
            @toggle-hide="toggleObjectHidden(light.id)"
            @remove="removeSelected"
          >
            <template #icon>
              <IconLightbulb class="ctv:size-3 ctv:shrink-0" :style="{ color: light.color }" />
</template>
          </Scene3DOutlinerRow>

          
          <div :class="groupHeaderClass">
            <span class="ctv:flex-1">{{ $t('scene3d.addCamera') }}</span>
            <button
              type="button"
              :class="addSelectClass"
              :aria-label="$t('scene3d.addCamera')"
              @click="addCamera"
            >+</button>
          </div>
          <Scene3DOutlinerRow
            v-for="(cameraEntry, index) in state.cameras"
            :key="cameraEntry.id"
            :label="cameraDisplayLabel(cameraEntry)"
            :name="cameraEntry.name ?? ''"
            :color="cameraEntry.preset ? cameraColor(index) : undefined"
            :selected="cameraEntry.id === selectedId"
            :hidden="!!cameraEntry.hidden"
            @select="selectObject(cameraEntry.id)"
            @rename="(name) => renameObject(cameraEntry.id, name)"
            @toggle-hide="toggleObjectHidden(cameraEntry.id)"
            @remove="removeSelected"
          >
            <template #icon>
<IconVideo class="ctv:size-3 ctv:shrink-0" />
</template>
            <template v-if="cameraEntry.id === outputCameraId" #badge>
              <span class="ctv:shrink-0 ctv:text-3xs ctv:opacity-70" :title="$t('scene3d.outputCamera')">REC</span>
</template>
          </Scene3DOutlinerRow>
        </div>

        
        <div
          class="ctv:relative ctv:min-w-0 ctv:flex-1 ctv:overflow-hidden ctv:rounded-lg ctv:bg-black"
          @mouseenter="handleMouseEnter"
          @mouseleave="handleMouseLeave"
        >
          <SceneCanvas :init-scene="initScene" />
          <button
            v-if="lookThroughId"
            type="button"
            class="ctv:absolute ctv:top-2 ctv:right-2 ctv:z-10 ctv:inline-flex ctv:cursor-pointer ctv:items-center ctv:gap-1
                   ctv:rounded-lg ctv:border-0 ctv:bg-black/60 ctv:px-2 ctv:py-1 ctv:text-2xs ctv:text-white
                   ctv:transition-colors ctv:hover:bg-black/80 ctv:[font-family:inherit]"
            @click="toggleLookThrough(lookThroughId)"
          >
            <IconEyeOff class="ctv:size-3" />
            {{ $t('scene3d.exitLookThrough') }}
          </button>
          
          <div
            v-if="pipCameraId && !lookThroughId"
            class="ctv:absolute ctv:right-2 ctv:bottom-2 ctv:z-10 ctv:flex ctv:items-center ctv:gap-1"
          >
            
            <button
              type="button"
              class="ctv:inline-flex ctv:cursor-pointer ctv:items-center ctv:justify-center
                     ctv:rounded-lg ctv:border-0 ctv:bg-black/60 ctv:p-1 ctv:text-white
                     ctv:transition-colors ctv:hover:bg-black/80 ctv:[font-family:inherit]"
              :title="$t('scene3d.switchToPipView')"
              @click="toggleLookThrough(pipCameraId)"
            >
              <IconEye class="ctv:size-3" />
            </button>
            <button
              type="button"
              class="ctv:inline-flex ctv:cursor-pointer ctv:items-center ctv:gap-1
                     ctv:rounded-lg ctv:border-0 ctv:bg-black/60 ctv:px-1.5 ctv:py-0.5 ctv:text-2xs ctv:text-white
                     ctv:transition-colors ctv:hover:bg-black/80 ctv:[font-family:inherit]"
              :title="$t('scene3d.closePipPreview')"
              @click="setPipCamera(null)"
            >
              {{ pipCameraId }}
              <IconX class="ctv:size-3" />
            </button>
          </div>
        </div>

        
        <div class="ctv-scroll-thin ctv:flex ctv:w-64 ctv:shrink-0 ctv:flex-col ctv:gap-1.5 ctv:overflow-y-auto ctv:rounded-lg ctv:bg-node-background ctv:p-1.5" @wheel.stop>
          <span :class="inspectorHeaderClass">{{ objectsSummary }}</span>
          <Scene3DCharacterPanel
            v-if="selectedCharacter"
            :character="selectedCharacter"
            :clip-names="clipNamesForSelected"
            @update-animation="updateSelectedAnimation"
            @update-transform="updateSelectedTransform"
          />
          <Scene3DPrimitivePanel
            v-else-if="selectedPrimitive"
            :primitive="selectedPrimitive"
            @update-color="(color) => updateSelectedPrimitive({ color })"
            @update-transform="updateSelectedTransform"
          />
          <Scene3DLightPanel
            v-else-if="selectedLight"
            :light="selectedLight"
            @update-light="updateSelectedLight"
          />
          <Scene3DCharacterPanel
            v-else-if="selectedModel"
            :character="selectedModel"
            :clip-names="clipNamesForSelected"
            fittable
            @update-animation="updateSelectedAnimation"
            @update-transform="updateSelectedTransform"
            @fit="fitSelectedModel"
          />
          <Scene3DCameraPanel
            v-else-if="selectedCamera"
            :camera="selectedCamera"
            :presets="cameraPresets"
            :looking-through="lookThroughId === selectedCamera.id"
            @bind-preset="(id) => bindCameraPreset(selectedCamera!.id, id)"
            @update-tuning="(tuning) => updateCameraTuning(selectedCamera!.id, tuning)"
            @set-fov="(fov) => setCameraFov(selectedCamera!.id, fov)"
            @update-transform="updateSelectedTransform"
            @toggle-view="toggleLookThrough(selectedCamera!.id)"
          />
          <div v-else class="ctv:px-1 ctv:text-2xs ctv:text-muted-foreground">
            {{ $t('scene3d.noSelection') }}
          </div>

          <div class="ctv:my-0.5 ctv:border-b ctv:border-border-subtle" />

          
          <span :class="inspectorHeaderClass">{{ $t('scene3d.environment') }}</span>
          <div class="ctv:flex ctv:flex-wrap ctv:items-center ctv:gap-x-3 ctv:gap-y-1.5 ctv:px-1">
            <label class="ctv:flex ctv:cursor-pointer ctv:items-center ctv:gap-1.5">
              <span class="ctv:text-2xs ctv:text-muted-foreground">{{ $t('scene3d.showGrid') }}</span>
              <ComfyTVToggle
                :model-value="state.environment.showGrid"
                @update:model-value="(v) => updateEnvironment({ showGrid: v })"
              />
            </label>
            <label class="ctv:flex ctv:cursor-pointer ctv:items-center ctv:gap-1.5">
              <span class="ctv:text-2xs ctv:text-muted-foreground">{{ $t('scene3d.showRoom') }}</span>
              <ComfyTVToggle
                :model-value="state.environment.showRoom"
                @update:model-value="(v) => updateEnvironment({ showRoom: v })"
              />
            </label>
            <label class="ctv:flex ctv:cursor-pointer ctv:items-center ctv:gap-1.5">
              <span class="ctv:text-2xs ctv:text-muted-foreground">{{ $t('scene3d.background') }}</span>
              <ComfyTVToggle
                :model-value="state.environment.background !== ''"
                @update:model-value="(v) => updateEnvironment({ background: v ? '#222222' : '' })"
              />
              <input
                v-if="state.environment.background"
                type="color"
                :value="state.environment.background"
                class="ctv:h-6 ctv:w-8 ctv:cursor-pointer ctv:rounded-md ctv:border-0 ctv:bg-transparent ctv:p-0"
                @input="onBackgroundInput"
              />
            </label>
          </div>

          <div class="ctv:my-0.5 ctv:border-b ctv:border-border-subtle" />

          
          <span :class="inspectorHeaderClass">{{ $t('scene3d.sectionOutput') }}</span>
          <Scene3DOutputPanel
            :width="outputWidth"
            :height="outputHeight"
            :channel="channel"
            :fps="state.output.fps"
            :frame-count="state.output.frameCount"
            :cameras="outputCameraOptions"
            :camera-id="outputCameraId || FREE_CAMERA_VALUE"
            @set-size="setOutputSize"
            @set-channel="setChannel"
            @set-fps="setOutputFps"
            @set-frame-count="setOutputFrameCount"
            @set-camera="onSetOutputCamera"
          />
        </div>
      </div>

      
      <div
        v-if="timelineData && (timelineData.cameras.length > 0 || timelineData.characters.length > 0)"
        class="ctv:shrink-0 ctv:rounded-lg ctv:bg-node-background ctv:p-1.5"
      >
        <Scene3DTimelineTracks
          v-model:loop="timelineLoop"
          :data="timelineData"
          :legend="timelineLegend"
          :frame="timelineFrame"
          :playing="timelinePlaying"
          :selected-id="selectedId"
          @seek="handleTimelineSeek"
          @toggle-play="handleTimelineTogglePlay"
          @camera-speed="setCameraSpeedById"
          @character-patch="updateCharacterAnimationById"
          @track-select="selectObject"
        />
      </div>

      
      <StageCard
        class="ctv:h-auto! ctv:grow-0 ctv:shrink-0"
        :state="stageState"
        :node="node"
        :on-run-request="onRunRequest"
        :on-cancel-request="onCancelRequest"
        :on-disconnect="onDisconnect"
        :on-action="onAction"
        hide-context
        hide-output
        hide-actions
      />
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted } from 'vue'
import IconBan from '~icons/lucide/ban'
import IconBox from '~icons/lucide/box'
import IconCamera from '~icons/lucide/camera'
import IconEye from '~icons/lucide/eye'
import IconEyeOff from '~icons/lucide/eye-off'
import IconLoader from '~icons/lucide/loader-2'
import IconMaximize from '~icons/lucide/maximize-2'
import IconMinimize from '~icons/lucide/minimize-2'
import IconVideo from '~icons/lucide/video'
import IconLightbulb from '~icons/lucide/lightbulb'
import IconMove3d from '~icons/lucide/move-3d'
import IconPersonStanding from '~icons/lucide/person-standing'
import IconRedo from '~icons/lucide/redo-2'
import IconRotate3d from '~icons/lucide/rotate-3d'
import IconScale3d from '~icons/lucide/scale-3d'
import IconUndo from '~icons/lucide/undo-2'
import IconX from '~icons/lucide/x'

import type { LGraphNode } from '@/lib/comfyApp'
import StageCard from '@/components/stages/StageCard.vue'
import SceneCanvas from '@/components/widgets/SceneCanvas.vue'
import Scene3DCameraPanel from '@/components/widgets/scene3d/Scene3DCameraPanel.vue'
import Scene3DCharacterPanel from '@/components/widgets/scene3d/Scene3DCharacterPanel.vue'
import Scene3DLightPanel from '@/components/widgets/scene3d/Scene3DLightPanel.vue'
import Scene3DOutlinerRow from '@/components/widgets/scene3d/Scene3DOutlinerRow.vue'
import Scene3DOutputPanel from '@/components/widgets/scene3d/Scene3DOutputPanel.vue'
import Scene3DPrimitivePanel from '@/components/widgets/scene3d/Scene3DPrimitivePanel.vue'
import Scene3DTimelineTracks from '@/components/widgets/scene3d/Scene3DTimelineTracks.vue'
import ComfyTVToggle from '@/components/widgets/ComfyTVToggle.vue'
import { useScene3dStage } from '@/composables/widgets/useScene3dStage'
import {
  FREE_CAMERA_VALUE,
  useScene3dFullscreen,
  useScene3dOutputSlots,
  useScene3dPanels
} from '@/composables/widgets/useScene3dPanels'
import type { StageState } from '@/stores/stageStore'
import type { Scene3dGizmoMode } from '@/widgets/three/scene3d/Scene3dViewport'
import { LIGHT_PRESET_NAMES } from '@/widgets/three/scene3d/lightPresets'
import { LIGHT_TYPES, PRIMITIVE_SHAPES } from '@/widgets/three/scene3d/types'

const props = defineProps<{
  state: StageState
  onRunRequest: () => void
  onCancelRequest: () => void
  onDisconnect: (slot: string) => void
  onAction: (id: string) => void
  node: LGraphNode
}>()

const stageState = props.state

const { syncOutputSlots } = useScene3dOutputSlots(props.node, stageState)

const scene3d = useScene3dStage(props.node, {
  onCaptured: (url) => syncOutputSlots(url, undefined),
  onRecorded: (url) => syncOutputSlots(undefined, url)
})

const {
  initScene,
  cleanup,
  handleMouseEnter,
  handleMouseLeave,
  state,
  selectedId,
  selectedCharacter,
  selectedPrimitive,
  selectedLight,
  selectedModel,
  selectedCamera,
  availableModels,
  modelAssets,
  clipNamesForSelected,
  gizmoMode,
  undo,
  redo,
  canUndo,
  canRedo,
  selectObject,
  fitSelectedModel,
  removeSelected,
  renameObject,
  toggleObjectHidden,
  updateSelectedAnimation,
  updateSelectedTransform,
  updateSelectedPrimitive,
  updateSelectedLight,
  updateEnvironment,
  setGizmoMode,
  cameraPresets,
  addCamera,
  bindCameraPreset,
  updateCameraTuning,
  setCameraFov,
  setCameraSpeedById,
  outputCameraId,
  lookThroughId,
  toggleLookThrough,
  pipCameraId,
  setPipCamera,
  timelinePlaying,
  timelineFrame,
  timelineLoop,
  handleTimelineTogglePlay,
  handleTimelineSeek,
  updateCharacterAnimationById,
  outputWidth,
  outputHeight,
  channel,
  capturing,
  recording,
  recordingSupported,
  hasRecordableDuration,
  setOutputSize,
  setChannel,
  setOutputFps,
  setOutputFrameCount,
  capture,
  record
} = scene3d

const {
  characterDisplayLabel,
  primitiveDisplayLabel,
  lightDisplayLabel,
  cameraDisplayLabel,
  characterColor,
  modelColor,
  cameraColor,
  timelineData,
  timelineLegend,
  gizmoModeDisabled,
  allGizmoDisabled,
  gizmoDisabledHint,
  outputCameraOptions,
  onSetOutputCamera,
  objectsSummary,
  recordingLabel,
  recordTitle,
  onAddCharacter,
  onAddModel,
  onAddPrimitive,
  onAddLight,
  onApplyLightPreset,
  onBackgroundInput
} = useScene3dPanels(scene3d)

const gizmoOptions = [
  { value: 'none' as Scene3dGizmoMode, labelKey: 'scene3d.gizmoNone', icon: IconBan },
  { value: 'translate' as Scene3dGizmoMode, labelKey: 'scene3d.gizmoTranslate', icon: IconMove3d },
  { value: 'rotate' as Scene3dGizmoMode, labelKey: 'scene3d.gizmoRotate', icon: IconRotate3d },
  { value: 'scale' as Scene3dGizmoMode, labelKey: 'scene3d.gizmoScale', icon: IconScale3d }
]

const { fullscreen, toggleFullscreen, onFullscreenKeydown } = useScene3dFullscreen()

onMounted(() => {
  syncOutputSlots()
  window.addEventListener('keydown', onFullscreenKeydown, true)
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onFullscreenKeydown, true)
  cleanup()
})

const actionBtnClass =
  'ctv:inline-flex ctv:h-7 ctv:items-center ctv:justify-center ctv:gap-1.5 ctv:cursor-pointer ctv:[font-family:inherit] ' +
  'ctv:rounded-lg ctv:border-0 ctv:bg-secondary-background ctv:px-2.5 ' +
  'ctv:text-xs ctv:text-base-foreground ctv:transition-colors ' +
  'ctv:hover:bg-secondary-background-hover ' +
  'ctv:disabled:cursor-not-allowed ctv:disabled:opacity-40 ctv:disabled:hover:bg-secondary-background'

const iconToolBtnClass =
  'ctv:inline-flex ctv:size-7 ctv:shrink-0 ctv:cursor-pointer ctv:items-center ctv:justify-center ' +
  'ctv:rounded-lg ctv:border-0 ctv:bg-secondary-background ctv:text-muted-foreground ctv:transition-colors ' +
  'ctv:hover:bg-secondary-background-hover ctv:hover:text-base-foreground'

const historyBtnClass =
  iconToolBtnClass +
  ' ctv:disabled:cursor-not-allowed ctv:disabled:opacity-40 ' +
  'ctv:disabled:hover:bg-secondary-background ctv:disabled:hover:text-muted-foreground'

const groupHeaderClass =
  'ctv:flex ctv:items-center ctv:gap-1 ctv:pt-1 ctv:text-3xs ctv:uppercase ctv:tracking-wide ctv:text-muted-foreground'

const inspectorHeaderClass =
  'ctv:px-1 ctv:text-3xs ctv:uppercase ctv:tracking-wide ctv:text-muted-foreground'

function gizmoBtnClass(active: boolean) {
  return (
    'ctv:flex ctv:cursor-pointer ctv:items-center ctv:justify-center ctv:gap-1 ctv:self-stretch ctv:px-2 ' +
    'ctv:rounded-md ctv:border-0 ctv:text-2xs ctv:transition-colors ctv:outline-none ctv:[font-family:inherit] ' +
    (active
      ? 'ctv:bg-secondary-background-selected ctv:text-base-foreground'
      : 'ctv:bg-transparent ctv:text-muted-foreground ctv:hover:text-base-foreground')
  )
}

const addSelectClass =
  'ctv:h-5 ctv:max-w-16 ctv:shrink-0 ctv:cursor-pointer ctv:rounded-md ctv:border-0 ctv:bg-secondary-background ' +
  'ctv:px-1 ctv:text-2xs ctv:text-muted-foreground ctv:outline-none ctv:[font-family:inherit] ' +
  'ctv:hover:bg-secondary-background-hover ctv:hover:text-base-foreground'
</script>
