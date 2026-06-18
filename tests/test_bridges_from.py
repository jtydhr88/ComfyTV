import pytest

np = pytest.importorskip("numpy")
torch = pytest.importorskip("torch")
PILImage = pytest.importorskip("PIL.Image")

import folder_paths
from ComfyTV.nodes.bridges import BridgeFromImage, BridgeFromMask, _load_image_tensor


def _write_rgba(tmp_path, alpha_row):
    h = 3
    w = len(alpha_row)
    rgba = np.zeros((h, w, 4), dtype=np.uint8)
    rgba[..., :3] = 200
    rgba[..., 3] = np.tile(np.array(alpha_row, dtype=np.uint8), (h, 1))
    p = tmp_path / "m.png"
    PILImage.fromarray(rgba, "RGBA").save(p)
    return p, rgba


def test_bridge_from_mask_inverts_alpha(tmp_path, monkeypatch):
    p, rgba = _write_rgba(tmp_path, [0, 64, 128, 255])
    monkeypatch.setattr(
        folder_paths, "get_annotated_filepath", lambda ann: str(p), raising=False,
    )

    out = BridgeFromMask.execute(image="/view?filename=m.png&type=temp")
    mask = out.values[0]

    expected = 1.0 - (rgba[..., 3].astype(np.float32) / 255.0)
    assert tuple(mask.shape) == (1, 3, 4)
    assert torch.allclose(mask[0], torch.from_numpy(expected), atol=1e-6)

    assert mask[0, 0, 0].item() == 1.0
    assert abs(mask[0, 0, 3].item()) < 1e-6


def test_bridge_from_mask_reuses_load_image_tensor(tmp_path, monkeypatch):
    p, _ = _write_rgba(tmp_path, [0, 100, 200, 255])
    monkeypatch.setattr(
        folder_paths, "get_annotated_filepath", lambda ann: str(p), raising=False,
    )

    url = "/view?filename=m.png&type=temp"
    mask = BridgeFromMask.execute(image=url).values[0]
    _img_t, helper_mask = _load_image_tensor(url)
    assert torch.equal(mask, helper_mask)


def test_bridge_from_image_drops_alpha_to_rgb(tmp_path, monkeypatch):
    p, rgba = _write_rgba(tmp_path, [0, 64, 128, 255])
    monkeypatch.setattr(
        folder_paths, "get_annotated_filepath", lambda ann: str(p), raising=False,
    )

    img = BridgeFromImage.execute(image="/view?filename=m.png&type=temp").values[0]
    assert tuple(img.shape) == (1, 3, 4, 3)  # [batch, H, W, RGB]
    expected_rgb = rgba[..., :3].astype(np.float32) / 255.0
    assert torch.allclose(img[0], torch.from_numpy(expected_rgb), atol=1e-6)


def test_load_image_tensor_zero_mask_when_no_alpha(tmp_path, monkeypatch):
    rgb = np.full((3, 4, 3), 200, dtype=np.uint8)
    p = tmp_path / "rgb.png"
    PILImage.fromarray(rgb, "RGB").save(p)
    monkeypatch.setattr(
        folder_paths, "get_annotated_filepath", lambda ann: str(p), raising=False,
    )

    _img_t, mask_t = _load_image_tensor("/view?filename=rgb.png&type=temp")
    assert tuple(mask_t.shape) == (1, 3, 4)
    assert torch.count_nonzero(mask_t).item() == 0
