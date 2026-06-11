"""Test fixtures + ComfyUI runtime stubs.

ComfyTV imports `nodes`, `folder_paths`, `server`, `execution`,
`comfy_api.latest`, and `app.database.db` from the ComfyUI process. These
don't exist in a bare pytest run — stub them here BEFORE any ComfyTV
module is imported.

The stubs are intentionally minimal: every test that exercises a real
ComfyUI integration should patch the specific attribute it needs (e.g.
`monkeypatch.setattr(comfy_nodes, "NODE_CLASS_MAPPINGS", {...})`).
"""

from __future__ import annotations

import os
import sys
import types
from pathlib import Path

# Tell ComfyTV/__init__.py to skip the V3 stage-class registration + HTTP route
# bind that need a live ComfyUI process. Must be set BEFORE the first
# `import ComfyTV` anywhere in the test run.
os.environ["COMFYTV_TESTING"] = "1"

# ── Make the package importable as `ComfyTV.*` ───────────────────────────────
# pytest's testpaths is tests/. The package itself sits one level up.
_REPO = Path(__file__).resolve().parent.parent
_PARENT = _REPO.parent
if str(_PARENT) not in sys.path:
    sys.path.insert(0, str(_PARENT))
PKG_NAME = _REPO.name  # "ComfyTV"

# ── Stub ComfyUI runtime modules ─────────────────────────────────────────────


def _make_module(name: str, **attrs) -> types.ModuleType:
    m = types.ModuleType(name)
    for k, v in attrs.items():
        setattr(m, k, v)
    sys.modules[name] = m
    return m


def _ensure_comfyui_stubs():
    # nodes — NODE_CLASS_MAPPINGS dict + minimal entries for the resolver tests
    if "nodes" not in sys.modules:
        class _OutputNode:
            OUTPUT_NODE = True
        _make_module(
            "nodes",
            NODE_CLASS_MAPPINGS={},
            NODE_DISPLAY_NAME_MAPPINGS={},
            _OutputNode=_OutputNode,
        )

    # folder_paths — base_path + user dir helper. Tests that need disk-backed
    # behavior override these via monkeypatch.
    if "folder_paths" not in sys.modules:
        base = str(_REPO / "tests" / "_tmp_user")
        os.makedirs(base, exist_ok=True)
        _make_module(
            "folder_paths",
            base_path=base,
            get_user_directory=lambda: os.path.join(base, "user", "default"),
            get_filename_list=lambda kind: [],
            get_input_directory=lambda: os.path.join(base, "input"),
            get_output_directory=lambda: os.path.join(base, "output"),
            get_temp_directory=lambda: os.path.join(base, "temp"),
            get_directory_by_type=lambda t: os.path.join(base, t),
        )

    # server.PromptServer — needs a singleton with `.instance.routes` (an
    # aiohttp RouteTableDef so `routes.get(...)` decorators don't choke).
    if "server" not in sys.modules:
        from aiohttp import web

        class _PS:
            instance = None
            client_id = None

        ps = _PS()
        ps.routes = web.RouteTableDef()
        ps.send_sync = lambda *a, **k: None
        _PS.instance = ps
        _make_module("server", PromptServer=_PS)

    # execution — only PromptExecutor + CacheType referenced in local_comfy.
    if "execution" not in sys.modules:
        class _CT:
            CLASSIC = "classic"
            NONE = "none"

        class _PE:
            def __init__(self, *a, **k):
                self.success = False
                self.history_result = {}

            async def execute_async(self, *a, **k):
                pass

        _make_module("execution", PromptExecutor=_PE, CacheType=_CT)

    # comfy_api.latest — the v3 io api used by stage nodes. Provide enough so
    # `from comfy_api.latest import ComfyExtension, io` succeeds; individual
    # tests can monkeypatch for richer behavior.
    if "comfy_api" not in sys.modules:
        comfy_api = _make_module("comfy_api")
        latest = _make_module("comfy_api.latest")

        class _Input:
            def __init__(self, *args, **kw):
                self.args = args
                self.kw = kw

        class _Autogrow:
            class TemplatePrefix(_Input):
                pass

            class Type(_Input):
                pass

            Input = _Input  # io.Autogrow.Input(...) factory

        class _Combo(_Input):
            pass

        class _Int(_Input):
            Input = _Input

        class _Float(_Input):
            Input = _Input

        class _Boolean(_Input):
            Input = _Input

        class _String(_Input):
            Input = _Input

        # io.Custom is called like `io.Custom("COMFYTV_TEXT")` at module
        # top level — it's both a callable AND must produce something whose
        # attributes don't error out when referenced as type annotations.
        class _Custom(_Input):
            Input = _Input

        class _NodeOutput:
            def __init__(self, *values, ui=None):
                self.values = values
                self.ui = ui or {}

        # V3 framework: io.ComfyNode is the base class every stage subclasses,
        # io.Schema is the structured constructor used in define_schema().
        class _ComfyNode:
            pass

        class _Schema:
            def __init__(self, **kw):
                self.kw = kw

        # Add `.Input` factory on Combo / Custom so call sites like
        # io.Combo.Input(...) and COMFYTV_TEXT.Input(...) work in stage
        # schema definitions.
        _Combo.Input = _Input
        _Custom.Output = _Input  # Custom("X").Output(...) used in outputs=[]
        _Custom.Input  = _Input

        # io.UploadType / FolderType / Hidden — small enums used by stage
        # loaders. Just attribute dict-of-strings is enough.
        _UploadType = types.SimpleNamespace(image="image", video="video", audio="audio")
        _FolderType = types.SimpleNamespace(input="input", output="output", temp="temp")
        _Hidden     = types.SimpleNamespace(unique_id="unique_id")
        _NumDisplay = types.SimpleNamespace(slider="slider", number="number")

        # io.Color — typing wrapper used by edits stages.
        class _Color(_Input):
            Input = _Input

        io = types.SimpleNamespace(
            Int=_Int, Float=_Float, Boolean=_Boolean, String=_String,
            Combo=_Combo, Custom=_Custom, Autogrow=_Autogrow,
            Color=_Color, NumberDisplay=_NumDisplay,
            NodeOutput=_NodeOutput,
            ComfyNode=_ComfyNode, Schema=_Schema,
            UploadType=_UploadType, FolderType=_FolderType, Hidden=_Hidden,
        )

        class _ComfyExtension:
            pass

        latest.io = io
        latest.ComfyExtension = _ComfyExtension
        comfy_api.latest = latest

    # comfy_config — config_parser.extract_node_configuration is called from
    # ComfyTV/__init__.py. Stub returns an object with a `.project.name` chain
    # since that's all the package init reads.
    if "comfy_config" not in sys.modules:
        class _Project:
            name = "ComfyTV"

        class _Config:
            project = _Project()

        _make_module(
            "comfy_config",
            config_parser=types.SimpleNamespace(
                extract_node_configuration=lambda d: _Config(),
            ),
        )

    # nodes — make sure the stub has EXTENSION_WEB_DIRS dict for the JS dir
    # registration line in ComfyTV/__init__.py.
    if not hasattr(sys.modules.get("nodes"), "EXTENSION_WEB_DIRS"):
        sys.modules["nodes"].EXTENSION_WEB_DIRS = {}

    # comfy.utils + comfy.model_management — used by _emit_progress and
    # _fake_run_ticks. Stub: ProgressBar is a no-op,
    # throw_exception_if_processing_interrupted returns silently.
    if "comfy" not in sys.modules:
        comfy_mod = _make_module("comfy")
        class _PB:
            def __init__(self, *a, **k): pass
            def update_absolute(self, *a, **k): pass
        utils_mod = _make_module("comfy.utils", ProgressBar=_PB)
        mm_mod = _make_module(
            "comfy.model_management",
            throw_exception_if_processing_interrupted=lambda: None,
        )
        comfy_mod.utils = utils_mod
        comfy_mod.model_management = mm_mod

    # app.database.db — only `Session` + `dependencies_available` referenced.
    # Stub: dependencies_available()=False so db.py falls through to the
    # standalone SQLite path, which we redirect to an in-memory DB anyway.
    if "app" not in sys.modules:
        _make_module("app")
        app_database = _make_module("app.database")
        app_db = _make_module(
            "app.database.db",
            Session=None,
            dependencies_available=lambda: False,
        )
        sys.modules["app"].database = app_database
        sys.modules["app.database"].db = app_db


_ensure_comfyui_stubs()


# ── pytest fixtures ──────────────────────────────────────────────────────────

import pytest  # noqa: E402  (imports after stubbing on purpose)


@pytest.fixture()
def reset_db(tmp_path, monkeypatch):
    """Swap ComfyTV.db's engine for a per-test SQLite in tmp_path.

    Yields the `db` module after init so the test body can immediately use
    `db.get_session()`. The original engine is restored on teardown."""
    from ComfyTV import db as comfytv_db

    # Force re-init by clearing the module-level singletons. The first
    # `db.init()` call will then pick up our redirected user dir.
    monkeypatch.setattr(comfytv_db, "_engine", None, raising=True)
    monkeypatch.setattr(comfytv_db, "_Session", None, raising=True)

    # Redirect the fallback path into tmp_path. folder_paths.get_user_directory
    # is consulted by db._user_db_fallback_path.
    user_dir = tmp_path / "user" / "default"
    user_dir.mkdir(parents=True, exist_ok=True)
    import folder_paths
    monkeypatch.setattr(folder_paths, "get_user_directory", lambda: str(user_dir))

    comfytv_db.init()
    yield comfytv_db
    # No restore needed — next test's monkeypatch resets _engine.


@pytest.fixture()
def comfy_nodes(monkeypatch):
    """Yield ComfyUI's mock `nodes` module so a test can register
    NODE_CLASS_MAPPINGS entries with INPUT_TYPES of its choosing."""
    import nodes as comfy_nodes_mod
    fresh: dict = {}
    monkeypatch.setattr(comfy_nodes_mod, "NODE_CLASS_MAPPINGS", fresh, raising=True)
    return comfy_nodes_mod


@pytest.fixture()
def sample_runner_ctx():
    """Build a RunnerContext with sane defaults — tests override fields they
    care about. The default is a text-to-image scenario with no upstream."""
    from ComfyTV.runners.base import RunnerContext

    def _make(**overrides):
        defaults = dict(
            kind="image",
            main_prompt="a forest at dawn",
            upstream={"images": [], "videos": [], "audio": [], "texts": []},
            options={
                "resolution": "1024",
                "aspect_ratio": "1:1",
                "duration_s": 4,
                "seed": 42,
            },
            progress=None,
        )
        defaults.update(overrides)
        return RunnerContext(**defaults)

    return _make


@pytest.fixture()
def sample_workflow_doc(tmp_path):
    """A minimal GUI-format LiteGraph doc with a top-level SaveImage +
    LoadImage + a subgraph instance referring to an inner KSampler. Returns
    `(gui_path, gui_dict, api_dict)` — write `gui_path` yourself if a test
    needs the file to actually exist on disk."""
    gui = {
        "nodes": [
            {"id": 9, "type": "SaveImage", "title": "Save", "pos": [10, 10]},
            {"id": 17, "type": "LoadImage", "title": "Load Image", "pos": [10, 100]},
            {"id": 47, "type": "sub-abc-id", "title": "Inpaint Subgraph", "pos": [200, 50]},
            {"id": 99, "type": "Note", "pos": [0, 0], "widgets_values": ["hi"]},
        ],
        "definitions": {
            "subgraphs": [
                {
                    "id": "sub-abc-id",
                    "nodes": [
                        {"id": 3, "type": "KSampler", "title": "KSampler"},
                        {"id": 23, "type": "CLIPTextEncode", "title": "Prompt"},
                    ],
                }
            ]
        },
        "groups": [
            {"title": "Loaders", "bounding": [0, 0, 500, 200]},
        ],
    }
    api = {
        "9":     {"class_type": "SaveImage",  "inputs": {"filename_prefix": "ComfyUI"}},
        "17":    {"class_type": "LoadImage",  "inputs": {"image": "x.png"}},
        "47:3":  {"class_type": "KSampler",
                  "inputs": {"seed": 1, "steps": 20, "cfg": 7.5,
                             "sampler_name": "euler", "scheduler": "normal",
                             "denoise": 1.0,
                             "model":  ["47:31", 0], "positive": ["47:23", 0],
                             "negative": ["47:24", 0], "latent_image": ["47:5", 0]}},
        "47:23": {"class_type": "CLIPTextEncode",
                  "inputs": {"text": "default", "clip": ["47:34", 0]}},
    }
    gui_path = tmp_path / "sample.json"
    return gui_path, gui, api


@pytest.fixture()
def write_workflow(sample_workflow_doc):
    """Convenience: write the sample GUI workflow to disk and return its path."""
    import json
    gui_path, gui, _api = sample_workflow_doc
    gui_path.write_text(json.dumps(gui), encoding="utf-8")
    return gui_path
