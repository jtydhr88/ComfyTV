import numpy as np

from .media import localize, get_video_info
from .media_torch import torch_process_video, _to_tensor


def _is_video(path) -> bool:
    import av
    if path.suffix.lower() in ('.png', '.jpg', '.jpeg', '.webp'):
        return False
    try:
        with av.open(str(path)) as c:
            if not c.streams.video:
                return False
            if (c.duration or 0) > 0:
                return True
            v = c.streams.video[0]
            return bool(v.duration and v.time_base)
    except Exception:
        return False


def _load_uv_image(path, device):
    import torch
    from PIL import Image
    arr = np.asarray(Image.open(str(path)).convert('RGB'), dtype=np.float32) / 255.0
    return torch.from_numpy(arr).to(device)


def _wrap(coord, mode):
    import torch
    if mode == 'repeat':
        return coord - torch.floor(coord)
    if mode == 'mirror':
        x2 = coord / 2 - torch.floor(coord / 2)
        return torch.where(x2 <= 0.5, 2 * x2, 2 - 2 * x2)
    return coord


def uv_remap_video(view_url: str, uv_url: str, *, mode: str = 'stmap',
                   u_offset: float = 0.0, v_offset: float = 0.0,
                   u_scale: float = 1.0, v_scale: float = 1.0,
                   wrap: str = 'clamp', flip_v: bool = True,
                   amount: float = 32.0, progress=None) -> str:
    import av
    import torch

    if mode not in ('stmap', 'idistort'):
        raise RuntimeError(f"uv remap: unknown mode {mode!r}")
    if wrap not in ('clamp', 'repeat', 'mirror'):
        raise RuntimeError(f"uv remap: unknown wrap {wrap!r}")

    uv_path = localize(uv_url)
    uv_is_video = _is_video(uv_path)
    uv_container = uv_iter = None
    uv_static = None
    uv_frame = None
    uv_t = -1.0

    if uv_is_video:
        uv_container = av.open(str(uv_path))
        uv_iter = uv_container.decode(uv_container.streams.video[0])

    def _uv_at(t, device):
        nonlocal uv_static, uv_frame, uv_t
        if not uv_is_video:
            if uv_static is None:
                uv_static = _load_uv_image(uv_path, device)
            return uv_static
        while uv_t < t - 1e-4:
            try:
                f = next(uv_iter)
                uv_t = float(f.pts * f.time_base) if f.pts is not None else uv_t + 1 / 24
                uv_frame = f
            except StopIteration:
                break
        if uv_frame is None:
            raise RuntimeError("uv remap: UV video has no frames")
        return _to_tensor(uv_frame, device)

    def frame_fn(img, t):
        device = img.device
        h, w = img.shape[0], img.shape[1]
        uv = _uv_at(t, device)
        if uv.shape[0] != h or uv.shape[1] != w:
            uv = torch.nn.functional.interpolate(
                uv.permute(2, 0, 1).unsqueeze(0), size=(h, w),
                mode='bilinear', align_corners=False
            ).squeeze(0).permute(1, 2, 0)
        u = (uv[..., 0] - u_offset) * u_scale
        v = (uv[..., 1] - v_offset) * v_scale

        if mode == 'stmap':
            u = _wrap(u, wrap)
            v = _wrap(v, wrap)
            if flip_v:
                v = 1.0 - v
            gx = u * 2 - 1
            gy = v * 2 - 1
            corners = False
        else:
            du = (u - 0.5) * 2 * amount
            dv = (v - 0.5) * 2 * amount
            if flip_v:
                dv = -dv
            ys, xs = torch.meshgrid(
                torch.arange(h, dtype=torch.float32, device=device),
                torch.arange(w, dtype=torch.float32, device=device), indexing='ij')
            gx = (xs + du) / max(w - 1, 1) * 2 - 1
            gy = (ys + dv) / max(h - 1, 1) * 2 - 1
            corners = True

        grid = torch.stack([gx, gy], dim=-1).unsqueeze(0)
        out = torch.nn.functional.grid_sample(
            img.permute(2, 0, 1).unsqueeze(0), grid,
            mode='bilinear',
            padding_mode='border' if wrap == 'clamp' else 'zeros',
            align_corners=corners)
        return out.squeeze(0).permute(1, 2, 0)

    try:
        return torch_process_video(view_url, frame_fn, progress=progress)
    finally:
        if uv_container is not None:
            uv_container.close()


__all__ = ['uv_remap_video']
