import { ref, watch } from 'vue'

import { app, type LGraphNode } from '@/lib/comfyApp'
import { useStageStore, type StageState } from '@/stores/stageStore'
import { uploadBlob } from '@/utils/uploadCanvas'
import { readWidgetStr, writeWidget } from '@/utils/widget'

export interface Shot {
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

export function useStoryboardShots(node: LGraphNode, state: StageState) {
  const store = useStageStore()

  const shots = ref<Shot[]>([])
  const uploadingId = ref<string | null>(null)
  const regeneratingId = ref<string | null>(null)
  const fileInputEl = ref<HTMLInputElement | null>(null)
  let pendingUploadShotId: string | null = null
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
    writeWidget(node, 'storyboard_data', json)
    store.applyExecutedPayload(state, { output: [json] })
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
    const raw = readWidgetStr(node, 'storyboard_data', '')
    if (loadFromJson(raw)) { lastWritten = raw; return }
    if (state.output && loadFromJson(String(state.output))) {
      lastWritten = String(state.output)
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
    if (regeneratingId.value) return
    const idx = shots.value.findIndex(s => s.id === shotId)
    if (idx < 0) return
    regeneratingId.value = shotId
    try {
      const workflow   = readWidgetStr(node, 'workflow', '')
      const premise    = readWidgetStr(node, 'main_prompt', '')
      const characters = readWidgetStr(node, 'characters', '')
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
      const url = await uploadBlob(file, { subfolder: 'storyboard', filename: file.name })
      setImage(shotId, url)
    } catch (err) {
      console.error('[ComfyTV/storyboard] ref upload failed', err)
    } finally {
      uploadingId.value = null
    }
  }

  restore()
  if (node) {
    const origOnConfigure = node.onConfigure
    node.onConfigure = function (info: any) {
      origOnConfigure?.call(this, info)
      restore()
    }
  }

  watch(() => state.output, (out) => {
    if (!out || out === lastWritten) return
    if (loadFromJson(String(out))) {
      lastWritten = String(out)
      writeWidget(node, 'storyboard_data', out)
    }
  })

  return {
    shots, uploadingId, regeneratingId, fileInputEl,
    addShot, removeShot, move,
    setField, setDuration, setImage,
    regenerateShot,
    pickFile, onFilePicked,
  }
}
