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
          @wheel.stop class="ctv-scroll-thin ctv:absolute ctv:right-0 ctv:top-full ctv:mt-1 ctv:z-20 ctv:w-44 ctv:max-h-56 ctv:overflow-y-auto
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
import ComfyTVNumber from '@/components/widgets/ComfyTVNumber.vue'
import ComfyTVSlider from '@/components/widgets/ComfyTVSlider.vue'
import ComfyTVText from '@/components/widgets/ComfyTVText.vue'
import ComfyTVToggle from '@/components/widgets/ComfyTVToggle.vue'
import ComfyTVSelect from '@/components/widgets/ComfyTVSelect.vue'
import type { LGraphNode } from '@/lib/comfyApp'
import type { StageState } from '@/stores/stageStore'
import { useCustomParams } from '@/composables/stages/useCustomParams'

const props = defineProps<{
  state: StageState
  node: LGraphNode
}>()

const {
  menuOpen,
  hasWidget,
  attached,
  available,
  defLabel,
  defType,
  cfg,
  cfgNum,
  cfgStr,
  numVal,
  useSlider,
  comboOptions,
  attach,
  detach,
  setVal,
} = useCustomParams(props.node, () => props.state)

const sectionLabel = 'ctv:text-2xs ctv:uppercase ctv:tracking-wide ctv:opacity-60'
const addBtn = 'ctv:inline-flex ctv:items-center ctv:h-5 ctv:px-1.5 ctv:rounded-sm ctv:text-3xs ctv:font-semibold ctv:cursor-pointer'
  + ' ctv:border-none ctv:bg-secondary-background ctv:text-secondary-foreground ctv:hover:bg-secondary-background-hover'
  + ' ctv:disabled:opacity-40 ctv:disabled:pointer-events-none'
const removeBtn = 'ctv:shrink-0 ctv:flex ctv:items-center ctv:justify-center ctv:size-5 ctv:rounded-full ctv:cursor-pointer'
  + ' ctv:border-none ctv:bg-transparent ctv:text-destructive-background ctv:hover:bg-destructive-background/10'
</script>
