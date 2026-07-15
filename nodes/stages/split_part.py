import logging

from ._common import *


def _cleanup_mask_array(b, min_px: int):
    import numpy as np
    from scipy import ndimage

    if not b.any():
        return b
    lbl, n = ndimage.label(b)
    if n > 1:
        sizes = np.bincount(lbl.ravel())
        sizes[0] = 0
        drop = sizes < min_px
        if drop.any() and not drop[sizes.argmax()]:
            b = b & ~drop[lbl]

    inv_lbl, n_inv = ndimage.label(~b)
    if n_inv > 1:
        inv_sizes = np.bincount(inv_lbl.ravel())
        border = np.unique(np.concatenate([
            inv_lbl[0, :], inv_lbl[-1, :], inv_lbl[:, 0], inv_lbl[:, -1]]))
        fill = inv_sizes < min_px
        fill[border] = False
        fill[0] = False
        if fill.any():
            b = b | fill[inv_lbl]
    return b


class MaskCleanup(io.ComfyNode):

    @classmethod
    def define_schema(cls):
        return io.Schema(
            node_id="ComfyTV.MaskCleanup",
            display_name="Mask Cleanup (ComfyTV)",
            category="ComfyTV/Utils",
            inputs=[
                io.Mask.Input("mask"),
                io.Float.Input("min_region_frac", default=0.01, min=0.0, max=0.2,
                               step=0.001,
                               tooltip="Islands/holes smaller than this fraction of the "
                                       "mask's largest region are removed/filled "
                                       "(absolute floor: 64 px)."),
            ],
            outputs=[io.Mask.Output("mask")],
        )

    @classmethod
    def execute(cls, mask, min_region_frac=0.01):
        import numpy as np
        import torch

        try:
            from scipy import ndimage
        except ImportError:
            logging.warning("[ComfyTV] MaskCleanup: scipy unavailable — passthrough")
            return io.NodeOutput(mask)

        if mask.ndim == 2:
            mask = mask.unsqueeze(0)
        out = []
        for m in mask:
            b = (m > 0.5).cpu().numpy()
            largest = 0
            if b.any():
                lbl, n = ndimage.label(b)
                if n:
                    sizes = np.bincount(lbl.ravel())
                    sizes[0] = 0
                    largest = int(sizes.max())
            min_px = max(64, int(largest * float(min_region_frac)))
            cleaned = _cleanup_mask_array(b, min_px)
            out.append(torch.from_numpy(cleaned.astype(np.float32)))
        result = torch.stack(out) if out else mask
        return io.NodeOutput(result.to(mask.device))


def _parse_parts(parts_data: str) -> list[dict]:
    try:
        data = json.loads(parts_data) if parts_data else {}
    except (ValueError, TypeError):
        return []
    raw = data.get("parts") if isinstance(data, dict) else None
    if not isinstance(raw, list):
        return []
    out: list[dict] = []
    for p in raw:
        if not isinstance(p, dict):
            continue
        if p.get("kind") == "points" and isinstance(p.get("points"), list):
            pts = [q for q in p["points"]
                   if isinstance(q, dict) and "x" in q and "y" in q]
            if pts:
                out.append({"kind": "points", "points": pts})
        elif p.get("kind") == "box" and isinstance(p.get("box"), dict):
            b = p["box"]
            if all(k in b for k in ("x", "y", "w", "h")) and b["w"] > 0 and b["h"] > 0:
                out.append({"kind": "box", "box": b})
    return out


def _part_invocations(parts: list[dict]) -> list[dict]:
    coords = lambda pts, label: json.dumps(
        [{"x": int(round(p["x"])), "y": int(round(p["y"]))}
         for p in pts if p.get("label", 1) == label]
    )
    invocations: list[dict] = []
    boxes = [
        {"x": int(round(p["box"]["x"])), "y": int(round(p["box"]["y"])),
         "width": int(round(p["box"]["w"])), "height": int(round(p["box"]["h"]))}
        for p in parts if p["kind"] == "box"
    ]
    if boxes:
        invocations.append({"points_pos": "", "points_neg": "", "bboxes": boxes})
    for p in parts:
        if p["kind"] != "points":
            continue
        invocations.append({
            "points_pos": coords(p["points"], 1),
            "points_neg": coords(p["points"], 0),
            "bboxes": "",
        })
    return invocations


def _merge_batches(payloads: list[str]) -> str:
    images: list[dict] = []
    for payload in payloads:
        try:
            batch = json.loads(payload)
        except (ValueError, TypeError):
            continue
        for it in (batch.get("images") if isinstance(batch, dict) else None) or []:
            if isinstance(it, dict) and it.get("image_url"):
                images.append(it)
    for i, it in enumerate(images):
        it["index"] = str(i + 1)
        it["label"] = f"#{i + 1}"
    return json.dumps({"images": images})


class SplitPartStage(io.ComfyNode):

    @classmethod
    def define_schema(cls):
        return io.Schema(
            node_id="ComfyTV.SplitPartStage",
            display_name="Split Parts",
            category="ComfyTV/Image",
            inputs=[
                *_standard_stage_inputs(),
                io.Combo.Input("workflow", options=labels_for('split-part'),
                               default=default_for('split-part'),
                               tooltip="Which segmentation workflow to run."),
                io.String.Input("parts_data", default="",
                                socketless=True, extra_dict={"hidden": True},
                                tooltip="Internal — JSON of the part prompts drawn on the card "
                                        "(point groups and boxes, in source-image pixel coords)."),
                _main_prompt_input(placeholder="(text workflow) concept to segment, e.g. 'strap', 'buckle', 'logo'"),
                COMFYTV_IMAGE.Input("image", optional=True),
                _selected_index_input(),
                _custom_params_input(),
            ],
            outputs=[COMFYTV_IMAGES.Output("images"), COMFYTV_IMAGE.Output("image")],
            is_output_node=True,
            hidden=[io.Hidden.unique_id],
        )

    @classmethod
    async def execute(cls, force_run_token=0, project_id="", parent_output_id=0,
                      workflow="", parts_data="", main_prompt="", image="",
                      selected_index=1, custom_params="{}"):
        parts = _parse_parts(parts_data)
        invocations = _part_invocations(parts)
        if not invocations:
            if not (main_prompt or "").strip():
                raise StageError(
                    "Split Parts needs a prompt: click/box the parts to "
                    "separate on the card, or type a concept (text workflow)."
                )
            invocations = [{"points_pos": "", "points_neg": "", "bboxes": ""}]

        payloads: list[str] = []
        total = len(invocations)
        for i, options in enumerate(invocations):
            _emit_progress(cls, i, total, text=f"segment {i + 1}/{total}")
            payloads.append(await invoke_runner(
                kind='split-part',
                label=workflow,
                main_prompt=main_prompt,
                upstream={'images': [image] if image else []},
                options=options,
                custom_params=custom_params,
            ))

        payload = _merge_batches(payloads)
        if payload == '{"images": []}':
            raise StageEmptyOutput(
                "segmentation ran but produced no part images — "
                "try different points/boxes or a lower threshold"
            )
        picked_idx = int(selected_index or 1)
        picked_url = _pick_image_from_batch(payload, picked_idx)
        return _stage_emit_auto(cls, project_id=project_id, payload_str=payload,
                                parent_output_id=parent_output_id,
                                picked_payload=picked_url, picked_index=picked_idx)
