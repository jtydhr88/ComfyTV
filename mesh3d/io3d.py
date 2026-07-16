"""GLB/glTF/OBJ/STL parsing and GLB/OBJ/STL export — no external 3D deps (vendored from pixal3d branches)."""

import json
import logging
import struct
from base64 import b64decode
from io import BytesIO

import numpy as np
import torch
from PIL import Image

from .core import get_mesh_batch_item, pack_variable_mesh_batch


# ---------------------------------------------------------------------------
# Mesh parsing: GLB / glTF / OBJ / STL -> MESH (no external deps)
# ---------------------------------------------------------------------------

_GLTF_COMPONENT_DTYPES = {5120: np.int8, 5121: np.uint8, 5122: np.int16,
                          5123: np.uint16, 5125: np.uint32, 5126: np.float32}
_GLTF_TYPE_COUNTS = {"SCALAR": 1, "VEC2": 2, "VEC3": 3, "VEC4": 4, "MAT4": 16}


def _gltf_read_accessor(gltf: dict, buffers: list[bytes], accessor_idx: int) -> np.ndarray:
    acc = gltf["accessors"][accessor_idx]
    if "sparse" in acc:
        raise ValueError("load_mesh: sparse glTF accessors are not supported")
    n_comp = _GLTF_TYPE_COUNTS[acc["type"]]
    dtype = _GLTF_COMPONENT_DTYPES[acc["componentType"]]
    count = acc["count"]
    if "bufferView" not in acc:
        return np.zeros((count, n_comp), dtype=np.float32)
    bv = gltf["bufferViews"][acc["bufferView"]]
    data = buffers[bv.get("buffer", 0)]
    offset = bv.get("byteOffset", 0) + acc.get("byteOffset", 0)
    elem_size = np.dtype(dtype).itemsize * n_comp
    stride = bv.get("byteStride") or elem_size
    if stride == elem_size:
        arr = np.frombuffer(data, dtype=dtype, count=count * n_comp, offset=offset).reshape(count, n_comp)
    else:  # interleaved
        raw = np.frombuffer(data, dtype=np.uint8, count=stride * (count - 1) + elem_size, offset=offset)
        arr = np.lib.stride_tricks.as_strided(
            raw, shape=(count, elem_size), strides=(stride, 1)).copy().view(dtype).reshape(count, n_comp)
    arr = arr.astype(np.float32) if acc["componentType"] != 5125 else arr.astype(np.int64)
    if acc.get("normalized"):
        arr = arr / float(np.iinfo(dtype).max)
    return arr


def _gltf_node_matrix(node: dict) -> np.ndarray:
    if "matrix" in node:
        return np.array(node["matrix"], dtype=np.float64).reshape(4, 4).T  # glTF is column-major
    m = np.eye(4)
    if "scale" in node:
        m[:3, :3] *= np.array(node["scale"], dtype=np.float64)
    if "rotation" in node:  # xyzw
        q = np.array(node["rotation"], dtype=np.float64)
        x, y, z, w = q / max(float(np.linalg.norm(q)), 1e-12)
        rot = np.array([
            [1 - 2 * (y * y + z * z), 2 * (x * y - w * z), 2 * (x * z + w * y)],
            [2 * (x * y + w * z), 1 - 2 * (x * x + z * z), 2 * (y * z - w * x)],
            [2 * (x * z - w * y), 2 * (y * z + w * x), 1 - 2 * (x * x + y * y)],
        ])
        m[:3, :3] = rot @ m[:3, :3]
    if "translation" in node:
        m[:3, 3] = node["translation"]
    return m


def _gltf_image_pil(gltf: dict, buffers: list[bytes], image_idx: int):
    img = gltf["images"][image_idx]
    if "bufferView" in img:
        bv = gltf["bufferViews"][img["bufferView"]]
        data = buffers[bv.get("buffer", 0)]
        raw = data[bv.get("byteOffset", 0):bv.get("byteOffset", 0) + bv["byteLength"]]
    elif img.get("uri", "").startswith("data:"):
        raw = b64decode(img["uri"].split(",", 1)[1])
    else:
        raise ValueError("load_mesh: external image URIs are not supported (use a self-contained .glb)")
    return Image.open(BytesIO(raw)).convert("RGB")


def _parse_gltf(data: bytes):
    # GLB container or a self-contained .gltf (data-URI buffers only).
    if data[:4] == b'glTF':
        _, version, _ = struct.unpack_from('<4sII', data, 0)
        if version != 2:
            raise ValueError(f"load_mesh: unsupported glTF version {version}")
        offset, json_chunk, bin_chunk = 12, None, None
        while offset < len(data):
            length, ctype = struct.unpack_from('<II', data, offset)
            chunk = data[offset + 8:offset + 8 + length]
            if ctype == 0x4E4F534A:
                json_chunk = chunk
            elif ctype == 0x004E4942:
                bin_chunk = chunk
            offset += 8 + length
        gltf = json.loads(json_chunk)
        embedded = bin_chunk
    else:
        gltf = json.loads(data)
        embedded = None

    buffers = []
    for buf in gltf.get("buffers", []):
        uri = buf.get("uri")
        if uri is None:
            buffers.append(embedded or b"")
        elif uri.startswith("data:"):
            buffers.append(b64decode(uri.split(",", 1)[1]))
        else:
            raise ValueError("load_mesh: external buffer URIs are not supported (use .glb)")

    # Walk the scene graph, baking world transforms into the vertices.
    scene = gltf.get("scenes", [{}])[gltf.get("scene", 0)]
    stack = [(idx, np.eye(4)) for idx in scene.get("nodes", [])]
    instances = []  # (mesh_idx, world_matrix)
    while stack:
        idx, parent = stack.pop()
        node = gltf["nodes"][idx]
        world = parent @ _gltf_node_matrix(node)
        if "mesh" in node:
            instances.append((node["mesh"], world))
        stack.extend((child, world) for child in node.get("children", []))
    if not instances:  # no scene graph -> take every mesh at identity
        instances = [(i, np.eye(4)) for i in range(len(gltf.get("meshes", [])))]

    parts = []   # (vertices, faces, uvs, colors, normals)
    texture = None
    texture_index = None
    for mesh_idx, world in instances:
        normal_mat = np.linalg.inv(world[:3, :3]).T
        for prim in gltf["meshes"][mesh_idx].get("primitives", []):
            if prim.get("mode", 4) != 4:
                continue
            v = _gltf_read_accessor(gltf, buffers, prim["attributes"]["POSITION"])[:, :3]
            v = v @ world[:3, :3].T + world[:3, 3]
            if "indices" in prim:
                f = _gltf_read_accessor(gltf, buffers, prim["indices"]).reshape(-1)
            else:
                f = np.arange(v.shape[0])
            f = f.astype(np.int64).reshape(-1, 3)

            uv = None
            if "TEXCOORD_0" in prim["attributes"]:
                uv = _gltf_read_accessor(gltf, buffers, prim["attributes"]["TEXCOORD_0"])[:, :2]

            normals = None
            if "NORMAL" in prim["attributes"]:
                normals = _gltf_read_accessor(gltf, buffers, prim["attributes"]["NORMAL"])[:, :3]
                normals = normals @ normal_mat.T
                normals = normals / np.linalg.norm(normals, axis=1, keepdims=True).clip(1e-12)

            base_color = np.array([1.0, 1.0, 1.0])
            prim_tex_index = None
            material = gltf.get("materials", [{}])[prim["material"]] if "material" in prim else {}
            pbr = material.get("pbrMetallicRoughness", {})
            if "baseColorFactor" in pbr:
                base_color = np.array(pbr["baseColorFactor"][:3])
            if "baseColorTexture" in pbr:
                prim_tex_index = gltf["textures"][pbr["baseColorTexture"]["index"]].get("source")

            colors = None
            if "COLOR_0" in prim["attributes"]:
                colors = _gltf_read_accessor(gltf, buffers, prim["attributes"]["COLOR_0"])[:, :3]
            if base_color.min() < 1.0:
                colors = (colors if colors is not None else np.ones((v.shape[0], 3))) * base_color

            # MESH carries a single texture, so keep the first baseColor
            # texture and fall back to material color for primitives using others.
            if prim_tex_index is not None:
                if texture_index is None:
                    texture_index = prim_tex_index
                    texture = _gltf_image_pil(gltf, buffers, prim_tex_index)
                elif prim_tex_index != texture_index:
                    logging.warning("load_mesh: multiple textures found; keeping the first")
                    uv = None
            if uv is None and texture_index is not None:
                uv = np.zeros((v.shape[0], 2), dtype=np.float32)
            parts.append((v.astype(np.float32), f, uv, colors, normals))

    if not parts:
        raise ValueError("load_mesh: no triangle primitives found")

    any_uv = any(p[2] is not None for p in parts)
    any_color = any(p[3] is not None for p in parts)
    all_normals = all(p[4] is not None for p in parts)
    verts, faces, uvs, colors, normals = [], [], [], [], []
    v_off = 0
    for v, f, uv, c, nrm in parts:
        verts.append(v)
        faces.append(f + v_off)
        if any_uv:
            uvs.append(uv if uv is not None else np.zeros((v.shape[0], 2), dtype=np.float32))
        if any_color:
            colors.append(c if c is not None else np.ones((v.shape[0], 3), dtype=np.float32))
        if all_normals:
            normals.append(nrm)
        v_off += v.shape[0]
    return (np.concatenate(verts), np.concatenate(faces),
            np.concatenate(uvs) if any_uv else None,
            np.concatenate(colors) if any_color else None,
            np.concatenate(normals) if all_normals else None,
            texture)


def _parse_obj(data: bytes):
    positions, texcoords, vertex_colors = [], [], []
    remap: dict[tuple[int, int], int] = {}
    out_v, out_uv, out_c, faces = [], [], [], []
    has_uv = False
    has_color = False

    def corner(token: str) -> int:
        nonlocal has_uv
        parts = token.split('/')
        vi = int(parts[0])
        vi = vi - 1 if vi > 0 else len(positions) + vi
        ti = -1
        if len(parts) > 1 and parts[1]:
            t = int(parts[1])
            ti = t - 1 if t > 0 else len(texcoords) + t
            has_uv = True
        key = (vi, ti)
        idx = remap.get(key)
        if idx is None:
            idx = len(out_v)
            remap[key] = idx
            out_v.append(positions[vi])
            out_uv.append(texcoords[ti] if ti >= 0 else (0.0, 0.0))
            out_c.append(vertex_colors[vi] if vi < len(vertex_colors) else (1.0, 1.0, 1.0))
        return idx

    for line in data.decode('utf-8', 'replace').splitlines():
        parts = line.split()
        if not parts:
            continue
        if parts[0] == 'v' and len(parts) >= 4:
            positions.append(tuple(float(x) for x in parts[1:4]))
            if len(parts) >= 7:  # non-standard "v x y z r g b"
                vertex_colors.append(tuple(float(x) for x in parts[4:7]))
                has_color = True
            else:
                vertex_colors.append((1.0, 1.0, 1.0))
        elif parts[0] == 'vt' and len(parts) >= 3:
            # OBJ v runs bottom-up; MESH uses the glTF convention (top-down).
            texcoords.append((float(parts[1]), 1.0 - float(parts[2])))
        elif parts[0] == 'f' and len(parts) >= 4:
            ids = [corner(tok) for tok in parts[1:]]
            for k in range(1, len(ids) - 1):  # fan triangulation
                faces.append((ids[0], ids[k], ids[k + 1]))

    if not faces:
        raise ValueError("load_mesh: OBJ contains no faces")
    return (np.array(out_v, dtype=np.float32), np.array(faces, dtype=np.int64),
            np.array(out_uv, dtype=np.float32) if has_uv else None,
            np.array(out_c, dtype=np.float32) if has_color else None,
            None, None)


def _parse_stl(data: bytes):
    is_ascii = data[:5].lower() == b'solid' and b'facet' in data[:1024]
    if is_ascii:
        tokens = data.decode('ascii', 'replace').split()
        verts = []
        i = 0
        while i < len(tokens):
            if tokens[i] == 'vertex':
                verts.append((float(tokens[i + 1]), float(tokens[i + 2]), float(tokens[i + 3])))
                i += 4
            else:
                i += 1
        v = np.array(verts, dtype=np.float32)[: (len(verts) // 3) * 3]
    else:
        count = struct.unpack_from('<I', data, 80)[0]
        rec = np.frombuffer(data, dtype=np.dtype([('n', '<f4', 3), ('v', '<f4', (3, 3)), ('attr', '<u2')]),
                            count=count, offset=84)
        v = rec['v'].reshape(-1, 3).astype(np.float32)
    if v.shape[0] < 3:
        raise ValueError("load_mesh: STL contains no triangles")
    faces = np.arange(v.shape[0], dtype=np.int64).reshape(-1, 3)
    return v, faces, None, None, None, None


def load_mesh_bytes(data: bytes, fmt: str = ""):
    """Parse a GLB/glTF/OBJ/STL byte blob into a single-item MESH batch (scene-graph transforms baked in)."""
    fmt = (fmt or "").lstrip(".").lower()
    if fmt == "fbx":
        raise ValueError("load_mesh: FBX is not supported; re-export the model as GLB")
    if fmt in ("glb", "gltf") or data[:4] == b'glTF':
        v, f, uv, colors, normals, texture_pil = _parse_gltf(data)
    elif fmt == "obj":
        v, f, uv, colors, normals, texture_pil = _parse_obj(data)
    elif fmt == "stl":
        v, f, uv, colors, normals, texture_pil = _parse_stl(data)
    elif data.lstrip()[:1] == b'{':
        v, f, uv, colors, normals, texture_pil = _parse_gltf(data)
    else:
        raise ValueError(f"load_mesh: unsupported format '{fmt or 'unknown'}' (need glb/gltf/obj/stl)")

    texture = None
    if texture_pil is not None:
        texture = torch.from_numpy(np.asarray(texture_pil, dtype=np.float32) / 255.0)[None]
    return pack_variable_mesh_batch(
        [torch.from_numpy(np.ascontiguousarray(v))],
        [torch.from_numpy(np.ascontiguousarray(f))],
        colors=[torch.from_numpy(np.ascontiguousarray(colors))] if colors is not None else None,
        uvs=[torch.from_numpy(np.ascontiguousarray(uv))] if uv is not None else None,
        normals=[torch.from_numpy(np.ascontiguousarray(normals))] if normals is not None else None,
        texture=texture,
    )


# ---------------------------------------------------------------------------
# GLB export
# ---------------------------------------------------------------------------

def save_glb(vertices, faces, filepath=None, metadata=None,
             uvs=None, vertex_colors=None, texture_image=None,
             metallic_roughness_image=None, unlit=False,
             normals=None, normal_map_image=None, tangents=None, occlusion_in_mr=False,
             material=None, emissive_image=None):
    """
    Save PyTorch tensor vertices and faces as a GLB file without external dependencies.

    Parameters:
    vertices: torch.Tensor of shape (N, 3) - The vertex coordinates
    faces: torch.Tensor of shape (M, 3) - The face indices (triangle faces)
    filepath: str - Output filepath (should end with .glb). None returns the GLB bytes instead of writing.
    metadata: dict - Optional asset.extras metadata
    uvs: torch.Tensor of shape (N, 2) - Optional per-vertex texture coordinates
    vertex_colors: torch.Tensor of shape (N, 3) or (N, 4) - Optional per-vertex colors in [0, 1]
    texture_image: PIL.Image - Optional baseColor texture, embedded as PNG
    metallic_roughness_image: PIL.Image - Optional glTF metallicRoughness texture
        (R unused, G=roughness, B=metallic), embedded as PNG
    normals: torch.Tensor of shape (N, 3) - Optional per-vertex normals, written as the
        glTF NORMAL attribute. When omitted, NO normals are written and viewers fall back
        to flat (per-face) shading — use smooth_normals to generate them.
    normal_map_image: PIL.Image - Optional tangent-space normal map (glTF/OpenGL +Y),
        written as the material normalTexture. Needs TEXCOORD_0.
    tangents: torch.Tensor of shape (N, 4) - Optional per-vertex tangents (xyz + handedness w),
        written as the glTF TANGENT attribute. Without it viewers derive tangents in-shader.
    occlusion_in_mr: bool - When True, R of metallic_roughness_image holds AO (ORM packing) and
        occlusionTexture is pointed at that same image.
    material: dict - Optional scalar overrides (base_color_factor, metallic/roughness_factor
        with <0 = auto, emissive_factor/strength, normal_scale, occlusion_strength, double_sided).
    emissive_image: PIL.Image - Optional emissive (glow) texture, written as emissiveTexture.
    """

    # Convert tensors to numpy arrays
    vertices_np = vertices.cpu().numpy().astype(np.float32)
    faces_signed = faces.cpu().numpy().astype(np.int64)
    uvs_np = uvs.cpu().numpy().astype(np.float32) if uvs is not None else None
    colors_np = vertex_colors.cpu().numpy().astype(np.float32) if vertex_colors is not None else None
    if colors_np is not None:
        colors_np = np.clip(colors_np, 0.0, 1.0)

    n_verts = vertices_np.shape[0]
    if n_verts == 0:
        raise ValueError("save_glb: vertices is empty")
    if faces_signed.size > 0:
        fmin = int(faces_signed.min())
        fmax = int(faces_signed.max())
        if fmin < 0 or fmax >= n_verts:
            raise ValueError(
                f"save_glb: face index out of range [0, {n_verts}): min={fmin}, max={fmax}"
            )
    if uvs_np is not None and uvs_np.shape[0] != n_verts:
        raise ValueError(
            f"save_glb: uvs has {uvs_np.shape[0]} entries but vertex count is {n_verts}"
        )
    if colors_np is not None and colors_np.shape[0] != n_verts:
        raise ValueError(
            f"save_glb: vertex_colors has {colors_np.shape[0]} entries but vertex count is {n_verts}"
        )

    normals_np = normals.cpu().numpy().astype(np.float32) if normals is not None else None
    if normals_np is not None and normals_np.shape[0] != n_verts:
        raise ValueError(
            f"save_glb: normals has {normals_np.shape[0]} entries but vertex count is {n_verts}"
        )
    tangents_np = tangents.cpu().numpy().astype(np.float32) if tangents is not None else None
    if tangents_np is not None and tangents_np.shape != (n_verts, 4):
        raise ValueError(
            f"save_glb: tangents must be (N, 4) with N={n_verts}, got {tuple(tangents_np.shape)}"
        )
    faces_np = faces_signed.astype(np.uint32)
    texture_png_bytes = None
    if texture_image is not None:
        buf = BytesIO()
        texture_image.save(buf, format="PNG")
        texture_png_bytes = buf.getvalue()
    mr_png_bytes = None
    if metallic_roughness_image is not None:
        buf = BytesIO()
        metallic_roughness_image.save(buf, format="PNG")
        mr_png_bytes = buf.getvalue()
    nm_png_bytes = None
    if normal_map_image is not None:
        buf = BytesIO()
        normal_map_image.save(buf, format="PNG")
        nm_png_bytes = buf.getvalue()
    em_png_bytes = None
    if emissive_image is not None:
        buf = BytesIO()
        emissive_image.save(buf, format="PNG")
        em_png_bytes = buf.getvalue()

    vertices_buffer = vertices_np.tobytes()
    indices_buffer = faces_np.tobytes()
    uvs_buffer = uvs_np.tobytes() if uvs_np is not None else b""
    colors_buffer = colors_np.tobytes() if colors_np is not None else b""
    normals_buffer = normals_np.tobytes() if normals_np is not None else b""
    tangents_buffer = tangents_np.tobytes() if tangents_np is not None else b""
    texture_buffer = texture_png_bytes if texture_png_bytes is not None else b""
    mr_buffer = mr_png_bytes if mr_png_bytes is not None else b""
    nm_buffer = nm_png_bytes if nm_png_bytes is not None else b""
    em_buffer = em_png_bytes if em_png_bytes is not None else b""

    def pad_to_4_bytes(buffer):
        padding_length = (4 - (len(buffer) % 4)) % 4
        return buffer + b'\x00' * padding_length

    # Blob order in one place; offsets accumulated in a pass so adding a buffer is one entry.
    _blobs = [
        ("vertices", vertices_buffer), ("indices", indices_buffer), ("uvs", uvs_buffer),
        ("colors", colors_buffer), ("normals", normals_buffer), ("tangents", tangents_buffer),
        ("texture", texture_buffer), ("mr", mr_buffer), ("nm", nm_buffer), ("em", em_buffer),
    ]
    byte_offset = {}
    acc = 0
    parts = []
    for name, b in _blobs:
        padded = pad_to_4_bytes(b)
        byte_offset[name] = acc
        acc += len(padded)
        parts.append(padded)
    buffer_data = b"".join(parts)

    vertices_byte_length = len(vertices_buffer)
    indices_byte_length = len(indices_buffer)
    vertices_byte_offset = byte_offset["vertices"]
    indices_byte_offset = byte_offset["indices"]
    uvs_byte_offset = byte_offset["uvs"]
    colors_byte_offset = byte_offset["colors"]
    normals_byte_offset = byte_offset["normals"]
    tangents_byte_offset = byte_offset["tangents"]
    texture_byte_offset = byte_offset["texture"]
    mr_byte_offset = byte_offset["mr"]
    nm_byte_offset = byte_offset["nm"]
    em_byte_offset = byte_offset["em"]

    buffer_views = [
        {
            "buffer": 0,
            "byteOffset": vertices_byte_offset,
            "byteLength": vertices_byte_length,
            "target": 34962  # ARRAY_BUFFER
        },
        {
            "buffer": 0,
            "byteOffset": indices_byte_offset,
            "byteLength": indices_byte_length,
            "target": 34963  # ELEMENT_ARRAY_BUFFER
        }
    ]
    accessors = [
        {
            "bufferView": 0,
            "byteOffset": 0,
            "componentType": 5126,  # FLOAT
            "count": len(vertices_np),
            "type": "VEC3",
            "max": vertices_np.max(axis=0).tolist(),
            "min": vertices_np.min(axis=0).tolist()
        },
        {
            "bufferView": 1,
            "byteOffset": 0,
            "componentType": 5125,  # UNSIGNED_INT
            "count": faces_np.size,
            "type": "SCALAR"
        }
    ]
    primitive_attributes = {"POSITION": 0}

    if uvs_np is not None and len(uvs_np) > 0:
        buffer_views.append({
            "buffer": 0,
            "byteOffset": uvs_byte_offset,
            "byteLength": len(uvs_buffer),
            "target": 34962
        })
        accessor_idx = len(accessors)
        accessors.append({
            "bufferView": len(buffer_views) - 1,
            "byteOffset": 0,
            "componentType": 5126,
            "count": len(uvs_np),
            "type": "VEC2",
        })
        primitive_attributes["TEXCOORD_0"] = accessor_idx

    if colors_np is not None and len(colors_np) > 0:
        buffer_views.append({
            "buffer": 0,
            "byteOffset": colors_byte_offset,
            "byteLength": len(colors_buffer),
            "target": 34962
        })
        accessor_idx = len(accessors)
        accessors.append({
            "bufferView": len(buffer_views) - 1,
            "byteOffset": 0,
            "componentType": 5126,
            "count": len(colors_np),
            "type": "VEC3" if colors_np.shape[1] == 3 else "VEC4",
        })
        primitive_attributes["COLOR_0"] = accessor_idx

    if normals_np is not None and len(normals_np) > 0:
        buffer_views.append({
            "buffer": 0,
            "byteOffset": normals_byte_offset,
            "byteLength": len(normals_buffer),
            "target": 34962
        })
        accessor_idx = len(accessors)
        accessors.append({
            "bufferView": len(buffer_views) - 1,
            "byteOffset": 0,
            "componentType": 5126,  # FLOAT
            "count": len(normals_np),
            "type": "VEC3",
        })
        primitive_attributes["NORMAL"] = accessor_idx

    if tangents_np is not None and len(tangents_np) > 0:
        buffer_views.append({
            "buffer": 0,
            "byteOffset": tangents_byte_offset,
            "byteLength": len(tangents_buffer),
            "target": 34962
        })
        accessor_idx = len(accessors)
        accessors.append({
            "bufferView": len(buffer_views) - 1,
            "byteOffset": 0,
            "componentType": 5126,  # FLOAT
            "count": len(tangents_np),
            "type": "VEC4",  # xyz tangent + w handedness (glTF TANGENT)
        })
        primitive_attributes["TANGENT"] = accessor_idx

    primitive = {
        "attributes": primitive_attributes,
        "indices": 1,
        "mode": 4  # TRIANGLES
    }

    images = []
    textures = []
    samplers = []
    materials = []
    extensions_used = []

    def add_image_texture(png_byte_offset, png_byte_length):
        """Append an embedded PNG image + a texture referencing it; return the texture index."""
        buffer_views.append({"buffer": 0, "byteOffset": png_byte_offset, "byteLength": png_byte_length})
        images.append({"bufferView": len(buffer_views) - 1, "mimeType": "image/png"})
        if not samplers:
            samplers.append({"magFilter": 9729, "minFilter": 9729, "wrapS": 33071, "wrapT": 33071})
        textures.append({"source": len(images) - 1, "sampler": 0})
        return len(textures) - 1

    has_uv = "TEXCOORD_0" in primitive_attributes
    if unlit and texture_png_bytes is None:
        # Flat, light-independent shading (KHR_materials_unlit): COLOR_0 is shown as-is, matching how a
        # gaussian splat renders (emissive). Without this the viewer lights the mesh and washes the colours.
        if nm_png_bytes is not None or em_png_bytes is not None or occlusion_in_mr or material is not None:
            logging.warning(
                "save_glb: unlit material ignores normal/occlusion/emissive maps and material "
                "overrides — those are PBR-lit features. Disable unlit to export them.")
        materials.append({
            "pbrMetallicRoughness": {"baseColorFactor": [1.0, 1.0, 1.0, 1.0], "metallicFactor": 0.0, "roughnessFactor": 1.0},
            "extensions": {"KHR_materials_unlit": {}},
            "doubleSided": True,
        })
        extensions_used.append("KHR_materials_unlit")
        primitive["material"] = 0
    else:
        pbr = {
            "metallicFactor": 0.0,
            "roughnessFactor": 0.5,
            "baseColorFactor": [0.22, 0.22, 0.22, 1.0],   # neutral-gray fallback for bare geometry only
        }
        if texture_png_bytes is not None and has_uv:
            pbr["baseColorTexture"] = {"index": add_image_texture(texture_byte_offset, len(texture_buffer)), "texCoord": 0}

        if (texture_png_bytes is not None and has_uv) or "COLOR_0" in primitive_attributes:
            pbr["baseColorFactor"] = [1.0, 1.0, 1.0, 1.0]
            pbr["roughnessFactor"] = 1.0

        if mr_png_bytes is not None and has_uv:
            mr_texture_index = add_image_texture(mr_byte_offset, len(mr_buffer))
            pbr["metallicRoughnessTexture"] = {"index": mr_texture_index, "texCoord": 0}
            # When a metallicRoughness texture is present, the factors scale it; use 1.0
            # so the texture values pass through unchanged (glTF convention).
            pbr["metallicFactor"] = 1.0
            pbr["roughnessFactor"] = 1.0

        mat = material if isinstance(material, dict) else {}
        # Scalar overrides (factor < 0 means "leave auto").
        if mat.get("base_color_factor") is not None:
            pbr["baseColorFactor"] = [float(x) for x in mat["base_color_factor"]]
        if mat.get("metallic_factor", -1.0) >= 0.0:
            pbr["metallicFactor"] = float(mat["metallic_factor"])
        if mat.get("roughness_factor", -1.0) >= 0.0:
            pbr["roughnessFactor"] = float(mat["roughness_factor"])

        material = {
            "pbrMetallicRoughness": pbr,
            "doubleSided": bool(mat.get("double_sided", True)),
        }
        if occlusion_in_mr and mr_png_bytes is not None and has_uv:
            # ORM packing: occlusionTexture reuses the MR image (glTF reads its R channel).
            material["occlusionTexture"] = {"index": mr_texture_index, "texCoord": 0,
                                            "strength": float(mat.get("occlusion_strength", 1.0))}
        if nm_png_bytes is not None and has_uv:
            material["normalTexture"] = {"index": add_image_texture(nm_byte_offset, len(nm_buffer)),
                                         "texCoord": 0, "scale": float(mat.get("normal_scale", 1.0))}

        emissive_factor = [float(x) for x in mat.get("emissive_factor", [0.0, 0.0, 0.0])]
        emissive_strength = float(mat.get("emissive_strength", 1.0))
        has_em_tex = em_png_bytes is not None and has_uv
        if any(c > 0.0 for c in emissive_factor) or has_em_tex:
            # glTF multiplies emissiveFactor × texture, so a texture with no color would go black;
            # default the factor to white in that case.
            if has_em_tex and not any(c > 0.0 for c in emissive_factor):
                emissive_factor = [1.0, 1.0, 1.0]
            material["emissiveFactor"] = [min(1.0, c) for c in emissive_factor]
            if has_em_tex:
                material["emissiveTexture"] = {"index": add_image_texture(em_byte_offset, len(em_buffer)),
                                               "texCoord": 0}
            if emissive_strength != 1.0:
                material.setdefault("extensions", {})["KHR_materials_emissive_strength"] = {
                    "emissiveStrength": emissive_strength}
                if "KHR_materials_emissive_strength" not in extensions_used:
                    extensions_used.append("KHR_materials_emissive_strength")

        materials.append(material)
        primitive["material"] = 0

    gltf = {
        "asset": {"version": "2.0", "generator": "ComfyUI"},
        "buffers": [{"byteLength": len(buffer_data)}],
        "bufferViews": buffer_views,
        "accessors": accessors,
        "meshes": [{"primitives": [primitive]}],
        "nodes": [{"mesh": 0}],
        "scenes": [{"nodes": [0]}],
        "scene": 0,
    }
    if images:
        gltf["images"] = images
    if samplers:
        gltf["samplers"] = samplers
    if textures:
        gltf["textures"] = textures
    if materials:
        gltf["materials"] = materials
    if extensions_used:
        gltf["extensionsUsed"] = extensions_used

    if metadata:
        gltf["asset"]["extras"] = metadata

    # Convert the JSON to bytes
    gltf_json = json.dumps(gltf).encode('utf8')

    def pad_json_to_4_bytes(buffer):
        padding_length = (4 - (len(buffer) % 4)) % 4
        return buffer + b' ' * padding_length

    gltf_json_padded = pad_json_to_4_bytes(gltf_json)

    # Create the GLB header (a 4-byte ASCII magic identifier glTF)
    glb_header = struct.pack('<4sII', b'glTF', 2, 12 + 8 + len(gltf_json_padded) + 8 + len(buffer_data))

    # Create JSON chunk header (chunk type 0)
    json_chunk_header = struct.pack('<II', len(gltf_json_padded), 0x4E4F534A)  # "JSON" in little endian

    # Create BIN chunk header (chunk type 1)
    bin_chunk_header = struct.pack('<II', len(buffer_data), 0x004E4942)  # "BIN\0" in little endian

    glb = b"".join([glb_header, json_chunk_header, gltf_json_padded, bin_chunk_header, buffer_data])
    if filepath is None:
        return glb                       # in-memory GLB bytes
    with open(filepath, 'wb') as f:
        f.write(glb)
    return filepath


def export_obj_bytes(mesh, index: int = 0) -> bytes:
    """Serialize one MESH batch item to Wavefront OBJ (with the Blender "v x y z r g b" vertex-color extension)."""
    v, f, colors, uvs, normals = get_mesh_batch_item(mesh, index)
    if v.shape[0] == 0 or f.shape[0] == 0:
        raise ValueError("export_obj: mesh item is empty")
    v_np = v.cpu().numpy().astype(np.float32)
    f_np = f.cpu().numpy().astype(np.int64)
    c_np = np.clip(colors.cpu().numpy(), 0.0, 1.0).astype(np.float32) if colors is not None else None
    uv_np = uvs.cpu().numpy().astype(np.float32) if uvs is not None else None
    n_np = normals.cpu().numpy().astype(np.float32) if normals is not None else None

    out = ["# ComfyTV OBJ export"]
    if c_np is not None:
        out.extend(f"v {p[0]:.6f} {p[1]:.6f} {p[2]:.6f} {c[0]:.4f} {c[1]:.4f} {c[2]:.4f}"
                   for p, c in zip(v_np, c_np))
    else:
        out.extend(f"v {p[0]:.6f} {p[1]:.6f} {p[2]:.6f}" for p in v_np)
    if uv_np is not None:
        out.extend(f"vt {t[0]:.6f} {1.0 - t[1]:.6f}" for t in uv_np)
    if n_np is not None:
        out.extend(f"vn {n[0]:.4f} {n[1]:.4f} {n[2]:.4f}" for n in n_np)

    if uv_np is not None and n_np is not None:
        fmt = "f {0}/{0}/{0} {1}/{1}/{1} {2}/{2}/{2}"
    elif uv_np is not None:
        fmt = "f {0}/{0} {1}/{1} {2}/{2}"
    elif n_np is not None:
        fmt = "f {0}//{0} {1}//{1} {2}//{2}"
    else:
        fmt = "f {0} {1} {2}"
    out.extend(fmt.format(a + 1, b + 1, c + 1) for a, b, c in f_np)
    return ("\n".join(out) + "\n").encode("utf-8")


def export_stl_bytes(mesh, index: int = 0) -> bytes:
    """Serialize one MESH batch item to binary STL."""
    v, f, _colors, _uvs, _normals = get_mesh_batch_item(mesh, index)
    if v.shape[0] == 0 or f.shape[0] == 0:
        raise ValueError("export_stl: mesh item is empty")
    v_np = v.cpu().numpy().astype(np.float32)
    f_np = f.cpu().numpy().astype(np.int64)

    tri = v_np[f_np]                                    # (F, 3, 3)
    n = np.cross(tri[:, 1] - tri[:, 0], tri[:, 2] - tri[:, 0])
    lens = np.linalg.norm(n, axis=1, keepdims=True)
    n = (n / np.clip(lens, 1e-20, None)).astype(np.float32)

    F = f_np.shape[0]
    rec = np.zeros(F, dtype=np.dtype([("n", "<f4", 3), ("v", "<f4", (3, 3)), ("attr", "<u2")]))
    rec["n"] = n
    rec["v"] = tri
    header = b"ComfyTV STL export".ljust(80, b"\x00")
    return header + struct.pack("<I", F) + rec.tobytes()


def mesh_item_to_glb_bytes(mesh, index, metadata=None):
    """Serialize one batch item of a MESH to in-memory GLB bytes, carrying every PBR attribute
    (uvs, colors, normals, texture, ORM/occlusion, normal map + tangents, emissive, material).
    Returns None for an empty item."""
    vertices_i, faces_i, v_colors, uvs_i, normals_i = get_mesh_batch_item(mesh, index)
    if vertices_i.shape[0] == 0 or faces_i.shape[0] == 0:
        return None

    def _img(attr):
        t = getattr(mesh, attr, None)
        if t is None:
            return None
        a = (t[index].clamp(0.0, 1.0).cpu().numpy() * 255).astype(np.uint8)
        assert a.ndim == 3 and a.shape[-1] == 3, f"{attr} must be (B, H, W, 3), got {tuple(t.shape)}"
        return Image.fromarray(a, mode="RGB")

    tangents_b = mesh.tangents
    tangents_i = tangents_b[index, :vertices_i.shape[0]] if tangents_b is not None else None
    return save_glb(
        vertices_i, faces_i, None, metadata,
        uvs=uvs_i,
        vertex_colors=v_colors,
        texture_image=_img("texture"),
        metallic_roughness_image=_img("metallic_roughness"),
        unlit=mesh.unlit,
        normals=normals_i,
        normal_map_image=_img("normal_map"),
        tangents=tangents_i,
        occlusion_in_mr=mesh.occlusion_in_mr,
        material=mesh.material,
        emissive_image=_img("emissive"),
    )
