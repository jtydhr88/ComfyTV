"""Local operator gate uses actual transport fixtures, never request.remote."""
import asyncio
import copy
import importlib
import json
from types import SimpleNamespace
import pytest
from ComfyTV.api import agent_routes


def module():
    assert hasattr(agent_routes,'hermes_interactions'), 'native interactions not wired'
    return agent_routes.hermes_interactions


def request(peer='127.0.0.1', host='localhost:8188', origin='http://localhost:8188', method='POST', cookie=None, **headers):
    h={'Host':host,'Content-Type':'application/json','X-ComfyTV-Interaction':'1'}
    if origin is not None: h['Origin']=origin
    h.update(headers)
    transport=SimpleNamespace(get_extra_info=lambda key: (peer,4567) if key=='peername' else None)
    async def read(): return b'{}'
    return SimpleNamespace(headers=h,transport=transport,scheme='http',method=method,cookies=cookie or {},read=read)

@pytest.mark.parametrize('peer,host,origin,allowed',[
 ('127.0.0.1','localhost:8188','http://localhost:8188',True),
 ('127.2.3.4','127.2.3.4:8188','http://127.2.3.4:8188',True),
 ('::1','[::1]:8188','http://[::1]:8188',True),
 ('::ffff:127.0.0.1','[::ffff:127.0.0.1]:8188','http://[::ffff:127.0.0.1]:8188',True),
 ('192.168.1.7','localhost:8188','http://localhost:8188',False),
 ('::ffff:192.168.1.7','localhost:8188','http://localhost:8188',False),
 ('127.0.0.1','evil.example:8188','http://evil.example:8188',False),
 ('127.0.0.1','127.0.0.1.evil:8188','http://127.0.0.1.evil:8188',False),
 ('127.0.0.1','localhost:8188','http://localhost:8189',False),
 ('127.0.0.1','localhost:8188','null',False),
 ('127.0.0.1','localhost:8188','http://user@localhost:8188',False),
 ('127.0.0.1','localhost:8188',None,False),
])
def test_direct_socket_host_origin_gate(peer,host,origin,allowed):
    gate=module().local_gate
    if allowed: assert gate(request(peer,host,origin)) is None
    else:
        with pytest.raises(ValueError): gate(request(peer,host,origin))

@pytest.mark.parametrize('headers',[{'Forwarded':'for=127.0.0.1'},{'X-Forwarded-For':'127.0.0.1'},{'X-Forwarded-Host':'localhost:8188'},{'Sec-Fetch-Site':'cross-site'},{'X-ComfyTV-Interaction':'0'},{'Content-Type':'text/plain'}])
def test_proxy_csrf_headers_failclosed(headers):
    with pytest.raises(ValueError): module().local_gate(request(**headers))


def test_channel_cookie_csrf_recovery_lease_lapse():
    m=module(); assert hasattr(m,'Channels'), 'missing server-owned HttpOnly channel lease'
    clock=[1000.0]; channels=m.Channels(clock=lambda:clock[0])
    response=channels.issue(request(),{'version':1,'kinds':['hermes_approval','hermes_question']})
    body=json.loads(response.body); cookie=response.cookies[m.COOKIE].value
    assert response.cookies[m.COOKIE]['httponly'] and response.cookies[m.COOKIE]['samesite']=='Strict'
    assert len(cookie)>=43 and body['can_respond'] is True
    h={'X-ComfyTV-Interaction-Channel':body['channel_id'],'X-ComfyTV-Interaction-CSRF':body['csrf_token']}
    valid=request(cookie={m.COOKIE:cookie},**h)
    binding=channels.validate(valid)
    assert binding.channel_id==body['channel_id']
    read=request(method='GET',origin=None,cookie={m.COOKIE:cookie},**h)
    assert channels.validate(read,control=False)==binding
    with pytest.raises(ValueError): channels.validate(request(cookie={m.COOKIE:cookie}))
    with pytest.raises(ValueError): channels.validate(request(peer='192.168.1.2',cookie={m.COOKIE:cookie},**h))
    with pytest.raises(ValueError): channels.validate(request(origin='http://evil.example',method='GET',cookie={m.COOKIE:cookie},**h),control=False)
    recovered=channels.issue(request(cookie={m.COOKIE:cookie}),{'version':1,'kinds':['hermes_approval','hermes_question']})
    assert json.loads(recovered.body)['channel_id']==binding.channel_id
    clock[0]+=121
    assert not channels.alive(binding)
    with pytest.raises(ValueError): channels.renew(valid,{'channel_id':binding.channel_id})
    new=channels.issue(request(cookie={m.COOKIE:cookie}),{'version':1,'kinds':['hermes_approval','hermes_question']})
    assert json.loads(new.body)['channel_id']!=binding.channel_id

async def test_native_channel_routes_actual_handler(bot_client,monkeypatch):
    m=module(); monkeypatch.setattr(m,'CHANNELS',m.Channels())
    origin=str(bot_client.make_url('/')).rstrip('/')
    headers={'Origin':origin,'X-ComfyTV-Interaction':'1'}
    response=await bot_client.post('/comfytv/agent/interactions/channel',json={'version':1,'kinds':['hermes_approval','hermes_question']},headers=headers)
    assert response.status==200, 'native channel issuance route missing'
    body=await response.json()
    cookie=response.cookies[m.COOKIE].value
    headers.update({'X-ComfyTV-Interaction-Channel':body['channel_id'],'X-ComfyTV-Interaction-CSRF':body['csrf_token'],'Cookie':m.COOKIE+'='+cookie})
    renew=await bot_client.post('/comfytv/agent/interactions/channel/renew',json={'channel_id':body['channel_id']},headers=headers)
    assert renew.status==200
    denied=await bot_client.post('/comfytv/agent/interactions/channel',json={'version':1,'kinds':['hermes_approval','hermes_question']})
    assert denied.status==403
    invalid=await bot_client.post('/comfytv/agent/interactions/channel',data='{"version":1,"version":1,"kinds":[]}',headers={**headers,'Content-Type':'application/json'})
    assert invalid.status==400


def upstream_snapshot(state='pending'):
    r=dict(request_id='a'*32,kind='approval',revision=1,digest='b'*64,state=state,
           created_at='2026-10-01T00:00:00Z',expires_at='2099-01-01T00:00:00Z',receipt=None,
           action=dict(command='echo harmless',description='fixture',redacted=False,truncated=False,approvable=True))
    return dict(schema_version=1,epoch='c'*32,run_id='run-1',session_id='session-1',revision=1,terminal=False,requests=[r])

async def test_standalone_store_original_binding_persist_before_broadcast(monkeypatch):
    m=module(); assert hasattr(m,'Interactions'), 'missing original-run standalone interactions store'
    from ComfyTV.api import bot_turns,agent_events
    from ComfyTV.bot.providers import TurnHandle
    from ComfyTV import storage
    channels=m.Channels(); issued=channels.issue(request(),{'version':1,'kinds':list(m.KINDS)})
    body=json.loads(issued.body); cookie=issued.cookies[m.COOKIE].value
    headers={'X-ComfyTV-Interaction-Channel':body['channel_id'],'X-ComfyTV-Interaction-CSRF':body['csrf_token']}
    browser=request(cookie={m.COOKIE:cookie},**headers); binding=channels.validate(browser)
    handle=TurnHandle(); live=bot_turns._TurnState(handle,'message-1')
    monkeypatch.setitem(bot_turns.ACTIVE_TURNS,'thread-1',live)
    order=[]
    monkeypatch.setattr(storage,'update_bot_message',lambda mid,**kw:order.append(('persist',json.loads(kw['content']))))
    monkeypatch.setattr(agent_events,'emit',lambda name,data:order.append((name,data)))
    current=upstream_snapshot(); calls=[]
    async def read(): return copy.deepcopy(current)
    async def respond(body):
        calls.append(body)
        r=current['requests'][0]; r['state']='approved'
        r['receipt']=dict(decision_digest=m.wire.decision_digest(body),state='approved',settled_at='2026-10-03T00:00:00Z')
        return {'schema_version':1,'epoch':current['epoch'],'run_id':'run-1','request':copy.deepcopy(r)}
    store=m.Interactions(channels)
    store.observe(current,binding,'thread-1','message-1','config-1',handle,read,respond)
    assert order[0][0]=='persist' and order[1][0]=='agent_interaction'
    assert order[0][1][0]['type']=='hermes_interaction'
    public=store.list('thread-1',browser)['interactions'][0]
    assert public['can_respond'] is True
    assert not any(key in json.dumps(public) for key in ['run_id','session_id','request_id','digest','epoch'])
    assert store.list('thread-1',request(peer='192.168.1.2'))['interactions'][0]['can_respond'] is False
    with pytest.raises(ValueError):
        await store.respond('thread-other',public['id'],browser,{'message_id':'message-1','revision':1,'choice':'once'})
    with pytest.raises(ValueError):
        await store.respond('thread-1',public['id'],browser,{'message_id':'message-other','revision':1,'choice':'once'})
    result=await store.respond('thread-1',public['id'],browser,{'message_id':'message-1','revision':1,'choice':'once'})
    assert result[0]==200 and result[1]['interaction']['state']=='approved' and len(calls)==1
    assert live.blocks[0]['interaction']['state']=='approved'

async def test_native_admission_binding_not_browser_mode(bot_client,fake_provider,monkeypatch):
    m=module(); channels=m.Channels(); monkeypatch.setattr(m,'CHANNELS',channels)
    origin=str(bot_client.make_url('/')).rstrip('/')
    headers={'Origin':origin,'X-ComfyTV-Interaction':'1'}
    issue=await bot_client.post('/comfytv/agent/interactions/channel',json={'version':1,'kinds':list(m.KINDS)},headers=headers)
    body=await issue.json(); headers.update({'Cookie':m.COOKIE+'='+issue.cookies[m.COOKIE].value,'X-ComfyTV-Interaction-Channel':body['channel_id'],'X-ComfyTV-Interaction-CSRF':body['csrf_token']})
    ack=await bot_client.post('/comfytv/agent/threads/new/messages',json={'content':'immutable','provider':fake_provider.id},headers=headers)
    assert ack.status==202
    await asyncio.sleep(.2)
    assert getattr(fake_provider.last_turn,'interaction_binding',None)==m.ChannelBinding(channels.epoch,body['channel_id']), 'validated native admission lost server binding'
    bad=await bot_client.post('/comfytv/agent/threads/new/messages',json={'content':'immutable','provider':fake_provider.id,'interaction_mode':'requests_v1'},headers=headers)
    assert bad.status==400
    remote=await bot_client.post('/comfytv/agent/threads/new/messages',json={'content':'remote legacy','provider':fake_provider.id})
    assert remote.status==202
    await asyncio.sleep(.2)
    assert fake_provider.last_turn.interaction_binding is None

async def test_provider_requests_original_run_typed_reply_no_second_submission(monkeypatch):
    from aiohttp import web
    from aiohttp.test_utils import TestServer
    from ComfyTV import storage
    from ComfyTV.bot.hermes import HermesProvider
    from ComfyTV.bot.providers import TurnRequest,TurnHandle
    from ComfyTV.api import bot_turns,agent_events
    from test_bot_hermes import contract
    m=module(); channels=m.Channels(); store=m.Interactions(channels)
    monkeypatch.setattr(m,'CHANNELS',channels); monkeypatch.setattr(m,'INTERACTIONS',store)
    issue=channels.issue(request(),{'version':1,'kinds':list(m.KINDS)})
    issued=json.loads(issue.body)
    browser=request(cookie={m.COOKIE:issue.cookies[m.COOKIE].value},**{'X-ComfyTV-Interaction-Channel':issued['channel_id'],'X-ComfyTV-Interaction-CSRF':issued['csrf_token']})
    binding=channels.validate(browser); current=upstream_snapshot(); calls=[]; answered=asyncio.Event()
    caps={'object':'hermes.api_server.capabilities','auth':{'type':'bearer','required':True},'features':{k:True for k in ('run_submission','run_status','run_events_sse','run_stop','run_approval_response','approval_events','session_resources')}}
    caps['features']['runs_idempotency']={'supported':True}
    async def route(req):
        body=await req.json() if req.can_read_body else None
        calls.append((req.method,req.path,body))
        if req.path=='/v1/capabilities': return web.json_response(caps)
        if req.path=='/v1/interactions/capabilities': return web.json_response(m.wire.CAPABILITIES)
        if req.path=='/api/sessions': return web.json_response({'session':{'id':'session-1'}})
        if req.path=='/v1/runs': return web.json_response({'run_id':'run-1'})
        if req.path.endswith('/requests'): return web.json_response(current)
        if req.path.endswith('/response'):
            r=current['requests'][0]; r['state']='approved'; r['receipt']=dict(decision_digest=m.wire.decision_digest(body),state='approved',settled_at='2026-10-03T00:00:00Z')
            answered.set(); return web.json_response(dict(schema_version=1,epoch=current['epoch'],run_id='run-1',request=r))
        if req.path.endswith('/events'):
            response=web.StreamResponse(headers={'Content-Type':'text/event-stream'}); await response.prepare(req)
            try:
                await asyncio.wait_for(answered.wait(),2)
                await response.write(b'data: {"event":"run.completed","output":"continued"}\n\n')
            except (asyncio.TimeoutError,ConnectionResetError): pass
            return response
        return web.json_response({'run_id':'run-1','status':'completed' if answered.is_set() else 'waiting_for_approval','output':'continued'})
    app=web.Application(); app.router.add_route('*','/{tail:.*}',route)
    async with TestServer(app) as server:
        settings={'bot-hermes-url':str(server.make_url('/')).rstrip('/'),'bot-hermes-mcp-server':'comfytv'}
        monkeypatch.setattr(storage,'get_setting',lambda k:settings.get(k)); monkeypatch.setenv('COMFYTV_HERMES_API_KEY','fixture-key')
        monkeypatch.setattr(storage,'update_bot_message',lambda *a,**kw:{})
        monkeypatch.setattr(agent_events,'emit',lambda *a:None)
        handle=TurnHandle(); monkeypatch.setitem(bot_turns.ACTIVE_TURNS,'thread-1',bot_turns._TurnState(handle,'message-1'))
        turn=TurnRequest(chat_id='thread-1',message_id='message-1',user_text='immutable')
        turn.interaction_binding=binding
        events=[]
        async def emit(e): events.append(e)
        p=HermesProvider(); p.POLL_INTERVAL=.01
        task=asyncio.create_task(p.send(turn,emit,handle))
        for _ in range(100):
            if store.records: break
            if task.done(): break
            await asyncio.sleep(.01)
        try:
            assert store.records, 'opted-in provider never published original-run request'
            card=store.list('thread-1',browser)['interactions'][0]
            status,result=await store.respond('thread-1',card['id'],browser,{'message_id':'message-1','revision':1,'choice':'once'})
            assert status==200 and result['interaction']['state']=='approved'
            result=await asyncio.wait_for(task,2)
            assert not result.error and handle._hermes['terminal']
            submits=[c for c in calls if c[1]=='/v1/runs']
            assert len(submits)==1 and submits[0][2]['input']=='immutable' and submits[0][2]['interaction_mode']=='requests_v1'
            assert len([c for c in calls if c[0]=='POST' and c[1].endswith('/response')])==1
        finally:
            if not task.done(): task.cancel()
            await asyncio.gather(task,return_exceptions=True)

@pytest.mark.parametrize('kind',['approval','question'])
async def test_native_interaction_snapshot_response_and_terminal_cleanup(bot_client,fake_provider,monkeypatch,kind):
    m=module(); channels=m.Channels(); store=m.Interactions(channels)
    monkeypatch.setattr(m,'CHANNELS',channels); monkeypatch.setattr(m,'INTERACTIONS',store)
    fake_provider.gate=asyncio.Event()
    origin=str(bot_client.make_url('/')).rstrip('/')
    headers={'Origin':origin,'X-ComfyTV-Interaction':'1'}
    issued=await bot_client.post('/comfytv/agent/interactions/channel',json={'version':1,'kinds':list(m.KINDS)},headers=headers)
    channel=await issued.json(); headers.update({'Cookie':m.COOKIE+'='+issued.cookies[m.COOKIE].value,'X-ComfyTV-Interaction-Channel':channel['channel_id'],'X-ComfyTV-Interaction-CSRF':channel['csrf_token']})
    admitted=await bot_client.post('/comfytv/agent/threads/new/messages',json={'content':'wait','provider':fake_provider.id},headers=headers)
    ack=await admitted.json(); await asyncio.sleep(.15)
    from ComfyTV.api import bot_turns
    live=bot_turns.ACTIVE_TURNS[ack['thread_id']]; current=upstream_snapshot(); calls=[]
    if kind=='question':
        r=current['requests'][0]; del r['action']; r.update(kind='question',questions=[dict(id='q0',question='选择',choices=['甲','乙'],multi_select=False,allow_other=True)])
    async def read(): return copy.deepcopy(current)
    async def respond(body):
        calls.append(body); r=current['requests'][0]; r['state']='approved' if kind=='approval' else 'answered'
        r['receipt']=dict(state=r['state'],decision_digest=m.wire.decision_digest(body),settled_at='2026-10-03T00:00:00Z')
    binding=m.ChannelBinding(channels.epoch,channel['channel_id'])
    store.observe(current,binding,ack['thread_id'],ack['message_id'],'config',live.handle,read,respond)
    path='/comfytv/agent/threads/'+ack['thread_id']+'/interactions'
    try:
        local=await bot_client.get(path,headers={k:v for k,v in headers.items() if k!='Origin'})
        assert local.status==200,'native standalone interactions snapshot route missing'
        card=(await local.json())['interactions'][0]; assert card['can_respond']
        remote=await bot_client.get(path,headers={'Cookie':headers['Cookie']})
        assert (await remote.json())['interactions'][0]['can_respond'] is False
        wrong_origin=await bot_client.get(path,headers={**headers,'Origin':'http://evil.example'})
        assert (await wrong_origin.json())['interactions'][0]['can_respond'] is False
        body={'message_id':ack['message_id'],'revision':1}
        body.update({'choice':'once'} if kind=='approval' else {'answers':[{'id':'q0','selected':['甲']}]})
        url=path+'/'+card['id']+'/response'
        rejected=await bot_client.post(url,json=body); assert rejected.status==403
        accepted=await bot_client.post(url,json=body,headers=headers)
        assert accepted.status==200 and (await accepted.json())['interaction']['state']==current['requests'][0]['state']
        repeated=await bot_client.post(url,json=body,headers=headers); assert repeated.status==200 and len(calls)==1
        current2=copy.deepcopy(current); r=current2['requests'][0]; r.update(request_id='d'*32,state='pending',receipt=None)
        store.observe(current2,binding,ack['thread_id'],ack['message_id'],'config',live.handle,read,respond)
        assert hasattr(store,'invalidate'), 'turn finally must disable every remaining interaction'
        store.invalidate(live.handle)
        assert all(not r['can_respond'] for r in store.list(ack['thread_id'],request())['interactions'])
        assert live.blocks[-1]['interaction']['state']=='stale'
    finally:
        fake_provider.gate.set(); await asyncio.sleep(.1)

async def test_browser_cannot_supply_upstream_binding_fields(monkeypatch):
    m=module(); channels=m.Channels(); store=m.Interactions(channels)
    from ComfyTV.api import bot_turns
    from ComfyTV.bot.providers import TurnHandle
    issue=channels.issue(request(),{'version':1,'kinds':list(m.KINDS)}); channel=json.loads(issue.body)
    browser=request(cookie={m.COOKIE:issue.cookies[m.COOKIE].value},**{'X-ComfyTV-Interaction-Channel':channel['channel_id'],'X-ComfyTV-Interaction-CSRF':channel['csrf_token']})
    handle=TurnHandle(); monkeypatch.setitem(bot_turns.ACTIVE_TURNS,'t',bot_turns._TurnState(handle,'m'))
    monkeypatch.setattr(store,'_publish',lambda r:None)
    async def read(): return upstream_snapshot()
    calls=[]
    async def respond(body): calls.append(body)
    store.observe(upstream_snapshot(),channels.validate(browser),'t','m','cfg',handle,read,respond)
    card=store.list('t',browser)['interactions'][0]
    with pytest.raises(ValueError):
        await store.respond('t',card['id'],browser,{'message_id':'m','revision':1,'choice':'once','epoch':'c'*32})
    assert not calls

@pytest.mark.parametrize('reason',['lease','expiry','unsafe'])
async def test_server_watch_no_ui_expiry_unsafe_denies_exact_and_stops(monkeypatch,reason):
    from ComfyTV.bot.hermes import HermesProvider
    from ComfyTV.bot.providers import TurnHandle
    m=module(); clock=[1000.0]; channels=m.Channels(clock=lambda:clock[0])
    monkeypatch.setattr(m,'CHANNELS',channels); monkeypatch.setattr(m,'INTERACTIONS',m.Interactions(channels))
    issue=channels.issue(request(),{'version':1,'kinds':list(m.KINDS)}); channel=json.loads(issue.body)
    binding=m.ChannelBinding(channels.epoch,channel['channel_id'])
    current=upstream_snapshot()
    if reason=='lease': clock[0]+=121
    if reason=='expiry': current['requests'][0]['expires_at']='2026-10-01T00:00:01Z'
    if reason=='unsafe': current['requests'][0]['action']['approvable']=False
    calls=[]; p=HermesProvider(); p.POLL_INTERVAL=.001
    monkeypatch.setattr(p,'config_fingerprint',lambda:'cfg')
    async def api(client,method,url,**kw): calls.append((method,url,kw.get('json'))); return copy.deepcopy(current)
    monkeypatch.setattr(p,'_json',api)
    async def stop(handle): handle.stop_requested=True; calls.append(('STOP',None,None)); return True
    monkeypatch.setattr(p,'_best_effort_stop',stop)
    handle=TurnHandle(); state=dict(url='http://127.0.0.1:1',key='fixture-key',run_id='run-1',token='session-1',redactions=['fixture-key'],interaction_binding=binding,config_fingerprint='cfg',chat_id='t',message_id='m')
    await asyncio.wait_for(p._interaction_watch(state,handle),1)
    decisions=[c[2] for c in calls if c[0]=='POST']
    assert decisions and decisions[0]['choice']=='deny', 'unsafe/no-UI cleanup must exact-deny before stop'
    assert calls[-1][0]=='STOP' and handle.stop_requested


def test_native_history_retains_only_canonical_interaction_block():
    from ComfyTV.api import agent_messages
    card=dict(id='a'*32,kind='hermes_approval',thread_id='t',message_id='m',revision=1,state='pending',created_at='2026-10-01T00:00:00Z',expires_at='2099-01-01T00:00:00Z',can_respond=False,action=upstream_snapshot()['requests'][0]['action'])
    blocks=agent_messages.native_blocks([{'type':'hermes_interaction','interaction':card}])
    assert blocks==[{'type':'hermes_interaction','interaction':card}], 'native transcript drops persisted Hermes cards'
    unsafe=dict(card,run_id='private')
    assert not agent_messages.native_blocks([{'type':'hermes_interaction','interaction':unsafe}])

async def test_tv_epoch_generation_late_callback_and_cancelled_readback(monkeypatch):
    m=module(); channels=m.Channels(); store=m.Interactions(channels)
    from ComfyTV.api import bot_turns
    from ComfyTV.bot.providers import TurnHandle
    issued=channels.issue(request(),{'version':1,'kinds':list(m.KINDS)}); body=json.loads(issued.body)
    browser=request(cookie={m.COOKIE:issued.cookies[m.COOKIE].value},**{'X-ComfyTV-Interaction-Channel':body['channel_id'],'X-ComfyTV-Interaction-CSRF':body['csrf_token']})
    handle=TurnHandle(); monkeypatch.setitem(bot_turns.ACTIVE_TURNS,'t',bot_turns._TurnState(handle,'m'))
    monkeypatch.setattr(store,'_publish',lambda r:None)
    current=upstream_snapshot()
    async def read(): return copy.deepcopy(current)
    async def respond(decision):
        r=current['requests'][0]; r['state']='cancelled'; r['receipt']=dict(decision_digest='0'*64,state='cancelled',settled_at='2026-10-03T00:00:00Z')
    binding=channels.validate(browser)
    store.observe(current,binding,'t','m','cfg',handle,read,respond)
    wrong=dict(current,epoch='d'*32)
    with pytest.raises(ValueError): store.observe(wrong,binding,'t','m','cfg',handle,read,respond)
    card=store.list('t',browser)['interactions'][0]
    status,result=await store.respond('t',card['id'],browser,{'message_id':'m','revision':1,'choice':'once'})
    assert status==409 and result['interaction']['state']=='cancelled', 'typed cancellation must not become delivery_unknown'
    store.invalidate(handle)
    fresh=upstream_snapshot(); fresh['requests'][0]['request_id']='e'*32
    with pytest.raises(ValueError): store.observe(fresh,binding,'t','m','cfg',handle,read,respond)

async def test_terminal_reconcile_preserves_true_expiry_and_cancel(monkeypatch):
    m=module(); channels=m.Channels(); store=m.Interactions(channels)
    from ComfyTV.api import bot_turns
    from ComfyTV.bot.providers import TurnHandle
    issue=channels.issue(request(),{'version':1,'kinds':list(m.KINDS)}); ch=json.loads(issue.body)
    binding=m.ChannelBinding(channels.epoch,ch['channel_id']); handle=TurnHandle()
    monkeypatch.setitem(bot_turns.ACTIVE_TURNS,'t',bot_turns._TurnState(handle,'m'))
    monkeypatch.setattr(store,'_publish',lambda r:None)
    data=upstream_snapshot(); data['requests'].append(dict(copy.deepcopy(data['requests'][0]),request_id='d'*32))
    async def read(): return copy.deepcopy(data)
    async def respond(body): pass
    store.observe(data,binding,'t','m','cfg',handle,read,respond)
    for r,state in zip(data['requests'],['expired','cancelled']):
        r['state']=state; r['receipt']=dict(decision_digest='0'*64,state=state,settled_at='2026-10-03T00:00:00Z')
    data['terminal']=True; data['revision']=2
    assert hasattr(store,'reconcile_terminal'), 'terminal event must canonical-read remaining original requests'
    await store.reconcile_terminal(handle)
    store.invalidate(handle)
    assert {r['state'] for r in store.list('t',request())['interactions']}=={'expired','cancelled'}

@pytest.mark.parametrize('mutation',['kind','content'])
def test_tv_snapshot_preflight_rejects_entire_mutated_batch(monkeypatch,mutation):
    m=module(); channels=m.Channels(); store=m.Interactions(channels)
    from ComfyTV.bot.providers import TurnHandle
    issued=channels.issue(request(),{'version':1,'kinds':list(m.KINDS)})
    binding=m.ChannelBinding(channels.epoch,json.loads(issued.body)['channel_id'])
    handle=TurnHandle(); changes=[]
    monkeypatch.setattr(store,'_publish',lambda r:changes.append(r['id']))
    async def read(): return upstream_snapshot()
    async def respond(body): pass
    data=upstream_snapshot(); store.observe(data,binding,'t','m','cfg',handle,read,respond)
    changes.clear()
    invalid=copy.deepcopy(data); bad=invalid['requests'][0]
    if mutation=='kind':
        del bad['action']; bad.update(kind='question',questions=[dict(id='q0',question='Choose?',choices=['yes'],multi_select=False,allow_other=False)])
    else: bad['action']['command']='mutated command'
    invalid['requests'].insert(0,dict(copy.deepcopy(data['requests'][0]),request_id='e'*32))
    with pytest.raises(ValueError): store.observe(invalid,binding,'t','m','cfg',handle,read,respond)
    assert not changes and len(store.records)==1, 'invalid snapshot must publish no prefix or changed-kind duplicate'


def test_empty_terminal_turn_does_not_retain_execution_handle():
    import gc
    import weakref
    from ComfyTV.bot.providers import TurnHandle
    m=module(); channels=m.Channels(); store=m.Interactions(channels)
    issued=channels.issue(request(),{'version':1,'kinds':list(m.KINDS)})
    binding=m.ChannelBinding(channels.epoch,json.loads(issued.body)['channel_id'])
    handle=TurnHandle(); reference=weakref.ref(handle)
    data=upstream_snapshot(); data['requests']=[]
    async def read(): return data
    async def respond(body): pass
    store.observe(data,binding,'t','m','cfg',handle,read,respond)
    store.invalidate(handle)
    del handle
    gc.collect()
    assert reference() is None, 'empty completed turns must not grow generation/closed registries forever'
