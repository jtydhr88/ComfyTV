**English** | [简体中文](skills.zh.md)

# Agent Skills

> Skills are reusable instruction packs — a folder with a `SKILL.md` — that teach any agent working on your ComfyTV how to do a specific job well: a prompting methodology, a production pipeline, a house style. Install once; the [Bot](bot.md) and every [MCP](mcp.md)-connected agent can find and follow them.

## What a skill is

ComfyTV uses the open **Agent Skills** format (the same `SKILL.md` convention used by Claude Code and other agent products). A skill is a folder:

```
my-skill/
├── SKILL.md              # required: frontmatter + instructions
├── references/           # optional: deeper material, loaded on demand
│   └── checklist.md
└── agents/openai.yaml    # optional: display metadata
```

`SKILL.md` starts with YAML frontmatter and continues with plain Markdown instructions:

```markdown
---
name: my-skill
description: One paragraph saying what this skill does and when an agent should use it.
---

# My Skill

Step-by-step instructions the agent follows...
Deeper material: see [references/checklist.md](references/checklist.md).
```

Two fields matter:

- **`name`** — lowercase letters, digits and hyphens (e.g. `h3-cinematic-director`). It's the skill's identity everywhere: the `/` palette, the MCP prompt, the folder under `skills/`.
- **`description`** — the *when-to-use* paragraph. Agents see only this until they decide the skill matches the task, so make it specific: what the skill produces, what inputs it expects, what phrases should trigger it.

The format is **progressive**: agents first see just the name + description, read the full `SKILL.md` when the task matches, and open `references/` files only when the instructions point there. Long methodologies stay cheap.

## Where skills live

| Location | Contents |
|---|---|
| `ComfyTV/skills/` | **Built-in** skills that ship with ComfyTV |
| `<ComfyUI user dir>/comfytv/skills/` | **Your** skills — imports land here |

A user skill with the same `name` as a built-in one **overrides** it.

ComfyTV ships one built-in skill today: **`h3-cinematic-director`** — a director-level methodology for MiniMax H3 video production: shot design, the exact H3 prompt schema (T2VA/I2VA/FL2VA/L2VA/Ref2VA), continuity auditing, and single-variable repair. Try it with the shipped [H3 workflows](generate.md#video-stage).

## Managing skills

Open **Settings → Skills** in the [sidebar](sidebar.md):

- **Enable Agent Skills** — the global switch (on by default). Off = the `skill` tool and all skill prompts disappear from MCP.
- Each installed skill shows its source (built-in / user) and description, with a **per-skill toggle**.
- **Import** — upload a `.zip` containing one skill folder (a `SKILL.md` at the zip root, or inside a single top-level folder). Invalid packs are rejected with the reason.
- **Delete** — user skills only; built-in skills can only be disabled.

Changes apply immediately — the skill index is scanned fresh on every request, no restart needed. One caveat: long-lived external MCP clients cache the tool list per session, so reconnect them (or start a new session) after installing a skill.

## Using skills

**From the Bot** — type **`/`** in the chat input to open the skill palette; keep typing to filter, press Enter or click to select. The skill becomes a chip on your message and the agent reads it before acting:

```
/h3-cinematic-director  ⏎
shot-design: a rainy-alley chase opening, three shots
```

**From external agents (Claude Code, Codex, …)** — nothing to configure. The MCP `skill` tool's description carries a live index of installed skills, so a connected agent discovers them on its own and calls `skill(action='read')` when a task matches. Each enabled skill is also served as an **MCP prompt**: in Claude Code they appear as `/mcp__comfytv__<name>` slash commands for explicit invocation.

## Writing your own

1. Create a folder under `<user dir>/comfytv/skills/` (or build a `.zip` and import it).
2. Write `SKILL.md` — frontmatter `name` + `description`, then the instructions. Write for an agent, not a human: imperative steps, exact field names, hard rules, failure cases.
3. Put long reference material in `references/*.md` and link to it from `SKILL.md` — agents fetch those files through the same `skill` tool.
4. Check **Settings → Skills**: your skill should be listed and enabled. If it shows as invalid, the row tells you why (missing description, bad name, broken frontmatter).

Limits worth knowing: descriptions are capped at 1024 characters; individual reference files at 512 KB; imported zips at 16 MB (64 MB unpacked).

**Trust note**: a skill is instructions your agent will follow. Only install skills from sources you trust — treat a skill zip like you'd treat a script you're about to run.

## See also

- [ComfyTV Bot](bot.md) — the `/` palette lives in its chat input
- [Agent access (MCP)](mcp.md) — the `skill` tool and prompt mapping
- [Sidebar](sidebar.md) — the Settings panel that manages skills
