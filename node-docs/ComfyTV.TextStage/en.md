# Text Stage

> Generates text with a local LLM from your instructions—expand prompts, write descriptions, or feed context to image and video stages.

## What this node does

**Text Stage** is ComfyTV’s text generator. Write what you want the LLM to do in **main_prompt**, pick a **workflow** (a ComfyUI subgraph behind the scenes), click **▶ Run**, and the generated string appears in the node preview.

The output type is `COMFYTV_TEXT`—not a native ComfyUI string socket, but a project snapshot you can wire to **texts** on Image Stage or Video Stage so it merges into their prompts.

Text Stage can also take upstream **texts**, **images**, and **videos** as multimodal context (whether they are used depends on the workflow and preset bindings).

## When to use it

- Expand a short idea with an LLM, then feed Image / Video Stage for t2i or t2v.
- Generate product copy, narration, character bios, or other plain text.
- Merge multiple upstream text outputs via **texts**, appended to **main_prompt** with newlines.
- Draft story premises (Storyboard Stage has its own main_prompt too).

## How ComfyTV stages work

- A **stage** with **▶ Run** executes **only that node**—not the whole ComfyUI graph via global Queue.
- After a run, the text snapshot is stored in the project; downstream stages read it on their next run and **do not automatically re-run** Text Stage.
- The **workflow** dropdown lists subgraphs from [`workflows/text/`](https://github.com/jtydhr88/ComfyTV/tree/main/workflows/text). ComfyTV maps `main_prompt`, seed, max_length, etc. into that subgraph.

Text workflows have no `SaveImage`; ComfyTV reads the LLM node’s first string output via `graph_output_first` in the preset.

## Types (COMFYTV_TEXT vs native ComfyUI)

| ComfyTV type | What it is | vs native ComfyUI |
| --- | --- | --- |
| `COMFYTV_TEXT` | Text snapshot in the project | Not a native STRING socket |
| Native STRING | In-memory string | Cannot wire directly to ComfyTV **texts** inputs |

**Conversion:**

- Native → ComfyTV: **ComfyTV/Bridge** → **→ ComfyTV Text** (Run to snapshot)
- ComfyTV → native: **← ComfyTV Text** (load snapshot for native nodes)

See [bridges.md](https://github.com/jtydhr88/ComfyTV/blob/main/docs/bridges.md).

## Parameters

### workflow

Backend from [`workflows/text/`](https://github.com/jtydhr88/ComfyTV/tree/main/workflows/text). Built-in: **Local Qwen3 4B** (Qwen3 4B chat via `TextGenerate`). Empty or grey list → restart ComfyUI or check workflow files.

Models: [models.md](https://github.com/jtydhr88/ComfyTV/blob/main/docs/models.md).

### main_prompt

Your main instruction. Upstream **texts** append with newlines.

**Example:** `Write three short scene descriptions: a café at dawn, a rainy street, neon at night.`

### texts / images / videos

Autogrow slots for upstream stage outputs. Text is most common; images/videos are for multimodal workflows (Local Qwen3 4B is primarily text).

### custom_params

Extra parameters (max_length, seed, temperature) configured in the **ComfyTV** sidebar when the stage is selected—mapped into the subgraph.

### project_id / parent_output_id / force_run_token

UI-managed; bind Project context and output lineage.

## Outputs

| Output | Type | Meaning | Downstream |
| --- | --- | --- | --- |
| **text** | `COMFYTV_TEXT` | Generated string snapshot | **texts** on Image / Video / Storyboard Stage; Bridge ← ComfyTV Text |

## Step by step for beginners

1. Add **Project**, then **ComfyTV → Generate → Text Stage**.
2. **workflow** → **Local Qwen3 4B** (or your installed backend).
3. **main_prompt**: `Write a 20-word cyberpunk opening narration.`
4. Ensure Qwen3 4B is downloaded ([models.md](https://github.com/jtydhr88/ComfyTV/blob/main/docs/models.md)).
5. Click **▶ Run** and wait for text in the preview.
6. Add **Image Stage**; wire **text** → **texts** (or paste into main_prompt).
7. Run Image Stage to generate from the LLM output.

## Full guides (recommended reading)

> This page covers **one node only**. For end-to-end workflows, multi-stage pipelines, type conversion, and design rationale, see the [ComfyTV user guides](https://github.com/jtydhr88/ComfyTV/tree/main/docs) on GitHub:

| Guide | Contents |
| --- | --- |
| [Getting started](https://github.com/jtydhr88/ComfyTV/blob/main/docs/getting-started.md) | Install, canvas basics, per-stage Run, snapshots, Project, Image Picker |
| [Generate](https://github.com/jtydhr88/ComfyTV/blob/main/docs/generate.md) | Text, Image, Video, Music, and Speech stages and workflow selection |
| [Model files](https://github.com/jtydhr88/ComfyTV/blob/main/docs/models.md) | Checkpoints, LoRAs, and folder paths per workflow |
| [Custom workflows](https://github.com/jtydhr88/ComfyTV/blob/main/docs/custom-workflows.md) | Import your ComfyUI workflow JSON without Python changes |

## Repository and workflows

| Resource | Link |
| --- | --- |
| **GitHub repository** | https://github.com/jtydhr88/ComfyTV |
| **User guides index** | https://github.com/jtydhr88/ComfyTV/tree/main/docs |
| **Built-in workflows** | https://github.com/jtydhr88/ComfyTV/tree/main/workflows |
| **Model checklist** | https://github.com/jtydhr88/ComfyTV/blob/main/docs/models.md |
| **This node's workflow folder** | https://github.com/jtydhr88/ComfyTV/tree/main/workflows/text |
| **Workflow README** | https://github.com/jtydhr88/ComfyTV/blob/main/workflows/text/README.md |
| **Custom workflows** | https://github.com/jtydhr88/ComfyTV/blob/main/docs/custom-workflows.md |
## FAQ

**Q: Run finished but no text / “no runner registered”?**  
A: Workflow label mismatch. Restart ComfyUI or re-bind the preset in the sidebar.

**Q: Cannot connect text to Image Stage?**  
A: Use **texts** or a `COMFYTV_TEXT`-compatible socket—not native STRING. Use Bridge if needed.

**Q: Changed main_prompt but Image still uses old text?**  
A: Snapshots—downstream does not re-run Text Stage. Re-run Text Stage, then Image Stage.

## Related nodes

- **Image Stage / Video Stage**—consume `COMFYTV_TEXT` as prompt context.
- **Storyboard Stage**—LLM output as structured storyboard JSON, not plain text.
- **Bridge → / ← ComfyTV Text**—interop with native ComfyUI text.
- **Project**—project context.
