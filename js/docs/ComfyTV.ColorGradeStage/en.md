> Six real-time GLSL color tools in the browser—like Lightroom sliders, no ▶ Run.

## What this node does

**Color Grade** applies non-destructive color adjustments via WebGL fragment shaders (GLSL) in your browser. Pick an effect, move sliders or curves; preview updates instantly.

**Instant** node—no ComfyUI queue, no diffusion models. Use for exposure, white balance, curves, then optional **Upscale** or **Relight**.

Six built-in GLSL effects (see table). Selection + values serialize to hidden `grade_state` JSON.

## When to use it

- Fix flat or dark generations quickly
- Match product color temperature
- Unified “film look” curves across shots
- Image Picker 🎨 color tool

## How it works

Transform stage, **no Run**. `useGLSLRenderer` loads the selected `.frag` shader from `grade_state`.

- Not a substitute for **Relight** (AI relighting, requires Run).

## Types

| Type | Meaning |
|---|---|
| `COMFYTV_IMAGE` | URL snapshot |

[bridges.md](https://github.com/jtydhr88/ComfyTV/blob/main/docs/bridges.md)

## UI — six GLSL effects

| Effect ID | Name | Controls | Use |
|---|---|---|---|
| **brightness_contrast** | Brightness / Contrast | −100…+100 each | Overall exposure |
| **color_adjustment** | Color Adjustment | Temp, tint, vibrance, saturation | White balance |
| **color_balance** | Color Balance | Shadow/mid/highlight R·G·B; preserve luminosity | Split toning |
| **hue_saturation** | Hue / Saturation | Mode (master/reds/…/colorize), HSL/HSV, hue/sat/lightness | Selective HSL |
| **color_curves** | Curves | Master / R / G / B curves | Fine tonal control |
| **image_levels** | Levels | Channel RGB/R/G/B; in/out black/white, gamma | Photoshop-style levels |

### grade_state (hidden)

JSON `{ effectId, values }` — driven by the Vue panel.

## Outputs

| Output | Type |
|---|---|
| **image** | `COMFYTV_IMAGE` |

## Step by step

1. Add **Color Grade** (menu or Image Picker).
2. Wire **image** in.
3. Pick an effect; adjust sliders/curves.
4. Wire out to **Upscale**, **Compare**, or Bridge.
5. **▶ Run** downstream generative stages if any.

## Workflows

None—browser GLSL only.

| Resource | Link |
|---|---|
| Image tools | https://github.com/jtydhr88/ComfyTV/blob/main/docs/image-tools.md |


## Full guides (recommended reading)

> This page covers **one node only**. For end-to-end workflows, multi-stage pipelines, type conversion, and design rationale, see the [ComfyTV user guides](https://github.com/jtydhr88/ComfyTV/tree/main/docs) on GitHub:

| Guide | Contents |
| --- | --- |
| [Getting started](https://github.com/jtydhr88/ComfyTV/blob/main/docs/getting-started.md) | Install, canvas basics, per-stage Run, snapshots, Project, Image Picker |
| [Image tools](https://github.com/jtydhr88/ComfyTV/blob/main/docs/image-tools.md) | Crop, inpaint, outpaint, upscale, multi-angle, variation presets |

## Repository and workflows

| Resource | Link |
| --- | --- |
| **GitHub repository** | https://github.com/jtydhr88/ComfyTV |
| **User guides index** | https://github.com/jtydhr88/ComfyTV/tree/main/docs |
| **Built-in workflows** | https://github.com/jtydhr88/ComfyTV/tree/main/workflows |
| **Model checklist** | https://github.com/jtydhr88/ComfyTV/blob/main/docs/models.md |
| **Custom workflows** | https://github.com/jtydhr88/ComfyTV/blob/main/docs/custom-workflows.md |
## FAQ

**Q: vs Relight?**  
A: Color Grade = traditional grades, instant; Relight = AI relight, Run + workflow.

**Q: Curves not editing?**  
A: Select **color_curves**; click the curve to add points.

**Q: Upscale still looks ungraded?**  
A: Re-Run Upscale after grading.

**Q: Stack multiple effects?**  
A: One effect per node—chain nodes or use Relight after.

## Related nodes

- **Relight**, **Crop**, **Upscale**, **Compare**
