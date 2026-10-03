import { describe,it,expect,vi,afterEach } from 'vitest'
import { ref } from 'vue'
import { mount } from '@vue/test-utils'
import { createAgentInteractions,interactionViewKey } from './agentInteractions'
import { zTVInteraction,zInteractionSnapshot,validInteractionDecision } from '../../schemas/hermesInteractionSchema'
import { createInteractionChannel } from './agentInteractionChannel'
import HermesApprovalCard from '../../components/agent/message/HermesApprovalCard.vue'
import HermesQuestionCard from '../../components/agent/message/HermesQuestionCard.vue'
const a:any={id:'a'.repeat(32),kind:'hermes_approval',thread_id:'A',message_id:'M',revision:1,state:'pending',created_at:'2026-01-01T00:00:00Z',expires_at:'2099-01-01T00:00:00Z',can_respond:true,action:{command:'printf full-action',description:'credential=[REDACTED]; suffix',redacted:true,truncated:false,approvable:true}}
function harness(){let items:any[]=[a];const applied:any[]=[];const rest:any={interactionChannel:{isAvailable:()=>true,available:ref(true),connected:ref(true),now:ref(Date.now())},getInteractions:vi.fn(async()=>zInteractionSnapshot.parse({schema_version:1,thread_id:'A',interactions:items})),respondInteraction:vi.fn(async()=>({schema_version:1,interaction:{...a,state:'approved',can_respond:false}}))};const controller=createAgentInteractions(rest,i=>applied.push(i));return {rest,controller,applied,set:(x:any[])=>items=x}}
describe('FE01-04 targeted regressions',()=>{
 afterEach(()=>vi.useRealTimers())
 it('terminal tombstone must survive late dispatching and pending GET snapshots without enabling another POST',async()=>{const h=harness();await h.controller.refresh('A');h.set([{...a,state:'approved',can_respond:false}]);await h.controller.refresh('A');h.set([{...a,state:'dispatching',can_respond:false}]);await h.controller.refresh('A');h.set([a]);await h.controller.refresh('A');console.log('TOMBSTONE_REPRO',JSON.stringify({states:h.applied.map(i=>i.state),canRespond:h.controller.view.canRespond(a)}));await h.controller.respond({interaction:a,decision:{choice:'once'}});expect(h.rest.respondInteraction).not.toHaveBeenCalled()})
 it('accepted contract-size free batch must be submit-enabled',async()=>{const {action,...common}=a;const i:any={...common,kind:'hermes_question',expires_at:null,questions:Array.from({length:4},(_,n)=>({id:'q'+n,question:'Open '+n,choices:[],multi_select:false,allow_other:false}))};const answers=i.questions.map((q:any)=>({id:q.id,selected:[],other_text:'x'.repeat(8000)}));expect(validInteractionDecision(i,{answers})).toBe(true);const w=mount(HermesQuestionCard,{props:{interaction:i},global:{provide:{[interactionViewKey as symbol]:{now:ref(Date.now()),canRespond:()=>true}}}});for(let n=0;n<4;n++)await w.get(`textarea[data-qid="q${n}"]`).setValue('x'.repeat(8000));expect(w.get('button[data-action="answer"]').attributes('disabled')).toBeUndefined();w.unmount()})
 it.each(['wrong-message','wrong-decision','malformed'])('exact canonical terminal GET remains authoritative despite %s POST receipt',async mode=>{const h=harness();await h.controller.refresh('A');h.rest.respondInteraction.mockImplementation(async()=>{h.set([{...a,state:'approved',can_respond:false}]);if(mode==='malformed')throw new SyntaxError('malformed JSON');return {schema_version:1,interaction:{...a,message_id:mode==='wrong-message'?'wrong':a.message_id,state:mode==='wrong-decision'?'denied':'approved',can_respond:false}}});await h.controller.respond({interaction:a,decision:{choice:'once'}});expect(h.applied.at(-1).state).toBe('approved');expect(h.applied.map(i=>i.state).slice(2)).not.toContain('delivery_unknown');const w=mount(HermesApprovalCard,{props:{interaction:h.applied.at(-1)},global:{provide:{[interactionViewKey as symbol]:h.controller.view}}});expect(w.find('[role=alert]').exists()).toBe(true);w.unmount()})
 it('elapsed expiry between 1s ticks must prevent response dispatch',async()=>{vi.useFakeTimers();vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));const h=harness();h.rest.interactionChannel.now.value=Date.now();const soon={...a,expires_at:'2026-01-01T00:00:00.100Z'};h.set([soon]);await h.controller.refresh('A');vi.setSystemTime(new Date('2026-01-01T00:00:00.900Z'));await h.controller.respond({interaction:soon,decision:{choice:'once'}});expect(h.rest.respondInteraction).not.toHaveBeenCalled();vi.useRealTimers()})
 it('settled tombstone survives reordered overlapping GETs, missing and contradictory readbacks',async()=>{
  const h=harness();await h.controller.refresh('A')
  let release:any;h.rest.getInteractions.mockImplementationOnce(()=>new Promise(r=>release=r))
  const older=h.controller.refresh('A');h.set([{...a,state:'approved',can_respond:false}]);await h.controller.refresh('A')
  release({schema_version:1,thread_id:'A',interactions:[{...a,state:'delivery_unknown',can_respond:false}]});await older
  for(const items of [[],[{...a,state:'stale',can_respond:false}],[{...a,state:'denied',can_respond:false}],[{...a,message_id:'changed'}],[a]]){h.set(items);await h.controller.refresh('A');expect(h.applied.at(-1).state).toBe('approved');expect(h.applied.at(-1).message_id).toBe('M');expect(h.controller.view.canRespond(a)).toBe(false)}
  await h.controller.respond({interaction:a,decision:{choice:'once'}});expect(h.rest.respondInteraction).not.toHaveBeenCalled()
 })
 it('expired lease between ticks prevents response dispatch even with stale available display',async()=>{
  vi.useFakeTimers();vi.setSystemTime(new Date('2026-01-01T00:00:00Z'))
  const channel=createInteractionChannel(vi.fn(async()=>new Response(JSON.stringify({schema_version:1,channel_id:'fixture',csrf_token:'fixture',expires_at:'2026-01-01T00:00:00.100Z',can_respond:true}))),'http://localhost:8188')
  await channel.open();channel.connected.value=true
  const h=harness();h.rest.interactionChannel=channel;const controller=createAgentInteractions(h.rest,()=>{});await controller.refresh('A')
  vi.setSystemTime(new Date('2026-01-01T00:00:00.900Z'));expect(channel.available.value).toBe(true)
  try{await controller.respond({interaction:a,decision:{choice:'once'}});expect(h.rest.respondInteraction).not.toHaveBeenCalled()}finally{channel.close()}
 })
})
