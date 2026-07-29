# Face Blur

> Automatically detect faces in a clip and obscure them with a blur, pixelation, or box.

## What this node does

**Face Blur** runs a face detector over your video and covers each detected face with a chosen obscuring effect. On ▶ Run it detects faces (re-detecting periodically to follow movement), then blurs, pixelates, or boxes them out, producing a new video. There is no drawing — detection is automatic.

Video in/out is `COMFYTV_VIDEO`. Bridge to native ComfyUI nodes via `ComfyTV/Bridge` — see https://github.com/jtydhr88/ComfyTV/blob/main/docs/bridges.md.

## When to use it

- Anonymize bystanders for privacy before publishing
- Redact identities in review or reference footage
- Quick censor pass on faces without rotoscoping

## Parameters

### mode
How to obscure each face. Options: `blur`, `pixelate`, `box`. Default `blur`.

### shape
The region shape covered per face. Options: `rect`, `ellipse`. Default `ellipse`.

### strength
Intensity of the effect (blur amount / pixel block size). Range `4`–`64`, step `1`, default `24`. Higher hides more detail.

### recheck
Re-detect faces every N frames. Range `1`–`120`, default `12`. Lower values follow fast movement more closely but cost more; higher values are faster but can lag on quick motion.

### search_scale
Detector scale factor. Range `1.05`–`2.0`, default `1.2`. Smaller values scan more thoroughly (finding more/smaller faces) but slower; larger values are faster but may miss faces.

### neighbors
Detector min-neighbors threshold. Range `1`–`10`, default `4`. Higher rejects weak detections (fewer false positives, but may miss borderline faces); lower is more permissive.

### min_size
Minimum face size in pixels to detect. Range `8`–`400`, default `24`. Raise it to ignore tiny background faces.

## Outputs

| Output | Type | Meaning |
|---|---|---|
| **video** | `COMFYTV_VIDEO` | The clip with detected faces obscured |

## Tips

- If faces flicker in and out, lower `recheck` and/or `search_scale`, or lower `min_size` for smaller faces.
- Getting false detections on non-faces? Raise `neighbors`.
- Detection follows motion only between rechecks, so very fast movement may briefly reveal a face — use a low `recheck`.

## Related nodes

- **Spot Remover** — cover a fixed spot/object rather than faces
- **Paint Strokes** — manually obscure regions the detector misses
