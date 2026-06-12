import os

WEB_DIRECTORY = "./js"

if os.environ.get("COMFYTV_TESTING") == "1":
    CUSTOM_NODE_DIR = os.path.dirname(os.path.realpath(__file__))

    async def comfy_entrypoint():
        raise RuntimeError("ComfyTV is in test mode — comfy_entrypoint disabled")

    __all__ = ["comfy_entrypoint"]
else:
    from . import db as _db

    CUSTOM_NODE_DIR = os.path.dirname(os.path.realpath(__file__))

    _db.init()

    from . import runners as _runners
    _runners.seed_workflows()

    from . import api as _api
    from . import storage as _storage
    from .nodes.stages import ComfyTVExtension as _ComfyTVExtension

    _storage.ensure_default_project()


    async def comfy_entrypoint():
        return _ComfyTVExtension()


    __all__ = ["comfy_entrypoint"]
