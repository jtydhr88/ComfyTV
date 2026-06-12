<template>
  <Teleport to="body">
    <Transition
      enter-active-class="duration-150 ease-out"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="duration-150 ease-in"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div
        v-if="store.open"
        class="fixed inset-0 z-[10000] flex items-center justify-center p-6
               bg-black/50 transition-opacity"
        @mousedown.self="store.close()"
      >
        <div
          class="w-full max-h-[calc(100vh-48px)] rounded-md overflow-hidden
                 flex flex-col shadow-[0_16px_48px_rgb(0_0_0/0.5)]
                 bg-interface-menu-surface text-base-foreground
                 border border-border-default"
          :style="{ maxWidth: store.width }"
        >
          <header
            class="flex items-center justify-between py-2.5 px-3.5
                   bg-base-foreground/[0.03] border-b border-border-subtle"
          >
            <h2 class="m-0 text-sm font-semibold text-base-foreground">
              {{ store.title }}
            </h2>
            <button
              class="bg-transparent border-0 cursor-pointer rounded
                     size-7 text-[22px] leading-none
                     text-muted-foreground
                     hover:bg-secondary-background-hover hover:text-base-foreground"
              aria-label="Close"
              @click="store.close()"
            >×</button>
          </header>
          <div class="flex-1 overflow-y-auto p-3.5 text-xs">
            <component
              :is="store.component"
              v-if="store.component"
              v-bind="store.props"
            />
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'
import { useDialogStore } from '@/stores/dialogStore'

const store = useDialogStore()

function onKey(e: KeyboardEvent) {
  if (e.key === 'Escape' && store.open) {
    e.stopPropagation()
    store.close()
  }
}

onMounted(() => window.addEventListener('keydown', onKey, true))
onUnmounted(() => window.removeEventListener('keydown', onKey, true))
</script>
