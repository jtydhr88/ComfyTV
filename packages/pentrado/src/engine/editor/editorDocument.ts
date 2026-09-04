import type { Document } from '../document'
import type { GroupData } from '../node'
import { getNodeKind } from '../nodeKind'
import type { EditorCore } from './editorCore'
import type { Editor, EditorEnv } from './editorTypes'
import { sanitizeGuides } from './guideOps'

export function createEditorDocument(env: EditorEnv, core: EditorCore): Pick<Editor, 'loadDocument' | 'serialize' | 'loadJSON' | 'hydrate'> {
  const { st, content, history } = env
  const { refresh } = core
  return {
    loadDocument(d) {
      st.doc = d
      st.selectedIds = []
      st.floating = null
      st.floatSession = { mode: 'idle' }
      history.clear()
      refresh()
    },
    serialize() {
      return {
        version: st.doc.version,
        width: st.doc.width,
        height: st.doc.height,
        root: getNodeKind(st.doc.root.kind).serialize(st.doc.root),
        channels: st.doc.channels,
        selectionId: st.doc.selectionId,
        guides: st.doc.guides?.length ? st.doc.guides.map((g) => ({ ...g })) : undefined,
        floating: st.floating
          ? {
              contentId: st.floating.contentId,
              url: content.get(st.floating.contentId)?.uploadedUrl ?? undefined,
              transform: { ...st.floating.transform },
              name: st.floating.name,
            }
          : undefined,
      }
    },
    loadJSON(raw) {
      let obj: unknown
      try {
        obj = typeof raw === 'string' ? JSON.parse(raw) : raw
      } catch {
        return
      }
      if (!obj || typeof obj !== 'object') return
      const o = obj as Record<string, unknown>
      const rootRaw = (o.root as unknown) ?? obj
      const root = getNodeKind('group').normalize(rootRaw) as GroupData
      const w = Number(o.width) || st.doc.width
      const h = Number(o.height) || st.doc.height
      const loadedGuides = sanitizeGuides(o.guides, w, h)
      st.doc = {
        version: 2,
        width: w,
        height: h,
        root,
        channels: Array.isArray(o.channels) ? (o.channels as Document['channels']) : [],
        selectionId: typeof o.selectionId === 'string' ? o.selectionId : undefined,
        guides: loadedGuides.length ? loadedGuides : undefined,
      }
      st.selectedIds = []
      st.floating = null
      st.floatSession = { mode: 'idle' }
      const rawFloat = o.floating as { contentId?: unknown; url?: unknown; transform?: unknown; name?: unknown } | undefined
      if (rawFloat && typeof rawFloat.contentId === 'string' && rawFloat.transform && typeof rawFloat.transform === 'object') {
        const t = rawFloat.transform as Record<string, unknown>
        const num = (v: unknown, d: number): number => (typeof v === 'number' && isFinite(v) ? v : d)
        st.floating = {
          contentId: rawFloat.contentId,
          url: typeof rawFloat.url === 'string' ? rawFloat.url : undefined,
          name: typeof rawFloat.name === 'string' ? rawFloat.name : undefined,
          transform: { x: num(t.x, 0), y: num(t.y, 0), w: num(t.w, 1), h: num(t.h, 1), rotation: num(t.rotation, 0) },
        }
      }
      history.clear()
      refresh()
    },
    async hydrate(loadUrl) {
      await getNodeKind(st.doc.root.kind).hydrate(st.doc.root, { content, loadUrl })
      if (st.floating && st.floating.url && !content.has(st.floating.contentId)) {
        try {
          const canvas = await loadUrl(st.floating.url)
          content.register(canvas, { id: st.floating.contentId, uploadedUrl: st.floating.url })
        } catch {
          void 0
        }
      }
      for (const ch of st.doc.channels) {
        if (ch.url && !content.has(ch.contentId)) {
          try {
            const canvas = await loadUrl(ch.url)
            content.register(canvas, { id: ch.contentId, uploadedUrl: ch.url, transient: true })
          } catch {
            void 0
          }
        }
      }
      refresh()
    },
  }
}
