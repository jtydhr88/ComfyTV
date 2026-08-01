import base64
import mimetypes
import os
import time

from ._common import *  # noqa: F401, F403
from ...runners.media import view_url_to_path
from .. import poster as poster_lib


def _payload_to_data_uri(payload):
    p = view_url_to_path(str(payload or ""))
    if p is None:
        return None
    path = str(p)
    mime = mimetypes.guess_type(path)[0] or "image/png"
    if not mime.startswith("image/"):
        return None
    try:
        with open(path, "rb") as fh:
            raw = fh.read()
    except OSError:
        return None
    return f"data:{mime};base64," + base64.b64encode(raw).decode("ascii")


def _save_poster_png(png_bytes):
    import urllib.parse

    import folder_paths
    output_dir = folder_paths.get_output_directory()
    full_folder, filename, counter, subfolder, _ = folder_paths.get_save_image_path(
        "ComfyTV/poster", output_dir,
    )
    file = f"{filename}_{counter:05}_.png"
    with open(os.path.join(full_folder, file), "wb") as fh:
        fh.write(png_bytes)
    qs = urllib.parse.urlencode({
        "filename": file, "subfolder": subfolder, "type": "output",
    })
    return f"/view?{qs}"


class PosterStage(io.ComfyNode):

    @classmethod
    def define_schema(cls):
        tpls = poster_lib.discover_templates() or ["hero"]
        return io.Schema(
            node_id="ComfyTV.PosterStage",
            display_name="Poster",
            category="ComfyTV/Image",
            inputs=[
                *_standard_stage_inputs(),
                io.Combo.Input("template", options=tpls, default=tpls[0],
                               socketless=True, extra_dict={"hidden": True},
                               tooltip="Layout template. Every element can be dragged, resized, and edited on the card."),
                io.Int.Input("width", default=1240, min=256, max=4096, step=2,
                             socketless=True, extra_dict={"hidden": True},
                             tooltip="Internal — poster width in pixels."),
                io.Int.Input("height", default=1754, min=256, max=4096, step=2,
                             socketless=True, extra_dict={"hidden": True},
                             tooltip="Internal — poster height in pixels."),
                io.String.Input("layout", default="{}", multiline=True, socketless=True,
                                extra_dict={"hidden": True},
                                tooltip="Internal — canvas layout + colors + fonts blob."),
                io.Autogrow.Input("images", template=_image_template(12)),
            ],
            outputs=[COMFYTV_IMAGE.Output("image")],
            is_output_node=True,
            hidden=[io.Hidden.unique_id],
        )

    @classmethod
    def execute(cls, force_run_token=0, project_id="", parent_output_id=0,
                template="", width=1240, height=1754, layout="{}", images=None):
        t0 = time.monotonic()
        uris = []
        for payload in _autogrow_values(images):
            uri = _payload_to_data_uri(payload)
            if uri is not None:
                uris.append(uri)

        _emit_progress(cls, 0, 2, text="composing")
        params = {"template": template, "width": int(width),
                  "height": int(height), "layout": layout or "{}"}
        html = poster_lib.build_html(template, params, uris)
        _emit_progress(cls, 1, 2, text="rendering")
        png = poster_lib.get_worker().render(html, int(width), int(height), scale=1)
        url = _save_poster_png(png)
        return _stage_emit_auto(
            cls, project_id=project_id, payload_str=url,
            params=params, parent_output_id=parent_output_id,
            duration_ms=int((time.monotonic() - t0) * 1000),
        )
