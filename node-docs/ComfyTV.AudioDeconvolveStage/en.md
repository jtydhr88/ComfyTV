# Audio Deconvolve (IR)

> Recover an impulse response from a recorded sine-sweep — turn a room, cabinet, or device into a reusable IR.

## What this node does

**Audio Deconvolve (IR)** takes a recording of an exponential sine sweep (an ESS played through a space or device) and deconvolves it against the ideal sweep to extract the **impulse response** (IR). That IR captures the reverb, coloration, and filtering of whatever the sweep passed through, and can then drive convolution reverb.

It takes the recorded sweep as a `COMFYTV_AUDIO` snapshot (or a `COMFYTV_VIDEO`, whose audio track is used) and outputs the extracted `COMFYTV_AUDIO` impulse response. It has a ▶ **Run**. A source is required.

To feed native ComfyUI `AUDIO` in or out, insert a **Bridge** — see [bridges.md](https://github.com/jtydhr88/ComfyTV/blob/main/docs/bridges.md).

## When to use it

- Capture a real hall/room reverb: play **Audio Sweep (ESS)**, record it in the space, then deconvolve here to get the IR.
- Profile a guitar cabinet or hardware processor into an IR for later convolution.

## Parameters

The sweep parameters must **match the sweep you played** so the deconvolution inverts the correct signal:

### duration_s
Sweep length in seconds, **1–30** (default **5.0**). Must match the played sweep's duration.

### fmin
Start (lowest) frequency in Hz, **10–1000** (default **20**).

### fmax
End (highest) frequency in Hz, **1000–20000** (default **20000**).

### amp
Sweep amplitude used in the reference, **0.01–1.0** (default **0.5**).

### ir_len_s
Length of the impulse response to keep, in seconds, **0.1–10** (default **2.0**). Long enough to include the full reverb tail; trim to avoid capturing extra noise.

## Outputs

| Output | Type | Meaning |
|---|---|---|
| **audio** | `COMFYTV_AUDIO` | The extracted impulse response |

## Tips

- The four sweep parameters here must mirror what you set in **Audio Sweep (ESS)**; a mismatch produces a smeared or wrong IR.
- Set **ir_len_s** to cover the reverb tail — too short truncates the decay, too long picks up room noise.
- Feed the resulting IR straight into **Audio Convolve (IR)** to reuse the captured space.

## Related nodes

- **Audio Sweep (ESS)** — generates the sweep you play to capture the response.
- **Audio Convolve (IR)** — applies the extracted IR to any source.
- **Muse Reverb (FDN)** — algorithmic reverb when you have no space to capture.
