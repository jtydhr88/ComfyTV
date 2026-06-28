# Project

> Names and binds the ComfyTV project context so every stage output is stored under one project and restored when you reload the workflow.

## What this node does

**Project** is the root context node for a ComfyTV canvas. It does not generate anything and has **no ▶ Run** button. It tells ComfyUI which project you are working in.

Every Image, Video, Audio, and other stage you run saves its snapshot into the **current project** asset library. When you reopen the same workflow, the Project node restores the project id and name so downstream stages can keep using prior snapshots.

If you are new to ComfyUI workflows, think of Project as a folder label shared by all stages on the canvas.

## When to use it

- Place one Project node at the **start** of every new ComfyTV pipeline.
- Switch between separate tasks (e.g. “Ad A” vs “Short B”) via project name or the UI project picker.
- Keep generated results organized by project instead of scattered in ComfyUI’s default output folder.
- Make it clear which project a saved workflow belongs to when collaborating or backing up.

## How ComfyTV stages work

ComfyTV is built around **per-stage runs** and **snapshots**:

- Stages with **▶ Run** execute only themselves—they do not queue the entire graph through ComfyUI’s global Queue.
- After a run, the result is stored as a snapshot; downstream stages read that snapshot on their next run and **do not automatically re-run upstream**.
- Project supplies `project_id` so all stages write to the same project storage.

Project does not participate in execution, but it defines *where* results go. Some stages may still run without Project, but project archiving and the asset library work best when Project is present—one per canvas is recommended.

## Parameters

### project_name

The visible label on the canvas, e.g. `my_short_v1`. You can rename it anytime; new runs attach to the project managed by the UI.

**Common mistake**: Renaming alone does not move old assets—they stay tied to the original `project_id`. Use the UI project picker to switch projects.

### project_id

Internal id bound to `projectStore.currentProjectId` and **saved with the workflow**. Usually leave it alone; editing it manually can break asset linkage.

### schema_version

Hidden field marking the ComfyTV workflow schema version. The frontend warns if a loaded workflow’s version differs from the installed plugin.

## Outputs

This node has **no output sockets**. It only sets context.

## Step by step for beginners

1. In ComfyUI: **Add Node** → **ComfyTV** → **Project** → **Project**.
2. Set **project_name**, e.g. `test_t2i`.
3. Add an **Image Stage** (or any generate stage) to the right and wire it up.
4. Run the Image Stage, then open the ComfyTV **Assets** sidebar and confirm results appear under the current project.
5. **Save** the workflow; on reload, project name and id restore automatically.
6. For a new separate task, change **project_name** or switch projects in the UI so outputs do not mix.

## Repository links

| Resource | Link |
| --- | --- |
| ComfyTV repository | https://github.com/jtydhr88/ComfyTV |
| Getting started | https://github.com/jtydhr88/ComfyTV/blob/main/docs/getting-started.md |
| All user docs | https://github.com/jtydhr88/ComfyTV/tree/main/docs |


## Full guides (recommended reading)

> This page covers **one node only**. For end-to-end workflows, multi-stage pipelines, type conversion, and design rationale, see the [ComfyTV user guides](https://github.com/jtydhr88/ComfyTV/tree/main/docs) on GitHub:

| Guide | Contents |
| --- | --- |
| [Getting started](https://github.com/jtydhr88/ComfyTV/blob/main/docs/getting-started.md) | Install, canvas basics, per-stage Run, snapshots, Project, Image Picker |

## Repository and workflows

| Resource | Link |
| --- | --- |
| **GitHub repository** | https://github.com/jtydhr88/ComfyTV |
| **User guides index** | https://github.com/jtydhr88/ComfyTV/tree/main/docs |
| **Built-in workflows** | https://github.com/jtydhr88/ComfyTV/tree/main/workflows |
| **Model checklist** | https://github.com/jtydhr88/ComfyTV/blob/main/docs/models.md |
| **Custom workflows** | https://github.com/jtydhr88/ComfyTV/blob/main/docs/custom-workflows.md |
## FAQ

**Q: Is Project required?**  
A: Strongly recommended. Without it, project archiving and asset filtering are incomplete.

**Q: Can I use two Project nodes?**  
A: Possible but confusing—stages share one context. Use one Project per canvas.

**Q: Do assets disappear after saving the workflow?**  
A: No. Snapshots live in ComfyTV project storage. Reloading the workflow with the same `project_id` keeps assets. Back up your ComfyUI data directory when moving machines.

## Related nodes

- **Image Stage / Video Stage / Audio Stage** and other Generate nodes—use Project context.
- **Load Image from Asset** and other asset loaders—pick from the current project library.
- **Image Picker**—select one image from a batch for editing.
