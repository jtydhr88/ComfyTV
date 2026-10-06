import { bn as defineComponent, bT as openBlock, bh as createElementBlock, bd as createBaseVNode, c9 as toDisplayString } from "./main-CgtxvwZl.mjs";
const _hoisted_1 = { class: "ctv:flex ctv:size-full ctv:items-center ctv:justify-center ctv:p-4 ctv:text-sm ctv:text-muted-foreground" };
const _hoisted_2 = ["href"];
const _sfc_main = /* @__PURE__ */ defineComponent({
  __name: "Load3dViewerContent",
  props: {
    modelUrl: {}
  },
  setup(__props) {
    return (_ctx, _cache) => {
      return openBlock(), createElementBlock("div", _hoisted_1, [
        createBaseVNode("a", {
          href: __props.modelUrl,
          target: "_blank",
          rel: "noopener",
          class: "ctv:underline"
        }, toDisplayString(__props.modelUrl), 9, _hoisted_2)
      ]);
    };
  }
});
export {
  _sfc_main as default
};
//# sourceMappingURL=Load3dViewerContent-umsEavlX.mjs.map
