# Audio Sweep (ESS)

> Generate an exponential sine-sweep test signal — the excitation used to capture a room or device's impulse response.

## What this node does

**Audio Sweep (ESS)** synthesizes an Exponential Sine Sweep (ESS): a tone that glides smoothly from a low frequency up to a high one, followed by a silent tail. Play this sweep through a speaker/room/device and record the result, then feed both back into **Audio Deconvolve (IR)** to recover the impulse response.

It takes no audio input — it is a pure generator — and outputs a `COMFYTV_AUDIO` snapshot. It has a ▶ **Run**.

To feed the sweep to native ComfyUI `AUDIO` nodes, insert a **Bridge** — see [bridges.md](https://github.com/jtydhr88/ComfyTV/blob/main/docs/bridges.md).

## When to use it

- Capture a real reverb IR: play the sweep in a room, record it, deconvolve to get the IR.
- Test the frequency response of a speaker, cabinet, or processing chain.
- Provide a controlled excitation signal for measurement.

## Parameters

### duration_s
Length of the sweep in seconds, **1–30** (default **5.0**). Longer sweeps give a better signal-to-noise ratio for the measurement.

### fmin
Start (lowest) frequency in Hz, **10–1000** (default **20**).

### fmax
End (highest) frequency in Hz, **1000–20000** (default **20000**).

### amp
Output amplitude, **0.01–1.0** (default **0.5**). Keep below 1.0 to avoid clipping on playback.

### tail_s
Silent tail appended after the sweep, in seconds, **0–10** (default **5.0**). Gives the reverb tail room to decay in the recording before the take ends.

## Outputs

| Output | Type | Meaning |
|---|---|---|
| **audio** | `COMFYTV_AUDIO` | The generated exponential sine sweep |

## Tips

- Match **duration_s** and the frequency range to the **Audio Deconvolve** settings you'll use, so the deconvolution inverts the correct sweep.
- Add enough **tail_s** to let the room's reverb fully decay, or the captured IR will be truncated.
- Keep **amp** conservative (~0.5) so the playback and recording chain stays clean.

## Related nodes

- **Audio Deconvolve (IR)** — recovers the impulse response from the recorded sweep.
- **Audio Convolve (IR)** — applies the recovered IR to any source.
