import asyncio
import threading


class _RenderWorker:
    def __init__(self):
        self._loop = None
        self._browser = None
        self._pw = None
        self._err = None
        self._ready = threading.Event()
        self._thread = threading.Thread(
            target=self._run, name="ComfyTVPosterRender", daemon=True
        )
        self._thread.start()
        self._ready.wait()

    def _run(self):
        try:
            self._loop = asyncio.new_event_loop()
            asyncio.set_event_loop(self._loop)
            self._loop.run_until_complete(self._startup())
        except Exception as exc:
            self._err = exc
            self._ready.set()
            return
        self._ready.set()
        self._loop.run_forever()

    async def _startup(self):
        from playwright.async_api import async_playwright

        self._pw = await async_playwright().start()
        self._browser = await self._pw.chromium.launch(
            args=["--no-sandbox", "--disable-dev-shm-usage"]
        )

    @staticmethod
    async def _copyfit(page):
        try:
            await page.evaluate("() => { if (window.__pmFit) window.__pmFit(); }")
        except Exception:
            pass

    async def _render(self, html, width, height, scale):
        ctx = await self._browser.new_context(
            viewport={"width": width, "height": height},
            device_scale_factor=scale,
        )
        page = await ctx.new_page()
        try:
            await page.set_content(html, wait_until="load")
            try:
                await page.evaluate(
                    "async () => { if (document.fonts && document.fonts.ready) "
                    "{ await document.fonts.ready; } }"
                )
            except Exception:
                pass
            await self._copyfit(page)
            return await page.screenshot(
                type="png",
                clip={"x": 0, "y": 0, "width": width, "height": height},
            )
        finally:
            await ctx.close()

    def _guard(self):
        if self._err is not None:
            raise RuntimeError(
                "ComfyTV Poster: Playwright/Chromium is not available "
                f"({self._err!r}). Install it in the ComfyUI env with:\n"
                "    python -m pip install playwright\n"
                "    python -m playwright install chromium"
            )

    def render(self, html, width, height, scale=1):
        self._guard()
        fut = asyncio.run_coroutine_threadsafe(
            self._render(html, int(width), int(height), int(scale)), self._loop
        )
        return fut.result(timeout=120)


_worker = None
_lock = threading.Lock()


def get_worker():
    global _worker
    with _lock:
        if _worker is None:
            _worker = _RenderWorker()
    return _worker
