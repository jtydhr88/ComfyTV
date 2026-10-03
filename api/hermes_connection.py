"""Trusted Settings onboarding. Client secrets never enter ordinary settings."""
import asyncio
import json
import re
import secrets
import hmac
import aiohttp
from aiohttp import web
from .. import storage
from ..bot import hermes_credentials as credentials
from . import hermes_interactions
from ._common import routes

PREFIX = '/comfytv/hermes/connection'
LOCK = asyncio.Lock()


class ConnectionError(Exception):
    def __init__(self, code, status=502):
        self.code, self.status = code, status
        super().__init__(code)


def settings():
    return (str(storage.get_setting('bot-hermes-url') or '').rstrip('/'),
            str(storage.get_setting('bot-hermes-mcp-server') or 'comfytv'))


def public(request):
    try:
        hermes_interactions.CHANNELS.validate(request, control=request.method != 'GET')
        can = True
    except ValueError:
        can = False
    return credentials.get_store().public(*settings(), can_manage=can)


@routes.get(PREFIX)
async def connection_status(request):
    return web.json_response(public(request), headers={'Cache-Control':'no-store'})


def strict(raw):
    def pairs(items):
        result = {}
        for k,v in items:
            if k in result: raise ValueError()
            result[k] = v
        return result
    return json.loads(raw, object_pairs_hook=pairs, parse_constant=lambda _: (_ for _ in ()).throw(ValueError()))


async def remote(endpoint, path, token=None, body=None, *, optional=False):
    headers = {'Authorization':'Bearer '+token} if token else {}
    try:
        async with aiohttp.ClientSession(headers=headers,trust_env=False,timeout=aiohttp.ClientTimeout(total=20,connect=5),auto_decompress=False) as client:
            async with client.request('POST' if body is not None else 'GET', endpoint+path,json=body,allow_redirects=False) as response:
                if optional and response.status==404: return None
                claim_rejection = response.status == 400 and path == '/v1/pairing/claim' and body is not None
                if response.status != 200 and not claim_rejection: raise ConnectionError('broker_auth_rejected' if response.status in (401,403) else 'broker_protocol_invalid')
                if response.content_type!='application/json' or response.headers.get('Content-Encoding'): raise ConnectionError('broker_protocol_invalid')
                raw=bytearray()
                limit = 8192 if claim_rejection else 65536
                async for chunk in response.content.iter_chunked(8192):
                    raw.extend(chunk)
                    if len(raw)>limit: raise ConnectionError('broker_protocol_invalid')
                result=strict(raw.decode('utf-8') if claim_rejection else raw)
                if not isinstance(result,dict): raise ConnectionError('broker_protocol_invalid')
                if claim_rejection:
                    # Only the actual broker's exact, bounded error envelope proves
                    # this claim was rejected; arbitrary HTTP400 remains unknown.
                    raise ConnectionError('broker_pairing_rejected' if result == {'error':'pairing_rejected'} else 'broker_protocol_invalid')
                return result
    except (aiohttp.ClientError,asyncio.TimeoutError):
        raise ConnectionError('broker_unreachable') from None
    except (ValueError,TypeError,RecursionError):
        raise ConnectionError('broker_protocol_invalid') from None


async def verify(endpoint, token, server):
    caps=await remote(endpoint,'/v1/capabilities',token)
    auth=caps.get('auth') or {}; restrictions=caps.get('restrictions') or {}; features=caps.get('features') or {}
    required=('run_submission','run_status','run_events_sse','run_stop','run_approval_response','approval_events','session_resources')
    if (caps.get('object')!='hermes.api_server.capabilities' or auth.get('type')!='bearer' or auth.get('required') is not True or restrictions.get('scope')!='owned-only' or restrictions.get('admin') is not False or any(features.get(k) is not True for k in required) or (features.get('runs_idempotency') or {}).get('supported') is not True):
        raise ConnectionError('restricted_broker_required')
    receipt=await remote(endpoint,'/v1/client/credential',token,optional=True)
    if receipt is not None:
        expected={'schema_version','credential_id','server_id','client_id','mcp_server','model','managed'}
        if (set(receipt)!=expected or type(receipt['schema_version']) is not int or receipt['schema_version']!=1 or type(receipt['managed']) is not bool or receipt['mcp_server']!=server or not isinstance(receipt['client_id'],str) or not receipt['client_id'] or not isinstance(receipt['model'],str) or not re.fullmatch('[0-9a-f]{32}',receipt['server_id'] or '') or (receipt['credential_id'] is not None and not re.fullmatch('[0-9a-f]{32}',receipt['credential_id']))):
            raise ConnectionError('broker_binding_mismatch')
    return dict(mode='active',endpoint=endpoint,client_token=token,mcp_server=server,credential_id=receipt['credential_id'] if receipt else None,server_id=receipt['server_id'] if receipt else None)


async def pair(store, body):
    existing = store.read()
    fresh = not (existing and existing.get('mode') == 'pending')
    if existing and existing.get('mode') == 'pending':
        pending=existing
        if pending.get('operation')!='pair' or pending['endpoint']!=body['endpoint'] or not hmac.compare_digest(pending['pairing_code'],body['pairing_code']):
            raise ConnectionError('setup_pending',409)
    else:
        pending=dict(mode='pending',operation='pair',endpoint=body['endpoint'],pairing_code=body['pairing_code'],client_token=secrets.token_urlsafe(48),mcp_server='comfytv',previous=existing)
        # Mandatory durable secret BEFORE first possible remote registration.
        store.save(pending)
    try:
        if not fresh:
            # Read-only reconciliation works even after the one-time code expires.
            try:
                binding=await remote(pending['endpoint'],'/v1/client/credential',pending['client_token'])
                active=await verify(pending['endpoint'],pending['client_token'],credentials.validate_server(binding['mcp_server']))
            except ConnectionError as exc:
                if exc.code!='broker_auth_rejected': raise
            else:
                if active['credential_id'] is None: raise ConnectionError('broker_protocol_invalid')
                store.save(active)
                return
        try:
            receipt=await remote(pending['endpoint'],'/v1/pairing/claim',body={'schema_version':1,'pairing_code':pending['pairing_code'],'client_token':pending['client_token']})
        except ConnectionError as exc:
            if fresh and exc.code in ('broker_auth_rejected','broker_pairing_rejected'):
                store.save(existing or {'mode':'unconfigured'})
                raise ConnectionError('pairing_rejected') from None
            raise
        if (set(receipt)!={'schema_version','status','credential_id','server_id','client_id','mcp_server','model'} or type(receipt['schema_version']) is not int or receipt['schema_version']!=1 or receipt['status']!='paired' or not re.fullmatch('[0-9a-f]{32}',receipt['credential_id']) or not re.fullmatch('[0-9a-f]{32}',receipt['server_id'])):
            raise ConnectionError('broker_protocol_invalid')
        server=credentials.validate_server(receipt['mcp_server'])
        active=await verify(pending['endpoint'],pending['client_token'],server)
        if active['credential_id']!=receipt['credential_id'] or active['server_id']!=receipt['server_id']: raise ConnectionError('broker_binding_mismatch')
        store.save(active)
    except ConnectionError as exc:
        if exc.code=='pairing_rejected': raise
        raise ConnectionError('setup_pending',409) from None
    except (credentials.StoreError,ValueError,TypeError,KeyError):
        # Accepted rotation may already have invalidated previous. Never restore it.
        raise ConnectionError('setup_pending',409) from None


FIELDS={'import':{'endpoint','client_token','mcp_server'},'pair':{'endpoint','pairing_code'},'migrate':{'from'},'disconnect':{'revoke_remote'},'test':set()}


def work_active():
    from .bot_turns import ACTIVE_TURNS
    # Resolve newly admitted turns too; unidentified work fails closed.
    for chat_id in ACTIVE_TURNS:
        try: chat=storage.get_bot_chat(chat_id)
        except Exception: return True
        if not chat or chat.get('provider')=='hermes': return True
    return False


def commit(store, record):
    if work_active(): raise ConnectionError('hermes_work_active',409)
    store.save(record)


async def dispatch(request, operation):
    try: hermes_interactions.CHANNELS.validate(request)
    except ValueError: return web.json_response({'error':'local_authorization_required'},status=403)
    try:
        raw=bytearray()
        async for chunk in request.content.iter_chunked(8192):
            raw.extend(chunk)
            if len(raw)>8192: raise ValueError()
        body=strict(raw)
        if not isinstance(body,dict) or set(body)!=FIELDS[operation]|{'schema_version'} or type(body['schema_version']) is not int or body['schema_version']!=1: raise ValueError()
        if operation=='migrate' and body['from'] not in ('environment','legacy_dpapi'): raise ValueError()
        if operation=='disconnect' and type(body['revoke_remote']) is not bool: raise ValueError()
        if operation=='pair':
            body['endpoint']=credentials.validate_endpoint(body['endpoint'])
            if not isinstance(body['pairing_code'],str) or not 16<=len(body['pairing_code'])<=1024 or not body['pairing_code'].isascii() or any(ord(c)<=32 or ord(c)>=127 for c in body['pairing_code']): raise ValueError()
        if operation=='import':
            body['endpoint']=credentials.validate_endpoint(body['endpoint'])
            credentials.validate_server(body['mcp_server'])
            if not isinstance(body['client_token'],str) or not 16<=len(body['client_token'])<=4096 or not body['client_token'].isascii() or any(ord(c)<=32 or ord(c)>=127 for c in body['client_token']): raise ValueError()
    except (ValueError,TypeError,RecursionError):
        return web.json_response({'error':'invalid_request'},status=400)
    try:
        if LOCK.locked(): raise ConnectionError('setup_busy',409)
        if operation!='test' and work_active(): raise ConnectionError('hermes_work_active',409)
        async with LOCK:
            store=credentials.get_store()
            if operation=='migrate':
                current=store.read()
                if current and current.get('mode')!='unconfigured': raise ConnectionError('connection_already_configured',409)
                import os
                token=os.environ.get('COMFYTV_HERMES_API_KEY','') if body['from']=='environment' else store.legacy_token()
                if not token: raise ConnectionError('migration_unavailable',409)
                endpoint,server=settings()
                commit(store, await verify(credentials.validate_endpoint(endpoint),token,credentials.validate_server(server)))
                return web.json_response({'schema_version':1,'status':'configured','connection':public(request)},headers={'Cache-Control':'no-store'})
            if operation=='disconnect':
                if not body['revoke_remote']:
                    store.save({'mode':'disabled'})
                else:
                    record=store.effective(*settings())
                    if record.get('mode')!='active': raise ConnectionError('revoke_pending' if record.get('mode')=='pending' else 'connection_not_configured',409)
                    endpoint=credentials.validate_endpoint(record['endpoint'])
                    store.save(dict(mode='pending',operation='revoke',endpoint=endpoint,client_token=record['client_token'],mcp_server=record['mcp_server'],previous=record))
                    try:
                        receipt=await remote(endpoint,'/v1/client/revoke',record['client_token'],{'schema_version':1})
                        if receipt!={'schema_version':1,'status':'revoked'} or type(receipt['schema_version']) is not int: raise ConnectionError('broker_protocol_invalid')
                        store.save({'mode':'disabled'})
                    except (ConnectionError,credentials.StoreError):
                        raise ConnectionError('revoke_pending',409) from None
                return web.json_response({'schema_version':1,'status':'disconnected','connection':public(request)},headers={'Cache-Control':'no-store'})
            if operation=='pair':
                await pair(store,body)
                return web.json_response({'schema_version':1,'status':'configured','connection':public(request)},headers={'Cache-Control':'no-store'})
            if operation=='import':
                if (store.read() or {}).get('mode')=='pending': raise ConnectionError('setup_pending',409)
                commit(store, await verify(body['endpoint'],body['client_token'],body['mcp_server']))
                return web.json_response({'schema_version':1,'status':'configured','connection':public(request)},headers={'Cache-Control':'no-store'})
            record=store.effective(*settings())
            if record.get('mode')!='active': raise ConnectionError('connection_not_configured',409)
            await verify(credentials.validate_endpoint(record['endpoint']),record['client_token'],credentials.validate_server(record['mcp_server']))
            return web.json_response({'schema_version':1,'status':'ok','authenticated':True},headers={'Cache-Control':'no-store'})
    except credentials.StoreError as exc:
        return web.json_response({'error':exc.reason},status=409)
    except ConnectionError as exc:
        return web.json_response({'error':exc.code},status=exc.status)
    except (ValueError,TypeError,KeyError,AttributeError):
        return web.json_response({'error':'broker_protocol_invalid'},status=502)


@routes.post(PREFIX+'/test')
async def connection_test(request): return await dispatch(request,'test')


@routes.post(PREFIX+'/import')
async def connection_import(request): return await dispatch(request,'import')


@routes.post(PREFIX+'/pair')
async def connection_pair(request): return await dispatch(request,'pair')


@routes.post(PREFIX+'/migrate')
async def connection_migrate(request): return await dispatch(request,'migrate')


@routes.post(PREFIX+'/disconnect')
async def connection_disconnect(request): return await dispatch(request,'disconnect')
