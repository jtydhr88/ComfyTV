"""MESH container + variable-size batch helpers (vendored from pixal3d-squashed)."""

import torch


class MESH:
    def __init__(self, vertices: torch.Tensor, faces: torch.Tensor,
                 uvs: torch.Tensor | None = None,
                 vertex_colors: torch.Tensor | None = None,
                 texture: torch.Tensor | None = None,
                 metallic_roughness: torch.Tensor | None = None,
                 vertex_counts: torch.Tensor | None = None,
                 face_counts: torch.Tensor | None = None,
                 unlit: bool = False,
                 normals: torch.Tensor | None = None,
                 tangents: torch.Tensor | None = None,
                 normal_map: torch.Tensor | None = None,
                 occlusion_in_mr: bool = False,
                 material: dict | None = None,
                 emissive: torch.Tensor | None = None):

        assert (vertex_counts is None) == (face_counts is None), \
            "vertex_counts and face_counts must be provided together (both or neither)"
        self.vertices = vertices            # vertices: (B, N, 3)
        self.faces = faces                  # faces: (B, M, 3)
        self.uvs = uvs                      # uvs: (B, N, 2)
        self.vertex_colors = vertex_colors  # vertex_colors: (B, N, 3 or 4)
        # Optional per-vertex normals: (B, N, 3). When None, save_glb writes no normals
        # and viewers fall back to flat (per-face) shading.
        self.normals = normals
        self.texture = texture              # texture (baseColor): (B, H, W, 3)
        # glTF metallicRoughness texture: (B, H, W, 3), R unused, G=roughness, B=metallic
        self.metallic_roughness = metallic_roughness
        # When vertices/faces are zero-padded to a common N/M across the batch (variable-size mesh batch),
        # these hold the real per-item lengths (B,). None means rows are uniform and no slicing is needed.
        self.vertex_counts = vertex_counts
        self.face_counts = face_counts
        # Render flat / emissive (no scene lighting) when saved, e.g. for gaussian-splat-derived meshes.
        self.unlit = unlit
        # Extra maps / material overrides attached by bake and material nodes; consumed by save_glb.
        self.tangents = tangents            # (B, N, 4) per-vertex tangents for normal mapping
        self.normal_map = normal_map        # tangent-space normal map: (B, H, W, 3)
        self.occlusion_in_mr = occlusion_in_mr  # True = R channel of metallic_roughness holds AO (ORM)
        self.material = material            # scalar/factor overrides
        self.emissive = emissive            # emissive map: (B, H, W, 3)


def pack_variable_mesh_batch(vertices, faces, colors=None, uvs=None, texture=None, unlit=False,
                             normals=None, metallic_roughness=None, tangents=None, normal_map=None,
                             occlusion_in_mr=False, material=None, emissive=None):
    # Pack per-item tensors into padded batches, stashing per-item lengths as runtime attrs.
    # colors/uvs/normals/tangents are 1:1 with vertices (padded to max_vertices); texture/
    # metallic_roughness/normal_map are (B,H,W,*) image stacks passed through unchanged.
    batch_size = len(vertices)
    max_vertices = max(v.shape[0] for v in vertices)
    max_faces = max(f.shape[0] for f in faces)

    packed_vertices = vertices[0].new_zeros((batch_size, max_vertices, vertices[0].shape[1]))
    packed_faces = faces[0].new_zeros((batch_size, max_faces, faces[0].shape[1]))
    vertex_counts = torch.tensor([v.shape[0] for v in vertices], device=vertices[0].device, dtype=torch.int64)
    face_counts = torch.tensor([f.shape[0] for f in faces], device=faces[0].device, dtype=torch.int64)

    for i, (v, f) in enumerate(zip(vertices, faces)):
        packed_vertices[i, :v.shape[0]] = v
        packed_faces[i, :f.shape[0]] = f

    packed_colors = None
    if colors is not None:
        packed_colors = colors[0].new_zeros((batch_size, max_vertices, colors[0].shape[1]))
        for i, c in enumerate(colors):
            assert c.shape[0] == vertices[i].shape[0], (
                f"vertex_colors[{i}] has {c.shape[0]} entries, expected {vertices[i].shape[0]} (1:1 with vertices)"
            )
            packed_colors[i, :c.shape[0]] = c

    packed_uvs = None
    if uvs is not None:
        packed_uvs = uvs[0].new_zeros((batch_size, max_vertices, uvs[0].shape[1]))
        for i, u in enumerate(uvs):
            assert u.shape[0] == vertices[i].shape[0], (
                f"uvs[{i}] has {u.shape[0]} entries, expected {vertices[i].shape[0]} (1:1 with vertices)"
            )
            packed_uvs[i, :u.shape[0]] = u

    packed_normals = None
    if normals is not None:
        packed_normals = normals[0].new_zeros((batch_size, max_vertices, normals[0].shape[1]))
        for i, nrm in enumerate(normals):
            assert nrm.shape[0] == vertices[i].shape[0], (
                f"normals[{i}] has {nrm.shape[0]} entries, expected {vertices[i].shape[0]} (1:1 with vertices)"
            )
            packed_normals[i, :nrm.shape[0]] = nrm

    packed_tangents = None
    if tangents is not None:
        packed_tangents = tangents[0].new_zeros((batch_size, max_vertices, tangents[0].shape[1]))
        for i, tn in enumerate(tangents):
            assert tn.shape[0] == vertices[i].shape[0], (
                f"tangents[{i}] has {tn.shape[0]} entries, expected {vertices[i].shape[0]} (1:1 with vertices)"
            )
            packed_tangents[i, :tn.shape[0]] = tn

    return MESH(packed_vertices, packed_faces,
                uvs=packed_uvs, vertex_colors=packed_colors, texture=texture,
                metallic_roughness=metallic_roughness,
                vertex_counts=vertex_counts, face_counts=face_counts, unlit=unlit,
                normals=packed_normals, tangents=packed_tangents,
                normal_map=normal_map, occlusion_in_mr=occlusion_in_mr,
                material=material, emissive=emissive)


def get_mesh_batch_item(mesh, index):
    # Returns (vertices, faces, colors, uvs, normals) for batch index, slicing to real lengths
    # if the mesh carries per-item counts (variable-size batch).
    v_colors = mesh.vertex_colors
    v_uvs = mesh.uvs
    v_normals = mesh.normals
    if mesh.vertex_counts is not None:
        vertex_count = int(mesh.vertex_counts[index].item())
        face_count = int(mesh.face_counts[index].item())
        vertices = mesh.vertices[index, :vertex_count]
        faces = mesh.faces[index, :face_count]
        colors = v_colors[index, :vertex_count] if v_colors is not None else None
        uvs = v_uvs[index, :vertex_count] if v_uvs is not None else None
        normals = v_normals[index, :vertex_count] if v_normals is not None else None
        return vertices, faces, colors, uvs, normals

    colors = v_colors[index] if v_colors is not None else None
    uvs = v_uvs[index] if v_uvs is not None else None
    normals = v_normals[index] if v_normals is not None else None
    return mesh.vertices[index], mesh.faces[index], colors, uvs, normals
