import json
import asyncio
import concurrent.futures
import threading
import pytest


async def test_async_read_admission_precedes_executor_queue_and_survives_cancellation(monkeypatch):
    from ComfyTV.api.mcp_tools import task_context as mod
    executor = concurrent.futures.ThreadPoolExecutor(max_workers=1)
    loop = asyncio.get_running_loop()
    old_executor = loop._default_executor
    loop.set_default_executor(executor)
    entered, release = threading.Event(), threading.Event()
    blocker = loop.run_in_executor(None, lambda: (entered.set(), release.wait(5)))
    tasks = []
    class Store:
        def reference(self, *args):
            return {'size_bytes': 2, 'expires_at': 10}
        def read(self, ref):
            return b'{}'
    monkeypatch.setattr(mod, 'get_store', Store)
    args = {'token': 'x' * 43, 'revision': 'sha256:' + '0' * 64}
    try:
        while not entered.is_set():
            await asyncio.sleep(.001)
        tasks = [asyncio.create_task(mod._read(args)) for _ in range(50)]
        await asyncio.sleep(.03)
        assert executor._work_queue.qsize() == 2
        rejected = [task for task in tasks if task.done()]
        assert len(rejected) == 48
        assert all(str(task.exception()) == 'context_read_busy' for task in rejected)
        accepted = [task for task in tasks if not task.done()]
        for task in accepted:
            task.cancel()
        await asyncio.gather(*accepted, return_exceptions=True)
        # Cancelling a waiter must not make its queued/running worker's slot free.
        with pytest.raises(ValueError, match='context_read_busy'):
            await mod._read(args)
        release.set()
        await blocker
        # A FIFO fence proves the accepted workers have completed.
        await loop.run_in_executor(None, lambda: None)
        assert (await mod._read(args))['complete']
    finally:
        release.set()
        await asyncio.gather(*tasks, return_exceptions=True)
        await blocker
        executor.shutdown(wait=True)
        loop._default_executor = old_executor



@pytest.mark.parametrize('failure', ['store', 'worker', 'submission'])
async def test_async_admission_releases_on_failures(monkeypatch, failure):
    from ComfyTV.api.mcp_tools import task_context as mod
    args = {'token': 'x' * 43, 'revision': 'sha256:' + '0' * 64}
    def failed(*args):
        raise RuntimeError('fixture failure')
    class Store:
        reference = failed
    monkeypatch.setattr(mod, 'get_store', failed if failure == 'store' else Store)
    if failure == 'submission':
        async def failed_thread(*args):
            raise RuntimeError('fixture failure')
        monkeypatch.setattr(mod.asyncio, 'to_thread', failed_thread)
    for _ in range(3):
        with pytest.raises(RuntimeError, match='fixture failure'):
            await mod._read(args)
    assert mod._READS.acquire(blocking=False)
    assert mod._READS.acquire(blocking=False)
    assert not mod._READS.acquire(blocking=False)
    mod._READS.release()
    mod._READS.release()


def test_large_unicode_value_pagination_reconstructs_exactly(tmp_path):
    from ComfyTV.api.task_context_store import ContextStore
    from ComfyTV.api.task_context import canonical
    from ComfyTV.api.mcp_tools.task_context import read_context
    store = ContextStore(tmp_path / 'cache')
    value = '中😀\\\"\n' * 20000
    ref = store.commit(store.reserve('c', canonical({'target': {'content': {'nodes': [{'id': 0, 'widgets_values': [value]}]}}})))
    args = {'token': ref['id'], 'revision': ref['revision'], 'operation': 'value', 'selector': '/target/content/nodes/0/widgets_values/0'}
    reply = read_context(store, args)
    assert reply['requires_pagination']
    chunks = []
    while True:
        reply = read_context(store, {**args, 'operation': 'page', 'cursor': reply['next_cursor']})
        assert len(json.dumps(reply).encode()) <= 16384
        chunks.append(reply['chunk'])
        if reply['complete']: break
    assert json.loads(''.join(chunks)) == value
    with pytest.raises(ValueError): read_context(store, {**args, 'revision': 'sha256:bad'})
    with pytest.raises(ValueError): read_context(store, {**args, 'operation': 'page', 'cursor': 'forged'})
    node = read_context(store, {**args, 'operation': 'node', 'selector': '0'})
    assert node['requires_pagination']


def test_selector_overhead_cannot_exceed_tool_budget(tmp_path):
    from ComfyTV.api.task_context_store import ContextStore
    from ComfyTV.api.task_context import canonical
    from ComfyTV.api.mcp_tools.task_context import read_context
    store = ContextStore(tmp_path / 'cache')
    key = '😀' * 1800
    ref = store.commit(store.reserve('c', canonical({key: 'x' * 20000})))
    args = {'token': ref['id'], 'revision': ref['revision'], 'operation': 'value', 'selector': '/' + key}
    try:
        reply = read_context(store, args)
    except ValueError:
        return  # Explicit bounded-selector rejection, whole document still pageable.
    assert len(json.dumps(reply).encode()) <= 16384
