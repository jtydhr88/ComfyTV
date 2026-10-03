"""Isolated, time-limited PyAV worker. Bytes in / bounded JSON out; no files."""
import io
import json
import math
import sys

import av

MAX_SOURCE = 64 * 1024 * 1024
MAX_DURATION = 300
MAX_PIXELS = 4096 * 4096


def probe(data, kind):
    container = av.open(io.BytesIO(data), options={'protocol_whitelist': 'pipe'})
    videos = container.streams.video
    audios = container.streams.audio
    if (kind == 'video' and not videos) or (kind == 'audio' and (not audios or videos)):
        raise ValueError('type mismatch')
    stream = videos[0] if kind == 'video' else audios[0]
    stream.thread_count = 1
    duration = float(stream.duration * stream.time_base) if stream.duration is not None else float(container.duration / av.time_base) if container.duration else 0
    if not math.isfinite(duration) or not 0 < duration <= MAX_DURATION:
        raise ValueError('duration limit')
    meta = {'duration_seconds': round(duration, 6), 'codec': stream.codec_context.name}
    if kind == 'video':
        w, h = stream.width, stream.height
        if not w or not h or w > 4096 or h > 4096 or w * h > MAX_PIXELS:
            raise ValueError('dimensions limit')
        fps = float(stream.average_rate or 0)
        if not math.isfinite(fps) or not 0 < fps <= 120:
            raise ValueError('fps limit')
        meta.update(width=w, height=h, fps=round(fps, 6), has_audio=bool(audios))
    else:
        rate, channels = stream.rate, stream.codec_context.channels
        if not 0 < rate <= 192000 or not 0 < channels <= 8:
            raise ValueError('audio limits')
        meta.update(sample_rate=rate, channels=channels)
    # Container facts alone are not enough to accept a corrupt or mislabeled file.
    frame = next(container.decode(stream))
    if kind == 'video' and (frame.width != meta['width'] or frame.height != meta['height']):
        raise ValueError('changing dimensions')
    return container, stream, meta


def jpeg(image):
    import base64
    image.thumbnail((1200, 1200))
    for quality in (80, 65, 45, 25):
        out = io.BytesIO()
        image.convert('RGB').save(out, format='JPEG', quality=quality)
        if out.tell() <= 1024 * 1024:
            return {'data': base64.b64encode(out.getvalue()).decode('ascii'), 'mimeType': 'image/jpeg'}
    raise ValueError('preview limit')


def video_preview(container, stream, meta, options):
    from PIL import Image
    duration = meta['duration_seconds']
    if options['mode'] == 'frame':
        targets = [options.get('time_seconds', duration / 2)]
        if not 0 <= targets[0] < duration:
            raise ValueError('time outside duration')
    else:
        count = options.get('frames', 4)
        targets = [duration * (i + .5) / count for i in range(count)]
    images, times = [], []
    for target in targets:
        container.seek(int(target / stream.time_base), stream=stream, backward=True)
        for index, frame in enumerate(container.decode(stream)):
            if index >= 300 or frame.width != meta['width'] or frame.height != meta['height']:
                raise ValueError('frame decode work/dimensions limit')
            when = float(frame.time) if frame.time is not None else None
            if when is not None and when >= target:
                image = frame.to_image()
                image.thumbnail((1200, 1200) if len(targets) == 1 else (300, 300))
                images.append(image)
                times.append(round(when, 6))
                break
        else:
            raise ValueError('frame unavailable')
    if len(images) == 1:
        composite = images[0]
    else:
        width, height = max(i.width for i in images), max(i.height for i in images)
        composite = Image.new('RGB', (width * len(images), height), 'black')
        for i, image in enumerate(images):
            composite.paste(image, (i * width, 0))
    return {'sample_times_seconds': times, 'perception': 'sampled_frames_not_analyzed',
            '_images': [jpeg(composite)]}


def waveform_preview(data, duration):
    import numpy as np
    from PIL import Image, ImageDraw
    # Incremental 8 kHz mono envelope; at most 2.4M samples / 300 seconds.
    peaks = np.zeros(800, dtype=np.float64)
    samples, squares, peak = 0, 0., 0.
    with av.open(io.BytesIO(data), options={'protocol_whitelist': 'pipe'}) as container:
        stream = container.streams.audio[0]
        stream.thread_count = 1
        resampler = av.AudioResampler(format='fltp', layout='mono', rate=8000)
        frames = 0
        def consume(frame):
            nonlocal samples, squares, peak
            array = frame.to_ndarray().reshape(-1)
            if len(array) > 65536 or samples + len(array) > 8000 * MAX_DURATION + 8000:
                raise ValueError('sample work limit')
            if not np.isfinite(array).all():
                raise ValueError('nonfinite samples')
            absolute = np.abs(array)
            bins = np.minimum(799, ((np.arange(len(array)) + samples) * 800 / (duration * 8000)).astype(int))
            np.maximum.at(peaks, bins, absolute)
            squares += float(np.dot(array, array))
            peak = max(peak, float(absolute.max(initial=0)))
            samples += len(array)
        for frame in container.decode(stream):
            frames += 1
            if frames > 30000 or frame.samples > 65536:
                raise ValueError('audio frame work limit')
            for converted in resampler.resample(frame):
                consume(converted)
        for converted in resampler.resample(None):
            consume(converted)
    if not samples or abs(samples / 8000 - duration) > max(.5, duration * .01):
        raise ValueError('duration mismatch')
    image = Image.new('RGB', (800, 200), '#101820')
    draw = ImageDraw.Draw(image)
    draw.line((0, 100, 799, 100), fill='#687080')
    for x, amplitude in enumerate(peaks):
        height = min(95, int(amplitude * 95))
        draw.line((x, 100 - height, x, 100 + height), fill='#51c5b6')
    return {'perception': 'waveform_only_not_listened', 'inspected_duration_seconds': round(samples / 8000, 6),
            'waveform_peak': round(peak, 6), 'waveform_rms': round(math.sqrt(squares / samples), 6),
            '_images': [jpeg(image)]}


def main():
    options = json.loads(sys.argv[1])
    data = sys.stdin.buffer.read(MAX_SOURCE + 1)
    if not data or len(data) > MAX_SOURCE:
        raise ValueError('source limit')
    container, stream, meta = probe(data, options['kind'])
    if options.get('mode', 'metadata') in {'frame', 'timeline'}:
        meta.update(video_preview(container, stream, meta, options))
    if options.get('mode') == 'waveform':
        meta.update(waveform_preview(data, meta['duration_seconds']))
    container.close()
    print(json.dumps(meta, allow_nan=False))


if __name__ == '__main__':
    main()
