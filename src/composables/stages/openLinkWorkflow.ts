import { markRaw } from 'vue'

import LinkWorkflowDialog from '@/components/dialog/LinkWorkflowDialog.vue'
import { i18n } from '@/i18n'
import { useDialogStore } from '@/stores/dialogStore'

export interface OpenLinkWorkflowOpts {
  onLinked?: (result: { label: string }) => void
}

export function openLinkWorkflow(kind: string, opts: OpenLinkWorkflowOpts = {}): void {
  const t = i18n.global.t
  const dialog = useDialogStore()
  dialog.show({
    title: t('workflowLink.title'),
    width: '560px',
    component: markRaw(LinkWorkflowDialog),
    props: {
      kind,
      onLinked: opts.onLinked ?? (() => {}),
      onClose: () => dialog.close(),
    },
  })
}
