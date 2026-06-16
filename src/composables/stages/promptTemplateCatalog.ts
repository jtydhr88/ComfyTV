export interface PromptTemplate {
  id: string
  labelKey: string
  template: string
}

export const PROMPT_TEMPLATES: PromptTemplate[] = [
  {
    id: 'storyboard-grid',
    labelKey: 'promptHelper.template.storyboardGrid',
    template: `You are a veteran Hollywood storyboard artist. Analyze the uploaded character/scene and propose the most suitable camera angles, keeping a consistent visual style.

MANDATORY LAYOUT: a precise 3x3 GRID of exactly 9 distinct panels.
- One image divided into 3 rows by 3 columns.
- Each panel separated by a thin, solid black line.
- Do NOT collage, overlap, or use random sizes. The grid must be perfectly aligned for slicing.

Subject: {subject}

Styling:
- Each panel shows the SAME subject from a DIFFERENT angle (front, side, back, action, close-up).
- Perfect character/object consistency across all panels.
- Cinematic lighting, high fidelity, 8k resolution.

Negative: no text, no captions, no UI, no watermarks, no broken grid lines.`,
  },
  {
    id: 'character-sheet',
    labelKey: 'promptHelper.template.characterSheet',
    template: `(strictly mimic source image art style:1.5), (same visual style:1.4), masterpiece, best quality, (character sheet:1.4), (reference sheet:1.3), (consistent art style:1.3),
multiple views, full body central figure, clean background, (heavy annotation:1.4), (text labels with arrows:1.3),
(prominent character profile text box:1.6), (dedicated biography section:1.5): {subject},
(clothing breakdown:1.5), (outfit decomposition:1.4), (floating apparel:1.3), displaying outerwear, upper-body and lower-body garments,
(detailed footwear display:1.5), (floating shoes:1.4),
(inventory knolling:1.2), personal accessories, organized items display, expression panels`,
  },
  {
    id: 'mood-board',
    labelKey: 'promptHelper.template.moodBoard',
    template: `Act as a Senior Art Director. Synthesize the concept below into a single, cohesive, high-density Visual Mood Board using a complex 8-panel asymmetrical grid layout.

Story & concept: {subject}

Read any attached reference images for key symbols and color preferences. Cohesive palette, cinematic lighting, high fidelity, 8k. No text, no UI, no watermarks.`,
  },
  {
    id: 'upscale',
    labelKey: 'promptHelper.template.upscale',
    template: `Losslessly upscale the reference image. Strictly preserve the original composition, color, lighting and every detail — do NOT repaint or add new content. Focus only on resolution, edge sharpening and denoising for pixel-level restoration. Best quality, 8k, masterpiece, highres, ultra detailed, sharp focus, image restoration, faithful to original.`,
  },
]
