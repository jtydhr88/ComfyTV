"""Bounded process-local immutable snapshots; capability tokens are private.

SQLite pages and logical admission are bounded, not total Python process RSS.
No snapshot filesystem I/O, migration, rehydration or automatic resubmission.
Restart loses all snapshots and private submission associations.
"""
import os
from pathlib import Path
import secrets
import sqlite3
import stat
import threading
import time

from .task_context import revision

MiB = 1024 * 1024


def safe_path(path):
    """Reject all symlinks and Windows junction/reparse components, including root."""
    path = Path(os.path.abspath(path))
    for part in (*reversed(path.parents), path):
        try:
            st = part.lstat()
        except FileNotFoundError:
            continue
        if stat.S_ISLNK(st.st_mode) or getattr(st, 'st_file_attributes', 0) & 0x400:
            raise ValueError('context unsafe reparse/symlink path')
        if stat.S_ISREG(st.st_mode) and st.st_nlink > 1:
            raise ValueError('context unsafe hardlink path')
    return path


class ContextStore:
    def __init__(self, root=None, *, clock=time.time):
        # root is an ignored legacy fixture label, never inspected or converted.
        # Each connection owns an independent volatile database, not shared memory.
        self.clock = clock
        self.lock = threading.RLock()
        self.reservations = {}
        self._sweep = None
        self.db = sqlite3.connect(':memory:', check_same_thread=False)
        self.db.execute('PRAGMA foreign_keys=ON')
        self.db.execute('PRAGMA temp_store=MEMORY')
        self.db.execute('PRAGMA journal_mode=MEMORY')
        self.db.execute('PRAGMA page_size=4096')
        if self.db.execute('PRAGMA page_size').fetchone()[0] != 4096:
            self.db.close()
            raise ValueError('context cache page size unsupported')
        if self.db.execute('PRAGMA max_page_count=8192').fetchone()[0] > 8192:
            self.db.close()
            raise ValueError('context cache exceeds page quota')
        self.db.execute('CREATE TABLE contexts (id TEXT PRIMARY KEY, chat TEXT NOT NULL, raw BLOB NOT NULL, revision TEXT NOT NULL, accepted REAL NOT NULL, expires REAL NOT NULL, dispatched INTEGER NOT NULL DEFAULT 0)')
        self.db.execute('CREATE TABLE submissions (message TEXT PRIMARY KEY, context TEXT NOT NULL UNIQUE REFERENCES contexts(id) ON DELETE CASCADE, task TEXT NOT NULL, digest TEXT NOT NULL)')
        self.db.commit()

    def start_cleanup(self, interval=60):
        import asyncio
        if self._sweep is None:
            loop = asyncio.get_running_loop()
            def sweep():
                self._sweep = None
                try:
                    self.cleanup()
                finally:
                    self._sweep = loop.call_later(interval, sweep)
            self._sweep = loop.call_later(interval, sweep)

    def close(self):
        if self._sweep is not None:
            self._sweep.cancel()
            self._sweep = None
        self.db.close()

    def cleanup(self):
        with self.lock, self.db:
            self.db.execute('DELETE FROM contexts WHERE expires <= ?', (self.clock(),))
            for token, (_, _, accepted) in list(self.reservations.items()):
                if accepted + 1800 <= self.clock():
                    self.reservations.pop(token)

    def stats(self):
        with self.lock:
            self.cleanup()
            n, size = self.db.execute('SELECT count(*), coalesce(sum(length(raw)),0) FROM contexts').fetchone()
            return {'records': n, 'bytes': size, 'reservations': len(self.reservations)}

    def reserve(self, chat, raw):
        if not isinstance(chat, str) or not chat or len(chat) > 256:
            raise ValueError('invalid context owner')
        if not isinstance(raw, bytes) or len(raw) > 4 * MiB:
            raise ValueError('context exceeds 4 MiB')
        with self.lock:
            stats = self.stats()
            n, size = self.db.execute('SELECT count(*), coalesce(sum(length(raw)),0) FROM contexts WHERE chat=?', (chat,)).fetchone()
            pending = list(self.reservations.values())
            own = [v for v in pending if v[0] == chat]
            if (len(pending) >= 4 or stats['records'] + len(pending) >= 32
                    or stats['bytes'] + sum(len(v[1]) for v in pending) + len(raw)
                    + 65536 + (stats['records'] + len(pending) + 1) * 32768 > 32 * MiB
                    or n + len(own) >= 4 or size + sum(len(v[1]) for v in own) + len(raw) > 8 * MiB):
                raise ValueError('context_capacity_busy')
            token = secrets.token_urlsafe(32)
            self.reservations[token] = (chat, raw, self.clock())
            return token

    def _check_owner_capacity(self, chat, size, token):
        # Caller holds the store lock and transaction; exclude the moving item
        # from both committed and reserved usage, but count other reservations.
        if not isinstance(chat, str) or not chat or len(chat) > 256:
            raise ValueError('invalid context owner')
        n, used = self.db.execute(
            'SELECT count(*), coalesce(sum(length(raw)),0) FROM contexts WHERE chat=? AND id<>?',
            (chat, token)).fetchone()
        pending = [item for key, item in self.reservations.items() if key != token and item[0] == chat]
        if n + len(pending) + 1 > 4 or used + sum(len(item[1]) for item in pending) + size > 8 * MiB:
            raise ValueError('context_capacity_busy')

    def commit(self, token, *, chat=None):
        with self.lock, self.db:
            owner, raw, accepted = self.reservations[token]
            # New native chats use a random provisional owner, never a shared 'new'.
            owner = owner if chat is None else chat
            self._check_owner_capacity(owner, len(raw), token)
            expires = accepted + 10800
            ref = {'schema': 'comfytv.task-context-ref.v1', 'id': token, 'revision': revision(raw), 'size_bytes': len(raw), 'expires_at': expires}
            self.db.execute('INSERT INTO contexts VALUES (?,?,?,?,?,?,0)', (token, owner, raw, ref['revision'], accepted, expires))
            self.reservations.pop(token)
        return ref

    def reference(self, token, expected_revision):
        with self.lock:
            self.cleanup()
            row = self.db.execute('SELECT revision,length(raw),expires FROM contexts WHERE id=?', (token,)).fetchone()
            if not row or row[0] != expected_revision:
                raise ValueError('context unavailable or revision mismatch')
            return {'schema': 'comfytv.task-context-ref.v1', 'id': token, 'revision': row[0], 'size_bytes': row[1], 'expires_at': row[2]}

    def read(self, ref):
        with self.lock:
            actual = self.reference(ref['id'], ref['revision'])
            if actual != ref:
                raise ValueError('context reference mismatch')
            raw = bytes(self.db.execute('SELECT raw FROM contexts WHERE id=?', (ref['id'],)).fetchone()[0])
            if revision(raw) != ref['revision']:
                raise ValueError('context digest mismatch')
            return raw

    def dispatch(self, ref):
        with self.lock, self.db:
            self.read(ref)
            accepted, dispatched = self.db.execute('SELECT accepted,dispatched FROM contexts WHERE id=?', (ref['id'],)).fetchone()
            if not dispatched and self.clock() - accepted > 1800:
                raise ValueError('context queue dwell exceeded')
            if ref['expires_at'] - self.clock() < 7200:
                raise ValueError('context expired: insufficient active lease')
            self.db.execute('UPDATE contexts SET dispatched=1 WHERE id=?', (ref['id'],))

    def bind(self, token, chat, message, task):
        from .task_context import strict_loads
        if len(task.encode('utf-8')) > 8192 or strict_loads(task)['context_ref']['id'] != token:
            raise ValueError('invalid frozen submission')
        with self.lock, self.db:
            context = self.db.execute('SELECT length(raw) FROM contexts WHERE id=?', (token,)).fetchone()
            if context is None:
                raise ValueError('context unavailable')
            self._check_owner_capacity(chat, context[0], token)
            row = self.db.execute('SELECT task FROM submissions WHERE message=?', (message,)).fetchone()
            if row:
                if row[0] != task:
                    raise ValueError('immutable submission identity conflict')
                return
            self.db.execute('UPDATE contexts SET chat=? WHERE id=?', (chat, token))
            self.db.execute('INSERT INTO submissions VALUES (?,?,?,?)', (message, token, task, revision(task.encode('utf-8'))))

    def submission(self, message):
        with self.lock:
            self.cleanup()
            row = self.db.execute('SELECT task,digest FROM submissions WHERE message=?', (message,)).fetchone()
            if not row or revision(row[0].encode('utf-8')) != row[1]:
                raise ValueError('submission unavailable')
            return row[0]

    def release(self, token):
        with self.lock, self.db:
            self.reservations.pop(token, None)
            self.db.execute('DELETE FROM contexts WHERE id=?', (token,))

    def release_chat(self, chat):
        with self.lock, self.db:
            self.db.execute('DELETE FROM contexts WHERE chat=?', (chat,))
            for token, item in list(self.reservations.items()):
                if item[0] == chat:
                    self.reservations.pop(token)


_STORE = None


async def cache_lifecycle(_app):
    global _STORE
    get_store()  # fresh volatile store; old tokens unavailable, never auto-submit
    try:
        yield
    finally:
        if _STORE is not None:
            _STORE.close()
            _STORE = None



def get_store():
    global _STORE
    if _STORE is None:
        _STORE = ContextStore()
    try:
        _STORE.start_cleanup()
    except RuntimeError:
        pass  # Import/startup may precede the event loop.
    return _STORE
