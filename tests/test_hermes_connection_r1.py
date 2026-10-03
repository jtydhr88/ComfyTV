"""R1 wire regression: actual broker envelope, bounded local HTTP fault cases.

Synthetic responses here test the TV trust boundary; the separate fix1 actual
candidate-broker harness proves cross-layer behavior without replacing handlers.
"""
import pytest
from aiohttp import web
from aiohttp.test_utils import TestServer

from ComfyTV.api import hermes_connection as hc
from ComfyTV.bot import hermes
from test_hermes_connection import authorize, restricted_broker
from test_hermes_credentials import Vault


REJECTION = b'{"error":"pairing_rejected"}'


@pytest.fixture
async def wire_broker():
    state = dict(status=400, raw=REJECTION, headers={}, calls=0)

    async def handler(request):
        state['calls'] += 1
        if state.get('reconcile401') and request.path == '/v1/client/credential':
            return web.json_response({'error': 'auth'}, status=401)
        if state.get('drop'):
            request.transport.close()
            return web.Response()
        return web.Response(status=state['status'], body=state['raw'],
                            headers={'Content-Type': 'application/json', **state['headers']})

    app = web.Application()
    app.router.add_route('*', '/{tail:.*}', handler)
    async with TestServer(app) as server:
        yield str(server.make_url('/')).rstrip('/'), state


@pytest.mark.parametrize('raw', [REJECTION, REJECTION + b' ' * (8192 - len(REJECTION))],
                         ids=['actual-envelope', '8192-byte-boundary'])
async def test_bounded_actual_rejection_envelope_recognized(wire_broker, raw):
    endpoint, state = wire_broker
    state['raw'] = raw
    with pytest.raises(hc.ConnectionError) as caught:
        await hc.remote(endpoint, '/v1/pairing/claim', body={'schema_version': 1})
    assert caught.value.code == 'broker_pairing_rejected'
    assert caught.value.status == 502


BAD_RESPONSES = [
    ('arbitrary400', 400, b'{"error":"invalid_request"}', {}),
    ('empty400', 400, b'', {}),
    ('malformed', 400, b'{"error":', {}),
    ('duplicate', 400, b'{"error":"pairing_rejected","error":"pairing_rejected"}', {}),
    ('extra', 400, b'{"error":"pairing_rejected","schema_version":1}', {}),
    ('array', 400, b'[{"error":"pairing_rejected"}]', {}),
    ('wrong-type', 400, b'{"error":true}', {}),
    ('constant', 400, b'{"error":NaN}', {}),
    ('invalid-utf8', 400, REJECTION + b'\xff', {}),
    ('utf16', 400, REJECTION.decode().encode('utf-16'), {}),
    ('oversize', 400, REJECTION + b' ' * (8193 - len(REJECTION)), {}),
    ('html', 400, REJECTION, {'Content-Type': 'text/html'}),
    ('encoded', 400, REJECTION, {'Content-Encoding': 'gzip'}),
    ('redirect', 302, REJECTION, {'Location': '/v1/pairing/claim'}),
    ('server-error', 500, REJECTION, {}),
]


@pytest.mark.parametrize('name,status,raw,headers', BAD_RESPONSES, ids=[x[0] for x in BAD_RESPONSES])
async def test_untrusted_rejection_stays_pending(bot_client, wire_broker, monkeypatch,
                                                 name, status, raw, headers):
    endpoint, state = wire_broker
    state.update(status=status, raw=raw, headers=headers)
    store = hermes.credentials.CredentialStore(backend=Vault())
    previous = dict(mode='active', endpoint=endpoint, client_token='previous-dedicated-token',
                    mcp_server='comfytv', credential_id=None)
    store.save(previous)
    monkeypatch.setattr(hermes.credentials, '_DEFAULT', store)
    auth = await authorize(bot_client)
    response = await bot_client.post(hc.PREFIX + '/pair', headers=auth, json={
        'schema_version': 1, 'endpoint': endpoint, 'pairing_code': 'invalid-unissued-code'})
    assert response.status == 409
    assert await response.json() == {'error': 'setup_pending'}
    record = store.read()
    assert record['mode'] == 'pending'
    assert record['previous'] == previous
    assert not store.public(endpoint, 'comfytv')['configured']
    assert state['calls'] == 1  # no redirect follow-up


@pytest.mark.parametrize('path,body', [('/v1/client/credential', None),
                                       ('/v1/client/revoke', {'schema_version': 1}),
                                       ('/v1/pairing/claim', None),
                                       ('/v1/pairing/claim?x=1', {'schema_version': 1}),
                                       ('/v1/pairing/claim/', {'schema_version': 1})])
async def test_rejection_recognition_is_exact_claim_post_only(wire_broker, path, body):
    endpoint, _ = wire_broker
    with pytest.raises(hc.ConnectionError) as caught:
        await hc.remote(endpoint, path, body=body)
    assert caught.value.code == 'broker_protocol_invalid'


@pytest.mark.parametrize('status', [401, 403])
async def test_existing_auth_rejection_semantics_unchanged(wire_broker, status):
    endpoint, state = wire_broker
    state.update(status=status, raw=b'not-json')
    with pytest.raises(hc.ConnectionError) as caught:
        await hc.remote(endpoint, '/v1/pairing/claim', body={'schema_version': 1})
    assert caught.value.code == 'broker_auth_rejected'


async def test_fresh_validated400_rolls_back_previous(bot_client, restricted_broker, monkeypatch):
    endpoint, state = restricted_broker
    store = hermes.credentials.CredentialStore(backend=Vault())
    monkeypatch.setattr(hermes.credentials, '_DEFAULT', store)
    auth = await authorize(bot_client)
    response = await bot_client.post(hc.PREFIX + '/import', headers=auth, json={
        'schema_version': 1, 'endpoint': endpoint, 'client_token': state['token'], 'mcp_server': 'comfytv'})
    assert response.status == 200
    previous = store.read()
    # Use a real local socket for the claim failure while retaining the verified old binding.
    async def reject(request):
        return web.json_response({'error': 'pairing_rejected'}, status=400)
    app = web.Application()
    app.router.add_post('/v1/pairing/claim', reject)
    async with TestServer(app) as server:
        response = await bot_client.post(hc.PREFIX + '/pair', headers=auth, json={
            'schema_version': 1, 'endpoint': str(server.make_url('/')).rstrip('/'),
            'pairing_code': 'invalid-unissued-code'})
        assert response.status == 502
        assert await response.json() == {'error': 'pairing_rejected'}
    assert store.read() == previous
    assert hermes.HermesProvider()._config() == (endpoint, state['token'], 'comfytv')


async def test_transport_error_remains_unknown(bot_client, wire_broker, monkeypatch):
    endpoint, state = wire_broker
    state['drop'] = True
    store = hermes.credentials.CredentialStore(backend=Vault())
    monkeypatch.setattr(hermes.credentials, '_DEFAULT', store)
    auth = await authorize(bot_client)
    response = await bot_client.post(hc.PREFIX + '/pair', headers=auth, json={
        'schema_version': 1, 'endpoint': endpoint, 'pairing_code': 'invalid-unissued-code'})
    assert response.status == 409
    assert await response.json() == {'error': 'setup_pending'}
    assert store.read()['mode'] == 'pending'


@pytest.mark.parametrize('status', [400, 401, 403])
async def test_previously_pending_explicit_rejection_never_restores_previous(
        bot_client, wire_broker, monkeypatch, status):
    endpoint, state = wire_broker
    state.update(status=status, reconcile401=True)
    store = hermes.credentials.CredentialStore(backend=Vault())
    previous = dict(mode='active', endpoint=endpoint, client_token='invalidated-old-token',
                    mcp_server='comfytv', credential_id=None)
    pending = dict(mode='pending', operation='pair', endpoint=endpoint,
                   pairing_code='previously-unknown-code', client_token='pending-dedicated-token',
                   mcp_server='comfytv', previous=previous)
    store.save(pending)
    monkeypatch.setattr(hermes.credentials, '_DEFAULT', store)
    monkeypatch.delenv('COMFYTV_HERMES_API_KEY', raising=False)
    auth = await authorize(bot_client)
    response = await bot_client.post(hc.PREFIX + '/pair', headers=auth, json={
        'schema_version': 1, 'endpoint': endpoint, 'pairing_code': pending['pairing_code']})
    assert response.status == 409
    assert await response.json() == {'error': 'setup_pending'}
    assert store.read() == pending
    with pytest.raises(hermes._Unavailable):
        hermes.HermesProvider()._config()
    assert state['calls'] == 2  # credential reconciliation, then same-token claim
