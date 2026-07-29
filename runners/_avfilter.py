from fractions import Fraction
from typing import Optional

from ._audio_io import _AUDIO_RATE


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


def tag_bt709(codec_context):
    codec_context.colorspace = 1
    codec_context.color_primaries = 1
    codec_context.color_trc = 1


def copy_color_tags(src_cc, dst_cc):
    for attr, unspecified in (('colorspace', 2), ('color_primaries', 2),
                              ('color_trc', 2), ('color_range', 0)):
        val = getattr(src_cc, attr, None)
        if val is not None and val != unspecified:
            setattr(dst_cc, attr, val)


_CS_FILTER_NAMES = {1: 'bt709', 5: 'bt470bg', 6: 'smpte170m',
                    7: 'smpte240m', 9: 'bt2020', 10: 'bt2020'}


_CS_FILTER_FORMATS = {'yuv420p', 'yuv420p10', 'yuv420p12',
                      'yuv422p', 'yuv422p10', 'yuv422p12',
                      'yuv444p', 'yuv444p10', 'yuv444p12'}


def _patch_colorspace_specs(specs, in_v):
    src_cs = getattr(getattr(in_v, 'codec_context', None), 'colorspace', None)
    iall = _CS_FILTER_NAMES.get(src_cs, 'bt709')
    out = []
    for name, args in specs:
        if name == 'colorspace' and 'iall=' not in (args or '') \
                and 'ispace=' not in (args or ''):
            args = f"iall={iall}:{args}" if args else f"iall={iall}"
        out.append((name, args))
    return out


def _build_video_graph(graph, in_v, specs, pix_fmt='yuv420p',
                       out_colorspace='bt709'):
    specs = list(specs)
    delivery = out_colorspace or 'bt709'
    if 'yuva' in pix_fmt:
        delivery = 'bt709'
    if delivery != 'bt709':
        base = pix_fmt[:-2] if pix_fmt.endswith('le') else pix_fmt
        if base not in _CS_FILTER_FORMATS:
            base = 'yuv420p'
        specs.append(('colorspace', f'all={delivery}:format={base}'))
    specs = _patch_colorspace_specs(specs, in_v)
    src = graph.add_buffer(template=in_v)
    prev = src
    for name, args in specs:
        f = graph.add(name, args) if args else graph.add(name)
        prev.link_to(f)
        prev = f
    if 'yuva' not in pix_fmt and delivery == 'bt709':
        mat = graph.add('scale', 'out_color_matrix=bt709')
        prev.link_to(mat)
        prev = mat
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


def make_progress(progress, total: int, label: str, min_interval: float = 0.3):
    if progress is None:
        return lambda value, text=None: None
    import time as _time
    state = {'last': 0.0, 'start': _time.monotonic()}

    def report(value, text=None):
        now = _time.monotonic()
        done = value >= total
        if not done and now - state['last'] < min_interval:
            return
        state['last'] = now
        v = min(value, total)
        parts = [text or label]
        if total > 0:
            parts.append(f"{int(v * 100 / total)}%")
        elapsed = now - state['start']
        if elapsed > 1.0 and 0 < v < total:
            rate = v / elapsed
            if rate > 0:
                eta = (total - v) / rate
                m, s = divmod(int(eta + 0.5), 60)
                parts.append(f"{rate:.1f} fps · {m}:{s:02d}")
        progress(v, total, ' · '.join(parts))

    return report


def _frame_time(frame, fallback_tb):
    tb = frame.time_base or fallback_tb
    if frame.pts is None or tb is None or abs(frame.pts) >= (1 << 61):
        return None
    return float(frame.pts * tb)


_COLOR_UNSPECIFIED = 2


_COLOR_BT709 = 1


def _tag_unspecified_color(frame):
    if frame.colorspace == _COLOR_UNSPECIFIED:
        frame.colorspace = _COLOR_BT709
    if frame.color_primaries == _COLOR_UNSPECIFIED:
        frame.color_primaries = _COLOR_BT709
    if frame.color_trc == _COLOR_UNSPECIFIED:
        frame.color_trc = _COLOR_BT709
    return frame


def _tag_from_frame(codec_context, frame):
    tagged = False
    for attr in ('colorspace', 'color_primaries', 'color_trc'):
        val = getattr(frame, attr, None)
        if val is not None and val != _COLOR_UNSPECIFIED:
            setattr(codec_context, attr, val)
            tagged = True
    if not tagged:
        tag_bt709(codec_context)


def has_encoder(name: str) -> bool:
    import av
    try:
        av.Codec(name, 'w')
        return True
    except Exception:
        return False
