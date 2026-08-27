from ._common import *  # noqa: F401, F403
from ...runners import blender as blender_bridge


class BlenderSceneStage(io.ComfyNode):

    @classmethod
    def define_schema(cls):
        return io.Schema(
            node_id="ComfyTV.BlenderSceneStage",
            display_name="Blender Scene",
            category="ComfyTV/3D",
            inputs=[*_standard_stage_inputs()],
            outputs=[],
            hidden=[io.Hidden.unique_id],
        )

    @classmethod
    async def execute(cls, force_run_token=0, project_id="", parent_output_id=0):
        raise StageError(
            "Blender Scene is a workbench, not a runnable stage — edit the "
            "scene in the embedded viewport and pull renders with Blender "
            "Camera / Blender Animation stages.")


class BlenderCameraStage(io.ComfyNode):

    @classmethod
    def define_schema(cls):
        return io.Schema(
            node_id="ComfyTV.BlenderCameraStage",
            display_name="Blender Camera",
            category="ComfyTV/3D",
            inputs=[
                *_standard_stage_inputs(),
                io.String.Input("camera", default="", socketless=True,
                                extra_dict={"hidden": True},
                                tooltip="Scene camera this stage renders. "
                                        "Managed by the camera picker on the card."),
                io.Combo.Input("shading", options=["clay", "full"],
                               default="clay", socketless=True,
                               extra_dict={"hidden": True},
                               tooltip="clay: Workbench driving render (form + "
                                       "motion + camera, for AI stages). "
                                       "full: the scene's own engine, F12."),
            ],
            outputs=[COMFYTV_IMAGE.Output("image")],
            is_output_node=True,
            hidden=[io.Hidden.unique_id],
        )

    @classmethod
    async def execute(cls, force_run_token=0, project_id="", parent_output_id=0,
                      camera="", shading="clay"):
        def _progress(frac: float, text: str):
            _emit_progress(cls, int(frac * 100), 100, text=text)

        payload = await blender_bridge.render_camera(camera, "still",
                                                     shading=shading,
                                                     progress=_progress)
        return _stage_emit_auto(cls, project_id=project_id, payload_str=payload,
                                parent_output_id=parent_output_id)


class BlenderAnimationStage(io.ComfyNode):

    @classmethod
    def define_schema(cls):
        return io.Schema(
            node_id="ComfyTV.BlenderAnimationStage",
            display_name="Blender Animation",
            category="ComfyTV/3D",
            inputs=[
                *_standard_stage_inputs(),
                io.String.Input("camera", default="", socketless=True,
                                extra_dict={"hidden": True},
                                tooltip="Scene camera this stage renders. "
                                        "Managed by the camera picker on the card."),
                io.Combo.Input("shading", options=["clay", "full"],
                               default="clay", socketless=True,
                               extra_dict={"hidden": True},
                               tooltip="clay: Workbench driving render (form + "
                                       "motion + camera, for AI stages). "
                                       "full: the scene's own engine, F12."),
            ],
            outputs=[COMFYTV_VIDEO.Output("video")],
            is_output_node=True,
            hidden=[io.Hidden.unique_id],
        )

    @classmethod
    async def execute(cls, force_run_token=0, project_id="", parent_output_id=0,
                      camera="", shading="clay"):
        def _progress(frac: float, text: str):
            _emit_progress(cls, int(frac * 100), 100, text=text)

        payload = await blender_bridge.render_camera(camera, "animation",
                                                     shading=shading,
                                                     progress=_progress)
        return _stage_emit_auto(cls, project_id=project_id, payload_str=payload,
                                parent_output_id=parent_output_id)
