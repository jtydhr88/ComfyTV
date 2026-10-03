"""Volatile snapshots must never interpret the legacy root as a filesystem path."""
import builtins
import os
from pathlib import Path
from unittest.mock import patch

import json
import pytest

from ComfyTV.api import task_context_store as mod


@pytest.mark.parametrize('label', [None, {'nodes': []}, ':memory:', 'file:danger?mode=rwc'])
def test_root_is_an_inert_label(label):
    class Hostile:
        def __fspath__(self):
            raise AssertionError('root inspected')
        def __str__(self):
            raise AssertionError('root converted')
    for root in (label, Hostile()):
        store = mod.ContextStore(root)
        assert store.db.execute('PRAGMA database_list').fetchall() == [(0, 'main', '')]
        assert store.db.execute('PRAGMA temp_store').fetchone() == (2,)
        assert store.db.execute('PRAGMA journal_mode').fetchone() == ('memory',)
        store.close()


@pytest.mark.parametrize('attack', ['parent', 'hardlink'])
def test_connect_boundary_swap_cannot_redirect_io(tmp_path, monkeypatch, attack):
    root = tmp_path / 'cache'
    root.mkdir()
    outside = tmp_path / 'outside'
    outside.mkdir()
    original = outside / 'contexts.sqlite3'
    original.write_bytes(b'original SQLite sentinel')
    before = original.stat()
    connect = mod.sqlite3.connect
    calls = []
    def swap(target, *args, **kwargs):
        calls.append(target)
        if attack == 'parent':
            root.rename(tmp_path / 'moved')
            root.symlink_to(outside, target_is_directory=True)
        else:
            os.link(original, root / 'contexts.sqlite3')
        assert target == ':memory:'
        return connect(target, *args, **kwargs)
    monkeypatch.setattr(mod.sqlite3, 'connect', swap)
    store = mod.ContextStore(root)
    assert store.read(store.commit(store.reserve('chat', b'{}'))) == b'{}'
    store.close()
    after = original.stat()
    # Link count/parent directory timestamps may change due to the attacker itself.
    assert (before.st_size, before.st_mtime_ns, before.st_mode, before.st_ino) == (after.st_size, after.st_mtime_ns, after.st_mode, after.st_ino)
    assert original.read_bytes() == b'original SQLite sentinel'
    assert sorted(p.name for p in outside.iterdir()) == ['contexts.sqlite3']
    assert calls == [':memory:']


def test_oversized_cache_and_sidecars_ignored_unchanged(tmp_path):
    root = tmp_path / 'hostile'
    root.mkdir()
    path = root / 'contexts.sqlite3'
    with path.open('wb') as stream:
        stream.truncate(40 * mod.MiB)
    for name in ('contexts.sqlite3-wal', 'contexts.sqlite3-journal', 'unexpected'):
        (root / name).write_bytes(b'unchanged')
    before = {p.name: (p.read_bytes(), p.stat()) for p in root.iterdir()}
    store = mod.ContextStore(root)
    token = store.reserve('chat', b'{}')
    assert store.read(store.commit(token)) == b'{}'
    store.close()
    assert set(before) == {p.name for p in root.iterdir()}
    for p in root.iterdir():
        raw, st = before[p.name]
        assert p.read_bytes() == raw
        now = p.stat()
        assert (now.st_size, now.st_mtime_ns, now.st_mode, now.st_ino) == (st.st_size, st.st_mtime_ns, st.st_mode, st.st_ino)


def test_fresh_instance_has_no_tokens_submissions_or_dispatch(tmp_path):
    first = mod.ContextStore(tmp_path)
    ref = first.commit(first.reserve('chat', b'{}'))
    first.bind(ref['id'], 'chat', 'message', json.dumps({'context_ref': ref}))
    first.dispatch(ref)
    second = mod.ContextStore(tmp_path)
    for action in (lambda: second.read(ref), lambda: second.dispatch(ref), lambda: second.submission('message')):
        with pytest.raises(ValueError, match='unavailable'):
            action()
    assert second.stats() == {'records': 0, 'bytes': 0, 'reservations': 0}
    assert first.read(ref) == b'{}'
    first.close()
    second.close()


def test_production_factory_does_not_resolve_folder_paths(monkeypatch):
    import folder_paths
    def forbidden():
        raise AssertionError('production factory resolved a cache directory')
    monkeypatch.setattr(folder_paths, 'get_user_directory', forbidden)
    monkeypatch.setattr(mod, '_STORE', None)
    store = mod.get_store()
    assert store.stats()['records'] == 0
    store.close()
    monkeypatch.setattr(mod, '_STORE', None)


def test_quota_boundary_churn_and_expiry():
    now = [0.0]
    store = mod.ContextStore(clock=lambda: now[0])
    for cycle in range(3):
        refs = [store.commit(store.reserve(str(i), b'x' * (mod.MiB - 65536))) for i in range(32)]
        with pytest.raises(ValueError, match='capacity'): store.reserve('overflow', b'x')
        for ref in refs:
            assert store.read(ref) == b'x' * (mod.MiB - 65536)
            store.release(ref['id'])
        assert store.stats()['records'] == 0
        assert store.db.execute('PRAGMA page_count').fetchone()[0] <= 8192
    refs = [store.commit(store.reserve('same', b'x' * (4 * mod.MiB))) for _ in range(2)]
    with pytest.raises(ValueError, match='capacity'): store.reserve('same', b'x')
    for ref in refs: store.release(ref['id'])
    pending = [store.reserve(str(i), b'{}') for i in range(4)]
    with pytest.raises(ValueError, match='capacity'): store.reserve('fifth', b'{}')
    now[0] = 1800
    assert store.stats()['reservations'] == 0
    ref = store.commit(store.reserve('active', b'{}'))
    store.dispatch(ref)
    now[0] += 3600
    assert store.read(ref) == b'{}'
    now[0] = ref['expires_at']
    with pytest.raises(ValueError, match='unavailable'): store.read(ref)
    store.close()


def test_store_lifecycle_never_touches_filesystem(tmp_path):
    root = tmp_path / 'hostile'
    root.mkdir()
    original = tmp_path / 'original'
    original.write_bytes(b'original sentinel')
    os.link(original, root / 'contexts.sqlite3')
    before = original.stat()
    calls = []
    connect = mod.sqlite3.connect

    def guarded(target, *args, **kwargs):
        calls.append(target)
        assert target == ':memory:', 'SQLite must never receive a filename'
        return connect(target, *args, **kwargs)

    def forbidden(*args, **kwargs):
        raise AssertionError('store performed filesystem I/O')

    # Real SQLite and full lifecycle; mocks guard only the prohibited boundary.
    from contextlib import ExitStack
    with ExitStack() as stack:
        stack.enter_context(patch.object(mod.sqlite3, 'connect', guarded))
        for obj, names in [(Path, ['lstat', 'stat', 'mkdir', 'iterdir', 'open', 'unlink', 'chmod']),
                           (os, ['open', 'chmod', 'stat', 'lstat', 'listdir', 'scandir', 'remove', 'unlink', 'mkdir']),
                           (builtins, ['open'])]:
            for name in names:
                stack.enter_context(patch.object(obj, name, forbidden))
        store = mod.ContextStore(root)
        ref = store.commit(store.reserve('chat', b'{}'))
        store.bind(ref['id'], 'chat', 'message', '{"context_ref":{"id":"' + ref['id'] + '"}}')
        assert store.read(ref) == b'{}'
        store.dispatch(ref)
        store.cleanup()
        store.release_chat('chat')
        store.close()
    after = original.stat()
    assert (before.st_size, before.st_mtime_ns, before.st_mode, before.st_ino, before.st_nlink) == (after.st_size, after.st_mtime_ns, after.st_mode, after.st_ino, after.st_nlink)
    assert original.read_bytes() == b'original sentinel'
    assert calls == [':memory:']
