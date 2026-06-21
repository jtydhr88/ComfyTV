import { markRaw } from 'vue'

import TextInputDialog from '@/components/dialog/TextInputDialog.vue'
import { useDialogStore } from '@/stores/dialogStore'

export interface AskTextOpts {
  title: string
  label?: string
  initialValue?: string
  placeholder?: string
  confirmText?: string
  cancelText?: string
  width?: string
}

export function askText(opts: AskTextOpts): Promise<string | null> {
  const dialog = useDialogStore()
  return new Promise((resolve) => {
    let settled = false
    const done = (value: string | null) => {
      if (settled) return
      settled = true
      resolve(value)
      dialog.close()
    }
    dialog.show({
      title: opts.title,
      width: opts.width ?? '420px',
      component: markRaw(TextInputDialog),
      props: {
        label: opts.label,
        initialValue: opts.initialValue,
        placeholder: opts.placeholder,
        confirmText: opts.confirmText,
        cancelText: opts.cancelText,
        onResolve: done,
      },
    })
  })
}
