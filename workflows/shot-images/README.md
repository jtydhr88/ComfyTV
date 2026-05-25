**English** | [简体中文](README.zh.md)

# `shot-images/` workflows

Workflows in this folder appear in the **Shot Images** dropdown. They iterate per-shot over a Storyboard, generating one image per shot.

## Stage inputs

- **Prompt** — usually a per-shot prompt; the host stage iterates internally and feeds each shot's prompt in turn.
- **Resolution**, **aspect ratio**, etc. — same as Image Stage.

## Relation to `image/`

Most t2i workflows work both as Image Stage and as Shot Images — same file, just called N times with different prompts. Authors typically keep a single file under `image/` and declare `kinds: ["image", "shot-images"]` in the config so it shows up in both dropdowns.

Only put a workflow here when it is **specifically** for Shot Images and should NOT appear in the Image Stage dropdown.

To add your own workflow see [docs/custom-workflows.md](../../docs/custom-workflows.md); to configure per-node bindings, select the stage on the canvas and open the left **ComfyTV** sidebar — see [docs/sidebar-config-editor.md](../../docs/sidebar-config-editor.md).

## What's here today

Nothing. Current Shot Images dropdown entries come from `image/`-folder workflows whose config declares the extra kind.
