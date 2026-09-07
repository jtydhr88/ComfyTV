from pathlib import Path

import pytest


@pytest.fixture()
def out_dir(reset_db):
    import folder_paths
    d = Path(folder_paths.get_output_directory()) / "comfytv" / "pano-test"
    d.mkdir(parents=True, exist_ok=True)
    return d


def _png(path, w, h):
    from PIL import Image
    Image.new("RGB", (w, h), (200, 30, 30)).save(path)
    return f"/view?filename={path.name}&subfolder=comfytv/pano-test&type=output"


def test_two_to_one_passes_through(out_dir):
    from ComfyTV.runners.panorama_ingest import ensure_equirect
    url = _png(out_dir / "ok.png", 2048, 1024)
    assert ensure_equirect(url) == (url, None)


def test_wider_than_input_gets_letterboxed_to_two_to_one(out_dir):
    from PIL import Image
    from ComfyTV.runners._media_paths import localize
    from ComfyTV.runners.panorama_ingest import ensure_equirect
    url = _png(out_dir / "narrow.png", 1392, 752)
    out, note = ensure_equirect(url)
    assert out != url and "letterboxed to 1504x752" in note
    with Image.open(localize(out)) as im:
        assert im.size == (1504, 752)
        assert im.getpixel((0, 376)) == (0, 0, 0)
        assert im.getpixel((752, 376)) == (200, 30, 30)


def test_unreadable_source_is_left_alone(reset_db):
    from ComfyTV.runners.panorama_ingest import ensure_equirect
    assert ensure_equirect("/view?filename=missing.png&type=output") == (
        "/view?filename=missing.png&type=output", None)
