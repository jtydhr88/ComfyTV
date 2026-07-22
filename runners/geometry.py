"""Backend mesh-geometry helpers: view URL in, local compute (vendored mesh3d), fresh output view URL out."""

import logging

from .media import fresh_output_path, localize, path_to_view_url

_log = logging.getLogger(__name__)

_SUBFOLDER = 'comfytv/3d'


def _parse_primitive_recipe(payload: str):
    import json
    try:
        spec = json.loads(payload)
    except (ValueError, TypeError):
        return None
    prim = spec.get('__prim__') if isinstance(spec, dict) else None
    if not isinstance(prim, dict):
        return None
    return {'kind': str(prim.get('kind', 'cube')).lower(),
            'params': {k: v for k, v in prim.items() if k != 'kind'}}


def load_model_mesh(model: str):
    s = (model or '').strip()
    if not s:
        raise RuntimeError("no model to load")
    if s.startswith('{'):
        prim = _parse_primitive_recipe(s)
        if prim is not None:
            from ..mesh3d.primitives import make_primitive
            return make_primitive(prim['kind'], **prim['params'])
    from ..mesh3d.io3d import load_mesh_bytes
    src = localize(s)
    return load_mesh_bytes(src.read_bytes(), src.suffix)


def save_model_mesh(mesh, index: int = 0) -> str:
    """Serialize one MESH batch item to a fresh output GLB; returns its view URL."""
    from ..mesh3d.io3d import mesh_item_to_glb_bytes
    glb = mesh_item_to_glb_bytes(mesh, index)
    if glb is None:
        raise RuntimeError("mesh operation produced an empty mesh")
    out = fresh_output_path('.glb', _SUBFOLDER)
    out.write_bytes(glb)
    return path_to_view_url(out)


def decimate_model(view_url: str, target_face_count: int, placement_mode: str = 'midpoint',
                   line_quadric_weight: float = 0.0, feature_edge_quadric_weight: float = 0.0,
                   feature_edge_min_dihedral_deg: float = 30.0, clamp_v_to_edge: bool = True):
    from ..mesh3d import ops
    mesh = load_model_mesh(view_url)
    out, stats = ops.decimate(
        mesh, int(target_face_count), placement_mode=placement_mode,
        line_quadric_weight=line_quadric_weight,
        feature_edge_quadric_weight=feature_edge_quadric_weight,
        feature_edge_min_dihedral_deg=feature_edge_min_dihedral_deg,
        clamp_v_to_edge=clamp_v_to_edge)
    out = ops.smooth_normals(out, crease_angle=180.0)
    return save_model_mesh(out), stats


def remesh_model(view_url: str, resolution: int = 512, sign_mode: str = 'udf',
                 smooth_iters: int = 0, band: float = 1.0, project_back: float = 0.0,
                 fix_poles: bool = False, drop_small_components: float = 0.01):
    from ..mesh3d import ops
    mesh = load_model_mesh(view_url)
    out, stats = ops.remesh(
        mesh, resolution=int(resolution), sign_mode=sign_mode,
        smooth_iters=int(smooth_iters), band=float(band),
        project_back=float(project_back), fix_poles=bool(fix_poles),
        drop_small_components=float(drop_small_components))
    out = ops.smooth_normals(out, crease_angle=180.0)
    return save_model_mesh(out), stats


def weld_model(view_url: str, epsilon_rel: float = 1e-5, epsilon_abs: float = 0.0):
    from ..mesh3d import ops
    mesh = load_model_mesh(view_url)
    out, stats = ops.weld(mesh, epsilon_rel=float(epsilon_rel), epsilon_abs=float(epsilon_abs))
    out = ops.smooth_normals(out, crease_angle=180.0)
    return save_model_mesh(out), stats


def fill_holes_model(view_url: str, max_perimeter: float = 0.03, max_verts: int = 16,
                     fill_chains: bool = False, weld_epsilon_rel: float = 1e-5):
    from ..mesh3d import ops
    mesh = load_model_mesh(view_url)
    out, stats = ops.fill_holes(
        mesh, max_perimeter=float(max_perimeter), max_verts=int(max_verts),
        fill_chains=bool(fill_chains), weld_epsilon_rel=float(weld_epsilon_rel))
    out = ops.smooth_normals(out, crease_angle=180.0)
    return save_model_mesh(out), stats


def smooth_normals_model(view_url: str, crease_angle: float = 180.0):
    from ..mesh3d import ops
    mesh = load_model_mesh(view_url)
    out = ops.smooth_normals(mesh, crease_angle=float(crease_angle))
    return save_model_mesh(out), ops.mesh_stats(out)


def unwrap_model(view_url: str, segmenter: str = 'pec', resolution: int = 1024,
                 padding: int = 1, weld_distance: float = 0.0, atlas_preview: int = 1024):
    """UV-unwrap; returns (glb_view_url, atlas_png_view_url, stats)."""
    from ..mesh3d import ops
    mesh = load_model_mesh(view_url)
    out, stats = ops.unwrap(
        mesh, segmenter=segmenter, resolution=int(resolution),
        padding=int(padding), weld_distance=float(weld_distance))
    out = ops.smooth_normals(out, crease_angle=180.0)
    payload = save_model_mesh(out)

    atlas_url = ''
    if atlas_preview > 0:
        import numpy as np
        from PIL import Image
        img = ops.render_uv_atlas(out, resolution=int(atlas_preview))
        pil = Image.fromarray((np.clip(img, 0.0, 1.0) * 255).astype(np.uint8), mode='RGB')
        atlas_path = fresh_output_path('.png', _SUBFOLDER)
        pil.save(atlas_path)
        atlas_url = path_to_view_url(atlas_path)
    return payload, atlas_url, stats


def bake_maps_model(low_url: str, high_url: str, bake_normal: bool = True, bake_ao: bool = True,
                    resolution: int = 1024, cage_distance: float = 0.05,
                    ao_samples: int = 64, ao_max_distance: float = 0.5,
                    ao_strength: float = 1.0, ao_bias: float = 0.01):
    """Bake normal/AO maps in one pass (the GLB round-trip between stages only keeps
    the baseColor texture); returns (glb_view_url, preview_png_url, stats)."""
    from ..mesh3d import ops
    if not bake_normal and not bake_ao:
        raise RuntimeError("bake: enable at least one of normal / ambient occlusion")
    low = load_model_mesh(low_url)
    if low.uvs is None:
        raise RuntimeError(
            "bake: the input model has no UVs — run Mesh UV Unwrap on it first")
    high = load_model_mesh(high_url)

    normal_img = None
    ao_img = None
    if bake_normal:
        normal_img = ops.bake_normal_map(
            low, high, resolution=int(resolution), cage_distance=float(cage_distance))
    if bake_ao:
        ao_img = ops.bake_ambient_occlusion(
            low, high, resolution=int(resolution), samples=int(ao_samples),
            max_distance=float(ao_max_distance), strength=float(ao_strength),
            bias=float(ao_bias))

    out = ops.apply_textures(low, occlusion=ao_img, normal_map=normal_img)
    payload = save_model_mesh(out)

    import numpy as np
    from PIL import Image

    def _to_pil(t):
        a = (t[0].clamp(0.0, 1.0).cpu().numpy() * 255).astype(np.uint8)
        return Image.fromarray(a, mode='RGB')

    panels = [p for p in (
        _to_pil(normal_img) if normal_img is not None else None,
        _to_pil(ao_img) if ao_img is not None else None,
    ) if p is not None]
    if len(panels) == 2:
        w = sum(p.width for p in panels)
        h = max(p.height for p in panels)
        combo = Image.new('RGB', (w, h))
        x = 0
        for p in panels:
            combo.paste(p, (x, 0))
            x += p.width
        preview = combo
    else:
        preview = panels[0]
    preview_path = fresh_output_path('.png', _SUBFOLDER)
    preview.save(preview_path)
    preview_url = path_to_view_url(preview_path)

    stats = ops.mesh_stats(out)
    stats['baked'] = [k for k, on in (('normal', bake_normal), ('ao', bake_ao)) if on]
    stats['resolution'] = int(resolution)
    return payload, preview_url, stats


def primitive_recipe(kind: str, params: dict = None):
    import json
    kind = (kind or 'cube').lower()
    params = {k: v for k, v in dict(params or {}).items() if k != 'kind'}
    payload = json.dumps({'__prim__': {'kind': kind, **params}},
                         separators=(',', ':'), sort_keys=True)
    return payload, {'kind': kind, 'recipe': params}


def boolean_model(url_a: str, url_b: str, op: str = 'union', resolution: int = 256,
                  smooth_iters: int = 0, transform_a: dict = None, transform_b: dict = None):
    from ..mesh3d import ops
    mesh_a = load_model_mesh(url_a)
    mesh_b = load_model_mesh(url_b)
    out, stats = ops.boolean(mesh_a, mesh_b, op=op, resolution=int(resolution),
                             smooth_iters=int(smooth_iters),
                             transform_a=transform_a, transform_b=transform_b)
    out = ops.smooth_normals(out, crease_angle=180.0)
    return save_model_mesh(out), stats


def subdivide_model(view_url: str, iterations: int = 1, smooth_iters: int = 0):
    from ..mesh3d import ops
    mesh = load_model_mesh(view_url)
    out, stats = ops.subdivide(mesh, iterations=int(iterations), smooth_iters=int(smooth_iters))
    out = ops.smooth_normals(out, crease_angle=180.0)
    return save_model_mesh(out), stats


def export_model(view_url: str, fmt: str = 'glb'):
    """Re-encode a model as glb/obj/stl; returns (view_url, stats)."""
    from ..mesh3d import ops
    from ..mesh3d.io3d import export_obj_bytes, export_stl_bytes, mesh_item_to_glb_bytes
    fmt = (fmt or 'glb').lower()
    mesh = load_model_mesh(view_url)
    if fmt == 'glb':
        data = mesh_item_to_glb_bytes(mesh, 0)
        if data is None:
            raise RuntimeError("export: mesh is empty")
    elif fmt == 'obj':
        data = export_obj_bytes(mesh, 0)
    elif fmt == 'stl':
        data = export_stl_bytes(mesh, 0)
    else:
        raise RuntimeError(f"export: unsupported format '{fmt}' (glb/obj/stl)")
    out = fresh_output_path(f'.{fmt}', _SUBFOLDER)
    out.write_bytes(data)
    return path_to_view_url(out), ops.mesh_stats(mesh)


def lineart_model(view_url: str, camera: dict = None, width: int = 1024, height: int = 1024,
                  thickness: float = 2.0, silhouette: bool = True, crease: bool = True,
                  boundary: bool = True, crease_angle: float = 60.0,
                  occlusion: bool = True, invert: bool = False):
    """Render a model's feature lines to a PNG; returns (png_view_url, stats)."""
    from ..mesh3d.lineart import lineart_image
    mesh = load_model_mesh(view_url)
    img, stats = lineart_image(
        mesh, camera=camera, width=int(width), height=int(height),
        thickness=float(thickness), silhouette=bool(silhouette), crease=bool(crease),
        boundary=bool(boundary), crease_angle=float(crease_angle),
        occlusion=bool(occlusion), invert=bool(invert))
    out = fresh_output_path('.png', _SUBFOLDER)
    img.save(out)
    return path_to_view_url(out), stats


def get_model_info(view_url: str) -> dict:
    """Face/vert counts + attribute presence for a model URL (card header info)."""
    from ..mesh3d import ops
    mesh = load_model_mesh(view_url)
    info = ops.mesh_stats(mesh)
    info['has_uvs'] = mesh.uvs is not None
    info['has_vertex_colors'] = mesh.vertex_colors is not None
    info['has_normals'] = mesh.normals is not None
    info['has_texture'] = mesh.texture is not None
    return info
