import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { deleteSkill, importSkill, listSkills, toggleSkill } from '@/api'
import type { Skill } from '@/api/schemas'
import { askConfirm } from '@/composables/dialog/useConfirmDialog'

function message(e: unknown): string {
  return e instanceof Error ? e.message : String(e)
}

export function useSkillsPanel(isActive: () => boolean | undefined) {
  const { t } = useI18n()

  const skills = ref<Skill[]>([])
  const globalEnabled = ref(true)
  const loading = ref(false)
  const importing = ref(false)
  const error = ref('')

  const validSkills = computed(() => skills.value.filter(s => s.valid))
  const invalidSkills = computed(() => skills.value.filter(s => !s.valid))

  async function load(): Promise<void> {
    loading.value = true
    error.value = ''
    try {
      const data = await listSkills()
      skills.value = data.skills
      globalEnabled.value = data.enabled
    } catch (e) {
      skills.value = []
      error.value = message(e)
    } finally {
      loading.value = false
    }
  }

  async function onToggle(skill: Skill, enabled: boolean): Promise<void> {
    error.value = ''
    try {
      await toggleSkill(skill.name, enabled)
    } catch (e) {
      error.value = message(e)
      return
    }
    await load()
  }

  async function onImport(e: Event): Promise<void> {
    const input = e.target as HTMLInputElement
    const file = input.files?.[0]
    input.value = ''
    if (!file) return
    importing.value = true
    error.value = ''
    try {
      await importSkill(file)
      await load()
    } catch (err) {
      error.value = message(err)
    } finally {
      importing.value = false
    }
  }

  async function onRemove(skill: Skill): Promise<void> {
    const ok = await askConfirm({
      title: t('skills.removeTitle'),
      message: t('skills.removeConfirm', { name: skill.name }),
      danger: true,
    })
    if (!ok) return
    error.value = ''
    try {
      await deleteSkill(skill.name)
    } catch (e) {
      error.value = message(e)
      return
    }
    await load()
  }

  watch(isActive, (active) => {
    if (active) void load()
  }, { immediate: true })

  return {
    skills,
    validSkills,
    invalidSkills,
    globalEnabled,
    loading,
    importing,
    error,
    load,
    onToggle,
    onImport,
    onRemove,
  }
}
