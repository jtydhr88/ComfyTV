import os
import re
import shutil

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(os.path.dirname(os.path.dirname(HERE)), "src", "agent", "native")
OVERRIDES = os.path.join(HERE, "overrides")


def rw(rel, fn):
    p = os.path.join(ROOT, rel)
    s = open(p, encoding="utf-8").read()
    n = fn(s)
    if n != s:
        open(p, "w", encoding="utf-8", newline="\n").write(n)
        print("patched", rel)


def cut(s, start_marker, end_marker, replacement=""):
    i = s.index(start_marker)
    j = s.index(end_marker, i) + len(end_marker)
    return s[:i] + replacement + s[j:]


def replace_once(s, old, new):
    assert old in s, f"expected {old!r}"
    return s.replace(old, new, 1)


MINIMAP_FORCE = (
    "    if (\n"
    "      activity.phase === 'running' &&\n"
    "      !settingStore.get('Comfy.Minimap.Visible')\n"
    "    )\n"
    "      void settingStore.set('Comfy.Minimap.Visible', true)\n"
)


def panel_root(s):
    s = cut(s, "import {\n  isCrdtDebugEnabled,", "import { useAgentCrdtFollower } from './crdt/useAgentCrdtFollower'\n")
    s = cut(s, "const CrdtDevPanel = defineAsyncComponent(", ")\n\n")
    s = cut(s, "const graphMutationsByWorkflow = new Map<", "  return mutations\n}\n")
    s = cut(s, "// The CRDT follower is the inbound content channel:",
            "  isCrdtDebugEnabled()\n)\n",
            "const mintPortWiring = { detach(): void {} }\nconst isCrdtDevPanelEnabled = false\n")
    s = cut(s, '      <template v-if="isCrdtDevPanelEnabled" #instrument>', "      </template>\n")
    s = replace_once(s, MINIMAP_FORCE, "")
    s = s.replace("const settingStore = useSettingStore()\n", "")
    for line in (
        "import { createGraphMutations } from '@/workbench/extensions/agent/crdt/graphMutations'\n",
        "import { useSettingStore } from '@/platform/settings/settingStore'\n",
        "import { layoutStore } from '@/renderer/core/layout/store/layoutStore'\n",
        "import { ACTOR_CONFIG } from '@/renderer/core/layout/constants'\n",
        "import { LayoutSource } from '@/renderer/core/layout/types'\n",
    ):
        s = s.replace(line, "")
    s = replace_once(s, "\nstart()\n",
                     "\nstart()\n"
                     "if (\n"
                     "  agentPanelStore.canRestoreWorkflow &&\n"
                     "  localStorage.getItem('ComfyTV.Agent.ThreadId') === null\n"
                     ")\n"
                     "  agentPanelStore.setWorkflowTarget(workflowStore.activeWorkflow)\n"
                     "watch(newChatRequests, () => onNewChat())\n"
                     "watch(status, (value) => {\n"
                     "  agentBusy.value = value !== 'idle'\n"
                     "}, { immediate: true })\n")
    s = replace_once(s, "import { app } from '@/scripts/app'\n",
                     "import { app } from '@/scripts/app'\n"
                     "import { agentBusy, newChatRequests } from '@/comfytv/actions'\n")
    s = re.sub(r"// The composition root injects.*?\n(?:// .*\n)*", "", s)
    s = re.sub(r"// eslint-disable-next-line import-x/no-restricted-paths\n", "", s)
    s = replace_once(s, ':available-workflows="availableWorkflowReferences"', ':available-workflows="[]"')
    s = replace_once(s, "import { app } from '@/scripts/app'\n",
                     "import { app } from '@/scripts/app'\n"
                     "import {\n  assetIdOf,\n  droppedComfyTVAssets,\n  isComfyTVAssetDrag,\n"
                     "  openAssetPicker,\n  toAttachment,\n  uploadToLibrary\n} from '@/comfytv/assets'\n"
                     "import {\n  closeEaglePicker,\n  droppedEagleAssets,\n  eagleAvailable,\n"
                     "  isEagleDrag,\n  openEaglePicker\n} from '@/comfytv/eagle'\n")
    s = replace_once(
        s,
        "  upload: async (file) => {\n"
        "    const uploaded = await rest.uploadImage(file, file.name)\n"
        "    // The library caches input assets; without this refresh a just-uploaded\n"
        "    // file is neither listed in the Assets tab nor mentionable this session.\n"
        "    void assetsStore.inputAssets.loadNew()\n"
        "    return {\n"
        "      ref: uploaded.name,\n"
        "      url: api.apiURL(\n"
        "        `/view?filename=${encodeURIComponent(uploaded.name)}&type=input`\n"
        "      )\n"
        "    }\n"
        "  },\n",
        "  upload: (file) => uploadToLibrary(file),\n")
    s = replace_once(
        s,
        "function onOpenAssets(): void {\n"
        "  exitNodeSelectionMode()\n"
        "  sidebarTabStore.activeSidebarTabId = 'assets'\n"
        "}\n",
        "const attachedAssetIds = (): number[] =>\n"
        "  composerStore.attachments.flatMap((item) => {\n"
        "    const id = assetIdOf(item.ref)\n"
        "    return id === null ? [] : [id]\n"
        "  })\n"
        "\n"
        "function onOpenEagle(): void {\n"
        "  exitNodeSelectionMode()\n"
        "  openEaglePicker({\n"
        "    addedIds: attachedAssetIds,\n"
        "    select: (asset) => panelRef.value?.addAttachment(toAttachment(asset)),\n"
        "    deselect: (asset) => composerStore.removeAttachment(toAttachment(asset).id)\n"
        "  })\n"
        "}\n"
        "\n"
        "function onOpenAssets(): void {\n"
        "  exitNodeSelectionMode()\n"
        "  closeEaglePicker()\n"
        "  openAssetPicker({\n"
        "    addedIds: attachedAssetIds,\n"
        "    select: (asset) => panelRef.value?.addAttachment(toAttachment(asset)),\n"
        "    deselect: (asset) => composerStore.removeAttachment(toAttachment(asset).id)\n"
        "  })\n"
        "}\n")
    s = replace_once(
        s,
        "  return (event.dataTransfer?.types ?? []).includes(MIME_ASSET_INFO)\n",
        "  return (\n"
        "    (event.dataTransfer?.types ?? []).includes(MIME_ASSET_INFO) ||\n"
        "    isComfyTVAssetDrag(event.dataTransfer) ||\n"
        "    isEagleDrag(event.dataTransfer)\n"
        "  )\n")
    s = replace_once(
        s,
        "async function attachDroppedAsset(event: DragEvent): Promise<void> {\n",
        "async function attachDroppedAsset(event: DragEvent): Promise<void> {\n"
        "  if (event.dataTransfer && isEagleDrag(event.dataTransfer)) {\n"
        "    for (const item of await droppedEagleAssets(event.dataTransfer))\n"
        "      panelRef.value?.addAttachment(item)\n"
        "    return\n"
        "  }\n"
        "  if (event.dataTransfer && isComfyTVAssetDrag(event.dataTransfer)) {\n"
        "    for (const item of droppedComfyTVAssets(event.dataTransfer))\n"
        "      panelRef.value?.addAttachment(item)\n"
        "    return\n"
        "  }\n")
    s = replace_once(
        s,
        '      :can-open-assets="!isBuilderMode"\n',
        '      :can-open-assets="!isBuilderMode"\n'
        '      :can-open-eagle="!isBuilderMode && eagleAvailable"\n')
    s = replace_once(
        s,
        '      @open-assets="onOpenAssets"\n',
        '      @open-assets="onOpenAssets"\n'
        '      @open-eagle="onOpenEagle"\n')
    assert "crdt/" not in s and "useAgentCrdtFollower" not in s, "crdt residue"
    return s


EAGLE_MENU_ITEM = (
    "              <DropdownMenuItem\n"
    '                v-if="canOpenEagle"\n'
    '                class="ctv:box-border ctv:flex ctv:h-7 ctv:w-full ctv:cursor-pointer'
    " ctv:items-center ctv:gap-1.5 ctv:rounded-lg ctv:px-1.5 ctv:py-1 ctv:text-[14px]/5"
    " ctv:font-normal ctv:text-base-foreground ctv:outline-none"
    ' ctv:data-highlighted:bg-secondary-background-hover"\n'
    "                @select=\"emit('openEagle')\"\n"
    "              >\n"
    '                <span class="ctv:icon-[lucide--bird] ctv:size-4 ctv:shrink-0" />\n'
    '                <span class="ctv:whitespace-nowrap">\n'
    "                  {{ t('agent.addFromEagle') }}\n"
    "                </span>\n"
    "              </DropdownMenuItem>\n"
)


def eagle_prop(s):
    s = replace_once(s, "  canOpenAssets = false,\n",
                     "  canOpenAssets = false,\n  canOpenEagle = false,\n")
    s = replace_once(s, "  canOpenAssets?: boolean\n",
                     "  canOpenAssets?: boolean\n  canOpenEagle?: boolean\n")
    return replace_once(s, "  openAssets: []\n", "  openAssets: []\n  openEagle: []\n")


def composer(s):
    s = cut(s, "              <DropdownMenuSub\n                v-model:open=\"workflowSubmenuOpen\"",
            "              </DropdownMenuSub>\n")
    s = eagle_prop(s)
    s = replace_once(
        s,
        "              <DropdownMenuSeparator\n"
        '                v-if="canAttach && canOpenAssets"\n',
        EAGLE_MENU_ITEM
        + "              <DropdownMenuSeparator\n"
        '                v-if="canAttach && (canOpenAssets || canOpenEagle)"\n')
    return s


def transcript(s):
    return replace_once(
        s,
        "  return names.length > 0\n"
        "    ? names.map((name) => ({ name, ref: name }))\n"
        "    : undefined\n",
        "  const previews = content?.attachment_previews as Record<string, string> | undefined\n"
        "  const labels = content?.attachment_labels as Record<string, string> | undefined\n"
        "  return names.length > 0\n"
        "    ? names.map((name) => ({\n"
        "        name: labels?.[name] ?? name,\n"
        "        ref: name,\n"
        "        previewUrl: previews?.[name]\n"
        "      }))\n"
        "    : undefined\n")


def api_schema(s):
    return s.replace("z.SafeParseReturnType<unknown, AgentWsEvent>",
                     "ReturnType<typeof zAgentWsEvent.safeParse>")


def rest_client(s):
    n = len(re.findall(r"(['`])/agent/", s))
    assert n >= 5, "rest paths moved"
    s = re.sub(r"(['`])/agent/", r"\1/comfytv/agent/", s)
    return replace_once(s, "`/workflows?limit=", "`/comfytv/agent/workflows?limit=")


def event_source(s):
    s = replace_once(s, "host.addCustomEventListener(type, onEvent)",
                     "host.addCustomEventListener(`comfytv_${type}`, onEvent)")
    return replace_once(s, "host.removeCustomEventListener(type, onEvent)",
                        "host.removeCustomEventListener(`comfytv_${type}`, onEvent)")


def panel_header(s):
    return cut(s, "    <span\n      class=\"shrink-0 rounded-full", "</span>\n")


def run_mode_popover(s):
    return replace_once(s, '@update:model-value="onSelectMode"',
                        '@update:model-value="(value) => onSelectMode(String(value))"')


def workflow_chip(s):
    return replace_once(s, '@update:model-value="onSelectTab"',
                        '@update:model-value="(value) => onSelectTab(String(value))"')


RESTORE_NO_ID = "    if (workflowId === undefined) return\n    await refreshCloudWorkflowIds()\n"


def workflow_selection(s):
    return replace_once(s, RESTORE_NO_ID,
                        "    if (workflowId === undefined) {\n"
                        "      panelStore.setWorkflowTarget(workflowStore.activeWorkflow)\n"
                        "      return\n"
                        "    }\n"
                        "    await refreshCloudWorkflowIds()\n")


def agent_panel(s):
    s = eagle_prop(s)
    s = replace_once(s, "            :can-open-assets\n",
                     "            :can-open-assets\n            :can-open-eagle\n")
    s = replace_once(s, "            @open-assets=\"emit('openAssets')\"\n",
                     "            @open-assets=\"emit('openAssets')\"\n"
                     "            @open-eagle=\"emit('openEagle')\"\n")
    s = cut(s, "          <RunNoticeBanner\n", "/>\n")
    s = cut(s, "            <template #header>\n", "            </template>\n")
    s = replace_once(s, "import RunNoticeBanner from './RunNoticeBanner.vue'\n", "")
    s = replace_once(s, "import WorkflowSelectorChip from './composer/WorkflowSelectorChip.vue'\n", "")
    return replace_once(
        s,
        "const workflowSelectorRef = ref<InstanceType<typeof WorkflowSelectorChip>>()\n\n"
        "function onWorkflowTargetRequired(): void {\n"
        "  workflowSelectorRef.value?.openPicker()\n"
        "}\n",
        "function onWorkflowTargetRequired(): void {}\n")


def message_feedback(s):
    i = s.index("    <AccessibleTooltip\n      :label=\"t('agent.helpful')\"")
    j = s.index("    <AccessibleTooltip\n      v-if=\"assets.length\"")
    s = s[:i] + s[j:]
    return replace_once(
        s,
        "const vote = ref<'up' | 'down' | null>(null)\n\n"
        "function setVote(next: 'up' | 'down'): void {\n"
        "  vote.value = vote.value === next ? null : next\n"
        "  emit('feedback', vote.value)\n"
        "}\n\n",
        "")


rw("AgentPanelRoot.vue", panel_root)
rw("components/agent/AgentPanel.vue", agent_panel)
rw("components/agent/Composer.vue", composer)
rw(
    "components/agent/composer/InlinePromptEditor.vue",
    lambda s: replace_once(
        s, '<div ref="host" />', '<div ref="host" @copy.stop @cut.stop @paste.stop />'
    ),
)
rw("components/agent/message/MessageFeedback.vue", message_feedback)
rw("services/agent/agentTranscript.ts", transcript)
rw("schemas/agentApiSchema.ts", api_schema)
rw("services/agent/agentRestClient.ts", rest_client)
rw("services/agent/agentEventSource.ts", event_source)
rw("components/agent/PanelHeader.vue", panel_header)
rw("components/agent/composer/RunModePopover.vue", run_mode_popover)
rw("components/agent/composer/WorkflowSelectorChip.vue", workflow_chip)
rw("composables/agent/useAgentWorkflowSelection.ts", workflow_selection)

for r, _, fs in os.walk(OVERRIDES):
    for f in fs:
        src = os.path.join(r, f)
        rel = os.path.relpath(src, OVERRIDES)
        dst = os.path.join(ROOT, rel)
        os.makedirs(os.path.dirname(dst), exist_ok=True)
        shutil.copyfile(src, dst)
        print("override", rel.replace(os.sep, "/"))

WORKBENCH = re.compile(r"'@/workbench/extensions/agent/([^']+)'")
ICON_COMPONENT = re.compile(r"<i-lucide:([a-z0-9-]+)((?:\s+[^\s/>]+(?:=\"[^\"]*\")?)*)\s*/>")
BRAND_ICON = ("icon-[comfy--comfy-c]", "icon-[lucide--bot]")


def icon_component(m: re.Match) -> str:
    name, attrs = m.group(1), m.group(2) or ""
    icon = f"icon-[lucide--{name}]"
    if 'class="' in attrs:
        attrs = attrs.replace('class="', f'class="{icon} ', 1)
    else:
        attrs += f' class="{icon}"'
    return f"<i{attrs} />"
STORAGE_KEYS = re.compile(r"'Comfy\.(Agent|AgentPanel)\.(?!open')")

for r, _, fs in os.walk(ROOT):
    for f in fs:
        p = os.path.join(r, f)
        s = open(p, encoding="utf-8").read()
        rewritten = STORAGE_KEYS.sub(r"'ComfyTV.\1.", s)
        rewritten = ICON_COMPONENT.sub(icon_component, rewritten).replace(*BRAND_ICON)
        if rewritten != s:
            open(p, "w", encoding="utf-8", newline="\n").write(rewritten)
            s = rewritten
        if "@/workbench/extensions/agent" not in s:
            continue

        def rel(m):
            target = os.path.join(ROOT, m.group(1))
            path = os.path.relpath(target, os.path.dirname(p)).replace(os.sep, "/")
            if not path.startswith("."):
                path = "./" + path
            return f"'{path}'"

        s = WORKBENCH.sub(rel, s)
        open(p, "w", encoding="utf-8", newline="\n").write(s)
        print("relinked", os.path.relpath(p, ROOT))
print("ok")
