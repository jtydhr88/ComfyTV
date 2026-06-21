import { markRaw } from 'vue'

import ConfirmDialog from '@/components/dialog/ConfirmDialog.vue'
import { useDialogStore } from '@/stores/dialogStore'

export interface AskConfirmOpts {
  title: string
  message: string
  confirmText?: string
  cancelText?: string
  danger?: boolean
  width?: string
}

export function askConfirm(opts: AskConfirmOpts): Promise<boolean> {
  const dialog = useDialogStore()
  return new Promise((resolve) => {
    let settled = false
    const done = (value: boolean) => {
      if (settled) return
      settled = true
      resolve(value)
      dialog.close()
    }
    dialog.show({
      title: opts.title,
      width: opts.width ?? '420px',
      component: markRaw(ConfirmDialog),
      props: {
        message: opts.message,
        confirmText: opts.confirmText,
        cancelText: opts.cancelText,
        danger: opts.danger,
        onResolve: done,
      },
    })
  })
}
