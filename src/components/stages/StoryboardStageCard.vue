<template>
  <div class="flex flex-col gap-1.5 size-full">
    <div class="flex items-center gap-2">
      <span class="text-[11px] font-semibold text-muted-foreground">{{ $t('storyboard.shots') }} · {{ shots.length }}</span>
      <button
        type="button"
        class="ml-auto py-0.5 px-2.5 text-[11px] rounded cursor-pointer
               bg-primary-background/15 border border-primary-background/40 text-primary-background
               hover:bg-primary-background/25"
        @click="addShot"
      >+ {{ $t('storyboard.addShot') }}</button>
    </div>

    <div v-if="shots.length === 0" class="text-[11px] text-muted-foreground/60 p-3 text-center">
      {{ $t('storyboard.empty') }}
    </div>

    <div v-else class="flex flex-col gap-1.5">
      <div
        v-for="(shot, idx) in shots"
        :key="shot.id"
        class="flex flex-col gap-1.5 p-2 rounded-md border border-border-subtle bg-base-foreground/5"
      >
        <header class="flex items-center gap-1.5 flex-wrap">
          <span class="text-[13px] font-bold text-base-foreground">#{{ idx + 1 }}</span>
          <label class="flex items-center gap-0.5 text-2xs text-muted-foreground">
            <input
              type="number" min="1" max="60" step="1"
              :value="shot.duration"
              class="w-[38px] py-0.5 px-1 rounded-sm text-[11px] font-mono
                     bg-secondary-background text-base-foreground border border-border-subtle"
              @change="(e) => setDuration(shot.id, Number((e.target as HTMLInputElement).value))"
            /><span>s</span>
          </label>
          <span v-if="shot.shot_size"
                class="py-px px-1.5 rounded-sm text-2xs bg-secondary-background text-base-foreground">{{ shot.shot_size }}</span>
          <span v-if="shot.character && shot.character !== '无'"
                class="py-px px-1.5 rounded-sm text-2xs bg-success-background/15 text-success-background">{{ shot.character }}</span>
          <div class="flex flex-col gap-px ml-auto">
            <button type="button" :class="moveBtn" :disabled="idx === 0"
                    @click="move(idx, -1)" :title="$t('storyboard.moveUp')">▲</button>
            <button type="button" :class="moveBtn" :disabled="idx === shots.length - 1"
                    @click="move(idx, 1)" :title="$t('storyboard.moveDown')">▼</button>
          </div>
          <button
            type="button"
            class="bg-transparent border-0 cursor-pointer text-xs px-0.5 opacity-70
                   hover:opacity-100 disabled:opacity-40 disabled:cursor-default"
            :disabled="regeneratingId === shot.id"
            :title="$t('storyboard.regenerate')"
            @click="regenerateShot(shot.id, idx + 1)"
          >{{ regeneratingId === shot.id ? '…' : '🔄' }}</button>
          <button type="button"
                  class="bg-transparent border-0 cursor-pointer text-[13px]"
                  :title="$t('storyboard.remove')" @click="removeShot(shot.id)">🗑</button>
        </header>

        <textarea
          class="w-full box-border resize-none border-0 border-l-2 rounded-none
                 py-1 px-2 text-[11px] italic leading-snug min-h-[22px] [font-family:inherit]
                 bg-primary-background/5 border-primary-background/60 text-base-foreground
                 focus:outline focus:outline-1 focus:outline-primary-background/50 focus:bg-primary-background/10"
          :value="shot.scene_purpose"
          :placeholder="$t('storyboard.cols.scene_purpose')"
          rows="1"
          @input="(e) => setField(shot.id, 'scene_purpose', (e.target as HTMLTextAreaElement).value)"
        />

        <div class="flex gap-1.5">
          <div class="relative shrink-0 w-24 h-[72px] rounded overflow-hidden bg-black border border-border-subtle">
            <img v-if="shot.image_url" :src="shot.image_url" :alt="`shot ${idx + 1}`"
                 class="size-full object-cover" draggable="false" />
            <div v-else class="size-full flex items-center justify-center text-3xs text-white/35 text-center px-1">
              {{ $t('storyboard.noRef') }}
            </div>
            <button
              type="button"
              class="absolute bottom-0.5 right-0.5 size-5 p-0 border-0 rounded cursor-pointer text-[11px]
                     bg-black/60 text-white disabled:opacity-60"
              :disabled="uploadingId === shot.id"
              :title="$t('storyboard.uploadRef')"
              @click="pickFile(shot.id)"
            >{{ uploadingId === shot.id ? '…' : '📤' }}</button>
            <button
              v-if="shot.image_url"
              type="button"
              class="absolute top-0.5 right-0.5 size-5 p-0 border-0 rounded cursor-pointer text-[11px]
                     bg-destructive-background/70 text-white"
              :title="$t('storyboard.clearRef')"
              @click="setImage(shot.id, null)"
            >✕</button>
          </div>

          <textarea
            class="flex-1 min-h-14 resize-y box-border py-1 px-1.5 rounded text-[11px] leading-snug
                   bg-secondary-background text-base-foreground border border-border-subtle"
            :value="shot.image_prompt"
            :placeholder="$t('storyboard.promptPlaceholder')"
            @input="(e) => setField(shot.id, 'image_prompt', (e.target as HTMLTextAreaElement).value, /*mirror=*/'prompt')"
          />
        </div>

        <dl class="grid grid-cols-[max-content_1fr] gap-x-2.5 gap-y-[3px] m-0 text-2xs items-start">
          <template v-for="field in META_FIELDS" :key="field.key">
            <dt class="opacity-50 whitespace-nowrap pt-1">{{ $t(field.label) }}</dt>
            <dd class="m-0">
              <textarea
                v-if="field.multiline"
                :class="metaInput(true)"
                :value="String(shot[field.key] ?? '')"
                rows="1"
                @input="(e) => setField(shot.id, field.key, (e.target as HTMLTextAreaElement).value)"
              />
              <input
                v-else
                :class="metaInput(false)"
                type="text"
                :value="String(shot[field.key] ?? '')"
                @input="(e) => setField(shot.id, field.key, (e.target as HTMLInputElement).value)"
              />
            </dd>
          </template>
        </dl>

        <details class="text-2xs py-[3px] px-1.5 rounded border border-dashed border-border-subtle"
                 :open="!!shot.character_desc">
          <summary class="cursor-pointer opacity-75 select-none pb-1 hover:opacity-100">{{ $t('storyboard.cols.character_desc') }}</summary>
          <textarea
            :class="metaInput(true, true)"
            :value="shot.character_desc"
            rows="2"
            @input="(e) => setField(shot.id, 'character_desc', (e.target as HTMLTextAreaElement).value)"
          />
        </details>
        <details class="text-2xs py-[3px] px-1.5 rounded border border-dashed border-border-subtle"
                 :open="!!shot.motion_prompt">
          <summary class="cursor-pointer opacity-75 select-none pb-1 hover:opacity-100">{{ $t('storyboard.cols.motion_prompt') }}</summary>
          <textarea
            :class="metaInput(true, true)"
            :value="shot.motion_prompt"
            rows="2"
            @input="(e) => setField(shot.id, 'motion_prompt', (e.target as HTMLTextAreaElement).value)"
          />
        </details>
      </div>
    </div>

    <input
      ref="fileInputEl"
      type="file"
      accept="image/*"
      class="hidden"
      @change="onFilePicked"
    />

    <StageCard
      :state="state"
      :node="node"
      :on-run-request="onRunRequest"
      :on-cancel-request="onCancelRequest"
      :on-disconnect="onDisconnect"
      :on-action="onAction"
      hide-output
    />
  </div>
</template>

<script setup lang="ts">
import StageCard from '@/components/stages/StageCard.vue'
import { useStoryboardShots, type Shot } from '@/composables/stages/useStoryboardShots'
import type { LGraphNode } from '@/lib/comfyApp'
import type { StageState } from '@/stores/stageStore'

const META_FIELDS: ReadonlyArray<{ key: keyof Shot; label: string; multiline?: boolean }> = [
  { key: 'character',  label: 'storyboard.cols.character' },
  { key: 'shot_size',  label: 'storyboard.cols.shot_size' },
  { key: 'emotion',    label: 'storyboard.cols.emotion' },
  { key: 'scene_tags', label: 'storyboard.cols.scene_tags' },
  { key: 'lighting',   label: 'storyboard.cols.lighting' },
  { key: 'action',     label: 'storyboard.cols.action', multiline: true },
  { key: 'sfx',        label: 'storyboard.cols.sfx' },
  { key: 'dialogue',   label: 'storyboard.cols.dialogue' },
]

const props = defineProps<{
  state: StageState
  onRunRequest: () => void
  onCancelRequest: () => void
  onDisconnect: (slot: string) => void
  onAction: (id: string) => void
  node: LGraphNode
}>()

const {
  shots, uploadingId, regeneratingId, fileInputEl,
  addShot, removeShot, move,
  setField, setDuration, setImage,
  regenerateShot,
  pickFile, onFilePicked,
} = useStoryboardShots(props.node, props.state)

const moveBtn = [
  'w-4 h-[13px] leading-none text-[8px] p-0 rounded-sm cursor-pointer',
  'bg-secondary-background text-muted-foreground border border-border-subtle',
  'disabled:opacity-30 disabled:cursor-default',
].join(' ')

const META_INPUT_BASE = 'w-full box-border py-0.5 px-1.5 text-2xs leading-snug rounded-sm [font-family:inherit]'
  + ' bg-secondary-background text-base-foreground border border-transparent'
  + ' hover:border-border-subtle'
  + ' focus:outline-none focus:border-primary-background/50 focus:bg-secondary-background-hover'
function metaInput(multiline: boolean, mono = false) {
  const ml = multiline ? ' min-h-[22px] resize-y' : ''
  const m = mono ? ' font-mono min-h-10' : ''
  return `${META_INPUT_BASE}${ml}${m}`
}
</script>
