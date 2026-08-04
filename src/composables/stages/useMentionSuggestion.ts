import { VueRenderer } from '@tiptap/vue-3'
import tippy, { type Instance as TippyInstance } from 'tippy.js'
import { type Component, type Ref } from 'vue'

import {
  imageSendOrder,
  mentionSendOrderOf,
  mentionSlotLabel,
  slotColor,
  type MentionSlotType,
} from '@/composables/stages/imageSlotMentions'
import { readImageRefs } from '@/composables/stages/imageRefs'
import { modulesForSurface } from '@/composables/stages/promptModules/catalog'
import type { PromptModule } from '@/composables/stages/promptModules/types'
import { t } from '@/i18n'
import type { LGraphNode } from '@/lib/comfyApp'
import { useAssetStore } from '@/stores/assetStore'
import { useEntryStore } from '@/stores/entryStore'
import { useStageStore } from '@/stores/stageStore'

export type MentionSuggestionItem =
  | { type: 'snippet'; module: PromptModule }
  | { type: 'imageSlot'; slotType: MentionSlotType; slot: number; ordinal: number; url: string | null; color: string }

export function useMentionSuggestion(
  projectId: Ref<string>,
  getNode: () => LGraphNode | undefined,
  MentionList: Component,
) {
  const entryStore = useEntryStore()
  const assetStore = useAssetStore()
  const stageStore = useStageStore()

  function imageSlotItems(q: string): MentionSuggestionItem[] {
    const node = getNode()
    if (!node) return []
    const order = imageSendOrder(node)
    if (order.length === 0) return []

    const refs = readImageRefs(node)
    const inputs = stageStore.getStage(node)?.inputs ?? []

    return order
      .map((slot, i) => {
        const pinned = refs.filter(r => r.slot === slot).at(-1)
        const url = pinned
          ? assetStore.byId(pinned.asset_id)?.payload_url ?? null
          : inputs.find(inp => inp.slot === `images.image${slot}`)?.content ?? null
        return {
          type: 'imageSlot' as const,
          slotType: 'image' as const,
          slot,
          ordinal: i + 1,
          url,
          color: slotColor(slot),
        }
      })
      .filter(item => slotItemMatches(item, q))
  }

  function mediaSlotItems(slotType: 'video' | 'audio', q: string): MentionSuggestionItem[] {
    const node = getNode()
    if (!node) return []
    return mentionSendOrderOf(node, slotType)
      .map((slot, i) => ({
        type: 'imageSlot' as const,
        slotType,
        slot,
        ordinal: i + 1,
        url: null,
        color: slotColor(slot),
      }))
      .filter(item => slotItemMatches(item, q))
  }

  function slotItemMatches(
    item: Extract<MentionSuggestionItem, { type: 'imageSlot' }>,
    q: string,
  ): boolean {
    if (!q) return true
    const chip = t(`mention.${item.slotType}Chip`, { n: item.slot }).toLowerCase()
    return mentionSlotLabel(item.slotType, item.slot).includes(q) || chip.includes(q)
  }

  return {
    char: '@',
    items: ({ query }: { query: string }): MentionSuggestionItem[] => {
      const q = query.toLowerCase()

      let mods = modulesForSurface('mention', entryStore.list(projectId.value))
      if (q) mods = mods.filter(m => (m.label ?? '').toLowerCase().includes(q))

      return [
        ...imageSlotItems(q),
        ...mediaSlotItems('video', q),
        ...mediaSlotItems('audio', q),
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
