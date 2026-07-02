const KIND_TO_OUTPUT_TYPE: Record<string, string> = {
  'image-batch': 'images',
  'image-picker': 'image',
  'audio-picker': 'audio',
}

export function outputTypeForKind(kind: string): string {
  return KIND_TO_OUTPUT_TYPE[kind] ?? kind
}
