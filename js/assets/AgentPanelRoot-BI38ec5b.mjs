var __defProp = Object.defineProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
var _a;
import { bn as defineComponent, cC as useVModel, cc as toRefs, cq as useForwardExpose, bT as openBlock, be as createBlock, cJ as withCtx, c2 as renderSlot, cg as unref, aj as Primitive, bg as createContext, ct as useId, c0 as ref, cG as watch, bK as nextTick, bQ as onMounted, co as useEventListener, bl as createVNode, bI as mergeProps, bf as createCommentVNode, ai as Presence_default, bb as computed, bh as createElementBlock, bA as injectPopperContentContext, bN as normalizeStyle, cn as useEmitAsProps, bM as normalizeProps, bt as guardReactiveProps, a6 as MenuItem_default, bw as hostStore, b2 as app, bX as parseNodeLocatorId, bx as hostVersion, bv as hostManager, bo as defineStore, cz as useStorage, ce as toValue, b9 as clsx, bL as normalizeClass, ba as cn, cy as useModel, cA as useTemplateRef, cK as withDirectives, cF as vModelText, bH as mergeModels, a$ as _export_sfc, aN as TooltipProvider_default, aO as TooltipRoot_default, aP as TooltipTrigger_default, bd as createBaseVNode, cM as withModifiers, aM as TooltipPortal_default, aL as TooltipContent_default, bk as createTextVNode, c9 as toDisplayString, cs as useI18n, M as Fragment, c1 as renderList, y as DropdownMenuRoot_default, z as DropdownMenuTrigger_default, v as DropdownMenuPortal_default, u as DropdownMenuContent_default, bs as getCurrentScope, bR as onScopeDispose, av as Schema, bF as isNodeLocatorId, bu as history, bG as keymap, b$ as redo, cf as undo, b5 as baseKeymap, G as EditorView, D as DOMParser$1, aB as Slice, N as Fragment$1, b8 as closeHistory, q as Decoration, r as DecorationSet, aI as TextSelection, bP as onBeforeUnmount, F as EditorState, c5 as shallowRef, c7 as storeToRefs, cj as useAgentRunModeStore, cu as useId$1, c4 as resolveDirective, b6 as buildTooltipConfig, w as DropdownMenuRadioGroup_default, x as DropdownMenuRadioItem_default, c3 as reportError, bz as inject, bE as isMemoSame, ck as useClipboard, cH as watchDebounced, b1 as api, bZ as reactiveOmit, cr as useForwardPropsEmits, aD as SliderRoot_default, aF as SliderTrack_default, aC as SliderRange_default, aE as SliderThumb_default, cx as useMediaControls, cI as whenever, cb as toRef, bm as defineAsyncComponent, cw as useLocalStorage, cE as useWorkflowStore, ca as toRaw, ci as useAgentPanelStore, l as DOMSerializer, cl as useClipboardItems, cL as withKeys, cv as useIntersectionObserver, bj as createSlots, aH as Teleport, bi as createNodeLocatorId, cm as useElementBounding, cp as useFloating, b4 as autoUpdate, L as FocusScope_default, bO as offset, c6 as shift, cD as useWindowSize, by as i18n, a as AgentApiError, cd as toTurnId, bB as isAgentEvent, bV as parseAgentWsEvent, cO as zDisownedWorkflowError, cN as zAgentAdmissionError, A as AGENT_WS_EVENT_TYPES, cB as useTimestamp, bW as parseNodeId, bJ as newChatRequests, b0 as agentBusy, bY as provide, br as eagleAvailable, bU as openEaglePicker, b7 as closeEaglePicker, bS as openAssetPicker, bC as isComfyTVAssetDrag, bD as isEagleDrag, bq as droppedEagleAssets, bp as droppedComfyTVAssets, ch as uploadToLibrary, c8 as toAttachment, bc as createAgentRestClient, b3 as assetIdOf, b_ as readonly } from "./main-xCN3Vn62.mjs";
const [injectCollapsibleRootContext, provideCollapsibleRootContext] = /* @__PURE__ */ createContext("CollapsibleRoot");
var CollapsibleRoot_vue_vue_type_script_setup_true_lang_default = /* @__PURE__ */ defineComponent({
  __name: "CollapsibleRoot",
  props: {
    defaultOpen: {
      type: Boolean,
      required: false,
      default: false
    },
    open: {
      type: Boolean,
      required: false,
      default: void 0
    },
    disabled: {
      type: Boolean,
      required: false
    },
    unmountOnHide: {
      type: Boolean,
      required: false,
      default: true
    },
    asChild: {
      type: Boolean,
      required: false
    },
    as: {
      type: null,
      required: false
    }
  },
  emits: ["update:open"],
  setup(__props, { expose: __expose, emit: __emit }) {
    const props = __props;
    const emit = __emit;
    const open = useVModel(props, "open", emit, {
      defaultValue: props.defaultOpen,
      passive: props.open === void 0
    });
    const { disabled, unmountOnHide } = toRefs(props);
    provideCollapsibleRootContext({
      contentId: "",
      disabled,
      open,
      unmountOnHide,
      onOpenToggle: () => {
        if (disabled.value) return;
        open.value = !open.value;
      }
    });
    __expose({ open });
    useForwardExpose();
    return (_ctx, _cache) => {
      return openBlock(), createBlock(unref(Primitive), {
        as: _ctx.as,
        "as-child": props.asChild,
        "data-state": unref(open) ? "open" : "closed",
        "data-disabled": unref(disabled) ? "" : void 0
      }, {
        default: withCtx(() => [renderSlot(_ctx.$slots, "default", { open: unref(open) })]),
        _: 3
      }, 8, [
        "as",
        "as-child",
        "data-state",
        "data-disabled"
      ]);
    };
  }
});
var CollapsibleRoot_default = CollapsibleRoot_vue_vue_type_script_setup_true_lang_default;
var CollapsibleContent_vue_vue_type_script_setup_true_lang_default = /* @__PURE__ */ defineComponent({
  inheritAttrs: false,
  __name: "CollapsibleContent",
  props: {
    forceMount: {
      type: Boolean,
      required: false
    },
    asChild: {
      type: Boolean,
      required: false
    },
    as: {
      type: null,
      required: false
    }
  },
  emits: ["contentFound"],
  setup(__props, { emit: __emit }) {
    const props = __props;
    const emits = __emit;
    const rootContext = injectCollapsibleRootContext();
    rootContext.contentId || (rootContext.contentId = useId(void 0, "reka-collapsible-content"));
    const presentRef = ref();
    const { forwardRef, currentElement } = useForwardExpose();
    const width = ref(0);
    const height = ref(0);
    const isOpen = computed(() => rootContext.open.value);
    const isMountAnimationPrevented = ref(isOpen.value);
    const currentStyle = ref();
    watch(() => {
      var _a2;
      return [isOpen.value, (_a2 = presentRef.value) == null ? void 0 : _a2.present];
    }, async () => {
      await nextTick();
      const node = currentElement.value;
      if (!node) return;
      currentStyle.value = currentStyle.value || {
        transitionDuration: node.style.transitionDuration,
        animationName: node.style.animationName
      };
      node.style.transitionDuration = "0s";
      node.style.animationName = "none";
      const rect = node.getBoundingClientRect();
      height.value = rect.height;
      width.value = rect.width;
      if (!isMountAnimationPrevented.value) {
        node.style.transitionDuration = currentStyle.value.transitionDuration;
        node.style.animationName = currentStyle.value.animationName;
      }
    }, { immediate: true });
    const skipAnimation = computed(() => isMountAnimationPrevented.value && rootContext.open.value);
    onMounted(() => {
      requestAnimationFrame(() => {
        isMountAnimationPrevented.value = false;
      });
    });
    useEventListener(currentElement, "beforematch", (ev) => {
      requestAnimationFrame(() => {
        rootContext.onOpenToggle();
        emits("contentFound");
      });
    });
    return (_ctx, _cache) => {
      return openBlock(), createBlock(unref(Presence_default), {
        ref_key: "presentRef",
        ref: presentRef,
        present: _ctx.forceMount || unref(rootContext).open.value,
        "force-mount": true
      }, {
        default: withCtx(({ present }) => {
          var _a2;
          return [createVNode(unref(Primitive), mergeProps(_ctx.$attrs, {
            id: unref(rootContext).contentId,
            ref: unref(forwardRef),
            "as-child": props.asChild,
            as: _ctx.as,
            hidden: !present ? unref(rootContext).unmountOnHide.value ? "" : "until-found" : void 0,
            "data-state": skipAnimation.value ? void 0 : unref(rootContext).open.value ? "open" : "closed",
            "data-disabled": ((_a2 = unref(rootContext).disabled) == null ? void 0 : _a2.value) ? "" : void 0,
            style: {
              [`--reka-collapsible-content-height`]: `${height.value}px`,
              [`--reka-collapsible-content-width`]: `${width.value}px`
            }
          }), {
            default: withCtx(() => [(unref(rootContext).unmountOnHide.value ? present : true) ? renderSlot(_ctx.$slots, "default", { key: 0 }) : createCommentVNode("v-if", true)]),
            _: 2
          }, 1040, [
            "id",
            "as-child",
            "as",
            "hidden",
            "data-state",
            "data-disabled",
            "style"
          ])];
        }),
        _: 3
      }, 8, ["present"]);
    };
  }
});
var CollapsibleContent_default = CollapsibleContent_vue_vue_type_script_setup_true_lang_default;
var CollapsibleTrigger_vue_vue_type_script_setup_true_lang_default = /* @__PURE__ */ defineComponent({
  __name: "CollapsibleTrigger",
  props: {
    asChild: {
      type: Boolean,
      required: false
    },
    as: {
      type: null,
      required: false,
      default: "button"
    }
  },
  setup(__props) {
    const props = __props;
    useForwardExpose();
    const rootContext = injectCollapsibleRootContext();
    return (_ctx, _cache) => {
      var _a2, _b;
      return openBlock(), createBlock(unref(Primitive), {
        type: _ctx.as === "button" ? "button" : void 0,
        as: _ctx.as,
        "as-child": props.asChild,
        "aria-controls": unref(rootContext).contentId,
        "aria-expanded": unref(rootContext).open.value,
        "data-state": unref(rootContext).open.value ? "open" : "closed",
        "data-disabled": ((_a2 = unref(rootContext).disabled) == null ? void 0 : _a2.value) ? "" : void 0,
        disabled: (_b = unref(rootContext).disabled) == null ? void 0 : _b.value,
        onClick: unref(rootContext).onOpenToggle
      }, {
        default: withCtx(() => [renderSlot(_ctx.$slots, "default")]),
        _: 3
      }, 8, [
        "type",
        "as",
        "as-child",
        "aria-controls",
        "aria-expanded",
        "data-state",
        "data-disabled",
        "disabled",
        "onClick"
      ]);
    };
  }
});
var CollapsibleTrigger_default = CollapsibleTrigger_vue_vue_type_script_setup_true_lang_default;
const _hoisted_1$t = {
  key: 0,
  d: "M0 0L6 6L12 0"
};
const _hoisted_2$o = {
  key: 1,
  d: "M0 0L4.58579 4.58579C5.36683 5.36683 6.63316 5.36684 7.41421 4.58579L12 0"
};
var Arrow_vue_vue_type_script_setup_true_lang_default = /* @__PURE__ */ defineComponent({
  __name: "Arrow",
  props: {
    width: {
      type: Number,
      required: false,
      default: 10
    },
    height: {
      type: Number,
      required: false,
      default: 5
    },
    rounded: {
      type: Boolean,
      required: false
    },
    asChild: {
      type: Boolean,
      required: false
    },
    as: {
      type: null,
      required: false,
      default: "svg"
    }
  },
  setup(__props) {
    const props = __props;
    useForwardExpose();
    return (_ctx, _cache) => {
      return openBlock(), createBlock(unref(Primitive), mergeProps(props, {
        width: _ctx.width,
        height: _ctx.height,
        viewBox: _ctx.asChild ? void 0 : "0 0 12 6",
        preserveAspectRatio: _ctx.asChild ? void 0 : "none"
      }), {
        default: withCtx(() => [renderSlot(_ctx.$slots, "default", {}, () => [!_ctx.rounded ? (openBlock(), createElementBlock("path", _hoisted_1$t)) : (openBlock(), createElementBlock("path", _hoisted_2$o))])]),
        _: 3
      }, 16, [
        "width",
        "height",
        "viewBox",
        "preserveAspectRatio"
      ]);
    };
  }
});
var Arrow_default = Arrow_vue_vue_type_script_setup_true_lang_default;
const OPPOSITE_SIDE = {
  top: "bottom",
  right: "left",
  bottom: "top",
  left: "right"
};
var PopperArrow_vue_vue_type_script_setup_true_lang_default = /* @__PURE__ */ defineComponent({
  inheritAttrs: false,
  __name: "PopperArrow",
  props: {
    width: {
      type: Number,
      required: false
    },
    height: {
      type: Number,
      required: false
    },
    rounded: {
      type: Boolean,
      required: false
    },
    asChild: {
      type: Boolean,
      required: false
    },
    as: {
      type: null,
      required: false,
      default: "svg"
    }
  },
  setup(__props) {
    const { forwardRef } = useForwardExpose();
    const contentContext = injectPopperContentContext();
    const baseSide = computed(() => OPPOSITE_SIDE[contentContext.placedSide.value]);
    return (_ctx, _cache) => {
      var _a2, _b, _c, _d;
      return openBlock(), createElementBlock("span", {
        ref: (el) => {
          unref(contentContext).onArrowChange(el ?? void 0);
          return void 0;
        },
        style: normalizeStyle({
          position: "absolute",
          left: ((_a2 = unref(contentContext).arrowX) == null ? void 0 : _a2.value) ? `${(_b = unref(contentContext).arrowX) == null ? void 0 : _b.value}px` : void 0,
          top: ((_c = unref(contentContext).arrowY) == null ? void 0 : _c.value) ? `${(_d = unref(contentContext).arrowY) == null ? void 0 : _d.value}px` : void 0,
          [baseSide.value]: 0,
          transformOrigin: {
            top: "",
            right: "0 0",
            bottom: "center 0",
            left: "100% 0"
          }[unref(contentContext).placedSide.value],
          transform: {
            top: "translateY(100%)",
            right: "translateY(50%) rotate(90deg) translateX(-50%)",
            bottom: `rotate(180deg)`,
            left: "translateY(50%) rotate(-90deg) translateX(50%)"
          }[unref(contentContext).placedSide.value],
          visibility: unref(contentContext).shouldHideArrow.value ? "hidden" : void 0
        })
      }, [createVNode(Arrow_default, mergeProps(_ctx.$attrs, {
        ref: unref(forwardRef),
        style: { display: "block" },
        as: _ctx.as,
        "as-child": _ctx.asChild,
        rounded: _ctx.rounded,
        width: _ctx.width,
        height: _ctx.height
      }), {
        default: withCtx(() => [renderSlot(_ctx.$slots, "default")]),
        _: 3
      }, 16, [
        "as",
        "as-child",
        "rounded",
        "width",
        "height"
      ])], 4);
    };
  }
});
var PopperArrow_default = PopperArrow_vue_vue_type_script_setup_true_lang_default;
var MenuSeparator_vue_vue_type_script_setup_true_lang_default = /* @__PURE__ */ defineComponent({
  __name: "MenuSeparator",
  props: {
    asChild: {
      type: Boolean,
      required: false
    },
    as: {
      type: null,
      required: false
    }
  },
  setup(__props) {
    const props = __props;
    return (_ctx, _cache) => {
      return openBlock(), createBlock(unref(Primitive), mergeProps(props, {
        role: "separator",
        "aria-orientation": "horizontal"
      }), {
        default: withCtx(() => [renderSlot(_ctx.$slots, "default")]),
        _: 3
      }, 16);
    };
  }
});
var MenuSeparator_default = MenuSeparator_vue_vue_type_script_setup_true_lang_default;
var DropdownMenuItem_vue_vue_type_script_setup_true_lang_default = /* @__PURE__ */ defineComponent({
  __name: "DropdownMenuItem",
  props: {
    disabled: {
      type: Boolean,
      required: false
    },
    textValue: {
      type: String,
      required: false
    },
    asChild: {
      type: Boolean,
      required: false
    },
    as: {
      type: null,
      required: false
    }
  },
  emits: ["select"],
  setup(__props, { emit: __emit }) {
    const props = __props;
    const emits = __emit;
    const emitsAsProps = useEmitAsProps(emits);
    useForwardExpose();
    return (_ctx, _cache) => {
      return openBlock(), createBlock(unref(MenuItem_default), normalizeProps(guardReactiveProps({
        ...props,
        ...unref(emitsAsProps)
      })), {
        default: withCtx(() => [renderSlot(_ctx.$slots, "default")]),
        _: 3
      }, 16);
    };
  }
});
var DropdownMenuItem_default = DropdownMenuItem_vue_vue_type_script_setup_true_lang_default;
var DropdownMenuSeparator_vue_vue_type_script_setup_true_lang_default = /* @__PURE__ */ defineComponent({
  __name: "DropdownMenuSeparator",
  props: {
    asChild: {
      type: Boolean,
      required: false
    },
    as: {
      type: null,
      required: false
    }
  },
  setup(__props) {
    const props = __props;
    useForwardExpose();
    return (_ctx, _cache) => {
      return openBlock(), createBlock(unref(MenuSeparator_default), normalizeProps(guardReactiveProps(props)), {
        default: withCtx(() => [renderSlot(_ctx.$slots, "default")]),
        _: 3
      }, 16);
    };
  }
});
var DropdownMenuSeparator_default = DropdownMenuSeparator_vue_vue_type_script_setup_true_lang_default;
var TooltipArrow_vue_vue_type_script_setup_true_lang_default = /* @__PURE__ */ defineComponent({
  __name: "TooltipArrow",
  props: {
    width: {
      type: Number,
      required: false,
      default: 10
    },
    height: {
      type: Number,
      required: false,
      default: 5
    },
    asChild: {
      type: Boolean,
      required: false
    },
    as: {
      type: null,
      required: false,
      default: "svg"
    }
  },
  setup(__props) {
    const props = __props;
    useForwardExpose();
    return (_ctx, _cache) => {
      return openBlock(), createBlock(unref(PopperArrow_default), normalizeProps(guardReactiveProps(props)), {
        default: withCtx(() => [renderSlot(_ctx.$slots, "default")]),
        _: 3
      }, 16);
    };
  }
});
var TooltipArrow_default = TooltipArrow_vue_vue_type_script_setup_true_lang_default;
const resolvedUserInfo = ref(null);
const userDisplayName = ref(void 0);
const userEmail = ref(void 0);
const isLoggedIn = ref(false);
function useCurrentUser() {
  return { resolvedUserInfo, userDisplayName, userEmail, isLoggedIn };
}
function useTelemetry() {
  return null;
}
function useWorkflowService() {
  return {
    async openWorkflow(workflow) {
      var _a2;
      const store = hostStore("workflow");
      if (((_a2 = store == null ? void 0 : store.activeWorkflow) == null ? void 0 : _a2.path) === workflow.path) return true;
      const loaded = typeof workflow.load === "function" ? await workflow.load() : workflow;
      const content = loaded.activeState ?? loaded.originalContent;
      if (!content) return false;
      await app.loadGraphData(content, true, true, loaded);
      return true;
    },
    async saveWorkflowAs(workflow, options = {}) {
      var _a2, _b, _c;
      const store = hostStore("workflow");
      if (!store || !options.filename) return false;
      const directory = typeof workflow.directory === "string" ? workflow.directory : workflow.path.split("/").slice(0, -1).join("/");
      const isApp = options.isApp ?? workflow.initialMode === "app";
      const newPath = `${directory}/${options.filename}${isApp ? ".app" : ""}.json`;
      const existing = (_a2 = store.getWorkflowByPath) == null ? void 0 : _a2.call(store, newPath);
      if (existing && !existing.isTemporary) return false;
      if (workflow.isTemporary) {
        await store.renameWorkflow(workflow, newPath);
        (_c = (_b = workflow.changeTracker) == null ? void 0 : _b.prepareForSave) == null ? void 0 : _c.call(_b);
        await store.saveWorkflow(workflow);
        return true;
      }
      if (typeof workflow.saveAs !== "function") return false;
      const target = await workflow.saveAs(newPath);
      return this.openWorkflow(target);
    },
    async closeWorkflow(workflow, _options) {
      var _a2, _b;
      await ((_b = (_a2 = hostStore("workflow")) == null ? void 0 : _a2.closeWorkflow) == null ? void 0 : _b.call(_a2, workflow));
    }
  };
}
const isBuilderMode = ref(false);
function useAppMode() {
  return { isBuilderMode };
}
const MIME_ASSET_INFO = "application/x-comfy-asset-info";
function parseAssetInfo(dataTransfer) {
  const raw = dataTransfer == null ? void 0 : dataTransfer.getData(MIME_ASSET_INFO);
  if (!raw) return void 0;
  try {
    const parsed = JSON.parse(raw);
    return typeof parsed === "object" && parsed !== null ? parsed : void 0;
  } catch {
    return void 0;
  }
}
function getDroppedAsset(dataTransfer) {
  var _a2, _b;
  const asset = parseAssetInfo(dataTransfer);
  const name = (asset == null ? void 0 : asset.display_name) ?? (asset == null ? void 0 : asset.filename);
  const validTypes = ["text/uri-list", "text/x-moz-url"];
  const match = [...dataTransfer.types].find((type) => validTypes.includes(type));
  const uri = match && ((_b = (_a2 = dataTransfer.getData(match)) == null ? void 0 : _a2.split("\n")) == null ? void 0 : _b[0]);
  const ref2 = asset == null ? void 0 : asset.attachment_ref;
  return uri || ref2 ? { name: name ?? ref2 ?? uri, uri, ref: ref2, kind: asset == null ? void 0 : asset.media_kind, previewUrl: asset == null ? void 0 : asset.preview_url } : void 0;
}
async function fetchDroppedAsset({ name, uri }) {
  if (!uri) return void 0;
  try {
    const response = await fetch(uri);
    const blob = await response.blob();
    return new File([blob], name, { type: blob.type });
  } catch {
    return void 0;
  }
}
function hasImageType({ type }) {
  return type.startsWith("image");
}
function hasVideoType({ type }) {
  return type.startsWith("video");
}
const IMAGE_EXTENSIONS = ["png", "jpg", "jpeg", "gif", "webp", "bmp", "avif", "tif", "tiff", "svg"];
const VIDEO_EXTENSIONS = ["mp4", "m4v", "webm", "mov", "avi", "mkv"];
const AUDIO_EXTENSIONS = ["mp3", "wav", "ogg", "flac", "opus", "m4a"];
const THREE_D_EXTENSIONS = ["obj", "fbx", "gltf", "glb", "stl", "usdz", "ply", "spz", "splat", "ksplat"];
const TEXT_EXTENSIONS = ["txt", "md", "markdown", "json", "csv", "yaml", "yml", "xml", "log"];
function getMediaTypeFromFilename(filename) {
  var _a2;
  if (!filename) return "other";
  const ext = (_a2 = filename.split(".").pop()) == null ? void 0 : _a2.toLowerCase();
  if (!ext) return "other";
  if (IMAGE_EXTENSIONS.includes(ext)) return "image";
  if (VIDEO_EXTENSIONS.includes(ext)) return "video";
  if (AUDIO_EXTENSIONS.includes(ext)) return "audio";
  if (THREE_D_EXTENSIONS.includes(ext)) return "3D";
  if (TEXT_EXTENSIONS.includes(ext)) return "text";
  return "other";
}
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function isValidUuid(value) {
  return typeof value === "string" && UUID_RE.test(value);
}
function formatTime(seconds) {
  if (isNaN(seconds) || seconds === 0) return "0:00";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}
const MEDIA_ATTACHABLE_KINDS = /* @__PURE__ */ new Set(["image", "video", "audio"]);
const EXTRA_ATTACHABLE_EXTENSIONS = /* @__PURE__ */ new Set(["glb", "md", "txt"]);
const AGENT_ATTACH_ACCEPT = "image/*,video/*,audio/*,.mp4,.m4a,.mov,.mp3,.wav,.glb,.md,.txt,.json,application/json";
function isAgentAttachable(file) {
  var _a2;
  if (MEDIA_ATTACHABLE_KINDS.has(getMediaTypeFromFilename(file.name)))
    return true;
  const extension = ((_a2 = file.name.split(".").pop()) == null ? void 0 : _a2.toLowerCase()) ?? "";
  return EXTRA_ATTACHABLE_EXTENSIONS.has(extension);
}
function findSubgraphByUuid(graph, targetUuid) {
  var _a2;
  if (graph && "subgraphs" in graph && graph.subgraphs instanceof Map) {
    return graph.subgraphs.get(targetUuid) ?? null;
  }
  for (const node of (graph == null ? void 0 : graph.nodes) ?? []) {
    if (((_a2 = node.isSubgraphNode) == null ? void 0 : _a2.call(node)) && node.subgraph) {
      if (node.subgraph.id === targetUuid) return node.subgraph;
      const found = findSubgraphByUuid(node.subgraph, targetUuid);
      if (found) return found;
    }
  }
  return null;
}
function getNodeByLocatorId(rootGraph, locatorId) {
  if (!rootGraph) return null;
  const parsed = parseNodeLocatorId(locatorId);
  if (!parsed) return null;
  const { subgraphUuid, localNodeId } = parsed;
  if (!subgraphUuid) return rootGraph.getNodeById(localNodeId) || null;
  const target = findSubgraphByUuid(rootGraph, subgraphUuid);
  return target ? target.getNodeById(localNodeId) || null : null;
}
function getNodeByExecutionId(rootGraph, executionId) {
  if (!rootGraph) return null;
  const parts = executionId.split(":");
  let graph = rootGraph;
  for (const part of parts.slice(0, -1)) {
    const node = graph.getNodeById(Number(part)) ?? graph.getNodeById(part);
    if (!(node == null ? void 0 : node.subgraph)) return null;
    graph = node.subgraph;
  }
  const last = parts[parts.length - 1];
  return graph.getNodeById(Number(last)) ?? graph.getNodeById(last) ?? null;
}
function useCanvasStore() {
  const version = hostVersion("canvas");
  const host = () => hostStore("canvas");
  return {
    get canvas() {
      var _a2;
      version.value;
      return ((_a2 = host()) == null ? void 0 : _a2.canvas) ?? null;
    },
    get currentGraph() {
      var _a2;
      version.value;
      return ((_a2 = host()) == null ? void 0 : _a2.currentGraph) ?? null;
    },
    get linearMode() {
      var _a2;
      version.value;
      return ((_a2 = host()) == null ? void 0 : _a2.linearMode) === true;
    },
    get selectedItems() {
      var _a2;
      version.value;
      return ((_a2 = host()) == null ? void 0 : _a2.selectedItems) ?? [];
    },
    updateSelectedItems() {
      var _a2, _b;
      (_b = (_a2 = host()) == null ? void 0 : _a2.updateSelectedItems) == null ? void 0 : _b.call(_a2);
    }
  };
}
function registerMinimapDecorationLayer(_id) {
  return {
    replace() {
    },
    dispose() {
    }
  };
}
const blankGraph = {
  last_node_id: 0,
  last_link_id: 0,
  nodes: [],
  links: [],
  groups: [],
  config: {},
  extra: {},
  version: 0.4
};
function useAgentNodeSelectionStore() {
  const version = hostVersion("agentNodeSelection");
  const host = () => hostStore("agentNodeSelection");
  return {
    get isActive() {
      var _a2;
      version.value;
      return ((_a2 = host()) == null ? void 0 : _a2.isActive) === true;
    },
    get isLoadingWorkflow() {
      var _a2;
      version.value;
      return ((_a2 = host()) == null ? void 0 : _a2.isLoadingWorkflow) === true;
    },
    get restoredNodeIds() {
      var _a2;
      version.value;
      return ((_a2 = host()) == null ? void 0 : _a2.restoredNodeIds) ?? null;
    },
    enter() {
      var _a2, _b;
      (_b = (_a2 = host()) == null ? void 0 : _a2.enter) == null ? void 0 : _b.call(_a2);
    },
    exit() {
      var _a2, _b;
      (_b = (_a2 = host()) == null ? void 0 : _a2.exit) == null ? void 0 : _b.call(_a2);
    },
    finishWorkflowLoad() {
      var _a2, _b;
      (_b = (_a2 = host()) == null ? void 0 : _a2.finishWorkflowLoad) == null ? void 0 : _b.call(_a2);
    },
    nodeIds(path) {
      var _a2, _b;
      return ((_b = (_a2 = host()) == null ? void 0 : _a2.nodeIds) == null ? void 0 : _b.call(_a2, path)) ?? [];
    },
    saveNodeIds(path, ids) {
      var _a2, _b;
      (_b = (_a2 = host()) == null ? void 0 : _a2.saveNodeIds) == null ? void 0 : _b.call(_a2, path, ids);
    }
  };
}
function useToastStore() {
  return {
    add(message) {
      var _a2;
      const toast = (_a2 = hostManager()) == null ? void 0 : _a2.toast;
      if (toast == null ? void 0 : toast.add) toast.add(message);
      else console.info("[ComfyTV/agent]", message.summary ?? "", message.detail ?? "");
    }
  };
}
let pending = null;
function useExecutionErrorStore() {
  return {
    recordPromptError(error) {
      pending = { message: error.message, details: error.details };
    },
    showErrorOverlay() {
      if (!pending) return;
      useToastStore().add({ severity: "error", summary: pending.message, detail: pending.details, life: 8e3 });
      pending = null;
    }
  };
}
function useWorkflowTabActivityStore() {
  const version = hostVersion("workflowTabActivity");
  const host = () => hostStore("workflowTabActivity");
  return {
    get editingTabPath() {
      var _a2;
      version.value;
      return ((_a2 = host()) == null ? void 0 : _a2.editingTabPath) ?? null;
    },
    get unseenModifiedPaths() {
      var _a2;
      version.value;
      const paths = (_a2 = host()) == null ? void 0 : _a2.unseenModifiedPaths;
      return paths instanceof Set ? paths : new Set(paths ?? []);
    },
    setEditing(path) {
      var _a2, _b;
      (_b = (_a2 = host()) == null ? void 0 : _a2.setEditing) == null ? void 0 : _b.call(_a2, path);
    },
    setCreating(creating) {
      var _a2, _b;
      (_b = (_a2 = host()) == null ? void 0 : _a2.setCreating) == null ? void 0 : _b.call(_a2, creating);
    },
    markModified(path) {
      var _a2, _b;
      (_b = (_a2 = host()) == null ? void 0 : _a2.markModified) == null ? void 0 : _b.call(_a2, path);
    },
    markSeen(path) {
      var _a2, _b;
      (_b = (_a2 = host()) == null ? void 0 : _a2.markSeen) == null ? void 0 : _b.call(_a2, path);
    },
    pruneClosed(openPaths) {
      var _a2, _b;
      (_b = (_a2 = host()) == null ? void 0 : _a2.pruneClosed) == null ? void 0 : _b.call(_a2, openPaths);
    },
    clearAgentActivity() {
      var _a2, _b;
      (_b = (_a2 = host()) == null ? void 0 : _a2.clearAgentActivity) == null ? void 0 : _b.call(_a2);
    }
  };
}
function isLGraphNode(item) {
  var _a2;
  const ctor = window.LGraphNode ?? ((_a2 = window.LiteGraph) == null ? void 0 : _a2.LGraphNode);
  if (ctor) return item instanceof ctor;
  return typeof item === "object" && item !== null && "id" in item && "graph" in item && typeof item.getInputInfo === "function";
}
function toRootGraphId(id) {
  return id;
}
function toOwningGraphId(id) {
  return id;
}
const tier = ref(null);
function useBillingContext() {
  return { tier };
}
const canTopUp = ref(false);
const canSubscribeSelfServe = ref(false);
const hasResolvedCapabilities = ref(true);
function useBillingCapabilities() {
  return { canTopUp, canSubscribeSelfServe, hasResolvedCapabilities };
}
const useOnboardingTourStore = defineStore("onboardingTour", () => {
  const activeTour = ref(null);
  return { activeTour };
});
const workspaceRole = ref(void 0);
function useWorkspaceUI() {
  return { workspaceRole };
}
const useTeamWorkspaceStore = defineStore("teamWorkspace", () => {
  const activeWorkspaceId = ref("local");
  const isSwitching = ref(false);
  const workspaceTransitionGeneration = ref(0);
  async function initialize() {
  }
  return {
    activeWorkspaceId,
    isSwitching,
    workspaceTransitionGeneration,
    initialize
  };
});
const SHARED_ONBOARDING_KEY = "ComfyTV.AgentPanel.onboarded";
function scopedOnboardingKey(userId, workspaceId) {
  if (!userId || !workspaceId) return null;
  return `${SHARED_ONBOARDING_KEY}.${userId}.${workspaceId}`;
}
function adoptSharedOnboardingFlag(scopedKey) {
  try {
    if (localStorage.getItem(SHARED_ONBOARDING_KEY) !== "true") return;
    if (localStorage.getItem(scopedKey) === null)
      localStorage.setItem(scopedKey, "true");
    localStorage.removeItem(SHARED_ONBOARDING_KEY);
  } catch {
  }
}
function useOnboarding(steps, storageKey = SHARED_ONBOARDING_KEY) {
  const seen = useStorage(storageKey, false);
  const index = ref(0);
  const step = computed(() => toValue(steps)[index.value]);
  const active = computed(() => !seen.value && !!step.value);
  const isLast = computed(() => index.value === toValue(steps).length - 1);
  function finish() {
    seen.value = true;
  }
  function next() {
    if (!active.value) return;
    if (isLast.value) finish();
    else index.value += 1;
  }
  return { active, index, step, isLast, next, finish };
}
const falsyToString = (value) => typeof value === "boolean" ? `${value}` : value === 0 ? "0" : value;
const defineConfig = (options) => {
  const cx = function() {
    for (var _len = arguments.length, inputs = new Array(_len), _key = 0; _key < _len; _key++) {
      inputs[_key] = arguments[_key];
    }
    return clsx(inputs);
  };
  const cva2 = (config) => (props) => {
    var _config_compoundVariants;
    if ((config === null || config === void 0 ? void 0 : config.variants) == null) return cx(config === null || config === void 0 ? void 0 : config.base, props === null || props === void 0 ? void 0 : props.class, props === null || props === void 0 ? void 0 : props.className);
    const { variants, defaultVariants } = config;
    const getVariantClassNames = Object.keys(variants).map((variant) => {
      const variantProp = props === null || props === void 0 ? void 0 : props[variant];
      const defaultVariantProp = defaultVariants === null || defaultVariants === void 0 ? void 0 : defaultVariants[variant];
      const variantKey = falsyToString(variantProp) || falsyToString(defaultVariantProp);
      return variants[variant][variantKey];
    });
    const defaultsAndProps = {
      ...defaultVariants,
      // remove `undefined` props
      ...props && Object.entries(props).reduce((acc, param) => {
        let [key, value] = param;
        return typeof value === "undefined" ? acc : {
          ...acc,
          [key]: value
        };
      }, {})
    };
    const getCompoundVariantClassNames = config === null || config === void 0 ? void 0 : (_config_compoundVariants = config.compoundVariants) === null || _config_compoundVariants === void 0 ? void 0 : _config_compoundVariants.reduce((acc, param) => {
      let { class: cvClass, className: cvClassName, ...cvConfig } = param;
      return Object.entries(cvConfig).every((param2) => {
        let [cvKey, cvSelector] = param2;
        const selector = defaultsAndProps[cvKey];
        return Array.isArray(cvSelector) ? cvSelector.includes(selector) : selector === cvSelector;
      }) ? [
        ...acc,
        cvClass,
        cvClassName
      ] : acc;
    }, []);
    return cx(config === null || config === void 0 ? void 0 : config.base, getVariantClassNames, getCompoundVariantClassNames, props === null || props === void 0 ? void 0 : props.class, props === null || props === void 0 ? void 0 : props.className);
  };
  const compose = function() {
    for (var _len = arguments.length, components = new Array(_len), _key = 0; _key < _len; _key++) {
      components[_key] = arguments[_key];
    }
    return (props) => {
      const propsWithoutClass = Object.fromEntries(Object.entries(props || {}).filter((param) => {
        let [key] = param;
        return ![
          "class",
          "className"
        ].includes(key);
      }));
      return cx(components.map((component) => component(propsWithoutClass)), props === null || props === void 0 ? void 0 : props.class, props === null || props === void 0 ? void 0 : props.className);
    };
  };
  return {
    compose,
    cva: cva2,
    cx
  };
};
const { cva } = defineConfig();
const buttonVariants = cva({
  base: "ctv:relative ctv:inline-flex ctv:items-center ctv:justify-center ctv:gap-2 ctv:cursor-pointer ctv:touch-manipulation ctv:whitespace-nowrap ctv:appearance-none ctv:border-none ctv:rounded-md ctv:text-sm ctv:font-medium ctv:font-inter ctv:transition-colors ctv:focus-visible:outline-none ctv:focus-visible:ring-1 ctv:focus-visible:ring-ring ctv:disabled:pointer-events-none ctv:disabled:opacity-50 ctv:[&_svg]:pointer-events-none ctv:[&_svg:not([width]):not([height])]:size-4 ctv:[&_svg]:shrink-0",
  variants: {
    variant: {
      secondary: "ctv:text-secondary-foreground ctv:bg-secondary-background ctv:hover:bg-secondary-background-hover",
      primary: "ctv:bg-primary-background ctv:text-base-foreground ctv:hover:bg-primary-background-hover",
      inverted: "ctv:bg-base-foreground ctv:text-base-background ctv:hover:bg-base-foreground/80",
      destructive: "ctv:bg-destructive-background ctv:text-base-foreground ctv:hover:bg-destructive-background-hover",
      textonly: "ctv:bg-transparent ctv:text-base-foreground ctv:hover:bg-secondary-background-hover",
      "muted-textonly": "ctv:bg-transparent ctv:text-muted-foreground ctv:hover:bg-secondary-background-hover",
      "destructive-textonly": "ctv:bg-transparent ctv:text-destructive-background ctv:hover:bg-destructive-background/10",
      outline: "ctv:border ctv:border-solid ctv:border-border-default ctv:bg-transparent ctv:text-base-foreground ctv:hover:bg-secondary-background-hover",
      link: "ctv:bg-transparent ctv:text-muted-foreground ctv:hover:text-base-foreground",
      "overlay-white": "ctv:bg-white ctv:text-gray-600 ctv:hover:bg-white/90",
      base: "ctv:bg-base-background ctv:text-base-foreground ctv:hover:bg-secondary-background-hover",
      tertiary: "ctv:bg-tertiary-background ctv:text-base-foreground ctv:hover:bg-tertiary-background-hover",
      subscribe: "ctv:border-transparent ctv:bg-credit ctv:text-charcoal-800 ctv:hover:opacity-80",
      "brand-ghost": "ctv:bg-transparency-white-t8 ctv:text-primary-warm-white ctv:hover:bg-transparency-white-t20 ctv:focus-visible:ring-2 ctv:focus-visible:ring-brand-yellow",
      "brand-solid": "ctv:bg-brand-yellow ctv:text-primary-comfy-ink ctv:hover:bg-brand-yellow/90 ctv:focus-visible:ring-2 ctv:focus-visible:ring-primary-warm-white",
      "brand-ghost-accent": "ctv:bg-transparency-white-t8 ctv:text-primary-warm-white ctv:hover:bg-brand-yellow ctv:hover:text-primary-comfy-ink ctv:focus-visible:ring-2 ctv:focus-visible:ring-brand-yellow"
    },
    size: {
      sm: "ctv:h-6 ctv:rounded-sm ctv:px-2 ctv:py-1 ctv:text-xs",
      md: "ctv:h-8 ctv:rounded-lg ctv:p-2 ctv:text-xs",
      lg: "ctv:h-10 ctv:rounded-lg ctv:px-4 ctv:py-2 ctv:text-sm",
      "icon-sm": "ctv:size-5 ctv:p-0",
      icon: "ctv:size-8",
      "icon-lg": "ctv:size-10",
      brand: "ctv:h-12 ctv:rounded-2xl ctv:px-5 ctv:font-formula ctv:text-sm ctv:font-semibold ctv:tracking-[0.7px] ctv:uppercase ctv:lg:h-13 ctv:xl:h-14 ctv:2xl:h-16",
      "brand-icon": "ctv:size-10 ctv:rounded-2xl ctv:xl:size-12",
      unset: ""
    }
  },
  defaultVariants: {
    variant: "secondary",
    size: "md"
  }
});
const _hoisted_1$s = {
  key: 0,
  class: "ctv:icon-[lucide--loader-circle] ctv:animate-spin",
  "aria-hidden": "true"
};
const _hoisted_2$n = {
  key: 1,
  class: "ctv:sr-only"
};
const _sfc_main$v = /* @__PURE__ */ defineComponent({
  __name: "Button",
  props: {
    variant: {},
    size: {},
    class: { type: [Boolean, null, String, Object, Array], default: "" },
    loading: { type: Boolean, default: false },
    disabled: { type: Boolean, default: false },
    asChild: { type: Boolean },
    as: { default: "button" }
  },
  setup(__props) {
    return (_ctx, _cache) => {
      return openBlock(), createBlock(unref(Primitive), {
        as: __props.as,
        "as-child": __props.asChild,
        disabled: __props.disabled || __props.loading,
        "aria-busy": __props.loading || void 0,
        class: normalizeClass(unref(cn)(unref(buttonVariants)({ variant: __props.variant, size: __props.size }), __props.class))
      }, {
        default: withCtx(() => [
          __props.loading ? (openBlock(), createElementBlock("i", _hoisted_1$s)) : createCommentVNode("", true),
          __props.loading ? (openBlock(), createElementBlock("span", _hoisted_2$n, [
            renderSlot(_ctx.$slots, "default")
          ])) : renderSlot(_ctx.$slots, "default", { key: 2 })
        ]),
        _: 3
      }, 8, ["as", "as-child", "disabled", "aria-busy", "class"]);
    };
  }
});
const _sfc_main$u = /* @__PURE__ */ defineComponent({
  __name: "Input",
  props: /* @__PURE__ */ mergeModels({
    class: { type: [Boolean, null, String, Object, Array] }
  }, {
    "modelValue": {},
    "modelModifiers": {}
  }),
  emits: ["update:modelValue"],
  setup(__props, { expose: __expose }) {
    const modelValue = useModel(__props, "modelValue");
    const inputRef = useTemplateRef("inputEl");
    __expose({
      focus: () => {
        var _a2;
        return (_a2 = inputRef.value) == null ? void 0 : _a2.focus();
      },
      select: () => {
        var _a2;
        return (_a2 = inputRef.value) == null ? void 0 : _a2.select();
      },
      blur: () => {
        var _a2;
        return (_a2 = inputRef.value) == null ? void 0 : _a2.blur();
      },
      setSelectionRange: (start, end) => {
        var _a2;
        return (_a2 = inputRef.value) == null ? void 0 : _a2.setSelectionRange(start, end);
      },
      selectAll: () => {
        var _a2;
        return (_a2 = inputRef.value) == null ? void 0 : _a2.setSelectionRange(0, inputRef.value.value.length);
      }
    });
    return (_ctx, _cache) => {
      return withDirectives((openBlock(), createElementBlock("input", {
        ref: "inputEl",
        "onUpdate:modelValue": _cache[0] || (_cache[0] = ($event) => modelValue.value = $event),
        class: normalizeClass(
          unref(cn)(
            "ctv:flex ctv:h-10 ctv:w-full ctv:min-w-0 ctv:appearance-none ctv:rounded-lg ctv:border-none ctv:bg-secondary-background ctv:px-4 ctv:py-2 ctv:text-sm ctv:text-base-foreground ctv:placeholder:text-muted-foreground ctv:focus-visible:ring-1 ctv:focus-visible:ring-border-default ctv:focus-visible:outline-none ctv:disabled:pointer-events-none ctv:disabled:opacity-50",
            __props.class
          )
        )
      }, null, 2)), [
        [vModelText, modelValue.value]
      ]);
    };
  }
});
const DEFAULT_AGENT_PAYWALL_PRESENTATION = {
  kind: "unavailable"
};
function resolveAgentPaywallPresentation({
  distribution,
  role,
  tier: tier2,
  canTopUp: canTopUp2,
  canSubscribeSelfServe: canSubscribeSelfServe2
}) {
  return { kind: "local" };
}
const _sfc_main$t = {};
const _hoisted_1$r = { class: "ctv:hidden" };
function _sfc_render(_ctx, _cache) {
  return openBlock(), createElementBlock("span", _hoisted_1$r);
}
const AgentFeedbackCaption = /* @__PURE__ */ _export_sfc(_sfc_main$t, [["render", _sfc_render]]);
function useModalLiftedZIndex(_open) {
  return computed(() => void 0);
}
const _hoisted_1$q = ["aria-label", "data-testid"];
const _sfc_main$s = /* @__PURE__ */ defineComponent({
  __name: "AccessibleTooltip",
  props: {
    label: {},
    testId: {},
    triggerClass: {},
    contentClass: {},
    ringClass: { default: "ctv:focus-visible:ring-base-foreground" },
    side: { default: "top" },
    sideOffset: { default: 6 },
    delayDuration: { default: 300 },
    disabled: { type: Boolean, default: false },
    skipDelayDuration: { default: 300 },
    disableHoverableContent: { type: Boolean, default: false },
    disableClosingTrigger: { type: Boolean, default: true },
    align: { default: "center" },
    collisionPadding: { default: 0 }
  },
  setup(__props) {
    const open = ref(false);
    const contentStyle = useModalLiftedZIndex();
    const labelText = computed(
      () => Array.isArray(__props.label) ? __props.label.join(", ") : __props.label
    );
    const contentClass = computed(
      () => cn(
        "ctv:z-1700 ctv:max-w-48 ctv:rounded-md ctv:bg-charcoal-300 ctv:px-3 ctv:py-2",
        "ctv:text-xs ctv:text-white ctv:shadow-interface ctv:will-change-[transform,opacity]",
        "ctv:data-[state=closed]:animate-out ctv:data-[state=open]:animate-in",
        "ctv:data-[state=closed]:fade-out-0 ctv:data-[state=open]:fade-in-0",
        "ctv:data-[state=closed]:zoom-out-95 ctv:data-[state=open]:zoom-in-95",
        __props.contentClass
      )
    );
    return (_ctx, _cache) => {
      return openBlock(), createBlock(unref(TooltipProvider_default), {
        "delay-duration": __props.delayDuration,
        "skip-delay-duration": __props.skipDelayDuration,
        "disable-hoverable-content": __props.disableHoverableContent
      }, {
        default: withCtx(() => [
          createVNode(unref(TooltipRoot_default), {
            open: open.value,
            "onUpdate:open": _cache[1] || (_cache[1] = ($event) => open.value = $event),
            disabled: __props.disabled,
            "disable-closing-trigger": __props.disableClosingTrigger
          }, {
            default: withCtx(() => [
              createVNode(unref(TooltipTrigger_default), { "as-child": "" }, {
                default: withCtx(() => [
                  renderSlot(_ctx.$slots, "trigger", {}, () => [
                    createBaseVNode("button", {
                      type: "button",
                      "aria-label": labelText.value,
                      "data-testid": __props.testId,
                      class: normalizeClass(
                        unref(cn)(
                          "ctv:cursor-pointer ctv:border-none ctv:bg-transparent ctv:p-0 ctv:focus-visible:ring-1 ctv:focus-visible:outline-none",
                          __props.ringClass,
                          __props.triggerClass
                        )
                      ),
                      onClick: _cache[0] || (_cache[0] = withModifiers(($event) => open.value = true, ["stop"]))
                    }, [
                      renderSlot(_ctx.$slots, "default")
                    ], 10, _hoisted_1$q)
                  ])
                ]),
                _: 3
              }),
              createVNode(unref(TooltipPortal_default), null, {
                default: withCtx(() => [
                  createVNode(unref(TooltipContent_default), {
                    side: __props.side,
                    "side-offset": __props.sideOffset,
                    align: __props.align,
                    "collision-padding": __props.collisionPadding,
                    "aria-hidden": _ctx.$slots.trigger ? void 0 : true,
                    "aria-label": _ctx.$slots.trigger ? void 0 : " ",
                    "data-testid": "disclosure-tooltip",
                    style: normalizeStyle(unref(contentStyle)),
                    class: normalizeClass(contentClass.value)
                  }, {
                    default: withCtx(() => [
                      renderSlot(_ctx.$slots, "content", {}, () => [
                        createTextVNode(toDisplayString(labelText.value), 1)
                      ]),
                      createVNode(unref(TooltipArrow_default), {
                        width: 10,
                        height: 5,
                        class: "ctv:fill-charcoal-300"
                      })
                    ]),
                    _: 3
                  }, 8, ["side", "side-offset", "align", "collision-padding", "aria-hidden", "aria-label", "style", "class"])
                ]),
                _: 3
              })
            ]),
            _: 3
          }, 8, ["open", "disabled", "disable-closing-trigger"])
        ]),
        _: 3
      }, 8, ["delay-duration", "skip-delay-duration", "disable-hoverable-content"]);
    };
  }
});
const _hoisted_1$p = { class: "ctv:flex ctv:h-full ctv:flex-col ctv:overflow-hidden" };
const _hoisted_2$m = { class: "ctv:flex ctv:h-10 ctv:shrink-0 ctv:items-center ctv:gap-1 ctv:px-2" };
const _hoisted_3$j = { class: "ctv:m-0 ctv:text-xs ctv:font-normal ctv:text-muted-foreground" };
const _hoisted_4$f = { class: "ctv:min-h-0 ctv:flex-1 ctv:overflow-y-auto ctv:p-2" };
const _hoisted_5$c = {
  key: 0,
  class: "ctv:px-2 ctv:py-8 ctv:text-center ctv:text-sm ctv:text-muted-foreground"
};
const _hoisted_6$b = { class: "ctv:my-0 ctv:px-2 ctv:py-1 ctv:text-xs ctv:font-medium ctv:text-muted-foreground" };
const _hoisted_7$8 = {
  key: 0,
  class: "ctv:flex ctv:min-w-0 ctv:flex-1 ctv:items-center"
};
const _hoisted_8$5 = { class: "ctv:truncate" };
const _hoisted_9$2 = { class: "ctv:truncate" };
const _hoisted_10$1 = { class: "ctv:truncate" };
const MAX_TITLE_LENGTH = 200;
const _sfc_main$r = /* @__PURE__ */ defineComponent({
  __name: "ChatHistoryScreen",
  props: {
    groups: {}
  },
  emits: ["back", "select", "delete", "copyMarkdown", "rename"],
  setup(__props, { emit: __emit }) {
    const emit = __emit;
    const { t } = useI18n();
    const sections = computed(
      () => [
        ["current", t("agent.historyCurrent"), __props.groups.current],
        ["today", t("agent.historyToday"), __props.groups.today],
        ["yesterday", t("agent.historyYesterday"), __props.groups.yesterday],
        ["earlier", t("agent.historyEarlier"), __props.groups.earlier]
      ].filter(([, , items]) => items.length > 0)
    );
    const isEmpty = computed(() => sections.value.length === 0);
    function pick(session) {
      emit("select", session.id);
    }
    const renamingId = ref(null);
    const renameDraft = ref("");
    const selectOnFocus = ref(false);
    function startRename(session) {
      renamingId.value = session.id;
      renameDraft.value = session.title;
      selectOnFocus.value = true;
    }
    function focusInput(el) {
      const input = el instanceof Element ? el : el == null ? void 0 : el.$el;
      if (!(input instanceof HTMLInputElement)) return;
      const shouldSelect = selectOnFocus.value;
      selectOnFocus.value = false;
      void nextTick(() => {
        if (!input.isConnected) return;
        input.focus();
        if (shouldSelect) input.select();
      });
    }
    function cancelRename() {
      renamingId.value = null;
    }
    function commitRename(session) {
      if (renamingId.value !== session.id) return;
      renamingId.value = null;
      const title = renameDraft.value.trim();
      if (title !== "" && title !== session.title.trim())
        emit("rename", session.id, title);
    }
    function onMenuCloseAutoFocus(event) {
      if (renamingId.value !== null) event.preventDefault();
    }
    function onRenameKeydown(session, event) {
      if (event.isComposing) return;
      if (event.key === "Enter") {
        event.preventDefault();
        commitRename(session);
      } else if (event.key === "Escape") {
        event.preventDefault();
        cancelRename();
      }
    }
    return (_ctx, _cache) => {
      return openBlock(), createElementBlock("div", _hoisted_1$p, [
        createBaseVNode("div", _hoisted_2$m, [
          createVNode(_sfc_main$s, {
            label: unref(t)("agent.backToPreviousChat"),
            side: "bottom",
            "skip-delay-duration": 0,
            "disable-hoverable-content": "",
            "collision-padding": 8
          }, {
            trigger: withCtx(() => [
              createVNode(_sfc_main$v, {
                type: "button",
                variant: "muted-textonly",
                size: "icon-sm",
                "aria-label": unref(t)("agent.backToPreviousChat"),
                class: "ctv:size-6 ctv:shrink-0",
                onClick: _cache[0] || (_cache[0] = ($event) => emit("back"))
              }, {
                default: withCtx(() => [..._cache[2] || (_cache[2] = [
                  createBaseVNode("span", { class: "ctv:icon-[lucide--chevron-left] ctv:size-4 ctv:shrink-0" }, null, -1)
                ])]),
                _: 1
              }, 8, ["aria-label"])
            ]),
            _: 1
          }, 8, ["label"]),
          createBaseVNode("h2", _hoisted_3$j, toDisplayString(unref(t)("agent.history")), 1)
        ]),
        createBaseVNode("div", _hoisted_4$f, [
          isEmpty.value ? (openBlock(), createElementBlock("p", _hoisted_5$c, toDisplayString(unref(t)("agent.historyEmpty")), 1)) : createCommentVNode("", true),
          (openBlock(true), createElementBlock(Fragment, null, renderList(sections.value, ([key, label, items]) => {
            return openBlock(), createElementBlock("section", {
              key,
              class: "ctv:mb-3"
            }, [
              createBaseVNode("p", _hoisted_6$b, toDisplayString(label), 1),
              (openBlock(true), createElementBlock(Fragment, null, renderList(items, (session) => {
                return openBlock(), createElementBlock("div", {
                  key: session.id,
                  class: "ctv:group ctv:flex ctv:items-center ctv:gap-2 ctv:rounded-sm ctv:px-2 ctv:py-1 ctv:hover:bg-secondary-background-hover"
                }, [
                  renamingId.value === session.id ? (openBlock(), createElementBlock("div", _hoisted_7$8, [
                    _cache[3] || (_cache[3] = createBaseVNode("span", { class: "ctv:icon-[lucide--circle-check] ctv:size-4 ctv:shrink-0 ctv:text-muted-foreground" }, null, -1)),
                    createVNode(_sfc_main$u, {
                      ref_for: true,
                      ref: focusInput,
                      modelValue: renameDraft.value,
                      "onUpdate:modelValue": _cache[1] || (_cache[1] = ($event) => renameDraft.value = $event),
                      type: "text",
                      "aria-label": unref(t)("g.rename"),
                      maxlength: MAX_TITLE_LENGTH,
                      class: "ctv:h-6 ctv:flex-1 ctv:px-2 ctv:py-1 ctv:text-xs",
                      onKeydown: ($event) => onRenameKeydown(session, $event),
                      onBlur: ($event) => commitRename(session)
                    }, null, 8, ["modelValue", "aria-label", "onKeydown", "onBlur"])
                  ])) : (openBlock(), createElementBlock(Fragment, { key: 1 }, [
                    createVNode(_sfc_main$v, {
                      type: "button",
                      variant: "muted-textonly",
                      size: "unset",
                      class: "ctv:min-w-0 ctv:flex-1 ctv:justify-start ctv:text-left ctv:text-xs ctv:font-normal",
                      onClick: ($event) => pick(session)
                    }, {
                      default: withCtx(() => [
                        _cache[4] || (_cache[4] = createBaseVNode("span", { class: "ctv:icon-[lucide--circle-check] ctv:size-4 ctv:shrink-0" }, null, -1)),
                        createBaseVNode("span", _hoisted_8$5, toDisplayString(session.title.trim() || unref(t)("agent.untitledChat")), 1)
                      ]),
                      _: 2
                    }, 1032, ["onClick"]),
                    createVNode(_sfc_main$s, {
                      label: unref(t)("agent.copyMarkdown"),
                      "skip-delay-duration": 0,
                      "disable-hoverable-content": "",
                      "collision-padding": 8
                    }, {
                      trigger: withCtx(() => [
                        createVNode(_sfc_main$v, {
                          type: "button",
                          variant: "muted-textonly",
                          size: "icon-sm",
                          class: "ctv:shrink-0",
                          "aria-label": unref(t)("agent.copyMarkdown"),
                          onClick: ($event) => emit("copyMarkdown", session.id)
                        }, {
                          default: withCtx(() => [..._cache[5] || (_cache[5] = [
                            createBaseVNode("span", { class: "ctv:icon-[lucide--copy] ctv:size-3.5" }, null, -1)
                          ])]),
                          _: 1
                        }, 8, ["aria-label", "onClick"])
                      ]),
                      _: 2
                    }, 1032, ["label"]),
                    createVNode(unref(DropdownMenuRoot_default), null, {
                      default: withCtx(() => [
                        createVNode(unref(DropdownMenuTrigger_default), { "as-child": "" }, {
                          default: withCtx(() => [
                            createVNode(_sfc_main$v, {
                              variant: "muted-textonly",
                              size: "icon-sm",
                              class: "ctv:size-6 ctv:shrink-0",
                              "aria-label": unref(t)("agent.chatOptions")
                            }, {
                              default: withCtx(() => [..._cache[6] || (_cache[6] = [
                                createBaseVNode("span", { class: "ctv:icon-[lucide--chevron-down] ctv:size-3" }, null, -1)
                              ])]),
                              _: 1
                            }, 8, ["aria-label"])
                          ]),
                          _: 1
                        }),
                        createVNode(unref(DropdownMenuPortal_default), null, {
                          default: withCtx(() => [
                            createVNode(unref(DropdownMenuContent_default), {
                              side: "bottom",
                              align: "end",
                              "side-offset": 4,
                              class: "agent-scope ctv:z-1100 ctv:flex ctv:w-32 ctv:flex-col ctv:gap-1 ctv:overflow-clip ctv:rounded-lg ctv:bg-secondary-background ctv:p-1 ctv:shadow-md ctv:ring-1 ctv:ring-border-subtle ctv:ring-inset",
                              onCloseAutoFocus: onMenuCloseAutoFocus
                            }, {
                              default: withCtx(() => [
                                createVNode(unref(DropdownMenuItem_default), {
                                  class: "ctv:flex ctv:h-6 ctv:w-full ctv:shrink-0 ctv:cursor-pointer ctv:items-center ctv:gap-1.5 ctv:rounded-lg ctv:px-1.5 ctv:py-1 ctv:text-xs ctv:text-base-foreground ctv:outline-none ctv:data-highlighted:bg-secondary-background-hover",
                                  onSelect: ($event) => startRename(session)
                                }, {
                                  default: withCtx(() => [
                                    _cache[7] || (_cache[7] = createBaseVNode("span", { class: "ctv:icon-[lucide--pencil] ctv:size-4 ctv:shrink-0" }, null, -1)),
                                    createBaseVNode("span", _hoisted_9$2, toDisplayString(unref(t)("g.rename")), 1)
                                  ]),
                                  _: 1
                                }, 8, ["onSelect"]),
                                createVNode(unref(DropdownMenuSeparator_default), { class: "ctv:relative ctv:h-0 ctv:w-full ctv:shrink-0 ctv:before:absolute ctv:before:inset-x-0 ctv:before:top-0 ctv:before:h-px ctv:before:bg-component-node-border" }),
                                createVNode(unref(DropdownMenuItem_default), {
                                  class: "ctv:flex ctv:h-6 ctv:w-full ctv:shrink-0 ctv:cursor-pointer ctv:items-center ctv:gap-1.5 ctv:rounded-lg ctv:px-1.5 ctv:py-1 ctv:text-xs ctv:text-base-foreground ctv:outline-none ctv:data-highlighted:bg-secondary-background-hover ctv:data-highlighted:text-destructive-background",
                                  onSelect: ($event) => emit("delete", session.id)
                                }, {
                                  default: withCtx(() => [
                                    _cache[8] || (_cache[8] = createBaseVNode("span", { class: "ctv:icon-[lucide--trash-2] ctv:size-4 ctv:shrink-0" }, null, -1)),
                                    createBaseVNode("span", _hoisted_10$1, toDisplayString(unref(t)("g.delete")), 1)
                                  ]),
                                  _: 1
                                }, 8, ["onSelect"])
                              ]),
                              _: 2
                            }, 1024)
                          ]),
                          _: 2
                        }, 1024)
                      ]),
                      _: 2
                    }, 1024)
                  ], 64))
                ]);
              }), 128))
            ]);
          }), 128))
        ])
      ]);
    };
  }
});
/*! @license DOMPurify 3.4.12 | (c) Cure53 and other contributors | Released under the Apache license 2.0 and Mozilla Public License 2.0 | github.com/cure53/DOMPurify/blob/3.4.12/LICENSE */
function _arrayLikeToArray(r, a) {
  (null == a || a > r.length) && (a = r.length);
  for (var e = 0, n = Array(a); e < a; e++) n[e] = r[e];
  return n;
}
function _arrayWithHoles(r) {
  if (Array.isArray(r)) return r;
}
function _iterableToArrayLimit(r, l3) {
  var t = null == r ? null : "undefined" != typeof Symbol && r[Symbol.iterator] || r["@@iterator"];
  if (null != t) {
    var e, n, i, u, a = [], f = true, o = false;
    try {
      if (i = (t = t.call(r)).next, 0 === l3) ;
      else for (; !(f = (e = i.call(t)).done) && (a.push(e.value), a.length !== l3); f = true) ;
    } catch (r2) {
      o = true, n = r2;
    } finally {
      try {
        if (!f && null != t.return && (u = t.return(), Object(u) !== u)) return;
      } finally {
        if (o) throw n;
      }
    }
    return a;
  }
}
function _nonIterableRest() {
  throw new TypeError("Invalid attempt to destructure non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.");
}
function _slicedToArray(r, e) {
  return _arrayWithHoles(r) || _iterableToArrayLimit(r, e) || _unsupportedIterableToArray(r, e) || _nonIterableRest();
}
function _unsupportedIterableToArray(r, a) {
  if (r) {
    if ("string" == typeof r) return _arrayLikeToArray(r, a);
    var t = {}.toString.call(r).slice(8, -1);
    return "Object" === t && r.constructor && (t = r.constructor.name), "Map" === t || "Set" === t ? Array.from(r) : "Arguments" === t || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(t) ? _arrayLikeToArray(r, a) : void 0;
  }
}
const entries = Object.entries, setPrototypeOf = Object.setPrototypeOf, isFrozen = Object.isFrozen, getPrototypeOf = Object.getPrototypeOf, getOwnPropertyDescriptor = Object.getOwnPropertyDescriptor;
let freeze = Object.freeze, seal = Object.seal, create = Object.create;
let _ref = typeof Reflect !== "undefined" && Reflect, apply = _ref.apply, construct = _ref.construct;
if (!freeze) {
  freeze = function freeze2(x2) {
    return x2;
  };
}
if (!seal) {
  seal = function seal2(x2) {
    return x2;
  };
}
if (!apply) {
  apply = function apply2(func, thisArg) {
    for (var _len = arguments.length, args = new Array(_len > 2 ? _len - 2 : 0), _key = 2; _key < _len; _key++) {
      args[_key - 2] = arguments[_key];
    }
    return func.apply(thisArg, args);
  };
}
if (!construct) {
  construct = function construct2(Func) {
    for (var _len2 = arguments.length, args = new Array(_len2 > 1 ? _len2 - 1 : 0), _key2 = 1; _key2 < _len2; _key2++) {
      args[_key2 - 1] = arguments[_key2];
    }
    return new Func(...args);
  };
}
const arrayForEach = unapply(Array.prototype.forEach);
const arrayLastIndexOf = unapply(Array.prototype.lastIndexOf);
const arrayPop = unapply(Array.prototype.pop);
const arrayPush = unapply(Array.prototype.push);
const arraySplice = unapply(Array.prototype.splice);
const arrayIsArray = Array.isArray;
const stringToLowerCase = unapply(String.prototype.toLowerCase);
const stringToString = unapply(String.prototype.toString);
const stringMatch = unapply(String.prototype.match);
const stringReplace = unapply(String.prototype.replace);
const stringIndexOf = unapply(String.prototype.indexOf);
const stringTrim = unapply(String.prototype.trim);
const numberToString = unapply(Number.prototype.toString);
const booleanToString = unapply(Boolean.prototype.toString);
const bigintToString = typeof BigInt === "undefined" ? null : unapply(BigInt.prototype.toString);
const symbolToString = typeof Symbol === "undefined" ? null : unapply(Symbol.prototype.toString);
const objectHasOwnProperty = unapply(Object.prototype.hasOwnProperty);
const objectToString = unapply(Object.prototype.toString);
const regExpTest = unapply(RegExp.prototype.test);
const typeErrorCreate = unconstruct(TypeError);
function unapply(func) {
  return function(thisArg) {
    if (thisArg instanceof RegExp) {
      thisArg.lastIndex = 0;
    }
    for (var _len3 = arguments.length, args = new Array(_len3 > 1 ? _len3 - 1 : 0), _key3 = 1; _key3 < _len3; _key3++) {
      args[_key3 - 1] = arguments[_key3];
    }
    return apply(func, thisArg, args);
  };
}
function unconstruct(Func) {
  return function() {
    for (var _len4 = arguments.length, args = new Array(_len4), _key4 = 0; _key4 < _len4; _key4++) {
      args[_key4] = arguments[_key4];
    }
    return construct(Func, args);
  };
}
function addToSet(set, array) {
  let transformCaseFunc = arguments.length > 2 && arguments[2] !== void 0 ? arguments[2] : stringToLowerCase;
  if (setPrototypeOf) {
    setPrototypeOf(set, null);
  }
  if (!arrayIsArray(array)) {
    return set;
  }
  let l3 = array.length;
  while (l3--) {
    let element = array[l3];
    if (typeof element === "string") {
      const lcElement = transformCaseFunc(element);
      if (lcElement !== element) {
        if (!isFrozen(array)) {
          array[l3] = lcElement;
        }
        element = lcElement;
      }
    }
    set[element] = true;
  }
  return set;
}
function cleanArray(array) {
  for (let index = 0; index < array.length; index++) {
    const isPropertyExist = objectHasOwnProperty(array, index);
    if (!isPropertyExist) {
      array[index] = null;
    }
  }
  return array;
}
function clone(object) {
  const newObject = create(null);
  for (const _ref2 of entries(object)) {
    var _ref3 = _slicedToArray(_ref2, 2);
    const property = _ref3[0];
    const value = _ref3[1];
    const isPropertyExist = objectHasOwnProperty(object, property);
    if (isPropertyExist) {
      if (arrayIsArray(value)) {
        newObject[property] = cleanArray(value);
      } else if (value && typeof value === "object" && value.constructor === Object) {
        newObject[property] = clone(value);
      } else {
        newObject[property] = value;
      }
    }
  }
  return newObject;
}
function stringifyValue(value) {
  switch (typeof value) {
    case "string": {
      return value;
    }
    case "number": {
      return numberToString(value);
    }
    case "boolean": {
      return booleanToString(value);
    }
    case "bigint": {
      return bigintToString ? bigintToString(value) : "0";
    }
    case "symbol": {
      return symbolToString ? symbolToString(value) : "Symbol()";
    }
    case "undefined": {
      return objectToString(value);
    }
    case "function":
    case "object": {
      if (value === null) {
        return objectToString(value);
      }
      const valueAsRecord = value;
      const valueToString = lookupGetter(valueAsRecord, "toString");
      if (typeof valueToString === "function") {
        const stringified = valueToString(valueAsRecord);
        return typeof stringified === "string" ? stringified : objectToString(stringified);
      }
      return objectToString(value);
    }
    default: {
      return objectToString(value);
    }
  }
}
function lookupGetter(object, prop) {
  while (object !== null) {
    const desc = getOwnPropertyDescriptor(object, prop);
    if (desc) {
      if (desc.get) {
        return unapply(desc.get);
      }
      if (typeof desc.value === "function") {
        return unapply(desc.value);
      }
    }
    object = getPrototypeOf(object);
  }
  function fallbackValue() {
    return null;
  }
  return fallbackValue;
}
function isRegex(value) {
  try {
    regExpTest(value, "");
    return true;
  } catch (_unused) {
    return false;
  }
}
const html$1 = freeze(["a", "abbr", "acronym", "address", "area", "article", "aside", "audio", "b", "bdi", "bdo", "big", "blink", "blockquote", "body", "br", "button", "canvas", "caption", "center", "cite", "code", "col", "colgroup", "content", "data", "datalist", "dd", "decorator", "del", "details", "dfn", "dialog", "dir", "div", "dl", "dt", "element", "em", "fieldset", "figcaption", "figure", "font", "footer", "form", "h1", "h2", "h3", "h4", "h5", "h6", "head", "header", "hgroup", "hr", "html", "i", "img", "input", "ins", "kbd", "label", "legend", "li", "main", "map", "mark", "marquee", "menu", "menuitem", "meter", "nav", "nobr", "ol", "optgroup", "option", "output", "p", "picture", "pre", "progress", "q", "rp", "rt", "ruby", "s", "samp", "search", "section", "select", "shadow", "slot", "small", "source", "spacer", "span", "strike", "strong", "style", "sub", "summary", "sup", "table", "tbody", "td", "template", "textarea", "tfoot", "th", "thead", "time", "tr", "track", "tt", "u", "ul", "var", "video", "wbr"]);
const svg$1 = freeze(["svg", "a", "altglyph", "altglyphdef", "altglyphitem", "animatecolor", "animatemotion", "animatetransform", "circle", "clippath", "defs", "desc", "ellipse", "enterkeyhint", "exportparts", "filter", "font", "g", "glyph", "glyphref", "hkern", "image", "inputmode", "line", "lineargradient", "marker", "mask", "metadata", "mpath", "part", "path", "pattern", "polygon", "polyline", "radialgradient", "rect", "stop", "style", "switch", "symbol", "text", "textpath", "title", "tref", "tspan", "view", "vkern"]);
const svgFilters = freeze(["feBlend", "feColorMatrix", "feComponentTransfer", "feComposite", "feConvolveMatrix", "feDiffuseLighting", "feDisplacementMap", "feDistantLight", "feDropShadow", "feFlood", "feFuncA", "feFuncB", "feFuncG", "feFuncR", "feGaussianBlur", "feImage", "feMerge", "feMergeNode", "feMorphology", "feOffset", "fePointLight", "feSpecularLighting", "feSpotLight", "feTile", "feTurbulence"]);
const svgDisallowed = freeze(["animate", "color-profile", "cursor", "discard", "font-face", "font-face-format", "font-face-name", "font-face-src", "font-face-uri", "foreignobject", "hatch", "hatchpath", "mesh", "meshgradient", "meshpatch", "meshrow", "missing-glyph", "script", "set", "solidcolor", "unknown", "use"]);
const mathMl$1 = freeze(["math", "menclose", "merror", "mfenced", "mfrac", "mglyph", "mi", "mlabeledtr", "mmultiscripts", "mn", "mo", "mover", "mpadded", "mphantom", "mroot", "mrow", "ms", "mspace", "msqrt", "mstyle", "msub", "msup", "msubsup", "mtable", "mtd", "mtext", "mtr", "munder", "munderover", "mprescripts"]);
const mathMlDisallowed = freeze(["maction", "maligngroup", "malignmark", "mlongdiv", "mscarries", "mscarry", "msgroup", "mstack", "msline", "msrow", "semantics", "annotation", "annotation-xml", "mprescripts", "none"]);
const text = freeze(["#text"]);
const html = freeze(["accept", "action", "align", "alt", "autocapitalize", "autocomplete", "autopictureinpicture", "autoplay", "background", "bgcolor", "border", "capture", "cellpadding", "cellspacing", "checked", "cite", "class", "clear", "color", "cols", "colspan", "command", "commandfor", "controls", "controlslist", "coords", "crossorigin", "datetime", "decoding", "default", "dir", "disabled", "disablepictureinpicture", "disableremoteplayback", "download", "draggable", "enctype", "enterkeyhint", "exportparts", "face", "for", "headers", "height", "hidden", "high", "href", "hreflang", "id", "inert", "inputmode", "integrity", "ismap", "kind", "label", "lang", "list", "loading", "loop", "low", "max", "maxlength", "media", "method", "min", "minlength", "multiple", "muted", "name", "nonce", "noshade", "novalidate", "nowrap", "open", "optimum", "part", "pattern", "placeholder", "playsinline", "popover", "popovertarget", "popovertargetaction", "poster", "preload", "pubdate", "radiogroup", "readonly", "rel", "required", "rev", "reversed", "role", "rows", "rowspan", "spellcheck", "scope", "selected", "shape", "size", "sizes", "slot", "span", "srclang", "start", "src", "srcset", "step", "style", "summary", "tabindex", "title", "translate", "type", "usemap", "valign", "value", "width", "wrap", "xmlns"]);
const svg = freeze(["accent-height", "accumulate", "additive", "alignment-baseline", "amplitude", "ascent", "attributename", "attributetype", "azimuth", "basefrequency", "baseline-shift", "begin", "bias", "by", "class", "clip", "clippathunits", "clip-path", "clip-rule", "color", "color-interpolation", "color-interpolation-filters", "color-profile", "color-rendering", "cx", "cy", "d", "dx", "dy", "diffuseconstant", "direction", "display", "divisor", "dominant-baseline", "dur", "edgemode", "elevation", "end", "exponent", "fill", "fill-opacity", "fill-rule", "filter", "filterunits", "flood-color", "flood-opacity", "font-family", "font-size", "font-size-adjust", "font-stretch", "font-style", "font-variant", "font-weight", "fx", "fy", "g1", "g2", "glyph-name", "glyphref", "gradientunits", "gradienttransform", "height", "href", "id", "image-rendering", "in", "in2", "intercept", "k", "k1", "k2", "k3", "k4", "kerning", "keypoints", "keysplines", "keytimes", "lang", "lengthadjust", "letter-spacing", "kernelmatrix", "kernelunitlength", "lighting-color", "local", "marker-end", "marker-mid", "marker-start", "markerheight", "markerunits", "markerwidth", "maskcontentunits", "maskunits", "max", "mask", "mask-type", "media", "method", "mode", "min", "name", "numoctaves", "offset", "operator", "opacity", "order", "orient", "orientation", "origin", "overflow", "paint-order", "path", "pathlength", "patterncontentunits", "patterntransform", "patternunits", "points", "preservealpha", "preserveaspectratio", "primitiveunits", "r", "rx", "ry", "radius", "refx", "refy", "repeatcount", "repeatdur", "restart", "result", "rotate", "scale", "seed", "shape-rendering", "slope", "specularconstant", "specularexponent", "spreadmethod", "startoffset", "stddeviation", "stitchtiles", "stop-color", "stop-opacity", "stroke-dasharray", "stroke-dashoffset", "stroke-linecap", "stroke-linejoin", "stroke-miterlimit", "stroke-opacity", "stroke", "stroke-width", "style", "surfacescale", "systemlanguage", "tabindex", "tablevalues", "targetx", "targety", "transform", "transform-origin", "text-anchor", "text-decoration", "text-orientation", "text-rendering", "textlength", "type", "u1", "u2", "unicode", "values", "viewbox", "visibility", "version", "vert-adv-y", "vert-origin-x", "vert-origin-y", "width", "word-spacing", "wrap", "writing-mode", "xchannelselector", "ychannelselector", "x", "x1", "x2", "xmlns", "y", "y1", "y2", "z", "zoomandpan"]);
const mathMl = freeze(["accent", "accentunder", "align", "bevelled", "close", "columnalign", "columnlines", "columnspacing", "columnspan", "denomalign", "depth", "dir", "display", "displaystyle", "encoding", "fence", "frame", "height", "href", "id", "largeop", "length", "linethickness", "lquote", "lspace", "mathbackground", "mathcolor", "mathsize", "mathvariant", "maxsize", "minsize", "movablelimits", "notation", "numalign", "open", "rowalign", "rowlines", "rowspacing", "rowspan", "rspace", "rquote", "scriptlevel", "scriptminsize", "scriptsizemultiplier", "selection", "separator", "separators", "stretchy", "subscriptshift", "supscriptshift", "symmetric", "voffset", "width", "xmlns"]);
const xml = freeze(["xlink:href", "xml:id", "xlink:title", "xml:space", "xmlns:xlink"]);
const MUSTACHE_EXPR = seal(/{{[\w\W]*|^[\w\W]*}}/g);
const ERB_EXPR = seal(/<%[\w\W]*|^[\w\W]*%>/g);
const TMPLIT_EXPR = seal(/\${[\w\W]*/g);
const DATA_ATTR = seal(/^data-[\-\w.\u00B7-\uFFFF]+$/);
const ARIA_ATTR = seal(/^aria-[\-\w]+$/);
const IS_ALLOWED_URI = seal(
  /^(?:(?:(?:f|ht)tps?|mailto|tel|callto|sms|cid|xmpp|matrix):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i
  // eslint-disable-line no-useless-escape
);
const IS_SCRIPT_OR_DATA = seal(/^(?:\w+script|data):/i);
const ATTR_WHITESPACE = seal(
  /[\u0000-\u0020\u00A0\u1680\u180E\u2000-\u2029\u205F\u3000]/g
  // eslint-disable-line no-control-regex
);
const DOCTYPE_NAME = seal(/^html$/i);
const CUSTOM_ELEMENT = seal(/^[a-z][.\w]*(-[.\w]+)+$/i);
const ELEMENT_MARKUP_PROBE = seal(/<[/\w!]/g);
const COMMENT_MARKUP_PROBE = seal(/<[/\w]/g);
const FALLBACK_TAG_CLOSE = seal(/<\/no(script|embed|frames)/i);
const SELF_CLOSING_TAG = seal(/\/>/i);
const NODE_TYPE = {
  element: 1,
  attribute: 2,
  text: 3,
  cdataSection: 4,
  entityReference: 5,
  // Deprecated
  entityNode: 6,
  // Deprecated
  processingInstruction: 7,
  comment: 8,
  document: 9,
  documentType: 10,
  documentFragment: 11,
  notation: 12
  // Deprecated
};
const getGlobal = function getGlobal2() {
  return typeof window === "undefined" ? null : window;
};
const _createTrustedTypesPolicy = function _createTrustedTypesPolicy2(trustedTypes, purifyHostElement) {
  if (typeof trustedTypes !== "object" || typeof trustedTypes.createPolicy !== "function") {
    return null;
  }
  let suffix = null;
  const ATTR_NAME = "data-tt-policy-suffix";
  if (purifyHostElement && purifyHostElement.hasAttribute(ATTR_NAME)) {
    suffix = purifyHostElement.getAttribute(ATTR_NAME);
  }
  const policyName = "dompurify" + (suffix ? "#" + suffix : "");
  try {
    return trustedTypes.createPolicy(policyName, {
      createHTML(html2) {
        return html2;
      },
      createScriptURL(scriptUrl) {
        return scriptUrl;
      }
    });
  } catch (_2) {
    console.warn("TrustedTypes policy " + policyName + " could not be created.");
    return null;
  }
};
const _createHooksMap = function _createHooksMap2() {
  return {
    afterSanitizeAttributes: [],
    afterSanitizeElements: [],
    afterSanitizeShadowDOM: [],
    beforeSanitizeAttributes: [],
    beforeSanitizeElements: [],
    beforeSanitizeShadowDOM: [],
    uponSanitizeAttribute: [],
    uponSanitizeElement: [],
    uponSanitizeShadowNode: []
  };
};
const _resolveSetOption = function _resolveSetOption2(cfg, key, fallback, options) {
  return objectHasOwnProperty(cfg, key) && arrayIsArray(cfg[key]) ? addToSet(options.base ? clone(options.base) : {}, cfg[key], options.transform) : fallback;
};
function createDOMPurify() {
  let window2 = arguments.length > 0 && arguments[0] !== void 0 ? arguments[0] : getGlobal();
  const DOMPurify = (root) => createDOMPurify(root);
  DOMPurify.version = "3.4.12";
  DOMPurify.removed = [];
  if (!window2 || !window2.document || window2.document.nodeType !== NODE_TYPE.document || !window2.Element) {
    DOMPurify.isSupported = false;
    return DOMPurify;
  }
  let document2 = window2.document;
  const originalDocument = document2;
  const currentScript = originalDocument.currentScript;
  window2.DocumentFragment;
  const HTMLTemplateElement = window2.HTMLTemplateElement, Node = window2.Node, Element2 = window2.Element, NodeFilter = window2.NodeFilter, _window$NamedNodeMap = window2.NamedNodeMap;
  _window$NamedNodeMap === void 0 ? window2.NamedNodeMap || window2.MozNamedAttrMap : _window$NamedNodeMap;
  window2.HTMLFormElement;
  const DOMParser2 = window2.DOMParser, trustedTypes = window2.trustedTypes;
  const ElementPrototype = Element2.prototype;
  const cloneNode = lookupGetter(ElementPrototype, "cloneNode");
  const remove = lookupGetter(ElementPrototype, "remove");
  const getNextSibling = lookupGetter(ElementPrototype, "nextSibling");
  const getChildNodes = lookupGetter(ElementPrototype, "childNodes");
  const getParentNode = lookupGetter(ElementPrototype, "parentNode");
  const getShadowRoot = lookupGetter(ElementPrototype, "shadowRoot");
  const getAttributes = lookupGetter(ElementPrototype, "attributes");
  const getNodeType = Node && Node.prototype ? lookupGetter(Node.prototype, "nodeType") : null;
  const getNodeName = Node && Node.prototype ? lookupGetter(Node.prototype, "nodeName") : null;
  if (typeof HTMLTemplateElement === "function") {
    const template = document2.createElement("template");
    if (template.content && template.content.ownerDocument) {
      document2 = template.content.ownerDocument;
    }
  }
  let trustedTypesPolicy;
  let emptyHTML = "";
  let defaultTrustedTypesPolicy;
  let defaultTrustedTypesPolicyResolved = false;
  let IN_TRUSTED_TYPES_POLICY = 0;
  const _assertNotInTrustedTypesPolicy = function _assertNotInTrustedTypesPolicy2() {
    if (IN_TRUSTED_TYPES_POLICY > 0) {
      throw typeErrorCreate('A configured TRUSTED_TYPES_POLICY callback (createHTML or createScriptURL) must not call DOMPurify.sanitize, as that causes infinite recursion. Do not pass a policy whose callbacks wrap DOMPurify as TRUSTED_TYPES_POLICY; see the "DOMPurify and Trusted Types" section of the README.');
    }
  };
  const _createTrustedHTML = function _createTrustedHTML2(html2) {
    _assertNotInTrustedTypesPolicy();
    IN_TRUSTED_TYPES_POLICY++;
    try {
      return trustedTypesPolicy.createHTML(html2);
    } finally {
      IN_TRUSTED_TYPES_POLICY--;
    }
  };
  const _createTrustedScriptURL = function _createTrustedScriptURL2(scriptUrl) {
    _assertNotInTrustedTypesPolicy();
    IN_TRUSTED_TYPES_POLICY++;
    try {
      return trustedTypesPolicy.createScriptURL(scriptUrl);
    } finally {
      IN_TRUSTED_TYPES_POLICY--;
    }
  };
  const _getDefaultTrustedTypesPolicy = function _getDefaultTrustedTypesPolicy2() {
    if (!defaultTrustedTypesPolicyResolved) {
      defaultTrustedTypesPolicy = _createTrustedTypesPolicy(trustedTypes, currentScript);
      defaultTrustedTypesPolicyResolved = true;
    }
    return defaultTrustedTypesPolicy;
  };
  const _document = document2, implementation = _document.implementation, createNodeIterator = _document.createNodeIterator, createDocumentFragment = _document.createDocumentFragment, getElementsByTagName = _document.getElementsByTagName;
  const importNode = originalDocument.importNode;
  let hooks = _createHooksMap();
  DOMPurify.isSupported = typeof entries === "function" && typeof getParentNode === "function" && implementation && implementation.createHTMLDocument !== void 0;
  const MUSTACHE_EXPR$1 = MUSTACHE_EXPR, ERB_EXPR$1 = ERB_EXPR, TMPLIT_EXPR$1 = TMPLIT_EXPR, DATA_ATTR$1 = DATA_ATTR, ARIA_ATTR$1 = ARIA_ATTR, IS_SCRIPT_OR_DATA$1 = IS_SCRIPT_OR_DATA, ATTR_WHITESPACE$1 = ATTR_WHITESPACE, CUSTOM_ELEMENT$1 = CUSTOM_ELEMENT;
  let IS_ALLOWED_URI$1 = IS_ALLOWED_URI;
  let ALLOWED_TAGS2 = null;
  const DEFAULT_ALLOWED_TAGS = addToSet({}, [...html$1, ...svg$1, ...svgFilters, ...mathMl$1, ...text]);
  let ALLOWED_ATTR = null;
  const DEFAULT_ALLOWED_ATTR = addToSet({}, [...html, ...svg, ...mathMl, ...xml]);
  let CUSTOM_ELEMENT_HANDLING = Object.seal(create(null, {
    tagNameCheck: {
      writable: true,
      configurable: false,
      enumerable: true,
      value: null
    },
    attributeNameCheck: {
      writable: true,
      configurable: false,
      enumerable: true,
      value: null
    },
    allowCustomizedBuiltInElements: {
      writable: true,
      configurable: false,
      enumerable: true,
      value: false
    }
  }));
  let FORBID_TAGS = null;
  let FORBID_ATTR = null;
  const EXTRA_ELEMENT_HANDLING = Object.seal(create(null, {
    tagCheck: {
      writable: true,
      configurable: false,
      enumerable: true,
      value: null
    },
    attributeCheck: {
      writable: true,
      configurable: false,
      enumerable: true,
      value: null
    }
  }));
  let ALLOW_ARIA_ATTR = true;
  let ALLOW_DATA_ATTR = true;
  let ALLOW_UNKNOWN_PROTOCOLS = false;
  let ALLOW_SELF_CLOSE_IN_ATTR = true;
  let SAFE_FOR_TEMPLATES = false;
  let SAFE_FOR_XML = true;
  let WHOLE_DOCUMENT = false;
  let SET_CONFIG = false;
  let SET_CONFIG_ALLOWED_TAGS = null;
  let SET_CONFIG_ALLOWED_ATTR = null;
  let FORCE_BODY = false;
  let RETURN_DOM = false;
  let RETURN_DOM_FRAGMENT = false;
  let RETURN_TRUSTED_TYPE = false;
  let SANITIZE_DOM = true;
  let SANITIZE_NAMED_PROPS = false;
  const SANITIZE_NAMED_PROPS_PREFIX = "user-content-";
  let KEEP_CONTENT = true;
  let IN_PLACE = false;
  let USE_PROFILES = {};
  let FORBID_CONTENTS = null;
  const DEFAULT_FORBID_CONTENTS = addToSet({}, [
    "annotation-xml",
    "audio",
    "colgroup",
    "desc",
    "foreignobject",
    "head",
    "iframe",
    "math",
    "mi",
    "mn",
    "mo",
    "ms",
    "mtext",
    "noembed",
    "noframes",
    "noscript",
    "plaintext",
    "script",
    // <selectedcontent> mirrors the selected <option>'s subtree, cloned by
    // the UA (customizable <select>) — including any on* handlers — and the
    // engine re-mirrors synchronously whenever a removal changes which
    // option/selectedcontent is current, even inside DOMPurify's inert
    // DOMParser document. Hoisting its children on removal re-inserts a fresh
    // mirror target ahead of the walk, which the engine refills, looping
    // forever (DoS) and amplifying output. Dropping its content on removal
    // (rather than hoisting) breaks that cascade; the content is a duplicate
    // of the option, which is sanitized on its own. See campaign-3 F1/F6.
    "selectedcontent",
    "style",
    "svg",
    "template",
    "thead",
    "title",
    "video",
    "xmp"
  ]);
  let DATA_URI_TAGS = null;
  const DEFAULT_DATA_URI_TAGS = addToSet({}, ["audio", "video", "img", "source", "image", "track"]);
  let URI_SAFE_ATTRIBUTES = null;
  const DEFAULT_URI_SAFE_ATTRIBUTES = addToSet({}, ["alt", "class", "for", "id", "label", "name", "pattern", "placeholder", "role", "summary", "title", "value", "style", "xmlns"]);
  const MATHML_NAMESPACE = "http://www.w3.org/1998/Math/MathML";
  const SVG_NAMESPACE = "http://www.w3.org/2000/svg";
  const HTML_NAMESPACE = "http://www.w3.org/1999/xhtml";
  let NAMESPACE = HTML_NAMESPACE;
  let IS_EMPTY_INPUT = false;
  let ALLOWED_NAMESPACES = null;
  const DEFAULT_ALLOWED_NAMESPACES = addToSet({}, [MATHML_NAMESPACE, SVG_NAMESPACE, HTML_NAMESPACE], stringToString);
  const DEFAULT_MATHML_TEXT_INTEGRATION_POINTS = freeze(["mi", "mo", "mn", "ms", "mtext"]);
  let MATHML_TEXT_INTEGRATION_POINTS = addToSet({}, DEFAULT_MATHML_TEXT_INTEGRATION_POINTS);
  const DEFAULT_HTML_INTEGRATION_POINTS = freeze(["annotation-xml"]);
  let HTML_INTEGRATION_POINTS = addToSet({}, DEFAULT_HTML_INTEGRATION_POINTS);
  const COMMON_SVG_AND_HTML_ELEMENTS = addToSet({}, ["title", "style", "font", "a", "script"]);
  let PARSER_MEDIA_TYPE = null;
  const SUPPORTED_PARSER_MEDIA_TYPES = ["application/xhtml+xml", "text/html"];
  const DEFAULT_PARSER_MEDIA_TYPE = "text/html";
  let transformCaseFunc = null;
  let CONFIG = null;
  const formElement = document2.createElement("form");
  const isRegexOrFunction = function isRegexOrFunction2(testValue) {
    return testValue instanceof RegExp || testValue instanceof Function;
  };
  const _parseConfig = function _parseConfig2() {
    let cfg = arguments.length > 0 && arguments[0] !== void 0 ? arguments[0] : {};
    if (CONFIG && CONFIG === cfg) {
      return;
    }
    if (!cfg || typeof cfg !== "object") {
      cfg = {};
    }
    cfg = clone(cfg);
    PARSER_MEDIA_TYPE = // eslint-disable-next-line unicorn/prefer-includes
    SUPPORTED_PARSER_MEDIA_TYPES.indexOf(cfg.PARSER_MEDIA_TYPE) === -1 ? DEFAULT_PARSER_MEDIA_TYPE : cfg.PARSER_MEDIA_TYPE;
    transformCaseFunc = PARSER_MEDIA_TYPE === "application/xhtml+xml" ? stringToString : stringToLowerCase;
    ALLOWED_TAGS2 = _resolveSetOption(cfg, "ALLOWED_TAGS", DEFAULT_ALLOWED_TAGS, {
      transform: transformCaseFunc
    });
    ALLOWED_ATTR = _resolveSetOption(cfg, "ALLOWED_ATTR", DEFAULT_ALLOWED_ATTR, {
      transform: transformCaseFunc
    });
    ALLOWED_NAMESPACES = _resolveSetOption(cfg, "ALLOWED_NAMESPACES", DEFAULT_ALLOWED_NAMESPACES, {
      transform: stringToString
    });
    URI_SAFE_ATTRIBUTES = _resolveSetOption(cfg, "ADD_URI_SAFE_ATTR", DEFAULT_URI_SAFE_ATTRIBUTES, {
      transform: transformCaseFunc,
      base: DEFAULT_URI_SAFE_ATTRIBUTES
    });
    DATA_URI_TAGS = _resolveSetOption(cfg, "ADD_DATA_URI_TAGS", DEFAULT_DATA_URI_TAGS, {
      transform: transformCaseFunc,
      base: DEFAULT_DATA_URI_TAGS
    });
    FORBID_CONTENTS = _resolveSetOption(cfg, "FORBID_CONTENTS", DEFAULT_FORBID_CONTENTS, {
      transform: transformCaseFunc
    });
    FORBID_TAGS = _resolveSetOption(cfg, "FORBID_TAGS", clone({}), {
      transform: transformCaseFunc
    });
    FORBID_ATTR = _resolveSetOption(cfg, "FORBID_ATTR", clone({}), {
      transform: transformCaseFunc
    });
    USE_PROFILES = objectHasOwnProperty(cfg, "USE_PROFILES") ? cfg.USE_PROFILES && typeof cfg.USE_PROFILES === "object" ? clone(cfg.USE_PROFILES) : cfg.USE_PROFILES : false;
    ALLOW_ARIA_ATTR = cfg.ALLOW_ARIA_ATTR !== false;
    ALLOW_DATA_ATTR = cfg.ALLOW_DATA_ATTR !== false;
    ALLOW_UNKNOWN_PROTOCOLS = cfg.ALLOW_UNKNOWN_PROTOCOLS || false;
    ALLOW_SELF_CLOSE_IN_ATTR = cfg.ALLOW_SELF_CLOSE_IN_ATTR !== false;
    SAFE_FOR_TEMPLATES = cfg.SAFE_FOR_TEMPLATES || false;
    SAFE_FOR_XML = cfg.SAFE_FOR_XML !== false;
    WHOLE_DOCUMENT = cfg.WHOLE_DOCUMENT || false;
    RETURN_DOM = cfg.RETURN_DOM || false;
    RETURN_DOM_FRAGMENT = cfg.RETURN_DOM_FRAGMENT || false;
    RETURN_TRUSTED_TYPE = cfg.RETURN_TRUSTED_TYPE || false;
    FORCE_BODY = cfg.FORCE_BODY || false;
    SANITIZE_DOM = cfg.SANITIZE_DOM !== false;
    SANITIZE_NAMED_PROPS = cfg.SANITIZE_NAMED_PROPS || false;
    KEEP_CONTENT = cfg.KEEP_CONTENT !== false;
    IN_PLACE = cfg.IN_PLACE || false;
    IS_ALLOWED_URI$1 = isRegex(cfg.ALLOWED_URI_REGEXP) ? cfg.ALLOWED_URI_REGEXP : IS_ALLOWED_URI;
    NAMESPACE = typeof cfg.NAMESPACE === "string" ? cfg.NAMESPACE : HTML_NAMESPACE;
    MATHML_TEXT_INTEGRATION_POINTS = objectHasOwnProperty(cfg, "MATHML_TEXT_INTEGRATION_POINTS") && cfg.MATHML_TEXT_INTEGRATION_POINTS && typeof cfg.MATHML_TEXT_INTEGRATION_POINTS === "object" ? clone(cfg.MATHML_TEXT_INTEGRATION_POINTS) : addToSet({}, DEFAULT_MATHML_TEXT_INTEGRATION_POINTS);
    HTML_INTEGRATION_POINTS = objectHasOwnProperty(cfg, "HTML_INTEGRATION_POINTS") && cfg.HTML_INTEGRATION_POINTS && typeof cfg.HTML_INTEGRATION_POINTS === "object" ? clone(cfg.HTML_INTEGRATION_POINTS) : addToSet({}, DEFAULT_HTML_INTEGRATION_POINTS);
    const customElementHandling = objectHasOwnProperty(cfg, "CUSTOM_ELEMENT_HANDLING") && cfg.CUSTOM_ELEMENT_HANDLING && typeof cfg.CUSTOM_ELEMENT_HANDLING === "object" ? clone(cfg.CUSTOM_ELEMENT_HANDLING) : create(null);
    CUSTOM_ELEMENT_HANDLING = create(null);
    if (objectHasOwnProperty(customElementHandling, "tagNameCheck") && isRegexOrFunction(customElementHandling.tagNameCheck)) {
      CUSTOM_ELEMENT_HANDLING.tagNameCheck = customElementHandling.tagNameCheck;
    }
    if (objectHasOwnProperty(customElementHandling, "attributeNameCheck") && isRegexOrFunction(customElementHandling.attributeNameCheck)) {
      CUSTOM_ELEMENT_HANDLING.attributeNameCheck = customElementHandling.attributeNameCheck;
    }
    if (objectHasOwnProperty(customElementHandling, "allowCustomizedBuiltInElements") && typeof customElementHandling.allowCustomizedBuiltInElements === "boolean") {
      CUSTOM_ELEMENT_HANDLING.allowCustomizedBuiltInElements = customElementHandling.allowCustomizedBuiltInElements;
    }
    seal(CUSTOM_ELEMENT_HANDLING);
    if (SAFE_FOR_TEMPLATES) {
      ALLOW_DATA_ATTR = false;
    }
    if (RETURN_DOM_FRAGMENT) {
      RETURN_DOM = true;
    }
    if (USE_PROFILES) {
      ALLOWED_TAGS2 = addToSet({}, text);
      ALLOWED_ATTR = create(null);
      if (USE_PROFILES.html === true) {
        addToSet(ALLOWED_TAGS2, html$1);
        addToSet(ALLOWED_ATTR, html);
      }
      if (USE_PROFILES.svg === true) {
        addToSet(ALLOWED_TAGS2, svg$1);
        addToSet(ALLOWED_ATTR, svg);
        addToSet(ALLOWED_ATTR, xml);
      }
      if (USE_PROFILES.svgFilters === true) {
        addToSet(ALLOWED_TAGS2, svgFilters);
        addToSet(ALLOWED_ATTR, svg);
        addToSet(ALLOWED_ATTR, xml);
      }
      if (USE_PROFILES.mathMl === true) {
        addToSet(ALLOWED_TAGS2, mathMl$1);
        addToSet(ALLOWED_ATTR, mathMl);
        addToSet(ALLOWED_ATTR, xml);
      }
    }
    EXTRA_ELEMENT_HANDLING.tagCheck = null;
    EXTRA_ELEMENT_HANDLING.attributeCheck = null;
    if (objectHasOwnProperty(cfg, "ADD_TAGS")) {
      if (typeof cfg.ADD_TAGS === "function") {
        EXTRA_ELEMENT_HANDLING.tagCheck = cfg.ADD_TAGS;
      } else if (arrayIsArray(cfg.ADD_TAGS)) {
        if (ALLOWED_TAGS2 === DEFAULT_ALLOWED_TAGS) {
          ALLOWED_TAGS2 = clone(ALLOWED_TAGS2);
        }
        addToSet(ALLOWED_TAGS2, cfg.ADD_TAGS, transformCaseFunc);
      }
    }
    if (objectHasOwnProperty(cfg, "ADD_ATTR")) {
      if (typeof cfg.ADD_ATTR === "function") {
        EXTRA_ELEMENT_HANDLING.attributeCheck = cfg.ADD_ATTR;
      } else if (arrayIsArray(cfg.ADD_ATTR)) {
        if (ALLOWED_ATTR === DEFAULT_ALLOWED_ATTR) {
          ALLOWED_ATTR = clone(ALLOWED_ATTR);
        }
        addToSet(ALLOWED_ATTR, cfg.ADD_ATTR, transformCaseFunc);
      }
    }
    if (objectHasOwnProperty(cfg, "ADD_URI_SAFE_ATTR") && arrayIsArray(cfg.ADD_URI_SAFE_ATTR)) {
      addToSet(URI_SAFE_ATTRIBUTES, cfg.ADD_URI_SAFE_ATTR, transformCaseFunc);
    }
    if (objectHasOwnProperty(cfg, "FORBID_CONTENTS") && arrayIsArray(cfg.FORBID_CONTENTS)) {
      if (FORBID_CONTENTS === DEFAULT_FORBID_CONTENTS) {
        FORBID_CONTENTS = clone(FORBID_CONTENTS);
      }
      addToSet(FORBID_CONTENTS, cfg.FORBID_CONTENTS, transformCaseFunc);
    }
    if (objectHasOwnProperty(cfg, "ADD_FORBID_CONTENTS") && arrayIsArray(cfg.ADD_FORBID_CONTENTS)) {
      if (FORBID_CONTENTS === DEFAULT_FORBID_CONTENTS) {
        FORBID_CONTENTS = clone(FORBID_CONTENTS);
      }
      addToSet(FORBID_CONTENTS, cfg.ADD_FORBID_CONTENTS, transformCaseFunc);
    }
    if (KEEP_CONTENT) {
      ALLOWED_TAGS2["#text"] = true;
    }
    if (WHOLE_DOCUMENT) {
      addToSet(ALLOWED_TAGS2, ["html", "head", "body"]);
    }
    if (ALLOWED_TAGS2.table) {
      addToSet(ALLOWED_TAGS2, ["tbody"]);
      delete FORBID_TAGS.tbody;
    }
    if (cfg.TRUSTED_TYPES_POLICY) {
      if (typeof cfg.TRUSTED_TYPES_POLICY.createHTML !== "function") {
        throw typeErrorCreate('TRUSTED_TYPES_POLICY configuration option must provide a "createHTML" hook.');
      }
      if (typeof cfg.TRUSTED_TYPES_POLICY.createScriptURL !== "function") {
        throw typeErrorCreate('TRUSTED_TYPES_POLICY configuration option must provide a "createScriptURL" hook.');
      }
      const previousTrustedTypesPolicy = trustedTypesPolicy;
      trustedTypesPolicy = cfg.TRUSTED_TYPES_POLICY;
      try {
        emptyHTML = _createTrustedHTML("");
      } catch (error) {
        trustedTypesPolicy = previousTrustedTypesPolicy;
        throw error;
      }
    } else if (cfg.TRUSTED_TYPES_POLICY === null) {
      trustedTypesPolicy = void 0;
      emptyHTML = "";
    } else {
      if (trustedTypesPolicy === void 0) {
        trustedTypesPolicy = _getDefaultTrustedTypesPolicy();
      }
      if (trustedTypesPolicy && typeof emptyHTML === "string") {
        emptyHTML = _createTrustedHTML("");
      }
    }
    if (freeze) {
      freeze(cfg);
    }
    CONFIG = cfg;
  };
  const ALL_SVG_TAGS = addToSet({}, [...svg$1, ...svgFilters, ...svgDisallowed]);
  const ALL_MATHML_TAGS = addToSet({}, [...mathMl$1, ...mathMlDisallowed]);
  const _checkSvgNamespace = function _checkSvgNamespace2(tagName, parent, parentTagName) {
    if (parent.namespaceURI === HTML_NAMESPACE) {
      return tagName === "svg";
    }
    if (parent.namespaceURI === MATHML_NAMESPACE) {
      return tagName === "svg" && (parentTagName === "annotation-xml" || MATHML_TEXT_INTEGRATION_POINTS[parentTagName]);
    }
    return Boolean(ALL_SVG_TAGS[tagName]);
  };
  const _checkMathMlNamespace = function _checkMathMlNamespace2(tagName, parent, parentTagName) {
    if (parent.namespaceURI === HTML_NAMESPACE) {
      return tagName === "math";
    }
    if (parent.namespaceURI === SVG_NAMESPACE) {
      return tagName === "math" && HTML_INTEGRATION_POINTS[parentTagName];
    }
    return Boolean(ALL_MATHML_TAGS[tagName]);
  };
  const _checkHtmlNamespace = function _checkHtmlNamespace2(tagName, parent, parentTagName) {
    if (parent.namespaceURI === SVG_NAMESPACE && !HTML_INTEGRATION_POINTS[parentTagName]) {
      return false;
    }
    if (parent.namespaceURI === MATHML_NAMESPACE && !MATHML_TEXT_INTEGRATION_POINTS[parentTagName]) {
      return false;
    }
    return !ALL_MATHML_TAGS[tagName] && (COMMON_SVG_AND_HTML_ELEMENTS[tagName] || !ALL_SVG_TAGS[tagName]);
  };
  const _checkValidNamespace = function _checkValidNamespace2(element) {
    let parent = getParentNode(element);
    if (!parent || !parent.tagName) {
      parent = {
        namespaceURI: NAMESPACE,
        tagName: "template"
      };
    }
    const tagName = stringToLowerCase(element.tagName);
    const parentTagName = stringToLowerCase(parent.tagName);
    if (!ALLOWED_NAMESPACES[element.namespaceURI]) {
      return false;
    }
    if (element.namespaceURI === SVG_NAMESPACE) {
      return _checkSvgNamespace(tagName, parent, parentTagName);
    }
    if (element.namespaceURI === MATHML_NAMESPACE) {
      return _checkMathMlNamespace(tagName, parent, parentTagName);
    }
    if (element.namespaceURI === HTML_NAMESPACE) {
      return _checkHtmlNamespace(tagName, parent, parentTagName);
    }
    if (PARSER_MEDIA_TYPE === "application/xhtml+xml" && ALLOWED_NAMESPACES[element.namespaceURI]) {
      return true;
    }
    return false;
  };
  const _forceRemove = function _forceRemove2(node) {
    arrayPush(DOMPurify.removed, {
      element: node
    });
    try {
      getParentNode(node).removeChild(node);
    } catch (_2) {
      remove(node);
      if (!getParentNode(node)) {
        throw typeErrorCreate("a node selected for removal could not be detached from its tree and cannot be safely returned; refusing to sanitize in place");
      }
    }
  };
  const _neutralizeRoot = function _neutralizeRoot2(root) {
    _neutralizeSubtree(root);
    const childNodes = getChildNodes(root);
    if (childNodes) {
      const snapshot = [];
      arrayForEach(childNodes, (child) => {
        arrayPush(snapshot, child);
      });
      arrayForEach(snapshot, (child) => {
        try {
          remove(child);
        } catch (_2) {
        }
      });
    }
    const attributes = getAttributes(root);
    if (attributes) {
      for (let i = attributes.length - 1; i >= 0; --i) {
        const attribute = attributes[i];
        const name = attribute && attribute.name;
        if (typeof name === "string") {
          try {
            root.removeAttribute(name);
          } catch (_2) {
          }
        }
      }
    }
  };
  const _removeAttribute = function _removeAttribute2(name, element) {
    try {
      arrayPush(DOMPurify.removed, {
        attribute: element.getAttributeNode(name),
        from: element
      });
    } catch (_2) {
      arrayPush(DOMPurify.removed, {
        attribute: null,
        from: element
      });
    }
    element.removeAttribute(name);
    if (name === "is") {
      if (RETURN_DOM || RETURN_DOM_FRAGMENT) {
        try {
          _forceRemove(element);
        } catch (_2) {
        }
      } else {
        try {
          element.setAttribute(name, "");
        } catch (_2) {
        }
      }
    }
  };
  const _stripDisallowedAttributes = function _stripDisallowedAttributes2(element) {
    const attributes = getAttributes(element);
    if (!attributes) {
      return;
    }
    for (let i = attributes.length - 1; i >= 0; --i) {
      const attribute = attributes[i];
      const name = attribute && attribute.name;
      if (typeof name !== "string" || ALLOWED_ATTR[transformCaseFunc(name)]) {
        continue;
      }
      try {
        element.removeAttribute(name);
      } catch (_2) {
      }
    }
  };
  const _neutralizeSubtree = function _neutralizeSubtree2(root) {
    const stack = [root];
    while (stack.length > 0) {
      const node = stack.pop();
      const nodeType = getNodeType ? getNodeType(node) : node.nodeType;
      if (nodeType === NODE_TYPE.element) {
        _stripDisallowedAttributes(node);
      }
      const childNodes = getChildNodes(node);
      if (childNodes) {
        for (let i = childNodes.length - 1; i >= 0; --i) {
          stack.push(childNodes[i]);
        }
      }
    }
  };
  const _neutralizePatchLinkage = function _neutralizePatchLinkage2(root) {
    if (!SAFE_FOR_XML) {
      return;
    }
    const stack = [root];
    while (stack.length > 0) {
      const node = stack.pop();
      const nodeType = getNodeType ? getNodeType(node) : node.nodeType;
      if (nodeType === NODE_TYPE.processingInstruction || nodeType === NODE_TYPE.comment && regExpTest(COMMENT_MARKUP_PROBE, node.data)) {
        try {
          remove(node);
        } catch (_2) {
        }
        continue;
      }
      if (nodeType === NODE_TYPE.element) {
        const element = node;
        const lcTag = transformCaseFunc(getNodeName ? getNodeName(node) : node.nodeName);
        try {
          if (element.hasAttribute && element.hasAttribute("patchsrc")) {
            element.removeAttribute("patchsrc");
          }
          if (element.hasAttribute && element.hasAttribute("for") && lcTag !== "label" && lcTag !== "output") {
            element.removeAttribute("for");
          }
        } catch (_2) {
        }
      }
      const childNodes = getChildNodes(node);
      if (childNodes) {
        for (let i = childNodes.length - 1; i >= 0; --i) {
          stack.push(childNodes[i]);
        }
      }
    }
  };
  const _initDocument = function _initDocument2(dirty) {
    let doc = null;
    let leadingWhitespace = null;
    if (FORCE_BODY) {
      dirty = "<remove></remove>" + dirty;
    } else {
      const matches = stringMatch(dirty, /^[\r\n\t ]+/);
      leadingWhitespace = matches && matches[0];
    }
    if (PARSER_MEDIA_TYPE === "application/xhtml+xml" && NAMESPACE === HTML_NAMESPACE) {
      dirty = '<html xmlns="http://www.w3.org/1999/xhtml"><head></head><body>' + dirty + "</body></html>";
    }
    const dirtyPayload = trustedTypesPolicy ? _createTrustedHTML(dirty) : dirty;
    if (NAMESPACE === HTML_NAMESPACE) {
      try {
        doc = new DOMParser2().parseFromString(dirtyPayload, PARSER_MEDIA_TYPE);
      } catch (_2) {
      }
    }
    if (!doc || !doc.documentElement) {
      doc = implementation.createDocument(NAMESPACE, "template", null);
      try {
        doc.documentElement.innerHTML = IS_EMPTY_INPUT ? emptyHTML : dirtyPayload;
      } catch (_2) {
      }
    }
    const body = doc.body || doc.documentElement;
    if (dirty && leadingWhitespace) {
      body.insertBefore(document2.createTextNode(leadingWhitespace), body.childNodes[0] || null);
    }
    if (NAMESPACE === HTML_NAMESPACE) {
      return getElementsByTagName.call(doc, WHOLE_DOCUMENT ? "html" : "body")[0];
    }
    return WHOLE_DOCUMENT ? doc.documentElement : body;
  };
  const _createNodeIterator = function _createNodeIterator2(root) {
    return createNodeIterator.call(
      root.ownerDocument || root,
      root,
      // eslint-disable-next-line no-bitwise
      NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_COMMENT | NodeFilter.SHOW_TEXT | NodeFilter.SHOW_PROCESSING_INSTRUCTION | NodeFilter.SHOW_CDATA_SECTION,
      null
    );
  };
  const _stripTemplateExpressions = function _stripTemplateExpressions2(value) {
    value = stringReplace(value, MUSTACHE_EXPR$1, " ");
    value = stringReplace(value, ERB_EXPR$1, " ");
    value = stringReplace(value, TMPLIT_EXPR$1, " ");
    return value;
  };
  const _scrubTemplateExpressions2 = function _scrubTemplateExpressions(node) {
    var _node$querySelectorAl;
    node.normalize();
    const walker = createNodeIterator.call(
      node.ownerDocument || node,
      node,
      // eslint-disable-next-line no-bitwise
      NodeFilter.SHOW_TEXT | NodeFilter.SHOW_COMMENT | NodeFilter.SHOW_CDATA_SECTION | NodeFilter.SHOW_PROCESSING_INSTRUCTION,
      null
    );
    let currentNode = walker.nextNode();
    while (currentNode) {
      currentNode.data = _stripTemplateExpressions(currentNode.data);
      currentNode = walker.nextNode();
    }
    const templates = (_node$querySelectorAl = node.querySelectorAll) === null || _node$querySelectorAl === void 0 ? void 0 : _node$querySelectorAl.call(node, "template");
    if (templates) {
      arrayForEach(templates, (tmpl) => {
        if (_isDocumentFragment(tmpl.content)) {
          _scrubTemplateExpressions2(tmpl.content);
        }
      });
    }
  };
  const _isClobbered = function _isClobbered2(element) {
    const realTagName = getNodeName ? getNodeName(element) : null;
    if (typeof realTagName !== "string") {
      return false;
    }
    if (transformCaseFunc(realTagName) !== "form") {
      return false;
    }
    return typeof element.nodeName !== "string" || typeof element.textContent !== "string" || typeof element.removeChild !== "function" || // Realm-safe NamedNodeMap detection: equality against the cached
    // prototype getter. Clobbered .attributes (e.g. <input name="attributes">)
    // makes the direct read diverge from the cached read; a clean form
    // (same-realm OR foreign-realm) has both reads pointing at the same
    // canonical NamedNodeMap.
    element.attributes !== getAttributes(element) || typeof element.removeAttribute !== "function" || typeof element.setAttribute !== "function" || typeof element.namespaceURI !== "string" || typeof element.insertBefore !== "function" || typeof element.hasChildNodes !== "function" || // NodeType clobbering probe. Cached Node.prototype.nodeType getter
    // returns the integer 1 for any Element regardless of realm; direct
    // read on a clobbered form (e.g. <input name="nodeType">) returns
    // the named child element. Cheap addition — nodeType is read from
    // an internal slot, no serialization cost — and removes a residual
    // clobbering surface used by several mXSS / PI / comment branches
    // in _sanitizeElements that compare currentNode.nodeType directly.
    element.nodeType !== getNodeType(element) || // HTMLFormElement has [LegacyOverrideBuiltIns]: a descendant named
    // "childNodes" shadows the prototype getter. Direct reads of
    // form.childNodes from a clobbered form return the named child
    // instead of the real NodeList, so any walk that reads it directly
    // skips the form's real children. Compare the direct read to the
    // cached Node.prototype getter — when the form's named-property
    // getter intercepts the read, the two values differ and we flag
    // the form. This catches every clobbering child type (input,
    // select, etc.) regardless of whether the named child happens to
    // carry a numeric .length, which a typeof-based probe would miss
    // (e.g. HTMLSelectElement.length is a defined unsigned-long).
    element.childNodes !== getChildNodes(element);
  };
  const _isDocumentFragment = function _isDocumentFragment2(value) {
    if (!getNodeType || typeof value !== "object" || value === null) {
      return false;
    }
    try {
      return getNodeType(value) === NODE_TYPE.documentFragment;
    } catch (_2) {
      return false;
    }
  };
  const _isNode = function _isNode2(value) {
    if (!getNodeType || typeof value !== "object" || value === null) {
      return false;
    }
    try {
      return typeof getNodeType(value) === "number";
    } catch (_2) {
      return false;
    }
  };
  function _executeHooks(hooks2, currentNode, data) {
    if (hooks2.length === 0) {
      return;
    }
    arrayForEach(hooks2, (hook) => {
      hook.call(DOMPurify, currentNode, data, CONFIG);
    });
  }
  const _isUnsafeNode = function _isUnsafeNode2(currentNode, tagName) {
    if (SAFE_FOR_XML && currentNode.hasChildNodes() && !_isNode(currentNode.firstElementChild) && regExpTest(ELEMENT_MARKUP_PROBE, currentNode.textContent) && regExpTest(ELEMENT_MARKUP_PROBE, currentNode.innerHTML)) {
      return true;
    }
    if (SAFE_FOR_XML && currentNode.namespaceURI === HTML_NAMESPACE && tagName === "style" && _isNode(currentNode.firstElementChild)) {
      return true;
    }
    if (currentNode.nodeType === NODE_TYPE.processingInstruction) {
      return true;
    }
    if (SAFE_FOR_XML && currentNode.nodeType === NODE_TYPE.comment && regExpTest(COMMENT_MARKUP_PROBE, currentNode.data)) {
      return true;
    }
    return false;
  };
  const _sanitizeDisallowedNode = function _sanitizeDisallowedNode2(currentNode, tagName) {
    if (!FORBID_TAGS[tagName] && _isBasicCustomElement(tagName)) {
      if (CUSTOM_ELEMENT_HANDLING.tagNameCheck instanceof RegExp && regExpTest(CUSTOM_ELEMENT_HANDLING.tagNameCheck, tagName)) {
        return false;
      }
      if (CUSTOM_ELEMENT_HANDLING.tagNameCheck instanceof Function && CUSTOM_ELEMENT_HANDLING.tagNameCheck(tagName)) {
        return false;
      }
    }
    if (KEEP_CONTENT && !FORBID_CONTENTS[tagName]) {
      const parentNode = getParentNode(currentNode);
      const childNodes = getChildNodes(currentNode);
      if (childNodes && parentNode) {
        const childCount = childNodes.length;
        for (let i = childCount - 1; i >= 0; --i) {
          const hoisted = IN_PLACE ? childNodes[i] : cloneNode(childNodes[i], true);
          parentNode.insertBefore(hoisted, getNextSibling(currentNode));
        }
      }
    }
    _forceRemove(currentNode);
    return true;
  };
  const _sanitizeElements = function _sanitizeElements2(currentNode, root) {
    _executeHooks(hooks.beforeSanitizeElements, currentNode, null);
    if (currentNode !== root && getParentNode(currentNode) === null) {
      return true;
    }
    if (_isClobbered(currentNode)) {
      _forceRemove(currentNode);
      return true;
    }
    const tagName = transformCaseFunc(getNodeName ? getNodeName(currentNode) : currentNode.nodeName);
    _executeHooks(hooks.uponSanitizeElement, currentNode, {
      tagName,
      allowedTags: ALLOWED_TAGS2
    });
    if (currentNode !== root && getParentNode(currentNode) === null) {
      return true;
    }
    if (_isUnsafeNode(currentNode, tagName)) {
      _forceRemove(currentNode);
      return true;
    }
    if (FORBID_TAGS[tagName] || !(EXTRA_ELEMENT_HANDLING.tagCheck instanceof Function && EXTRA_ELEMENT_HANDLING.tagCheck(tagName)) && !ALLOWED_TAGS2[tagName]) {
      const removed = _sanitizeDisallowedNode(currentNode, tagName);
      if (removed === false) {
        _executeHooks(hooks.afterSanitizeElements, currentNode, null);
      }
      return removed;
    }
    const nt2 = getNodeType ? getNodeType(currentNode) : currentNode.nodeType;
    if (nt2 === NODE_TYPE.element && !_checkValidNamespace(currentNode)) {
      _forceRemove(currentNode);
      return true;
    }
    if ((tagName === "noscript" || tagName === "noembed" || tagName === "noframes") && regExpTest(FALLBACK_TAG_CLOSE, currentNode.innerHTML)) {
      _forceRemove(currentNode);
      return true;
    }
    if (SAFE_FOR_TEMPLATES && currentNode.nodeType === NODE_TYPE.text) {
      const content = _stripTemplateExpressions(currentNode.textContent);
      if (currentNode.textContent !== content) {
        arrayPush(DOMPurify.removed, {
          element: currentNode.cloneNode()
        });
        currentNode.textContent = content;
      }
    }
    _executeHooks(hooks.afterSanitizeElements, currentNode, null);
    return false;
  };
  const _isValidAttribute = function _isValidAttribute2(lcTag, lcName, value) {
    if (FORBID_ATTR[lcName]) {
      return false;
    }
    if (SAFE_FOR_XML && lcName === "patchsrc") {
      return false;
    }
    if (SAFE_FOR_XML && lcName === "for" && lcTag !== "label" && lcTag !== "output") {
      return false;
    }
    if (SANITIZE_DOM && (lcName === "id" || lcName === "name") && (value in document2 || value in formElement)) {
      return false;
    }
    const nameIsPermitted = ALLOWED_ATTR[lcName] || EXTRA_ELEMENT_HANDLING.attributeCheck instanceof Function && EXTRA_ELEMENT_HANDLING.attributeCheck(lcName, lcTag);
    if (ALLOW_DATA_ATTR && regExpTest(DATA_ATTR$1, lcName)) ;
    else if (ALLOW_ARIA_ATTR && regExpTest(ARIA_ATTR$1, lcName)) ;
    else if (!nameIsPermitted) {
      if (
        // First condition does a very basic check if a) it's basically a valid custom element tagname AND
        // b) if the tagName passes whatever the user has configured for CUSTOM_ELEMENT_HANDLING.tagNameCheck
        // and c) if the attribute name passes whatever the user has configured for CUSTOM_ELEMENT_HANDLING.attributeNameCheck
        _isBasicCustomElement(lcTag) && (CUSTOM_ELEMENT_HANDLING.tagNameCheck instanceof RegExp && regExpTest(CUSTOM_ELEMENT_HANDLING.tagNameCheck, lcTag) || CUSTOM_ELEMENT_HANDLING.tagNameCheck instanceof Function && CUSTOM_ELEMENT_HANDLING.tagNameCheck(lcTag)) && (CUSTOM_ELEMENT_HANDLING.attributeNameCheck instanceof RegExp && regExpTest(CUSTOM_ELEMENT_HANDLING.attributeNameCheck, lcName) || CUSTOM_ELEMENT_HANDLING.attributeNameCheck instanceof Function && CUSTOM_ELEMENT_HANDLING.attributeNameCheck(lcName, lcTag)) || // Alternative, second condition checks if it's an `is`-attribute, AND
        // the value passes whatever the user has configured for CUSTOM_ELEMENT_HANDLING.tagNameCheck
        lcName === "is" && CUSTOM_ELEMENT_HANDLING.allowCustomizedBuiltInElements && (CUSTOM_ELEMENT_HANDLING.tagNameCheck instanceof RegExp && regExpTest(CUSTOM_ELEMENT_HANDLING.tagNameCheck, value) || CUSTOM_ELEMENT_HANDLING.tagNameCheck instanceof Function && CUSTOM_ELEMENT_HANDLING.tagNameCheck(value))
      ) ;
      else {
        return false;
      }
    } else if (URI_SAFE_ATTRIBUTES[lcName]) ;
    else if (regExpTest(IS_ALLOWED_URI$1, stringReplace(value, ATTR_WHITESPACE$1, ""))) ;
    else if ((lcName === "src" || lcName === "xlink:href" || lcName === "href") && lcTag !== "script" && stringIndexOf(value, "data:") === 0 && DATA_URI_TAGS[lcTag]) ;
    else if (ALLOW_UNKNOWN_PROTOCOLS && !regExpTest(IS_SCRIPT_OR_DATA$1, stringReplace(value, ATTR_WHITESPACE$1, ""))) ;
    else if (value) {
      return false;
    } else ;
    return true;
  };
  const RESERVED_CUSTOM_ELEMENT_NAMES = addToSet({}, ["annotation-xml", "color-profile", "font-face", "font-face-format", "font-face-name", "font-face-src", "font-face-uri", "missing-glyph"]);
  const _isBasicCustomElement = function _isBasicCustomElement2(tagName) {
    return !RESERVED_CUSTOM_ELEMENT_NAMES[stringToLowerCase(tagName)] && regExpTest(CUSTOM_ELEMENT$1, tagName);
  };
  const _applyTrustedTypesToAttribute = function _applyTrustedTypesToAttribute2(lcTag, lcName, namespaceURI, value) {
    if (trustedTypesPolicy && typeof trustedTypes === "object" && typeof trustedTypes.getAttributeType === "function" && !namespaceURI) {
      switch (trustedTypes.getAttributeType(lcTag, lcName)) {
        case "TrustedHTML": {
          return _createTrustedHTML(value);
        }
        case "TrustedScriptURL": {
          return _createTrustedScriptURL(value);
        }
      }
    }
    return value;
  };
  const _setAttributeValue = function _setAttributeValue2(currentNode, name, namespaceURI, value) {
    try {
      if (namespaceURI) {
        currentNode.setAttributeNS(namespaceURI, name, value);
      } else {
        currentNode.setAttribute(name, value);
      }
      if (_isClobbered(currentNode)) {
        _forceRemove(currentNode);
      } else {
        arrayPop(DOMPurify.removed);
      }
    } catch (_2) {
      _removeAttribute(name, currentNode);
    }
  };
  const _sanitizeAttributes = function _sanitizeAttributes2(currentNode) {
    _executeHooks(hooks.beforeSanitizeAttributes, currentNode, null);
    const attributes = currentNode.attributes;
    if (!attributes || _isClobbered(currentNode)) {
      return;
    }
    const hookEvent = {
      attrName: "",
      attrValue: "",
      keepAttr: true,
      allowedAttributes: ALLOWED_ATTR,
      forceKeepAttr: void 0
    };
    let l3 = attributes.length;
    const lcTag = transformCaseFunc(currentNode.nodeName);
    while (l3--) {
      const attr = attributes[l3];
      const name = attr.name, namespaceURI = attr.namespaceURI, attrValue = attr.value;
      const lcName = transformCaseFunc(name);
      const initValue = attrValue;
      let value = name === "value" ? initValue : stringTrim(initValue);
      hookEvent.attrName = lcName;
      hookEvent.attrValue = value;
      hookEvent.keepAttr = true;
      hookEvent.forceKeepAttr = void 0;
      _executeHooks(hooks.uponSanitizeAttribute, currentNode, hookEvent);
      value = hookEvent.attrValue;
      if (SANITIZE_NAMED_PROPS && (lcName === "id" || lcName === "name") && stringIndexOf(value, SANITIZE_NAMED_PROPS_PREFIX) !== 0) {
        _removeAttribute(name, currentNode);
        value = SANITIZE_NAMED_PROPS_PREFIX + value;
      }
      if (SAFE_FOR_XML && regExpTest(/((--!?|])>)|<\/(style|script|title|xmp|textarea|noscript|iframe|noembed|noframes)/i, value)) {
        _removeAttribute(name, currentNode);
        continue;
      }
      if (lcName === "attributename" && stringMatch(value, "href")) {
        _removeAttribute(name, currentNode);
        continue;
      }
      if (hookEvent.forceKeepAttr) {
        continue;
      }
      if (!hookEvent.keepAttr) {
        _removeAttribute(name, currentNode);
        continue;
      }
      if (!ALLOW_SELF_CLOSE_IN_ATTR && regExpTest(SELF_CLOSING_TAG, value)) {
        _removeAttribute(name, currentNode);
        continue;
      }
      if (SAFE_FOR_TEMPLATES) {
        value = _stripTemplateExpressions(value);
      }
      if (!_isValidAttribute(lcTag, lcName, value)) {
        _removeAttribute(name, currentNode);
        continue;
      }
      value = _applyTrustedTypesToAttribute(lcTag, lcName, namespaceURI, value);
      if (value !== initValue) {
        _setAttributeValue(currentNode, name, namespaceURI, value);
      }
    }
    _executeHooks(hooks.afterSanitizeAttributes, currentNode, null);
  };
  const _sanitizeShadowDOM2 = function _sanitizeShadowDOM(fragment) {
    let shadowNode = null;
    const shadowIterator = _createNodeIterator(fragment);
    _executeHooks(hooks.beforeSanitizeShadowDOM, fragment, null);
    while (shadowNode = shadowIterator.nextNode()) {
      _executeHooks(hooks.uponSanitizeShadowNode, shadowNode, null);
      _sanitizeElements(shadowNode, fragment);
      _sanitizeAttributes(shadowNode);
      if (_isDocumentFragment(shadowNode.content)) {
        _sanitizeShadowDOM2(shadowNode.content);
      }
      const shadowNodeType = getNodeType ? getNodeType(shadowNode) : shadowNode.nodeType;
      if (shadowNodeType === NODE_TYPE.element) {
        const innerSr = getShadowRoot(shadowNode);
        if (_isDocumentFragment(innerSr)) {
          _sanitizeAttachedShadowRoots(innerSr);
          _sanitizeShadowDOM2(innerSr);
        }
      }
    }
    _executeHooks(hooks.afterSanitizeShadowDOM, fragment, null);
  };
  const _sanitizeAttachedShadowRoots = function _sanitizeAttachedShadowRoots2(root) {
    const stack = [{
      node: root,
      shadow: null
    }];
    while (stack.length > 0) {
      const item = stack.pop();
      if (item.shadow) {
        _sanitizeShadowDOM2(item.shadow);
        continue;
      }
      const node = item.node;
      const nodeType = getNodeType ? getNodeType(node) : node.nodeType;
      const isElement = nodeType === NODE_TYPE.element;
      const childNodes = getChildNodes(node);
      if (childNodes) {
        for (let i = childNodes.length - 1; i >= 0; --i) {
          stack.push({
            node: childNodes[i],
            shadow: null
          });
        }
      }
      if (isElement) {
        const rootName = getNodeName ? getNodeName(node) : null;
        if (typeof rootName === "string" && transformCaseFunc(rootName) === "template") {
          const content = node.content;
          if (_isDocumentFragment(content)) {
            stack.push({
              node: content,
              shadow: null
            });
          }
        }
      }
      if (isElement) {
        const sr = getShadowRoot(node);
        if (_isDocumentFragment(sr)) {
          stack.push({
            node: null,
            shadow: sr
          }, {
            node: sr,
            shadow: null
          });
        }
      }
    }
  };
  DOMPurify.sanitize = function(dirty) {
    let cfg = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : {};
    let body = null;
    let importedNode = null;
    let currentNode = null;
    let returnNode = null;
    IS_EMPTY_INPUT = !dirty;
    if (IS_EMPTY_INPUT) {
      dirty = "<!-->";
    }
    if (typeof dirty !== "string" && !_isNode(dirty)) {
      dirty = stringifyValue(dirty);
      if (typeof dirty !== "string") {
        throw typeErrorCreate("dirty is not a string, aborting");
      }
    }
    if (!DOMPurify.isSupported) {
      return dirty;
    }
    if (SET_CONFIG) {
      ALLOWED_TAGS2 = SET_CONFIG_ALLOWED_TAGS;
      ALLOWED_ATTR = SET_CONFIG_ALLOWED_ATTR;
    } else {
      _parseConfig(cfg);
    }
    if (hooks.uponSanitizeElement.length > 0 || hooks.uponSanitizeAttribute.length > 0) {
      ALLOWED_TAGS2 = clone(ALLOWED_TAGS2);
    }
    if (hooks.uponSanitizeAttribute.length > 0) {
      ALLOWED_ATTR = clone(ALLOWED_ATTR);
    }
    DOMPurify.removed = [];
    const inPlace = IN_PLACE && typeof dirty !== "string" && _isNode(dirty);
    if (inPlace) {
      _neutralizePatchLinkage(dirty);
      const nn = getNodeName ? getNodeName(dirty) : dirty.nodeName;
      if (typeof nn === "string") {
        const tagName = transformCaseFunc(nn);
        if (!ALLOWED_TAGS2[tagName] || FORBID_TAGS[tagName]) {
          _neutralizeRoot(dirty);
          throw typeErrorCreate("root node is forbidden and cannot be sanitized in-place");
        }
      }
      if (_isClobbered(dirty)) {
        _neutralizeRoot(dirty);
        throw typeErrorCreate("root node is clobbered and cannot be sanitized in-place");
      }
      try {
        _sanitizeAttachedShadowRoots(dirty);
      } catch (error) {
        _neutralizeRoot(dirty);
        throw error;
      }
    } else if (_isNode(dirty)) {
      body = _initDocument("<!---->");
      importedNode = body.ownerDocument.importNode(dirty, true);
      if (importedNode.nodeType === NODE_TYPE.element && importedNode.nodeName === "BODY") {
        body = importedNode;
      } else if (importedNode.nodeName === "HTML") {
        body = importedNode;
      } else {
        body.appendChild(importedNode);
      }
      _sanitizeAttachedShadowRoots(importedNode);
    } else {
      if (!RETURN_DOM && !SAFE_FOR_TEMPLATES && !WHOLE_DOCUMENT && // eslint-disable-next-line unicorn/prefer-includes
      dirty.indexOf("<") === -1) {
        return trustedTypesPolicy && RETURN_TRUSTED_TYPE ? _createTrustedHTML(dirty) : dirty;
      }
      body = _initDocument(dirty);
      if (!body) {
        return RETURN_DOM ? null : RETURN_TRUSTED_TYPE ? emptyHTML : "";
      }
    }
    if (body && FORCE_BODY) {
      _forceRemove(body.firstChild);
    }
    const walkRoot = inPlace ? dirty : body;
    const nodeIterator = _createNodeIterator(walkRoot);
    try {
      while (currentNode = nodeIterator.nextNode()) {
        _sanitizeElements(currentNode, walkRoot);
        _sanitizeAttributes(currentNode);
        if (_isDocumentFragment(currentNode.content)) {
          _sanitizeShadowDOM2(currentNode.content);
        }
      }
    } catch (error) {
      if (inPlace) {
        _neutralizeRoot(dirty);
        arrayForEach(DOMPurify.removed, (entry) => {
          if (entry.element) {
            _neutralizeSubtree(entry.element);
          }
        });
      }
      throw error;
    }
    if (inPlace) {
      arrayForEach(DOMPurify.removed, (entry) => {
        if (entry.element) {
          _neutralizeSubtree(entry.element);
        }
      });
      if (SAFE_FOR_TEMPLATES) {
        _scrubTemplateExpressions2(dirty);
      }
      return dirty;
    }
    if (RETURN_DOM) {
      if (SAFE_FOR_TEMPLATES) {
        _scrubTemplateExpressions2(body);
      }
      if (RETURN_DOM_FRAGMENT) {
        returnNode = createDocumentFragment.call(body.ownerDocument);
        while (body.firstChild) {
          returnNode.appendChild(body.firstChild);
        }
      } else {
        returnNode = body;
      }
      if (ALLOWED_ATTR.shadowroot || ALLOWED_ATTR.shadowrootmode) {
        returnNode = importNode.call(originalDocument, returnNode, true);
      }
      return returnNode;
    }
    let serializedHTML = WHOLE_DOCUMENT ? body.outerHTML : body.innerHTML;
    if (WHOLE_DOCUMENT && ALLOWED_TAGS2["!doctype"] && body.ownerDocument && body.ownerDocument.doctype && body.ownerDocument.doctype.name && regExpTest(DOCTYPE_NAME, body.ownerDocument.doctype.name)) {
      serializedHTML = "<!DOCTYPE " + body.ownerDocument.doctype.name + ">\n" + serializedHTML;
    }
    if (SAFE_FOR_TEMPLATES) {
      serializedHTML = _stripTemplateExpressions(serializedHTML);
    }
    return trustedTypesPolicy && RETURN_TRUSTED_TYPE ? _createTrustedHTML(serializedHTML) : serializedHTML;
  };
  DOMPurify.setConfig = function() {
    let cfg = arguments.length > 0 && arguments[0] !== void 0 ? arguments[0] : {};
    _parseConfig(cfg);
    SET_CONFIG = true;
    SET_CONFIG_ALLOWED_TAGS = ALLOWED_TAGS2;
    SET_CONFIG_ALLOWED_ATTR = ALLOWED_ATTR;
  };
  DOMPurify.clearConfig = function() {
    CONFIG = null;
    SET_CONFIG = false;
    SET_CONFIG_ALLOWED_TAGS = null;
    SET_CONFIG_ALLOWED_ATTR = null;
    trustedTypesPolicy = defaultTrustedTypesPolicy;
    emptyHTML = "";
  };
  DOMPurify.isValidAttribute = function(tag, attr, value) {
    if (!CONFIG) {
      _parseConfig({});
    }
    const lcTag = transformCaseFunc(tag);
    const lcName = transformCaseFunc(attr);
    return _isValidAttribute(lcTag, lcName, value);
  };
  DOMPurify.addHook = function(entryPoint, hookFunction) {
    if (typeof hookFunction !== "function") {
      return;
    }
    if (!objectHasOwnProperty(hooks, entryPoint)) {
      return;
    }
    arrayPush(hooks[entryPoint], hookFunction);
  };
  DOMPurify.removeHook = function(entryPoint, hookFunction) {
    if (!objectHasOwnProperty(hooks, entryPoint)) {
      return void 0;
    }
    if (hookFunction !== void 0) {
      const index = arrayLastIndexOf(hooks[entryPoint], hookFunction);
      return index === -1 ? void 0 : arraySplice(hooks[entryPoint], index, 1)[0];
    }
    return arrayPop(hooks[entryPoint]);
  };
  DOMPurify.removeHooks = function(entryPoint) {
    if (!objectHasOwnProperty(hooks, entryPoint)) {
      return;
    }
    hooks[entryPoint] = [];
  };
  DOMPurify.removeAllHooks = function() {
    hooks = _createHooksMap();
  };
  return DOMPurify;
}
var purify = createDOMPurify();
function selectedNodeKey(node) {
  return node.locatorId ?? node.id;
}
function signature(scope, nodes) {
  return JSON.stringify([scope, nodes.map(selectedNodeKey).sort()]);
}
function useCanvasSelection(options) {
  const staged = options.staged ?? ref([]);
  const consumedSig = ref(null);
  const stagedSig = ref(null);
  const dismissedSig = options.dismissedSignature ?? ref(null);
  let lastLiveSig = null;
  let stopSelectionWatch;
  watch(
    () => toValue(options.enabled ?? true),
    (enabled) => {
      stopSelectionWatch == null ? void 0 : stopSelectionWatch();
      stopSelectionWatch = void 0;
      if (!enabled) {
        staged.value = [];
        consumedSig.value = null;
        stagedSig.value = null;
        dismissedSig.value = null;
        lastLiveSig = null;
        return;
      }
      stopSelectionWatch = watch(
        () => [
          toValue(options.isLive),
          toValue(options.isTracking ?? true),
          toValue(options.isPaused ?? false),
          toValue(options.scope ?? null),
          toValue(options.selection)
        ],
        ([isLive, isTracking, isPaused, scope, nodes]) => {
          if (isPaused) return;
          if (!isLive) {
            return;
          }
          if (!isTracking) return;
          if (nodes.length === 0) {
            staged.value = [];
            consumedSig.value = null;
            stagedSig.value = null;
            if (lastLiveSig !== null) dismissedSig.value = null;
            lastLiveSig = null;
            return;
          }
          const sig = signature(scope, nodes);
          lastLiveSig = sig;
          if (sig !== dismissedSig.value) dismissedSig.value = null;
          if (sig === dismissedSig.value) return;
          if (sig === consumedSig.value || sig === stagedSig.value) return;
          consumedSig.value = null;
          stagedSig.value = sig;
          staged.value = [...nodes];
        },
        { immediate: true, deep: true, flush: "sync" }
      );
    },
    { immediate: true, flush: "sync" }
  );
  if (getCurrentScope()) onScopeDispose(() => stopSelectionWatch == null ? void 0 : stopSelectionWatch());
  function currentSignature() {
    return signature(toValue(options.scope ?? null), toValue(options.selection));
  }
  function consume() {
    const tags = staged.value;
    consumedSig.value = currentSignature();
    staged.value = [];
    return tags;
  }
  function dismissed() {
    return dismissedSig.value !== null && dismissedSig.value === currentSignature();
  }
  function remove(id) {
    staged.value = staged.value.filter((node) => selectedNodeKey(node) !== id);
    if (staged.value.length === 0) dismissedSig.value = currentSignature();
  }
  function add(node) {
    if (staged.value.some((tag) => selectedNodeKey(tag) === selectedNodeKey(node)))
      return;
    staged.value = [...staged.value, node];
  }
  function replace(nodes) {
    staged.value = [...nodes];
    consumedSig.value = null;
    stagedSig.value = nodes.length ? signature(toValue(options.scope ?? null), nodes) : null;
    if (nodes.length) dismissedSig.value = null;
  }
  return { staged, consume, dismissed, remove, add, replace };
}
function composerReferenceKey(reference) {
  switch (reference.kind) {
    case "workflow":
      return `workflow:${reference.id}`;
    case "node":
      return `node:${JSON.stringify([reference.scope, selectedNodeKey(reference.node)])}`;
    case "asset":
      return `asset:${reference.attachment.id}`;
  }
}
function composerReferenceName(reference) {
  switch (reference.kind) {
    case "workflow":
      return reference.name;
    case "node":
      return `${reference.node.title} #${reference.node.id}`;
    case "asset":
      return reference.attachment.name;
  }
}
function workflowReferenceParts(text2, references) {
  const parts = [];
  let offset2 = 0;
  for (const reference of [...references].sort(
    (a, b2) => a.textOffset - b2.textOffset
  )) {
    const next = Math.max(offset2, Math.min(text2.length, reference.textOffset));
    if (next > offset2)
      parts.push({ type: "text", text: text2.slice(offset2, next) });
    parts.push({ type: "workflow", reference });
    offset2 = next;
  }
  if (offset2 < text2.length)
    parts.push({ type: "text", text: text2.slice(offset2) });
  return parts;
}
function nodeReferenceText(name) {
  return `@[Node: ${name}]`;
}
function assetReferenceText(name) {
  const kind = getMediaTypeFromFilename(name);
  const label = {
    image: "Image",
    video: "Video",
    audio: "Audio",
    "3D": "3D",
    text: "File",
    other: "File"
  }[kind];
  return `@[${label}: ${name}]`;
}
function agentMessageText(message) {
  const text2 = workflowReferenceParts(
    message.text,
    message.workflowReferences ?? []
  ).map(
    (part) => part.type === "text" ? part.text : `@[Workflow: ${part.reference.name}]`
  ).join("");
  const context = [
    ...(message.tags ?? []).map(nodeReferenceText),
    ...(message.attachments ?? []).map(({ name }) => assetReferenceText(name))
  ].filter((label) => !text2.includes(label));
  return [text2, ...new Set(context)].filter(Boolean).join("\n");
}
function insertComposerReference(prompt, reference, insertion) {
  const textOffset = Math.min(
    prompt.text.length,
    Math.max(0, insertion.textOffset)
  );
  const referenceIndex = Math.min(
    prompt.references.length,
    Math.max(0, insertion.referenceIndex)
  );
  const needsSpace = prompt.text[textOffset] !== " ";
  const references = prompt.references.map((item, index) => ({
    ...item,
    textOffset: needsSpace && (item.textOffset > textOffset || item.textOffset === textOffset && index >= referenceIndex) ? item.textOffset + 1 : item.textOffset
  }));
  references.splice(referenceIndex, 0, { ...reference, textOffset });
  return {
    prompt: {
      text: needsSpace ? `${prompt.text.slice(0, textOffset)} ${prompt.text.slice(textOffset)}` : prompt.text,
      references
    },
    insertion: {
      textOffset: textOffset + 1,
      referenceIndex: referenceIndex + 1
    }
  };
}
function composerPromptForSend(prompt) {
  let text2 = "";
  let offset2 = 0;
  const workflowReferences = [];
  for (const reference of prompt.references) {
    text2 += prompt.text.slice(offset2, reference.textOffset);
    offset2 = reference.textOffset;
    if (reference.kind === "workflow") {
      const { kind: _kind, ...workflow } = reference;
      workflowReferences.push({ ...workflow, textOffset: text2.length });
    } else {
      const name = composerReferenceName(reference);
      text2 += reference.kind === "node" ? nodeReferenceText(name) : assetReferenceText(name);
    }
  }
  return { text: text2 + prompt.text.slice(offset2), workflowReferences };
}
function sameComposerReferenceOrder(a, b2) {
  return a.references.length === b2.references.length && a.references.every(
    (reference, index) => composerReferenceKey(reference) === composerReferenceKey(b2.references[index])
  );
}
const inlinePromptSchema = new Schema({
  nodes: {
    doc: { content: "inline*", whitespace: "pre" },
    text: { group: "inline" },
    workflow: {
      group: "inline",
      inline: true,
      atom: true,
      attrs: { id: {}, name: {}, unavailable: { default: false } },
      toDOM: (node) => [
        "span",
        {
          "data-comfy-workflow": "1",
          "data-workflow-id": node.attrs.id,
          "data-workflow-unavailable": String(node.attrs.unavailable)
        },
        node.attrs.name
      ],
      parseDOM: [
        {
          tag: 'span[data-comfy-workflow="1"]',
          getAttrs(element) {
            var _a2;
            const id = (_a2 = element.getAttribute("data-workflow-id")) == null ? void 0 : _a2.trim();
            const name = element.textContent;
            return id && name.trim() ? {
              id,
              name,
              unavailable: element.getAttribute("data-workflow-unavailable") === "true"
            } : false;
          }
        }
      ]
    },
    node: {
      group: "inline",
      inline: true,
      atom: true,
      attrs: { id: {}, name: {}, scope: {}, locatorId: { default: null } },
      toDOM: (node) => [
        "span",
        { "data-node-id": node.attrs.id },
        nodeReferenceText(`${node.attrs.name} #${node.attrs.id}`)
      ]
    },
    asset: {
      group: "inline",
      inline: true,
      atom: true,
      attrs: {
        id: {},
        name: {},
        ref: {},
        previewUrl: { default: null },
        uploading: { default: false }
      },
      toDOM: (node) => [
        "span",
        { "data-asset-id": node.attrs.id },
        assetReferenceText(node.attrs.name)
      ]
    }
  }
});
function promptReferenceNode(reference) {
  switch (reference.kind) {
    case "workflow":
      return inlinePromptSchema.nodes.workflow.create({
        id: reference.id,
        name: reference.name,
        unavailable: reference.unavailable === true
      });
    case "node":
      return inlinePromptSchema.nodes.node.create({
        id: reference.node.id,
        name: reference.node.title,
        locatorId: reference.node.locatorId,
        scope: reference.scope
      });
    case "asset":
      return inlinePromptSchema.nodes.asset.create({ ...reference.attachment });
  }
}
function promptDocument(prompt) {
  const content = [];
  let offset2 = 0;
  for (const reference of prompt.references) {
    const next = Math.max(
      offset2,
      Math.min(prompt.text.length, reference.textOffset)
    );
    if (next > offset2)
      content.push(inlinePromptSchema.text(prompt.text.slice(offset2, next)));
    content.push(promptReferenceNode(reference));
    offset2 = next;
  }
  if (offset2 < prompt.text.length)
    content.push(inlinePromptSchema.text(prompt.text.slice(offset2)));
  return inlinePromptSchema.nodes.doc.create(null, content);
}
function promptNodeReference(node, textOffset) {
  const { id, name } = node.attrs;
  if (typeof id !== "string" || typeof name !== "string") return;
  if (node.type.name === "workflow")
    return {
      kind: "workflow",
      id,
      name,
      textOffset,
      ...node.attrs.unavailable === true ? { unavailable: true } : {}
    };
  if (node.type.name === "node") {
    const { scope, locatorId } = node.attrs;
    if (typeof scope !== "string") return;
    return {
      kind: "node",
      scope,
      textOffset,
      node: {
        id,
        title: name,
        ...isNodeLocatorId(locatorId) ? { locatorId } : {}
      }
    };
  }
  if (node.type.name === "asset") {
    const { ref: ref2, previewUrl, uploading } = node.attrs;
    if (typeof ref2 !== "string") return;
    return {
      kind: "asset",
      textOffset,
      attachment: {
        id,
        name,
        ref: ref2,
        ...typeof previewUrl === "string" ? { previewUrl } : {},
        ...uploading === true ? { uploading: true } : {}
      }
    };
  }
}
function promptDraft(doc) {
  let text2 = "";
  const references = [];
  doc.forEach((node) => {
    if (node.isText) text2 += node.text;
    else {
      const reference = promptNodeReference(node, text2.length);
      if (reference) references.push(reference);
    }
  });
  return { text: text2, references };
}
function promptTextOffset(doc, position) {
  return doc.textBetween(0, position, "", "").length;
}
function promptInsertionPoint(doc, position) {
  let referenceIndex = 0;
  doc.forEach((node, offset2) => {
    if (!node.isText && offset2 < position) referenceIndex++;
  });
  return { textOffset: promptTextOffset(doc, position), referenceIndex };
}
function promptDocumentPosition(doc, textOffset) {
  let text2 = 0;
  let position = 0;
  doc.forEach((node, offset2) => {
    if (node.isText && textOffset >= text2 && textOffset <= text2 + node.nodeSize)
      position = offset2 + textOffset - text2;
    else if (!node.isText && textOffset === text2)
      position = offset2 + node.nodeSize;
    if (node.isText) text2 += node.nodeSize;
  });
  return position;
}
const _sfc_main$q = /* @__PURE__ */ defineComponent({
  ...{ inheritAttrs: false },
  __name: "InlinePromptEditor",
  props: /* @__PURE__ */ mergeModels({
    label: {},
    expanded: { type: Boolean, default: false },
    activeDescendant: {},
    historyEpoch: { default: 0 },
    editableWorkflowId: {}
  }, {
    "modelValue": {
      default: () => ({ text: "", references: [] })
    },
    "modelModifiers": {}
  }),
  emits: /* @__PURE__ */ mergeModels(["input", "selectionChange", "keydown", "keyup", "click", "blur", "openReferenceWorkflow", "removeWorkflowReference", "removeNodeReference"], ["update:modelValue"]),
  setup(__props, { expose: __expose, emit: __emit }) {
    const model = useModel(__props, "modelValue");
    const emit = __emit;
    const { t } = useI18n();
    const host = useTemplateRef("host");
    let view;
    const insertions = /* @__PURE__ */ new Set();
    const plugins = [
      history(),
      keymap({
        "Mod-z": undo,
        "Mod-Shift-z": redo,
        "Mod-y": redo,
        "Shift-Enter": (state, dispatch) => {
          dispatch == null ? void 0 : dispatch(state.tr.insertText("\n").scrollIntoView());
          return true;
        }
      }),
      keymap(baseKeymap)
    ];
    function createState() {
      return EditorState.create({
        doc: promptDocument(model.value),
        plugins
      });
    }
    function deleteReference(state, position, node) {
      var _a2, _b;
      const end = position + node.nodeSize;
      const padding = ((_b = (_a2 = state.doc.nodeAt(end)) == null ? void 0 : _a2.text) == null ? void 0 : _b.startsWith(" ")) ? 1 : 0;
      return state.tr.delete(position, end + padding);
    }
    function referenceClipboardText(node) {
      const reference = promptNodeReference(node, 0);
      if (!reference) return "";
      const name = composerReferenceName(reference);
      if (reference.kind === "workflow") return `@[Workflow: ${name}]`;
      return reference.kind === "node" ? nodeReferenceText(name) : assetReferenceText(name);
    }
    function passiveReferenceView(node, iconClass) {
      const dom = document.createElement("span");
      const reference = promptNodeReference(node, 0);
      if (!reference) return { dom };
      dom.contentEditable = "false";
      dom.dataset.testid = `${reference.kind}-reference-chip`;
      dom.className = "ctv:inline ctv:rounded-sm ctv:bg-primary-background/30 ctv:box-decoration-clone ctv:px-1 ctv:py-0.5 ctv:font-inter ctv:text-xs/[15px] ctv:font-normal ctv:break-all ctv:whitespace-normal ctv:text-primary-background-hover ctv:ring-1 ctv:ring-primary-background/30 ctv:ring-inset [&.ProseMirror-selectednode]:outline-1";
      const icon = document.createElement("span");
      icon.className = `${iconClass} ctv:mr-1 ctv:inline-block ctv:size-3 ctv:align-middle`;
      icon.setAttribute("aria-hidden", "true");
      const label = document.createElement("span");
      label.textContent = composerReferenceName(reference);
      dom.append(icon, label);
      return { dom, ignoreMutation: () => true };
    }
    onMounted(() => {
      if (!host.value) return;
      view = new EditorView(host.value, {
        state: createState(),
        attributes: () => ({
          role: "textbox",
          "aria-label": __props.label,
          "aria-multiline": "true",
          "aria-expanded": String(__props.expanded),
          "aria-controls": "agent-reference-menu",
          ...__props.activeDescendant ? { "aria-activedescendant": __props.activeDescendant } : {},
          class: "ctv:text-base-foreground ctv:min-h-7 ctv:w-full ctv:cursor-text ctv:font-inter ctv:text-[14px]/5 ctv:font-normal ctv:wrap-anywhere ctv:whitespace-pre-wrap ctv:outline-none"
        }),
        decorations(state) {
          if (state.selection.empty) return null;
          const decorations = [];
          state.doc.nodesBetween(
            state.selection.from,
            state.selection.to,
            (node, position) => {
              if (node.type === inlinePromptSchema.nodes.workflow)
                decorations.push(
                  Decoration.node(position, position + node.nodeSize, {
                    "data-selected": "true"
                  })
                );
            }
          );
          return DecorationSet.create(state.doc, decorations);
        },
        dispatchTransaction(transaction) {
          if (!view) return;
          const previousReferences = promptDraft(view.state.doc).references;
          const nextReferences = promptDraft(transaction.doc).references;
          if (previousReferences.length !== nextReferences.length || previousReferences.some(
            (reference, index) => composerReferenceKey(reference) !== composerReferenceKey(nextReferences[index])
          ))
            closeHistory(transaction);
          for (const insertion of insertions) {
            const collapsed = insertion.from === insertion.to;
            insertion.from = transaction.mapping.map(insertion.from, 1);
            insertion.to = Math.max(
              insertion.from,
              transaction.mapping.map(insertion.to, collapsed ? 1 : -1)
            );
          }
          view.updateState(view.state.apply(transaction));
          if (transaction.docChanged) {
            const draft = promptDraft(view.state.doc);
            model.value = draft;
            for (const previous of previousReferences) {
              if (draft.references.some(
                (reference) => composerReferenceKey(reference) === composerReferenceKey(previous)
              ))
                continue;
              if (previous.kind === "workflow")
                emit("removeWorkflowReference", previous.id);
              if (previous.kind === "node")
                emit("removeNodeReference", selectedNodeKey(previous.node));
            }
            emit("input");
          }
          if (transaction.selectionSet || transaction.docChanged)
            emit("selectionChange");
        },
        handleKeyDown(editor, event) {
          emit("keydown", event);
          if (!event.defaultPrevented && !event.isComposing && editor.state.selection.empty) {
            const { $from, from } = editor.state.selection;
            const adjacent = event.key === "Backspace" ? $from.nodeBefore : event.key === "Delete" ? $from.nodeAfter : null;
            if ((adjacent == null ? void 0 : adjacent.isAtom) && !adjacent.isText) {
              const start = event.key === "Backspace" ? from - adjacent.nodeSize : from;
              editor.dispatch(
                deleteReference(editor.state, start, adjacent).scrollIntoView()
              );
              event.preventDefault();
            }
          }
          return event.defaultPrevented;
        },
        handleDOMEvents: {
          dragenter: () => true,
          dragover: () => true,
          drop: () => true,
          keyup: (_view, event) => {
            emit("keyup", event);
            return false;
          },
          click: () => {
            emit("click");
            return false;
          },
          blur: () => {
            emit("blur");
            return false;
          }
        },
        transformPastedHTML: (html2) => purify.sanitize(html2),
        handlePaste(editor, event, slice) {
          const clipboard = event.clipboardData;
          if (!clipboard) return false;
          const text2 = clipboard.getData("text/plain");
          const { state } = editor;
          const hasWorkflows = slice.content.content.some(
            (node) => node.type === inlinePromptSchema.nodes.workflow
          );
          if (!hasWorkflows) {
            editor.dispatch(state.tr.insertText(text2).scrollIntoView());
            return true;
          }
          const usedIds = /* @__PURE__ */ new Set([__props.editableWorkflowId]);
          state.doc.forEach((node, position) => {
            if (node.type === inlinePromptSchema.nodes.workflow && (position < state.selection.from || position >= state.selection.to))
              usedIds.add(node.attrs.id);
          });
          const pasted = DOMParser$1.fromSchema(inlinePromptSchema).parseSlice(
            purify.sanitize(clipboard.getData("text/html"), {
              RETURN_DOM_FRAGMENT: true
            }),
            { preserveWhitespace: "full" }
          );
          const content = pasted.content.content.map((node) => {
            if (node.type !== inlinePromptSchema.nodes.workflow) return node;
            if (usedIds.has(node.attrs.id))
              return inlinePromptSchema.text(referenceClipboardText(node));
            usedIds.add(node.attrs.id);
            return node;
          });
          editor.dispatch(
            state.tr.replaceSelection(new Slice(Fragment$1.from(content), 0, 0)).setMeta("paste", true).setMeta("uiEvent", "paste").scrollIntoView()
          );
          return true;
        },
        clipboardTextSerializer: (slice) => slice.content.textBetween(
          0,
          slice.content.size,
          "",
          (node) => referenceClipboardText(node)
        ),
        nodeViews: {
          node: (node) => passiveReferenceView(node, "ctv:icon-[comfy--node]"),
          asset: (node) => passiveReferenceView(node, "ctv:icon-[lucide--paperclip]"),
          workflow(node, editor, getPos) {
            const id = node.attrs.id;
            const name = node.attrs.name;
            const dom = document.createElement("span");
            if (typeof id !== "string" || typeof name !== "string") return { dom };
            dom.contentEditable = "false";
            dom.dataset.testid = "workflow-reference-chip";
            dom.className = "group/workflow ctv:inline ctv:selection:bg-transparent ctv:selection:text-inherit";
            const open = document.createElement("span");
            open.setAttribute("role", "button");
            open.tabIndex = 0;
            const unavailable = node.attrs.unavailable === true;
            open.setAttribute(
              "aria-label",
              t(
                unavailable ? "agent.unavailableWorkflowReference" : "agent.openWorkflowTab",
                { name }
              )
            );
            if (unavailable) {
              const reason = t("agent.workflowReferenceUnavailableReason");
              open.setAttribute("aria-disabled", "true");
              open.setAttribute("aria-description", reason);
              open.title = reason;
            }
            open.className = "ctv:inline ctv:cursor-pointer ctv:rounded-sm ctv:bg-primary-background/30 ctv:box-decoration-clone ctv:px-1 ctv:py-0.5 ctv:font-inter ctv:text-xs/[15px] ctv:font-normal ctv:break-all ctv:whitespace-normal ctv:text-primary-background-hover ctv:ring-1 ctv:ring-primary-background/30 ctv:transition-colors ctv:ring-inset ctv:group-data-selected/workflow:bg-primary-background/60 ctv:group-data-selected/workflow:text-base-foreground ctv:group-data-selected/workflow:ring-primary-background ctv:hover:bg-primary-background/40 ctv:group-data-selected/workflow:hover:bg-primary-background/60 ctv:focus-visible:outline-2 ctv:focus-visible:outline-offset-2 ctv:focus-visible:outline-primary-background ctv:aria-disabled:cursor-not-allowed ctv:aria-disabled:opacity-50";
            const icon = document.createElement("span");
            icon.className = "ctv:icon-[comfy--workflow] ctv:mr-1 ctv:inline-block ctv:size-3 ctv:align-middle";
            const title = document.createElement("span");
            title.textContent = name;
            open.append(icon, title);
            open.onclick = () => {
              if (!unavailable) emit("openReferenceWorkflow", id, name);
            };
            open.onkeydown = (event) => {
              if (event.key === "Enter" || event.key === " ") event.preventDefault();
              if (event.key === "Enter") open.click();
            };
            open.onkeyup = (event) => {
              if (event.key !== " ") return;
              event.preventDefault();
              open.click();
            };
            const removeAnchor = document.createElement("span");
            removeAnchor.className = "ctv:relative ctv:inline-block ctv:h-4 ctv:w-0 ctv:align-middle";
            const remove = document.createElement("button");
            remove.type = "button";
            remove.setAttribute(
              "aria-label",
              t("agent.removeWorkflowReference", { name })
            );
            remove.className = "ctv:text-base-foreground ctv:pointer-events-none ctv:absolute ctv:-top-2 ctv:-right-2 ctv:z-10 ctv:flex ctv:size-5 ctv:cursor-pointer ctv:items-center ctv:justify-center ctv:rounded-full ctv:p-0 ctv:opacity-0 ctv:transition-opacity ctv:group-focus-within/workflow:pointer-events-auto ctv:group-focus-within/workflow:opacity-100 ctv:group-hover/workflow:pointer-events-auto ctv:group-hover/workflow:opacity-100 ctv:focus-visible:outline-2 ctv:focus-visible:outline-primary-background ctv:touch:pointer-events-auto ctv:touch:opacity-100";
            const badge = document.createElement("span");
            badge.className = "ctv:bg-base-background ctv:hover:bg-secondary-background-hover ctv:flex ctv:size-3 ctv:items-center ctv:justify-center ctv:rounded-full ctv:ring-1 ctv:ring-border-default";
            const cross = document.createElement("span");
            cross.className = "ctv:icon-[lucide--x] ctv:size-2";
            badge.append(cross);
            remove.append(badge);
            remove.onclick = () => {
              const position = getPos();
              if (position === void 0) return;
              editor.dispatch(deleteReference(editor.state, position, node));
            };
            removeAnchor.append(remove);
            dom.append(open, removeAnchor);
            return { dom, stopEvent: () => true, ignoreMutation: () => true };
          }
        }
      });
    });
    watch(
      [model, () => __props.historyEpoch],
      ([next, epoch], [, previousEpoch]) => {
        if (!view) return;
        const doc = promptDocument(next);
        if (epoch !== previousEpoch) {
          insertions.clear();
          const state = createState();
          const position = Math.min(view.state.selection.head, doc.content.size);
          view.updateState(
            state.apply(
              state.tr.setSelection(TextSelection.create(state.doc, position))
            )
          );
          emit("selectionChange");
          return;
        }
        const start = view.state.doc.content.findDiffStart(doc.content);
        if (start === null) return;
        const end = view.state.doc.content.findDiffEnd(doc.content);
        if (!end) return;
        const overlap = Math.max(0, start - Math.min(end.a, end.b));
        const before = promptDraft(view.state.doc);
        const metadataOnly = before.text === next.text && sameComposerReferenceOrder(before, next);
        const transaction = view.state.tr.replace(
          start,
          end.a + overlap,
          doc.slice(start, end.b + overlap)
        );
        view.dispatch(
          closeHistory(transaction.setMeta("addToHistory", !metadataOnly))
        );
      },
      { flush: "post", deep: true }
    );
    watch(
      () => [__props.label, __props.expanded, __props.activeDescendant],
      () => view == null ? void 0 : view.setProps({})
    );
    onBeforeUnmount(() => {
      insertions.clear();
      view == null ? void 0 : view.destroy();
      view = void 0;
    });
    function selection() {
      if (!view) return { start: 0, end: 0 };
      return {
        start: promptTextOffset(view.state.doc, view.state.selection.from),
        end: promptTextOffset(view.state.doc, view.state.selection.to)
      };
    }
    function replaceText(from, to, text2) {
      if (!view) return;
      view.dispatch(
        view.state.tr.insertText(
          text2,
          promptDocumentPosition(view.state.doc, from),
          promptDocumentPosition(view.state.doc, to)
        )
      );
    }
    function captureInsertion(from, to) {
      const insertion = {
        from: view ? from === void 0 ? view.state.selection.from : promptDocumentPosition(view.state.doc, from) : 0,
        to: view ? to === void 0 ? view.state.selection.to : promptDocumentPosition(view.state.doc, to) : 0
      };
      insertions.add(insertion);
      return {
        insert(reference) {
          var _a2, _b;
          if (!view || !insertions.delete(insertion)) return;
          const node = inlinePromptSchema.nodes.workflow.create({
            id: reference.id,
            name: reference.name
          });
          const transaction = view.state.tr.replaceWith(
            insertion.from,
            insertion.to,
            node
          );
          const afterChip = insertion.from + node.nodeSize;
          if (!((_b = (_a2 = transaction.doc.nodeAt(afterChip)) == null ? void 0 : _a2.text) == null ? void 0 : _b.startsWith(" ")))
            transaction.insertText(" ", afterChip);
          view.dispatch(
            transaction.setSelection(TextSelection.create(transaction.doc, afterChip + 1)).scrollIntoView()
          );
          view.focus();
        },
        cancel: () => insertions.delete(insertion)
      };
    }
    __expose({
      insertionPoint: () => view ? promptInsertionPoint(view.state.doc, view.state.selection.head) : { textOffset: 0, referenceIndex: 0 },
      focus: () => view == null ? void 0 : view.focus(),
      selection,
      replaceText,
      captureInsertion
    });
    return (_ctx, _cache) => {
      return openBlock(), createElementBlock("div", {
        ref_key: "host",
        ref: host,
        onCopy: _cache[0] || (_cache[0] = withModifiers(() => {
        }, ["stop"])),
        onCut: _cache[1] || (_cache[1] = withModifiers(() => {
        }, ["stop"])),
        onPaste: _cache[2] || (_cache[2] = withModifiers(() => {
        }, ["stop"]))
      }, null, 544);
    };
  }
});
function transitionMentionPicker(state, event) {
  if (event.type === "closed") return { status: "closed" };
  if (event.type === "queryChanged") {
    const section = state.status === "open" ? state.section : "root";
    return {
      status: "open",
      section,
      start: event.start,
      query: event.query,
      activeIndex: section !== "root" && event.query === "" ? 0 : Math.max(0, event.firstMatchIndex)
    };
  }
  if (state.status === "closed") return state;
  switch (event.type) {
    case "sectionSelected":
      return { ...state, section: event.section, query: "", activeIndex: 0 };
    case "back":
      return { ...state, section: "root", activeIndex: 0 };
    case "nodesUnavailable":
      return state.section === "nodes" ? {
        ...state,
        section: "root",
        activeIndex: Math.max(0, event.firstMatchIndex)
      } : state;
    case "highlighted":
      return { ...state, activeIndex: event.index };
    case "highlightMoved": {
      const count = event.disabled.length;
      for (let offset2 = 1; offset2 <= count; offset2++) {
        const index = (state.activeIndex + event.direction * offset2 + count) % count;
        if (!event.disabled[index]) return { ...state, activeIndex: index };
      }
      return state;
    }
  }
}
function useAgentMentionPicker(options) {
  const { t } = useI18n();
  const graphNodes = ref([]);
  function loadMentionNodes() {
    if (options.nodeReferenceDisabledReason()) {
      graphNodes.value = [];
      return;
    }
    graphNodes.value = options.getMentionNodes().toSorted((a, b2) => a.title.localeCompare(b2.title));
  }
  const mention = ref({ status: "closed" });
  const mentionSection = computed(
    () => mention.value.status === "open" ? mention.value.section : "root"
  );
  const mentionQuery = computed(
    () => mention.value.status === "open" ? mention.value.query : null
  );
  const mentionActive = computed(
    () => mention.value.status === "open" ? mention.value.activeIndex : 0
  );
  const stagedKeys = computed(
    () => new Set(options.selectionTags().map((tag) => selectedNodeKey(tag)))
  );
  function getMentionMatches(section, query) {
    const search = query.toLowerCase();
    if (section === "root") {
      const sections = [
        { kind: "section", id: "nodes", label: t("agent.nodes") },
        { kind: "section", id: "workflows", label: t("agent.workflows") }
      ];
      return sections.filter(
        ({ label }) => label.toLowerCase().includes(search)
      );
    }
    const back = { kind: "back", id: "back", label: t("g.back") };
    if (section === "nodes") {
      return [
        back,
        ...graphNodes.value.filter(
          (node) => !stagedKeys.value.has(selectedNodeKey(node)) && (node.title.toLowerCase().includes(search) || node.id.includes(search))
        ).map(
          (node) => ({
            kind: "node",
            id: selectedNodeKey(node),
            label: node.title,
            node
          })
        )
      ];
    }
    return [
      back,
      ...options.workflows().filter(({ name }) => name.toLowerCase().includes(search)).map(
        (workflow) => ({
          kind: "workflow",
          id: workflow.id ?? workflow.tabPath,
          label: workflow.name,
          workflow
        })
      )
    ];
  }
  const mentionMatches = computed(() => {
    const query = mentionQuery.value;
    return query === null ? [] : getMentionMatches(mentionSection.value, query);
  });
  const mentionVisible = computed(
    () => mentionQuery.value !== null && (mentionQuery.value === "" || mentionMatches.value.some(
      (match) => match.kind !== "back" && !isNodeReferenceDisabled(match)
    ))
  );
  const mentionHasResults = computed(
    () => mentionSection.value === "root" || mentionMatches.value.length > 1
  );
  function duplicatedTitles(nodes) {
    const seen = /* @__PURE__ */ new Set();
    const dupes = /* @__PURE__ */ new Set();
    for (const node of nodes) {
      if (seen.has(node.title)) dupes.add(node.title);
      else seen.add(node.title);
    }
    return dupes;
  }
  const graphDupes = computed(() => duplicatedTitles(graphNodes.value));
  const tagDupes = computed(() => duplicatedTitles(options.selectionTags()));
  watch(
    () => options.selectionTags(),
    (tags) => {
      if (tags.length) loadMentionNodes();
    },
    { immediate: true }
  );
  function dispatchMention(event) {
    mention.value = transitionMentionPicker(mention.value, event);
  }
  function firstMentionMatchIndex(section, query) {
    return getMentionMatches(section, query).findIndex(
      (match) => match.kind !== "back" && !isNodeReferenceDisabled(match)
    );
  }
  function syncMention() {
    var _a2;
    const caret = ((_a2 = options.editor()) == null ? void 0 : _a2.selection().start) ?? 0;
    const text2 = options.draft();
    const at = text2.lastIndexOf("@", caret - 1);
    const atValid = at !== -1 && at < caret && (at === 0 || /\s/.test(text2[at - 1]));
    if (!atValid) {
      dispatchMention({ type: "closed" });
      return;
    }
    const query = text2.slice(at + 1, caret);
    if (query.includes("\n")) {
      dispatchMention({ type: "closed" });
      return;
    }
    if (mention.value.status === "closed") loadMentionNodes();
    dispatchMention({
      type: "queryChanged",
      start: at,
      query,
      firstMatchIndex: firstMentionMatchIndex(mentionSection.value, query)
    });
  }
  function isNodeReferenceDisabled(match) {
    return !!options.nodeReferenceDisabledReason() && (match.kind === "node" || match.kind === "section" && match.id === "nodes");
  }
  watch(
    () => options.nodeReferenceDisabledReason(),
    (reason) => {
      if (!reason) {
        if (mention.value.status === "open") loadMentionNodes();
        return;
      }
      graphNodes.value = [];
      if (mention.value.status === "open" && mention.value.section === "nodes") {
        dispatchMention({
          type: "nodesUnavailable",
          firstMatchIndex: firstMentionMatchIndex("root", mention.value.query)
        });
      }
    },
    { flush: "sync" }
  );
  async function pickMention(match) {
    var _a2, _b, _c;
    const state = mention.value;
    if (state.status === "closed" || isMentionDisabled(match)) return;
    if (match.kind === "section") {
      (_a2 = options.editor()) == null ? void 0 : _a2.replaceText(state.start + 1, state.start + 1 + state.query.length, "");
      dispatchMention({ type: "sectionSelected", section: match.id });
      if (match.id === "workflows") options.requestWorkflows();
      return;
    }
    if (match.kind === "back") {
      dispatchMention({ type: "back" });
      return;
    }
    if (match.kind === "workflow") {
      if (await options.selectWorkflow(
        match.workflow,
        state.start,
        state.start + 1 + state.query.length
      ))
        dispatchMention({ type: "closed" });
      return;
    }
    (_b = options.editor()) == null ? void 0 : _b.replaceText(state.start, state.start + 1 + state.query.length, "");
    options.pickNode(match.node);
    dispatchMention({ type: "closed" });
    (_c = options.editor()) == null ? void 0 : _c.focus();
  }
  function isMentionDisabled(match) {
    return isNodeReferenceDisabled(match) || match.kind === "workflow" && options.workflowSelecting();
  }
  function onComposerKeydown(event) {
    const state = mention.value;
    if (state.status === "open" && mentionVisible.value && !event.isComposing && !event.shiftKey) {
      const matches = mentionMatches.value;
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        dispatchMention({
          type: "highlightMoved",
          direction: event.key === "ArrowDown" ? 1 : -1,
          disabled: matches.map(isMentionDisabled)
        });
        return true;
      }
      if (event.key === "Enter" || event.key === "Tab") {
        event.preventDefault();
        const match = state.activeIndex < 0 ? void 0 : matches.at(state.activeIndex);
        if (match) void pickMention(match);
        return true;
      }
      if (event.key === "Escape") {
        event.stopPropagation();
        dispatchMention({ type: "closed" });
        return true;
      }
    }
    return false;
  }
  const CARET_KEYS = ["ArrowLeft", "ArrowRight", "Home", "End"];
  function onComposerKeyup(event) {
    if (mention.value.status === "open" && CARET_KEYS.includes(event.key))
      syncMention();
  }
  return {
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
    onComposerKeydown,
    onComposerKeyup,
    close: () => dispatchMention({ type: "closed" }),
    highlight: (index) => dispatchMention({ type: "highlighted", index })
  };
}
function useWorkflowReferencePicker(options) {
  const eligibleWorkflows = computed(() => {
    const selectedIds = new Set(options.references().map(({ id }) => id));
    return options.workflows().filter(
      ({ id }) => id === void 0 || id !== options.editableWorkflowId() && !selectedIds.has(id)
    );
  });
  async function selectWorkflow(workflow, from, to) {
    var _a2;
    if (options.selecting()) return false;
    const insertion = (_a2 = options.editor()) == null ? void 0 : _a2.captureInsertion(from, to);
    if (!insertion) return false;
    try {
      const reference = await options.resolve(workflow);
      if (!reference) return false;
      insertion.insert(reference);
      return true;
    } finally {
      insertion.cancel();
    }
  }
  return { eligibleWorkflows, selectWorkflow };
}
function resetTextWhenReferencesCleared(text2, references) {
  return references.length === 0 && text2.trim() === "" ? "" : text2;
}
const useAgentComposerStore = defineStore("agentComposer", () => {
  const draftState = shallowRef({ text: "", references: [] });
  const prompt = computed(() => draftState.value);
  const draft = computed(() => prompt.value.text);
  const attachments = computed(
    () => prompt.value.references.flatMap(
      (item) => item.kind === "asset" ? [item.attachment] : []
    )
  );
  const workflowReferences = computed(
    () => prompt.value.references.flatMap((item) => {
      if (item.kind !== "workflow") return [];
      const { kind: _kind, ...reference } = item;
      return [reference];
    })
  );
  const nodes = computed(
    () => prompt.value.references.flatMap(
      (item) => item.kind === "node" ? [item.node] : []
    )
  );
  const nodeScope = ref(null);
  const promptEpoch = ref(0);
  const insertionPoint = shallowRef({
    textOffset: 0,
    referenceIndex: 0
  });
  const undoAssets = /* @__PURE__ */ new Map();
  const retiredAssets = /* @__PURE__ */ new Set();
  const submission = shallowRef(null);
  let revision = 0;
  let nextSubmissionId = 0;
  function updateDraft(next) {
    ++revision;
    draftState.value = next;
  }
  function setInsertionPoint(point) {
    insertionPoint.value = point;
  }
  function resetPromptHistory() {
    ++promptEpoch.value;
  }
  function setText(text2) {
    if (text2 === draft.value) return;
    updateDraft({
      text: text2,
      references: prompt.value.references.map((item) => ({
        ...item,
        textOffset: Math.min(text2.length, item.textOffset)
      }))
    });
    insertionPoint.value = {
      textOffset: text2.length,
      referenceIndex: prompt.value.references.length
    };
  }
  function applyEditorPrompt(next) {
    const seen = /* @__PURE__ */ new Set();
    const references = next.references.flatMap((item) => {
      const key = composerReferenceKey(item);
      if (seen.has(key)) return [];
      seen.add(key);
      if (item.kind === "node" && item.scope !== nodeScope.value) return [];
      if (item.kind !== "asset") return [item];
      if (retiredAssets.has(item.attachment.id)) return [];
      const attachment = undoAssets.get(item.attachment.id) ?? item.attachment;
      undoAssets.set(attachment.id, attachment);
      return [{ ...item, attachment }];
    });
    updateDraft({ text: next.text, references });
  }
  function replacePrompt(next) {
    resetPromptHistory();
    updateDraft({
      text: next.text,
      references: [
        ...next.workflowReferences.map(
          (item) => ({ ...item, kind: "workflow" })
        ),
        ...prompt.value.references.filter((item) => item.kind !== "workflow").map((item) => ({
          ...item,
          textOffset: Math.min(item.textOffset, next.text.length)
        }))
      ].sort((a, b2) => a.textOffset - b2.textOffset)
    });
  }
  function restorePrompt(next) {
    resetPromptHistory();
    applyEditorPrompt(next);
  }
  function replaceDraft(next) {
    for (const attachment of next.attachments) {
      undoAssets.set(attachment.id, { ...attachment });
      retiredAssets.delete(attachment.id);
    }
    restorePrompt({
      text: next.text,
      references: [
        ...next.workflowReferences.map(
          (item) => ({ ...item, kind: "workflow" })
        ),
        ...next.attachments.map(
          (attachment) => ({
            kind: "asset",
            attachment: { ...attachment },
            textOffset: next.text.length
          })
        )
      ].sort((a, b2) => a.textOffset - b2.textOffset)
    });
  }
  function setWorkflowReferences(references) {
    updateDraft({
      text: draft.value,
      references: [
        ...references.map(
          (item) => ({ ...item, kind: "workflow" })
        ),
        ...prompt.value.references.filter((item) => item.kind !== "workflow")
      ].sort((a, b2) => a.textOffset - b2.textOffset)
    });
  }
  function removeReference(key) {
    const references = prompt.value.references.filter(
      (item) => composerReferenceKey(item) !== key
    );
    if (references.length !== prompt.value.references.length)
      updateDraft({
        text: resetTextWhenReferencesCleared(draft.value, references),
        references
      });
  }
  function removeWorkflowReference(id) {
    removeReference(`workflow:${id}`);
  }
  function setNodeScope(scope) {
    if (scope === nodeScope.value) return;
    nodeScope.value = scope;
    resetPromptHistory();
    if (nodes.value.length === 0) return;
    const references = prompt.value.references.filter(
      (item) => item.kind !== "node"
    );
    updateDraft({
      text: resetTextWhenReferencesCleared(draft.value, references),
      references
    });
  }
  function setNodes(next) {
    if (next.length === nodes.value.length && next.every((node, index) => {
      const previous = nodes.value[index];
      return node.id === previous.id && node.locatorId === previous.locatorId && node.title === previous.title;
    }))
      return;
    const byKey = new Map(next.map((node) => [selectedNodeKey(node), node]));
    let result = {
      text: draft.value,
      references: prompt.value.references.flatMap(
        (item) => {
          if (item.kind !== "node") return [item];
          const node = byKey.get(selectedNodeKey(item.node));
          return node ? [{ ...item, node }] : [];
        }
      )
    };
    if (nodeScope.value !== null) {
      for (const node of next) {
        if (result.references.some(
          (item) => item.kind === "node" && selectedNodeKey(item.node) === selectedNodeKey(node)
        ))
          continue;
        const inserted = insertComposerReference(
          result,
          {
            kind: "node",
            node: { ...node },
            scope: nodeScope.value,
            textOffset: 0
          },
          insertionPoint.value
        );
        result = inserted.prompt;
        insertionPoint.value = inserted.insertion;
      }
    }
    updateDraft({
      ...result,
      text: resetTextWhenReferencesCleared(result.text, result.references)
    });
  }
  function addAttachment(attachment) {
    if (undoAssets.has(attachment.id) || retiredAssets.has(attachment.id))
      return;
    undoAssets.set(attachment.id, { ...attachment });
    const inserted = insertComposerReference(
      prompt.value,
      { kind: "asset", attachment: { ...attachment }, textOffset: 0 },
      insertionPoint.value
    );
    insertionPoint.value = inserted.insertion;
    updateDraft(inserted.prompt);
  }
  function revokePreview(attachment) {
    var _a2;
    if ((_a2 = attachment.previewUrl) == null ? void 0 : _a2.startsWith("blob:"))
      URL.revokeObjectURL(attachment.previewUrl);
  }
  function updateAttachment(id, patch) {
    var _a2;
    const previous = undoAssets.get(id);
    if (!previous) {
      if ((_a2 = patch.previewUrl) == null ? void 0 : _a2.startsWith("blob:"))
        URL.revokeObjectURL(patch.previewUrl);
      return;
    }
    if (patch.previewUrl !== void 0 && patch.previewUrl !== previous.previewUrl)
      revokePreview(previous);
    const attachment = { ...previous, ...patch, id };
    undoAssets.set(id, attachment);
    if (!attachments.value.some((item) => item.id === id)) return;
    updateDraft({
      text: draft.value,
      references: prompt.value.references.map(
        (item) => item.kind === "asset" && item.attachment.id === id ? { ...item, attachment } : item
      )
    });
  }
  function removeAttachment(id) {
    const attachment = undoAssets.get(id);
    if (attachment) revokePreview(attachment);
    undoAssets.delete(id);
    retiredAssets.add(id);
    removeReference(`asset:${id}`);
  }
  function releaseUnusedAssets() {
    var _a2;
    const retained = new Set(attachments.value.map(({ id }) => id));
    for (const attachment of ((_a2 = submission.value) == null ? void 0 : _a2.snapshot.attachments) ?? [])
      retained.add(attachment.id);
    for (const [id, attachment] of undoAssets)
      if (!retained.has(id)) {
        revokePreview(attachment);
        undoAssets.delete(id);
        retiredAssets.add(id);
      }
  }
  function startSubmission(snapshot) {
    resetPromptHistory();
    updateDraft({ text: "", references: [] });
    insertionPoint.value = { textOffset: 0, referenceIndex: 0 };
    const id = ++nextSubmissionId;
    submission.value = {
      id,
      phase: "pending",
      stopRequested: false,
      revision,
      snapshot
    };
    return id;
  }
  function requestSubmissionStop() {
    const pending2 = submission.value;
    if ((pending2 == null ? void 0 : pending2.phase) !== "pending") return false;
    submission.value = { ...pending2, stopRequested: true };
    return true;
  }
  function settleSubmission(id, sent) {
    const pending2 = submission.value;
    if ((pending2 == null ? void 0 : pending2.id) !== id) return;
    submission.value = sent || pending2.revision !== revision ? null : { ...pending2, phase: "failed" };
    releaseUnusedAssets();
  }
  function takeFailedSubmission() {
    const failed = submission.value;
    if ((failed == null ? void 0 : failed.phase) !== "failed") return;
    submission.value = null;
    if (failed.revision === revision) return failed.snapshot;
  }
  function invalidateSubmission() {
    submission.value = null;
  }
  return {
    draftState,
    draft,
    attachments,
    workflowReferences,
    prompt,
    nodes,
    nodeScope,
    promptEpoch,
    insertionPoint,
    submission,
    setText,
    setInsertionPoint,
    resetPromptHistory,
    applyEditorPrompt,
    replacePrompt,
    restorePrompt,
    replaceDraft,
    setWorkflowReferences,
    removeWorkflowReference,
    removeReference,
    setNodeScope,
    setNodes,
    addAttachment,
    updateAttachment,
    removeAttachment,
    releaseUnusedAssets,
    startSubmission,
    requestSubmissionStop,
    settleSubmission,
    takeFailedSubmission,
    invalidateSubmission
  };
});
function useComposer(options) {
  const store = useAgentComposerStore();
  const { draft, attachments, prompt, workflowReferences, promptEpoch } = storeToRefs(store);
  if (getCurrentScope()) onScopeDispose(store.releaseUnusedAssets);
  const canSend = computed(
    () => (draft.value.trim().length > 0 || prompt.value.references.length > 0) && !attachments.value.some((item) => item.uploading)
  );
  function submit() {
    if (options.isRunning()) {
      options.onStop();
      return;
    }
    if (!canSend.value) return;
    options.onSend(
      composerPromptForSend(prompt.value).text.trim(),
      attachments.value
    );
  }
  function insert(text2) {
    store.setText(draft.value ? `${draft.value} ${text2}` : text2);
  }
  return {
    draft,
    attachments,
    prompt,
    promptEpoch,
    applyEditorPrompt: store.applyEditorPrompt,
    setInsertionPoint: store.setInsertionPoint,
    removeReference: store.removeReference,
    workflowReferences,
    canSend,
    submit,
    insert,
    setText: store.setText,
    replacePrompt: store.replacePrompt,
    addAttachment: store.addAttachment,
    updateAttachment: store.updateAttachment,
    removeAttachment: store.removeAttachment
  };
}
function iconForMediaType(mediaType) {
  switch (mediaType) {
    case "video":
      return "ctv:icon-[lucide--video]";
    case "audio":
      return "ctv:icon-[lucide--music]";
    case "3D":
      return "ctv:icon-[lucide--box]";
    case "text":
      return "ctv:icon-[lucide--text]";
    case "other":
      return "ctv:icon-[lucide--check-check]";
    default:
      return "ctv:icon-[lucide--image]";
  }
}
const _hoisted_1$o = ["data-attachment-name"];
const _hoisted_2$l = ["aria-label"];
const _hoisted_3$i = ["src", "alt"];
const _hoisted_4$e = { class: "ctv:max-w-32 ctv:truncate" };
const _sfc_main$p = /* @__PURE__ */ defineComponent({
  __name: "AttachmentChip",
  props: {
    name: {},
    previewUrl: {},
    uploading: { type: Boolean, default: false }
  },
  emits: ["remove"],
  setup(__props, { emit: __emit }) {
    const emit = __emit;
    const kind = computed(() => getMediaTypeFromFilename(__props.name));
    const kindIconClass = computed(
      () => kind.value === "other" ? "ctv:icon-[lucide--file]" : iconForMediaType(kind.value)
    );
    return (_ctx, _cache) => {
      return openBlock(), createElementBlock("span", {
        "data-testid": "agent-attachment-chip",
        "data-attachment-name": __props.name,
        class: "ctv:inline-flex ctv:h-7 ctv:items-center ctv:gap-1 ctv:rounded-lg ctv:border ctv:border-border-default ctv:bg-secondary-background ctv:px-2.5 ctv:text-xs/4 ctv:font-medium ctv:text-base-foreground"
      }, [
        __props.uploading ? (openBlock(), createElementBlock("span", {
          key: 0,
          "aria-label": _ctx.$t("agent.uploading"),
          class: "ctv:icon-[lucide--loader-circle] ctv:size-3.5 ctv:animate-spin ctv:text-muted-foreground"
        }, null, 8, _hoisted_2$l)) : __props.previewUrl && kind.value === "image" ? (openBlock(), createElementBlock("img", {
          key: 1,
          src: __props.previewUrl,
          alt: __props.name,
          class: "ctv:size-3.5 ctv:shrink-0 ctv:rounded-sm ctv:object-cover"
        }, null, 8, _hoisted_3$i)) : (openBlock(), createElementBlock("span", {
          key: 2,
          class: normalizeClass(unref(cn)(kindIconClass.value, "ctv:size-3.5 ctv:shrink-0"))
        }, null, 2)),
        createBaseVNode("span", _hoisted_4$e, toDisplayString(__props.name), 1),
        createVNode(_sfc_main$v, {
          type: "button",
          variant: "muted-textonly",
          size: "unset",
          "aria-label": _ctx.$t("agent.remove"),
          class: "ctv:size-3.5 ctv:shrink-0",
          onClick: _cache[0] || (_cache[0] = ($event) => emit("remove"))
        }, {
          default: withCtx(() => [..._cache[1] || (_cache[1] = [
            createBaseVNode("span", { class: "ctv:icon-[lucide--x] ctv:size-3.5 ctv:shrink-0" }, null, -1)
          ])]),
          _: 1
        }, 8, ["aria-label"])
      ], 8, _hoisted_1$o);
    };
  }
});
const _hoisted_1$n = { class: "ctv:flex ctv:flex-col ctv:gap-0.5" };
const _hoisted_2$k = {
  "aria-hidden": "true",
  class: "ctv:text-sm/5 ctv:font-medium ctv:text-base-foreground"
};
const _hoisted_3$h = ["id"];
const _hoisted_4$d = { class: "ctv:min-w-0 ctv:flex-1" };
const _hoisted_5$b = { class: "ctv:block ctv:text-sm/5 ctv:text-base-foreground" };
const _hoisted_6$a = { class: "ctv:mt-0.5 ctv:block ctv:text-xs/4 ctv:text-muted-foreground" };
const _hoisted_7$7 = {
  key: 0,
  role: "status",
  class: "ctv:sr-only"
};
const _sfc_main$o = /* @__PURE__ */ defineComponent({
  __name: "RunModePopover",
  setup(__props) {
    const { t } = useI18n();
    const store = useAgentRunModeStore();
    const toast = useToastStore();
    const open = ref(false);
    const savingMode = ref(null);
    const descriptionId = useId$1();
    let openCount = 0;
    function onOpenChange(next) {
      open.value = next;
      if (next) openCount += 1;
    }
    async function onSelectMode(value) {
      const match = options.find((option) => option.mode === value);
      if (!match || savingMode.value !== null) return;
      const openedAs = openCount;
      savingMode.value = match.mode;
      try {
        await store.save(match.mode, null);
        if (openedAs === openCount) open.value = false;
      } catch (error) {
        reportError(error, { errorType: "agent_run_mode_save_failure" });
        toast.add({ severity: "error", detail: t("agent.runModeSaveFailed") });
      } finally {
        savingMode.value = null;
      }
    }
    const TRIGGER_LABEL_KEYS = {
      ask_approval: "agent.runModeTriggerAsk",
      auto: "agent.runModeTriggerAuto",
      auto_limited: "agent.runModeTriggerAutoLimit"
    };
    const triggerLabel = computed(() => t(TRIGGER_LABEL_KEYS[store.mode]));
    const TRIGGER_TOOLTIP_KEYS = {
      ask_approval: "agent.runModeTriggerAskTooltip",
      auto: "agent.runModeTriggerAutoTooltip",
      auto_limited: "agent.runModeTriggerAutoLimitTooltip"
    };
    const triggerTooltip = computed(() => t(TRIGGER_TOOLTIP_KEYS[store.mode]));
    const options = [
      {
        mode: "ask_approval",
        icon: "ctv:icon-[lucide--hand]",
        title: "agent.runModeAsk",
        description: "agent.runModeAskDescription"
      },
      {
        mode: "auto",
        icon: "ctv:icon-[lucide--zap]",
        title: "agent.runModeAuto",
        description: "agent.runModeAutoDescription"
      }
    ];
    return (_ctx, _cache) => {
      const _directive_tooltip = resolveDirective("tooltip");
      return openBlock(), createBlock(unref(DropdownMenuRoot_default), {
        open: open.value,
        modal: false,
        "onUpdate:open": onOpenChange
      }, {
        default: withCtx(() => [
          createVNode(unref(DropdownMenuTrigger_default), { "as-child": "" }, {
            default: withCtx(() => [
              withDirectives((openBlock(), createBlock(_sfc_main$v, {
                variant: "muted-textonly",
                size: "md",
                class: normalizeClass(unref(cn)("ctv:gap-1", open.value && "ctv:bg-secondary-background-hover"))
              }, {
                default: withCtx(() => [
                  createBaseVNode("span", null, toDisplayString(triggerLabel.value), 1),
                  _cache[2] || (_cache[2] = createBaseVNode("span", {
                    "data-testid": "run-mode-chevron",
                    class: "ctv:icon-[lucide--chevron-down] ctv:size-4"
                  }, null, -1))
                ]),
                _: 1
              }, 8, ["class"])), [
                [
                  _directive_tooltip,
                  unref(buildTooltipConfig)(triggerTooltip.value),
                  void 0,
                  { top: true }
                ]
              ])
            ]),
            _: 1
          }),
          createVNode(unref(DropdownMenuPortal_default), null, {
            default: withCtx(() => [
              createVNode(unref(DropdownMenuContent_default), {
                side: "top",
                align: "end",
                "side-offset": 8,
                "aria-describedby": unref(descriptionId),
                class: "agent-scope ctv:z-1100 ctv:flex ctv:w-80 ctv:flex-col ctv:gap-2.5 ctv:rounded-lg ctv:border ctv:border-border-default ctv:bg-secondary-background ctv:p-2.5 ctv:text-base-foreground ctv:shadow-lg ctv:outline-none ctv:data-[side=bottom]:slide-in-from-top-2 ctv:data-[side=top]:slide-in-from-bottom-2 ctv:data-[state=closed]:animate-out ctv:data-[state=closed]:fade-out-0 ctv:data-[state=closed]:zoom-out-95 ctv:data-[state=open]:animate-in ctv:data-[state=open]:fade-in-0 ctv:data-[state=open]:zoom-in-95"
              }, {
                default: withCtx(() => [
                  createBaseVNode("div", _hoisted_1$n, [
                    createBaseVNode("div", _hoisted_2$k, toDisplayString(unref(t)("agent.runPermissions")), 1),
                    createBaseVNode("div", {
                      id: unref(descriptionId),
                      "aria-hidden": "true",
                      class: "ctv:text-xs/4 ctv:text-muted-foreground"
                    }, toDisplayString(unref(t)("agent.runPermissionsDescription")), 9, _hoisted_3$h)
                  ]),
                  createVNode(unref(DropdownMenuRadioGroup_default), {
                    "model-value": unref(store).mode,
                    "aria-label": unref(t)("agent.runPermissions"),
                    class: "ctv:flex ctv:flex-col ctv:gap-1",
                    "onUpdate:modelValue": _cache[1] || (_cache[1] = (value) => onSelectMode(String(value)))
                  }, {
                    default: withCtx(() => [
                      (openBlock(), createElementBlock(Fragment, null, renderList(options, (option) => {
                        return createVNode(unref(DropdownMenuRadioItem_default), {
                          key: option.mode,
                          value: option.mode,
                          disabled: savingMode.value !== null,
                          "aria-busy": savingMode.value === option.mode || void 0,
                          "as-child": "",
                          onSelect: _cache[0] || (_cache[0] = withModifiers(() => {
                          }, ["prevent"]))
                        }, {
                          default: withCtx(() => [
                            createVNode(_sfc_main$v, {
                              variant: unref(store).mode === option.mode ? "tertiary" : "muted-textonly",
                              size: "unset",
                              class: normalizeClass(
                                unref(cn)(
                                  "ctv:w-full ctv:items-start ctv:gap-3 ctv:px-2.5 ctv:py-2 ctv:text-left ctv:whitespace-normal ctv:data-disabled:pointer-events-none",
                                  savingMode.value !== null && savingMode.value !== option.mode && "ctv:opacity-50"
                                )
                              )
                            }, {
                              default: withCtx(() => [
                                createBaseVNode("span", {
                                  class: normalizeClass(
                                    unref(cn)(
                                      "ctv:mt-0.5 ctv:size-4 ctv:shrink-0 ctv:text-muted-foreground",
                                      option.icon
                                    )
                                  )
                                }, null, 2),
                                createBaseVNode("span", _hoisted_4$d, [
                                  createBaseVNode("span", _hoisted_5$b, toDisplayString(unref(t)(option.title)), 1),
                                  createBaseVNode("span", _hoisted_6$a, toDisplayString(unref(t)(option.description)), 1)
                                ]),
                                createBaseVNode("span", {
                                  "aria-hidden": "true",
                                  class: normalizeClass(
                                    unref(cn)(
                                      "ctv:mt-0.5 ctv:size-4 ctv:shrink-0",
                                      savingMode.value === option.mode ? "ctv:icon-[lucide--loader-circle] ctv:text-muted-foreground ctv:motion-safe:animate-spin" : unref(store).mode === option.mode && "ctv:icon-[lucide--check] ctv:text-base-foreground"
                                    )
                                  )
                                }, null, 2)
                              ]),
                              _: 2
                            }, 1032, ["variant", "class"])
                          ]),
                          _: 2
                        }, 1032, ["value", "disabled", "aria-busy"]);
                      }), 64))
                    ]),
                    _: 1
                  }, 8, ["model-value", "aria-label"])
                ]),
                _: 1
              }, 8, ["aria-describedby"]),
              open.value ? (openBlock(), createElementBlock("span", _hoisted_7$7, toDisplayString(savingMode.value === null ? "" : unref(t)("g.saving")), 1)) : createCommentVNode("", true)
            ]),
            _: 1
          })
        ]),
        _: 1
      }, 8, ["open"]);
    };
  }
});
const _hoisted_1$m = {
  id: "agent-composer",
  class: "ctv:relative ctv:flex ctv:flex-col ctv:rounded-lg ctv:border ctv:border-border-default ctv:bg-base-background"
};
const _hoisted_2$j = ["aria-label"];
const _hoisted_3$g = {
  key: 0,
  class: "ctv:flex ctv:h-6 ctv:items-center ctv:px-1.5 ctv:py-1 ctv:text-xs/4 ctv:text-muted-foreground"
};
const _hoisted_4$c = ["id", "aria-disabled", "aria-description", "data-active", "onMouseenter", "onClick"];
const _hoisted_5$a = {
  key: 0,
  class: "ctv:icon-[comfy--node] ctv:size-3.5 ctv:shrink-0"
};
const _hoisted_6$9 = {
  key: 1,
  class: "ctv:icon-[comfy--workflow] ctv:size-3.5 ctv:shrink-0"
};
const _hoisted_7$6 = {
  key: 2,
  class: "ctv:icon-[lucide--chevron-left] ctv:size-4 ctv:shrink-0"
};
const _hoisted_8$4 = { class: "ctv:min-w-0 ctv:flex-1 ctv:truncate" };
const _hoisted_9$1 = {
  key: 3,
  class: "ctv:text-xs ctv:text-muted-foreground"
};
const _hoisted_10 = {
  key: 5,
  class: "ctv:icon-[lucide--chevron-right] ctv:size-4 ctv:shrink-0"
};
const _hoisted_11 = {
  key: 1,
  role: "status",
  class: "ctv:px-2 ctv:py-1 ctv:text-xs ctv:text-muted-foreground"
};
const _hoisted_12 = {
  key: 1,
  class: "ctv:flex ctv:h-11 ctv:shrink-0 ctv:items-center ctv:rounded-t-lg ctv:bg-base-background ctv:px-2"
};
const _hoisted_13 = {
  key: 0,
  role: "status",
  class: "ctv:absolute ctv:inset-px ctv:z-20 ctv:flex ctv:flex-col ctv:items-center ctv:justify-center ctv:gap-2 ctv:rounded-lg ctv:bg-secondary-background ctv:font-inter ctv:text-[14px] ctv:leading-[normal] ctv:font-normal ctv:text-muted-foreground"
};
const _hoisted_14 = {
  key: 1,
  "data-testid": "composer-node-section",
  class: "ctv:flex ctv:flex-wrap ctv:items-center ctv:gap-2 ctv:border-b ctv:border-border-default ctv:p-3"
};
const _hoisted_15 = { class: "ctv:flex ctv:items-center ctv:gap-1" };
const _hoisted_16 = { class: "ctv:max-w-40 ctv:truncate" };
const _hoisted_17 = {
  key: 2,
  "data-testid": "composer-asset-section",
  class: "ctv:flex ctv:flex-wrap ctv:gap-2 ctv:p-3"
};
const _hoisted_18 = {
  "data-testid": "composer-inline-input",
  class: "ctv:max-h-100 ctv:min-h-16 ctv:overflow-x-hidden ctv:overflow-y-auto ctv:p-3"
};
const _hoisted_19 = {
  key: 0,
  role: "status",
  class: "ctv:mb-1 ctv:flex ctv:items-center ctv:gap-1 ctv:text-xs ctv:text-muted-foreground"
};
const _hoisted_20 = { class: "ctv:relative ctv:min-h-7" };
const _hoisted_21 = {
  key: 0,
  class: "ctv:pointer-events-none ctv:relative ctv:z-10 ctv:-mt-7 ctv:font-inter ctv:text-[14px]/[20px] ctv:font-normal ctv:text-muted-foreground"
};
const _hoisted_22 = { class: "ctv:underline ctv:decoration-dashed ctv:underline-offset-2" };
const _hoisted_23 = { class: "ctv:flex ctv:items-center ctv:justify-between ctv:px-3 ctv:py-2" };
const _hoisted_24 = { class: "ctv:whitespace-nowrap" };
const _hoisted_25 = { class: "ctv:whitespace-nowrap" };
const _hoisted_26 = { class: "ctv:whitespace-nowrap" };
const _hoisted_27 = { class: "ctv:whitespace-nowrap" };
const _hoisted_28 = { class: "ctv:flex ctv:items-center ctv:gap-1" };
const _hoisted_29 = {
  key: 0,
  class: "ctv:icon-[lucide--square] ctv:size-4"
};
const _hoisted_30 = {
  key: 1,
  class: "ctv:icon-[lucide--arrow-up] ctv:size-4"
};
const _hoisted_31 = {
  key: 0,
  class: "ctv:ml-1 ctv:opacity-50"
};
const duplicateIdClass = "ctv:shrink-0 ctv:rounded-full ctv:bg-interface-menu-keybind-surface-default ctv:px-1 ctv:py-0.5 ctv:font-mono ctv:text-xs/4 ctv:font-medium ctv:text-base-foreground";
const _sfc_main$n = /* @__PURE__ */ defineComponent({
  __name: "Composer",
  props: {
    streaming: { type: Boolean, default: false },
    submitting: { type: Boolean, default: false },
    canAttach: { type: Boolean, default: false },
    canOpenAssets: { type: Boolean, default: false },
    canOpenEagle: { type: Boolean, default: false },
    selectionTags: { default: () => [] },
    nodeReferenceDisabledReason: {},
    availableWorkflows: { default: () => [] },
    selectWorkflowReference: { type: Function, default: async () => void 0 },
    editableWorkflowId: {},
    hasWorkflowTarget: { type: Boolean, default: false },
    workflowSelecting: { type: Boolean, default: false },
    getMentionNodes: { type: Function, default: () => [] }
  },
  emits: ["send", "stop", "attach", "openAssets", "openEagle", "selectNodes", "removeTag", "mentionPick", "requestWorkflowReferences", "removeWorkflowReference", "openReferenceWorkflow", "workflowTargetRequired"],
  setup(__props, { expose: __expose, emit: __emit }) {
    const emit = __emit;
    const { t } = useI18n();
    const assetDragActive = inject(
      "agentAssetDragActive",
      ref(false)
    );
    const running = computed(() => __props.streaming || __props.submitting);
    const composer = useComposer({
      onSend: (text2, attachments) => {
        if (__props.workflowSelecting || __props.submitting) return;
        if (!__props.hasWorkflowTarget) {
          emit("workflowTargetRequired");
          return;
        }
        if (workflowReferences.value.length > 0) {
          const { text: draft, workflowReferences: references } = composerPromptForSend(composer.prompt.value);
          const offsets = references.map((reference) => reference.textOffset);
          const start = Math.min(
            draft.length - draft.trimStart().length,
            ...offsets
          );
          const end = Math.max(draft.trimEnd().length, ...offsets);
          emit(
            "send",
            draft.slice(start, end),
            attachments,
            references.map((reference) => ({
              ...reference,
              textOffset: Math.min(
                end - start,
                Math.max(0, reference.textOffset - start)
              )
            }))
          );
        } else emit("send", text2, attachments);
      },
      isRunning: () => running.value,
      onStop: () => emit("stop")
    });
    const editorRef = useTemplateRef("editorRef");
    const { workflowReferences } = composer;
    const addMenuOpen = ref(false);
    const { eligibleWorkflows, selectWorkflow } = useWorkflowReferencePicker({
      editor: () => editorRef.value,
      references: () => workflowReferences.value,
      workflows: () => __props.availableWorkflows,
      editableWorkflowId: () => __props.editableWorkflowId,
      selecting: () => __props.workflowSelecting,
      resolve: (workflow) => __props.selectWorkflowReference(workflow)
    });
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
      selectionTags: () => __props.selectionTags,
      workflows: () => eligibleWorkflows.value,
      nodeReferenceDisabledReason: () => __props.nodeReferenceDisabledReason,
      workflowSelecting: () => __props.workflowSelecting,
      getMentionNodes: () => __props.getMentionNodes(),
      selectWorkflow,
      pickNode: (node) => emit("mentionPick", node),
      requestWorkflows: () => emit("requestWorkflowReferences")
    });
    function onSelectNodes(event) {
      if (__props.nodeReferenceDisabledReason) {
        event.preventDefault();
        return;
      }
      emit("selectNodes");
    }
    function onEditorSelectionChange() {
      var _a2;
      const point = (_a2 = editorRef.value) == null ? void 0 : _a2.insertionPoint();
      if (point) composer.setInsertionPoint(point);
      syncMention();
    }
    function onComposerKeydown(event) {
      if (handleMentionKeydown(event)) return;
      if (event.key === "Enter") onEnter(event);
      if (event.key === "Escape" && running.value && !event.isComposing && !event.repeat) {
        event.preventDefault();
        event.stopPropagation();
        emit("stop");
      }
    }
    const mentionListRef = useTemplateRef("mentionListRef");
    watch(mentionActive, async () => {
      var _a2, _b, _c;
      await nextTick();
      (_c = (_b = (_a2 = mentionListRef.value) == null ? void 0 : _a2.querySelector('[data-active="true"]')) == null ? void 0 : _b.scrollIntoView) == null ? void 0 : _c.call(_b, { block: "nearest" });
    });
    const placeholderHint = computed(() => {
      const [text2 = "", mentionNodes = ""] = t("agent.placeholder").split("\n");
      return { text: text2, mentionNodes };
    });
    function onEnter(event) {
      if (event.isComposing || event.shiftKey) return;
      event.preventDefault();
      if (running.value) return;
      composer.submit();
    }
    const primaryActionTooltip = computed(
      () => running.value ? t("agent.stop") : t("agent.send")
    );
    const primaryActionShortcut = computed(
      () => running.value ? t("agent.stopShortcut") : void 0
    );
    function onPrimaryAction() {
      if (running.value) emit("stop");
      else composer.submit();
    }
    function insert(text2) {
      var _a2;
      composer.insert(text2);
      (_a2 = editorRef.value) == null ? void 0 : _a2.focus();
    }
    function replaceDraft(prompt) {
      var _a2;
      composer.replacePrompt(prompt);
      (_a2 = editorRef.value) == null ? void 0 : _a2.focus();
    }
    __expose({
      insert,
      replaceDraft,
      addAttachment: composer.addAttachment,
      updateAttachment: composer.updateAttachment,
      removeAttachment: composer.removeAttachment
    });
    return (_ctx, _cache) => {
      const _directive_tooltip = resolveDirective("tooltip");
      return openBlock(), createElementBlock("div", _hoisted_1$m, [
        unref(mentionVisible) ? (openBlock(), createElementBlock("div", {
          key: 0,
          id: "agent-reference-menu",
          ref_key: "mentionListRef",
          ref: mentionListRef,
          "data-testid": "agent-reference-menu",
          role: "menu",
          "aria-label": unref(t)("agent.addToPrompt"),
          class: "ctv:absolute ctv:inset-x-0 ctv:bottom-full ctv:z-1100 ctv:-mb-8.75 ctv:max-h-64 ctv:overflow-y-auto ctv:rounded-lg ctv:border ctv:border-border-subtle ctv:bg-secondary-background ctv:p-1 ctv:font-inter ctv:shadow-md",
          onMousedown: _cache[0] || (_cache[0] = withModifiers(() => {
          }, ["prevent"]))
        }, [
          unref(mentionSection) === "root" ? (openBlock(), createElementBlock("div", _hoisted_3$g, toDisplayString(unref(t)("agent.reference")), 1)) : createCommentVNode("", true),
          (openBlock(true), createElementBlock(Fragment, null, renderList(unref(mentionMatches), (match, index) => {
            return openBlock(), createBlock(_sfc_main$s, {
              key: `${match.kind}:${match.id}`,
              label: __props.nodeReferenceDisabledReason ?? "",
              disabled: !unref(isNodeReferenceDisabled)(match),
              "skip-delay-duration": 0,
              "disable-hoverable-content": "",
              "collision-padding": 8
            }, {
              trigger: withCtx(() => [
                createBaseVNode("div", {
                  id: `agent-reference-item-${index}`,
                  "aria-disabled": unref(isMentionDisabled)(match) || void 0,
                  "aria-description": unref(isNodeReferenceDisabled)(match) ? __props.nodeReferenceDisabledReason : void 0,
                  role: "menuitem",
                  "data-active": index === unref(mentionActive),
                  class: normalizeClass(
                    unref(cn)(
                      "ctv:flex ctv:h-7 ctv:w-full ctv:cursor-pointer ctv:items-center ctv:gap-1.5 ctv:rounded-lg ctv:px-1.5 ctv:py-1 ctv:text-xs ctv:font-normal ctv:text-base-foreground ctv:outline-none ctv:aria-disabled:cursor-not-allowed ctv:aria-disabled:opacity-50",
                      index === unref(mentionActive) && "ctv:bg-secondary-background-hover"
                    )
                  ),
                  onMouseenter: ($event) => unref(highlightMention)(index),
                  onClick: ($event) => unref(pickMention)(match)
                }, [
                  match.kind === "section" && match.id === "nodes" ? (openBlock(), createElementBlock("span", _hoisted_5$a)) : match.kind === "section" && match.id === "workflows" ? (openBlock(), createElementBlock("span", _hoisted_6$9)) : match.kind === "back" ? (openBlock(), createElementBlock("span", _hoisted_7$6)) : createCommentVNode("", true),
                  createBaseVNode("span", _hoisted_8$4, toDisplayString(match.label), 1),
                  match.kind === "workflow" && match.workflow.id === void 0 ? (openBlock(), createElementBlock("span", _hoisted_9$1, toDisplayString(unref(t)("agent.unsavedWorkflow")), 1)) : createCommentVNode("", true),
                  match.kind === "node" && unref(graphDupes).has(match.node.title) ? (openBlock(), createElementBlock("span", {
                    key: 4,
                    class: normalizeClass(unref(cn)(duplicateIdClass, "ctv:ml-auto"))
                  }, " #" + toDisplayString(match.node.id), 3)) : createCommentVNode("", true),
                  match.kind === "section" ? (openBlock(), createElementBlock("span", _hoisted_10)) : createCommentVNode("", true)
                ], 42, _hoisted_4$c)
              ]),
              _: 2
            }, 1032, ["label", "disabled"]);
          }), 128)),
          !unref(mentionHasResults) ? (openBlock(), createElementBlock("div", _hoisted_11, toDisplayString(unref(mentionSection) === "workflows" ? unref(t)("agent.noWorkflowsToReference") : unref(t)("agent.noNodesToReference")), 1)) : createCommentVNode("", true)
        ], 40, _hoisted_2$j)) : createCommentVNode("", true),
        _ctx.$slots.header ? (openBlock(), createElementBlock("div", _hoisted_12, [
          renderSlot(_ctx.$slots, "header")
        ])) : createCommentVNode("", true),
        createBaseVNode("div", {
          class: normalizeClass(
            unref(cn)(
              "ctv:relative ctv:flex ctv:flex-col ctv:border ctv:transition-colors",
              unref(assetDragActive) ? "ctv:h-28 ctv:rounded-lg ctv:border-dashed ctv:border-component-node-border ctv:bg-secondary-background" : "ctv:min-h-28 ctv:rounded-lg ctv:border-border-default ctv:bg-secondary-background ctv:focus-within:border-muted-foreground"
            )
          )
        }, [
          unref(assetDragActive) ? (openBlock(), createElementBlock("div", _hoisted_13, [
            _cache[9] || (_cache[9] = createBaseVNode("span", {
              "aria-hidden": "true",
              class: "ctv:icon-[lucide--upload] ctv:size-6 ctv:shrink-0 ctv:text-muted-foreground"
            }, null, -1)),
            createBaseVNode("span", null, toDisplayString(unref(t)("agent.dragAndDropAssets")), 1)
          ])) : createCommentVNode("", true),
          __props.selectionTags.length ? (openBlock(), createElementBlock("div", _hoisted_14, [
            (openBlock(true), createElementBlock(Fragment, null, renderList(__props.selectionTags, (tag) => {
              return openBlock(), createElementBlock("span", {
                key: unref(selectedNodeKey)(tag),
                class: "ctv:inline-flex ctv:h-7 ctv:items-center ctv:gap-1 ctv:rounded-lg ctv:border ctv:border-border-default ctv:bg-secondary-background-hover ctv:px-2.5 ctv:text-xs/4 ctv:font-medium ctv:text-base-foreground ctv:transition-colors ctv:hover:bg-tertiary-background-hover"
              }, [
                createBaseVNode("span", _hoisted_15, [
                  _cache[10] || (_cache[10] = createBaseVNode("span", { class: "ctv:icon-[comfy--node] ctv:size-3.5 ctv:text-muted-foreground" }, null, -1)),
                  createBaseVNode("span", _hoisted_16, toDisplayString(tag.title), 1),
                  unref(graphDupes).has(tag.title) || unref(tagDupes).has(tag.title) ? (openBlock(), createElementBlock("span", {
                    key: 0,
                    class: normalizeClass(duplicateIdClass)
                  }, "#" + toDisplayString(tag.id), 1)) : createCommentVNode("", true)
                ]),
                withDirectives((openBlock(), createBlock(_sfc_main$v, {
                  type: "button",
                  variant: "muted-textonly",
                  size: "unset",
                  "aria-label": unref(t)("agent.removeNodeLabel", { node: `${tag.title} #${tag.id}` }),
                  class: "ctv:size-3.5",
                  onClick: withModifiers(($event) => emit("removeTag", unref(selectedNodeKey)(tag)), ["stop"])
                }, {
                  default: withCtx(() => [..._cache[11] || (_cache[11] = [
                    createBaseVNode("span", { class: "ctv:icon-[lucide--x] ctv:size-3.5 ctv:shrink-0" }, null, -1)
                  ])]),
                  _: 1
                }, 8, ["aria-label", "onClick"])), [
                  [
                    _directive_tooltip,
                    unref(buildTooltipConfig)(unref(t)("agent.remove")),
                    void 0,
                    { top: true }
                  ]
                ])
              ]);
            }), 128))
          ])) : createCommentVNode("", true),
          unref(composer).attachments.value.length ? (openBlock(), createElementBlock("div", _hoisted_17, [
            (openBlock(true), createElementBlock(Fragment, null, renderList(unref(composer).attachments.value, (item) => {
              return openBlock(), createBlock(_sfc_main$p, {
                key: item.id,
                name: item.name,
                "preview-url": item.previewUrl,
                uploading: item.uploading,
                onRemove: ($event) => unref(composer).removeReference(`asset:${item.id}`)
              }, null, 8, ["name", "preview-url", "uploading", "onRemove"]);
            }), 128))
          ])) : createCommentVNode("", true),
          createBaseVNode("div", _hoisted_18, [
            __props.workflowSelecting ? (openBlock(), createElementBlock("div", _hoisted_19, [
              _cache[12] || (_cache[12] = createBaseVNode("span", { class: "ctv:icon-[lucide--loader-circle] ctv:size-3 ctv:animate-spin" }, null, -1)),
              createTextVNode(" " + toDisplayString(unref(t)("agent.savingWorkflow")), 1)
            ])) : createCommentVNode("", true),
            createBaseVNode("div", _hoisted_20, [
              createVNode(_sfc_main$q, {
                ref_key: "editorRef",
                ref: editorRef,
                "model-value": unref(composer).prompt.value,
                label: unref(t)("agent.placeholder"),
                expanded: unref(mentionVisible),
                "active-descendant": unref(mentionVisible) ? `agent-reference-item-${unref(mentionActive)}` : void 0,
                "history-epoch": unref(composer).promptEpoch.value,
                "editable-workflow-id": __props.editableWorkflowId,
                onKeydown: onComposerKeydown,
                "onUpdate:modelValue": unref(composer).applyEditorPrompt,
                onKeyup: unref(onComposerKeyup),
                onInput: unref(syncMention),
                onSelectionChange: onEditorSelectionChange,
                onClick: unref(syncMention),
                onBlur: _cache[1] || (_cache[1] = ($event) => unref(closeMention)()),
                onOpenReferenceWorkflow: _cache[2] || (_cache[2] = (id, name) => emit("openReferenceWorkflow", id, name)),
                onRemoveNodeReference: _cache[3] || (_cache[3] = ($event) => emit("removeTag", $event)),
                onRemoveWorkflowReference: _cache[4] || (_cache[4] = ($event) => emit("removeWorkflowReference", $event))
              }, null, 8, ["model-value", "label", "expanded", "active-descendant", "history-epoch", "editable-workflow-id", "onUpdate:modelValue", "onKeyup", "onInput", "onClick"]),
              !unref(composer).draft.value && !unref(composer).prompt.value.references.length ? (openBlock(), createElementBlock("div", _hoisted_21, [
                createBaseVNode("span", null, toDisplayString(placeholderHint.value.text), 1),
                createVNode(_sfc_main$s, {
                  label: __props.nodeReferenceDisabledReason ?? "",
                  disabled: !__props.nodeReferenceDisabledReason,
                  "skip-delay-duration": 0,
                  "disable-hoverable-content": "",
                  "collision-padding": 8
                }, {
                  trigger: withCtx(() => [
                    createVNode(_sfc_main$v, {
                      type: "button",
                      variant: "link",
                      size: "unset",
                      "aria-disabled": !!__props.nodeReferenceDisabledReason || void 0,
                      "aria-description": __props.nodeReferenceDisabledReason,
                      class: "ctv:pointer-events-auto ctv:-ml-1 ctv:h-5 ctv:shrink-0 ctv:gap-1 ctv:px-1 ctv:align-top ctv:text-sm/5 ctv:aria-disabled:cursor-not-allowed ctv:aria-disabled:opacity-50",
                      onClick: onSelectNodes
                    }, {
                      default: withCtx(() => [
                        _cache[13] || (_cache[13] = createBaseVNode("span", { class: "ctv:icon-[lucide--mouse-pointer-click] ctv:size-3.5 ctv:shrink-0" }, null, -1)),
                        createBaseVNode("span", _hoisted_22, toDisplayString(placeholderHint.value.mentionNodes), 1)
                      ]),
                      _: 1
                    }, 8, ["aria-disabled", "aria-description"])
                  ]),
                  _: 1
                }, 8, ["label", "disabled"])
              ])) : createCommentVNode("", true)
            ])
          ]),
          createBaseVNode("div", _hoisted_23, [
            createVNode(unref(DropdownMenuRoot_default), {
              open: addMenuOpen.value,
              "onUpdate:open": _cache[8] || (_cache[8] = ($event) => addMenuOpen.value = $event)
            }, {
              default: withCtx(() => [
                createVNode(unref(DropdownMenuTrigger_default), { "as-child": "" }, {
                  default: withCtx(() => [
                    withDirectives((openBlock(), createBlock(_sfc_main$v, {
                      variant: "muted-textonly",
                      size: "icon",
                      "aria-label": unref(t)("agent.addToPrompt")
                    }, {
                      default: withCtx(() => [..._cache[14] || (_cache[14] = [
                        createBaseVNode("span", { class: "ctv:icon-[lucide--plus] ctv:size-4" }, null, -1)
                      ])]),
                      _: 1
                    }, 8, ["aria-label"])), [
                      [
                        _directive_tooltip,
                        unref(buildTooltipConfig)(unref(t)("agent.addToPrompt")),
                        void 0,
                        { top: true }
                      ]
                    ])
                  ]),
                  _: 1
                }),
                createVNode(unref(DropdownMenuPortal_default), null, {
                  default: withCtx(() => [
                    createVNode(unref(DropdownMenuContent_default), {
                      side: "top",
                      align: "start",
                      "side-offset": 4,
                      class: "agent-scope ctv:z-1100 ctv:box-border ctv:w-max ctv:min-w-46.5 ctv:rounded-lg ctv:border ctv:border-border-subtle ctv:bg-secondary-background ctv:p-1 ctv:font-inter ctv:shadow-lg"
                    }, {
                      default: withCtx(() => [
                        createVNode(_sfc_main$s, {
                          label: __props.nodeReferenceDisabledReason ?? "",
                          disabled: !__props.nodeReferenceDisabledReason,
                          "skip-delay-duration": 0,
                          "disable-hoverable-content": "",
                          "collision-padding": 8
                        }, {
                          trigger: withCtx(() => [
                            createVNode(unref(DropdownMenuItem_default), {
                              disabled: !!__props.nodeReferenceDisabledReason,
                              "aria-description": __props.nodeReferenceDisabledReason,
                              class: "ctv:mb-0.5 ctv:box-border ctv:flex ctv:h-7 ctv:w-full ctv:cursor-pointer ctv:items-center ctv:gap-1.5 ctv:rounded-lg ctv:px-1.5 ctv:py-1 ctv:text-[14px]/5 ctv:font-normal ctv:text-base-foreground ctv:outline-none ctv:aria-disabled:cursor-not-allowed ctv:aria-disabled:opacity-50 ctv:data-highlighted:bg-secondary-background-hover",
                              onSelect: onSelectNodes
                            }, {
                              default: withCtx(() => [
                                _cache[15] || (_cache[15] = createBaseVNode("span", { class: "ctv:icon-[comfy--node] ctv:size-4 ctv:shrink-0" }, null, -1)),
                                createBaseVNode("span", _hoisted_24, toDisplayString(unref(t)("agent.nodes")), 1)
                              ]),
                              _: 1
                            }, 8, ["disabled", "aria-description"])
                          ]),
                          _: 1
                        }, 8, ["label", "disabled"]),
                        __props.canOpenAssets ? (openBlock(), createBlock(unref(DropdownMenuItem_default), {
                          key: 0,
                          class: "ctv:box-border ctv:flex ctv:h-7 ctv:w-full ctv:cursor-pointer ctv:items-center ctv:gap-1.5 ctv:rounded-lg ctv:px-1.5 ctv:py-1 ctv:text-[14px]/5 ctv:font-normal ctv:text-base-foreground ctv:outline-none ctv:data-highlighted:bg-secondary-background-hover",
                          onSelect: _cache[5] || (_cache[5] = ($event) => emit("openAssets"))
                        }, {
                          default: withCtx(() => [
                            _cache[16] || (_cache[16] = createBaseVNode("span", { class: "ctv:icon-[comfy--image-ai-edit] ctv:size-4 ctv:shrink-0" }, null, -1)),
                            createBaseVNode("span", _hoisted_25, toDisplayString(unref(t)("agent.addFromAssets")), 1)
                          ]),
                          _: 1
                        })) : createCommentVNode("", true),
                        __props.canOpenEagle ? (openBlock(), createBlock(unref(DropdownMenuItem_default), {
                          key: 1,
                          class: "ctv:box-border ctv:flex ctv:h-7 ctv:w-full ctv:cursor-pointer ctv:items-center ctv:gap-1.5 ctv:rounded-lg ctv:px-1.5 ctv:py-1 ctv:text-[14px]/5 ctv:font-normal ctv:text-base-foreground ctv:outline-none ctv:data-highlighted:bg-secondary-background-hover",
                          onSelect: _cache[6] || (_cache[6] = ($event) => emit("openEagle"))
                        }, {
                          default: withCtx(() => [
                            _cache[17] || (_cache[17] = createBaseVNode("span", { class: "ctv:icon-[lucide--bird] ctv:size-4 ctv:shrink-0" }, null, -1)),
                            createBaseVNode("span", _hoisted_26, toDisplayString(unref(t)("agent.addFromEagle")), 1)
                          ]),
                          _: 1
                        })) : createCommentVNode("", true),
                        __props.canAttach && (__props.canOpenAssets || __props.canOpenEagle) ? (openBlock(), createBlock(unref(DropdownMenuSeparator_default), {
                          key: 2,
                          class: "ctv:mt-0 ctv:mb-px ctv:h-px ctv:bg-border-subtle"
                        })) : createCommentVNode("", true),
                        __props.canAttach ? (openBlock(), createBlock(unref(DropdownMenuItem_default), {
                          key: 3,
                          class: "ctv:box-border ctv:flex ctv:h-7 ctv:w-full ctv:cursor-pointer ctv:items-center ctv:gap-1.5 ctv:rounded-lg ctv:px-1.5 ctv:py-1 ctv:text-[14px]/5 ctv:font-normal ctv:text-base-foreground ctv:outline-none ctv:data-highlighted:bg-secondary-background-hover",
                          onSelect: _cache[7] || (_cache[7] = ($event) => emit("attach"))
                        }, {
                          default: withCtx(() => [
                            _cache[18] || (_cache[18] = createBaseVNode("i", { class: "ctv:icon-[lucide--paperclip] ctv:size-4 ctv:shrink-0" }, null, -1)),
                            createBaseVNode("span", _hoisted_27, toDisplayString(unref(t)("agent.attachFiles")), 1)
                          ]),
                          _: 1
                        })) : createCommentVNode("", true)
                      ]),
                      _: 1
                    })
                  ]),
                  _: 1
                })
              ]),
              _: 1
            }, 8, ["open"]),
            createBaseVNode("div", _hoisted_28, [
              createVNode(_sfc_main$o),
              createVNode(_sfc_main$s, {
                label: primaryActionTooltip.value,
                "skip-delay-duration": 0,
                "disable-hoverable-content": "",
                "collision-padding": 8
              }, {
                trigger: withCtx(() => [
                  createVNode(_sfc_main$v, {
                    type: "button",
                    variant: running.value ? "secondary" : "inverted",
                    size: "icon",
                    "aria-label": running.value ? unref(t)("agent.stop") : unref(t)("agent.send"),
                    disabled: !running.value && (__props.workflowSelecting || !unref(composer).canSend.value),
                    onClick: onPrimaryAction
                  }, {
                    default: withCtx(() => [
                      running.value ? (openBlock(), createElementBlock("i", _hoisted_29)) : (openBlock(), createElementBlock("i", _hoisted_30))
                    ]),
                    _: 1
                  }, 8, ["variant", "aria-label", "disabled"])
                ]),
                content: withCtx(() => [
                  createTextVNode(toDisplayString(primaryActionTooltip.value) + " ", 1),
                  primaryActionShortcut.value ? (openBlock(), createElementBlock("span", _hoisted_31, toDisplayString(primaryActionShortcut.value), 1)) : createCommentVNode("", true)
                ]),
                _: 1
              }, 8, ["label"])
            ])
          ])
        ], 2)
      ]);
    };
  }
});
const ASSET_KINDS = /* @__PURE__ */ new Set(["image", "video", "audio", "3D"]);
function classifyAssetUrl(href, baseUrl = window.location.origin) {
  let url;
  try {
    url = new URL(href, baseUrl);
  } catch {
    return null;
  }
  let filename = url.searchParams.get("filename");
  try {
    filename ?? (filename = decodeURIComponent(url.pathname.split("/").at(-1) ?? ""));
  } catch {
    return null;
  }
  if (!filename) return null;
  const kind = getMediaTypeFromFilename(filename);
  if (!ASSET_KINDS.has(kind)) return null;
  return { url: href, filename, kind };
}
function scanInline(tokens) {
  const scan = { assets: [], sawImageSyntax: false };
  for (const token of tokens ?? []) {
    if (token.type === "image" || token.type === "link") {
      const asset = token.href ? classifyAssetUrl(token.href) : null;
      if (!asset) return null;
      if (token.type === "image") {
        scan.sawImageSyntax = true;
        if (token.text) asset.label = token.text;
      }
      scan.assets.push(asset);
    } else if (token.type === "br" || token.type === "space") {
      continue;
    } else if (token.type === "text" && (token.text ?? "").trim() === "") {
      continue;
    } else {
      return null;
    }
  }
  return scan.assets.length ? scan : null;
}
function selectAssets(scan) {
  const { assets, sawImageSyntax } = scan;
  if (assets.length > 1 || sawImageSyntax) return assets;
  return assets[0].kind === "image" ? null : assets;
}
function tokenReplyAssets(token) {
  if (token.type === "paragraph") {
    const scan = scanInline(token.tokens);
    return scan ? selectAssets(scan) : null;
  }
  if (token.type !== "list") return null;
  const combined = { assets: [], sawImageSyntax: false };
  for (const item of token.items) {
    for (const block of item.tokens) {
      if (block.type !== "text" && block.type !== "paragraph") return null;
      const scan = scanInline(block.tokens);
      if (!scan) return null;
      combined.assets.push(...scan.assets);
      combined.sawImageSyntax || (combined.sawImageSyntax = scan.sawImageSyntax);
    }
  }
  return combined.assets.length ? selectAssets(combined) : null;
}
function htmlReplyAssets(html2) {
  const doc = new DOMParser().parseFromString(html2, "text/html");
  const seen = /* @__PURE__ */ new Set();
  const out = [];
  for (const element of doc.querySelectorAll("a[href], img[src]")) {
    const href = element.getAttribute("href") ?? element.getAttribute("src") ?? "";
    const asset = classifyAssetUrl(href);
    if (asset && !seen.has(asset.url)) {
      seen.add(asset.url);
      out.push(asset);
    }
  }
  return out;
}
function replyAssetResultItem(asset) {
  return {
    filename: asset.filename,
    subfolder: "",
    type: "output",
    nodeId: "",
    mediaType: asset.kind === "image" ? "images" : asset.kind,
    url: asset.url
  };
}
function z() {
  return { async: false, breaks: false, extensions: null, gfm: true, hooks: null, pedantic: false, renderer: null, silent: false, tokenizer: null, walkTokens: null };
}
var T = z();
function N(l3) {
  T = l3;
}
var _ = { exec: () => null };
function E(l3) {
  let e = [];
  return (t) => {
    let n = Math.max(0, Math.min(3, t - 1)), s = e[n];
    return s || (s = l3(n), e[n] = s), s;
  };
}
function d(l3, e = "") {
  let t = typeof l3 == "string" ? l3 : l3.source, n = { replace: (s, r) => {
    let i = typeof r == "string" ? r : r.source;
    return i = i.replace(m.caret, "$1"), t = t.replace(s, i), n;
  }, getRegex: () => new RegExp(t, e) };
  return n;
}
var Te = ((l3 = "") => {
  try {
    return !!new RegExp("(?<=1)(?<!1)" + l3);
  } catch {
    return false;
  }
})(), m = { codeRemoveIndent: /^(?: {1,4}| {0,3}\t)/gm, outputLinkReplace: /\\([\[\]])/g, indentCodeCompensation: /^(\s+)(?:```)/, beginningSpace: /^\s+/, endingHash: /#$/, startingSpaceChar: /^ /, endingSpaceChar: / $/, nonSpaceChar: /[^ ]/, newLineCharGlobal: /\n/g, tabCharGlobal: /\t/g, multipleSpaceGlobal: /\s+/g, blankLine: /^[ \t]*$/, doubleBlankLine: /\n[ \t]*\n[ \t]*$/, blockquoteStart: /^ {0,3}>/, blockquoteSetextReplace: /\n {0,3}((?:=+|-+) *)(?=\n|$)/g, blockquoteSetextReplace2: /^ {0,3}>[ \t]?/gm, listReplaceNesting: /^ {1,4}(?=( {4})*[^ ])/g, listIsTask: /^\[[ xX]\] +\S/, listReplaceTask: /^\[[ xX]\] +/, listTaskCheckbox: /\[[ xX]\]/, anyLine: /\n.*\n/, hrefBrackets: /^<(.*)>$/, tableDelimiter: /[:|]/, tableAlignChars: /^\||\| *$/g, tableRowBlankLine: /\n[ \t]*$/, tableAlignRight: /^ *-+: *$/, tableAlignCenter: /^ *:-+: *$/, tableAlignLeft: /^ *:-+ *$/, startATag: /^<a /i, endATag: /^<\/a>/i, startPreScriptTag: /^<(pre|code|kbd|script)(\s|>)/i, endPreScriptTag: /^<\/(pre|code|kbd|script)(\s|>)/i, startAngleBracket: /^</, endAngleBracket: />$/, pedanticHrefTitle: /^([^'"]*[^\s])\s+(['"])(.*)\2/, unicodeAlphaNumeric: /[\p{L}\p{N}]/u, escapeTest: /[&<>"']/, escapeReplace: /[&<>"']/g, escapeTestNoEncode: /[<>"']|&(?!(#\d{1,7}|#[Xx][a-fA-F0-9]{1,6}|\w+);)/, escapeReplaceNoEncode: /[<>"']|&(?!(#\d{1,7}|#[Xx][a-fA-F0-9]{1,6}|\w+);)/g, caret: /(^|[^\[])\^/g, percentDecode: /%25/g, findPipe: /\|/g, splitPipe: / \|/, slashPipe: /\\\|/g, carriageReturn: /\r\n|\r/g, spaceLine: /^ +$/gm, notSpaceStart: /^\S*/, endingNewline: /\n$/, listItemRegex: (l3) => new RegExp(`^( {0,3}${l3})((?:[	 ][^\\n]*)?(?:\\n|$))`), nextBulletRegex: E((l3) => new RegExp(`^ {0,${l3}}(?:[*+-]|\\d{1,9}[.)])((?:[ 	][^\\n]*)?(?:\\n|$))`)), hrRegex: E((l3) => new RegExp(`^ {0,${l3}}((?:- *){3,}|(?:_ *){3,}|(?:\\* *){3,})(?:\\n+|$)`)), fencesBeginRegex: E((l3) => new RegExp(`^ {0,${l3}}(?:\`\`\`|~~~)`)), headingBeginRegex: E((l3) => new RegExp(`^ {0,${l3}}#`)), htmlBeginRegex: E((l3) => new RegExp(`^ {0,${l3}}<(?:[a-z].*>|!--)`, "i")), blockquoteBeginRegex: E((l3) => new RegExp(`^ {0,${l3}}>`)) }, Oe = /^(?:[ \t]*(?:\n|$))+/, we = /^((?: {4}| {0,3}\t)[^\n]+(?:\n(?:[ \t]*(?:\n|$))*)?)+/, ye = /^ {0,3}(`{3,}(?=[^`\n]*(?:\n|$))|~{3,})([^\n]*)(?:\n|$)(?:|([\s\S]*?)(?:\n|$))(?: {0,3}\1[~`]* *(?=\n|$)|$)/, B = /^ {0,3}((?:-[\t ]*){3,}|(?:_[ \t]*){3,}|(?:\*[ \t]*){3,})(?:\n+|$)/, Pe = /^ {0,3}(#{1,6})(?=\s|$)(.*)(?:\n+|$)/, j = / {0,3}(?:[*+-]|\d{1,9}[.)])/, oe = /^(?!bull |blockCode|fences|blockquote|heading|html|table)((?:.|\n(?!\s*?\n|bull |blockCode|fences|blockquote|heading|html|table))+?)\n {0,3}(=+|-+) *(?:\n+|$)/, ae = d(oe).replace(/bull/g, j).replace(/blockCode/g, /(?: {4}| {0,3}\t)/).replace(/fences/g, / {0,3}(?:`{3,}|~{3,})/).replace(/blockquote/g, / {0,3}>/).replace(/heading/g, / {0,3}#{1,6}(?:\s|$)/).replace(/html/g, / {0,3}<[^\n>]+>\n/).replace(/\|table/g, "").getRegex(), Se = d(oe).replace(/bull/g, j).replace(/blockCode/g, /(?: {4}| {0,3}\t)/).replace(/fences/g, / {0,3}(?:`{3,}|~{3,})/).replace(/blockquote/g, / {0,3}>/).replace(/heading/g, / {0,3}#{1,6}(?:\s|$)/).replace(/html/g, / {0,3}<[^\n>]+>\n/).replace(/table/g, / {0,3}\|?(?:[:\- ]*\|)+[\:\- ]*\n/).getRegex(), F = /^([^\n]+(?:\n(?!hr|heading|lheading|blockquote|fences|list|html|table|[ \t]+\n)[^\n]+)*)/, $e = /^[^\n]+/, U = /(?!\s*\])(?:\\[\s\S]|[^\[\]\\])+/, Le = d(/^ {0,3}\[(label)\]: *(?:\n[ \t]*)?([^<\s][^\s]*|<.*?>)(?:(?: +(?:\n[ \t]*)?| *\n[ \t]*)(title))? *(?:\n+|$)/).replace("label", U).replace("title", /(?:"(?:\\"?|[^"\\])*"|'[^'\n]*(?:\n[^'\n]+)*\n?'|\([^()]*\))/).getRegex(), _e = d(/^(bull)([ \t][^\n]*?)?(?:\n|$)/).replace(/bull/g, j).getRegex(), H = "address|article|aside|base|basefont|blockquote|body|caption|center|col|colgroup|dd|details|dialog|dir|div|dl|dt|fieldset|figcaption|figure|footer|form|frame|frameset|h[1-6]|head|header|hr|html|iframe|legend|li|link|main|menu|menuitem|meta|nav|noframes|ol|optgroup|option|p|param|search|section|summary|table|tbody|td|tfoot|th|thead|title|tr|track|ul", K = /<!--(?:-?>|[\s\S]*?(?:-->|$))/, Me = d("^ {0,3}(?:<(script|pre|style|textarea)[\\s>][\\s\\S]*?(?:</\\1>[^\\n]*\\n*|$)|comment[^\\n]*(\\n+|$)|<\\?[\\s\\S]*?(?:\\?>[^\\n]*\\n*|$)|<![A-Z][\\s\\S]*?(?:>[^\\n]*\\n*|$)|<!\\[CDATA\\[[\\s\\S]*?(?:\\]\\]>[^\\n]*\\n*|$)|</?(tag)(?: +|\\n|/?>)[\\s\\S]*?(?:(?:\\n[ 	]*)+\\n|$)|<(?!script|pre|style|textarea)([a-z][\\w-]*)(?:attribute)*? */?>(?=[ \\t]*(?:\\n|$))[\\s\\S]*?(?:(?:\\n[ 	]*)+\\n|$)|</(?!script|pre|style|textarea)[a-z][\\w-]*\\s*>(?=[ \\t]*(?:\\n|$))[\\s\\S]*?(?:(?:\\n[ 	]*)+\\n|$))", "i").replace("comment", K).replace("tag", H).replace("attribute", / +[a-zA-Z:_][\w.:-]*(?: *= *"[^"\n]*"| *= *'[^'\n]*'| *= *[^\s"'=<>`]+)?/).getRegex(), le = (l3) => d(F).replace("hr", B).replace("heading", " {0,3}#{1,6}(?:\\s|$)").replace("|lheading", "").replace("|table", "").replace("blockquote", " {0,3}>").replace("fences", " {0,3}(?:`{3,}(?=[^`\\n]*\\n)|~~~)[^\\n]*\\n").replace("list", l3).replace("html", "</?(?:tag)(?: +|\\n|/?>)|<(?:script|pre|style|textarea|!--)").replace("tag", H).getRegex(), ze = le(/ {0,3}(?:[*+-]|1[.)])[ \t]+[^ \t\n]/), Ee = le(/ {0,3}(?:[*+-]|\d{1,9}[.)])(?:[ \t]|\n|$)/), Ce = d(/^( {0,3}> ?(paragraph|[^\n]*)(?:\n|$))+/).replace("paragraph", Ee).getRegex(), W = { blockquote: Ce, code: we, def: Le, fences: ye, heading: Pe, hr: B, html: Me, lheading: ae, list: _e, newline: Oe, paragraph: ze, table: _, text: $e }, se = d("^ *([^\\n ].*)\\n {0,3}((?:\\| *)?:?-+:? *(?:\\| *:?-+:? *)*(?:\\| *)?)(?:\\n((?:(?! *\\n|hr|heading|blockquote|code|fences|list|html).*(?:\\n|$))*)\\n*|$)").replace("hr", B).replace("heading", " {0,3}#{1,6}(?:\\s|$)").replace("blockquote", " {0,3}>").replace("code", "(?: {4}| {0,3}	)[^\\n]").replace("fences", " {0,3}(?:`{3,}(?=[^`\\n]*\\n)|~~~)[^\\n]*\\n").replace("list", " {0,3}(?:[*+-]|1[.)])[ \\t]").replace("html", "</?(?:tag)(?: +|\\n|/?>)|<(?:script|pre|style|textarea|!--)").replace("tag", H).getRegex(), Ae = { ...W, lheading: Se, table: se, paragraph: d(F).replace("hr", B).replace("heading", " {0,3}#{1,6}(?:\\s|$)").replace("|lheading", "").replace("table", se).replace("blockquote", " {0,3}>").replace("fences", " {0,3}(?:`{3,}(?=[^`\\n]*\\n)|~~~)[^\\n]*\\n").replace("list", " {0,3}(?:[*+-]|1[.)])[ \\t]+[^ \\t\\n]").replace("html", "</?(?:tag)(?: +|\\n|/?>)|<(?:script|pre|style|textarea|!--)").replace("tag", H).getRegex() }, Ie = { ...W, html: d(`^ *(?:comment *(?:\\n|\\s*$)|<(tag)[\\s\\S]+?</\\1> *(?:\\n{2,}|\\s*$)|<tag(?:"[^"]*"|'[^']*'|\\s[^'"/>\\s]*)*?/?> *(?:\\n{2,}|\\s*$))`).replace("comment", K).replace(/tag/g, "(?!(?:a|em|strong|small|s|cite|q|dfn|abbr|data|time|code|var|samp|kbd|sub|sup|i|b|u|mark|ruby|rt|rp|bdi|bdo|span|br|wbr|ins|del|img)\\b)\\w+(?!:|[^\\w\\s@]*@)\\b").getRegex(), def: /^ *\[([^\]]+)\]: *<?([^\s>]+)>?(?: +(["(][^\n]+[")]))? *(?:\n+|$)/, heading: /^(#{1,6})(.*)(?:\n+|$)/, fences: _, lheading: /^(.+?)\n {0,3}(=+|-+) *(?:\n+|$)/, paragraph: d(F).replace("hr", B).replace("heading", ` *#{1,6} *[^
]`).replace("lheading", ae).replace("|table", "").replace("blockquote", " {0,3}>").replace("|fences", "").replace("|list", "").replace("|html", "").replace("|tag", "").getRegex() }, Be = /^\\([!"#$%&'()*+,\-./:;<=>?@\[\]\\^_`{|}~])/, qe = /^(`+)([^`]|[^`][\s\S]*?[^`])\1(?!`)/, ue = /^( {2,}|\\)\n(?!\s*$)/, De = /^(`+|[^`])(?:(?= {2,}\n)|[\s\S]*?(?:(?=[\\<!\[`*_]|\b_|$)|[^ ](?= {2,}\n)))/, C = /[\p{P}\p{S}]/u, Z = /[\s\p{P}\p{S}]/u, X = /[^\s\p{P}\p{S}]/u, ve = d(/^((?![*_])punctSpace)/, "u").replace(/punctSpace/g, Z).getRegex(), pe = /(?!~)[\p{P}\p{S}]/u, He = /(?!~)[\s\p{P}\p{S}]/u, Ze = /(?:[^\s\p{P}\p{S}]|~)/u, Ge = d(/link|precode-code|html/, "g").replace("link", /\[(?:[^\[\]`]|(?<a>`+)[^`]+\k<a>(?!`))*?\]\((?:\\[\s\S]|[^\\\(\)]|\((?:\\[\s\S]|[^\\\(\)])*\))*\)/).replace("precode-", Te ? "(?<!`)()" : "(^^|[^`])").replace("code", /(?<b>`+)[^`]+\k<b>(?!`)/).replace("html", /<(?! )[^<>]*?>/).getRegex(), ce = /^(?:\*+(?:((?!\*)punct)|([^\s*]))?)|^_+(?:((?!_)punct)|([^\s_]))?/, Ne = d(ce, "u").replace(/punct/g, C).getRegex(), Qe = d(ce, "u").replace(/punct/g, pe).getRegex(), he = "^[^_*]*?__[^_*]*?\\*[^_*]*?(?=__)|[^*]+(?=[^*])|(?!\\*)punct(\\*+)(?=[\\s]|$)|notPunctSpace(\\*+)(?!\\*)(?=punctSpace|$)|(?!\\*)punctSpace(\\*+)(?=notPunctSpace)|[\\s](\\*+)(?!\\*)(?=punct)|(?!\\*)punct(\\*+)(?!\\*)(?=punct)|notPunctSpace(\\*+)(?=notPunctSpace)", je = d(he, "gu").replace(/notPunctSpace/g, X).replace(/punctSpace/g, Z).replace(/punct/g, C).getRegex(), Fe = d(he, "gu").replace(/notPunctSpace/g, Ze).replace(/punctSpace/g, He).replace(/punct/g, pe).getRegex(), Ue = d("^[^_*]*?\\*\\*[^_*]*?_[^_*]*?(?=\\*\\*)|[^_]+(?=[^_])|(?!_)punct(_+)(?=[\\s]|$)|notPunctSpace(_+)(?!_)(?=punctSpace|$)|(?!_)punctSpace(_+)(?=notPunctSpace)|[\\s](_+)(?!_)(?=punct)|(?!_)punct(_+)(?!_)(?=punct)", "gu").replace(/notPunctSpace/g, X).replace(/punctSpace/g, Z).replace(/punct/g, C).getRegex(), Ke = d(/^~~?(?:((?!~)punct)|[^\s~])/, "u").replace(/punct/g, C).getRegex(), We = "^[^~]+(?=[^~])|(?!~)punct(~~?)(?=[\\s]|$)|notPunctSpace(~~?)(?!~)(?=punctSpace|$)|(?!~)punctSpace(~~?)(?=notPunctSpace)|[\\s](~~?)(?!~)(?=punct)|(?!~)punct(~~?)(?!~)(?=punct)|notPunctSpace(~~?)(?=notPunctSpace)", Xe = d(We, "gu").replace(/notPunctSpace/g, X).replace(/punctSpace/g, Z).replace(/punct/g, C).getRegex(), Je = d(/\\(punct)/, "gu").replace(/punct/g, C).getRegex(), Ve = d(/^<(scheme:[^\s\x00-\x1f<>]*|email)>/).replace("scheme", /[a-zA-Z][a-zA-Z0-9+.-]{1,31}/).replace("email", /[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+(@)[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+(?![-_])/).getRegex(), Ye = d(K).replace("(?:-->|$)", "-->").getRegex(), et = d("^comment|^</[a-zA-Z][\\w:-]*\\s*>|^<[a-zA-Z][\\w-]*(?:attribute)*?\\s*/?>|^<\\?[\\s\\S]*?\\?>|^<![a-zA-Z]+\\s[\\s\\S]*?>|^<!\\[CDATA\\[[\\s\\S]*?\\]\\]>").replace("comment", Ye).replace("attribute", /\s+[a-zA-Z:_][\w.:-]*(?:\s*=\s*"[^"]*"|\s*=\s*'[^']*'|\s*=\s*[^\s"'=<>`]+)?/).getRegex(), v = /(?:\[(?:\\[\s\S]|[^\[\]\\])*\]|\\[\s\S]|`+(?!`)[^`]*?`+(?!`)|``+(?=\])|[^\[\]\\`])*?/, tt = d(/^!?\[(label)\]\(\s*(href)(?:(?:[ \t]+(?:\n[ \t]*)?|\n[ \t]*)(title))?\s*\)/).replace("label", v).replace("href", /<(?:\\.|[^\n<>\\])+>|[^ \t\n\x00-\x1f]+|(?=\))/).replace("title", /"(?:\\"?|[^"\\])*"|'(?:\\'?|[^'\\])*'|\((?:\\\)?|[^)\\])*\)/).getRegex(), ke = d(/^!?\[(label)\]\[(ref)\]/).replace("label", v).replace("ref", U).getRegex(), de = d(/^!?\[(ref)\](?:\[\])?/).replace("ref", U).getRegex(), nt = d("reflink|nolink(?!\\()", "g").replace("reflink", ke).replace("nolink", de).getRegex(), ie = /[hH][tT][tT][pP][sS]?|[fF][tT][pP]/, J = { _backpedal: _, anyPunctuation: Je, autolink: Ve, blockSkip: Ge, br: ue, code: qe, del: _, delLDelim: _, delRDelim: _, emStrongLDelim: Ne, emStrongRDelimAst: je, emStrongRDelimUnd: Ue, escape: Be, link: tt, nolink: de, punctuation: ve, reflink: ke, reflinkSearch: nt, tag: et, text: De, url: _ }, rt = { ...J, link: d(/^!?\[(label)\]\((.*?)\)/).replace("label", v).getRegex(), reflink: d(/^!?\[(label)\]\s*\[([^\]]*)\]/).replace("label", v).getRegex() }, Q = { ...J, emStrongRDelimAst: Fe, emStrongLDelim: Qe, delLDelim: Ke, delRDelim: Xe, url: d(/^((?:protocol):\/\/|www\.)(?:[a-zA-Z0-9\-]+\.?)+[^\s<]*|^email/).replace("protocol", ie).replace("email", /[A-Za-z0-9._+-]+(@)[a-zA-Z0-9-_]+(?:\.[a-zA-Z0-9-_]*[a-zA-Z0-9])+(?![-_])/).getRegex(), _backpedal: /(?:[^?!.,:;*_'"~()&]+|\([^)]*\)|&(?![a-zA-Z0-9]+;$)|[?!.,:;*_'"~)]+(?!$))+/, del: /^(~~?)(?=[^\s~])((?:\\[\s\S]|[^\\])*?(?:\\[\s\S]|[^\s~\\]))\1(?=[^~]|$)/, text: d(/^(`+|~+|[^`~])(?:(?=[`~])|(?= {2,}\n)|(?=[a-zA-Z0-9.!#$%&'*+\/=?_`{\|}~-]+@)|[\s\S]*?(?:(?=[\\<!\[`*~_]|\b_|protocol:\/\/|www\.|$)|[^ ](?= {2,}\n)|[^a-zA-Z0-9.!#$%&'*+\/=?_`{\|}~-](?=[a-zA-Z0-9.!#$%&'*+\/=?_`{\|}~-]+@)))/).replace("protocol", ie).getRegex() }, st = { ...Q, br: d(ue).replace("{2,}", "*").getRegex(), text: d(Q.text).replace("\\b_", "\\b_| {2,}\\n").replace(/\{2,\}/g, "*").getRegex() }, q = { normal: W, gfm: Ae, pedantic: Ie }, A = { normal: J, gfm: Q, breaks: st, pedantic: rt };
var it = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }, ge = (l3) => it[l3];
function O(l3, e) {
  if (e) {
    if (m.escapeTest.test(l3)) return l3.replace(m.escapeReplace, ge);
  } else if (m.escapeTestNoEncode.test(l3)) return l3.replace(m.escapeReplaceNoEncode, ge);
  return l3;
}
function V(l3) {
  try {
    l3 = encodeURI(l3).replace(m.percentDecode, "%");
  } catch {
    return null;
  }
  return l3;
}
function Y(l3, e) {
  var _a2;
  let t = l3.replace(m.findPipe, (r, i, o) => {
    let u = false, a = i;
    for (; --a >= 0 && o[a] === "\\"; ) u = !u;
    return u ? "|" : " |";
  }), n = t.split(m.splitPipe), s = 0;
  if (n[0].trim() || n.shift(), n.length > 0 && !((_a2 = n.at(-1)) == null ? void 0 : _a2.trim()) && n.pop(), e) if (n.length > e) n.splice(e);
  else for (; n.length < e; ) n.push("");
  for (; s < n.length; s++) n[s] = n[s].trim().replace(m.slashPipe, "|");
  return n;
}
function $(l3, e, t) {
  let n = l3.length;
  if (n === 0) return "";
  let s = 0;
  for (; s < n; ) {
    let r = l3.charAt(n - s - 1);
    if (r === e && true) s++;
    else break;
  }
  return l3.slice(0, n - s);
}
function ee(l3) {
  let e = l3.split(`
`), t = e.length - 1;
  for (; t >= 0 && m.blankLine.test(e[t]); ) t--;
  return e.length - t <= 2 ? l3 : e.slice(0, t + 1).join(`
`);
}
function fe(l3, e) {
  if (l3.indexOf(e[1]) === -1) return -1;
  let t = 0;
  for (let n = 0; n < l3.length; n++) if (l3[n] === "\\") n++;
  else if (l3[n] === e[0]) t++;
  else if (l3[n] === e[1] && (t--, t < 0)) return n;
  return t > 0 ? -2 : -1;
}
function me(l3, e = 0) {
  let t = e, n = "";
  for (let s of l3) if (s === "	") {
    let r = 4 - t % 4;
    n += " ".repeat(r), t += r;
  } else n += s, t++;
  return n;
}
function xe(l3, e, t, n, s) {
  let r = e.href, i = e.title || null, o = l3[1].replace(s.other.outputLinkReplace, "$1");
  n.state.inLink = true;
  let u = { type: l3[0].charAt(0) === "!" ? "image" : "link", raw: t, href: r, title: i, text: o, tokens: n.inlineTokens(o) };
  return n.state.inLink = false, u;
}
function ot(l3, e, t) {
  let n = l3.match(t.other.indentCodeCompensation);
  if (n === null) return e;
  let s = n[1];
  return e.split(`
`).map((r) => {
    let i = r.match(t.other.beginningSpace);
    if (i === null) return r;
    let [o] = i;
    return o.length >= s.length ? r.slice(s.length) : r;
  }).join(`
`);
}
var w = class {
  constructor(e) {
    __publicField(this, "options");
    __publicField(this, "rules");
    __publicField(this, "lexer");
    this.options = e || T;
  }
  space(e) {
    let t = this.rules.block.newline.exec(e);
    if (t && t[0].length > 0) return { type: "space", raw: t[0] };
  }
  code(e) {
    let t = this.rules.block.code.exec(e);
    if (t) {
      let n = this.options.pedantic ? t[0] : ee(t[0]), s = n.replace(this.rules.other.codeRemoveIndent, "");
      return { type: "code", raw: n, codeBlockStyle: "indented", text: s };
    }
  }
  fences(e) {
    let t = this.rules.block.fences.exec(e);
    if (t) {
      let n = t[0], s = ot(n, t[3] || "", this.rules);
      return { type: "code", raw: n, lang: t[2] ? t[2].trim().replace(this.rules.inline.anyPunctuation, "$1") : t[2], text: s };
    }
  }
  heading(e) {
    let t = this.rules.block.heading.exec(e);
    if (t) {
      let n = t[2].trim();
      if (this.rules.other.endingHash.test(n)) {
        let s = $(n, "#");
        (this.options.pedantic || !s || this.rules.other.endingSpaceChar.test(s)) && (n = s.trim());
      }
      return { type: "heading", raw: $(t[0], `
`), depth: t[1].length, text: n, tokens: this.lexer.inline(n) };
    }
  }
  hr(e) {
    let t = this.rules.block.hr.exec(e);
    if (t) return { type: "hr", raw: $(t[0], `
`) };
  }
  blockquote(e) {
    let t = this.rules.block.blockquote.exec(e);
    if (t) {
      let n = $(t[0], `
`).split(`
`), s = "", r = "", i = [];
      for (; n.length > 0; ) {
        let o = false, u = [], a;
        for (a = 0; a < n.length; a++) if (this.rules.other.blockquoteStart.test(n[a])) u.push(n[a]), o = true;
        else if (!o) u.push(n[a]);
        else break;
        n = n.slice(a);
        let p = u.join(`
`), c = p.replace(this.rules.other.blockquoteSetextReplace, `
    $1`).replace(this.rules.other.blockquoteSetextReplace2, "");
        s = s ? `${s}
${p}` : p, r = r ? `${r}
${c}` : c;
        let h = this.lexer.state.top;
        if (this.lexer.state.top = true, this.lexer.blockTokens(c, i, true), this.lexer.state.top = h, n.length === 0) break;
        let k = i.at(-1);
        if ((k == null ? void 0 : k.type) === "code") break;
        if ((k == null ? void 0 : k.type) === "blockquote") {
          let R = k, f = R.raw + `
` + n.join(`
`), S = this.blockquote(f);
          i[i.length - 1] = S, s = s.substring(0, s.length - R.raw.length) + S.raw, r = r.substring(0, r.length - R.text.length) + S.text;
          break;
        } else if ((k == null ? void 0 : k.type) === "list") {
          let R = k, f = R.raw + `
` + n.join(`
`), S = this.list(f);
          i[i.length - 1] = S, s = s.substring(0, s.length - k.raw.length) + S.raw, r = r.substring(0, r.length - R.raw.length) + S.raw, n = f.substring(i.at(-1).raw.length).split(`
`);
          continue;
        }
      }
      return { type: "blockquote", raw: s, tokens: i, text: r };
    }
  }
  list(e) {
    let t = this.rules.block.list.exec(e);
    if (t) {
      let n = t[1].trim(), s = n.length > 1, r = { type: "list", raw: "", ordered: s, start: s ? +n.slice(0, -1) : "", loose: false, items: [] };
      n = s ? `\\d{1,9}\\${n.slice(-1)}` : `\\${n}`, this.options.pedantic && (n = s ? n : "[*+-]");
      let i = this.rules.other.listItemRegex(n), o = false;
      for (; e; ) {
        let a = false, p = "", c = "";
        if (!(t = i.exec(e)) || this.rules.block.hr.test(e)) break;
        p = t[0], e = e.substring(p.length);
        let h = me(t[2].split(`
`, 1)[0], t[1].length), k = e.split(`
`, 1)[0], R = !h.trim(), f = 0;
        if (this.options.pedantic ? (f = 2, c = h.trimStart()) : R ? f = t[1].length + 1 : (f = h.search(this.rules.other.nonSpaceChar), f = f > 4 ? 1 : f, c = h.slice(f), f += t[1].length), R && this.rules.other.blankLine.test(k) && (p += k + `
`, e = e.substring(k.length + 1), a = true), !a) {
          let S = this.rules.other.nextBulletRegex(f), te = this.rules.other.hrRegex(f), ne = this.rules.other.fencesBeginRegex(f), re = this.rules.other.headingBeginRegex(f), be = this.rules.other.htmlBeginRegex(f), Re = this.rules.other.blockquoteBeginRegex(f);
          for (; e; ) {
            let G = e.split(`
`, 1)[0], I;
            if (k = G, this.options.pedantic ? (k = k.replace(this.rules.other.listReplaceNesting, "  "), I = k) : I = k.replace(this.rules.other.tabCharGlobal, "    "), ne.test(k) || re.test(k) || be.test(k) || Re.test(k) || S.test(k) || te.test(k)) break;
            if (I.search(this.rules.other.nonSpaceChar) >= f || !k.trim()) c += `
` + I.slice(f);
            else {
              if (R || h.replace(this.rules.other.tabCharGlobal, "    ").search(this.rules.other.nonSpaceChar) >= 4 || ne.test(h) || re.test(h) || te.test(h)) break;
              c += `
` + k;
            }
            R = !k.trim(), p += G + `
`, e = e.substring(G.length + 1), h = I.slice(f);
          }
        }
        r.loose || (o ? r.loose = true : this.rules.other.doubleBlankLine.test(p) && (o = true)), r.items.push({ type: "list_item", raw: p, task: !!this.options.gfm && this.rules.other.listIsTask.test(c), loose: false, text: c, tokens: [] }), r.raw += p;
      }
      let u = r.items.at(-1);
      if (u) u.raw = u.raw.trimEnd(), u.text = u.text.trimEnd();
      else return;
      r.raw = r.raw.trimEnd();
      for (let a of r.items) {
        this.lexer.state.top = false, a.tokens = this.lexer.blockTokens(a.text, []);
        let p = a.tokens[0];
        if (a.task && ((p == null ? void 0 : p.type) === "text" || (p == null ? void 0 : p.type) === "paragraph")) {
          a.text = a.text.replace(this.rules.other.listReplaceTask, ""), p.raw = p.raw.replace(this.rules.other.listReplaceTask, ""), p.text = p.text.replace(this.rules.other.listReplaceTask, "");
          for (let h = this.lexer.inlineQueue.length - 1; h >= 0; h--) if (this.rules.other.listIsTask.test(this.lexer.inlineQueue[h].src)) {
            this.lexer.inlineQueue[h].src = this.lexer.inlineQueue[h].src.replace(this.rules.other.listReplaceTask, "");
            break;
          }
          let c = this.rules.other.listTaskCheckbox.exec(a.raw);
          if (c) {
            let h = { type: "checkbox", raw: c[0] + " ", checked: c[0] !== "[ ]" };
            a.checked = h.checked, r.loose ? a.tokens[0] && ["paragraph", "text"].includes(a.tokens[0].type) && "tokens" in a.tokens[0] && a.tokens[0].tokens ? (a.tokens[0].raw = h.raw + a.tokens[0].raw, a.tokens[0].text = h.raw + a.tokens[0].text, a.tokens[0].tokens.unshift(h)) : a.tokens.unshift({ type: "paragraph", raw: h.raw, text: h.raw, tokens: [h] }) : a.tokens.unshift(h);
          }
        } else a.task && (a.task = false);
        if (!r.loose) {
          let c = a.tokens.filter((k) => k.type === "space"), h = c.length > 0 && c.some((k) => this.rules.other.anyLine.test(k.raw));
          r.loose = h;
        }
      }
      if (r.loose) for (let a of r.items) {
        a.loose = true;
        for (let p of a.tokens) p.type === "text" && (p.type = "paragraph");
      }
      return r;
    }
  }
  html(e) {
    let t = this.rules.block.html.exec(e);
    if (t) {
      let n = ee(t[0]);
      return { type: "html", block: true, raw: n, pre: t[1] === "pre" || t[1] === "script" || t[1] === "style", text: n };
    }
  }
  def(e) {
    let t = this.rules.block.def.exec(e);
    if (t) {
      let n = t[1].toLowerCase().replace(this.rules.other.multipleSpaceGlobal, " "), s = t[2] ? t[2].replace(this.rules.other.hrefBrackets, "$1").replace(this.rules.inline.anyPunctuation, "$1") : "", r = t[3] ? t[3].substring(1, t[3].length - 1).replace(this.rules.inline.anyPunctuation, "$1") : t[3];
      return { type: "def", tag: n, raw: $(t[0], `
`), href: s, title: r };
    }
  }
  table(e) {
    var _a2;
    let t = this.rules.block.table.exec(e);
    if (!t || !this.rules.other.tableDelimiter.test(t[2])) return;
    let n = Y(t[1]), s = t[2].replace(this.rules.other.tableAlignChars, "").split("|"), r = ((_a2 = t[3]) == null ? void 0 : _a2.trim()) ? t[3].replace(this.rules.other.tableRowBlankLine, "").split(`
`) : [], i = { type: "table", raw: $(t[0], `
`), header: [], align: [], rows: [] };
    if (n.length === s.length) {
      for (let o of s) this.rules.other.tableAlignRight.test(o) ? i.align.push("right") : this.rules.other.tableAlignCenter.test(o) ? i.align.push("center") : this.rules.other.tableAlignLeft.test(o) ? i.align.push("left") : i.align.push(null);
      for (let o = 0; o < n.length; o++) i.header.push({ text: n[o], tokens: this.lexer.inline(n[o]), header: true, align: i.align[o] });
      for (let o of r) i.rows.push(Y(o, i.header.length).map((u, a) => ({ text: u, tokens: this.lexer.inline(u), header: false, align: i.align[a] })));
      return i;
    }
  }
  lheading(e) {
    let t = this.rules.block.lheading.exec(e);
    if (t) {
      let n = t[1].trim();
      return { type: "heading", raw: $(t[0], `
`), depth: t[2].charAt(0) === "=" ? 1 : 2, text: n, tokens: this.lexer.inline(n) };
    }
  }
  paragraph(e) {
    let t = this.rules.block.paragraph.exec(e);
    if (t) {
      let n = t[1].charAt(t[1].length - 1) === `
` ? t[1].slice(0, -1) : t[1];
      return { type: "paragraph", raw: t[0], text: n, tokens: this.lexer.inline(n) };
    }
  }
  text(e) {
    let t = this.rules.block.text.exec(e);
    if (t) return { type: "text", raw: t[0], text: t[0], tokens: this.lexer.inline(t[0]) };
  }
  escape(e) {
    let t = this.rules.inline.escape.exec(e);
    if (t) return { type: "escape", raw: t[0], text: t[1] };
  }
  tag(e) {
    let t = this.rules.inline.tag.exec(e);
    if (t) return !this.lexer.state.inLink && this.rules.other.startATag.test(t[0]) ? this.lexer.state.inLink = true : this.lexer.state.inLink && this.rules.other.endATag.test(t[0]) && (this.lexer.state.inLink = false), !this.lexer.state.inRawBlock && this.rules.other.startPreScriptTag.test(t[0]) ? this.lexer.state.inRawBlock = true : this.lexer.state.inRawBlock && this.rules.other.endPreScriptTag.test(t[0]) && (this.lexer.state.inRawBlock = false), { type: "html", raw: t[0], inLink: this.lexer.state.inLink, inRawBlock: this.lexer.state.inRawBlock, block: false, text: t[0] };
  }
  link(e) {
    let t = this.rules.inline.link.exec(e);
    if (t) {
      let n = t[2].trim();
      if (!this.options.pedantic && this.rules.other.startAngleBracket.test(n)) {
        if (!this.rules.other.endAngleBracket.test(n)) return;
        let i = $(n.slice(0, -1), "\\");
        if ((n.length - i.length) % 2 === 0) return;
      } else {
        let i = fe(t[2], "()");
        if (i === -2) return;
        if (i > -1) {
          let u = (t[0].indexOf("!") === 0 ? 5 : 4) + t[1].length + i;
          t[2] = t[2].substring(0, i), t[0] = t[0].substring(0, u).trim(), t[3] = "";
        }
      }
      let s = t[2], r = "";
      if (this.options.pedantic) {
        let i = this.rules.other.pedanticHrefTitle.exec(s);
        i && (s = i[1], r = i[3]);
      } else r = t[3] ? t[3].slice(1, -1) : "";
      return s = s.trim(), this.rules.other.startAngleBracket.test(s) && (this.options.pedantic && !this.rules.other.endAngleBracket.test(n) ? s = s.slice(1) : s = s.slice(1, -1)), xe(t, { href: s && s.replace(this.rules.inline.anyPunctuation, "$1"), title: r && r.replace(this.rules.inline.anyPunctuation, "$1") }, t[0], this.lexer, this.rules);
    }
  }
  reflink(e, t) {
    let n;
    if ((n = this.rules.inline.reflink.exec(e)) || (n = this.rules.inline.nolink.exec(e))) {
      let s = (n[2] || n[1]).replace(this.rules.other.multipleSpaceGlobal, " "), r = t[s.toLowerCase()];
      if (!r) {
        let i = n[0].charAt(0);
        return { type: "text", raw: i, text: i };
      }
      return xe(n, r, n[0], this.lexer, this.rules);
    }
  }
  emStrong(e, t, n = "") {
    let s = this.rules.inline.emStrongLDelim.exec(e);
    if (!s || !s[1] && !s[2] && !s[3] && !s[4] || s[4] && n.match(this.rules.other.unicodeAlphaNumeric)) return;
    if (!(s[1] || s[3] || "") || !n || this.rules.inline.punctuation.exec(n)) {
      let i = [...s[0]].length - 1, o, u, a = i, p = 0, c = s[0][0] === "*" ? this.rules.inline.emStrongRDelimAst : this.rules.inline.emStrongRDelimUnd;
      for (c.lastIndex = 0, t = t.slice(-1 * e.length + i); (s = c.exec(t)) !== null; ) {
        if (o = s[1] || s[2] || s[3] || s[4] || s[5] || s[6], !o) continue;
        if (u = [...o].length, s[3] || s[4]) {
          a += u;
          continue;
        } else if ((s[5] || s[6]) && i % 3 && !((i + u) % 3)) {
          p += u;
          continue;
        }
        if (a -= u, a > 0) continue;
        u = Math.min(u, u + a + p);
        let h = [...s[0]][0].length, k = e.slice(0, i + s.index + h + u);
        if (Math.min(i, u) % 2) {
          let f = k.slice(1, -1);
          return { type: "em", raw: k, text: f, tokens: this.lexer.inlineTokens(f) };
        }
        let R = k.slice(2, -2);
        return { type: "strong", raw: k, text: R, tokens: this.lexer.inlineTokens(R) };
      }
    }
  }
  codespan(e) {
    let t = this.rules.inline.code.exec(e);
    if (t) {
      let n = t[2].replace(this.rules.other.newLineCharGlobal, " "), s = this.rules.other.nonSpaceChar.test(n), r = this.rules.other.startingSpaceChar.test(n) && this.rules.other.endingSpaceChar.test(n);
      return s && r && (n = n.substring(1, n.length - 1)), { type: "codespan", raw: t[0], text: n };
    }
  }
  br(e) {
    let t = this.rules.inline.br.exec(e);
    if (t) return { type: "br", raw: t[0] };
  }
  del(e, t, n = "") {
    let s = this.rules.inline.delLDelim.exec(e);
    if (!s) return;
    if (!(s[1] || "") || !n || this.rules.inline.punctuation.exec(n)) {
      let i = [...s[0]].length - 1, o, u, a = i, p = this.rules.inline.delRDelim;
      for (p.lastIndex = 0, t = t.slice(-1 * e.length + i); (s = p.exec(t)) !== null; ) {
        if (o = s[1] || s[2] || s[3] || s[4] || s[5] || s[6], !o || (u = [...o].length, u !== i)) continue;
        if (s[3] || s[4]) {
          a += u;
          continue;
        }
        if (a -= u, a > 0) continue;
        u = Math.min(u, u + a);
        let c = [...s[0]][0].length, h = e.slice(0, i + s.index + c + u), k = h.slice(i, -i);
        return { type: "del", raw: h, text: k, tokens: this.lexer.inlineTokens(k) };
      }
    }
  }
  autolink(e) {
    let t = this.rules.inline.autolink.exec(e);
    if (t) {
      let n, s;
      return t[2] === "@" ? (n = t[1], s = "mailto:" + n) : (n = t[1], s = n), { type: "link", raw: t[0], text: n, href: s, tokens: [{ type: "text", raw: n, text: n }] };
    }
  }
  url(e) {
    var _a2;
    let t;
    if (t = this.rules.inline.url.exec(e)) {
      let n, s;
      if (t[2] === "@") n = t[0], s = "mailto:" + n;
      else {
        let r;
        do
          r = t[0], t[0] = ((_a2 = this.rules.inline._backpedal.exec(t[0])) == null ? void 0 : _a2[0]) ?? "";
        while (r !== t[0]);
        n = t[0], t[1] === "www." ? s = "http://" + t[0] : s = t[0];
      }
      return { type: "link", raw: t[0], text: n, href: s, tokens: [{ type: "text", raw: n, text: n }] };
    }
  }
  inlineText(e) {
    let t = this.rules.inline.text.exec(e);
    if (t) {
      let n = this.lexer.state.inRawBlock;
      return { type: "text", raw: t[0], text: t[0], escaped: n };
    }
  }
};
var x = class l {
  constructor(e) {
    __publicField(this, "tokens");
    __publicField(this, "options");
    __publicField(this, "state");
    __publicField(this, "inlineQueue");
    __publicField(this, "tokenizer");
    this.tokens = [], this.tokens.links = /* @__PURE__ */ Object.create(null), this.options = e || T, this.options.tokenizer = this.options.tokenizer || new w(), this.tokenizer = this.options.tokenizer, this.tokenizer.options = this.options, this.tokenizer.lexer = this, this.inlineQueue = [], this.state = { inLink: false, inRawBlock: false, top: true };
    let t = { other: m, block: q.normal, inline: A.normal };
    this.options.pedantic ? (t.block = q.pedantic, t.inline = A.pedantic) : this.options.gfm && (t.block = q.gfm, this.options.breaks ? t.inline = A.breaks : t.inline = A.gfm), this.tokenizer.rules = t;
  }
  static get rules() {
    return { block: q, inline: A };
  }
  static lex(e, t) {
    return new l(t).lex(e);
  }
  static lexInline(e, t) {
    return new l(t).inlineTokens(e);
  }
  lex(e) {
    e = e.replace(m.carriageReturn, `
`), this.blockTokens(e, this.tokens);
    for (let t = 0; t < this.inlineQueue.length; t++) {
      let n = this.inlineQueue[t];
      this.inlineTokens(n.src, n.tokens);
    }
    return this.inlineQueue = [], this.tokens;
  }
  blockTokens(e, t = [], n = false) {
    var _a2, _b, _c;
    this.tokenizer.lexer = this, this.options.pedantic && (e = e.replace(m.tabCharGlobal, "    ").replace(m.spaceLine, ""));
    let s = 1 / 0;
    for (; e; ) {
      if (e.length < s) s = e.length;
      else {
        this.infiniteLoopError(e.charCodeAt(0));
        break;
      }
      let r;
      if ((_b = (_a2 = this.options.extensions) == null ? void 0 : _a2.block) == null ? void 0 : _b.some((o) => (r = o.call({ lexer: this }, e, t)) ? (e = e.substring(r.raw.length), t.push(r), true) : false)) continue;
      if (r = this.tokenizer.space(e)) {
        e = e.substring(r.raw.length);
        let o = t.at(-1);
        r.raw.length === 1 && o !== void 0 ? o.raw += `
` : t.push(r);
        continue;
      }
      if (r = this.tokenizer.code(e)) {
        e = e.substring(r.raw.length);
        let o = t.at(-1);
        (o == null ? void 0 : o.type) === "paragraph" || (o == null ? void 0 : o.type) === "text" ? (o.raw += (o.raw.endsWith(`
`) ? "" : `
`) + r.raw, o.text += `
` + r.text, this.inlineQueue.at(-1).src = o.text) : t.push(r);
        continue;
      }
      if (r = this.tokenizer.fences(e)) {
        e = e.substring(r.raw.length), t.push(r);
        continue;
      }
      if (r = this.tokenizer.heading(e)) {
        e = e.substring(r.raw.length), t.push(r);
        continue;
      }
      if (r = this.tokenizer.hr(e)) {
        e = e.substring(r.raw.length), t.push(r);
        continue;
      }
      if (r = this.tokenizer.blockquote(e)) {
        e = e.substring(r.raw.length), t.push(r);
        continue;
      }
      if (r = this.tokenizer.list(e)) {
        e = e.substring(r.raw.length), t.push(r);
        continue;
      }
      if (r = this.tokenizer.html(e)) {
        e = e.substring(r.raw.length), t.push(r);
        continue;
      }
      if (r = this.tokenizer.def(e)) {
        e = e.substring(r.raw.length);
        let o = t.at(-1);
        (o == null ? void 0 : o.type) === "paragraph" || (o == null ? void 0 : o.type) === "text" ? (o.raw += (o.raw.endsWith(`
`) ? "" : `
`) + r.raw, o.text += `
` + r.raw, this.inlineQueue.at(-1).src = o.text) : this.tokens.links[r.tag] || (this.tokens.links[r.tag] = { href: r.href, title: r.title }, t.push(r));
        continue;
      }
      if (r = this.tokenizer.table(e)) {
        e = e.substring(r.raw.length), t.push(r);
        continue;
      }
      if (r = this.tokenizer.lheading(e)) {
        e = e.substring(r.raw.length), t.push(r);
        continue;
      }
      let i = e;
      if ((_c = this.options.extensions) == null ? void 0 : _c.startBlock) {
        let o = 1 / 0, u = e.slice(1), a;
        this.options.extensions.startBlock.forEach((p) => {
          a = p.call({ lexer: this }, u), typeof a == "number" && a >= 0 && (o = Math.min(o, a));
        }), o < 1 / 0 && o >= 0 && (i = e.substring(0, o + 1));
      }
      if (this.state.top && (r = this.tokenizer.paragraph(i))) {
        let o = t.at(-1);
        n && (o == null ? void 0 : o.type) === "paragraph" ? (o.raw += (o.raw.endsWith(`
`) ? "" : `
`) + r.raw, o.text += `
` + r.text, this.inlineQueue.pop(), this.inlineQueue.at(-1).src = o.text) : t.push(r), n = i.length !== e.length, e = e.substring(r.raw.length);
        continue;
      }
      if (r = this.tokenizer.text(e)) {
        e = e.substring(r.raw.length);
        let o = t.at(-1);
        (o == null ? void 0 : o.type) === "text" ? (o.raw += (o.raw.endsWith(`
`) ? "" : `
`) + r.raw, o.text += `
` + r.text, this.inlineQueue.pop(), this.inlineQueue.at(-1).src = o.text) : t.push(r);
        continue;
      }
      if (e) {
        this.infiniteLoopError(e.charCodeAt(0));
        break;
      }
    }
    return this.state.top = true, t;
  }
  inline(e, t = []) {
    return this.inlineQueue.push({ src: e, tokens: t }), t;
  }
  inlineTokens(e, t = []) {
    var _a2, _b, _c, _d, _e2;
    this.tokenizer.lexer = this;
    let n = e;
    if (this.tokens.links) {
      let o = Object.keys(this.tokens.links);
      o.length > 0 && (n = n.replace(this.tokenizer.rules.inline.reflinkSearch, (u) => o.includes(u.slice(u.lastIndexOf("[") + 1, -1)) ? "[" + "a".repeat(u.length - 2) + "]" : u));
    }
    n = n.replace(this.tokenizer.rules.inline.anyPunctuation, "++"), n = n.replace(this.tokenizer.rules.inline.blockSkip, (o, u, a) => {
      let p = a ? a.length : 0;
      return o.slice(0, p) + "[" + "a".repeat(o.length - p - 2) + "]";
    }), n = ((_b = (_a2 = this.options.hooks) == null ? void 0 : _a2.emStrongMask) == null ? void 0 : _b.call({ lexer: this }, n)) ?? n;
    let s = false, r = "", i = 1 / 0;
    for (; e; ) {
      if (e.length < i) i = e.length;
      else {
        this.infiniteLoopError(e.charCodeAt(0));
        break;
      }
      s || (r = ""), s = false;
      let o;
      if ((_d = (_c = this.options.extensions) == null ? void 0 : _c.inline) == null ? void 0 : _d.some((a) => (o = a.call({ lexer: this }, e, t)) ? (e = e.substring(o.raw.length), t.push(o), true) : false)) continue;
      if (o = this.tokenizer.escape(e)) {
        e = e.substring(o.raw.length), t.push(o);
        continue;
      }
      if (o = this.tokenizer.tag(e)) {
        e = e.substring(o.raw.length), t.push(o);
        continue;
      }
      if (o = this.tokenizer.link(e)) {
        e = e.substring(o.raw.length), t.push(o);
        continue;
      }
      if (o = this.tokenizer.reflink(e, this.tokens.links)) {
        e = e.substring(o.raw.length);
        let a = t.at(-1);
        o.type === "text" && (a == null ? void 0 : a.type) === "text" ? (a.raw += o.raw, a.text += o.text) : t.push(o);
        continue;
      }
      if (o = this.tokenizer.emStrong(e, n, r)) {
        e = e.substring(o.raw.length), t.push(o);
        continue;
      }
      if (o = this.tokenizer.codespan(e)) {
        e = e.substring(o.raw.length), t.push(o);
        continue;
      }
      if (o = this.tokenizer.br(e)) {
        e = e.substring(o.raw.length), t.push(o);
        continue;
      }
      if (o = this.tokenizer.del(e, n, r)) {
        e = e.substring(o.raw.length), t.push(o);
        continue;
      }
      if (o = this.tokenizer.autolink(e)) {
        e = e.substring(o.raw.length), t.push(o);
        continue;
      }
      if (!this.state.inLink && (o = this.tokenizer.url(e))) {
        e = e.substring(o.raw.length), t.push(o);
        continue;
      }
      let u = e;
      if ((_e2 = this.options.extensions) == null ? void 0 : _e2.startInline) {
        let a = 1 / 0, p = e.slice(1), c;
        this.options.extensions.startInline.forEach((h) => {
          c = h.call({ lexer: this }, p), typeof c == "number" && c >= 0 && (a = Math.min(a, c));
        }), a < 1 / 0 && a >= 0 && (u = e.substring(0, a + 1));
      }
      if (o = this.tokenizer.inlineText(u)) {
        e = e.substring(o.raw.length), o.raw.slice(-1) !== "_" && (r = o.raw.slice(-1)), s = true;
        let a = t.at(-1);
        (a == null ? void 0 : a.type) === "text" ? (a.raw += o.raw, a.text += o.text) : t.push(o);
        continue;
      }
      if (e) {
        this.infiniteLoopError(e.charCodeAt(0));
        break;
      }
    }
    return t;
  }
  infiniteLoopError(e) {
    let t = "Infinite loop on byte: " + e;
    if (this.options.silent) console.error(t);
    else throw new Error(t);
  }
};
var y = class {
  constructor(e) {
    __publicField(this, "options");
    __publicField(this, "parser");
    this.options = e || T;
  }
  space(e) {
    return "";
  }
  code({ text: e, lang: t, escaped: n }) {
    var _a2;
    let s = (_a2 = (t || "").match(m.notSpaceStart)) == null ? void 0 : _a2[0], r = e.replace(m.endingNewline, "") + `
`;
    return s ? '<pre><code class="language-' + O(s) + '">' + (n ? r : O(r, true)) + `</code></pre>
` : "<pre><code>" + (n ? r : O(r, true)) + `</code></pre>
`;
  }
  blockquote({ tokens: e }) {
    return `<blockquote>
${this.parser.parse(e)}</blockquote>
`;
  }
  html({ text: e }) {
    return e;
  }
  def(e) {
    return "";
  }
  heading({ tokens: e, depth: t }) {
    return `<h${t}>${this.parser.parseInline(e)}</h${t}>
`;
  }
  hr(e) {
    return `<hr>
`;
  }
  list(e) {
    let t = e.ordered, n = e.start, s = "";
    for (let o = 0; o < e.items.length; o++) {
      let u = e.items[o];
      s += this.listitem(u);
    }
    let r = t ? "ol" : "ul", i = t && n !== 1 ? ' start="' + n + '"' : "";
    return "<" + r + i + `>
` + s + "</" + r + `>
`;
  }
  listitem(e) {
    return `<li>${this.parser.parse(e.tokens)}</li>
`;
  }
  checkbox({ checked: e }) {
    return "<input " + (e ? 'checked="" ' : "") + 'disabled="" type="checkbox"> ';
  }
  paragraph({ tokens: e }) {
    return `<p>${this.parser.parseInline(e)}</p>
`;
  }
  table(e) {
    let t = "", n = "";
    for (let r = 0; r < e.header.length; r++) n += this.tablecell(e.header[r]);
    t += this.tablerow({ text: n });
    let s = "";
    for (let r = 0; r < e.rows.length; r++) {
      let i = e.rows[r];
      n = "";
      for (let o = 0; o < i.length; o++) n += this.tablecell(i[o]);
      s += this.tablerow({ text: n });
    }
    return s && (s = `<tbody>${s}</tbody>`), `<table>
<thead>
` + t + `</thead>
` + s + `</table>
`;
  }
  tablerow({ text: e }) {
    return `<tr>
${e}</tr>
`;
  }
  tablecell(e) {
    let t = this.parser.parseInline(e.tokens), n = e.header ? "th" : "td";
    return (e.align ? `<${n} align="${e.align}">` : `<${n}>`) + t + `</${n}>
`;
  }
  strong({ tokens: e }) {
    return `<strong>${this.parser.parseInline(e)}</strong>`;
  }
  em({ tokens: e }) {
    return `<em>${this.parser.parseInline(e)}</em>`;
  }
  codespan({ text: e }) {
    return `<code>${O(e, true)}</code>`;
  }
  br(e) {
    return "<br>";
  }
  del({ tokens: e }) {
    return `<del>${this.parser.parseInline(e)}</del>`;
  }
  link({ href: e, title: t, tokens: n }) {
    let s = this.parser.parseInline(n), r = V(e);
    if (r === null) return s;
    e = r;
    let i = '<a href="' + e + '"';
    return t && (i += ' title="' + O(t) + '"'), i += ">" + s + "</a>", i;
  }
  image({ href: e, title: t, text: n, tokens: s }) {
    s && (n = this.parser.parseInline(s, this.parser.textRenderer));
    let r = V(e);
    if (r === null) return O(n);
    e = r;
    let i = `<img src="${e}" alt="${O(n)}"`;
    return t && (i += ` title="${O(t)}"`), i += ">", i;
  }
  text(e) {
    return "tokens" in e && e.tokens ? this.parser.parseInline(e.tokens) : "escaped" in e && e.escaped ? e.text : O(e.text);
  }
};
var L = class {
  strong({ text: e }) {
    return e;
  }
  em({ text: e }) {
    return e;
  }
  codespan({ text: e }) {
    return e;
  }
  del({ text: e }) {
    return e;
  }
  html({ text: e }) {
    return e;
  }
  text({ text: e }) {
    return e;
  }
  link({ text: e }) {
    return "" + e;
  }
  image({ text: e }) {
    return "" + e;
  }
  br() {
    return "";
  }
  checkbox({ raw: e }) {
    return e;
  }
};
var b = class l2 {
  constructor(e) {
    __publicField(this, "options");
    __publicField(this, "renderer");
    __publicField(this, "textRenderer");
    this.options = e || T, this.options.renderer = this.options.renderer || new y(), this.renderer = this.options.renderer, this.renderer.options = this.options, this.renderer.parser = this, this.textRenderer = new L();
  }
  static parse(e, t) {
    return new l2(t).parse(e);
  }
  static parseInline(e, t) {
    return new l2(t).parseInline(e);
  }
  parse(e) {
    var _a2, _b;
    this.renderer.parser = this;
    let t = "";
    for (let n = 0; n < e.length; n++) {
      let s = e[n];
      if ((_b = (_a2 = this.options.extensions) == null ? void 0 : _a2.renderers) == null ? void 0 : _b[s.type]) {
        let i = s, o = this.options.extensions.renderers[i.type].call({ parser: this }, i);
        if (o !== false || !["space", "hr", "heading", "code", "table", "blockquote", "list", "html", "def", "paragraph", "text"].includes(i.type)) {
          t += o || "";
          continue;
        }
      }
      let r = s;
      switch (r.type) {
        case "space": {
          t += this.renderer.space(r);
          break;
        }
        case "hr": {
          t += this.renderer.hr(r);
          break;
        }
        case "heading": {
          t += this.renderer.heading(r);
          break;
        }
        case "code": {
          t += this.renderer.code(r);
          break;
        }
        case "table": {
          t += this.renderer.table(r);
          break;
        }
        case "blockquote": {
          t += this.renderer.blockquote(r);
          break;
        }
        case "list": {
          t += this.renderer.list(r);
          break;
        }
        case "checkbox": {
          t += this.renderer.checkbox(r);
          break;
        }
        case "html": {
          t += this.renderer.html(r);
          break;
        }
        case "def": {
          t += this.renderer.def(r);
          break;
        }
        case "paragraph": {
          t += this.renderer.paragraph(r);
          break;
        }
        case "text": {
          t += this.renderer.text(r);
          break;
        }
        default: {
          let i = 'Token with "' + r.type + '" type was not found.';
          if (this.options.silent) return console.error(i), "";
          throw new Error(i);
        }
      }
    }
    return t;
  }
  parseInline(e, t = this.renderer) {
    var _a2, _b;
    this.renderer.parser = this;
    let n = "";
    for (let s = 0; s < e.length; s++) {
      let r = e[s];
      if ((_b = (_a2 = this.options.extensions) == null ? void 0 : _a2.renderers) == null ? void 0 : _b[r.type]) {
        let o = this.options.extensions.renderers[r.type].call({ parser: this }, r);
        if (o !== false || !["escape", "html", "link", "image", "strong", "em", "codespan", "br", "del", "text"].includes(r.type)) {
          n += o || "";
          continue;
        }
      }
      let i = r;
      switch (i.type) {
        case "escape": {
          n += t.text(i);
          break;
        }
        case "html": {
          n += t.html(i);
          break;
        }
        case "link": {
          n += t.link(i);
          break;
        }
        case "image": {
          n += t.image(i);
          break;
        }
        case "checkbox": {
          n += t.checkbox(i);
          break;
        }
        case "strong": {
          n += t.strong(i);
          break;
        }
        case "em": {
          n += t.em(i);
          break;
        }
        case "codespan": {
          n += t.codespan(i);
          break;
        }
        case "br": {
          n += t.br(i);
          break;
        }
        case "del": {
          n += t.del(i);
          break;
        }
        case "text": {
          n += t.text(i);
          break;
        }
        default: {
          let o = 'Token with "' + i.type + '" type was not found.';
          if (this.options.silent) return console.error(o), "";
          throw new Error(o);
        }
      }
    }
    return n;
  }
};
var P = (_a = class {
  constructor(e) {
    __publicField(this, "options");
    __publicField(this, "block");
    this.options = e || T;
  }
  preprocess(e) {
    return e;
  }
  postprocess(e) {
    return e;
  }
  processAllTokens(e) {
    return e;
  }
  emStrongMask(e) {
    return e;
  }
  provideLexer(e = this.block) {
    return e ? x.lex : x.lexInline;
  }
  provideParser(e = this.block) {
    return e ? b.parse : b.parseInline;
  }
}, __publicField(_a, "passThroughHooks", /* @__PURE__ */ new Set(["preprocess", "postprocess", "processAllTokens", "emStrongMask"])), __publicField(_a, "passThroughHooksRespectAsync", /* @__PURE__ */ new Set(["preprocess", "postprocess", "processAllTokens"])), _a);
var D = class {
  constructor(...e) {
    __publicField(this, "defaults", z());
    __publicField(this, "options", this.setOptions);
    __publicField(this, "parse", this.parseMarkdown(true));
    __publicField(this, "parseInline", this.parseMarkdown(false));
    __publicField(this, "Parser", b);
    __publicField(this, "Renderer", y);
    __publicField(this, "TextRenderer", L);
    __publicField(this, "Lexer", x);
    __publicField(this, "Tokenizer", w);
    __publicField(this, "Hooks", P);
    this.use(...e);
  }
  walkTokens(e, t) {
    var _a2, _b;
    let n = [];
    for (let s of e) switch (n = n.concat(t.call(this, s)), s.type) {
      case "table": {
        let r = s;
        for (let i of r.header) n = n.concat(this.walkTokens(i.tokens, t));
        for (let i of r.rows) for (let o of i) n = n.concat(this.walkTokens(o.tokens, t));
        break;
      }
      case "list": {
        let r = s;
        n = n.concat(this.walkTokens(r.items, t));
        break;
      }
      default: {
        let r = s;
        ((_b = (_a2 = this.defaults.extensions) == null ? void 0 : _a2.childTokens) == null ? void 0 : _b[r.type]) ? this.defaults.extensions.childTokens[r.type].forEach((i) => {
          let o = r[i].flat(1 / 0);
          n = n.concat(this.walkTokens(o, t));
        }) : r.tokens && (n = n.concat(this.walkTokens(r.tokens, t)));
      }
    }
    return n;
  }
  use(...e) {
    let t = this.defaults.extensions || { renderers: {}, childTokens: {} };
    return e.forEach((n) => {
      let s = { ...n };
      if (s.async = this.defaults.async || s.async || false, n.extensions && (n.extensions.forEach((r) => {
        if (!r.name) throw new Error("extension name required");
        if ("renderer" in r) {
          let i = t.renderers[r.name];
          i ? t.renderers[r.name] = function(...o) {
            let u = r.renderer.apply(this, o);
            return u === false && (u = i.apply(this, o)), u;
          } : t.renderers[r.name] = r.renderer;
        }
        if ("tokenizer" in r) {
          if (!r.level || r.level !== "block" && r.level !== "inline") throw new Error("extension level must be 'block' or 'inline'");
          let i = t[r.level];
          i ? i.unshift(r.tokenizer) : t[r.level] = [r.tokenizer], r.start && (r.level === "block" ? t.startBlock ? t.startBlock.push(r.start) : t.startBlock = [r.start] : r.level === "inline" && (t.startInline ? t.startInline.push(r.start) : t.startInline = [r.start]));
        }
        "childTokens" in r && r.childTokens && (t.childTokens[r.name] = r.childTokens);
      }), s.extensions = t), n.renderer) {
        let r = this.defaults.renderer || new y(this.defaults);
        for (let i in n.renderer) {
          if (!(i in r)) throw new Error(`renderer '${i}' does not exist`);
          if (["options", "parser"].includes(i)) continue;
          let o = i, u = n.renderer[o], a = r[o];
          r[o] = (...p) => {
            let c = u.apply(r, p);
            return c === false && (c = a.apply(r, p)), c || "";
          };
        }
        s.renderer = r;
      }
      if (n.tokenizer) {
        let r = this.defaults.tokenizer || new w(this.defaults);
        for (let i in n.tokenizer) {
          if (!(i in r)) throw new Error(`tokenizer '${i}' does not exist`);
          if (["options", "rules", "lexer"].includes(i)) continue;
          let o = i, u = n.tokenizer[o], a = r[o];
          r[o] = (...p) => {
            let c = u.apply(r, p);
            return c === false && (c = a.apply(r, p)), c;
          };
        }
        s.tokenizer = r;
      }
      if (n.hooks) {
        let r = this.defaults.hooks || new P();
        for (let i in n.hooks) {
          if (!(i in r)) throw new Error(`hook '${i}' does not exist`);
          if (["options", "block"].includes(i)) continue;
          let o = i, u = n.hooks[o], a = r[o];
          P.passThroughHooks.has(i) ? r[o] = (p) => {
            if (this.defaults.async && P.passThroughHooksRespectAsync.has(i)) return (async () => {
              let h = await u.call(r, p);
              return a.call(r, h);
            })();
            let c = u.call(r, p);
            return a.call(r, c);
          } : r[o] = (...p) => {
            if (this.defaults.async) return (async () => {
              let h = await u.apply(r, p);
              return h === false && (h = await a.apply(r, p)), h;
            })();
            let c = u.apply(r, p);
            return c === false && (c = a.apply(r, p)), c;
          };
        }
        s.hooks = r;
      }
      if (n.walkTokens) {
        let r = this.defaults.walkTokens, i = n.walkTokens;
        s.walkTokens = function(o) {
          let u = [];
          return u.push(i.call(this, o)), r && (u = u.concat(r.call(this, o))), u;
        };
      }
      this.defaults = { ...this.defaults, ...s };
    }), this;
  }
  setOptions(e) {
    return this.defaults = { ...this.defaults, ...e }, this;
  }
  lexer(e, t) {
    return x.lex(e, t ?? this.defaults);
  }
  parser(e, t) {
    return b.parse(e, t ?? this.defaults);
  }
  parseMarkdown(e) {
    return (n, s) => {
      let r = { ...s }, i = { ...this.defaults, ...r }, o = this.onError(!!i.silent, !!i.async);
      if (this.defaults.async === true && r.async === false) return o(new Error("marked(): The async option was set to true by an extension. Remove async: false from the parse options object to return a Promise."));
      if (typeof n > "u" || n === null) return o(new Error("marked(): input parameter is undefined or null"));
      if (typeof n != "string") return o(new Error("marked(): input parameter is of type " + Object.prototype.toString.call(n) + ", string expected"));
      if (i.hooks && (i.hooks.options = i, i.hooks.block = e), i.async) return (async () => {
        let u = i.hooks ? await i.hooks.preprocess(n) : n, p = await (i.hooks ? await i.hooks.provideLexer(e) : e ? x.lex : x.lexInline)(u, i), c = i.hooks ? await i.hooks.processAllTokens(p) : p;
        i.walkTokens && await Promise.all(this.walkTokens(c, i.walkTokens));
        let k = await (i.hooks ? await i.hooks.provideParser(e) : e ? b.parse : b.parseInline)(c, i);
        return i.hooks ? await i.hooks.postprocess(k) : k;
      })().catch(o);
      try {
        i.hooks && (n = i.hooks.preprocess(n));
        let a = (i.hooks ? i.hooks.provideLexer(e) : e ? x.lex : x.lexInline)(n, i);
        i.hooks && (a = i.hooks.processAllTokens(a)), i.walkTokens && this.walkTokens(a, i.walkTokens);
        let c = (i.hooks ? i.hooks.provideParser(e) : e ? b.parse : b.parseInline)(a, i);
        return i.hooks && (c = i.hooks.postprocess(c)), c;
      } catch (u) {
        return o(u);
      }
    };
  }
  onError(e, t) {
    return (n) => {
      if (n.message += `
Please report this to https://github.com/markedjs/marked.`, e) {
        let s = "<p>An error occurred:</p><pre>" + O(n.message + "", true) + "</pre>";
        return t ? Promise.resolve(s) : s;
      }
      if (t) return Promise.reject(n);
      throw n;
    };
  }
};
var M = new D();
function g(l3, e) {
  return M.parse(l3, e);
}
g.options = g.setOptions = function(l3) {
  return M.setOptions(l3), g.defaults = M.defaults, N(g.defaults), g;
};
g.getDefaults = z;
g.defaults = T;
g.use = function(...l3) {
  return M.use(...l3), g.defaults = M.defaults, N(g.defaults), g;
};
g.walkTokens = function(l3, e) {
  return M.walkTokens(l3, e);
};
g.parseInline = M.parseInline;
g.Parser = b;
g.parser = b.parse;
g.Renderer = y;
g.TextRenderer = L;
g.Lexer = x;
g.lexer = x.lex;
g.Tokenizer = w;
g.Hooks = P;
g.parse = g;
g.options;
g.setOptions;
g.use;
g.walkTokens;
g.parseInline;
b.parse;
x.lex;
const ALLOWED_TAGS = ["video", "source"];
const ALLOWED_ATTRS = ["controls", "autoplay", "loop", "muted", "preload", "poster"];
const MEDIA_SRC_REGEX = /(<(?:img|source|video)[^>]*\ssrc=['"])(?!(?:[/#?]|[a-z][a-z0-9+.-]*:))([^'"\s>]+)(['"])/gi;
const NON_REBASEABLE_HREF = /^(?:[/#?]|[a-z][a-z0-9+.-]*:)/i;
function resolveMarkdownUrl(href, baseUrl) {
  if (!baseUrl) return href;
  if (!NON_REBASEABLE_HREF.test(href)) return `${baseUrl}/${href}`;
  return href;
}
function createMarkdownRenderer(baseUrl) {
  const normalizedBase = baseUrl ? baseUrl.replace(/\/+$/, "") : "";
  const renderer = new y();
  renderer.image = ({ href, title, text: text2 }) => {
    const src = resolveMarkdownUrl(href, normalizedBase);
    const titleAttr = title ? ` title="${title}"` : "";
    return `<img src="${src}" alt="${text2}"${titleAttr} />`;
  };
  renderer.link = ({ href, title, tokens, text: text2 }) => {
    const target = resolveMarkdownUrl(href, normalizedBase);
    const linkText = text2 === href ? target : tokens ? renderer.parser.parseInline(tokens) : text2;
    const titleAttr = title ? ` title="${title}"` : "";
    return `<a href="${target}" ${titleAttr} target="_blank" rel="noopener noreferrer">${linkText}</a>`;
  };
  return renderer;
}
function renderMarkdownToHtml(markdown, baseUrl) {
  if (!markdown) return "";
  let html2 = g.parse(markdown, { renderer: createMarkdownRenderer(baseUrl), gfm: true });
  if (baseUrl) html2 = html2.replace(MEDIA_SRC_REGEX, `$1${baseUrl.replace(/\/+$/, "")}/$2$3`);
  return purify.sanitize(html2, { ADD_TAGS: ALLOWED_TAGS, ADD_ATTR: [...ALLOWED_ATTRS, "target", "rel"] });
}
function foldActivity(parts) {
  const rows = [];
  for (const part of parts) {
    if (part.type === "thinking") {
      rows.push({
        kind: "thinking",
        text: part.text,
        state: part.state,
        durationMs: part.durationMs
      });
      continue;
    }
    const previous = rows.at(-1);
    if ((previous == null ? void 0 : previous.kind) === "tool" && previous.name === part.name) {
      previous.count += 1;
      if (part.state === "streaming") previous.state = "streaming";
      if (part.ok === false) previous.ok = false;
      if (part.durationMs !== void 0)
        previous.durationMs = (previous.durationMs ?? 0) + part.durationMs;
    } else {
      rows.push({
        kind: "tool",
        name: part.name,
        state: part.state,
        ok: part.ok,
        count: 1,
        durationMs: part.durationMs
      });
    }
  }
  return rows;
}
function totalDurationMs(parts) {
  return parts.reduce((total, part) => total + (part.durationMs ?? 0), 0);
}
function upperFirst(str) {
  return str.substring(0, 1).toUpperCase() + str.substring(1);
}
const KNOWN_TOOLS = {
  new_tab: {
    labelKey: "agent.toolOpenedNewTab",
    activeLabelKey: "agent.toolOpeningNewTab",
    icon: "ctv:icon-[lucide--plus]"
  },
  switch_tab: {
    labelKey: "agent.toolSwitchedTabs",
    activeLabelKey: "agent.toolSwitchingTabs",
    icon: "ctv:icon-[lucide--arrow-left-right]"
  },
  remember: {
    labelKey: "agent.toolSavedPreference",
    activeLabelKey: "agent.toolSavingPreference",
    icon: "ctv:icon-[lucide--save]"
  },
  forget: {
    labelKey: "agent.toolForgotPreference",
    activeLabelKey: "agent.toolForgettingPreference",
    icon: "ctv:icon-[lucide--circle-question-mark]"
  }
};
function knownTool(name) {
  return Object.hasOwn(KNOWN_TOOLS, name) ? KNOWN_TOOLS[name] : void 0;
}
function toolLabel(name, state, translate) {
  const known = knownTool(name);
  if (known)
    return translate(
      state === "streaming" ? known.activeLabelKey : known.labelKey
    );
  return upperFirst(name.replaceAll("_", " "));
}
function toolGlyph(name, state, ok) {
  var _a2;
  if (state === "streaming") return "ctv:animate-spin ctv:icon-[lucide--loader-circle]";
  if (ok === false) return "ctv:icon-[lucide--circle-x]";
  return ((_a2 = knownTool(name)) == null ? void 0 : _a2.icon) ?? "ctv:icon-[lucide--wrench]";
}
const MS_PER_MINUTE = 6e4;
function tenthsOfSecond(ms) {
  return (ms / 1e3).toFixed(1);
}
function splitMinutes(ms) {
  const seconds = Math.round(ms / 1e3);
  return { minutes: Math.floor(seconds / 60), seconds: seconds % 60 };
}
function formatDurationCompact(ms) {
  if (ms < MS_PER_MINUTE) return `${tenthsOfSecond(ms)}s`;
  const { minutes, seconds } = splitMinutes(ms);
  return `${minutes}m ${seconds}s`;
}
const _hoisted_1$l = {
  role: "list",
  class: "ctv:flex ctv:flex-col"
};
const _hoisted_2$i = { class: "ctv:flex ctv:w-4 ctv:shrink-0 ctv:flex-col ctv:items-center" };
const _hoisted_3$f = {
  key: 0,
  class: "ctv:mt-1 ctv:w-px ctv:flex-1 ctv:bg-component-node-border"
};
const _hoisted_4$b = { class: "ctv:flex ctv:min-w-0 ctv:flex-1 ctv:items-start ctv:gap-2 ctv:pb-3" };
const _hoisted_5$9 = {
  key: 0,
  class: "ctv:mt-0.5 ctv:shrink-0 ctv:text-xs ctv:text-muted-foreground"
};
const _hoisted_6$8 = {
  key: 2,
  class: "ctv:mt-0.5 ctv:ml-auto ctv:shrink-0 ctv:font-mono ctv:text-xs/4 ctv:text-muted-foreground"
};
const LABEL = "ctv:text-muted-foreground ctv:min-w-0 ctv:text-sm/5";
const _sfc_main$m = /* @__PURE__ */ defineComponent({
  __name: "ActivityTrace",
  props: {
    parts: {},
    live: { type: Boolean, default: false }
  },
  setup(__props) {
    const { t } = useI18n();
    const rows = computed(() => foldActivity(__props.parts));
    const LABEL_STREAMING = `${LABEL} agent-shimmer-text`;
    function labelClass(state) {
      return state === "streaming" ? LABEL_STREAMING : LABEL;
    }
    function glyphOf(row) {
      return row.kind === "thinking" ? "ctv:icon-[lucide--brain]" : toolGlyph(row.name, row.state, row.ok);
    }
    function rowSignature(row) {
      return row.kind === "tool" ? `tool:${row.name}:${row.state}:${row.ok}:${row.count}:${row.durationMs}` : `think:${row.state}:${row.durationMs}:${row.text}`;
    }
    return (_ctx, _cache) => {
      return openBlock(), createElementBlock("div", _hoisted_1$l, [
        (openBlock(true), createElementBlock(Fragment, null, renderList(rows.value, (row, index, ___, _cached) => {
          const _memo = [rowSignature(row), index === rows.value.length - 1, __props.live];
          if (_cached && _cached.el && _cached.key === index && isMemoSame(_cached, _memo)) return _cached;
          const _item = (openBlock(), createElementBlock("div", {
            key: index,
            role: "listitem",
            class: normalizeClass(unref(cn)("ctv:flex ctv:gap-2 ctv:px-2", __props.live && "agent-row-enter"))
          }, [
            createBaseVNode("div", _hoisted_2$i, [
              createBaseVNode("span", {
                class: normalizeClass(
                  unref(cn)("ctv:mt-0.5 ctv:size-4 ctv:shrink-0 ctv:text-muted-foreground", glyphOf(row))
                )
              }, null, 2),
              index < rows.value.length - 1 ? (openBlock(), createElementBlock("span", _hoisted_3$f)) : createCommentVNode("", true)
            ]),
            createBaseVNode("div", _hoisted_4$b, [
              row.kind === "thinking" ? (openBlock(), createElementBlock("span", {
                key: 0,
                class: normalizeClass(
                  unref(cn)(labelClass(row.state), "ctv:wrap-break-word ctv:whitespace-pre-wrap")
                )
              }, toDisplayString(row.text || unref(t)("agent.thinking")), 3)) : (openBlock(), createElementBlock(Fragment, { key: 1 }, [
                createBaseVNode("span", {
                  class: normalizeClass(labelClass(row.state))
                }, toDisplayString(unref(toolLabel)(row.name, row.state, unref(t))), 3),
                row.count > 1 ? (openBlock(), createElementBlock("span", _hoisted_5$9, "×" + toDisplayString(row.count), 1)) : createCommentVNode("", true)
              ], 64)),
              row.durationMs !== void 0 ? (openBlock(), createElementBlock("span", _hoisted_6$8, toDisplayString(unref(formatDurationCompact)(row.durationMs)), 1)) : createCommentVNode("", true)
            ])
          ], 2));
          _item.memo = _memo;
          return _item;
        }, _cache, 0), 128))
      ]);
    };
  }
});
const _hoisted_1$k = {
  role: "alert",
  class: "ctv:flex ctv:w-full ctv:flex-col ctv:justify-center ctv:gap-2 ctv:overflow-hidden ctv:rounded-lg ctv:border ctv:border-component-node-border ctv:bg-modal-card-background ctv:p-4 ctv:shadow-sm"
};
const _hoisted_2$h = { class: "ctv:flex ctv:w-full ctv:items-start ctv:gap-2" };
const _hoisted_3$e = { class: "ctv:min-w-0 ctv:flex-1 ctv:text-sm/5" };
const _hoisted_4$a = { class: "ctv:m-0 ctv:font-medium ctv:text-base-foreground" };
const _hoisted_5$8 = { class: "ctv:m-0 ctv:text-muted-foreground" };
const _hoisted_6$7 = {
  key: 0,
  class: "ctv:flex ctv:w-full ctv:justify-end ctv:gap-2"
};
const _sfc_main$l = /* @__PURE__ */ defineComponent({
  __name: "AgentPaywallCard",
  props: {
    presentation: { default: () => DEFAULT_AGENT_PAYWALL_PRESENTATION },
    message: {}
  },
  emits: ["paywallAction"],
  setup(__props, { emit: __emit }) {
    const emit = __emit;
    const bodyKeys = {
      subscribed: "agent.paywall.body.subscribed",
      subscriptionRequired: "agent.paywall.body.subscriptionRequired",
      member: "agent.paywall.body.member",
      salesManaged: "agent.paywall.body.salesManaged",
      local: "agent.paywall.body.local",
      unavailable: "agent.paywall.body.subscriptionRequired"
    };
    const bodyKey = computed(() => bodyKeys[__props.presentation.kind]);
    const showUpgrade = computed(
      () => __props.presentation.kind === "subscribed" && __props.presentation.showUpgrade
    );
    const showSubscribe = computed(
      () => __props.presentation.kind === "subscriptionRequired"
    );
    const showAddCredits = computed(
      () => __props.presentation.kind === "subscribed" || __props.presentation.kind === "local"
    );
    return (_ctx, _cache) => {
      return openBlock(), createElementBlock("div", _hoisted_1$k, [
        createBaseVNode("div", _hoisted_2$h, [
          _cache[3] || (_cache[3] = createBaseVNode("span", {
            "aria-hidden": "true",
            class: "ctv:mt-0.5 ctv:icon-[lucide--gauge] ctv:size-5 ctv:shrink-0 ctv:text-destructive-background"
          }, null, -1)),
          createBaseVNode("div", _hoisted_3$e, [
            createBaseVNode("p", _hoisted_4$a, toDisplayString(_ctx.$t("agent.paywall.title")), 1),
            createBaseVNode("p", _hoisted_5$8, toDisplayString(__props.message || _ctx.$t(bodyKey.value)), 1)
          ])
        ]),
        showAddCredits.value || showSubscribe.value || showUpgrade.value ? (openBlock(), createElementBlock("div", _hoisted_6$7, [
          showUpgrade.value ? (openBlock(), createBlock(_sfc_main$v, {
            key: 0,
            variant: "secondary",
            size: "sm",
            onClick: _cache[0] || (_cache[0] = ($event) => emit("paywallAction", "upgrade"))
          }, {
            default: withCtx(() => [
              createTextVNode(toDisplayString(_ctx.$t("agent.paywall.upgradePlan")), 1)
            ]),
            _: 1
          })) : createCommentVNode("", true),
          showSubscribe.value ? (openBlock(), createBlock(_sfc_main$v, {
            key: 1,
            variant: "inverted",
            size: "sm",
            onClick: _cache[1] || (_cache[1] = ($event) => emit("paywallAction", "subscribe"))
          }, {
            default: withCtx(() => [
              createTextVNode(toDisplayString(_ctx.$t("agent.paywall.subscribe")), 1)
            ]),
            _: 1
          })) : createCommentVNode("", true),
          showAddCredits.value ? (openBlock(), createBlock(_sfc_main$v, {
            key: 2,
            variant: "inverted",
            size: "sm",
            onClick: _cache[2] || (_cache[2] = ($event) => emit("paywallAction", "addCredits"))
          }, {
            default: withCtx(() => [
              createTextVNode(toDisplayString(_ctx.$t("agent.paywall.addCredits")), 1)
            ]),
            _: 1
          })) : createCommentVNode("", true)
        ])) : createCommentVNode("", true)
      ]);
    };
  }
});
const _hoisted_1$j = ["innerHTML"];
const _hoisted_2$g = ["innerHTML"];
const _sfc_main$k = /* @__PURE__ */ defineComponent({
  ...{ inheritAttrs: false },
  __name: "SanitizedHtml",
  props: {
    html: {},
    as: { default: "div" }
  },
  setup(__props) {
    const purifier = purify(window);
    const sanitizedHtml = computed(
      () => purifier.sanitize(__props.html, {
        ADD_TAGS: ["video", "source"],
        ADD_ATTR: ["controls", "autoplay", "loop", "muted", "preload", "poster", "target", "rel"]
      })
    );
    return (_ctx, _cache) => {
      return __props.as === "span" ? (openBlock(), createElementBlock("span", mergeProps({ key: 0 }, _ctx.$attrs, { innerHTML: sanitizedHtml.value }), null, 16, _hoisted_1$j)) : (openBlock(), createElementBlock("div", mergeProps({ key: 1 }, _ctx.$attrs, { innerHTML: sanitizedHtml.value }), null, 16, _hoisted_2$g));
    };
  }
});
const _hoisted_1$i = { class: "ctv:group ctv:relative ctv:my-2 ctv:overflow-hidden ctv:rounded-md ctv:border ctv:border-border-default" };
const _hoisted_2$f = { class: "ctv:flex ctv:items-center ctv:justify-between ctv:border-b ctv:border-border-default ctv:bg-secondary-background-hover ctv:px-3 ctv:py-1.5" };
const _hoisted_3$d = { class: "ctv:flex ctv:items-center ctv:gap-1.5 ctv:font-mono ctv:text-xs ctv:text-muted-foreground" };
const _hoisted_4$9 = { class: "ctv:font-medium ctv:text-base-foreground" };
const _hoisted_5$7 = {
  key: 1,
  class: "ctv:overflow-x-auto ctv:p-4 ctv:font-mono ctv:text-sm ctv:text-base-foreground"
};
const _sfc_main$j = /* @__PURE__ */ defineComponent({
  __name: "CodeBlock",
  props: {
    code: {},
    lang: { default: "text" }
  },
  setup(__props) {
    const { t } = useI18n();
    const { copy, copied } = useClipboard({ copiedDuring: 2e3, legacy: true });
    const highlighted = ref(null);
    watchDebounced(
      () => [__props.code, __props.lang],
      async ([currentCode, currentLang], _prev, onCleanup) => {
        let cancelled = false;
        onCleanup(() => {
          cancelled = true;
        });
        try {
          const { codeToHtml } = await import("./shiki-Do5VLs4k.mjs");
          const html2 = await codeToHtml(currentCode, {
            lang: currentLang,
            theme: "github-dark",
            colorReplacements: { "#24292e": "transparent" }
          });
          if (!cancelled) highlighted.value = purify.sanitize(html2);
        } catch {
          if (!cancelled) highlighted.value = null;
        }
      },
      { immediate: true, debounce: 100 }
    );
    return (_ctx, _cache) => {
      return openBlock(), createElementBlock("div", _hoisted_1$i, [
        createBaseVNode("div", _hoisted_2$f, [
          createBaseVNode("span", _hoisted_3$d, [
            _cache[1] || (_cache[1] = createBaseVNode("span", { class: "ctv:icon-[lucide--file-code] ctv:size-3.5" }, null, -1)),
            createBaseVNode("span", _hoisted_4$9, toDisplayString(__props.lang), 1)
          ]),
          createVNode(_sfc_main$v, {
            type: "button",
            variant: "outline",
            size: "sm",
            class: "ctv:gap-1 ctv:font-mono",
            onClick: _cache[0] || (_cache[0] = ($event) => unref(copy)(__props.code))
          }, {
            default: withCtx(() => [
              createBaseVNode("span", {
                class: normalizeClass(
                  unref(cn)(
                    "ctv:size-3.5",
                    unref(copied) ? "ctv:icon-[lucide--check]" : "ctv:icon-[lucide--copy]"
                  )
                )
              }, null, 2),
              createTextVNode(" " + toDisplayString(unref(copied) ? unref(t)("agent.copied") : unref(t)("agent.copy")), 1)
            ]),
            _: 1
          })
        ]),
        highlighted.value ? (openBlock(), createBlock(_sfc_main$k, {
          key: 0,
          class: "ctv:overflow-x-auto ctv:p-4 ctv:font-mono ctv:text-sm ctv:[&_pre]:bg-transparent",
          html: highlighted.value
        }, null, 8, ["html"])) : (openBlock(), createElementBlock("pre", _hoisted_5$7, [
          createBaseVNode("code", null, toDisplayString(__props.code), 1)
        ]))
      ]);
    };
  }
});
const assetService = {
  isAssetAPIEnabled() {
    var _a2, _b;
    return ((_b = (_a2 = api).getServerFeature) == null ? void 0 : _b.call(_a2, "assets", false)) === true;
  },
  async getInputAssetsIncludingPublic() {
    try {
      const res = await api.fetchApi("/assets?tags=input&limit=200");
      if (!res.ok) return [];
      const data = await res.json();
      return Array.isArray(data == null ? void 0 : data.assets) ? data.assets : [];
    } catch {
      return [];
    }
  }
};
function isAssetPreviewSupported() {
  var _a2, _b;
  return assetService.isAssetAPIEnabled() || ((_b = (_a2 = api).getServerFeature) == null ? void 0 : _b.call(_a2, "assets", false)) === true;
}
async function fetchAssets(params) {
  const query = new URLSearchParams(params);
  const res = await api.fetchApi(`/assets?${query}`);
  if (!res.ok) return [];
  const data = await res.json();
  return data.assets ?? [];
}
function resolvePreviewUrl(asset) {
  if (asset.preview_url) return api.apiURL(asset.preview_url);
  return api.apiURL(`/assets/${asset.preview_id ?? asset.id}/content`);
}
async function findOutputAsset(name) {
  const byHash = await fetchAssets({ hash: name });
  const hashMatch = byHash.find((a) => a.hash === name);
  if (hashMatch) return hashMatch;
  const byName = await fetchAssets({ name_contains: name });
  return byName.find((a) => a.name === name);
}
async function findServerPreviewUrl(name) {
  try {
    const asset = await findOutputAsset(name);
    if (!(asset == null ? void 0 : asset.preview_id)) return null;
    return resolvePreviewUrl(asset);
  } catch {
    return null;
  }
}
function useDialogStore() {
  return {
    showDialog(options) {
      var _a2;
      const url = (_a2 = options.props) == null ? void 0 : _a2.modelUrl;
      if (typeof url === "string") window.open(url, "_blank", "noopener");
    },
    updateDialog(_options) {
    },
    closeDialog(_options) {
    }
  };
}
const _sfc_main$i = /* @__PURE__ */ defineComponent({
  __name: "Slider",
  props: {
    defaultValue: {},
    modelValue: {},
    disabled: { type: Boolean },
    orientation: {},
    dir: {},
    inverted: { type: Boolean },
    min: {},
    max: {},
    step: {},
    minStepsBetweenThumbs: {},
    thumbAlignment: {},
    asChild: { type: Boolean },
    as: {},
    name: {},
    required: { type: Boolean },
    class: { type: [Boolean, null, String, Object, Array] },
    rangeClass: { type: [Boolean, null, String, Object, Array] },
    thumbClass: { type: [Boolean, null, String, Object, Array] }
  },
  emits: ["update:modelValue", "valueCommit"],
  setup(__props, { emit: __emit }) {
    const props = __props;
    const pressed = ref(false);
    const setPressed = (val) => {
      pressed.value = val;
    };
    const emits = __emit;
    const delegatedProps = reactiveOmit(props, "class", "rangeClass", "thumbClass");
    const forwarded = useForwardPropsEmits(delegatedProps, emits);
    return (_ctx, _cache) => {
      return openBlock(), createBlock(unref(SliderRoot_default), mergeProps({
        "data-slot": "slider",
        class: unref(cn)(
          "ctv:relative ctv:flex ctv:w-full ctv:touch-none ctv:items-center ctv:select-none ctv:data-disabled:opacity-50",
          "ctv:data-[orientation=vertical]:h-full ctv:data-[orientation=vertical]:min-h-44 ctv:data-[orientation=vertical]:w-auto ctv:data-[orientation=vertical]:flex-col",
          props.class
        )
      }, unref(forwarded), {
        onSlideStart: _cache[0] || (_cache[0] = () => setPressed(true)),
        onSlideMove: _cache[1] || (_cache[1] = () => setPressed(true)),
        onSlideEnd: _cache[2] || (_cache[2] = () => setPressed(false))
      }), {
        default: withCtx(({ modelValue }) => [
          createVNode(unref(SliderTrack_default), {
            "data-slot": "slider-track",
            class: normalizeClass(
              unref(cn)(
                "ctv:relative ctv:grow ctv:overflow-hidden ctv:rounded-full ctv:bg-node-stroke",
                "ctv:cursor-pointer ctv:overflow-visible",
                "ctv:before:absolute ctv:before:-inset-2 ctv:before:block ctv:before:bg-transparent",
                "ctv:data-[orientation=horizontal]:h-0.5 ctv:data-[orientation=horizontal]:w-full",
                "ctv:data-[orientation=vertical]:h-full ctv:data-[orientation=vertical]:w-0.5"
              )
            )
          }, {
            default: withCtx(() => [
              createVNode(unref(SliderRange_default), {
                "data-slot": "slider-range",
                class: normalizeClass(
                  unref(cn)(
                    "ctv:absolute ctv:bg-node-component-surface-highlight ctv:data-[orientation=horizontal]:h-full ctv:data-[orientation=vertical]:w-full",
                    props.rangeClass
                  )
                )
              }, null, 8, ["class"])
            ]),
            _: 1
          }, 8, ["class"]),
          (openBlock(true), createElementBlock(Fragment, null, renderList(modelValue, (_2, key) => {
            return openBlock(), createBlock(unref(SliderThumb_default), {
              key,
              "data-slot": "slider-thumb",
              class: normalizeClass(
                unref(cn)(
                  "ctv:block ctv:size-3.5 ctv:shrink-0 ctv:rounded-full ctv:bg-node-component-surface-highlight ctv:shadow-sm ctv:ring-node-component-surface-selected ctv:transition-[color,box-shadow]",
                  "ctv:cursor-grab",
                  "ctv:before:absolute ctv:before:-inset-1 ctv:before:block ctv:before:rounded-full ctv:before:bg-transparent",
                  "ctv:hover:ring-2 ctv:focus-visible:ring-2 ctv:focus-visible:outline-hidden ctv:disabled:pointer-events-none ctv:disabled:opacity-50",
                  { "ctv:cursor-grabbing": pressed.value },
                  props.thumbClass
                )
              )
            }, null, 8, ["class"]);
          }), 128))
        ]),
        _: 1
      }, 16, ["class"]);
    };
  }
});
function useWaveAudioPlayer(options) {
  const { src, barCount = 40, waveform = true } = options;
  const audioRef = ref();
  const waveformRef = ref();
  const loading = ref(false);
  let decodeRequestId = 0;
  const bars = ref(generatePlaceholderBars());
  const { playing, currentTime, duration, volume, muted } = useMediaControls(audioRef);
  const playedBarIndex = computed(() => {
    if (duration.value === 0) return -1;
    return Math.floor(currentTime.value / duration.value * barCount) - 1;
  });
  const formattedCurrentTime = computed(() => formatTime(currentTime.value));
  const formattedDuration = computed(() => formatTime(duration.value));
  function generatePlaceholderBars() {
    return Array.from({ length: barCount }, () => ({ height: Math.random() * 60 + 10 }));
  }
  function generateBarsFromBuffer(buffer) {
    const channelData = buffer.getChannelData(0);
    if (channelData.length === 0) {
      bars.value = generatePlaceholderBars();
      return;
    }
    const averages = [];
    for (let i = 0; i < barCount; i++) {
      const start = Math.floor(i * channelData.length / barCount);
      const end = Math.max(start + 1, Math.floor((i + 1) * channelData.length / barCount));
      let sum = 0;
      for (let j2 = start; j2 < end && j2 < channelData.length; j2++) sum += Math.abs(channelData[j2]);
      averages.push(sum / (end - start));
    }
    const peak = Math.max(...averages) || 1;
    bars.value = averages.map((avg) => ({ height: Math.max(8, avg / peak * 100) }));
  }
  async function decodeAudioSource(url) {
    const requestId = ++decodeRequestId;
    loading.value = true;
    let ctx;
    try {
      const apiBase = api.apiURL("/");
      const route = url.includes(apiBase) ? url.slice(url.indexOf(apiBase) + api.apiURL("").length) : url;
      const response = await api.fetchApi(route);
      if (requestId !== decodeRequestId) return;
      if (!response.ok) {
        if (requestId === decodeRequestId) bars.value = generatePlaceholderBars();
        return;
      }
      const arrayBuffer = await response.arrayBuffer();
      if (requestId !== decodeRequestId) return;
      ctx = new AudioContext();
      const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
      if (requestId !== decodeRequestId) return;
      generateBarsFromBuffer(audioBuffer);
    } catch {
      if (requestId === decodeRequestId) bars.value = generatePlaceholderBars();
    } finally {
      await (ctx == null ? void 0 : ctx.close());
      if (requestId === decodeRequestId) loading.value = false;
    }
  }
  const progressRatio = computed(() => duration.value === 0 ? 0 : currentTime.value / duration.value * 100);
  function togglePlayPause() {
    playing.value = !playing.value;
  }
  function seekToStart() {
    currentTime.value = 0;
  }
  function seekToEnd() {
    currentTime.value = duration.value;
    playing.value = false;
  }
  function seekToRatio(ratio) {
    currentTime.value = Math.max(0, Math.min(1, ratio)) * duration.value;
  }
  function toggleMute() {
    muted.value = !muted.value;
  }
  const volumeIcon = computed(() => {
    if (muted.value || volume.value === 0) return "ctv:icon-[lucide--volume-x]";
    if (volume.value < 0.5) return "ctv:icon-[lucide--volume-1]";
    return "ctv:icon-[lucide--volume-2]";
  });
  function handleWaveformClick(event) {
    if (!waveformRef.value || duration.value === 0) return;
    const rect = waveformRef.value.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
    currentTime.value = ratio * duration.value;
    if (!playing.value) playing.value = true;
  }
  whenever(
    src,
    (url) => {
      playing.value = false;
      currentTime.value = 0;
      if (waveform) void decodeAudioSource(url);
    },
    { immediate: true }
  );
  return {
    audioRef,
    waveformRef,
    bars,
    loading,
    isPlaying: playing,
    playedBarIndex,
    progressRatio,
    formattedCurrentTime,
    formattedDuration,
    togglePlayPause,
    seekToStart,
    seekToEnd,
    volume,
    muted,
    volumeIcon,
    toggleMute,
    seekToRatio,
    handleWaveformClick
  };
}
const DEFAULT_DOWNLOAD_FILENAME = "download.png";
function triggerLinkDownload(href, filename) {
  const link = document.createElement("a");
  link.href = href;
  link.download = filename;
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
function extractFilenameFromUrl(url) {
  try {
    return new URL(url, window.location.origin).searchParams.get("filename");
  } catch {
    return null;
  }
}
function extractFilenameFromContentDisposition(header) {
  if (!header) return null;
  const extended = header.match(/filename\*=UTF-8''([^;]+)/i);
  if (extended == null ? void 0 : extended[1]) {
    try {
      return decodeURIComponent(extended[1]);
    } catch {
    }
  }
  const quoted = header.match(/filename="([^"]+)"/i);
  if (quoted == null ? void 0 : quoted[1]) return quoted[1];
  const unquoted = header.match(/filename=([^;\s]+)/i);
  return (unquoted == null ? void 0 : unquoted[1]) ?? null;
}
function downloadFile(url, filename) {
  if (!url || typeof url !== "string" || url.trim().length === 0) {
    throw new Error("Invalid URL provided for download");
  }
  triggerLinkDownload(url, filename || extractFilenameFromUrl(url) || DEFAULT_DOWNLOAD_FILENAME);
}
function downloadBlob(filename, blob) {
  const url = URL.createObjectURL(blob);
  triggerLinkDownload(url, filename);
  queueMicrotask(() => URL.revokeObjectURL(url));
}
async function downloadFileAsBlob(url, {
  filename,
  fetch: fetchFile = fetch,
  preferResponseFilename = true
} = {}) {
  const fallback = filename || extractFilenameFromUrl(url) || DEFAULT_DOWNLOAD_FILENAME;
  const response = await fetchFile(url);
  if (!response.ok) throw new Error(`Failed to fetch ${url}: ${response.status}`);
  const headerFilename = extractFilenameFromContentDisposition(
    response.headers.get("Content-Disposition")
  );
  downloadBlob(preferResponseFilename ? headerFilename ?? fallback : fallback, await response.blob());
}
function useAssetDownload() {
  const { t } = useI18n();
  const toast = useToastStore();
  async function downloadFiles(files) {
    const pending2 = files.map((file) => {
      try {
        if (file.mode === "direct") {
          downloadFile(file.url, file.filename);
          return Promise.resolve();
        }
        return downloadFileAsBlob(file.url, {
          filename: file.filename,
          fetch: file.fetch,
          preferResponseFilename: file.preferResponseFilename
        });
      } catch (error) {
        return Promise.reject(error);
      }
    });
    const results = await Promise.allSettled(pending2);
    const failures = results.flatMap(
      (result, index) => result.status === "rejected" ? [{ cause: result.reason, filename: files[index].filename }] : []
    );
    const successCount = files.length - failures.length;
    if (successCount > 0) {
      toast.add({
        severity: "success",
        summary: t("g.success"),
        detail: t("mediaAsset.selection.downloadsStarted", successCount),
        life: 2e3
      });
    }
    if (failures.length > 0) {
      for (const failure of failures) {
        reportError(failure.cause, {
          errorType: "error_downloading_asset",
          context: { filename: failure.filename }
        });
      }
      toast.add({
        severity: "error",
        summary: t("g.error"),
        detail: t("progressToast.downloadsFailed", failures.length)
      });
    }
  }
  return { downloadFiles };
}
async function displayFilename(asset) {
  if (!isAssetPreviewSupported()) return asset.filename;
  const record = await findOutputAsset(asset.filename).catch(() => void 0);
  const name = record == null ? void 0 : record.name.split("/").pop();
  if (!name) return asset.filename;
  const dot = asset.filename.lastIndexOf(".");
  return name.includes(".") || dot === -1 ? name : `${name}${asset.filename.slice(dot)}`;
}
async function resolveReplyAssetDownload(asset) {
  const apiBase = api.apiURL("/");
  return {
    url: asset.url.includes(apiBase) ? asset.url.slice(asset.url.indexOf(apiBase) + api.apiURL("").length) : asset.url,
    filename: await displayFilename(asset),
    fetch: (url) => api.fetchApi(url),
    mode: "fetch",
    preferResponseFilename: false
  };
}
const _hoisted_1$h = { class: "group/audio ctv:flex ctv:w-full ctv:items-center ctv:gap-2.5 ctv:rounded-lg ctv:border ctv:border-component-node-border ctv:px-3 ctv:py-2.5" };
const _hoisted_2$e = ["src"];
const _hoisted_3$c = { class: "ctv:flex ctv:min-w-0 ctv:flex-1 ctv:flex-col" };
const _hoisted_4$8 = { class: "ctv:truncate ctv:text-sm/4 ctv:font-medium ctv:text-base-foreground" };
const _hoisted_5$6 = { class: "ctv:flex ctv:h-6 ctv:items-center ctv:gap-4" };
const _hoisted_6$6 = { class: "ctv:text-xs ctv:whitespace-nowrap ctv:text-muted-foreground ctv:tabular-nums" };
const _hoisted_7$5 = { class: "ctv:flex ctv:shrink-0 ctv:items-center ctv:gap-2" };
const _sfc_main$h = /* @__PURE__ */ defineComponent({
  __name: "ReplyAudioCard",
  props: {
    asset: {},
    title: {}
  },
  setup(__props) {
    const { t } = useI18n();
    const { downloadFiles } = useAssetDownload();
    const {
      audioRef,
      isPlaying,
      progressRatio,
      formattedCurrentTime,
      formattedDuration,
      togglePlayPause,
      muted,
      volumeIcon,
      toggleMute,
      seekToRatio
    } = useWaveAudioPlayer({ src: toRef(() => __props.asset.url), waveform: false });
    function onScrub(value) {
      if (value == null ? void 0 : value.length) seekToRatio(value[0] / 100);
    }
    async function download() {
      await downloadFiles([await resolveReplyAssetDownload(__props.asset)]);
    }
    return (_ctx, _cache) => {
      return openBlock(), createElementBlock("div", _hoisted_1$h, [
        createBaseVNode("audio", {
          ref: (el) => audioRef.value = el,
          "data-testid": "reply-audio-element",
          class: "ctv:hidden",
          src: __props.asset.url,
          preload: "metadata"
        }, null, 8, _hoisted_2$e),
        createVNode(_sfc_main$v, {
          type: "button",
          variant: "secondary",
          size: "icon-lg",
          "aria-label": unref(isPlaying) ? unref(t)("g.pause") : unref(t)("g.play"),
          class: "ctv:shrink-0",
          onClick: unref(togglePlayPause)
        }, {
          default: withCtx(() => [
            createBaseVNode("span", {
              class: normalizeClass(
                unref(cn)(
                  "ctv:size-4",
                  unref(isPlaying) ? "ctv:icon-[lucide--pause]" : "ctv:icon-[lucide--play]"
                )
              )
            }, null, 2)
          ]),
          _: 1
        }, 8, ["aria-label", "onClick"]),
        createBaseVNode("div", _hoisted_3$c, [
          createBaseVNode("span", _hoisted_4$8, toDisplayString(__props.title), 1),
          createBaseVNode("div", _hoisted_5$6, [
            createBaseVNode("span", _hoisted_6$6, toDisplayString(unref(formattedCurrentTime)) + " / " + toDisplayString(unref(formattedDuration)), 1),
            createVNode(_sfc_main$i, {
              class: "ctv:min-w-0 ctv:flex-1",
              "thumb-class": "ctv:opacity-0 ctv:transition-opacity ctv:group-hover/audio:opacity-100 ctv:focus-visible:opacity-100",
              "model-value": [unref(progressRatio)],
              max: 100,
              step: 0.1,
              "onUpdate:modelValue": onScrub
            }, null, 8, ["model-value"]),
            createBaseVNode("div", _hoisted_7$5, [
              createVNode(_sfc_main$v, {
                type: "button",
                variant: "muted-textonly",
                size: "icon-sm",
                "aria-label": unref(muted) ? unref(t)("g.unmute") : unref(t)("g.mute"),
                class: "ctv:size-6 ctv:rounded-lg",
                onClick: unref(toggleMute)
              }, {
                default: withCtx(() => [
                  createBaseVNode("span", {
                    class: normalizeClass(unref(cn)("ctv:size-4", unref(volumeIcon)))
                  }, null, 2)
                ]),
                _: 1
              }, 8, ["aria-label", "onClick"]),
              createVNode(_sfc_main$v, {
                type: "button",
                variant: "muted-textonly",
                size: "icon-sm",
                "aria-label": unref(t)("g.download"),
                class: "ctv:size-6 ctv:rounded-lg",
                onClick: download
              }, {
                default: withCtx(() => [..._cache[0] || (_cache[0] = [
                  createBaseVNode("span", { class: "ctv:icon-[lucide--download] ctv:size-4" }, null, -1)
                ])]),
                _: 1
              }, 8, ["aria-label"])
            ])
          ])
        ])
      ]);
    };
  }
});
const _hoisted_1$g = { class: "ctv:my-4 ctv:flex ctv:flex-col ctv:gap-2" };
const _hoisted_2$d = ["aria-label", "onClick"];
const _hoisted_3$b = ["src", "alt"];
const _hoisted_4$7 = ["src"];
const _hoisted_5$5 = ["src", "alt"];
const _hoisted_6$5 = {
  key: 2,
  class: "ctv:flex ctv:flex-col ctv:gap-1"
};
const COLLAPSED_COUNT = 12;
const AUDIO_COLLAPSED_COUNT = 5;
const _sfc_main$g = /* @__PURE__ */ defineComponent({
  __name: "ReplyAssetGroup",
  props: {
    assets: {}
  },
  setup(__props) {
    const { t } = useI18n();
    const visual = computed(() => __props.assets.filter((asset) => asset.kind !== "audio"));
    const audio = computed(() => __props.assets.filter((asset) => asset.kind === "audio"));
    const expanded = ref(false);
    const collapsible = computed(() => visual.value.length > COLLAPSED_COUNT);
    const visibleVisual = computed(
      () => expanded.value || !collapsible.value ? visual.value : visual.value.slice(0, COLLAPSED_COUNT)
    );
    const multi = computed(() => visual.value.length > 1);
    const audioExpanded = ref(false);
    const audioCollapsible = computed(
      () => audio.value.length > AUDIO_COLLAPSED_COUNT
    );
    const visibleAudio = computed(
      () => audioExpanded.value || !audioCollapsible.value ? audio.value : audio.value.slice(0, AUDIO_COLLAPSED_COUNT)
    );
    const gridColsClass = computed(() => {
      const count = visual.value.length;
      if (count <= 1) return "ctv:grid-cols-1";
      if (count === 2) return "ctv:grid-cols-2";
      if (count === 3) return "ctv:grid-cols-3";
      return "ctv:grid-cols-4";
    });
    const galleryAssets = computed(
      () => visual.value.filter((asset) => asset.kind !== "3D")
    );
    const galleryItems = computed(
      () => galleryAssets.value.map(replyAssetResultItem)
    );
    const galleryIndex = ref(-1);
    const modelThumbnails = ref({});
    const assetNames = ref({});
    watch(
      () => __props.assets.filter((asset) => asset.kind === "3D" || asset.kind === "audio"),
      (lookups) => {
        if (!isAssetPreviewSupported()) return;
        for (const { url, filename, kind } of lookups) {
          if (kind === "3D" && !(url in modelThumbnails.value)) {
            modelThumbnails.value[url] = "";
            void findServerPreviewUrl(filename).then(async (preview) => {
              if (preview) {
                modelThumbnails.value[url] = preview;
                return;
              }
              const { generateModelThumbnail } = await import("./modelThumbnail-BGHpx4aH.mjs");
              const generated = await generateModelThumbnail(url, filename);
              if (generated) modelThumbnails.value[url] = generated;
            }).catch(() => {
            });
          }
          if (!(url in assetNames.value)) {
            assetNames.value[url] = "";
            void findOutputAsset(filename).then((record) => {
              if (record == null ? void 0 : record.name) assetNames.value[url] = record.name;
            }).catch(() => {
            });
          }
        }
      },
      { immediate: true }
    );
    const Load3dViewerContent = defineAsyncComponent(
      () => import("./Load3dViewerContent-BKWL9EU0.mjs")
    );
    const MediaLightbox = defineAsyncComponent(
      () => import("./MediaLightbox-jlgAx0e-.mjs")
    );
    function refreshModelThumbnail(asset, retry = true) {
      if (!isAssetPreviewSupported() || modelThumbnails.value[asset.url]) return;
      void findServerPreviewUrl(asset.filename).then((preview) => {
        if (preview) {
          modelThumbnails.value[asset.url] = preview;
        } else if (retry) {
          setTimeout(() => refreshModelThumbnail(asset, false), 2e3);
        }
      });
    }
    function inspect(asset) {
      if (asset.kind === "3D") {
        useDialogStore().showDialog({
          key: "asset-3d-viewer",
          title: assetNames.value[asset.url] || asset.filename,
          component: Load3dViewerContent,
          props: { modelUrl: asset.url },
          dialogComponentProps: {
            renderer: "reka",
            size: "full",
            contentClass: "ctv:left-1/2 ctv:w-[80vw] ctv:sm:max-w-[80vw] ctv:h-[80vh] ctv:max-h-[80vh]",
            maximizable: true,
            onClose: () => refreshModelThumbnail(asset)
          }
        });
        return;
      }
      galleryIndex.value = galleryAssets.value.indexOf(asset);
    }
    function playPreview(event) {
      const video = event.target;
      if (video instanceof HTMLVideoElement) void video.play().catch(() => {
      });
    }
    function stopPreview(event) {
      const video = event.target;
      if (video instanceof HTMLVideoElement) video.pause();
    }
    return (_ctx, _cache) => {
      return openBlock(), createElementBlock("div", _hoisted_1$g, [
        visibleVisual.value.length ? (openBlock(), createElementBlock("div", {
          key: 0,
          class: normalizeClass(unref(cn)("ctv:grid ctv:gap-1", gridColsClass.value))
        }, [
          (openBlock(true), createElementBlock(Fragment, null, renderList(visibleVisual.value, (asset) => {
            return openBlock(), createElementBlock("button", {
              key: asset.url,
              type: "button",
              "aria-label": asset.label ?? asset.filename,
              class: normalizeClass(
                unref(cn)(
                  "ctv:relative ctv:cursor-pointer ctv:overflow-hidden ctv:rounded-lg ctv:border-none ctv:p-0",
                  multi.value && "ctv:aspect-square ctv:bg-secondary-background-hover",
                  !multi.value && asset.kind === "3D" && "ctv:justify-self-end"
                )
              ),
              onClick: ($event) => inspect(asset)
            }, [
              asset.kind === "image" ? (openBlock(), createElementBlock("img", {
                key: 0,
                src: asset.url,
                alt: asset.label ?? asset.filename,
                "data-testid": "reply-image-preview",
                loading: "lazy",
                class: normalizeClass(multi.value ? "ctv:size-full ctv:object-cover" : "ctv:block ctv:h-auto ctv:max-w-full")
              }, null, 10, _hoisted_3$b)) : asset.kind === "video" ? (openBlock(), createElementBlock("video", {
                key: 1,
                src: asset.url,
                "data-testid": "reply-video-preview",
                muted: "",
                loop: "",
                playsinline: "",
                preload: "metadata",
                class: normalizeClass(multi.value ? "ctv:size-full ctv:object-cover" : "ctv:block ctv:h-auto ctv:max-w-full"),
                onMouseenter: playPreview,
                onMouseleave: stopPreview
              }, null, 42, _hoisted_4$7)) : modelThumbnails.value[asset.url] ? (openBlock(), createElementBlock("img", {
                key: 2,
                src: modelThumbnails.value[asset.url],
                alt: asset.label ?? asset.filename,
                loading: "lazy",
                class: normalizeClass(multi.value ? "ctv:size-full ctv:object-cover" : "ctv:block ctv:h-auto ctv:max-w-full")
              }, null, 10, _hoisted_5$5)) : (openBlock(), createElementBlock("span", {
                key: 3,
                class: normalizeClass(
                  unref(cn)(
                    "ctv:flex ctv:items-center ctv:justify-center",
                    multi.value ? "ctv:size-full" : "ctv:aspect-square ctv:w-40 ctv:bg-secondary-background-hover"
                  )
                )
              }, [..._cache[3] || (_cache[3] = [
                createBaseVNode("span", { class: "ctv:icon-[lucide--box] ctv:size-6 ctv:text-muted-foreground" }, null, -1)
              ])], 2))
            ], 10, _hoisted_2$d);
          }), 128))
        ], 2)) : createCommentVNode("", true),
        collapsible.value ? (openBlock(), createBlock(_sfc_main$v, {
          key: 1,
          type: "button",
          variant: "outline",
          size: "sm",
          class: "ctv:self-center ctv:rounded-full ctv:border-component-node-border",
          onClick: _cache[0] || (_cache[0] = ($event) => expanded.value = !expanded.value)
        }, {
          default: withCtx(() => [
            createTextVNode(toDisplayString(expanded.value ? unref(t)("agent.showLess") : unref(t)("agent.showMore")) + " ", 1),
            createBaseVNode("span", {
              class: normalizeClass(
                unref(cn)("ctv:icon-[lucide--chevron-down] ctv:size-3", expanded.value && "ctv:rotate-180")
              )
            }, null, 2)
          ]),
          _: 1
        })) : createCommentVNode("", true),
        audio.value.length ? (openBlock(), createElementBlock("div", _hoisted_6$5, [
          (openBlock(true), createElementBlock(Fragment, null, renderList(visibleAudio.value, (asset) => {
            return openBlock(), createBlock(_sfc_main$h, {
              key: asset.url,
              asset,
              title: assetNames.value[asset.url] || asset.filename
            }, null, 8, ["asset", "title"]);
          }), 128)),
          audioCollapsible.value ? (openBlock(), createBlock(_sfc_main$v, {
            key: 0,
            type: "button",
            variant: "outline",
            size: "sm",
            class: "ctv:self-center ctv:rounded-full ctv:border-component-node-border",
            onClick: _cache[1] || (_cache[1] = ($event) => audioExpanded.value = !audioExpanded.value)
          }, {
            default: withCtx(() => [
              createTextVNode(toDisplayString(audioExpanded.value ? unref(t)("agent.showLess") : unref(t)("agent.showMore")) + " ", 1),
              createBaseVNode("span", {
                class: normalizeClass(
                  unref(cn)(
                    "ctv:icon-[lucide--chevron-down] ctv:size-3",
                    audioExpanded.value && "ctv:rotate-180"
                  )
                )
              }, null, 2)
            ]),
            _: 1
          })) : createCommentVNode("", true)
        ])) : createCommentVNode("", true),
        galleryIndex.value !== -1 ? (openBlock(), createBlock(unref(MediaLightbox), {
          key: 3,
          "all-gallery-items": galleryItems.value,
          "active-index": galleryIndex.value,
          "onUpdate:activeIndex": _cache[2] || (_cache[2] = ($event) => galleryIndex.value = $event)
        }, null, 8, ["all-gallery-items", "active-index"])) : createCommentVNode("", true)
      ]);
    };
  }
});
const _hoisted_1$f = {
  "data-testid": "markdown-stream",
  class: "ctv:max-w-full ctv:min-w-0"
};
const _sfc_main$f = /* @__PURE__ */ defineComponent({
  __name: "MarkdownStream",
  props: {
    text: {}
  },
  setup(__props) {
    const apiBaseUrl = new URL(api.apiURL(""), window.location.origin).href;
    const normalizedBase = apiBaseUrl.replace(/\/+$/, "");
    const segments = computed(() => {
      var _a2;
      const out = [];
      let prose = "";
      const flushProse = () => {
        if (!prose) return;
        out.push({
          type: "prose",
          html: renderMarkdownToHtml(prose, apiBaseUrl)
        });
        prose = "";
      };
      for (const token of g.lexer(__props.text)) {
        if (token.type === "code" && token.codeBlockStyle !== "indented") {
          flushProse();
          out.push({
            type: "code",
            code: token.text,
            lang: ((_a2 = token.lang) == null ? void 0 : _a2.split(/\s+/)[0]) || "text"
          });
          continue;
        }
        const assets = tokenReplyAssets(token);
        if (assets) {
          flushProse();
          const resolved = assets.map((asset) => ({
            ...asset,
            url: resolveMarkdownUrl(asset.url, normalizedBase)
          }));
          const prev = out.at(-1);
          if ((prev == null ? void 0 : prev.type) === "assets") prev.assets.push(...resolved);
          else out.push({ type: "assets", assets: resolved });
        } else {
          prose += token.raw;
        }
      }
      flushProse();
      return out;
    });
    const MediaLightbox = defineAsyncComponent(
      () => import("./MediaLightbox-jlgAx0e-.mjs")
    );
    const proseItems = ref([]);
    const proseIndex = ref(-1);
    function onProseClick(event) {
      const image = event.target;
      if (!(image instanceof HTMLImageElement)) return;
      const asset = classifyAssetUrl(image.src) ?? {
        url: image.src,
        filename: image.alt || "image",
        kind: "image"
      };
      proseItems.value = [replyAssetResultItem({ ...asset, kind: "image" })];
      proseIndex.value = 0;
    }
    const proseClass = cn(
      "ctv:text-sm ctv:wrap-break-word ctv:text-base-foreground",
      "ctv:[&_img]:mt-2 ctv:[&_img]:block ctv:[&_img]:h-auto ctv:[&_img]:max-w-full ctv:[&_img]:cursor-pointer ctv:[&_img]:object-contain",
      "ctv:[&_a]:cursor-pointer ctv:[&_a]:text-primary-background ctv:[&_a]:underline",
      "ctv:[&_p]:my-0 ctv:[&_p]:pt-4 ctv:[&_p:first-child]:pt-0 ctv:[&_strong]:font-semibold",
      "ctv:[&_h1]:mt-0 ctv:[&_h1]:pt-4 ctv:[&_h1]:pb-2 ctv:[&_h1]:text-2xl ctv:[&_h1]:font-semibold",
      "ctv:[&_h2]:pt-3.5 ctv:[&_h2]:pb-1.5 ctv:[&_h2]:text-base ctv:[&_h2]:font-semibold ctv:[&_h3]:pt-2 ctv:[&_h3]:font-semibold",
      "ctv:[&_ol]:my-0 ctv:[&_ol]:list-decimal ctv:[&_ol]:pt-1 ctv:[&_ol]:pb-2 ctv:[&_ol]:pl-5",
      "ctv:[&_ul]:my-0 ctv:[&_ul]:list-disc ctv:[&_ul]:pt-1 ctv:[&_ul]:pb-2 ctv:[&_ul]:pl-5",
      "ctv:[&_:not(pre)>code]:rounded-sm ctv:[&_:not(pre)>code]:border ctv:[&_:not(pre)>code]:border-border-default ctv:[&_:not(pre)>code]:bg-secondary-background-hover ctv:[&_:not(pre)>code]:px-1.5 ctv:[&_:not(pre)>code]:py-0.5 ctv:[&_:not(pre)>code]:text-[0.875em]",
      "ctv:[&_blockquote]:my-2 ctv:[&_blockquote]:border-l-[3px] ctv:[&_blockquote]:border-border-default ctv:[&_blockquote]:py-1.5 ctv:[&_blockquote]:pl-3.5 ctv:[&_blockquote]:text-muted-foreground",
      "ctv:[&_table]:my-2 ctv:[&_table]:w-full ctv:[&_table]:border-collapse ctv:[&_table]:overflow-hidden ctv:[&_table]:rounded-lg ctv:[&_table]:bg-secondary-background",
      "ctv:[&_th]:border-b ctv:[&_th]:border-border-default ctv:[&_th]:bg-secondary-background-hover ctv:[&_th]:px-4 ctv:[&_th]:py-2.5 ctv:[&_th]:text-left ctv:[&_th]:font-semibold",
      "ctv:[&_td]:border-b ctv:[&_td]:border-border-default ctv:[&_td]:px-4 ctv:[&_td]:py-2.5"
    );
    return (_ctx, _cache) => {
      return openBlock(), createElementBlock("div", _hoisted_1$f, [
        (openBlock(true), createElementBlock(Fragment, null, renderList(segments.value, (segment, index) => {
          return openBlock(), createElementBlock(Fragment, { key: index }, [
            segment.type === "code" ? (openBlock(), createBlock(_sfc_main$j, {
              key: 0,
              code: segment.code,
              lang: segment.lang
            }, null, 8, ["code", "lang"])) : segment.type === "assets" ? (openBlock(), createBlock(_sfc_main$g, {
              key: 1,
              assets: segment.assets
            }, null, 8, ["assets"])) : (openBlock(), createBlock(_sfc_main$k, {
              key: 2,
              class: normalizeClass(unref(proseClass)),
              html: segment.html,
              onClick: onProseClick
            }, null, 8, ["class", "html"]))
          ], 64);
        }), 128)),
        proseIndex.value !== -1 ? (openBlock(), createBlock(unref(MediaLightbox), {
          key: 0,
          "all-gallery-items": proseItems.value,
          "active-index": proseIndex.value,
          "onUpdate:activeIndex": _cache[0] || (_cache[0] = ($event) => proseIndex.value = $event)
        }, null, 8, ["all-gallery-items", "active-index"])) : createCommentVNode("", true)
      ]);
    };
  }
});
const _hoisted_1$e = { class: "ctv:flex ctv:w-full ctv:flex-col ctv:gap-2 ctv:overflow-hidden ctv:rounded-lg ctv:border ctv:border-component-node-border ctv:bg-secondary-background ctv:p-4 ctv:shadow-interface" };
const _hoisted_2$c = { class: "ctv:flex ctv:min-w-0 ctv:flex-col ctv:gap-0.5 ctv:text-sm/5" };
const _hoisted_3$a = { class: "ctv:m-0 ctv:font-medium ctv:text-base-foreground" };
const _hoisted_4$6 = { class: "ctv:m-0 ctv:min-w-0 ctv:list-disc ctv:pl-5 ctv:text-muted-foreground" };
const _hoisted_5$4 = {
  key: 1,
  class: "ctv:wrap-break-word ctv:underline ctv:underline-offset-2"
};
const _hoisted_6$4 = { class: "ctv:m-0 ctv:text-muted-foreground" };
const _hoisted_7$4 = { class: "ctv:flex ctv:h-6 ctv:w-full ctv:justify-end ctv:gap-2" };
const _sfc_main$e = /* @__PURE__ */ defineComponent({
  __name: "RunApprovalCard",
  props: {
    part: {},
    answering: { type: Boolean, default: false }
  },
  emits: ["answer", "openWorkflow"],
  setup(__props, { emit: __emit }) {
    const emit = __emit;
    const { t } = useI18n();
    const workflowLabel = computed(
      () => {
        var _a2, _b;
        return ((_a2 = __props.part.workflowName) == null ? void 0 : _a2.trim()) || ((_b = __props.part.workflowId) == null ? void 0 : _b.trim()) || t("agent.runApproval.thisWorkflow");
      }
    );
    return (_ctx, _cache) => {
      return openBlock(), createElementBlock("div", _hoisted_1$e, [
        createBaseVNode("div", _hoisted_2$c, [
          createBaseVNode("p", _hoisted_3$a, toDisplayString(unref(t)("agent.runApproval.lead")), 1),
          createBaseVNode("ul", _hoisted_4$6, [
            createBaseVNode("li", null, [
              __props.part.workflowId ? (openBlock(), createBlock(_sfc_main$v, {
                key: 0,
                type: "button",
                variant: "link",
                size: "unset",
                class: "ctv:max-w-full ctv:justify-start ctv:text-left ctv:font-normal ctv:wrap-break-word ctv:whitespace-normal ctv:text-inherit ctv:underline ctv:underline-offset-2",
                onClick: _cache[0] || (_cache[0] = ($event) => emit("openWorkflow", __props.part.workflowId, __props.part.workflowName))
              }, {
                default: withCtx(() => [
                  createTextVNode(toDisplayString(workflowLabel.value), 1)
                ]),
                _: 1
              })) : (openBlock(), createElementBlock("span", _hoisted_5$4, toDisplayString(workflowLabel.value), 1))
            ])
          ]),
          createBaseVNode("p", _hoisted_6$4, toDisplayString(unref(t)("agent.runApproval.question")), 1)
        ]),
        createBaseVNode("div", _hoisted_7$4, [
          createVNode(_sfc_main$v, {
            variant: "secondary",
            size: "sm",
            disabled: __props.answering,
            "aria-busy": __props.answering || void 0,
            onClick: _cache[1] || (_cache[1] = ($event) => emit("answer", __props.part.askId, "cancel"))
          }, {
            default: withCtx(() => [
              createTextVNode(toDisplayString(unref(t)("agent.runApproval.cancel")), 1)
            ]),
            _: 1
          }, 8, ["disabled", "aria-busy"]),
          createVNode(_sfc_main$v, {
            variant: "primary",
            size: "sm",
            disabled: __props.answering,
            "aria-busy": __props.answering || void 0,
            onClick: _cache[2] || (_cache[2] = ($event) => emit("answer", __props.part.askId, "run"))
          }, {
            default: withCtx(() => [
              createTextVNode(toDisplayString(unref(t)("agent.runApproval.run")), 1)
            ]),
            _: 1
          }, 8, ["disabled", "aria-busy"])
        ])
      ]);
    };
  }
});
async function navigateToGraph(targetGraph) {
  const canvas = useCanvasStore().canvas;
  if (!canvas) return;
  if (canvas.graph !== targetGraph) {
    canvas.subgraph = targetGraph.isRootGraph ? void 0 : targetGraph;
    canvas.setGraph(targetGraph);
    await nextTick();
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  }
}
function visibleViewport(canvas) {
  const dock = document.getElementById("local-agent-dock");
  const width = canvas.canvas.width / window.devicePixelRatio;
  const height = canvas.canvas.height / window.devicePixelRatio;
  const covered = dock ? dock.getBoundingClientRect().width : 0;
  return [0, 0, Math.max(width - covered, 0), height];
}
function useFocusNode() {
  const canvasStore = useCanvasStore();
  async function focusNodeInstance(node) {
    if (!canvasStore.canvas || !node.graph) return;
    await navigateToGraph(node.graph);
    const canvas = canvasStore.canvas;
    if (!canvas || canvas.graph !== node.graph) return;
    canvas.animateToBounds(node.boundingRect, { viewport: visibleViewport(canvas) });
  }
  async function focusNode(nodeId, executionIdMap) {
    if (!canvasStore.canvas) return;
    const graphNode = executionIdMap ? executionIdMap.get(nodeId) : getNodeByExecutionId(app.rootGraph, nodeId);
    if (!(graphNode == null ? void 0 : graphNode.graph)) return;
    await focusNodeInstance(graphNode);
  }
  return { focusNode, focusNodeInstance };
}
function getLegacyWorkflowId(id) {
  return id && !isValidUuid(id) ? id : void 0;
}
function areWorkflowIdsEquivalent(existingId, incomingId, existingLegacyId) {
  if (isValidUuid(existingId) && isValidUuid(incomingId)) {
    return existingId.toLowerCase() === incomingId.toLowerCase();
  }
  const incomingLegacyId = getLegacyWorkflowId(incomingId);
  if (incomingLegacyId) {
    return incomingLegacyId === existingLegacyId || incomingLegacyId === existingId;
  }
  return !existingId || !incomingId;
}
const LEGACY_STORAGE_KEY = "ComfyTV.Agent.WorkflowTabBindings";
const STORAGE_KEY = "ComfyTV.Agent.WorkflowTabBindings.v2";
const BINDING_TTL_MS = 30 * 24 * 60 * 60 * 1e3;
function isPersistedBinding(value) {
  if (typeof value !== "object" || value === null) return false;
  const { tabPath, graphId, confirmedAt } = value;
  return typeof tabPath === "string" && (graphId === null || typeof graphId === "string") && typeof confirmedAt === "number";
}
function readLegacyBindings(now) {
  try {
    const parsed = JSON.parse(
      localStorage.getItem(LEGACY_STORAGE_KEY) ?? "null"
    );
    if (typeof parsed !== "object" || parsed === null) return {};
    return Object.fromEntries(
      Object.entries(parsed).flatMap(
        ([workflowId, tabPath]) => typeof tabPath === "string" ? [[workflowId, { tabPath, graphId: null, confirmedAt: now }]] : []
      )
    );
  } catch {
    return {};
  }
}
function liveBindings(bindings, now) {
  return Object.fromEntries(
    Object.entries(bindings).filter(
      (entry) => isPersistedBinding(entry[1]) && entry[1].confirmedAt + BINDING_TTL_MS >= now
    )
  );
}
function graphIdOf(tab) {
  var _a2;
  const activeId = (_a2 = tab.activeState) == null ? void 0 : _a2.id;
  if (activeId !== void 0) return activeId;
  if (typeof tab.originalContent !== "string") return void 0;
  try {
    const parsed = JSON.parse(tab.originalContent);
    return typeof parsed === "object" && parsed !== null && "id" in parsed && typeof parsed.id === "string" ? parsed.id : void 0;
  } catch {
    return void 0;
  }
}
const useAgentWorkflowTabBindingStore = defineStore(
  "agentWorkflowTabBinding",
  () => {
    const now = Date.now();
    const hasStoredBindings = localStorage.getItem(STORAGE_KEY) !== null;
    const tabByWorkflow = useLocalStorage(STORAGE_KEY, {});
    tabByWorkflow.value = liveBindings(
      hasStoredBindings ? tabByWorkflow.value : readLegacyBindings(now),
      now
    );
    const workflows = useWorkflowStore();
    const boundInstances = /* @__PURE__ */ new Map();
    const refusedInstances = /* @__PURE__ */ new Map();
    function recordFor(workflowId) {
      return Object.hasOwn(tabByWorkflow.value, workflowId) ? tabByWorkflow.value[workflowId] : void 0;
    }
    function recordIdFor(tabPath) {
      for (const [workflowId, record] of Object.entries(tabByWorkflow.value)) {
        if (record.tabPath === tabPath) return workflowId;
      }
      return void 0;
    }
    function isVerifiedOwner(workflowId, tab) {
      return boundInstances.get(workflowId) === toRaw(tab);
    }
    function claimable(workflowId, record, tab) {
      if (refusedInstances.get(workflowId) === toRaw(tab)) return false;
      const graphId = graphIdOf(tab);
      if (record.graphId === null || graphId === void 0)
        return !tab.isTemporary;
      return areWorkflowIdsEquivalent(graphId, record.graphId, tab.legacyId);
    }
    function blockedByOccupant(workflowId, record) {
      const occupant = workflows.openWorkflows.find(
        (tab) => tab.path === record.tabPath
      );
      return occupant !== void 0 && !isVerifiedOwner(workflowId, occupant) && !claimable(workflowId, record, occupant);
    }
    function unbind(tabPath) {
      for (const [workflowId, record] of Object.entries(tabByWorkflow.value)) {
        if (record.tabPath === tabPath) {
          delete tabByWorkflow.value[workflowId];
          boundInstances.delete(workflowId);
          refusedInstances.delete(workflowId);
        }
      }
    }
    function unbindWorkflow(workflowId) {
      if (!Object.hasOwn(tabByWorkflow.value, workflowId)) return;
      delete tabByWorkflow.value[workflowId];
      boundInstances.delete(workflowId);
      refusedInstances.delete(workflowId);
    }
    function releaseClosedTab({ tab, path }) {
      const workflowId = recordIdFor(path);
      if (workflowId === void 0) return;
      if (refusedInstances.get(workflowId) === toRaw(tab))
        refusedInstances.delete(workflowId);
      if (isVerifiedOwner(workflowId, tab)) unbind(path);
    }
    function adoptOpenTab({ tab, path }) {
      const workflowId = recordIdFor(path);
      if (workflowId === void 0 || boundInstances.has(workflowId)) return;
      const record = tabByWorkflow.value[workflowId];
      if (!claimable(workflowId, record, tab)) {
        refusedInstances.set(workflowId, toRaw(tab));
        return;
      }
      boundInstances.set(workflowId, toRaw(tab));
      tabByWorkflow.value[workflowId] = { ...record, confirmedAt: Date.now() };
    }
    watch(
      () => workflows.openWorkflows.map((tab) => ({ tab, path: tab.path })),
      (open, previous = []) => {
        previous.filter(({ tab }) => !open.some((entry) => entry.tab === tab)).forEach(releaseClosedTab);
        open.forEach(adoptOpenTab);
      },
      { immediate: true }
    );
    function matchesWorkflow(workflowId, workflow) {
      return !workflow.isTemporary || isVerifiedOwner(workflowId, workflow);
    }
    function bind(workflowId, tabPath) {
      unbind(tabPath);
      refusedInstances.delete(workflowId);
      const workflow = workflows.getWorkflowByPath(tabPath);
      if (workflow) boundInstances.set(workflowId, toRaw(workflow));
      else boundInstances.delete(workflowId);
      tabByWorkflow.value = {
        ...tabByWorkflow.value,
        [workflowId]: {
          tabPath,
          graphId: workflow ? graphIdOf(workflow) ?? null : null,
          confirmedAt: Date.now()
        }
      };
    }
    function tabPathFor(workflowId) {
      const record = recordFor(workflowId);
      return record !== void 0 && !blockedByOccupant(workflowId, record) ? record.tabPath : void 0;
    }
    function workflowIdFor(tabPath) {
      const workflowId = recordIdFor(tabPath);
      return workflowId !== void 0 && !blockedByOccupant(workflowId, tabByWorkflow.value[workflowId]) ? workflowId : void 0;
    }
    return {
      bind,
      unbind,
      unbindWorkflow,
      matchesWorkflow,
      tabPathFor,
      workflowIdFor
    };
  }
);
class AgentTargetNavigationError extends Error {
  constructor(code, workflowId, locatorId) {
    super(`Agent navigation failed: ${code}`);
    __publicField(this, "recoverable", true);
    this.code = code;
    this.workflowId = workflowId;
    this.locatorId = locatorId;
    this.name = "AgentTargetNavigationError";
  }
}
function createTargetAwareAgentNavigation(dependencies) {
  function target(reference) {
    const tab = dependencies.tabForWorkflow(reference.workflowId);
    if (tab === void 0)
      throw new AgentTargetNavigationError(
        "missing_target",
        reference.workflowId,
        reference.locatorId
      );
    if (!dependencies.isOpen(tab))
      throw new AgentTargetNavigationError(
        "closed_target",
        reference.workflowId,
        reference.locatorId
      );
    return tab;
  }
  async function navigate(reference) {
    const tab = target(reference);
    if (!await dependencies.activate(tab))
      throw new AgentTargetNavigationError(
        "activation_failed",
        reference.workflowId,
        reference.locatorId
      );
    if (dependencies.activeTab() !== tab)
      throw new AgentTargetNavigationError(
        "activation_failed",
        reference.workflowId,
        reference.locatorId
      );
    const node = dependencies.resolveIn(tab, reference.locatorId);
    if (node === void 0)
      throw new AgentTargetNavigationError(
        "missing_node",
        reference.workflowId,
        reference.locatorId
      );
    await dependencies.focus(node);
    if (dependencies.activeTab() !== tab)
      throw new AgentTargetNavigationError(
        "activation_failed",
        reference.workflowId,
        reference.locatorId
      );
    return node;
  }
  return { navigate };
}
function useAgentTargetNavigation() {
  const bindingStore = useAgentWorkflowTabBindingStore();
  const workflowStore = useWorkflowStore();
  const workflowService = useWorkflowService();
  const { focusNodeInstance } = useFocusNode();
  return createTargetAwareAgentNavigation({
    tabForWorkflow: (workflowId) => {
      const path = bindingStore.tabPathFor(workflowId);
      return path === void 0 ? void 0 : workflowStore.getWorkflowByPath(path) ?? void 0;
    },
    isOpen: (tab) => workflowStore.openWorkflows.includes(tab),
    activate: (tab) => workflowService.openWorkflow(tab),
    activeTab: () => workflowStore.activeWorkflow ?? void 0,
    resolveIn: (tab, locatorId) => workflowStore.activeWorkflow === tab ? getNodeByLocatorId(app.rootGraph, locatorId) ?? void 0 : void 0,
    focus: focusNodeInstance
  });
}
const _hoisted_1$d = {
  "data-testid": "workflow-link-content",
  class: "ctv:flex ctv:min-w-0 ctv:flex-1 ctv:flex-col ctv:gap-0.5"
};
const _hoisted_2$b = { class: "ctv:truncate ctv:text-sm/4 ctv:font-medium ctv:text-base-foreground" };
const _hoisted_3$9 = ["id"];
const _sfc_main$d = /* @__PURE__ */ defineComponent({
  __name: "TabLinkCard",
  props: {
    workflowId: {},
    locatorId: {},
    name: {}
  },
  setup(__props) {
    const { t } = useI18n();
    const workflowStore = useWorkflowStore();
    const workflowService = useWorkflowService();
    const bindingStore = useAgentWorkflowTabBindingStore();
    const toast = useToastStore();
    const { enabled: agentEnabled } = storeToRefs(useAgentPanelStore());
    const targetNavigation = useAgentTargetNavigation();
    const tab = computed(() => {
      const path = bindingStore.tabPathFor(__props.workflowId);
      return path === void 0 ? void 0 : workflowStore.openWorkflows.find((open2) => open2.path === path);
    });
    const label = computed(() => {
      var _a2;
      return __props.name || ((_a2 = tab.value) == null ? void 0 : _a2.filename);
    });
    const nodeCountId = useId$1();
    const nodeCount = ref();
    watch(
      tab,
      (activeTab) => {
        var _a2, _b;
        nodeCount.value = (_b = (_a2 = activeTab == null ? void 0 : activeTab.activeState) == null ? void 0 : _a2.nodes) == null ? void 0 : _b.length;
      },
      { immediate: true }
    );
    useEventListener(
      api,
      "graphChanged",
      (event) => {
        var _a2;
        if (tab.value === workflowStore.activeWorkflow) {
          nodeCount.value = (_a2 = event.detail.nodes) == null ? void 0 : _a2.length;
        }
      }
    );
    async function open() {
      const target = tab.value;
      if (!target) return;
      if (__props.locatorId === void 0) await workflowService.openWorkflow(target);
      else {
        try {
          await targetNavigation.navigate({ workflowId: __props.workflowId, locatorId: __props.locatorId });
        } catch (error) {
          if (!(error instanceof AgentTargetNavigationError))
            reportError(error, { errorType: "agent_target_navigation_failure" });
          toast.add({
            severity: "warn",
            detail: t("agent.targetNavigationUnavailable"),
            life: 5e3
          });
        }
      }
    }
    return (_ctx, _cache) => {
      return unref(agentEnabled) && tab.value ? (openBlock(), createBlock(_sfc_main$v, {
        key: 0,
        type: "button",
        variant: "outline",
        size: "unset",
        "aria-label": unref(t)("agent.openWorkflowTab", { name: label.value }),
        "aria-describedby": nodeCount.value === void 0 ? void 0 : unref(nodeCountId),
        class: "ctv:h-[53px] ctv:w-full ctv:justify-start ctv:gap-2.5 ctv:border-component-node-border ctv:px-3 ctv:py-2.5 ctv:text-left ctv:whitespace-normal",
        onClick: open
      }, {
        default: withCtx(() => [
          _cache[0] || (_cache[0] = createBaseVNode("span", {
            "aria-hidden": "true",
            "data-testid": "workflow-link-media",
            class: "ctv:flex ctv:size-8 ctv:shrink-0 ctv:items-center ctv:justify-center ctv:rounded-md ctv:border ctv:border-component-node-border ctv:bg-secondary-background ctv:text-muted-foreground"
          }, [
            createBaseVNode("span", { class: "ctv:icon-[comfy--workflow] ctv:size-4" })
          ], -1)),
          createBaseVNode("span", _hoisted_1$d, [
            createBaseVNode("span", _hoisted_2$b, toDisplayString(label.value), 1),
            nodeCount.value !== void 0 ? (openBlock(), createElementBlock("span", {
              key: 0,
              id: unref(nodeCountId),
              class: "ctv:text-xs ctv:text-muted-foreground"
            }, toDisplayString(unref(t)("g.nodesCount", nodeCount.value)), 9, _hoisted_3$9)) : createCommentVNode("", true)
          ]),
          _cache[1] || (_cache[1] = createBaseVNode("span", {
            "aria-hidden": "true",
            "data-testid": "workflow-link-navigation",
            class: "ctv:icon-[lucide--arrow-right] ctv:size-4 ctv:shrink-0 ctv:text-muted-foreground"
          }, null, -1))
        ]),
        _: 1
      }, 8, ["aria-label", "aria-describedby"])) : createCommentVNode("", true);
    };
  }
});
const _hoisted_1$c = { class: "ctv:text-left" };
const _sfc_main$c = /* @__PURE__ */ defineComponent({
  __name: "WorkSummary",
  props: {
    parts: {}
  },
  setup(__props) {
    const { t } = useI18n();
    const totalMs = computed(() => totalDurationMs(__props.parts));
    const label = computed(() => {
      if (totalMs.value <= 0) return t("agent.worked");
      if (totalMs.value < MS_PER_MINUTE)
        return t("agent.workedForSeconds", {
          seconds: tenthsOfSecond(totalMs.value)
        });
      return t("agent.workedForMinutes", splitMinutes(totalMs.value));
    });
    return (_ctx, _cache) => {
      return openBlock(), createBlock(unref(CollapsibleRoot_default), null, {
        default: withCtx(() => [
          createVNode(unref(CollapsibleTrigger_default), { class: "ctv:group ctv:flex ctv:h-8 ctv:w-full ctv:cursor-pointer ctv:items-center ctv:gap-2 ctv:rounded-lg ctv:px-2 ctv:text-sm ctv:leading-none ctv:font-normal ctv:text-muted-foreground ctv:transition-colors ctv:hover:bg-secondary-background-hover ctv:hover:text-base-foreground" }, {
            default: withCtx(() => [
              createBaseVNode("span", _hoisted_1$c, toDisplayString(label.value), 1),
              _cache[0] || (_cache[0] = createBaseVNode("span", { class: "ctv:icon-[lucide--chevron-down] ctv:size-4 ctv:shrink-0 ctv:transition-transform ctv:group-data-[state=open]:rotate-180" }, null, -1))
            ]),
            _: 1
          }),
          createVNode(unref(CollapsibleContent_default), { class: "agent-work-summary ctv:overflow-hidden" }, {
            default: withCtx(() => [
              createVNode(_sfc_main$m, { parts: __props.parts }, null, 8, ["parts"])
            ]),
            _: 1
          })
        ]),
        _: 1
      });
    };
  }
});
const _hoisted_1$b = {
  key: 2,
  role: "group",
  class: "ctv:flex ctv:flex-col ctv:gap-1"
};
const _hoisted_2$a = ["role"];
const _hoisted_3$8 = { class: "ctv:flex ctv:flex-col ctv:gap-0.5" };
const _hoisted_4$5 = {
  key: 0,
  class: "ctv:text-xs ctv:text-muted-foreground"
};
const _sfc_main$b = /* @__PURE__ */ defineComponent({
  __name: "AgentMessageGroup",
  props: {
    group: {},
    streaming: { type: Boolean },
    activityParts: {},
    answeringAskIds: {},
    paywallPresentation: {}
  },
  emits: ["answer", "openWorkflow", "paywallAction"],
  setup(__props, { emit: __emit }) {
    const emit = __emit;
    return (_ctx, _cache) => {
      return __props.group.kind === "text" ? (openBlock(), createBlock(_sfc_main$f, {
        key: 0,
        text: __props.group.part.text
      }, null, 8, ["text"])) : __props.group.kind === "trace" ? (openBlock(), createElementBlock(Fragment, { key: 1 }, [
        __props.streaming ? (openBlock(), createBlock(_sfc_main$m, {
          key: 0,
          parts: __props.activityParts,
          live: ""
        }, null, 8, ["parts"])) : (openBlock(), createBlock(_sfc_main$c, {
          key: 1,
          parts: __props.activityParts
        }, null, 8, ["parts"]))
      ], 64)) : __props.group.kind === "tabLinks" ? (openBlock(), createElementBlock("div", _hoisted_1$b, [
        (openBlock(true), createElementBlock(Fragment, null, renderList(__props.group.parts, (link, linkIndex) => {
          return openBlock(), createBlock(_sfc_main$d, {
            key: linkIndex,
            "workflow-id": link.workflowId,
            "locator-id": link.locatorId,
            name: link.name
          }, null, 8, ["workflow-id", "locator-id", "name"]);
        }), 128))
      ])) : __props.group.kind === "runApproval" ? (openBlock(), createBlock(_sfc_main$e, {
        key: 3,
        part: __props.group.part,
        answering: __props.answeringAskIds.has(__props.group.part.askId),
        onAnswer: _cache[0] || (_cache[0] = (askId, selection) => emit("answer", askId, selection)),
        onOpenWorkflow: _cache[1] || (_cache[1] = (workflowId, workflowName) => emit("openWorkflow", workflowId, workflowName))
      }, null, 8, ["part", "answering"])) : __props.group.kind === "paywall" ? (openBlock(), createBlock(_sfc_main$l, {
        key: 4,
        presentation: __props.paywallPresentation,
        message: __props.group.part.message,
        onPaywallAction: _cache[2] || (_cache[2] = ($event) => emit("paywallAction", $event))
      }, null, 8, ["presentation", "message"])) : (openBlock(), createElementBlock("div", {
        key: 5,
        role: __props.group.part.level === "error" ? "alert" : "status",
        class: normalizeClass(
          unref(cn)(
            "ctv:flex ctv:items-start ctv:gap-2 ctv:rounded-xl ctv:border ctv:px-3 ctv:py-2 ctv:text-sm",
            __props.group.part.level === "error" ? "ctv:border-destructive-background/40 ctv:text-destructive-background" : "ctv:border-component-node-border ctv:text-muted-foreground"
          )
        )
      }, [
        _cache[3] || (_cache[3] = createBaseVNode("span", { class: "ctv:mt-0.5 ctv:icon-[lucide--triangle-alert] ctv:size-4 ctv:shrink-0" }, null, -1)),
        createBaseVNode("span", _hoisted_3$8, [
          createBaseVNode("span", null, toDisplayString(__props.group.part.text), 1),
          __props.group.part.retryAfterSeconds !== void 0 ? (openBlock(), createElementBlock("span", _hoisted_4$5, toDisplayString(_ctx.$t("agent.retryAfterSeconds", {
            seconds: __props.group.part.retryAfterSeconds
          })), 1)) : createCommentVNode("", true)
        ])
      ], 10, _hoisted_2$a));
    };
  }
});
const _hoisted_1$a = { class: "ctv:flex ctv:w-full ctv:items-center ctv:justify-start ctv:gap-1 ctv:text-muted-foreground" };
const _hoisted_2$9 = { class: "ctv:flex ctv:h-6 ctv:w-14 ctv:rounded-lg ctv:transition-colors ctv:hover:bg-secondary-background-hover ctv:hover:text-base-foreground ctv:has-data-[state=open]:bg-secondary-background-hover ctv:has-data-[state=open]:text-base-foreground" };
const _sfc_main$a = /* @__PURE__ */ defineComponent({
  __name: "MessageFeedback",
  props: {
    markdown: {},
    assets: { default: () => [] }
  },
  emits: ["feedback"],
  setup(__props, { emit: __emit }) {
    const { t } = useI18n();
    const { copy, copied } = useClipboard({ copiedDuring: 2e3, legacy: true });
    const { downloadFiles } = useAssetDownload();
    function copyPlainText() {
      var _a2;
      const doc = new DOMParser().parseFromString(
        renderMarkdownToHtml(__props.markdown),
        "text/html"
      );
      void copy(((_a2 = doc.body.textContent) == null ? void 0 : _a2.trim()) ?? "");
    }
    const downloading = ref(false);
    async function downloadAssets() {
      if (downloading.value) return;
      downloading.value = true;
      try {
        await downloadFiles(
          await Promise.all(__props.assets.map(resolveReplyAssetDownload))
        );
      } finally {
        downloading.value = false;
      }
    }
    return (_ctx, _cache) => {
      return openBlock(), createElementBlock("div", _hoisted_1$a, [
        __props.assets.length ? (openBlock(), createBlock(_sfc_main$s, {
          key: 0,
          label: unref(t)("agent.downloadAssets"),
          "skip-delay-duration": 0,
          "disable-hoverable-content": "",
          "collision-padding": 8
        }, {
          trigger: withCtx(() => [
            createVNode(_sfc_main$v, {
              type: "button",
              variant: "muted-textonly",
              size: "icon-sm",
              "aria-label": unref(t)("agent.downloadAssets"),
              disabled: downloading.value,
              class: "ctv:size-6 ctv:rounded-lg",
              onClick: downloadAssets
            }, {
              default: withCtx(() => [..._cache[2] || (_cache[2] = [
                createBaseVNode("span", { class: "ctv:icon-[lucide--download] ctv:size-3" }, null, -1)
              ])]),
              _: 1
            }, 8, ["aria-label", "disabled"])
          ]),
          _: 1
        }, 8, ["label"])) : createCommentVNode("", true),
        createBaseVNode("div", _hoisted_2$9, [
          createVNode(_sfc_main$s, {
            label: unref(copied) ? unref(t)("agent.copied") : unref(t)("agent.copy"),
            "skip-delay-duration": 0,
            "disable-hoverable-content": "",
            "collision-padding": 8
          }, {
            trigger: withCtx(() => [
              createVNode(_sfc_main$v, {
                type: "button",
                variant: "muted-textonly",
                size: "unset",
                "aria-label": unref(copied) ? unref(t)("agent.copied") : unref(t)("agent.copy"),
                class: normalizeClass(
                  unref(cn)(
                    "ctv:h-6 ctv:w-8 ctv:rounded-l-lg ctv:rounded-r-none ctv:focus-visible:z-10",
                    unref(copied) ? "ctv:text-base-foreground" : "ctv:text-inherit"
                  )
                ),
                onClick: _cache[0] || (_cache[0] = ($event) => copyPlainText())
              }, {
                default: withCtx(() => [
                  createBaseVNode("span", {
                    class: normalizeClass(
                      unref(cn)(
                        "ctv:size-3",
                        unref(copied) ? "ctv:icon-[lucide--check]" : "ctv:icon-[lucide--copy]"
                      )
                    )
                  }, null, 2)
                ]),
                _: 1
              }, 8, ["aria-label", "class"])
            ]),
            _: 1
          }, 8, ["label"]),
          createVNode(unref(DropdownMenuRoot_default), null, {
            default: withCtx(() => [
              createVNode(unref(DropdownMenuTrigger_default), { "as-child": "" }, {
                default: withCtx(() => [
                  createVNode(_sfc_main$v, {
                    variant: "muted-textonly",
                    size: "icon-sm",
                    "aria-label": unref(t)("agent.copyMarkdown"),
                    class: "ctv:size-6 ctv:rounded-l-none ctv:rounded-r-lg ctv:text-inherit ctv:focus-visible:z-10"
                  }, {
                    default: withCtx(() => [..._cache[3] || (_cache[3] = [
                      createBaseVNode("span", { class: "ctv:icon-[lucide--chevron-down] ctv:size-3" }, null, -1)
                    ])]),
                    _: 1
                  }, 8, ["aria-label"])
                ]),
                _: 1
              }),
              createVNode(unref(DropdownMenuPortal_default), null, {
                default: withCtx(() => [
                  createVNode(unref(DropdownMenuContent_default), {
                    align: "end",
                    "side-offset": 4,
                    class: "ctv:z-1100 ctv:h-9 ctv:w-36 ctv:rounded-lg ctv:border ctv:border-border-subtle ctv:bg-secondary-background ctv:p-1 ctv:shadow-lg"
                  }, {
                    default: withCtx(() => [
                      createVNode(unref(DropdownMenuItem_default), {
                        class: "ctv:flex ctv:h-7 ctv:w-full ctv:cursor-pointer ctv:items-center ctv:rounded-lg ctv:px-1.5 ctv:text-[14px]/5 ctv:font-normal ctv:whitespace-nowrap ctv:text-base-foreground ctv:outline-none ctv:data-highlighted:bg-secondary-background-hover",
                        onSelect: _cache[1] || (_cache[1] = ($event) => unref(copy)(__props.markdown))
                      }, {
                        default: withCtx(() => [
                          createTextVNode(toDisplayString(unref(t)("agent.copyMarkdown")), 1)
                        ]),
                        _: 1
                      })
                    ]),
                    _: 1
                  })
                ]),
                _: 1
              })
            ]),
            _: 1
          })
        ])
      ]);
    };
  }
});
const _hoisted_1$9 = { class: "ctv:space-y-2 ctv:pb-4" };
const _hoisted_2$8 = {
  key: 0,
  class: "ctv:flex ctv:h-8 ctv:items-center ctv:gap-2 ctv:rounded-lg ctv:px-2 ctv:text-sm/5 ctv:font-normal ctv:text-muted-foreground"
};
const _hoisted_3$7 = { class: "agent-shimmer-text ctv:min-w-0 ctv:truncate" };
const _sfc_main$9 = /* @__PURE__ */ defineComponent({
  __name: "AgentMessage",
  props: {
    message: {},
    answeringAskIds: { default: () => /* @__PURE__ */ new Set() },
    paywallPresentation: { default: () => DEFAULT_AGENT_PAYWALL_PRESENTATION }
  },
  emits: ["feedback", "answerAsk", "openWorkflow", "paywallAction"],
  setup(__props, { emit: __emit }) {
    const { t } = useI18n();
    const emit = __emit;
    const activityParts = computed(
      () => __props.message.parts.filter(
        (part) => part.type === "tool" || part.type === "thinking"
      )
    );
    const groups = computed(() => {
      const out = [];
      let tracePlaced = activityParts.value.length === 0;
      for (const part of __props.message.parts) {
        if (part.type === "tool" || part.type === "thinking") {
          if (tracePlaced) continue;
          tracePlaced = true;
          out.push({ kind: "trace" });
        } else if (part.type === "text") {
          out.push({ kind: "text", part });
        } else if (part.type === "tabLink") {
          const prev = out.at(-1);
          if ((prev == null ? void 0 : prev.kind) === "tabLinks") prev.parts.push(part);
          else out.push({ kind: "tabLinks", parts: [part] });
        } else if (part.type === "runApproval") {
          out.push({ kind: "runApproval", part });
        } else if (part.type === "paywall") {
          out.push({ kind: "paywall", part });
        } else {
          out.push({ kind: "notice", part });
        }
      }
      return out;
    });
    const markdown = computed(
      () => __props.message.parts.filter((part) => part.type === "text").map((part) => part.text).join("\n\n")
    );
    const showActions = computed(
      () => !__props.message.streaming && markdown.value.length > 0
    );
    const replyAssets = computed(
      () => showActions.value ? htmlReplyAssets(renderMarkdownToHtml(markdown.value)) : []
    );
    const composing = computed(
      () => __props.message.streaming && __props.message.parts.length > 0 && __props.message.parts.every(
        (part) => part.type !== "runApproval" && (!("state" in part) || part.state === "done")
      )
    );
    const status = computed(() => {
      const narrating = activityParts.value.length === 0 && (__props.message.thinking || __props.message.streaming && !__props.message.parts.length);
      if (narrating)
        return {
          icon: "ctv:icon-[lucide--brain]",
          text: __props.message.thinkingText || t("agent.thinking")
        };
      if (composing.value)
        return {
          icon: "ctv:text-muted-foreground ctv:icon-[lucide--loader-circle] ctv:animate-spin",
          text: t("agent.working")
        };
      return null;
    });
    return (_ctx, _cache) => {
      return openBlock(), createElementBlock("div", _hoisted_1$9, [
        (openBlock(true), createElementBlock(Fragment, null, renderList(groups.value, (group, index) => {
          return openBlock(), createBlock(_sfc_main$b, {
            key: index,
            group,
            streaming: __props.message.streaming,
            "activity-parts": activityParts.value,
            "answering-ask-ids": __props.answeringAskIds,
            "paywall-presentation": __props.paywallPresentation,
            onAnswer: _cache[0] || (_cache[0] = (askId, selection) => emit("answerAsk", askId, selection)),
            onOpenWorkflow: _cache[1] || (_cache[1] = (workflowId, workflowName) => emit("openWorkflow", workflowId, workflowName)),
            onPaywallAction: _cache[2] || (_cache[2] = ($event) => emit("paywallAction", $event))
          }, null, 8, ["group", "streaming", "activity-parts", "answering-ask-ids", "paywall-presentation"]);
        }), 128)),
        status.value ? (openBlock(), createElementBlock("div", _hoisted_2$8, [
          createBaseVNode("span", {
            class: normalizeClass(unref(cn)("ctv:size-4 ctv:shrink-0", status.value.icon))
          }, null, 2),
          createBaseVNode("span", _hoisted_3$7, toDisplayString(status.value.text), 1)
        ])) : createCommentVNode("", true),
        showActions.value ? (openBlock(), createBlock(_sfc_main$a, {
          key: 1,
          markdown: markdown.value,
          assets: replyAssets.value,
          onFeedback: _cache[3] || (_cache[3] = ($event) => emit("feedback", $event))
        }, null, 8, ["markdown", "assets"])) : createCommentVNode("", true)
      ]);
    };
  }
});
function userMessageClipboard(message) {
  const { text: text2, workflowReferences = [] } = message;
  const plainText = agentMessageText(message);
  const prompt = promptDocument({
    text: text2,
    references: [...workflowReferences].sort((a, b2) => a.textOffset - b2.textOffset).map((reference) => ({ ...reference, kind: "workflow" }))
  });
  const container = document.createElement("span");
  container.style.whiteSpace = "pre-wrap";
  container.append(
    DOMSerializer.fromSchema(inlinePromptSchema).serializeFragment(
      prompt.content
    ),
    plainText.slice(agentMessageText({ text: text2, workflowReferences }).length)
  );
  return { text: plainText, html: container.outerHTML };
}
function selectedUserMessageClipboard(bubble, selection) {
  if (!selection || selection.isCollapsed || selection.rangeCount !== 1) return;
  const range = selection.getRangeAt(0).cloneRange();
  if (!bubble.contains(range.startContainer) || !bubble.contains(range.endContainer))
    return;
  for (const chip of bubble.querySelectorAll('[data-comfy-workflow="1"]')) {
    if (chip.contains(range.startContainer)) range.setStartBefore(chip);
    if (chip.contains(range.endContainer)) range.setEndAfter(chip);
  }
  const prompt = promptDraft(
    DOMParser$1.fromSchema(inlinePromptSchema).parse(range.cloneContents(), {
      preserveWhitespace: "full"
    })
  );
  const workflowReferences = prompt.references.filter(
    (reference) => reference.kind === "workflow"
  );
  if (!workflowReferences.length) return;
  return userMessageClipboard({ text: prompt.text, workflowReferences });
}
const _hoisted_1$8 = {
  key: 0,
  class: "ctv:flex ctv:flex-wrap ctv:justify-end ctv:gap-1"
};
const _hoisted_2$7 = { class: "ctv:max-w-40 ctv:truncate" };
const _hoisted_3$6 = {
  key: 1,
  class: "ctv:w-full"
};
const _hoisted_4$4 = {
  key: 2,
  class: "ctv:grid ctv:w-56 ctv:max-w-full ctv:grid-cols-2 ctv:gap-1.5"
};
const _hoisted_5$3 = { class: "ctv:flex ctv:aspect-square ctv:w-full ctv:items-center ctv:justify-center ctv:rounded-lg ctv:bg-secondary-background" };
const _hoisted_6$3 = { class: "ctv:mt-0.5 ctv:truncate ctv:text-xs ctv:text-muted-foreground" };
const _hoisted_7$3 = ["aria-label", "data-workflow-id", "data-workflow-unavailable", "aria-disabled", "aria-description", "title", "onClick", "onKeydown", "onKeyup"];
const _hoisted_8$3 = {
  key: 4,
  class: "ctv:flex ctv:text-muted-foreground ctv:opacity-0 ctv:transition-opacity ctv:group-hover:opacity-100 ctv:focus-within:opacity-100 ctv:touch:opacity-100"
};
const _sfc_main$8 = /* @__PURE__ */ defineComponent({
  __name: "UserMessage",
  props: {
    text: {},
    attachments: { default: () => [] },
    tags: { default: () => [] },
    workflowReferences: { default: () => [] },
    editable: { type: Boolean, default: false }
  },
  emits: ["edit", "openReferenceWorkflow"],
  setup(__props, { emit: __emit }) {
    const emit = __emit;
    const { t } = useI18n();
    const promptParts = computed(
      () => workflowReferenceParts(__props.text, __props.workflowReferences)
    );
    const readableText = computed(
      () => agentMessageText({ text: __props.text, workflowReferences: __props.workflowReferences, tags: __props.tags, attachments: __props.attachments })
    );
    const bubble = useTemplateRef("bubble");
    const plainClipboard = useClipboard({ copiedDuring: 2e3, legacy: true });
    const richClipboard = useClipboardItems({ copiedDuring: 2e3 });
    const copied = computed(
      () => plainClipboard.copied.value || richClipboard.copied.value
    );
    async function copyMessage() {
      if (__props.workflowReferences.length && richClipboard.isSupported.value && typeof ClipboardItem !== "undefined") {
        const content = userMessageClipboard({
          text: __props.text,
          workflowReferences: __props.workflowReferences,
          tags: __props.tags,
          attachments: __props.attachments
        });
        try {
          await richClipboard.copy([
            new ClipboardItem({
              "text/plain": new Blob([content.text], { type: "text/plain" }),
              "text/html": new Blob([content.html], { type: "text/html" })
            })
          ]);
          return;
        } catch {
          await plainClipboard.copy(content.text);
          return;
        }
      }
      await plainClipboard.copy(readableText.value);
    }
    function copySelection(event) {
      if (!bubble.value || !event.clipboardData) return;
      const content = selectedUserMessageClipboard(
        bubble.value,
        document.getSelection()
      );
      if (!content) return;
      event.clipboardData.setData("text/plain", content.text);
      event.clipboardData.setData("text/html", content.html);
      event.preventDefault();
      event.stopPropagation();
    }
    function openReference(reference) {
      if (reference.unavailable) return;
      emit("openReferenceWorkflow", reference.id, reference.name);
    }
    function attachmentIconClass(name) {
      const kind = getMediaTypeFromFilename(name);
      return kind === "other" ? "ctv:icon-[lucide--file]" : iconForMediaType(kind);
    }
    const splitAttachments = computed(() => {
      const grid = [];
      const plain = [];
      for (const item of __props.attachments) {
        const kind = getMediaTypeFromFilename(item.name);
        const url = item.previewUrl ?? (item.ref ? api.apiURL(
          `/view?filename=${encodeURIComponent(item.ref)}&type=input`
        ) : void 0);
        if (url && (kind === "image" || kind === "video" || kind === "audio" || kind === "3D")) {
          grid.push({ url, filename: item.name, kind });
        } else {
          plain.push(item);
        }
      }
      return { grid, plain };
    });
    return (_ctx, _cache) => {
      return openBlock(), createElementBlock("div", {
        class: "ctv:group ctv:flex ctv:flex-col ctv:items-end ctv:gap-2 ctv:pl-16",
        onCopy: copySelection
      }, [
        __props.tags.length ? (openBlock(), createElementBlock("div", _hoisted_1$8, [
          (openBlock(true), createElementBlock(Fragment, null, renderList(__props.tags, (tag, index) => {
            return openBlock(), createElementBlock("span", {
              key: `${tag}:${index}`,
              class: "ctv:inline-flex ctv:items-center ctv:gap-1 ctv:rounded-xl ctv:bg-secondary-background ctv:px-1.5 ctv:py-0.5 ctv:text-xs ctv:text-muted-foreground"
            }, [
              _cache[2] || (_cache[2] = createBaseVNode("span", { class: "ctv:icon-[lucide--at-sign] ctv:size-3 ctv:shrink-0" }, null, -1)),
              createBaseVNode("span", _hoisted_2$7, toDisplayString(tag), 1)
            ]);
          }), 128))
        ])) : createCommentVNode("", true),
        splitAttachments.value.grid.length ? (openBlock(), createElementBlock("div", _hoisted_3$6, [
          createVNode(_sfc_main$g, {
            assets: splitAttachments.value.grid
          }, null, 8, ["assets"])
        ])) : createCommentVNode("", true),
        splitAttachments.value.plain.length ? (openBlock(), createElementBlock("div", _hoisted_4$4, [
          (openBlock(true), createElementBlock(Fragment, null, renderList(splitAttachments.value.plain, (item, index) => {
            return openBlock(), createElementBlock("figure", {
              key: `${item.name}:${index}`,
              class: "ctv:m-0"
            }, [
              createBaseVNode("div", _hoisted_5$3, [
                createBaseVNode("span", {
                  class: normalizeClass(
                    unref(cn)(attachmentIconClass(item.name), "ctv:size-6 ctv:text-muted-foreground")
                  )
                }, null, 2)
              ]),
              createBaseVNode("figcaption", _hoisted_6$3, toDisplayString(item.name), 1)
            ]);
          }), 128))
        ])) : createCommentVNode("", true),
        __props.text || __props.workflowReferences.length ? (openBlock(), createElementBlock("div", {
          key: 3,
          ref_key: "bubble",
          ref: bubble,
          "data-testid": "user-message-bubble",
          class: "ctv:w-fit ctv:max-w-full ctv:rounded-lg ctv:border ctv:border-component-node-border ctv:bg-secondary-background ctv:px-2.5 ctv:py-1.5 ctv:text-sm/5 ctv:font-normal ctv:wrap-break-word ctv:whitespace-pre-wrap ctv:text-muted-foreground"
        }, [
          (openBlock(true), createElementBlock(Fragment, null, renderList(promptParts.value, (part, index) => {
            return openBlock(), createElementBlock(Fragment, { key: index }, [
              part.type === "workflow" ? (openBlock(), createElementBlock("span", {
                key: 0,
                role: "button",
                tabindex: "0",
                "aria-label": part.reference.unavailable ? unref(t)("agent.unavailableWorkflowReference", {
                  name: part.reference.name
                }) : unref(t)("agent.openWorkflowTab", { name: part.reference.name }),
                "data-testid": "workflow-reference-chip",
                "data-comfy-workflow": "1",
                "data-workflow-id": part.reference.id,
                "data-workflow-unavailable": part.reference.unavailable ? "true" : void 0,
                "aria-disabled": part.reference.unavailable,
                "aria-description": part.reference.unavailable ? unref(t)("agent.workflowReferenceUnavailableReason") : void 0,
                title: part.reference.unavailable ? unref(t)("agent.workflowReferenceUnavailableReason") : void 0,
                class: "ctv:inline ctv:cursor-pointer ctv:rounded-sm ctv:bg-primary-background/30 ctv:box-decoration-clone ctv:px-1 ctv:py-0.5 ctv:font-inter ctv:text-xs/[15px] ctv:font-normal ctv:break-all ctv:whitespace-normal ctv:text-primary-background-hover ctv:ring-1 ctv:ring-primary-background/30 ctv:ring-inset ctv:focus-visible:outline-2 ctv:focus-visible:outline-offset-2 ctv:focus-visible:outline-primary-background ctv:aria-disabled:cursor-not-allowed ctv:aria-disabled:opacity-50",
                onClick: ($event) => openReference(part.reference),
                onKeydown: [
                  withKeys(withModifiers(($event) => openReference(part.reference), ["prevent"]), ["enter"]),
                  _cache[0] || (_cache[0] = withKeys(withModifiers(() => {
                  }, ["prevent"]), ["space"]))
                ],
                onKeyup: withKeys(withModifiers(($event) => openReference(part.reference), ["prevent"]), ["space"])
              }, [
                _cache[3] || (_cache[3] = createBaseVNode("span", { class: "ctv:mr-1 ctv:icon-[comfy--workflow] ctv:inline-block ctv:size-3 ctv:align-middle" }, null, -1)),
                createBaseVNode("span", null, toDisplayString(part.reference.name), 1)
              ], 40, _hoisted_7$3)) : (openBlock(), createElementBlock(Fragment, { key: 1 }, [
                createTextVNode(toDisplayString(part.text), 1)
              ], 64))
            ], 64);
          }), 128))
        ], 512)) : createCommentVNode("", true),
        readableText.value ? (openBlock(), createElementBlock("div", _hoisted_8$3, [
          __props.editable && (__props.text || __props.workflowReferences.length) ? (openBlock(), createBlock(_sfc_main$s, {
            key: 0,
            label: unref(t)("g.edit"),
            "skip-delay-duration": 0,
            "disable-hoverable-content": "",
            "collision-padding": 8
          }, {
            trigger: withCtx(() => [
              createVNode(_sfc_main$v, {
                type: "button",
                variant: "muted-textonly",
                size: "icon-sm",
                "aria-label": unref(t)("g.edit"),
                class: "ctv:size-6 ctv:rounded-lg",
                onClick: _cache[1] || (_cache[1] = ($event) => emit("edit", { text: __props.text, workflowReferences: __props.workflowReferences }))
              }, {
                default: withCtx(() => [..._cache[4] || (_cache[4] = [
                  createBaseVNode("span", { class: "ctv:icon-[lucide--pencil] ctv:size-3" }, null, -1)
                ])]),
                _: 1
              }, 8, ["aria-label"])
            ]),
            _: 1
          }, 8, ["label"])) : createCommentVNode("", true),
          createVNode(_sfc_main$s, {
            label: copied.value ? unref(t)("agent.copied") : unref(t)("agent.copy"),
            "skip-delay-duration": 0,
            "disable-hoverable-content": "",
            "collision-padding": 8
          }, {
            trigger: withCtx(() => [
              createVNode(_sfc_main$v, {
                type: "button",
                variant: "muted-textonly",
                size: "icon-sm",
                "aria-label": copied.value ? unref(t)("agent.copied") : unref(t)("agent.copy"),
                class: "ctv:size-6 ctv:rounded-lg",
                onClick: copyMessage
              }, {
                default: withCtx(() => [
                  createBaseVNode("span", {
                    class: normalizeClass(
                      unref(cn)(
                        "ctv:size-3",
                        copied.value ? "ctv:icon-[lucide--check]" : "ctv:icon-[lucide--copy]"
                      )
                    )
                  }, null, 2)
                ]),
                _: 1
              }, 8, ["aria-label"])
            ]),
            _: 1
          }, 8, ["label"])
        ])) : createCommentVNode("", true)
      ], 32);
    };
  }
});
const _hoisted_1$7 = { class: "ctv:relative ctv:h-full" };
const _hoisted_2$6 = { class: "ctv:mx-auto ctv:max-w-[640px] ctv:p-4" };
const _hoisted_3$5 = { class: "ctv:flex ctv:flex-col ctv:gap-4" };
const _sfc_main$7 = /* @__PURE__ */ defineComponent({
  __name: "ConversationView",
  props: {
    entries: {},
    paywallPresentation: { default: () => DEFAULT_AGENT_PAYWALL_PRESENTATION },
    editableTurnId: { default: null },
    answeringAskIds: { default: () => /* @__PURE__ */ new Set() }
  },
  emits: ["feedback", "editPrompt", "answerAsk", "openWorkflow", "openReferenceWorkflow", "paywallAction"],
  setup(__props, { emit: __emit }) {
    const emit = __emit;
    const { t } = useI18n();
    const bottom = ref();
    const atBottom = ref(true);
    useIntersectionObserver(bottom, ([entry]) => {
      atBottom.value = (entry == null ? void 0 : entry.isIntersecting) ?? true;
    });
    const top = ref();
    const atTop = ref(true);
    useIntersectionObserver(top, ([entry]) => {
      atTop.value = (entry == null ? void 0 : entry.isIntersecting) ?? true;
    });
    function scrollToLatest() {
      var _a2;
      (_a2 = bottom.value) == null ? void 0 : _a2.scrollIntoView({ block: "end" });
    }
    const latestContentSignal = computed(() => {
      const last = __props.entries.at(-1);
      if (!last || !("parts" in last)) return `${__props.entries.length}`;
      const tail = last.parts.at(-1);
      const tailText = tail && "text" in tail ? tail.text.length : 0;
      const settled = last.parts.filter(
        (part) => "state" in part && part.state === "done"
      ).length;
      return `${__props.entries.length}:${last.streaming}:${last.parts.length}:${settled}:${tailText}`;
    });
    watch(
      latestContentSignal,
      async () => {
        if (!atBottom.value) return;
        await nextTick();
        scrollToLatest();
      },
      { flush: "post" }
    );
    return (_ctx, _cache) => {
      const _directive_tooltip = resolveDirective("tooltip");
      return openBlock(), createElementBlock("div", _hoisted_1$7, [
        createBaseVNode("div", {
          class: normalizeClass(
            unref(cn)(
              "ctv:h-full ctv:overflow-y-auto",
              !atTop.value && "ctv:mask-t-from-[calc(100%-2rem)]",
              !atBottom.value && "ctv:mask-b-from-[calc(100%-2rem)]"
            )
          )
        }, [
          createBaseVNode("div", {
            ref_key: "top",
            ref: top
          }, null, 512),
          createBaseVNode("div", _hoisted_2$6, [
            createBaseVNode("div", _hoisted_3$5, [
              (openBlock(true), createElementBlock(Fragment, null, renderList(__props.entries, (entry) => {
                return openBlock(), createElementBlock(Fragment, {
                  key: `${entry.role}-${entry.id}`
                }, [
                  entry.role === "user" ? (openBlock(), createBlock(_sfc_main$8, {
                    key: 0,
                    text: entry.text,
                    attachments: entry.attachments,
                    tags: entry.tags,
                    "workflow-references": entry.workflowReferences,
                    editable: entry.id === __props.editableTurnId,
                    onEdit: _cache[0] || (_cache[0] = ($event) => emit("editPrompt", $event)),
                    onOpenReferenceWorkflow: _cache[1] || (_cache[1] = (workflowId, workflowName) => emit("openReferenceWorkflow", workflowId, workflowName))
                  }, null, 8, ["text", "attachments", "tags", "workflow-references", "editable"])) : (openBlock(), createBlock(_sfc_main$9, {
                    key: 1,
                    message: entry,
                    "answering-ask-ids": __props.answeringAskIds,
                    "paywall-presentation": __props.paywallPresentation,
                    onFeedback: ($event) => emit("feedback", entry.id, $event),
                    onAnswerAsk: _cache[2] || (_cache[2] = (askId, selection) => emit("answerAsk", askId, selection)),
                    onOpenWorkflow: _cache[3] || (_cache[3] = (workflowId, workflowName) => emit("openWorkflow", workflowId, workflowName)),
                    onPaywallAction: _cache[4] || (_cache[4] = ($event) => emit("paywallAction", $event))
                  }, null, 8, ["message", "answering-ask-ids", "paywall-presentation", "onFeedback"]))
                ], 64);
              }), 128)),
              createBaseVNode("div", {
                ref_key: "bottom",
                ref: bottom
              }, null, 512)
            ])
          ])
        ], 2),
        !atBottom.value ? withDirectives((openBlock(), createBlock(_sfc_main$v, {
          key: 0,
          type: "button",
          variant: "secondary",
          size: "icon",
          "aria-label": unref(t)("agent.latest"),
          class: "ctv:absolute ctv:bottom-2 ctv:left-1/2 ctv:-translate-x-1/2 ctv:rounded-full ctv:shadow-md ctv:ring-1 ctv:ring-muted-foreground",
          onClick: scrollToLatest
        }, {
          default: withCtx(() => [..._cache[5] || (_cache[5] = [
            createBaseVNode("span", { class: "ctv:icon-[lucide--chevron-down] ctv:size-4" }, null, -1)
          ])]),
          _: 1
        }, 8, ["aria-label"])), [
          [
            _directive_tooltip,
            unref(buildTooltipConfig)(unref(t)("agent.latest")),
            void 0,
            { top: true }
          ]
        ]) : createCommentVNode("", true)
      ]);
    };
  }
});
const _hoisted_1$6 = { class: "ctv:flex ctv:h-full ctv:flex-col ctv:overflow-x-hidden ctv:overflow-y-auto ctv:px-4 ctv:py-8" };
const _hoisted_2$5 = { class: "ctv:my-auto ctv:flex ctv:shrink-0 ctv:flex-col ctv:items-center ctv:gap-8 ctv:text-center" };
const _hoisted_3$4 = { class: "ctv:flex ctv:flex-col ctv:items-center ctv:gap-4 ctv:pt-12" };
const _hoisted_4$3 = { class: "ctv:flex ctv:max-w-sm ctv:flex-col ctv:items-center ctv:text-base/snug ctv:font-semibold ctv:tracking-tight ctv:text-base-foreground @min-[570px]:text-2xl/snug" };
const _hoisted_5$2 = { class: "ctv:my-0" };
const _hoisted_6$2 = { class: "ctv:my-0" };
const _hoisted_7$2 = {
  "data-testid": "suggested-prompts",
  class: "ctv:mx-auto ctv:flex ctv:w-full ctv:max-w-[608px] ctv:shrink-0 ctv:flex-wrap ctv:gap-2 @min-[460px]:justify-center"
};
const _hoisted_8$2 = { class: "ctv:truncate" };
const _sfc_main$6 = /* @__PURE__ */ defineComponent({
  __name: "EmptyState",
  props: {
    userName: {}
  },
  emits: ["insert"],
  setup(__props, { emit: __emit }) {
    const emit = __emit;
    const { t, tm } = useI18n();
    const prompts = computed(() => tm("agent.suggestedPrompts"));
    const promptIcons = [
      "ctv:icon-[lucide--lightbulb]",
      "ctv:icon-[lucide--list]",
      "ctv:icon-[lucide--search]",
      "ctv:icon-[lucide--message-circle-warning]",
      "ctv:icon-[lucide--workflow]"
    ];
    return (_ctx, _cache) => {
      return openBlock(), createElementBlock("div", _hoisted_1$6, [
        createBaseVNode("div", _hoisted_2$5, [
          createBaseVNode("div", _hoisted_3$4, [
            _cache[0] || (_cache[0] = createBaseVNode("div", { class: "ctv:flex ctv:size-12 ctv:items-center ctv:justify-center ctv:rounded-xl ctv:border ctv:border-plum-600 ctv:bg-ink-700" }, [
              createBaseVNode("span", {
                class: "ctv:icon-[lucide--bot] ctv:size-6 ctv:text-brand-yellow drop-shadow-[0_0_12px_currentColor]",
                "aria-hidden": "true"
              })
            ], -1)),
            createBaseVNode("div", _hoisted_4$3, [
              createBaseVNode("p", _hoisted_5$2, toDisplayString(unref(t)("agent.greeting", { name: __props.userName ?? unref(t)("agent.friend") })), 1),
              createBaseVNode("p", _hoisted_6$2, toDisplayString(unref(t)("agent.greetingQuestion")), 1)
            ])
          ]),
          createBaseVNode("div", _hoisted_7$2, [
            (openBlock(true), createElementBlock(Fragment, null, renderList(prompts.value, (prompt, index) => {
              return openBlock(), createBlock(_sfc_main$v, {
                key: index,
                type: "button",
                variant: "secondary",
                size: "md",
                class: "ctv:w-full ctv:max-w-full ctv:min-w-0 ctv:justify-start ctv:rounded-full ctv:px-3 ctv:text-sm @min-[460px]:w-auto",
                onClick: ($event) => emit("insert", prompt)
              }, {
                default: withCtx(() => [
                  createBaseVNode("span", {
                    class: normalizeClass(
                      unref(cn)(
                        "ctv:size-3 ctv:shrink-0 ctv:text-muted-foreground",
                        promptIcons[index] ?? "ctv:icon-[lucide--sparkles]"
                      )
                    ),
                    "aria-hidden": "true"
                  }, null, 2),
                  createBaseVNode("span", _hoisted_8$2, toDisplayString(prompt), 1)
                ]),
                _: 2
              }, 1032, ["onClick"]);
            }), 128))
          ])
        ])
      ]);
    };
  }
});
const _hoisted_1$5 = { class: "ctv:flex ctv:h-12 ctv:shrink-0 ctv:items-center ctv:gap-2 ctv:border-b ctv:border-component-node-border ctv:px-4" };
const _hoisted_2$4 = {
  id: "agent-panel-title",
  class: "ctv:my-0 ctv:text-sm ctv:font-normal ctv:whitespace-nowrap ctv:text-base-foreground"
};
const _hoisted_3$3 = { class: "ctv:ml-auto ctv:flex ctv:items-center ctv:gap-2" };
const _sfc_main$5 = /* @__PURE__ */ defineComponent({
  __name: "PanelHeader",
  props: {
    isMaximized: { type: Boolean, default: false }
  },
  emits: ["newChat", "toggleSize", "close"],
  setup(__props, { emit: __emit }) {
    const emit = __emit;
    const { t } = useI18n();
    const sizeToggleIcon = computed(
      () => __props.isMaximized ? "ctv:icon-[lucide--minimize-2]" : "ctv:icon-[lucide--maximize-2]"
    );
    const sizeToggleLabel = computed(
      () => __props.isMaximized ? t("agent.minimize") : t("agent.maximize")
    );
    return (_ctx, _cache) => {
      const _directive_tooltip = resolveDirective("tooltip");
      return openBlock(), createElementBlock("header", _hoisted_1$5, [
        createBaseVNode("h1", _hoisted_2$4, toDisplayString(unref(t)("agent.title")), 1),
        createBaseVNode("div", _hoisted_3$3, [
          withDirectives((openBlock(), createBlock(_sfc_main$v, {
            variant: "muted-textonly",
            size: "icon",
            "aria-label": unref(t)("agent.newChat"),
            onClick: _cache[0] || (_cache[0] = ($event) => emit("newChat"))
          }, {
            default: withCtx(() => [..._cache[3] || (_cache[3] = [
              createBaseVNode("span", { class: "ctv:icon-[lucide--message-circle-plus] ctv:size-4" }, null, -1)
            ])]),
            _: 1
          }, 8, ["aria-label"])), [
            [
              _directive_tooltip,
              unref(buildTooltipConfig)(unref(t)("agent.newChat")),
              void 0,
              { bottom: true }
            ]
          ]),
          withDirectives((openBlock(), createBlock(_sfc_main$v, {
            variant: "muted-textonly",
            size: "icon",
            "aria-label": sizeToggleLabel.value,
            onClick: _cache[1] || (_cache[1] = ($event) => emit("toggleSize"))
          }, {
            default: withCtx(() => [
              createBaseVNode("span", {
                class: normalizeClass(unref(cn)(sizeToggleIcon.value, "ctv:size-4"))
              }, null, 2)
            ]),
            _: 1
          }, 8, ["aria-label"])), [
            [
              _directive_tooltip,
              unref(buildTooltipConfig)(sizeToggleLabel.value),
              void 0,
              { bottom: true }
            ]
          ]),
          withDirectives((openBlock(), createBlock(_sfc_main$v, {
            variant: "muted-textonly",
            size: "icon",
            "aria-label": unref(t)("agent.close"),
            onClick: _cache[2] || (_cache[2] = ($event) => emit("close"))
          }, {
            default: withCtx(() => [..._cache[4] || (_cache[4] = [
              createBaseVNode("span", { class: "ctv:icon-[lucide--x] ctv:size-4" }, null, -1)
            ])]),
            _: 1
          }, 8, ["aria-label"])), [
            [
              _directive_tooltip,
              unref(buildTooltipConfig)(unref(t)("agent.close")),
              void 0,
              { bottom: true }
            ]
          ])
        ])
      ]);
    };
  }
});
const _hoisted_1$4 = { class: "@container ctv:flex ctv:h-full ctv:flex-col ctv:overflow-hidden ctv:bg-base-background ctv:text-base-foreground" };
const _hoisted_2$3 = { class: "ctv:flex ctv:h-10 ctv:shrink-0 ctv:items-center ctv:px-2" };
const _hoisted_3$2 = ["aria-label"];
const _hoisted_4$2 = { class: "ctv:min-w-0 ctv:truncate" };
const _hoisted_5$1 = { class: "ctv:truncate" };
const _hoisted_6$1 = { class: "ctv:truncate" };
const _hoisted_7$1 = { class: "ctv:min-h-0 ctv:flex-1" };
const _hoisted_8$1 = { class: "ctv:shrink-0 ctv:py-3" };
const _hoisted_9 = { class: "ctv:mx-auto ctv:flex ctv:w-full ctv:max-w-[640px] ctv:flex-col ctv:gap-4 ctv:px-4" };
const _sfc_main$4 = /* @__PURE__ */ defineComponent({
  __name: "AgentPanel",
  props: {
    entries: {},
    userName: {},
    streaming: { type: Boolean, default: false },
    submitting: { type: Boolean, default: false },
    canAttach: { type: Boolean, default: false },
    canOpenAssets: { type: Boolean, default: false },
    canOpenEagle: { type: Boolean, default: false },
    isMaximized: { type: Boolean, default: false },
    selectionTags: { default: () => [] },
    nodeReferenceDisabledReason: {},
    availableWorkflows: { default: () => [] },
    selectWorkflowReference: { type: Function },
    savingReference: { type: Boolean, default: false },
    editableWorkflowId: {},
    activeTab: { default: null },
    workflowTabs: { default: () => [] },
    visibleTabPath: { default: null },
    selectingTabPath: { default: null },
    selectTab: { type: Function, default: async () => false },
    workflowDetached: { type: Boolean, default: false },
    getMentionNodes: { type: Function, default: () => [] },
    paywallPresentation: { default: () => DEFAULT_AGENT_PAYWALL_PRESENTATION },
    sessionId: { default: null },
    customTitle: {},
    historyGroups: {},
    editableTurnId: { default: null },
    answeringAskIds: { default: () => /* @__PURE__ */ new Set() }
  },
  emits: ["send", "stop", "attach", "openAssets", "openEagle", "selectNodes", "removeTag", "mentionPick", "requestWorkflowReferences", "removeWorkflowReference", "feedback", "paywallAction", "newChat", "toggleSize", "close", "openHistory", "selectHistory", "deleteHistory", "copyHistory", "renameHistory", "renameChat", "answerAsk", "openWorkflow", "openReferenceWorkflow"],
  setup(__props, { expose: __expose, emit: __emit }) {
    const emit = __emit;
    const showHistory = ref(false);
    function onNewChat() {
      showHistory.value = false;
      emit("newChat");
    }
    function onOpenHistory() {
      showHistory.value = true;
      emit("openHistory");
    }
    function onSelectHistory(id) {
      showHistory.value = false;
      emit("selectHistory", id);
    }
    const composerRef = ref();
    function onWorkflowTargetRequired() {
    }
    const { t } = useI18n();
    const sessionTitle = computed(() => {
      if (__props.customTitle) return __props.customTitle;
      const firstUser = __props.entries.find(
        (entry) => entry.role === "user"
      );
      return (firstUser == null ? void 0 : firstUser.text.trim().slice(0, 60)) || void 0;
    });
    const renaming = ref(false);
    const renameDraft = ref("");
    const renameInput = ref();
    const titleButton = ref();
    async function startRename() {
      var _a2, _b;
      renameDraft.value = sessionTitle.value ?? "";
      renaming.value = true;
      await nextTick();
      (_a2 = renameInput.value) == null ? void 0 : _a2.focus();
      (_b = renameInput.value) == null ? void 0 : _b.select();
    }
    async function exitRename() {
      var _a2;
      renaming.value = false;
      await nextTick();
      const button = (_a2 = titleButton.value) == null ? void 0 : _a2.$el;
      if (button instanceof HTMLButtonElement) button.focus();
    }
    function onRenameKeydown(event) {
      if (event.isComposing) return;
      if (event.key === "Enter") {
        event.preventDefault();
        commitRename();
      } else if (event.key === "Escape") {
        event.preventDefault();
        void exitRename();
      }
    }
    function commitRename() {
      if (!renaming.value) return;
      void exitRename();
      const title = renameDraft.value.trim();
      if (title !== "" && title !== sessionTitle.value) emit("renameChat", title);
    }
    function onDeleteChat() {
      if (__props.sessionId !== null) emit("deleteHistory", __props.sessionId);
    }
    function addAttachment(attachment) {
      var _a2;
      (_a2 = composerRef.value) == null ? void 0 : _a2.addAttachment(attachment);
    }
    function updateAttachment(id, patch) {
      var _a2;
      (_a2 = composerRef.value) == null ? void 0 : _a2.updateAttachment(id, patch);
    }
    function removeAttachment(id) {
      var _a2;
      (_a2 = composerRef.value) == null ? void 0 : _a2.removeAttachment(id);
    }
    function onComposerSend(text2, attachments, references) {
      if (references !== void 0) emit("send", text2, attachments, references);
      else emit("send", text2, attachments);
    }
    __expose({ addAttachment, updateAttachment, removeAttachment });
    return (_ctx, _cache) => {
      const _directive_tooltip = resolveDirective("tooltip");
      return openBlock(), createElementBlock("section", _hoisted_1$4, [
        createVNode(_sfc_main$5, {
          "is-maximized": __props.isMaximized,
          onNewChat,
          onToggleSize: _cache[0] || (_cache[0] = ($event) => emit("toggleSize")),
          onClose: _cache[1] || (_cache[1] = ($event) => emit("close"))
        }, null, 8, ["is-maximized"]),
        showHistory.value ? (openBlock(), createBlock(_sfc_main$r, {
          key: 0,
          groups: __props.historyGroups,
          class: "ctv:min-h-0 ctv:flex-1",
          onBack: _cache[2] || (_cache[2] = ($event) => showHistory.value = false),
          onSelect: onSelectHistory,
          onDelete: _cache[3] || (_cache[3] = ($event) => emit("deleteHistory", $event)),
          onCopyMarkdown: _cache[4] || (_cache[4] = ($event) => emit("copyHistory", $event)),
          onRename: _cache[5] || (_cache[5] = (id, title) => emit("renameHistory", id, title))
        }, null, 8, ["groups"])) : (openBlock(), createElementBlock(Fragment, { key: 1 }, [
          createBaseVNode("div", _hoisted_2$3, [
            withDirectives((openBlock(), createBlock(_sfc_main$v, {
              id: "agent-chat-history",
              type: "button",
              variant: "muted-textonly",
              size: "icon-sm",
              "aria-label": unref(t)("agent.showChatHistory"),
              class: "ctv:size-6 ctv:shrink-0",
              onClick: onOpenHistory
            }, {
              default: withCtx(() => [..._cache[24] || (_cache[24] = [
                createBaseVNode("span", { class: "ctv:icon-[lucide--history] ctv:size-4 ctv:shrink-0" }, null, -1)
              ])]),
              _: 1
            }, 8, ["aria-label"])), [
              [
                _directive_tooltip,
                unref(buildTooltipConfig)(unref(t)("agent.showChatHistory")),
                void 0,
                { bottom: true }
              ]
            ]),
            renaming.value ? (openBlock(), createBlock(_sfc_main$u, {
              key: 0,
              ref_key: "renameInput",
              ref: renameInput,
              modelValue: renameDraft.value,
              "onUpdate:modelValue": _cache[6] || (_cache[6] = ($event) => renameDraft.value = $event),
              type: "text",
              "aria-label": unref(t)("g.rename"),
              class: "ctv:h-6 ctv:flex-1 ctv:px-2 ctv:py-1 ctv:text-xs",
              onKeydown: onRenameKeydown,
              onBlur: commitRename
            }, null, 8, ["modelValue", "aria-label"])) : (openBlock(), createElementBlock("div", {
              key: 1,
              role: "group",
              "aria-label": unref(t)("agent.chatOptions"),
              class: "ctv:flex ctv:w-fit ctv:max-w-full ctv:min-w-0 ctv:items-center"
            }, [
              createVNode(_sfc_main$v, {
                ref_key: "titleButton",
                ref: titleButton,
                type: "button",
                variant: "muted-textonly",
                size: "sm",
                disabled: __props.sessionId === null,
                class: "ctv:min-w-0 ctv:justify-start ctv:text-left",
                onClick: startRename
              }, {
                default: withCtx(() => [
                  createBaseVNode("span", _hoisted_4$2, toDisplayString(sessionTitle.value || unref(t)("agent.newChatTitle")), 1)
                ]),
                _: 1
              }, 8, ["disabled"]),
              __props.sessionId ? (openBlock(), createBlock(unref(DropdownMenuRoot_default), { key: 0 }, {
                default: withCtx(() => [
                  createVNode(unref(DropdownMenuTrigger_default), { "as-child": "" }, {
                    default: withCtx(() => [
                      withDirectives((openBlock(), createBlock(_sfc_main$v, {
                        variant: "muted-textonly",
                        size: "icon-sm",
                        "aria-label": unref(t)("agent.chatOptions"),
                        class: "ctv:size-6 ctv:shrink-0"
                      }, {
                        default: withCtx(() => [..._cache[25] || (_cache[25] = [
                          createBaseVNode("span", { class: "ctv:icon-[lucide--chevron-down] ctv:size-3" }, null, -1)
                        ])]),
                        _: 1
                      }, 8, ["aria-label"])), [
                        [
                          _directive_tooltip,
                          unref(buildTooltipConfig)(unref(t)("agent.chatOptions")),
                          void 0,
                          { bottom: true }
                        ]
                      ])
                    ]),
                    _: 1
                  }),
                  createVNode(unref(DropdownMenuPortal_default), null, {
                    default: withCtx(() => [
                      createVNode(unref(DropdownMenuContent_default), {
                        side: "bottom",
                        align: "start",
                        "side-offset": 4,
                        class: "agent-scope ctv:z-1100 ctv:flex ctv:h-16 ctv:w-32 ctv:flex-col ctv:gap-1 ctv:rounded-xl ctv:bg-secondary-background ctv:p-1 ctv:shadow-lg"
                      }, {
                        default: withCtx(() => [
                          createVNode(unref(DropdownMenuItem_default), {
                            class: "ctv:flex ctv:h-6 ctv:w-full ctv:shrink-0 ctv:cursor-pointer ctv:items-center ctv:gap-1.5 ctv:rounded-lg ctv:px-1.5 ctv:py-1 ctv:text-xs ctv:text-base-foreground ctv:outline-none ctv:data-highlighted:bg-secondary-background-hover",
                            onSelect: startRename
                          }, {
                            default: withCtx(() => [
                              _cache[26] || (_cache[26] = createBaseVNode("span", { class: "ctv:icon-[lucide--pencil] ctv:size-4 ctv:shrink-0" }, null, -1)),
                              createBaseVNode("span", _hoisted_5$1, toDisplayString(unref(t)("g.rename")), 1)
                            ]),
                            _: 1
                          }),
                          createVNode(unref(DropdownMenuSeparator_default), { class: "ctv:relative ctv:h-0 ctv:w-full ctv:shrink-0 ctv:before:absolute ctv:before:inset-x-0 ctv:before:top-0 ctv:before:h-px ctv:before:bg-component-node-border" }),
                          createVNode(unref(DropdownMenuItem_default), {
                            class: "ctv:flex ctv:h-6 ctv:w-full ctv:shrink-0 ctv:cursor-pointer ctv:items-center ctv:gap-1.5 ctv:rounded-lg ctv:px-1.5 ctv:py-1 ctv:text-xs ctv:text-base-foreground ctv:outline-none ctv:data-highlighted:bg-secondary-background-hover ctv:data-highlighted:text-destructive-background",
                            onSelect: onDeleteChat
                          }, {
                            default: withCtx(() => [
                              _cache[27] || (_cache[27] = createBaseVNode("span", { class: "ctv:icon-[lucide--trash-2] ctv:size-4 ctv:shrink-0" }, null, -1)),
                              createBaseVNode("span", _hoisted_6$1, toDisplayString(unref(t)("g.delete")), 1)
                            ]),
                            _: 1
                          })
                        ]),
                        _: 1
                      })
                    ]),
                    _: 1
                  })
                ]),
                _: 1
              })) : createCommentVNode("", true)
            ], 8, _hoisted_3$2))
          ]),
          createBaseVNode("div", _hoisted_7$1, [
            !__props.entries.length ? (openBlock(), createBlock(_sfc_main$6, {
              key: 0,
              "user-name": __props.userName,
              onInsert: _cache[7] || (_cache[7] = ($event) => {
                var _a2;
                return (_a2 = composerRef.value) == null ? void 0 : _a2.insert($event);
              })
            }, null, 8, ["user-name"])) : (openBlock(), createBlock(_sfc_main$7, {
              key: 1,
              entries: __props.entries,
              "editable-turn-id": __props.editableTurnId,
              "answering-ask-ids": __props.answeringAskIds,
              "paywall-presentation": __props.paywallPresentation,
              onEditPrompt: _cache[8] || (_cache[8] = ($event) => {
                var _a2;
                return (_a2 = composerRef.value) == null ? void 0 : _a2.replaceDraft($event);
              }),
              onFeedback: _cache[9] || (_cache[9] = (id, vote) => emit("feedback", id, vote)),
              onAnswerAsk: _cache[10] || (_cache[10] = (askId, selection) => emit("answerAsk", askId, selection)),
              onOpenWorkflow: _cache[11] || (_cache[11] = (workflowId, workflowName) => emit("openWorkflow", workflowId, workflowName)),
              onOpenReferenceWorkflow: _cache[12] || (_cache[12] = (workflowId, workflowName) => emit("openReferenceWorkflow", workflowId, workflowName)),
              onPaywallAction: _cache[13] || (_cache[13] = ($event) => emit("paywallAction", $event))
            }, null, 8, ["entries", "editable-turn-id", "answering-ask-ids", "paywall-presentation"]))
          ])
        ], 64)),
        !showHistory.value ? (openBlock(), createElementBlock(Fragment, { key: 2 }, [
          renderSlot(_ctx.$slots, "instrument"),
          createBaseVNode("footer", _hoisted_8$1, [
            createBaseVNode("div", _hoisted_9, [
              createVNode(_sfc_main$n, {
                ref_key: "composerRef",
                ref: composerRef,
                streaming: __props.streaming,
                submitting: __props.submitting,
                "can-attach": __props.canAttach,
                "can-open-assets": __props.canOpenAssets,
                "can-open-eagle": __props.canOpenEagle,
                "selection-tags": __props.selectionTags,
                "node-reference-disabled-reason": __props.nodeReferenceDisabledReason,
                "select-workflow-reference": __props.selectWorkflowReference,
                "available-workflows": __props.availableWorkflows,
                "editable-workflow-id": __props.editableWorkflowId,
                "has-workflow-target": !__props.workflowDetached,
                "workflow-selecting": __props.selectingTabPath !== null || __props.savingReference,
                "get-mention-nodes": __props.getMentionNodes,
                onSend: onComposerSend,
                onStop: _cache[14] || (_cache[14] = ($event) => emit("stop")),
                onAttach: _cache[15] || (_cache[15] = ($event) => emit("attach")),
                onOpenAssets: _cache[16] || (_cache[16] = ($event) => emit("openAssets")),
                onOpenEagle: _cache[17] || (_cache[17] = ($event) => emit("openEagle")),
                onSelectNodes: _cache[18] || (_cache[18] = ($event) => emit("selectNodes")),
                onRemoveTag: _cache[19] || (_cache[19] = ($event) => emit("removeTag", $event)),
                onMentionPick: _cache[20] || (_cache[20] = ($event) => emit("mentionPick", $event)),
                onRequestWorkflowReferences: _cache[21] || (_cache[21] = ($event) => emit("requestWorkflowReferences")),
                onRemoveWorkflowReference: _cache[22] || (_cache[22] = ($event) => emit("removeWorkflowReference", $event)),
                onOpenReferenceWorkflow: _cache[23] || (_cache[23] = (workflowId, workflowName) => emit("openReferenceWorkflow", workflowId, workflowName)),
                onWorkflowTargetRequired
              }, null, 8, ["streaming", "submitting", "can-attach", "can-open-assets", "can-open-eagle", "selection-tags", "node-reference-disabled-reason", "select-workflow-reference", "available-workflows", "editable-workflow-id", "has-workflow-target", "workflow-selecting", "get-mention-nodes"]),
              createVNode(AgentFeedbackCaption)
            ])
          ])
        ], 64)) : createCommentVNode("", true)
      ]);
    };
  }
});
const _hoisted_1$3 = { class: "ctv:flex ctv:min-w-0 ctv:items-center ctv:gap-2" };
const _hoisted_2$2 = { class: "ctv:flex ctv:min-w-0 ctv:flex-col" };
const _hoisted_3$1 = { class: "ctv:text-sm ctv:font-medium ctv:wrap-break-word ctv:text-base-foreground" };
const _hoisted_4$1 = {
  key: 0,
  class: "ctv:text-sm ctv:wrap-break-word ctv:text-muted-foreground"
};
const _sfc_main$3 = /* @__PURE__ */ defineComponent({
  __name: "CanvasBanner",
  props: {
    accent: {}
  },
  setup(__props) {
    return (_ctx, _cache) => {
      return openBlock(), createElementBlock("div", {
        class: normalizeClass(
          unref(cn)(
            "ctv:pointer-events-auto ctv:relative ctv:flex ctv:items-center ctv:gap-12 ctv:rounded-lg ctv:border ctv:border-l-4 ctv:border-interface-stroke ctv:bg-interface-panel-surface ctv:p-4 ctv:shadow-interface",
            __props.accent
          )
        )
      }, [
        createBaseVNode("div", _hoisted_1$3, [
          renderSlot(_ctx.$slots, "icon"),
          createBaseVNode("div", _hoisted_2$2, [
            createBaseVNode("span", _hoisted_3$1, [
              renderSlot(_ctx.$slots, "title")
            ]),
            _ctx.$slots.description ? (openBlock(), createElementBlock("span", _hoisted_4$1, [
              renderSlot(_ctx.$slots, "description")
            ])) : createCommentVNode("", true)
          ])
        ]),
        renderSlot(_ctx.$slots, "actions")
      ], 2);
    };
  }
});
function calculatePositionExtents(items) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const item of items) {
    if (!item.pos || !item.size) continue;
    const x2 = item.pos[0];
    const y2 = item.pos[1];
    const width = item.size[0];
    const height = item.size[1];
    if (![x2, y2, width, height].every(Number.isFinite)) continue;
    minX = Math.min(minX, x2);
    minY = Math.min(minY, y2);
    maxX = Math.max(maxX, x2 + width);
    maxY = Math.max(maxY, y2 + height);
  }
  return minX === Infinity ? null : { minX, minY, maxX, maxY };
}
function createPositionBounds(items, padding) {
  if (!Number.isFinite(padding)) return null;
  const extents = calculatePositionExtents(items);
  if (!extents) return null;
  const { minX, minY, maxX, maxY } = extents;
  return [
    minX - padding,
    minY - padding,
    maxX - minX + padding * 2,
    maxY - minY + padding * 2
  ];
}
const SETTLE_MS = 1e3;
const useAgentGraphActivityStore = defineStore(
  "agentGraphActivity",
  () => {
    const state = ref({ phase: "idle" });
    const turnOpen = ref(false);
    const currentTurnId = ref(null);
    let settleTimer;
    function startTurn(turnId = null) {
      if (turnOpen.value && currentTurnId.value === turnId) return;
      const previous = state.value;
      const resumesCurrentTurn = currentTurnId.value === turnId && (previous.phase === "settling" || previous.phase === "complete");
      turnOpen.value = true;
      currentTurnId.value = turnId;
      if (settleTimer !== void 0) clearTimeout(settleTimer);
      settleTimer = void 0;
      if (resumesCurrentTurn) {
        state.value = { ...previous, phase: "running" };
        return;
      }
      state.value = { phase: "idle" };
    }
    function recordMaterialized(target, nodeIds) {
      if (nodeIds.length === 0) return;
      if (settleTimer !== void 0) clearTimeout(settleTimer);
      settleTimer = void 0;
      turnOpen.value = true;
      const current = state.value;
      const sameTarget = current.phase !== "idle" && current.workflowId === target.workflowId && current.rootGraphId === target.rootGraphId;
      const previous = sameTarget ? current.nodeIds : [];
      state.value = {
        phase: "running",
        ...target,
        nodeIds: [.../* @__PURE__ */ new Set([...previous, ...nodeIds])]
      };
    }
    function finishTurn() {
      turnOpen.value = false;
      if (state.value.phase !== "running") return;
      if (settleTimer !== void 0) clearTimeout(settleTimer);
      state.value = { ...state.value, phase: "settling" };
      settleTimer = setTimeout(() => {
        settleTimer = void 0;
        if (state.value.phase !== "settling") return;
        state.value = { ...state.value, phase: "complete" };
      }, SETTLE_MS);
    }
    function removeNodes(nodeIds) {
      if (state.value.phase === "idle" || nodeIds.length === 0) return;
      const removed = new Set(nodeIds);
      const remaining = state.value.nodeIds.filter((id) => !removed.has(id));
      state.value = remaining.length === 0 ? { phase: "idle" } : { ...state.value, nodeIds: remaining };
    }
    function dismiss() {
      if (settleTimer !== void 0) clearTimeout(settleTimer);
      settleTimer = void 0;
      currentTurnId.value = null;
      state.value = { phase: "idle" };
    }
    function resetWorkflow(workflowId) {
      if (state.value.phase !== "idle" && state.value.workflowId === workflowId)
        dismiss();
    }
    return {
      state,
      startTurn,
      recordMaterialized,
      finishTurn,
      removeNodes,
      dismiss,
      resetWorkflow
    };
  }
);
const _hoisted_1$2 = {
  key: 0,
  class: "ctv:pointer-events-none ctv:absolute ctv:inset-x-2 ctv:bottom-8 ctv:z-1100 ctv:flex ctv:justify-center"
};
const _hoisted_2$1 = { class: "ctv:flex ctv:min-w-0 ctv:items-center ctv:gap-1" };
const _sfc_main$2 = /* @__PURE__ */ defineComponent({
  __name: "AgentGraphActivityBar",
  props: {
    canvas: {}
  },
  setup(__props) {
    const { t } = useI18n();
    const activity = useAgentGraphActivityStore();
    const teleportTarget = ref(null);
    onMounted(() => {
      teleportTarget.value = document.querySelector(".graph-canvas-panel");
    });
    const visibleState = computed(() => {
      var _a2;
      const state = activity.state;
      if (state.phase === "idle" || !((_a2 = __props.canvas) == null ? void 0 : _a2.graph) || String(__props.canvas.graph.id) !== state.rootGraphId)
        return null;
      return state;
    });
    const isComplete = computed(() => {
      var _a2;
      return ((_a2 = visibleState.value) == null ? void 0 : _a2.phase) === "complete";
    });
    const presentation = computed(() => {
      var _a2;
      return {
        testId: isComplete.value ? "agent-graph-added-toast" : "agent-graph-activity-bar",
        accent: isComplete.value ? "ctv:border-l-success-background" : "ctv:border-l-base-foreground",
        iconClass: isComplete.value ? "ctv:icon-[lucide--check] ctv:text-success-background" : "ctv:icon-[lucide--loader-circle] ctv:text-muted-foreground ctv:motion-safe:animate-spin",
        title: isComplete.value ? t("agent.nodesAdded", ((_a2 = visibleState.value) == null ? void 0 : _a2.nodeIds.length) ?? 0) : t("agent.updatingGraph")
      };
    });
    const liveNodes = computed(() => {
      const state = visibleState.value;
      if (!state || !__props.canvas) return [];
      return state.nodeIds.flatMap((nodeId) => {
        const locator = createNodeLocatorId(null, nodeId);
        const node = getNodeByLocatorId(app.rootGraph, locator);
        return locator && (node == null ? void 0 : node.graph) === __props.canvas.graph ? [node] : [];
      });
    });
    function viewNodes() {
      const panel = document.querySelector(".graph-canvas-panel");
      if (!__props.canvas || !panel) return;
      const bounds = createPositionBounds(liveNodes.value, 40);
      if (!bounds) return;
      const canvasRect = __props.canvas.canvas.getBoundingClientRect();
      const panelRect = panel.getBoundingClientRect();
      __props.canvas.animateToBounds(bounds, {
        viewport: [
          panelRect.left - canvasRect.left,
          panelRect.top - canvasRect.top,
          panelRect.width,
          panelRect.height
        ]
      });
    }
    return (_ctx, _cache) => {
      return teleportTarget.value ? (openBlock(), createBlock(Teleport, {
        key: 0,
        to: teleportTarget.value
      }, [
        visibleState.value ? (openBlock(), createElementBlock("div", _hoisted_1$2, [
          createVNode(_sfc_main$3, {
            "data-testid": presentation.value.testId,
            role: "status",
            accent: presentation.value.accent,
            class: "ctv:max-w-full ctv:flex-wrap ctv:gap-3"
          }, createSlots({
            icon: withCtx(() => [
              createBaseVNode("i", {
                class: normalizeClass([presentation.value.iconClass, "ctv:size-4 ctv:shrink-0"]),
                "aria-hidden": "true"
              }, null, 2)
            ]),
            title: withCtx(() => [
              createTextVNode(toDisplayString(presentation.value.title), 1)
            ]),
            actions: withCtx(() => [
              createBaseVNode("div", _hoisted_2$1, [
                liveNodes.value.length > 0 ? (openBlock(), createBlock(_sfc_main$v, {
                  key: 0,
                  variant: "secondary",
                  size: "sm",
                  class: "ctv:whitespace-nowrap",
                  onClick: viewNodes
                }, {
                  default: withCtx(() => [
                    createTextVNode(toDisplayString(unref(t)("agent.viewAddedNodes", liveNodes.value.length)), 1)
                  ]),
                  _: 1
                })) : createCommentVNode("", true),
                isComplete.value ? (openBlock(), createBlock(_sfc_main$v, {
                  key: 1,
                  variant: "muted-textonly",
                  size: "icon",
                  class: "ctv:shrink-0",
                  "aria-label": unref(t)("agent.close"),
                  onClick: _cache[0] || (_cache[0] = ($event) => unref(activity).dismiss())
                }, {
                  default: withCtx(() => [..._cache[1] || (_cache[1] = [
                    createBaseVNode("i", {
                      class: "ctv:icon-[lucide--x] ctv:size-4",
                      "aria-hidden": "true"
                    }, null, -1)
                  ])]),
                  _: 1
                }, 8, ["aria-label"])) : createCommentVNode("", true)
              ])
            ]),
            _: 2
          }, [
            !isComplete.value ? {
              name: "description",
              fn: withCtx(() => [
                createTextVNode(toDisplayString(unref(t)("agent.editWhileWorking")), 1)
              ]),
              key: "0"
            } : void 0
          ]), 1032, ["data-testid", "accent"])
        ])) : createCommentVNode("", true)
      ], 8, ["to"])) : createCommentVNode("", true);
    };
  }
});
const vRekaZIndex = {};
const SPOTLIGHT_EDGE_INSET = 2;
function clampSpotlightRect(r, pad, viewport) {
  const left = Math.max(SPOTLIGHT_EDGE_INSET, r.left - pad);
  const top = Math.max(SPOTLIGHT_EDGE_INSET, r.top - pad);
  const right = Math.min(viewport.width - SPOTLIGHT_EDGE_INSET, r.right + pad);
  const bottom = Math.min(
    viewport.height - SPOTLIGHT_EDGE_INSET,
    r.bottom + pad
  );
  return {
    x: left,
    y: top,
    width: Math.max(0, right - left),
    height: Math.max(0, bottom - top)
  };
}
function clampSpotlight(r, pad, viewport) {
  const { x: x2, y: y2, width, height } = clampSpotlightRect(r, pad, viewport);
  return {
    left: `${x2}px`,
    top: `${y2}px`,
    width: `${width}px`,
    height: `${height}px`
  };
}
const _hoisted_1$1 = {
  key: 0,
  class: "agent-scope ctv:fixed ctv:inset-0"
};
const _hoisted_2 = ["aria-labelledby", "aria-describedby"];
const _hoisted_3 = { class: "ctv:flex ctv:flex-col ctv:gap-6" };
const _hoisted_4 = { class: "ctv:flex ctv:flex-col ctv:gap-2" };
const _hoisted_5 = { class: "ctv:m-0 ctv:text-xs/normal ctv:opacity-50" };
const _hoisted_6 = ["id"];
const _hoisted_7 = ["id"];
const _hoisted_8 = { class: "ctv:flex ctv:justify-end ctv:gap-3" };
const _sfc_main$1 = /* @__PURE__ */ defineComponent({
  __name: "OnboardingCoach",
  props: {
    steps: {},
    storageKey: {}
  },
  setup(__props) {
    const { active, index, step, isLast, next, finish } = useOnboarding(
      () => __props.steps,
      __props.storageKey
    );
    const titleId = useId$1();
    const bodyId = useId$1();
    const target = ref(null);
    const toolbar = ref(null);
    const card = ref(null);
    const bounds = useElementBounding(target);
    const toolbarBounds = useElementBounding(toolbar);
    const { width, height } = useWindowSize();
    let targetRetryTimer;
    function scheduleTargetRetry() {
      clearTimeout(targetRetryTimer);
      if (!active.value || target.value) return;
      targetRetryTimer = setTimeout(() => {
        resolveTargets();
        scheduleTargetRetry();
      }, 50);
    }
    function resolveTargets() {
      const nextTarget = active.value ? document.querySelector(step.value.target) : null;
      const nextToolbar = active.value && step.value.toolbarTarget ? document.querySelector(step.value.toolbarTarget) : null;
      if (target.value !== nextTarget) target.value = nextTarget;
      if (toolbar.value !== nextToolbar) toolbar.value = nextToolbar;
      bounds.update();
      toolbarBounds.update();
      scheduleTargetRetry();
    }
    const targetObserver = new MutationObserver(resolveTargets);
    targetObserver.observe(document.body, {
      childList: true,
      subtree: true
    });
    onBeforeUnmount(() => {
      targetObserver.disconnect();
      clearTimeout(targetRetryTimer);
    });
    watch(
      [active, step],
      async () => {
        await nextTick();
        resolveTargets();
      },
      { immediate: true, flush: "post" }
    );
    const middleware = computed(() => {
      var _a2, _b;
      const result = [
        offset({
          mainAxis: 16,
          crossAxis: ((_a2 = step.value) == null ? void 0 : _a2.placement) === "left-start" ? -16 : 0
        })
      ];
      if (((_b = step.value) == null ? void 0 : _b.placement) === "graph-bottom") {
        const bottom = toolbar.value ? toolbarBounds.top.value : bounds.bottom.value;
        result.push({
          name: "graphBottom",
          fn: ({ rects }) => ({
            x: rects.reference.x + (rects.reference.width - rects.floating.width) / 2,
            y: Math.min(bottom, rects.reference.y + rects.reference.height) - 16 - rects.floating.height
          })
        });
      }
      return [...result, shift({ padding: 8, crossAxis: true })];
    });
    const { floatingStyles, isPositioned } = useFloating(target, card, {
      strategy: "fixed",
      transform: false,
      placement: () => {
        var _a2, _b;
        return ((_a2 = step.value) == null ? void 0 : _a2.placement) === "left-center" ? "left" : ((_b = step.value) == null ? void 0 : _b.placement) === "left-end" ? "left-end" : "left-start";
      },
      middleware,
      whileElementsMounted: autoUpdate
    });
    const spotlightStyle = computed(
      () => clampSpotlight(
        new DOMRect(
          bounds.left.value,
          bounds.top.value,
          bounds.width.value,
          bounds.height.value
        ),
        0,
        { width: width.value, height: height.value }
      )
    );
    useEventListener(
      document,
      "keydown",
      (event) => {
        if (!active.value || !target.value || event.key !== "Escape") return;
        event.preventDefault();
        event.stopPropagation();
        finish();
      },
      { capture: true }
    );
    return (_ctx, _cache) => {
      return openBlock(), createBlock(Teleport, { to: "body" }, [
        unref(active) && target.value ? withDirectives((openBlock(), createElementBlock("div", _hoisted_1$1, [
          _cache[0] || (_cache[0] = createBaseVNode("div", { class: "ctv:absolute ctv:inset-0" }, null, -1)),
          createBaseVNode("div", {
            "aria-hidden": "true",
            "data-testid": "agent-coach-spotlight",
            style: normalizeStyle({ ...spotlightStyle.value }),
            class: "ctv:pointer-events-none ctv:absolute ctv:rounded-lg ctv:shadow-[0_0_0_9999px_var(--color-coach-scrim)]"
          }, null, 4),
          createVNode(unref(FocusScope_default), {
            "as-child": "",
            trapped: "",
            loop: ""
          }, {
            default: withCtx(() => [
              createBaseVNode("div", {
                ref_key: "card",
                ref: card,
                role: "dialog",
                "aria-modal": "true",
                "aria-labelledby": unref(titleId),
                "aria-describedby": unref(bodyId),
                tabindex: "-1",
                style: normalizeStyle({
                  ...unref(floatingStyles),
                  opacity: unref(isPositioned) ? 1 : 0
                }),
                class: normalizeClass(
                  unref(cn)(
                    "ctv:fixed ctv:box-border ctv:flex ctv:max-h-[calc(100vh-16px)] ctv:w-[307px] ctv:max-w-[calc(100vw-16px)] ctv:flex-col ctv:gap-3 ctv:overflow-y-auto ctv:rounded-2xl ctv:border ctv:bg-base-background ctv:p-4 ctv:font-inter ctv:text-base-foreground ctv:shadow-lg",
                    unref(index) < 2 ? "ctv:border-secondary-background" : "ctv:border-alpha-smoke-500-20"
                  )
                )
              }, [
                createBaseVNode("div", _hoisted_3, [
                  createBaseVNode("div", _hoisted_4, [
                    createBaseVNode("p", _hoisted_5, toDisplayString(_ctx.$t("agent.coachProgress", {
                      current: unref(index) + 1,
                      total: __props.steps.length
                    })), 1),
                    createBaseVNode("h3", {
                      id: unref(titleId),
                      class: "ctv:m-0 ctv:text-base/normal ctv:font-semibold"
                    }, toDisplayString(unref(step).title), 9, _hoisted_6),
                    createBaseVNode("p", {
                      id: unref(bodyId),
                      class: "ctv:m-0 ctv:text-sm/normal ctv:text-muted-foreground"
                    }, toDisplayString(unref(step).body), 9, _hoisted_7)
                  ]),
                  createBaseVNode("div", _hoisted_8, [
                    createVNode(_sfc_main$v, {
                      variant: "secondary",
                      size: "md",
                      onClick: unref(finish)
                    }, {
                      default: withCtx(() => [
                        createTextVNode(toDisplayString(_ctx.$t("agent.skip")), 1)
                      ]),
                      _: 1
                    }, 8, ["onClick"]),
                    createVNode(_sfc_main$v, {
                      variant: "inverted",
                      size: "md",
                      onClick: unref(next)
                    }, {
                      default: withCtx(() => [
                        createTextVNode(toDisplayString(_ctx.$t(unref(isLast) ? "onboardingCoachmarks.done" : "g.next")), 1)
                      ]),
                      _: 1
                    }, 8, ["onClick"])
                  ])
                ])
              ], 14, _hoisted_2)
            ]),
            _: 1
          })
        ])), [
          [unref(vRekaZIndex)]
        ]) : createCommentVNode("", true)
      ]);
    };
  }
});
const MAX_ATTACHMENT_BYTES = 20 * 1024 * 1024;
let stagedCount = 0;
function useAttachment(options) {
  function stage(name) {
    const id = `upload-${++stagedCount}:${name}`;
    options.stage({ id, name, ref: "", uploading: true });
    return id;
  }
  function isTooLarge(file) {
    var _a2, _b;
    const maxBytes = ((_a2 = options.maxBytes) == null ? void 0 : _a2.call(options, file)) ?? MAX_ATTACHMENT_BYTES;
    if (file.size <= maxBytes) return false;
    (_b = options.onError) == null ? void 0 : _b.call(
      options,
      i18n.global.t("agent.attachmentTooLarge", {
        name: file.name,
        limit: `${maxBytes / 1024 / 1024}MB`
      })
    );
    return true;
  }
  async function uploadStagedFile(id, file) {
    var _a2;
    options.update(id, {
      name: file.name,
      previewUrl: hasImageType(file) ? URL.createObjectURL(file) : void 0
    });
    try {
      const result = await options.upload(file);
      options.update(id, {
        ref: result.ref,
        ...result.url ? { previewUrl: result.url } : {},
        uploading: false
      });
      return true;
    } catch {
      reportError(new Error("Agent attachment upload failed"), {
        errorType: "agent_attachment_upload_failed"
      });
      (_a2 = options.onError) == null ? void 0 : _a2.call(
        options,
        i18n.global.t("agent.attachmentUploadFailed", { name: file.name })
      );
      options.remove(id);
      return false;
    }
  }
  async function addDeferredFile(name, resolve) {
    const id = stage(name);
    const file = await resolve();
    if (!file) {
      options.remove(id);
      return void 0;
    }
    if (isTooLarge(file)) {
      options.remove(id);
      return file;
    }
    await uploadStagedFile(id, file);
    return file;
  }
  async function addFiles(files) {
    for (const file of files) {
      if (isTooLarge(file)) continue;
      await uploadStagedFile(stage(file.name), file);
    }
  }
  return { addDeferredFile, addFiles };
}
function createAssistantMessage(id) {
  return {
    id,
    role: "assistant",
    parts: [],
    streaming: true,
    thinking: false
  };
}
function snapshotMessage(message) {
  return { ...message, parts: message.parts.map((part) => ({ ...part })) };
}
function createAgentEventTransport(message, emit) {
  let openText = null;
  let openThinking = null;
  let openThinkingStartedAt = 0;
  const tools = /* @__PURE__ */ new Map();
  let settled = false;
  let lastTabTargetKey;
  function closeOpenText() {
    if (openText) {
      openText.state = "done";
      openText = null;
    }
  }
  function openNewText() {
    const part = { type: "text", text: "", state: "streaming" };
    message.parts.push(part);
    openText = part;
    return part;
  }
  function closeOpenThinking() {
    if (openThinking) {
      openThinking.state = "done";
      const durationMs = Date.now() - openThinkingStartedAt;
      if (durationMs > 0) openThinking.durationMs = durationMs;
      openThinking = null;
    }
  }
  function openNewThinking() {
    const part = {
      type: "thinking",
      text: "",
      state: "streaming"
    };
    message.parts.push(part);
    openThinking = part;
    openThinkingStartedAt = Date.now();
    return part;
  }
  function ingest(event) {
    var _a2, _b;
    if (settled) return;
    switch (event.type) {
      case "agent_thinking":
        closeOpenText();
        message.thinking = true;
        (openThinking ?? openNewThinking()).text += event.data.delta;
        message.thinkingText = openThinking == null ? void 0 : openThinking.text;
        break;
      case "agent_tool_call": {
        closeOpenText();
        closeOpenThinking();
        message.thinking = false;
        message.thinkingText = void 0;
        let part = tools.get(event.data.tool_call_id);
        if (!part) {
          part = {
            type: "tool",
            callId: event.data.tool_call_id,
            name: event.data.tool_name,
            state: "streaming"
          };
          tools.set(event.data.tool_call_id, part);
          message.parts.push(part);
        }
        part.name = event.data.tool_name;
        if (event.data.status !== "running") {
          part.state = "done";
          part.ok = event.data.status === "success";
          part.durationMs = event.data.duration_ms;
        }
        break;
      }
      case "agent_active_tab": {
        const targetKey = `${event.data.workflow_id}\0${event.data.node_locator_id ?? ""}`;
        if (lastTabTargetKey === targetKey) return;
        lastTabTargetKey = targetKey;
        closeOpenText();
        closeOpenThinking();
        message.thinking = false;
        message.thinkingText = void 0;
        message.parts.push({
          type: "tabLink",
          workflowId: event.data.workflow_id,
          locatorId: event.data.node_locator_id,
          name: event.data.name
        });
        break;
      }
      case "agent_ask": {
        if (event.data.kind !== "run_approval") return;
        closeOpenText();
        closeOpenThinking();
        message.thinking = false;
        message.thinkingText = void 0;
        const part = {
          type: "runApproval",
          askId: event.data.ask_id,
          workflowId: ((_a2 = event.data.context) == null ? void 0 : _a2.workflow_id) || void 0,
          workflowName: ((_b = event.data.context) == null ? void 0 : _b.workflow_name) || void 0
        };
        message.parts.push(part);
        break;
      }
      case "agent_ask_resolved":
        message.parts = message.parts.filter(
          (part) => part.type !== "runApproval" || part.askId !== event.data.ask_id
        );
        break;
      case "agent_message_delta":
        closeOpenThinking();
        message.thinking = false;
        message.thinkingText = void 0;
        (openText ?? openNewText()).text += event.data.delta;
        break;
      case "agent_message_done":
        settle();
        return;
    }
    emit(snapshotMessage(message));
  }
  function settle() {
    if (settled) return;
    settled = true;
    closeOpenText();
    closeOpenThinking();
    message.thinking = false;
    message.thinkingText = void 0;
    message.streaming = false;
    emit(snapshotMessage(message));
  }
  return { ingest, settle };
}
function workflowReferenceUrl(id) {
  return `workflow://${encodeURIComponent(id).replaceAll("(", "%28").replaceAll(")", "%29")}`;
}
function serializeWorkflowReferences(text2, references) {
  return workflowReferenceParts(text2, references).map((part) => {
    if (part.type === "text") return part.text;
    const name = part.reference.name.replace(/[\\[\]]/g, "\\$&");
    return `[${name}](${workflowReferenceUrl(part.reference.id)})`;
  }).join("");
}
function parseWorkflowReferences(content, references) {
  const remaining = new Map(
    references.map((reference) => [
      workflowReferenceUrl(reference.id),
      { ...reference, textOffset: 0 }
    ])
  );
  const positioned = [];
  let text2 = "";
  let offset2 = 0;
  for (const match of content.matchAll(
    /\[((?:\\.|[^\]\\])*)\]\((workflow:\/\/[^\s)]+)\)/g
  )) {
    const reference = remaining.get(match[2]);
    if (!reference) continue;
    text2 += content.slice(offset2, match.index);
    positioned.push({
      ...reference,
      name: match[1].replace(/\\([\\[\]])/g, "$1"),
      textOffset: text2.length
    });
    remaining.delete(match[2]);
    offset2 = match.index + match[0].length;
  }
  return {
    text: text2 + content.slice(offset2),
    references: [...remaining.values(), ...positioned]
  };
}
function attachmentRefNames(value) {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    if (typeof entry !== "object" || entry === null || !("name" in entry))
      return [];
    const { name } = entry;
    return typeof name === "string" ? [name] : [];
  });
}
function parseUserAttachments(content) {
  const names = Array.isArray(content == null ? void 0 : content.attachments) ? content.attachments.filter(
    (name) => typeof name === "string"
  ) : attachmentRefNames(content == null ? void 0 : content.attachment_refs);
  const previews = content == null ? void 0 : content.attachment_previews;
  const labels = content == null ? void 0 : content.attachment_labels;
  return names.length > 0 ? names.map((name) => ({
    name: (labels == null ? void 0 : labels[name]) ?? name,
    ref: name,
    previewUrl: previews == null ? void 0 : previews[name]
  })) : void 0;
}
function parseUserWorkflowReferences(text2, rawReferences) {
  if (!Array.isArray(rawReferences)) return void 0;
  const references = rawReferences.flatMap((value) => {
    if (typeof value !== "object" || value === null || !("workflow_id" in value) || !("name" in value))
      return [];
    const { workflow_id: id, name } = value;
    return typeof id === "string" && typeof name === "string" ? [
      {
        id,
        name,
        ..."unavailable" in value && value.unavailable === true ? { unavailable: true } : {}
      }
    ] : [];
  });
  return references.length > 0 ? parseWorkflowReferences(text2, references) : void 0;
}
function normalizeAgentTranscript(history2) {
  var _a2, _b, _c, _d, _e2;
  const userTexts = /* @__PURE__ */ new Map();
  const userAttachments = /* @__PURE__ */ new Map();
  const userWorkflowReferences = /* @__PURE__ */ new Map();
  const assistants = /* @__PURE__ */ new Map();
  const turnOrder = [];
  const seenTurns = /* @__PURE__ */ new Set();
  const rowIds = /* @__PURE__ */ new Set();
  let pending2;
  let latestWorkflowId;
  for (const row of [...history2].sort((a, b2) => a.seq - b2.seq)) {
    const turnId = row.turn_id;
    rowIds.add(row.id);
    if (!seenTurns.has(turnId)) {
      seenTurns.add(turnId);
      turnOrder.push(turnId);
    }
    const text2 = typeof ((_a2 = row.content) == null ? void 0 : _a2.text) === "string" ? row.content.text : "";
    if (row.role === "user") {
      userTexts.set(turnId, text2);
      const attachments = parseUserAttachments(row.content);
      if (attachments) userAttachments.set(turnId, attachments);
      if (row.workflow_id) latestWorkflowId = row.workflow_id;
      const referenceUpdate = parseUserWorkflowReferences(
        text2,
        (_b = row.content) == null ? void 0 : _b.workflow_references
      );
      if (referenceUpdate) {
        userTexts.set(turnId, referenceUpdate.text);
        userWorkflowReferences.set(turnId, referenceUpdate.references);
      }
    }
    if (row.role === "assistant") {
      const message = assistants.get(turnId) ?? createAssistantMessage(turnId);
      message.streaming = false;
      if (text2)
        message.parts = [
          ...message.parts,
          { type: "text", text: text2, state: "done" }
        ];
      if (row.status === "streaming" && ((_c = row.pending_ask) == null ? void 0 : _c.kind) === "run_approval") {
        message.parts.push({
          type: "runApproval",
          askId: row.pending_ask.ask_id,
          workflowId: ((_d = row.pending_ask.context) == null ? void 0 : _d.workflow_id) || void 0,
          workflowName: ((_e2 = row.pending_ask.context) == null ? void 0 : _e2.workflow_name) || void 0
        });
        message.streaming = true;
        pending2 = {
          messageId: row.id,
          message
        };
      }
      assistants.set(turnId, message);
    }
  }
  const messages = turnOrder.map((turnId) => {
    const message = assistants.get(turnId) ?? createAssistantMessage(turnId);
    message.streaming = message === (pending2 == null ? void 0 : pending2.message);
    return message;
  });
  return {
    messages,
    userTexts,
    userAttachments,
    userWorkflowReferences,
    latestWorkflowId,
    rowIds,
    assistantTurnIds: new Set(assistants.keys()),
    pending: pending2
  };
}
const useAgentConversationStore = defineStore(
  "agentConversation",
  () => {
    const messages = ref([]);
    const activeTurnId = ref(null);
    const threadId = ref(null);
    const userTexts = ref(/* @__PURE__ */ new Map());
    const userAttachments = ref(/* @__PURE__ */ new Map());
    const userTags = ref(/* @__PURE__ */ new Map());
    const userWorkflowReferences = ref(/* @__PURE__ */ new Map());
    const latestWorkflowId = ref();
    let transport = null;
    let liveMessage = null;
    const backgroundTurns = /* @__PURE__ */ new Map();
    let hydratedMessageIds = /* @__PURE__ */ new Set();
    let hydratedAssistantTurnIds = /* @__PURE__ */ new Set();
    const activeIndex = ref(-1);
    function replaceActive(message) {
      var _a2;
      const index = activeIndex.value;
      if (index >= 0 && ((_a2 = messages.value[index]) == null ? void 0 : _a2.id) === message.id)
        messages.value[index] = message;
    }
    function recordUser(turnId, text2, attachments, tags, workflowReferences) {
      userTexts.value.set(turnId, text2);
      if (attachments !== void 0 && attachments.length > 0)
        userAttachments.value.set(turnId, attachments);
      if (tags !== void 0 && tags.length > 0)
        userTags.value.set(turnId, tags);
      if (workflowReferences !== void 0 && workflowReferences.length > 0)
        userWorkflowReferences.value.set(turnId, workflowReferences);
    }
    function setThreadId(id) {
      threadId.value = id;
    }
    function recordSettledReply(turnId, text2, parts) {
      userTexts.value.set(turnId, text2);
      const message = createAssistantMessage(turnId);
      message.streaming = false;
      message.parts = parts;
      messages.value.push(message);
    }
    function recordFailedSend(turnId, text2, noticeText, retryAfterSeconds) {
      recordSettledReply(turnId, text2, [
        { type: "notice", level: "error", text: noticeText, retryAfterSeconds }
      ]);
    }
    function recordPaywall(turnId, text2, message) {
      recordSettledReply(turnId, text2, [{ type: "paywall", message }]);
    }
    function startTurn(turnId) {
      if (transport) abortActiveTurn();
      const message = createAssistantMessage(turnId);
      liveMessage = message;
      activeTurnId.value = turnId;
      activeIndex.value = messages.value.push(message) - 1;
      transport = createAgentEventTransport(message, replaceActive);
    }
    function ingest(event) {
      var _a2;
      if (transport && event.data.message_id === activeTurnId.value) {
        if (event.type === "agent_message_done") {
          transport.settle();
          clearActive();
          return;
        }
        transport.ingest(event);
        return;
      }
      const eventThreadId = event.data.thread_id;
      if (event.type === "agent_active_tab" && event.data.message_id === void 0) {
        if (eventThreadId === void 0 || eventThreadId === threadId.value)
          transport == null ? void 0 : transport.ingest(event);
        else (_a2 = backgroundTurns.get(eventThreadId)) == null ? void 0 : _a2.transport.ingest(event);
        return;
      }
      if (eventThreadId === void 0) return;
      const entry = backgroundTurns.get(eventThreadId);
      if (!entry || entry.messageId !== event.data.message_id) return;
      if (event.type === "agent_message_done") {
        entry.transport.settle();
        entry.settled = true;
        return;
      }
      entry.transport.ingest(event);
    }
    function abortActiveTurn() {
      if (!transport) return;
      transport.settle();
      clearActive();
    }
    function stashActiveTurn() {
      if (!transport || liveMessage === null) return;
      if (threadId.value === null || activeTurnId.value === null) {
        abortActiveTurn();
        return;
      }
      backgroundTurns.set(threadId.value, {
        messageId: activeTurnId.value,
        message: liveMessage,
        transport,
        userText: userTexts.value.get(liveMessage.id),
        settled: false
      });
      clearActive();
    }
    function resumeBackgroundTurn() {
      if (threadId.value === null) return;
      const entry = backgroundTurns.get(threadId.value);
      if (!entry) return;
      backgroundTurns.delete(threadId.value);
      const kept = messages.value.filter((m2) => m2.id !== entry.message.id);
      const poppedHydratedCopy = removeHydratedCopy(entry, kept);
      if (entry.settled && !poppedHydratedCopy && hydratedMessageIds.has(entry.messageId))
        return;
      if (entry.userText !== void 0 && !userTexts.value.has(entry.message.id))
        userTexts.value.set(entry.message.id, entry.userText);
      const index = kept.push(entry.message) - 1;
      messages.value = kept;
      if (entry.settled) return;
      activeTurnId.value = entry.messageId;
      activeIndex.value = index;
      transport = entry.transport;
      liveMessage = entry.message;
    }
    function removeHydratedCopy(entry, kept) {
      if (kept.length !== messages.value.length) return false;
      const last = kept.at(-1);
      if (!last || hydratedAssistantTurnIds.has(last.id)) return false;
      if (entry.userText === void 0 || userTexts.value.get(last.id) !== entry.userText)
        return false;
      kept.pop();
      userTexts.value.delete(last.id);
      return true;
    }
    function settleBackgroundTurn(turnId) {
      for (const [key, entry] of backgroundTurns) {
        if (entry.messageId !== turnId) continue;
        entry.transport.settle();
        backgroundTurns.delete(key);
        return;
      }
    }
    function dropBackgroundTurns() {
      for (const entry of backgroundTurns.values()) entry.transport.settle();
      backgroundTurns.clear();
    }
    function clearActive() {
      transport = null;
      liveMessage = null;
      activeIndex.value = -1;
      activeTurnId.value = null;
    }
    function dropAttachmentPreviews() {
      for (const attachments of userAttachments.value.values()) {
        for (const { previewUrl } of attachments) {
          if (previewUrl == null ? void 0 : previewUrl.startsWith("blob:")) URL.revokeObjectURL(previewUrl);
        }
      }
      userAttachments.value = /* @__PURE__ */ new Map();
    }
    function reset() {
      messages.value = [];
      userTexts.value = /* @__PURE__ */ new Map();
      userTags.value = /* @__PURE__ */ new Map();
      userWorkflowReferences.value = /* @__PURE__ */ new Map();
      latestWorkflowId.value = void 0;
      dropAttachmentPreviews();
      threadId.value = null;
      hydratedMessageIds = /* @__PURE__ */ new Set();
      hydratedAssistantTurnIds = /* @__PURE__ */ new Set();
      clearActive();
    }
    function hydrate(history2) {
      clearActive();
      const transcript = normalizeAgentTranscript(history2);
      messages.value = transcript.messages;
      userTexts.value = transcript.userTexts;
      userTags.value = /* @__PURE__ */ new Map();
      userWorkflowReferences.value = transcript.userWorkflowReferences;
      latestWorkflowId.value = transcript.latestWorkflowId;
      hydratedMessageIds = transcript.rowIds;
      hydratedAssistantTurnIds = transcript.assistantTurnIds;
      dropAttachmentPreviews();
      userAttachments.value = transcript.userAttachments;
      if (transcript.pending) {
        liveMessage = transcript.pending.message;
        activeTurnId.value = transcript.pending.messageId;
        activeIndex.value = messages.value.indexOf(transcript.pending.message);
        transport = createAgentEventTransport(
          transcript.pending.message,
          replaceActive
        );
      }
    }
    const entries2 = computed(
      () => messages.value.flatMap((message) => {
        const text2 = userTexts.value.get(message.id);
        return text2 === void 0 ? [message] : [
          {
            id: message.id,
            role: "user",
            text: text2,
            attachments: userAttachments.value.get(message.id),
            tags: userTags.value.get(message.id),
            workflowReferences: userWorkflowReferences.value.get(message.id)
          },
          message
        ];
      })
    );
    const activeMessage = computed(
      () => activeIndex.value >= 0 ? messages.value[activeIndex.value] : null
    );
    const isStreaming = computed(() => {
      var _a2;
      return ((_a2 = activeMessage.value) == null ? void 0 : _a2.streaming) ?? false;
    });
    const status = computed(() => {
      const message = activeMessage.value;
      if (!(message == null ? void 0 : message.streaming)) return "idle";
      return message.thinking ? "thinking" : "streaming";
    });
    return {
      messages,
      entries: entries2,
      activeTurnId,
      threadId,
      isStreaming,
      status,
      latestWorkflowId,
      recordUser,
      setThreadId,
      recordFailedSend,
      recordPaywall,
      startTurn,
      ingest,
      abortActiveTurn,
      stashActiveTurn,
      resumeBackgroundTurn,
      settleBackgroundTurn,
      dropBackgroundTurns,
      reset,
      hydrate
    };
  }
);
function useAgentWorkflowResolver({
  workflows,
  bindings,
  listCloudWorkflows
}) {
  const cloudIndex = ref([]);
  let refreshGeneration = 0;
  const cloudIdsByName = computed(() => {
    const counts = /* @__PURE__ */ new Map();
    for (const { name } of cloudIndex.value)
      counts.set(name, (counts.get(name) ?? 0) + 1);
    return new Map(
      cloudIndex.value.flatMap(
        ({ id, name }) => counts.get(name) === 1 ? [[name, id]] : []
      )
    );
  });
  async function refreshCloudWorkflowIds() {
    const generation = ++refreshGeneration;
    try {
      const entries2 = await listCloudWorkflows();
      if (generation !== refreshGeneration) return false;
      cloudIndex.value = entries2.flatMap(
        ({ id, name }) => name === void 0 ? [] : [{ id, name }]
      );
      return true;
    } catch (error) {
      if (generation !== refreshGeneration) return false;
      reportError(error, {
        errorType: "agent_cloud_workflow_ids_refresh_failed"
      });
      return false;
    }
  }
  function forgetCloudWorkflowId(workflowId) {
    cloudIndex.value = cloudIndex.value.filter(({ id }) => id !== workflowId);
  }
  function cloudWorkflowName(workflow) {
    return workflow.suffix === "app.json" ? `${workflow.filename}.app` : workflow.filename;
  }
  function savedMatches(name, candidates) {
    return candidates.filter(
      (workflow) => !workflow.isTemporary && cloudWorkflowName(workflow) === name
    );
  }
  function cloudIdFor(workflow) {
    const name = cloudWorkflowName(workflow);
    const saved = !workflow.isTemporary && savedMatches(name, workflows.openWorkflows).length === 1 ? cloudIdsByName.value.get(name) : void 0;
    if (saved !== void 0) return saved;
    const bound = bindings.workflowIdFor(workflow.path);
    return bound !== void 0 && bindings.matchesWorkflow(bound, workflow) ? bound : void 0;
  }
  function indexedNameFor(workflowId) {
    for (const [name, id] of cloudIdsByName.value) {
      if (id === workflowId) return name;
    }
    return void 0;
  }
  function bindingIsStale(workflowId, bound) {
    if (bound.isTemporary) return false;
    const indexedName = indexedNameFor(workflowId);
    const boundName = cloudWorkflowName(bound);
    if (indexedName === void 0 || indexedName === boundName) return false;
    const boundId = cloudIdsByName.value.get(boundName);
    return boundId !== void 0 && boundId !== workflowId;
  }
  function resolveWorkflow(workflowId, nameCandidates) {
    const path = bindings.tabPathFor(workflowId);
    const bound = path === void 0 ? null : workflows.getWorkflowByPath(path);
    if (bound && bindings.matchesWorkflow(workflowId, bound)) {
      if (!bindingIsStale(workflowId, bound)) return bound;
      bindings.unbind(bound.path);
    }
    for (const [name, id] of cloudIdsByName.value) {
      if (id !== workflowId) continue;
      const matches = savedMatches(name, nameCandidates);
      return matches.length === 1 ? matches[0] : null;
    }
    return null;
  }
  function boundOrOpenWorkflowFor(workflowId) {
    return resolveWorkflow(workflowId, workflows.openWorkflows);
  }
  function storedWorkflowFor(workflowId) {
    return resolveWorkflow(workflowId, workflows.workflows);
  }
  function openWorkflowFor(workflowId) {
    return workflows.openWorkflows.find(
      (workflow) => cloudIdFor(workflow) === workflowId
    ) ?? null;
  }
  const availableWorkflowReferences = computed(
    () => {
      const seenIds = /* @__PURE__ */ new Set();
      const open = [];
      for (const workflow of workflows.openWorkflows) {
        const id = cloudIdFor(workflow);
        const name = cloudWorkflowName(workflow);
        if (id !== void 0) {
          if (seenIds.has(id)) continue;
          seenIds.add(id);
          open.push({ id, name });
        } else if (workflow.isTemporary) {
          open.push({ tabPath: workflow.path, name });
        }
      }
      const saved = cloudIndex.value.filter(({ id }) => {
        if (seenIds.has(id)) return false;
        seenIds.add(id);
        return true;
      });
      return [
        ...open.toSorted((a, b2) => a.name.localeCompare(b2.name)),
        ...saved.toSorted((a, b2) => a.name.localeCompare(b2.name))
      ];
    }
  );
  function openTabsSnapshot() {
    const openTabs = workflows.openWorkflows.flatMap((workflow) => {
      const id = cloudIdFor(workflow);
      return id === void 0 ? [] : [{ workflow_id: id, name: cloudWorkflowName(workflow) }];
    });
    return openTabs.length > 0 ? { open_tabs: openTabs } : void 0;
  }
  function nextSaveFilename(workflow) {
    const names = /* @__PURE__ */ new Set([
      ...cloudIndex.value.map(({ name }) => name),
      ...workflows.workflows.filter((candidate) => candidate.path !== workflow.path).map(cloudWorkflowName)
    ]);
    const appSuffix = workflow.initialMode === "app" ? ".app" : "";
    const stem = workflow.filename.replace(/ \(\d+\)$/, "");
    let filename = workflow.filename;
    let counter = 2;
    while (names.has(`${filename}${appSuffix}`))
      filename = `${stem} (${counter++})`;
    return filename;
  }
  return {
    refreshCloudWorkflowIds,
    forgetCloudWorkflowId,
    cloudIdFor,
    cloudWorkflowName,
    boundOrOpenWorkflowFor,
    storedWorkflowFor,
    openWorkflowFor,
    availableWorkflowReferences,
    openTabsSnapshot,
    nextSaveFilename
  };
}
function useAgentWorkflowSelection({
  resolver,
  canSelectTarget,
  warnWorkflowUnavailable
}) {
  const workflowStore = useWorkflowStore();
  const workflowService = useWorkflowService();
  const bindingStore = useAgentWorkflowTabBindingStore();
  const panelStore = useAgentPanelStore();
  const { selectedWorkflow: selectedTarget, canRestoreWorkflow } = storeToRefs(panelStore);
  const composerStore = useAgentComposerStore();
  const { workflowReferences } = storeToRefs(composerStore);
  const { t } = useI18n();
  const toast = useToastStore();
  const {
    refreshCloudWorkflowIds,
    cloudIdFor,
    cloudWorkflowName,
    nextSaveFilename,
    boundOrOpenWorkflowFor
  } = resolver;
  const editableWorkflowId = computed(
    () => selectedTarget.value ? cloudIdFor(selectedTarget.value) : void 0
  );
  let composerContextGeneration = 0;
  const workflowSelection = ref(null);
  const selectingTarget = computed(
    () => {
      var _a2;
      return ((_a2 = workflowSelection.value) == null ? void 0 : _a2.purpose) === "target" ? workflowSelection.value.workflow : null;
    }
  );
  const savingReference = computed(
    () => {
      var _a2;
      return ((_a2 = workflowSelection.value) == null ? void 0 : _a2.purpose) === "reference";
    }
  );
  let targetSelectionGeneration = 0;
  function commitWorkflowTarget(workflow, workflowId) {
    bindingStore.bind(workflowId, workflow.path);
    panelStore.setWorkflowTarget(workflow);
    composerStore.removeWorkflowReference(workflowId);
  }
  async function prepareWorkflowSelection(tab, isCurrent) {
    function fail(detail) {
      if (isCurrent()) warnWorkflowSelectionFailed(detail);
      return void 0;
    }
    try {
      if (tab.isTemporary && cloudIdFor(tab) === void 0) {
        if (!await refreshCloudWorkflowIds()) return fail();
        if (!isCurrent()) return;
        const filename = nextSaveFilename(tab);
        if (!await workflowService.saveWorkflowAs(tab, { filename }))
          return fail();
      }
      if (!isCurrent()) return;
      let workflowId = cloudIdFor(tab);
      if (workflowId === void 0) {
        if (!await refreshCloudWorkflowIds()) return fail();
        if (!isCurrent()) return;
        workflowId = cloudIdFor(tab);
      }
      if (workflowId === void 0) warnWorkflowUnavailable();
      return workflowId;
    } catch (error) {
      return fail(error instanceof Error ? error.message : void 0);
    }
  }
  function warnWorkflowSelectionFailed(detail = t("shareWorkflow.saveFailedDescription")) {
    toast.add({
      severity: "warn",
      summary: t("shareWorkflow.saveFailedTitle"),
      detail
    });
  }
  async function onSelectWorkflowTarget(path) {
    const tab = workflowStore.getWorkflowByPath(path);
    if (!tab || workflowSelection.value || !canSelectTarget()) return false;
    workflowSelection.value = { purpose: "target", workflow: tab };
    const generation = ++targetSelectionGeneration;
    const isCurrent = () => generation === targetSelectionGeneration && workflowStore.openWorkflows.includes(tab);
    try {
      const workflowId = await prepareWorkflowSelection(tab, isCurrent);
      if (workflowId === void 0 || !isCurrent()) return false;
      if (!await workflowService.openWorkflow(tab)) {
        if (isCurrent())
          warnWorkflowSelectionFailed(t("agent.targetNavigationUnavailable"));
        return false;
      }
      if (!isCurrent()) return false;
      commitWorkflowTarget(tab, workflowId);
      return true;
    } catch (error) {
      if (isCurrent())
        warnWorkflowSelectionFailed(
          error instanceof Error ? error.message : void 0
        );
      return false;
    } finally {
      workflowSelection.value = null;
    }
  }
  async function onSelectWorkflowReference(option) {
    if (workflowSelection.value) return void 0;
    if (option.id !== void 0) {
      if (option.id === editableWorkflowId.value || workflowReferences.value.some(({ id }) => id === option.id))
        return void 0;
      return option;
    }
    const tab = workflowStore.getWorkflowByPath(option.tabPath);
    if (!tab || !workflowStore.openWorkflows.includes(tab)) return void 0;
    workflowSelection.value = { purpose: "reference", workflow: tab };
    const generation = composerContextGeneration;
    const isCurrent = () => generation === composerContextGeneration && workflowStore.openWorkflows.includes(tab);
    try {
      const workflowId = await prepareWorkflowSelection(tab, isCurrent);
      if (workflowId === void 0 || !isCurrent()) return void 0;
      if (workflowId === editableWorkflowId.value || workflowReferences.value.some(({ id }) => id === workflowId))
        return void 0;
      bindingStore.bind(workflowId, tab.path);
      return {
        id: workflowId,
        name: cloudWorkflowName(tab)
      };
    } catch (error) {
      if (isCurrent())
        warnWorkflowSelectionFailed(
          error instanceof Error ? error.message : void 0
        );
      return void 0;
    } finally {
      workflowSelection.value = null;
    }
  }
  function onRequestWorkflowReferences() {
    if (!workflowSelection.value) void refreshCloudWorkflowIds();
  }
  async function onWorkflowRestored(workflowId, isSessionCurrent) {
    if (!canRestoreWorkflow.value || !isSessionCurrent()) return;
    const generation = ++targetSelectionGeneration;
    const isCurrent = () => generation === targetSelectionGeneration && isSessionCurrent() && canRestoreWorkflow.value;
    if (workflowId === void 0) {
      panelStore.setWorkflowTarget(workflowStore.activeWorkflow);
      return;
    }
    await refreshCloudWorkflowIds();
    if (!isCurrent()) return;
    const target = boundOrOpenWorkflowFor(workflowId);
    if (target === null) {
      panelStore.setWorkflowTarget(null);
      warnWorkflowUnavailable();
      return;
    }
    try {
      const opened = await workflowService.openWorkflow(target);
      if (!isCurrent()) return;
      if (!opened) {
        panelStore.setWorkflowTarget(null);
        warnWorkflowUnavailable();
        return;
      }
      commitWorkflowTarget(target, workflowId);
    } catch {
      if (!isCurrent()) return;
      warnWorkflowUnavailable();
    }
  }
  function cancelSelection() {
    ++composerContextGeneration;
    ++targetSelectionGeneration;
  }
  onScopeDispose(cancelSelection);
  return {
    isSelecting: computed(() => workflowSelection.value !== null),
    selectingTarget,
    savingReference,
    selectTarget: onSelectWorkflowTarget,
    selectReference: onSelectWorkflowReference,
    restoreTarget: onWorkflowRestored,
    requestReferences: onRequestWorkflowReferences,
    cancelSelection
  };
}
const randomStorage = new Uint32Array(31);
class UuidGenerationError extends Error {
  constructor(message) {
    super(message);
    this.name = "UuidGenerationError";
  }
}
function getWebCrypto() {
  return globalThis.crypto;
}
function createUuidv4() {
  const webCrypto = getWebCrypto();
  if (typeof (webCrypto == null ? void 0 : webCrypto.randomUUID) === "function") {
    return webCrypto.randomUUID();
  }
  if (typeof (webCrypto == null ? void 0 : webCrypto.getRandomValues) === "function") {
    const random = webCrypto.getRandomValues(randomStorage);
    let i = 0;
    return "10000000-1000-4000-8000-100000000000".replaceAll(
      /[018]/g,
      (a) => (Number(a) ^ random[i++] * 3725290298461914e-24 >> Number(a) * 0.25).toString(16)
    );
  }
  throw new UuidGenerationError("Web Crypto is required to generate a UUID");
}
const THREAD_STORAGE_KEY = "ComfyTV.Agent.ThreadId";
const PREPARE_TIMEOUT_MS = 3e3;
let sessionGeneration = 0;
let rememberedWorkflowId = null;
function parseAdmissionError(error) {
  if (!(error instanceof AgentApiError)) return void 0;
  const parsed = zAgentAdmissionError.safeParse(error.body);
  if (!parsed.success) return void 0;
  const expectedStatus = parsed.data.error.type === "PAYMENT_REQUIRED" ? 402 : 503;
  if (error.status !== expectedStatus) return void 0;
  return { ...parsed.data.error, retryAfterSeconds: error.retryAfterSeconds };
}
function disownsWorkflow(error) {
  return error instanceof AgentApiError && error.status === 403 && zDisownedWorkflowError.safeParse(error.body).success;
}
function useAgentSession(deps) {
  const { rest, events, workflow } = deps;
  const conversationStore = useAgentConversationStore();
  const bindingStore = useAgentWorkflowTabBindingStore();
  const boundWorkflowId = ref(rememberedWorkflowId);
  const notices = ref([]);
  const promptEditState = ref({ phase: "idle" });
  const sending = ref(false);
  const answeringAskIds = ref(/* @__PURE__ */ new Set());
  function setAskAnswering(askId, answering) {
    const next = new Set(answeringAskIds.value);
    if (answering) next.add(askId);
    else next.delete(askId);
    answeringAskIds.value = next;
  }
  function nextLocalErrorId() {
    return toTurnId(`local-error-${createUuidv4()}`);
  }
  let unsubscribe = null;
  let unsubscribeStatus = null;
  let ownedGeneration = 0;
  let everLive = false;
  function pushError(text2) {
    notices.value.push({ level: "error", text: text2 });
  }
  function start() {
    ownedGeneration = ++sessionGeneration;
    everLive = false;
    if (conversationStore.threadId === null && localStorage.getItem(THREAD_STORAGE_KEY) === null) {
      rememberedWorkflowId = null;
      boundWorkflowId.value = null;
    }
    unsubscribe = events.subscribe(onRaw);
    if (events.onStatus) unsubscribeStatus = events.onStatus(onStatus);
    const surviving = conversationStore.threadId;
    if (surviving !== null) {
      const generation = ++loadGeneration;
      const isCurrent = () => generation === loadGeneration && ownedGeneration === sessionGeneration;
      conversationStore.stashActiveTurn();
      void hydrateFromServer(surviving, isCurrent).then(() => {
        if (isCurrent() && conversationStore.threadId === surviving)
          conversationStore.resumeBackgroundTurn();
      });
      return;
    }
    if (conversationStore.messages.length === 0) {
      const stored = localStorage.getItem(THREAD_STORAGE_KEY);
      if (stored !== null) {
        const generation = ++loadGeneration;
        conversationStore.setThreadId(stored);
        void hydrateFromServer(
          stored,
          () => generation === loadGeneration && ownedGeneration === sessionGeneration
        );
      }
    }
  }
  async function hydrateFromServer(threadId, isCurrent = () => true) {
    var _a2;
    try {
      const history2 = await rest.getMessages(threadId);
      if (conversationStore.threadId !== threadId || !isCurrent()) return false;
      conversationStore.hydrate(history2);
      await ((_a2 = workflow == null ? void 0 : workflow.restored) == null ? void 0 : _a2.call(workflow, conversationStore.latestWorkflowId, isCurrent));
      if (conversationStore.threadId !== threadId || !isCurrent()) return false;
      return true;
    } catch (error) {
      if (!isCurrent()) return false;
      if (error instanceof AgentApiError && error.status === 404) {
        if (conversationStore.threadId === threadId)
          conversationStore.setThreadId(null);
        localStorage.removeItem(THREAD_STORAGE_KEY);
        return false;
      }
      pushError(error instanceof Error ? error.message : String(error));
      return false;
    }
  }
  function stop() {
    unsubscribe == null ? void 0 : unsubscribe();
    unsubscribeStatus == null ? void 0 : unsubscribeStatus();
    unsubscribe = null;
    unsubscribeStatus = null;
    const stoppedGeneration = ownedGeneration;
    queueMicrotask(() => {
      if (stoppedGeneration !== sessionGeneration) return;
      conversationStore.abortActiveTurn();
      conversationStore.dropBackgroundTurns();
    });
  }
  async function prepareWorkflow() {
    if (!(workflow == null ? void 0 : workflow.prepare)) return;
    await Promise.race([
      workflow.prepare().catch(() => void 0),
      new Promise((resolve) => setTimeout(resolve, PREPARE_TIMEOUT_MS))
    ]);
  }
  function recordUnavailableTarget(text2) {
    conversationStore.recordFailedSend(
      nextLocalErrorId(),
      text2,
      i18n.global.t("agent.targetNavigationUnavailable")
    );
  }
  function postTurn(threadId, text2, origin, wfContext, attachments, tags, workflowReferences) {
    const input = buildPostInput(
      threadId,
      text2,
      origin,
      wfContext,
      attachments,
      tags,
      workflowReferences
    );
    if ((wfContext == null ? void 0 : wfContext.id) === void 0) return rest.postMessage(threadId, input);
    return rest.postMessage(threadId, { ...input, workflowId: wfContext.id });
  }
  function buildPostInput(threadId, text2, origin, wfContext, attachments, tags, workflowReferences) {
    var _a2, _b;
    const draft = (_a2 = workflow == null ? void 0 : workflow.draft) == null ? void 0 : _a2.call(workflow, origin);
    return {
      content: serializeWorkflowReferences(text2, workflowReferences ?? []),
      tabs: (_b = workflow == null ? void 0 : workflow.tabs) == null ? void 0 : _b.call(workflow, origin),
      workflowReferences: serializeReferencedWorkflows(
        workflowReferences,
        wfContext == null ? void 0 : wfContext.id
      ),
      selection: selectedNodes(tags),
      attachments: attachments == null ? void 0 : attachments.map((attachment) => attachment.ref),
      ...canSendDraft(threadId, wfContext, draft) ? { draft } : {}
    };
  }
  function serializeReferencedWorkflows(references, currentWorkflowId) {
    return (references ?? []).filter((reference) => reference.id !== currentWorkflowId).map((reference) => ({
      workflow_id: reference.id,
      name: reference.name
    }));
  }
  function selectedNodes(tags) {
    if (tags === void 0 || tags.length === 0) return void 0;
    return { node_ids: tags.map((tag) => tag.id) };
  }
  function canSendDraft(threadId, wfContext, draft) {
    if (draft === void 0) return false;
    return threadId === "new" || (wfContext == null ? void 0 : wfContext.id) !== void 0;
  }
  function acceptTurn(ack, text2, wfContext, attachments, tags, workflowReferences) {
    conversationStore.setThreadId(ack.thread_id);
    localStorage.setItem(THREAD_STORAGE_KEY, ack.thread_id);
    if (ack.workflow_id !== void 0) {
      const boundAtAck = boundWorkflowId.value;
      bindWorkflow(ack.workflow_id);
      const shouldAdopt = (wfContext == null ? void 0 : wfContext.id) !== void 0 || ack.workflow_id !== boundAtAck && bindingStore.tabPathFor(ack.workflow_id) === void 0;
      if (shouldAdopt) workflow == null ? void 0 : workflow.adopted(ack.workflow_id, wfContext);
    }
    const turnId = ack.message_id;
    conversationStore.recordUser(
      turnId,
      text2,
      attachments == null ? void 0 : attachments.map(({ name, previewUrl, ref: ref2 }) => ({
        name,
        previewUrl,
        ref: ref2
      })),
      tags == null ? void 0 : tags.map((tag) => `${tag.title} #${tag.id}`),
      workflowReferences
    );
    conversationStore.startTurn(turnId);
    if (wasStopRequestedWhileSending()) {
      stopRequestedWhileSending.value = false;
      void stopTurn();
    }
  }
  function recordSendError(error, text2) {
    const admission = parseAdmissionError(error);
    if ((admission == null ? void 0 : admission.reason) === "no_funds") {
      conversationStore.recordPaywall(
        nextLocalErrorId(),
        text2,
        admission.message
      );
      return;
    }
    if (admission !== void 0) {
      conversationStore.recordFailedSend(
        nextLocalErrorId(),
        text2,
        admission.message,
        admission.reason === "funds_unavailable" ? admission.retryAfterSeconds : void 0
      );
      return;
    }
    const message = error instanceof AgentApiError ? error.message : error instanceof Error ? error.message : String(error);
    conversationStore.recordFailedSend(
      nextLocalErrorId(),
      text2,
      `${i18n.global.t("agent.sendFailed")}: ${message}`
    );
  }
  function releaseDisownedWorkflow(sent, error) {
    var _a2;
    if ((sent == null ? void 0 : sent.id) === void 0 || !disownsWorkflow(error)) return;
    bindingStore.unbindWorkflow(sent.id);
    (_a2 = workflow == null ? void 0 : workflow.disowned) == null ? void 0 : _a2.call(workflow, sent.id);
    if (boundWorkflowId.value === sent.id) boundWorkflowId.value = null;
    if (rememberedWorkflowId === sent.id) rememberedWorkflowId = null;
  }
  async function performSend(text2, attachments, tags, workflowReferences) {
    const generation = loadGeneration;
    const threadAtSend = conversationStore.threadId ?? "new";
    const originContext = workflow == null ? void 0 : workflow.current();
    const origin = originContext === void 0 ? null : { tabPath: originContext.tabPath };
    let sentContext;
    try {
      await prepareWorkflow();
      if (generation !== loadGeneration) return false;
      const wfContext = workflow == null ? void 0 : workflow.current(origin);
      if (workflowTargetChanged(originContext, wfContext)) {
        recordUnavailableTarget(text2);
        return false;
      }
      sentContext = wfContext;
      const ack = await postTurn(
        threadAtSend,
        text2,
        origin,
        wfContext,
        attachments,
        tags,
        workflowReferences
      );
      if (generation !== loadGeneration) return false;
      acceptTurn(ack, text2, wfContext, attachments, tags, workflowReferences);
      return true;
    } catch (error) {
      releaseDisownedWorkflow(sentContext, error);
      if (generation !== loadGeneration) return false;
      recordSendError(error, text2);
      return false;
    }
  }
  function workflowTargetChanged(origin, current) {
    if ((origin == null ? void 0 : origin.id) === void 0) return false;
    return (current == null ? void 0 : current.id) !== origin.id;
  }
  async function sendMessage(text2, attachments, tags, workflowReferences) {
    if (sending.value) {
      conversationStore.recordFailedSend(
        nextLocalErrorId(),
        text2,
        i18n.global.t("agent.sendBusy")
      );
      return false;
    }
    promptEditState.value = { phase: "idle" };
    sending.value = true;
    stopRequestedWhileSending.value = false;
    try {
      return await performSend(text2, attachments, tags, workflowReferences);
    } finally {
      sending.value = false;
    }
  }
  const stopRequestedWhileSending = ref(false);
  const wasStopRequestedWhileSending = () => stopRequestedWhileSending.value;
  async function stopTurn() {
    const threadId = conversationStore.threadId;
    const turnId = conversationStore.activeTurnId;
    if (threadId === null || turnId === null) {
      if (sending.value) stopRequestedWhileSending.value = true;
      return;
    }
    promptEditState.value = { phase: "stopping", turnId };
    try {
      await rest.cancelMessage(threadId, turnId);
    } catch (error) {
      if (error instanceof AgentApiError) {
        if (error.status === 409) return;
        promptEditState.value = { phase: "idle" };
        pushError(error.message);
        return;
      }
      promptEditState.value = { phase: "idle" };
      pushError(error instanceof Error ? error.message : String(error));
    }
  }
  async function answerAsk(askId, selection) {
    const currentThreadId = conversationStore.threadId;
    const messageId = conversationStore.activeTurnId;
    if (currentThreadId === null || messageId === null || answeringAskIds.value.has(askId))
      return;
    setAskAnswering(askId, true);
    try {
      await rest.answerAsk(currentThreadId, askId, [selection]);
    } catch (error) {
      setAskAnswering(askId, false);
      if (error instanceof AgentApiError && error.status === 409) {
        conversationStore.ingest({
          type: "agent_ask_resolved",
          data: {
            thread_id: currentThreadId,
            message_id: messageId,
            ask_id: askId,
            status: "answered",
            selected: null
          }
        });
        return;
      }
      reportError(error, { errorType: "agent_ask_answer_failed" });
      pushError(error instanceof Error ? error.message : String(error));
    }
  }
  let loadGeneration = 0;
  function newChat() {
    loadGeneration++;
    promptEditState.value = { phase: "idle" };
    conversationStore.stashActiveTurn();
    conversationStore.reset();
    boundWorkflowId.value = null;
    rememberedWorkflowId = null;
    localStorage.removeItem(THREAD_STORAGE_KEY);
  }
  function listThreads() {
    return rest.listThreads();
  }
  async function loadThread(threadId) {
    const generation = ++loadGeneration;
    promptEditState.value = { phase: "idle" };
    const isCurrent = () => generation === loadGeneration && ownedGeneration === sessionGeneration;
    conversationStore.stashActiveTurn();
    boundWorkflowId.value = null;
    rememberedWorkflowId = null;
    conversationStore.setThreadId(threadId);
    localStorage.setItem(THREAD_STORAGE_KEY, threadId);
    const hydrated = await hydrateFromServer(threadId, isCurrent);
    if (hydrated && isCurrent()) conversationStore.resumeBackgroundTurn();
  }
  function onRaw(raw) {
    var _a2, _b;
    if (typeof raw !== "object" || raw === null) return;
    const type = raw.type;
    if (typeof type !== "string" || !isAgentEvent(type)) return;
    const parsed = parseAgentWsEvent(raw);
    if (!parsed.success) {
      const messageId = (_a2 = raw.data) == null ? void 0 : _a2.message_id;
      if (type === "agent_message_done") {
        if (typeof messageId !== "string" || messageId === conversationStore.activeTurnId) {
          conversationStore.abortActiveTurn();
          pushError(i18n.global.t("agent.malformedEvent"));
        } else {
          conversationStore.settleBackgroundTurn(messageId);
        }
      }
      console.warn("[agent] dropping malformed agent event", parsed.error);
      return;
    }
    const event = parsed.data;
    if (event.type === "agent_ask_resolved")
      setAskAnswering(event.data.ask_id, false);
    switch (event.type) {
      case "agent_active_tab":
        conversationStore.ingest(event);
        if (event.data.thread_id === void 0 || event.data.thread_id === conversationStore.threadId)
          (_b = workflow == null ? void 0 : workflow.activeTab) == null ? void 0 : _b.call(workflow, event.data);
        return;
      default:
        conversationStore.ingest(event);
        if (event.type === "agent_message_done" && promptEditState.value.phase === "stopping" && event.data.message_id === promptEditState.value.turnId && event.data.thread_id === conversationStore.threadId)
          promptEditState.value = {
            phase: "ready",
            turnId: promptEditState.value.turnId
          };
    }
  }
  function onStatus(live) {
    if (live) {
      everLive = true;
      return;
    }
    if (!everLive) return;
    conversationStore.abortActiveTurn();
    conversationStore.dropBackgroundTurns();
  }
  const isSending = computed(() => sending.value);
  const editableTurnId = computed(
    () => promptEditState.value.phase === "ready" ? promptEditState.value.turnId : null
  );
  function bindWorkflow(workflowId) {
    boundWorkflowId.value = workflowId;
    rememberedWorkflowId = workflowId;
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
  };
}
function useAgentDraftSubmission(options) {
  const composer = useAgentComposerStore();
  const { selection } = options;
  function recoverFailedSubmission() {
    const snapshot = composer.takeFailedSubmission();
    if (!snapshot || selection.staged.value.length > 0) return;
    composer.restorePrompt({
      text: snapshot.prompt.text,
      references: snapshot.prompt.references.filter((reference) => {
        if (reference.kind === "workflow")
          return reference.id !== options.editableWorkflowId();
        if (reference.kind === "node")
          return options.target() === snapshot.target && snapshot.nodes.some(
            (node) => selectedNodeKey(node) === selectedNodeKey(reference.node)
          );
        return true;
      })
    });
    if (options.target() === snapshot.target) selection.replace(snapshot.nodes);
  }
  watch(() => composer.submission, recoverFailedSubmission, {
    immediate: true,
    flush: "sync"
  });
  async function submit(text2, attachments, references = []) {
    var _a2, _b;
    const target = options.target();
    if (!options.canSubmit() || ((_a2 = composer.submission) == null ? void 0 : _a2.phase) === "pending" || target === null || !text2.trim() && attachments.length === 0 || attachments.some((attachment) => attachment.uploading))
      return;
    const prompt = composer.prompt;
    const sentAttachments = [...attachments];
    const sentReferences = [...references];
    selection.exit();
    const nodes = selection.workflow() === target ? [...selection.staged.value] : [];
    selection.consume();
    const submissionId = composer.startSubmission({
      prompt,
      attachments: sentAttachments,
      nodes,
      target
    });
    const sent = await options.send(
      text2,
      sentAttachments,
      nodes,
      sentReferences
    );
    const stopRequested = ((_b = composer.submission) == null ? void 0 : _b.id) === submissionId && composer.submission.stopRequested;
    composer.settleSubmission(submissionId, sent);
    if (sent && stopRequested) await options.stop();
  }
  return { submit };
}
const OPEN = 1;
function createAgentEventSource(host) {
  return {
    subscribe(listener) {
      const unbinders = [...AGENT_WS_EVENT_TYPES].map((type) => {
        const onEvent = (event) => listener({ type, data: event.detail });
        host.addCustomEventListener(`comfytv_${type}`, onEvent);
        return () => host.removeCustomEventListener(`comfytv_${type}`, onEvent);
      });
      return () => unbinders.forEach((unbind) => unbind());
    },
    onStatus(listener) {
      var _a2;
      const onDown = () => listener(false);
      const onUp = () => listener(true);
      host.addEventListener("reconnecting", onDown);
      host.addEventListener("reconnected", onUp);
      listener(((_a2 = host.socket) == null ? void 0 : _a2.readyState) === OPEN);
      return () => {
        host.removeEventListener("reconnecting", onDown);
        host.removeEventListener("reconnected", onUp);
      };
    }
  };
}
function startOfLocalDay(now) {
  const date = new Date(now);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}
function groupSessionsByRecency(sessions, activeId, now) {
  const startToday = startOfLocalDay(now);
  const startYesterday = startOfLocalDay(startToday - 1);
  const groups = {
    current: [],
    today: [],
    yesterday: [],
    earlier: []
  };
  const ordered = [...sessions].sort((a, b2) => b2.updatedAt - a.updatedAt);
  for (const session of ordered) {
    if (session.id === activeId) groups.current.push(session);
    else if (session.updatedAt >= startToday) groups.today.push(session);
    else if (session.updatedAt >= startYesterday) groups.yesterday.push(session);
    else groups.earlier.push(session);
  }
  return groups;
}
const useAgentChatHistoryStore = defineStore("agentChatHistory", () => {
  const sessions = ref([]);
  const activeId = ref(null);
  const now = useTimestamp({ interval: 6e4 });
  const customTitles = useLocalStorage(
    "ComfyTV.Agent.ChatTitles",
    {}
  );
  const deletedIds = useLocalStorage("ComfyTV.Agent.DeletedThreads", []);
  const titled = computed(
    () => sessions.value.map((session) => {
      const custom = customTitles.value[session.id];
      return custom === void 0 ? session : { ...session, title: custom };
    })
  );
  const grouped = computed(
    () => groupSessionsByRecency(titled.value, activeId.value, now.value)
  );
  function titleFor(id) {
    return id === null ? void 0 : customTitles.value[id];
  }
  function rename(id, title) {
    const trimmed = title.trim();
    if (trimmed === "") return;
    customTitles.value = { ...customTitles.value, [id]: trimmed };
  }
  function remove(id) {
    sessions.value = sessions.value.filter((item) => item.id !== id);
    const { [id]: _removed, ...rest } = customTitles.value;
    customTitles.value = rest;
    if (!deletedIds.value.includes(id))
      deletedIds.value = [...deletedIds.value, id];
    if (activeId.value === id) activeId.value = null;
  }
  function replaceAll(next) {
    sessions.value = next.filter(
      (session) => !deletedIds.value.includes(session.id)
    );
  }
  function setActive(id) {
    activeId.value = id;
  }
  return {
    sessions,
    activeId,
    grouped,
    titleFor,
    rename,
    remove,
    replaceAll,
    setActive
  };
});
const useAgentConsentStore = defineStore("agentConsent", () => {
  const identity = computed(() => "local");
  const accepted = computed(() => true);
  const isChecking = computed(() => false);
  async function ensureScope() {
    return "local";
  }
  async function load() {
    return true;
  }
  async function accept(_expectedIdentity) {
    return true;
  }
  return { accepted, identity, isChecking, ensureScope, load, accept };
});
const _hoisted_1 = ["accept"];
const CREATING_TAB_MIN_DURATION_MS = 500;
const _sfc_main = /* @__PURE__ */ defineComponent({
  __name: "AgentPanelRoot",
  setup(__props) {
    var _a2;
    const { t } = useI18n();
    const toast = useToastStore();
    const { workspaceRole: workspaceRole2 } = useWorkspaceUI();
    const { tier: subscriptionTier } = useBillingContext();
    const { canTopUp: canTopUp2, canSubscribeSelfServe: canSubscribeSelfServe2 } = useBillingCapabilities();
    const paywallPresentation = computed(() => {
      return resolveAgentPaywallPresentation({
        distribution: "local",
        role: workspaceRole2.value,
        tier: subscriptionTier.value,
        canTopUp: canTopUp2.value,
        canSubscribeSelfServe: canSubscribeSelfServe2.value
      });
    });
    const { isBuilderMode: isBuilderMode2 } = useAppMode();
    const { resolvedUserInfo: resolvedUserInfo2, userDisplayName: userDisplayName2 } = useCurrentUser();
    const userName = computed(
      () => {
        var _a3;
        return ((_a3 = userDisplayName2.value) == null ? void 0 : _a3.trim().split(/\s+/)[0]) || void 0;
      }
    );
    const rest = createAgentRestClient();
    const events = createAgentEventSource(api);
    function onPaywallAction(action) {
    }
    const workflowStore = useWorkflowStore();
    const workflowService = useWorkflowService();
    const bindingStore = useAgentWorkflowTabBindingStore();
    const agentPanelStore = useAgentPanelStore();
    const composerStore = useAgentComposerStore();
    const { selectedWorkflow: selectedTarget } = storeToRefs(agentPanelStore);
    const { dismissedSelectionSignature, enabled: agentEnabled } = storeToRefs(agentPanelStore);
    const agentNodeSelectionStore = useAgentNodeSelectionStore();
    const workflowResolver = useAgentWorkflowResolver({
      workflows: workflowStore,
      bindings: bindingStore,
      listCloudWorkflows: () => rest.listCloudWorkflows()
    });
    const {
      refreshCloudWorkflowIds,
      forgetCloudWorkflowId,
      cloudIdFor,
      boundOrOpenWorkflowFor,
      storedWorkflowFor,
      openWorkflowFor,
      openTabsSnapshot
    } = workflowResolver;
    const {
      isSelecting: workflowSelecting,
      selectingTarget,
      savingReference,
      selectTarget: onSelectWorkflowTarget,
      selectReference: onSelectWorkflowReference,
      restoreTarget: onWorkflowRestored,
      requestReferences: onRequestWorkflowReferences,
      cancelSelection: cancelWorkflowSelection
    } = useAgentWorkflowSelection({
      resolver: workflowResolver,
      canSelectTarget: () => !isSending.value && status.value === "idle",
      warnWorkflowUnavailable
    });
    const tabActivity = useWorkflowTabActivityStore();
    const agentTabGraph = {
      ...blankGraph,
      extra: { ds: { offset: [0, 0], scale: 1 } }
    };
    const canvasStore = useCanvasStore();
    const graphActivity = useAgentGraphActivityStore();
    watch(
      () => {
        var _a3;
        return (_a3 = canvasStore.canvas) == null ? void 0 : _a3.graph;
      },
      (graph, _previous, onCleanup) => {
        if (!(graph == null ? void 0 : graph.events)) return;
        const events2 = graph.events;
        const onNodeRemoved = (event) => {
          var _a3;
          if (!(event instanceof CustomEvent)) return;
          const nodeId = parseNodeId(String((_a3 = event.detail.node) == null ? void 0 : _a3.id));
          if (nodeId) graphActivity.removeNodes([nodeId]);
        };
        events2.addEventListener("ctv:node:removed", onNodeRemoved);
        onCleanup(() => events2.removeEventListener("ctv:node:removed", onNodeRemoved));
      },
      { immediate: true }
    );
    const agentMinimapLayer = registerMinimapDecorationLayer();
    watch(
      () => graphActivity.state,
      (activity) => {
        if (activity.phase === "idle") {
          return;
        }
        const rootGraphId = toRootGraphId(activity.rootGraphId);
        agentMinimapLayer.replace(
          activity.nodeIds.map((nodeId) => ({
            target: {
              rootGraphId,
              owningGraphId: toOwningGraphId(activity.rootGraphId),
              nodeId
            },
            enter: "pop"
          }))
        );
      },
      { immediate: true }
    );
    const { accepted: consentAccepted } = storeToRefs(useAgentConsentStore());
    const workspaceStore = useTeamWorkspaceStore();
    const onboardingKey = computed(
      () => {
        var _a3;
        return scopedOnboardingKey(
          (_a3 = resolvedUserInfo2.value) == null ? void 0 : _a3.id,
          workspaceStore.activeWorkspaceId
        );
      }
    );
    watch(
      onboardingKey,
      (key) => {
        if (key) adoptSharedOnboardingFlag(key);
      },
      { immediate: true }
    );
    const { activeTour } = storeToRefs(useOnboardingTourStore());
    function toSelectedNode(node) {
      return {
        id: String(node.id),
        locatorId: workflowStore.nodeToNodeLocatorId(node),
        title: node.title || node.type
      };
    }
    const canReferenceNodes = computed(
      () => {
        var _a3;
        return selectedTarget.value !== null && ((_a3 = workflowStore.activeWorkflow) == null ? void 0 : _a3.path) === selectedTarget.value.path;
      }
    );
    const nodeReferenceDisabledReason = computed(() => {
      if (selectedTarget.value === null) return t("agent.selectWorkflowForNodes");
      if (!canReferenceNodes.value)
        return t("agent.switchWorkflowForNodes", {
          workflowName: selectedTarget.value.filename
        });
      return void 0;
    });
    const selectedNodes = computed(
      () => canvasStore.selectedItems.filter(isLGraphNode).map(toSelectedNode)
    );
    composerStore.setNodeScope(((_a2 = selectedTarget.value) == null ? void 0 : _a2.path) ?? null);
    const {
      staged: selectionTags,
      consume: consumeSelection,
      remove: removeSelectionTag,
      add: addSelectionTag,
      replace: replaceSelectionTags
    } = useCanvasSelection({
      staged: computed({
        get: () => composerStore.nodes,
        set: composerStore.setNodes
      }),
      selection: selectedNodes,
      enabled: () => agentEnabled.value && selectedTarget.value !== null,
      isLive: () => agentPanelStore.isOpen,
      isTracking: () => canReferenceNodes.value && agentNodeSelectionStore.isActive,
      isPaused: () => agentNodeSelectionStore.isLoadingWorkflow,
      scope: () => {
        var _a3;
        return ((_a3 = selectedTarget.value) == null ? void 0 : _a3.path) ?? null;
      },
      dismissedSignature: dismissedSelectionSignature
    });
    let nodeReferenceWorkflow = selectionTags.value.length ? selectedTarget.value : null;
    function viewedGraphNodes() {
      var _a3, _b, _c;
      return ((_b = (_a3 = app.canvas) == null ? void 0 : _a3.graph) == null ? void 0 : _b.nodes) ?? ((_c = app.graph) == null ? void 0 : _c.nodes) ?? [];
    }
    function mentionableNodes() {
      return canReferenceNodes.value ? viewedGraphNodes().map(toSelectedNode) : [];
    }
    watch(
      selectionTags,
      (tags) => {
        var _a3;
        nodeReferenceWorkflow = tags.length ? selectedTarget.value : null;
        if (!agentPanelStore.isOpen || agentNodeSelectionStore.isLoadingWorkflow)
          return;
        agentNodeSelectionStore.saveNodeIds(
          (_a3 = selectedTarget.value) == null ? void 0 : _a3.path,
          tags.map(selectedNodeKey)
        );
      },
      { deep: true, flush: "sync" }
    );
    watch(
      [() => agentPanelStore.isOpen, canReferenceNodes],
      ([open, canReference]) => {
        var _a3;
        if (!open || !canReference || selectionTags.value.length > 0) return;
        const locatorIds = new Set(
          agentNodeSelectionStore.nodeIds((_a3 = selectedTarget.value) == null ? void 0 : _a3.path)
        );
        replaceSelectionTags(
          [...locatorIds].map((locatorId) => getNodeByLocatorId(app.rootGraph, locatorId)).filter((node) => node !== null).map(toSelectedNode)
        );
      },
      { immediate: true }
    );
    const workflowDetached = computed(() => selectedTarget.value === null);
    function originWorkflow(origin) {
      if (origin === null) return void 0;
      return (origin === void 0 ? selectedTarget.value : workflowStore.openWorkflows.find(
        (workflow) => workflow.path === origin.tabPath
      )) ?? void 0;
    }
    function targetWorkflowTurnContext(origin) {
      if (workflowDetached.value) return void 0;
      const target = originWorkflow(origin);
      if (!target) return void 0;
      const id = cloudIdFor(target);
      if (id === void 0 && !target.isTemporary && origin !== void 0)
        return void 0;
      return id === void 0 ? { tabPath: target.path } : { id, tabPath: target.path };
    }
    function targetWorkflowDraft(origin) {
      var _a3, _b;
      if (workflowDetached.value) return void 0;
      const target = originWorkflow(origin);
      if (!target) return void 0;
      if (target.path === ((_a3 = workflowStore.activeWorkflow) == null ? void 0 : _a3.path))
        (_b = target.changeTracker) == null ? void 0 : _b.prepareForSave();
      const content = target.activeState;
      if (!content) return void 0;
      return { content };
    }
    const selectedTargetTab = computed(() => {
      const target = selectedTarget.value;
      return target ? {
        path: target.path,
        name: target.filename,
        isPersisted: target.isPersisted,
        modified: target.isModified
      } : null;
    });
    const editableWorkflowId = computed(() => {
      const target = selectedTarget.value;
      return target ? cloudIdFor(target) : void 0;
    });
    const workflowTabs = computed(
      () => workflowStore.openWorkflows.map((tab) => ({
        path: tab.path,
        name: tab.filename,
        isPersisted: tab.isPersisted,
        modified: tab.isModified
      }))
    );
    function onWorkflowAdopted(workflowId, sent) {
      if (sent === void 0) return;
      const adoptable = sent.id === void 0 ? bindingStore.tabPathFor(workflowId) === void 0 && storedWorkflowFor(workflowId) === null : sent.id === workflowId;
      if (adoptable) {
        bindingStore.bind(workflowId, sent.tabPath);
        tabActivity.setEditing(sent.tabPath);
      }
    }
    function warnWorkflowUnavailable() {
      toast.add({
        severity: "warn",
        detail: t("agent.targetNavigationUnavailable"),
        life: 5e3
      });
    }
    const {
      sendMessage,
      stopTurn,
      isSending: sessionIsSending,
      newChat,
      start,
      stop,
      entries: entries2,
      editableTurnId,
      isStreaming,
      status,
      notices,
      threadId,
      listThreads,
      loadThread,
      boundWorkflowId,
      bindWorkflow,
      answerAsk,
      answeringAskIds
    } = useAgentSession({
      rest,
      events,
      workflow: {
        current: targetWorkflowTurnContext,
        adopted: onWorkflowAdopted,
        restored: onWorkflowRestored,
        prepare: async () => {
          await refreshCloudWorkflowIds();
        },
        disowned: forgetCloudWorkflowId,
        tabs: openTabsSnapshot,
        activeTab: enqueueActiveTab,
        draft: targetWorkflowDraft
      }
    });
    const isSending = computed(
      () => {
        var _a3;
        return sessionIsSending.value || ((_a3 = composerStore.submission) == null ? void 0 : _a3.phase) === "pending";
      }
    );
    const { activeTurnId: conversationTurnId } = storeToRefs(
      useAgentConversationStore()
    );
    function resumedTurnTabPath() {
      if (workflowDetached.value) return null;
      const bound = boundWorkflowId.value;
      if (bound === null) {
        const context2 = targetWorkflowTurnContext();
        return (context2 == null ? void 0 : context2.id) !== void 0 ? context2.tabPath : null;
      }
      const boundPath = bindingStore.tabPathFor(bound);
      if (boundPath !== void 0) return boundPath;
      const context = targetWorkflowTurnContext();
      return (context == null ? void 0 : context.id) === bound ? context.tabPath : null;
    }
    let observedActivityStatus = false;
    watch(
      [status, conversationTurnId],
      ([value, turnId]) => {
        if (value === "idle") {
          if (observedActivityStatus) graphActivity.finishTurn();
        } else graphActivity.startTurn(turnId);
        observedActivityStatus = true;
        if (value === "idle") {
          const completedPath = tabActivity.editingTabPath;
          tabActivity.setEditing(null);
          if (completedPath !== null) tabActivity.markModified(completedPath);
        } else if (tabActivity.editingTabPath === null)
          tabActivity.setEditing(resumedTurnTabPath());
      },
      { immediate: true, flush: "sync" }
    );
    const executionErrorStore = useExecutionErrorStore();
    function surfaceAgentError(type, details) {
      executionErrorStore.recordPromptError({
        type,
        message: t(`errorCatalog.promptErrors.${type}.desc`),
        details
      });
      executionErrorStore.showErrorOverlay();
    }
    let noticesSeen = 0;
    watch(
      () => notices.value.length,
      (length) => {
        for (const notice of notices.value.slice(noticesSeen))
          surfaceAgentError("agent_api_failed", notice.text);
        noticesSeen = length;
      }
    );
    let activeTabGeneration = 0;
    let activeTabChain = Promise.resolve();
    function enqueueActiveTab(data) {
      const generation = ++activeTabGeneration;
      activeTabChain = activeTabChain.then(() => onAgentActiveTab(data, generation));
    }
    function onOpenApprovalWorkflow(workflowId, workflowName) {
      enqueueActiveTab({ workflow_id: workflowId, name: workflowName });
    }
    async function onNavigateToReferenceWorkflow(workflowId) {
      try {
        let target = openWorkflowFor(workflowId);
        if (target === null) {
          await Promise.all([
            refreshCloudWorkflowIds(),
            workflowStore.syncWorkflows()
          ]);
          target = storedWorkflowFor(workflowId);
        }
        if (target === null || !await workflowService.openWorkflow(target)) {
          warnWorkflowUnavailable();
          return;
        }
        bindingStore.bind(workflowId, target.path);
      } catch {
        warnWorkflowUnavailable();
      }
    }
    function agentTabFilename(name) {
      const cleaned = [
        ...(name ?? "").replace(/[/\\\p{Cc}]/gu, "-").replace(/\.json$/i, "").trim().replace(/^\.+/, "")
      ].slice(0, 80).join("").replace(/^[\s.]+/u, "").trim();
      return cleaned.length === 0 ? void 0 : `${cleaned}.json`;
    }
    async function onAgentActiveTab(data, generation) {
      var _a3, _b;
      const stale = () => generation !== activeTabGeneration;
      if (stale()) return;
      try {
        const bound = boundOrOpenWorkflowFor(data.workflow_id);
        if (bound) {
          const opened2 = await workflowService.openWorkflow(bound);
          if (stale()) return;
          if (!opened2) {
            warnWorkflowUnavailable();
            return;
          }
          bindingStore.bind(data.workflow_id, bound.path);
          if (status.value !== "idle") tabActivity.setEditing(bound.path);
          bindWorkflow(data.workflow_id);
          (_a3 = useTelemetry()) == null ? void 0 : _a3.trackAgentWorkflowApplied({
            workflow_id: data.workflow_id,
            target: "active_tab_switch"
          });
          return;
        }
        const creatingStartedAt = Date.now();
        tabActivity.setCreating(true);
        const remainingCreatingTime = CREATING_TAB_MIN_DURATION_MS - (Date.now() - creatingStartedAt);
        if (remainingCreatingTime > 0)
          await new Promise((resolve) => setTimeout(resolve, remainingCreatingTime));
        if (stale()) return;
        const tab = workflowStore.createNewTemporary(
          agentTabFilename(data.name),
          agentTabGraph
        );
        tabActivity.setCreating(false);
        let opened;
        try {
          opened = await workflowService.openWorkflow(tab);
        } catch (error) {
          await workflowService.closeWorkflow(tab, { warnIfUnsaved: false });
          throw error;
        }
        if (stale() || !opened) {
          await workflowService.closeWorkflow(tab, { warnIfUnsaved: false });
          if (!stale()) warnWorkflowUnavailable();
          return;
        }
        if (status.value !== "idle") tabActivity.setEditing(tab.path);
        bindingStore.bind(data.workflow_id, tab.path);
        bindWorkflow(data.workflow_id);
        (_b = useTelemetry()) == null ? void 0 : _b.trackAgentWorkflowApplied({
          workflow_id: data.workflow_id,
          target: "active_tab_open"
        });
      } catch (error) {
        if (stale()) return;
        bindWorkflow(data.workflow_id);
        surfaceAgentError(
          "agent_api_failed",
          error instanceof Error ? error.message : String(error)
        );
      } finally {
        tabActivity.setCreating(false);
      }
    }
    start();
    if (agentPanelStore.canRestoreWorkflow && localStorage.getItem("ComfyTV.Agent.ThreadId") === null)
      agentPanelStore.setWorkflowTarget(workflowStore.activeWorkflow);
    watch(newChatRequests, () => onNewChat());
    watch(status, (value) => {
      agentBusy.value = value !== "idle";
    }, { immediate: true });
    void refreshCloudWorkflowIds();
    onBeforeUnmount(() => {
      ++activeTabGeneration;
      exitNodeSelectionMode();
      stop();
      tabActivity.setEditing(null);
      tabActivity.setCreating(false);
    });
    const history2 = useAgentChatHistoryStore();
    const { copy } = useClipboard({ legacy: true });
    function onFeedback(turnId, vote) {
      const message = entries2.value.find(
        (entry) => entry.role === "assistant" && entry.id === turnId
      );
      (message == null ? void 0 : message.role) === "assistant" ? message.parts.flatMap((part) => part.type === "tabLink" ? [part.workflowId] : []).at(-1) ?? null : null;
    }
    function toChatSession(thread) {
      const stamp = thread.last_message_at ?? thread.updated_at ?? thread.created_at;
      const updatedAt = stamp ? Date.parse(stamp) : Date.now();
      return {
        id: thread.id,
        title: thread.title || thread.preview || t("agent.untitledChat"),
        updatedAt: Number.isNaN(updatedAt) ? Date.now() : updatedAt
      };
    }
    async function refreshHistory() {
      try {
        history2.replaceAll((await listThreads()).map(toChatSession));
      } catch (error) {
        surfaceAgentError(
          "agent_api_failed",
          error instanceof Error ? error.message : String(error)
        );
      }
    }
    watch(threadId, (id) => history2.setActive(id), { immediate: true });
    void refreshHistory();
    async function onSelectHistory(id) {
      composerStore.invalidateSubmission();
      cancelWorkflowSelection();
      agentPanelStore.resetWorkflowTarget();
      exitNodeSelectionMode();
      await loadThread(id);
      void refreshHistory();
    }
    function buildTranscriptMarkdown(entries22) {
      return entries22.map((entry) => {
        if (entry.role === "user") return `**You:** ${agentMessageText(entry)}`;
        const text2 = entry.parts.filter((part) => part.type === "text").map((part) => part.text).join("");
        return `**Agent:** ${text2}`;
      }).join("\n\n");
    }
    function onCopyMarkdown(id) {
      if (id === history2.activeId) void copy(buildTranscriptMarkdown(entries2.value));
      else toast.add({ severity: "info", summary: t("agent.copyUnavailable") });
    }
    const coachSteps = computed(() => [
      {
        target: "#agent-panel-root",
        placement: "left-center",
        title: t("agent.coachTitle"),
        body: t("agent.coachBody")
      },
      {
        target: "#agent-composer",
        placement: "left-end",
        title: t("agent.coachWorkflowTitle"),
        body: t("agent.coachWorkflowBody")
      },
      {
        target: ".graph-canvas-panel",
        placement: "graph-bottom",
        toolbarTarget: '.graph-canvas-panel [role="toolbar"]',
        title: t("agent.coachGraphTitle"),
        body: t("agent.coachGraphBody")
      },
      {
        target: "#agent-chat-history",
        placement: "left-start",
        title: t("agent.coachHistoryTitle"),
        body: t("agent.coachHistoryBody")
      }
    ]);
    const { submit: onSend } = useAgentDraftSubmission({
      canSubmit: () => !workflowSelecting.value && !isSending.value,
      target: () => selectedTarget.value,
      editableWorkflowId: () => editableWorkflowId.value,
      selection: {
        staged: selectionTags,
        workflow: () => nodeReferenceWorkflow,
        consume: consumeSelection,
        replace: replaceSelectionTags,
        exit: exitNodeSelectionMode
      },
      send: (text2, attachments, nodes, references) => {
        return sendMessage(text2, attachments, nodes, references);
      },
      stop: stopTurn
    });
    function onStop() {
      if (!composerStore.requestSubmissionStop()) void stopTurn();
    }
    function onRenameChat(title) {
      if (threadId.value !== null) history2.rename(threadId.value, title);
    }
    function onRenameHistory(id, title) {
      history2.rename(id, title);
    }
    function onDeleteHistory(id) {
      history2.remove(id);
      if (id === threadId.value) onNewChat();
    }
    function onNewChat() {
      composerStore.invalidateSubmission();
      cancelWorkflowSelection();
      exitNodeSelectionMode();
      composerStore.setWorkflowReferences([]);
      composerStore.resetPromptHistory();
      agentPanelStore.setWorkflowTarget(workflowStore.activeWorkflow);
      newChat();
    }
    const panelRef = ref();
    const fileInput = ref();
    const assetDragActive = ref(false);
    let assetDragDepth = 0;
    provide("agentAssetDragActive", readonly(assetDragActive));
    let selectingNodes = false;
    let nodeSelectionCanvas;
    let restoreAllowDragNodes;
    let restoreSelectOnly;
    watch(
      () => canvasStore.selectedItems,
      (items) => {
        if (agentNodeSelectionStore.restoredNodeIds !== null) {
          if (canReferenceNodes.value) {
            replaceSelectionTags(items.filter(isLGraphNode).map(toSelectedNode));
          }
          agentNodeSelectionStore.finishWorkflowLoad();
        }
      },
      { immediate: true }
    );
    function exitNodeSelectionMode() {
      const canvas = nodeSelectionCanvas;
      if (canvas) {
        canvas.multi_select = false;
        canvas.allow_dragnodes = restoreAllowDragNodes ?? true;
        canvas.selectOnly = restoreSelectOnly ?? false;
      }
      nodeSelectionCanvas = void 0;
      restoreAllowDragNodes = void 0;
      restoreSelectOnly = void 0;
      selectingNodes = false;
      if (agentNodeSelectionStore.isActive) agentNodeSelectionStore.exit();
      if (canvas) {
        canvas.deselectAll();
        canvasStore.updateSelectedItems();
      }
    }
    watch(
      () => agentNodeSelectionStore.isActive,
      (active) => {
        if (!active) exitNodeSelectionMode();
      }
    );
    watch(() => workflowStore.activeWorkflow, exitNodeSelectionMode);
    watch(
      selectedTarget,
      (target, previous) => {
        exitNodeSelectionMode();
        composerStore.setNodeScope((target == null ? void 0 : target.path) ?? null);
        nodeReferenceWorkflow = null;
        agentNodeSelectionStore.saveNodeIds(previous == null ? void 0 : previous.path, []);
        agentNodeSelectionStore.saveNodeIds(target == null ? void 0 : target.path, []);
      },
      { flush: "sync" }
    );
    watch(
      () => canvasStore.currentGraph,
      () => {
        if (!agentNodeSelectionStore.isLoadingWorkflow) exitNodeSelectionMode();
      }
    );
    function onSelectNodes() {
      if (!canReferenceNodes.value || selectingNodes) return;
      const canvas = app.canvas;
      if (!canvas) return;
      const merged = new Map(
        [...canvas.selectedItems].filter(isLGraphNode).map((node) => [workflowStore.nodeToNodeLocatorId(node), node])
      );
      for (const tag of selectionTags.value) {
        const key = selectedNodeKey(tag);
        const node = getNodeByLocatorId(app.rootGraph, key);
        if (node) merged.set(key, node);
      }
      if (merged.size) {
        canvas.selectItems([...merged.values()]);
        canvasStore.updateSelectedItems();
      }
      restoreAllowDragNodes = canvas.allow_dragnodes;
      restoreSelectOnly = canvas.selectOnly;
      canvas.allow_dragnodes = false;
      canvas.selectOnly = true;
      canvas.multi_select = true;
      nodeSelectionCanvas = canvas;
      selectingNodes = true;
      agentNodeSelectionStore.enter();
      void nextTick(() => {
        if (selectingNodes) canvas.canvas.focus();
      });
    }
    const attachment = useAttachment({
      upload: (file) => uploadToLibrary(file),
      maxBytes: (file) => {
        const serverLimit = api.getServerFeature(
          "max_upload_size",
          MAX_ATTACHMENT_BYTES
        );
        return hasVideoType(file) ? serverLimit : Math.min(MAX_ATTACHMENT_BYTES, serverLimit);
      },
      // A rejected file is the user's problem to fix, not an agent failure, so it
      // must not raise the server-error overlay.
      onError: (message) => toast.add({ severity: "warn", detail: message, life: 5e3 }),
      stage: composerStore.addAttachment,
      update: composerStore.updateAttachment,
      remove: composerStore.removeAttachment
    });
    function onAttach() {
      var _a3;
      exitNodeSelectionMode();
      (_a3 = fileInput.value) == null ? void 0 : _a3.click();
    }
    const attachedAssetIds = () => composerStore.attachments.flatMap((item) => {
      const id = assetIdOf(item.ref);
      return id === null ? [] : [id];
    });
    function onOpenEagle() {
      exitNodeSelectionMode();
      openEaglePicker({
        addedIds: attachedAssetIds,
        select: (asset) => {
          var _a3;
          return (_a3 = panelRef.value) == null ? void 0 : _a3.addAttachment(toAttachment(asset));
        },
        deselect: (asset) => composerStore.removeAttachment(toAttachment(asset).id)
      });
    }
    function onOpenAssets() {
      exitNodeSelectionMode();
      closeEaglePicker();
      openAssetPicker({
        addedIds: attachedAssetIds,
        select: (asset) => {
          var _a3;
          return (_a3 = panelRef.value) == null ? void 0 : _a3.addAttachment(toAttachment(asset));
        },
        deselect: (asset) => composerStore.removeAttachment(toAttachment(asset).id)
      });
    }
    function onMentionPick(node) {
      if (!canReferenceNodes.value) return;
      const stagedBefore = selectionTags.value.length;
      addSelectionTag(node);
      if (selectionTags.value.length > stagedBefore)
        ;
    }
    function onRemoveSelectionTag(id) {
      removeSelectionTag(id);
    }
    function onClosePanel() {
      exitNodeSelectionMode();
      agentPanelStore.close("close_button");
    }
    async function onFilesPicked(event) {
      const input = event.target;
      const files = input.files;
      if (files && files.length > 0) await attachment.addFiles(Array.from(files));
      input.value = "";
    }
    function isAssetDrag(event) {
      var _a3;
      return (((_a3 = event.dataTransfer) == null ? void 0 : _a3.types) ?? []).includes(MIME_ASSET_INFO) || isComfyTVAssetDrag(event.dataTransfer) || isEagleDrag(event.dataTransfer);
    }
    function isAttachableDrag(event) {
      var _a3;
      return (((_a3 = event.dataTransfer) == null ? void 0 : _a3.types) ?? []).includes("Files") || isAssetDrag(event);
    }
    function clearAssetDrag() {
      assetDragDepth = 0;
      assetDragActive.value = false;
    }
    function onPanelDragEnter(event) {
      if (!isAttachableDrag(event)) return;
      assetDragDepth += 1;
      assetDragActive.value = true;
    }
    function onPanelDragLeave() {
      if (assetDragDepth === 0) return;
      assetDragDepth -= 1;
      if (assetDragDepth === 0) assetDragActive.value = false;
    }
    async function attachDroppedAsset(event) {
      var _a3, _b, _c;
      if (event.dataTransfer && isEagleDrag(event.dataTransfer)) {
        for (const item of await droppedEagleAssets(event.dataTransfer))
          (_a3 = panelRef.value) == null ? void 0 : _a3.addAttachment(item);
        return;
      }
      if (event.dataTransfer && isComfyTVAssetDrag(event.dataTransfer)) {
        for (const item of droppedComfyTVAssets(event.dataTransfer))
          (_b = panelRef.value) == null ? void 0 : _b.addAttachment(item);
        return;
      }
      const asset = event.dataTransfer && getDroppedAsset(event.dataTransfer);
      if (!asset) {
        toast.add({
          severity: "warn",
          detail: t("agent.assetNotAttachable"),
          life: 5e3
        });
        return;
      }
      if (asset.ref && asset.kind !== "other") {
        (_c = panelRef.value) == null ? void 0 : _c.addAttachment({
          id: `asset:${asset.ref}`,
          name: asset.name,
          ref: asset.ref,
          previewUrl: asset.previewUrl
        });
        return;
      }
      const file = await attachment.addDeferredFile(asset.name, async () => {
        const file2 = await fetchDroppedAsset(asset);
        return file2 && isAgentAttachable(file2) ? file2 : void 0;
      });
      if (!file)
        toast.add({
          severity: "warn",
          detail: t("agent.assetNotAttachable"),
          life: 5e3
        });
    }
    function onPanelDragOver(event) {
      if (isAttachableDrag(event)) event.preventDefault();
    }
    function onPanelDrop(event) {
      var _a3, _b;
      clearAssetDrag();
      if ((((_a3 = event.dataTransfer) == null ? void 0 : _a3.files.length) ?? 0) === 0 && isAssetDrag(event)) {
        event.preventDefault();
        void attachDroppedAsset(event);
        return;
      }
      const files = Array.from(((_b = event.dataTransfer) == null ? void 0 : _b.files) ?? []).filter(
        isAgentAttachable
      );
      if (files.length === 0) return;
      event.preventDefault();
      void attachment.addFiles(files);
    }
    return (_ctx, _cache) => {
      var _a3, _b;
      return openBlock(), createElementBlock(Fragment, null, [
        createVNode(_sfc_main$2, {
          canvas: unref(canvasStore).canvas
        }, null, 8, ["canvas"]),
        createBaseVNode("div", {
          id: "agent-panel-root",
          class: "ctv:size-full",
          onDragenter: onPanelDragEnter,
          onDragleave: onPanelDragLeave,
          onDragover: onPanelDragOver,
          onDrop: onPanelDrop
        }, [
          createBaseVNode("input", {
            ref_key: "fileInput",
            ref: fileInput,
            type: "file",
            accept: unref(AGENT_ATTACH_ACCEPT),
            multiple: "",
            class: "ctv:hidden",
            "data-testid": "agent-file-input",
            onChange: onFilesPicked
          }, null, 40, _hoisted_1),
          createVNode(_sfc_main$4, {
            ref_key: "panelRef",
            ref: panelRef,
            entries: unref(entries2),
            "editable-turn-id": unref(editableTurnId),
            "answering-ask-ids": unref(answeringAskIds),
            "user-name": userName.value,
            streaming: unref(isStreaming),
            submitting: isSending.value || unref(status) === "thinking",
            "can-attach": true,
            "can-open-assets": !unref(isBuilderMode2),
            "can-open-eagle": !unref(isBuilderMode2) && unref(eagleAvailable),
            "is-maximized": unref(agentPanelStore).isMaximized,
            "history-groups": unref(history2).grouped,
            "session-id": unref(threadId),
            "custom-title": unref(history2).titleFor(unref(threadId)),
            "selection-tags": unref(selectionTags),
            "node-reference-disabled-reason": nodeReferenceDisabledReason.value,
            "select-workflow-reference": unref(onSelectWorkflowReference),
            "saving-reference": unref(savingReference),
            "available-workflows": [],
            "editable-workflow-id": editableWorkflowId.value,
            "active-tab": selectedTargetTab.value,
            "workflow-tabs": workflowTabs.value,
            "visible-tab-path": ((_a3 = unref(workflowStore).activeWorkflow) == null ? void 0 : _a3.path) ?? null,
            "selecting-tab-path": ((_b = unref(selectingTarget)) == null ? void 0 : _b.path) ?? null,
            "select-tab": unref(onSelectWorkflowTarget),
            "workflow-detached": workflowDetached.value,
            "get-mention-nodes": mentionableNodes,
            "paywall-presentation": paywallPresentation.value,
            onSend: unref(onSend),
            onStop,
            onAttach,
            onOpenAssets,
            onOpenEagle,
            onSelectNodes,
            onRemoveTag: onRemoveSelectionTag,
            onMentionPick,
            onRequestWorkflowReferences: unref(onRequestWorkflowReferences),
            onRemoveWorkflowReference: unref(composerStore).removeWorkflowReference,
            onFeedback,
            onAnswerAsk: unref(answerAsk),
            onOpenWorkflow: onOpenApprovalWorkflow,
            onOpenReferenceWorkflow: onNavigateToReferenceWorkflow,
            onPaywallAction,
            onNewChat,
            onToggleSize: _cache[0] || (_cache[0] = ($event) => unref(agentPanelStore).toggleMaximize()),
            onClose: onClosePanel,
            onOpenHistory: _cache[1] || (_cache[1] = ($event) => refreshHistory()),
            onSelectHistory,
            onDeleteHistory,
            onRenameHistory,
            onRenameChat,
            onCopyHistory: onCopyMarkdown
          }, null, 8, ["entries", "editable-turn-id", "answering-ask-ids", "user-name", "streaming", "submitting", "can-open-assets", "can-open-eagle", "is-maximized", "history-groups", "session-id", "custom-title", "selection-tags", "node-reference-disabled-reason", "select-workflow-reference", "saving-reference", "editable-workflow-id", "active-tab", "workflow-tabs", "visible-tab-path", "selecting-tab-path", "select-tab", "workflow-detached", "paywall-presentation", "onSend", "onRequestWorkflowReferences", "onRemoveWorkflowReference", "onAnswerAsk"]),
          unref(consentAccepted) && onboardingKey.value && !unref(canvasStore).linearMode && unref(activeTour) === null ? (openBlock(), createBlock(_sfc_main$1, {
            key: 0,
            steps: coachSteps.value,
            "storage-key": onboardingKey.value
          }, null, 8, ["steps", "storage-key"])) : createCommentVNode("", true)
        ], 32)
      ], 64);
    };
  }
});
export {
  _sfc_main as default
};
//# sourceMappingURL=AgentPanelRoot-BI38ec5b.mjs.map
