

import hashlib
import json
import logging

from .base import Runner, RunnerContext

_log = logging.getLogger(__name__)

_SAMPLE_CLIPS = [
    'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
    'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4',
    'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4',
]


class FakeMultishotRunner(Runner):

    async def invoke(self, ctx: RunnerContext):
        if ctx.kind != 'timeline':
            raise NotImplementedError(
                f"{self.id} doesn't handle kind={ctx.kind!r}"
            )

        raw = ctx.upstream.get('timeline') or ''
        try:
            tl = json.loads(raw) if isinstance(raw, str) else (raw or {})
        except (json.JSONDecodeError, TypeError):
            tl = {}
        segments = tl.get('segments') or []
        frame_rate = int(tl.get('frameRate') or 24)
        duration_frames = tl.get('durationFrames')
        total = max(1, len(segments))

        _log.info(
            "[ComfyTV/multishot] FAKE render  shots=%d  fps=%d  frames=%s",
            len(segments), frame_rate, duration_frames,
        )

        for i, seg in enumerate(segments):
            prompt = (seg.get('prompt') or '').strip()
            if ctx.progress:
                ctx.progress(i, total, f"shot {i + 1}/{total}: {prompt[:40]}")
        if ctx.progress:
            ctx.progress(total, total, "stitching shots")

        blob = raw.encode('utf-8', 'replace') if isinstance(raw, str) else b''
        idx = int(hashlib.md5(blob).hexdigest(), 16) % len(_SAMPLE_CLIPS)
        return _SAMPLE_CLIPS[idx]
