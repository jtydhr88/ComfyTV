import { bn as defineComponent, bQ as onMounted, bP as onBeforeUnmount, bT as openBlock, be as createBlock, bd as createBaseVNode, bh as createElementBlock, bf as createCommentVNode, M as Fragment, cM as withModifiers, aH as Teleport, bb as computed } from "./main-hv189Cl5.mjs";
const _hoisted_1 = ["src"];
const _hoisted_2 = ["src"];
const _hoisted_3 = ["src", "alt"];
const _sfc_main = /* @__PURE__ */ defineComponent({
  __name: "MediaLightbox",
  props: {
    allGalleryItems: {},
    activeIndex: {}
  },
  emits: ["update:activeIndex"],
  setup(__props, { emit: __emit }) {
    const props = __props;
    const emit = __emit;
    const hasMultiple = computed(() => props.allGalleryItems.length > 1);
    const activeItem = computed(() => {
      const item = props.allGalleryItems[props.activeIndex];
      if (!item) return null;
      return {
        ...item,
        isVideo: item.mediaType === "video",
        isAudio: item.mediaType === "audio"
      };
    });
    function close() {
      emit("update:activeIndex", -1);
    }
    function step(direction) {
      const count = props.allGalleryItems.length;
      if (!count) return;
      emit("update:activeIndex", (props.activeIndex + direction + count) % count);
    }
    function onKey(event) {
      if (event.key === "Escape") close();
      else if (event.key === "ArrowLeft") step(-1);
      else if (event.key === "ArrowRight") step(1);
    }
    onMounted(() => document.addEventListener("keydown", onKey));
    onBeforeUnmount(() => document.removeEventListener("keydown", onKey));
    return (_ctx, _cache) => {
      return openBlock(), createBlock(Teleport, { to: "body" }, [
        createBaseVNode("div", {
          class: "agent-scope ctv:fixed ctv:inset-0 ctv:z-1700 ctv:flex ctv:items-center ctv:justify-center ctv:bg-black/80 ctv:p-8",
          role: "dialog",
          "aria-modal": "true",
          onClick: withModifiers(close, ["self"])
        }, [
          createBaseVNode("button", {
            type: "button",
            class: "ctv:absolute ctv:top-4 ctv:right-4 ctv:flex ctv:size-9 ctv:cursor-pointer ctv:items-center ctv:justify-center ctv:rounded-full ctv:bg-black/50 ctv:text-white ctv:hover:bg-black/70",
            "aria-label": "close",
            onClick: close
          }, [..._cache[2] || (_cache[2] = [
            createBaseVNode("i", { class: "ctv:icon-[lucide--x] ctv:size-5" }, null, -1)
          ])]),
          hasMultiple.value ? (openBlock(), createElementBlock("button", {
            key: 0,
            type: "button",
            class: "ctv:absolute ctv:top-1/2 ctv:left-4 ctv:flex ctv:size-9 ctv:-translate-y-1/2 ctv:cursor-pointer ctv:items-center ctv:justify-center ctv:rounded-full ctv:bg-black/50 ctv:text-white ctv:hover:bg-black/70",
            onClick: _cache[0] || (_cache[0] = ($event) => step(-1))
          }, [..._cache[3] || (_cache[3] = [
            createBaseVNode("i", { class: "ctv:icon-[lucide--chevron-left] ctv:size-5" }, null, -1)
          ])])) : createCommentVNode("", true),
          hasMultiple.value ? (openBlock(), createElementBlock("button", {
            key: 1,
            type: "button",
            class: "ctv:absolute ctv:top-1/2 ctv:right-4 ctv:flex ctv:size-9 ctv:-translate-y-1/2 ctv:cursor-pointer ctv:items-center ctv:justify-center ctv:rounded-full ctv:bg-black/50 ctv:text-white ctv:hover:bg-black/70",
            onClick: _cache[1] || (_cache[1] = ($event) => step(1))
          }, [..._cache[4] || (_cache[4] = [
            createBaseVNode("i", { class: "ctv:icon-[lucide--chevron-right] ctv:size-5" }, null, -1)
          ])])) : createCommentVNode("", true),
          activeItem.value ? (openBlock(), createElementBlock(Fragment, { key: 2 }, [
            activeItem.value.isVideo ? (openBlock(), createElementBlock("video", {
              key: 0,
              src: activeItem.value.url,
              controls: "",
              autoplay: "",
              class: "ctv:max-h-full ctv:max-w-full ctv:rounded-lg"
            }, null, 8, _hoisted_1)) : activeItem.value.isAudio ? (openBlock(), createElementBlock("audio", {
              key: 1,
              src: activeItem.value.url,
              controls: "",
              autoplay: ""
            }, null, 8, _hoisted_2)) : (openBlock(), createElementBlock("img", {
              key: 2,
              src: activeItem.value.url,
              alt: activeItem.value.filename,
              class: "ctv:max-h-full ctv:max-w-full ctv:rounded-lg ctv:object-contain"
            }, null, 8, _hoisted_3))
          ], 64)) : createCommentVNode("", true)
        ])
      ]);
    };
  }
});
export {
  _sfc_main as default
};
//# sourceMappingURL=MediaLightbox-CH39jZrx.mjs.map
