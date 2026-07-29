import numpy as np

from .media import localize
from .media_filter import has_encoder
from .media_torch import _to_tensor
from .uvmap import _is_video


LUMA_WEIGHTS = {
    'rec709': (0.2126, 0.7152, 0.0722),
    'rec2020': (0.2627, 0.6780, 0.0593),
    'ccir601': (0.2989, 0.5866, 0.1145),
}


MATTE_OUTPUTS = ('alpha', 'matte', 'premult', 'composite')


def _luma(t, math_mode='rec709'):
    if math_mode == 'average':
        return t[..., :3].mean(dim=-1)
    if math_mode == 'max':
        return t[..., :3].max(dim=-1).values
    wr, wg, wb = LUMA_WEIGHTS.get(math_mode, LUMA_WEIGHTS['rec709'])
    return t[..., 0] * wr + t[..., 1] * wg + t[..., 2] * wb


def _luma_f(rgb, math_mode='rec709'):
    if math_mode == 'average':
        return sum(rgb[:3]) / 3.0
    if math_mode == 'max':
        return max(rgb[:3])
    wr, wg, wb = LUMA_WEIGHTS.get(math_mode, LUMA_WEIGHTS['rec709'])
    return rgb[0] * wr + rgb[1] * wg + rgb[2] * wb


def _parse_color(s, default=(0.0, 1.0, 0.0)):
    s = (s or '').strip().lstrip('#')
    if len(s) != 6:
        return default
    try:
        return tuple(int(s[i:i + 2], 16) / 255.0 for i in (0, 2, 4))
    except ValueError:
        return default


class _SideSource:
    def __init__(self, url):
        import av
        self.path = localize(url)
        self.is_video = _is_video(self.path)
        self.container = None
        self.iter = None
        self.static = None
        self.frame = None
        self.t = -1.0
        if self.is_video:
            self.container = av.open(str(self.path))
            self.iter = self.container.decode(self.container.streams.video[0])
            cc = self.container.streams.video[0].codec_context
            self.has_alpha = 'a' in (cc.pix_fmt or '')
        else:
            self.has_alpha = False

    def at(self, t, device, hw=None):
        import torch
        from PIL import Image
        if not self.is_video:
            if self.static is None:
                arr = np.asarray(Image.open(str(self.path)).convert('RGB'),
                                 dtype=np.float32) / 255.0
                self.static = torch.from_numpy(arr).to(device)
            out = self.static
        else:
            while self.t < t - 1e-4:
                try:
                    f = next(self.iter)
                    self.t = (float(f.pts * f.time_base)
                              if f.pts is not None else self.t + 1 / 24)
                    self.frame = f
                except StopIteration:
                    break
            if self.frame is None:
                raise RuntimeError("keying: side input has no frames")
            out = _to_tensor(self.frame, device, alpha=self.has_alpha)
        if hw is not None and (out.shape[0] != hw[0] or out.shape[1] != hw[1]):
            out = torch.nn.functional.interpolate(
                out.permute(2, 0, 1).unsqueeze(0), size=hw,
                mode='bilinear', align_corners=False
            ).squeeze(0).permute(1, 2, 0)
        return out

    def close(self):
        if self.container is not None:
            self.container.close()


def _matte_out(img_rgb, alpha, output, bg=None):
    import torch
    if output == 'matte':
        return alpha.unsqueeze(-1).expand_as(img_rgb).clamp(0, 1)
    if output == 'composite':
        b = bg if bg is not None else torch.zeros_like(img_rgb)
        return (img_rgb + b * (1 - alpha.unsqueeze(-1))).clamp(0, 1)
    if output == 'premult':
        return img_rgb.clamp(0, 1)
    return torch.cat([img_rgb.clamp(0, 1),
                      alpha.unsqueeze(-1).clamp(0, 1)], dim=-1)


def _check_output(output, needs_encoder=True):
    if output not in MATTE_OUTPUTS:
        raise RuntimeError(f"keying: unknown output {output!r}")
    if output == 'alpha' and needs_encoder and not has_encoder('libvpx-vp9'):
        raise RuntimeError(
            "keying: this PyAV build lacks the libvpx-vp9 encoder needed "
            "for alpha output — use output='matte' instead."
        )
