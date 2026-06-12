<template>
  <Teleport to="body">
    <Transition
      enter-active-class="ctv:duration-150 ctv:ease-out"
      enter-from-class="ctv:opacity-0"
      enter-to-class="ctv:opacity-100"
      leave-active-class="ctv:duration-150 ctv:ease-in"
      leave-from-class="ctv:opacity-100"
      leave-to-class="ctv:opacity-0"
    >
      <div
        v-if="store.open"
        class="ctv:fixed ctv:inset-0 ctv:z-[10000] ctv:flex ctv:items-center ctv:justify-center ctv:p-6
               ctv:bg-black/50 ctv:transition-opacity"
        @mousedown.self="store.close()"
      >
        <div
          class="ctv:w-full ctv:max-h-[calc(100vh-48px)] ctv:rounded-md ctv:overflow-hidden
                 ctv:flex ctv:flex-col ctv:shadow-[0_16px_48px_rgb(0_0_0/0.5)]
                 ctv:bg-interface-menu-surface ctv:text-base-foreground
                 ctv:border ctv:border-border-default"
          :style="{ maxWidth: store.width }"
        >
          <header
            class="ctv:flex ctv:items-center ctv:justify-between ctv:py-2.5 ctv:px-3.5
                   ctv:bg-base-foreground/[0.03] ctv:border-b ctv:border-border-subtle"
          >
            <h2 class="ctv:m-0 ctv:text-sm ctv:font-semibold ctv:text-base-foreground">
              {{ store.title }}
            </h2>
            <button
              class="ctv:bg-transparent ctv:border-0 ctv:cursor-pointer ctv:rounded
                     ctv:size-7 ctv:text-[22px] ctv:leading-none
                     ctv:text-muted-foreground
                     ctv:hover:bg-secondary-background-hover ctv:hover:text-base-foreground"
              aria-label="Close"
              @click="store.close()"
            >×</button>
          </header>
          <div class="ctv:flex-1 ctv:overflow-y-auto ctv:p-3.5 ctv:text-xs">
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
