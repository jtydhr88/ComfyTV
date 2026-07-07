from ._common import *


class UpscaleStage(io.ComfyNode):

    @classmethod
    def define_schema(cls):
        return io.Schema(
            node_id="ComfyTV.UpscaleStage",
            display_name="Upscale",
            category="ComfyTV/Image",
            inputs=[
                *_standard_stage_inputs(),
                io.Combo.Input("workflow", options=labels_for('upscale'),
                               default=default_for('upscale'),
                               tooltip="Which upscale workflow to run."),
                io.Combo.Input("scale", options=["2x", "4x"], default="2x",
                               ),
                _main_prompt_input(tooltip="Optional guide prompt for the diffusion-refine pass. Empty → workflow's default (e.g. 'masterpiece, 8k')."),
                COMFYTV_IMAGE.Input("image", optional=True),
                _custom_params_input(),
            ],
            outputs=[COMFYTV_IMAGE.Output("image")],
            is_output_node=True,
            hidden=[io.Hidden.unique_id],
        )

    @classmethod
    async def execute(cls, force_run_token=0, project_id="", parent_output_id=0,
                      workflow="", scale="2x", main_prompt="", image="", custom_params="{}"):
        return await run_stage_workflow(
            cls,
            custom_params=custom_params,
            kind='upscale',
            label=workflow,
            project_id=project_id,
            parent_output_id=parent_output_id,
            main_prompt=main_prompt,
            upstream={'images': [image] if image else []},
            options={'scale': scale},
        )


class OutpaintStage(io.ComfyNode):

    @classmethod
    def define_schema(cls):
        return io.Schema(
            node_id="ComfyTV.OutpaintStage",
            display_name="Outpaint",
            category="ComfyTV/Image",
            inputs=[
                *_standard_stage_inputs(),
                io.Combo.Input("workflow", options=labels_for('outpaint'),
                               default=default_for('outpaint'),
                               tooltip="Which outpaint workflow to run."),
                io.Int.Input("pad_left",   default=0, min=0, max=4096, step=1,
                             socketless=True, extra_dict={"hidden": True},
                             ),
                io.Int.Input("pad_top",    default=0, min=0, max=4096, step=1,
                             socketless=True, extra_dict={"hidden": True},
                             ),
                io.Int.Input("pad_right",  default=0, min=0, max=4096, step=1,
                             socketless=True, extra_dict={"hidden": True},
                             ),
                io.Int.Input("pad_bottom", default=0, min=0, max=4096, step=1,
                             socketless=True, extra_dict={"hidden": True},
                             ),
                io.Int.Input("feathering", default=40, min=0, max=256, step=1,
                             socketless=True, extra_dict={"hidden": True},
                             ),
                _main_prompt_input(placeholder="整张图最终的样子 / Describe the WHOLE finished image — subject + scene + style + lighting (e.g. 'a hiker on a forest path, golden hour, photorealistic'). Don't write instructions like 'extend the scene'.", ),
                COMFYTV_IMAGE.Input("image", optional=True),
                _custom_params_input(),
            ],
            outputs=[COMFYTV_IMAGE.Output("image")],
            is_output_node=True,
            hidden=[io.Hidden.unique_id],
        )

    @classmethod
    async def execute(cls, force_run_token=0, project_id="", parent_output_id=0,
                      workflow="", pad_left=0, pad_top=0, pad_right=0, pad_bottom=0,
                      feathering=40, main_prompt="", image="", custom_params="{}"):
        return await run_stage_workflow(
            cls,
            custom_params=custom_params,
            kind='outpaint',
            label=workflow,
            project_id=project_id,
            parent_output_id=parent_output_id,
            main_prompt=main_prompt,
            upstream={'images': [image] if image else []},
            options={
                'pad_left':   int(pad_left   or 0),
                'pad_top':    int(pad_top    or 0),
                'pad_right':  int(pad_right  or 0),
                'pad_bottom': int(pad_bottom or 0),
                'feathering': int(feathering or 0),
            },
        )


class InpaintStage(io.ComfyNode):

    @classmethod
    def define_schema(cls):
        return io.Schema(
            node_id="ComfyTV.InpaintStage",
            display_name="Inpaint",
            category="ComfyTV/Image",
            inputs=[
                *_standard_stage_inputs(),
                io.Combo.Input("workflow", options=labels_for('inpaint'),
                               default=default_for('inpaint'),
                               tooltip="Which inpaint workflow to run."),
                io.String.Input("mask_data", default="",
                                socketless=True, extra_dict={"hidden": True},
                                ),
                _main_prompt_input(placeholder="Describe what should appear in the masked region (e.g. 'a wooden chair', 'an empty wall').", ),
                COMFYTV_IMAGE.Input("image", optional=True),
                _custom_params_input(),
            ],
            outputs=[COMFYTV_IMAGE.Output("image")],
            is_output_node=True,
            hidden=[io.Hidden.unique_id],
        )

    @classmethod
    async def execute(cls, force_run_token=0, project_id="", parent_output_id=0,
                      workflow="", mask_data="", main_prompt="", image="", custom_params="{}"):
        return await run_stage_workflow(
            cls,
            custom_params=custom_params,
            kind='inpaint',
            label=workflow,
            project_id=project_id,
            parent_output_id=parent_output_id,
            main_prompt=main_prompt,
            upstream={'images': [image] if image else []},
            options={'mask_data': mask_data or ''},
        )


class ImageEditStage(io.ComfyNode):

    @classmethod
    def define_schema(cls):
        return io.Schema(
            node_id="ComfyTV.ImageEditStage",
            display_name="Image Edit",
            category="ComfyTV/Image",
            inputs=[
                *_standard_stage_inputs(),
                io.Combo.Input("workflow", options=labels_for('image-edit'),
                               default=default_for('image-edit'),
                               tooltip="Which instruction-edit workflow to run."),
                _main_prompt_input(placeholder="指令式描述要做什么:\"remove the bicycle\", \"change the dress to red\", \"replace the background with mountains\". Use imperative / action-based language; describe the change, not the whole scene.", ),
                COMFYTV_IMAGE.Input("image", optional=True),
                _custom_params_input(),
            ],
            outputs=[COMFYTV_IMAGE.Output("image")],
            is_output_node=True,
            hidden=[io.Hidden.unique_id],
        )

    @classmethod
    async def execute(cls, force_run_token=0, project_id="", parent_output_id=0,
                      workflow="", main_prompt="", image="", custom_params="{}"):
        return await run_stage_workflow(
            cls,
            custom_params=custom_params,
            kind='image-edit',
            label=workflow,
            project_id=project_id,
            parent_output_id=parent_output_id,
            main_prompt=main_prompt,
            upstream={'images': [image] if image else []},
            options={},
        )


class EraseStage(io.ComfyNode):

    @classmethod
    def define_schema(cls):
        return io.Schema(
            node_id="ComfyTV.EraseStage",
            display_name="Erase",
            category="ComfyTV/Image",
            inputs=[
                *_standard_stage_inputs(),
                io.Combo.Input("workflow", options=labels_for('erase'),
                               default=default_for('erase'),
                               tooltip="Which erase backend to run."),
                io.String.Input("mask_data", default="",
                                socketless=True, extra_dict={"hidden": True},
                                ),
                COMFYTV_IMAGE.Input("image", optional=True),
                _custom_params_input(),
            ],
            outputs=[COMFYTV_IMAGE.Output("image")],
            is_output_node=True,
            hidden=[io.Hidden.unique_id],
        )

    @classmethod
    async def execute(cls, force_run_token=0, project_id="", parent_output_id=0,
                      workflow="", mask_data="", image="", custom_params="{}"):
        return await run_stage_workflow(
            cls,
            custom_params=custom_params,
            kind='erase',
            label=workflow,
            project_id=project_id,
            parent_output_id=parent_output_id,
            main_prompt='',  # erase is promptless — workflow uses a literal fill prompt
            upstream={'images': [image] if image else []},
            options={'mask_data': mask_data or ''},
        )


class CutoutStage(io.ComfyNode):

    @classmethod
    def define_schema(cls):
        return io.Schema(
            node_id="ComfyTV.CutoutStage",
            display_name="Cutout",
            category="ComfyTV/Image",
            inputs=[
                *_standard_stage_inputs(),
                io.Combo.Input("workflow", options=labels_for('cutout'),
                               default=default_for('cutout'),
                               tooltip="Which segmentation backend to run."),
                COMFYTV_IMAGE.Input("image", optional=True),
                _custom_params_input(),
            ],
            outputs=[COMFYTV_IMAGE.Output("image")],
            is_output_node=True,
            hidden=[io.Hidden.unique_id],
        )

    @classmethod
    async def execute(cls, force_run_token=0, project_id="", parent_output_id=0,
                      workflow="", image="", custom_params="{}"):
        return await run_stage_workflow(
            cls,
            custom_params=custom_params,
            kind='cutout',
            label=workflow,
            project_id=project_id,
            parent_output_id=parent_output_id,
            main_prompt='',
            upstream={'images': [image] if image else []},
            options={},
        )


class RelightStage(io.ComfyNode):

    @classmethod
    def define_schema(cls):
        return io.Schema(
            node_id="ComfyTV.RelightStage",
            display_name="Relight",
            category="ComfyTV/Input",
            inputs=[
                _project_id_input(),
                _parent_output_id_input(),
                _main_prompt_input(tooltip="Free-form lighting description; emitted verbatim on the light_prompt output."),
                io.String.Input("lights_data", default="[]",
                                socketless=True, extra_dict={"hidden": True},
                                tooltip="Internal — light-ball editor state (LightInfoEntry[] JSON)."),
                io.String.Input("light_render_url", default="",
                                socketless=True, extra_dict={"hidden": True},
                                tooltip="Internal — /view URL of the auto-uploaded light-ball render."),
            ],
            outputs=[
                COMFYTV_IMAGE.Output("light_render", display_name="3d light"),
                COMFYTV_TEXT.Output("light_prompt"),
            ],
            is_output_node=True,
            hidden=[io.Hidden.unique_id],
        )

    @classmethod
    def execute(cls, project_id="", parent_output_id=0, main_prompt="",
                lights_data="[]", light_render_url=""):
        _emit_progress(cls, 1, 1, text="done")
        row_id = _persist(
            cls=cls,
            project_id=project_id,
            output_type='image',
            payload_url=light_render_url or "",
            params={'lights_data': lights_data or '[]'},
            parent_output_id=parent_output_id,
        )
        ui: dict = {"output": [light_render_url or ""]}
        if row_id is not None:
            ui["output_id"] = [row_id]
        return io.NodeOutput(light_render_url or "", main_prompt or "", ui=ui)


class MultiangleStage(io.ComfyNode):

    @classmethod
    def define_schema(cls):
        return io.Schema(
            node_id="ComfyTV.MultiangleStage",
            display_name="Multiangle",
            category="ComfyTV/Image",
            inputs=[
                *_standard_stage_inputs(),
                io.Combo.Input("workflow", options=labels_for('multiangle'),
                               default=default_for('multiangle'),
                               tooltip="Which multiangle workflow to run."),
                io.Int.Input("horizontal_angle", default=0, min=0, max=360, step=1,
                             display_mode=io.NumberDisplay.slider,
                             ),
                io.Int.Input("vertical_angle", default=0, min=-30, max=60, step=1,
                             display_mode=io.NumberDisplay.slider,
                             ),
                io.Float.Input("zoom", default=5.0, min=0.0, max=10.0, step=0.1,
                               display_mode=io.NumberDisplay.slider,
                               ),
                _main_prompt_input(placeholder="可选:主体/场景的补充描述。LoRA 自己负责相机控制,这里只是给模型多一点上下文(留空也 OK)。 / Optional: extra subject/scene context. The LoRA handles the camera; this just adds detail (empty is fine).", tooltip="Optional supplementary description appended after the LoRA's camera keywords."),
                COMFYTV_IMAGE.Input("image", optional=True),
                _custom_params_input(),
            ],
            outputs=[COMFYTV_IMAGE.Output("image")],
            is_output_node=True,
            hidden=[io.Hidden.unique_id],
        )

    @classmethod
    async def execute(cls, force_run_token=0, project_id="", parent_output_id=0,
                      workflow="", horizontal_angle=0, vertical_angle=0,
                      zoom=5.0, main_prompt="", image="", custom_params="{}"):
        prompt = _multiangle_prompt(horizontal_angle, vertical_angle, zoom,
                                    extra=main_prompt or "")

        return await run_stage_workflow(
            cls,
            custom_params=custom_params,
            kind='multiangle',
            label=workflow,
            project_id=project_id,
            parent_output_id=parent_output_id,
            main_prompt=prompt,
            upstream={'images': [image] if image else []},
            options={},
        )
