<template>
  <div
    class="ctv:rounded-md ctv:border ctv:px-2.5 ctv:py-2 ctv:text-xs"
    :class="pending
      ? 'ctv:border-border ctv:bg-secondary-background'
      : 'ctv:border-border-subtle ctv:opacity-80'"
  >
    <div class="ctv:mb-1.5 ctv:flex ctv:items-start ctv:gap-1.5">
      <i
        class="pi ctv:mt-0.5 ctv:text-[10px]"
        :class="block.kind === 'run_approval' ? 'pi-play-circle' : 'pi-question-circle'"
      />
      <span class="ctv:break-words ctv:whitespace-pre-wrap ctv:font-medium">{{ block.prompt }}</span>
    </div>

    <div class="ctv:flex ctv:flex-wrap ctv:gap-1.5">
      <button
        v-for="option in block.options ?? []"
        :key="option.id"
        class="ctv:rounded-md ctv:border ctv:px-2 ctv:py-1 ctv:text-left ctv:text-xs"
        :class="optionClass(option.id)"
        :disabled="!pending"
        :title="option.description"
        @click="onOptionClick(option.id)"
      >{{ option.label }}</button>
    </div>

    <div
      v-if="pending && block.allow_other"
      class="ctv:mt-1.5 ctv:flex ctv:items-center ctv:gap-1.5"
    >
      <input
        v-model="otherText"
        class="ctv:min-w-0 ctv:flex-1 ctv:rounded-md ctv:border ctv:border-border-subtle ctv:bg-transparent ctv:px-2 ctv:py-1 ctv:text-xs ctv:text-base-foreground"
        :placeholder="$t('bot.askOtherPlaceholder')"
        @keydown.enter.prevent="submit"
      >
    </div>

    <div
      v-if="pending && (multiSelect || block.allow_other)"
      class="ctv:mt-1.5"
    >
      <button
        class="ctv:rounded-md ctv:border ctv:border-border ctv:bg-primary-background ctv:px-2.5 ctv:py-1 ctv:text-xs ctv:cursor-pointer"
        :disabled="!canSubmit"
        :class="!canSubmit && 'ctv:opacity-50'"
        @click="submit"
      >{{ $t('bot.askSubmit') }}</button>
    </div>

    <div
      v-if="!pending && block.status !== 'answered'"
      class="ctv:mt-1 ctv:text-2xs ctv:text-muted-foreground ctv:italic"
    >
      {{ block.status === 'expired' ? $t('bot.askExpired') : $t('bot.askCancelled') }}
    </div>
    <div
      v-else-if="!pending && block.other_text"
      class="ctv:mt-1 ctv:text-2xs ctv:text-muted-foreground"
    >
      “{{ block.other_text }}”
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'

import { type BotBlock, useBotStore } from '@/stores/botStore'

const props = defineProps<{ block: BotBlock }>()

const store = useBotStore()

const picked = ref<Set<string>>(new Set())
const otherText = ref('')

const pending = computed(() => props.block.status === 'pending')
const multiSelect = computed(() => (props.block.max_selections ?? 1) > 1)

const canSubmit = computed(() => {
  const min = props.block.min_selections ?? 1
  return picked.value.size >= min
    || (props.block.allow_other === true && otherText.value.trim().length > 0)
})

function optionClass(id: string): string {
  const chosen = pending.value
    ? picked.value.has(id)
    : (props.block.selected ?? []).includes(id)
  if (chosen) return 'ctv:border-border ctv:bg-interface-menu-component-surface-hovered ctv:cursor-pointer'
  return pending.value
    ? 'ctv:border-border-subtle ctv:bg-transparent ctv:text-muted-foreground ctv:cursor-pointer'
    : 'ctv:border-border-subtle ctv:bg-transparent ctv:text-muted-foreground'
}

function onOptionClick(id: string): void {
  if (!pending.value) return
  if (!multiSelect.value && !props.block.allow_other) {
    void store.answerAsk(props.block.ask_id ?? '', [id])
    return
  }
  const next = new Set(picked.value)
  if (next.has(id)) {
    next.delete(id)
  } else {
    if (!multiSelect.value) next.clear()
    if (next.size < (props.block.max_selections ?? 1)) next.add(id)
  }
  picked.value = next
}

function submit(): void {
  if (!canSubmit.value) return
  void store.answerAsk(
    props.block.ask_id ?? '', [...picked.value], otherText.value.trim())
}
</script>
