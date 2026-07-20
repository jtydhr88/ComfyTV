<template>
  <Teleport to="body" :disabled="!fullscreen">
    <div
      v-if="fullscreen"
      class="ctv:fixed ctv:inset-0 ctv:z-[1400] ctv:bg-base-background ctv:p-3 ctv:flex ctv:flex-row ctv:gap-3 ctv:text-xs ctv:text-base-foreground"
      @contextmenu.stop.prevent
    >
      <div class="ctv:flex-[2] ctv:min-w-0 ctv:min-h-0 ctv:flex ctv:flex-col ctv:gap-2">
        <div class="ctv:relative ctv:flex-1 ctv:min-h-0 ctv:flex ctv:flex-col">
          <slot name="player" />
          <button
            type="button"
            :class="toggleBtnClass"
            :title="$t('fx.exitFullscreen')"
            @click.stop="toggleFullscreen"
          ><IconMinimize class="ctv:size-3.5" /></button>
        </div>

        <div
          v-if="scopeNodes.length"
          class="ctv:h-52 ctv:shrink-0 ctv:flex ctv:flex-row ctv:gap-2"
        >
          <FxScopeMirror
            v-for="s in scopeNodes"
            :key="String((s as any).id)"
            :scope-node="s"
            class="ctv:flex-1 ctv:min-w-0"
          />
        </div>
      </div>

      <div
        class="ctv:flex-1 ctv:min-w-0 ctv:min-h-0 ctv:overflow-y-auto ctv-scroll-thin ctv:flex ctv:flex-col ctv:gap-1.5"
        @wheel.stop
      >
        <slot />
      </div>
    </div>

    <div
      v-else
      class="ctv:flex ctv:flex-col ctv:gap-1.5 ctv:size-full"
      @contextmenu.stop.prevent
    >
      <div class="ctv:relative ctv:flex-1 ctv:flex ctv:flex-col">
        <slot name="player" />
        <button
          type="button"
          :class="toggleBtnClass"
          :title="$t('fx.fullscreen')"
          @click.stop="toggleFullscreen"
        ><IconMaximize class="ctv:size-3.5" /></button>
      </div>
      <slot />
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { onBeforeUnmount, ref, shallowRef } from 'vue'
import IconMaximize from '~icons/lucide/maximize-2'
import IconMinimize from '~icons/lucide/minimize-2'

import type { LGraphNode } from '@/lib/comfyApp'
import FxScopeMirror from '@/components/stages/FxScopeMirror.vue'
import { findDownstreamScopeNodes } from '@/composables/stages/useDownstreamScopes'

const props = defineProps<{
  node: LGraphNode
}>()

const fullscreen = ref(false)
const scopeNodes = shallowRef<LGraphNode[]>([])

function onKeydown(e: KeyboardEvent): void {
  if (e.key !== 'Escape' || !fullscreen.value) return
  e.stopPropagation()
  e.preventDefault()
  toggleFullscreen()
}

function toggleFullscreen(): void {
  fullscreen.value = !fullscreen.value
  if (fullscreen.value) {
    scopeNodes.value = findDownstreamScopeNodes(props.node)
    window.addEventListener('keydown', onKeydown, true)
  } else {
    scopeNodes.value = []
    window.removeEventListener('keydown', onKeydown, true)
  }
}

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown, true)
})

const toggleBtnClass =
  'ctv:absolute ctv:top-1 ctv:right-1 ctv:z-20 ctv:inline-flex ctv:size-6 ctv:items-center ctv:justify-center'
  + ' ctv:rounded ctv:border ctv:border-border-subtle ctv:cursor-pointer'
  + ' ctv:bg-secondary-background/80 ctv:text-base-foreground ctv:hover:border-primary-background'
</script>
