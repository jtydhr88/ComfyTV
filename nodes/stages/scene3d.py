from ._common import *

class Scene3DStage(io.ComfyNode):

    @classmethod
    def define_schema(cls):
        return io.Schema(
            node_id="ComfyTV.Scene3DStage",
            display_name="3D Scene",
            category="ComfyTV/Input",
            inputs=[
                _project_id_input(),
                _parent_output_id_input(),
                io.String.Input("scene_state", default="{}",
                                socketless=True, extra_dict={"hidden": True},
                                tooltip="Internal — Scene3D editor state JSON (characters/primitives/lights/camera/output)."),
                io.Combo.Input("channel", options=["color", "depth", "normal", "openpose"],
                               default="color", socketless=True, extra_dict={"hidden": True},
                               tooltip="Internal — render channel used by capture/record; driven by the node body."),
                io.Int.Input("width", default=1024, min=64, max=4096, step=8,
                             socketless=True, extra_dict={"hidden": True},
                             tooltip="Internal — capture/record width in pixels; also fixes the editor viewport aspect."),
                io.Int.Input("height", default=1024, min=64, max=4096, step=8,
                             socketless=True, extra_dict={"hidden": True},
                             tooltip="Internal — capture/record height in pixels; also fixes the editor viewport aspect."),
                io.String.Input("captured_image", default="",
                                socketless=True, extra_dict={"hidden": True},
                                tooltip="Internal — /view URL of the last Capture upload."),
                io.String.Input("captured_images", default="",
                                socketless=True, extra_dict={"hidden": True},
                                tooltip="Internal — JSON images batch of the last Capture "
                                        "(one entry per scene camera)."),
                io.String.Input("captured_video", default="",
                                socketless=True, extra_dict={"hidden": True},
                                tooltip="Internal — /view URL of the last Record upload."),
            ],
            outputs=[
                COMFYTV_IMAGE.Output("image"),
                COMFYTV_VIDEO.Output("video"),
                COMFYTV_IMAGES.Output("images"),
            ],
            is_output_node=True,
            hidden=[io.Hidden.unique_id],
        )

    @classmethod
    def execute(cls, project_id="", parent_output_id=0, scene_state="{}",
                channel="color", width=1024, height=1024,
                captured_image="", captured_images="", captured_video=""):
        _emit_progress(cls, 1, 1, text="done")
        params = {'scene_state': scene_state or '{}', 'channel': channel,
                  'width': int(width), 'height': int(height)}
        ui: dict = {"output": [captured_image]} if captured_image else {}
        if captured_image:
            row_id = _persist(
                cls=cls,
                project_id=project_id,
                output_type='image',
                payload_url=captured_image,
                params=params,
                parent_output_id=parent_output_id,
            )
            if row_id is not None:
                ui["output_id"] = [row_id]
        if captured_images:
            try:
                batch_json = json.loads(captured_images)
                batch = batch_json.get("images") if isinstance(batch_json, dict) else None
            except (ValueError, TypeError):
                batch = None
            if isinstance(batch, list) and len(batch) > 1:
                _persist(
                    cls=cls,
                    project_id=project_id,
                    output_type='images',
                    payload_url="",
                    payload_json=batch_json,
                    params=params,
                    parent_output_id=parent_output_id,
                )
        if captured_video:
            _persist(
                cls=cls,
                project_id=project_id,
                output_type='video',
                payload_url=captured_video,
                params=params,
                parent_output_id=parent_output_id,
            )
        return io.NodeOutput(captured_image or "", captured_video or "",
                             captured_images or "", ui=ui)
