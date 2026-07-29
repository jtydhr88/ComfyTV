# ComfyTV node-doc style guide (for authors)

This file is internal guidance for writing node help. It is NOT published (the docs
sync only reads folders named `ComfyTV.*`). One node = one folder:

```
node-docs/ComfyTV.<ClassName>/en.md      # English, source of truth
node-docs/ComfyTV.<ClassName>/zh.md      # Simplified Chinese, faithful mirror
```

The folder name is the node's `node_id` (e.g. class `GlowStage` with
`node_id="ComfyTV.GlowStage"` -> folder `ComfyTV.GlowStage`). `MaskCleanup` has no
`Stage` suffix -> folder `ComfyTV.MaskCleanup`.

## Audience and voice

- Readers are **creators/editors**, not Python developers. Explain what the node is
  FOR and WHEN to reach for it, in plain language, before listing knobs.
- Professional but approachable. Assume familiarity with editing/VFX/audio concepts
  but define ComfyTV-specific behavior.
- Compare to tools people know when it helps ("like a chroma key in After Effects",
  "like a compressor in a DAW"), but keep it accurate.

## The one hard rule: never invent behavior or parameters

- Every parameter name, its type, default, range, and dropdown options MUST come from
  the node's `define_schema()` in the source file you are given. Do not guess.
- If you are unsure what a parameter does, read the `execute()` / render logic in the
  same file (and the frontend component in `src/` for rich-UI nodes) and describe the
  real effect. If still unclear, describe it minimally rather than fabricating.
- `research/<domain>/` docs are good background for concepts and algorithms, but the
  node's actual inputs/outputs/behavior come from the code.

## Types (state briefly, link once)

Most ComfyTV media flows as project snapshots, not native ComfyUI tensors:
`COMFYTV_VIDEO`, `COMFYTV_IMAGE`, `COMFYTV_IMAGES`, `COMFYTV_AUDIO`, `COMFYTV_MASK`,
`COMFYTV_MODEL`, etc. To interoperate with native ComfyUI nodes, users insert a
**Bridge** (`ComfyTV/Bridge`). Mention the in/out type; you do not need the full
type table on every FX node, a one-line note plus a link to
`https://github.com/jtydhr88/ComfyTV/blob/main/docs/bridges.md` is enough.

## Two templates

### A. Standard node (FX / filter / transform / utility) — target 40-80 lines

```markdown
# <Display Name>

> <One sentence: what it does and the payoff, plain language.>

## What this node does

<1-3 short paragraphs. The effect, the input/output type, whether it has a ▶ Run
(GPU/ffmpeg) or is instant/browser-side. Note auto-spawned pickers if any.>

## When to use it

- <concrete creative situation>
- <another>
- <another>

## Parameters

### <param_name>
<What it controls, the real range/default/options from define_schema, and how it
changes the result. Give a sensible starting value.>

<...one subsection per real input, in schema order. Group trivially related ones.>

## Outputs

| Output | Type | Meaning |
|---|---|---|
| **<name>** | `<TYPE>` | <what downstream gets> |

## Tips

- <gotchas, performance notes, common mistakes — only real ones>

## Related nodes

- **<Node>** — <why related>
```

### B. Flagship node (rich in-browser editor: Layer Editor, Storyboard, Score/MIDI
editors, Scene3D, Material, etc.) — target 90-160 lines

Same header + "What this node does" + "When to use it", then expand with:

- **## The editor** — walk through the UI panels/tools as a creator sees them. Read
  the Vue component under `src/` to be accurate about panels, tools, shortcuts.
- **## Workflow / step by step** — a realistic end-to-end pass.
- **## Inputs and outputs** — table.
- **## Tips** and **## Related nodes** as above.

## zh.md rules

- Same structure and section order as en.md; faithful, natural Simplified Chinese.
- Keep code/type tokens in English: `COMFYTV_VIDEO`, `define_schema`, node display
  names in parentheses on first mention, e.g. `辉光 (Glow)`.
- Keep the same links. Translate prose, not URLs or type names.
- Match the bilingual style of existing docs (see `ComfyTV.ImageStage/zh.md`).

## Consistency checklist before you finish each node

- [ ] Title = the node's real `display_name`.
- [ ] Every documented parameter exists in `define_schema` with the right options.
- [ ] Input/output types match the schema.
- [ ] en.md and zh.md cover the same sections and facts.
- [ ] No invented features, no fabricated analogies.
