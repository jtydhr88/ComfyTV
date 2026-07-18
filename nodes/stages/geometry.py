from ._common import *  # noqa: F401, F403
from ...runners.geometry import (
    bake_maps_model, boolean_model, decimate_model, export_model,
    fill_holes_model, primitive_recipe, remesh_model, smooth_normals_model,
    subdivide_model, unwrap_model, weld_model,
)
from .loaders import _captured_image_input

MESH_OPERATIONS = (
    'decimate', 'remesh', 'weld', 'fill_holes', 'smooth_normals',
    'subdivide', 'unwrap', 'export',
)


def _require_model(stage_label: str, model: str) -> None:
    if not (model or '').strip():
        raise RuntimeError(
            f"{stage_label} needs an upstream model — wire one into the model input."
        )


class MeshOpStage(io.ComfyNode):

    @classmethod
    def define_schema(cls):
        return io.Schema(
            node_id="ComfyTV.MeshOpStage",
            display_name="Mesh Ops",
            category="ComfyTV/3D",
            inputs=[
                *_standard_stage_inputs(),
                io.Combo.Input("operation", options=list(MESH_OPERATIONS), default='decimate',
                               socketless=True, extra_dict={"hidden": True},
                               tooltip="Which mesh operation to run; the card shows its parameters."),
                io.Int.Input("target_face_count", default=50_000, min=100, max=5_000_000,
                             socketless=True, extra_dict={"hidden": True},
                             tooltip="decimate — target max face count (QEM edge collapse)."),
                io.Combo.Input("placement_mode", options=['midpoint', 'qem'], default='midpoint',
                               socketless=True, extra_dict={"hidden": True},
                               tooltip="decimate — midpoint: robust, preserves thin features. "
                                       "qem: QEM-optimal vertex placement (sharper hard surfaces)."),
                io.Float.Input("feature_edge_quadric_weight", default=0.0, min=0.0, max=1000.0, step=1.0,
                               socketless=True, extra_dict={"hidden": True},
                               tooltip="decimate/qem — extra quadric weight on dihedral feature edges. 0 = off."),
                io.Float.Input("feature_edge_min_dihedral_deg", default=30.0, min=0.0, max=180.0, step=1.0,
                               socketless=True, extra_dict={"hidden": True},
                               tooltip="decimate/qem — min dihedral angle (deg) for a feature edge."),
                io.Int.Input("resolution", default=256, min=32, max=1024,
                             socketless=True, extra_dict={"hidden": True},
                             tooltip="remesh — voxel grid resolution. 256 ~ 100k faces, 512 ~ 1M."),
                io.Combo.Input("sign_mode", options=['udf', 'sdf'], default='udf',
                               socketless=True, extra_dict={"hidden": True},
                               tooltip="remesh — udf: robust to messy input. sdf: clean single surface."),
                io.Float.Input("project_back", default=0.0, min=0.0, max=1.0, step=0.05,
                               socketless=True, extra_dict={"hidden": True},
                               tooltip="remesh — lerp verts toward the original surface."),
                io.Int.Input("smooth_iters", default=0, min=0, max=20,
                             socketless=True, extra_dict={"hidden": True},
                             tooltip="Taubin smoothing iterations."),
                io.Float.Input("epsilon_rel", default=1e-5, min=0.0, max=0.01, step=1e-6,
                               socketless=True, extra_dict={"hidden": True},
                               tooltip="weld — tolerance as a fraction of the bbox diagonal."),
                io.Float.Input("max_perimeter", default=0.03, min=0.0, max=10.0, step=0.001,
                               socketless=True, extra_dict={"hidden": True},
                               tooltip="fill_holes — max hole perimeter to fill (mesh units)."),
                io.Int.Input("max_verts", default=16, min=3, max=1024,
                             socketless=True, extra_dict={"hidden": True},
                             tooltip="fill_holes — cap boundary verts per hole."),
                io.Float.Input("crease_angle", default=180.0, min=0.0, max=180.0, step=1.0,
                               socketless=True, extra_dict={"hidden": True},
                               tooltip="smooth_normals — edges sharper than this stay hard. 180 = fully smooth."),
                io.Int.Input("iterations", default=1, min=1, max=4,
                             socketless=True, extra_dict={"hidden": True},
                             tooltip="subdivide — each iteration splits every triangle into 4."),
                io.Combo.Input("segmenter", options=['pec', 'adaptive'], default='pec',
                               socketless=True, extra_dict={"hidden": True},
                               tooltip="unwrap — pec: fast GPU chart segmentation. adaptive: CPU."),
                io.Int.Input("atlas_resolution", default=1024, min=256, max=8192, step=256,
                             socketless=True, extra_dict={"hidden": True},
                             tooltip="unwrap — target atlas resolution for texel-density auto-scale."),
                io.Int.Input("padding", default=1, min=0, max=16,
                             socketless=True, extra_dict={"hidden": True},
                             tooltip="unwrap — texel padding between charts."),
                io.Combo.Input("format", options=['glb', 'obj', 'stl'], default='glb',
                               socketless=True, extra_dict={"hidden": True},
                               tooltip="export — glb keeps everything; obj keeps UVs/normals/colors; "
                                       "stl is bare triangles."),
                COMFYTV_MODEL.Input("model", optional=True),
                _captured_image_input(),
            ],
            outputs=[COMFYTV_MODEL.Output("model"), COMFYTV_IMAGE.Output("image")],
            is_output_node=True,
            hidden=[io.Hidden.unique_id],
        )

    @classmethod
    def execute(cls, force_run_token=0, project_id="", parent_output_id=0,
                operation='decimate',
                target_face_count=50_000, placement_mode='midpoint',
                feature_edge_quadric_weight=0.0, feature_edge_min_dihedral_deg=30.0,
                resolution=256, sign_mode='udf', project_back=0.0, smooth_iters=0,
                epsilon_rel=1e-5, max_perimeter=0.03, max_verts=16,
                crease_angle=180.0, iterations=1,
                segmenter='pec', atlas_resolution=1024, padding=1,
                format='glb', model="", captured_image=""):
        _require_model("Mesh Ops", model)
        picked = captured_image or ""

        if operation == 'decimate':
            payload, stats = decimate_model(
                model, int(target_face_count), placement_mode=placement_mode,
                feature_edge_quadric_weight=float(feature_edge_quadric_weight),
                feature_edge_min_dihedral_deg=float(feature_edge_min_dihedral_deg))
        elif operation == 'remesh':
            payload, stats = remesh_model(
                model, resolution=int(resolution), sign_mode=sign_mode,
                smooth_iters=int(smooth_iters), project_back=float(project_back))
        elif operation == 'weld':
            payload, stats = weld_model(model, epsilon_rel=float(epsilon_rel))
        elif operation == 'fill_holes':
            payload, stats = fill_holes_model(model, max_perimeter=float(max_perimeter),
                                              max_verts=int(max_verts))
        elif operation == 'smooth_normals':
            payload, stats = smooth_normals_model(model, crease_angle=float(crease_angle))
        elif operation == 'subdivide':
            payload, stats = subdivide_model(model, iterations=int(iterations),
                                             smooth_iters=int(smooth_iters))
        elif operation == 'unwrap':
            payload, atlas_url, stats = unwrap_model(
                model, segmenter=segmenter, resolution=int(atlas_resolution),
                padding=int(padding), atlas_preview=min(int(atlas_resolution), 1024))
            picked = atlas_url
        elif operation == 'export':
            payload, stats = export_model(model, fmt=format)
        else:
            raise RuntimeError(f"Mesh Ops: unknown operation '{operation}'")

        return _stage_emit_auto(cls, project_id=project_id, payload_str=payload,
                                params={'op': operation, 'stats': stats},
                                parent_output_id=parent_output_id,
                                picked_payload=picked)


class MeshPrimitiveStage(io.ComfyNode):

    @classmethod
    def define_schema(cls):
        return io.Schema(
            node_id="ComfyTV.MeshPrimitiveStage",
            display_name="Mesh Primitive",
            category="ComfyTV/3D",
            inputs=[
                _project_id_input(),
                _parent_output_id_input(),
                io.Combo.Input("kind", options=['cube', 'sphere', 'cylinder', 'cone', 'plane', 'torus'],
                               default='cube', socketless=True, extra_dict={"hidden": True}),
                io.String.Input("recipe", default="{}",
                                socketless=True, extra_dict={"hidden": True},
                                tooltip="Internal — three.js geometry.parameters JSON for the selected "
                                        "kind (width/radiusTop/phiLength/arc/...); filled by the node body. "
                                        "Downstream ops generate the mesh from this recipe."),
                _captured_image_input(),
            ],
            outputs=[COMFYTV_MODEL.Output("model"), COMFYTV_IMAGE.Output("image")],
            is_output_node=True,
            hidden=[io.Hidden.unique_id],
        )

    @classmethod
    def execute(cls, project_id="", parent_output_id=0,
                kind='cube', recipe="{}", captured_image=""):
        import json
        try:
            params = json.loads(recipe) if (recipe or '').strip() else {}
        except (ValueError, TypeError):
            params = {}
        if not isinstance(params, dict):
            params = {}
        payload, stats = primitive_recipe(kind, params)
        return _stage_emit_auto(cls, project_id=project_id, payload_str=payload,
                                params={'op': 'primitive', 'kind': kind, 'stats': stats},
                                parent_output_id=parent_output_id,
                                picked_payload=captured_image or "")


class MeshBooleanStage(io.ComfyNode):

    @classmethod
    def define_schema(cls):
        return io.Schema(
            node_id="ComfyTV.MeshBooleanStage",
            display_name="Mesh Boolean",
            category="ComfyTV/3D",
            inputs=[
                *_standard_stage_inputs(),
                io.Combo.Input("operation", options=['union', 'difference', 'intersect'],
                               default='union', socketless=True, extra_dict={"hidden": True},
                               tooltip="difference removes model B's volume from model A."),
                io.Int.Input("resolution", default=256, min=32, max=1024,
                             socketless=True, extra_dict={"hidden": True},
                             tooltip="SDF voxel grid resolution. Higher = sharper cut, more faces; "
                                     "follow with a decimate for an exact count."),
                io.Int.Input("smooth_iters", default=0, min=0, max=20,
                             socketless=True, extra_dict={"hidden": True},
                             tooltip="Taubin smoothing iterations on the result."),
                io.String.Input("transform_b", default="", socketless=True,
                                extra_dict={"hidden": True},
                                tooltip="Internal — TRS of model B (position/quaternion/scale JSON) "
                                        "set by the gizmo in the node body."),
                COMFYTV_MODEL.Input("model", optional=True),
                COMFYTV_MODEL.Input("model_b", optional=True),
                _captured_image_input(),
                io.String.Input("transform_a", default="", socketless=True,
                                extra_dict={"hidden": True},
                                tooltip="Internal — TRS of model A (position/quaternion/scale JSON) "
                                        "set by the gizmo in the node body."),
            ],
            outputs=[COMFYTV_MODEL.Output("model"), COMFYTV_IMAGE.Output("image")],
            is_output_node=True,
            hidden=[io.Hidden.unique_id],
        )

    @classmethod
    def execute(cls, force_run_token=0, project_id="", parent_output_id=0,
                operation='union', resolution=256, smooth_iters=0,
                transform_a="", transform_b="",
                model="", model_b="", captured_image=""):
        _require_model("Mesh Boolean", model)
        if not (model_b or '').strip():
            raise RuntimeError(
                "Mesh Boolean needs a second model — wire one into the model_b input."
            )

        def _parse_trs(raw):
            if not (raw or '').strip():
                return None
            try:
                return json.loads(raw)
            except (ValueError, TypeError):
                return None

        payload, stats = boolean_model(model, model_b, op=operation,
                                       resolution=int(resolution),
                                       smooth_iters=int(smooth_iters),
                                       transform_a=_parse_trs(transform_a),
                                       transform_b=_parse_trs(transform_b))
        return _stage_emit_auto(cls, project_id=project_id, payload_str=payload,
                                params={'op': 'boolean', 'stats': stats},
                                parent_output_id=parent_output_id,
                                picked_payload=captured_image or "")


class MeshBakeMapsStage(io.ComfyNode):

    @classmethod
    def define_schema(cls):
        return io.Schema(
            node_id="ComfyTV.MeshBakeMapsStage",
            display_name="Mesh Bake Maps",
            category="ComfyTV/3D",
            inputs=[
                *_standard_stage_inputs(),
                io.Boolean.Input("bake_normal", default=True,
                                 socketless=True, extra_dict={"hidden": True},
                                 tooltip="Bake a tangent-space normal map (glTF/OpenGL +Y) "
                                         "capturing high-poly detail lost to decimation."),
                io.Boolean.Input("bake_ao", default=True,
                                 socketless=True, extra_dict={"hidden": True},
                                 tooltip="Bake an ambient-occlusion map (white = open, dark = crevices), "
                                         "packed into the glTF ORM/occlusionTexture."),
                io.Int.Input("resolution", default=1024, min=256, max=4096, step=256,
                             socketless=True, extra_dict={"hidden": True},
                             tooltip="Baked map resolution."),
                io.Float.Input("cage_distance", default=0.05, min=0.001, max=0.5, step=0.001,
                               socketless=True, extra_dict={"hidden": True},
                               tooltip="Normal bake — surface search band as a fraction of the bbox "
                                       "diagonal. Raise for missing patches; lower if it grabs across gaps."),
                io.Int.Input("ao_samples", default=64, min=4, max=512, step=4,
                             socketless=True, extra_dict={"hidden": True},
                             tooltip="AO rays per texel. More = smoother, slower."),
                io.Float.Input("ao_strength", default=1.0, min=0.0, max=2.0, step=0.05,
                               socketless=True, extra_dict={"hidden": True},
                               tooltip="Scales the occlusion. >1 darkens, <1 lightens."),
                COMFYTV_MODEL.Input("model", optional=True,
                                    tooltip="UV-unwrapped low-poly to bake onto."),
                COMFYTV_MODEL.Input("high_poly", optional=True,
                                    tooltip="High-poly source of the detail (the mesh the low-poly "
                                            "was decimated from)."),
            ],
            outputs=[COMFYTV_MODEL.Output("model"), COMFYTV_IMAGE.Output("maps")],
            is_output_node=True,
            hidden=[io.Hidden.unique_id],
        )

    @classmethod
    def execute(cls, force_run_token=0, project_id="", parent_output_id=0,
                bake_normal=True, bake_ao=True, resolution=1024, cage_distance=0.05,
                ao_samples=64, ao_strength=1.0, model="", high_poly=""):
        _require_model("Mesh Bake Maps", model)
        if not (high_poly or '').strip():
            raise RuntimeError(
                "Mesh Bake Maps needs a high-poly model — wire the pre-decimation mesh "
                "into the high_poly input."
            )
        payload, preview_url, stats = bake_maps_model(
            model, high_poly, bake_normal=bool(bake_normal), bake_ao=bool(bake_ao),
            resolution=int(resolution), cage_distance=float(cage_distance),
            ao_samples=int(ao_samples), ao_strength=float(ao_strength))
        return _stage_emit_auto(cls, project_id=project_id, payload_str=payload,
                                params={'op': 'bake_maps', 'stats': stats,
                                        'maps_url': preview_url},
                                parent_output_id=parent_output_id,
                                picked_payload=preview_url)
