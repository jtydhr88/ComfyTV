<template>
  <PopoverRoot v-model:open="open">
    <PopoverAnchor v-if="$slots.anchor" as-child>
      <slot name="anchor" />
    </PopoverAnchor>
    <PopoverTrigger v-if="$slots.trigger" as-child>
      <slot name="trigger" />
    </PopoverTrigger>
    <PopoverPortal>
      <PopoverContent
        class="v2-pop"
        :side="side"
        :align="align"
        :side-offset="6"
        :collision-padding="{ top: 10, bottom: 10, left: -Infinity, right: -Infinity }"
        update-position-strategy="always"
        :style="width ? { width } : undefined"
        @wheel.stop
        @focus-outside.prevent
      >
        <slot />
      </PopoverContent>
    </PopoverPortal>
  </PopoverRoot>
</template>

<script lang="ts">
let closeCurrent: (() => void) | null = null
</script>

<script setup lang="ts">
import { PopoverAnchor, PopoverContent, PopoverPortal, PopoverRoot, PopoverTrigger } from 'reka-ui'
import { computed, onScopeDispose, ref, watch } from 'vue'

const props = withDefaults(defineProps<{
  open?: boolean
  side?: 'top' | 'right' | 'bottom' | 'left'
  align?: 'start' | 'center' | 'end'
  width?: string
}>(), { open: undefined, side: 'bottom', align: 'start', width: '' })

const emit = defineEmits<{ 'update:open': [boolean] }>()

const local = ref(false)
const open = computed({
  get: () => props.open ?? local.value,
  set: (value) => { local.value = value; emit('update:open', value) },
})
const close = () => { open.value = false }

watch(open, (isOpen) => {
  if (isOpen) {
    if (closeCurrent && closeCurrent !== close) closeCurrent()
    closeCurrent = close
  } else if (closeCurrent === close) {
    closeCurrent = null
  }
})
onScopeDispose(() => { if (closeCurrent === close) closeCurrent = null })
</script>

<style>
.v2-pop {
  z-index: 998;
  display: flex;
  flex-direction: column;
  max-height: var(--reka-popover-content-available-height, 70vh);
  overflow: auto;
  overscroll-behavior: contain;
  border-radius: 8px;
  box-shadow: 0 10px 32px rgba(0, 0, 0, .45);
}
.v2-pop > * { margin-top: 0; }
</style>
