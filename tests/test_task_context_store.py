import asyncio
import json
import pytest
from ComfyTV.api.task_context_store import ContextStore, MiB


def test_store_global_byte_record_bounds(tmp_path):
    store = ContextStore(tmp_path / 'cache')
    refs = [store.commit(store.reserve(str(i), b'x' * (MiB - 65536))) for i in range(32)]
    with pytest.raises(ValueError, match='capacity'): store.reserve('new', b'{}')
    assert store.read(refs[0]) == b'x' * (MiB - 65536)
    assert store.db.execute('PRAGMA max_page_count').fetchone()[0] * store.db.execute('PRAGMA page_size').fetchone()[0] <= 32 * MiB
    assert not (tmp_path / 'cache').exists()
    store.close()


async def test_periodic_cleanup_and_fresh_instance_unavailable(tmp_path):
    now = [0.0]
    root = tmp_path / 'cache'
    first = ContextStore(root, clock=lambda: now[0])
    ref = first.commit(first.reserve('c', b'{}'))
    reopened = ContextStore(root, clock=lambda: now[0])
    with pytest.raises(ValueError, match='unavailable'): reopened.dispatch(ref)
    first.start_cleanup(interval=.01)
    now[0] = 10801
    await asyncio.sleep(.04)
    assert first.db.execute('SELECT count(*) FROM contexts').fetchone()[0] == 0
    reopened.close()
    first.close()


async def test_startup_lifecycle_initializes_and_closes_store(tmp_path, monkeypatch):
    from ComfyTV.api import task_context_store as mod
    import folder_paths
    monkeypatch.setattr(mod, '_STORE', None)
    monkeypatch.setattr(folder_paths, 'get_user_directory', lambda: str(tmp_path))
    lifecycle = mod.cache_lifecycle(None)
    await anext(lifecycle)
    assert mod._STORE is not None and mod._STORE._sweep is not None
    with pytest.raises(StopAsyncIteration): await anext(lifecycle)
    assert mod._STORE is None


def test_windows_reparse_components_rejected(tmp_path, monkeypatch):
    from pathlib import Path
    from types import SimpleNamespace
    from ComfyTV.api.task_context_store import safe_path
    real = Path.lstat
    def stat(path):
        st = real(path)
        return SimpleNamespace(st_mode=st.st_mode, st_file_attributes=0x400) if path == tmp_path else st
    monkeypatch.setattr(Path, 'lstat', stat)
    with pytest.raises(ValueError, match='reparse'): safe_path(tmp_path / 'cache')


@pytest.mark.parametrize('method', ['commit', 'bind'])
@pytest.mark.parametrize('kind', ['records', 'bytes', 'pending', 'invalid'])
def test_owner_reassignment_preserves_atomic_quota(tmp_path, method, kind):
    store = ContextStore(tmp_path / 'cache')
    if kind in ('records', 'pending'):
        for _ in range(3 if kind == 'pending' else 4):
            store.commit(store.reserve('target', b'{}'))
        if kind == 'pending':
            store.reserve('target', b'{}')
    elif kind == 'bytes':
        for _ in range(2):
            store.commit(store.reserve('target', b'x' * (4 * MiB)))
    token = store.reserve('source', b'{}')
    ref = store.commit(token) if method == 'bind' else None
    owner = '' if kind == 'invalid' else 'target'
    with pytest.raises(ValueError, match='owner|capacity'):
        if method == 'commit':
            store.commit(token, chat=owner)
        else:
            store.bind(token, owner, 'message', json.dumps({'context_ref': ref}))
    if method == 'commit':
        assert store.reservations[token][0] == 'source'
        assert store.db.execute('SELECT count(*) FROM contexts WHERE id=?', (token,)).fetchone()[0] == 0
    else:
        assert store.db.execute('SELECT chat FROM contexts WHERE id=?', (token,)).fetchone()[0] == 'source'
        assert store.db.execute('SELECT count(*) FROM submissions').fetchone()[0] == 0
    store.close()
