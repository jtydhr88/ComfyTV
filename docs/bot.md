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

The bot does not talk to any cloud model API directly and ComfyTV never stores a key. Instead it drives an **agent CLI already installed on your machine** using that CLI's own login — or, with the Local LLM provider, a **model server running on your own hardware**. Four providers ship today:

| Provider | Install | Sign in | Attachments |
| --- | --- | --- | --- |
| [Claude Code](https://claude.com/claude-code) | `npm install -g @anthropic-ai/claude-code` | run `claude`, log in once | images / video / audio |
| [Codex](https://developers.openai.com/codex) | `npm install -g @openai/codex` | `codex login` | images / video / audio |
| [Qwen Code](https://qwenlm.github.io/qwen-code-docs/) | official install script (see its docs) | run `qwen`, then `/auth` | not yet |
| Local LLM | any OpenAI-compatible local server | none — set the endpoint URL in Settings | not yet |

Prerequisites:

1. Install at least one agent CLI and sign in once — or run a local model server and set its URL in Settings.
2. In ComfyTV **Settings → Agent & MCP**, enable **MCP server** and then **ComfyTV Bot** (the bot requires MCP — it's how the agent reaches your canvas).

With more than one provider available, the ➕ button asks which engine a new chat should use; each chat remembers its provider. If no provider is found, the panel shows an install guide instead of a chat box.

Provider isolation is per-engine: Claude Code runs with a strict per-turn MCP config and a tool whitelist; Codex runs `codex exec` sandboxed to the bot's working directory with shell and web search disabled, every MCP server except ComfyTV's turned off, and its localhost canvas-tool approvals routed through Codex's automatic reviewer (headless runs cannot prompt); Qwen Code runs against a project-scoped `.qwen/settings.json` inside the bot's working directory (ComfyTV MCP server only, built-in shell/file tools excluded) — your global CLI configuration is never touched.

## Local LLM provider

The Local LLM provider needs no agent CLI at all: ComfyTV runs the agent loop itself against any OpenAI-compatible endpoint — LM Studio, llama.cpp's `llama-server`, vLLM, Ollama and friends. Point **Settings → Agent & MCP → Local LLM endpoint** at the server's base URL (e.g. `http://127.0.0.1:1234/v1`); the model dropdown suggestions come straight from the endpoint's `/models` list. Keyless local endpoints only — consistent with the no-stored-keys rule (a `COMFYTV_LOCAL_LLM_API_KEY` environment variable is honoured for LAN servers that insist on a token, but nothing is ever stored).

Details worth knowing:

- Conversations replay from ComfyTV's own transcript (the endpoint holds no session), so history survives server restarts.
- The bot exposes the core canvas toolset (build / run / wait / look) rather than all tools — small local models drown in the full catalog.
- `wait_stage` is looped provider-side, so the model is only consulted when the render actually finishes.
- If the [LM Studio](https://lmstudio.ai) `lms` CLI is present, the driver model is unloaded from VRAM while a render runs and reloaded afterwards — on a single-GPU machine the canvas gets the whole card during generation.

## Using the panel

- **Conversations** are persistent: the list supports pin, rename and delete; each chat remembers its full context across turns (the CLI resumes the same session).
- **Streaming**: replies stream in live; tool calls appear as collapsible chips (e.g. `add_stage`, `wait_stage`) so you can watch it work the canvas in real time — nodes appear and run on your canvas as it goes.
- **Stop** aborts the current turn; partial output is kept.
- Switching sidebar tabs (or closing the panel) does not interrupt a running turn — the turn continues server-side and the transcript catches up when you return.

## How it works, briefly

Each turn spawns a fresh CLI process in headless mode, locked down to the ComfyTV MCP server (`--strict-mcp-config`, tools whitelisted to `mcp__comfytv__*`), resuming the chat's session for continuity. The conversation state lives with the CLI; ComfyTV's database keeps a display mirror of the transcript. Canvas writes still follow MCP rules — an open ComfyTV page executes them, whether it is in Comfy Desktop or a browser.

## Troubleshooting

| Symptom | Cause / fix |
|---|---|
| No ✨ icon in the sidebar | **Enable ComfyTV Bot** is off (Settings → Agent & MCP), which itself requires **Enable MCP server** |
| Panel shows an install guide | No agent CLI found — install one from the table above and sign in, then *Check again* |
| Bot says it can't reach the canvas | No ComfyTV page open (or page websocket dropped after a server restart — hard-refresh) |
| Long renders: bot seems idle | It's inside a blocking `wait_stage` — the tool chip shows it; this is normal and cheap |

## See also

- [Agent access (MCP)](mcp.md) — the toolset the bot uses, and how to connect external agents
- [Sidebar](sidebar.md) — the Settings panel with both switches
