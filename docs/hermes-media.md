# Hermes managed media references

This extends only the ComfyTV Python adapter, not Hermes identity, profiles,
broker, model serving or legacy Claude/Codex media processing.

## Contract

The existing `bot-hermes-image-attachments` setting now gates image/video/audio
references together. `attachments=false` still forbids attachments. Capability
field names and `attachment_transport=asset_refs` are unchanged. Only canonical
`asset:<id>` native references or legacy `{asset_id: <safe integer>}` objects are
accepted, at most six, without duplicates. Documents, archives and other asset
classes are unsupported. Original files never cross to the Hermes host.

Server-built manifest v1 and task-input v1/v2 retain their wire shape. Images keep
existing metadata, validation and preview behavior. Video/audio facts are probed
from bounded managed input/output bytes and include actual type, duration,
codec, size, SHA-256 revision, video dimensions/fps/audio presence or audio sample
rate/channels. No client URLs, paths or original bytes enter the task input.
`perception=not_inspected`, `inspect_tool=inspect_media_asset` and factual
limitations travel inside structured attachment data, not identity/system
instructions. Existing draft/selection/preferences capture, immutable submission,
message/session identity, queue admission and terminal cleanup remain unchanged.
Display blocks retain actual `video` and `audio` types rather than pretending
originals are images. Deleted, unsafe, mislabeled, corrupt/unprobeable or stale
references fail closed; admission probes one decoded frame, not every frame of
an entire video. Later corruption/undecodable samples fail during inspection.

## On-demand inspection

`inspect_media_asset` uses the same MCP visibility gate as
`inspect_image_asset`. It accepts `asset_id`, optional exact `revision`, and:

- `mode=metadata` (default): facts only, image/video/audio; no preview.
- `mode=frame`: video; optional `time_seconds`, default midpoint.
- `mode=timeline`: video; `frames=2..4`, default four, evenly sampled mid-bins;
  one composite JPEG and actual sample timestamps. This is a sampled frame
  sheet, not an exhaustive timeline or soundtrack analysis.
- `mode=waveform`: audio; deterministic whole-file 8 kHz mono envelope, peak/RMS
  of the downmixed/resampled signal and inspected duration. It is not an
  original-channel clipping detector.

Images still use `inspect_image_asset` for visual previews. Returned `_images`
are the existing native MCP ImageContent contract, consumed by the unchanged
bounded Hermes derivative-image cache. Model instructions require
`vision_analyze` on returned MEDIA previews before visual content claims.
Waveforms do **not** establish speech, transcripts, lyrics, language, emotion or
music meaning. Video samples do **not** imply continuous-video understanding or
soundtrack listening. No STT, OCR or new model is installed.

## Explicit bounds

Images retain 20 MiB source, 40 million pixels and existing one-frame validation.
Video/audio source limit: **64 MiB per asset**, duration **0 < duration <= 300 s**.
Video width/height each <=4096, pixels <=16,777,216, fps >0 and <=120. Audio sample
rate <=192 kHz and channels <=8. Unknown/nonfinite duration is rejected.

Managed-file resolution reuses the existing no-traversal/no-link/no-reparse,
regular-file input/output resolver, including descriptor-relative opens on
POSIX. Decoder input is in-memory bytes; nested FFmpeg file/network protocols
are excluded (`protocol_whitelist=pipe`). No derivative is written to Windows
output or to a new disk cache. PyAV workers use one decoding thread, bounded
stdin, and a **20 s subprocess timeout with kill/wait**. Preview inspection uses
up to two workers (probe then inspection), hence at most **40 s worker time**;
six-asset manifest admission probes sequentially. The existing shared two-slot
producer semaphore caps concurrent producers, including timeout cleanup.

Video seeks decode at most 300 frames per sample, at most four samples.
Waveforms process at most 30,000 decoded audio frames, 65,536 samples per frame,
and 2,408,000 resampled samples (300 s plus <=1 s flush tolerance), into 800 bins.
Actual duration mismatch rejects the waveform. Preview output is a single JPEG
<=1 MiB and <=1200x1200; worker JSON <=2 MiB. Manifest and structured task input
remain <=8 KiB. These are IO/work/dimension/time bounds, not an OS-level memory
sandbox; native decoder allocation is not protected by a Windows Job Object.

Requires existing runtime PyAV/Pillow and NumPy for waveforms. Missing dependency
or codec fails closed. Local tests used PyAV 18.1.0 installed in the checkout's
non-production test venv; no live runtime was changed.

## Health and verification

Local health projection reports `unsupported=[document]`; upstream health wire
validation and `media.image` details remain compatible. It does not fabricate
new tool usability, listening, vision or inference evidence. An administrator's
MCP tool filters still determine upstream availability; no allowlist is modified.

`tests/test_media_refs.py` generates real two-second red/blue MPEG-4 video and
440 Hz PCM WAV using local ffmpeg, checks actual decoded pixel colors and
waveform RMS/peak, exercises native/legacy routes and local fake Runs transport,
and covers mixed context, display types, disabled gates, unsupported types,
revision/path/type/size/duration/options validation, and child timeout/reaping.
No production API, model or GPU is used. Deployment and real-user acceptance
remain separate work.
