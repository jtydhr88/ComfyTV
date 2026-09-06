import asyncio

import pytest


@pytest.fixture(scope="module")
def registered():
    from ComfyTV.nodes.stages import ComfyTVExtension
    classes = asyncio.run(ComfyTVExtension().get_node_list())
    return {c.__name__: c for c in classes}


def test_registry_and_stage_meta_only_differ_by_the_documented_sets(registered):
    from ComfyTV.nodes.bridges import ALL_BRIDGES
    from ComfyTV.nodes.stages.common.meta import (
        NON_STAGE_NODES, PENDING_STAGES, STAGE_META,
    )
    bridge_names = {c.__name__ for c in ALL_BRIDGES}
    assert set(STAGE_META) - set(registered) == set(PENDING_STAGES)
    assert set(registered) - set(STAGE_META) - bridge_names == set(NON_STAGE_NODES)
    assert not (set(PENDING_STAGES) & set(registered)), "a pending stage got registered — drop it from PENDING_STAGES"


def test_every_registered_stage_builds_a_schema(registered):
    from ComfyTV.nodes.bridges import ALL_BRIDGES
    bridge_names = {c.__name__ for c in ALL_BRIDGES}
    broken = {}
    for name, cls in registered.items():
        if name in bridge_names:
            continue
        try:
            schema = cls.define_schema()
        except Exception as e:  # noqa: BLE001
            broken[name] = f"{type(e).__name__}: {e}"
            continue
        node_id = getattr(schema, "node_id", None) or getattr(schema, "kw", {}).get("node_id")
        if node_id != f"ComfyTV.{name}":
            broken[name] = f"node_id {node_id!r}"
    assert broken == {}


def test_catalog_lists_only_registered_stages_with_runnable_flag(registered):
    from ComfyTV.api.stages import stages_payload
    from ComfyTV.nodes.stages.common.meta import PENDING_STAGES
    rows = {r["node_id"].removeprefix("ComfyTV."): r for r in stages_payload()}
    assert not (set(rows) & set(PENDING_STAGES))
    assert set(rows) <= set(registered)
    assert rows["ImageStage"]["runnable"] is True
    assert rows["CropStage"]["runnable"] is False
    assert rows["AssetImageLoaderStage"]["runnable"] is False


async def test_add_stage_rejects_pending_catalog_entries():
    from ComfyTV.api.mcp_tools.stages import _normalize_stage_class
    with pytest.raises(ValueError, match="unknown stage class"):
        _normalize_stage_class("ComfyTV.StoryboardStage")
    assert _normalize_stage_class("ImageStage") == "ComfyTV.ImageStage"
