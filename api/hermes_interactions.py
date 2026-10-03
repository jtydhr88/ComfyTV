"""Windows-local browser trust boundary for requests_v1. Legacy routes unchanged."""
import ipaddress
import asyncio
import copy
import json
import hashlib
import hmac
import secrets
import time
import uuid
from dataclasses import dataclass
from datetime import datetime, timezone
from aiohttp import web
from urllib.parse import urlsplit
from ..bot import interaction_wire as wire
from ._common import routes

COOKIE='comfytv_interaction'
LEASE_SECONDS=120
MAX_CHANNELS=128
KINDS=('hermes_approval','hermes_question')

@dataclass(frozen=True)
class ChannelBinding:
    epoch: str
    channel_id: str

class Channels:
    def __init__(self,clock=time.time):
        self.clock=clock
        self.epoch=uuid.uuid4().hex
        # Volatile process key only: recover a stable CSRF proof without storing
        # plaintext cookie/CSRF tokens or retaining an unbounded tab-token list.
        self._csrf_key=secrets.token_bytes(32)
        self.records={}

    @staticmethod
    def _digest(token):
        return hashlib.sha256(token.encode()).hexdigest()

    def alive(self,binding):
        record=self.records.get(binding.channel_id) if isinstance(binding,ChannelBinding) else None
        return bool(record and binding.epoch==self.epoch and record['expires']>self.clock())

    def validate(self,request,*,control=True):
        local_gate(request,control=control)
        channel=request.headers.get('X-ComfyTV-Interaction-Channel','')
        binding=ChannelBinding(self.epoch,channel)
        _require(self.alive(binding))
        record=self.records[channel]
        _require(hmac.compare_digest(record['cookie'],self._digest(request.cookies.get(COOKIE,''))))
        _require(hmac.compare_digest(record['csrf'],self._digest(request.headers.get('X-ComfyTV-Interaction-CSRF',''))))
        return binding

    def _response(self,channel,csrf,request):
        expires=datetime.fromtimestamp(self.records[channel]['expires'],timezone.utc).isoformat().replace('+00:00','Z')
        return web.json_response(dict(schema_version=1,channel_id=channel,csrf_token=csrf,expires_at=expires,can_respond=True),headers={'Cache-Control':'no-store'})

    def issue(self,request,body):
        local_gate(request)
        _require(isinstance(body,dict) and set(body)=={'version','kinds'} and type(body['version']) is int and body['version']==1 and body['kinds']==list(KINDS))
        cookie=request.cookies.get(COOKIE,'')
        digest=self._digest(cookie)
        channel=next((cid for cid,r in self.records.items() if r['expires']>self.clock() and hmac.compare_digest(r['cookie'],digest)),None)
        if channel is None:
            self.records={cid:r for cid,r in self.records.items() if r['expires']>self.clock()}
            _require(len(self.records)<MAX_CHANNELS)
            channel=uuid.uuid4().hex; cookie=secrets.token_urlsafe(32)
            csrf=hmac.new(self._csrf_key,(self.epoch+':'+channel+':'+cookie).encode(),hashlib.sha256).hexdigest()
            self.records[channel]={'cookie':self._digest(cookie),'csrf':self._digest(csrf),'expires':self.clock()+LEASE_SECONDS}
        else:
            csrf=hmac.new(self._csrf_key,(self.epoch+':'+channel+':'+cookie).encode(),hashlib.sha256).hexdigest()
        response=self._response(channel,csrf,request)
        response.set_cookie(COOKIE,cookie,httponly=True,samesite='Strict',path='/',secure=request.scheme=='https')
        return response

    def renew(self,request,body):
        binding=self.validate(request)
        _require(isinstance(body,dict) and set(body)=={'channel_id'} and body['channel_id']==binding.channel_id)
        self.records[binding.channel_id]['expires']=self.clock()+LEASE_SECONDS
        return self._response(binding.channel_id,request.headers['X-ComfyTV-Interaction-CSRF'],request)

CHANNELS=Channels()

async def _body(request):
    try:
        raw=await request.read()
        return wire.strict_loads(raw)
    except (ValueError,TypeError,RecursionError):
        raise web.HTTPBadRequest(text='invalid interaction JSON') from None

@routes.post('/comfytv/agent/interactions/channel')
async def channel_issue(request):
    try: local_gate(request)
    except ValueError: return web.json_response({'error':'interaction unavailable'},status=403)
    body=await _body(request)
    try: return CHANNELS.issue(request,body)
    except ValueError: return web.json_response({'error':'invalid channel'},status=400)

@routes.post('/comfytv/agent/interactions/channel/renew')
async def channel_renew(request):
    try: CHANNELS.validate(request)
    except ValueError: return web.json_response({'error':'interaction unavailable'},status=403)
    body=await _body(request)
    try: return CHANNELS.renew(request,body)
    except ValueError: return web.json_response({'error':'interaction unavailable'},status=403)


def history_card(card):
    """Validate the browser union before transcript projection; never restore authority."""
    _require(isinstance(card,dict))
    kind=card.get('kind')
    _require(kind in KINDS)
    payload='action' if kind=='hermes_approval' else 'questions'
    _require(set(card)=={'id','kind','thread_id','message_id','revision','state','created_at','expires_at','can_respond',payload})
    _require(isinstance(card['id'],str) and wire.HEX32.fullmatch(card['id']))
    _require(all(isinstance(card[k],str) and 0<len(card[k])<=256 for k in ('thread_id','message_id')))
    _require(type(card['can_respond']) is bool and card['state'] in wire.STATES|{'dispatching','delivery_unknown'})
    public=dict(request_id=card['id'],kind=kind[7:],revision=card['revision'],digest='0'*64,state='pending',created_at=card['created_at'],expires_at=card['expires_at'],receipt=None)
    public[payload]=card[payload]; wire.public_request(public)
    result=copy.deepcopy(card); result['can_respond']=False
    return result

class Interactions:
    """Volatile authority; durable transcript is never a restored execution permit."""
    def __init__(self,channels):
        self.channels=channels
        self.records={}
        self.bindings={}
        from weakref import WeakKeyDictionary, WeakSet
        self.generations=WeakKeyDictionary()
        self.closed=WeakSet()

    def _active(self,record):
        from .bot_turns import ACTIVE_TURNS
        live=ACTIVE_TURNS.get(record['thread'])
        return bool(not record.get('closed') and live and live.message_id==record['message'] and live.handle is record['handle'] and not live.handle.stop_requested and self.channels.alive(record['channel']))

    def public(self,record,request=None):
        r=record['request']; state=record.get('delivery') or r['state']
        can=False
        if request is not None and state=='pending' and self._active(record):
            try: can=self.channels.validate(request,control=False)==record['channel']
            except ValueError: pass
        if r['expires_at'] is not None and wire.timestamp(r['expires_at'])<=self.channels.clock(): can=False
        result=dict(id=record['id'],kind='hermes_'+r['kind'],thread_id=record['thread'],message_id=record['message'],revision=r['revision'],state=state,created_at=r['created_at'],expires_at=r['expires_at'],can_respond=can)
        payload='action' if r['kind']=='approval' else 'questions'
        result[payload]=copy.deepcopy(r[payload])
        return result

    def _publish(self,record):
        from .. import storage
        from . import bot_turns,agent_events
        public=self.public(record) # broadcast/history never grants receiver authority
        live=bot_turns.ACTIVE_TURNS.get(record['thread'])
        if live and live.message_id==record['message']:
            block=next((b for b in live.blocks if b.get('type')=='hermes_interaction' and b['interaction']['id']==record['id']),None)
            if block is None: live.blocks.append(dict(type='hermes_interaction',interaction=public))
            else: block['interaction']=public
            storage.update_bot_message(record['message'],content=json.dumps(live.blocks))
        else:
            rows=storage.list_bot_messages(record['thread'])
            row=next((r for r in rows if r['id']==record['message']),None)
            if row:
                blocks=json.loads(row['content'] or '[]')
                for b in blocks:
                    if b.get('type')=='hermes_interaction' and b['interaction']['id']==record['id']: b['interaction']=public
                storage.update_bot_message(record['message'],content=json.dumps(blocks))
        agent_events.emit('agent_interaction',dict(thread_id=record['thread'],message_id=record['message'],interaction=public))

    def observe(self,data,channel,thread,message,config,handle,read,respond,*,respond_factory=None):
        data=wire.snapshot(data,data['run_id'],data['session_id'])
        _require(isinstance(channel,ChannelBinding) and self.channels.alive(channel) and handle not in self.closed)
        generation=(data['run_id'],data['session_id'],data['epoch'],channel,thread,message,config)
        previous=self.generations.get(handle)
        _require(previous is None or previous==generation)
        # Validate every binding and immutable payload before persistence/broadcast.
        added=0
        for r in data['requests']:
            same_id=[v for k,v in self.bindings.items() if k[0]==data['run_id'] and k[1]==data['epoch'] and k[3]==r['request_id']]
            if same_id:
                record=self.records[same_id[0]]
                _require(record['thread']==thread and record['message']==message and record['channel']==channel and record['config']==config and record['handle'] is handle)
                _require(wire.immutable(record['request'])==wire.immutable(r))
                _require(record['request']['state']=='pending' or record['request']==r)
            else: added+=1
        _require(len(self.records)+added<=1024)
        self.generations[handle]=generation
        for r in data['requests']:
            key=(data['run_id'],data['epoch'],r['kind'],r['request_id'])
            interaction_id=self.bindings.get(key)
            if interaction_id:
                record=self.records[interaction_id]
                _require(record['thread']==thread and record['message']==message and record['channel']==channel and record['config']==config and record['handle'] is handle)
                _require(wire.immutable(record['request'])==wire.immutable(r))
                _require(record['request']['state']=='pending' or record['request']==r)
                changed=record['request']!=r
                record['request']=copy.deepcopy(r)
                if r['state']!='pending': record['delivery']=None
                if changed: self._publish(record)
            else:
                _require(len(self.records)<1024)
                interaction_id=uuid.uuid4().hex
                record=dict(id=interaction_id,thread=thread,message=message,channel=channel,config=config,handle=handle,epoch=data['epoch'],run=data['run_id'],session=data['session_id'],request=copy.deepcopy(r),read=read,respond=respond_factory(r['request_id']) if respond_factory else respond,decision=None,delivery=None)
                self.records[interaction_id]=record; self.bindings[key]=interaction_id
                self._publish(record)

    async def reconcile_terminal(self,handle):
        records=[r for r in self.records.values() if r['handle'] is handle]
        if not records: return
        first=records[0]
        data=wire.snapshot(await first['read'](),first['run'],first['session'])
        _require(data['epoch']==first['epoch'])
        current={r['request_id']:r for r in data['requests']}
        changes=[]
        for record in records:
            r=current.get(record['request']['request_id'])
            _require(r is not None and wire.immutable(r)==wire.immutable(record['request']))
            _require(record['request']['state']=='pending' or record['request']==r)
            changes.append((record,r))
        for record,r in changes:
            record['request']=r
            if r['state']!='pending': record['delivery']=None
            self._publish(record)

    def invalidate(self,handle):
        if handle in self.generations: self.closed.add(handle)
        for record in self.records.values():
            if record['handle'] is handle:
                record['closed']=True
                if record['request']['state']=='pending' and record.get('delivery') not in {'dispatching','delivery_unknown'}:
                    record['delivery']='stale'
                self._publish(record)

    def list(self,thread,request):
        return dict(schema_version=1,thread_id=thread,interactions=[self.public(r,request) for r in self.records.values() if r['thread']==thread])

    async def _readback(self,record):
        data=wire.snapshot(await record['read'](),record['run'],record['session'])
        _require(data['epoch']==record['epoch'])
        current=next((r for r in data['requests'] if r['request_id']==record['request']['request_id']),None)
        _require(current is not None and wire.immutable(current)==wire.immutable(record['request']))
        _require(record['request']['state']=='pending' or record['request']==current)
        matches=wire.receipt_matches(current,record['decision'],record.get('outcome'))
        record['request']=current
        if current['state']!='pending': record['delivery']=None
        self._publish(record)
        return current['state']!='pending' and (record['decision'] is None or matches)

    async def respond(self,thread,interaction_id,request,body):
        channel=self.channels.validate(request)
        record=self.records.get(interaction_id)
        _require(record and record['thread']==thread and record['channel']==channel and self._active(record))
        _require(isinstance(body,dict) and body.get('message_id')==record['message'] and type(body.get('revision')) is int and body['revision']==record['request']['revision'])
        allowed = ({'message_id','revision','choice'} if record['request']['kind']=='approval' else {'message_id','revision','answers','skip'})
        _require(set(body)<=allowed)
        upstream=dict(epoch=record['epoch'],digest=record['request']['digest'],revision=body['revision'],kind=record['request']['kind'])
        upstream.update({k:v for k,v in body.items() if k not in {'message_id','revision'}})
        wire.response(upstream,record['request'],record['epoch'])
        digest=wire.decision_digest(upstream)
        if record['decision'] is not None:
            _require(record['decision']==digest)
            dispatch=False
        else:
            _require(record['request']['state']=='pending' and not record['delivery'])
            expires=record['request']['expires_at']
            _require(expires is None or wire.timestamp(expires)>self.channels.clock())
            record['decision']=digest; record['outcome']=wire.expected_outcome(upstream); record['delivery']='dispatching'
            self._publish(record)
            dispatch=True
        try:
            if dispatch: await record['respond'](upstream)
            settled=await self._readback(record)
        except Exception:
            settled=False
        if not settled and record['request']['state']!='pending':
            return 409,dict(schema_version=1,interaction=self.public(record,request))
        if not settled:
            record['delivery']='delivery_unknown'; self._publish(record)
        return (200 if settled else 202),dict(schema_version=1,interaction=self.public(record,request))

INTERACTIONS=Interactions(CHANNELS)

@routes.get('/comfytv/agent/threads/{tid}/interactions')
async def interaction_list(request):
    from .. import storage
    thread=request.match_info['tid']
    if storage.get_bot_chat(thread) is None:
        return web.json_response({'error':'thread not found'},status=404)
    # Reconciliation is read-only and bounded; a snapshot can never dispatch.
    records=[r for r in INTERACTIONS.records.values() if r['thread']==thread and r.get('delivery')=='delivery_unknown']
    for record in records[:2]:
        try:
            async with asyncio.timeout(2): await INTERACTIONS._readback(record)
        except Exception: pass
    result=INTERACTIONS.list(thread,request)
    known={r['id'] for r in result['interactions']}
    for row in storage.list_bot_messages(thread):
        try: blocks=json.loads(row['content'] or '[]')
        except (ValueError,TypeError): continue
        for block in blocks:
            if block.get('type')=='hermes_interaction':
                card=block.get('interaction',{})
                if card.get('id') not in known:
                    # Transcript survives restarts; process authority does not.
                    try: card=history_card(card)
                    except (ValueError,TypeError,KeyError): continue
                    if card.get('state') in {'pending','dispatching'}: card['state']='stale'
                    result['interactions'].append(card); known.add(card.get('id'))
    return web.json_response(result,headers={'Cache-Control':'no-store'})

@routes.post('/comfytv/agent/threads/{tid}/interactions/{iid}/response')
async def interaction_response(request):
    try: CHANNELS.validate(request)
    except ValueError: return web.json_response({'error':'interaction unavailable'},status=403)
    body=await _body(request)
    try:
        status,result=await INTERACTIONS.respond(request.match_info['tid'],request.match_info['iid'],request,body)
        return web.json_response(result,status=status,headers={'Cache-Control':'no-store'})
    except (ValueError,TypeError,KeyError):
        return web.json_response({'error':'interaction conflict; read canonical snapshot'},status=409)


def _require(value):
    if not value: raise ValueError('interaction unavailable')

def _loopback(host):
    try:
        address=ipaddress.ip_address(host)
        if isinstance(address,ipaddress.IPv6Address) and address.ipv4_mapped:
            address=address.ipv4_mapped
        return address.is_loopback
    except ValueError:
        return False

def _origin(value):
    _require(isinstance(value,str) and value and not any(c.isspace() or ord(c)<32 for c in value) and '\\' not in value)
    parsed=urlsplit(value)
    _require(parsed.scheme in {'http','https'} and parsed.hostname and parsed.username is None and parsed.password is None and not parsed.path and not parsed.query and not parsed.fragment)
    _require(parsed.hostname=='localhost' or _loopback(parsed.hostname))
    _require(not parsed.netloc.endswith(':'))
    return parsed.scheme,parsed.hostname,parsed.port or (443 if parsed.scheme=='https' else 80)

def local_gate(request, *, control=True):
    transport=getattr(request,'transport',None)
    _require(transport is not None)
    peer=transport.get_extra_info('peername')
    _require(isinstance(peer,tuple) and peer and _loopback(peer[0]))
    headers=request.headers
    names=[n.lower() for n in headers]
    _require(len(names)==len(set(names)))
    _require(not any(n=='forwarded' or n.startswith('x-forwarded-') for n in names))
    scheme=request.scheme
    _require(scheme in {'http','https'})
    origin=_origin(scheme+'://'+headers.get('Host',''))
    supplied=headers.get('Origin')
    _require(not control or supplied is not None)
    if supplied is not None: _require(_origin(supplied)==origin)
    _require(headers.get('Sec-Fetch-Site','same-origin')=='same-origin')
    _require(headers.get('X-ComfyTV-Interaction')=='1')
    if control:
        _require(headers.get('Content-Type','').lower() in {'application/json','application/json; charset=utf-8'})
