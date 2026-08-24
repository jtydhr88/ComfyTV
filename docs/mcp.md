**English** | [简体中文](mcp.zh.md)

# Agent access (MCP)

> ComfyTV ships an MCP server so AI agents can read and drive your canvas: build node graphs, run stages, wait for renders, inspect results with real vision, edit the native ComfyUI graph, and manage your workflow configuration — all through 45 tools, plus installed [Agent Skills](skills.md) served as MCP prompts.

## What it is

ComfyTV exposes a [Model Context Protocol](https://modelcontextprotocol.io) endpoint at `POST /comfytv/mcp` on your ComfyUI server. Any MCP-capable agent (Claude Code, or anything speaking streamable HTTP JSON-RPC) can connect and use ComfyTV as a set of tools.

The design has one important twist: **the canvas truth lives in the open ComfyTV page**. Read tools answer from the server, but write tools (adding nodes, setting prompts, running stages) are executed *by the open ComfyTV page* — inside Comfy Desktop or a browser — and the server relays commands to it over the websocket. No open page → write tools fail with a clear timeout message.

## Enabling

MCP is **off by default**. In the ComfyTV sidebar open **Settings → Agent & MCP** and turn on **Enable MCP server**. (The embedded [Bot](bot.md) additionally requires its own switch.)

## Connecting a client

For Claude Code:

```bash
claude mcp add --transport http comfytv http://127.0.0.1:8188/comfytv/mcp
```

For Codex, add the server to `~/.codex/config.toml`:

```toml
[mcp_servers.comfytv]
url = "http://127.0.0.1:8188/comfytv/mcp"
```

Any other MCP client: point it at the same URL with the streamable HTTP transport.
The handlers are stateless, but the server issues an `Mcp-Session-Id` on
`initialize` for clients that expect streamable-HTTP session management. No auth
is added on top of your ComfyUI instance, so treat network exposure of port 8188
accordingly.

## The tool catalog

**Read & discover**

| Tool | What it does |
|---|---|
| `server_info` | Version, stage count, mirror state, recent errors |
| `projects` | List/get projects |
| `stage_catalog` | Every stage type and workflow kind |
| `list_workflows` | Workflow library per kind |
| `get_canvas` | Live canvas snapshot (nodes, prompts, run states) |
| `get_stage` | One stage in full detail: every widget value, connections both ways, references, warnings |
| `outputs` | Render history per stage |
| `assets` / `resources` / `entries` | Asset library, LUT/font/soundfont files, prompt snippets |
| `jobs` / `exec_errors` / `servers` | Remote jobs, recent errors, machine list |
| `node_info` | Search ComfyUI's installed node classes and inspect their inputs/outputs |
| `skill` | List installed [Agent Skills](skills.md) and read their instructions — the tool's own description carries a live index of what's installed |

**Build & run**

| Tool | What it does |
|---|---|
| `add_stage` / `set_stage` | Create and configure stages: prompt, workflow, widgets, asset references, target server |
| `connect_stages` | Wire outputs to inputs (auto-matches types) |
| `run_stage` | Queue a run, exactly like the Run button |
| `wait_stage` | Block until the run lands an output or errors — no polling |
| `cancel_stage` | Stop an in-flight run |
| `remove_stage` | Delete a node |
| `arrange_canvas` | Tidy the canvas layout (rows, columns, grids) |

**Native ComfyUI graph**

| Tool | What it does |
|---|---|
| `graph_get` | Read the native canvas graph — every node, widget, link and group, ComfyTV or not |
| `graph_edit` | Batch-edit the native graph: add/remove/clone nodes, set widgets, wire links, group, collapse, bypass, pack/unpack subgraphs — one undo step |
| `graph_run` | Queue the native graph exactly like ComfyUI's Run button and wait for the outputs |
| `workflow_create` | Author a brand-new workflow file for a stage kind from an API-format graph |
| `canvas_command` | Whitelisted native commands: undo/redo, save, fit view, interrupt, refresh node definitions |
| `canvas_focus` | Select a node and glide the user's viewport to it — show the user what changed |

**See & judge**

| Tool | What it does |
|---|---|
| `view_image` | Returns the actual image (downscaled) so the agent can look at it |
| `fx_preview` | Render a ~1.2s window of a video through one FX stage's real filter chain and see its middle frame — iterate look params cheaply before a full render |
| `media_probe` | Video duration/fps/resolution/audio |
| `media_frame` | Extract a frame from a video as a PNG URL |
| `media_waveform` | Render an audio waveform image |
| `pick_output` | Choose among multi-image output candidates |

**Configure**

| Tool | What it does |
|---|---|
| `workflow_get` / `workflow_edit` | Read a workflow's input bindings and node inventory; bind/unbind stage values to workflow inputs, validated against the real graph |
| `stage_params` | Define custom stage parameters, then bind them as `option:<key>` |
| `asset_edit` | Save outputs into the asset library, rename, categorize |

**Rich editors**

| Tool | What it does |
|---|---|
| `scene_get/edit/capture/record` | Drive a Scene 3D stage: characters, lights, cameras, animation clips, camera paths and the multi-shot director timeline (add_shot/patch_shot/set_path) |
| `director_get/director_edit` | Read and edit the Director clip timeline |

## Patterns that matter

**The production loop.** `stage_catalog` → `add_stage` (prompt, workflow, `asset_refs`) → `connect_stages` → `run_stage` → `wait_stage` → `outputs` → `view_image` to QC → iterate.

**Waiting without polling.** `wait_stage` blocks server-side (default 25 s per call, max 170 s) and returns the new output the second it lands. On timeout it returns `after_output_id` — call again with it to keep waiting. Total wait is unbounded; long renders just take a few re-calls.

**Mentions are zero-based.** Prompt tokens like `@image_0` / `@video_0` address a stage's sendable media *per type*, starting at 0, in slot order (wired inputs first, then `asset_refs`). Out-of-range tokens expand to nothing — and the tools warn you when that happens.

**Real vision.** `view_image` is the only tool that returns pixels. For video QC: `media_frame` to pull a frame, then `view_image` to actually look at it. Never judge an image by its filename.

**Binding a freshly linked workflow.** `workflow_get` shows the API graph's node inventory; `workflow_edit` binds stage values with sources like `option:seed`, `computed:width` / `computed:height` (sizing engine), `main_prompt`, `upstream_image:value[0]` or `literal:...`. If the workflow needs a parameter ComfyTV has no key for, create one with `stage_params` first and bind `option:<its key>`. `reset_to_preset` is your undo.

**Multi-machine.** `servers` lists configured machines with live load; `set_stage {server: <id>}` routes a stage's runs there. Results land back on the local machine.

**Two graph layers.** Stage tools (`add_stage`/`set_stage`/…) work at the ComfyTV product layer; the `graph_*` family edits the underlying native ComfyUI graph — any node from any plugin. Use stages when one exists for the job; drop to `graph_edit` + `graph_run` to build raw pipelines, and `canvas_focus` to show the user what you changed.

**Skills.** When the user has [Agent Skills](skills.md) installed, the `skill` tool's description lists them; read a matching skill before acting and follow it. Each enabled skill is also exposed as an **MCP prompt** — in Claude Code they appear as `/mcp__comfytv__<skill-name>` slash commands for explicit invocation.

## Requirements and behavior notes

- Write tools need an open ComfyTV page in Desktop or a browser; the canvas mirror activates lazily after the first MCP call (retry `get_canvas` after ~10 s on a fresh connection).
- MCP clients cache `tools/list` per session — reconnect after the server gains new tools.
- If your client enforces a per-call tool timeout, pass a smaller `timeout_s` to `wait_stage` and re-call in slices.

## See also

- [ComfyTV Bot](bot.md) — the embedded chat agent built on these same tools
- [Agent Skills](skills.md) — instruction packs served through the `skill` tool and MCP prompts
- [Custom workflows](custom-workflows.md) — what bindings are, hand-edited
- [Sidebar](sidebar.md) — the Settings panel with the MCP switch
