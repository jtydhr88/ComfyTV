from ._common import *


class MaterialStage(io.ComfyNode):

    @classmethod
    def define_schema(cls):
        return io.Schema(
            node_id="ComfyTV.MaterialStage",
            display_name="Material",
            category="ComfyTV/Input",
            inputs=[
                _project_id_input(),
                _parent_output_id_input(),
                io.String.Input("material_state", default="{}",
                                socketless=True, extra_dict={"hidden": True},
                                tooltip="Internal — PBR material JSON (color/metalness/roughness/"
                                        "transmission/…). Driven by the material editor in the node body."),
                io.String.Input("captured_image", default="",
                                socketless=True, extra_dict={"hidden": True},
                                tooltip="Internal — /view URL of the material-ball preview snapshot. "
                                        "Written by the node body; becomes the `image` output."),
            ],
            outputs=[
                COMFYTV_MATERIAL.Output("material"),
                COMFYTV_IMAGE.Output("image"),
            ],
            is_output_node=True,
            hidden=[io.Hidden.unique_id],
        )

    @classmethod
    def execute(cls, project_id="", parent_output_id=0, material_state="{}",
                captured_image=""):
        return _stage_emit_auto(cls, project_id=project_id,
                                payload_str=material_state or "{}",
                                parent_output_id=parent_output_id,
                                picked_payload=captured_image or "")
