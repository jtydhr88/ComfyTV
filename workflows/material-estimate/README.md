# material-estimate workflows

VLM workflows for the **Material** stage: given an image patch (usually a part
cutout from Split Parts), return a JSON string of PBR parameters. The stage
extracts the first `{...}` block from the generated text, merges it into the
material editor, and the user fine-tunes from there.

Contract for custom workflows linked to this stage:
- input: one image, bound from `upstream_image:annotated[0]`;
- output: text containing a JSON object with any of
  `color, metalness, roughness, transmission, opacity, clearcoat,
  clearcoatRoughness, ior, emissive, emissiveIntensity`
  (result type `graph_output_first` on the text-producing node).

Default `qwen3vl-estimate` is core-only: `CLIPLoader(qwen3vl_8b) →
TextGenerate → PreviewAny`. Model: `qwen3vl_8b_fp8_scaled.safetensors`
(Comfy-Org) in `models/clip/` or `models/text_encoders/`.

gemma4_e4b was evaluated as an alternative and rejected: through both the
default template and the LTX2-style `<image_soft_token>` template it returned
identical grey estimates for visibly different patches, i.e. the image never
influenced the answer.
