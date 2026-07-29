from .media import (
    localize,
    fresh_output_path,
    path_to_view_url,
    _decode_audio_to_array,
    _AUDIO_RATE,
)
from .roseus_lut import ROSEUS_LUT


_GRAY_LUT = tuple((v, v, v) for v in range(256))


def _lut(colormap: str):
    return ROSEUS_LUT if colormap == 'roseus' else _GRAY_LUT


def render_waveform_image(view_url: str, width: int = 1200, height: int = 480,
                          show_rms: bool = True, show_clipping: bool = True,
                          db_axis: bool = False) -> str:
    import numpy as np
    from PIL import Image

    arr = _decode_audio_to_array(localize(view_url))
    if arr.shape[1] == 0:
        raise RuntimeError("waveform: source has no audio")
    width = min(4096, max(240, int(width)))
    height = min(2048, max(120, int(height)))

    mono = arr.mean(axis=0)
    n = mono.shape[0]
    block = max(1, n // width)
    ncols = min(width, (n + block - 1) // block)
    padded = np.zeros(ncols * block, dtype=np.float32)
    padded[:n] = mono[:ncols * block]
    cols = padded.reshape(ncols, block)
    vmax = cols.max(axis=1)
    vmin = cols.min(axis=1)
    rms = np.sqrt((cols ** 2).mean(axis=1))
    clip_cols = (np.abs(arr[:, :ncols * block])
                 .reshape(2, ncols, block).max(axis=(0, 2))) >= (32766.0 / 32768.0)

    def to_y(v):
        if db_axis:
            db = 20.0 * np.log10(np.maximum(np.abs(v), 1e-6))
            mag = np.clip((db + 60.0) / 60.0, 0.0, 1.0) * np.sign(v)
        else:
            mag = np.clip(v, -1.0, 1.0)
        return ((1.0 - mag) * 0.5 * (height - 1)).astype(int)

    img = np.zeros((height, width, 3), dtype=np.uint8)
    img[:, :] = (20, 20, 32)
    mid = height // 2
    img[mid, :ncols] = (60, 60, 90)

    y_hi, y_lo = to_y(vmax), to_y(vmin)
    yr_hi, yr_lo = to_y(rms), to_y(-rms)
    for x in range(ncols):
        img[min(y_hi[x], y_lo[x]):max(y_hi[x], y_lo[x]) + 1, x] = (86, 86, 149)
        if show_rms:
            img[min(yr_hi[x], yr_lo[x]):max(yr_hi[x], yr_lo[x]) + 1, x] = (130, 130, 200)
        if show_clipping and clip_cols[x]:
            img[:, x] = (255, 40, 40)

    out = fresh_output_path('.png', subfolder='comfytv/audio')
    Image.fromarray(img, 'RGB').save(str(out), 'PNG')
    return path_to_view_url(out)


def render_spectrogram_image(view_url: str, width: int = 1200,
                             height: int = 480, scale: str = 'log',
                             colormap: str = 'roseus', range_db: float = 80.0,
                             gain_db: float = 20.0,
                             freq_gain_dbpoct: float = 0.0) -> str:
    import numpy as np
    from PIL import Image

    if scale not in ('linear', 'log', 'mel'):
        raise RuntimeError(f"spectrogram: unknown scale {scale!r}")
    arr = _decode_audio_to_array(localize(view_url))
    if arr.shape[1] == 0:
        raise RuntimeError("spectrogram: source has no audio")
    width = min(4096, max(240, int(width)))
    height = min(2048, max(120, int(height)))

    mono = arr.mean(axis=0)
    nfft = 2048
    hop = max(1, (mono.shape[0] - nfft) // width)
    nframes = min(width, max(1, 1 + (mono.shape[0] - nfft) // hop))
    win = np.hanning(nfft).astype(np.float32)
    idx = (np.arange(nframes)[:, None] * hop + np.arange(nfft)[None, :])
    frames = mono[np.clip(idx, 0, mono.shape[0] - 1)] * win
    power = np.abs(np.fft.rfft(frames, axis=1)) ** 2
    wss = 4.0 / (win.sum() ** 2)
    db = 10.0 * np.log10(np.maximum(power * wss, 1e-12))

    freqs = np.fft.rfftfreq(nfft, 1.0 / _AUDIO_RATE)
    if freq_gain_dbpoct:
        db = db + freq_gain_dbpoct * np.log2(np.maximum(freqs, 1.0) / 1000.0)[None, :]

    fmin, fmax = 20.0, _AUDIO_RATE / 2.0
    rows = np.arange(height)
    frac = 1.0 - rows / (height - 1)
    if scale == 'linear':
        target = frac * fmax
    elif scale == 'log':
        target = fmin * (fmax / fmin) ** frac
    else:
        def to_mel(f):
            return 2595.0 * np.log10(1.0 + f / 700.0)

        def from_mel(m):
            return 700.0 * (10.0 ** (m / 2595.0) - 1.0)
        target = from_mel(frac * to_mel(fmax))
    bins = np.clip(np.searchsorted(freqs, target), 0, freqs.shape[0] - 1)

    grid = db[:, bins].T
    bright = np.clip((grid + float(gain_db) + float(range_db)) / float(range_db),
                     0.0, 1.0)
    lut = np.array(_lut(colormap), dtype=np.uint8)
    img = lut[(bright * 255).astype(np.uint8)]
    if nframes < width:
        pad = np.zeros((height, width - nframes, 3), dtype=np.uint8)
        pad[:, :] = lut[0]
        img = np.concatenate([img, pad], axis=1)

    out = fresh_output_path('.png', subfolder='comfytv/audio')
    Image.fromarray(img, 'RGB').save(str(out), 'PNG')
    return path_to_view_url(out)


__all__ = ['render_waveform_image', 'render_spectrogram_image']
