import { isPsdMedia, PSD_MIME, type PentradoMediaInput } from '../../host'
import { DEFAULT_FONT_REF } from '../../fontStore'
import { groupKind, type FontRef } from '../../engine'
import { buildPsdFromEditor } from '../../psdExport'
import { bufferedContentRegistry, decodePngBytes, psdToNodes } from '../../psdImport'
import { MAX_CONTENT_DIM, type StageCtx } from './stageContext'

export function createStagePsd(ctx: StageCtx) {
  const { editor, content, host, fontStore, glOk, exportingPsd, importingPsd, t, toastError, toastInfo } = ctx

  function fontDisplayName(ref: FontRef): string | undefined {
    if (ref.kind === 'builtin') return fontStore.builtins().find((b) => b.id === ref.id)?.name ?? ref.id
    return ref.name
  }
  function matchFontByName(name: string | undefined): FontRef {
    if (!name) return DEFAULT_FONT_REF
    const normalize = (v: string): string => v.toLowerCase().replace(/[^a-z0-9]/g, '')
    const target = normalize(name)
    if (!target) return DEFAULT_FONT_REF
    const hit = fontStore.builtins().find((b) => {
      const n = normalize(b.name)
      const id = normalize(b.id)
      return n === target || id === target || (n.length >= 4 && (target.includes(n) || n.includes(target)))
    })
    return hit ? { kind: 'builtin', id: hit.id } : DEFAULT_FONT_REF
  }
  async function buildPsdForExport(): Promise<import('ag-psd').Psd> {
    if (editor.floating()) editor.anchorFloating()
    const gs = editor.guides()
    return buildPsdFromEditor(
      { document: () => editor.document(), render: () => editor.render(), readbackCanvas: ctx.readbackCanvas },
      content,
      {
        fontName: (n) => fontDisplayName(n.fontRef),
        guides: {
          horizontal: gs.filter((g) => g.axis === 'y').map((g) => g.pos),
          vertical: gs.filter((g) => g.axis === 'x').map((g) => g.pos),
        },
      }
    )
  }
  async function writePsdBlob(): Promise<Blob> {
    const psd = await buildPsdForExport()
    const { writePsd } = await import('ag-psd')
    return new Blob([writePsd(psd)], { type: PSD_MIME })
  }
  async function exportPsd(): Promise<void> {
    if (!glOk.value || exportingPsd.value) return
    exportingPsd.value = true
    try {
      host.download(`pentrado-layers-${Date.now()}.psd`, await writePsdBlob())
    } catch (e) {
      console.warn('[pentrado] PSD export failed', e)
      toastError(t('pentrado.exportPsdFailed'))
    } finally {
      exportingPsd.value = false
      ctx.requestRender()
    }
  }
  const canExportToLibrary = host.saveToLibrary != null
  async function exportPsdToLibrary(): Promise<void> {
    if (!glOk.value || exportingPsd.value || !host.saveToLibrary) return
    exportingPsd.value = true
    try {
      const doc = editor.document()
      const blob = await writePsdBlob()
      await host.saveToLibrary({
        blob,
        filename: `pentrado-layers-${Date.now()}.psd`,
        mime: PSD_MIME,
        width: doc.width,
        height: doc.height,
        preview: ctx.flattenComposite(),
      })
      toastInfo(t('pentrado.exportPsdAssetDone'))
    } catch (e) {
      console.warn('[pentrado] PSD asset export failed', e)
      toastError(t('pentrado.exportPsdFailed'))
    } finally {
      exportingPsd.value = false
      ctx.requestRender()
    }
  }
  async function importPsdBuffer(buffer: ArrayBuffer, sourceName: string): Promise<void> {
    const { readPsd } = await import('ag-psd')
    const psd = readPsd(buffer, { skipThumbnail: true })
    const registry = bufferedContentRegistry()
    const result = await psdToNodes(psd, {
      registerContent: registry.registerContent,
      matchFont: matchFontByName,
      decodePng: decodePngBytes,
    })
    if (!result.nodes.length) {
      toastError(t('pentrado.importPsdEmpty'))
      return
    }
    if (editor.document().root.children.length === 0) {
      ctx.setArtboardSize(
        Math.min(result.width, MAX_CONTENT_DIM),
        Math.min(result.height, MAX_CONTENT_DIM)
      )
      for (const node of result.nodes) editor.addNode(node)
    } else {
      editor.addNode(groupKind.create({
        name: sourceName.replace(/\.(psd|psb)$/i, ''),
        children: result.nodes,
        passThrough: false,
      }))
    }
    registry.commit((canvas, id) => content.register(canvas, { id }))
    if (result.guides.length && editor.guides().length === 0) {
      const size = editor.document()
      for (const g of result.guides) {
        const max = g.axis === 'x' ? size.width : size.height
        if (g.pos >= 0 && g.pos <= max) editor.guideAddLive(g.axis, g.pos)
      }
    }
    editor.invalidate()
    if (result.warnings.length) {
      console.warn('[pentrado] PSD import warnings', result.warnings)
    }
  }
  async function runPsdImport(load: () => Promise<{ buffer: ArrayBuffer; name: string }>): Promise<void> {
    if (importingPsd.value) return
    importingPsd.value = true
    try {
      const { buffer, name } = await load()
      await importPsdBuffer(buffer, name)
    } catch (e) {
      console.warn('[pentrado] PSD import failed', e)
      toastError(t('pentrado.importPsdFailed'))
    } finally {
      importingPsd.value = false
      ctx.requestRender()
    }
  }
  function importPsdFile(file: File): Promise<void> {
    return runPsdImport(async () => ({ buffer: await file.arrayBuffer(), name: file.name }))
  }
  function importPsdFromUrl(url: string, name: string): Promise<void> {
    return runPsdImport(async () => {
      const resp = await fetch(url)
      if (!resp.ok) throw new Error(`psd fetch ${resp.status}`)
      return { buffer: await resp.arrayBuffer(), name }
    })
  }
  function addMedia(media: PentradoMediaInput): Promise<void> {
    if (isPsdMedia(media)) return importPsdFromUrl(media.url, media.name || 'PSD')
    return ctx.addImageFromUrl(media.url, media.name || 'Image')
  }
  return { exportPsd, canExportToLibrary, exportPsdToLibrary, importPsdFile, importPsdFromUrl, addMedia }
}
