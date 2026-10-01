**English** | [简体中文](bot.zh.md)

# ComfyTV Bot

> A chat agent docked beside your canvas: describe what you want, and it builds nodes, runs workflows, waits for renders, looks at the results and iterates — powered by your locally installed agent CLI, with no API keys stored anywhere.

## What it is

The **ComfyTV Bot** is a panel docked to the right of the canvas — open it with the agent button at the top right of the workflow tabs. The panel is the one the ComfyUI frontend ships for its cloud agent, vendored into ComfyTV (see `src/agent/native/UPSTREAM`) and wired to ComfyTV's own local agent backend. Every message you send spawns an agent turn that can use the full [ComfyTV MCP toolset](mcp.md) — and *only* that toolset: it can read and edit your canvas, run stages, inspect images, and manage your library, but it has no shell, no file system access, and no other tools.

Typical asks:

- *"Add an image stage with Z-Image Turbo, prompt a neon cat at night, 16:9, and run it."*
- *"Use that image as the reference for a 5-second image-to-video, wait for it, and QC the first frame."*
- *"Here's my song and its timed lyrics — trim it into sections and build an audio-driven MV section by section."*
- *"Look at my canvas and tell me why the video stage failed."*
- *"Open the Director timeline and re-take clip 3 with a slower camera."*
- *"I just linked a new workflow — bind seed, width and height for me."*

## No API keys, by design

The bot does not talk to any cloud model API directly and ComfyTV never stores a key. Instead it drives an **agent CLI already installed on your machine** using that CLI's own login — or, with the Local LLM and ComfyUI LLM providers, a **model running on your own hardware**. Six providers ship today:

| Provider | Install | Sign in | Attachments |
| --- | --- | --- | --- |
| [Claude Code](https://claude.com/claude-code) | `npm install -g @anthropic-ai/claude-code` | run `claude`, log in once | images / video / audio |
| [Codex](https://developers.openai.com/codex) | `npm install -g @openai/codex` | `codex login` | images / video / audio |
| [Qwen Code](https://qwenlm.github.io/qwen-code-docs/) | official install script (see its docs) | run `qwen`, then `/auth` | not yet |
| DeepSeek Harness | `dsh` (DeepSeek Harness command line) | sign in inside the DeepSeek Harness app | images, on vision models |
| Local LLM | any OpenAI-compatible local server | none — set the endpoint URL in Settings | not yet |
| ComfyUI LLM | a Qwen3- or Gemma-family checkpoint in `models/text_encoders` | none | not yet |

Prerequisites:

1. Install at least one agent CLI and sign in once — or run a local model server and set its URL in Settings.
2. In ComfyTV **Settings → Agent & MCP**, enable **MCP server** and then **ComfyTV Bot** (the bot requires MCP — it's how the agent reaches your canvas).

The bar above the chat picks the engine (and, per engine, the model) for new chats; a chat keeps the engine it started with, so switching the engine starts a new chat. A red dot on the engine chip means it is not installed or not signed in — hover it for the reason.

Provider isolation is per-engine: Claude Code runs with a strict per-turn MCP config and a tool whitelist; Codex runs `codex exec` sandboxed to the bot's working directory with shell and web search disabled, every MCP server except ComfyTV's turned off, and its localhost canvas-tool approvals routed through Codex's automatic reviewer (headless runs cannot prompt); Qwen Code runs against a project-scoped `.qwen/settings.json` inside the bot's working directory (ComfyTV MCP server only, built-in shell/file tools excluded); DeepSeek Harness runs `dsh` in ACP mode with a dedicated profile whose built-in tools are all disabled — your global CLI configuration and the app's own settings are never touched.

## Local LLM provider

The Local LLM provider needs no agent CLI at all: ComfyTV runs the agent loop itself against any OpenAI-compatible endpoint — LM Studio, llama.cpp's `llama-server`, vLLM, Ollama and friends. Point **Settings → Agent & MCP → Local LLM endpoint** at the server's base URL (e.g. `http://127.0.0.1:1234/v1`); the model dropdown suggestions come straight from the endpoint's `/models` list. Keyless local endpoints only — consistent with the no-stored-keys rule (a `COMFYTV_LOCAL_LLM_API_KEY` environment variable is honoured for LAN servers that insist on a token, but nothing is ever stored).

Details worth knowing:

- Conversations replay from ComfyTV's own transcript (the endpoint holds no session), so history survives server restarts.
- The bot exposes the core canvas toolset (build / run / wait / look) rather than all tools — small local models drown in the full catalog.
- `wait_stage` is looped provider-side, so the model is only consulted when the render actually finishes.
- If the [LM Studio](https://lmstudio.ai) `lms` CLI is present, the driver model is unloaded from VRAM while a render runs and reloaded afterwards — on a single-GPU machine the canvas gets the whole card during generation.

## ComfyUI LLM provider

The ComfyUI LLM provider goes one step further: no external server either — inference runs **inside ComfyUI itself**, on the same text-encoder stack the core `TextGenerate` node uses. Drop a generation-capable Qwen3- or Gemma-family checkpoint (e.g. Qwen3 8B, or the Gemma 3/4 encoders LTX2 already uses) into `models/text_encoders` and the provider appears; pick the checkpoint under **Settings → Agent & MCP → ComfyUI LLM model** (blank = first found). Qwen3 has native tool-calling training and is the best driver; Gemma follows the same convention by instruction.

Compared to the Local LLM provider:

- Nothing to install or configure — no endpoint URL, no server process.
- VRAM is arbitrated by ComfyUI's model management: while a render runs, the LLM is offloaded automatically and reloaded on the next turn. No `lms`-style juggling.
- Tool calls use the Hermes convention Qwen3 was trained on (`<tool_call>` blocks), rendered and parsed by ComfyTV.
- Turns are served one at a time from an OpenAI-compatible shim at `/comfytv/llm/v1` (non-streaming) — other local apps on your machine may point at it too while the bot is enabled.

## DeepSeek Harness provider

Each turn starts `dsh` (the DeepSeek Harness command line) in ACP mode and uses its own login; ComfyTV never reads or stores credentials.

Setup:

1. Install the DeepSeek Harness desktop app and sign in to your DeepSeek account.
2. Put `dsh` on PATH: **Manage dsh Command…** in the app menu, or `npm install -g @deepseek-ai/dsh`.

- **Model and billing**: every entry in the model menu says whether it bills the **desktop account** or the **API key**. Blank uses the first desktop-account model and never falls back to the API key. The list appears after the first chat turn.
- **Tools**: all Harness built-in tools (shell, files, web, sub-agents, …) are disabled; only ComfyTV MCP tools are callable.
- **Sessions**: each chat has one Harness session and survives a ComfyTV restart. ACP cannot fork, so these chats cannot be branched. Deleting a ComfyTV chat does not delete the Harness session.
- **Attachments**: images only, and only when the selected model accepts them; current DeepSeek models do not, so the turn is refused before it is sent.
- **Files**: working directories live under ComfyUI's user directory in `comfytv/bot-home-deepseek-harness/chats/<chat id>`; a dedicated profile is created at `~/.dsh/profiles/comfytv-acp` on first use.

## Using the panel

- **Canvas**: the bot always works on the tab on screen; switch tabs and it follows.
- **Conversations** are persistent: the history screen (clock icon) lists, renames and removes chats; each chat remembers its full context across turns (the CLI resumes the same session).
- **Streaming**: replies stream in live; tool activity shows as an activity trace per turn (e.g. `add_stage`, `wait_stage`) that folds into a summary when the turn ends — nodes appear and run on your canvas as it goes.
- **Mentions**: type **`@`** to reference a node (a stage) on the canvas, or select nodes with the picker to attach them to the message.
- **Attachments**: on providers that support them, attach images / video / audio from ComfyTV's asset library via the **+** button, by dragging asset cards from the Assets tab, or by dropping / pasting files (they are imported into the library first, so the agent can hand them to stages as `asset_refs`). Videos are summarized with a middle frame, audio with a waveform, so the agent can actually *see* what you sent.
- **Skills**: start a message with **`/<name>`** to run it under an installed [Agent Skill](skills.md); the agent reads that skill first and follows its instructions for the task.
- **Run permissions**: the popover next to the send button switches between asking before the agent runs a workflow and running automatically.
- **Stop** aborts the current turn; partial output is kept.
- Closing the panel does not interrupt a running turn — the turn continues server-side and the transcript catches up when you reopen it.

## How it works, briefly

CLI providers spawn a fresh headless process per turn and resume the chat's session. DeepSeek Harness starts `dsh` in ACP mode each turn and resumes its session. ComfyTV's database keeps a display mirror of the transcript. Canvas writes still follow MCP rules — an open ComfyTV page executes them, whether it is in Comfy Desktop or a browser.

## Troubleshooting

| Symptom | Cause / fix |
|---|---|
| No agent button at the top right | **Enable ComfyTV Bot** is off (Settings → Agent & MCP), which itself requires **Enable MCP server**; the button also needs a ComfyUI frontend that ships the agent panel slot (1.53 or newer) |
| Red dot on the engine chip | That agent CLI is not installed or not signed in — install one from the table above and sign in, then reopen the panel |
| Bot says it can't reach the canvas | No ComfyTV page open (or page websocket dropped after a server restart — hard-refresh) |
| Long renders: bot seems idle | It's inside a blocking `wait_stage` — the tool chip shows it; this is normal and cheap |

## See also

- [Agent access (MCP)](mcp.md) — the toolset the bot uses, and how to connect external agents
- [Agent Skills](skills.md) — instruction packs the bot (and external agents) can invoke
- [Sidebar](sidebar.md) — the Settings panel with both switches
