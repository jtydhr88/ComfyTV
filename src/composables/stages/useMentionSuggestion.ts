import { VueRenderer } from '@tiptap/vue-3'
import tippy, { type Instance as TippyInstance } from 'tippy.js'
import { type Component, type Ref } from 'vue'

import { modulesForSurface } from '@/composables/stages/promptModules/catalog'
import type { PromptModule } from '@/composables/stages/promptModules/types'
import { useEntryStore } from '@/stores/entryStore'

export type MentionSuggestionItem = { type: 'snippet'; module: PromptModule }

const MAX_ENTRIES = 8

export function useMentionSuggestion(
  projectId: Ref<string>,
  MentionList: Component,
) {
  const entryStore = useEntryStore()

  return {
    char: '@',
    items: ({ query }: { query: string }): MentionSuggestionItem[] => {
      const q = query.toLowerCase()

      let mods = modulesForSurface('mention', entryStore.list(projectId.value))
      if (q) mods = mods.filter(m => (m.label ?? '').toLowerCase().includes(q))

      return mods.slice(0, MAX_ENTRIES).map(module => ({ type: 'snippet' as const, module }))
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
