**English** | [简体中文](bot.zh.md)

# ComfyTV Bot

> A chat agent embedded in the sidebar that drives your canvas: describe what you want, and it builds nodes, runs workflows, waits for renders, looks at the results and iterates — powered by your locally installed agent CLI, with no API keys stored anywhere.

## What it is

The **ComfyTV Bot** is a sidebar chat panel (the ✨ icon) backed by a local agent CLI. Every message you send spawns an agent turn that can use the full [ComfyTV MCP toolset](mcp.md) — and *only* that toolset: it can read and edit your canvas, run stages, inspect images, and manage your library, but it has no shell, no file system access, and no other tools.

Typical asks:

- *"Add an image stage with Z-Image Turbo, prompt a neon cat at night, 16:9, and run it."*
- *"Use that image as the reference for a 5-second image-to-video, wait for it, and QC the first frame."*
- *"Here's my song and its timed lyrics — trim it into sections and build an audio-driven MV section by section."*
- *"Look at my canvas and tell me why the video stage failed."*
- *"Open the Director timeline and re-take clip 3 with a slower camera."*
- *"I just linked a new workflow — bind seed, width and height for me."*

## No API keys, by design

The bot does not talk to any model API directly and ComfyTV never stores a key. Instead it drives the **agent already installed on your machine** — [Claude Code](https://claude.com/claude-code), [Codex](https://developers.openai.com/codex), or a local model served by [LM Studio](https://lmstudio.ai/) — using whatever login or model that backend has. The provider layer is pluggable, so other local agents can be added later.

Prerequisites:

1. Install Claude Code and sign in once (`npm install -g @anthropic-ai/claude-code`, then `claude` → login).
2. Or install the Codex CLI and sign in once (`codex login`). When both CLIs are present, Codex is used first.
3. Or run LM Studio with a local model loaded. The LM Studio provider talks to its OpenAI-compatible endpoint at `http://127.0.0.1:1234/v1` and can be configured with environment variables (see below).
4. In ComfyTV **Settings → Agent & MCP**, enable **MCP server** and then **ComfyTV Bot** (the bot requires MCP — it's how the agent reaches your canvas).

If no agent CLI is found, the panel shows an install guide instead of a chat box.

## Using the panel

- **Conversations** are persistent: the list supports pin, rename and delete; each chat remembers its full context across turns (the CLI resumes the same session).
- **Provider selector**: when more than one provider is available, a dropdown appears next to the new-chat button so you can pick Codex, Claude Code, or LM Studio per conversation.
- **Streaming**: replies stream in live; tool calls appear as collapsible chips (e.g. `add_stage`, `wait_stage`) so you can watch it work the canvas in real time — nodes appear and run on your canvas as it goes.
- **Stop** aborts the current turn; partial output is kept.
- Switching sidebar tabs (or closing the panel) does not interrupt a running turn — the turn continues server-side and the transcript catches up when you return.

## How it works, briefly

Each turn spawns a fresh CLI process in headless mode, locked down to the ComfyTV MCP server (`--strict-mcp-config`, tools whitelisted to `mcp__comfytv__*`), resuming the chat's session for continuity. The conversation state lives with the CLI; ComfyTV's database keeps a display mirror of the transcript. Canvas writes still follow MCP rules — an open ComfyTV tab executes them, so keep the tab open while the bot works.

## Troubleshooting

| Symptom | Cause / fix |
|---|---|
| No ✨ icon in the sidebar | **Enable ComfyTV Bot** is off (Settings → Agent & MCP), which itself requires **Enable MCP server** |
| Panel shows an install guide | No agent found — install Claude Code, Codex, or load a model in LM Studio, then *Check again* |
| Bot says it can't reach the canvas | No ComfyTV tab open (or tab websocket dropped after a server restart — hard-refresh) |
| Long renders: bot seems idle | It's inside a blocking `wait_stage` — the tool chip shows it; this is normal and cheap |

## LM Studio provider configuration

The LM Studio provider drives the canvas through LM Studio's local
OpenAI-compatible API. Configure it with environment variables:

- `LMSTUDIO_BASE_URL` — API base URL (default `http://127.0.0.1:1234/v1`).
- `LMSTUDIO_API_KEY` — optional bearer token.
- `LMSTUDIO_MODEL` — executor model id (for example `minicpm5-1b-...`).
- `LMSTUDIO_PLANNER_MODEL` — optional larger planner model id (for example `qwen/qwen3.8-27b`).
- `LMSTUDIO_HIGH_LEVEL=1` — use a small set of high-level tools (`generate_image`,
  `list_image_workflows`) instead of the raw 35 ComfyTV tools; recommended for
  small driver models.
- `LMSTUDIO_DEFAULT_WORKFLOW` — workflow label used when the model does not
  supply one (default `ComfyUI_Krea2 多LoRA 3.0`).
- `LMSTUDIO_UNLOAD_ON_WAIT=1` — unload the LM Studio model during long ComfyUI
  renders so the GPU stays free, then reload it afterwards.

## See also

- [Agent access (MCP)](mcp.md) — the toolset the bot uses, and how to connect external agents
- [Sidebar](sidebar.md) — the Settings panel with both switches
