from ._common import *

class DirectorTimelineStage(io.ComfyNode):
    @classmethod
    def define_schema(cls):
        return io.Schema(
            node_id="ComfyTV.DirectorTimelineStage",
            display_name="Director Timeline",
            category="ComfyTV/Compose",
            inputs=[
                _force_run_token(),
                _project_id_input(),
                _parent_output_id_input(),

                io.String.Input("timeline_data", default="",
                                socketless=True, extra_dict={"hidden": True},
                                tooltip="Serialized timeline JSON — driven by the Vue panel."),
                io.Int.Input("frame_rate", default=24, min=1, max=120, step=1,
                             socketless=True, extra_dict={"hidden": True},
                             tooltip="Timeline frame rate (fps)."),

                io.Autogrow.Input("images", template=_image_template(24)),
                COMFYTV_AUDIO.Input("audio", optional=True),
            ],
            outputs=[COMFYTV_TIMELINE.Output("timeline")],
            is_output_node=True,
            hidden=[io.Hidden.unique_id],
        )

    @classmethod
    def execute(cls, force_run_token=0, project_id="", parent_output_id=0,
                timeline_data="", frame_rate=24, images=None, audio=""):
        payload = timeline_data or json.dumps({
            "frameRate": int(frame_rate or 24),
            "durationFrames": 0,
            "segments": [],
            "audioSegments": [],
        })
        return _stage_emit_auto(cls, project_id=project_id, payload_str=payload,
                                parent_output_id=parent_output_id)


class TimelineVideoStage(io.ComfyNode):

    @classmethod
    def define_schema(cls):
        return io.Schema(
            node_id="ComfyTV.TimelineVideoStage",
            display_name="Timeline Render",
            category="ComfyTV/Compose",
            inputs=[
                _force_run_token(),
                _project_id_input(),
                _parent_output_id_input(),
                io.Combo.Input("workflow", options=TIMELINE_WORKFLOWS,
                               default=TIMELINE_WORKFLOWS[0] if TIMELINE_WORKFLOWS else "",
                               tooltip="Which multi-shot video backend renders the timeline. Placeholder for now."),
                COMFYTV_TIMELINE.Input("timeline", optional=True),
            ],
            outputs=[COMFYTV_VIDEO.Output("video")],
            is_output_node=True,
            hidden=[io.Hidden.unique_id],
        )

    @classmethod
    async def execute(cls, force_run_token=0, project_id="", parent_output_id=0,
                      workflow="", timeline=""):
        def _progress(value, total, text=""):
            import comfy.model_management
            comfy.model_management.throw_exception_if_processing_interrupted()
            _emit_progress(cls, value, total, text)

        runner = RUNNER_REGISTRY.by_label(workflow, 'timeline')
        payload = None
        if runner is not None:
            try:
                ctx = RunnerContext(
                    kind='timeline',
                    upstream={'timeline': timeline},
                    progress=_progress,
                )
                payload = await runner.invoke(ctx)
            except NotImplementedError:
                payload = None
        if not payload:
            raise RuntimeError(f"TimelineVideoStage: workflow {workflow!r} returned no output")
        return _stage_emit_auto(cls, project_id=project_id, payload_str=payload,
                                parent_output_id=parent_output_id)


