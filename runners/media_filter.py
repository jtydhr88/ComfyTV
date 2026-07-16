
import logging
from fractions import Fraction
from pathlib import Path
from typing import Optional

from .media import (
    localize, fresh_output_path, path_to_view_url, get_video_info,
    _decode_audio_to_array, _encode_audio_array, _new_aac_stream,
    _AUDIO_RATE, _AAC_FRAME,
)

_log = logging.getLogger(__name__)

FilterSpec = tuple

_OUT_TB = Fraction(1, 90000)

_filters_cache: Optional[frozenset] = None


def available_filters() -> frozenset:
    global _filters_cache
    if _filters_cache is None:
        import av.filter
        names = set()
        for f in av.filter.filters_available:
            names.add(f if isinstance(f, str) else getattr(f, 'name', str(f)))
        _filters_cache = frozenset(names)
    return _filters_cache


def has_filter(name: str) -> bool:
    return name in available_filters()


def require_filters(*names: str) -> None:
    missing = [n for n in names if not has_filter(n)]
    if missing:
        raise RuntimeError(
            f"this build of PyAV/FFmpeg lacks filter(s): {', '.join(missing)} — "
            f"pip-installed av wheels normally include them; check `av.filter.filters_available`."
        )


def _spec_str(specs) -> str:
    return ','.join(n if not a else f"{n}={a}" for n, a in (specs or []))


def _build_video_graph(graph, in_v, specs, pix_fmt='yuv420p'):
    src = graph.add_buffer(template=in_v)
    prev = src
    for name, args in specs:
        f = graph.add(name, args) if args else graph.add(name)
        prev.link_to(f)
        prev = f
    fmt = graph.add('format', pix_fmt)
    prev.link_to(fmt)
    sink = graph.add('buffersink')
    fmt.link_to(sink)
    return src, sink


def _build_audio_graph(graph, in_a, specs):
    src = graph.add_abuffer(template=in_a)
    prev = src
    for name, args in specs:
        f = graph.add(name, args) if args else graph.add(name)
        prev.link_to(f)
        prev = f
    fmt = graph.add(
        'aformat',
        f'sample_fmts=fltp:sample_rates={_AUDIO_RATE}:channel_layouts=stereo')
    prev.link_to(fmt)
    sink = graph.add('abuffersink')
    fmt.link_to(sink)
    return src, sink


def _drain(sink):
    import av
    out = []
    while True:
        try:
            out.append(sink.pull())
        except (av.error.BlockingIOError, av.error.EOFError, EOFError):
            break
        except av.FFmpegError as e:
            if getattr(e, 'errno', None) in (11, 35):
                break
            raise
    return out


def _frame_time(frame, fallback_tb):
    tb = frame.time_base or fallback_tb
    if frame.pts is None or tb is None or abs(frame.pts) >= (1 << 61):
        return None
    return float(frame.pts * tb)


def filter_video(view_url: str,
                 video_specs=None,
                 audio_specs=None,
                 *,
                 out_fps=None,
                 out_ext='.mp4',
                 vcodec='libx264',
                 pix_fmt='yuv420p',
                 vcodec_options=None,
                 keep_audio=True,
                 progress=None) -> str:
    import av

    video_specs = list(video_specs or [])
    audio_specs = list(audio_specs or [])
    require_filters(*[n for n, _ in video_specs + audio_specs])
    if not video_specs and not audio_specs:
        raise RuntimeError("filter_video: no filters given")

    src_path = localize(view_url)
    info = get_video_info(view_url)
    out = fresh_output_path(out_ext)
    total_est = max(1, int(info['duration'] * info['fps']))

    with av.open(str(src_path)) as inp, av.open(str(out), 'w') as outp:
        in_v = inp.streams.video[0] if inp.streams.video else None
        in_a = inp.streams.audio[0] if (keep_audio and inp.streams.audio) else None
        if in_v is None:
            raise RuntimeError("filter_video: source has no video stream")

        vgraph = vsrc = vsink = None
        out_v = None
        if video_specs:
            vgraph = av.filter.Graph()
            vsrc, vsink = _build_video_graph(vgraph, in_v, video_specs, pix_fmt)
            vgraph.configure()
        else:
            out_v = outp.add_stream_from_template(in_v)

        agraph = asrc = asink = None
        out_a = None
        pending_chunks = []
        audio_pts = 0
        if audio_specs and in_a is not None:
            agraph = av.filter.Graph()
            asrc, asink = _build_audio_graph(agraph, in_a, audio_specs)
            agraph.configure()
            out_a = _new_aac_stream(outp)
        elif in_a is not None:
            out_a = outp.add_stream_from_template(in_a)

        enc_v = None
        held = []

        def _mux(pkt):
            if video_specs and enc_v is None:
                held.append(pkt)
                return
            while held:
                outp.mux(held.pop(0))
            outp.mux(pkt)

        def _encode_filtered(frame):
            nonlocal enc_v
            if enc_v is None:
                rate = out_fps or info['fps'] or 24
                enc_v = outp.add_stream(vcodec, rate=round(rate),
                                        options=dict(vcodec_options or {}))
                enc_v.width = frame.width - (frame.width % 2)
                enc_v.height = frame.height - (frame.height % 2)
                enc_v.pix_fmt = pix_fmt
                enc_v.codec_context.time_base = _OUT_TB
            t = _frame_time(frame, in_v.time_base)
            if t is None:
                return
            if frame.width != enc_v.width or frame.height != enc_v.height:
                frame = frame.reformat(width=enc_v.width, height=enc_v.height,
                                       format=pix_fmt)
            frame.pts = int(round(t / _OUT_TB))
            frame.time_base = _OUT_TB
            for pkt in enc_v.encode(frame):
                _mux(pkt)

        def _emit_filtered_audio(flush=False):
            nonlocal pending_chunks, audio_pts
            import numpy as np
            if not pending_chunks:
                return
            arr = np.concatenate(pending_chunks, axis=1)
            pending_chunks = []
            pos = 0
            while arr.shape[1] - pos >= _AAC_FRAME or (flush and pos < arr.shape[1]):
                n = min(_AAC_FRAME, arr.shape[1] - pos)
                chunk = np.ascontiguousarray(arr[:, pos:pos + n])
                af = av.AudioFrame.from_ndarray(chunk, format='fltp', layout='stereo')
                af.sample_rate = _AUDIO_RATE
                af.pts = audio_pts
                af.time_base = Fraction(1, _AUDIO_RATE)
                audio_pts += n
                pos += n
                for pkt in out_a.encode(af):
                    _mux(pkt)
            if pos < arr.shape[1]:
                pending_chunks = [arr[:, pos:]]

        n_in = 0
        for packet in inp.demux():
            if packet.dts is None:
                continue
            if packet.stream is in_v:
                if vgraph is not None:
                    for frame in packet.decode():
                        vsrc.push(frame)
                        for f in _drain(vsink):
                            _encode_filtered(f)
                        n_in += 1
                        if progress is not None and n_in % 30 == 0:
                            progress(min(n_in, total_est), total_est, "filtering")
                else:
                    packet.stream = out_v
                    outp.mux(packet)
            elif in_a is not None and packet.stream is in_a:
                if agraph is not None:
                    for frame in packet.decode():
                        asrc.push(frame)
                        for f in _drain(asink):
                            pending_chunks.append(
                                f.to_ndarray().astype('float32', copy=False))
                    _emit_filtered_audio()
                elif out_a is not None and audio_specs == []:
                    packet.stream = out_a
                    _mux(packet)

        if vgraph is not None:
            vsrc.push(None)
            for f in _drain(vsink):
                _encode_filtered(f)
            if enc_v is not None:
                for pkt in enc_v.encode():
                    outp.mux(pkt)
        if agraph is not None:
            asrc.push(None)
            for f in _drain(asink):
                pending_chunks.append(f.to_ndarray().astype('float32', copy=False))
            _emit_filtered_audio(flush=True)
            for pkt in out_a.encode():
                _mux(pkt)

        if progress is not None:
            progress(total_est, total_est, "finalizing")

    return path_to_view_url(out)


def process_audio_array(arr, audio_specs):
    import av
    import numpy as np

    audio_specs = list(audio_specs or [])
    require_filters(*[n for n, _ in audio_specs])
    graph = av.filter.Graph()
    src = graph.add_abuffer(format='fltp', layout='stereo',
                            sample_rate=_AUDIO_RATE,
                            time_base=Fraction(1, _AUDIO_RATE))
    prev = src
    for name, args in audio_specs:
        f = graph.add(name, args) if args else graph.add(name)
        prev.link_to(f)
        prev = f
    fmt = graph.add(
        'aformat',
        f'sample_fmts=fltp:sample_rates={_AUDIO_RATE}:channel_layouts=stereo')
    prev.link_to(fmt)
    sink = graph.add('abuffersink')
    fmt.link_to(sink)
    graph.configure()

    chunks = []
    pos = 0
    total = arr.shape[1]
    while pos < total:
        n = min(_AAC_FRAME, total - pos)
        af = av.AudioFrame.from_ndarray(
            np.ascontiguousarray(arr[:, pos:pos + n].astype(np.float32)),
            format='fltp', layout='stereo')
        af.sample_rate = _AUDIO_RATE
        af.pts = pos
        af.time_base = Fraction(1, _AUDIO_RATE)
        pos += n
        src.push(af)
        for f in _drain(sink):
            chunks.append(f.to_ndarray().astype(np.float32, copy=False))
    src.push(None)
    for f in _drain(sink):
        chunks.append(f.to_ndarray().astype(np.float32, copy=False))
    if not chunks:
        return np.zeros((2, 0), dtype=np.float32)
    return np.concatenate(chunks, axis=1)


def atempo_specs(factor: float):
    if not factor or factor <= 0:
        raise ValueError(f"atempo: factor must be positive ({factor})")
    specs = []
    remain = float(factor)
    while remain > 2.0 + 1e-9:
        specs.append(('atempo', '2.0'))
        remain /= 2.0
    while remain < 0.5 - 1e-9:
        specs.append(('atempo', '0.5'))
        remain /= 0.5
    specs.append(('atempo', f'{remain:.6f}'))
    return specs


def filter_audio(view_url: str, audio_specs, out_codec: str = 'wav') -> str:
    import av

    audio_specs = list(audio_specs or [])
    require_filters(*[n for n, _ in audio_specs])
    src_path = localize(view_url)

    if out_codec == 'mp3':
        out = fresh_output_path('.mp3', subfolder='comfytv-audio')
        codec, container = 'libmp3lame', 'mp3'
    else:
        out = fresh_output_path('.wav', subfolder='comfytv-audio')
        codec, container = 'pcm_s16le', 'wav'

    with av.open(str(src_path)) as inp:
        if not inp.streams.audio:
            raise RuntimeError("filter_audio: source has no audio stream")
        in_a = inp.streams.audio[0]

        graph = av.filter.Graph()
        asrc, asink = _build_audio_graph(graph, in_a, audio_specs)
        graph.configure()

        with av.open(str(out), 'w', format=container) as outp:
            out_a = outp.add_stream(codec, rate=_AUDIO_RATE)
            out_a.layout = 'stereo'
            pts = 0

            def _write(frame):
                nonlocal pts
                frame.pts = pts
                frame.time_base = Fraction(1, _AUDIO_RATE)
                pts += frame.samples
                for pkt in out_a.encode(frame):
                    outp.mux(pkt)

            for frame in inp.decode(in_a):
                asrc.push(frame)
                for f in _drain(asink):
                    _write(f)
            asrc.push(None)
            for f in _drain(asink):
                _write(f)
            for pkt in out_a.encode():
                outp.mux(pkt)

    return path_to_view_url(out)


def has_encoder(name: str) -> bool:
    import av
    try:
        av.Codec(name, 'w')
        return True
    except Exception:
        return False


def chroma_key_video(view_url: str, key_color: str = '#00FF00',
                     similarity: float = 0.1, blend: float = 0.05,
                     despill_mix: float = 0.5, despill_expand: float = 0.0,
                     mode: str = 'alpha', progress=None) -> str:
    color = (key_color or '#00FF00').strip().lstrip('#')
    if len(color) != 6:
        raise RuntimeError(f"chroma key: bad color {key_color!r}")
    r, g, b = (int(color[i:i + 2], 16) for i in (0, 2, 4))

    specs = [('chromakey',
              f'color=0x{color}:similarity={min(max(float(similarity), 0.01), 1.0)}'
              f':blend={min(max(float(blend), 0.0), 1.0)}')]
    if float(despill_mix or 0) > 0 and (g >= b or b > g):
        despill_type = 'green' if g >= b else 'blue'
        specs.append(('despill',
                      f'type={despill_type}:mix={min(max(float(despill_mix), 0.0), 1.0)}'
                      f':expand={min(max(float(despill_expand), 0.0), 1.0)}'))

    if mode == 'matte':
        require_filters('alphaextract')
        specs.append(('alphaextract', None))
        return filter_video(view_url, specs, keep_audio=False, progress=progress)

    if not has_encoder('libvpx-vp9'):
        raise RuntimeError(
            "chroma key: this PyAV build lacks the libvpx-vp9 encoder needed "
            "for alpha output — use mode='matte' instead."
        )
    return filter_video(
        view_url, specs,
        out_ext='.webm', vcodec='libvpx-vp9', pix_fmt='yuva420p',
        vcodec_options={'crf': '32', 'b': '0', 'row-mt': '1',
                        'cpu-used': '4', 'auto-alt-ref': '0'},
        keep_audio=False, progress=progress,
    )


XFADE_TRANSITIONS = [
    'fade', 'dissolve', 'fadeblack', 'fadewhite', 'fadegrays', 'fadefast', 'fadeslow',
    'wipeleft', 'wiperight', 'wipeup', 'wipedown',
    'wipetl', 'wipetr', 'wipebl', 'wipebr',
    'slideleft', 'slideright', 'slideup', 'slidedown',
    'smoothleft', 'smoothright', 'smoothup', 'smoothdown',
    'circlecrop', 'rectcrop', 'circleopen', 'circleclose',
    'vertopen', 'vertclose', 'horzopen', 'horzclose',
    'diagtl', 'diagtr', 'diagbl', 'diagbr',
    'hlslice', 'hrslice', 'vuslice', 'vdslice',
    'hlwind', 'hrwind', 'vuwind', 'vdwind',
    'coverleft', 'coverright', 'coverup', 'coverdown',
    'revealleft', 'revealright', 'revealup', 'revealdown',
    'squeezeh', 'squeezev', 'zoomin', 'distance', 'pixelize', 'radial', 'hblur',
]


def xfade_videos(url_a: str, url_b: str, transition: str = 'fade',
                 duration: float = 1.0, offset: Optional[float] = None,
                 progress=None) -> str:
    import av
    import numpy as np

    require_filters('xfade', 'scale', 'fps', 'settb', 'format')
    if transition not in XFADE_TRANSITIONS:
        raise RuntimeError(f"xfade: unknown transition {transition!r}")

    info_a = get_video_info(url_a)
    info_b = get_video_info(url_b)
    dur_a = float(info_a['duration'] or 0.0)
    dur_b = float(info_b['duration'] or 0.0)
    duration = max(0.1, min(float(duration or 1.0), max(0.1, dur_a), max(0.1, dur_b)))
    if offset is None or offset <= 0:
        offset = max(0.0, dur_a - duration)
    offset = max(0.0, min(float(offset), max(0.0, dur_a - duration)))

    w = info_a['width'] - (info_a['width'] % 2)
    h = info_a['height'] - (info_a['height'] % 2)
    fps = info_a['fps'] or 24
    src_a = localize(url_a)
    src_b = localize(url_b)
    out = fresh_output_path('.mp4')
    total_est = max(1, int((dur_a + dur_b) * fps))

    with av.open(str(src_a)) as ca, av.open(str(src_b)) as cb, \
            av.open(str(out), 'w') as outp:
        va, vb = ca.streams.video[0], cb.streams.video[0]

        graph = av.filter.Graph()

        def _norm_chain(stream):
            buf = graph.add_buffer(template=stream)
            chain = buf
            for name, args in (
                ('scale', f'{w}:{h}:flags=bicubic'),
                ('fps', f'{fps}'),
                ('format', 'yuv420p'),
                ('settb', 'AVTB'),
            ):
                f = graph.add(name, args)
                chain.link_to(f)
                chain = f
            return buf, chain

        buf_a, tail_a = _norm_chain(va)
        buf_b, tail_b = _norm_chain(vb)
        xf = graph.add('xfade',
                       f'transition={transition}:duration={duration}:offset={offset}')
        tail_a.link_to(xf, 0, 0)
        tail_b.link_to(xf, 0, 1)
        sink = graph.add('buffersink')
        xf.link_to(sink)
        graph.configure()

        out_v = outp.add_stream('libx264', rate=round(fps))
        out_v.width, out_v.height = w, h
        out_v.pix_fmt = 'yuv420p'
        out_v.codec_context.time_base = _OUT_TB

        has_audio = bool(ca.streams.audio) or bool(cb.streams.audio)
        out_a = _new_aac_stream(outp) if has_audio else None

        dec_a = ca.decode(va)
        dec_b = cb.decode(vb)
        next_b = None
        a_done = b_done = False
        fed_a_t = 0.0
        n_out = 0

        def _emit():
            nonlocal n_out
            for f in _drain(sink):
                t = _frame_time(f, None)
                if t is None:
                    continue
                f.pts = int(round(t / _OUT_TB))
                f.time_base = _OUT_TB
                for pkt in out_v.encode(f):
                    outp.mux(pkt)
                n_out += 1
                if progress is not None and n_out % 30 == 0:
                    progress(min(n_out, total_est), total_est, "transition")

        while not (a_done and b_done):
            if not a_done:
                try:
                    fa = next(dec_a)
                    ft = _frame_time(fa, va.time_base)
                    if ft is not None:
                        fed_a_t = ft
                    buf_a.push(fa)
                except StopIteration:
                    buf_a.push(None)
                    a_done = True
            while not b_done:
                if next_b is None:
                    try:
                        next_b = next(dec_b)
                    except StopIteration:
                        buf_b.push(None)
                        b_done = True
                        break
                t_b = _frame_time(next_b, vb.time_base)
                if t_b is None:
                    t_b = 0.0
                if a_done or (t_b + offset <= fed_a_t + 0.5):
                    buf_b.push(next_b)
                    next_b = None
                else:
                    break
            _emit()

        _emit()
        for pkt in out_v.encode():
            outp.mux(pkt)

        if out_a is not None:
            arr_a = _decode_audio_to_array(src_a)
            arr_b = _decode_audio_to_array(src_b)

            def _fit(arr, seconds):
                target = int(round(seconds * _AUDIO_RATE))
                if arr.shape[1] >= target:
                    return arr[:, :target]
                pad = np.zeros((2, target - arr.shape[1]), dtype=np.float32)
                return np.concatenate([arr, pad], axis=1)

            arr_a = _fit(arr_a, offset + duration)
            arr_b = _fit(arr_b, dur_b)
            n_x = int(round(duration * _AUDIO_RATE))
            n_x = min(n_x, arr_a.shape[1], arr_b.shape[1])
            head = arr_a[:, :arr_a.shape[1] - n_x]
            ramp_out = arr_a[:, arr_a.shape[1] - n_x:] * np.linspace(1.0, 0.0, n_x, dtype=np.float32)
            ramp_in = arr_b[:, :n_x] * np.linspace(0.0, 1.0, n_x, dtype=np.float32)
            mixed = np.clip(ramp_out + ramp_in, -1.0, 1.0)
            full = np.concatenate([head, mixed, arr_b[:, n_x:]], axis=1)
            _encode_audio_array(outp, out_a, full.astype(np.float32, copy=False))

    return path_to_view_url(out)


def scene_detect(view_url: str, threshold: float = 0.4,
                 min_gap_s: float = 1.0, max_scenes: int = 48,
                 progress=None) -> list:
    import av

    require_filters('select', 'scale')
    threshold = min(max(float(threshold or 0.4), 0.01), 1.0)
    src_path = localize(view_url)
    info = get_video_info(view_url)
    total_est = max(1, int(info['duration'] * info['fps']))

    cuts: list = []
    with av.open(str(src_path)) as inp:
        in_v = inp.streams.video[0]
        graph = av.filter.Graph()
        buf = graph.add_buffer(template=in_v)
        sel = graph.add('select', f'gt(scene,{threshold})')
        sink = graph.add('buffersink')
        buf.link_to(sel)
        sel.link_to(sink)
        graph.configure()

        n = 0
        last = -1e9
        for frame in inp.decode(in_v):
            buf.push(frame)
            n += 1
            if progress is not None and n % 60 == 0:
                progress(min(n, total_est), total_est, "scanning")
            for f in _drain(sink):
                t = _frame_time(f, in_v.time_base)
                if t is not None and t - last >= max(0.0, float(min_gap_s or 0.0)):
                    cuts.append(round(t, 3))
                    last = t
        buf.push(None)
        for f in _drain(sink):
            t = _frame_time(f, in_v.time_base)
            if t is not None and t - last >= max(0.0, float(min_gap_s or 0.0)):
                cuts.append(round(t, 3))
                last = t

    if len(cuts) > max_scenes:
        cuts = cuts[:max_scenes]
    return cuts


def filter_frame_image(view_url: str, position, video_specs) -> str:
    import av

    from .media import _resolve_position

    video_specs = list(video_specs or [])
    require_filters(*[n for n, _ in video_specs])
    src_path = localize(view_url)
    info = get_video_info(view_url)
    target_s = _resolve_position(position, info['duration'])
    out_path = fresh_output_path('.png', subfolder='comfytv-frames')

    with av.open(str(src_path)) as c:
        in_v = c.streams.video[0]
        if in_v.time_base:
            try:
                c.seek(int(target_s / float(in_v.time_base)),
                       stream=in_v, any_frame=False, backward=True)
            except Exception:
                pass
        picked = None
        for frame in c.decode(in_v):
            picked = frame
            if frame.pts is not None and in_v.time_base and \
                    frame.pts * float(in_v.time_base) >= target_s:
                break
        if picked is None:
            raise RuntimeError(f"no decodable frame at {position!r}")

        graph = av.filter.Graph()
        buf = graph.add_buffer(template=in_v)
        prev = buf
        for name, args in video_specs:
            f = graph.add(name, args) if args else graph.add(name)
            prev.link_to(f)
            prev = f
        fmt = graph.add('format', 'rgb24')
        prev.link_to(fmt)
        sink = graph.add('buffersink')
        fmt.link_to(sink)
        graph.configure()

        buf.push(picked)
        buf.push(None)
        outs = _drain(sink)
        if not outs:
            raise RuntimeError("scope filter produced no output frame")
        outs[0].to_image().save(str(out_path), 'PNG')

    return path_to_view_url(out_path)


AFADE_CURVES = [
    'tri', 'qsin', 'hsin', 'esin', 'log', 'ipar', 'qua', 'cub', 'squ', 'cbr',
    'par', 'exp', 'iqsin', 'ihsin', 'dese', 'desi', 'losi', 'sinc', 'isinc',
    'nofade',
]


def crossfade_audios(url_a: str, url_b: str, duration: float = 1.0,
                     curve1: str = 'tri', curve2: str = 'tri',
                     overlap: bool = True, out_codec: str = 'wav') -> str:
    import av

    require_filters('acrossfade', 'aformat')
    if curve1 not in AFADE_CURVES:
        raise RuntimeError(f"acrossfade: unknown curve {curve1!r}")
    if curve2 not in AFADE_CURVES:
        raise RuntimeError(f"acrossfade: unknown curve {curve2!r}")
    duration = min(max(float(duration or 1.0), 0.01), 60.0)

    src_a = localize(url_a)
    src_b = localize(url_b)
    if out_codec == 'mp3':
        out = fresh_output_path('.mp3', subfolder='comfytv-audio')
        codec, container = 'libmp3lame', 'mp3'
    else:
        out = fresh_output_path('.wav', subfolder='comfytv-audio')
        codec, container = 'pcm_s16le', 'wav'

    with av.open(str(src_a)) as ca, av.open(str(src_b)) as cb, \
            av.open(str(out), 'w', format=container) as outp:
        if not ca.streams.audio:
            raise RuntimeError("acrossfade: input A has no audio stream")
        if not cb.streams.audio:
            raise RuntimeError("acrossfade: input B has no audio stream")
        in_a = ca.streams.audio[0]
        in_b = cb.streams.audio[0]

        graph = av.filter.Graph()
        buf_a = graph.add_abuffer(template=in_a)
        buf_b = graph.add_abuffer(template=in_b)
        xf = graph.add('acrossfade',
                       f'd={duration}:c1={curve1}:c2={curve2}'
                       f':o={1 if overlap else 0}')
        buf_a.link_to(xf, 0, 0)
        buf_b.link_to(xf, 0, 1)
        fmt = graph.add(
            'aformat',
            f'sample_fmts=fltp:sample_rates={_AUDIO_RATE}:channel_layouts=stereo')
        xf.link_to(fmt)
        sink = graph.add('abuffersink')
        fmt.link_to(sink)
        graph.configure()

        out_a = outp.add_stream(codec, rate=_AUDIO_RATE)
        out_a.layout = 'stereo'
        pts = 0

        def _write(frame):
            nonlocal pts
            frame.pts = pts
            frame.time_base = Fraction(1, _AUDIO_RATE)
            pts += frame.samples
            for pkt in out_a.encode(frame):
                outp.mux(pkt)

        for frame in ca.decode(in_a):
            buf_a.push(frame)
            for f in _drain(sink):
                _write(f)
        buf_a.push(None)
        for frame in cb.decode(in_b):
            buf_b.push(frame)
            for f in _drain(sink):
                _write(f)
        buf_b.push(None)
        for f in _drain(sink):
            _write(f)
        for pkt in out_a.encode():
            outp.mux(pkt)

    return path_to_view_url(out)


def analyze_audio(view_url: str, audio_specs) -> list:
    import gc

    import av
    import av.logging

    audio_specs = list(audio_specs or [])
    require_filters(*[n for n, _ in audio_specs])
    src_path = localize(view_url)

    prev_level = av.logging.get_level()
    av.logging.set_level(av.logging.INFO)
    try:
        with av.logging.Capture(local=True) as logs:
            with av.open(str(src_path)) as inp:
                if not inp.streams.audio:
                    raise RuntimeError(
                        "analyze_audio: source has no audio stream")
                in_a = inp.streams.audio[0]
                graph = av.filter.Graph()
                asrc, asink = _build_audio_graph(graph, in_a, audio_specs)
                graph.configure()
                for frame in inp.decode(in_a):
                    asrc.push(frame)
                    _drain(asink)
                asrc.push(None)
                _drain(asink)
            del graph, asrc, asink
            gc.collect()
    finally:
        av.logging.set_level(prev_level)

    return [msg for _level, _name, msg in logs if msg]


def audio_image(view_url: str, filter_name: str, args=None) -> str:
    import av

    require_filters(filter_name, 'format')
    src_path = localize(view_url)
    out = fresh_output_path('.png', subfolder='comfytv-audio')

    with av.open(str(src_path)) as inp:
        if not inp.streams.audio:
            raise RuntimeError("audio_image: source has no audio stream")
        in_a = inp.streams.audio[0]

        graph = av.filter.Graph()
        asrc = graph.add_abuffer(template=in_a)
        f = graph.add(filter_name, args) if args else graph.add(filter_name)
        asrc.link_to(f)
        fmt = graph.add('format', 'rgb24')
        f.link_to(fmt)
        sink = graph.add('buffersink')
        fmt.link_to(sink)
        graph.configure()

        for frame in inp.decode(in_a):
            asrc.push(frame)
        asrc.push(None)
        outs = _drain(sink)
        if not outs:
            raise RuntimeError(f"audio_image: {filter_name} produced no frame")
        outs[-1].to_image().save(str(out), 'PNG')

    return path_to_view_url(out)


__all__ = [
    'available_filters', 'has_filter', 'require_filters', 'has_encoder',
    'filter_video', 'filter_audio', 'chroma_key_video',
    'process_audio_array', 'atempo_specs',
    'xfade_videos', 'XFADE_TRANSITIONS',
    'scene_detect', 'filter_frame_image',
    'crossfade_audios', 'analyze_audio', 'audio_image', 'AFADE_CURVES',
]
