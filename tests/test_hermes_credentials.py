import importlib
import json
import pytest


def module():
    from ComfyTV.bot import hermes
    assert hasattr(hermes, 'credentials'), 'secure credential resolver missing'
    return hermes.credentials


class Vault:
    """Injected secure-backend fixture, NOT a physical OS keyring."""
    backend = 'test-secure-vault'
    def __init__(self): self.value = None
    def read(self): return self.value
    def write(self, value): self.value = value


def test_saved_binding_wins_over_environment(monkeypatch):
    m = module()
    vault = Vault()
    store = m.CredentialStore(backend=vault)
    record = dict(mode='active',endpoint='http://127.0.0.1:8765',client_token='dedicated-client-token',mcp_server='comfytv',credential_id=None)
    store.save(record)
    monkeypatch.setenv('COMFYTV_HERMES_API_KEY', 'old-env')
    assert store.effective('http://localhost:9999','evil')['endpoint'] == record['endpoint']
    assert store.effective('http://localhost:9999','evil')['client_token'] == 'dedicated-client-token'
    assert 'dedicated-client-token' not in json.dumps(store.public('http://localhost:9999','evil'))


def test_disabled_tombstone_and_unavailable_fail_closed(monkeypatch):
    m = module()
    monkeypatch.setenv('COMFYTV_HERMES_API_KEY','inherited')
    store = m.CredentialStore(backend=Vault())
    store.save({'mode':'disabled'})
    public = store.public('http://localhost:8765','comfytv')
    assert public['source'] == 'disabled'
    assert not public['configured']
    assert not store.effective('http://localhost:8765','comfytv').get('client_token')
    unavailable = m.CredentialStore()
    assert unavailable.public('http://localhost:8765','comfytv')['source'] == 'environment'
    assert unavailable.public('http://localhost:8765','comfytv')['secure_storage']['available'] is False
    with pytest.raises(m.StoreError): unavailable.save({'mode':'disabled'})


def test_os_backend_selection_rejects_plaintext_and_corruption():
    m = module()
    assert hasattr(m, 'KeyringBackend'), 'OS secure backend missing'
    class Plaintext:
        def get_password(self,*args): return None
        def set_password(self,*args): pass
    with pytest.raises(m.StoreError): m.KeyringBackend(adapter=Plaintext())
    vault = Vault(); vault.value = '{broken'
    store = m.CredentialStore(backend=vault)
    with pytest.raises(m.StoreError): store.effective('http://localhost:1','comfytv')
    assert not store.public('http://localhost:1','comfytv')['configured']
    assert store.public('http://localhost:1','comfytv')['secure_storage']['reason'] == 'secure_storage_read_failed'


def test_encrypted_atomic_file_readback_and_link_failure(tmp_path):
    m = module()
    assert hasattr(m,'EncryptedFileBackend'), 'atomic encrypted record backend missing'
    class Crypto:
        def protect(self, value): return b'ENCRYPTED:' + value[::-1]
        def unprotect(self, value):
            if not value.startswith(b'ENCRYPTED:'): raise ValueError()
            return value[10:][::-1]
        def secure(self, path): path.chmod(0o700 if path.is_dir() else 0o600)
        def check(self, path):
            if path.is_symlink() or path.stat().st_mode & 0o077: raise ValueError()
    # Explicit crypto fixture; not DPAPI evidence.
    backend = m.EncryptedFileBackend(tmp_path/'isolated', crypto=Crypto())
    assert not backend.directory.exists(), 'read-only discovery must not create storage'
    assert backend.read() is None
    store = m.CredentialStore(backend=backend)
    store.save({'mode':'disabled'})
    assert store.read() == {'mode':'disabled'}
    assert b'disabled' not in backend.path.read_bytes()
    backend.path.unlink(); backend.path.symlink_to(tmp_path/'outside')
    with pytest.raises(m.StoreError): store.save({'mode':'disabled'})
    assert hasattr(m,'WindowsCrypto'), 'native DPAPI/ACL implementation missing'
    ordinary_file=tmp_path/'not-a-directory'; ordinary_file.write_bytes(b'x'); ordinary_file.chmod(0o600)
    with pytest.raises(m.StoreError): m.EncryptedFileBackend(ordinary_file,crypto=Crypto())
    if __import__('os').name != 'nt':
        with pytest.raises(m.StoreError): m.WindowsCrypto()


def test_legacy_migration_reads_safe_encrypted_file_without_deleting(tmp_path):
    m=module()
    class Crypto:
        def unprotect(self,data): return data[::-1]
        def check(self,path):
            if path.is_symlink(): raise ValueError()
    class LegacyVault(Vault):
        directory=tmp_path
        crypto=Crypto()
    path=tmp_path/'client-key.dpapi'; path.write_bytes(b'existing-client-key'[::-1])
    store=m.CredentialStore(backend=LegacyVault())
    assert hasattr(store,'legacy_token'), 'legacy migration missing'
    assert store.legacy_token()=='existing-client-key'
    assert path.exists()
    assert store.public('http://localhost:1','comfytv')['migration']['legacy_dpapi']
    path.unlink(); path.symlink_to(tmp_path/'outside')
    with pytest.raises(m.StoreError): store.legacy_token()


@pytest.mark.parametrize('raw',['[]','{"mode":"active"}','{"mode":"active","client_token":"secret","endpoint":"http://example.com","mcp_server":"comfytv"}'])
def test_corrupt_record_is_fail_closed_and_status_is_safe(raw,monkeypatch):
    m=module(); vault=Vault(); vault.value=raw
    monkeypatch.setenv('COMFYTV_HERMES_API_KEY','must-not-fallback')
    store=m.CredentialStore(backend=vault)
    with pytest.raises(m.StoreError): store.effective('http://localhost:1','comfytv')
    public=store.public('http://localhost:1','comfytv')
    assert public['source']=='none' and not public['configured']
    assert 'secret' not in json.dumps(public)


def test_backend_access_failure_never_restores_environment(monkeypatch):
    m=module()
    monkeypatch.setenv('COMFYTV_HERMES_API_KEY','inherited-secret')
    class Inaccessible(Vault):
        def read(self): raise OSError('private details')
    store=m.CredentialStore(backend=Inaccessible())
    with pytest.raises(m.StoreError): store.effective('http://localhost:1','comfytv')
    assert not store.public('http://localhost:1','comfytv')['secure_storage']['available']
    unavailable=m.CredentialStore(unavailable_reason='secure_storage_read_failed')
    with pytest.raises(m.StoreError): unavailable.effective('http://localhost:1','comfytv')
    assert unavailable.public('http://localhost:1','comfytv')['source']=='none'


def test_windows_acl_owner_and_exact_allowlist_independent_of_ace_order():
    m=module(); sid='S-1-5-21-123-456-789-1001'
    assert hasattr(m.WindowsCrypto,'safe_sddl'), 'semantic ACL verification missing'
    for acl in [f'O:{sid}D:P(A;;FA;;;{sid})(A;;FA;;;SY)',f'O:{sid}D:P(A;;FA;;;SY)(A;;FA;;;{sid})']:
        assert m.WindowsCrypto.safe_sddl(acl,sid)
    for acl in [f'O:{sid}D:(A;;FA;;;{sid})(A;;FA;;;SY)',f'O:SYD:P(A;;FA;;;{sid})(A;;FA;;;SY)',f'O:{sid}D:P(A;;FA;;;{sid})(A;;FA;;;WD)',f'O:{sid}D:P(A;;FA;;;{sid})(A;;FA;;;SY)(A;;FR;;;WD)']:
        assert not m.WindowsCrypto.safe_sddl(acl,sid)
    inherited_children=f'O:{sid}D:P(A;OICI;FA;;;{sid})(A;OICI;FA;;;SY)'
    assert m.WindowsCrypto.safe_sddl(inherited_children,sid,directory=True)
    assert not m.WindowsCrypto.safe_sddl(inherited_children,sid)



def test_keyring_dependency_loss_cannot_resurrect_environment(tmp_path,monkeypatch):
    m=module()
    assert hasattr(m,'keyring_marker_directory'), 'nonsecret configured marker missing'
    monkeypatch.setattr(m,'keyring_marker_directory',lambda:tmp_path/'private-meta')
    class Keyring:
        __module__='keyring.backends.SecretService'
        value=None
        def get_password(self,*args): return self.value
        def set_password(self,*args): self.value=args[-1]
    backend=m.KeyringBackend(adapter=Keyring())
    store=m.CredentialStore(backend=backend); store.save({'mode':'disabled'})
    marker=tmp_path/'private-meta'/'keyring-used'
    assert marker.exists() and marker.read_text()=='1'
    marker.chmod(0o644)
    with pytest.raises(m.StoreError): store.save({'mode':'disabled'})
    marker.chmod(0o600)
    monkeypatch.setenv('COMFYTV_HERMES_API_KEY','inherited-secret')
    monkeypatch.setattr(m,'_DEFAULT',None)
    monkeypatch.setattr(m,'KeyringBackend',lambda: (_ for _ in ()).throw(m.StoreError()))
    public=m.get_store().public('http://localhost:1','comfytv')
    assert public['source']=='none' and not public['configured']


def test_public_environment_fields_cannot_echo_the_client_secret(monkeypatch):
    m=module(); secret='inherited-client-secret'
    monkeypatch.setenv('COMFYTV_HERMES_API_KEY',secret)
    store=m.CredentialStore()
    assert secret not in json.dumps(store.public('http://localhost/'+secret,secret))
    assert not store.public('', 'comfytv')['configured']
