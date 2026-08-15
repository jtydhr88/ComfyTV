# Director

> A clip timeline that renders a whole short film segment by segment: per-clip prompts, references, transitions and seeds, with content-addressed caching so only edited clips re-render.

## What this node does

**Director** turns one node into a multi-shot production console. You lay out **clips** on a horizontal timeline — each clip carries its own prompt, duration, seed, optional workflow override, per-clip reference media and an outgoing transition — then press **▶ Run** once. ComfyTV renders the clips serially through the selected video workflow, stitches them with your transitions, and emits a single finished video.

The key economy is the **content-addressed cache**: every clip's render is keyed by its full recipe (prompt, seed, references, duration, workflow, shared settings). On the next Run, unchanged clips reuse their cached renders instantly and only the clips you touched are re-generated. Iterating on shot 3 of a five-shot film costs one shot, not five.

## When to use it

- Multi-shot short films where each shot needs its own prompt but shares a cast and style
- Iterating on individual shots without paying for the whole film again
- Chained generation where each clip continues from the previous clip's last frame

## How ComfyTV designed this

- **One timeline widget**: the whole edit lives in a single `timeline_data` JSON value, so undo, copy/paste and workflow saves carry the full film.
- **Shared cast + per-clip references**: asset references attached to the node itself act as the film-wide cast (stable ordinals across every clip); each clip can stack its own references on top. Mention ordinals merge: shared references come first, then the clip's own — `@image_0` means the same first cast member in every clip.
- **@mention = selection**: with no mentions a clip sends all of its reference pool; mentioning specific ordinals sends only those, in mention order.
- **Chain modes**: `off` renders clips independently; `prepend` feeds each clip the previous clip's last frame as an extra leading reference; `replace` swaps the clip's image references for that last frame — for strict visual continuity.
- **Adaptive Run**: edited clips → incremental render; a failed run with no edits → resume from the failure; a successful run with no edits → fresh seeds for the whole film (a new take).
- **Per-clip re-take**: each clip has a regenerate button that rerolls its seed and re-runs just that clip.
- **Agent access**: the [MCP tools](https://github.com/jtydhr88/ComfyTV/blob/main/docs/mcp.md) `director_get` / `director_edit` read and edit the same timeline programmatically.

## Types (COMFYTV_* vs native ComfyUI)

| ComfyTV type | What it is | vs ComfyUI |
|---|---|---|
| `COMFYTV_VIDEO` | Video URL snapshot | Bridge to/from `VIDEO` |

## Parameters

### workflow
The default video workflow for every clip (any label from your `video` workflow library). Individual clips may override it.

### resolution / aspect_ratio
Output tier (e.g. 720P) and aspect (e.g. 16:9), shared by every clip so the stitched film is uniform.

### generate_audio
Whether clip workflows should generate audio. Off when you plan to score the film separately.

### main_prompt
A film-wide prompt available to every clip; clip prompts can reference the shared cast with `@image_N` mentions.

### The timeline (editor)
Clips are added, dragged to reorder, and edge-dragged to resize (1–120 s each). Selecting a clip opens its editor: prompt with full @mention support, duration, transition (21 styles: cut, fade, dissolve, wipes, slides, circle, pixelize, zoom …) and transition duration, per-clip references, enable toggle, and the regenerate button.

## Outputs

| Output | Type | Meaning | Downstream |
|---|---|---|---|
| **video** | `COMFYTV_VIDEO` | The stitched film | Mux Audio, Video Clip, Upscale |

## Step by step

1. Add **Director**, pick a video **workflow** (e.g. an image-to-video or reference-to-video workflow).
2. Attach your cast as asset references on the node — these are `@image_0`, `@image_1`, … in every clip.
3. Add clips; give each a prompt, duration and transition.
4. **▶ Run** — watch per-clip progress on the timeline.
5. Unhappy with one shot? Select it, tweak the prompt or press regenerate. Only that clip re-renders.
6. Wire **video** into **Mux · Audio** with a music track to finish.

## Full guides (recommended reading)

| Guide | Contents |
| --- | --- |
| [Compose](https://github.com/jtydhr88/ComfyTV/blob/main/docs/compose.md) | Timelines, transitions, assembling films |
| [Agent access (MCP)](https://github.com/jtydhr88/ComfyTV/blob/main/docs/mcp.md) | Driving the Director from an agent |

## Repository and workflows

| Resource | Link |
| --- | --- |
| **GitHub repository** | https://github.com/jtydhr88/ComfyTV |
| **User guides index** | https://github.com/jtydhr88/ComfyTV/tree/main/docs |
| **Built-in workflows** | https://github.com/jtydhr88/ComfyTV/tree/main/workflows |

## FAQ

**Q: Why did every clip re-render after a successful run?**  
A: Running again with zero edits is treated as "give me a new take" — all seeds reroll. Edit any clip (or nothing at all before the first run) for incremental behavior.

**Q: Do shared and clip references collide in numbering?**  
A: No. The pool is merged with shared references first, so `@image_0` is the first shared reference in every clip; clip-local references continue the numbering.

**Q: Where did the seed field go?**  
A: Seeds are managed per clip behind the regenerate button — press it for a fresh take of that clip.

## Related nodes

- **Video Stage** — single-shot generation
- **Director Timeline** / **Timeline Video** — manual assembly from separate clips
- **Mux · Audio** — add a soundtrack to the finished film
