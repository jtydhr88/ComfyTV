from ._common import *  # noqa: F401, F403


class PanoramaStage(io.ComfyNode):

    @classmethod
    def define_schema(cls):
        return io.Schema(
            node_id="ComfyTV.PanoramaStage",
            display_name="Panorama",
            category="ComfyTV/Panorama",
            inputs=[
                _force_run_token(),
                _project_id_input(),
                _parent_output_id_input(),
                io.Combo.Input("workflow", options=PANORAMA_WORKFLOWS,
                               default=PANORAMA_WORKFLOWS[0] if PANORAMA_WORKFLOWS else "",
                               tooltip="Which panorama generation workflow to invoke on Run. Leave at the default if you only want to upload an HDRI manually."),
                _main_prompt_input(placeholder="Describe the panoramic scene (e.g. 'sunset over a mountain lake').", tooltip="Scene description for the equirectangular panorama. The workflow auto-prepends 'equirectangular 360 degree panorama, ' so just describe content."),
                io.String.Input("manual_source", default="",
                                socketless=True,
                                extra_dict={"hidden": True},
                                tooltip="User-uploaded panorama path (annotated /view? URL string). When non-empty, overrides everything else."),
                COMFYTV_IMAGE.Input("image", optional=True),
            ],
            outputs=[COMFYTV_PANORAMA.Output("panorama")],
            is_output_node=True,
            hidden=[io.Hidden.unique_id],
        )

    @classmethod
    async def execute(cls, force_run_token=0, project_id="", parent_output_id=0,
                      workflow="", main_prompt="", manual_source="", image=""):

        if (manual_source or "").strip():
            return _stage_emit_auto(cls, project_id=project_id,
                                    payload_str=manual_source.strip(),
                                    parent_output_id=parent_output_id)

        runner = RUNNER_REGISTRY.by_label(workflow, 'panorama') if workflow else None
        if runner is not None:
            try:
                user_prompt = (main_prompt or '').strip()
                composed = ("equirectangular 360 degree panorama, " + user_prompt) \
                    if user_prompt else \
                    "equirectangular 360 degree panorama, a peaceful landscape"
                ctx = RunnerContext(
                    kind='panorama',
                    main_prompt=composed,
                    upstream={'images': [image] if image else []},
                    options={},
                )
                payload = await runner.invoke(ctx)
                if payload:
                    return _stage_emit_auto(cls, project_id=project_id,
                                            payload_str=payload,
                                            parent_output_id=parent_output_id)
            except NotImplementedError:
                pass

        source = (image or "").strip()
        if not source:
            raise RuntimeError(
                f"PanoramaStage: workflow {workflow!r} returned no output and no upstream image")
        return _stage_emit_auto(cls, project_id=project_id, payload_str=source,
                                parent_output_id=parent_output_id)


class PanoramaCurrentViewStage(io.ComfyNode):

    @classmethod
    def define_schema(cls):
        return io.Schema(
            node_id="ComfyTV.PanoramaCurrentViewStage",
            display_name="Panorama · Current View",
            category="ComfyTV/Panorama",
            inputs=[
                _force_run_token(),
                _project_id_input(),
                _parent_output_id_input(),
                io.Float.Input("yaw", default=0.0, min=-180.0, max=180.0, step=0.1,
                               socketless=True, extra_dict={"hidden": True},
                               tooltip="Camera azimuth (degrees, -180..180, 0 = forward)."),
                io.Float.Input("pitch", default=0.0, min=-89.0, max=89.0, step=0.1,
                               socketless=True, extra_dict={"hidden": True},
                               tooltip="Camera elevation (degrees, -89..89, 0 = horizon)."),
                io.Float.Input("fov", default=75.0, min=10.0, max=120.0, step=0.5,
                               socketless=True, extra_dict={"hidden": True},
                               tooltip="Vertical field of view in degrees."),
                io.Combo.Input("aspect_ratio", options=IMAGE_ASPECT_RATIOS,
                               default="16:9",
                               socketless=True, extra_dict={"hidden": True},
                               tooltip="Captured view aspect ratio. Locks the preview shell too."),
                io.Combo.Input("resolution", options=IMAGE_RESOLUTIONS, default="1K",
                               socketless=True, extra_dict={"hidden": True},
                               tooltip="Captured view short-side resolution tier (1K=1024, 2K=2048, 4K=4096)."),
                COMFYTV_PANORAMA.Input("panorama", optional=True),
            ],
            outputs=[COMFYTV_IMAGE.Output("image")],
            is_output_node=True,
            hidden=[io.Hidden.unique_id],
        )

    @classmethod
    def execute(cls, force_run_token=0, project_id="", parent_output_id=0,
                yaw=0.0, pitch=0.0, fov=75.0,
                aspect_ratio="16:9", resolution="1K", panorama=""):
        return io.NodeOutput(panorama)


class PanoramaMultiViewStage(io.ComfyNode):

    @classmethod
    def define_schema(cls):
        return io.Schema(
            node_id="ComfyTV.PanoramaMultiViewStage",
            display_name="Panorama · Multi-View",
            category="ComfyTV/Panorama",
            inputs=[
                _force_run_token(),
                _project_id_input(),
                _parent_output_id_input(),
                io.Int.Input("view_count", default=4, min=1, max=64, step=1,
                             socketless=True, extra_dict={"hidden": True},
                             tooltip="How many viewport screenshots to extract. Hidden — driven by the Vue panel's slider."),
                io.Combo.Input("aspect_ratio", options=IMAGE_ASPECT_RATIOS,
                               default="16:9",
                               socketless=True, extra_dict={"hidden": True},
                               tooltip="Per-view aspect ratio."),
                io.Combo.Input("resolution", options=IMAGE_RESOLUTIONS, default="1K",
                               socketless=True, extra_dict={"hidden": True},
                               tooltip="Per-view short-side resolution tier."),
                COMFYTV_PANORAMA.Input("panorama", optional=True),
                _selected_index_input(),
            ],
            outputs=[COMFYTV_IMAGES.Output("images"), COMFYTV_IMAGE.Output("image")],
            is_output_node=True,
            hidden=[io.Hidden.unique_id],
        )

    @classmethod
    def execute(cls, force_run_token=0, project_id="", parent_output_id=0,
                view_count=4, aspect_ratio="16:9", resolution="1K", panorama="",
                selected_index=1):
        import json as _json
        return io.NodeOutput(
            _json.dumps({"images": [panorama] if panorama else []}),
            panorama,
        )


