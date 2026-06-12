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


def fresh_output_path(suffix: str, subfolder: str = 'comfytv-video') -> Path:
    base = Path(folder_paths.get_output_directory())
    out_dir = _ensure_subdir(base, subfolder)
    return out_dir / f"{uuid.uuid4().hex[:12]}{suffix}"


def localize(view_url: str) -> Path:
    p = view_url_to_path(view_url)
    if p is not None:
        return p

    if isinstance(view_url, str) and (view_url.startswith('http://') or view_url.startswith('https://')):
        suffix = Path(urllib.parse.urlparse(view_url).path).suffix or '.mp4'
        dl_dir = _ensure_subdir(Path(folder_paths.get_temp_directory()), 'comfytv-dl')
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
    out_path = fresh_output_path('.png', subfolder='comfytv-frames')

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
    if w <= 0 or h <= 0:
        raise RuntimeError(f"crop: invalid w/h ({w}x{h})")
    src = localize(view_url)
    out = fresh_output_path('.mp4')
    x, y, w, h = int(x), int(y), int(w), int(h)

    with av.open(str(src)) as inp, av.open(str(out), 'w') as outp:
        in_v = inp.streams.video[0]
        out_v = outp.add_stream('libx264', rate=in_v.average_rate or 24)
        out_v.width = w
        out_v.height = h
        out_v.pix_fmt = 'yuv420p'

        in_a = inp.streams.audio[0] if inp.streams.audio else None
        out_a = outp.add_stream_from_template(in_a) if in_a is not None else None

        for packet in inp.demux():
            if packet.stream is in_v:
                for frame in packet.decode():
                    img = frame.to_image().crop((x, y, x + w, y + h))
                    new_frame = av.VideoFrame.from_image(img)
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
        out = fresh_output_path('.mp3', subfolder='comfytv-audio')
        target_codec = 'libmp3lame'
        container = 'mp3'
    else:
        out = fresh_output_path('.wav', subfolder='comfytv-audio')
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


__all__ = [
    'view_url_to_path', 'path_to_view_url',
    'localize', 'fresh_output_path',
    'get_video_info',
    'extract_frame',
    'trim_video', 'crop_video', 'resize_video',
    'demux_audio', 'silence_video',
]
