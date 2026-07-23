import math

from .media import localize, _decode_audio_to_array
from .audio_dsp import _write_wav

_FFT = 2048
_HOP = 512


def _stft(x, device):
    import torch

    win = torch.hann_window(_FFT, device=device)
    return torch.stft(x, n_fft=_FFT, hop_length=_HOP, window=win,
                      center=True, return_complex=True), win


def _noise_profile_means(power, noise_power=None, auto_fraction=0.1):
    import torch

    if noise_power is not None and noise_power.shape[-1] >= 2:
        return noise_power.mean(dim=-1)
    frame_energy = power.mean(dim=1).sum(dim=0)
    n = max(2, int(power.shape[-1] * auto_fraction))
    idx = torch.argsort(frame_energy)[:n]
    return power[..., idx].mean(dim=-1)


def spectral_gate(x, *, reduction_db=12.0, sensitivity=6.0,
                  freq_smooth_bands=6, attack_blocks=2, release_blocks=4,
                  noise=None, device='cpu'):
    import torch

    spec, win = _stft(x, device)
    power = spec.real ** 2 + spec.imag ** 2
    noise_power = None
    if noise is not None and noise.shape[-1] >= _FFT:
        nspec, _ = _stft(noise, device)
        noise_power = nspec.real ** 2 + nspec.imag ** 2
    means = _noise_profile_means(power, noise_power).clamp(min=1e-12)

    threshold = max(0.0, float(sensitivity)) * math.log(10.0)
    atten = 10.0 ** (-abs(float(reduction_db)) / 20.0)
    p_prev = torch.roll(power, shifts=1, dims=-1)
    p_next = torch.roll(power, shifts=-1, dims=-1)
    p_prev[..., 0] = power[..., 0]
    p_next[..., -1] = power[..., -1]
    second = torch.minimum(
        torch.maximum(torch.minimum(p_prev, p_next), power),
        torch.maximum(p_prev, p_next))
    is_noise = second <= threshold * means.unsqueeze(-1)

    gains = torch.where(is_noise, torch.full_like(power, atten),
                        torch.ones_like(power))

    step_attack = 10.0 ** (-abs(float(reduction_db))
                           / max(1, int(attack_blocks)) / 20.0)
    step_release = 10.0 ** (-abs(float(reduction_db))
                            / max(1, int(release_blocks)) / 20.0)
    n_frames = gains.shape[-1]
    for t in range(1, n_frames):
        gains[..., t] = torch.maximum(gains[..., t],
                                      gains[..., t - 1] * step_release)
    for t in range(n_frames - 2, -1, -1):
        gains[..., t] = torch.maximum(gains[..., t],
                                      gains[..., t + 1] * step_attack)
    gains = gains.clamp(min=atten)

    bands = max(0, int(freq_smooth_bands))
    if bands > 0:
        k = 2 * bands + 1
        pad = gains.permute(0, 2, 1).reshape(-1, 1, gains.shape[1])
        kernel = torch.full((1, 1, k), 1.0 / k, device=device)
        sm = torch.nn.functional.conv1d(
            torch.nn.functional.pad(pad, (bands, bands), mode='replicate'),
            kernel)
        gains = sm.reshape(gains.shape[0], gains.shape[2],
                           gains.shape[1]).permute(0, 2, 1)

    out_spec = spec * gains
    y = torch.istft(out_spec, n_fft=_FFT, hop_length=_HOP, window=win,
                    center=True, length=x.shape[-1])
    return y.clamp(-1.0, 1.0)


def noise_reduce_audio(view_url: str, *, reduction_db=12.0, sensitivity=6.0,
                       freq_smooth_bands=6, noise_url='',
                       progress=None) -> str:
    import numpy as np
    import torch

    arr = _decode_audio_to_array(localize(view_url))
    if arr.shape[1] == 0:
        raise RuntimeError("noise reduction: source has no audio")
    device = 'cuda' if torch.cuda.is_available() else 'cpu'
    x = torch.from_numpy(arr).to(device)
    noise = None
    if (noise_url or '').strip():
        narr = _decode_audio_to_array(localize(noise_url))
        if narr.shape[1] >= _FFT:
            noise = torch.from_numpy(narr).to(device)
    y = spectral_gate(x, reduction_db=reduction_db,
                      sensitivity=sensitivity,
                      freq_smooth_bands=freq_smooth_bands, noise=noise,
                      device=device)
    return _write_wav(y.cpu().numpy().astype(np.float32))


__all__ = ['spectral_gate', 'noise_reduce_audio']
