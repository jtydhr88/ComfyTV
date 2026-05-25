<template>
  <Teleport to="body">
    <Transition name="comfytv-dlg">
      <div
        v-if="store.open"
        class="comfytv-dlg-backdrop"
        @mousedown.self="store.close()"
      >
        <div class="comfytv-dlg" :style="{ maxWidth: store.width }">
          <header class="comfytv-dlg-header">
            <h2 class="comfytv-dlg-title">{{ store.title }}</h2>
            <button class="comfytv-dlg-close" @click="store.close()" aria-label="Close">
              ×
            </button>
          </header>
          <div class="comfytv-dlg-body">
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

<style scoped>
.comfytv-dlg-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: 10000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
}
.comfytv-dlg {
  width: 100%;
  max-height: calc(100vh - 48px);
  background: var(--comfy-menu-bg, #202020);
  color: var(--input-text, #e0e0e0);
  border: 1px solid var(--border-color, #3a3a3a);
  border-radius: 6px;
  box-shadow: 0 16px 48px rgba(0, 0, 0, 0.5);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.comfytv-dlg-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 14px;
  border-bottom: 1px solid var(--border-color, #2a2a2a);
  background: rgba(255, 255, 255, 0.02);
}
.comfytv-dlg-title {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  color: var(--input-text, #e0e0e0);
}
.comfytv-dlg-close {
  background: transparent;
  border: 0;
  color: var(--input-text-secondary, #aaa);
  font-size: 22px;
  line-height: 1;
  width: 28px;
  height: 28px;
  border-radius: 4px;
  cursor: pointer;
}
.comfytv-dlg-close:hover {
  background: rgba(255, 255, 255, 0.1);
  color: var(--input-text, #e0e0e0);
}
.comfytv-dlg-body {
  flex: 1 1 auto;
  overflow-y: auto;
  padding: 14px;
  font-size: 12px;
}

.comfytv-dlg-enter-active, .comfytv-dlg-leave-active {
  transition: opacity 160ms ease;
}
.comfytv-dlg-enter-active .comfytv-dlg, .comfytv-dlg-leave-active .comfytv-dlg {
  transition: transform 160ms ease, opacity 160ms ease;
}
.comfytv-dlg-enter-from, .comfytv-dlg-leave-to {
  opacity: 0;
}
.comfytv-dlg-enter-from .comfytv-dlg, .comfytv-dlg-leave-to .comfytv-dlg {
  transform: translateY(-12px) scale(0.985);
  opacity: 0;
}
</style>
