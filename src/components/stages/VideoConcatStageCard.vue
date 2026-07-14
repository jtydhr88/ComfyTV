<template>
  <div class="ctv:flex ctv:flex-col ctv:gap-1.5 ctv:size-full">
    <div
      class="ctv:flex ctv:flex-col ctv:gap-1"
      @pointerdown.stop
      @pointermove.stop
      @pointerup.stop
    >
      <div
        v-if="clips.length === 0"
        class="ctv:flex ctv:flex-col ctv:items-center ctv:justify-center ctv:gap-1.5 ctv:h-24
               ctv:rounded-md ctv:bg-black/40 ctv:border ctv:border-dashed ctv:border-border-subtle ctv:text-white/50"
      >
        <i class="pi pi-video ctv:text-[24px] ctv:opacity-60" />
        <div class="ctv:text-xs">{{ $t('videoConcat.noInputs') }}</div>
      </div>

      <div
        v-else
        ref="stripEl"
        class="ctv:flex ctv:gap-1.5 ctv:p-1.5 ctv:rounded-md ctv:overflow-x-auto ctv:bg-black/40
               ctv:border ctv:border-border-subtle ctv:select-none"
      >
        <div
          v-for="(clip, idx) in orderedClips"
          :key="clip.key"
          class="ctv:relative ctv:shrink-0 ctv:w-32 ctv:rounded-md ctv:overflow-hidden ctv:bg-black
                 ctv:border-2 ctv:touch-none"
          :class="dragKey === clip.key
            ? 'ctv:border-dashed ctv:opacity-40 ctv:cursor-grabbing'
            : 'ctv:cursor-grab'"
          :style="{ borderColor: clip.color }"
          @pointerdown="(e) => onTileDown(e, idx)"
          @pointermove="onTileMove"
          @pointerup="onTileUp"
          @pointercancel="onTileUp"
        >
          <video
            :src="clip.url"
            class="ctv:block ctv:w-full ctv:h-18 ctv:object-cover ctv:pointer-events-none"
            muted playsinline preload="metadata"
          />
          <span class="ctv:absolute ctv:top-0.5 ctv:left-0.5 ctv:py-px ctv:px-1.5 ctv:text-3xs ctv:font-bold
                       ctv:rounded ctv:text-black ctv:pointer-events-none"
                :style="{ background: clip.color }">
            {{ idx + 1 }}
          </span>
          <span class="ctv:absolute ctv:bottom-0.5 ctv:right-0.5 ctv:py-px ctv:px-1 ctv:text-3xs ctv:font-bold
                       ctv:rounded ctv:bg-black/70 ctv:pointer-events-none"
                :style="{ color: clip.color }">
            {{ clip.key.replace('video', '#') }}
          </span>
        </div>
      </div>

      <div v-if="clips.length > 1" class="ctv:text-3xs ctv:text-center ctv:text-muted-foreground ctv:tracking-wide">
        {{ $t('videoConcat.dragToReorder') }}
      </div>
    </div>

    <div class="ctv:text-2xs ctv:text-center ctv:py-0.5 ctv:tracking-wide">
      <span v-if="clips.length < 2" class="ctv:text-muted-foreground">{{ $t('videoConcat.needTwo') }}</span>
      <span v-else-if="state.running" class="ctv:text-muted-foreground">{{ $t('videoConcat.concatenating') }}</span>
      <span v-else-if="state.output" class="ctv:text-success-background">{{ $t('videoConcat.done') }}</span>
      <span v-else class="ctv:text-muted-foreground">{{ $t('videoConcat.readyToRun', { n: clips.length }) }}</span>
    </div>

    <StageCard
      :state="state"
      :node="node"
      :on-run-request="onRunRequest"
      :on-cancel-request="onCancelRequest"
      :on-disconnect="onDisconnect"
      :on-action="onAction"
    />

    <Teleport to="body">
      <div
        v-if="dragClip"
        class="ctv:fixed ctv:z-[9999] ctv:rounded-md ctv:overflow-hidden ctv:bg-black ctv:border-2
               ctv:pointer-events-none ctv:shadow-[0_8px_24px_rgb(0_0_0/0.6)] ctv:rotate-2"
        :style="{
          left: `${cloneX}px`,
          top: `${cloneY}px`,
          width: `${cloneW}px`,
          height: `${cloneH}px`,
          borderColor: dragClip.color,
        }"
      >
        <video
          :src="dragClip.url"
          class="ctv:block ctv:size-full ctv:object-cover"
          muted playsinline preload="metadata"
        />
        <span class="ctv:absolute ctv:top-0.5 ctv:left-0.5 ctv:py-px ctv:px-1.5 ctv:text-3xs ctv:font-bold
                     ctv:rounded ctv:text-black"
              :style="{ background: dragClip.color }">
          {{ dragTargetIdx + 1 }}
        </span>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { LGraphNode } from '@/lib/comfyApp'
import type { StageState } from '@/stores/stageStore'
import StageCard from '@/components/stages/StageCard.vue'
import { slotColor } from '@/composables/stages/imageSlotMentions'
import { parseOrder, reconcileOrder } from '@/composables/stages/videoConcatOrder'
import { bindWidgetCallback, onNodeConfigure, readWidgetStr, writeWidget } from '@/utils/widget'

const props = defineProps<{
  state: StageState
  onRunRequest: () => void
  onCancelRequest: () => void
  onDisconnect: (slot: string) => void
  onAction: (id: string) => void
  node: LGraphNode
}>()

const SLOT_RE = /^videos\.video(\d+)$/

interface Clip {
  key: string
  url: string
  color: string
}

const clips = computed<Clip[]>(() =>
  props.state.inputs
    .filter(i => SLOT_RE.test(i.slot) && i.source === 'upstream' && i.content)
    .map(i => {
      const key = i.slot.split('.').pop()!
      const slot = Number(SLOT_RE.exec(i.slot)![1])
      return { key, url: i.content!, color: slotColor(slot) }
    }))

const order = ref<string[]>(parseOrder(readWidgetStr(props.node, 'clip_order', '')))

function reconcile(saved: string[], current: Clip[]): string[] {
  return reconcileOrder(saved, current.map(c => c.key))
}

watch(clips, (v) => {
  const next = reconcile(order.value, v)
  if (next.join() !== order.value.join()) order.value = next
}, { immediate: true })

watch(order, (v) => {
  writeWidget(props.node, 'clip_order', JSON.stringify(v))
})

bindWidgetCallback(props.node, 'clip_order', (value) => {
  const parsed = reconcile(parseOrder(String(value ?? '')), clips.value)
  if (parsed.join() !== order.value.join()) order.value = parsed
})

onNodeConfigure(props.node, () => {
  const restored = reconcile(parseOrder(readWidgetStr(props.node, 'clip_order', '')), clips.value)
  if (restored.join() !== order.value.join()) order.value = restored
})

const orderedClips = computed<Clip[]>(() => {
  const byKey = new Map(clips.value.map(c => [c.key, c]))
  return order.value.map(k => byKey.get(k)).filter((c): c is Clip => !!c)
})

const stripEl = ref<HTMLDivElement | null>(null)
const dragKey = ref<string | null>(null)
const dragClip = computed(() => orderedClips.value.find(c => c.key === dragKey.value) ?? null)
const dragTargetIdx = computed(() => orderedClips.value.findIndex(c => c.key === dragKey.value))

const cloneX = ref(0)
const cloneY = ref(0)
const cloneW = ref(128)
const cloneH = ref(72)
let grabDX = 0
let grabDY = 0

function tileTargetIndex(clientX: number): number {
  const strip = stripEl.value
  if (!strip) return 0
  const rect = strip.getBoundingClientRect()
  const tiles = orderedClips.value.length
  if (tiles === 0 || rect.width === 0) return 0
  const first = strip.firstElementChild as HTMLElement | null
  const scale = first && first.offsetWidth > 0
    ? first.getBoundingClientRect().width / first.offsetWidth
    : 1
  const tileW = (first ? first.offsetWidth + 6 : 134) * scale
  const x = clientX - rect.left + strip.scrollLeft * scale
  return Math.min(tiles - 1, Math.max(0, Math.floor(x / tileW)))
}

function onTileDown(e: PointerEvent, idx: number) {
  const clip = orderedClips.value[idx]
  if (!clip) return
  const tile = e.currentTarget as HTMLElement
  const rect = tile.getBoundingClientRect()
  dragKey.value = clip.key
  cloneW.value = rect.width
  cloneH.value = rect.height
  grabDX = e.clientX - rect.left
  grabDY = e.clientY - rect.top
  cloneX.value = rect.left
  cloneY.value = rect.top
  tile.setPointerCapture?.(e.pointerId)
}

function onTileMove(e: PointerEvent) {
  if (dragKey.value == null) return
  cloneX.value = e.clientX - grabDX
  cloneY.value = e.clientY - grabDY

  const from = dragTargetIdx.value
  const target = tileTargetIndex(e.clientX)
  if (from < 0 || target === from) return
  const next = [...order.value]
  const [moved] = next.splice(from, 1)
  next.splice(target, 0, moved)
  order.value = next
}

function onTileUp() {
  dragKey.value = null
}
</script>
