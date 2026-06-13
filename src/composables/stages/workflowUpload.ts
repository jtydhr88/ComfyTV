import { importWorkflow } from '@/api'
import { getStageMeta } from '@/composables/stages/stageMeta'
import { app } from '@/lib/comfyApp'
import { i18n } from '@/i18n'

function toast(severity: string, summary: string, detail = '') {
  ;(app as any)?.extensionManager?.toast?.add?.({ severity, summary, detail, life: 5000 })
}

function addOptionEverywhere(kind: string, label: string) {
  const nodes = (app as any)?.graph?._nodes ?? []
  for (const n of nodes) {
    if (getStageMeta(n?.comfyClass)?.workflow_kind !== kind) continue
    const vals = n.widgets?.find((w: any) => w.name === 'workflow')?.options?.values
    if (Array.isArray(vals) && !vals.includes(label)) vals.push(label)
  }
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

  const widgets = node.widgets
  if (Array.isArray(widgets)) {
    const bi = widgets.indexOf(btn)
    const wi = widgets.indexOf(wfWidget)
    if (bi > -1 && wi > -1 && bi !== wi + 1) {
      widgets.splice(bi, 1)
      widgets.splice(wi + 1, 0, btn)
    }
  }
}
