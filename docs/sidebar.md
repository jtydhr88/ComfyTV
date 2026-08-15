**English** | [简体中文](sidebar.zh.md)

# The ComfyTV sidebar

ComfyTV registers a single **ComfyTV** tab in ComfyUI's left sidebar rail. Inside it are **eight tabs** — everything that isn't a node on the canvas lives here: workflow configuration, the media library, prompt fragments, workflow/parameter management per stage kind, presets, resources, remote servers, and settings. The last tab you used is remembered across reloads.

(When the [ComfyTV Bot](bot.md) is enabled, a second ✨ icon appears in the sidebar rail — that one is the embedded chat agent, documented separately.)

<!-- TODO(screenshot): the sidebar with its 7-tab bar (Workflow / Assets / Entries / Stages / Presets / Resources / Servers) -->
![ComfyTV sidebar tabs](images/sidebar-tabs.png)

---

## Workflow — configure the selected stage's workflow

Select a stage node on the canvas and this tab becomes the **workflow config editor** for it — which workflow node receives the prompt, which `LoadImage` takes upstream image #N, where the seed goes, and so on.

![Workflow config sidebar](images/sidebar-overview.png)

What you'll see, top to bottom:

- The stage's **kind** and the **workflow** it currently has selected. If the node's workflow combo is empty, or the workflow hasn't finished its one-time preparation yet (normal for a freshly imported one — it happens automatically the first time it runs), the editor says so instead of showing fields.
- A **linked source** banner when the workflow is a 🔗 [linked one](custom-workflows.md): it lives in ComfyUI's own library and live-updates when you save it there. You can **Unlink** from here; if the underlying file was moved or deleted, the banner turns into a broken-link warning.
- **Notes** — free-text notes shipped with the workflow's preset (gotchas, model requirements).
- **Exposed widgets & bindings** — the workflow's nodes, searchable and filterable by group chips, where you edit each binding. Changes apply immediately, no restart.
- **⇩ Export preset.json** — package the current bindings to share alongside the workflow file.

The full editor walkthrough is in [sidebar-config-editor.md](sidebar-config-editor.md).

---

## Assets — the media library

<!-- TODO(screenshot): Assets tab in grid view with category chips + media filter -->
![Assets panel](images/assets-panel.png)

A library of **images, video, audio, and 3D models** you want to keep reusing — independent of any single project.

- **Get things in**: the upload button, or just **drag files onto the panel**. The panel also **scans ComfyTV's media folder** on open (and via *Scan folder* in the ⚙ menu) and adopts anything new it finds there.
- **Organize**: create **categories** and tag assets with them — an asset can carry several tags. Filter by category chip, by media type (image / video / audio / model, with counts), or search by name. Grid and list views.
- **Use an asset**: **drag it onto the canvas** — ComfyTV creates the matching *Load … from Asset* node wired to it — or use the card menu's *Load as node*. The menu also offers *View full* (lightbox), *Make proxy* (for videos), *Edit tags*, *Rename*, and *Delete*. Deleting removes the library entry; files on disk are left alone.
- Asset images can also be dropped straight into a stage's prompt as reference images — see [Prompt references](#prompt-references) below.

---

## Entries — reusable prompt fragments

<!-- TODO(screenshot): Entries tab with a couple of fragments -->
![Entries panel](images/entries-panel.png)

Per-project **text fragments** you can reference in any stage's prompt by typing `@label`.

- Each entry has a **label** (must start with a letter or underscore — Chinese is fine — then letters / digits / `_` / `-`) and a **content** block. At run time, `@label` in a prompt expands to the content; unknown tokens stay literal.
- Delete an entry and existing `@label` tokens simply fall back to literal text.
- **Import / Export** round-trips all entries of the project as a JSON backup (duplicates are skipped on import).
- You can also create a fragment **without leaving the prompt**: type `@`, type a new label, and the mention popup offers to create it on the spot.

---

## Stages — workflows & extra parameters per stage kind

<!-- TODO(screenshot): Stages tab showing the workflow list with badges + the parameter form -->
![Stage manager](images/stage-manager.png)

Pick a **stage kind** in the header dropdown; two sections follow.

**Workflows** — every workflow registered for that kind, i.e. what the matching stage node's dropdown offers:

- Badges tell you each row's story: **built-in** (ships with ComfyTV), **linked** (points into ComfyUI's native library), **new** (found in the most recent scan), **default**, plus health warnings — *file missing*, *not GUI format*, *API not generated* (normal until first run).
- Hover a row to **★ set it as the default** — new stage nodes of this kind start with it selected.
- **Import** a JSON here, or drop files into `user/comfytv/workflows/<kind>/` and hit **Rescan** — the library is re-scanned from disk with no backend restart.

**Parameters** — define your own extra widgets for every stage of this kind:

- A parameter has a label, a type (**float / int / string / boolean / combo**), a default, and type-specific config (min / max / step for numbers, options for combos, placeholder for strings).
- On any stage card of that kind you can then **attach** the parameter and set a per-node value; the value merges into the stage's run options, and you wire it into the workflow via a binding in the **Workflow** tab.

---

## Presets — every saved stage preset

<!-- TODO(screenshot): Presets tab grouped by stage type -->
![Presets panel](images/presets-panel.png)

All parameter presets you've saved from stage cards, grouped by stage type. Rename or delete them here; creating one happens on the node itself (the preset bar's **Save preset** button). Built-in presets are marked and can't be overwritten.

---

## Resources — LUTs, fonts, SoundFonts

<!-- TODO(screenshot): Resources tab with the three kind groups -->
![Resources panel](images/resources-panel.png)

Files that nodes consume but that aren't media assets:

| Kind | Formats | Used by |
|---|---|---|
| **LUTs** | `.cube` `.3dl` `.dat` `.m3d` `.csp` | Video LUT (with live preview) |
| **Fonts** | `.ttf` `.otf` `.woff` `.woff2` | Title / Subtitles / Annotate, Layer-editor text |
| **SoundFonts** | `.sf2` `.sf3` | Score Synth (SF2) |

Upload, rename, and delete per group. When a stage runs on a **remote server**, preflight checks that the remote has the same resource — you get a warning (with *Run anyway*) if it's missing or differs.

---

## Servers — run stages on other machines

<!-- TODO(screenshot): Servers tab with one remote registered + capability badge -->
![Servers panel](images/servers-panel.png)

Register other ComfyUI instances on your network (name / host / port) and stages gain a **Run on** dropdown — run heavy stages on the GPU rig upstairs while light ones stay local, in parallel. Results always land on this machine.

- **Test connection** shows online/offline plus queue status (running / pending, and how many jobs are from ComfyTV).
- A **capability probe** reports the remote's ComfyTV version — or warns that ComfyTV isn't installed there — and lists any nodes it's missing. Preflight blocks a run that can't work (no ComfyTV, missing node) and warns on missing resources.
- Disable or delete a server anytime; stages pointed at it fall back to running locally.

---

## Settings — backups, MCP and the Bot

Two sections of global switches, saved to the ComfyTV database:

- **Backup**: automatic snapshots of ComfyTV's data on server start (toggle, retention count, custom path) plus a *Back up now* button.
- **Agent & MCP**: **Enable MCP server** opens the agent endpoint documented in [Agent access (MCP)](mcp.md); **Enable ComfyTV Bot** shows the embedded chat agent from [ComfyTV Bot](bot.md). Both default to **off**; the Bot switch requires MCP and unlocks only when it's on. Turning MCP off also turns the Bot off, and the ✨ icon appears or disappears immediately when you save.

---

## Prompt references

The sidebar's libraries plug directly into every stage's prompt box.

<!-- TODO(screenshot): the @ mention popup showing image-slot chips and fragments -->
![Mention popup](images/prompt-mentions.png)

Type **`@`** in a prompt to open the mention popup:

- **`@image_N`** — reference one of the stage's wired image slots inline ("make @image_0's character wear @image_1's outfit"). Chips are color-coded to match the input slots, so you can see at a glance which image is which. At run time each token expands to the image's actual ordinal in the batch that gets sent.
- **`@fragment`** — insert an [Entries](#entries--reusable-prompt-fragments) fragment by label. Type a label that doesn't exist yet and the popup offers to **create it inline**.
- **Asset images** — insert an image straight from the asset library; it's sent as a **reference image** at run and claims one of the workflow's reference slots.

### Pinned image references

<!-- TODO(screenshot): the Image references strip on a stage card -->
![Image references](images/image-refs.png)

Stages that take images also have an **Image references** strip: pin images from the asset library onto the stage's reference slots **without wiring any nodes**. The strip warns when two pins target the same slot, when a pin overrides an upstream connection, or when the workflow binds fewer slots than you've pinned.

### Prompt helper

The ✨ **prompt helper** on generator cards offers quick starters (portrait, landscape, product, …), templates (storyboard grid, character sheet, mood board, upscale), and enhancement tags grouped by quality / lighting / mood / style — one click appends them to the prompt.
