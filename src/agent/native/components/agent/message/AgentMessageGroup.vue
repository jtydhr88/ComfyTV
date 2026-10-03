<script setup lang="ts">
import HermesQuestionCard from './HermesQuestionCard.vue'
import HermesApprovalCard from './HermesApprovalCard.vue'
import type { InteractionResponse } from '../../../schemas/hermesInteractionSchema'
import { cn } from '@comfyorg/tailwind-utils'

import type { ActivityPart } from '../../../services/agent/agentMessageParts'
import type {
  AgentPaywallAction,
  AgentPaywallPresentation
} from '../../../services/agent/agentPaywallPresentation'
import ActivityTrace from './ActivityTrace.vue'
import AgentPaywallCard from './AgentPaywallCard.vue'
import MarkdownStream from './MarkdownStream.vue'
import RunApprovalCard from './RunApprovalCard.vue'
import TabLinkCard from './TabLinkCard.vue'
import type { AgentMessageGroup } from './agentMessageGroup'
import WorkSummary from './WorkSummary.vue'

const { group } = defineProps<{
  group: AgentMessageGroup
  streaming: boolean
  activityParts: readonly ActivityPart[]
  answeringAskIds: ReadonlySet<string>
  paywallPresentation: AgentPaywallPresentation
}>()

const emit = defineEmits<{
  respondInteraction: [response: InteractionResponse]
  answer: [askId: string, selection: 'run' | 'cancel']
  openWorkflow: [workflowId: string, workflowName?: string]
  paywallAction: [action: AgentPaywallAction]
}>()
</script>

<template>
  <MarkdownStream v-if="group.kind === 'text'" :text="group.part.text" />
  <template v-else-if="group.kind === 'trace'">
    <ActivityTrace v-if="streaming" :parts="activityParts" live />
    <WorkSummary v-else :parts="activityParts" />
  </template>
  <div
    v-else-if="group.kind === 'tabLinks'"
    role="group"
    class="ctv:flex ctv:flex-col ctv:gap-1"
  >
    <TabLinkCard
      v-for="(link, linkIndex) in group.parts"
      :key="linkIndex"
      :workflow-id="link.workflowId"
      :locator-id="link.locatorId"
      :name="link.name"
    />
  </div>
  <HermesApprovalCard
    v-else-if="group.kind === 'hermes_interaction' && group.part.interaction.kind === 'hermes_approval'"
    :interaction="group.part.interaction"
    @respond="emit('respondInteraction', $event)"
  />
  <HermesQuestionCard
    v-else-if="group.kind === 'hermes_interaction' && group.part.interaction.kind === 'hermes_question'"
    :interaction="group.part.interaction"
    @respond="emit('respondInteraction', $event)"
  />
  <RunApprovalCard
    v-else-if="group.kind === 'runApproval'"
    :part="group.part"
    :answering="answeringAskIds.has(group.part.askId)"
    @answer="(askId, selection) => emit('answer', askId, selection)"
    @open-workflow="
      (workflowId, workflowName) =>
        emit('openWorkflow', workflowId, workflowName)
    "
  />
  <AgentPaywallCard
    v-else-if="group.kind === 'paywall'"
    :presentation="paywallPresentation"
    :message="group.part.message"
    @paywall-action="emit('paywallAction', $event)"
  />
  <div
    v-else-if="group.kind === 'notice'"
    :role="group.part.level === 'error' ? 'alert' : 'status'"
    :class="
      cn(
        'ctv:flex ctv:items-start ctv:gap-2 ctv:rounded-xl ctv:border ctv:px-3 ctv:py-2 ctv:text-sm',
        group.part.level === 'error'
          ? 'ctv:border-destructive-background/40 ctv:text-destructive-background'
          : 'ctv:border-component-node-border ctv:text-muted-foreground'
      )
    "
  >
    <span class="ctv:mt-0.5 ctv:icon-[lucide--triangle-alert] ctv:size-4 ctv:shrink-0" />
    <span class="ctv:flex ctv:flex-col ctv:gap-0.5">
      <span>{{ group.part.text }}</span>
      <span
        v-if="group.part.retryAfterSeconds !== undefined"
        class="ctv:text-xs ctv:text-muted-foreground"
      >
        {{
          $t('agent.retryAfterSeconds', {
            seconds: group.part.retryAfterSeconds
          })
        }}
      </span>
    </span>
  </div>
</template>
