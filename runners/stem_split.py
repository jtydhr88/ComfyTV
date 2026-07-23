from .media import localize, _decode_audio_to_array, _AUDIO_RATE
from .media_filter import make_progress
from .audio_dsp import _write_wav

STEM_NAMES = ('drums', 'bass', 'other', 'vocals')

_MODEL_CACHE = {}


def _get_bundle_model(device):
    if device not in _MODEL_CACHE:
        from torchaudio.pipelines import HDEMUCS_HIGH_MUSDB_PLUS
        model = HDEMUCS_HIGH_MUSDB_PLUS.get_model()
        model.to(device).eval()
        sources = list(getattr(model, 'sources', None)
                       or ('drums', 'bass', 'other', 'vocals'))
        _MODEL_CACHE[device] = (model, HDEMUCS_HIGH_MUSDB_PLUS.sample_rate,
                                sources)
    return _MODEL_CACHE[device]


def separate_array(model, mix, *, segment_s=10.0, overlap_s=1.0,
                   sample_rate=44100, device='cpu', report=None):
    import torch

    chunk = int(segment_s * sample_rate)
    overlap = int(overlap_s * sample_rate)
    total = mix.shape[-1]
    out = torch.zeros(4, mix.shape[0], total, device=device)
    weight = torch.zeros(total, device=device)

    ref_mean = mix.mean()
    ref_std = mix.std().clamp(min=1e-8)
    norm = (mix - ref_mean) / ref_std

    step = max(1, chunk - overlap)
    starts = list(range(0, total, step))
    for i, start in enumerate(starts):
        end = min(total, start + chunk)
        seg = norm[:, start:end].unsqueeze(0).to(device)
        with torch.no_grad():
            stems = model(seg)[0]
        n = end - start
        w = torch.ones(n, device=device)
        fade = min(overlap, n)
        if overlap > 0 and fade > 1:
            if i > 0:
                w[:fade] = torch.linspace(0.0, 1.0, fade, device=device)
            if i < len(starts) - 1 and end < total:
                w[-fade:] = torch.minimum(
                    w[-fade:],
                    torch.linspace(1.0, 0.0, fade, device=device))
        out[..., start:end] += stems * w
        weight[start:end] += w
        if report:
            report(i + 1)
    out = out / weight.clamp(min=1e-8)
    return out * ref_std + ref_mean


def separate_stems(view_url: str, *, progress=None) -> dict:
    import numpy as np
    import torch

    arr = _decode_audio_to_array(localize(view_url))
    if arr.shape[1] == 0:
        raise RuntimeError("stem split: source has no audio")
    device = 'cuda' if torch.cuda.is_available() else 'cpu'
    model, model_sr, sources = _get_bundle_model(device)

    mix = torch.from_numpy(arr)
    if model_sr != _AUDIO_RATE:
        import torchaudio
        mix = torchaudio.functional.resample(mix, _AUDIO_RATE, model_sr)

    n_chunks = max(1, (mix.shape[-1] // int(9.0 * model_sr)) + 1)
    report = make_progress(progress, n_chunks, "separating")
    stems = separate_array(model, mix, sample_rate=model_sr, device=device,
                           report=report)
    if model_sr != _AUDIO_RATE:
        import torchaudio
        stems = torchaudio.functional.resample(stems, model_sr, _AUDIO_RATE)
    stems = stems.cpu().numpy().astype(np.float32)

    by_name = {name: stems[i] for i, name in enumerate(sources)}
    result = {}
    for name in STEM_NAMES:
        result[name] = _write_wav(np.clip(by_name[name], -1.0, 1.0))
    acc = np.clip(by_name['drums'] + by_name['bass'] + by_name['other'],
                  -1.0, 1.0)
    result['accompaniment'] = _write_wav(acc)
    return result


__all__ = ['separate_stems', 'separate_array', 'STEM_NAMES']
