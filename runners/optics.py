import math

LENS_MODELS = ['nuke_k1k2', 'fisheye_equidistant', 'fisheye_orthographic',
               'fisheye_equisolid', 'fisheye_stereographic']
LENS_DIRECTIONS = ['undistort', 'distort']
LENS_EDGES = ['blank', 'clamp', 'mirror']
_EDGE_PAD = {'blank': 'zeros', 'clamp': 'border', 'mirror': 'reflection'}


def _base_grid(h, w, device):
    import torch
    ys = torch.linspace(-1.0, 1.0, h, device=device)
    xs = torch.linspace(-1.0, 1.0, w, device=device)
    gy, gx = torch.meshgrid(ys, xs, indexing='ij')
    return gx, gy


def _newton_undistort(rd, k1, k2, iters=4):
    ru = rd.clone()
    for _ in range(iters):
        r2 = ru * ru
        f = ru * (1 + k1 * r2 + k2 * r2 * r2) - rd
        df = 1 + 3 * k1 * r2 + 5 * k2 * r2 * r2
        ru = ru - f / df.clamp(min=1e-6)
    return ru.clamp(min=0)


def build_lens_grid(h, w, *, model='nuke_k1k2', direction='undistort',
                    k1=0.0, k2=0.0, fov=140.0, center_x=0.0, center_y=0.0,
                    squeeze=1.0, scale=1.0, device='cpu'):
    import torch
    gx, gy = _base_grid(h, w, device)
    aspect = w / max(1, h)
    sq = max(0.5, min(2.0, float(squeeze)))
    px = (gx - 2 * float(center_x)) * aspect / sq
    py = gy - 2 * float(center_y)
    px = px / max(1e-6, float(scale))
    py = py / max(1e-6, float(scale))
    r = torch.sqrt(px * px + py * py).clamp(min=1e-6)

    if model == 'nuke_k1k2':
        if direction == 'undistort':
            rs = r * (1 + k1 * r * r + k2 * r ** 4)
        else:
            rs = _newton_undistort(r, float(k1), float(k2))
        ratio = rs / r
    else:
        theta_max = math.radians(max(20.0, min(179.0, float(fov)))) / 2.0
        corner = math.sqrt(aspect * aspect + 1.0)
        u = r / corner

        def fish_norm(theta):
            if model == 'fisheye_orthographic':
                return torch.sin(theta) / math.sin(theta_max)
            if model == 'fisheye_equisolid':
                return torch.sin(theta / 2) / math.sin(theta_max / 2)
            if model == 'fisheye_stereographic':
                return torch.tan(theta / 2) / math.tan(theta_max / 2)
            return theta / theta_max

        if direction == 'undistort':
            theta = torch.atan(u.clamp(max=8.0) * math.tan(theta_max))
            rs = fish_norm(theta) * corner
        else:
            theta = (u.clamp(0, 1) * theta_max)
            if model == 'fisheye_orthographic':
                theta = torch.asin((u.clamp(0, 0.999)
                                    * math.sin(theta_max)).clamp(-1, 1))
            elif model == 'fisheye_equisolid':
                theta = 2 * torch.asin((u.clamp(0, 0.999)
                                        * math.sin(theta_max / 2)).clamp(-1, 1))
            elif model == 'fisheye_stereographic':
                theta = 2 * torch.atan(u * math.tan(theta_max / 2))
            rs = (torch.tan(theta) / math.tan(theta_max)) * corner
        ratio = rs / r

    sx = px * ratio * sq / aspect + 2 * float(center_x)
    sy = py * ratio + 2 * float(center_y)
    return torch.stack([sx, sy], dim=-1)


def sample_with_grid(img, grid, edge='clamp'):
    import torch
    src = img.permute(2, 0, 1).unsqueeze(0)
    out = torch.nn.functional.grid_sample(
        src, grid.unsqueeze(0), mode='bilinear',
        padding_mode=_EDGE_PAD.get(edge, 'border'), align_corners=True)
    return out.squeeze(0).permute(1, 2, 0)


def build_lens_distort_fn(params):
    cache = {}

    def fn(img, t):
        key = (img.shape[0], img.shape[1], str(img.device))
        if key not in cache:
            cache[key] = build_lens_grid(
                img.shape[0], img.shape[1],
                model=params.get('model') or 'nuke_k1k2',
                direction=params.get('direction') or 'undistort',
                k1=float(params.get('k1', 0.0)),
                k2=float(params.get('k2', 0.0)),
                fov=float(params.get('fov', 140.0)),
                center_x=float(params.get('center_x', 0.0)),
                center_y=float(params.get('center_y', 0.0)),
                squeeze=float(params.get('squeeze', 1.0)),
                scale=float(params.get('lens_scale', 1.0)),
                device=str(img.device))
        return sample_with_grid(img, cache[key],
                                params.get('edge') or 'clamp').clamp(0, 1)

    return fn


def build_chroma_ab_fn(params):
    import torch
    cache = {}

    def fn(img, t):
        key = (img.shape[0], img.shape[1], str(img.device))
        if key not in cache:
            h, w = img.shape[0], img.shape[1]
            gx, gy = _base_grid(h, w, str(img.device))
            cx = 2 * float(params.get('center_x', 0.0))
            cy = 2 * float(params.get('center_y', 0.0))
            px = gx - cx
            py = gy - cy
            r = torch.sqrt(px * px + py * py).clamp(min=1e-6)
            fall = max(0.5, min(3.0, float(params.get('falloff', 1.0))))
            amt = float(params.get('amount', 0.01))
            disp = amt * r.pow(fall)
            grids = []
            for sign in (1.0, -1.0):
                sx = px * (1 + sign * disp) + cx
                sy = py * (1 + sign * disp) + cy
                grids.append(torch.stack([sx, sy], dim=-1))
            cache[key] = grids
        g_r, g_b = cache[key]
        out = img.clone()
        out[..., 0] = sample_with_grid(img[..., 0:1].repeat(1, 1, 3),
                                       g_r, 'clamp')[..., 0]
        out[..., 2] = sample_with_grid(img[..., 2:3].repeat(1, 1, 3),
                                       g_b, 'clamp')[..., 2]
        return out.clamp(0, 1)

    return fn


_GHOST_OFFSETS = (-0.55, -0.25, 0.2, 0.45, 0.7, 1.35, 1.7, 2.2)
_GHOST_HUES = ((1.0, 0.6, 0.5), (0.6, 1.0, 0.6), (0.5, 0.7, 1.0),
               (1.0, 0.9, 0.5), (0.7, 0.5, 1.0), (0.5, 1.0, 0.9),
               (1.0, 0.7, 0.8), (0.8, 1.0, 0.5))


def build_lens_flare_fn(params):
    import torch
    cache = {}

    def fn(img, t):
        h, w = img.shape[0], img.shape[1]
        key = (h, w, str(img.device))
        if key not in cache:
            cache[key] = _base_grid(h, w, str(img.device))
        gx, gy = cache[key]
        aspect = w / max(1, h)
        lx = float(params.get('pos_x', 0.75)) * 2 - 1
        ly = float(params.get('pos_y', 0.25)) * 2 - 1
        intensity = float(params.get('intensity', 0.8))
        size = max(0.02, float(params.get('size', 0.25)))
        streak = float(params.get('streak', 0.5))
        n_ghosts = max(0, min(8, int(params.get('ghosts', 5))))

        def dist2(px, py):
            return ((gx - px) * aspect) ** 2 + (gy - py) ** 2

        flare = torch.zeros_like(img)
        core = torch.exp(-dist2(lx, ly) / (2 * (size * 0.5) ** 2))
        halo = torch.exp(-dist2(lx, ly) / (2 * (size * 1.6) ** 2)) * 0.35
        warm = torch.tensor([1.0, 0.92, 0.78], device=img.device)
        flare += (core + halo).unsqueeze(-1) * warm

        if streak > 0:
            sy = torch.exp(-((gy - ly) ** 2) / (2 * (size * 0.06) ** 2))
            sx = torch.exp(-(gx - lx).abs() / (streak * 1.2))
            cool = torch.tensor([0.55, 0.75, 1.0], device=img.device)
            flare += (sy * sx * streak).unsqueeze(-1) * cool

        for i in range(n_ghosts):
            f = _GHOST_OFFSETS[i]
            px = lx + (-lx) * (1 + f)
            py = ly + (-ly) * (1 + f)
            gsize = size * (0.25 + 0.35 * ((i * 2654435761) % 7) / 6.0)
            d2 = dist2(px, py)
            disc = torch.exp(-d2 / (2 * gsize ** 2))
            ring = torch.exp(-((torch.sqrt(d2) - gsize * 1.4) ** 2)
                             / (2 * (gsize * 0.35) ** 2)) * 0.5
            tint = torch.tensor(_GHOST_HUES[i], device=img.device)
            flare += ((disc * 0.5 + ring) * 0.28).unsqueeze(-1) * tint

        return (img + flare * intensity).clamp(0, 1)

    return fn


__all__ = ['LENS_MODELS', 'LENS_DIRECTIONS', 'LENS_EDGES',
           'build_lens_grid', 'sample_with_grid', 'build_lens_distort_fn',
           'build_chroma_ab_fn', 'build_lens_flare_fn']
