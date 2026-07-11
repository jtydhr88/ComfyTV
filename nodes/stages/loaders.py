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


_MODEL_FILE_SUFFIXES = ('.glb', '.gltf', '.fbx', '.obj', '.spz', '.splat', '.ply', '.ksplat')


def _list_3d_input_files() -> list[str]:
    try:
        base = folder_paths.get_input_directory()
        root = os.path.join(base, "3d")
        os.makedirs(root, exist_ok=True)
        out = []
        for dirpath, _dirs, files in os.walk(root):
            for f in files:
                if f.lower().endswith(_MODEL_FILE_SUFFIXES):
                    rel = os.path.relpath(os.path.join(dirpath, f), base)
                    out.append(rel.replace('\\', '/'))
        return sorted(out)
    except Exception:
        return []


def _asset_loader_inputs() -> list:
    return [
        _project_id_input(),
        _parent_output_id_input(),
        io.String.Input(
            "asset_url",
            default="",
            socketless=True,
            extra_dict={"hidden": True},
            tooltip="Internal — payload URL of the asset picked in the node body. Becomes this stage's output.",
        ),
        io.Int.Input(
            "asset_id",
            default=0, min=0, max=2_147_483_647,
            socketless=True,
            extra_dict={"hidden": True},
            tooltip="Internal — library id of the picked asset (lineage/debug only).",
        ),
        io.String.Input(
            "category",
            default="all",
            socketless=True,
            extra_dict={"hidden": True},
            tooltip="Internal — last-selected category filter, persisted so the node remembers it.",
        ),
    ]


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


class AssetImageLoaderStage(io.ComfyNode):

    @classmethod
    def define_schema(cls):
        return io.Schema(
            node_id="ComfyTV.AssetImageLoaderStage",
            display_name="Load Image from Asset",
            category="ComfyTV/Input",
            inputs=_asset_loader_inputs(),
            outputs=[COMFYTV_IMAGE.Output("image")],
            is_output_node=True,
            hidden=[io.Hidden.unique_id],
        )

    @classmethod
    def execute(cls, project_id="", parent_output_id=0, asset_url="", asset_id=0, category="all"):
        return _stage_emit_auto(cls, project_id=project_id, payload_str=asset_url or "",
                                parent_output_id=parent_output_id)


class AssetVideoLoaderStage(io.ComfyNode):

    @classmethod
    def define_schema(cls):
        return io.Schema(
            node_id="ComfyTV.AssetVideoLoaderStage",
            display_name="Load Video from Asset",
            category="ComfyTV/Input",
            inputs=_asset_loader_inputs(),
            outputs=[COMFYTV_VIDEO.Output("video")],
            is_output_node=True,
            hidden=[io.Hidden.unique_id],
        )

    @classmethod
    def execute(cls, project_id="", parent_output_id=0, asset_url="", asset_id=0, category="all"):
        return _stage_emit_auto(cls, project_id=project_id, payload_str=asset_url or "",
                                parent_output_id=parent_output_id)


class AssetAudioLoaderStage(io.ComfyNode):

    @classmethod
    def define_schema(cls):
        return io.Schema(
            node_id="ComfyTV.AssetAudioLoaderStage",
            display_name="Load Audio from Asset",
            category="ComfyTV/Input",
            inputs=_asset_loader_inputs(),
            outputs=[COMFYTV_AUDIO.Output("audio")],
            is_output_node=True,
            hidden=[io.Hidden.unique_id],
        )

    @classmethod
    def execute(cls, project_id="", parent_output_id=0, asset_url="", asset_id=0, category="all"):
        return _stage_emit_auto(cls, project_id=project_id, payload_str=asset_url or "",
                                parent_output_id=parent_output_id)


def _captured_image_input():
    return io.String.Input(
        "captured_image",
        default="",
        socketless=True,
        extra_dict={"hidden": True},
        tooltip="Internal — /view? URL of the preview-viewport snapshot. Written by the "
                "3D preview in the node body; becomes the `image` output.",
    )


class AssetModelLoaderStage(io.ComfyNode):

    @classmethod
    def define_schema(cls):
        return io.Schema(
            node_id="ComfyTV.AssetModelLoaderStage",
            display_name="Load 3D Model from Asset",
            category="ComfyTV/Input",
            inputs=[*_asset_loader_inputs(), _captured_image_input()],
            outputs=[COMFYTV_MODEL.Output("model"), COMFYTV_IMAGE.Output("image")],
            is_output_node=True,
            hidden=[io.Hidden.unique_id],
        )

    @classmethod
    def execute(cls, project_id="", parent_output_id=0, asset_url="", asset_id=0,
                category="all", captured_image=""):
        return _stage_emit_auto(cls, project_id=project_id, payload_str=asset_url or "",
                                parent_output_id=parent_output_id,
                                picked_payload=captured_image or "")


class ModelLoaderStage(io.ComfyNode):

    @classmethod
    def define_schema(cls):
        return io.Schema(
            node_id="ComfyTV.ModelLoaderStage",
            display_name="Load 3D Model",
            category="ComfyTV/Input",
            inputs=[
                _project_id_input(),
                _parent_output_id_input(),
                io.Combo.Input(
                    "model",
                    options=_list_3d_input_files(),
                    optional=True,
                    default="",
                    socketless=True,
                    extra_dict={"hidden": True},
                    tooltip="Internal — input/3d-relative path of the picked model. Driven by the "
                            "card's thumbnail dropdown; options carry the server-side file list.",
                ),
                _captured_image_input(),
            ],
            outputs=[COMFYTV_MODEL.Output("model"), COMFYTV_IMAGE.Output("image")],
            is_output_node=True,
            hidden=[io.Hidden.unique_id],
        )

    @classmethod
    def execute(cls, project_id="", parent_output_id=0, model="", captured_image=""):
        payload = _input_file_url(model)
        return _stage_emit_auto(cls, project_id=project_id, payload_str=payload,
                                parent_output_id=parent_output_id,
                                picked_payload=captured_image or "")


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


class AudioLoaderStage(io.ComfyNode):

    @classmethod
    def define_schema(cls):
        return io.Schema(
            node_id="ComfyTV.AudioLoaderStage",
            display_name="Load Audio",
            category="ComfyTV/Input",
            inputs=[
                _project_id_input(),
                _parent_output_id_input(),
                io.Combo.Input(
                    "audio",
                    options=_list_input_files(["audio"]),
                    upload=io.UploadType.audio,
                    image_folder=io.FolderType.input,
                    optional=True,
                    default="",
                    tooltip="Pick an existing input file or upload a new one. The selected audio becomes this stage's output.",
                ),
            ],
            outputs=[COMFYTV_AUDIO.Output("audio")],
            is_output_node=True,
            hidden=[io.Hidden.unique_id],
        )

    @classmethod
    def execute(cls, project_id="", parent_output_id=0, audio=""):
        payload = _input_file_url(audio)
        return _stage_emit_auto(cls, project_id=project_id, payload_str=payload,
                                parent_output_id=parent_output_id)

