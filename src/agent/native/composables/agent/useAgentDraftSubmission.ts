import { watch } from 'vue'

import type { ComfyWorkflow } from '@agent/platform/workflow/management/stores/comfyWorkflow'

import { useAgentComposerStore } from '../../stores/agent/agentComposerStore'
import type { WorkflowReference } from '../../types/workflowReference'
import type { SelectedNode, useCanvasSelection } from './useCanvasSelection'
import { selectedNodeKey } from './useCanvasSelection'
import type { ComposerAttachment } from './useComposer'

interface UseAgentDraftSubmissionOptions {
  canSubmit: () => boolean
  captureMixedContext?: () => boolean
  target: () => ComfyWorkflow | null
  editableWorkflowId: () => string | undefined
  selection: Pick<
    ReturnType<typeof useCanvasSelection>,
    'staged' | 'consume' | 'replace'
  > & {
    workflow: () => ComfyWorkflow | null
    exit: () => void
  }
  send: (
    text: string,
    attachments: ComposerAttachment[],
    nodes: SelectedNode[],
    references: WorkflowReference[]
  ) => Promise<boolean>
  stop: () => Promise<void>
}

export function useAgentDraftSubmission(
  options: UseAgentDraftSubmissionOptions
) {
  const composer = useAgentComposerStore()
  const { selection } = options

  function recoverFailedSubmission(): void {
    const snapshot = composer.takeFailedSubmission()
    if (!snapshot || selection.staged.value.length > 0) return

    composer.restorePrompt({
      text: snapshot.prompt.text,
      references: snapshot.prompt.references.filter((reference) => {
        if (reference.kind === 'workflow')
          return reference.id !== options.editableWorkflowId()
        if (reference.kind === 'node')
          return (
            options.target() === snapshot.target &&
            snapshot.nodes.some(
              (node) =>
                selectedNodeKey(node) === selectedNodeKey(reference.node)
            )
          )
        return true
      })
    })
    if (options.target() === snapshot.target) selection.replace(snapshot.nodes)
  }

  watch(() => composer.submission, recoverFailedSubmission, {
    immediate: true,
    flush: 'sync'
  })

  async function submit(
    text: string,
    attachments: ComposerAttachment[],
    references: WorkflowReference[] = []
  ): Promise<void> {
    const target = options.target()
    if (
      !options.canSubmit() ||
      composer.submission?.phase === 'pending' ||
      (!text.trim() && attachments.length === 0) ||
      attachments.some((attachment) => attachment.uploading)
    )
      return

    const capture = attachments.length > 0 && options.captureMixedContext?.() === true
    const prompt = capture ? {
      text: composer.prompt.text,
      references: composer.prompt.references.map((reference) => {
        if (reference.kind === 'node') return { ...reference, node: { ...reference.node } }
        if (reference.kind === 'asset') return { ...reference, attachment: { ...reference.attachment } }
        return { ...reference }
      })
    } : composer.prompt
    const sentAttachments = capture ? attachments.map((item) => ({ ...item })) : [...attachments]
    const sentReferences = capture ? references.map((item) => ({ ...item })) : [...references]
    selection.exit()
    const nodes =
      selection.workflow() === target
        ? selection.staged.value.map((node) => capture ? { ...node } : node)
        : []

    selection.consume()
    const submissionId = composer.startSubmission({
      prompt,
      attachments: sentAttachments,
      nodes,
      target
    })

    const sent = await options.send(
      text,
      sentAttachments,
      nodes,
      sentReferences
    )
    const stopRequested =
      composer.submission?.id === submissionId &&
      composer.submission.stopRequested
    composer.settleSubmission(submissionId, sent)
    if (sent && stopRequested) await options.stop()
  }

  return { submit }
}
