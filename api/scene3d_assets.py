import os

from ._common import routes

_ASSETS_DIR = os.path.join(
    os.path.dirname(os.path.dirname(os.path.realpath(__file__))), "assets"
)

for _prefix, _sub in (
    ("/comfytv/scene3d", "scene3d"),
    ("/comfytv/camera_presets", "camera_presets"),
    ("/comfytv/fonts", "fonts"),
):
    _path = os.path.join(_ASSETS_DIR, _sub)
    if os.path.isdir(_path):
        routes.static(_prefix, _path)
