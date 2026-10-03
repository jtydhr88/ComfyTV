<script setup lang="ts">
import {
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuPortal,
  DropdownMenuRoot,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger
} from 'reka-ui'
import { computed, inject, nextTick, ref, useTemplateRef, watch } from 'vue'
import type { Ref } from 'vue'
import { useI18n } from 'vue-i18n'

import Button from '@agent/components/ui/button/Button.vue'
import AccessibleTooltip from '@agent/components/ui/tooltip/AccessibleTooltip.vue'
import { buildTooltipConfig } from '@agent/composables/useTooltipConfig'

import InlinePromptEditor from './composer/InlinePromptEditor.vue'
import { composerPromptForSend } from '../../utils/composerPrompt'
import { useAgentMentionPicker } from '../../composables/agent/useAgentMentionPicker'
import { useWorkflowReferencePicker } from '../../composables/agent/useWorkflowReferencePicker'
import type { ComposerAttachment } from '../../composables/agent/useComposer'
import { useComposer } from '../../composables/agent/useComposer'
import type { SelectedNode } from '../../composables/agent/useCanvasSelection'
import { selectedNodeKey } from '../../composables/agent/useCanvasSelection'
import type {
  PromptSnapshot,
  WorkflowReference,
  WorkflowReferenceMetadata,
  WorkflowReferenceOption
} from '../../types/workflowReference'
import { cn } from '@comfyorg/tailwind-utils'

import AttachmentChip from './composer/AttachmentChip.vue'
import RunModePopover from './composer/RunModePopover.vue'

const {
  streaming = false,
  submitting = false,
  canAttach = false,
  canOpenAssets = false,
  canOpenEagle = false,
  selectionTags = [],
  nodeReferenceDisabledReason,
  availableWorkflows = [],
  selectWorkflowReference = async () => undefined,
  editableWorkflowId,
  workflowSelecting = false,
  getMentionNodes = () => []
} = defineProps<{
  streaming?: boolean
  submitting?: boolean
  canAttach?: boolean
  canOpenAssets?: boolean
  canOpenEagle?: boolean
  selectionTags?: SelectedNode[]
  nodeReferenceDisabledReason?: string
  availableWorkflows?: WorkflowReferenceOption[]
  selectWorkflowReference?: (
    workflow: WorkflowReferenceOption
  ) => Promise<WorkflowReferenceMetadata | undefined>
  editableWorkflowId?: string
  workflowSelecting?: boolean
  getMentionNodes?: () => SelectedNode[]
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
  openReferenceWorkflow: [workflowId: string, workflowName: string]
}>()
const { t } = useI18n()

const assetDragActive = inject<Readonly<Ref<boolean>>>(
  'agentAssetDragActive',
  ref(false)
)

const duplicateIdClass =
  'ctv:shrink-0 ctv:rounded-full ctv:bg-interface-menu-keybind-surface-default ctv:px-1 ctv:py-0.5 ctv:font-mono ctv:text-xs/4 ctv:font-medium ctv:text-base-foreground'

const running = computed(() => streaming || submitting)

const composer = useComposer({
  onSend: (text, attachments) => {
    if (workflowSelecting || submitting) return
    if (workflowReferences.value.length > 0) {
      const { text: draft, workflowReferences: references } =
        composerPromptForSend(composer.prompt.value)
      const offsets = references.map((reference) => reference.textOffset)
      const start = Math.min(
        draft.length - draft.trimStart().length,
        ...offsets
      )
      const end = Math.max(draft.trimEnd().length, ...offsets)
      emit(
        'send',
        draft.slice(start, end),
        attachments,
        references.map((reference) => ({
          ...reference,
          textOffset: Math.min(
            end - start,
            Math.max(0, reference.textOffset - start)
          )
        }))
      )
    } else emit('send', text, attachments)
  },
  isRunning: () => running.value,
  onStop: () => emit('stop')
})

const editorRef =
  useTemplateRef<InstanceType<typeof InlinePromptEditor>>('editorRef')
const { workflowReferences } = composer

const workflowSubmenuOpen = ref(false)
const addMenuOpen = ref(false)

const { eligibleWorkflows, selectWorkflow } = useWorkflowReferencePicker({
  editor: () => editorRef.value,
  references: () => workflowReferences.value,
  workflows: () => availableWorkflows,
  editableWorkflowId: () => editableWorkflowId,
  selecting: () => workflowSelecting,
  resolve: (workflow) => selectWorkflowReference(workflow)
})

const {
  mentionSection,
  mentionActive,
  mentionMatches,
  mentionVisible,
  mentionHasResults,
  graphDupes,
  tagDupes,
  syncMention,
  pickMention,
  isNodeReferenceDisabled,
  isMentionDisabled,
  onComposerKeydown: handleMentionKeydown,
  onComposerKeyup,
  close: closeMention,
  highlight: highlightMention
} = useAgentMentionPicker({
  draft: () => composer.draft.value,
  editor: () => editorRef.value,
  selectionTags: () => selectionTags,
  workflows: () => eligibleWorkflows.value,
  nodeReferenceDisabledReason: () => nodeReferenceDisabledReason,
  workflowSelecting: () => workflowSelecting,
  getMentionNodes: () => getMentionNodes(),
  selectWorkflow,
  pickNode: (node) => emit('mentionPick', node),
  requestWorkflows: () => emit('requestWorkflowReferences')
})

function onSelectNodes(event: Event): void {
  if (nodeReferenceDisabledReason) {
    event.preventDefault()
    return
  }
  emit('selectNodes')
}

function onWorkflowSubmenuOpenChange(open: boolean): void {
  if (open && !workflowSelecting) emit('requestWorkflowReferences')
}

async function pickWorkflow(workflow: WorkflowReferenceOption): Promise<void> {
  if (await selectWorkflow(workflow)) addMenuOpen.value = false
}

function onEditorSelectionChange(): void {
  const point = editorRef.value?.insertionPoint()
  if (point) composer.setInsertionPoint(point)
  syncMention()
}

function onComposerKeydown(event: KeyboardEvent): void {
  if (handleMentionKeydown(event)) return
  if (event.key === 'Enter') onEnter(event)
  if (
    event.key === 'Escape' &&
    running.value &&
    !event.isComposing &&
    !event.repeat
  ) {
    event.preventDefault()
    event.stopPropagation()
    emit('stop')
  }
}

const mentionListRef = useTemplateRef<HTMLDivElement>('mentionListRef')
watch(mentionActive, async () => {
  await nextTick()
  mentionListRef.value
    ?.querySelector('[data-active="true"]')
    ?.scrollIntoView?.({ block: 'nearest' })
})

const placeholderHint = computed(() => {
  const [text = '', mentionNodes = ''] = t('agent.placeholder').split('\n')
  return { text, mentionNodes }
})

function onEnter(event: KeyboardEvent): void {
  if (event.isComposing || event.shiftKey) return
  event.preventDefault()
  if (running.value) return
  composer.submit()
}

const primaryActionTooltip = computed(() =>
  running.value ? t('agent.stop') : t('agent.send')
)
const primaryActionShortcut = computed(() =>
  running.value ? t('agent.stopShortcut') : undefined
)

function onPrimaryAction(): void {
  if (running.value) emit('stop')
  else composer.submit()
}

function insert(text: string): void {
  composer.insert(text)
  editorRef.value?.focus()
}

function replaceDraft(prompt: PromptSnapshot): void {
  composer.replacePrompt(prompt)
  editorRef.value?.focus()
}

defineExpose({
  insert,
  replaceDraft,
  addAttachment: composer.addAttachment,
  updateAttachment: composer.updateAttachment,
  removeAttachment: composer.removeAttachment
})
</script>

<template>
  <div
    id="agent-composer"
    class="ctv:relative ctv:flex ctv:flex-col ctv:rounded-lg ctv:border ctv:border-border-default ctv:bg-base-background"
  >
    <div
      v-if="mentionVisible"
      id="agent-reference-menu"
      ref="mentionListRef"
      data-testid="agent-reference-menu"
      role="menu"
      :aria-label="t('agent.addToPrompt')"
      class="ctv:absolute ctv:inset-x-0 ctv:bottom-full ctv:z-1100 ctv:-mb-8.75 ctv:max-h-64 ctv:overflow-y-auto ctv:rounded-lg ctv:border ctv:border-border-subtle ctv:bg-secondary-background ctv:p-1 ctv:font-inter ctv:shadow-md"
      @mousedown.prevent
    >
      <div
        v-if="mentionSection === 'root'"
        class="ctv:flex ctv:h-6 ctv:items-center ctv:px-1.5 ctv:py-1 ctv:text-xs/4 ctv:text-muted-foreground"
      >
        {{ t('agent.reference') }}
      </div>
      <AccessibleTooltip
        v-for="(match, index) in mentionMatches"
        :key="`${match.kind}:${match.id}`"
        :label="nodeReferenceDisabledReason ?? ''"
        :disabled="!isNodeReferenceDisabled(match)"
        :skip-delay-duration="0"
        disable-hoverable-content
        :collision-padding="8"
      >
        <template #trigger>
          <div
            :id="`agent-reference-item-${index}`"
            :aria-disabled="isMentionDisabled(match) || undefined"
            :aria-description="
              isNodeReferenceDisabled(match)
                ? nodeReferenceDisabledReason
                : undefined
            "
            role="menuitem"
            :data-active="index === mentionActive"
            :class="
              cn(
                'ctv:flex ctv:h-7 ctv:w-full ctv:cursor-pointer ctv:items-center ctv:gap-1.5 ctv:rounded-lg ctv:px-1.5 ctv:py-1 ctv:text-xs ctv:font-normal ctv:text-base-foreground ctv:outline-none ctv:aria-disabled:cursor-not-allowed ctv:aria-disabled:opacity-50',
                index === mentionActive && 'ctv:bg-secondary-background-hover'
              )
            "
            @mouseenter="highlightMention(index)"
            @click="pickMention(match)"
          >
            <span
              v-if="match.kind === 'section' && match.id === 'nodes'"
              class="ctv:icon-[comfy--node] ctv:size-3.5 ctv:shrink-0"
            />
            <span
              v-else-if="match.kind === 'section' && match.id === 'workflows'"
              class="ctv:icon-[comfy--workflow] ctv:size-3.5 ctv:shrink-0"
            />
            <span
              v-else-if="match.kind === 'back'"
              class="ctv:icon-[lucide--chevron-left] ctv:size-4 ctv:shrink-0"
            />
            <span class="ctv:min-w-0 ctv:flex-1 ctv:truncate">{{ match.label }}</span>
            <span
              v-if="
                match.kind === 'workflow' && match.workflow.id === undefined
              "
              class="ctv:text-xs ctv:text-muted-foreground"
              >{{ t('agent.unsavedWorkflow') }}</span
            >
            <span
              v-if="match.kind === 'node' && graphDupes.has(match.node.title)"
              :class="cn(duplicateIdClass, 'ctv:ml-auto')"
            >
              #{{ match.node.id }}
            </span>
            <span
              v-if="match.kind === 'section'"
              class="ctv:icon-[lucide--chevron-right] ctv:size-4 ctv:shrink-0"
            />
          </div>
        </template>
      </AccessibleTooltip>
      <div
        v-if="!mentionHasResults"
        role="status"
        class="ctv:px-2 ctv:py-1 ctv:text-xs ctv:text-muted-foreground"
      >
        {{
          mentionSection === 'workflows'
            ? t('agent.noWorkflowsToReference')
            : t('agent.noNodesToReference')
        }}
      </div>
    </div>

    <div
      v-if="$slots.header"
      class="ctv:flex ctv:h-11 ctv:shrink-0 ctv:items-center ctv:rounded-t-lg ctv:bg-base-background ctv:px-2"
    >
      <slot name="header" />
    </div>

    <div
      :class="
        cn(
          'ctv:relative ctv:flex ctv:flex-col ctv:border ctv:transition-colors',
          assetDragActive
            ? 'ctv:h-28 ctv:rounded-lg ctv:border-dashed ctv:border-component-node-border ctv:bg-secondary-background'
            : 'ctv:min-h-28 ctv:rounded-lg ctv:border-border-default ctv:bg-secondary-background ctv:focus-within:border-muted-foreground'
        )
      "
    >
      <div
        v-if="assetDragActive"
        role="status"
        class="ctv:absolute ctv:inset-px ctv:z-20 ctv:flex ctv:flex-col ctv:items-center ctv:justify-center ctv:gap-2 ctv:rounded-lg ctv:bg-secondary-background ctv:font-inter ctv:text-[14px] ctv:leading-[normal] ctv:font-normal ctv:text-muted-foreground"
      >
        <span
          aria-hidden="true"
          class="ctv:icon-[lucide--upload] ctv:size-6 ctv:shrink-0 ctv:text-muted-foreground"
        />
        <span>{{ t('agent.dragAndDropAssets') }}</span>
      </div>
      <div
        v-if="selectionTags.length"
        data-testid="composer-node-section"
        class="ctv:flex ctv:flex-wrap ctv:items-center ctv:gap-2 ctv:border-b ctv:border-border-default ctv:p-3"
      >
        <span
          v-for="tag in selectionTags"
          :key="selectedNodeKey(tag)"
          class="ctv:inline-flex ctv:h-7 ctv:items-center ctv:gap-1 ctv:rounded-lg ctv:border ctv:border-border-default ctv:bg-secondary-background-hover ctv:px-2.5 ctv:text-xs/4 ctv:font-medium ctv:text-base-foreground ctv:transition-colors ctv:hover:bg-tertiary-background-hover"
        >
          <span class="ctv:flex ctv:items-center ctv:gap-1">
            <span class="ctv:icon-[comfy--node] ctv:size-3.5 ctv:text-muted-foreground" />
            <span class="ctv:max-w-40 ctv:truncate">{{ tag.title }}</span>
            <span
              v-if="graphDupes.has(tag.title) || tagDupes.has(tag.title)"
              :class="duplicateIdClass"
              >#{{ tag.id }}</span
            >
          </span>
          <Button
            v-tooltip.top="buildTooltipConfig(t('agent.remove'))"
            type="button"
            variant="muted-textonly"
            size="unset"
            :aria-label="
              t('agent.removeNodeLabel', { node: `${tag.title} #${tag.id}` })
            "
            class="ctv:size-3.5"
            @click.stop="emit('removeTag', selectedNodeKey(tag))"
          >
            <span class="ctv:icon-[lucide--x] ctv:size-3.5 ctv:shrink-0" />
          </Button>
        </span>
      </div>

      <div
        v-if="composer.attachments.value.length"
        data-testid="composer-asset-section"
        class="ctv:flex ctv:flex-wrap ctv:gap-2 ctv:p-3"
      >
        <AttachmentChip
          v-for="item in composer.attachments.value"
          :key="item.id"
          :name="item.name"
          :preview-url="item.previewUrl"
          :uploading="item.uploading"
          @remove="composer.removeReference(`asset:${item.id}`)"
        />
      </div>

      <div
        data-testid="composer-inline-input"
        class="ctv:max-h-100 ctv:min-h-16 ctv:overflow-x-hidden ctv:overflow-y-auto ctv:p-3"
      >
        <div
          v-if="workflowSelecting"
          role="status"
          class="ctv:mb-1 ctv:flex ctv:items-center ctv:gap-1 ctv:text-xs ctv:text-muted-foreground"
        >
          <span class="ctv:icon-[lucide--loader-circle] ctv:size-3 ctv:animate-spin" />
          {{ t('agent.savingWorkflow') }}
        </div>
        <div class="ctv:relative ctv:min-h-7">
          <InlinePromptEditor
            ref="editorRef"
            :model-value="composer.prompt.value"
            :label="t('agent.placeholder')"
            :expanded="mentionVisible"
            :active-descendant="
              mentionVisible
                ? `agent-reference-item-${mentionActive}`
                : undefined
            "
            :history-epoch="composer.promptEpoch.value"
            :editable-workflow-id
            @keydown="onComposerKeydown"
            @update:model-value="composer.applyEditorPrompt"
            @keyup="onComposerKeyup"
            @input="syncMention"
            @selection-change="onEditorSelectionChange"
            @click="syncMention"
            @blur="closeMention()"
            @open-reference-workflow="
              (id, name) => emit('openReferenceWorkflow', id, name)
            "
            @remove-node-reference="emit('removeTag', $event)"
            @remove-workflow-reference="emit('removeWorkflowReference', $event)"
          />

          <div
            v-if="
              !composer.draft.value && !composer.prompt.value.references.length
            "
            class="ctv:pointer-events-none ctv:relative ctv:z-10 ctv:-mt-7 ctv:font-inter ctv:text-[14px]/[20px] ctv:font-normal ctv:text-muted-foreground"
          >
            <span>{{ placeholderHint.text }} </span>
            <AccessibleTooltip
              :label="nodeReferenceDisabledReason ?? ''"
              :disabled="!nodeReferenceDisabledReason"
              :skip-delay-duration="0"
              disable-hoverable-content
              :collision-padding="8"
            >
              <template #trigger>
                <Button
                  type="button"
                  variant="link"
                  size="unset"
                  :aria-disabled="!!nodeReferenceDisabledReason || undefined"
                  :aria-description="nodeReferenceDisabledReason"
                  class="ctv:pointer-events-auto ctv:-ml-1 ctv:h-5 ctv:shrink-0 ctv:gap-1 ctv:px-1 ctv:align-top ctv:text-sm/5 ctv:aria-disabled:cursor-not-allowed ctv:aria-disabled:opacity-50"
                  @click="onSelectNodes"
                >
                  <span
                    class="ctv:icon-[lucide--mouse-pointer-click] ctv:size-3.5 ctv:shrink-0"
                  />
                  <span
                    class="ctv:underline ctv:decoration-dashed ctv:underline-offset-2"
                    >{{ placeholderHint.mentionNodes }}</span
                  >
                </Button>
              </template>
            </AccessibleTooltip>
          </div>
        </div>
      </div>

      <div class="ctv:flex ctv:items-center ctv:justify-between ctv:px-3 ctv:py-2">
        <DropdownMenuRoot v-model:open="addMenuOpen">
          <DropdownMenuTrigger as-child>
            <Button
              v-tooltip.top="buildTooltipConfig(t('agent.addToPrompt'))"
              variant="muted-textonly"
              size="icon"
              :aria-label="t('agent.addToPrompt')"
            >
              <span class="ctv:icon-[lucide--plus] ctv:size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuPortal>
            <DropdownMenuContent
              side="top"
              align="start"
              :side-offset="4"
              class="agent-scope ctv:z-1100 ctv:box-border ctv:w-max ctv:min-w-46.5 ctv:rounded-lg ctv:border ctv:border-border-subtle ctv:bg-secondary-background ctv:p-1 ctv:font-inter ctv:shadow-lg"
            >
              <AccessibleTooltip
                :label="nodeReferenceDisabledReason ?? ''"
                :disabled="!nodeReferenceDisabledReason"
                :skip-delay-duration="0"
                disable-hoverable-content
                :collision-padding="8"
              >
                <template #trigger>
                  <DropdownMenuItem
                    :disabled="!!nodeReferenceDisabledReason"
                    :aria-description="nodeReferenceDisabledReason"
                    class="ctv:mb-0.5 ctv:box-border ctv:flex ctv:h-7 ctv:w-full ctv:cursor-pointer ctv:items-center ctv:gap-1.5 ctv:rounded-lg ctv:px-1.5 ctv:py-1 ctv:text-[14px]/5 ctv:font-normal ctv:text-base-foreground ctv:outline-none ctv:aria-disabled:cursor-not-allowed ctv:aria-disabled:opacity-50 ctv:data-highlighted:bg-secondary-background-hover"
                    @select="onSelectNodes"
                  >
                    <span class="ctv:icon-[comfy--node] ctv:size-4 ctv:shrink-0" />
                    <span class="ctv:whitespace-nowrap">
                      {{ t('agent.nodes') }}
                    </span>
                  </DropdownMenuItem>
                </template>
              </AccessibleTooltip>
              <DropdownMenuItem
                v-if="canOpenAssets"
                class="ctv:box-border ctv:flex ctv:h-7 ctv:w-full ctv:cursor-pointer ctv:items-center ctv:gap-1.5 ctv:rounded-lg ctv:px-1.5 ctv:py-1 ctv:text-[14px]/5 ctv:font-normal ctv:text-base-foreground ctv:outline-none ctv:data-highlighted:bg-secondary-background-hover"
                @select="emit('openAssets')"
              >
                <span class="ctv:icon-[comfy--image-ai-edit] ctv:size-4 ctv:shrink-0" />
                <span class="ctv:whitespace-nowrap">
                  {{ t('agent.addFromAssets') }}
                </span>
              </DropdownMenuItem>
              <DropdownMenuItem
                v-if="canOpenEagle"
                class="ctv:box-border ctv:flex ctv:h-7 ctv:w-full ctv:cursor-pointer ctv:items-center ctv:gap-1.5 ctv:rounded-lg ctv:px-1.5 ctv:py-1 ctv:text-[14px]/5 ctv:font-normal ctv:text-base-foreground ctv:outline-none ctv:data-highlighted:bg-secondary-background-hover"
                @select="emit('openEagle')"
              >
                <span class="ctv:icon-[lucide--bird] ctv:size-4 ctv:shrink-0" />
                <span class="ctv:whitespace-nowrap">
                  {{ t('agent.addFromEagle') }}
                </span>
              </DropdownMenuItem>
              <DropdownMenuSeparator
                v-if="canAttach && (canOpenAssets || canOpenEagle)"
                class="ctv:mt-0 ctv:mb-px ctv:h-px ctv:bg-border-subtle"
              />
              <DropdownMenuItem
                v-if="canAttach"
                class="ctv:box-border ctv:flex ctv:h-7 ctv:w-full ctv:cursor-pointer ctv:items-center ctv:gap-1.5 ctv:rounded-lg ctv:px-1.5 ctv:py-1 ctv:text-[14px]/5 ctv:font-normal ctv:text-base-foreground ctv:outline-none ctv:data-highlighted:bg-secondary-background-hover"
                @select="emit('attach')"
              >
                <i class="ctv:icon-[lucide--paperclip] ctv:size-4 ctv:shrink-0" />
                <span class="ctv:whitespace-nowrap">{{
                  t('agent.attachFiles')
                }}</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenuPortal>
        </DropdownMenuRoot>

        <div class="ctv:flex ctv:items-center ctv:gap-1">
          <RunModePopover />
          <AccessibleTooltip
            :label="primaryActionTooltip"
            :skip-delay-duration="0"
            disable-hoverable-content
            :collision-padding="8"
          >
            <template #trigger>
              <Button
                type="button"
                :variant="running ? 'secondary' : 'inverted'"
                size="icon"
                :aria-label="running ? t('agent.stop') : t('agent.send')"
                :disabled="
                  !running && (workflowSelecting || !composer.canSend.value)
                "
                @click="onPrimaryAction"
              >
                <i v-if="running" class="ctv:icon-[lucide--square] ctv:size-4" />
                <i v-else class="ctv:icon-[lucide--arrow-up] ctv:size-4" />
              </Button>
            </template>
            <template #content>
              {{ primaryActionTooltip }}
              <span v-if="primaryActionShortcut" class="ctv:ml-1 ctv:opacity-50">{{
                primaryActionShortcut
              }}</span>
            </template>
          </AccessibleTooltip>
        </div>
      </div>
    </div>
  </div>
</template>
