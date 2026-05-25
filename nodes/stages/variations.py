from ._common import *


class ImageVariationsStage(io.ComfyNode):

    @classmethod
    def define_schema(cls):
        all_workflows = (MULTIVIEW_WORKFLOWS or []) + (SEQUENCE_WORKFLOWS or [])
        return io.Schema(
            node_id="ComfyTV.ImageVariationsStage",
            display_name="Image Variations",
            category="ComfyTV/Image",
            inputs=[
                _force_run_token(),
                _project_id_input(),
                _parent_output_id_input(),
                io.Combo.Input("workflow", options=all_workflows,
                               default=all_workflows[0] if all_workflows else "",
                               tooltip="Multi-view (parallel angles) or sequence (chained next-scene) workflow. Each one fans the source image into its own fixed batch."),
                io.Int.Input("variant_count", default=3, min=1, max=25, step=1,
                             display_mode=io.NumberDisplay.slider,
                             tooltip="How many images this workflow will produce. Informational — the count is baked into the chosen workflow."),
                _main_prompt_input(placeholder="Describe the subject (e.g. 'modern wooden chair', 'young Asian businesswoman, 30s').", tooltip="Subject / scene description. Each frame's prompt prepends an angle or sequence keyword automatically."),
                COMFYTV_IMAGE.Input("image", optional=True),
                _selected_index_input(),
            ],
            outputs=[COMFYTV_IMAGES.Output("images"), COMFYTV_IMAGE.Output("image")],
            is_output_node=True,
            hidden=[io.Hidden.unique_id],
        )

    @classmethod
    async def execute(cls, force_run_token=0, project_id="", parent_output_id=0,
                      workflow="", variant_count=3, main_prompt="", image="",
                      selected_index=1):
        runner = (RUNNER_REGISTRY.by_label(workflow, 'multiview')
                  or RUNNER_REGISTRY.by_label(workflow, 'sequence'))
        payload = None
        if runner is not None:
            kind = 'multiview' if workflow in (MULTIVIEW_WORKFLOWS or []) else 'sequence'
            try:
                ctx = RunnerContext(
                    kind=kind,
                    main_prompt=(main_prompt or '').strip(),
                    upstream={'images': [image] if image else []},
                    options={},
                )
                payload = await runner.invoke(ctx)
            except NotImplementedError:
                payload = None
        if not payload:
            raise RuntimeError(f"ImageVariationsStage: workflow {workflow!r} returned no output")
        picked_idx = int(selected_index or 1)
        picked_url = _pick_image_from_batch(payload, picked_idx)
        return _stage_emit_auto(cls, project_id=project_id, payload_str=payload,
                                parent_output_id=parent_output_id,
                                picked_payload=picked_url, picked_index=picked_idx)
