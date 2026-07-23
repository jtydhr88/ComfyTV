import numpy as np

BOKEH_SHAPES = ['disc', 'hex']


def _disc_kernel(radius: int, shape: str, device):
    import torch
    r = max(1, int(radius))
    size = r * 2 + 1
    ys, xs = np.mgrid[-r:r + 1, -r:r + 1].astype(np.float32)
    if shape == 'hex':
        ax = np.abs(xs)
        ay = np.abs(ys)
        inside = (ax <= r) & (ay <= r * 0.866) \
            & (ax * 0.5 + ay * 0.866 <= r * 0.866 + 0.5)
        k = inside.astype(np.float32)
    else:
        d = np.sqrt(xs * xs + ys * ys)
        k = np.clip(r + 0.5 - d, 0, 1).astype(np.float32)
    k /= max(1e-6, k.sum())
    return torch.from_numpy(k).to(device).unsqueeze(0).unsqueeze(0)


def _blur_with_kernel(img, kernel):
    import torch
    c = img.shape[-1]
    src = img.permute(2, 0, 1).unsqueeze(0)
    k = kernel.repeat(c, 1, 1, 1)
    pad = kernel.shape[-1] // 2
    out = torch.nn.functional.conv2d(src, k, padding=pad, groups=c)
    return out.squeeze(0).permute(1, 2, 0)


def build_zdefocus_fn(depth_for, *, focus_depth=0.5, focus_range=0.15,
                      max_radius=16, layers=8, shape='disc',
                      highlight_boost=0.0, invert_depth=False):
    import torch
    kernel_cache = {}

    max_radius = max(1, min(48, int(max_radius)))
    layers = max(3, min(12, int(layers)))
    focus_range = max(0.0, min(1.0, float(focus_range)))
    focus_depth = max(0.0, min(1.0, float(focus_depth)))

    def kernel_for(r, device):
        key = (r, str(device))
        if key not in kernel_cache:
            kernel_cache[key] = _disc_kernel(r, shape, device)
        return kernel_cache[key]

    def fn(img, t):
        depth = depth_for(img, t).clamp(0, 1)
        if invert_depth:
            depth = 1.0 - depth
        half = focus_range / 2.0
        dist = (depth - focus_depth).abs()
        coc = ((dist - half) / max(1e-6, 1.0 - half)).clamp(0, 1)
        radius = coc * max_radius

        boosted = img
        if highlight_boost > 0:
            boosted = img * (1.0 + highlight_boost * img.pow(4))

        edges = torch.linspace(0, 1, layers + 1, device=img.device)
        acc = torch.zeros_like(img)
        acc_a = torch.zeros(img.shape[0], img.shape[1], 1,
                            device=img.device)
        order = torch.argsort(
            torch.tensor([(edges[i] + edges[i + 1]).item() / 2
                          for i in range(layers)], device=img.device),
            descending=True)
        for li in order.tolist():
            lo = edges[li]
            hi = edges[li + 1]
            mask = ((depth >= lo) & (depth < hi if li < layers - 1
                                     else depth <= hi)).float().unsqueeze(-1)
            if mask.sum() < 1:
                continue
            mid = float((lo + hi) / 2)
            m_dist = abs(mid - focus_depth)
            m_coc = max(0.0, min(1.0, (m_dist - half)
                                 / max(1e-6, 1.0 - half)))
            r = int(round(m_coc * max_radius))
            layer_rgb = boosted * mask
            layer_a = mask
            if r >= 1:
                k = kernel_for(r, img.device)
                layer_rgb = _blur_with_kernel(layer_rgb, k)
                layer_a = _blur_with_kernel(layer_a, k)
            acc = layer_rgb + acc * (1 - layer_a)
            acc_a = layer_a + acc_a * (1 - layer_a)

        out = acc / acc_a.clamp(min=1e-4)
        if highlight_boost > 0:
            out = out / (1.0 + highlight_boost * out.clamp(0, 1).pow(4))
        sharp_zone = (radius < 0.5).float().unsqueeze(-1)
        out = img * sharp_zone + out * (1 - sharp_zone)
        return out.clamp(0, 1)

    return fn


def zdefocus_video(view_url: str, depth_url: str, *, depth_is_video=False,
                   focus_depth=0.5, focus_range=0.15, max_radius=16,
                   layers=8, shape='disc', highlight_boost=0.0,
                   invert_depth=False, progress=None) -> str:
    import torch
    from PIL import Image
    import av as _av
    from .media import localize
    from .media_torch import torch_process_video

    if depth_is_video:
        container = _av.open(str(localize(depth_url)))
        stream = container.streams.video[0]
        decoder = container.decode(stream)
        state = {'last': None}

        def depth_for(img, t):
            try:
                frame = next(decoder)
                arr = frame.to_ndarray(format='rgb24').astype(np.float32)
                d = arr.mean(axis=-1) / 255.0
                state['last'] = torch.from_numpy(d).to(img.device)
            except StopIteration:
                pass
            d = state['last']
            if d is None:
                return torch.full(img.shape[:2], 0.5, device=img.device)
            if d.shape != img.shape[:2]:
                d = torch.nn.functional.interpolate(
                    d.unsqueeze(0).unsqueeze(0), size=img.shape[:2],
                    mode='bilinear', align_corners=False)[0, 0]
                state['last'] = d
            return d
    else:
        src = Image.open(str(localize(depth_url))).convert('L')
        cache = {}

        def depth_for(img, t):
            key = (img.shape[0], img.shape[1])
            if key not in cache:
                m = np.asarray(src.resize((key[1], key[0])),
                               dtype=np.float32) / 255.0
                cache[key] = torch.from_numpy(m).to(img.device)
            return cache[key]

    fn = build_zdefocus_fn(
        depth_for, focus_depth=focus_depth, focus_range=focus_range,
        max_radius=max_radius, layers=layers, shape=shape,
        highlight_boost=highlight_boost, invert_depth=invert_depth)
    try:
        return torch_process_video(view_url, fn, progress=progress)
    finally:
        if depth_is_video:
            container.close()


__all__ = ['BOKEH_SHAPES', 'build_zdefocus_fn', 'zdefocus_video']
