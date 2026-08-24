import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'

const listSkills = vi.fn()
const toggleSkill = vi.fn()
const importSkill = vi.fn()
const deleteSkill = vi.fn()
vi.mock('@/api', () => ({
  listSkills: (...a: any[]) => listSkills(...a),
  toggleSkill: (...a: any[]) => toggleSkill(...a),
  importSkill: (...a: any[]) => importSkill(...a),
  deleteSkill: (...a: any[]) => deleteSkill(...a),
}))

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string, args?: Record<string, unknown>) =>
      args ? `${key}:${JSON.stringify(args)}` : key,
  }),
}))

const askConfirm = vi.fn()
vi.mock('@/composables/dialog/useConfirmDialog', () => ({
  askConfirm: (...a: any[]) => askConfirm(...a),
}))

import { useSkillsPanel } from './useSkillsPanel'

function skill(name: string, extra: Record<string, unknown> = {}) {
  return {
    name,
    description: `${name} does things`,
    display_name: '',
    source: 'builtin',
    valid: true,
    enabled: true,
    error: '',
    ...extra,
  }
}

function flush(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0))
}

beforeEach(() => {
  vi.clearAllMocks()
  listSkills.mockResolvedValue({ enabled: true, skills: [] })
})

describe('useSkillsPanel', () => {
  it('loads only when active and splits valid from invalid', async () => {
    const active = ref(false)
    listSkills.mockResolvedValue({ enabled: true, skills: [
      skill('good'),
      skill('broken', { valid: false, enabled: false, error: 'no description' }),
    ] })
    const p = useSkillsPanel(() => active.value)
    await flush()
    expect(listSkills).not.toHaveBeenCalled()
    active.value = true
    await flush()
    expect(p.validSkills.value.map(s => s.name)).toEqual(['good'])
    expect(p.invalidSkills.value.map(s => s.name)).toEqual(['broken'])
    expect(p.globalEnabled.value).toBe(true)
  })

  it('onToggle flips the skill and refetches', async () => {
    toggleSkill.mockResolvedValue({ ok: true })
    const p = useSkillsPanel(() => true)
    await flush()
    listSkills.mockClear()
    await p.onToggle(skill('good') as any, false)
    expect(toggleSkill).toHaveBeenCalledWith('good', false)
    expect(listSkills).toHaveBeenCalled()
  })

  it('onToggle surfaces the error and keeps the list', async () => {
    toggleSkill.mockRejectedValue(new Error('boom'))
    const p = useSkillsPanel(() => true)
    await flush()
    listSkills.mockClear()
    await p.onToggle(skill('good') as any, false)
    expect(p.error.value).toContain('boom')
    expect(listSkills).not.toHaveBeenCalled()
  })

  it('onImport posts the zip, refetches and resets the input', async () => {
    importSkill.mockResolvedValue({ ok: true, skill: skill('newy') })
    const p = useSkillsPanel(() => true)
    await flush()
    listSkills.mockClear()
    const input = document.createElement('input')
    input.type = 'file'
    const file = new File(['x'], 'skill.zip')
    Object.defineProperty(input, 'files', { value: [file], configurable: true })
    await p.onImport({ target: input } as unknown as Event)
    expect(importSkill).toHaveBeenCalledWith(file)
    expect(listSkills).toHaveBeenCalled()
    expect(input.value).toBe('')
  })

  it('onImport surfaces backend errors', async () => {
    importSkill.mockRejectedValue(new Error('already exists'))
    const p = useSkillsPanel(() => true)
    await flush()
    const input = document.createElement('input')
    input.type = 'file'
    Object.defineProperty(input, 'files', {
      value: [new File(['x'], 'skill.zip')], configurable: true,
    })
    await p.onImport({ target: input } as unknown as Event)
    expect(p.error.value).toContain('already exists')
  })

  it('onRemove deletes only after a danger confirm', async () => {
    deleteSkill.mockResolvedValue({ ok: true })
    const p = useSkillsPanel(() => true)
    await flush()
    askConfirm.mockResolvedValueOnce(false)
    await p.onRemove(skill('mine', { source: 'user' }) as any)
    expect(deleteSkill).not.toHaveBeenCalled()
    askConfirm.mockResolvedValueOnce(true)
    await p.onRemove(skill('mine', { source: 'user' }) as any)
    expect(askConfirm).toHaveBeenCalledWith(expect.objectContaining({
      danger: true,
      message: 'skills.removeConfirm:{"name":"mine"}',
    }))
    expect(deleteSkill).toHaveBeenCalledWith('mine')
  })
})
