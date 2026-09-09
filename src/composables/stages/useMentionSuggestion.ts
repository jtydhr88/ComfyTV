import { findSuggestionMatch, type Trigger } from '@tiptap/suggestion'
import { VueRenderer } from '@tiptap/vue-3'
import tippy, { type Instance as TippyInstance } from 'tippy.js'
import { type Component, type Ref } from 'vue'

import {
  mentionSendOrders,
  mentionSlotLabel,
  slotColor,
  type MentionOrders,
  type MentionSlotType,
} from '@/composables/stages/imageSlotMentions'
import { readMediaTable } from '@/composables/stages/mediaOrder'
import { mediaEntrySourceNode, mediaEntryUrl } from '@/composables/stages/mediaOrderSync'
import { modulesForSurface } from '@/composables/stages/promptModules/catalog'
import type { PromptModule } from '@/composables/stages/promptModules/types'
import { t } from '@/i18n'
import type { LGraphNode } from '@/lib/comfyApp'
import { useAssetStore } from '@/stores/assetStore'
import { useEntryStore } from '@/stores/entryStore'

export type MentionSuggestionItem =
  | { type: 'snippet'; module: PromptModule }
  | { type: 'imageSlot'; slotType: MentionSlotType; slot: number; ordinal: number; url: string | null; color: string; note: string }

export interface MentionSource {
  orders(): MentionOrders
  previewUrl(type: MentionSlotType, slot: number): string | null
  note?(type: MentionSlotType, slot: number): string
}

export function nodeMentionSource(getNode: () => LGraphNode | undefined): MentionSource {
  const assetStore = useAssetStore()
  return {
    orders() {
      return mentionSendOrders(getNode())
    },
    previewUrl(type, position) {
      const node = getNode()
      const entry = readMediaTable(node)[type][position - 1]
      if (!entry || type !== 'image') return null
      return mediaEntryUrl(node, entry)
    },
    note(type, position) {
      const node = getNode()
      const entry = readMediaTable(node)[type][position - 1]
      if (!entry) return ''
      if (entry.src === 'link') {
        const src = mediaEntrySourceNode(node, entry)
        return String(src?.title || src?.comfyClass || t('mediaStrip.wired'))
      }
      if (entry.src === 'batch') return t('imageRefs.batchItem', { n: entry.batch_index! + 1 })
      return assetStore.byId(entry.asset_id!)?.name || `asset:${entry.asset_id}`
    },
  }
}

export function mentionPrefixAllowed(before: string): boolean {
  return !/[A-Za-z0-9]/.test(before)
}

export function useMentionSuggestionFromSource(
  projectId: Ref<string>,
  getSource: () => MentionSource,
  MentionList: Component,
) {
  const entryStore = useEntryStore()

  function slotItems(q: string): MentionSuggestionItem[] {
    const source = getSource()
    const orders = source.orders()
    const out: MentionSuggestionItem[] = []
    for (const slotType of ['image', 'video', 'audio'] as const) {
      orders[slotType].forEach((slot, i) => {
        const item = {
          type: 'imageSlot' as const,
          slotType,
          slot,
          ordinal: i + 1,
          url: source.previewUrl(slotType, slot),
          color: slotColor(slot),
          note: source.note?.(slotType, slot) ?? '',
        }
        if (slotItemMatches(item, q)) out.push(item)
      })
    }
    return out
  }

  function slotItemMatches(
    item: Extract<MentionSuggestionItem, { type: 'imageSlot' }>,
    q: string,
  ): boolean {
    if (!q) return true
    const chip = t(`mention.${item.slotType}Chip`, { n: item.slot }).toLowerCase()
    return mentionSlotLabel(item.slotType, item.slot).includes(q) || chip.includes(q)
      || item.note.toLowerCase().includes(q)
  }

  return {
    char: '@',
    allowedPrefixes: null,
    findSuggestionMatch: (config: Trigger) => {
      const match = findSuggestionMatch(config)
      if (!match) return null
      const before = config.$position.doc.textBetween(
        Math.max(0, match.range.from - 1),
        match.range.from,
        '\n',
        '￼',
      )
      return mentionPrefixAllowed(before) ? match : null
    },
    items: ({ query }: { query: string }): MentionSuggestionItem[] => {
      const q = query.toLowerCase()

      let mods = modulesForSurface('mention', entryStore.list(projectId.value))
      if (q) mods = mods.filter(m => (m.label ?? '').toLowerCase().includes(q))

      return [
        ...slotItems(q),
        ...mods.map(module => ({ type: 'snippet' as const, module })),
      ]
    },
    render: () => {
      let component: any
      let popup: TippyInstance[] | undefined
      return {
        onStart: (props: any) => {
          component = new VueRenderer(MentionList, {
            props,
            editor: props.editor,
          })
          if (!props.clientRect) return
          popup = tippy('body', {
            getReferenceClientRect: props.clientRect,
            appendTo: () => document.body,
            content: component.element,
            showOnCreate: true,
            interactive: true,
            trigger: 'manual',
            placement: 'bottom-start',
            arrow: false,
            offset: [0, 4],
            theme: 'comfytv-transparent',
          })
        },
        onUpdate: (props: any) => {
          component?.updateProps(props)
          if (!props.clientRect) return
          popup?.[0]?.setProps({ getReferenceClientRect: props.clientRect })
        },
        onKeyDown: (props: any) => {
          if (props.event.key === 'Escape') {
            popup?.[0]?.hide()
            return true
          }
          return component?.ref?.onKeyDown(props)
        },
        onExit: () => {
          popup?.[0]?.destroy()
          component?.destroy()
        },
      }
    },
  }
}

export function useMentionSuggestion(
  projectId: Ref<string>,
  getNode: () => LGraphNode | undefined,
  MentionList: Component,
) {
  return useMentionSuggestionFromSource(projectId, () => nodeMentionSource(getNode), MentionList)
}
