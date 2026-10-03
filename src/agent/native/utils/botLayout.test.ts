import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { parse } from '@vue/compiler-sfc'

const panel = readFileSync('src/agent/native/AgentPanelRoot.vue', 'utf8')
const template = parse(panel).descriptor.template!.content

describe('Bot pane layout', () => {
  it('does not render the attachment policy as an always-visible banner', () => {
    expect(template).not.toContain('imagePolicy.label')
    expect(template).not.toContain('role="note"')
  })
  it('keeps unsupported-input feedback outside the presentation-only change', () => {
    expect(panel).toContain("toast.add({ severity: 'warn', detail: imagePolicy.value.label, life: 5000 })")
    expect(panel).toContain("allowed: (file) => imagePolicy.value.allows(getMediaTypeFromFilename(file.name))")
    expect(template).toContain(':accept="imagePolicy.accept"')
  })
})
