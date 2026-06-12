import type {
  ExposedWidget,
} from './workflowConfigCatalog'

export function useBindingWriter(
  postBinding: (payload: Record<string, unknown>) => Promise<void>,
  deleteBinding: (nodeId: string, widgetName: string) => Promise<void>,
) {
  function isStageBound(w: ExposedWidget): boolean {
    if (!w.stage_binding) return false
    if (w.stage_binding.startsWith('literal:')) return false
    return true
  }

  function dropdownValueFor(w: ExposedWidget): string {
    if (!w.stage_binding) return '__VALUE__'
    if (w.stage_binding.startsWith('literal:')) return '__VALUE__'
    return w.stage_binding
  }

  function coerceForWidget(w: ExposedWidget, raw: any): any {
    if (w.widget_type === 'INT' || w.widget_type === 'FLOAT') {
      const n = Number(raw)
      return Number.isFinite(n) ? n : w.current_value
    }
    if (w.widget_type === 'BOOLEAN') {
      if (typeof raw === 'boolean') return raw
      const s = String(raw).toLowerCase()
      return s === 'true' || s === '1' || s === 'on' || s === 'yes'
    }
    return raw
  }

  function effectiveValue(w: ExposedWidget): any {
    if (typeof w.stage_binding === 'string' && w.stage_binding.startsWith('literal:')) {
      const lit = w.stage_binding.slice('literal:'.length)
      if (lit !== '') return coerceForWidget(w, lit)
    }
    if (w.override_value !== null && w.override_value !== undefined && w.override_value !== '') {
      return coerceForWidget(w, w.override_value)
    }
    return w.current_value
  }

  function comboOptions(w: ExposedWidget): string[] {
    if (w.widget_type !== 'COMBO') return []
    const vals = w.widget_props?.values
    return Array.isArray(vals) ? vals.map((x: any) => String(x)) : []
  }

  function numProp(w: ExposedWidget, key: string): number | undefined {
    const v = w.widget_props?.[key]
    return typeof v === 'number' ? v : undefined
  }

  function inferCast(widgetType: string): string | null {
    switch (widgetType) {
      case 'INT':     return 'int'
      case 'FLOAT':   return 'float'
      case 'BOOLEAN': return 'bool'
      default:        return null
    }
  }

  async function onValueChange(w: ExposedWidget, newVal: any) {
    if (isStageBound(w)) return

    const isCleared =
      newVal === null || newVal === undefined ||
      (typeof newVal === 'string' && newVal === '')
    if (isCleared) {
      w.override_value = null
      w.stage_binding  = null
      await deleteBinding(w.node_id, w.widget_name)
      return
    }

    w.override_value = String(newVal)
    w.stage_binding  = `literal:${w.override_value}`
    w.cast           = inferCast(w.widget_type)

    await postBinding({
      node_id:    w.node_id,
      input_name: w.widget_name,
      from:       w.stage_binding,
      default:    w.override_value,
      cast:       w.cast,
      required:   false,
    })
  }

  async function onBindingChange(w: ExposedWidget, newBinding: string) {
    if (newBinding === '__VALUE__') {
      if (w.stage_binding) {
        await deleteBinding(w.node_id, w.widget_name)
      }
      w.stage_binding  = null
      w.override_value = null
      return
    }
    let cast: string | null = null
    let defaultValue: string | null = null
    if (newBinding === 'option:seed') {
      cast = 'int'
      defaultValue = 'random_int31'
    } else if (newBinding === 'option:batch_size' ||
               newBinding === 'computed:width' ||
               newBinding === 'computed:height' ||
               newBinding === 'computed:length') {
      cast = 'int'
    }
    const isUpstream = newBinding.startsWith('upstream_')
    w.stage_binding  = newBinding
    w.override_value = defaultValue
    w.cast           = cast

    await postBinding({
      node_id:    w.node_id,
      input_name: w.widget_name,
      from:       newBinding,
      default:    defaultValue,
      cast:       cast,
      required:   isUpstream,
    })
  }

  return {
    isStageBound,
    dropdownValueFor,
    coerceForWidget,
    effectiveValue,
    comboOptions,
    numProp,
    inferCast,
    onValueChange,
    onBindingChange,
  }
}
