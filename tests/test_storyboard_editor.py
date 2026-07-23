"""StoryboardEditorStage — schema contract and output persistence."""
import json


def _stage():
    from ComfyTV.nodes.stages.storyboard_editor import StoryboardEditorStage
    return StoryboardEditorStage


def _input_names(schema) -> list[str]:
    names = []
    for inp in schema.kw["inputs"]:
        if inp.args:
            names.append(inp.args[0])
    return names


def test_schema_contract():
    schema = _stage().define_schema()
    assert schema.kw["node_id"] == "ComfyTV.StoryboardEditorStage"
    assert schema.kw["is_output_node"] is True
    names = _input_names(schema)
    for widget in ("board_state", "width", "height", "captured_image",
                   "captured_images", "animatic_video", "storyboard", "images"):
        assert widget in names
    outputs = schema.kw["outputs"]
    assert len(outputs) == 3


def test_execute_without_capture_is_noop(reset_db):
    out = _stage().execute(project_id="", board_state="{}")
    assert out.values == ("", "", "")
    assert "output" not in out.ui


def test_execute_persists_cover_and_batch(reset_db):
    from ComfyTV import storage
    proj = storage.create_project("sb")
    board_state = json.dumps({
        "version": 1, "width": 1280, "height": 720,
        "defaultBoardTimingMs": 2000,
        "boards": [
            {"uid": "AAAAA", "newShot": True, "compositeUrl": "/view?f=a.png"},
            {"uid": "BBBBB", "newShot": False, "compositeUrl": "/view?f=b.png"},
        ],
    })
    batch = json.dumps({"images": [
        {"index": 1, "label": "1A", "image_url": "/view?f=a.png"},
        {"index": 2, "label": "1A", "image_url": "/view?f=b.png"},
    ]})
    out = _stage().execute(
        project_id=proj["id"], board_state=board_state,
        width=1280, height=720,
        captured_image="/view?f=a.png", captured_images=batch,
        animatic_video="/view?f=animatic.mp4",
    )
    assert out.values == ("/view?f=a.png", batch, "/view?f=animatic.mp4")
    assert out.ui["output"] == ["/view?f=a.png"]
    assert out.ui["output_id"]

    rows = storage.list_outputs(project_id=proj["id"])
    types = sorted(r["output_type"] for r in rows)
    assert types == ["image", "images", "video"]
    vid_row = next(r for r in rows if r["output_type"] == "video")
    assert vid_row["payload_url"] == "/view?f=animatic.mp4"
    img_row = next(r for r in rows if r["output_type"] == "image")
    assert img_row["payload_url"] == "/view?f=a.png"
    params = img_row["params_json"] or {}
    assert json.loads(params["board_state"])["boards"][0]["uid"] == "AAAAA"
    imgs_row = next(r for r in rows if r["output_type"] == "images")
    assert len(imgs_row["payload_json"]["images"]) == 2


def test_animatic_encodes_boards_with_durations(tmp_path):
    import pytest
    av = pytest.importorskip("av")
    np = pytest.importorskip("numpy")
    from PIL import Image
    import folder_paths
    from pathlib import Path
    from ComfyTV.runners import media
    from ComfyTV.runners.animatic import boards_to_animatic

    src_dir = Path(folder_paths.get_output_directory()) / 'sb-src'
    src_dir.mkdir(parents=True, exist_ok=True)
    urls = []
    for name, color in (('red.png', (255, 0, 0)), ('tall.png', (0, 255, 0))):
        p = src_dir / name
        size = (320, 180) if name == 'red.png' else (100, 300)
        Image.new('RGB', size, color).save(p)
        urls.append(media.path_to_view_url(p))

    out_url = boards_to_animatic(
        [
            {"image_url": urls[0], "duration_ms": 1000},
            {"image_url": urls[1], "duration_ms": 500},
            {"image_url": "", "duration_ms": 250},
        ],
        width=320, height=180, fps=8,
    )
    with av.open(str(media.localize(out_url))) as c:
        s = c.streams.video[0]
        frames = [f for pkt in c.demux(s) for f in pkt.decode()]
    # 8 + 4 + 2 frames
    assert len(frames) == 14
    first = frames[0].to_ndarray(format='rgb24')
    assert first.shape == (180, 320, 3)
    assert first[90, 160, 0] > 180 and first[90, 160, 1] < 90
    # letterboxed tall image: pillarbox bars stay dark
    mid = frames[9].to_ndarray(format='rgb24')
    assert mid[90, 5].max() < 40 and mid[90, 160, 1] > 150
    # blank board: near-black
    blank = frames[13].to_ndarray(format='rgb24')
    assert int(blank.mean()) < 30


def test_gif_export_and_caption_burn(tmp_path):
    import pytest
    pytest.importorskip("av")
    from PIL import Image
    import folder_paths
    from pathlib import Path
    from ComfyTV.runners import media
    from ComfyTV.runners.animatic import boards_to_gif, _burn_caption, _load_caption_font
    import numpy as np

    src_dir = Path(folder_paths.get_output_directory()) / 'sb-src'
    src_dir.mkdir(parents=True, exist_ok=True)
    p = src_dir / 'white.png'
    Image.new('RGB', (320, 180), (255, 255, 255)).save(p)
    url = media.path_to_view_url(p)

    out_url = boards_to_gif(
        [
            {"image_url": url, "duration_ms": 800, "caption": "第一镜：走吧"},
            {"image_url": url, "duration_ms": 400},
        ],
        width=320, height=180, burn_captions=True,
    )
    gif_path = media.localize(out_url)
    assert str(gif_path).endswith('.gif')
    with Image.open(gif_path) as g:
        assert g.n_frames == 2
        assert g.size == (320, 180)
        assert g.info.get('duration') in (800, 400)

    # caption burn darkens the bottom band on a white frame
    white = np.full((180, 320, 3), 255, np.uint8)
    burned = _burn_caption(white.copy(), "对白测试")
    assert burned[170, 160].mean() < 240
    assert burned[10, 160].mean() == 255
    assert _load_caption_font(16) is not None


def test_animatic_rejects_empty_and_oversized():
    import pytest
    pytest.importorskip("av")
    from ComfyTV.runners.animatic import boards_to_animatic, MAX_BOARDS
    with pytest.raises(ValueError):
        boards_to_animatic([])
    with pytest.raises(ValueError):
        boards_to_animatic([{"image_url": ""}] * (MAX_BOARDS + 1))
