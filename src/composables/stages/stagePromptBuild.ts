import {
  injectAssetRefs,
  nodeAcceptsAudioInput,
  nodeAcceptsAutogrowImages,
  nodeAcceptsAutogrowVideos,
  fetchWorkflowMetaCached,
  mentionWorkflowRef,
  type ResolvedImageRef,
} from '@/composables/stages/assetSlots'
import { expandDirectorTimeline } from '@/composables/stages/directorMentions'
import { readImageRefs, refType } from '@/composables/stages/imageRefs'
import {
  expandMentionTokens,
  mentionOrdinalText,
  minimaxAudioOffset,
  mentionSendOrders,
  normalizeMentionStyle,
} from '@/composables/stages/imageSlotMentions'
import { t } from '@/i18n'
import { app } from '@/lib/comfyApp'
import { useAssetStore } from '@/stores/assetStore'
import { useEntryStore } from '@/stores/entryStore'
import { usePinnedBatchStore } from '@/stores/pinnedBatchStore'
import { useProjectStore } from '@/stores/projectStore'
import { useStageStore } from '@/stores/stageStore'
import { buildScopedPrompt, collectReachableNodeIds } from '@/utils/graphSerialize'

type Store = ReturnType<typeof useStageStore>

export interface BuiltRunPrompt {
  pm: any
  targetId: string
  isBridgeIn: boolean
  pid: string
}

export async function buildRunPrompt(node: any, store: Store): Promise<BuiltRunPrompt | null> {
  const a = app as any
  const isBridgeIn = typeof node?.comfyClass === 'string'
                     && node.comfyClass.startsWith('ComfyTV.BridgeTo')
  const pm = isBridgeIn
    ? await a.graphToPrompt()
    : await buildScopedPrompt(a, collectReachableNodeIds(a, node))

  const entries = useEntryStore()
  const pid = useProjectStore().currentProjectId || ''

  const resolveStyle = async (graphNode: unknown) => {
    const wfRef = mentionWorkflowRef(graphNode, a.graph)
    if (!wfRef) return normalizeMentionStyle(undefined)
    try {
      const meta = await fetchWorkflowMetaCached(wfRef.kind, wfRef.label)
      return normalizeMentionStyle(meta.mention_style)
    } catch {
      return normalizeMentionStyle(undefined)
    }
  }
  const ordinalTexts = (
    style: ReturnType<typeof normalizeMentionStyle>,
    orders: ReturnType<typeof mentionSendOrders>,
  ) => ({
    image: mentionOrdinalText(style, n => t('mention.imageExpand', { n }), 'image'),
    video: mentionOrdinalText(style, n => t('mention.videoExpand', { n }), 'video'),
    audio: mentionOrdinalText(style, n => t('mention.audioExpand', { n }), 'audio',
                              style === 'minimax_tags' ? minimaxAudioOffset(orders) : 0),
  })
  const runStyle = await resolveStyle(node)

  const targetId = String(node.id)
  const missingUpstream: string[] = []
  const promptNodeIds = isBridgeIn ? [targetId] : Object.keys(pm?.output ?? {})
  for (const nid of promptNodeIds) {
    const nodeInputs = pm?.output?.[nid]?.inputs
    if (!nodeInputs) continue
    for (const key of Object.keys(nodeInputs)) {
      const val = nodeInputs[key]
      if (!Array.isArray(val) || val.length !== 2) continue
      const upstreamId = val[0]
      if (!isBridgeIn && pm?.output?.[String(upstreamId)]) continue
      const upstreamSlot = Number(val[1]) || 0
      const upstreamNode = a.graph?.getNodeById?.(Number(upstreamId))
                        ?? a.graph?.getNodeById?.(String(upstreamId))
      if (!upstreamNode) continue
      const upstreamState = store.getStage(upstreamNode)
      let snapshot: string | null | undefined
      if (upstreamState) {
        const slotted = upstreamState.outputs?.[upstreamSlot]
        if (slotted != null) {
          snapshot = slotted
        } else if (upstreamSlot === 0 && upstreamState.output) {
          snapshot = upstreamState.output
        }
      }
      if (snapshot != null) {
        if ((key === 'texts' || key.startsWith('texts.')) && snapshot.includes('@')) {
          const upstreamOrders = mentionSendOrders(upstreamNode)
          const { text, missing } = expandMentionTokens(
            entries.expand(pid, snapshot),
            upstreamOrders,
            ordinalTexts(runStyle, upstreamOrders),
          )
          for (const m of missing) {
            console.warn(`[ComfyTV/stage] upstream #${upstreamId}: @${m.type}_${m.slot} references an empty slot — dropped from prompt`)
          }
          snapshot = text
        }
        nodeInputs[key] = snapshot
      } else if (!isBridgeIn) {
        const upstreamLabel = upstreamNode.title
                              || upstreamNode.comfyClass
                              || `#${upstreamId}`
        missingUpstream.push(`${upstreamLabel} (#${upstreamId})`)
      }
    }
  }

  if (missingUpstream.length > 0) {
    const list = [...new Set(missingUpstream)].join(', ')
    const msg = t('error.upstreamNotReadyDetail', { list })
    console.warn(`[ComfyTV/stage] ${msg}`)
    ;(app as any)?.extensionManager?.toast?.add?.({
      severity: 'warn',
      summary: t('error.upstreamNotReady'),
      detail: msg,
      life: 6000,
    })
    return null
  }

  const assetStore = useAssetStore()
  const pinnedBatches = usePinnedBatchStore()

  const refsByNode = new Map<string, ReturnType<typeof readImageRefs>>()
  for (const nid of Object.keys(pm?.output ?? {})) {
    const gn = a.graph?.getNodeById?.(Number(nid)) ?? a.graph?.getNodeById?.(String(nid))
    const refs = readImageRefs(gn)
    if (refs.length) refsByNode.set(String(nid), refs)
  }
  if (refsByNode.size > 0) await assetStore.hydrate()

  for (const [nid, inputs] of Object.entries(pm?.output ?? {})) {
    const obj = (inputs as any)?.inputs
    if (!obj) continue

    const refs = refsByNode.get(String(nid))
    if (refs?.length) {
      const graphNode = a.graph?.getNodeById?.(Number(nid))
                     ?? a.graph?.getNodeById?.(String(nid))
      const acceptsType = {
        image: nodeAcceptsAutogrowImages(graphNode),
        video: nodeAcceptsAutogrowVideos(graphNode),
        audio: nodeAcceptsAudioInput(graphNode),
      }
      const resolved: ResolvedImageRef[] = []
      for (const r of refs) {
        const type = refType(r)
        if (!acceptsType[type]) continue
        if (r.batch_index != null) {
          const urls = r.batch_id ? pinnedBatches.byId(pid, r.batch_id)?.urls ?? [] : []
          const url = urls[r.batch_index]
          if (url) resolved.push({ id: -1, url, slot: r.slot, type: 'image' })
          else console.warn(`[ComfyTV/stage] node #${nid}: pinned batch ref #${r.batch_index + 1} has no image (batch ${r.batch_id ?? 'unknown'})`)
          continue
        }
        const asset = r.asset_id != null ? assetStore.byId(r.asset_id) : undefined
        if (asset) resolved.push({ id: r.asset_id!, url: asset.payload_url, slot: r.slot, type })
        else console.warn(`[ComfyTV/stage] node #${nid}: ${type} ref ${r.asset_id} missing from library`)
      }
      for (const w of injectAssetRefs(obj, resolved)) {
        console.warn(`[ComfyTV/stage] node #${nid}: ${w}`)
      }
    }

    const mp = obj.main_prompt
    if (typeof mp === 'string' && mp.includes('@')) {
      const graphNode = a.graph?.getNodeById?.(Number(nid))
                     ?? a.graph?.getNodeById?.(String(nid))
      const mentionStyle = String(nid) === targetId
        ? runStyle
        : await resolveStyle(graphNode)
      const nodeOrders = mentionSendOrders(graphNode)
      const { text, missing } = expandMentionTokens(
        entries.expand(pid, mp),
        nodeOrders,
        ordinalTexts(mentionStyle, nodeOrders),
      )
      for (const m of missing) {
        console.warn(`[ComfyTV/stage] node #${nid}: @${m.type}_${m.slot} references an empty slot — dropped from prompt`)
      }
      obj.main_prompt = text
    }

    const tl = obj.timeline_data
    if (typeof tl === 'string'
        && (pm?.output?.[nid] as any)?.class_type === 'ComfyTV.DirectorStage') {
      const graphNode = a.graph?.getNodeById?.(Number(nid))
                     ?? a.graph?.getNodeById?.(String(nid))
      const sharedRefs = { images: [] as string[], videos: [] as string[], audio: [] as string[] }
      const nodeRefs = readImageRefs(graphNode)
      if (nodeRefs.length) await assetStore.hydrate()
      const bucketOf = { image: 'images', video: 'videos', audio: 'audio' } as const
      for (const r of [...nodeRefs].sort((x, y) => x.slot - y.slot)) {
        let url: string | undefined
        if (r.batch_index != null) {
          url = r.batch_id
            ? pinnedBatches.byId(pid, r.batch_id)?.urls[r.batch_index]
            : undefined
        } else if (r.asset_id != null) {
          url = assetStore.byId(r.asset_id)?.payload_url
        }
        if (url) sharedRefs[bucketOf[refType(r)]].push(url)
        else console.warn(`[ComfyTV/stage] director #${nid}: shared ref (slot ${r.slot}) could not be resolved — skipped`)
      }
      obj.timeline_data = await expandDirectorTimeline(tl, {
        defaultWorkflow: String(obj.workflow ?? ''),
        shared: sharedRefs,
        expandEntries: (s) => entries.expand(pid, s),
        styleFor: async (label) => {
          try {
            const meta = await fetchWorkflowMetaCached('video', label)
            return normalizeMentionStyle(meta.mention_style)
          } catch {
            return normalizeMentionStyle(undefined)
          }
        },
        naturalText: (type, n) => t(`mention.${type}Expand`, { n }),
        onMissing: (clipId, type, slot) => {
          console.warn(`[ComfyTV/stage] director #${nid} clip ${clipId}: @${type}_${slot} references an empty ref — dropped from prompt`)
        },
      })
    }
  }

  return { pm, targetId, isBridgeIn, pid }
}
