import os

if os.environ.get("COMFYTV_TESTING") == "1":
    CUSTOM_NODE_DIR = os.path.dirname(os.path.realpath(__file__))

    async def comfy_entrypoint():
        raise RuntimeError("ComfyTV is in test mode — comfy_entrypoint disabled")

    __all__ = ["comfy_entrypoint"]
else:
    import nodes as _comfy_nodes
    from comfy_config import config_parser

    from . import db as _db
    from . import api as _api
    from . import storage as _storage
    from .nodes.stages import ComfyTVExtension as _ComfyTVExtension

    CUSTOM_NODE_DIR = os.path.dirname(os.path.realpath(__file__))

    project_config = config_parser.extract_node_configuration(CUSTOM_NODE_DIR)
    _comfy_nodes.EXTENSION_WEB_DIRS[project_config.project.name] = os.path.join(CUSTOM_NODE_DIR, "js")

    _db.init()
    _storage.ensure_default_project()


    async def comfy_entrypoint():
        return _ComfyTVExtension()


    __all__ = ["comfy_entrypoint"]
