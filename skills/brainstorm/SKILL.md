---
name: brainstorm
description: Pre-production ideation on the canvas. Use when the user wants to develop an idea, script, campaign, character, or storyboard concept BEFORE generating anything — invoked via /brainstorm or when they ask to "brainstorm", "develop the idea", "帮我想想", or explore directions. Converges one decision at a time and lands every confirmed element on the canvas as a stage; defers all generation until the direction is locked.
---

# Brainstorm

## Purpose

Turn a vague idea into locked creative direction, materialized as canvas
stages — before any credits or GPU time are spent on generation.

## Rules

1. **One question per round.** Ask exactly one decision at a time with
   `ask_user` (2–4 concrete options, `allow_other: true`). Never dump a
   questionnaire into prose.
2. **Maximize distinction between options.** Vary audience, structure,
   format, or pacing — not surface adjectives. "Neon noir vs pastel
   documentary" beats "blue vs slightly bluer".
3. **Confirmed decisions land on the canvas immediately.** After each
   answer, write the element to the canvas so nothing lives only in chat:
   - premise / logline / world rules → a text stage (`add_stage`, kind
     text) with the content in `main_prompt`
   - shot lists / beats → a storyboard or sequence stage when available,
     else numbered text stages
   - characters → one text stage per character (name, role, look, voice)
   - group related stages (`graph_edit` `create_group`) and title them
4. **Mark states as you go.** Use `graph_edit` op `set_review`:
   `approved` once the user confirms an element, `review` for drafts
   awaiting their call, `archived` for rejected directions you keep for
   reference. Never delete a rejected option the user might revisit.
5. **Defer generation.** Do not run image/video stages during
   brainstorming. Only after the user confirms the direction is locked,
   propose the first generation step — and respect the chat's run mode.
6. **Save durable preferences.** When the user states a standing choice
   ("always 16:9", "stay in this palette"), store it with `remember`.

## Flow

1. Restate the starting idea in one sentence; confirm with `ask_user`.
2. Loop: pick the highest-leverage open decision → ask → land the answer
   on canvas → mark `approved`.
3. When premise, audience, format and key beats are all approved,
   summarize the locked direction in chat and list the canvas stages
   created.
4. Offer the first production step (which stage to generate first).
