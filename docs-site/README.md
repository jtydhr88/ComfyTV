# ComfyTV Docs Site

The published documentation for ComfyTV, built with [Mintlify](https://mintlify.com) and deployed to **comfytv.org**. This mirrors the setup of the official ComfyUI docs (`docs.comfy.org`).

## How content is sourced

We do **not** hand-write node pages twice. Content has a single source of truth inside the ComfyTV repo, and a sync script turns it into MDX + navigation:

| Source (in the repo) | Generated site pages |
|----------------------|----------------------|
| `../node-docs/ComfyTV.<Node>/{en,zh}.md` (in-app node help) | `node-reference/<slug>.mdx` + `zh/node-reference/<slug>.mdx` |
| `../docs/<topic>.md` / `<topic>.zh.md` (user guides) | `guides/<topic>.mdx` + `zh/guides/<topic>.mdx` |

Everything under `node-reference/`, `guides/`, and their `zh/` mirrors is **generated** — edit the source `.md` files, not the MDX. Hand-authored pages are only `index.mdx`, `zh/index.mdx`, and the site shell (`docs.json`, `custom.css`).

```bash
npm run sync           # regenerate MDX + patch docs.json navigation
npm run sync:dry-run   # report what would change, touch nothing
```

The node-reference grouping is curated in `scripts/sync-content.mjs` (`CATEGORY_GROUPS`). New documented nodes that are not yet grouped are reported and dropped into an "Uncategorized" group so nothing is silently missed.

## Local preview

Mintlify (`mint`) refuses to run on Node 25+. Use the wrapper script, which finds
an installed Node 22 LTS via nvm-windows and uses it **for that command only** —
your global `node -v` is never changed.

```powershell
.\scripts\mint.cmd install   # first time only
.\scripts\mint.cmd sync      # regenerate MDX from ../node-docs and ../docs
.\scripts\mint.cmd           # start dev server -> http://localhost:3000
.\scripts\mint.cmd check     # broken-link check
```

One-time prerequisite (if Node 22 is not installed): `nvm install 22`.

Prefer plain npm? Switch first with `nvm use 22`, run `npm install` / `npm run sync`
/ `npm run dev`, then `nvm use 25.9.0` to switch back. The wrapper just avoids that
dance.

## Deploy

Connect this folder to Mintlify (GitHub app) and point the custom domain `comfytv.org`. Every push to the default branch deploys automatically, exactly like the official docs on Vercel.

## Roadmap to full parity with docs.comfy.org

Done (phase 1): Mintlify shell, brand, en+zh, generated Node Reference + Guides tabs, contextual AI actions, content-sync script.

Next:

1. **Languages** — add `ja` and `ko`. This needs the hash-based translation pipeline ported from the official repo (`.github/scripts/i18n/`): incremental re-translation keyed on `translationSourceHash` (already stamped into generated zh pages), a terminology glossary, and truncation repair. Without it, ja/ko cannot be maintained by hand.
2. **CI gates** — broken-link check (`npm run check`), redirect enforcement on renamed pages, i18n sync check.
3. **Content breadth** — installation/first-run guides, a workflow-example per capability (embed the workflow JSON in the preview PNG so users can drag it in), and a `troubleshooting`/`support` tab.
4. **Analytics + comments** — GA4 + PostHog (one block in `docs.json`), optional Giscus comments.
5. **Brand** — replace placeholder `logo.svg` / `favicon.svg` and finalize `colors` in `docs.json` + `custom.css`.
