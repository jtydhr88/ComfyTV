import { importWorkflow } from '@/api'
import { addOptionEverywhere } from '@/composables/stages/workflowCombo'
import { openLinkWorkflow } from '@/composables/stages/openLinkWorkflow'
import { app } from '@/lib/comfyApp'
import { i18n } from '@/i18n'

function toast(severity: string, summary: string, detail = '') {
  ;(app as any)?.extensionManager?.toast?.add?.({ severity, summary, detail, life: 5000 })
}

async function doUpload(node: any, wfWidget: any, kind: string) {
  const t = i18n.global.t
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = '.json,application/json'
  input.style.display = 'none'
  input.onchange = async () => {
    const file = input.files?.[0]
    input.remove()
    if (!file) return
    try {
      const text = await file.text()
      try { JSON.parse(text) } catch {
        toast('warn', t('workflow.importFailed'), t('workflow.notJson'))
        return
      }
      const res = await importWorkflow(kind, file.name, text)
      addOptionEverywhere(kind, res.label)
      wfWidget.value = res.label
      wfWidget.callback?.(res.label)
      ;(app as any)?.graph?.setDirtyCanvas?.(true, true)
      toast('success', t('workflow.imported', { label: res.label }))
    } catch (e: any) {
      toast('error', t('workflow.importFailed'), String(e?.message || e))
    }
  }
  document.body.appendChild(input)
  input.click()
}

export function addWorkflowUploadButton(node: any, wfWidget: any, kind: string): void {
  if (!node?.addWidget || !wfWidget) return
  if (node.widgets?.some((w: any) => w.__comfytvUpload)) return

  const btn = node.addWidget(
    'button',
    i18n.global.t('workflow.uploadButton'),
    null,
    () => { void doUpload(node, wfWidget, kind) },
  )
  btn.__comfytvUpload = true
  btn.serialize = false

  const linkBtn = node.addWidget(
    'button',
    i18n.global.t('workflow.linkButton'),
    null,
    () => {
      openLinkWorkflow(kind, {
        onLinked: ({ label }) => {
          addOptionEverywhere(kind, label)
          wfWidget.value = label
          wfWidget.callback?.(label)
          ;(app as any)?.graph?.setDirtyCanvas?.(true, true)
        },
      })
    },
  )
  linkBtn.__comfytvLink = true
  linkBtn.serialize = false

  const widgets = node.widgets
  if (Array.isArray(widgets)) {
    const wi = widgets.indexOf(wfWidget)
    const bi = widgets.indexOf(btn)
    if (bi > -1 && wi > -1 && bi !== wi + 1) {
      widgets.splice(bi, 1)
      widgets.splice(wi + 1, 0, btn)
    }
    const li = widgets.indexOf(linkBtn)
    const bi2 = widgets.indexOf(btn)
    if (li > -1 && bi2 > -1 && li !== bi2 + 1) {
      widgets.splice(li, 1)
      widgets.splice(bi2 + 1, 0, linkBtn)
    }
  }

  if (!node.__comfytvCompactWidgets) {
    node.__comfytvCompactWidgets = true
    const prevOnSerialize = node.onSerialize
    node.onSerialize = function (this: any, o: any) {
      prevOnSerialize?.call(this, o)
      if (Array.isArray(o?.widgets_values)) {
        o.widgets_values = o.widgets_values.filter(() => true)
      }
    }
  }
}
