export const WORKFLOW_API_GENERATED = 'comfytv:workflow-api-generated'

export interface WorkflowApiGeneratedDetail {
  kind: string
  label: string
}

export function emitWorkflowApiGenerated(kind: string, label: string): void {
  window.dispatchEvent(new CustomEvent<WorkflowApiGeneratedDetail>(
    WORKFLOW_API_GENERATED, { detail: { kind, label } },
  ))
}
