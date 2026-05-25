<template>
  <div class="storyboard-stage">
    <div class="board-header">
      <span class="title">{{ $t('storyboard.shots') }} · {{ shots.length }}</span>
      <button type="button" class="add-btn" @click="addShot">+ {{ $t('storyboard.addShot') }}</button>
    </div>

    <div v-if="shots.length === 0" class="board-empty">
      {{ $t('storyboard.empty') }}
    </div>

    <div v-else class="shot-list">
      <div
        v-for="(shot, idx) in shots"
        :key="shot.id"
        class="shot-card"
      >
        <header class="shot-head">
          <span class="shot-no">#{{ idx + 1 }}</span>
          <label class="dur">
            <input
              type="number" min="1" max="60" step="1"
              :value="shot.duration"
              @change="(e) => setDuration(shot.id, Number((e.target as HTMLInputElement).value))"
            /><span>s</span>
          </label>
          <span v-if="shot.shot_size" class="chip size">{{ shot.shot_size }}</span>
          <span v-if="shot.character && shot.character !== '无'" class="chip char">{{ shot.character }}</span>
          <div class="shot-move">
            <button type="button" :disabled="idx === 0" @click="move(idx, -1)" :title="$t('storyboard.moveUp')">▲</button>
            <button type="button" :disabled="idx === shots.length - 1" @click="move(idx, 1)" :title="$t('storyboard.moveDown')">▼</button>
          </div>
          <button
            type="button"
            class="regen"
            :disabled="regeneratingId === shot.id"
            :title="$t('storyboard.regenerate')"
            @click="regenerateShot(shot.id, idx + 1)"
          >{{ regeneratingId === shot.id ? '…' : '🔄' }}</button>
          <button type="button" class="del" :title="$t('storyboard.remove')" @click="removeShot(shot.id)">🗑</button>
        </header>

        <textarea
          class="shot-purpose"
          :value="shot.scene_purpose"
          :placeholder="$t('storyboard.cols.scene_purpose')"
          rows="1"
          @input="(e) => setField(shot.id, 'scene_purpose', (e.target as HTMLTextAreaElement).value)"
        />

        <div class="shot-body">
          <div class="shot-img">
            <img v-if="shot.image_url" :src="shot.image_url" :alt="`shot ${idx + 1}`" draggable="false" />
            <div v-else class="img-placeholder">{{ $t('storyboard.noRef') }}</div>
            <button
              type="button"
              class="upload-mini"
              :disabled="uploadingId === shot.id"
              :title="$t('storyboard.uploadRef')"
              @click="pickFile(shot.id)"
            >{{ uploadingId === shot.id ? '…' : '📤' }}</button>
            <button
              v-if="shot.image_url"
              type="button"
              class="clear-mini"
              :title="$t('storyboard.clearRef')"
              @click="setImage(shot.id, null)"
            >✕</button>
          </div>

          <textarea
            class="shot-prompt"
            :value="shot.image_prompt"
            :placeholder="$t('storyboard.promptPlaceholder')"
            @input="(e) => setField(shot.id, 'image_prompt', (e.target as HTMLTextAreaElement).value, /*mirror=*/'prompt')"
          />
        </div>

        <dl class="meta">
          <template v-for="field in META_FIELDS" :key="field.key">
            <dt>{{ $t(field.label) }}</dt>
            <dd>
              <textarea
                v-if="field.multiline"
                class="meta-input multiline"
                :value="String(shot[field.key] ?? '')"
                rows="1"
                @input="(e) => setField(shot.id, field.key, (e.target as HTMLTextAreaElement).value)"
              />
              <input
                v-else
                class="meta-input"
                type="text"
                :value="String(shot[field.key] ?? '')"
                @input="(e) => setField(shot.id, field.key, (e.target as HTMLInputElement).value)"
              />
            </dd>
          </template>
        </dl>

        <details class="more" :open="!!shot.character_desc">
          <summary>{{ $t('storyboard.cols.character_desc') }}</summary>
          <textarea
            class="meta-input multiline"
            :value="shot.character_desc"
            rows="2"
            @input="(e) => setField(shot.id, 'character_desc', (e.target as HTMLTextAreaElement).value)"
          />
        </details>
        <details class="more" :open="!!shot.motion_prompt">
          <summary>{{ $t('storyboard.cols.motion_prompt') }}</summary>
          <textarea
            class="meta-input multiline"
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
      class="hidden-file"
      @change="onFilePicked"
    />

    <StageCard
      :state="state"
      :on-run-request="onRunRequest"
      :on-cancel-request="onCancelRequest"
      :on-disconnect="onDisconnect"
      :on-action="onAction"
      hide-output
    />
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { useStageStore, type StageState } from '@/stores/stageStore'
import StageCard from '@/components/stages/StageCard.vue'
import { app } from '@/lib/comfyApp'

interface Shot {
  id: string
  shot_no: string
  duration: number
  image_url: string | null
  prompt: string
  image_prompt: string
  scene_purpose: string
  character: string
  character_desc: string
  shot_size: string
  action: string
  emotion: string
  scene_tags: string
  lighting: string
  sfx: string
  dialogue: string
  motion_prompt: string
  [k: string]: unknown
}

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
  node: any
}>()

const store = useStageStore()

const shots = ref<Shot[]>([])
const uploadingId = ref<string | null>(null)
const regeneratingId = ref<string | null>(null)
const fileInputEl = ref<HTMLInputElement | null>(null)
let pendingUploadShotId: string | null = null

function getWidget(name: string): any | null {
  return props.node?.widgets?.find((w: any) => w.name === name) ?? null
}
function newId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
}

function blankShot(no: number): Shot {
  return {
    id: newId(), shot_no: String(no), duration: 3, image_url: null,
    prompt: '', image_prompt: '', scene_purpose: '', character: '',
    character_desc: '', shot_size: '', action: '', emotion: '',
    scene_tags: '', lighting: '', sfx: '', dialogue: '', motion_prompt: '',
  }
}
function addShot() {
  shots.value.push(blankShot(shots.value.length + 1))
  commit()
}
function removeShot(id: string) {
  shots.value = shots.value.filter(s => s.id !== id)
  commit()
}
function move(idx: number, dir: -1 | 1) {
  const j = idx + dir
  if (j < 0 || j >= shots.value.length) return
  const arr = shots.value
  ;[arr[idx], arr[j]] = [arr[j], arr[idx]]
  commit()
}

function setField<K extends keyof Shot>(
  id: string, key: K, value: Shot[K], mirror?: keyof Shot,
) {
  const s = shots.value.find(x => x.id === id); if (!s) return
  ;(s as any)[key] = value
  if (mirror) (s as any)[mirror] = value
  commit()
}
function setDuration(id: string, v: number) {
  const s = shots.value.find(x => x.id === id); if (!s) return
  s.duration = Math.max(1, Math.min(60, Math.round(v))); commit()
}
function setImage(id: string, url: string | null) {
  const s = shots.value.find(x => x.id === id); if (!s) return
  s.image_url = url; commit()
}

async function regenerateShot(shotId: string, targetNo: number) {
  if (regeneratingId.value) return  // serialize: one at a time
  const idx = shots.value.findIndex(s => s.id === shotId)
  if (idx < 0) return
  regeneratingId.value = shotId
  try {
    const workflow   = String(getWidget('workflow')?.value ?? '')
    const premise    = String(getWidget('main_prompt')?.value ?? '')
    const characters = String(getWidget('characters')?.value ?? '')
    const body = {
      workflow,
      premise,
      characters,
      shots: shots.value.map(s => ({ ...s, shot_no: s.shot_no })),
      target_shot_no: targetNo,
    }
    const resp = await (app as any).api.fetchApi('/comfytv/storyboard/regenerate_shot', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (resp.status !== 200) {
      const text = await resp.text()
      throw new Error(`${resp.status} ${text.slice(0, 200)}`)
    }
    const data = await resp.json() as { shot: Partial<Shot> }
    if (!data?.shot) throw new Error('no shot in response')
    const current = shots.value[idx]
    const incoming = data.shot
    const merged: Shot = {
      ...current,
      ...incoming,
      id: current.id,
      image_url: current.image_url,
      shot_no: String(targetNo),
      duration: parseInt(String(incoming.duration ?? current.duration), 10) || current.duration,
      prompt: String(incoming.image_prompt ?? incoming.prompt ?? current.prompt ?? ''),
      image_prompt: String(incoming.image_prompt ?? incoming.prompt ?? current.image_prompt ?? ''),
    }
    shots.value[idx] = merged
    commit()
  } catch (err: any) {
    console.error('[ComfyTV/storyboard] regenerate failed', err)
    ;(app as any)?.extensionManager?.toast?.add?.({
      severity: 'warn',
      summary: 'Regenerate shot failed',
      detail: String(err?.message || err),
      life: 5000,
    })
  } finally {
    regeneratingId.value = null
  }
}

function pickFile(shotId: string) {
  pendingUploadShotId = shotId
  fileInputEl.value?.click()
}
async function onFilePicked(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  const shotId = pendingUploadShotId
  pendingUploadShotId = null
  if (!file || !shotId) return

  uploadingId.value = shotId
  try {
    const body = new FormData()
    body.append('image', file, file.name)
    body.append('subfolder', 'storyboard')
    body.append('type', 'input')
    const resp = await (app as any).api.fetchApi('/upload/image', { method: 'POST', body })
    if (resp.status !== 200) throw new Error(`upload ${resp.status}`)
    const data = await resp.json() as { name?: string }
    if (!data?.name) throw new Error('no name')
    const url = `/view?filename=${encodeURIComponent(data.name)}&subfolder=storyboard&type=input`
    setImage(shotId, url)
  } catch (err) {
    console.error('[ComfyTV/storyboard] ref upload failed', err)
  } finally {
    uploadingId.value = null
  }
}

let lastWritten = ''

function serialize(): string {
  return JSON.stringify({
    shots: shots.value.map((s, i) => ({
      shot_no: String(i + 1),
      duration: s.duration,
      image_url: s.image_url,
      prompt: s.prompt,
      image_prompt: s.image_prompt,
      scene_purpose: s.scene_purpose,
      character: s.character,
      character_desc: s.character_desc,
      shot_size: s.shot_size,
      action: s.action,
      emotion: s.emotion,
      scene_tags: s.scene_tags,
      lighting: s.lighting,
      sfx: s.sfx,
      dialogue: s.dialogue,
      motion_prompt: s.motion_prompt,
    })),
  })
}
function commit() {
  const json = serialize()
  lastWritten = json
  const w = getWidget('storyboard_data')
  if (w && w.value !== json) { w.value = json; w.callback?.(json) }
  store.applyExecutedPayload(props.state, { output: [json] })
}

function loadFromJson(raw: string): boolean {
  if (!raw) return false
  try {
    const p = JSON.parse(raw)
    if (!Array.isArray(p?.shots)) return false
    shots.value = p.shots.map((s: any, i: number) => {
      const dur = Math.max(1, parseInt(String(s.duration ?? 3), 10) || 3)
      const imgPrompt = String(s.image_prompt ?? s.prompt ?? '')
      return {
        id: newId(),
        shot_no: String(s.shot_no ?? i + 1),
        duration: dur,
        image_url: s.image_url ?? null,
        prompt: imgPrompt,
        image_prompt: imgPrompt,
        scene_purpose: String(s.scene_purpose ?? ''),
        character: String(s.character ?? ''),
        character_desc: String(s.character_desc ?? ''),
        shot_size: String(s.shot_size ?? ''),
        action: String(s.action ?? ''),
        emotion: String(s.emotion ?? ''),
        scene_tags: String(s.scene_tags ?? ''),
        lighting: String(s.lighting ?? ''),
        sfx: String(s.sfx ?? ''),
        dialogue: String(s.dialogue ?? ''),
        motion_prompt: String(s.motion_prompt ?? ''),
      }
    })
    return true
  } catch {
    return false
  }
}

function restore() {
  const raw = String(getWidget('storyboard_data')?.value ?? '')
  if (loadFromJson(raw)) { lastWritten = raw; return }
  if (props.state.output && loadFromJson(String(props.state.output))) {
    lastWritten = String(props.state.output)
  }
}
restore()

if (props.node) {
  const origOnConfigure = props.node.onConfigure
  props.node.onConfigure = function (info: any) {
    origOnConfigure?.call(this, info)
    restore()
  }
}

watch(() => props.state.output, (out) => {
  if (!out || out === lastWritten) return
  if (loadFromJson(String(out))) {
    lastWritten = String(out)
    const w = getWidget('storyboard_data')
    if (w && w.value !== out) { w.value = out; w.callback?.(out) }
  }
})
</script>

<style scoped>
.storyboard-stage {
  display: flex;
  flex-direction: column;
  gap: 6px;
  width: 100%;
  height: 100%;
}
.board-header { display: flex; align-items: center; gap: 8px; }
.title { font-size: 11px; color: rgba(255,255,255,0.7); font-weight: 600; }
.add-btn {
  margin-left: auto; padding: 3px 10px; font-size: 11px;
  background: rgba(233,61,130,0.2); border: 1px solid rgba(233,61,130,0.4);
  border-radius: 4px; color: #ffb0d8; cursor: pointer;
}
.add-btn:hover { background: rgba(233,61,130,0.32); }
.board-empty { font-size: 11px; color: rgba(255,255,255,0.4); padding: 12px; text-align: center; }

.shot-list { display: flex; flex-direction: column; gap: 6px; }
.shot-card {
  border: 1px solid rgba(255,255,255,0.1); border-radius: 6px;
  background: rgba(255,255,255,0.03); padding: 8px; display: flex; flex-direction: column; gap: 6px;
}
.shot-head { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.shot-no { font-size: 13px; font-weight: 700; color: #d8b0ff; }
.chip {
  padding: 1px 6px; border-radius: 3px; font-size: 10px;
  background: rgba(255,255,255,0.08); color: rgba(255,255,255,0.8);
}
.chip.char { background: rgba(120,200,120,0.15); color: #b5e3a5; }
.shot-purpose {
  width: 100%; box-sizing: border-box; resize: none;
  background: rgba(78,168,255,0.06); color: rgba(255,255,255,0.85);
  border: none; border-left: 2px solid rgba(78,168,255,0.6); border-radius: 0;
  padding: 4px 8px; font-size: 11px; font-style: italic; line-height: 1.4;
  font-family: inherit; min-height: 22px;
}
.shot-purpose:focus { outline: 1px solid rgba(78,168,255,0.5); outline-offset: -1px; background: rgba(78,168,255,0.1); }
.meta { display: grid; grid-template-columns: max-content 1fr; gap: 3px 10px; margin: 0; font-size: 10px; align-items: start; }
.meta dt { opacity: 0.5; white-space: nowrap; padding-top: 4px; }
.meta dd { margin: 0; }
.meta-input {
  width: 100%; box-sizing: border-box;
  background: rgba(0,0,0,0.25); color: rgba(255,255,255,0.85);
  border: 1px solid transparent; border-radius: 3px;
  padding: 2px 5px; font-size: 10px; line-height: 1.4;
  font-family: inherit;
}
.meta-input:hover { border-color: rgba(255,255,255,0.08); }
.meta-input:focus {
  outline: none;
  border-color: rgba(78,168,255,0.5);
  background: rgba(0,0,0,0.4);
}
.meta-input.multiline { min-height: 22px; resize: vertical; }
.more {
  font-size: 10px; border: 1px dashed rgba(255,255,255,0.15);
  border-radius: 4px; padding: 3px 6px;
}
.more > summary { cursor: pointer; opacity: 0.75; user-select: none; padding-bottom: 4px; }
.more > summary:hover { opacity: 1; }
.more .meta-input.multiline { font-family: ui-monospace, monospace; min-height: 40px; }
.shot-move { display: flex; flex-direction: column; gap: 1px; margin-left: auto; }
.shot-move button {
  width: 16px; height: 13px; line-height: 1; font-size: 8px; padding: 0;
  border: 1px solid rgba(255,255,255,0.15); background: rgba(255,255,255,0.05);
  color: rgba(255,255,255,0.7); border-radius: 2px; cursor: pointer;
}
.shot-move button:disabled { opacity: 0.3; cursor: default; }
.dur { display: flex; align-items: center; gap: 2px; font-size: 10px; color: rgba(255,255,255,0.5); }
.dur input {
  width: 38px; background: rgba(0,0,0,0.3); color: rgba(255,255,255,0.9);
  border: 1px solid rgba(255,255,255,0.15); border-radius: 3px; padding: 2px 4px;
  font-size: 11px; font-family: ui-monospace, monospace;
}
.del { background: none; border: none; cursor: pointer; font-size: 13px; }
.regen {
  background: none; border: none; cursor: pointer; font-size: 12px;
  padding: 0 2px; opacity: 0.7;
}
.regen:hover:not(:disabled) { opacity: 1; }
.regen:disabled { opacity: 0.4; cursor: default; }

.shot-body { display: flex; gap: 6px; }
.shot-img {
  position: relative; flex: 0 0 96px; width: 96px; height: 72px;
  border-radius: 4px; overflow: hidden; background: #000;
  border: 1px solid rgba(255,255,255,0.1);
}
.shot-img img { width: 100%; height: 100%; object-fit: cover; }
.img-placeholder {
  width: 100%; height: 100%; display: flex; align-items: center; justify-content: center;
  font-size: 9px; color: rgba(255,255,255,0.35); text-align: center; padding: 0 4px;
}
.upload-mini, .clear-mini {
  position: absolute; width: 20px; height: 20px; padding: 0;
  border: none; border-radius: 4px; cursor: pointer; font-size: 11px;
  background: rgba(0,0,0,0.6); color: #fff;
}
.upload-mini { bottom: 2px; right: 2px; }
.upload-mini:disabled { opacity: 0.6; }
.clear-mini { top: 2px; right: 2px; background: rgba(120,20,20,0.7); }

.shot-prompt {
  flex: 1; min-height: 56px; resize: vertical; box-sizing: border-box;
  background: rgba(0,0,0,0.3); color: var(--input-text,#ddd);
  border: 1px solid rgba(255,255,255,0.15); border-radius: 4px;
  padding: 4px 6px; font-size: 11px; line-height: 1.4;
}

.hidden-file { display: none; }
</style>
