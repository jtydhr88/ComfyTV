"""Strict requests_v1 public wire validation. No services or configuration access."""
import copy
import hashlib
import json
import re
from datetime import datetime, timezone

CAPABILITIES = dict(schema_version=1, protocol='requests_v1', approval_choices=['once', 'deny'],
                    questions=True, snapshots=True, response_receipts=True, expiry=True)
STATES = {'pending','approved','denied','answered','skipped','expired','cancelled','undeliverable','stale'}
HEX32 = re.compile('[a-f0-9]{32}')
HEX64 = re.compile('[a-f0-9]{64}')
MAX_REQUESTS = 64
MAX_PUBLIC_BYTES = 16384

def check(value):
    if not value: raise ValueError('invalid interaction contract')

def canonical(value):
    return json.dumps(value,sort_keys=True,separators=(',', ':'),ensure_ascii=True,allow_nan=False)

def timestamp(value):
    check(isinstance(value,str) and re.fullmatch(r'\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,6})?(?:Z|\+00:00)',value))
    return datetime.fromisoformat(value.replace('Z','+00:00')).timestamp()

def text(value, limit):
    check(isinstance(value,str) and len(value.encode('utf-8')) <= limit)

def public_request(value):
    check(isinstance(value,dict))
    kind=value.get('kind')
    common={'request_id','kind','revision','digest','state','created_at','expires_at','receipt'}
    check(kind in {'approval','question'} and set(value)==common|({'action'} if kind=='approval' else {'questions'}))
    check(isinstance(value['request_id'],str) and HEX32.fullmatch(value['request_id']))
    check(isinstance(value['digest'],str) and HEX64.fullmatch(value['digest']))
    check(type(value['revision']) is int and value['revision']==1)
    check(value['state'] in STATES)
    timestamp(value['created_at'])
    check(value['expires_at'] is not None or kind=='question')
    if value['expires_at'] is not None:
        check(timestamp(value['expires_at']) >= timestamp(value['created_at']))
    receipt=value['receipt']
    if value['state']=='pending': check(receipt is None)
    else:
        check(isinstance(receipt,dict) and set(receipt)=={'decision_digest','state','settled_at'})
        check(receipt['state']==value['state'])
        check(isinstance(receipt['decision_digest'],str) and HEX64.fullmatch(receipt['decision_digest']))
        timestamp(receipt['settled_at'])
        check(value['state'] not in ({'answered','skipped'} if kind=='approval' else {'approved','denied'}))
    if kind=='approval':
        action=value['action']
        check(isinstance(action,dict) and set(action)=={'command','description','redacted','truncated','approvable'})
        for field in ('command','description'): text(action[field],8192)
        check(sum(len(action[f].encode('utf-8')) for f in ('command','description'))<=8192)
        check(all(type(action[f]) is bool for f in ('redacted','truncated','approvable')))
        check(not action['approvable'] or (bool(action['command']) and not action['truncated']))
    else:
        questions=value['questions']
        check(isinstance(questions,list) and 1<=len(questions)<=5)
        for i,q in enumerate(questions):
            check(isinstance(q,dict) and set(q)=={'id','question','choices','multi_select','allow_other'})
            check(q['id']=='q'+str(i))
            text(q['question'],4096); check(bool(q['question']))
            check(type(q['multi_select']) is bool and type(q['allow_other']) is bool)
            choices=q['choices']; check(isinstance(choices,list) and len(choices)<=4)
            for label in choices: text(label,1024); check(bool(label) and len(label)<=256)
            check(len(choices)==len(set(choices)))
    check(len(json.dumps(value,ensure_ascii=False,separators=(',', ':'),allow_nan=False).encode('utf-8'))<=MAX_PUBLIC_BYTES)
    return copy.deepcopy(value)

def strict_loads(raw):
    check(isinstance(raw,(str,bytes)) and len(raw.encode() if isinstance(raw,str) else raw)<=32768)
    def unique(pairs):
        result={}
        for k,v in pairs: check(k not in result); result[k]=v
        return result
    def invalid(_): raise ValueError('invalid interaction JSON')
    result=json.loads(raw,object_pairs_hook=unique,parse_constant=invalid)
    def depth(value,n=0):
        check(n<=8)
        if isinstance(value,dict):
            for child in value.values(): depth(child,n+1)
        elif isinstance(value,list):
            for child in value: depth(child,n+1)
    depth(result); check(isinstance(result,dict))
    return result

def decision_digest(body):
    return hashlib.sha256(canonical(body).encode()).hexdigest()

def response(body, request, epoch):
    check(isinstance(body,dict) and len(json.dumps(body,ensure_ascii=False,separators=(',', ':'),allow_nan=False).encode('utf-8'))<=32768)
    base={'epoch','digest','revision','kind'}
    check(body.get('epoch')==epoch and body.get('digest')==request['digest'] and type(body.get('revision')) is int and body['revision']==request['revision'] and body.get('kind')==request['kind'])
    if request['kind']=='approval':
        check(set(body)==base|{'choice'} and body['choice'] in {'once','deny'})
        check(body['choice']!='once' or request['action']['approvable'])
    else:
        if 'skip' in body:
            check(set(body)==base|{'skip'} and body['skip'] is True)
        else:
            check(set(body)==base|{'answers'} and isinstance(body['answers'],list))
            questions={q['id']:q for q in request['questions']}
            check(len(body['answers'])==len(questions))
            seen=set()
            for a in body['answers']:
                check(isinstance(a,dict) and {'id','selected'}<=set(a)<= {'id','selected','other_text'})
                check(isinstance(a['id'],str) and a['id'] in questions and a['id'] not in seen)
                seen.add(a['id']); q=questions[a['id']]; selected=a['selected']
                check(isinstance(selected,list) and all(isinstance(s,str) for s in selected))
                check(len(selected)==len(set(selected)) and all(s in q['choices'] for s in selected))
                other=a.get('other_text',''); text(other,8192)
                nonempty=bool(other.strip())
                check(not other or q['allow_other'] or not q['choices'])
                count=len(selected)+int(nonempty)
                check(count>=1 and (q['multi_select'] or count<=1))
                check(bool(q['choices']) or nonempty)
    return copy.deepcopy(body)

def expected_outcome(body):
    if body['kind']=='approval':
        return 'approved' if body['choice']=='once' else 'denied'
    return 'skipped' if body.get('skip') is True else 'answered'

def receipt_matches(request, digest, outcome):
    receipt=request['receipt']
    return bool(receipt and receipt['decision_digest']==digest and
                request['state']==outcome and receipt['state']==outcome)

def immutable(value):
    return hashlib.sha256(canonical({k:v for k,v in value.items() if k not in {'state','receipt'}}).encode()).hexdigest()

def snapshot(value,run_id,session_id):
    check(isinstance(value,dict) and set(value)=={'schema_version','epoch','run_id','session_id','revision','terminal','requests'})
    check(type(value['schema_version']) is int and value['schema_version']==1)
    check(isinstance(value['epoch'],str) and HEX32.fullmatch(value['epoch']))
    check(value['run_id']==run_id and value['session_id']==session_id)
    check(type(value['revision']) is int and value['revision']>=0 and type(value['terminal']) is bool)
    check(isinstance(value['requests'],list) and len(value['requests'])<=MAX_REQUESTS)
    requests=[public_request(r) for r in value['requests']]
    check(len({r['request_id'] for r in requests})==len(requests))
    check(not value['terminal'] or all(r['state']!='pending' for r in requests))
    return dict(value, requests=requests)

def redact(value,secrets):
    result=copy.deepcopy(value)
    def clean(s):
        for secret in secrets:
            if secret: s=s.replace(secret,'[redacted]')
        s=re.sub(r"(?i)\b((?:api[_-]?key|token|password|secret)\s*[:=]\s*)(\"[^\"]*\"|'[^']*'|[^\s,;]+)",r'\1[redacted]',s)
        s=re.sub(r'(?i)\bbearer\s+[^\s\"\',;]+','Bearer [redacted]',s)
        s=re.sub(r'(?i)(https?://)[^/\s:@]+:[^/\s@]+@',r'\1[redacted]@',s)
        return re.sub(r'\b(?:sk-[A-Za-z0-9_-]{20,}|gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,})\b','[redacted]',s)
    if result['kind']=='approval':
        a=result['action']
        for field in ('command','description'):
            safe=clean(a[field]); a['redacted']=a['redacted'] or safe!=a[field]
            # Generic credential patterns can swallow executable text. A changed
            # command is display-only; never authorize its hidden original.
            if field=='command' and safe!=a[field]: a['approvable']=False
            a[field]=safe
    else:
        for q in result['questions']:
            q['question']=clean(q['question'])
            q['choices']=[clean(c) for c in q['choices']]
        # Labels are wire values, not merely decoration. Changed labels cannot be
        # answered safely; fail closed instead of accepting invented selections.
        check(all(q['choices']==old['choices'] for q,old in zip(result['questions'],value['questions'])))
    return result
