<template>
  <div
    class="ctv:flex ctv:flex-col ctv:overflow-hidden ctv:rounded-md ctv:border ctv:border-[#161616]
           ctv:bg-[#2b2b2b] ctv:text-[11px] ctv:text-[#d6d6d6]"
    :class="collapsed ? 'ctv:flex-none' : 'ctv:min-h-0 ctv:flex-1'"
  >
    <div
      class="ctv:flex ctv:shrink-0 ctv:items-center ctv:gap-0.5 ctv:border-b ctv:border-[#161616] ctv:bg-[#333333]
             ctv:px-2 ctv:py-1 ctv:cursor-pointer ctv:select-none"
      :title="$t(collapsed ? 'pentrado.expandPanel' : 'pentrado.collapsePanel')"
      @click="toggle"
    >
      <IconChevronRight
        class="ctv:size-3 ctv:shrink-0 ctv:text-[#9b9b9b] ctv:transition-transform"
        :class="collapsed ? '' : 'ctv:rotate-90'"
      />
      <span class="ctv:flex-1 ctv:text-[11px] ctv:font-semibold">{{ title }}</span>
      <template v-if="!collapsed">
        <slot name="actions" />
      </template>
    </div>
    <div v-show="!collapsed" class="ctv:flex ctv:min-h-0 ctv:flex-1 ctv:flex-col ctv:overflow-hidden">
      <slot />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import IconChevronRight from '~icons/lucide/chevron-right'

const props = defineProps<{
  title: string
  storageKey?: string
}>()

const collapsed = ref(
  props.storageKey ? globalThis.localStorage?.getItem(props.storageKey) === '1' : false,
)

function toggle(): void {
  collapsed.value = !collapsed.value
  if (!props.storageKey) return
  try {
    globalThis.localStorage?.setItem(props.storageKey, collapsed.value ? '1' : '0')
  } catch {}
}
</script>
