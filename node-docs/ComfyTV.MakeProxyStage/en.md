# Make Proxy

> Build a lightweight preview copy of a video so playback and scrubbing stay smooth.

## What this node does

**Make Proxy** takes a source video URL and transcodes it into a smaller, easier-to-play
**proxy** clip. On **▶ Run** the server builds the proxy (via the proxy runner) and returns a
`COMFYTV_VIDEO` reference to it. It reports progress while transcoding.

Unlike the other editing nodes, its input is a plain **video** string — a source `/view` URL —
rather than a `COMFYTV_VIDEO` socket. Give it a real URL or the run errors out.

## When to use it

- A large or high-bitrate clip stutters when you scrub or preview it — make a proxy to edit
  against smoothly.
- You want a fast-loading stand-in for a heavy source while building a sequence.

## Parameters

### video
The source `/view` URL to build a preview proxy for. Must be non-empty. This is a string
input, not a `COMFYTV_VIDEO` socket.

## Outputs

| Output | Type | Meaning |
|---|---|---|
| **proxy** | `COMFYTV_VIDEO` | A lightweight preview transcode of the source clip. |

## Tips

- The proxy is a preview-quality stand-in; use it for editing/scrubbing, and keep the original
  source for final output.
- If nothing happens, check that **video** holds a valid source URL — an empty value raises an
  error.

## Bridge note

`COMFYTV_VIDEO` is a project snapshot reference, not a native ComfyUI tensor. To move
between ComfyTV and native ComfyUI nodes, insert a **Bridge** (`ComfyTV/Bridge`). See
<https://github.com/jtydhr88/ComfyTV/blob/main/docs/bridges.md>.

## Related nodes

- **Video Clip** / **Video Split** — edit against the smooth proxy.
- **Video Resize** — set an explicit output size if you need a specific proxy dimension.
