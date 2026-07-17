import { computed, reactive, ref, watch, type Ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useStorage } from '@vueuse/core'

import { STAGE_PARAM_TYPES, type StageParam } from '@/api/schemas'
import { askConfirm } from '@/composables/dialog/useConfirmDialog'
import { useStageParamStore } from '@/stores/stageParamStore'

export const FALLBACK_STAGE_KINDS = [
  'text', 'image', 'video', 'audio', 'speech', 'panorama',
  'multiangle', 'multiview',
  'upscale', 'outpaint', 'inpaint', 'image-edit', 'erase', 'cutout',
]

export function useStageKindSelection() {
  const backendKinds = ref<string[]>([])
  const kindOptions = computed(() =>
    (backendKinds.value.length ? backendKinds.value : FALLBACK_STAGE_KINDS)
      .map(k => ({ value: k, label: k })),
  )
  const activeKind = useStorage<string>('comfytv:sidebar:stage-kind', FALLBACK_STAGE_KINDS[0]!)

  function onKinds(kinds: string[]) {
    backendKinds.value = kinds
  }

  return { kindOptions, activeKind, onKinds }
}

export function useStageParamForm(activeKind: Ref<string>) {
  const { t } = useI18n()
  const store = useStageParamStore()

  store.ensureHydrated()
  store.installWebSocketSync()

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

  return {
    rows,
    form,
    error,
    typeOptions,
    comboDefaultOptions,
    onCreate,
    onDelete,
  }
}
