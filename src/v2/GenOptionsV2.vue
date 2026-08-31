<template>
  <PopoverRoot v-model:open="open">
    <PopoverTrigger as-child>
      <button type="button" class="v2-genopt__chip" :aria-expanded="open" @pointerdown.stop>
        <span v-if="ratio" class="v2-genopt__icon"><span :style="ratioBoxStyle(ratio)" /></span>
        <span class="v2-genopt__label">{{ chipLabel }}</span>
        <svg viewBox="0 0 10 6" fill="none" :class="['v2-genopt__chev', open && 'v2-genopt__chev--open']">
          <path d="M1 1l4 4 4-4" stroke="currentColor" stroke-width="1.4" />
        </svg>
      </button>
    </PopoverTrigger>
    <PopoverPortal>
      <PopoverContent class="v2-genopt__pop" side="top" align="start" :side-offset="8" @pointerdown.stop>
        <template v-if="resolution != null">
          <div class="v2-genopt__title">{{ t('v2.genopt.resolution') }}</div>
          <div class="v2-genopt__row">
            <button
              v-for="r in resolutionOptions" :key="r" type="button"
              :class="['v2-genopt__opt', r === resolution && 'v2-genopt__opt--on']"
              @click="pick('resolution', r)"
            >{{ r }}</button>
          </div>
        </template>
        <template v-if="ratio != null">
          <div class="v2-genopt__title">{{ t('v2.genopt.ratio') }}</div>
          <div class="v2-genopt__grid">
            <button
              v-for="r in ratioOptions" :key="r" type="button"
              :class="['v2-genopt__cell', r === ratio && 'v2-genopt__opt--on']"
              @click="pick('aspect_ratio', r)"
            >
              <span class="v2-genopt__icon v2-genopt__icon--cell"><span :style="ratioBoxStyle(r)" /></span>
              <span>{{ r }}</span>
            </button>
          </div>
        </template>
        <template v-if="batch != null">
          <div class="v2-genopt__title">{{ t('v2.genopt.count') }}</div>
          <div class="v2-genopt__row">
            <button
              v-for="n in batchOptions" :key="n" type="button"
              :class="['v2-genopt__opt', n === batch && 'v2-genopt__opt--on']"
              @click="pick('batch_size', n)"
            >{{ t('v2.batchCount', { n }) }}</button>
          </div>
        </template>
      </PopoverContent>
    </PopoverPortal>
  </PopoverRoot>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { PopoverContent, PopoverPortal, PopoverRoot, PopoverTrigger } from 'reka-ui'
import { useI18n } from 'vue-i18n'

const props = withDefaults(defineProps<{
  ratio?: string | null
  ratioOptions?: string[]
  resolution?: string | null
  resolutionOptions?: string[]
  batch?: string | null
}>(), { ratio: null, ratioOptions: () => [], resolution: null, resolutionOptions: () => [], batch: null })

const emit = defineEmits<{ update: [name: string, value: string] }>()

const { t } = useI18n()
const open = ref(false)

const batchOptions = Array.from({ length: 8 }, (_, i) => String(i + 1))

const chipLabel = computed(() => [
  props.ratio,
  props.resolution,
  props.batch != null ? t('v2.batchCount', { n: props.batch }) : null,
].filter(Boolean).join(' · '))

function ratioBoxStyle(r: string): Record<string, string> {
  const [a, b] = String(r).split(':').map(Number)
  if (!a || !b) return { width: '11px', height: '11px' }
  const long = 12
  const short = Math.max(5, Math.round(long * Math.min(a, b) / Math.max(a, b)))
  return a >= b
    ? { width: `${long}px`, height: `${short}px` }
    : { width: `${short}px`, height: `${long}px` }
}

function pick(name: string, value: string) {
  emit('update', name, value)
}
</script>

<style>
.v2-genopt__chip {
  display: flex;
  align-items: center;
  gap: 6px;
  max-width: 100%;
  cursor: pointer;
}
.v2-genopt__label {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  color: var(--v2-text-mid);
}
.v2-genopt__chev { width: 8px; height: 5px; flex: none; transition: transform .15s ease; }
.v2-genopt__chev--open { transform: rotate(180deg); }
.v2-genopt__icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 14px;
  height: 14px;
  flex: none;
}
.v2-genopt__icon > span {
  border: 1.4px solid currentColor;
  border-radius: 2px;
  box-sizing: border-box;
}
.v2-genopt__icon--cell { width: 16px; height: 16px; margin: 0 auto; }
.v2-genopt__pop {
  z-index: 3000;
  width: 292px;
  padding: 12px;
  border-radius: 14px;
  background: var(--v2-slab-bg, #1c1c22);
  border: 1px solid var(--v2-slab-border, #2c2c34);
  box-shadow: 0 10px 32px rgba(0, 0, 0, .5);
  color: var(--v2-text-mid, #b9b9c0);
  font: 500 11px/1.2 system-ui, sans-serif;
}
.v2-genopt__title {
  margin: 10px 0 6px;
  color: var(--v2-text-muted, #808088);
  font-size: 11px;
}
.v2-genopt__title:first-child { margin-top: 0; }
.v2-genopt__row { display: flex; flex-wrap: wrap; gap: 6px; }
.v2-genopt__opt {
  flex: 1 0 auto;
  min-width: 48px;
  height: 30px;
  padding: 0 10px;
  border: 1px solid var(--v2-chip-border, #34343c);
  border-radius: 9px;
  background: transparent;
  color: var(--v2-text-mid, #b9b9c0);
  font: 500 11px/1 system-ui, sans-serif;
  cursor: pointer;
}
.v2-genopt__opt:hover, .v2-genopt__cell:hover { background: var(--v2-hover-bg, rgba(255,255,255,.06)); }
.v2-genopt__pop button { outline: none; }
.v2-genopt__pop button:focus-visible { border-color: var(--v2-text-muted, #808088); }
.v2-genopt__grid {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 6px;
}
.v2-genopt__cell {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 5px;
  padding: 8px 0 6px;
  border: 1px solid var(--v2-chip-border, #34343c);
  border-radius: 9px;
  background: transparent;
  color: var(--v2-text-mid, #b9b9c0);
  font: 500 11px/1 system-ui, sans-serif;
  cursor: pointer;
}
.v2-genopt__opt--on,
.v2-genopt__cell.v2-genopt__opt--on {
  background: var(--v2-chip-bg, rgba(255,255,255,.1));
  border-color: var(--v2-text-strong, #ececf1);
  color: var(--v2-text-strong, #ececf1);
}
html:not(.dark-theme) .v2-genopt__pop {
  background: #ffffff;
  border-color: rgba(0, 0, 0, .1);
  box-shadow: 0 10px 32px rgba(0, 0, 0, .18);
  color: #4a4a52;
}
html:not(.dark-theme) .v2-genopt__pop .v2-genopt__opt,
html:not(.dark-theme) .v2-genopt__pop .v2-genopt__cell {
  border-color: rgba(0, 0, 0, .12);
  color: #4a4a52;
}
html:not(.dark-theme) .v2-genopt__pop .v2-genopt__opt:hover,
html:not(.dark-theme) .v2-genopt__pop .v2-genopt__cell:hover {
  background: rgba(0, 0, 0, .05);
}
html:not(.dark-theme) .v2-genopt__pop .v2-genopt__opt--on {
  background: rgba(0, 0, 0, .07);
  border-color: #202024;
  color: #202024;
}
</style>
