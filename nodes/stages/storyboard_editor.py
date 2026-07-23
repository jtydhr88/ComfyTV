from ._common import *

class StoryboardEditorStage(io.ComfyNode):

    @classmethod
    def define_schema(cls):
        return io.Schema(
            node_id="ComfyTV.StoryboardEditorStage",
            display_name="Storyboard Editor",
            category="ComfyTV/Input",
            inputs=[
                _project_id_input(),
                _parent_output_id_input(),
                COMFYTV_STORYBOARD.Input("storyboard", optional=True),
                COMFYTV_IMAGES.Input("images", optional=True),
                io.String.Input("board_state", default="{}",
                                socketless=True, extra_dict={"hidden": True},
                                tooltip="Internal — storyboard document JSON (boards/timing/metadata/per-board layers)."),
                io.Int.Input("width", default=1280, min=64, max=4096, step=8,
                             socketless=True, extra_dict={"hidden": True},
                             tooltip="Internal — board artboard width in pixels."),
                io.Int.Input("height", default=720, min=64, max=4096, step=8,
                             socketless=True, extra_dict={"hidden": True},
                             tooltip="Internal — board artboard height in pixels."),
                io.String.Input("captured_image", default="",
                                socketless=True, extra_dict={"hidden": True},
                                tooltip="Internal — /view URL of the cover board composite."),
                io.String.Input("captured_images", default="",
                                socketless=True, extra_dict={"hidden": True},
                                tooltip="Internal — JSON images batch, one composite per board."),
                io.String.Input("animatic_video", default="",
                                socketless=True, extra_dict={"hidden": True},
                                tooltip="Internal — /view URL of the last exported animatic video."),
            ],
            outputs=[
                COMFYTV_IMAGE.Output("image"),
                COMFYTV_IMAGES.Output("images"),
                COMFYTV_VIDEO.Output("video"),
            ],
            is_output_node=True,
            hidden=[io.Hidden.unique_id],
        )

    @classmethod
    def execute(cls, project_id="", parent_output_id=0, storyboard=None,
                images=None, board_state="{}", width=1280, height=720,
                captured_image="", captured_images="", animatic_video=""):
        _emit_progress(cls, 1, 1, text="done")
        params = {'board_state': board_state or '{}',
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
            if isinstance(batch, list) and batch:
                _persist(
                    cls=cls,
                    project_id=project_id,
                    output_type='images',
                    payload_url="",
                    payload_json=batch_json,
                    params=params,
                    parent_output_id=parent_output_id,
                )
        if animatic_video:
            _persist(
                cls=cls,
                project_id=project_id,
                output_type='video',
                payload_url=animatic_video,
                params=params,
                parent_output_id=parent_output_id,
            )
        return io.NodeOutput(captured_image or "", captured_images or "",
                             animatic_video or "", ui=ui)
