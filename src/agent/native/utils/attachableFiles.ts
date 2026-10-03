import type { MediaType } from '@agent/utils/formatUtil'
import { getMediaTypeFromFilename } from '@agent/utils/formatUtil'

export interface AttachmentCapability {
  attachments?: boolean
  attachment_transport?: string
  attachment_media_types?: string[]
  attachment_mixed_context?: boolean
}

export function attachmentPolicy(cap: AttachmentCapability) {
  const references = cap.attachment_transport === 'asset_refs'
  const enabled = cap.attachments !== false
  const mixedContext = references && cap.attachments === true && cap.attachment_mixed_context === true
  // Copy the advertised list; an existing policy must not follow later mutations.
  // Older reference servers omitted the list and supported images only.
  const mediaTypes = ['image', 'video', 'audio'].filter(kind =>
    (cap.attachment_media_types ?? ['image']).includes(kind))
  return {
    references,
    enabled,
    mixedContext,
    // Unknown deferred/Eagle media must first be imported via the library.
    allowsDeferred: enabled && !references,
    accept: references ? mediaTypes.map(kind => `${kind}/*`).join(',') : AGENT_ATTACH_ACCEPT,
    label: references
      ? enabled ? mediaTypes.some(kind => kind !== 'image')
        ? `Media references · not inspected. Inspect metadata, video frames/timeline and audio waveform on demand; waveform is not hearing or transcription. Documents unsupported. ${mixedContext
          ? 'Workflow drafts, root-level node selections, saved references and preferences are captured, not applied. Nested selections are currently unsupported and rejected. ComfyTV skills and request preference overrides remain unsupported.'
          : 'Combining media with selection, skills, workflow context or saved preferences is unsupported and will be rejected. Send without media to keep that context, or use a separate chat without it.'} Nothing is automatically cleared. Deferred Eagle imports remain unsupported.`
        : mixedContext
        ? 'Image references · not inspected. Workflow drafts, root-level node selections, saved references and preferences are captured, not applied. Nested selections are currently unsupported and rejected. Unsupported or ambiguous context is rejected; nothing is automatically unlinked. ComfyTV skills, request preference overrides, video/audio/documents and deferred Eagle imports remain unsupported.'
        : 'Image references only · not inspected. Video/audio/documents unsupported. Combining images with selection, skills, workflow context or saved preferences is unsupported and will be rejected. Send without images to keep that context, or use a separate chat without it. Nothing is automatically cleared.'
        : 'Image references disabled pending cache and vision acceptance.'
      : enabled ? '' : 'Attachments unsupported by this provider.',
    allows: (kind: string) => enabled && (!references || mediaTypes.includes(kind))
  }
}

const MEDIA_ATTACHABLE_KINDS = new Set<MediaType>(['image', 'video', 'audio'])

/* Non-media formats approved for agent attach (Jo, FE-1323); extended as the
   backend grows support. json is deliberately left out here: the panel's
   drop handler claims a raw File drop only when isAgentAttachable approves
   it, and a bare-dropped workflow .json must stay unclaimed so the graph
   loader (which only runs on an unclaimed drop) can still open it. */
const EXTRA_ATTACHABLE_EXTENSIONS = new Set(['glb', 'md', 'txt'])

/* The OS picker cannot express "any audio plus these extensions" through MIME
   alone (glb and md have no reliable browser MIME), so the accept list names
   the extensions explicitly alongside the media wildcards. */
export const AGENT_ATTACH_ACCEPT =
  'image/*,video/*,audio/*,.mp4,.m4a,.mov,.mp3,.wav,.glb,.md,.txt,.json,application/json'

/**
 * Judged by file NAME, not MIME type: dragged glb/md/txt files carry an empty
 * or generic MIME, and the reply pipeline classifies by extension already.
 *
 * .json is intentionally excluded even though it is in AGENT_ATTACH_ACCEPT:
 * this only gates the OS file-picker's visible filter, letting a user select
 * a .json through the picker. A raw drag-and-drop of a .json file must still
 * fall through to the graph loader, which treats it as a workflow to open.
 */
export function isAgentAttachable(file: File): boolean {
  if (MEDIA_ATTACHABLE_KINDS.has(getMediaTypeFromFilename(file.name)))
    return true
  const extension = file.name.split('.').pop()?.toLowerCase() ?? ''
  return EXTRA_ATTACHABLE_EXTENSIONS.has(extension)
}
