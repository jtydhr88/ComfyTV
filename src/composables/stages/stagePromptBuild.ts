import { fetchWorkflowMetaCached, mentionWorkflowRef } from '@/composables/stages/assetSlots'
import { expandDirectorTimeline } from '@/composables/stages/directorMentions'
import {
  expandMentionTokens,
  mentionOrdinalText,
  minimaxAudioOffset,
  mentionSendOrders,
  normalizeMentionStyle,
} from '@/composables/stages/imageSlotMentions'
import {
  materializeMedia,
  type MediaEntry,
  type MediaType,
  MEDIA_TYPES,
  readMediaTable,
} from '@/composables/stages/mediaOrder'
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
            console.warn(`[ComfyTV/stage] upstream #${upstreamId}: @${m.type}_${m.slot} references an empty position — dropped from prompt`)
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

  const graphNodeOf = (nid: string) =>
    a.graph?.getNodeById?.(Number(nid)) ?? a.graph?.getNodeById?.(String(nid))

  const tablesByNode = new Map<string, ReturnType<typeof readMediaTable>>()
  let needsAssets = false
  for (const nid of Object.keys(pm?.output ?? {})) {
    const table = readMediaTable(graphNodeOf(nid))
    if (MEDIA_TYPES.some(tp => table[tp].length > 0)) tablesByNode.set(String(nid), table)
    if (MEDIA_TYPES.some(tp => table[tp].some(e => e.src === 'asset'))) needsAssets = true
  }
  if (needsAssets) await assetStore.hydrate()

  const resolveUrl = (e: MediaEntry, _type: MediaType): string | null => {
    if (e.src === 'batch') {
      const urls = pinnedBatches.byId(pid, e.batch_id!)?.urls ?? []
      return urls[e.batch_index!] ?? null
    }
    if (e.src === 'asset') return assetStore.byId(e.asset_id!)?.payload_url ?? null
    return null
  }

  for (const [nid, inputs] of Object.entries(pm?.output ?? {})) {
    const obj = (inputs as any)?.inputs
    if (!obj) continue
    const graphNode = graphNodeOf(nid)

    const table = tablesByNode.get(String(nid))
    if (table) {
      for (const w of materializeMedia(obj, graphNode, table, resolveUrl)) {
        console.warn(`[ComfyTV/stage] node #${nid}: ${w}`)
      }
    }

    const mp = obj.main_prompt
    if (typeof mp === 'string' && mp.includes('@')) {
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
        console.warn(`[ComfyTV/stage] node #${nid}: @${m.type}_${m.slot} references an empty position — dropped from prompt`)
      }
      obj.main_prompt = text
    }

    const tl = obj.timeline_data
    if (typeof tl === 'string'
        && (pm?.output?.[nid] as any)?.class_type === 'ComfyTV.DirectorStage') {
      const sharedRefs = { images: [] as string[], videos: [] as string[], audio: [] as string[] }
      const bucketOf = { image: 'images', video: 'videos', audio: 'audio' } as const
      const nodeTable = readMediaTable(graphNode)
      for (const type of MEDIA_TYPES) {
        for (const e of nodeTable[type]) {
          if (e.src === 'link') continue
          const url = resolveUrl(e, type)
          if (url) sharedRefs[bucketOf[type]].push(url)
          else console.warn(`[ComfyTV/stage] director #${nid}: shared ref ${e.key} could not be resolved — skipped`)
        }
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
