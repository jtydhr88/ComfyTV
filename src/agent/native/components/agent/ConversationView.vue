<script setup lang="ts">
import type { InteractionResponse } from '../../schemas/hermesInteractionSchema'
import { useIntersectionObserver } from '@vueuse/core'
import { computed, nextTick, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import Button from '@agent/components/ui/button/Button.vue'
import { buildTooltipConfig } from '@agent/composables/useTooltipConfig'

import { cn } from '@comfyorg/tailwind-utils'

import { DEFAULT_AGENT_PAYWALL_PRESENTATION } from '../../services/agent/agentPaywallPresentation'
import type {
  AgentPaywallAction,
  AgentPaywallPresentation
} from '../../services/agent/agentPaywallPresentation'
import type { ConversationEntry } from '../../stores/agent/agentConversationStore'
import type { TurnId } from '../../schemas/agentApiSchema'
import type { PromptSnapshot } from '../../types/workflowReference'

import AgentMessage from './message/AgentMessage.vue'
import UserMessage from './message/UserMessage.vue'

const {
  entries,
  paywallPresentation = DEFAULT_AGENT_PAYWALL_PRESENTATION,
  editableTurnId = null,
  answeringAskIds = new Set<string>()
} = defineProps<{
  entries: ConversationEntry[]
  paywallPresentation?: AgentPaywallPresentation
  editableTurnId?: TurnId | null
  answeringAskIds?: ReadonlySet<string>
}>()
const emit = defineEmits<{
  feedback: [turnId: string, vote: 'up' | 'down' | null]
  editPrompt: [prompt: PromptSnapshot]
  respondInteraction: [response: InteractionResponse]
  answerAsk: [askId: string, selection: 'run' | 'cancel']
  openWorkflow: [workflowId: string, workflowName?: string]
  openReferenceWorkflow: [workflowId: string, workflowName: string]
  paywallAction: [action: AgentPaywallAction]
}>()

const { t } = useI18n()

const bottom = ref<HTMLElement>()
const atBottom = ref(true)

useIntersectionObserver(bottom, ([entry]) => {
  atBottom.value = entry?.isIntersecting ?? true
})

const top = ref<HTMLElement>()
const atTop = ref(true)

useIntersectionObserver(top, ([entry]) => {
  atTop.value = entry?.isIntersecting ?? true
})

function scrollToLatest(): void {
  bottom.value?.scrollIntoView({ block: 'end' })
}

const latestContentSignal = computed(() => {
  const last = entries.at(-1)
  if (!last || !('parts' in last)) return `${entries.length}`
  const tail = last.parts.at(-1)
  const tailText = tail && 'text' in tail ? tail.text.length : 0
  const settled = last.parts.filter(
    (part) => 'state' in part && part.state === 'done'
  ).length
  return `${entries.length}:${last.streaming}:${last.parts.length}:${settled}:${tailText}`
})

watch(
  latestContentSignal,
  async () => {
    if (!atBottom.value) return
    await nextTick()
    scrollToLatest()
  },
  { flush: 'post' }
)
</script>

<template>
  <div class="ctv:relative ctv:h-full">
    <div
      :class="
        cn(
          'ctv:h-full ctv:overflow-y-auto',
          !atTop && 'ctv:mask-t-from-[calc(100%-2rem)]',
          !atBottom && 'ctv:mask-b-from-[calc(100%-2rem)]'
        )
      "
    >
      <div ref="top" />
      <div class="ctv:mx-auto ctv:max-w-[640px] ctv:p-4">
        <div class="ctv:flex ctv:flex-col ctv:gap-4">
          <template v-for="entry in entries" :key="`${entry.role}-${entry.id}`">
            <UserMessage
              v-if="entry.role === 'user'"
              :text="entry.text"
              :attachments="entry.attachments"
              :tags="entry.tags"
              :workflow-references="entry.workflowReferences"
              :editable="entry.id === editableTurnId"
              @edit="emit('editPrompt', $event)"
              @open-reference-workflow="
                (workflowId: string, workflowName: string) =>
                  emit('openReferenceWorkflow', workflowId, workflowName)
              "
            />
            <AgentMessage
              v-else
              :message="entry"
              :answering-ask-ids
              :paywall-presentation
              @feedback="emit('feedback', entry.id, $event)"
              @respond-interaction="emit('respondInteraction', $event)"
              @answer-ask="
                (askId: string, selection: 'run' | 'cancel') =>
                  emit('answerAsk', askId, selection)
              "
              @open-workflow="
                (workflowId: string, workflowName?: string) =>
                  emit('openWorkflow', workflowId, workflowName)
              "
              @paywall-action="emit('paywallAction', $event)"
            />
          </template>
          <div ref="bottom" />
        </div>
      </div>
    </div>

    <Button
      v-if="!atBottom"
      v-tooltip.top="buildTooltipConfig(t('agent.latest'))"
      type="button"
      variant="secondary"
      size="icon"
      :aria-label="t('agent.latest')"
      class="ctv:absolute ctv:bottom-2 ctv:left-1/2 ctv:-translate-x-1/2 ctv:rounded-full ctv:shadow-md ctv:ring-1 ctv:ring-muted-foreground"
      @click="scrollToLatest"
    >
      <span class="ctv:icon-[lucide--chevron-down] ctv:size-4" />
    </Button>
  </div>
</template>
