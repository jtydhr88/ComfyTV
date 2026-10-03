"""Actual TV handlers + real local HTTP restricted broker CONTRACT FIXTURE.
This fixture is not the companion broker implementation or production evidence.
"""
import json
import pytest
from aiohttp import web
from ComfyTV.bot import hermes
from ComfyTV.api import hermes_interactions
from test_hermes_credentials import Vault


async def authorize(client):
    headers={'Origin':str(client.make_url('/')).rstrip('/'),'X-ComfyTV-Interaction':'1'}
    r=await client.post('/comfytv/agent/interactions/channel',json={'version':1,'kinds':['hermes_approval','hermes_question']},headers=headers)
    body=await r.json()
    headers.update({'Cookie':hermes_interactions.COOKIE+'='+r.cookies[hermes_interactions.COOKIE].value,'X-ComfyTV-Interaction-Channel':body['channel_id'],'X-ComfyTV-Interaction-CSRF':body['csrf_token']})
    return headers


async def test_public_status_trust_and_strict_body(bot_client,monkeypatch):
    monkeypatch.delenv('COMFYTV_HERMES_API_KEY',raising=False)
    r=await bot_client.get('/comfytv/hermes/connection')
    assert r.status==200, 'connection routes not wired'
    status=await r.json()
    assert set(status)=={'schema_version','source','configured','endpoint','mcp_server','credential_id','secure_storage','migration','can_manage'}
    assert not status['can_manage']
    denied=await bot_client.post('/comfytv/hermes/connection/test',json={'schema_version':1})
    assert denied.status==403
    headers=await authorize(bot_client)
    for raw in ['{"schema_version":1,"schema_version":1}', '{"schema_version":true}', '{"schema_version":1,"private_path":"x"}', ' '*8193]:
        r=await bot_client.post('/comfytv/hermes/connection/test',data=raw,headers={**headers,'Content-Type':'application/json'})
        assert r.status==400
    r=await bot_client.get('/comfytv/hermes/connection',headers=headers)
    assert (await r.json())['can_manage']


@pytest.fixture
async def restricted_broker():
    state={'token':'existing-dedicated-token','calls':[], 'admin':False, 'redirect':False, 'lost':False}
    async def handler(request):
        state['calls'].append((request.method,request.path,request.headers.get('Authorization')))
        if request.path == '/v1/pairing/claim':
            body=await request.json()
            if state.get('claims_expired') or body['pairing_code'] != 'trusted-one-time-code': return web.json_response({'error':'invalid'},status=403)
            state['token']=body['client_token']
            if state['lost']:
                state['lost']=False
                request.transport.close()
                return web.Response()
            return web.json_response(dict(schema_version=1,status='paired',credential_id='a'*32,server_id='b'*32,client_id='owner',mcp_server='comfytv',model='model'))
        if request.headers.get('Authorization') != 'Bearer '+state['token']: return web.json_response({'error':'auth'},status=401)
        if state['redirect']: raise web.HTTPFound('/elsewhere')
        if request.path == '/v1/capabilities':
            if state.get('pause'):
                state['entered'].set(); await state['release'].wait()
            return web.json_response({'object':'hermes.api_server.capabilities','auth':{'type':'bearer','required':True},'restrictions':{'scope':'all','admin':True} if state.get('raw_main') else {'scope':'owned-only','admin':state['admin']},'features':{**{k:True for k in ('run_submission','run_status','run_events_sse','run_stop','run_approval_response','approval_events','session_resources')},'runs_idempotency':{'supported':True}}})
        if request.path == '/v1/client/credential':
            if state.get('bad_receipt'): return web.json_response({'schema_version':1,'token':'should-never-echo'})
            return web.json_response(dict(schema_version=1,credential_id='a'*32,server_id='b'*32,client_id='owner',mcp_server='wrong' if state.get('wrong_binding') else 'comfytv',model='model',managed=True))
        if request.path == '/v1/client/revoke':
            state['token']='revoked'
            if state.get('lose_revoke'):
                request.transport.close(); return web.Response()
            return web.json_response({'schema_version':1,'status':'revoked'})
        return web.json_response({'error':'not_found'},status=404)
    app=web.Application(); app.router.add_route('*','/{tail:.*}',handler)
    from aiohttp.test_utils import TestServer
    server=TestServer(app); await server.start_server()
    try: yield str(server.make_url('/')).rstrip('/'),state
    finally: await server.close()


async def test_import_verify_test_and_provider_without_environment(bot_client,restricted_broker,monkeypatch):
    endpoint,state=restricted_broker
    store=hermes.credentials.CredentialStore(backend=Vault())
    monkeypatch.setattr(hermes.credentials,'_DEFAULT',store)
    monkeypatch.delenv('COMFYTV_HERMES_API_KEY',raising=False)
    headers=await authorize(bot_client)
    r=await bot_client.post('/comfytv/hermes/connection/import',json={'schema_version':1,'endpoint':endpoint,'client_token':state['token'],'mcp_server':'comfytv'},headers=headers)
    assert r.status==200, await r.text()
    assert (await r.json())['status']=='configured'
    assert hermes.HermesProvider()._config()==(endpoint,state['token'],'comfytv')
    r=await bot_client.post('/comfytv/hermes/connection/test',json={'schema_version':1},headers=headers)
    assert await r.json()=={'schema_version':1,'status':'ok','authenticated':True}
    assert all(path not in ('/v1/runs','/api/sessions') for _,path,_ in state['calls'])


async def test_pair_lost_response_retry_uses_persisted_token(bot_client,restricted_broker,monkeypatch):
    endpoint,state=restricted_broker; state['lost']=True
    vault=Vault(); store=hermes.credentials.CredentialStore(backend=vault)
    monkeypatch.setattr(hermes.credentials,'_DEFAULT',store)
    headers=await authorize(bot_client)
    body={'schema_version':1,'endpoint':endpoint,'pairing_code':'trusted-one-time-code'}
    r=await bot_client.post('/comfytv/hermes/connection/pair',json=body,headers=headers)
    assert r.status==409, await r.text()
    assert (await r.json())['error']=='setup_pending'
    pending=store.read()
    assert pending['mode']=='pending' and pending['client_token']==state['token']
    token=state['token']; assert len(token)>=43
    status=await (await bot_client.get('/comfytv/hermes/connection')).json()
    assert not status['configured'] and status['secure_storage']['reason']=='setup_pending'
    assert status['source']=='secure_store'
    assert token not in json.dumps(status) and body['pairing_code'] not in json.dumps(status)
    r=await bot_client.post('/comfytv/hermes/connection/pair',json={**body,'pairing_code':'different-valid-code'},headers=headers)
    assert r.status==409
    r=await bot_client.post('/comfytv/hermes/connection/pair',json=body,headers=headers)
    assert r.status==200, await r.text()
    assert state['token']==token and store.read()['mode']=='active'


async def test_pair_storage_failure_never_claims_or_loses_recovery(bot_client,restricted_broker,monkeypatch):
    endpoint,state=restricted_broker
    class FailureVault(Vault):
        fail_at=1; writes=0
        def write(self,value):
            self.writes+=1
            if self.writes==self.fail_at: raise OSError('fixture storage failure')
            super().write(value)
    vault=FailureVault(); store=hermes.credentials.CredentialStore(backend=vault)
    monkeypatch.setattr(hermes.credentials,'_DEFAULT',store)
    headers=await authorize(bot_client); body={'schema_version':1,'endpoint':endpoint,'pairing_code':'trusted-one-time-code'}
    r=await bot_client.post('/comfytv/hermes/connection/pair',json=body,headers=headers)
    assert r.status==409 and not state['calls']
    vault.fail_at=vault.writes+2
    r=await bot_client.post('/comfytv/hermes/connection/pair',json=body,headers=headers)
    assert r.status==409 and store.read()['mode']=='pending'
    token=state['token']; state['claims_expired']=True
    r=await bot_client.post('/comfytv/hermes/connection/pair',json=body,headers=headers)
    assert r.status==200 and state['token']==token


async def test_known_pair_rejection_preserves_previous_connection(bot_client,restricted_broker,monkeypatch):
    endpoint,state=restricted_broker
    store=hermes.credentials.CredentialStore(backend=Vault())
    old=dict(mode='active',endpoint=endpoint,client_token=state['token'],mcp_server='comfytv',credential_id=None)
    store.save(old); monkeypatch.setattr(hermes.credentials,'_DEFAULT',store)
    headers=await authorize(bot_client)
    r=await bot_client.post('/comfytv/hermes/connection/pair',json={'schema_version':1,'endpoint':endpoint,'pairing_code':'invalid-unclaimed-code'},headers=headers)
    assert r.status==502 and store.read()==old


@pytest.mark.parametrize('revoke',[False,True])
async def test_migrate_environment_then_disconnect_persists_tombstone(bot_client,restricted_broker,monkeypatch,revoke):
    from ComfyTV import storage
    endpoint,state=restricted_broker
    storage.set_settings({'bot-hermes-url':endpoint,'bot-hermes-mcp-server':'comfytv'})
    monkeypatch.setenv('COMFYTV_HERMES_API_KEY',state['token'])
    store=hermes.credentials.CredentialStore(backend=Vault()); monkeypatch.setattr(hermes.credentials,'_DEFAULT',store)
    headers=await authorize(bot_client)
    r=await bot_client.post('/comfytv/hermes/connection/migrate',json={'schema_version':1,'from':'environment'},headers=headers)
    assert r.status==200, await r.text()
    assert store.public(endpoint,'comfytv')['source']=='secure_store'
    monkeypatch.delenv('COMFYTV_HERMES_API_KEY')
    assert hermes.HermesProvider()._config()[1]==state['token']
    monkeypatch.setenv('COMFYTV_HERMES_API_KEY','still-inherited')
    r=await bot_client.post('/comfytv/hermes/connection/disconnect',json={'schema_version':1,'revoke_remote':revoke},headers=headers)
    assert r.status==200, await r.text()
    assert (await r.json())['status']=='disconnected'
    assert store.public(endpoint,'comfytv')['source']=='disabled'
    assert any(path=='/v1/client/revoke' for _,path,_ in state['calls'])==revoke
    with pytest.raises(hermes._Unavailable): hermes.HermesProvider()._config()


async def test_generic_binding_settings_require_channel_and_active_setup_blocked(bot_client,restricted_broker,monkeypatch):
    from ComfyTV import storage
    from ComfyTV.api import bot_turns
    endpoint,state=restricted_broker
    headers=await authorize(bot_client)
    for key,value in [('bot-hermes-url',endpoint),('bot-hermes-mcp-server','alternate'),('bot-model-hermes','another-model')]:
        r=await bot_client.put('/comfytv/settings',json={'values':{key:value}})
        assert r.status==403
        r=await bot_client.put('/comfytv/settings',json={'values':{key:value}},headers=headers)
        assert r.status==200
    monkeypatch.setattr(hermes.credentials,'_DEFAULT',hermes.credentials.CredentialStore(backend=Vault()))
    monkeypatch.setitem(bot_turns.ACTIVE_TURNS,'test-active',object())
    r=await bot_client.post('/comfytv/hermes/connection/import',json={'schema_version':1,'endpoint':endpoint,'client_token':state['token'],'mcp_server':'comfytv'},headers=headers)
    assert r.status==409 and (await r.json())['error']=='hermes_work_active'
    assert not state['calls']


async def test_legacy_dpapi_api_migration_real_file_fixture(bot_client,restricted_broker,monkeypatch,tmp_path):
    from ComfyTV import storage
    endpoint,state=restricted_broker
    storage.set_settings({'bot-hermes-url':endpoint,'bot-hermes-mcp-server':'comfytv'})
    class Crypto:
        # Deterministic injected crypto ONLY; native DPAPI runs separately.
        def protect(self,data): return data[::-1]
        def unprotect(self,data): return data[::-1]
        def secure(self,path): path.chmod(0o700 if path.is_dir() else 0o600)
        def check(self,path):
            if path.is_symlink() or path.stat().st_mode & 0o077: raise OSError('unsafe fixture path')
    backend=hermes.credentials.EncryptedFileBackend(tmp_path/'isolated',crypto=Crypto())
    backend.directory.mkdir(); backend.crypto.secure(backend.directory)
    legacy=backend.directory/'client-key.dpapi'
    legacy.write_bytes(backend.crypto.protect(state['token'].encode())); backend.crypto.secure(legacy)
    store=hermes.credentials.CredentialStore(backend=backend); monkeypatch.setattr(hermes.credentials,'_DEFAULT',store)
    monkeypatch.delenv('COMFYTV_HERMES_API_KEY',raising=False)
    headers=await authorize(bot_client)
    r=await bot_client.post('/comfytv/hermes/connection/migrate',json={'schema_version':1,'from':'legacy_dpapi'},headers=headers)
    assert r.status==200, await r.text()
    assert legacy.exists() and hermes.HermesProvider()._config()==(endpoint,state['token'],'comfytv')



async def test_revoke_unknown_delivery_is_not_retried_or_claimed_success(bot_client,restricted_broker,monkeypatch):
    endpoint,state=restricted_broker; state['lose_revoke']=True
    store=hermes.credentials.CredentialStore(backend=Vault())
    store.save(dict(mode='active',endpoint=endpoint,client_token=state['token'],mcp_server='comfytv',credential_id=None))
    monkeypatch.setattr(hermes.credentials,'_DEFAULT',store)
    headers=await authorize(bot_client); body={'schema_version':1,'revoke_remote':True}
    r=await bot_client.post('/comfytv/hermes/connection/disconnect',json=body,headers=headers)
    assert r.status==409 and (await r.json())['error']=='revoke_pending'
    status=await (await bot_client.get('/comfytv/hermes/connection')).json()
    assert status['secure_storage']['reason']=='revoke_pending'
    r=await bot_client.post('/comfytv/hermes/connection/disconnect',json=body,headers=headers)
    assert r.status==409
    assert sum(path=='/v1/client/revoke' for _,path,_ in state['calls'])==1
    r=await bot_client.post('/comfytv/hermes/connection/disconnect',json={'schema_version':1,'revoke_remote':False},headers=headers)
    assert r.status==200 and store.read()['mode']=='disabled'


async def test_mutations_serialized_and_work_arriving_before_commit_preserved(bot_client,restricted_broker,monkeypatch):
    import asyncio
    from ComfyTV.api import bot_turns
    endpoint,state=restricted_broker
    state.update(pause=True,entered=asyncio.Event(),release=asyncio.Event())
    store=hermes.credentials.CredentialStore(backend=Vault()); monkeypatch.setattr(hermes.credentials,'_DEFAULT',store)
    headers=await authorize(bot_client)
    body={'schema_version':1,'endpoint':endpoint,'client_token':state['token'],'mcp_server':'comfytv'}
    first=asyncio.create_task(bot_client.post('/comfytv/hermes/connection/import',json=body,headers=headers))
    await state['entered'].wait()
    r=await bot_client.post('/comfytv/hermes/connection/import',json=body,headers=headers)
    assert r.status==409 and (await r.json())['error']=='setup_busy'
    monkeypatch.setitem(bot_turns.ACTIVE_TURNS,'new-active',object()); state['release'].set()
    r=await first
    assert r.status==409 and (await r.json())['error']=='hermes_work_active'
    assert store.read() is None


@pytest.mark.parametrize('mode',['admin','redirect','wrong_binding','raw_main','bad_receipt'])
async def test_import_rejects_unrestricted_redirect_or_mismatched_broker(bot_client,restricted_broker,monkeypatch,mode,caplog):
    endpoint,state=restricted_broker; state[mode]=True
    vault=Vault(); store=hermes.credentials.CredentialStore(backend=vault)
    previous=dict(mode='active',endpoint='http://localhost:12345',client_token='previous-client-secret',mcp_server='comfytv',credential_id=None)
    store.save(previous); monkeypatch.setattr(hermes.credentials,'_DEFAULT',store)
    headers=await authorize(bot_client)
    r=await bot_client.post('/comfytv/hermes/connection/import',json={'schema_version':1,'endpoint':endpoint,'client_token':state['token'],'mcp_server':'comfytv'},headers=headers)
    assert r.status==502, await r.text()
    assert store.read()==previous
    assert state['token'] not in await r.text() and state['token'] not in caplog.text
    assert not any(path=='/elsewhere' for _,path,_ in state['calls'])


@pytest.mark.parametrize('endpoint',['http://192.168.1.2','https://user:pass@example.com','https://example.com?x=1','https://example.com/#x','http://localhost:','file:///secret'])
async def test_unsafe_urls_rejected_before_network(bot_client,monkeypatch,endpoint):
    store=hermes.credentials.CredentialStore(backend=Vault()); monkeypatch.setattr(hermes.credentials,'_DEFAULT',store)
    headers=await authorize(bot_client)
    r=await bot_client.post('/comfytv/hermes/connection/import',json={'schema_version':1,'endpoint':endpoint,'client_token':'existing-dedicated-token','mcp_server':'comfytv'},headers=headers)
    assert r.status==400 and store.read() is None


async def test_other_provider_work_does_not_block_hermes_setup(bot_client,restricted_broker,monkeypatch):
    from ComfyTV import storage
    from ComfyTV.api import bot_turns
    endpoint,state=restricted_broker
    chat=storage.create_bot_chat(provider='claude')
    monkeypatch.setitem(bot_turns.ACTIVE_TURNS,chat['id'],object())
    store=hermes.credentials.CredentialStore(backend=Vault()); monkeypatch.setattr(hermes.credentials,'_DEFAULT',store)
    headers=await authorize(bot_client)
    r=await bot_client.post('/comfytv/hermes/connection/import',json={'schema_version':1,'endpoint':endpoint,'client_token':state['token'],'mcp_server':'comfytv'},headers=headers)
    assert r.status==200, await r.text()



async def test_status_exports_no_secret_and_edited_settings_cannot_exfiltrate_saved_token(bot_client,restricted_broker,monkeypatch):
    from ComfyTV import storage
    endpoint,state=restricted_broker
    store=hermes.credentials.CredentialStore(backend=Vault()); monkeypatch.setattr(hermes.credentials,'_DEFAULT',store)
    headers=await authorize(bot_client)
    r=await bot_client.post('/comfytv/hermes/connection/import',json={'schema_version':1,'endpoint':endpoint,'client_token':state['token'],'mcp_server':'comfytv'},headers=headers)
    assert r.status==200
    storage.set_settings({'bot-hermes-url':'http://localhost:1','bot-hermes-mcp-server':'edited'})
    count=len(state['calls'])
    status=await bot_client.get('/comfytv/hermes/connection')
    exported=await bot_client.get('/comfytv/settings')
    assert len(state['calls'])==count
    assert state['token'] not in await status.text() and state['token'] not in await exported.text()
    assert hermes.HermesProvider()._config()==(endpoint,state['token'],'comfytv')
    bot_client.session.cookie_jar.clear()
    for extra in [{'Origin':'http://evil.example'},{'Forwarded':'for=127.0.0.1'},{'X-Forwarded-For':'127.0.0.1'},{'Cookie':hermes_interactions.COOKIE+'=wrong'},{'X-ComfyTV-Interaction-CSRF':'wrong'}]:
        r=await bot_client.post('/comfytv/hermes/connection/test',json={'schema_version':1},headers={**headers,**extra})
        assert r.status==403
