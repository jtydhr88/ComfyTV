from ._common import *


class CropStage(io.ComfyNode):

    @classmethod
    def define_schema(cls):
        return io.Schema(
            node_id="ComfyTV.CropStage",
            display_name="Crop",
            category="ComfyTV/Image",
            inputs=[
                _force_run_token(),
                _project_id_input(),
                _parent_output_id_input(),
                io.Int.Input("crop_x", default=0, min=0, max=8192,
                             socketless=True, extra_dict={"hidden": True}),
                io.Int.Input("crop_y", default=0, min=0, max=8192,
                             socketless=True, extra_dict={"hidden": True}),
                io.Int.Input("crop_w", default=0, min=0, max=8192,
                             socketless=True, extra_dict={"hidden": True}),
                io.Int.Input("crop_h", default=0, min=0, max=8192,
                             socketless=True, extra_dict={"hidden": True}),
                COMFYTV_IMAGE.Input("image", optional=True),
            ],
            outputs=[COMFYTV_IMAGE.Output("image")],
            is_output_node=True,
            hidden=[io.Hidden.unique_id],
        )

    @classmethod
    def execute(cls, force_run_token=0, project_id="", parent_output_id=0,
                crop_x=0, crop_y=0, crop_w=0, crop_h=0, image=""):
        return io.NodeOutput(image)


class RotateStage(io.ComfyNode):

    @classmethod
    def define_schema(cls):
        return io.Schema(
            node_id="ComfyTV.RotateStage",
            display_name="Rotate",
            category="ComfyTV/Image",
            inputs=[
                _force_run_token(),
                _project_id_input(),
                _parent_output_id_input(),
                io.Int.Input("angle", default=0, min=-180, max=180, step=1,
                             socketless=True, extra_dict={"hidden": True},
                             tooltip="Rotation angle in degrees (-180 to 180, positive = clockwise)."),
                COMFYTV_IMAGE.Input("image", optional=True),
            ],
            outputs=[COMFYTV_IMAGE.Output("image")],
            is_output_node=True,
            hidden=[io.Hidden.unique_id],
        )

    @classmethod
    def execute(cls, force_run_token=0, project_id="", parent_output_id=0,
                angle=0, image=""):
        return io.NodeOutput(image)


class MirrorStage(io.ComfyNode):

    @classmethod
    def define_schema(cls):
        return io.Schema(
            node_id="ComfyTV.MirrorStage",
            display_name="Mirror",
            category="ComfyTV/Image",
            inputs=[
                _force_run_token(),
                _project_id_input(),
                _parent_output_id_input(),
                io.Boolean.Input("flip_horizontal", default=False,
                                 socketless=True, extra_dict={"hidden": True},
                                 tooltip="Flip left↔right."),
                io.Boolean.Input("flip_vertical", default=False,
                                 socketless=True, extra_dict={"hidden": True},
                                 tooltip="Flip top↔bottom."),
                COMFYTV_IMAGE.Input("image", optional=True),
            ],
            outputs=[COMFYTV_IMAGE.Output("image")],
            is_output_node=True,
            hidden=[io.Hidden.unique_id],
        )

    @classmethod
    def execute(cls, force_run_token=0, project_id="", parent_output_id=0,
                flip_horizontal=False, flip_vertical=False, image=""):
        return io.NodeOutput(image)


class GridSplitStage(io.ComfyNode):

    @classmethod
    def define_schema(cls):
        return io.Schema(
            node_id="ComfyTV.GridSplitStage",
            display_name="Grid Split",
            category="ComfyTV/Image",
            inputs=[
                _force_run_token(),
                _project_id_input(),
                _parent_output_id_input(),
                io.Int.Input("rows", default=2, min=1, max=10, step=1,
                             socketless=True, extra_dict={"hidden": True},
                             tooltip="Number of grid rows. Hidden — driven by the Vue panel."),
                io.Int.Input("cols", default=2, min=1, max=10, step=1,
                             socketless=True, extra_dict={"hidden": True},
                             tooltip="Number of grid columns. Hidden — driven by the Vue panel."),
                COMFYTV_IMAGE.Input("image", optional=True),
                _selected_index_input(),
            ],

            outputs=[COMFYTV_IMAGES.Output("images"), COMFYTV_IMAGE.Output("image")],
            is_output_node=True,
            hidden=[io.Hidden.unique_id],
        )

    @classmethod
    def execute(cls, force_run_token=0, project_id="", parent_output_id=0,
                rows=2, cols=2, image="", selected_index=1):
        import json as _json
        return io.NodeOutput(_json.dumps({"images": [image] if image else []}), image)


class CompareStage(io.ComfyNode):

    @classmethod
    def define_schema(cls):
        return io.Schema(
            node_id="ComfyTV.CompareStage",
            display_name="Compare",
            category="ComfyTV/Compose",
            inputs=[
                _project_id_input(),
                COMFYTV_IMAGE.Input("image_a", optional=True),
                COMFYTV_IMAGE.Input("image_b", optional=True),
            ],
            outputs=[],
            is_output_node=True,
            hidden=[io.Hidden.unique_id],
        )

    @classmethod
    def execute(cls, project_id="", image_a="", image_b=""):
        return io.NodeOutput()
