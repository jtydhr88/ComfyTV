"""Real Windows historical SOP acceptance. Elevated same-user context required.
python tests/native_hermes_legacy.py bot/hermes_credentials.py
Never reads production credentials; only touches a unique native-test namespace.
"""
import importlib.util
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import uuid


def powershell(script, path):
    env=dict(os.environ, COMFYTV_NATIVE_FIXTURE=str(path))
    result=subprocess.run(['powershell.exe','-NoProfile','-NonInteractive','-Command',script],env=env,capture_output=True)
    if result.returncode: raise AssertionError('native fixture staging failed; elevated same-user Windows context required')


def stage_historical_parent(directory, sid):
    # The actual SOP uses .NET protected inheritable owner+SYSTEM directory ACL.
    directory.mkdir()
    powershell("$ErrorActionPreference='Stop'; $p=$env:COMFYTV_NATIVE_FIXTURE; "
        "$u=[System.Security.Principal.WindowsIdentity]::GetCurrent().User; "
        "$a=New-Object System.Security.AccessControl.DirectorySecurity; "
        "$a.SetAccessRuleProtection($true,$false); $a.SetOwner($u); "
        "foreach($s in @($u,(New-Object System.Security.Principal.SecurityIdentifier('S-1-5-18')))){ "
        "$r=New-Object System.Security.AccessControl.FileSystemAccessRule($s,'FullControl','ContainerInherit,ObjectInherit','None','Allow'); $a.AddAccessRule($r) }; "
        "Set-Acl -LiteralPath $p -AclObject $a",directory)


def stage_historical_file_owner(path):
    # Preserve inherited ACEs, set historical elevated installer owner to BA.
    powershell("$ErrorActionPreference='Stop'; $p=$env:COMFYTV_NATIVE_FIXTURE; "
        "$a=Get-Acl -LiteralPath $p; "
        "$a.SetOwner((New-Object System.Security.Principal.SecurityIdentifier('S-1-5-32-544'))); "
        "Set-Acl -LiteralPath $p -AclObject $a",path)


def main():
    if os.name!='nt':
        print(json.dumps({'native_windows_verified':False,'reason':'requires_windows'})); return 2
    spec=importlib.util.spec_from_file_location('native_credentials',Path(sys.argv[1]).resolve())
    m=importlib.util.module_from_spec(spec); spec.loader.exec_module(m)
    root=Path(os.environ['LOCALAPPDATA'])/('ComfyTV-Hermes-native-test-'+uuid.uuid4().hex)
    crypto=m.WindowsCrypto(); sid=crypto.sid; root.mkdir()
    checks=[]
    def rejected(action,name):
        try: action()
        except m.StoreError: checks.append(name)
        else: raise AssertionError(name+' accepted')
    def acl(path,sddl,protected=True):
        c=crypto.c; sd=c.c_void_p()
        assert crypto.to_sd(sddl,1,c.byref(sd),None)
        try: assert crypto.setsecurity(str(path),5|(0x80000000 if protected else 0x20000000),sd)
        finally: crypto.free(sd)
    result=None
    old_env=os.environ.pop('COMFYTV_HERMES_API_KEY',None)
    try:
        directory=root/'historical'; stage_historical_parent(directory,sid)
        parent_sddl=crypto._sddl(directory)
        expected=f'O:{sid}D:PAI(A;OICI;FA;;;SY)(A;OICI;FA;;;{sid})'
        # ACE order is immaterial; fixture must really have PAI and inheritance.
        assert 'D:PAI(' in parent_sddl and ';OICI;' in parent_sddl and crypto.safe_sddl(parent_sddl,sid,directory=True), 'historical parent was not reproduced'
        legacy=directory/'client-key.dpapi'; token=uuid.uuid4().hex+uuid.uuid4().hex
        legacy.write_bytes(crypto.protect(token.encode())); stage_historical_file_owner(legacy)
        original=legacy.read_bytes(); legacy_sddl=crypto._sddl(legacy)
        assert legacy_sddl in (f'O:BAD:AI(A;ID;FA;;;SY)(A;ID;FA;;;{sid})', f'O:BAD:AI(A;ID;FA;;;{sid})(A;ID;FA;;;SY)'), 'actual historical file ACL not reproduced'
        store=m.CredentialStore(backend=m.EncryptedFileBackend(directory,crypto=crypto))
        public=store.public('http://127.0.0.1:1','comfytv')
        assert public['source']=='none' and not public['configured'] and public['secure_storage']['available'] and public['migration']['legacy_dpapi']
        assert store.legacy_token()==token
        store.save(dict(mode='active',endpoint='http://127.0.0.1:1',client_token=token,mcp_server='comfytv'))
        assert store.effective('http://localhost:9','other')['client_token']==token
        crypto.check(store.backend.path)
        assert legacy.read_bytes()==original and crypto._sddl(legacy)==legacy_sddl
        rejected(lambda:crypto.check(legacy),'active_inherited_BA_rejected')
        active=store.backend.path
        acl(active,f'O:BAD:P(A;;FA;;;SY)(A;;FA;;;{sid})')
        rejected(store.read,'active_BA_owner_rejected'); crypto.secure(active)
        # Genuine inherited active ACL via .NET, never an injected verifier.
        powershell("$ErrorActionPreference='Stop'; $p=$env:COMFYTV_NATIVE_FIXTURE; $a=Get-Acl -LiteralPath $p; $a.SetAccessRuleProtection($false,$false); Set-Acl -LiteralPath $p -AclObject $a",active)
        rejected(store.read,'active_unprotected_rejected'); crypto.secure(active)
        acl(legacy,f'O:BAD:P(A;;FA;;;SY)(A;;FA;;;{sid})(A;;FR;;;WD)')
        rejected(store.legacy_token,'legacy_extra_principal_rejected')
        acl(legacy,f'O:SYD:P(A;;FA;;;SY)(A;;FA;;;{sid})')
        rejected(store.legacy_token,'legacy_unsafe_owner_rejected')
        # Restore only the synthetic fixture; production ACLs are never repaired.
        acl(legacy,f'O:{sid}D:P(A;;FA;;;SY)(A;;FA;;;{sid})')
        link=directory/'legacy-hardlink'; os.link(legacy,link)
        rejected(store.legacy_token,'legacy_hardlink_rejected'); link.unlink()
        legacy.write_bytes(b'x'*16385); rejected(store.legacy_token,'legacy_oversize_rejected'); legacy.write_bytes(original)
        acl(directory,f'O:{sid}D:(A;OICI;FA;;;SY)(A;OICI;FA;;;{sid})',False)
        rejected(store.legacy_token,'unprotected_parent_rejected')
        crypto.secure(directory)
        acl(directory,f'O:BAD:P(A;;FA;;;SY)(A;;FA;;;{sid})')
        rejected(store.legacy_token,'unsafe_parent_owner_rejected'); crypto.secure(directory)
        # Ancestor reparse rejection on legacy, using a native directory junction.
        junction=root/'junction'
        p=subprocess.run(['cmd','/c','mklink','/J',str(junction),str(directory)],capture_output=True)
        assert p.returncode==0
        try: rejected(lambda:crypto.check_legacy(junction/'client-key.dpapi',junction),'ancestor_reparse_rejected')
        finally: junction.rmdir()
        rejected(lambda:crypto.check_legacy(legacy,root),'wrong_namespace_rejected')
        result=dict(native_windows_verified=True,historical_parent_sddl=parent_sddl,historical_legacy_sddl=legacy_sddl,legacy_decrypt=True,strict_active_write=True,environmentless_effective=True,pre_migration_public_status=True,legacy_unchanged=True,rejected=checks,production_touched=False)
    finally:
        if old_env is not None: os.environ['COMFYTV_HERMES_API_KEY']=old_env
        shutil.rmtree(root,ignore_errors=False)
        assert not root.exists(), 'fixture cleanup failed'
    result['fixture_cleanup_verified']=True
    print(json.dumps(result)); return 0


if __name__=='__main__': raise SystemExit(main())
