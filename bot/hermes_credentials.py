"""Standalone credential resolver. Optional OS dependencies are loaded lazily."""
import json
import os
import secrets
import ipaddress
import re
from urllib.parse import urlsplit
from pathlib import Path


def validate_endpoint(endpoint):
    if not isinstance(endpoint,str) or not endpoint or len(endpoint)>2048 or any(c.isspace() or ord(c)<32 for c in endpoint) or '\\' in endpoint: raise ValueError()
    p=urlsplit(endpoint)
    loopback=p.hostname=='localhost'
    try: loopback=loopback or ipaddress.ip_address(p.hostname or '').is_loopback
    except ValueError: pass
    if p.scheme not in ('http','https') or not p.hostname or p.username is not None or p.password is not None or p.query or p.fragment or (p.scheme=='http' and not loopback) or p.netloc.endswith(':'): raise ValueError()
    p.port
    return endpoint.rstrip('/')


def validate_server(server):
    if not isinstance(server,str) or not re.fullmatch(r'[A-Za-z0-9_-]{1,100}',server): raise ValueError()
    return server


class EncryptedFileBackend:
    backend = 'windows_dpapi'
    def __init__(self, directory, *, crypto):
        self.directory = Path(directory)
        self.path = self.directory / 'connection-v1.dpapi'
        self.crypto = crypto
        if self.directory.exists() or self.directory.is_symlink():
            if not self.directory.is_dir(): raise StoreError('secure_storage_unsafe_path')
            crypto.check(self.directory)

    def _check(self):
        self.crypto.check(self.directory)
        if self.path.exists() or self.path.is_symlink():
            self.crypto.check(self.path)

    def read(self):
        if not self.directory.exists() and not self.directory.is_symlink(): return None
        self._check()
        if not self.path.exists(): return None
        if self.path.stat().st_size > 32768: raise StoreError()
        return self.crypto.unprotect(self.path.read_bytes()).decode('utf-8')

    def write(self, value):
        if not self.directory.exists() and not self.directory.is_symlink():
            self.directory.mkdir()
            self.crypto.secure(self.directory)
        self._check()
        encrypted = self.crypto.protect(value.encode('utf-8'))
        temp = self.directory / ('pending-' + secrets.token_hex(16))
        try:
            with temp.open('xb') as stream:
                self.crypto.secure(temp)
                self.crypto.check(temp)
                stream.write(encrypted); stream.flush(); os.fsync(stream.fileno())
            self._check()
            os.replace(temp, self.path)
            self.crypto.check(self.path)
            if self.read() != value: raise StoreError()
        finally:
            if temp.exists(): temp.unlink()



class StoreError(Exception):
    def __init__(self, reason='secure_storage_unavailable'):
        self.reason = reason
        super().__init__(reason)


def validate_record(record):
    if not isinstance(record,dict) or record.get('mode') not in ('active','disabled','pending','unconfigured'): raise ValueError()
    if record['mode'] in ('disabled','unconfigured'):
        if set(record)!={'mode'}: raise ValueError()
        return record
    validate_endpoint(record['endpoint']); validate_server(record['mcp_server'])
    token=record['client_token']
    if not isinstance(token,str) or not 16<=len(token)<=4096 or not token.isascii() or any(ord(c)<=32 or ord(c)>=127 for c in token): raise ValueError()
    for name in ('credential_id','server_id'):
        value=record.get(name)
        if value is not None and (not isinstance(value,str) or not re.fullmatch('[0-9a-f]{32}',value)): raise ValueError()
    if record['mode']=='active':
        if set(record)-{'mode','endpoint','client_token','mcp_server','credential_id','server_id'}: raise ValueError()
    else:
        operation=record.get('operation')
        if operation not in ('pair','revoke') or set(record)-{'mode','operation','endpoint','client_token','mcp_server','previous','pairing_code'}: raise ValueError()
        if operation=='pair' and (not isinstance(record.get('pairing_code'),str) or not 16<=len(record['pairing_code'])<=1024): raise ValueError()
        if record.get('previous') is not None:
            if record['previous'].get('mode')=='pending': raise ValueError()
            validate_record(record['previous'])
    return record


class CredentialStore:
    def __init__(self, *, backend=None, unavailable_reason='secure_storage_unavailable'):
        self.backend = backend
        self.unavailable_reason = unavailable_reason

    def read(self):
        if self.backend is None:
            raise StoreError()
        try:
            value = self.backend.read()
            return validate_record(json.loads(value)) if value is not None else None
        except Exception:
            raise StoreError('secure_storage_read_failed') from None

    def save(self, record):
        if self.backend is None:
            raise StoreError()
        try:
            validate_record(record)
            value = json.dumps(record, sort_keys=True, separators=(',', ':'))
            self.backend.write(value)
            if self.backend.read() != value:
                raise StoreError()
        except Exception:
            raise StoreError('secure_storage_write_failed') from None

    def effective(self, endpoint, server):
        if self.backend is None and self.unavailable_reason != 'secure_storage_unavailable': raise StoreError(self.unavailable_reason)
        record = self.read() if self.backend is not None else None
        if record and record.get('mode') != 'unconfigured':
            return record
        key = os.environ.get('COMFYTV_HERMES_API_KEY', '')
        return dict(mode='active' if key and endpoint else 'none',endpoint=endpoint,client_token=key,mcp_server=server,credential_id=None,source='environment' if key else 'none')

    def legacy_present(self):
        directory=getattr(self.backend,'directory',None)
        return bool(directory and (directory/'client-key.dpapi').exists())

    def legacy_token(self):
        try:
            path=self.backend.directory/'client-key.dpapi'
            self.backend.crypto.check(self.backend.directory)
            check_legacy=getattr(self.backend.crypto,'check_legacy',None)
            if check_legacy is not None: check_legacy(path,self.backend.directory)
            else: self.backend.crypto.check(path)
            if path.stat().st_size>16384: raise StoreError()
            token=self.backend.crypto.unprotect(path.read_bytes()).decode('utf-8')
            if not 16<=len(token)<=4096 or not token.isascii() or any(ord(c)<=32 or ord(c)>=127 for c in token): raise StoreError()
            return token
        except Exception:
            raise StoreError('legacy_migration_unavailable') from None

    def public(self, endpoint, server, can_manage=False):
        reason = None if self.backend is not None else self.unavailable_reason
        try:
            record = self.effective(endpoint, server)
        except StoreError as exc:
            reason = exc.reason
            record = {'mode':'none'}
        if record.get('mode') == 'pending': reason = 'revoke_pending' if record.get('operation') == 'revoke' else 'setup_pending'
        secret_values=[r.get(name) for r in (record,record.get('previous') or {}) for name in ('client_token','pairing_code') if r.get(name)]
        endpoint=record.get('endpoint',''); server=record.get('mcp_server','comfytv'); credential_id=record.get('credential_id')
        if any(s in endpoint for s in secret_values): endpoint=''
        if any(s in server for s in secret_values): server='unknown'
        if credential_id and any(s in credential_id for s in secret_values): credential_id=None
        return dict(schema_version=1,source='disabled' if record.get('mode') == 'disabled' else record.get('source','secure_store' if reason in (None,'setup_pending','revoke_pending') else 'none'),configured=record.get('mode')=='active',endpoint=endpoint,mcp_server=server,credential_id=credential_id,secure_storage=dict(available=self.backend is not None and reason != 'secure_storage_read_failed',backend=getattr(self.backend,'backend','unavailable'),reason=reason),migration=dict(legacy_dpapi=self.legacy_present(),environment=bool(os.environ.get('COMFYTV_HERMES_API_KEY'))),can_manage=can_manage)


class WindowsCrypto:
    """CurrentUser DPAPI; protected owner + SYSTEM DACL, verified before I/O."""
    def __init__(self):
        if os.name != 'nt': raise StoreError()
        import ctypes as c
        from ctypes import wintypes as w
        self.c, self.w = c, w
        self.adv = c.WinDLL('advapi32', use_last_error=True)
        self.kernel = c.WinDLL('kernel32', use_last_error=True)
        self.crypt = c.WinDLL('crypt32', use_last_error=True)
        P = c.c_void_p
        def bind(dll, name, args, rest=w.BOOL):
            f = getattr(dll,name); f.argtypes=args; f.restype=rest; return f
        self.free = bind(self.kernel,'LocalFree',[P],P)
        self.close = bind(self.kernel,'CloseHandle',[w.HANDLE])
        getprocess = bind(self.kernel,'GetCurrentProcess',[],w.HANDLE)
        opentoken = bind(self.adv,'OpenProcessToken',[w.HANDLE,w.DWORD,c.POINTER(w.HANDLE)])
        getinfo = bind(self.adv,'GetTokenInformation',[w.HANDLE,c.c_int,P,w.DWORD,c.POINTER(w.DWORD)])
        sidstring = bind(self.adv,'ConvertSidToStringSidW',[P,c.POINTER(P)])
        token=w.HANDLE(); size=w.DWORD()
        if not opentoken(getprocess(),8,c.byref(token)): raise StoreError()
        try:
            getinfo(token,1,None,0,c.byref(size)); buf=c.create_string_buffer(size.value)
            if not getinfo(token,1,buf,size,c.byref(size)): raise StoreError()
            sid=c.cast(buf,c.POINTER(P))[0]; out=P()
            if not sidstring(sid,c.byref(out)): raise StoreError()
            try: self.sid=c.wstring_at(out)
            finally: self.free(out)
        finally: self.close(token)
        self.to_sd=bind(self.adv,'ConvertStringSecurityDescriptorToSecurityDescriptorW',[w.LPCWSTR,w.DWORD,c.POINTER(P),c.POINTER(w.DWORD)])
        self.to_string=bind(self.adv,'ConvertSecurityDescriptorToStringSecurityDescriptorW',[P,w.DWORD,w.DWORD,c.POINTER(P),c.POINTER(w.DWORD)])
        self.setsecurity=bind(self.adv,'SetFileSecurityW',[w.LPCWSTR,w.DWORD,P])
        self.getsecurity=bind(self.adv,'GetFileSecurityW',[w.LPCWSTR,w.DWORD,P,w.DWORD,c.POINTER(w.DWORD)])
        class Blob(c.Structure):
            _fields_=[('size',w.DWORD),('data',c.POINTER(c.c_ubyte))]
        self.Blob=Blob
        self.encrypt=bind(self.crypt,'CryptProtectData',[c.POINTER(Blob),w.LPCWSTR,P,P,P,w.DWORD,c.POINTER(Blob)])
        self.decrypt=bind(self.crypt,'CryptUnprotectData',[c.POINTER(Blob),P,P,P,P,w.DWORD,c.POINTER(Blob)])

    def _crypt(self, data, decrypt=False):
        c=self.c; buf=c.create_string_buffer(data)
        source=self.Blob(len(data),c.cast(buf,c.POINTER(c.c_ubyte))); dest=self.Blob()
        if decrypt: ok=self.decrypt(c.byref(source),None,None,None,None,1,c.byref(dest))
        else: ok=self.encrypt(c.byref(source),'ComfyTV-Hermes',None,None,None,1,c.byref(dest))
        if not ok: raise StoreError('secure_storage_crypto_failed')
        try: return c.string_at(dest.data,dest.size)
        finally: self.free(dest.data)

    def protect(self, data): return self._crypt(data)
    def unprotect(self, data): return self._crypt(data,True)

    def secure(self, path):
        c=self.c; descriptor=c.c_void_p()
        sddl='O:'+self.sid+'D:P(A;;FA;;;'+self.sid+')(A;;FA;;;SY)'
        if not self.to_sd(sddl,1,c.byref(descriptor),None): raise StoreError()
        try:
            if not self.setsecurity(str(path),0x80000005,descriptor): raise StoreError('secure_storage_acl_failed')
        finally: self.free(descriptor)

    @staticmethod
    def safe_sddl(actual, sid, *, directory=False):
        # AI is auto-inheritance bookkeeping, not an additional access grant.
        if directory: actual=actual.replace('D:PAI(', 'D:P(', 1)
        prefix='O:'+sid+'D:P'
        # OI/CI grants only the same owner and SYSTEM to child files/dirs;
        # permit this common protected legacy-directory ACL, never on files.
        flags=('', 'OI', 'CI', 'OICI') if directory else ('',)
        for user_flags in flags:
            for system_flags in flags:
                user='(A;'+user_flags+';FA;;;'+sid+')'; system='(A;'+system_flags+';FA;;;SY)'
                if actual in (prefix+user+system,prefix+system+user): return True
        return False

    @staticmethod
    def safe_legacy_sddl(actual, sid):
        # Historical elevated installer wrote CurrentUser DPAPI under a
        # protected user-owned directory: BA owner + inherited user/SYSTEM ACL.
        # This is a legacy-only exception, not protection from a local admin.
        for owner in (sid,'BA'):
            for control in ('P','PAI','AI',''):
                for uf in ('','ID'):
                    for sf in ('','ID'):
                        user=f'(A;{uf};FA;;;{sid})'; system=f'(A;{sf};FA;;;SY)'
                        prefix=f'O:{owner}D:{control}'
                        if actual in (prefix+user+system,prefix+system+user): return True
        return False

    @staticmethod
    def _check_path(path):
        path=Path(path)
        # Reject junctions/reparse points along the entire lexical path.
        for p in [path,*path.parents]:
            st=p.lstat()
            if p.is_symlink() or getattr(st,'st_file_attributes',0) & 0x400:
                raise StoreError('secure_storage_unsafe_path')
        if not path.is_dir() and path.stat().st_nlink != 1: raise StoreError('secure_storage_unsafe_path')

    def check_legacy(self, path, directory):
        path=Path(path); directory=Path(directory)
        if path != directory/'client-key.dpapi' or not directory.is_dir(): raise StoreError('secure_storage_unsafe_path')
        self.check(directory)
        self._check_path(path)
        if not path.is_file() or path.stat().st_size>16384: raise StoreError('secure_storage_unsafe_path')
        if not self.safe_legacy_sddl(self._sddl(path),self.sid): raise StoreError('secure_storage_unsafe_acl')

    def _sddl(self, path):
        c=self.c; size=self.w.DWORD()
        self.getsecurity(str(path),5,None,0,c.byref(size))
        buf=c.create_string_buffer(size.value)
        if not self.getsecurity(str(path),5,buf,size,c.byref(size)): raise StoreError()
        out=c.c_void_p()
        if not self.to_string(buf,1,5,c.byref(out),None): raise StoreError()
        try: return c.wstring_at(out)
        finally: self.free(out)

    def check(self, path):
        path=Path(path)
        self._check_path(path)
        if not self.safe_sddl(self._sddl(path),self.sid,directory=path.is_dir()): raise StoreError('secure_storage_unsafe_acl')


_DEFAULT = None


def get_store():
    global _DEFAULT
    if _DEFAULT is None:
        try:
            backend = (EncryptedFileBackend(Path(os.environ['LOCALAPPDATA']) / 'ComfyTV-Hermes', crypto=WindowsCrypto()) if os.name == 'nt' else KeyringBackend())
        except Exception:
            backend = None
        # An existing Windows encrypted record/namespace that cannot be opened
        # is not an initial unconfigured install: never resurrect inherited env.
        blocked = os.name == 'nt' and (Path(os.environ.get('LOCALAPPDATA','')) / 'ComfyTV-Hermes').exists() and backend is None
        if os.name!='nt' and backend is None:
            marker=keyring_marker_directory()/'keyring-used'
            blocked=marker.exists() or marker.is_symlink()
        _DEFAULT = CredentialStore(backend=backend,unavailable_reason='secure_storage_read_failed' if blocked else 'secure_storage_unavailable')
    return _DEFAULT


def keyring_marker_directory():
    import sys
    return Path.home() / ('Library/Application Support/ComfyTV-Hermes' if sys.platform=='darwin' else '.local/share/ComfyTV-Hermes')


def write_keyring_marker(directory):
    """Nonsecret use marker, never a plaintext credential fallback."""
    directory.mkdir(mode=0o700,parents=True,exist_ok=True)
    for path in [directory,*directory.parents]:
        if path.is_symlink(): raise StoreError('secure_storage_unsafe_path')
    st=directory.stat()
    if st.st_uid!=os.getuid() or st.st_mode & 0o077: raise StoreError('secure_storage_unsafe_acl')
    marker=directory/'keyring-used'
    if marker.exists() or marker.is_symlink():
        st=marker.lstat()
        if marker.is_symlink() or not marker.is_file() or st.st_nlink!=1 or st.st_uid!=os.getuid() or st.st_mode & 0o077: raise StoreError('secure_storage_unsafe_acl')
        return
    fd=os.open(marker,os.O_WRONLY|os.O_CREAT|os.O_EXCL,0o600)
    with os.fdopen(fd,'w') as stream:
        stream.write('1'); stream.flush(); os.fsync(stream.fileno())


class KeyringBackend:
    backend = 'os_keyring'
    def __init__(self, *, adapter=None, namespace='ComfyTV-Hermes', marker_directory=None):
        if adapter is None:
            try:
                import keyring
                adapter = keyring.get_keyring()
            except Exception:
                raise StoreError() from None
        # Only known native secure adapters; no chained/null/plaintext fallback.
        name = type(adapter).__module__ + '.' + type(adapter).__name__
        if name not in {'keyring.backends.SecretService.Keyring', 'keyring.backends.macOS.Keyring', 'keyring.backends.kwallet.DBusKeyring', 'keyring.backends.kwallet.DBusKeyringKWallet4'}:
            raise StoreError()
        self.adapter, self.namespace = adapter, namespace
        self.marker_directory=Path(marker_directory) if marker_directory is not None else keyring_marker_directory()
        # A locked/unreachable real adapter remains selected; read errors must
        # fail closed rather than making environment fallback appear initial.

    def read(self):
        return self.adapter.get_password(self.namespace, 'connection-v1')

    def write(self, value):
        write_keyring_marker(self.marker_directory)
        self.adapter.set_password(self.namespace, 'connection-v1', value)
