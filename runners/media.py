import logging
import urllib.parse
import urllib.request
import uuid
from pathlib import Path
from typing import Optional, Union

import folder_paths

_log = logging.getLogger(__name__)


def view_url_to_path(view_url: str) -> Optional[Path]:
    if not view_url or not isinstance(view_url, str):
        return None

    if view_url.startswith('http://') or view_url.startswith('https://'):
        return None
    try:
        u = urllib.parse.urlparse(view_url)
        q = urllib.parse.parse_qs(u.query)
    except Exception:
        return None
    filename = (q.get('filename') or [''])[0]
    if not filename:
        return None
    subfolder = (q.get('subfolder') or [''])[0]
    type_ = (q.get('type') or ['output'])[0]
    base = folder_paths.get_directory_by_type(type_)
    if not base:
        return None
    p = Path(base) / subfolder / filename if subfolder else Path(base) / filename

    base_resolved = Path(base).resolve()
    p_resolved = p.resolve()
    try:
        p_resolved.relative_to(base_resolved)
    except ValueError:
        raise ValueError(
            f"view URL escapes {type_!r} directory: {view_url!r}"
        )

    return p_resolved if p_resolved.exists() else None


def path_to_view_url(p: Path, type_: str = 'output') -> str:
    base = Path(folder_paths.get_directory_by_type(type_))
    try:
        rel = p.relative_to(base)
    except ValueError:
        rel = Path(p.name)
    parts = rel.parts
    filename = parts[-1]
    subfolder = '/'.join(parts[:-1])
    params = {'filename': filename, 'type': type_}
    if subfolder:
        params['subfolder'] = subfolder
    return '/view?' + urllib.parse.urlencode(params)


def _ensure_subdir(base: Path, sub: str) -> Path:
    out = base / sub
    out.mkdir(parents=True, exist_ok=True)
    return out


def fresh_output_path(suffix: str, subfolder: str = 'comfytv/video') -> Path:
    base = Path(folder_paths.get_output_directory())
    out_dir = _ensure_subdir(base, subfolder)
    return out_dir / f"{uuid.uuid4().hex[:12]}{suffix}"


def _strip_fx_envelope(view_url):
    if not isinstance(view_url, str) or not view_url.lstrip().startswith('{'):
        return view_url
    import json
    try:
        data = json.loads(view_url)
    except (ValueError, TypeError):
        return view_url
    inner = data.get('__fxvideo__') if isinstance(data, dict) else None
    if isinstance(inner, dict) and inner.get('url'):
        return str(inner['url'])
    return view_url


def localize(view_url: str) -> Path:
    view_url = _strip_fx_envelope(view_url)
    p = view_url_to_path(view_url)
    if p is not None:
        return p

    if isinstance(view_url, str) and (view_url.startswith('http://') or view_url.startswith('https://')):
        suffix = Path(urllib.parse.urlparse(view_url).path).suffix or '.mp4'
        dl_dir = _ensure_subdir(Path(folder_paths.get_temp_directory()), 'comfytv/dl')
        dest = dl_dir / f"{uuid.uuid4().hex[:12]}{suffix}"
        try:
            urllib.request.urlretrieve(view_url, dest)
            return dest
        except Exception as e:
            raise RuntimeError(f"failed to download {view_url!r}: {e}") from e
    raise RuntimeError(f"can't resolve view URL to a local file: {view_url!r}")


def get_video_info(view_url: str) -> dict:
    import av
    src = localize(view_url)
    with av.open(str(src)) as c:
        vstream = c.streams.video[0] if c.streams.video else None
        if vstream is None:
            raise RuntimeError(f"no video stream in {src}")
        dur = 0.0
        if vstream.duration and vstream.time_base:
            dur = float(vstream.duration * vstream.time_base)
        elif c.duration:
            dur = c.duration / 1_000_000
        try:
            fps = float(vstream.average_rate) if vstream.average_rate else 24.0
        except (TypeError, ZeroDivisionError):
            fps = 24.0
        return {
            'duration': dur,
            'fps':      fps,
            'width':    vstream.width,
            'height':   vstream.height,
            'has_audio': bool(c.streams.audio),
        }


def _resolve_position(position: Union[str, float, int], duration: float) -> float:
    cap = max(0.0, duration - 0.05) if duration > 0 else 0.0
    if isinstance(position, str):
        s = position.strip().lower()
        if s == 'first':  return 0.0
        if s == 'last':   return cap
        if s == 'middle': return duration / 2.0
        if s.endswith('%'):
            try:
                pct = float(s.rstrip('%')) / 100.0
            except ValueError:
                pct = 0.0
            return max(0.0, min(cap, pct * duration))
        try:
            n = float(s)
        except ValueError:
            return 0.0
        if 0.0 <= n <= 1.0 and duration > 1.5:
            return n * duration
        return max(0.0, min(cap, n))
    try:
        n = float(position)
    except (TypeError, ValueError):
        return 0.0
    return max(0.0, min(cap, n))


def extract_frame(view_url: str, position: Union[str, float, int] = 'last') -> str:
    import av
    src = localize(view_url)
    info = get_video_info(view_url)
    target_s = _resolve_position(position, info['duration'])
    out_path = fresh_output_path('.png', subfolder='comfytv/frames')

    with av.open(str(src)) as c:
        vstream = c.streams.video[0]
        if vstream.time_base:
            target_pts = int(target_s / float(vstream.time_base))
        else:
            target_pts = 0
        try:
            c.seek(target_pts, stream=vstream, any_frame=False, backward=True)
        except Exception:
            pass

        picked = None
        for frame in c.decode(vstream):
            picked = frame
            if frame.pts is None:
                continue
            if vstream.time_base and frame.pts * float(vstream.time_base) >= target_s:
                break

        if picked is None:
            raise RuntimeError(f"no decodable frame at position={position!r} in {src}")

        picked.to_image().save(str(out_path), 'PNG')

    return path_to_view_url(out_path)


def trim_video(view_url: str, start_s: float, end_s: float) -> str:
    import av
    if end_s <= start_s:
        raise RuntimeError(f"trim: end_s ({end_s}) must be > start_s ({start_s})")
    src = localize(view_url)
    out = fresh_output_path('.mp4')

    with av.open(str(src)) as inp, av.open(str(out), 'w') as outp:
        in_to_out: dict[int, object] = {}
        for s in inp.streams:
            if s.type in ('video', 'audio'):
                in_to_out[s.index] = outp.add_stream_from_template(s)

        vstream = inp.streams.video[0] if inp.streams.video else None
        if vstream and vstream.time_base:
            try:
                inp.seek(int(start_s / float(vstream.time_base)),
                         stream=vstream, any_frame=False, backward=True)
            except Exception:
                pass

        first_dts: dict[int, int] = {}
        for packet in inp.demux():
            if packet.dts is None or packet.stream.index not in in_to_out:
                continue
            tb = float(packet.stream.time_base)
            ts = (packet.pts if packet.pts is not None else packet.dts) * tb
            if ts > end_s:
                continue
            offset = first_dts.setdefault(packet.stream.index, packet.dts)
            if packet.pts is not None:
                packet.pts -= offset
            packet.dts -= offset
            packet.stream = in_to_out[packet.stream.index]
            outp.mux(packet)

    return path_to_view_url(out)


def trim_video_precise(view_url: str, start_s: float, end_s: float) -> str:
    import av
    import numpy as np
    from fractions import Fraction
    if end_s <= start_s:
        raise RuntimeError(f"trim: end_s ({end_s}) must be > start_s ({start_s})")
    src = localize(view_url)
    out = fresh_output_path('.mp4')
    out_tb = Fraction(1, 90000)
    eps = 1e-3

    with av.open(str(src)) as inp, av.open(str(out), 'w') as outp:
        in_v = inp.streams.video[0]
        w = in_v.width - (in_v.width % 2)
        h = in_v.height - (in_v.height % 2)
        out_v = outp.add_stream('libx264', rate=in_v.average_rate or 24,
                                options={'crf': '20'})
        out_v.width = w
        out_v.height = h
        out_v.pix_fmt = 'yuv420p'
        out_v.codec_context.time_base = out_tb
        from .media_filter import copy_color_tags
        copy_color_tags(in_v.codec_context, out_v.codec_context)
        out_a = _new_aac_stream(outp) if inp.streams.audio else None

        if in_v.time_base:
            try:
                inp.seek(int(start_s / float(in_v.time_base)),
                         stream=in_v, any_frame=False, backward=True)
            except Exception:
                pass

        try:
            frame_dur = 1.0 / float(in_v.average_rate)
        except (TypeError, ZeroDivisionError):
            frame_dur = 1.0 / 24.0

        prev_t = None
        for frame in inp.decode(in_v):
            if frame.pts is not None and frame.time_base:
                t = float(frame.pts * frame.time_base)
            else:
                t = (prev_t + frame_dur) if prev_t is not None else 0.0
            prev_t = t
            if t < start_s - eps:
                continue
            if t >= end_s - eps:
                break
            nf = frame.reformat(width=w, height=h, format='yuv420p')
            nf.pts = int(round(max(0.0, t - start_s) / out_tb))
            nf.time_base = out_tb
            for pkt in out_v.encode(nf):
                outp.mux(pkt)
        for pkt in out_v.encode():
            outp.mux(pkt)

        if out_a is not None:
            arr = _decode_audio_to_array(src)
            a0 = max(0, int(round(start_s * _AUDIO_RATE)))
            a1 = min(arr.shape[1], int(round(end_s * _AUDIO_RATE)))
            if a1 > a0:
                _encode_audio_array(
                    outp, out_a,
                    np.ascontiguousarray(arr[:, a0:a1]).astype(np.float32, copy=False))

    return path_to_view_url(out)


def _set_audio_stream_layout(out_stream, in_stream) -> None:
    try:
        out_stream.layout = in_stream.layout
        return
    except (AttributeError, TypeError, ValueError):
        pass
    try:
        out_stream.channels = in_stream.channels
    except (AttributeError, TypeError):
        pass


def crop_video(view_url: str, x: int, y: int, w: int, h: int) -> str:
    import av
    src = localize(view_url)
    out = fresh_output_path('.mp4')
    x, y, w, h = int(x), int(y), int(w), int(h)
    w -= w % 2
    h -= h % 2
    if w <= 0 or h <= 0:
        raise RuntimeError(f"crop: invalid w/h ({w}x{h})")

    with av.open(str(src)) as inp, av.open(str(out), 'w') as outp:
        in_v = inp.streams.video[0]
        out_v = outp.add_stream('libx264', rate=in_v.average_rate or 24)
        out_v.width = w
        out_v.height = h
        out_v.pix_fmt = 'yuv420p'
        from .media_filter import tag_bt709
        tag_bt709(out_v.codec_context)

        in_a = inp.streams.audio[0] if inp.streams.audio else None
        out_a = outp.add_stream_from_template(in_a) if in_a is not None else None

        for packet in inp.demux():
            if packet.stream is in_v:
                for frame in packet.decode():
                    img = frame.to_image().crop((x, y, x + w, y + h))
                    new_frame = av.VideoFrame.from_image(img)
                    new_frame = new_frame.reformat(format='yuv420p',
                                                   dst_colorspace='ITU709')
                    new_frame.pts = frame.pts
                    new_frame.time_base = frame.time_base
                    for pkt in out_v.encode(new_frame):
                        outp.mux(pkt)
            elif out_a is not None and packet.stream is in_a:
                if packet.dts is None:
                    continue
                packet.stream = out_a
                outp.mux(packet)

        for pkt in out_v.encode():
            outp.mux(pkt)

    return path_to_view_url(out)


def resize_video(view_url: str, w: int, h: int) -> str:
    import av
    if w <= 0 or h <= 0:
        raise RuntimeError(f"resize: invalid w/h ({w}x{h})")
    src = localize(view_url)
    out = fresh_output_path('.mp4')
    w, h = int(w), int(h)

    with av.open(str(src)) as inp, av.open(str(out), 'w') as outp:
        in_v = inp.streams.video[0]
        out_v = outp.add_stream('libx264', rate=in_v.average_rate or 24)
        out_v.width = w
        out_v.height = h
        out_v.pix_fmt = 'yuv420p'
        from .media_filter import copy_color_tags
        copy_color_tags(in_v.codec_context, out_v.codec_context)

        in_a = inp.streams.audio[0] if inp.streams.audio else None
        out_a = outp.add_stream_from_template(in_a) if in_a is not None else None

        for packet in inp.demux():
            if packet.stream is in_v:
                for frame in packet.decode():
                    resized = frame.reformat(width=w, height=h, format='yuv420p')
                    for pkt in out_v.encode(resized):
                        outp.mux(pkt)
            elif out_a is not None and packet.stream is in_a:
                if packet.dts is None:
                    continue
                packet.stream = out_a
                outp.mux(packet)

        for pkt in out_v.encode():
            outp.mux(pkt)

    return path_to_view_url(out)


def demux_audio(view_url: str, codec: str = 'wav') -> str:
    import av
    src = localize(view_url)
    info = get_video_info(view_url)
    if not info['has_audio']:
        raise RuntimeError(f"demux_audio: source has no audio stream ({src.name})")

    if codec == 'mp3':
        out = fresh_output_path('.mp3', subfolder='comfytv/audio')
        target_codec = 'libmp3lame'
        container = 'mp3'
    else:
        out = fresh_output_path('.wav', subfolder='comfytv/audio')
        target_codec = 'pcm_s16le'
        container = 'wav'

    with av.open(str(src)) as inp, av.open(str(out), 'w', format=container) as outp:
        in_a = inp.streams.audio[0]
        out_a = outp.add_stream(target_codec, rate=in_a.rate)
        _set_audio_stream_layout(out_a, in_a)

        resampler = av.AudioResampler(
            format=out_a.format,
            layout=out_a.layout,
            rate=out_a.rate,
        )

        for frame in inp.decode(in_a):
            for resampled in resampler.resample(frame):
                for pkt in out_a.encode(resampled):
                    outp.mux(pkt)

        for resampled in resampler.resample(None):
            for pkt in out_a.encode(resampled):
                outp.mux(pkt)
        for pkt in out_a.encode():
            outp.mux(pkt)

    return path_to_view_url(out)


def silence_video(view_url: str) -> str:
    import av
    src = localize(view_url)
    out = fresh_output_path('.mp4')

    with av.open(str(src)) as inp, av.open(str(out), 'w') as outp:
        in_v = inp.streams.video[0]
        out_v = outp.add_stream_from_template(in_v)
        for packet in inp.demux(in_v):
            if packet.dts is None:
                continue
            packet.stream = out_v
            outp.mux(packet)

    return path_to_view_url(out)


_AUDIO_RATE = 44100
_AAC_FRAME = 1024


def _new_aac_stream(outp):
    out_a = outp.add_stream('aac', rate=_AUDIO_RATE)
    out_a.layout = 'stereo'
    return out_a


def _decode_audio_to_array(path):
    import av
    import numpy as np
    chunks = []
    with av.open(str(path)) as inp:
        if not inp.streams.audio:
            return np.zeros((2, 0), dtype=np.float32)
        in_a = inp.streams.audio[0]
        resampler = av.AudioResampler(format='fltp', layout='stereo', rate=_AUDIO_RATE)
        for frame in inp.decode(in_a):
            for rf in resampler.resample(frame):
                chunks.append(rf.to_ndarray().astype(np.float32, copy=False))
        for rf in resampler.resample(None):
            chunks.append(rf.to_ndarray().astype(np.float32, copy=False))
    return np.concatenate(chunks, axis=1) if chunks else np.zeros((2, 0), dtype=np.float32)


def _encode_audio_array(outp, out_a, arr):
    import av
    import numpy as np
    from fractions import Fraction
    pos = 0
    total = arr.shape[1]
    while pos < total:
        chunk = arr[:, pos:pos + _AAC_FRAME]
        af = av.AudioFrame.from_ndarray(
            np.ascontiguousarray(chunk), format='fltp', layout='stereo')
        af.sample_rate = _AUDIO_RATE
        af.pts = pos
        af.time_base = Fraction(1, _AUDIO_RATE)
        pos += chunk.shape[1]
        for pkt in out_a.encode(af):
            outp.mux(pkt)
    for pkt in out_a.encode():
        outp.mux(pkt)


def speed_video(view_url: str, factor: float, reverse: bool = False,
                pitch_compensate: bool = True) -> str:
    import av
    import numpy as np
    from fractions import Fraction
    factor = float(factor or 1.0)
    if not (0.1 <= factor <= 10.0):
        raise RuntimeError(f"speed: factor out of range ({factor})")
    src = localize(view_url)
    out = fresh_output_path('.mp4')
    out_tb = Fraction(1, 90000)
    max_reverse_frames = 3000

    with av.open(str(src)) as inp, av.open(str(out), 'w') as outp:
        in_v = inp.streams.video[0]
        w = in_v.width - (in_v.width % 2)
        h = in_v.height - (in_v.height % 2)
        out_v = outp.add_stream('libx264', rate=in_v.average_rate or 24)
        out_v.width = w
        out_v.height = h
        out_v.pix_fmt = 'yuv420p'
        out_v.codec_context.time_base = out_tb
        from .media_filter import copy_color_tags
        copy_color_tags(in_v.codec_context, out_v.codec_context)
        out_a = _new_aac_stream(outp) if inp.streams.audio else None

        try:
            frame_dur = 1.0 / float(in_v.average_rate)
        except (TypeError, ZeroDivisionError):
            frame_dur = 1.0 / 24.0
        out_frame_dur = frame_dur / factor

        buffered = []
        prev_t = None
        end_t = 0.0
        for frame in inp.decode(in_v):
            if frame.pts is not None and frame.time_base:
                t = float(frame.pts * frame.time_base)
            else:
                t = (prev_t + frame_dur) if prev_t is not None else 0.0
            prev_t = t
            out_t = t / factor
            end_t = max(end_t, out_t + out_frame_dur)
            nf = frame.reformat(width=w, height=h, format='yuv420p')
            if reverse:
                buffered.append((out_t, nf))
                if len(buffered) > max_reverse_frames:
                    raise RuntimeError(
                        f"reverse: clip too long (>{max_reverse_frames} frames) — trim it first"
                    )
            else:
                nf.pts = int(round(out_t / out_tb))
                nf.time_base = out_tb
                for pkt in out_v.encode(nf):
                    outp.mux(pkt)

        if reverse:
            for out_t, nf in reversed(buffered):
                new_t = max(0.0, end_t - out_t - out_frame_dur)
                nf.pts = int(round(new_t / out_tb))
                nf.time_base = out_tb
                for pkt in out_v.encode(nf):
                    outp.mux(pkt)

        for pkt in out_v.encode():
            outp.mux(pkt)

        if out_a is not None:
            arr = _decode_audio_to_array(src)
            if factor != 1.0 and arr.shape[1] > 1:
                if pitch_compensate:
                    from .media_filter import process_audio_array, atempo_specs
                    arr = process_audio_array(arr, atempo_specs(factor))
                else:
                    n_out = max(1, int(round(arr.shape[1] / factor)))
                    xi = np.linspace(0.0, arr.shape[1] - 1, n_out)
                    xp = np.arange(arr.shape[1])
                    arr = np.stack([np.interp(xi, xp, arr[c]) for c in range(2)]).astype(np.float32)
            if reverse:
                target = int(round(end_t * _AUDIO_RATE))
                if target > 0:
                    if arr.shape[1] > target:
                        arr = arr[:, :target]
                    elif arr.shape[1] < target:
                        arr = np.concatenate(
                            [arr, np.zeros((2, target - arr.shape[1]),
                                           dtype=np.float32)], axis=1)
                arr = np.ascontiguousarray(arr[:, ::-1])
            _encode_audio_array(outp, out_a, arr)

    return path_to_view_url(out)


def transpose_video(view_url: str, rotate_deg: int = 0,
                    flip_h: bool = False, flip_v: bool = False) -> str:
    import av
    import numpy as np
    rot = int(rotate_deg) % 360
    if rot not in (0, 90, 180, 270):
        raise RuntimeError(f"transpose: rotate_deg must be a multiple of 90 ({rotate_deg})")
    if rot == 0 and not flip_h and not flip_v:
        raise RuntimeError("transpose: nothing to do — set a rotation or a flip")
    src = localize(view_url)
    out = fresh_output_path('.mp4')

    with av.open(str(src)) as inp, av.open(str(out), 'w') as outp:
        in_v = inp.streams.video[0]
        sw, sh = in_v.width, in_v.height
        w, h = (sh, sw) if rot in (90, 270) else (sw, sh)
        w -= w % 2
        h -= h % 2
        out_v = outp.add_stream('libx264', rate=in_v.average_rate or 24)
        out_v.width = w
        out_v.height = h
        out_v.pix_fmt = 'yuv420p'
        from .media_filter import tag_bt709
        tag_bt709(out_v.codec_context)

        in_a = inp.streams.audio[0] if inp.streams.audio else None
        out_a = outp.add_stream_from_template(in_a) if in_a is not None else None

        k = (-(rot // 90)) % 4
        for packet in inp.demux():
            if packet.stream is in_v:
                for frame in packet.decode():
                    arr = frame.to_ndarray(format='rgb24')
                    if k:
                        arr = np.rot90(arr, k=k)
                    if flip_h:
                        arr = arr[:, ::-1]
                    if flip_v:
                        arr = arr[::-1]
                    arr = np.ascontiguousarray(arr[:h, :w])
                    nf = av.VideoFrame.from_ndarray(arr, format='rgb24')
                    nf = nf.reformat(format='yuv420p',
                                     dst_colorspace='ITU709')
                    nf.pts = frame.pts
                    nf.time_base = frame.time_base
                    for pkt in out_v.encode(nf):
                        outp.mux(pkt)
            elif out_a is not None and packet.stream is in_a:
                if packet.dts is None:
                    continue
                packet.stream = out_a
                outp.mux(packet)

        for pkt in out_v.encode():
            outp.mux(pkt)

    return path_to_view_url(out)


def adjust_volume(view_url: str, volume: float = 1.0,
                  fade_in_s: float = 0.0, fade_out_s: float = 0.0) -> str:
    import av
    import numpy as np
    src = localize(view_url)
    arr = _decode_audio_to_array(src)
    if arr.shape[1] == 0:
        raise RuntimeError("adjust_volume: source has no audio track")
    out = fresh_output_path('.mp4')

    gain = min(max(float(volume or 0.0), 0.0), 8.0)
    arr = arr * gain
    n = arr.shape[1]
    fi = int(min(max(float(fade_in_s or 0.0), 0.0) * _AUDIO_RATE, n))
    fo = int(min(max(float(fade_out_s or 0.0), 0.0) * _AUDIO_RATE, n))
    if fi > 0:
        arr[:, :fi] *= np.linspace(0.0, 1.0, fi)
    if fo > 0:
        arr[:, n - fo:] *= np.linspace(1.0, 0.0, fo)
    np.clip(arr, -1.0, 1.0, out=arr)

    with av.open(str(src)) as inp, av.open(str(out), 'w') as outp:
        in_v = inp.streams.video[0]
        out_v = outp.add_stream_from_template(in_v)
        out_a = _new_aac_stream(outp)
        for packet in inp.demux(in_v):
            if packet.dts is None:
                continue
            packet.stream = out_v
            outp.mux(packet)
        _encode_audio_array(outp, out_a, arr.astype(np.float32, copy=False))

    return path_to_view_url(out)


def mux_audio(video_url: str, audio_url: str,
              mode: str = 'replace', offset_s: float = 0.0) -> str:
    import av
    import numpy as np
    if mode not in ('replace', 'mix'):
        raise RuntimeError(f"mux_audio: unknown mode {mode!r}")
    vsrc = localize(video_url)
    asrc = localize(audio_url)
    dur = float(get_video_info(video_url).get('duration') or 0.0)
    out = fresh_output_path('.mp4')

    new = _decode_audio_to_array(asrc)
    if new.shape[1] == 0:
        raise RuntimeError("mux_audio: audio input has no decodable audio")
    off = int(round(float(offset_s or 0.0) * _AUDIO_RATE))
    if off > 0:
        new = np.concatenate([np.zeros((2, off), dtype=np.float32), new], axis=1)
    elif off < 0:
        new = new[:, -off:]

    target = int(round(dur * _AUDIO_RATE)) or new.shape[1]

    def _fit(a):
        if a.shape[1] > target:
            return a[:, :target]
        if a.shape[1] < target:
            return np.concatenate(
                [a, np.zeros((2, target - a.shape[1]), dtype=np.float32)], axis=1)
        return a

    new = _fit(new)
    if mode == 'mix':
        orig = _fit(_decode_audio_to_array(vsrc))
        new = np.clip(orig + new, -1.0, 1.0)

    with av.open(str(vsrc)) as inp, av.open(str(out), 'w') as outp:
        in_v = inp.streams.video[0]
        out_v = outp.add_stream_from_template(in_v)
        out_a = _new_aac_stream(outp)
        for packet in inp.demux(in_v):
            if packet.dts is None:
                continue
            packet.stream = out_v
            outp.mux(packet)
        _encode_audio_array(outp, out_a, new.astype(np.float32, copy=False))

    return path_to_view_url(out)


def extract_frames_multi(view_url: str, times) -> str:
    import json
    ts = sorted({round(float(t), 3) for t in (times or [])
                 if t is not None and float(t) >= 0})
    if not ts:
        raise RuntimeError("extract_frames: no timestamps given — add marks first")
    if len(ts) > 48:
        raise RuntimeError(f"extract_frames: too many marks ({len(ts)}), max 48")
    images = []
    for i, t in enumerate(ts):
        url = extract_frame(view_url, t)
        images.append({'index': i + 1, 'label': f"{t:.2f}s", 'image_url': url})
    return json.dumps({'images': images})


def concat_videos(view_urls: list, progress=None) -> str:
    import av
    import numpy as np
    from fractions import Fraction

    urls = [u for u in (view_urls or []) if (u or '').strip()]
    if len(urls) < 2:
        raise RuntimeError(f"concat: need at least 2 videos, got {len(urls)}")

    srcs = [localize(u) for u in urls]

    width = height = 0
    rate = None
    any_audio = False
    for i, src in enumerate(srcs):
        with av.open(str(src)) as probe:
            if not probe.streams.video:
                raise RuntimeError(f"concat: clip {i + 1} has no video stream")
            v = probe.streams.video[0]
            if i == 0:
                width = v.width - (v.width % 2)
                height = v.height - (v.height % 2)
                rate = v.average_rate or 24
            if probe.streams.audio:
                any_audio = True
    if width <= 0 or height <= 0:
        raise RuntimeError(f"concat: first clip has invalid dimensions ({width}x{height})")

    out = fresh_output_path('.mp4')
    AUDIO_RATE = 44100
    AAC_FRAME = 1024
    out_tb = Fraction(1, 90000)

    with av.open(str(out), 'w') as outp:
        out_v = outp.add_stream('libx264', rate=rate)
        out_v.width = width
        out_v.height = height
        out_v.pix_fmt = 'yuv420p'
        out_v.codec_context.time_base = out_tb

        out_a = None
        if any_audio:
            out_a = outp.add_stream('aac', rate=AUDIO_RATE)
            out_a.layout = 'stereo'

        samples_written = 0
        pending = np.zeros((2, 0), dtype=np.float32)

        def emit_audio(flush=False):
            nonlocal pending, samples_written
            while pending.shape[1] >= AAC_FRAME or (flush and pending.shape[1] > 0):
                n = min(AAC_FRAME, pending.shape[1])
                chunk, pending = pending[:, :n], pending[:, n:]
                af = av.AudioFrame.from_ndarray(
                    np.ascontiguousarray(chunk), format='fltp', layout='stereo')
                af.sample_rate = AUDIO_RATE
                af.pts = samples_written
                af.time_base = Fraction(1, AUDIO_RATE)
                samples_written += n
                for pkt in out_a.encode(af):
                    outp.mux(pkt)

        offset = 0.0
        for i, src in enumerate(srcs):
            if progress is not None:
                progress(i, len(srcs), f"clip {i + 1}/{len(srcs)}")
            clip_audio = []
            clip_end = 0.0
            with av.open(str(src)) as inp:
                in_v = inp.streams.video[0]
                in_a = inp.streams.audio[0] if inp.streams.audio else None
                if i == 0:
                    from .media_filter import copy_color_tags
                    copy_color_tags(in_v.codec_context,
                                    out_v.codec_context)
                try:
                    frame_dur = 1.0 / float(in_v.average_rate)
                except (TypeError, ZeroDivisionError):
                    frame_dur = 1.0 / 24.0
                resampler = None
                if in_a is not None and out_a is not None:
                    resampler = av.AudioResampler(format='fltp', layout='stereo', rate=AUDIO_RATE)

                prev_t = None
                for packet in inp.demux():
                    if packet.stream is in_v:
                        for frame in packet.decode():
                            if frame.pts is not None and frame.time_base:
                                t = float(frame.pts * frame.time_base)
                            else:
                                t = (prev_t + frame_dur) if prev_t is not None else 0.0
                            prev_t = t
                            clip_end = max(clip_end, t + frame_dur)
                            nf = frame.reformat(width=width, height=height, format='yuv420p')
                            nf.pts = int(round((offset + t) / out_tb))
                            nf.time_base = out_tb
                            for pkt in out_v.encode(nf):
                                outp.mux(pkt)
                    elif resampler is not None and packet.stream is in_a:
                        for frame in packet.decode():
                            for rf in resampler.resample(frame):
                                clip_audio.append(rf.to_ndarray().astype(np.float32, copy=False))
                if resampler is not None:
                    for rf in resampler.resample(None):
                        clip_audio.append(rf.to_ndarray().astype(np.float32, copy=False))

            if out_a is not None:
                target = int(round(clip_end * AUDIO_RATE))
                got = (np.concatenate(clip_audio, axis=1)
                       if clip_audio else np.zeros((2, 0), dtype=np.float32))
                if got.shape[1] > target:
                    got = got[:, :target]
                elif got.shape[1] < target:
                    got = np.concatenate(
                        [got, np.zeros((2, target - got.shape[1]), dtype=np.float32)], axis=1)
                pending = np.concatenate([pending, got], axis=1)
                emit_audio()

            offset += clip_end

        if out_a is not None:
            emit_audio(flush=True)
            for pkt in out_a.encode():
                outp.mux(pkt)
        for pkt in out_v.encode():
            outp.mux(pkt)

    return path_to_view_url(out)


__all__ = [
    'view_url_to_path', 'path_to_view_url',
    'localize', 'fresh_output_path',
    'get_video_info',
    'extract_frame',
    'trim_video', 'trim_video_precise', 'crop_video', 'resize_video', 'concat_videos',
    'speed_video', 'transpose_video', 'adjust_volume', 'mux_audio',
    'extract_frames_multi',
    'demux_audio', 'silence_video',
]
