import { ref } from 'vue'

export type FileKind = 'image' | 'video'

export function fileTypeMatchesKind(type: string, kind: FileKind): boolean {
  return kind === 'image' ? type.startsWith('image/') : type.startsWith('video/')
}

export function hasMatchingItem(
  items: Iterable<DataTransferItem> | null | undefined,
  kind: FileKind,
): boolean {
  if (!items) return false
  return Array.from(items).some(it => it.kind === 'file' && fileTypeMatchesKind(it.type, kind))
}

export function pickMatchingFile(
  files: Iterable<File> | null | undefined,
  kind: FileKind,
): File | null {
  if (!files) return null
  return Array.from(files).find(f => fileTypeMatchesKind(f.type, kind)) ?? null
}

export function useFileDrop(getKind: () => FileKind, onFile: (file: File) => void) {
  const isDragOver = ref(false)
  let dragCounter = 0

  function onDragEnter(ev: DragEvent) {
    if (!hasMatchingItem(ev.dataTransfer?.items, getKind())) return
    dragCounter++
    isDragOver.value = true
  }

  function onDragOver(ev: DragEvent) {
    if (ev.dataTransfer) ev.dataTransfer.dropEffect = 'copy'
  }

  function onDragLeave() {
    dragCounter = Math.max(0, dragCounter - 1)
    if (dragCounter === 0) isDragOver.value = false
  }

  function onDrop(ev: DragEvent) {
    dragCounter = 0
    isDragOver.value = false
    const file = pickMatchingFile(ev.dataTransfer?.files, getKind())
    if (file) onFile(file)
  }

  return { isDragOver, onDragEnter, onDragOver, onDragLeave, onDrop }
}
