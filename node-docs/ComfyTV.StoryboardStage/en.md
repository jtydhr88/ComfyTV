# Storyboard Stage

> Uses an LLM to expand a short story premise into a structured shot list (16 fields per shot) for Shot Images—this node does not generate pictures itself.

## What this node does

**Storyboard Stage** (display name **Storyboard**) is a **shot-list generator**. Write a story premise in **main_prompt**, set total duration and shot count, click **▶ Run**, and the LLM returns **`COMFYTV_STORYBOARD`**—JSON with per-shot duration, scene description, shot size, dialogue, image prompts, and more across **16 fields**.

An embedded **shot-board editor** lets you edit each shot after the run before wiring **Shot Images Stage** to generate one image per shot.

**Important**: Storyboard output is **structured text**, not images. Per-shot frames come from **Shot Images Stage**.

## When to use it

- Pre-production for shorts, ads, or MVs: shot list first, then keyframes.
- Fix **shot_count** (e.g. 6) and **total_duration_s** (e.g. 30s) so the LLM splits time across shots.
- Define **characters** cards so the same character stays consistent across shots.
- Pipeline: Text Stage → Storyboard → Shot Images → Video Stage.

## How ComfyTV stages work

- **▶ Run** executes only the LLM subgraph in [`workflows/storyboard/`](https://github.com/jtydhr88/ComfyTV/tree/main/workflows/storyboard).
- ComfyTV builds a structured LLM prompt from **main_prompt + upstream texts**, **total_duration_s**, **shot_count**, and **characters** (see `_storyboard_llm_prompt`), requiring **exactly** the requested number of shots.
- Raw LLM text is parsed via `_shape_storyboard_from_llm` into JSON and snapshotted; Shot Images reads **storyboard** and loops image workflows per shot.

Output uses `graph_output_first` (not SaveImage)—must be declared in the workflow preset.

## Types (COMFYTV_STORYBOARD)

| ComfyTV type | What it is | vs native ComfyUI |
| --- | --- | --- |
| `COMFYTV_STORYBOARD` | Structured shot-list JSON snapshot | No native ComfyUI equivalent |
| `COMFYTV_TEXT` | Plain string | Storyboard has a `shots` array schema |

Do not wire Storyboard to Image Stage **texts**; use **Shot Images Stage** **storyboard** input, or copy a shot’s **image_prompt** manually.

Bridge nodes focus on Image/Video/Audio/Text; Storyboard is used inside ComfyTV pipelines.

## Parameters

### workflow

LLM backend from [`workflows/storyboard/`](https://github.com/jtydhr88/ComfyTV/tree/main/workflows/storyboard).

The repo README notes the folder **may not yet ship full JSON workflows**; the dropdown may show runner placeholder stubs (e.g. Qwen Storyboard stub). Add workflow + `_preset.json` to the folder and restart ComfyUI to select your own.

Docs: [workflows/storyboard/README.md](https://github.com/jtydhr88/ComfyTV/blob/main/workflows/storyboard/README.md)

### main_prompt (story premise)

One or a few sentences on core conflict or scene beats.

**Example:** `A race driver crashes on a rainy track; flashbacks reveal what caused the accident.`

Upstream **texts** append with newlines.

### total_duration_s

Target total seconds (**2–600**, default **30**). The LLM assigns per-shot **duration** values that should sum near this.

### shot_count

**Exact** number of shots (**1–25**, default **6**). The LLM is instructed to output exactly this many.

### characters (character cards)

Optional, one character per line, e.g.:

```
- Lin_Yue_driver: 32yo male, lean build, white racing suit
- Shen_Zhao_reporter: 28yo female, short hair, holding mic
```

When a shot references a character, the LLM repeats the full description for prompt independence.

### texts

Autogrow slot for Text Stage expansions as extra premise.

### storyboard_data

Hidden, driven by the **shot-board editor**. Edit in the UI table—not by hand in the widget.

### custom_params

Sidebar: max_length, temperature, seed, etc.

## Sixteen fields per shot (output JSON)

Each shot object includes:

| Field | Meaning |
| --- | --- |
| shot_no | Shot number |
| duration | Seconds for this shot |
| scene_purpose | Scene / narrative description |
| character | Character name |
| character_desc | Appearance description |
| character_img / reference_img | Character / reference images (optional) |
| shot_size | Framing (close-up, wide, etc.) |
| action | Character action |
| emotion | Mood |
| scene_tags | Scene tags |
| lighting | Lighting mood |
| sfx | Sound effects hint |
| dialogue | Spoken lines |
| image_prompt | **Still frame** text-to-image prompt |
| motion_prompt | **Video motion** prompt for Video Stage |

**Shot Images** mainly uses **image_prompt**; Video Stage can use **motion_prompt**.

## Outputs

| Output | Type | Meaning | Downstream |
| --- | --- | --- | --- |
| **storyboard** | `COMFYTV_STORYBOARD` | Full shot-list JSON snapshot | **Shot Images Stage** **storyboard** |

## Step by step for beginners

1. Add **Project**; optional Text Stage → **texts** on Storyboard.
2. **ComfyTV → Generate → Storyboard**.
3. Pick an installed LLM backend (Qwen etc.—[models.md](https://github.com/jtydhr88/ComfyTV/blob/main/docs/models.md)).
4. **main_prompt**: 1–3 sentence outline; **total_duration_s** `30`, **shot_count** `6`.
5. Fill **characters** if you have fixed roles.
6. **▶ Run**; review six shots in the editor; tweak **image_prompt** as needed.
7. Add **Shot Images Stage**, wire **storyboard** → pick image workflow → Run.
8. Pick one shot image → **Video Stage I2V**; use **motion_prompt** for motion description.

## Full guides (recommended reading)

> This page covers **one node only**. For end-to-end workflows, multi-stage pipelines, type conversion, and design rationale, see the [ComfyTV user guides](https://github.com/jtydhr88/ComfyTV/tree/main/docs) on GitHub:

| Guide | Contents |
| --- | --- |
| [Getting started](https://github.com/jtydhr88/ComfyTV/blob/main/docs/getting-started.md) | Install, canvas basics, per-stage Run, snapshots, Project, Image Picker |
| [Generate](https://github.com/jtydhr88/ComfyTV/blob/main/docs/generate.md) | Text, Image, Video, Music, and Speech stages and workflow selection |
| [Compose](https://github.com/jtydhr88/ComfyTV/blob/main/docs/compose.md) | Image Picker, Compare, Storyboard→Shot Images, timeline |
| [Custom workflows](https://github.com/jtydhr88/ComfyTV/blob/main/docs/custom-workflows.md) | Import your ComfyUI workflow JSON without Python changes |

## Repository and workflows

| Resource | Link |
| --- | --- |
| **GitHub repository** | https://github.com/jtydhr88/ComfyTV |
| **User guides index** | https://github.com/jtydhr88/ComfyTV/tree/main/docs |
| **Built-in workflows** | https://github.com/jtydhr88/ComfyTV/tree/main/workflows |
| **Model checklist** | https://github.com/jtydhr88/ComfyTV/blob/main/docs/models.md |
| **This node's workflow folder** | https://github.com/jtydhr88/ComfyTV/tree/main/workflows/storyboard |
| **Workflow README** | https://github.com/jtydhr88/ComfyTV/blob/main/workflows/storyboard/README.md |
| **Custom workflows** | https://github.com/jtydhr88/ComfyTV/blob/main/docs/custom-workflows.md |
## FAQ

**Q: No shot list / NotImplemented error?**  
A: Workflow may be a placeholder stub. Add a real LLM workflow under `workflows/storyboard/` with preset, or pick an implemented backend.

**Q: Can it output images directly?**  
A: No. Use **Shot Images Stage** or copy **image_prompt** to Image Stage.

**Q: Shot durations don’t add up?**  
A: Edit **duration** per shot in the editor; re-running Storyboard overwrites edits.

**Q: Cannot wire storyboard to Image Stage texts?**  
A: Wrong type—use **Shot Images Stage** or paste **image_prompt** text.

## Related nodes

- **Text Stage**—upstream premise expansion.
- **Shot Images Stage**—generates images from **storyboard**.
- **Image Stage**—single-shot manual generation (copy image_prompt).
- **Video Stage**—I2V using motion_prompt or Shot Images output.
- **Speech Stage**—TTS from shot **dialogue**.
- **Project**—project context.
