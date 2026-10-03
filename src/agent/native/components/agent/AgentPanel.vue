<script setup lang="ts">
import type { InteractionResponse } from '../../schemas/hermesInteractionSchema'
import {
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuPortal,
  DropdownMenuRoot,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from 'reka-ui'
import { computed, nextTick, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import Button from '@agent/components/ui/button/Button.vue'
import Input from '@agent/components/ui/input/Input.vue'
import { buildTooltipConfig } from '@agent/composables/useTooltipConfig'

import type { ActiveTab } from '../../types/activeTab'
import type {
  WorkflowReference,
  WorkflowReferenceMetadata,
  WorkflowReferenceOption
} from '../../types/workflowReference'
import type { TurnId } from '../../schemas/agentApiSchema'
import type { ComposerAttachment } from '../../composables/agent/useComposer'
import type { SelectedNode } from '../../composables/agent/useCanvasSelection'
import { DEFAULT_AGENT_PAYWALL_PRESENTATION } from '../../services/agent/agentPaywallPresentation'
import type {
  AgentPaywallAction,
  AgentPaywallPresentation
} from '../../services/agent/agentPaywallPresentation'
import type { ConversationEntry } from '../../stores/agent/agentConversationStore'
import type { HistoryGroups } from '../../stores/agent/agentChatHistoryStore'

import AgentFeedbackCaption from './AgentFeedbackCaption.vue'
import ChatHistoryScreen from './ChatHistoryScreen.vue'
import Composer from './Composer.vue'
import ConversationView from './ConversationView.vue'
import EmptyState from './EmptyState.vue'
import PanelHeader from './PanelHeader.vue'

const {
  entries,
  userName,
  streaming = false,
  submitting = false,
  canAttach = false,
  canOpenAssets = false,
  canOpenEagle = false,
  isMaximized = false,
  selectionTags = [],
  nodeReferenceDisabledReason,
  availableWorkflows = [],
  selectWorkflowReference,
  savingReference = false,
  editableWorkflowId,
  activeTab = null,
  workflowTabs = [],
  visibleTabPath = null,
  selectingTabPath = null,
  selectTab = async () => false,
  workflowDetached = false,
  getMentionNodes = () => [],
  paywallPresentation = DEFAULT_AGENT_PAYWALL_PRESENTATION,
  sessionId = null,
  customTitle,
  historyGroups,
  editableTurnId = null,
  answeringAskIds = new Set<string>()
} = defineProps<{
  entries: ConversationEntry[]
  userName?: string
  streaming?: boolean
  submitting?: boolean
  canAttach?: boolean
  canOpenAssets?: boolean
  canOpenEagle?: boolean
  isMaximized?: boolean
  selectionTags?: SelectedNode[]
  nodeReferenceDisabledReason?: string
  availableWorkflows?: WorkflowReferenceOption[]
  selectWorkflowReference?: (
    workflow: WorkflowReferenceOption
  ) => Promise<WorkflowReferenceMetadata | undefined>
  savingReference?: boolean
  editableWorkflowId?: string
  activeTab?: ActiveTab | null
  workflowTabs?: ActiveTab[]
  visibleTabPath?: string | null
  selectingTabPath?: string | null
  selectTab?: (path: string) => Promise<boolean>
  workflowDetached?: boolean
  getMentionNodes?: () => SelectedNode[]
  paywallPresentation?: AgentPaywallPresentation
  sessionId?: string | null
  customTitle?: string
  historyGroups: HistoryGroups
  editableTurnId?: TurnId | null
  answeringAskIds?: ReadonlySet<string>
}>()
const emit = defineEmits<{
  send: [
    text: string,
    attachments: ComposerAttachment[],
    workflowReferences?: WorkflowReference[]
  ]
  stop: []
  attach: []
  openAssets: []
  openEagle: []
  selectNodes: []
  removeTag: [id: string]
  mentionPick: [node: SelectedNode]
  requestWorkflowReferences: []
  removeWorkflowReference: [id: string]
  feedback: [turnId: string, vote: 'up' | 'down' | null]
  paywallAction: [action: AgentPaywallAction]
  toggleWorkflowLink: []
  newChat: []
  toggleSize: []
  close: []
  openHistory: []
  selectHistory: [id: string]
  deleteHistory: [id: string]
  copyHistory: [id: string]
  renameHistory: [id: string, title: string]
  renameChat: [title: string]
  respondInteraction: [response: InteractionResponse]
  answerAsk: [askId: string, selection: 'run' | 'cancel']
  openWorkflow: [workflowId: string, workflowName?: string]
  openReferenceWorkflow: [workflowId: string, workflowName: string]
}>()

const showHistory = ref(false)

function onNewChat(): void {
  showHistory.value = false
  emit('newChat')
}
function onOpenHistory(): void {
  showHistory.value = true
  emit('openHistory')
}
function onSelectHistory(id: string): void {
  showHistory.value = false
  emit('selectHistory', id)
}

const composerRef = ref<InstanceType<typeof Composer>>()

const { t } = useI18n()

const sessionTitle = computed(() => {
  if (customTitle) return customTitle
  const firstUser = entries.find(
    (entry): entry is Extract<ConversationEntry, { role: 'user' }> =>
      entry.role === 'user'
  )
  return firstUser?.text.trim().slice(0, 60) || undefined
})

const renaming = ref(false)
const renameDraft = ref('')
const renameInput = ref<InstanceType<typeof Input>>()
const titleButton = ref<InstanceType<typeof Button>>()

async function startRename(): Promise<void> {
  renameDraft.value = sessionTitle.value ?? ''
  renaming.value = true
  await nextTick()
  renameInput.value?.focus()
  renameInput.value?.select()
}

async function exitRename(): Promise<void> {
  renaming.value = false
  await nextTick()
  const button: unknown = titleButton.value?.$el
  if (button instanceof HTMLButtonElement) button.focus()
}

function onRenameKeydown(event: KeyboardEvent): void {
  // A CJK composition confirms and cancels with these same keys.
  if (event.isComposing) return
  if (event.key === 'Enter') {
    event.preventDefault()
    commitRename()
  } else if (event.key === 'Escape') {
    event.preventDefault()
    void exitRename()
  }
}

function commitRename(): void {
  if (!renaming.value) return
  void exitRename()
  const title = renameDraft.value.trim()
  if (title !== '' && title !== sessionTitle.value) emit('renameChat', title)
}

function onDeleteChat(): void {
  if (sessionId !== null) emit('deleteHistory', sessionId)
}

function addAttachment(attachment: ComposerAttachment): void {
  composerRef.value?.addAttachment(attachment)
}

function updateAttachment(
  id: string,
  patch: Partial<ComposerAttachment>
): void {
  composerRef.value?.updateAttachment(id, patch)
}

function removeAttachment(id: string): void {
  composerRef.value?.removeAttachment(id)
}

function onComposerSend(
  text: string,
  attachments: ComposerAttachment[],
  references?: WorkflowReference[]
): void {
  if (references !== undefined) emit('send', text, attachments, references)
  else emit('send', text, attachments)
}

defineExpose({ addAttachment, updateAttachment, removeAttachment })
</script>

<template>
  <section
    class="@container ctv:flex ctv:h-full ctv:flex-col ctv:overflow-hidden ctv:bg-base-background ctv:text-base-foreground"
  >
    <PanelHeader
      :is-maximized
      @new-chat="onNewChat"
      @toggle-size="emit('toggleSize')"
      @close="emit('close')"
    />

    <template v-if="showHistory">
      <ChatHistoryScreen
        :groups="historyGroups"
        class="ctv:min-h-0 ctv:flex-1"
        @back="showHistory = false"
        @select="onSelectHistory"
        @delete="emit('deleteHistory', $event)"
        @copy-markdown="emit('copyHistory', $event)"
        @rename="(id, title) => emit('renameHistory', id, title)"
      />
    </template>

    <template v-else>
      <div class="ctv:flex ctv:h-10 ctv:shrink-0 ctv:items-center ctv:px-2">
        <Button
          id="agent-chat-history"
          v-tooltip.bottom="buildTooltipConfig(t('agent.showChatHistory'))"
          type="button"
          variant="muted-textonly"
          size="icon-sm"
          :aria-label="t('agent.showChatHistory')"
          class="ctv:size-6 ctv:shrink-0"
          @click="onOpenHistory"
        >
          <span class="ctv:icon-[lucide--history] ctv:size-4 ctv:shrink-0" />
        </Button>
        <template v-if="renaming">
          <Input
            ref="renameInput"
            v-model="renameDraft"
            type="text"
            :aria-label="t('g.rename')"
            class="ctv:h-6 ctv:flex-1 ctv:px-2 ctv:py-1 ctv:text-xs"
            @keydown="onRenameKeydown"
            @blur="commitRename"
          />
        </template>
        <div
          v-else
          role="group"
          :aria-label="t('agent.chatOptions')"
          class="ctv:flex ctv:w-fit ctv:max-w-full ctv:min-w-0 ctv:items-center"
        >
          <Button
            ref="titleButton"
            type="button"
            variant="muted-textonly"
            size="sm"
            :disabled="sessionId === null"
            class="ctv:min-w-0 ctv:justify-start ctv:text-left"
            @click="startRename"
          >
            <span class="ctv:min-w-0 ctv:truncate">{{
              sessionTitle || t('agent.newChatTitle')
            }}</span>
          </Button>
          <DropdownMenuRoot v-if="sessionId">
            <DropdownMenuTrigger as-child>
              <Button
                v-tooltip.bottom="buildTooltipConfig(t('agent.chatOptions'))"
                variant="muted-textonly"
                size="icon-sm"
                :aria-label="t('agent.chatOptions')"
                class="ctv:size-6 ctv:shrink-0"
              >
                <span class="ctv:icon-[lucide--chevron-down] ctv:size-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuPortal>
              <DropdownMenuContent
                side="bottom"
                align="start"
                :side-offset="4"
                class="agent-scope ctv:z-1100 ctv:flex ctv:h-16 ctv:w-32 ctv:flex-col ctv:gap-1 ctv:rounded-xl ctv:bg-secondary-background ctv:p-1 ctv:shadow-lg"
              >
                <DropdownMenuItem
                  class="ctv:flex ctv:h-6 ctv:w-full ctv:shrink-0 ctv:cursor-pointer ctv:items-center ctv:gap-1.5 ctv:rounded-lg ctv:px-1.5 ctv:py-1 ctv:text-xs ctv:text-base-foreground ctv:outline-none ctv:data-highlighted:bg-secondary-background-hover"
                  @select="startRename"
                >
                  <span class="ctv:icon-[lucide--pencil] ctv:size-4 ctv:shrink-0" />
                  <span class="ctv:truncate">{{ t('g.rename') }}</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator
                  class="ctv:relative ctv:h-0 ctv:w-full ctv:shrink-0 ctv:before:absolute ctv:before:inset-x-0 ctv:before:top-0 ctv:before:h-px ctv:before:bg-component-node-border"
                />
                <DropdownMenuItem
                  class="ctv:flex ctv:h-6 ctv:w-full ctv:shrink-0 ctv:cursor-pointer ctv:items-center ctv:gap-1.5 ctv:rounded-lg ctv:px-1.5 ctv:py-1 ctv:text-xs ctv:text-base-foreground ctv:outline-none ctv:data-highlighted:bg-secondary-background-hover ctv:data-highlighted:text-destructive-background"
                  @select="onDeleteChat"
                >
                  <span class="ctv:icon-[lucide--trash-2] ctv:size-4 ctv:shrink-0" />
                  <span class="ctv:truncate">{{ t('g.delete') }}</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenuPortal>
          </DropdownMenuRoot>
        </div>
      </div>

      <div class="ctv:min-h-0 ctv:flex-1">
        <EmptyState
          v-if="!entries.length"
          :user-name
          @insert="composerRef?.insert($event)"
        />
        <ConversationView
          v-else
          :entries
          :editable-turn-id
          :answering-ask-ids
          :paywall-presentation
          @edit-prompt="composerRef?.replaceDraft($event)"
          @feedback="(id, vote) => emit('feedback', id, vote)"
          @respond-interaction="emit('respondInteraction', $event)"
          @answer-ask="
            (askId, selection) => emit('answerAsk', askId, selection)
          "
          @open-workflow="
            (workflowId, workflowName) =>
              emit('openWorkflow', workflowId, workflowName)
          "
          @open-reference-workflow="
            (workflowId, workflowName) =>
              emit('openReferenceWorkflow', workflowId, workflowName)
          "
          @paywall-action="emit('paywallAction', $event)"
        />
      </div>
    </template>

    <template v-if="!showHistory">
      <slot name="instrument" />
      <footer class="ctv:shrink-0 ctv:py-3">
        <div class="ctv:mx-auto ctv:flex ctv:w-full ctv:max-w-[640px] ctv:flex-col ctv:gap-4 ctv:px-4">
          <div class="ctv:flex ctv:items-center ctv:justify-between ctv:gap-2 ctv:text-xs">
            <span role="status" class="ctv:min-w-0 ctv:truncate">{{
              workflowDetached
                ? t('agent.noWorkflowLinked')
                : t('agent.workflowLinked', { name: activeTab?.name ?? '' })
            }}</span>
            <Button
              type="button"
              variant="muted-textonly"
              size="sm"
              :disabled="streaming || submitting || selectingTabPath !== null || savingReference || (workflowDetached && visibleTabPath === null)"
              :aria-label="t(workflowDetached ? 'agent.linkCurrentWorkflow' : 'agent.unlinkWorkflow')"
              @click="emit('toggleWorkflowLink')"
            >{{ t(workflowDetached ? 'agent.linkCurrentWorkflow' : 'agent.unlinkWorkflow') }}</Button>
          </div>
          <Composer
            ref="composerRef"
            :streaming
            :submitting
            :can-attach
            :can-open-assets
            :can-open-eagle
            :selection-tags
            :node-reference-disabled-reason
            :select-workflow-reference
            :available-workflows
            :editable-workflow-id
            :workflow-selecting="selectingTabPath !== null || savingReference"
            :get-mention-nodes
            @send="onComposerSend"
            @stop="emit('stop')"
            @attach="emit('attach')"
            @open-assets="emit('openAssets')"
            @open-eagle="emit('openEagle')"
            @select-nodes="emit('selectNodes')"
            @remove-tag="emit('removeTag', $event)"
            @mention-pick="emit('mentionPick', $event)"
            @request-workflow-references="emit('requestWorkflowReferences')"
            @remove-workflow-reference="emit('removeWorkflowReference', $event)"
            @open-reference-workflow="
              (workflowId, workflowName) =>
                emit('openReferenceWorkflow', workflowId, workflowName)
            "
          >
          </Composer>
          <AgentFeedbackCaption />
        </div>
      </footer>
    </template>
  </section>
</template>
