export function extractRunError(e: unknown, nodeId: number | string): {
  message: string
  type?: string
  traceback?: string
} {
  const resp = (e as any)?.response
  const top = resp?.error
  const nodeErrors = resp?.node_errors
  const idKey = String(nodeId)
  const myErrors = nodeErrors && (nodeErrors[idKey] ?? nodeErrors[Number(idKey)])

  if (myErrors && Array.isArray(myErrors.errors) && myErrors.errors.length > 0) {
    const parts = myErrors.errors.map((er: any) => {
      const msg = er?.message ? String(er.message) : 'invalid input'
      const det = er?.details ? String(er.details) : ''
      return det ? `${msg}: ${det}` : msg
    })
    return {
      message: parts.join('; '),
      type: String(top?.type || 'ValidationError'),
    }
  }

  if (nodeErrors && typeof nodeErrors === 'object') {
    const lines: string[] = []
    for (const [nid, ne] of Object.entries<any>(nodeErrors)) {
      if (!ne?.errors?.length) continue
      const klass = ne.class_type ? `${ne.class_type} (#${nid})` : `#${nid}`
      for (const er of ne.errors) {
        lines.push(`${klass}: ${er?.message || 'invalid'}${er?.details ? ` — ${er.details}` : ''}`)
      }
    }
    if (lines.length > 0) {
      return {
        message: lines.join('\n'),
        type: String(top?.type || 'ValidationError'),
      }
    }
  }

  if (top && typeof top === 'object') {
    const msg = String(top.message || 'prompt failed')
    const det = top.details ? String(top.details) : ''
    return {
      message: det ? `${msg}: ${det}` : msg,
      type: String(top.type || 'PromptError'),
    }
  }

  const msg = e instanceof Error
    ? (e.message || e.toString())
    : (typeof e === 'string' ? e : 'queuePrompt failed')
  const stack = e instanceof Error ? e.stack : undefined
  return { message: msg, traceback: stack }
}
