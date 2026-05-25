from ._common import *  # noqa: F401, F403


def _list_input_files(content_kinds: list[str]) -> list[str]:
    try:
        input_dir = folder_paths.get_input_directory()
        files = [
            f for f in os.listdir(input_dir)
            if os.path.isfile(os.path.join(input_dir, f))
        ]
        return sorted(folder_paths.filter_files_content_types(files, content_kinds))
    except Exception:
        return []


class ImageLoaderStage(io.ComfyNode):

    @classmethod
    def define_schema(cls):
        return io.Schema(
            node_id="ComfyTV.ImageLoaderStage",
            display_name="Load Image",
            category="ComfyTV/Input",
            inputs=[
                _project_id_input(),
                _parent_output_id_input(),
                io.Combo.Input(
                    "image",
                    options=_list_input_files(["image"]),
                    upload=io.UploadType.image,
                    image_folder=io.FolderType.input,
                    optional=True,
                    default="",
                    tooltip="Pick an existing input file or upload a new one. The selected image becomes this stage's output.",
                ),
            ],
            outputs=[COMFYTV_IMAGE.Output("image")],
            is_output_node=True,
            hidden=[io.Hidden.unique_id],
        )

    @classmethod
    def execute(cls, project_id="", parent_output_id=0, image=""):
        payload = _input_file_url(image)
        return _stage_emit_auto(cls, project_id=project_id, payload_str=payload,
                                parent_output_id=parent_output_id)


class VideoLoaderStage(io.ComfyNode):

    @classmethod
    def define_schema(cls):
        return io.Schema(
            node_id="ComfyTV.VideoLoaderStage",
            display_name="Load Video",
            category="ComfyTV/Input",
            inputs=[
                _project_id_input(),
                _parent_output_id_input(),
                io.Combo.Input(
                    "video",
                    options=_list_input_files(["video"]),
                    upload=io.UploadType.video,
                    image_folder=io.FolderType.input,
                    optional=True,
                    default="",
                    tooltip="Pick an existing input file or upload a new one. The selected video becomes this stage's output.",
                ),
            ],
            outputs=[COMFYTV_VIDEO.Output("video")],
            is_output_node=True,
            hidden=[io.Hidden.unique_id],
        )

    @classmethod
    def execute(cls, project_id="", parent_output_id=0, video=""):
        payload = _input_file_url(video)
        return _stage_emit_auto(cls, project_id=project_id, payload_str=payload,
                                parent_output_id=parent_output_id)

