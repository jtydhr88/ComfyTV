"""Algorithm tier for mesh3d/lineart.py -- skips on CI (no torch)."""
from __future__ import annotations

import numpy as np
import pytest

torch = pytest.importorskip("torch")

from ComfyTV.mesh3d.core import pack_variable_mesh_batch
from ComfyTV.mesh3d.lineart import (
    _weld_positions, default_camera, extract_feature_edges, lineart_image,
)
from ComfyTV.mesh3d.primitives import make_primitive

from mesh3d_utils import item, offset


FRONT_CAM = {'position': [0.0, 0.0, 4.0], 'target': [0.0, 0.0, 0.0], 'fov': 45.0}


def _cube():
    return make_primitive('cube', segments=1)


def _welded_cube():
    v, f, *_ = item(_cube())
    return _weld_positions(v.float(), f.long(), eps=1e-6)


class TestWeld:
    def test_cube_welds_split_corners(self):
        v, f = _welded_cube()
        assert v.shape[0] == 8
        assert f.shape[0] == 12

    def test_degenerate_faces_dropped(self):
        v = torch.tensor([[0.0, 0, 0], [1, 0, 0], [1.0000001, 0, 0], [0, 1, 0]])
        f = torch.tensor([[0, 1, 2], [0, 1, 3]], dtype=torch.long)
        _, f2 = _weld_positions(v, f, eps=1e-3)
        assert f2.shape[0] == 1


class TestFeatureEdges:
    def test_cube_creases(self):
        v, f = _welded_cube()
        cam = torch.tensor([0.0, 0.0, 4.0])
        edges, counts = extract_feature_edges(v, f, cam, silhouette=False, crease=True,
                                              boundary=False, crease_angle_deg=60.0)
        assert counts['crease'] == 12
        assert edges.shape[0] == 12

    def test_cube_silhouette_head_on(self):
        v, f = _welded_cube()
        cam = torch.tensor([0.0, 0.0, 4.0])
        edges, counts = extract_feature_edges(v, f, cam, silhouette=True, crease=False,
                                              boundary=False)
        assert counts['silhouette'] == 4

    def test_closed_cube_has_no_boundary(self):
        v, f = _welded_cube()
        cam = torch.tensor([0.0, 0.0, 4.0])
        _, counts = extract_feature_edges(v, f, cam, silhouette=False, crease=False,
                                          boundary=True)
        assert counts['boundary'] == 0

    def test_plane_boundary(self):
        v, f, *_ = item(make_primitive('plane', segments=1))
        v, f = _weld_positions(v.float(), f.long(), eps=1e-6)
        cam = torch.tensor([0.0, 0.0, 4.0])
        _, counts = extract_feature_edges(v, f, cam, silhouette=False, crease=False,
                                          boundary=True)
        assert counts['boundary'] == 4

    def test_crease_angle_gates_flat_diagonals(self):
        v, f = _welded_cube()
        cam = torch.tensor([0.0, 0.0, 4.0])
        edges, _ = extract_feature_edges(v, f, cam, silhouette=False, crease=True,
                                         boundary=False, crease_angle_deg=1.0)
        assert edges.shape[0] == 12


class TestRender:
    def test_cube_renders_lines(self):
        img, stats = lineart_image(_cube(), camera=FRONT_CAM,
                                   width=256, height=256)
        a = np.asarray(img)
        assert a.shape == (256, 256, 3)
        assert (a > 200).any()
        assert a[0, 0, 0] < 32
        assert stats['feature_edges'] > 0
        assert 0.0 < stats['visible_ratio'] <= 1.0

    def test_invert_swaps_background(self):
        img, _ = lineart_image(_cube(), camera=FRONT_CAM,
                               width=128, height=128, invert=True)
        a = np.asarray(img)
        assert a[0, 0, 0] > 224

    def test_default_camera_used_when_missing(self):
        img, stats = lineart_image(_cube(), camera=None,
                                   width=128, height=128)
        assert (np.asarray(img) > 200).any()
        cam = default_camera(item(_cube())[0].float())
        assert cam['fov'] == 45.0 and len(cam['position']) == 3

    def test_occlusion_hides_back_edges(self):
        cube = _cube()
        _, occluded = lineart_image(cube, camera=FRONT_CAM, width=128, height=128,
                                    occlusion=True, silhouette=False, boundary=False)
        _, wire = lineart_image(cube, camera=FRONT_CAM, width=128, height=128,
                                occlusion=False, silhouette=False, boundary=False)
        assert occluded['visible_ratio'] < wire['visible_ratio']
        assert wire['visible_ratio'] == 1.0

    def test_hidden_object_disappears(self):
        cube = _cube()
        v1, f1, *_ = item(cube)
        v2, f2, *_ = item(offset(cube, 0.0, 0.0, -5.0))
        merged = pack_variable_mesh_batch(
            [torch.cat([v1, v2])], [torch.cat([f1, f2 + v1.shape[0]])])

        img_scene, _ = lineart_image(merged, camera=FRONT_CAM, width=192, height=192)
        img_front, _ = lineart_image(cube, camera=FRONT_CAM, width=192, height=192)
        diff = np.abs(np.asarray(img_scene).astype(np.int16)
                      - np.asarray(img_front).astype(np.int16))
        assert diff.mean() < 0.5

    def test_empty_mesh_raises(self):
        empty = pack_variable_mesh_batch(
            [torch.zeros((0, 3))], [torch.zeros((0, 3), dtype=torch.long)])
        with pytest.raises(RuntimeError):
            lineart_image(empty, camera=FRONT_CAM)

    def test_no_edge_types_raises(self):
        with pytest.raises(RuntimeError):
            lineart_image(make_primitive('sphere'), camera=FRONT_CAM,
                          silhouette=False, crease=False, boundary=False)
