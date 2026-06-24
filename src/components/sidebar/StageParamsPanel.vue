<template>
  <div class="ctv:flex ctv:flex-col ctv:size-full ctv:overflow-hidden ctv:text-xs ctv:text-base-foreground">
    <div class="ctv:shrink-0 ctv:flex ctv:items-center ctv:gap-2 ctv:py-1.5 ctv:px-2.5
                ctv:bg-interface-panel-surface ctv:border-b ctv:border-border-subtle">
      <span class="ctv:flex-1 ctv:font-semibold ctv:text-sm">{{ $t('stageParams.sidebar.title') }}</span>
      <div class="ctv:w-28">
        <ComfyTVSelect :model-value="activeKind" :options="kindOptions" @update:model-value="activeKind = String($event)" />
      </div>
    </div>

    <div class="ctv:flex-1 ctv:min-h-0 ctv:overflow-y-auto ctv:p-2.5 ctv:flex ctv:flex-col ctv:gap-2.5">
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
        >✕</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import ComfyTVNumber from '@/components/widgets/ComfyTVNumber.vue'
import ComfyTVText from '@/components/widgets/ComfyTVText.vue'
import ComfyTVToggle from '@/components/widgets/ComfyTVToggle.vue'
import ComfyTVSelect from '@/components/widgets/ComfyTVSelect.vue'
import { askConfirm } from '@/composables/dialog/useConfirmDialog'
import { STAGE_PARAM_TYPES, type StageParam } from '@/api/schemas'
import { useStageParamStore } from '@/stores/stageParamStore'

defineProps<{ active?: boolean }>()

const { t } = useI18n()
const store = useStageParamStore()

const STAGE_PARAM_KINDS = [
  'text', 'image', 'video', 'audio', 'panorama',
  'multiangle', 'relight', 'multiview',
  'upscale', 'outpaint', 'inpaint', 'image-edit', 'erase', 'cutout',
] as const
const kindOptions = STAGE_PARAM_KINDS.map(k => ({ value: k, label: k }))
const activeKind = ref<string>(STAGE_PARAM_KINDS[0])

const typeOptions = STAGE_PARAM_TYPES.map(tp => ({ value: tp, label: tp }))

const rows = computed<StageParam[]>(() => store.forKind(activeKind.value))

const form = reactive({
  label: '',
  type: 'float' as string,
  default: '',
  numDefault: 0 as number | null,
  boolDefault: false,
  options: '',
  min: null as number | null,
  max: null as number | null,
  step: null as number | null,
  placeholder: '',
})
const error = ref('')

const comboOptionsList = computed(() =>
  form.options.split(',').map(s => s.trim()).filter(Boolean),
)
const comboDefaultOptions = computed(() => comboOptionsList.value)

function resetForm() {
  form.label = ''
  form.default = ''
  form.numDefault = 0
  form.boolDefault = false
  form.options = ''
  form.min = null
  form.max = null
  form.step = null
  form.placeholder = ''
}

watch(() => form.type, () => { error.value = '' })

function buildConfig(): Record<string, unknown> {
  const cfg: Record<string, unknown> = {}
  if (form.type === 'combo') {
    cfg.options = comboOptionsList.value
  } else if (form.type === 'int' || form.type === 'float') {
    if (form.min != null) cfg.min = form.min
    if (form.max != null) cfg.max = form.max
    if (form.step != null) cfg.step = form.step
  } else if (form.type === 'string') {
    if (form.placeholder) cfg.placeholder = form.placeholder
  }
  return cfg
}

function buildDefault(): unknown {
  switch (form.type) {
    case 'boolean': return form.boolDefault
    case 'int':     return form.numDefault != null ? Math.trunc(form.numDefault) : null
    case 'float':   return form.numDefault
    case 'combo':   return form.default || comboOptionsList.value[0] || ''
    default:        return form.default
  }
}

async function onCreate() {
  if (!form.label.trim()) {
    error.value = t('stageParams.sidebar.labelRequired')
    return
  }
  error.value = ''
  const created = await store.create({
    kind: activeKind.value,
    label: form.label.trim(),
    type: form.type,
    default: buildDefault(),
    config: buildConfig(),
  })
  if (created) resetForm()
}

async function onDelete(p: StageParam) {
  const ok = await askConfirm({
    title: t('stageParams.sidebar.delete'),
    message: t('stageParams.sidebar.deleteConfirm'),
    danger: true,
  })
  if (ok) void store.remove(p.id)
}

store.ensureHydrated()
store.installWebSocketSync()

const fieldRow = 'ctv:flex ctv:flex-col ctv:gap-0.5'
const fieldLabel = 'ctv:text-3xs ctv:uppercase ctv:tracking-wide ctv:opacity-55'
const primaryBtn = 'ctv:inline-flex ctv:items-center ctv:h-6 ctv:px-2.5 ctv:rounded-sm ctv:text-xs ctv:font-medium ctv:cursor-pointer'
  + ' ctv:border-none ctv:bg-primary-background ctv:text-base-foreground ctv:hover:bg-primary-background-hover'
const deleteBtn = 'ctv:shrink-0 ctv:flex ctv:items-center ctv:justify-center ctv:size-5 ctv:rounded-full ctv:cursor-pointer ctv:text-xs'
  + ' ctv:border-none ctv:bg-transparent ctv:text-destructive-background ctv:hover:bg-destructive-background/10'
</script>
