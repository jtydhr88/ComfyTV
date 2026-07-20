<template>
  <div class="ctv:flex ctv:flex-col ctv:gap-1 ctv:min-w-0 ctv:min-h-0">
    <span class="ctv:shrink-0 ctv:text-2xs ctv:uppercase ctv:tracking-wide ctv:text-muted-foreground">
      {{ label }}
    </span>
    <canvas
      ref="scopeCanvas"
      width="512"
      height="256"
      class="ctv:w-full ctv:flex-1 ctv:min-h-0 ctv:rounded ctv:border ctv:border-border-subtle ctv:bg-black"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import type { LGraphNode } from '@/lib/comfyApp'
import { useLiveScope } from '@/composables/stages/useLiveScope'
import { scopeKindOf } from '@/composables/stages/useDownstreamScopes'
import type { ScopeKind } from '@/composables/stages/scopeMath'

const props = defineProps<{
  scopeNode: LGraphNode
}>()

const scopeCanvas = ref<HTMLCanvasElement | null>(null)
const label = computed(() => scopeKindOf(props.scopeNode))

useLiveScope({
  node: props.scopeNode,
  scope: () => scopeKindOf(props.scopeNode) as ScopeKind,
  canvasEl: scopeCanvas,
})
</script>
