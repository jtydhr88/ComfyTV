import { computed, ref, watch } from 'vue'
import type { Ref } from 'vue'

import { listSkills } from '@/api'
import type { Skill } from '@/api/schemas'

export function useSkillSlash(draft: Ref<string>) {
  const skills = ref<Skill[]>([])
  const selected = ref<Skill | null>(null)
  const loaded = ref(false)

  const open = computed(() =>
    draft.value.startsWith('/')
    && !draft.value.includes('\n')
    && selected.value === null)

  const query = computed(() => {
    if (!open.value) return ''
    return (draft.value.slice(1).split(/\s/, 1)[0] ?? '').toLowerCase()
  })

  const matches = computed(() => {
    if (!open.value) return []
    return skills.value.filter((s) => {
      if (!s.enabled) return false
      if (!query.value) return true
      return s.name.toLowerCase().includes(query.value)
        || (s.display_name || '').toLowerCase().includes(query.value)
    })
  })

  async function ensureLoaded(): Promise<void> {
    if (loaded.value) return
    loaded.value = true
    try {
      skills.value = (await listSkills()).skills
    } catch {
      loaded.value = false
    }
  }

  function pick(skill: Skill): void {
    selected.value = skill
    draft.value = draft.value.replace(/^\/\S*\s?/, '')
  }

  function pickFirst(): boolean {
    if (!open.value || matches.value.length === 0) return false
    pick(matches.value[0]!)
    return true
  }

  function clear(): void {
    selected.value = null
  }

  watch(open, (isOpen) => {
    if (isOpen) void ensureLoaded()
  }, { immediate: true })

  return { skills, selected, open, query, matches, pick, pickFirst, clear }
}
