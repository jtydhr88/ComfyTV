import asyncio,copy,json
import pytest
from test_hermes_interactions import module,request,upstream_snapshot

@pytest.mark.parametrize('choice,state,expected',[('deny','approved',409),('once','denied',409),('once','expired',409),('deny','cancelled',409),('once','approved',200),('deny','denied',200)])
async def test_tv_receipt_outcome_consistency_first_writer(monkeypatch,choice,state,expected):
    m=module()
    from ComfyTV.api import bot_turns
    from ComfyTV.bot.providers import TurnHandle
    channels=m.Channels(); store=m.Interactions(channels)
    issued=channels.issue(request(),{'version':1,'kinds':list(m.KINDS)}); a=json.loads(issued.body)
    browser=request(cookie={m.COOKIE:issued.cookies[m.COOKIE].value},**{'X-ComfyTV-Interaction-Channel':a['channel_id'],'X-ComfyTV-Interaction-CSRF':a['csrf_token']})
    handle=TurnHandle(); monkeypatch.setitem(bot_turns.ACTIVE_TURNS,'t',bot_turns._TurnState(handle,'msg'))
    monkeypatch.setattr(store,'_publish',lambda r:None)
    current=upstream_snapshot(); calls=[]
    async def read(): return copy.deepcopy(current)
    async def respond(body):
        calls.append(body); r=current['requests'][0]; r['state']=state
        r['receipt']={'state':state,'decision_digest':m.wire.decision_digest(body),'settled_at':'2026-10-03T00:00:00Z'}
    store.observe(current,channels.validate(browser),'t','msg','cfg',handle,read,respond)
    iid=next(iter(store.records)); body=dict(message_id='msg',revision=1,choice=choice)
    for _ in range(2):
        status,result=await store.respond('t',iid,browser,body)
        assert status==expected
        assert result['interaction']['state']==state
    with pytest.raises(ValueError): await store.respond('t',iid,browser,dict(body,choice='once' if choice=='deny' else 'deny'))
    assert len(calls)==1

def test_multitab_stable_proof_bounded_recovery_no_lease_extension():
    m=module(); clock=[1000.0]; channels=m.Channels(clock=lambda:clock[0])
    issued=channels.issue(request(),{'version':1,'kinds':list(m.KINDS)}); a=json.loads(issued.body); cookie={m.COOKIE:issued.cookies[m.COOKIE].value}
    browser=request(cookie=cookie,**{'X-ComfyTV-Interaction-Channel':a['channel_id'],'X-ComfyTV-Interaction-CSRF':a['csrf_token']})
    binding=channels.validate(browser); deadline=channels.records[binding.channel_id]['expires']
    clock[0]+=10
    for _ in range(150):
        recovered=json.loads(channels.issue(request(cookie=cookie),{'version':1,'kinds':list(m.KINDS)}).body)
        assert recovered['csrf_token']==a['csrf_token']
        assert channels.validate(browser)==binding
    assert channels.records[binding.channel_id]['expires']==deadline
    assert a['csrf_token'] not in repr(channels.records) and cookie[m.COOKIE] not in repr(channels.records)
    with pytest.raises(ValueError): channels.validate(request(cookie=cookie,**{'X-ComfyTV-Interaction-Channel':a['channel_id'],'X-ComfyTV-Interaction-CSRF':'wrong'}))
    channels.renew(browser,{'channel_id':binding.channel_id}); assert channels.records[binding.channel_id]['expires']==clock[0]+m.LEASE_SECONDS
    clock[0]+=m.LEASE_SECONDS
    with pytest.raises(ValueError): channels.renew(browser,{'channel_id':binding.channel_id})
    new=json.loads(channels.issue(request(cookie=cookie),{'version':1,'kinds':list(m.KINDS)}).body)
    assert new['channel_id']!=binding.channel_id and not channels.alive(binding)

@pytest.mark.parametrize('command',['echo token=value; rm -rf fixture','echo bearer fixture; delete fixture','echo known-key; delete fixture'])
def test_command_redaction_forbids_once(command):
    m=module(); r=upstream_snapshot()['requests'][0]; r['action']['command']=command
    safe=m.wire.redact(r,['known-key'])
    assert safe['action']['command']!=command and not safe['action']['approvable'] and not safe['action']['truncated']
    with pytest.raises(ValueError): m.wire.response(dict(epoch='c'*32,digest='b'*64,revision=1,kind='approval',choice='once'),safe,'c'*32)

async def test_atomic_publish_invalid_later_record_zero_writes(monkeypatch):
    m=module()
    from ComfyTV.bot.hermes import HermesProvider
    from ComfyTV.bot.providers import TurnHandle
    from ComfyTV.api import bot_turns,agent_events
    from ComfyTV import storage
    channels=m.Channels(); store=m.Interactions(channels)
    monkeypatch.setattr(m,'CHANNELS',channels); monkeypatch.setattr(m,'INTERACTIONS',store)
    issued=channels.issue(request(),{'version':1,'kinds':list(m.KINDS)}); channel=json.loads(issued.body)
    binding=m.ChannelBinding(channels.epoch,channel['channel_id']); handle=TurnHandle()
    monkeypatch.setitem(bot_turns.ACTIVE_TURNS,'thread',bot_turns._TurnState(handle,'message'))
    writes=[]; broadcasts=[]
    monkeypatch.setattr(storage,'update_bot_message',lambda *a,**k:writes.append(k))
    monkeypatch.setattr(agent_events,'emit',lambda *a,**k:broadcasts.append(a))
    current=upstream_snapshot(); bad=copy.deepcopy(current['requests'][0]); bad['request_id']='d'*32
    old=copy.deepcopy(bad); old['state']='denied'; old['receipt']={'state':'denied','decision_digest':'0'*64,'settled_at':'2026-10-03T00:00:00Z'}
    async def read(): return copy.deepcopy(current)
    async def respond(body): pass
    store.observe(dict(current,requests=[old]),binding,'thread','message','config',handle,read,respond)
    writes.clear(); broadcasts.clear()
    current['requests'].append(bad) # previously denied request resurrected alongside fresh pending
    p=HermesProvider(); stopped=[]
    class FakeClient:
        async def __aenter__(self): return self
        async def __aexit__(self,*a): pass
    monkeypatch.setattr(p,'_client',lambda *a:FakeClient())
    async def fake_json(*a,**k): return copy.deepcopy(current)
    monkeypatch.setattr(p,'_json',fake_json); monkeypatch.setattr(p,'config_fingerprint',lambda:'config')
    async def stop(h): stopped.append(True); h.stop_requested=True; return True
    monkeypatch.setattr(p,'_best_effort_stop',stop)
    state={'interaction_binding':binding,'key':'synthetic','url':'http://127.0.0.1:9','run_id':current['run_id'],'token':current['session_id'],'redactions':[],'config_fingerprint':'config','chat_id':'thread','message_id':'message'}
    await asyncio.wait_for(p._interaction_watch(state,handle),1)
    assert stopped
    assert len(store.records)==1, 'invalid batch published a new approvable card before discovering resurrected tombstone'

    assert writes==[] and broadcasts==[]
    assert handle.stop_requested
