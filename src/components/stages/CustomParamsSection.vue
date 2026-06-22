<template>
  <section
    v-if="hasWidget && (attached.length || available.length)"
    class="ctv:flex ctv:flex-col ctv:gap-1"
  >
    <div class="ctv:flex ctv:items-center ctv:gap-2">
      <div :class="sectionLabel">{{ $t('stageParams.section') }}</div>
      <div class="ctv:relative ctv:ml-auto">
        <button
          :class="addBtn"
          :disabled="!available.length"
          :title="$t('stageParams.addHint')"
          @click.stop="menuOpen = !menuOpen"
        >+ {{ $t('stageParams.add') }}</button>
        <div
          v-if="menuOpen"
          class="ctv:absolute ctv:right-0 ctv:top-full ctv:mt-1 ctv:z-20 ctv:w-44 ctv:max-h-56 ctv:overflow-y-auto
                 ctv:p-1 ctv:rounded ctv:shadow-md ctv:bg-interface-menu-surface ctv:border ctv:border-border-default"
          @click.stop
        >
          <button
            v-for="d in available"
            :key="d.key"
            class="ctv:flex ctv:items-center ctv:gap-1.5 ctv:w-full ctv:px-1.5 ctv:py-1 ctv:rounded-sm ctv:cursor-pointer
                   ctv:text-left ctv:text-2xs ctv:bg-transparent ctv:border-none ctv:text-base-foreground
                   ctv:hover:bg-secondary-background-hover"
            @click="attach(d)"
          >
            <span class="ctv:flex-1 ctv:truncate">{{ d.label }}</span>
            <span class="ctv:text-3xs ctv:opacity-50">{{ d.type }}</span>
          </button>
        </div>
      </div>
    </div>

    <div
      v-for="item in attached"
      :key="item.key"
      class="ctv:flex ctv:items-center ctv:gap-2"
    >
      <span class="ctv:shrink-0 ctv:w-20 ctv:truncate ctv:text-[11px] ctv:text-muted-foreground" :title="defLabel(item.key)">
        {{ defLabel(item.key) }}
      </span>
      <div class="ctv:flex-1 ctv:min-w-0">
        <ComfyTVToggle
          v-if="defType(item.key) === 'boolean'"
          :model-value="Boolean(item.value)"
          @update:model-value="setVal(item.key, $event)"
        />
        <ComfyTVSlider
          v-else-if="useSlider(item.key)"
          :model-value="numVal(item.value)"
          :min="cfgNum(item.key, 'min')!"
          :max="cfgNum(item.key, 'max')!"
          :step="cfgNum(item.key, 'step') ?? (defType(item.key) === 'int' ? 1 : 0.1)"
          :precision="defType(item.key) === 'int' ? 0 : undefined"
          @update:model-value="setVal(item.key, $event)"
        />
        <ComfyTVNumber
          v-else-if="defType(item.key) === 'int' || defType(item.key) === 'float'"
          :model-value="numVal(item.value)"
          :min="cfgNum(item.key, 'min')"
          :max="cfgNum(item.key, 'max')"
          :step="cfgNum(item.key, 'step') ?? (defType(item.key) === 'int' ? 1 : 0.1)"
          :precision="defType(item.key) === 'int' ? 0 : undefined"
          @update:model-value="setVal(item.key, $event)"
        />
        <ComfyTVSelect
          v-else-if="defType(item.key) === 'combo'"
          :model-value="item.value as string"
          :options="comboOptions(item.key)"
          @update:model-value="setVal(item.key, $event)"
        />
        <ComfyTVText
          v-else
          :model-value="item.value == null ? '' : String(item.value)"
          :multiline="Boolean(cfg(item.key)?.multiline)"
          :placeholder="cfgStr(item.key, 'placeholder')"
          @update:model-value="setVal(item.key, $event)"
        />
      </div>
      <button
        :class="removeBtn"
        :title="$t('stageParams.remove')"
        @click="detach(item.key)"
      >−</button>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'

import ComfyTVNumber from '@/components/widgets/ComfyTVNumber.vue'
import ComfyTVSlider from '@/components/widgets/ComfyTVSlider.vue'
import ComfyTVText from '@/components/widgets/ComfyTVText.vue'
import ComfyTVToggle from '@/components/widgets/ComfyTVToggle.vue'
import ComfyTVSelect from '@/components/widgets/ComfyTVSelect.vue'
import type { LGraphNode } from '@/lib/comfyApp'
import type { StageState } from '@/stores/stageStore'
import type { StageParam } from '@/api/schemas'
import { useStageParamStore } from '@/stores/stageParamStore'
import { bindWidgetCallback, getWidget, readWidgetStr, writeWidget } from '@/utils/widget'

interface ParamItem { key: string; value: unknown }

const props = defineProps<{
  state: StageState
  node: LGraphNode
}>()

const store = useStageParamStore()
const menuOpen = ref(false)
const items = ref<ParamItem[]>([])

const hasWidget = computed(() => !!getWidget(props.node, 'custom_params'))
const defs = computed(() => store.forKind(props.state.kind))

const attached = computed(() =>
  items.value.filter(it => defs.value.some(d => d.key === it.key)),
)
const available = computed(() =>
  defs.value.filter(d => !items.value.some(it => it.key === d.key)),
)

function defByKey(key: string): StageParam | undefined {
  return defs.value.find(d => d.key === key)
}
function defLabel(key: string): string { return defByKey(key)?.label ?? key }
function defType(key: string): string { return defByKey(key)?.type ?? 'string' }
function cfg(key: string): Record<string, unknown> { return defByKey(key)?.config ?? {} }
function cfgNum(key: string, k: string): number | undefined {
  const v = cfg(key)[k]
  return typeof v === 'number' ? v : undefined
}
function cfgStr(key: string, k: string): string | undefined {
  const v = cfg(key)[k]
  return typeof v === 'string' ? v : undefined
}
function numVal(v: unknown): number | null {
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}
function useSlider(key: string): boolean {
  return defType(key) === 'int'
    && cfgNum(key, 'min') !== undefined
    && cfgNum(key, 'max') !== undefined
}
function comboOptions(key: string): string[] {
  const opts = cfg(key).options
  return Array.isArray(opts) ? opts.map(o => String(o)) : []
}

function readItems(): ParamItem[] {
  try {
    const data = JSON.parse(readWidgetStr(props.node, 'custom_params', '{}'))
    const arr = data?.items
    return Array.isArray(arr)
      ? arr.filter((x: any) => x && typeof x.key === 'string').map((x: any) => ({ key: x.key, value: x.value }))
      : []
  } catch {
    return []
  }
}

function persist() {
  writeWidget(props.node, 'custom_params', JSON.stringify({ items: items.value }))
}

function defaultFor(d: StageParam): unknown {
  if (d.default != null) return d.default
  switch (d.type) {
    case 'boolean': return false
    case 'int':
    case 'float':   return 0
    case 'combo':   return comboOptions(d.key)[0] ?? ''
    default:        return ''
  }
}

function attach(d: StageParam) {
  menuOpen.value = false
  if (items.value.some(it => it.key === d.key)) return
  items.value = [...items.value, { key: d.key, value: defaultFor(d) }]
  persist()
}

function detach(key: string) {
  items.value = items.value.filter(it => it.key !== key)
  persist()
}

function setVal(key: string, value: unknown) {
  items.value = items.value.map(it => (it.key === key ? { ...it, value } : it))
  persist()
}

function closeMenu() { menuOpen.value = false }

onMounted(async () => {
  store.ensureHydrated()
  store.installWebSocketSync()
  await store.hydrate()
  items.value = readItems()
  bindWidgetCallback(props.node, 'custom_params', () => { items.value = readItems() })
  window.addEventListener('click', closeMenu)
})
onBeforeUnmount(() => window.removeEventListener('click', closeMenu))

const sectionLabel = 'ctv:text-2xs ctv:uppercase ctv:tracking-wide ctv:opacity-60'
const addBtn = 'ctv:inline-flex ctv:items-center ctv:h-5 ctv:px-1.5 ctv:rounded-sm ctv:text-3xs ctv:font-semibold ctv:cursor-pointer'
  + ' ctv:border-none ctv:bg-secondary-background ctv:text-secondary-foreground ctv:hover:bg-secondary-background-hover'
  + ' ctv:disabled:opacity-40 ctv:disabled:pointer-events-none'
const removeBtn = 'ctv:shrink-0 ctv:flex ctv:items-center ctv:justify-center ctv:size-5 ctv:rounded-full ctv:cursor-pointer'
  + ' ctv:border-none ctv:bg-transparent ctv:text-destructive-background ctv:hover:bg-destructive-background/10'
</script>
