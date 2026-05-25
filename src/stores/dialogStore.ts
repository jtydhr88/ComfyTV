import { defineStore } from 'pinia'
import { ref, shallowRef, type Component } from 'vue'

export interface DialogOpenOpts {
  title: string
  component: Component
  props?: Record<string, unknown>
  width?: string
}

export const useDialogStore = defineStore('comfytv-dialog', () => {
  const open = ref(false)
  const title = ref('')
  const component = shallowRef<Component | null>(null)
  const props = ref<Record<string, unknown>>({})
  const width = ref('720px')

  function show(opts: DialogOpenOpts) {
    title.value = opts.title
    component.value = opts.component
    props.value = opts.props ?? {}
    width.value = opts.width ?? '720px'
    open.value = true
  }

  function close() {
    open.value = false
    setTimeout(() => {
      component.value = null
      props.value = {}
      title.value = ''
    }, 180)
  }

  return { open, title, component, props, width, show, close }
})
