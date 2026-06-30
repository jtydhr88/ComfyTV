# Music Stage (Audio Stage)

> Generates music or songs from style tags and optional lyrics—instrumental or vocal—not the same as Speech Stage text-to-speech.

## What this node does

Shown as **Music Stage** (node id: `ComfyTV.AudioStage`). Write genre, mood, instruments, and BPM in **main_prompt** as **tags**, optionally fill **lyrics**, set duration, click **▶ Run**, and get a **`COMFYTV_AUDIO`** music snapshot.

Built-in **ACE-Step v1 Song** uses ACE-Step 3.5B: **empty lyrics = instrumental**; filled lyrics = sung vocals.

This is **not TTS**. For narration or dialogue, use **Speech Stage**.

## When to use it

- Background music, lo-fi, electronic, jazz (leave lyrics empty).
- Demo songs with lyrics + style tags.
- Audio track for Video Stage **IA2V** (wire **audio**).
- Source audio for Timeline or Audio Extract chains.

## How ComfyTV stages work

- **▶ Run** executes only the subgraph in [`workflows/audio/`](https://github.com/jtydhr88/ComfyTV/tree/main/workflows/audio).
- **Snapshots**: audio URL (e.g. FLAC) is stored in the project.
- ComfyTV maps tags → ACE-Step `TextEncodeAceStepAudio.tags`, lyrics → `.lyrics`, duration → `EmptyAceStepLatentAudio.seconds`.

Native ComfyUI has no “read this script aloud” TTS; ACE-Step / Stable Audio are **music** generators—ComfyTV splits **music** and **speech** into two stages.

## Types (COMFYTV_AUDIO vs native ComfyUI)

| ComfyTV type | What it is | vs native ComfyUI |
| --- | --- | --- |
| `COMFYTV_AUDIO` | Audio clip project snapshot URL | Not an in-memory AUDIO tensor |
| Native AUDIO | Sample tensor | Needs Bridge for ComfyTV stages |

**Conversion:**

- Native → ComfyTV: **→ ComfyTV Audio**
- ComfyTV → native: **← ComfyTV Audio**

See [bridges.md](https://github.com/jtydhr88/ComfyTV/blob/main/docs/bridges.md).

## Music Stage vs Speech Stage (important)

| | **Music Stage** (this node) | **Speech Stage** |
| --- | --- | --- |
| Purpose | Songs / instrumentals / SFX | Narration, dialogue, dubbing (TTS) |
| main_prompt | Style tags (genre, BPM, instruments) | **Full script to be read aloud** |
| lyrics | Optional sung lyrics | N/A (use reference_text for cloners) |
| Typical workflow | ACE-Step v1 Song | Kokoro TTS, etc. |
| Sound | Melody, arrangement | Spoken voice, no full song mix |

## Parameters

### workflow

Backend from [`workflows/audio/`](https://github.com/jtydhr88/ComfyTV/tree/main/workflows/audio):

- **ACE-Step v1 Song** (`ace-step-v1-song.json`)—tags + optional lyrics + duration.

Docs: [workflows/audio/README.md](https://github.com/jtydhr88/ComfyTV/blob/main/workflows/audio/README.md).  
Model: `ace_step_v1_3.5b.safetensors` in `models/checkpoints/` ([models.md](https://github.com/jtydhr88/ComfyTV/blob/main/docs/models.md)).

### main_prompt (style tags)

Keywords for genre, mood, instruments, tempo.

**Example:** `lo-fi, jazz piano, rainy night, 90bpm, soft female vocals`

**Mistake:** Pasting a narration script here—that belongs on Speech Stage; Music Stage prompts describe **music**, not a reading script.

### duration_s

Length in seconds, **1–240**, default **30**.

### lyrics

- **Empty**: instrumental / no vocals.
- **Filled**: song mode—ACE-Step generates singing to the lyrics.

### custom_params

Sidebar: seed and other workflow params.

## Outputs

| Output | Type | Meaning | Downstream |
| --- | --- | --- | --- |
| **audio** | `COMFYTV_AUDIO` | Generated music snapshot | Video **audio** (IA2V); Timeline; Audio Extract; Bridge |

## Step by step for beginners

1. Add **Project**, then **ComfyTV → Generate → Music Stage**.
2. **workflow** → **ACE-Step v1 Song**.
3. **main_prompt**: `cinematic orchestral, epic, 120bpm, no vocals`.
4. Leave **lyrics** empty, **duration_s** `30`.
5. Place `ace_step_v1_3.5b.safetensors` in checkpoints.
6. **▶ Run** and preview on the node.
7. For IA2V: **Video Stage** → **IA2V**, Music **audio** → Video **audio**, plus a portrait on **images**.

**Vocal song**: fill **lyrics**, tags like `pop, upbeat, female vocal` → Run.

## Full guides (recommended reading)

> This page covers **one node only**. For end-to-end workflows, multi-stage pipelines, type conversion, and design rationale, see the [ComfyTV user guides](https://github.com/jtydhr88/ComfyTV/tree/main/docs) on GitHub:

| Guide | Contents |
| --- | --- |
| [Getting started](https://github.com/jtydhr88/ComfyTV/blob/main/docs/getting-started.md) | Install, canvas basics, per-stage Run, snapshots, Project, Image Picker |
| [Generate](https://github.com/jtydhr88/ComfyTV/blob/main/docs/generate.md) | Text, Image, Video, Music, and Speech stages and workflow selection |
| [Model files](https://github.com/jtydhr88/ComfyTV/blob/main/docs/models.md) | Checkpoints, LoRAs, and folder paths per workflow |

## Repository and workflows

| Resource | Link |
| --- | --- |
| **GitHub repository** | https://github.com/jtydhr88/ComfyTV |
| **User guides index** | https://github.com/jtydhr88/ComfyTV/tree/main/docs |
| **Built-in workflows** | https://github.com/jtydhr88/ComfyTV/tree/main/workflows |
| **Model checklist** | https://github.com/jtydhr88/ComfyTV/blob/main/docs/models.md |
| **This node's workflow folder** | https://github.com/jtydhr88/ComfyTV/tree/main/workflows/audio |
| **Workflow README** | https://github.com/jtydhr88/ComfyTV/blob/main/workflows/audio/README.md |
| **Custom workflows** | https://github.com/jtydhr88/ComfyTV/blob/main/docs/custom-workflows.md |
## FAQ

**Q: Sounds like speech, not a song?**  
A: You may want Speech Stage; Music Stage uses tags + lyrics for **music**.

**Q: Model not found?**  
A: Download ACE-Step checkpoint to `models/checkpoints/`, restart ComfyUI.

**Q: Cannot wire audio to Video Stage?**  
A: Both ends must be `COMFYTV_AUDIO`; bridge native AUDIO first.

**Q: Need read-aloud dubbing?**  
A: Use **Speech Stage**, not this node.

## Related nodes

- **Speech Stage**—TTS (do not confuse with Music Stage).
- **Video Stage (IA2V)**—**audio** drives visuals.
- **Audio Extract Vocal / Bg Stage**—split vocals or backing.
- **Director Timeline Stage**—multi-track timeline.
- **Bridge → / ← ComfyTV Audio**—native interop.
- **Project**—project context.
