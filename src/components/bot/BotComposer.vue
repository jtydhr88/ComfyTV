<template>
  <div class="ctv:shrink-0 ctv:border-t ctv:border-border-subtle ctv:p-2">
    <AssetPickerPopup
      v-if="pickerOpen && store.canAttach"
      class="ctv:mb-1.5"
      :added-ids="pending.map(a => a.asset_id)"
      :media-types="['image', 'video', 'audio']"
      @select="addAsset"
      @close="pickerOpen = false"
    />
    <div
      v-if="slashOpen && slashMatches.length"
      class="ctv:mb-1.5 ctv:max-h-48 ctv:overflow-y-auto ctv:rounded-lg ctv:border ctv:border-border-subtle ctv:bg-secondary-background ctv:p-1 ctv:flex ctv:flex-col"
    >
      <button
        v-for="s in slashMatches"
        :key="s.name"
        class="ctv-bot-skill-option"
        @click="pickSkill(s)"
      >
        <span class="ctv:shrink-0 ctv:font-mono ctv:text-xs ctv:text-base-foreground">/{{ s.name }}</span>
        <span class="ctv:min-w-0 ctv:truncate ctv:text-2xs ctv:text-muted-foreground">{{ s.description }}</span>
      </button>
    </div>
    <div
      v-if="mentionOpen && mentionMatches.length"
      class="ctv:mb-1.5 ctv:max-h-48 ctv:overflow-y-auto ctv:rounded-lg ctv:border ctv:border-border-subtle ctv:bg-secondary-background ctv:p-1 ctv:flex ctv:flex-col"
    >
      <button
        v-for="m in mentionMatches"
        :key="refKey(m)"
        class="ctv-bot-skill-option"
        @click="pickMention(m)"
      >
        <i class="pi ctv:shrink-0 ctv:text-[10px] ctv:text-muted-foreground" :class="refIcon(m)" />
        <span class="ctv:shrink-0 ctv:text-xs ctv:text-base-foreground">{{ refLabel(m) }}</span>
        <span class="ctv:min-w-0 ctv:truncate ctv:text-2xs ctv:text-muted-foreground">
          {{ m.kind === 'stage' ? m.stage_class : m.media_type }}
        </span>
      </button>
    </div>
    <div
      class="ctv:flex ctv:flex-col ctv:gap-1.5 ctv:rounded-lg ctv:border ctv:border-border-subtle ctv:bg-secondary-background ctv:px-2 ctv:py-1.5 ctv:focus-within:border-border"
    >
      <div v-if="mentionRefs.length" class="ctv:flex ctv:flex-wrap ctv:gap-1.5">
        <span
          v-for="r in mentionRefs"
          :key="refKey(r)"
          class="ctv:inline-flex ctv:items-center ctv:gap-1 ctv:rounded-full ctv:border ctv:border-border-subtle ctv:px-2 ctv:py-0.5 ctv:text-2xs ctv:text-base-foreground"
        >
          <i class="pi ctv:text-[9px]" :class="refIcon(r)" />
          @{{ refLabel(r) }}
          <button
            class="ctv-bot-skill-x"
            :title="$t('bot.removeRef')"
            @click="removeRef(refKey(r))"
          >
            <i class="pi pi-times ctv:text-[9px]" />
          </button>
        </span>
      </div>
      <div v-if="selectedSkill" class="ctv:flex ctv:flex-wrap ctv:gap-1.5">
        <span
          class="ctv:inline-flex ctv:items-center ctv:gap-1 ctv:rounded-full ctv:border ctv:border-border-subtle ctv:px-2 ctv:py-0.5 ctv:text-2xs ctv:font-mono ctv:text-base-foreground"
        >
          <i class="pi pi-bolt ctv:text-[9px]" />
          /{{ selectedSkill.name }}
          <button
            class="ctv-bot-skill-x"
            :title="$t('bot.removeSkill')"
            @click="clearSkill()"
          >
            <i class="pi pi-times ctv:text-[9px]" />
          </button>
        </span>
      </div>
      <div v-if="pending.length" class="ctv:flex ctv:flex-wrap ctv:gap-1.5">
        <div
          v-for="att in pending"
          :key="att.asset_id"
          class="ctv:group ctv:relative"
          :class="att.media_type === 'image' ? 'ctv:h-14 ctv:w-14' : ''"
        >
          <img
            v-if="att.media_type === 'image'"
            :src="att.url"
            :title="att.name"
            class="ctv:h-14 ctv:w-14 ctv:rounded-md ctv:border ctv:border-border-subtle ctv:object-cover"
          >
          <div
            v-else
            :title="att.name"
            class="ctv:flex ctv:h-14 ctv:max-w-36 ctv:items-center ctv:gap-1.5 ctv:rounded-md ctv:border ctv:border-border-subtle ctv:px-2"
          >
            <i
              class="pi ctv:shrink-0 ctv:text-sm ctv:text-muted-foreground"
              :class="att.media_type === 'video' ? 'pi-video' : 'pi-volume-up'"
            />
            <span class="ctv:truncate ctv:text-[11px]">{{ att.name }}</span>
          </div>
          <button
            class="ctv-bot-chip-x"
            :title="$t('bot.removeAttachment')"
            @click="removePending(att.asset_id)"
          >
            <i class="pi pi-times ctv:text-[9px]" />
          </button>
        </div>
        <div
          v-if="uploading"
          class="ctv:flex ctv:h-14 ctv:w-14 ctv:items-center ctv:justify-center ctv:rounded-md ctv:border ctv:border-dashed ctv:border-border-subtle"
        >
          <i class="pi pi-spin pi-spinner ctv:text-xs ctv:text-muted-foreground" />
        </div>
      </div>
      <textarea
        ref="input"
        v-model="draft"
        rows="1"
        class="ctv:max-h-40 ctv:w-full ctv:resize-none ctv:border-none ctv:bg-transparent ctv:text-sm ctv:text-base-foreground ctv:outline-none ctv:[font-family:inherit]"
        :placeholder="$t('bot.inputPlaceholder')"
        @input="autoGrow"
        @paste="onPaste"
        @keydown.enter.exact.prevent="onEnter"
      />
      <div class="ctv:flex ctv:items-center ctv:gap-1.5">
        <template v-if="store.canAttach">
          <button
            class="ctv-bot-attach"
            :title="$t('bot.attachImage')"
            :disabled="store.busy || uploading"
            @click="filePicker?.click()"
          >
            <i class="pi pi-image ctv:text-xs" />
          </button>
          <button
            class="ctv-bot-attach"
            :class="pickerOpen ? 'ctv-bot-attach-active' : ''"
            :title="$t('bot.attachFromLibrary')"
            :disabled="store.busy"
            @click="togglePicker"
          >
            <i class="pi ctv:text-xs" :class="pickerOpen ? 'pi-times' : 'pi-images'" />
          </button>
        </template>
        <button
          class="ctv-bot-attach"
          :title="$t('bot.insertFromCanvas')"
          :disabled="store.busy"
          @click="insertFromCanvas"
        >
          <i class="pi pi-plus-circle ctv:text-xs" />
        </button>
        <input
          ref="filePicker"
          type="file"
          accept="image/*,video/*,audio/*"
          multiple
          class="ctv:hidden"
          @change="onPick"
        >
        <div class="ctv:flex-1" />
        <button
          v-if="store.busy"
          class="ctv-bot-send ctv:flex ctv:items-center ctv:gap-1 ctv:rounded-md ctv:border-none ctv:bg-node-stroke-error/80 ctv:px-2.5 ctv:py-1 ctv:text-xs ctv:text-white ctv:cursor-pointer"
          @click="store.stop()"
        >
          <i class="pi pi-stop-circle ctv:text-[11px]" />
          {{ $t('bot.stop') }}
        </button>
        <button
          class="ctv-bot-send ctv:flex ctv:items-center ctv:gap-1 ctv:rounded-md ctv:border-none ctv:bg-interface-menu-component-surface-hovered ctv:px-2.5 ctv:py-1 ctv:text-xs ctv:text-base-foreground ctv:cursor-pointer ctv:disabled:opacity-40 ctv:disabled:cursor-default"
          :disabled="!draft.trim() && !pending.length"
          @click="submit"
        >
          <i class="pi ctv:text-[11px]" :class="store.busy ? 'pi-list' : 'pi-send'" />
          {{ store.busy ? $t('bot.queue') : $t('bot.send') }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { nextTick, ref, watch } from 'vue'

import type { Asset } from '@/api/schemas'
import AssetPickerPopup from '@/components/stages/AssetPickerPopup.vue'
import { useBotMentions } from '@/composables/functional/useBotMentions'
import { useSkillSlash } from '@/composables/functional/useSkillSlash'
import { importAssetFiles } from '@/composables/sidebar/assetImport'
import { toastLoaderUploadFailed } from '@/composables/stages/useLoaderFileDrop'
import { useAssetStore } from '@/stores/assetStore'
import { type BotAttachment, useBotStore } from '@/stores/botStore'
import { refIcon, refKey, refLabel, selectedCanvasStages } from '@/utils/botRefs'

const emit = defineEmits<{ sent: [] }>()

const store = useBotStore()
const draft = ref('')
const {
  open: slashOpen,
  matches: slashMatches,
  selected: selectedSkill,
  pick: pickSkill,
  pickFirst: pickFirstSkill,
  clear: clearSkill,
} = useSkillSlash(draft)
const {
  refs: mentionRefs,
  open: mentionOpen,
  matches: mentionMatches,
  pick: pickMention,
  pickFirst: pickFirstMention,
  addRef,
  removeRef,
  clear: clearRefs,
} = useBotMentions(draft)
const pending = ref<BotAttachment[]>([])
const uploading = ref(false)
const pickerOpen = ref(false)
const input = ref<HTMLTextAreaElement | null>(null)
const filePicker = ref<HTMLInputElement | null>(null)

const ATTACHABLE = ['image', 'video', 'audio'] as const

function insertFromCanvas(): void {
  selectedCanvasStages().forEach(addRef)
}

function addAsset(asset: Asset): void {
  if (!store.canAttach) return
  if (!(ATTACHABLE as readonly string[]).includes(asset.media_type)) return
  if (pending.value.some(a => a.asset_id === asset.id)) return
  pending.value = [...pending.value, {
    asset_id: asset.id, url: asset.payload_url, name: asset.name,
    media_type: asset.media_type as BotAttachment['media_type'],
  }]
}

function removePending(assetId: number): void {
  pending.value = pending.value.filter(a => a.asset_id !== assetId)
}

function togglePicker(): void {
  pickerOpen.value = !pickerOpen.value
  if (pickerOpen.value) {
    const assets = useAssetStore()
    assets.ensureHydrated()
    assets.installWebSocketSync()
  }
}

async function importFiles(files: File[]): Promise<void> {
  uploading.value = true
  try {
    const created = await importAssetFiles(files)
    created.forEach(addAsset)
  } catch (e) {
    console.error('[ComfyTV/bot] attachment upload failed', e)
    toastLoaderUploadFailed(e)
  } finally {
    uploading.value = false
  }
}

function onPick(e: Event): void {
  const el = e.target as HTMLInputElement
  const files = Array.from(el.files ?? [])
  el.value = ''
  if (files.length) void importFiles(files)
}

function onPaste(e: ClipboardEvent): void {
  if (!store.canAttach) return
  const files = Array.from(e.clipboardData?.files ?? [])
    .filter(f => ['image/', 'video/', 'audio/'].some(p => f.type.startsWith(p)))
  if (!files.length) return
  e.preventDefault()
  void importFiles(files)
}

function autoGrow() {
  const el = input.value
  if (!el) return
  el.style.height = 'auto'
  el.style.height = `${Math.min(el.scrollHeight, 160)}px`
}

function onEnter() {
  if (pickFirstMention()) return
  if (pickFirstSkill()) return
  void submit()
}

async function submit() {
  const text = draft.value.trim()
  if ((!text && !pending.value.length) || uploading.value) return
  const attachments = pending.value
  const skill = selectedSkill.value?.name
  const refs = mentionRefs.value
  draft.value = ''
  pending.value = []
  clearSkill()
  clearRefs()
  await nextTick()
  autoGrow()
  await store.send(text, attachments, skill, refs)
  emit('sent')
}

watch(() => store.activeChatId, () => {
  pending.value = []
  clearSkill()
  clearRefs()
})

defineExpose({ addAsset, importFiles })
</script>

<style scoped>
@media (hover: hover) {
  .ctv-bot-send:hover:not(:disabled) {
    filter: brightness(1.15);
  }
  .ctv-bot-attach:hover:not(:disabled) {
    background: color-mix(in srgb, currentColor 12%, transparent);
  }
  .ctv-bot-chip-x:hover {
    filter: brightness(1.4);
  }
  .ctv-bot-skill-option:hover {
    background: color-mix(in srgb, currentColor 10%, transparent);
  }
  .ctv-bot-skill-x:hover {
    filter: brightness(1.4);
  }
}
.ctv-bot-skill-option {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  border: none;
  border-radius: 6px;
  background: transparent;
  padding: 5px 8px;
  text-align: left;
  cursor: pointer;
  font-family: inherit;
  color: inherit;
}
.ctv-bot-skill-x {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: none;
  border-radius: 999px;
  background: transparent;
  padding: 0;
  margin-left: 2px;
  color: inherit;
  cursor: pointer;
}
.ctv-bot-attach {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--p-text-muted-color, #9ca3af);
  cursor: pointer;
}
.ctv-bot-attach:disabled {
  opacity: 0.4;
  cursor: default;
}
.ctv-bot-attach-active {
  background: color-mix(in srgb, currentColor 14%, transparent);
  color: var(--input-text, #e0e0e0);
}
.ctv-bot-chip-x {
  position: absolute;
  top: -5px;
  right: -5px;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  border: none;
  border-radius: 999px;
  background: color-mix(in srgb, black 55%, transparent);
  color: white;
  cursor: pointer;
}
</style>
