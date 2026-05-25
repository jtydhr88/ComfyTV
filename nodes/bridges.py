import json
import os
from fractions import Fraction

import numpy as np
import torch
from PIL import Image as PILImage

import folder_paths
from comfy_api.latest import io

from .stages import (
    COMFYTV_AUDIO,
    COMFYTV_IMAGE,
    COMFYTV_IMAGES,
    COMFYTV_TEXT,
    COMFYTV_VIDEO,
    _force_run_token,
    _project_id_input,
    _parent_output_id_input,
    _selected_index_input,
    _stage_emit_auto,
    _pick_image_from_batch,
)


def _view_url(filename: str, subfolder: str, type_: str) -> str:
    import urllib.parse
    qs = urllib.parse.urlencode({
        "filename": filename, "subfolder": subfolder, "type": type_,
    })
    return f"/view?{qs}"


def _save_images_to_disk(images: torch.Tensor, prefix: str = "ComfyTV/bridge") -> list[dict]:
    output_dir = folder_paths.get_output_directory()
    h, w = int(images[0].shape[0]), int(images[0].shape[1])
    full_folder, filename, counter, subfolder, _ = folder_paths.get_save_image_path(
        prefix, output_dir, w, h,
    )
    saved: list[dict] = []
    for image in images:
        arr = (255.0 * image.cpu().numpy()).clip(0, 255).astype(np.uint8)
        img = PILImage.fromarray(arr)
        file = f"{filename}_{counter:05}_.png"
        img.save(os.path.join(full_folder, file))
        saved.append({"filename": file, "subfolder": subfolder, "type": "output"})
        counter += 1
    return saved


def _save_video_to_disk(video, prefix: str = "ComfyTV/bridge") -> dict:
    from comfy_api.latest import Types  # type: ignore[attr-defined]

    width, height = video.get_dimensions()
    output_dir = folder_paths.get_output_directory()
    full_folder, filename, counter, subfolder, _ = folder_paths.get_save_image_path(
        prefix, output_dir, width, height,
    )

    fmt = Types.VideoContainer("auto")
    ext = Types.VideoContainer.get_extension(fmt)
    file = f"{filename}_{counter:05}_.{ext}"
    video.save_to(
        os.path.join(full_folder, file),
        format=fmt,
        codec=Types.VideoCodec("auto"),
        metadata=None,
    )
    return {"filename": file, "subfolder": subfolder, "type": "output"}


def _save_audio_to_disk(audio: dict, prefix: str = "ComfyTV/bridge") -> dict:
    import torchaudio

    waveform: torch.Tensor = audio["waveform"]
    sample_rate: int = int(audio["sample_rate"])

    if waveform.dim() == 3:
        waveform = waveform[0]

    output_dir = folder_paths.get_output_directory()
    full_folder, filename, counter, subfolder, _ = folder_paths.get_save_image_path(
        prefix, output_dir, 1, 1,
    )
    file = f"{filename}_{counter:05}_.wav"
    torchaudio.save(
        os.path.join(full_folder, file),
        waveform.cpu(),
        sample_rate,
    )
    return {"filename": file, "subfolder": subfolder, "type": "output"}


def _first_save_to_url(saved: dict | list[dict]) -> str:
    if isinstance(saved, list):
        saved = saved[0]
    return _view_url(
        filename=saved.get("filename", ""),
        subfolder=saved.get("subfolder", ""),
        type_=saved.get("type", "output"),
    )

class BridgeToImage(io.ComfyNode):

    @classmethod
    def define_schema(cls):
        return io.Schema(
            node_id="ComfyTV.BridgeToImage",
            display_name="→ ComfyTV Image",
            category="ComfyTV/Bridge",
            inputs=[
                _force_run_token(),
                _project_id_input(),
                _parent_output_id_input(),
                io.Image.Input("image"),
            ],
            outputs=[COMFYTV_IMAGE.Output("image")],
            is_output_node=True,
            hidden=[io.Hidden.unique_id],
        )

    @classmethod
    def execute(cls, force_run_token=0, project_id="", parent_output_id=0, image=None):
        if image is None or len(image) == 0:
            raise RuntimeError("BridgeToImage: no input image wired")
        saved = _save_images_to_disk(image[:1], prefix="ComfyTV/bridge")
        url = _first_save_to_url(saved)
        return _stage_emit_auto(
            cls, project_id=project_id, payload_str=url,
            parent_output_id=parent_output_id,
        )


class BridgeToImages(io.ComfyNode):

    @classmethod
    def define_schema(cls):
        return io.Schema(
            node_id="ComfyTV.BridgeToImages",
            display_name="→ ComfyTV Images",
            category="ComfyTV/Bridge",
            inputs=[
                _force_run_token(),
                _project_id_input(),
                _parent_output_id_input(),
                io.Image.Input("images"),
                _selected_index_input(),
            ],

            outputs=[COMFYTV_IMAGES.Output("images"), COMFYTV_IMAGE.Output("image")],
            is_output_node=True,
            hidden=[io.Hidden.unique_id],
        )

    @classmethod
    def execute(cls, force_run_token=0, project_id="", parent_output_id=0,
                images=None, selected_index=1):
        if images is None or len(images) == 0:
            raise RuntimeError("BridgeToImages: no input images wired")
        saved = _save_images_to_disk(images, prefix="ComfyTV/bridge")
        payload = json.dumps({
            "images": [
                {
                    "index": str(i + 1),
                    "label": f"#{i + 1}",
                    "image_url": _first_save_to_url(s),
                }
                for i, s in enumerate(saved)
            ]
        })
        picked_idx = int(selected_index or 1)
        picked_url = _pick_image_from_batch(payload, picked_idx)
        return _stage_emit_auto(
            cls, project_id=project_id, payload_str=payload,
            parent_output_id=parent_output_id,
            picked_payload=picked_url, picked_index=picked_idx,
        )


class BridgeToVideo(io.ComfyNode):

    @classmethod
    def define_schema(cls):
        return io.Schema(
            node_id="ComfyTV.BridgeToVideo",
            display_name="→ ComfyTV Video",
            category="ComfyTV/Bridge",
            inputs=[
                _force_run_token(),
                _project_id_input(),
                _parent_output_id_input(),
                io.Video.Input("video"),
            ],
            outputs=[COMFYTV_VIDEO.Output("video")],
            is_output_node=True,
            hidden=[io.Hidden.unique_id],
        )

    @classmethod
    def execute(cls, force_run_token=0, project_id="", parent_output_id=0, video=None):
        if video is None:
            raise RuntimeError("BridgeToVideo: no input video wired")
        saved = _save_video_to_disk(video, prefix="ComfyTV/bridge")
        url = _first_save_to_url(saved)
        return _stage_emit_auto(
            cls, project_id=project_id, payload_str=url,
            parent_output_id=parent_output_id,
        )


class BridgeToText(io.ComfyNode):

    @classmethod
    def define_schema(cls):
        return io.Schema(
            node_id="ComfyTV.BridgeToText",
            display_name="→ ComfyTV Text",
            category="ComfyTV/Bridge",
            inputs=[
                _force_run_token(),
                _project_id_input(),
                _parent_output_id_input(),
                io.String.Input("text", multiline=True, force_input=True),
            ],
            outputs=[COMFYTV_TEXT.Output("text")],
            is_output_node=True,
            hidden=[io.Hidden.unique_id],
        )

    @classmethod
    def execute(cls, force_run_token=0, project_id="", parent_output_id=0, text=""):
        return _stage_emit_auto(
            cls, project_id=project_id, payload_str=str(text or ""),
            parent_output_id=parent_output_id,
        )


class BridgeToAudio(io.ComfyNode):

    @classmethod
    def define_schema(cls):
        return io.Schema(
            node_id="ComfyTV.BridgeToAudio",
            display_name="→ ComfyTV Audio",
            category="ComfyTV/Bridge",
            inputs=[
                _force_run_token(),
                _project_id_input(),
                _parent_output_id_input(),
                io.Audio.Input("audio"),
            ],
            outputs=[COMFYTV_AUDIO.Output("audio")],
            is_output_node=True,
            hidden=[io.Hidden.unique_id],
        )

    @classmethod
    def execute(cls, force_run_token=0, project_id="", parent_output_id=0, audio=None):
        if audio is None:
            raise RuntimeError("BridgeToAudio: no input audio wired")
        saved = _save_audio_to_disk(audio, prefix="ComfyTV/bridge")
        url = _first_save_to_url(saved)
        return _stage_emit_auto(
            cls, project_id=project_id, payload_str=url,
            parent_output_id=parent_output_id,
        )


def _url_to_annotated_path(url: str) -> str:
    import urllib.parse
    if not isinstance(url, str) or not url.startswith("/view?"):
        raise RuntimeError(
            f"expected a ComfyTV /view? URL; got {url!r}"
        )
    qs = urllib.parse.urlparse(url).query
    params = dict(urllib.parse.parse_qsl(qs))
    filename = params.get("filename", "")
    subfolder = params.get("subfolder", "")
    type_ = params.get("type", "output").lower()
    if not filename:
        raise RuntimeError(f"/view? URL has no filename: {url!r}")
    if type_ not in ("output", "input", "temp"):
        raise RuntimeError(f"/view? URL has unknown type={type_!r}")
    path = f"{subfolder}/{filename}" if subfolder else filename
    return f"{path} [{type_}]"


def _load_image_tensor(url: str) -> tuple[torch.Tensor, torch.Tensor]:
    annotated = _url_to_annotated_path(url)
    image_path = folder_paths.get_annotated_filepath(annotated)

    img = PILImage.open(image_path)

    img = img.convert("RGBA") if img.mode in ("P", "LA") else img.convert("RGB")
    arr = np.array(img).astype(np.float32) / 255.0
    if arr.shape[-1] == 4:
        rgb = arr[..., :3]
        mask = 1.0 - arr[..., 3]
    else:
        rgb = arr
        mask = np.zeros(arr.shape[:2], dtype=np.float32)
    image_t = torch.from_numpy(rgb).unsqueeze(0)
    mask_t  = torch.from_numpy(mask).unsqueeze(0)
    return image_t, mask_t


class BridgeFromImage(io.ComfyNode):

    @classmethod
    def define_schema(cls):
        return io.Schema(
            node_id="ComfyTV.BridgeFromImage",
            display_name="← ComfyTV Image",
            category="ComfyTV/Bridge",
            inputs=[
                COMFYTV_IMAGE.Input("image"),
            ],
            outputs=[
                io.Image.Output(display_name="IMAGE"),
            ],
        )

    @classmethod
    def execute(cls, image=""):
        if not image:
            raise RuntimeError("BridgeFromImage: input is empty")
        image_t, _mask_t = _load_image_tensor(str(image))
        return io.NodeOutput(image_t)


class BridgeFromMask(io.ComfyNode):

    @classmethod
    def define_schema(cls):
        return io.Schema(
            node_id="ComfyTV.BridgeFromMask",
            display_name="← ComfyTV Mask",
            category="ComfyTV/Bridge",
            inputs=[
                COMFYTV_IMAGE.Input("image"),
            ],
            outputs=[
                io.Mask.Output(display_name="MASK"),
            ],
        )

    @classmethod
    def execute(cls, image=""):
        if not image:
            raise RuntimeError("BridgeFromMask: input is empty")
        annotated = _url_to_annotated_path(str(image))
        image_path = folder_paths.get_annotated_filepath(annotated)
        img = PILImage.open(image_path).convert("RGBA")
        alpha = np.array(img).astype(np.float32)[..., 3] / 255.0

        mask_t = torch.from_numpy(alpha).unsqueeze(0)
        return io.NodeOutput(mask_t)


class BridgeFromVideo(io.ComfyNode):

    @classmethod
    def define_schema(cls):
        return io.Schema(
            node_id="ComfyTV.BridgeFromVideo",
            display_name="← ComfyTV Video",
            category="ComfyTV/Bridge",
            inputs=[
                COMFYTV_VIDEO.Input("video"),
            ],
            outputs=[
                io.Video.Output(display_name="VIDEO"),
            ],
        )

    @classmethod
    def execute(cls, video=""):
        if not video:
            raise RuntimeError("BridgeFromVideo: input is empty")
        from comfy_api.latest import InputImpl
        annotated = _url_to_annotated_path(str(video))
        path = folder_paths.get_annotated_filepath(annotated)

        return io.NodeOutput(InputImpl.VideoFromFile(path))


class BridgeFromText(io.ComfyNode):

    @classmethod
    def define_schema(cls):
        return io.Schema(
            node_id="ComfyTV.BridgeFromText",
            display_name="← ComfyTV Text",
            category="ComfyTV/Bridge",
            inputs=[
                COMFYTV_TEXT.Input("text"),
            ],
            outputs=[
                io.String.Output(display_name="STRING"),
            ],
        )

    @classmethod
    def execute(cls, text=""):
        return io.NodeOutput(str(text or ""))


class BridgeFromAudio(io.ComfyNode):

    @classmethod
    def define_schema(cls):
        return io.Schema(
            node_id="ComfyTV.BridgeFromAudio",
            display_name="← ComfyTV Audio",
            category="ComfyTV/Bridge",
            inputs=[
                COMFYTV_AUDIO.Input("audio"),
            ],
            outputs=[
                io.Audio.Output(display_name="AUDIO"),
            ],
        )

    @classmethod
    def execute(cls, audio=""):
        if not audio:
            raise RuntimeError("BridgeFromAudio: input is empty")
        import torchaudio
        annotated = _url_to_annotated_path(str(audio))
        path = folder_paths.get_annotated_filepath(annotated)
        waveform, sample_rate = torchaudio.load(path)

        return io.NodeOutput({
            "waveform": waveform.unsqueeze(0),
            "sample_rate": int(sample_rate),
        })


INTO_BRIDGES: list[type[io.ComfyNode]] = [
    BridgeToText, BridgeToImage, BridgeToImages, BridgeToVideo, BridgeToAudio,
]
OUT_BRIDGES: list[type[io.ComfyNode]] = [
    BridgeFromText, BridgeFromImage, BridgeFromVideo, BridgeFromAudio, BridgeFromMask,
]
ALL_BRIDGES = INTO_BRIDGES + OUT_BRIDGES
