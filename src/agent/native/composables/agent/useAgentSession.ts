import { computed, ref } from 'vue'
import { createAgentInteractions } from '../../services/agent/agentInteractions'

import { i18n } from '@agent/i18n'
import { reportError } from '@agent/platform/telemetry/reportError'
import { createUuidv4 } from '@agent/utils/uuid'
import type {
  AgentActiveTabData,
  AgentTurnAccepted,
  TurnId
} from '../../schemas/agentApiSchema'
import {
  isAgentEvent,
  parseAgentWsEvent,
  toTurnId,
  zAgentAdmissionError,
  zDisownedWorkflowError
} from '../../schemas/agentApiSchema'
import { AgentApiError } from '../../services/agent/agentRestClient'
import type {
  AgentRestClient,
  DraftSnapshot,
  OpenTabsSnapshot,
  PostMessageInput
} from '../../services/agent/agentRestClient'
import { useAgentConversationStore } from '../../stores/agent/agentConversationStore'
import { useAgentWorkflowTabBindingStore } from '../../stores/agent/agentWorkflowTabBindingStore'
import type { WorkflowReference } from '../../types/workflowReference'
import { serializeWorkflowReferences } from '../../utils/workflowReferenceText'
import { copyWorkflowJson } from '../../utils/copyWorkflowJson'
import { attachmentPolicy, type AttachmentCapability } from '../../utils/attachableFiles'

export interface AgentEventSource {
  subscribe(listener: (raw: unknown) => void): () => void
  onStatus?(listener: (live: boolean) => void): () => void
}

export interface SessionNotice {
  level: 'error'
  text: string
}

interface SentAttachment {
  ref: string
  name: string
  previewUrl?: string
}

interface SentTag {
  locatorId?: string
  id: string
  title: string
}

export interface WorkflowTurnContext {
  id?: string
  tabPath: string
}

/**
 * Workflow lookup context: omitted resolves the currently selected target,
 * `null` pins the absence of a target, and `{ tabPath }` pins its identity.
 * A send captures this before preparation so later selections cannot change
 * which workflow owns the turn.
 */
export type TurnOrigin = { tabPath: string } | null

type PromptEditState =
  | { phase: 'idle' }
  | { phase: 'stopping'; turnId: TurnId }
  | { phase: 'ready'; turnId: TurnId }

export interface AgentSessionDeps {
  rest: AgentRestClient
  events: AgentEventSource
  attachmentCapability?: () => AttachmentCapability
  workflow?: {
    // origin, when given, pins resolution to the tab that initiated the send
    // instead of the target selected when this is called - it is read
    // after prepare() so cloud ids it resolves are fresh, but must still
    // describe the pre-await originating tab, not a later switch. See
    // TurnOrigin for why "no origin tab" is a value rather than an omission.
    current(origin?: TurnOrigin): WorkflowTurnContext | undefined
    /** Stable host tab object; never serialized. Detect close/reopen at the same path. */
    identity?(origin: TurnOrigin): object | undefined
    adopted(workflowId: string, sent: WorkflowTurnContext | undefined): void
    restored?(
      workflowId: string | undefined,
      isCurrent: () => boolean
    ): Promise<void> | void
    prepare?(): Promise<void>
    /** The server refused this workflow id; forget every cached trace of it. */
    disowned?(workflowId: string): void
    tabs?(origin?: TurnOrigin): OpenTabsSnapshot | undefined
    activeTab?(data: AgentActiveTabData): void
    draft?(origin?: TurnOrigin): DraftSnapshot | undefined
  }
}

const THREAD_STORAGE_KEY = 'ComfyTV.Agent.ThreadId'
const PREPARE_TIMEOUT_MS = 3000

let sessionGeneration = 0

/**
 * Page-lifetime binding memory: the workflow a resumed turn belongs to must
 * survive a panel remount. Module-level like `sessionGeneration`;
 * newChat/loadThread clear it.
 */
let rememberedWorkflowId: string | null = null

function parseAdmissionError(error: unknown) {
  if (!(error instanceof AgentApiError)) return undefined
  const parsed = zAgentAdmissionError.safeParse(error.body)
  if (!parsed.success) return undefined
  const expectedStatus =
    parsed.data.error.type === 'PAYMENT_REQUIRED' ? 402 : 503
  if (error.status !== expectedStatus) return undefined
  return { ...parsed.data.error, retryAfterSeconds: error.retryAfterSeconds }
}

function disownsWorkflow(error: unknown): boolean {
  return (
    error instanceof AgentApiError &&
    error.status === 403 &&
    zDisownedWorkflowError.safeParse(error.body).success
  )
}

export function useAgentSession(deps: AgentSessionDeps) {
  const { rest, events, workflow } = deps

  const conversationStore = useAgentConversationStore()
  const bindingStore = useAgentWorkflowTabBindingStore()
  const interactions = rest.interactionChannel ? createAgentInteractions(rest, conversationStore.reconcileInteraction) : undefined
  let interactionRefresh: ReturnType<typeof setInterval> | undefined
  /**
   * The workflow the session is bound to (set on turn ack or an active-tab
   * switch, cleared by newChat/loadThread) - the CRDT follower's subscribe
   * target.
   */
  const boundWorkflowId = ref<string | null>(rememberedWorkflowId)

  const notices = ref<SessionNotice[]>([])
  const promptEditState = ref<PromptEditState>({ phase: 'idle' })
  const sending = ref(false)
  const answeringAskIds = ref<ReadonlySet<string>>(new Set())

  function setAskAnswering(askId: string, answering: boolean): void {
    const next = new Set(answeringAskIds.value)
    if (answering) next.add(askId)
    else next.delete(askId)
    answeringAskIds.value = next
  }

  function nextLocalErrorId(): TurnId {
    return toTurnId(`local-error-${createUuidv4()}`)
  }

  let unsubscribe: (() => void) | null = null
  let unsubscribeStatus: (() => void) | null = null
  let ownedGeneration = 0
  // The status source reports its current state synchronously on subscribe
  // (see agentEventSource.onStatus), so the first callback is a snapshot,
  // not a transition. Track whether we've ever observed a live connection so
  // an initial `false` (still connecting, not yet dropped) doesn't abort a
  // turn that survived a remount.
  let everLive = false

  function pushError(text: string): void {
    notices.value.push({ level: 'error', text })
  }

  function start(): void {
    ownedGeneration = ++sessionGeneration
    everLive = false
    // The binding only outlives a remount together with its thread: a page
    // with no surviving thread has no resumed turn the binding could serve.
    if (
      conversationStore.threadId === null &&
      localStorage.getItem(THREAD_STORAGE_KEY) === null
    ) {
      rememberedWorkflowId = null
      boundWorkflowId.value = null
    }
    void rest.interactionChannel?.open().then(() => { if (conversationStore.threadId) void interactions?.refresh(conversationStore.threadId) })
    interactionRefresh = setInterval(() => { if (conversationStore.threadId) void interactions?.refresh(conversationStore.threadId) }, 30000)
    unsubscribe = events.subscribe(onRaw)
    if (events.onStatus) unsubscribeStatus = events.onStatus(onStatus)
    const surviving = conversationStore.threadId
    if (surviving !== null) {
      const generation = ++loadGeneration
      const isCurrent = () =>
        generation === loadGeneration && ownedGeneration === sessionGeneration
      conversationStore.stashActiveTurn()
      void hydrateFromServer(surviving, isCurrent).then(() => {
        if (isCurrent() && conversationStore.threadId === surviving)
          conversationStore.resumeBackgroundTurn()
      })
      return
    }
    if (conversationStore.messages.length === 0) {
      const stored = localStorage.getItem(THREAD_STORAGE_KEY)
      if (stored !== null) {
        const generation = ++loadGeneration
        conversationStore.setThreadId(stored)
        void hydrateFromServer(
          stored,
          () =>
            generation === loadGeneration &&
            ownedGeneration === sessionGeneration
        )
      }
    }
  }

  async function hydrateFromServer(
    threadId: string,
    isCurrent: () => boolean = () => true
  ): Promise<boolean> {
    try {
      const history = await rest.getMessages(threadId)
      if (conversationStore.threadId !== threadId || !isCurrent()) return false
      conversationStore.hydrate(history)
      await interactions?.refresh(threadId)
      await workflow?.restored?.(conversationStore.latestWorkflowId, isCurrent)
      if (conversationStore.threadId !== threadId || !isCurrent()) return false
      return true
    } catch (error) {
      if (!isCurrent()) return false
      if (error instanceof AgentApiError && error.status === 404) {
        if (conversationStore.threadId === threadId)
          conversationStore.setThreadId(null)
        localStorage.removeItem(THREAD_STORAGE_KEY)
        return false
      }
      pushError(error instanceof Error ? error.message : String(error))
      return false
    }
  }

  function stop(): void {
    clearInterval(interactionRefresh)
    rest.interactionChannel?.close()
    unsubscribe?.()
    unsubscribeStatus?.()
    unsubscribe = null
    unsubscribeStatus = null
    const stoppedGeneration = ownedGeneration
    queueMicrotask(() => {
      if (stoppedGeneration !== sessionGeneration) return
      conversationStore.abortActiveTurn()
      conversationStore.dropBackgroundTurns()
    })
  }

  async function prepareWorkflow(): Promise<void> {
    if (!workflow?.prepare) return
    await Promise.race([
      workflow.prepare().catch(() => undefined),
      new Promise<void>((resolve) => setTimeout(resolve, PREPARE_TIMEOUT_MS))
    ])
  }

  function recordUnavailableTarget(text: string): void {
    conversationStore.recordFailedSend(
      nextLocalErrorId(),
      text,
      i18n.global.t('agent.targetNavigationUnavailable')
    )
  }

  function postTurn(
    threadId: string,
    text: string,
    origin: TurnOrigin,
    wfContext: WorkflowTurnContext | undefined,
    attachments?: SentAttachment[],
    tags?: SentTag[],
    workflowReferences?: WorkflowReference[]
  ): Promise<AgentTurnAccepted> {
    const input = buildPostInput(
      threadId,
      text,
      origin,
      wfContext,
      attachments,
      tags,
      workflowReferences
    )
    if (wfContext?.id === undefined) return rest.postMessage(threadId, input)
    return rest.postMessage(threadId, { ...input, workflowId: wfContext.id })
  }

  function buildPostInput(
    threadId: string,
    text: string,
    origin: TurnOrigin,
    wfContext: WorkflowTurnContext | undefined,
    attachments?: SentAttachment[],
    tags?: SentTag[],
    workflowReferences?: WorkflowReference[],
    mixed = false
  ): PostMessageInput {
    const liveDraft = workflow?.draft?.(origin)
    const draft = mixed && liveDraft
      ? { ...liveDraft, content: copyWorkflowJson(liveDraft.content) }
      : liveDraft
    return {
      content: serializeWorkflowReferences(text, workflowReferences ?? []),
      tabs: workflow?.tabs?.(origin),
      workflowReferences: serializeReferencedWorkflows(
        workflowReferences,
        wfContext?.id
      ),
      selection: selectedNodes(tags, mixed),
      attachments: attachments?.map((attachment) => attachment.ref),
      ...((mixed && draft !== undefined) || canSendDraft(threadId, wfContext, draft) ? { draft } : {})
    }
  }

  function serializeReferencedWorkflows(
    references: WorkflowReference[] | undefined,
    currentWorkflowId: string | undefined
  ) {
    return (references ?? [])
      .filter((reference) => reference.id !== currentWorkflowId)
      .map((reference) => ({
        workflow_id: reference.id,
        name: reference.name
      }))
  }

  function selectedNodes(tags: SentTag[] | undefined, mixed = false) {
    if (tags === undefined || tags.length === 0) return undefined
    return {
      node_ids: tags.map((tag) => tag.id),
      ...(mixed ? { node_locators: tags.map((tag) => tag.locatorId ?? String(tag.id)) } : {})
    }
  }

  function canSendDraft(
    threadId: string,
    wfContext: WorkflowTurnContext | undefined,
    draft: DraftSnapshot | undefined
  ): boolean {
    if (draft === undefined) return false
    return threadId === 'new' || wfContext?.id !== undefined
  }

  function acceptTurn(
    ack: AgentTurnAccepted,
    text: string,
    wfContext: WorkflowTurnContext | undefined,
    attachments?: SentAttachment[],
    tags?: SentTag[],
    workflowReferences?: WorkflowReference[]
  ): void {
    conversationStore.setThreadId(ack.thread_id)
    localStorage.setItem(THREAD_STORAGE_KEY, ack.thread_id)
    if (ack.workflow_id !== undefined) {
      const boundAtAck = boundWorkflowId.value
      bindWorkflow(ack.workflow_id)
      const shouldAdopt =
        wfContext?.id !== undefined ||
        (ack.workflow_id !== boundAtAck &&
          bindingStore.tabPathFor(ack.workflow_id) === undefined)
      if (shouldAdopt) workflow?.adopted(ack.workflow_id, wfContext)
    }
    const turnId = ack.message_id as TurnId
    conversationStore.recordUser(
      turnId,
      text,
      attachments?.map(({ name, previewUrl, ref }) => ({
        name,
        previewUrl,
        ref
      })),
      tags?.map((tag) => `${tag.title} #${tag.id}`),
      workflowReferences
    )
    conversationStore.startTurn(turnId)
    if (wasStopRequestedWhileSending()) {
      stopRequestedWhileSending.value = false
      void stopTurn()
    }
  }

  function recordSendError(error: unknown, text: string): void {
    const admission = parseAdmissionError(error)
    if (admission?.reason === 'no_funds') {
      conversationStore.recordPaywall(
        nextLocalErrorId(),
        text,
        admission.message
      )
      return
    }
    if (admission !== undefined) {
      conversationStore.recordFailedSend(
        nextLocalErrorId(),
        text,
        admission.message,
        admission.reason === 'funds_unavailable'
          ? admission.retryAfterSeconds
          : undefined
      )
      return
    }
    const message =
      error instanceof AgentApiError
        ? error.message
        : error instanceof Error
          ? error.message
          : String(error)
    conversationStore.recordFailedSend(
      nextLocalErrorId(),
      text,
      `${i18n.global.t('agent.sendFailed')}: ${message}`
    )
  }

  /**
   * The server will not serve the id this turn was posted under, and the
   * binding that produced it outlives the page. Left in place it poisons the
   * tab: every later turn re-posts the same dead id, and a reload re-affirms
   * the binding through the thread's own workflow pointer.
   *
   * Everything here is keyed by the refused id, never by its tab path: the tab
   * may already have been rebound to a healthy workflow while the POST was in
   * flight. `disowned` evicts the id from the resolver's cloud index, which
   * `cloudIdFor` consults ahead of the binding store.
   */
  function releaseDisownedWorkflow(
    sent: WorkflowTurnContext | undefined,
    error: unknown
  ): void {
    if (sent?.id === undefined || !disownsWorkflow(error)) return
    bindingStore.unbindWorkflow(sent.id)
    workflow?.disowned?.(sent.id)
    if (boundWorkflowId.value === sent.id) boundWorkflowId.value = null
    if (rememberedWorkflowId === sent.id) rememberedWorkflowId = null
  }

  async function performSend(
    text: string,
    attachments?: SentAttachment[],
    tags?: SentTag[],
    workflowReferences?: WorkflowReference[]
  ): Promise<boolean> {
    const generation = loadGeneration
    const threadAtSend = conversationStore.threadId ?? 'new'
    const originContext = workflow?.current()
    const origin: TurnOrigin =
      originContext === undefined ? null : { tabPath: originContext.tabPath }
    let sentContext: WorkflowTurnContext | undefined
    try {
      const capability = deps.attachmentCapability?.()
      const policy = attachmentPolicy(capability ?? {})
      const mixed = Boolean(attachments?.length) && policy.mixedContext
      if (mixed || policy.references) {
        attachments = attachments?.map((attachment) => ({ ...attachment }))
      }
      // Managed asset names are editable labels, not filenames. Ingress checks
      // actual asset media_type; the backend authoritatively validates each ref.
      if (policy.references && attachments?.some(attachment =>
        !policy.enabled || !/^asset:\d+$/.test(attachment.ref)
      )) throw new Error('Unsupported media reference. Attach capability-approved image/video/audio assets; documents and archives are unsupported.')
      if (mixed) {
        tags = tags?.map((tag) => ({ ...tag }))
        workflowReferences = workflowReferences?.map((reference) => ({
          ...reference
        }))
      }
      const originAtClick =
        mixed && originContext ? { ...originContext } : originContext
      const identityAtClick = mixed ? workflow?.identity?.(origin) : undefined
      // Compose the existing wire content, then detach every submitted value
      // from the live editor/graph before preparation can yield. Draft JSON is
      // copied/validated by buildPostInput; optional envelope fields may omit
      // undefined exactly as they do in the REST serializer.
      const captured: PostMessageInput | undefined = mixed
        ? JSON.parse(JSON.stringify(
            buildPostInput(
              threadAtSend, text, origin, originAtClick,
              attachments, tags, workflowReferences, true
            ),
            (_key, value) => {
              if (typeof value === 'number' && !Number.isFinite(value))
                throw new Error('Mixed context requires finite JSON values.')
              return value
            }
          ))
        : undefined
      await prepareWorkflow()
      if (generation !== loadGeneration) return false
      const wfContext = workflow?.current(origin)
      const originUnavailable = mixed && origin !== null && (
        wfContext?.tabPath !== origin.tabPath ||
        (workflow?.identity && workflow.identity(origin) !== identityAtClick)
      )
      if (workflowTargetChanged(originAtClick, wfContext) || originUnavailable) {
        recordUnavailableTarget(text)
        return false
      }
      sentContext = wfContext
      const ack = captured
        ? await rest.postMessage(threadAtSend, {
            ...captured,
            ...(wfContext?.id === undefined ? {} : { workflowId: wfContext.id })
          })
        : await postTurn(
            threadAtSend,
            text,
            origin,
            wfContext,
            attachments,
            tags,
            workflowReferences
          )
      if (generation !== loadGeneration) return false
      acceptTurn(ack, text, wfContext, attachments, tags, workflowReferences)
      return true
    } catch (error) {
      // Before the generation guard: the binding store is page-global and
      // persisted, so a refusal that lands after newChat()/loadThread() has
      // moved on still has to release, or the dead id survives the reload.
      releaseDisownedWorkflow(sentContext, error)
      if (generation !== loadGeneration) return false
      recordSendError(error, text)
      return false
    }
  }

  function workflowTargetChanged(
    origin: WorkflowTurnContext | undefined,
    current: WorkflowTurnContext | undefined
  ): boolean {
    if (origin?.id === undefined) return false
    return current?.id !== origin.id
  }

  async function sendMessage(
    text: string,
    attachments?: SentAttachment[],
    tags?: SentTag[],
    workflowReferences?: WorkflowReference[]
  ): Promise<boolean> {
    if (sending.value) {
      conversationStore.recordFailedSend(
        nextLocalErrorId(),
        text,
        i18n.global.t('agent.sendBusy')
      )
      return false
    }
    promptEditState.value = { phase: 'idle' }
    sending.value = true
    stopRequestedWhileSending.value = false
    try {
      return await performSend(text, attachments, tags, workflowReferences)
    } finally {
      sending.value = false
    }
  }

  const stopRequestedWhileSending = ref(false)
  const wasStopRequestedWhileSending = () => stopRequestedWhileSending.value

  async function stopTurn(): Promise<void> {
    const threadId = conversationStore.threadId
    const turnId = conversationStore.activeTurnId
    if (threadId === null || turnId === null) {
      // The POST has not acked yet; remember the intent and cancel on ack.
      if (sending.value) stopRequestedWhileSending.value = true
      return
    }
    promptEditState.value = { phase: 'stopping', turnId }
    try {
      await rest.cancelMessage(threadId, turnId)
    } catch (error) {
      if (error instanceof AgentApiError) {
        if (error.status === 409) return
        promptEditState.value = { phase: 'idle' }
        pushError(error.message)
        return
      }
      promptEditState.value = { phase: 'idle' }
      pushError(error instanceof Error ? error.message : String(error))
    }
  }

  async function answerAsk(
    askId: string,
    selection: 'run' | 'cancel'
  ): Promise<void> {
    const currentThreadId = conversationStore.threadId
    const messageId = conversationStore.activeTurnId
    if (
      currentThreadId === null ||
      messageId === null ||
      answeringAskIds.value.has(askId)
    )
      return
    setAskAnswering(askId, true)
    try {
      await rest.answerAsk(currentThreadId, askId, [selection])
      // Keep the actions disabled until the canonical resolution frame arrives.
    } catch (error) {
      setAskAnswering(askId, false)
      if (error instanceof AgentApiError && error.status === 409) {
        // Conflict is not an answered receipt. Reconcile only the captured
        // thread; a late callback must not hydrate a newly selected chat.
        if (conversationStore.threadId === currentThreadId)
          await hydrateFromServer(currentThreadId, () => conversationStore.threadId === currentThreadId)
        return
      }
      reportError(error, { errorType: 'agent_ask_answer_failed' })
      pushError(error instanceof Error ? error.message : String(error))
    }
  }

  let loadGeneration = 0

  function newChat(): void {
    loadGeneration++
    promptEditState.value = { phase: 'idle' }
    conversationStore.stashActiveTurn()
    conversationStore.reset()
    boundWorkflowId.value = null
    rememberedWorkflowId = null
    localStorage.removeItem(THREAD_STORAGE_KEY)
  }

  function listThreads() {
    return rest.listThreads()
  }

  async function loadThread(threadId: string): Promise<void> {
    const generation = ++loadGeneration
    promptEditState.value = { phase: 'idle' }
    const isCurrent = () =>
      generation === loadGeneration && ownedGeneration === sessionGeneration
    conversationStore.stashActiveTurn()
    boundWorkflowId.value = null
    rememberedWorkflowId = null
    conversationStore.setThreadId(threadId)
    localStorage.setItem(THREAD_STORAGE_KEY, threadId)
    const hydrated = await hydrateFromServer(threadId, isCurrent)
    if (hydrated && isCurrent()) conversationStore.resumeBackgroundTurn()
  }

  function onRaw(raw: unknown): void {
    if (typeof raw !== 'object' || raw === null) return
    const type = (raw as { type?: unknown }).type
    if (typeof type !== 'string' || !isAgentEvent(type)) return
    const parsed = parseAgentWsEvent(raw)
    if (!parsed.success) {
      const messageId = (raw as { data?: { message_id?: unknown } }).data
        ?.message_id
      if (type === 'agent_message_done') {
        if (
          typeof messageId !== 'string' ||
          messageId === conversationStore.activeTurnId
        ) {
          conversationStore.abortActiveTurn()
          pushError(i18n.global.t('agent.malformedEvent'))
        } else {
          conversationStore.settleBackgroundTurn(messageId)
        }
      }
      console.warn('[agent] dropping malformed agent event', parsed.error)
      return
    }
    const event = parsed.data
    if (event.type === 'agent_interaction') {
      interactions?.hint(event.data.interaction)
      void interactions?.refresh(event.data.thread_id)
      return
    }
    if (event.type === 'agent_ask_resolved')
      setAskAnswering(event.data.ask_id, false)
    switch (event.type) {
      case 'agent_active_tab':
        // Every thread records the link in its own transcript; only the thread
        // on screen is allowed to move the user's tabs.
        conversationStore.ingest(event)
        if (
          event.data.thread_id === undefined ||
          event.data.thread_id === conversationStore.threadId
        )
          workflow?.activeTab?.(event.data)
        return
      default:
        conversationStore.ingest(event)
        if (
          event.type === 'agent_message_done' &&
          promptEditState.value.phase === 'stopping' &&
          event.data.message_id === promptEditState.value.turnId &&
          event.data.thread_id === conversationStore.threadId
        )
          promptEditState.value = {
            phase: 'ready',
            turnId: promptEditState.value.turnId
          }
    }
  }

  function onStatus(live: boolean): void {
    if (rest.interactionChannel) rest.interactionChannel.connected.value = live
    if (live && conversationStore.threadId) void interactions?.refresh(conversationStore.threadId)
    if (live) {
      everLive = true
      return
    }
    // Only a real live->down transition means a turn's stream was actually
    // interrupted. An initial `false` (socket not open yet) is not a
    // reconnect and must not abort a turn that survived a remount.
    if (!everLive) return
    conversationStore.abortActiveTurn()
    conversationStore.dropBackgroundTurns()
  }

  const isSending = computed(() => sending.value)
  const editableTurnId = computed(() =>
    promptEditState.value.phase === 'ready'
      ? promptEditState.value.turnId
      : null
  )

  function bindWorkflow(workflowId: string): void {
    boundWorkflowId.value = workflowId
    rememberedWorkflowId = workflowId
  }

  return {
    boundWorkflowId: computed(() => boundWorkflowId.value),
    bindWorkflow,
    isSending,
    editableTurnId,
    start,
    stop,
    sendMessage,
    stopTurn,
    interactionView: interactions?.view,
    respondInteraction: interactions?.respond,
    answerAsk,
    answeringAskIds: computed(() => answeringAskIds.value),
    newChat,
    listThreads,
    loadThread,
    entries: computed(() => conversationStore.entries),
    status: computed(() => conversationStore.status),
    isStreaming: computed(() => conversationStore.isStreaming),
    notices: computed(() => notices.value),
    threadId: computed(() => conversationStore.threadId)
  }
}
