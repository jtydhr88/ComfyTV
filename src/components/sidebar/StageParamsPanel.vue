<template>
  <div class="ctv:flex ctv:flex-col ctv:size-full ctv:overflow-hidden ctv:text-xs ctv:text-base-foreground">
    <div class="ctv:shrink-0 ctv:flex ctv:items-center ctv:gap-2 ctv:py-1.5 ctv:px-2.5
                ctv:bg-interface-panel-surface ctv:border-b ctv:border-border-subtle">
      <span class="ctv:flex-1 ctv:font-semibold ctv:text-sm">{{ $t('stageManager.title') }}</span>
      <div class="ctv:w-28">
        <ComfyTVSelect :model-value="activeKind" :options="kindOptions" @update:model-value="activeKind = String($event)" />
      </div>
    </div>

    <div class="ctv:flex-1 ctv:min-h-0 ctv:overflow-y-auto ctv:p-2.5 ctv:flex ctv:flex-col ctv:gap-2.5">
      <section>
        <button :class="sectionToggle" :aria-expanded="!wfCollapsed" @click="wfCollapsed = !wfCollapsed">
          <i :class="['pi', wfCollapsed ? 'pi-chevron-right' : 'pi-chevron-down', 'ctv:w-2.5 ctv:text-2xs ctv:text-muted-foreground']" />
          <span class="ctv:flex-1 ctv:text-left">{{ $t('stageManager.section.workflows') }}</span>
        </button>
        <StageWorkflowList v-show="!wfCollapsed" :kind="activeKind" :active="active" class="ctv:mt-1.5" @kinds="onKinds" />
        <p v-show="!wfCollapsed" class="ctv:m-0 ctv:mt-1.5 ctv:text-3xs ctv:italic ctv:text-muted-foreground/60">
          {{ $t('stageManager.hint') }}
        </p>
      </section>

      <section>
        <button :class="sectionToggle" :aria-expanded="!paramsCollapsed" @click="paramsCollapsed = !paramsCollapsed">
          <i :class="['pi', paramsCollapsed ? 'pi-chevron-right' : 'pi-chevron-down', 'ctv:w-2.5 ctv:text-2xs ctv:text-muted-foreground']" />
          <span class="ctv:flex-1 ctv:text-left">{{ $t('stageManager.section.params') }}</span>
        </button>
      <div v-show="!paramsCollapsed" class="ctv:mt-1.5 ctv:flex ctv:flex-col ctv:gap-2.5">
      <div class="ctv:flex ctv:flex-col ctv:gap-1.5 ctv:p-2 ctv:rounded ctv:border ctv:border-border-subtle ctv:bg-secondary-background/40">
        <div class="ctv:text-2xs ctv:uppercase ctv:tracking-wide ctv:opacity-60">{{ $t('stageParams.sidebar.new') }}</div>

        <label :class="fieldRow">
          <span :class="fieldLabel">{{ $t('stageParams.sidebar.label') }}</span>
          <ComfyTVText :model-value="form.label" :placeholder="$t('stageParams.sidebar.label')" @update:model-value="form.label = $event" />
        </label>

        <label :class="fieldRow">
          <span :class="fieldLabel">{{ $t('stageParams.sidebar.type') }}</span>
          <ComfyTVSelect :model-value="form.type" :options="typeOptions" @update:model-value="form.type = String($event)" />
        </label>

        <label v-if="form.type === 'combo'" :class="fieldRow">
          <span :class="fieldLabel">{{ $t('stageParams.sidebar.options') }}</span>
          <ComfyTVText :model-value="form.options" placeholder="a, b, c" @update:model-value="form.options = $event" />
        </label>

        <template v-if="form.type === 'int' || form.type === 'float'">
          <div class="ctv:flex ctv:gap-1.5">
            <label class="ctv:flex-1">
              <span :class="fieldLabel">{{ $t('stageParams.sidebar.min') }}</span>
              <ComfyTVNumber :model-value="form.min" @update:model-value="form.min = $event" />
            </label>
            <label class="ctv:flex-1">
              <span :class="fieldLabel">{{ $t('stageParams.sidebar.max') }}</span>
              <ComfyTVNumber :model-value="form.max" @update:model-value="form.max = $event" />
            </label>
            <label class="ctv:flex-1">
              <span :class="fieldLabel">{{ $t('stageParams.sidebar.step') }}</span>
              <ComfyTVNumber :model-value="form.step" @update:model-value="form.step = $event" />
            </label>
          </div>
          <div v-if="form.type === 'int'" class="ctv:text-3xs ctv:text-muted-foreground/70 ctv:italic">{{ $t('stageParams.sidebar.sliderHint') }}</div>
        </template>

        <label v-if="form.type === 'string'" :class="fieldRow">
          <span :class="fieldLabel">{{ $t('stageParams.sidebar.placeholder') }}</span>
          <ComfyTVText :model-value="form.placeholder" @update:model-value="form.placeholder = $event" />
        </label>

        <div :class="fieldRow">
          <span :class="fieldLabel">{{ $t('stageParams.sidebar.default') }}</span>
          <ComfyTVToggle v-if="form.type === 'boolean'" :model-value="form.boolDefault" @update:model-value="form.boolDefault = $event" />
          <ComfyTVNumber v-else-if="form.type === 'int' || form.type === 'float'" :model-value="form.numDefault" @update:model-value="form.numDefault = $event" />
          <ComfyTVSelect v-else-if="form.type === 'combo'" :model-value="form.default" :options="comboDefaultOptions" @update:model-value="form.default = String($event)" />
          <ComfyTVText v-else :model-value="form.default" @update:model-value="form.default = $event" />
        </div>

        <div class="ctv:flex ctv:items-center ctv:gap-2 ctv:mt-0.5">
          <span v-if="error" class="ctv:flex-1 ctv:text-3xs ctv:text-destructive-background">{{ error }}</span>
          <span v-else class="ctv:flex-1" />
          <button :class="primaryBtn" @click="onCreate">{{ $t('stageParams.sidebar.create') }}</button>
        </div>
      </div>

      <div v-if="rows.length === 0" class="ctv:py-4 ctv:text-center ctv:italic ctv:text-muted-foreground/60">
        {{ $t('stageParams.sidebar.empty') }}
      </div>
      <div
        v-for="p in rows"
        :key="p.id"
        class="ctv:flex ctv:items-center ctv:gap-2 ctv:py-1.5 ctv:px-2 ctv:rounded ctv:border ctv:border-border-subtle"
      >
        <div class="ctv:flex-1 ctv:min-w-0">
          <div class="ctv:flex ctv:items-center ctv:gap-1.5">
            <span class="ctv:truncate ctv:font-semibold">{{ p.label }}</span>
            <span v-if="p.origin === 0" class="ctv:py-0 ctv:px-1 ctv:rounded ctv:text-3xs ctv:bg-base-foreground/10 ctv:text-muted-foreground">
              {{ $t('stageParams.sidebar.system') }}
            </span>
          </div>
          <div class="ctv:text-3xs ctv:text-muted-foreground ctv:font-mono ctv:truncate">
            option:{{ p.key }} · {{ p.type }}<template v-if="p.default != null"> · = {{ p.default }}</template>
          </div>
        </div>
        <button
          v-if="p.origin !== 0"
          :class="deleteBtn"
          :title="$t('stageParams.sidebar.delete')"
          @click="onDelete(p)"
        ><i class="pi pi-times" /></button>
      </div>
      </div>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useStorage } from '@vueuse/core'

import ComfyTVNumber from '@/components/widgets/ComfyTVNumber.vue'
import ComfyTVText from '@/components/widgets/ComfyTVText.vue'
import ComfyTVToggle from '@/components/widgets/ComfyTVToggle.vue'
import ComfyTVSelect from '@/components/widgets/ComfyTVSelect.vue'
import StageWorkflowList from '@/components/sidebar/StageWorkflowList.vue'
import {
  useStageKindSelection,
  useStageParamForm,
} from '@/composables/sidebar/useStageParamForm'

defineProps<{ active?: boolean }>()

const { kindOptions, activeKind, onKinds } = useStageKindSelection()

const wfCollapsed     = useStorage('comfytv:sidebar:stage-workflows-collapsed', false)
const paramsCollapsed = useStorage('comfytv:sidebar:stage-params-collapsed', false)

const {
  rows,
  form,
  error,
  typeOptions,
  comboDefaultOptions,
  onCreate,
  onDelete,
} = useStageParamForm(activeKind)

const sectionToggle = 'ctv:flex ctv:items-center ctv:gap-1.5 ctv:w-full ctv:py-1 ctv:px-0 ctv:cursor-pointer ctv:[font-family:inherit]'
  + ' ctv:bg-transparent ctv:border-none ctv:text-inherit ctv:text-2xs ctv:uppercase ctv:tracking-wide ctv:font-semibold ctv:text-muted-foreground'
  + ' ctv:hover:text-base-foreground'
const fieldRow = 'ctv:flex ctv:flex-col ctv:gap-0.5'
const fieldLabel = 'ctv:text-3xs ctv:uppercase ctv:tracking-wide ctv:opacity-55'
const primaryBtn = 'ctv:inline-flex ctv:items-center ctv:h-6 ctv:px-2.5 ctv:rounded-sm ctv:text-xs ctv:font-medium ctv:cursor-pointer'
  + ' ctv:border-none ctv:bg-primary-background ctv:text-base-foreground ctv:hover:bg-primary-background-hover'
const deleteBtn = 'ctv:shrink-0 ctv:flex ctv:items-center ctv:justify-center ctv:size-5 ctv:rounded-full ctv:cursor-pointer ctv:text-xs'
  + ' ctv:border-none ctv:bg-transparent ctv:text-destructive-background ctv:hover:bg-destructive-background/10'
</script>
