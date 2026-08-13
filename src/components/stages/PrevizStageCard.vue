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
        <button type="button" :class="historyBtnClass" :disabled="!canUndo" :title="$t('previz.undo')" @click="undo">
          <IconUndo class="ctv:size-4" />
        </button>
        <button type="button" :class="historyBtnClass" :disabled="!canRedo" :title="$t('previz.redo')" @click="redo">
          <IconRedo class="ctv:size-4" />
        </button>

        <div class="ctv:h-5 ctv:w-px ctv:bg-border-subtle" />

        <button type="button" :class="actionBtnClass" :title="$t('previz.prevShot')" @click="setShot(shotIdx - 1)">
          <IconSkipBack class="ctv:size-3.5" />
        </button>
        <button type="button" :class="actionBtnClass" @click="togglePlay">
          <IconPause v-if="playing" class="ctv:size-3.5" />
          <IconPlay v-else class="ctv:size-3.5" />
          {{ playing ? $t('previz.pause') : $t('previz.play') }}
        </button>
        <button type="button" :class="actionBtnClass" :title="$t('previz.nextShot')" @click="setShot(shotIdx + 1)">
          <IconSkipForward class="ctv:size-3.5" />
        </button>
        <label class="ctv:flex ctv:items-center ctv:gap-1 ctv:text-2xs ctv:text-muted-foreground">
          <ComfyTVToggle v-model="playAll" />
          {{ $t('previz.playAll') }}
        </label>
        <select v-model.number="speed" :class="compactSelectClass" :aria-label="$t('previz.speed')">
          <option :value="0.5">0.5×</option>
          <option :value="1">1×</option>
          <option :value="2">2×</option>
        </select>
        <span class="ctv:text-2xs ctv:tabular-nums ctv:text-muted-foreground">
          {{ globalTime.toFixed(1) }}s / {{ duration.toFixed(1) }}s
        </span>

        <div class="ctv:h-5 ctv:w-px ctv:bg-border-subtle" />

        <button type="button" :class="actionBtnClass" :disabled="capturing || recording" @click="capture">
          <IconLoader v-if="capturing" class="ctv:size-3.5 ctv:animate-spin" />
          <IconCamera v-else class="ctv:size-3.5" />
          {{ $t('previz.capture') }}
        </button>
        <button
          type="button"
          :class="actionBtnClass"
          :disabled="capturing || recording || !recordingSupported"
          @click="record"
        >
          <IconLoader v-if="recording" class="ctv:size-3.5 ctv:animate-spin" />
          <IconVideo v-else class="ctv:size-3.5" />
          {{ recording ? recordingLabel : $t('previz.record') }}
        </button>

        <div class="ctv:flex-1" />

        <select
          :value="project.aspect"
          :class="compactSelectClass"
          :aria-label="$t('previz.aspect')"
          @change="setAspect(($event.target as HTMLSelectElement).value)"
        >
          <option v-for="a in aspectOptions" :key="a" :value="a">{{ a }}</option>
        </select>
        <button
          type="button"
          :class="historyBtnClass"
          :title="$t(fullscreen ? 'previz.exitFullscreen' : 'previz.fullscreen')"
          @click="toggleFullscreen"
        >
          <IconMinimize v-if="fullscreen" class="ctv:size-4" />
          <IconMaximize v-else class="ctv:size-4" />
        </button>
      </div>

      <div class="ctv:flex ctv:min-h-0 ctv:flex-1 ctv:gap-1">
        <div
          class="ctv-scroll-thin ctv:flex ctv:w-44 ctv:shrink-0 ctv:flex-col ctv:gap-1 ctv:overflow-y-auto ctv:rounded-lg ctv:bg-node-background ctv:p-1.5"
          @wheel.stop
        >
          <div :class="groupHeaderClass">
            <span class="ctv:flex-1">{{ $t('previz.actors') }}</span>
            <select value="" :class="addSelectClass" :aria-label="$t('previz.addActor')" @change="onAddActor">
              <option value="" disabled>+</option>
              <option v-for="kind in actorKinds" :key="kind" :value="kind">
                {{ $t(`previz.kind.${kind}`) }}
              </option>
            </select>
          </div>
          <div
            v-for="actor in actorRows"
            :key="actor.label"
            class="ctv:group ctv:flex ctv:cursor-pointer ctv:items-center ctv:gap-1 ctv:rounded ctv:px-1 ctv:py-0.5"
            :class="isActorSelected(actor.label)
              ? 'ctv:bg-primary/20 ctv:text-base-foreground'
              : 'ctv:text-muted-foreground ctv:hover:bg-secondary-background'"
            @click="selectActor(actor.label)"
          >
            <span class="ctv:flex-1 ctv:truncate">{{ actor.label }}</span>
            <span class="ctv:text-2xs ctv:opacity-60">{{ $t(`previz.kind.${actor.kind}`) }}</span>
            <button
              type="button"
              class="ctv:hidden ctv:cursor-pointer ctv:border-0 ctv:bg-transparent ctv:p-0 ctv:text-muted-foreground ctv:group-hover:block"
              :title="$t('previz.removeActor')"
              @click.stop="removeActor(actor.label)"
            >
              <IconX class="ctv:size-3" />
            </button>
          </div>

          <div :class="groupHeaderClass">
            <span class="ctv:flex-1">{{ $t('previz.shots') }}</span>
            <button
              type="button"
              class="ctv:cursor-pointer ctv:border-0 ctv:bg-transparent ctv:p-0 ctv:text-muted-foreground ctv:hover:text-base-foreground"
              :title="$t('previz.addShot')"
              @click="addShot"
            >
              <IconPlus class="ctv:size-3.5" />
            </button>
          </div>
          <div
            v-for="(shot, i) in shotRows"
            :key="i"
            class="ctv:group ctv:flex ctv:cursor-pointer ctv:items-center ctv:gap-1 ctv:rounded ctv:px-1 ctv:py-0.5"
            :class="i === shotIdx
              ? 'ctv:bg-primary/20 ctv:text-base-foreground'
              : 'ctv:text-muted-foreground ctv:hover:bg-secondary-background'"
            @click="setShot(i)"
          >
            <span class="ctv:flex-1 ctv:truncate">{{ shot.name }}</span>
            <span class="ctv:text-2xs ctv:opacity-60">{{ shot.dur.toFixed(1) }}s</span>
            <button
              v-if="shotRows.length > 1"
              type="button"
              class="ctv:hidden ctv:cursor-pointer ctv:border-0 ctv:bg-transparent ctv:p-0 ctv:text-muted-foreground ctv:group-hover:block"
              :title="$t('previz.removeShot')"
              @click.stop="removeShot(i)"
            >
              <IconX class="ctv:size-3" />
            </button>
          </div>
        </div>

        <div class="ctv:relative ctv:min-w-0 ctv:flex-1 ctv:overflow-hidden ctv:rounded-lg ctv:bg-black">
          <SceneCanvas :init-scene="initViewport" />
          <div
            class="ctv:absolute ctv:right-2 ctv:bottom-2 ctv:z-10 ctv:h-[108px] ctv:w-[192px] ctv:overflow-hidden ctv:rounded-lg ctv:border ctv:border-border-subtle ctv:bg-black/80"
          >
            <SceneCanvas :init-scene="attachMonitor" />
          </div>
        </div>

        <div
          class="ctv-scroll-thin ctv:flex ctv:w-60 ctv:shrink-0 ctv:flex-col ctv:gap-1.5 ctv:overflow-y-auto ctv:rounded-lg ctv:bg-node-background ctv:p-1.5"
          @wheel.stop
        >
          <template v-if="actorPanel">
            <span :class="inspectorHeaderClass">{{ actorPanel.label }}</span>
            <label v-if="actorPanel.kind === 'char'" :class="fieldRowClass">
              <span :class="fieldLabelClass">{{ $t('previz.pose') }}</span>
              <select
                :value="actorPanel.pose"
                :class="selectClass"
                @change="updateActor(actorPanel.label, { pose: ($event.target as HTMLSelectElement).value as never })"
              >
                <option v-for="p in poses" :key="p" :value="p">{{ $t(`previz.pose_.${p}`) }}</option>
              </select>
            </label>
            <label v-if="actorPanel.kind === 'char'" :class="fieldRowClass">
              <span :class="fieldLabelClass">{{ $t('previz.mount') }}</span>
              <select
                :value="actorPanel.mount ?? ''"
                :class="selectClass"
                @change="onSetMount(($event.target as HTMLSelectElement).value)"
              >
                <option value="">{{ $t('previz.none') }}</option>
                <option v-for="m in mountOptions" :key="m" :value="m">{{ m }}</option>
              </select>
            </label>
            <label :class="fieldRowClass">
              <span :class="fieldLabelClass">{{ $t('previz.rotation') }}</span>
              <input
                type="number"
                step="5"
                :value="Math.round((actorPanel.rotY * 180) / Math.PI)"
                :class="numberClass"
                @change="updateActor(actorPanel.label, { rotY: (Number(($event.target as HTMLInputElement).value) * Math.PI) / 180 })"
              />
            </label>
            <label :class="fieldRowClass">
              <span :class="fieldLabelClass">{{ $t('previz.scale') }}</span>
              <input
                type="number"
                step="0.1"
                min="0.3"
                max="3"
                :value="actorPanel.scale"
                :class="numberClass"
                @change="updateActor(actorPanel.label, { scale: Number(($event.target as HTMLInputElement).value) })"
              />
            </label>
            <label :class="fieldRowClass">
              <span :class="fieldLabelClass">{{ $t('previz.height') }}</span>
              <input
                type="number"
                step="0.1"
                min="0"
                max="20"
                :value="actorPanel.height"
                :class="numberClass"
                @change="updateActor(actorPanel.label, { height: Number(($event.target as HTMLInputElement).value) })"
              />
            </label>
            <label :class="fieldRowClass">
              <span :class="fieldLabelClass">{{ $t('previz.pathMode') }}</span>
              <select
                :value="actorStraight ? 'line' : 'curve'"
                :class="selectClass"
                @change="setActorStraight(actorPanel.label, ($event.target as HTMLSelectElement).value === 'line')"
              >
                <option value="curve">{{ $t('previz.pathCurve') }}</option>
                <option value="line">{{ $t('previz.pathLine') }}</option>
              </select>
            </label>
            <div class="ctv:flex ctv:gap-1">
              <button type="button" :class="smallBtnClass" @click="addPathPoint(actorPanel.label)">
                <IconPlus class="ctv:size-3" /> {{ $t('previz.pathPoint') }}
              </button>
              <button
                v-if="selectedPathIndex !== null"
                type="button"
                :class="smallBtnClass"
                @click="removePathPoint(actorPanel.label, selectedPathIndex)"
              >
                <IconX class="ctv:size-3" /> {{ $t('previz.pathPoint') }} {{ selectedPathIndex + 1 }}
              </button>
            </div>
          </template>

          <template v-if="shotPanel">
            <span :class="inspectorHeaderClass">{{ $t('previz.shot') }} {{ shotIdx + 1 }}</span>
            <label :class="fieldRowClass">
              <span :class="fieldLabelClass">{{ $t('previz.name') }}</span>
              <input
                type="text"
                :value="shotPanel.name"
                :class="numberClass"
                @change="updateShot(shotIdx, { name: ($event.target as HTMLInputElement).value })"
              />
            </label>
            <label :class="fieldRowClass">
              <span :class="fieldLabelClass">{{ $t('previz.duration') }}</span>
              <input
                type="number"
                step="0.5"
                min="0.5"
                :value="shotPanel.dur"
                :class="numberClass"
                @change="updateShot(shotIdx, { dur: Number(($event.target as HTMLInputElement).value) })"
              />
            </label>
            <label :class="fieldRowClass">
              <span :class="fieldLabelClass">{{ $t('previz.fov') }}</span>
              <input
                type="number"
                step="1"
                min="10"
                max="110"
                :value="shotPanel.fov"
                :class="numberClass"
                @change="updateShot(shotIdx, { fov: Number(($event.target as HTMLInputElement).value) })"
              />
            </label>
            <label :class="fieldRowClass">
              <span :class="fieldLabelClass">{{ $t('previz.lock') }}</span>
              <select
                :value="shotPanel.lock"
                :class="selectClass"
                @change="updateShot(shotIdx, { lock: ($event.target as HTMLSelectElement).value })"
              >
                <option value="">{{ $t('previz.lockGlobal') }}</option>
                <option :value="LOCK_MANUAL">{{ $t('previz.lockManual') }}</option>
                <option v-for="a in actorRows" :key="a.label" :value="a.label">{{ a.label }}</option>
              </select>
            </label>
            <label :class="fieldRowClass">
              <span :class="fieldLabelClass">{{ $t('previz.timingMode') }}</span>
              <select
                :value="shotPanel.timingMode"
                :class="selectClass"
                @change="updateShot(shotIdx, { timingMode: ($event.target as HTMLSelectElement).value as never })"
              >
                <option value="pointSync">{{ $t('previz.timingPointSync') }}</option>
                <option value="arcLength">{{ $t('previz.timingArcLength') }}</option>
                <option value="custom">{{ $t('previz.timingCustom') }}</option>
              </select>
            </label>
            <label v-if="shotPanel.timingMode === 'pointSync'" :class="fieldRowClass">
              <span :class="fieldLabelClass">{{ $t('previz.syncActor') }}</span>
              <select
                :value="shotPanel.syncActor"
                :class="selectClass"
                @change="updateShot(shotIdx, { syncActor: ($event.target as HTMLSelectElement).value })"
              >
                <option value="">{{ $t('previz.none') }}</option>
                <option v-for="a in actorRows" :key="a.label" :value="a.label">{{ a.label }}</option>
              </select>
            </label>
            <label :class="fieldRowClass">
              <span :class="fieldLabelClass">{{ $t('previz.pathMode') }}</span>
              <select
                :value="shotStraight ? 'line' : 'curve'"
                :class="selectClass"
                @change="setShotStraight(($event.target as HTMLSelectElement).value === 'line')"
              >
                <option value="curve">{{ $t('previz.pathCurve') }}</option>
                <option value="line">{{ $t('previz.pathLine') }}</option>
              </select>
            </label>
            <div class="ctv:flex ctv:gap-1">
              <button type="button" :class="smallBtnClass" @click="addCamPoint(shotIdx)">
                <IconPlus class="ctv:size-3" /> {{ $t('previz.camPoint') }}
              </button>
              <button
                v-if="selectedCamIndex !== null && shotPanel.camCount > 1"
                type="button"
                :class="smallBtnClass"
                @click="removeCamPoint(shotIdx, selectedCamIndex)"
              >
                <IconX class="ctv:size-3" /> {{ $t('previz.camPoint') }} {{ selectedCamIndex + 1 }}
              </button>
            </div>
            <template v-if="camPointPanel">
              <span :class="inspectorHeaderClass">
                {{ $t('previz.camPoint') }} {{ (selectedCamIndex ?? 0) + 1 }}
              </span>
              <label :class="fieldRowClass">
                <span :class="fieldLabelClass">Y</span>
                <input
                  type="number"
                  step="0.2"
                  min="0.2"
                  max="30"
                  :value="camPointPanel.y"
                  :class="numberClass"
                  @change="setCamPoint(shotIdx, selectedCamIndex!, { y: Number(($event.target as HTMLInputElement).value) })"
                />
              </label>
              <label :class="fieldRowClass">
                <span :class="fieldLabelClass">{{ $t('previz.keyFov') }}</span>
                <input
                  type="number"
                  step="1"
                  min="10"
                  max="110"
                  :value="camPointPanel.fov"
                  :class="numberClass"
                  @change="setCamKey(shotIdx, selectedCamIndex!, { fov: Number(($event.target as HTMLInputElement).value) })"
                />
              </label>
              <template v-if="shotPanel.lock === LOCK_MANUAL">
                <label :class="fieldRowClass">
                  <span :class="fieldLabelClass">{{ $t('previz.keyYaw') }}</span>
                  <input
                    type="number"
                    step="5"
                    :value="camPointPanel.yaw"
                    :class="numberClass"
                    @change="setCamKey(shotIdx, selectedCamIndex!, { yaw: Number(($event.target as HTMLInputElement).value) })"
                  />
                </label>
                <label :class="fieldRowClass">
                  <span :class="fieldLabelClass">{{ $t('previz.keyPitch') }}</span>
                  <input
                    type="number"
                    step="5"
                    min="-85"
                    max="85"
                    :value="camPointPanel.pitch"
                    :class="numberClass"
                    @change="setCamKey(shotIdx, selectedCamIndex!, { pitch: Number(($event.target as HTMLInputElement).value) })"
                  />
                </label>
              </template>
            </template>
          </template>

          <span :class="inspectorHeaderClass">{{ $t('previz.environment') }}</span>
          <label :class="fieldRowClass">
            <span :class="fieldLabelClass">{{ $t('previz.ground') }}</span>
            <select
              :value="groundStyle"
              :class="selectClass"
              @change="updateGround({ style: ($event.target as HTMLSelectElement).value as never })"
            >
              <option value="checker">{{ $t('previz.groundChecker') }}</option>
              <option value="white">{{ $t('previz.groundWhite') }}</option>
              <option value="black">{{ $t('previz.groundBlack') }}</option>
            </select>
          </label>
          <label :class="fieldRowClass">
            <span :class="fieldLabelClass">{{ $t('previz.sunIntensity') }}</span>
            <ComfyTVSlider
              :model-value="sunPanel.intensity"
              :min="0"
              :max="3"
              :step="0.05"
              @update:model-value="(v) => updateSun({ intensity: v })"
            />
          </label>
          <label :class="fieldRowClass">
            <span :class="fieldLabelClass">{{ $t('previz.sunTemp') }}</span>
            <ComfyTVSlider
              :model-value="sunPanel.temp"
              :min="2500"
              :max="9000"
              :step="100"
              :precision="0"
              @update:model-value="(v) => updateSun({ temp: v })"
            />
          </label>
          <label :class="fieldRowClass">
            <span :class="fieldLabelClass">{{ $t('previz.sunAmbient') }}</span>
            <ComfyTVSlider
              :model-value="sunPanel.ambient"
              :min="0"
              :max="1"
              :step="0.02"
              @update:model-value="(v) => updateSun({ ambient: v })"
            />
          </label>
          <label :class="fieldRowClass">
            <span :class="fieldLabelClass">{{ $t('previz.sunSoftness') }}</span>
            <ComfyTVSlider
              :model-value="sunPanel.softness"
              :min="0"
              :max="5"
              :step="0.1"
              @update:model-value="(v) => updateSun({ softness: v })"
            />
          </label>
          <label class="ctv:flex ctv:items-center ctv:gap-1.5 ctv:text-2xs ctv:text-muted-foreground">
            <ComfyTVToggle
              :model-value="project.settings.collision"
              @update:model-value="setCollision"
            />
            {{ $t('previz.collision') }}
          </label>
          <label class="ctv:flex ctv:items-center ctv:gap-1.5 ctv:text-2xs ctv:text-muted-foreground">
            <ComfyTVToggle
              :model-value="project.settings.labels"
              @update:model-value="setLabels"
            />
            {{ $t('previz.labels') }}
          </label>
        </div>
      </div>

      <div class="ctv:h-32 ctv:shrink-0">
        <PrevizTimeline
          :data="timelineData"
          :global-time="globalTime"
          :active-shot="shotIdx"
          @seek="seekGlobal"
          @select-shot="setShot"
          @set-cam-time="setCamTime"
          @set-path-time="setActorPathTime"
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
import { computed, onBeforeUnmount, onMounted } from 'vue'
import IconCamera from '~icons/lucide/camera'
import IconLoader from '~icons/lucide/loader-2'
import IconMaximize from '~icons/lucide/maximize-2'
import IconMinimize from '~icons/lucide/minimize-2'
import IconPause from '~icons/lucide/pause'
import IconPlay from '~icons/lucide/play'
import IconPlus from '~icons/lucide/plus'
import IconRedo from '~icons/lucide/redo-2'
import IconSkipBack from '~icons/lucide/skip-back'
import IconSkipForward from '~icons/lucide/skip-forward'
import IconUndo from '~icons/lucide/undo-2'
import IconVideo from '~icons/lucide/video'
import IconX from '~icons/lucide/x'

import type { LGraphNode } from '@/lib/comfyApp'
import { i18n } from '@/i18n'
import StageCard from '@/components/stages/StageCard.vue'
import SceneCanvas from '@/components/widgets/SceneCanvas.vue'
import ComfyTVSlider from '@/components/widgets/ComfyTVSlider.vue'
import ComfyTVToggle from '@/components/widgets/ComfyTVToggle.vue'
import PrevizTimeline from '@/components/previz/PrevizTimeline.vue'
import { usePrevizStage } from '@/composables/widgets/usePrevizStage'
import {
  useScene3dFullscreen,
  useScene3dOutputSlots
} from '@/composables/widgets/useScene3dPanels'
import type { StageState } from '@/stores/stageStore'
import type { PrevizActorKind } from '@/widgets/three/previz/types'
import { PREVIZ_ASPECTS, PREVIZ_LOCK_MANUAL } from '@/widgets/three/previz/types'
import {
  anchorCount,
  sampleAim,
  sampleFov,
  trackPath,
  trackTimes
} from '@/widgets/three/previz/dollyTrack'

const props = defineProps<{
  state: StageState
  onRunRequest: () => void
  onCancelRequest: () => void
  onDisconnect: (slot: string) => void
  onAction: (id: string) => void
  node: LGraphNode
}>()

const stageState = props.state
const t = i18n.global.t

const { syncOutputSlots } = useScene3dOutputSlots(props.node, stageState)

const previz = usePrevizStage(props.node, {
  onCaptured: (url) => syncOutputSlots(url, undefined),
  onRecorded: (url) => syncOutputSlots(undefined, url)
})

const {
  world,
  project,
  shotIdx,
  playing,
  playAll,
  speed,
  globalTime,
  duration,
  selected,
  uiVersion,
  canUndo,
  canRedo,
  capturing,
  recording,
  recordProgress,
  recordingSupported,
  timelineData,
  shotStraight,
  actorStraight,
  setActorStraight,
  setShotStraight,
  initViewport,
  attachMonitor,
  cleanup,
  undo,
  redo,
  togglePlay,
  setShot,
  seekGlobal,
  addActor,
  removeActor,
  selectActor,
  updateActor,
  addPathPoint,
  removePathPoint,
  setActorPathTime,
  addShot,
  removeShot,
  updateShot,
  addCamPoint,
  removeCamPoint,
  setCamPoint,
  setCamKey,
  setCamTime,
  updateSun,
  updateGround,
  setAspect,
  setCollision,
  setLabels,
  capture,
  record
} = previz

const LOCK_MANUAL = PREVIZ_LOCK_MANUAL
const aspectOptions = Object.keys(PREVIZ_ASPECTS)
const actorKinds: PrevizActorKind[] = [
  'char',
  'horse',
  'car',
  'dog',
  'prop',
  'tree',
  'rock',
  'bush',
  'house',
  'mount',
  'road',
  'wall',
  'pillar'
]
const poses = ['stand', 'sit', 'crouch', 'lie', 'ride', 'custom']

const actorRows = computed(() => {
  void uiVersion.value
  return world.actors.map((a) => ({ label: a.label, kind: a.data.kind }))
})

const shotRows = computed(() => {
  void uiVersion.value
  return world.shots.map((s) => ({ name: s.name, dur: s.dur }))
})

const actorPanel = computed(() => {
  void uiVersion.value
  const sel = selected.value
  const label = sel?.type === 'actor' || sel?.type === 'pathPoint' ? sel.label : null
  const a = label ? world.actorByLabel(label) : null
  if (!a) return null
  return {
    label: a.label,
    kind: a.data.kind,
    pose: a.data.pose,
    mount: a.data.mount,
    rotY: a.data.rotY,
    scale: a.data.scale,
    height: a.data.height
  }
})

const shotPanel = computed(() => {
  void uiVersion.value
  const s = world.shots[shotIdx.value]
  if (!s) return null
  return {
    name: s.name,
    dur: s.dur,
    fov: s.fov,
    lock: s.lock,
    timingMode: s.timingMode,
    syncActor: s.syncActor,
    camCount: anchorCount(s.action)
  }
})

const selectedPathIndex = computed(() =>
  selected.value?.type === 'pathPoint' ? selected.value.index : null
)
const selectedCamIndex = computed(() =>
  selected.value?.type === 'camPoint' ? selected.value.index : null
)

const camPointPanel = computed(() => {
  void uiVersion.value
  const i = selectedCamIndex.value
  const s = world.shots[shotIdx.value]
  const point = s ? trackPath(s.action)?.points[i ?? -1] : null
  if (i === null || !s || !point) return null
  const at = trackTimes(s.action, s.dur)[i] ?? 0
  const aim = sampleAim(s.action, at, { yawDeg: s.yaw, pitchDeg: s.pitch })
  return {
    y: Math.round(point.co[1] * 100) / 100,
    yaw: Math.round(aim.yawDeg),
    pitch: Math.round(aim.pitchDeg),
    fov: Math.round(sampleFov(s.action, at, s.fov))
  }
})

const mountOptions = computed(() => {
  void uiVersion.value
  const current = actorPanel.value?.label
  return world.actors
    .filter((a) => (a.data.kind === 'horse' || a.data.kind === 'car') && a.label !== current)
    .map((a) => a.label)
})

const groundStyle = computed(() => {
  void uiVersion.value
  return world.getGround().style
})

const sunPanel = computed(() => {
  void uiVersion.value
  return world.getSun()
})

const recordingLabel = computed(() => {
  const p = recordProgress.value
  if (!p || p.status !== 'rendering' || p.frame === undefined) return t('previz.recording')
  return `${Math.round(((p.frame + 1) / p.totalFrames) * 100)}%`
})

function isActorSelected(label: string): boolean {
  const sel = selected.value
  return (sel?.type === 'actor' || sel?.type === 'pathPoint') && sel.label === label
}

function onAddActor(e: Event): void {
  const el = e.target as HTMLSelectElement
  const kind = el.value as PrevizActorKind
  el.value = ''
  if (kind) addActor(kind)
}

function onSetMount(mount: string): void {
  const label = actorPanel.value?.label
  if (!label) return
  updateActor(label, { mount: mount || undefined, pose: mount ? 'ride' : 'stand' })
}

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
  'ctv:hover:bg-secondary-background-hover ctv:disabled:cursor-default ctv:disabled:opacity-40'

const historyBtnClass =
  'ctv:inline-flex ctv:size-7 ctv:items-center ctv:justify-center ctv:cursor-pointer ctv:[font-family:inherit] ' +
  'ctv:rounded-lg ctv:border-0 ctv:bg-secondary-background ctv:text-base-foreground ' +
  'ctv:transition-colors ctv:hover:bg-secondary-background-hover ctv:disabled:cursor-default ctv:disabled:opacity-40'

const smallBtnClass =
  'ctv:inline-flex ctv:h-6 ctv:items-center ctv:gap-1 ctv:cursor-pointer ctv:[font-family:inherit] ' +
  'ctv:rounded ctv:border-0 ctv:bg-secondary-background ctv:px-1.5 ' +
  'ctv:text-2xs ctv:text-base-foreground ctv:transition-colors ctv:hover:bg-secondary-background-hover'

const compactSelectClass =
  'ctv:h-6 ctv:cursor-pointer ctv:rounded-lg ctv:border-0 ctv:bg-secondary-background ' +
  'ctv:px-1.5 ctv:text-2xs ctv:text-base-foreground ctv:outline-none ctv:[font-family:inherit]'

const selectClass =
  'ctv:h-6 ctv:min-w-0 ctv:flex-1 ctv:cursor-pointer ctv:rounded-lg ctv:border-0 ' +
  'ctv:bg-secondary-background ctv:px-1.5 ctv:text-2xs ctv:text-base-foreground ' +
  'ctv:outline-none ctv:[font-family:inherit]'

const addSelectClass =
  'ctv:h-5 ctv:w-8 ctv:cursor-pointer ctv:rounded-lg ctv:border-0 ctv:bg-secondary-background ' +
  'ctv:text-center ctv:text-2xs ctv:text-base-foreground ctv:outline-none ctv:[font-family:inherit]'

const numberClass =
  'ctv:h-6 ctv:min-w-0 ctv:flex-1 ctv:rounded-lg ctv:border-0 ctv:bg-secondary-background ' +
  'ctv:px-1.5 ctv:text-2xs ctv:text-base-foreground ctv:outline-none ctv:[font-family:inherit]'

const groupHeaderClass =
  'ctv:flex ctv:items-center ctv:gap-1 ctv:pt-1 ctv:text-2xs ctv:font-semibold ctv:text-muted-foreground'

const inspectorHeaderClass = 'ctv:text-2xs ctv:font-semibold ctv:text-muted-foreground'

const fieldRowClass = 'ctv:flex ctv:items-center ctv:gap-1.5'
const fieldLabelClass = 'ctv:w-14 ctv:shrink-0 ctv:text-2xs ctv:text-muted-foreground'
</script>
