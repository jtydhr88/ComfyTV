<template>
  <input
    v-if="editing"
    ref="inputRef"
    :value="draft"
    :placeholder="label"
    :class="inputClass"
    @click.stop
    @pointerdown.stop
    @dblclick.stop
    @keydown.enter.prevent="commitEdit"
    @keydown.esc.prevent="cancelEdit"
    @blur="commitEdit"
    @input="draft = ($event.target as HTMLInputElement).value"
  />
  <button
    v-else
    type="button"
    :class="itemClass"
    @click="emit('select')"
    @dblclick.stop="startEdit"
  >
    <span
      v-if="color"
      class="ctv:size-2 ctv:shrink-0 ctv:rounded-full"
      :style="{ backgroundColor: color }"
    />
    <slot name="icon" />
    <span
      class="ctv:flex-1 ctv:truncate ctv:text-left"
      :class="hidden ? 'ctv:line-through ctv:opacity-50' : ''"
      :title="$t('scene3d.renameHint')"
    >{{ label }}</span>
    <slot name="badge" />
    <span
      :class="chipClass"
      :title="hidden ? $t('scene3d.showObject') : $t('scene3d.hideObject')"
      @click.stop="emit('toggleHide')"
    >
      <IconEyeOff v-if="hidden" class="ctv:size-3" />
      <IconEye v-else class="ctv:size-3" />
    </span>
    <span
      v-if="removable && selected"
      :class="chipClass"
      :title="$t('scene3d.removeObject')"
      @click.stop="emit('remove')"
    ><IconX class="ctv:size-3" /></span>
  </button>
</template>

<script setup lang="ts">
import { computed, nextTick, ref } from 'vue'
import IconEye from '~icons/lucide/eye'
import IconEyeOff from '~icons/lucide/eye-off'
import IconX from '~icons/lucide/x'

const {
  label,
  name = '',
  selected = false,
  hidden = false,
  removable = true
} = defineProps<{
  label: string
  name?: string
  color?: string
  selected?: boolean
  hidden?: boolean
  removable?: boolean
}>()

const emit = defineEmits<{
  select: []
  rename: [name: string]
  toggleHide: []
  remove: []
}>()

const editing = ref(false)
const draft = ref('')
const inputRef = ref<HTMLInputElement>()

function startEdit(): void {
  draft.value = name
  editing.value = true
  void nextTick(() => {
    inputRef.value?.focus()
    inputRef.value?.select()
  })
}

function commitEdit(): void {
  if (!editing.value) return
  editing.value = false
  if (draft.value.trim() !== name.trim()) emit('rename', draft.value)
}

function cancelEdit(): void {
  editing.value = false
}

const itemClass = computed(
  () =>
    'ctv:flex ctv:w-full ctv:cursor-pointer ctv:items-center ctv:gap-1.5 ctv:[font-family:inherit] ' +
    'ctv:rounded-md ctv:border-0 ctv:px-1.5 ctv:py-1 ctv:text-2xs ctv:transition-colors ' +
    (selected
      ? 'ctv:bg-secondary-background-selected ctv:text-base-foreground'
      : 'ctv:bg-transparent ctv:text-muted-foreground ctv:hover:bg-secondary-background-hover ctv:hover:text-base-foreground')
)

const chipClass =
  'ctv:flex ctv:shrink-0 ctv:cursor-pointer ctv:items-center ctv:justify-center ' +
  'ctv:rounded-full ctv:opacity-55 ctv:transition-opacity ctv:hover:opacity-100'

const inputClass =
  'ctv:w-full ctv:min-w-0 ctv:rounded-md ctv:border-0 ctv:bg-secondary-background ' +
  'ctv:px-1.5 ctv:py-1 ctv:text-2xs ctv:text-base-foreground ctv:outline-none ' +
  'ctv:ring-1 ctv:ring-node-component-border ctv:[font-family:inherit]'
</script>
