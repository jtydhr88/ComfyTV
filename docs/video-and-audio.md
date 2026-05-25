**English** | [简体中文](video-and-audio.zh.md)

# Video & audio

> Video **generation** lives in the Generate group (see [generate.md](generate.md)). This page covers the **editing** stages in **ComfyTV / Video** and the separation stages in **ComfyTV / Audio**. Video Upscale, Subtitle Erase, and Demucs vocal/bg split are pending — see [roadmap.md](roadmap.md).

![Video editing stages](images/video-tools.png)

---

## Video editing (ComfyTV / Video)

Feed a video (from a **Generate → Video** stage or a **Load Video** node) into any of these:

| Stage | What it does | Status |
|---|---|---|
| **Video Clip** | Trim to a start/end range. | ✅ PyAV |
| **Video Crop** | Crop to a rectangular region. | ✅ PyAV |
| **Video Resize** | Change resolution (width / height) preserving frame rate. | ✅ PyAV |
| **Video Extract Frame** | Pull a single still (first / last / at time). The result is a `COMFYTV_IMAGE`. | ✅ PyAV |
| **↪ Extend** (toolbar action) | One-click chain — extract the source's last frame, spawn a new Video Stage, wire that frame as the I2V starting image. | ✅ |
| **Video Upscale** | Frame-by-frame upscale. | ⏳ pending |
| **Subtitle Erase (Smart)** | Auto-detect and remove burned-in subtitles. | ⏳ pending |
| **Subtitle Erase (Region)** | Remove subtitles inside a region you box. | ⏳ pending |

---

## Audio (ComfyTV / Audio)

Take a video or audio track and split it:

| Stage | Output | Status |
|-------|--------|--------|
| **Demux · Audio Track** | The audio extracted from a video. | ✅ PyAV |
| **Demux · Silent Video** | The video with its audio stripped. | ✅ PyAV |
| **Audio · Vocals Only** | Demucs voice-separated track. | ⏳ pending |
| **Audio · Background Only** | Demucs instrumental / ambient track. | ⏳ pending |

The demux pair is meant to be used together — one node for the audio, one for the silent video — both wired from the same source clip. The 🔀 **Demux** toolbar action spawns both at once.

A separated / extracted audio track can be wired into a **Video Stage**'s optional `audio` input for audio-driven video (works with LTX 2.3 IA2V).
