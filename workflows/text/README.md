**English** | [简体中文](README.zh.md)

# `text/` workflows

Workflows in this folder appear in the **Text Stage** dropdown. Take a prompt + optional context; produce a string.

## Stage inputs

- **Prompt** — the stage's main input.
- **Max output length** (`max_length`) — Text Stage widget.
- **Random seed** (optional).

## What your workflow needs

- A text-gen node whose **slot 0** output is the resulting string.
- The prompt input wired to the stage's prompt.
- LLM / CLIP loader.

Text outputs don't go through `SaveImage`. Result type is `graph_output_first`; ComfyTV reads slot 0 of that node's cached output. **You must declare this explicitly in the config** — auto-detect only finds save-class nodes, which text workflows usually don't have.

To add your own workflow see [docs/custom-workflows.md](../../docs/custom-workflows.md); to configure per-node bindings, select the stage on the canvas and open the left **ComfyTV** sidebar — see [docs/sidebar-config-editor.md](../../docs/sidebar-config-editor.md).

## What's here today

- **Local Qwen3 4B** (`local-qwen3-4b.json` + `_preset.json`) — Qwen3 4B chat LLM via `TextGenerate` (`clip_type=lumina2` routes the file as a chat model).

## Models referenced

See [docs/models.md](../../docs/models.md).
