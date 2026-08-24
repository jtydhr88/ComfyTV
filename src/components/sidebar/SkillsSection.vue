<template>
  <div class="ctv:mt-2 ctv:px-1 ctv:flex ctv:items-center ctv:gap-1">
    <span class="ctv:flex-1 ctv:font-semibold ctv:text-muted-foreground ctv:uppercase ctv:text-2xs ctv:tracking-wide">
      {{ $t('skills.section') }}
    </span>
    <button
      :class="iconBtnClass"
      :title="$t('skills.import')"
      :disabled="importing"
      @click="fileInput?.click()"
    >
      <i v-if="importing" class="pi pi-spin pi-spinner ctv:text-xs" />
      <IconUpload v-else class="ctv:size-3.5" />
    </button>
    <input
      ref="fileInput"
      type="file"
      accept=".zip"
      class="ctv:hidden"
      @change="onImport"
    />
  </div>

  <div class="ctv:px-1 ctv:text-muted-foreground ctv:leading-relaxed">
    {{ $t('skills.hint') }}
  </div>

  <div v-if="error" class="ctv:py-1 ctv:px-1.5 ctv:rounded ctv:bg-destructive-background/15 ctv:text-destructive-background ctv:break-all">
    {{ error }}
  </div>

  <div
    v-if="!loading && validSkills.length === 0 && invalidSkills.length === 0"
    class="ctv:py-2 ctv:px-1.5 ctv:text-center ctv:italic ctv:text-muted-foreground/60"
  >
    {{ $t('skills.empty') }}
  </div>

  <div
    v-for="skill in validSkills"
    :key="skill.name"
    class="ctv:flex ctv:flex-col ctv:gap-1 ctv:py-1.5 ctv:px-2 ctv:rounded-lg
           ctv:bg-secondary-background ctv:border ctv:border-border-subtle"
  >
    <div class="ctv:flex ctv:items-center ctv:gap-2">
      <div class="ctv:flex-1 ctv:min-w-0">
        <div class="ctv:flex ctv:items-center ctv:gap-1.5">
          <span class="ctv:font-semibold ctv:truncate">
            {{ skill.display_name || skill.name }}
          </span>
          <span
            class="ctv:shrink-0 ctv:rounded ctv:px-1 ctv:py-0.5 ctv:text-2xs
                   ctv:bg-interface-menu-component-surface-hovered ctv:text-muted-foreground"
          >
            {{ $t(`skills.source.${skill.source}`) }}
          </span>
        </div>
        <div
          class="ctv:text-muted-foreground ctv:leading-relaxed ctv:line-clamp-2"
          :title="skill.description"
        >
          {{ skill.description }}
        </div>
      </div>
      <button
        v-if="skill.source === 'user'"
        :class="[iconBtnClass, 'ctv:hover:text-destructive-background']"
        :title="$t('skills.remove')"
        @click="onRemove(skill)"
      >
        <IconTrash2 class="ctv:size-3.5" />
      </button>
      <ComfyTVToggle
        :model-value="skill.enabled"
        :disabled="!enabled"
        @update:model-value="(v: boolean) => onToggle(skill, v)"
      />
    </div>
  </div>

  <div
    v-for="skill in invalidSkills"
    :key="skill.name"
    class="ctv:flex ctv:items-center ctv:gap-2 ctv:py-1.5 ctv:px-2 ctv:rounded-lg
           ctv:bg-secondary-background ctv:border ctv:border-border-subtle ctv:opacity-60"
  >
    <div class="ctv:flex-1 ctv:min-w-0">
      <div class="ctv:font-semibold ctv:truncate">{{ skill.name }}</div>
      <div class="ctv:text-destructive-background ctv:leading-relaxed ctv:break-all">
        {{ skill.error }}
      </div>
    </div>
    <button
      v-if="skill.source === 'user'"
      :class="[iconBtnClass, 'ctv:hover:text-destructive-background']"
      :title="$t('skills.remove')"
      @click="onRemove(skill)"
    >
      <IconTrash2 class="ctv:size-3.5" />
    </button>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

import ComfyTVToggle from '@/components/widgets/ComfyTVToggle.vue'
import { useSkillsPanel } from '@/composables/sidebar/useSkillsPanel'

import IconTrash2 from '~icons/lucide/trash-2'
import IconUpload from '~icons/lucide/upload'

const props = defineProps<{ active?: boolean; enabled?: boolean }>()

const fileInput = ref<HTMLInputElement | null>(null)

const {
  validSkills,
  invalidSkills,
  loading,
  importing,
  error,
  onToggle,
  onImport,
  onRemove,
} = useSkillsPanel(() => props.active)

const iconBtnClass = 'ctv:inline-flex ctv:items-center ctv:justify-center ctv:cursor-pointer ctv:shrink-0 '
  + 'ctv:rounded-md ctv:border-none ctv:bg-transparent ctv:p-1 ctv:text-muted-foreground '
  + 'ctv:hover:bg-secondary-background-hover ctv:hover:text-base-foreground '
  + 'ctv:disabled:opacity-50 ctv:disabled:pointer-events-none'
</script>
