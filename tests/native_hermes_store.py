"""Native isolated acceptance: no ComfyUI imports, no production credentials.
Usage: python tests/native_hermes_store.py bot/hermes_credentials.py
Only a fresh LOCALAPPDATA/ComfyTV-Hermes-native-test-<uuid> is touched.
"""
import importlib.util
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import uuid


def main():
    if os.name != 'nt':
        print(json.dumps({'native_windows_verified':False,'reason':'requires_windows'}))
        return 2
    module_path=Path(sys.argv[1]).resolve()
    spec=importlib.util.spec_from_file_location('isolated_hermes_credentials',module_path)
    module=importlib.util.module_from_spec(spec); spec.loader.exec_module(module)
    directory=Path(os.environ['LOCALAPPDATA'])/('ComfyTV-Hermes-native-test-'+uuid.uuid4().hex)
    crypto=module.WindowsCrypto()
    try:
        backend=module.EncryptedFileBackend(directory,crypto=crypto)
        store=module.CredentialStore(backend=backend)
        token=uuid.uuid4().hex+uuid.uuid4().hex
        record=dict(mode='active',endpoint='http://127.0.0.1:1',client_token=token,mcp_server='comfytv',credential_id=None)
        code=uuid.uuid4().hex
        pending=dict(mode='pending',operation='pair',endpoint=record['endpoint'],client_token=token,mcp_server='comfytv',pairing_code=code,previous=None)
        store.save(pending)
        assert store.read()==pending
        assert token.encode() not in backend.path.read_bytes() and code.encode() not in backend.path.read_bytes()
        store.save(record)
        assert store.read()==record
        assert token.encode() not in backend.path.read_bytes()
        crypto.check(directory); crypto.check(backend.path)
        legacy=directory/'client-key.dpapi'
        legacy.write_bytes(crypto.protect(token.encode())); crypto.secure(legacy)
        assert store.legacy_token()==token and legacy.exists()
        ciphertext=backend.path.read_bytes(); backend.path.write_bytes(b'invalid-ciphertext')
        try: store.read()
        except module.StoreError: pass
        else: raise AssertionError('corruption did not fail closed')
        backend.path.write_bytes(ciphertext)
        # A real unsafe ACL, not a substituted verifier.
        result=subprocess.run(['icacls',str(backend.path),'/grant','*S-1-1-0:(R)'],capture_output=True)
        assert result.returncode==0, 'native ACL fixture failed'
        try: store.read()
        except module.StoreError: pass
        else: raise AssertionError('unsafe ACL accepted')
        crypto.secure(backend.path)
        link=directory/'hardlink.dpapi'; os.link(backend.path,link)
        try: store.read()
        except module.StoreError: pass
        else: raise AssertionError('hardlink accepted')
        link.unlink()
        target=directory/'junction-target'; target.mkdir(); crypto.secure(target)
        junction=directory/'junction'
        result=subprocess.run(['cmd','/c','mklink','/J',str(junction),str(target)],capture_output=True)
        assert result.returncode==0, 'native junction fixture failed'
        try: module.EncryptedFileBackend(junction,crypto=crypto)
        except module.StoreError: pass
        else: raise AssertionError('junction accepted')
        junction.rmdir()
        store.save({'mode':'disabled'})
        # Namespace-local env compatibility check; never modifies process env.
        assert store.effective('http://localhost:9','other')['mode']=='disabled'
        print(json.dumps({'native_windows_verified':True,'dpapi_readback':True,'owner_system_acl':True,'corruption_rejected':True,'unsafe_acl_rejected':True,'hardlink_rejected':True,'junction_rejected':True,'legacy_read':True,'tombstone':True,'production_touched':False}))
        return 0
    finally:
        shutil.rmtree(directory,ignore_errors=False)


if __name__=='__main__': raise SystemExit(main())
