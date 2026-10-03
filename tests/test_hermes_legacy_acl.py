"""Pure ACL regressions; synthetic crypto below is NOT native DPAPI evidence."""
import importlib.util
from pathlib import Path
import pytest

spec=importlib.util.spec_from_file_location('credentials',Path(__file__).parents[1]/'bot/hermes_credentials.py')
m=importlib.util.module_from_spec(spec); spec.loader.exec_module(m)
SID='S-1-5-21-123-456-789-1001'
PARENT=f'O:{SID}D:PAI(A;OICI;FA;;;SY)(A;OICI;FA;;;{SID})'
LEGACY=f'O:BAD:AI(A;ID;FA;;;SY)(A;ID;FA;;;{SID})'


def test_actual_sop_parent_bookkeeping_is_not_an_access_grant():
    assert m.WindowsCrypto.safe_sddl(PARENT,SID,directory=True)
    assert not m.WindowsCrypto.safe_sddl(PARENT,SID)


def test_historical_legacy_is_not_an_active_record_acl():
    assert m.WindowsCrypto.safe_legacy_sddl(LEGACY,SID)
    assert not m.WindowsCrypto.safe_sddl(LEGACY,SID)
    for bad in [LEGACY.replace('O:BA','O:SY'),LEGACY.replace('FA','FR',1),LEGACY+'(A;;FR;;;WD)',LEGACY.replace(';ID;',';IO;',1)]:
        assert not m.WindowsCrypto.safe_legacy_sddl(bad,SID)
    for bad in [PARENT.replace('PAI','AI'),PARENT.replace('O:'+SID,'O:BA'),PARENT+'(A;;FR;;;WD)',PARENT.replace('FA','FR',1)]:
        assert not m.WindowsCrypto.safe_sddl(bad,SID,directory=True)


def test_historical_migration_preserves_legacy_and_writes_strict_active(tmp_path,monkeypatch):
    monkeypatch.delenv('COMFYTV_HERMES_API_KEY',raising=False)
    class Crypto(m.WindowsCrypto):
        def __init__(self): self.sid=SID; self.acls={tmp_path:PARENT}
        def _sddl(self,path): return self.acls[path]
        def check(self,path):
            if not self.safe_sddl(self._sddl(path),SID,directory=path.is_dir()): raise m.StoreError()
        def protect(self,data): return b'encrypted:'+data[::-1]
        def unprotect(self,data): return data[10:][::-1]
        def secure(self,path): self.acls[path]=f'O:{SID}D:P(A;;FA;;;SY)(A;;FA;;;{SID})'
    crypto=Crypto(); legacy=tmp_path/'client-key.dpapi'
    original=crypto.protect(b'synthetic-legacy-client-token'); legacy.write_bytes(original); crypto.acls[legacy]=LEGACY
    store=m.CredentialStore(backend=m.EncryptedFileBackend(tmp_path,crypto=crypto))
    public=store.public('http://localhost:1','comfytv')
    assert public['source']=='none' and not public['configured']
    assert public['secure_storage']['available'] and public['migration']['legacy_dpapi']
    token=store.legacy_token()
    # Atomic rename preserves ACL in Windows; fixture resolves the final path to that strict ACL.
    crypto.acls[store.backend.path]=f'O:{SID}D:P(A;;FA;;;SY)(A;;FA;;;{SID})'
    store.save(dict(mode='active',endpoint='http://localhost:1',mcp_server='comfytv',client_token=token))
    assert store.effective('http://localhost:9','other')['client_token']==token
    assert legacy.read_bytes()==original and crypto.acls[legacy]==LEGACY
    with pytest.raises(m.StoreError): crypto.check(legacy)
    crypto.acls[tmp_path]=PARENT.replace('PAI','AI')
    with pytest.raises(m.StoreError): store.legacy_token()
