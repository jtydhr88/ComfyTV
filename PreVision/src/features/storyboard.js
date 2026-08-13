/*
 * features/storyboard.js — offline storyboard planner (subsystem P, refactor P5,
 * ADR-0011). Script text -> deterministic beat analysis -> StoryboardPlan (pure JSON,
 * never touches the project) -> user-confirmed materialization into a new scene, plus
 * the planner dialog window family and its top-level DOM/window bindings. The whole
 * subsystem moved verbatim from src/app.js; the bindings now run at bridge time, before
 * the app.js remnant, inside the same end-of-body script — DOM availability unchanged.
 *
 * Module-level mutable planner state (pendingStoryboardPlan / pendingStoryboardSource /
 * storyboardPlanStale / storyboardDialogFullscreen / storyboardDialogRestoreBounds /
 * storyboardDialogResizeSession) is exposed through transitional globalThis accessor
 * shims (ADR-0009 mechanism — the bridge's Object.assign can only snapshot values, and
 * external bare reads such as the smoke suite's live getters need the current binding).
 * The shims go away with the store shim in P9.
 *
 * Transitional free references resolved through globals at call time only: deepCopy,
 * sceneTemplateById, sceneTemplateText, automaticCaptureMutationBlocked,
 * setSceneRailLevel, markDirty, showCommandModal (app.js); sceneIdx/project via the
 * core store shim (ADR-0009); PreVisionI18n (i18n runtime); alert/window/document
 * (host globals). P7 added true imports for runtime-owned syncScene, loadScene, and
 * stageToData.
 */
import { $, curScene } from '../core/store.js';
import { SCENE_TEMPLATES } from '../core/project-data.js';
import { loadScene as runtimeLoadScene, stageToData as runtimeStageToData, syncScene as runtimeSyncScene } from '../stage/runtime.js';

/* Storyboard Planner v2 keeps analysis deterministic, locale-independent, and ephemeral until Apply. */
const STORYBOARD_PLAN_VERSION=1;
const STORY_MOOD_ADJUSTMENTS={
  tension:{fov:-3,distance:.95,height:-.05,duration:.95},
  warmth:{fov:1,distance:1,height:.04,duration:1.08},
  sadness:{fov:-2,distance:1.04,height:.12,duration:1.15},
  action:{fov:4,distance:1.03,height:-.12,duration:.82},
  suspense:{fov:-4,distance:.98,height:.08,duration:1.1},
  daily:{fov:0,distance:1,height:0,duration:1},
};
const STORY_PACE_MULTIPLIER={slow:1.18,standard:1,fast:.82};
const STORY_MOOD_LABEL_KEYS={tension:'storyboard.mood.tension',warmth:'storyboard.mood.warmth',sadness:'storyboard.mood.sadness',action:'storyboard.mood.action',suspense:'storyboard.mood.suspense',daily:'storyboard.mood.daily'};
const STORY_PACE_LABEL_KEYS={slow:'storyboard.pace.slow',standard:'storyboard.pace.standard',fast:'storyboard.pace.fast'};
const STORYBOARD_REASON_LABEL_KEYS={
  'template.manual':'storyboard.reason.template.manual','template.dialogue':'storyboard.reason.template.dialogue',
  'template.chase':'storyboard.reason.template.chase','template.establishing':'storyboard.reason.template.establishing',
  'template.performance':'storyboard.reason.template.performance','template.fallback':'storyboard.reason.template.fallback',
  'shot.establish':'storyboard.reason.shot.establish','shot.dialogue':'storyboard.reason.shot.dialogue',
  'shot.action':'storyboard.reason.shot.action','shot.environment':'storyboard.reason.shot.environment',
  'shot.reaction':'storyboard.reason.shot.reaction','shot.support':'storyboard.reason.shot.support',
  'merge.shotLimit':'storyboard.reason.merge.shotLimit','merge.extraCharacter':'storyboard.reason.merge.extraCharacter',
};
const STORYBOARD_ROLE_LABEL_KEYS={primary:'storyboard.roles.primary',secondary:'storyboard.roles.secondary'};
const STORYBOARD_WARNING_LABEL_KEYS={tooManyCharacters:'storyboard.warning.tooManyCharacters',ambiguousBeats:'storyboard.warning.ambiguousBeats'};
const STORYBOARD_BEAT_TYPE_LABEL_KEYS={dialogue:'storyboard.beat.type.dialogue',action:'storyboard.beat.type.action',environment:'storyboard.beat.type.environment'};
const STORYBOARD_EYELINE_LABEL_KEYS={left:'storyboard.eyeline.left',right:'storyboard.eyeline.right',center:'storyboard.eyeline.center'};
const STORYBOARD_ANALYSIS_LEXICON=Object.freeze({
  dialogue:['say','says','said','ask','asks','asked','reply','replies','replied','tell','tells','told','dialogue',
    '\u8bf4','\u95ee','\u56de\u7b54','\u56de\u5e94','\u544a\u8bc9','\u558a','\u9053'],
  action:['run','runs','ran','rush','rushes','rushed','chase','chases','chased','sprint','escape','fight','fights','fought','turn','turns','turned','enter','enters','entered','leave','leaves','left','explode','explodes','roar','roars','ride','rides',
    '\u8dd1','\u51b2','\u8ffd','\u9003','\u6253','\u6218\u6597','\u8f6c\u8eab','\u8d70\u8fdb','\u8fdb\u5165','\u79bb\u5f00','\u7206\u70b8','\u9a91\u9a6c','\u4f38\u51fa','\u7ad9\u8d77','\u5750\u4e0b'],
  environment:['interior','exterior','room','street','city','mountain','desert','forest','sea','sky','station','house','night','morning','rain','wind','wide shot','environment',
    '\u5185\u666f','\u5916\u666f','\u623f\u95f4','\u8857\u9053','\u57ce\u5e02','\u5c71','\u6c99\u6f20','\u68ee\u6797','\u6d77','\u5929\u7a7a','\u8f66\u7ad9','\u623f\u5b50','\u591c','\u6e05\u6668','\u96e8','\u98ce','\u7a7a\u955c','\u8fdc\u666f','\u73af\u5883'],
  single:['alone','solo','monologue','perform','performs','sing','sings','dance','dances','wait','waits','reflect',
    '\u72ec\u81ea','\u4e00\u4e2a\u4eba','\u72ec\u767d','\u8868\u6f14','\u5531','\u8df3','\u7b49\u5f85','\u6c89\u601d'],
});
const STORYBOARD_SCENE_HEADING=/^(?:INT\.?|EXT\.?|INT\/EXT\.?|I\/E\.?|SCENE\b|\u5185\u666f|\u5916\u666f|\u5185\/\u5916\u666f|\u573a\u666f)/i;
const STORYBOARD_QUOTE=/["\u201c\u201d\u2018\u2019\u300c\u300d\u300e\u300f]/;
const STORYBOARD_PARENTHETICAL=/^[\(\uFF08].*[\)\uFF09]$/;
const STORYBOARD_STAGE_LIMIT=29.5;
function clampStoryboard(value,min,max){return Math.max(min,Math.min(max,Number(value)));}
function roundStoryboard(value,digits=2){const scale=Math.pow(10,digits);return Math.round(Number(value)*scale)/scale;}
function storyboardEscapeRegExp(value){return String(value).replace(/[\\^$.*+?()[\]{}|]/g,'\\$&');}
function storyboardTermCount(text,terms){
  const value=String(text||'').toLowerCase();
  return (terms||[]).reduce((score,term)=>{
    const needle=String(term||'').toLowerCase();
    if(!needle)return score;
    if(/^[a-z0-9 -]+$/.test(needle)){
      return score+(value.match(new RegExp('\\b'+storyboardEscapeRegExp(needle).replace(/ /g,'\\s+')+'\\b','g'))||[]).length;
    }
    return score+Math.max(0,value.split(needle).length-1);
  },0);
}
function storyboardKeywordScore(text,category){
  const key=String(category||'').split('.').pop();
  return storyboardTermCount(text,STORYBOARD_ANALYSIS_LEXICON[key]||[]);
}
function splitStoryboardSegments(value){
  const line=String(value||'').trim();
  if(!line)return [];
  return (line.match(/[^.!?\u3002\uFF01\uFF1F;\uFF1B]+[.!?\u3002\uFF01\uFF1F;\uFF1B]*/g)||[line]).map(part=>part.trim()).filter(Boolean);
}
function cleanStoryboardSpeaker(value){
  return String(value||'').replace(/[\(\uFF08][^)\uFF09]*[\)\uFF09]/g,'').replace(/\s+/g,' ').trim();
}
function isStoryboardSpeakerCue(value){
  const name=cleanStoryboardSpeaker(value);
  if(!name||name.length>28||/[.!?\u3002\uFF01\uFF1F;\uFF1B]/.test(name)||STORYBOARD_SCENE_HEADING.test(name))return false;
  if(/^[A-Z][A-Z0-9 .'-]{0,27}$/.test(name)&&name.split(/\s+/).length<=4)return true;
  return /^[\u4e00-\u9fffA-Za-z][\u4e00-\u9fffA-Za-z0-9 _.'-]{0,11}$/.test(name);
}
function detectStoryboardSpeaker(text){
  const value=String(text||'');
  const english=value.match(/\b([A-Z][A-Za-z'-]{1,20})\s+(?:says?|asks?|repl(?:y|ies|ied)|shouts?|tells?)\b/);
  if(english)return cleanStoryboardSpeaker(english[1]);
  const chinese=value.match(/([\u4e00-\u9fff]{1,6})(?:\u8bf4|\u95ee|\u56de\u7b54|\u56de\u5e94|\u558a|\u9053)/);
  return chinese?cleanStoryboardSpeaker(chinese[1]):'';
}
function classifyStoryboardSegment(text,explicitSpeaker='',flags={}){
  const value=String(text||'').trim(),speaker=cleanStoryboardSpeaker(explicitSpeaker||detectStoryboardSpeaker(value));
  const dialogueScore=storyboardKeywordScore(value,'dialogue');
  const actionScore=storyboardKeywordScore(value,'action');
  const environmentScore=storyboardKeywordScore(value,'environment');
  if(flags.heading)return {type:'environment',confidence:.98,reasonCode:'beat.environment',speakerName:'',ambiguous:false};
  if(flags.parenthetical)return {type:'action',confidence:.86,reasonCode:'beat.action',speakerName:speaker,ambiguous:false};
  if(speaker)return {type:'dialogue',confidence:String(explicitSpeaker||'').trim().length ? .95 : .88,reasonCode:'beat.explicitDialogue',speakerName:speaker,ambiguous:false};
  if(STORYBOARD_QUOTE.test(value)||dialogueScore>0)return {type:'dialogue',confidence:.84,reasonCode:'beat.quotedDialogue',speakerName:'',ambiguous:false};
  if(environmentScore>actionScore&&environmentScore>0)return {type:'environment',confidence:.84,reasonCode:'beat.environment',speakerName:'',ambiguous:false};
  if(actionScore>0)return {type:'action',confidence:.82,reasonCode:'beat.action',speakerName:'',ambiguous:false};
  if(environmentScore>0)return {type:'environment',confidence:.78,reasonCode:'beat.environment',speakerName:'',ambiguous:false};
  return {type:'action',confidence:.55,reasonCode:'beat.ambiguous',speakerName:'',ambiguous:true};
}
function analyzeStoryboardScript(rawText){
  const raw=String(rawText??''),lines=raw.replace(/\r\n?/g,'\n').split('\n');
  const beats=[],namedCharacters=[];let pendingSpeaker='';
  const rememberSpeaker=name=>{
    const clean=cleanStoryboardSpeaker(name);
    if(!clean)return '';
    const existing=namedCharacters.find(item=>item.toLowerCase()===clean.toLowerCase());
    if(existing)return existing;
    namedCharacters.push(clean);
    return clean;
  };
  const pushBeat=(text,explicitSpeaker='',flags={})=>{
    const value=String(text||'').trim();
    if(!value)return;
    const classified=classifyStoryboardSegment(value,explicitSpeaker,flags);
    const speaker=rememberSpeaker(classified.speakerName);
    beats.push({
      id:'B'+String(beats.length+1).padStart(2,'0'),
      type:classified.type,text:value,speakerName:speaker,
      confidence:classified.confidence,reasonCode:classified.reasonCode,ambiguous:classified.ambiguous,
    });
  };
  lines.forEach(rawLine=>{
    const line=rawLine.trim();
    if(!line){pendingSpeaker='';return;}
    if(STORYBOARD_SCENE_HEADING.test(line)){pushBeat(line,'',{heading:true});pendingSpeaker='';return;}
    const cue=line.match(/^([^:\uFF1A]{1,28})[:\uFF1A]\s*(.+)$/);
    if(cue&&isStoryboardSpeakerCue(cue[1])){
      const speaker=rememberSpeaker(cue[1]);
      splitStoryboardSegments(cue[2]).forEach(segment=>pushBeat(segment,speaker));
      pendingSpeaker='';return;
    }
    if(isStoryboardSpeakerCue(line)&&/^[A-Z]/.test(line)){
      pendingSpeaker=rememberSpeaker(line);return;
    }
    if(STORYBOARD_PARENTHETICAL.test(line)){
      pushBeat(line,pendingSpeaker,{parenthetical:true});return;
    }
    if(pendingSpeaker){
      splitStoryboardSegments(line).forEach(segment=>pushBeat(segment,pendingSpeaker));
      pendingSpeaker='';return;
    }
    splitStoryboardSegments(line).forEach(segment=>pushBeat(segment));
  });
  return {
    rawText:raw,
    normalizedText:raw.replace(/\r\n?/g,'\n').trim(),
    beats,
    namedCharacters,
    ambiguousCount:beats.filter(beat=>beat.ambiguous).length,
    extraCharacterCount:Math.max(0,namedCharacters.length-2),
  };
}
function parseBeats(text){return analyzeStoryboardScript(text).beats.map(beat=>beat.text);}
function scoreStoryboardTemplates(analysis){
  const counts=analysis.beats.reduce((out,beat)=>(out[beat.type]++,out),{dialogue:0,action:0,environment:0});
  const raw=analysis.normalizedText,roles=Math.min(2,analysis.namedCharacters.length);
  return {
    dialogue:counts.dialogue*4+roles*2+storyboardKeywordScore(raw,'dialogue'),
    chase:counts.action*2+storyboardKeywordScore(raw,'action')*2,
    establishing:counts.environment*3+storyboardKeywordScore(raw,'environment')*2,
    performance:counts.action+(analysis.namedCharacters.length<=1?2:0)+storyboardKeywordScore(raw,'single')*3,
  };
}
function storyboardTemplateDecision(rawText,requested='auto',existingAnalysis=null){
  const analysis=existingAnalysis||analyzeStoryboardScript(rawText);
  const manual=requested!=='auto'&&SCENE_TEMPLATES.some(template=>template.id===requested);
  const scores=scoreStoryboardTemplates(analysis);
  if(manual)return {templateId:requested,reasonCode:'template.manual',confidence:1,scores};
  const order=['dialogue','chase','establishing','performance'];
  let best=order[0];
  order.slice(1).forEach(id=>{if(scores[id]>scores[best])best=id;});
  const sorted=order.map(id=>scores[id]).sort((a,b)=>b-a),bestScore=sorted[0],second=sorted[1];
  if(bestScore<=0)best=analysis.beats.length<=2?'performance':'dialogue';
  const confidence=bestScore<=0 ? .55 : clampStoryboard(.55+.4*(bestScore-second)/Math.max(1,bestScore),.55,.95);
  return {templateId:best,reasonCode:bestScore<=0?'template.fallback':'template.'+best,confidence:roundStoryboard(confidence,3),scores};
}
function detectStoryTemplate(text){return storyboardTemplateDecision(text,'auto').templateId;}
function resolveStoryTemplateId(text,requested){return storyboardTemplateDecision(text,requested).templateId;}
function storyboardActorCatalog(sourceScene,template){
  const source=Array.isArray(sourceScene?.actors)?sourceScene.actors:[];
  const fallback=Array.isArray(template?.actors)?template.actors:[];
  const list=source.length?source:fallback;
  return list.filter(actor=>actor&&actor.label).map(actor=>({
    label:String(actor.label),kind:String(actor.kind||'prop'),
    pos:[clampStoryboard(actor.pos?.[0]||0,-STORYBOARD_STAGE_LIMIT,STORYBOARD_STAGE_LIMIT),clampStoryboard(actor.pos?.[1]||0,-STORYBOARD_STAGE_LIMIT,STORYBOARD_STAGE_LIMIT)],
    rotY:Number.isFinite(+actor.rotY)?+actor.rotY:0,
  }));
}
function resolveStoryboardRoles(analysis,actorCatalog,roleMappings={}){
  const characters=actorCatalog.filter(actor=>actor.kind==='char');
  const candidates=characters.length?characters:actorCatalog;
  const hasDialogue=analysis.beats.some(beat=>beat.type==='dialogue');
  const roleCount=Math.min(2,Math.max(1,analysis.namedCharacters.length,hasDialogue&&candidates.length>1?2:1));
  return Array.from({length:roleCount},(_,index)=>{
    const id=index===0?'primary':'secondary',requested=roleMappings?.[id];
    const mapped=candidates.find(actor=>actor.label===requested)||candidates[index]||candidates[0]||null;
    return {
      id,
      sourceName:analysis.namedCharacters[index]||'',
      actorLabel:mapped?.label||'',
      confidence:analysis.namedCharacters[index] ? .8 : .66,
      reasonCode:analysis.namedCharacters[index]?'role.detected':'role.inferred',
    };
  });
}
function storyboardActorForRole(roleId,roles,actorCatalog){
  const role=roles.find(item=>item.id===roleId)||roles[0];
  return actorCatalog.find(actor=>actor.label===role?.actorLabel)||actorCatalog[0]||{label:'',kind:'prop',pos:[0,0],rotY:0};
}
function storyboardRoleForBeat(beat,roles,index){
  const named=roles.find(role=>role.sourceName&&role.sourceName===beat?.speakerName);
  if(named)return named.id;
  if(beat?.type==='dialogue'&&roles.length>1)return index%2?'secondary':'primary';
  return 'primary';
}
function storyboardAxis(roles,actorCatalog){
  const primary=storyboardActorForRole('primary',roles,actorCatalog);
  const secondary=roles.length>1?storyboardActorForRole('secondary',roles,actorCatalog):null;
  let dx=(secondary?.pos?.[0]??primary.pos[0])-primary.pos[0],dz=(secondary?.pos?.[1]??primary.pos[1])-primary.pos[1];
  let length=Math.hypot(dx,dz);
  if(length<.5){dx=Math.sin(primary.rotY||0);dz=Math.cos(primary.rotY||0);length=Math.hypot(dx,dz)||1;}
  const direction=[dx/length,dz/length],basePerp=[-direction[1],direction[0]];
  const midpoint=secondary?[(primary.pos[0]+secondary.pos[0])/2,(primary.pos[1]+secondary.pos[1])/2]:primary.pos.slice();
  const margin=side=>{
    const x=midpoint[0]+basePerp[0]*side*7,z=midpoint[1]+basePerp[1]*side*7;
    return Math.min(STORYBOARD_STAGE_LIMIT-Math.abs(x),STORYBOARD_STAGE_LIMIT-Math.abs(z));
  };
  const side=margin(1)>=margin(-1)?1:-1;
  return {origin:primary.pos.slice(),direction,perpendicular:[basePerp[0]*side,basePerp[1]*side],side};
}
function storyboardShotGroups(beats){
  const count=Math.max(4,Math.min(8,beats.length)),groups=Array.from({length:count},()=>[]);
  if(beats.length<=count){
    beats.forEach((beat,index)=>groups[index].push(beat));
    for(let index=beats.length;index<count;index++)groups[index].push(beats[index%beats.length]);
  }else{
    beats.forEach((beat,index)=>groups[Math.min(count-1,Math.floor(index*count/beats.length))].push(beat));
  }
  return groups;
}
function storyboardCameraForShot(templateShot,shotIndex,beat,subject,axis,moodSpec){
  const type=beat?.type||'action',isSupport=!!beat?.support;
  let distance=type==='environment'?9:type==='action'?6:shotIndex===0?7:4.2;
  if(isSupport)distance=3.8;
  distance*=moodSpec.distance;
  const count=Math.max(type==='action'?2:1,templateShot.cam?.length||1),points=[];
  for(let index=0;index<count;index++){
    const source=templateShot.cam?.[Math.min(index,(templateShot.cam?.length||1)-1)]||[0,2,0];
    const progress=count===1?0:index/(count-1)-.5;
    const along=progress*2.2+(shotIndex%2?.65:-.65);
    const sideDistance=Math.max(2.4,distance-progress*.5);
    let x=subject.pos[0]+axis.perpendicular[0]*sideDistance+axis.direction[0]*along;
    let z=subject.pos[1]+axis.perpendicular[1]*sideDistance+axis.direction[1]*along;
    x=clampStoryboard(x,-STORYBOARD_STAGE_LIMIT,STORYBOARD_STAGE_LIMIT);
    z=clampStoryboard(z,-STORYBOARD_STAGE_LIMIT,STORYBOARD_STAGE_LIMIT);
    const cross=(axis.direction[0]*(z-axis.origin[1])-axis.direction[1]*(x-axis.origin[0]))*axis.side;
    if(cross<.35){
      x=clampStoryboard(subject.pos[0]+axis.perpendicular[0]*2.4,-STORYBOARD_STAGE_LIMIT,STORYBOARD_STAGE_LIMIT);
      z=clampStoryboard(subject.pos[1]+axis.perpendicular[1]*2.4,-STORYBOARD_STAGE_LIMIT,STORYBOARD_STAGE_LIMIT);
    }
    points.push([roundStoryboard(x),roundStoryboard(clampStoryboard((source[1]||2)+moodSpec.height,.2,15)),roundStoryboard(z)]);
  }
  return points;
}
function buildStoryboardPlan(rawText,options={},sourceScene={}){
  const analysis=analyzeStoryboardScript(rawText);
  if(!analysis.beats.length)return null;
  const requestedTemplate=SCENE_TEMPLATES.some(template=>template.id===options.requestedTemplate)?options.requestedTemplate:'auto';
  const mood=STORY_MOOD_ADJUSTMENTS[options.mood]?options.mood:'daily';
  const pace=STORY_PACE_MULTIPLIER[options.pace]?options.pace:'standard';
  const decision=storyboardTemplateDecision(rawText,requestedTemplate,analysis);
  const template=sceneTemplateById(decision.templateId),actorCatalog=storyboardActorCatalog(sourceScene,template);
  const roles=resolveStoryboardRoles(analysis,actorCatalog,options.roleMappings||{});
  const axis=storyboardAxis(roles,actorCatalog),groups=storyboardShotGroups(analysis.beats);
  const moodSpec=STORY_MOOD_ADJUSTMENTS[mood],paceMultiplier=STORY_PACE_MULTIPLIER[pace];
  const shots=groups.map((group,index)=>{
    const primaryBeat=group[0],support=index>=analysis.beats.length&&analysis.beats.length<4;
    const beat=Object.assign({},primaryBeat,{support}),roleId=storyboardRoleForBeat(primaryBeat,roles,index);
    const subject=storyboardActorForRole(roleId,roles,actorCatalog),templateShot=template.shots[index%template.shots.length];
    const merged=group.length>1,reasonCode=support?'shot.support':index===0?'shot.establish':primaryBeat.type==='dialogue'?'shot.dialogue':primaryBeat.type==='environment'?'shot.environment':'shot.action';
    const averageConfidence=group.reduce((sum,item)=>sum+item.confidence,0)/group.length;
    return {
      id:'S'+String(index+1).padStart(2,'0'),
      templateShotIndex:index%template.shots.length,
      compositionNameKey:templateShot.nameKey,
      compositionDescriptionKey:templateShot.descKey,
      beatIds:group.map(item=>item.id),
      subjectRole:roleId,
      lockActorLabel:subject.label,
      dur:clampStoryboard(Math.round((templateShot.dur+(merged?Math.min(2,group.length-1)*.5:0))*moodSpec.duration*paceMultiplier*2)/2,1,15),
      fov:clampStoryboard(Math.round(templateShot.fov+moodSpec.fov),10,110),
      cam:storyboardCameraForShot(templateShot,index,beat,subject,axis,moodSpec),
      axisSide:axis.side,
      eyeline:roles.length<2?'center':roleId==='secondary'?'left':'right',
      reasonCode,
      mergeReasonCode:merged?'merge.shotLimit':'',
      confidence:roundStoryboard(clampStoryboard((averageConfidence+decision.confidence)/2,.55,.98),3),
    };
  });
  const beats=analysis.beats.map(beat=>{
    const covering=shots.filter(shot=>shot.beatIds.includes(beat.id)).map(shot=>shot.id);
    const extraSpeaker=beat.speakerName&&!roles.some(role=>role.sourceName===beat.speakerName);
    const mergedShot=shots.find(shot=>shot.beatIds.length>1&&shot.beatIds.includes(beat.id));
    return Object.assign({},beat,{
      roleId:storyboardRoleForBeat(beat,roles,analysis.beats.indexOf(beat)),
      coverageShotIds:covering,
      mergeReasonCode:extraSpeaker?'merge.extraCharacter':mergedShot?'merge.shotLimit':'',
    });
  });
  const warnings=[];
  if(analysis.extraCharacterCount)warnings.push({code:'tooManyCharacters',count:analysis.namedCharacters.length});
  if(analysis.ambiguousCount)warnings.push({code:'ambiguousBeats',count:analysis.ambiguousCount});
  return {
    schemaVersion:STORYBOARD_PLAN_VERSION,
    rawText:analysis.rawText,
    normalizedText:analysis.normalizedText,
    options:{requestedTemplate,mood,pace},
    templateId:decision.templateId,
    templateDecision:decision,
    roles,beats,shots,warnings,axis,
    availableActors:actorCatalog,
  };
}
function validateStoryboardPlan(plan,actorCatalog=plan?.availableActors||[]){
  const errors=[];
  if(!plan||plan.schemaVersion!==STORYBOARD_PLAN_VERSION)errors.push('plan.schema');
  if(!plan?.shots||plan.shots.length<4||plan.shots.length>8)errors.push('plan.shotCount');
  const actorLabels=new Set(actorCatalog.map(actor=>actor.label)),characterCount=actorCatalog.filter(actor=>actor.kind==='char').length;
  if((plan?.roles||[]).some(role=>!actorLabels.has(role.actorLabel)))errors.push('plan.roleMapping');
  if(characterCount>1&&new Set((plan?.roles||[]).map(role=>role.actorLabel)).size!==(plan?.roles||[]).length)errors.push('plan.duplicateRole');
  const covered=new Set();
  (plan?.shots||[]).forEach(shot=>{
    shot.beatIds.forEach(id=>covered.add(id));
    if(!actorLabels.has(shot.lockActorLabel))errors.push('shot.subject');
    if(!Number.isFinite(+shot.dur)||shot.dur<1||shot.dur>15)errors.push('shot.duration');
    if(!Number.isFinite(+shot.fov)||shot.fov<10||shot.fov>110)errors.push('shot.fov');
    if(!Array.isArray(shot.cam)||!shot.cam.length)errors.push('shot.camera');
    (shot.cam||[]).forEach(point=>{
      if(!Array.isArray(point)||point.length!==3||point.some(value=>!Number.isFinite(+value))||
        Math.abs(point[0])>STORYBOARD_STAGE_LIMIT||point[1]<.2||point[1]>15||Math.abs(point[2])>STORYBOARD_STAGE_LIMIT)errors.push('shot.camera');
      const cross=(plan.axis.direction[0]*(point[2]-plan.axis.origin[1])-plan.axis.direction[1]*(point[0]-plan.axis.origin[0]))*plan.axis.side;
      if(cross<=0)errors.push('shot.axis');
    });
  });
  (plan?.beats||[]).forEach(beat=>{if(!covered.has(beat.id)&&!beat.mergeReasonCode)errors.push('beat.coverage');});
  return {valid:errors.length===0,errors:[...new Set(errors)]};
}
function storyboardCompositionLabel(key){
  return PreVisionI18n.t(key).replace(/^\d+\s*/,'').trim();
}
function materializeStoryboardPlanShots(plan){
  return plan.shots.map((shot,index)=>{
    const composition=storyboardCompositionLabel(shot.compositionNameKey);
    const description=PreVisionI18n.t(shot.compositionDescriptionKey);
    const beatText=plan.beats.filter(beat=>shot.beatIds.includes(beat.id)).map(beat=>beat.text).join(' / ').slice(0,120);
    return {
      name:PreVisionI18n.t('storyboard.generatedShotName',{index:String(index+1).padStart(2,'0'),composition}),
      desc:PreVisionI18n.t('storyboard.generatedShotDescription',{composition:description,beat:beatText}),
      dur:shot.dur,lock:shot.lockActorLabel,fov:shot.fov,
      camMode:shot.cam.length>1?'curve':'line',timingMode:'arcLength',syncActor:'',cam:deepCopy(shot.cam),
    };
  });
}
function storyboardPlanToScene(plan,sourceScene,index){
  const sceneData=deepCopy(sourceScene||{}),templateText=sceneTemplateText(sceneTemplateById(plan.templateId));
  sceneData.name=PreVisionI18n.t('storyboard.generatedSceneName',{index,template:templateText.name});
  sceneData.desc=PreVisionI18n.t('storyboard.generatedSceneDescription',{
    template:templateText.name,
    mood:PreVisionI18n.t(STORY_MOOD_LABEL_KEYS[plan.options.mood]||STORY_MOOD_LABEL_KEYS.daily),
    pace:PreVisionI18n.t(STORY_PACE_LABEL_KEYS[plan.options.pace]||STORY_PACE_LABEL_KEYS.standard),
  });
  sceneData.templateId=plan.templateId;
  sceneData.script=plan.rawText;
  sceneData.actors=Array.isArray(sceneData.actors)&&sceneData.actors.length?sceneData.actors:deepCopy(sceneTemplateById(plan.templateId).actors);
  sceneData.shots=materializeStoryboardPlanShots(plan);
  delete sceneData.storyboardPlan;
  return sceneData;
}
function genStoryboard(text,mood='daily',pace='standard',requestedTemplate='auto'){
  const template=sceneTemplateById(resolveStoryTemplateId(text,requestedTemplate));
  const plan=buildStoryboardPlan(text,{mood,pace,requestedTemplate},{actors:deepCopy(template.actors)});
  return plan?materializeStoryboardPlanShots(plan):[];
}
let pendingStoryboardPlan=null,pendingStoryboardSource=null,storyboardPlanStale=false;
const STORYBOARD_DIALOG_DEFAULT_WIDTH=960,STORYBOARD_DIALOG_DEFAULT_HEIGHT=760;
const STORYBOARD_DIALOG_MIN_WIDTH=760,STORYBOARD_DIALOG_MIN_HEIGHT=640,STORYBOARD_DIALOG_MARGIN=16;
let storyboardDialogFullscreen=false,storyboardDialogRestoreBounds=null,storyboardDialogResizeSession=null;
const STORYBOARD_RESIZE_CORNERS=['nw','ne','sw','se'];
/* Transitional globalThis accessor shim for the planner's mutable module state
 * (ADR-0009 mechanism; removed with the store shim in P9). Bare setters, no side
 * effects — external bare reads/writes keep the exact pre-split semantics. */
const defineStoryboardGlobal = (name, get, set) =>
  Object.defineProperty(globalThis, name, { get, set, configurable: true });
defineStoryboardGlobal('pendingStoryboardPlan', () => pendingStoryboardPlan, v => { pendingStoryboardPlan = v; });
defineStoryboardGlobal('pendingStoryboardSource', () => pendingStoryboardSource, v => { pendingStoryboardSource = v; });
defineStoryboardGlobal('storyboardPlanStale', () => storyboardPlanStale, v => { storyboardPlanStale = v; });
defineStoryboardGlobal('storyboardDialogFullscreen', () => storyboardDialogFullscreen, v => { storyboardDialogFullscreen = v; });
defineStoryboardGlobal('storyboardDialogRestoreBounds', () => storyboardDialogRestoreBounds, v => { storyboardDialogRestoreBounds = v; });
defineStoryboardGlobal('storyboardDialogResizeSession', () => storyboardDialogResizeSession, v => { storyboardDialogResizeSession = v; });
function storyboardResizeHandles(){return STORYBOARD_RESIZE_CORNERS.map(corner=>$('storyResize'+corner.toUpperCase()));}
function storyboardDialogViewport(){
  return {width:Math.max(1,window.innerWidth||document.documentElement.clientWidth||1),height:Math.max(1,window.innerHeight||document.documentElement.clientHeight||1)};
}
function clampStoryboardDialogBounds(bounds={}){
  const viewport=storyboardDialogViewport(),margin=Math.min(STORYBOARD_DIALOG_MARGIN,Math.floor(Math.min(viewport.width,viewport.height)/4));
  const maxWidth=Math.max(1,viewport.width-margin*2),maxHeight=Math.max(1,viewport.height-margin*2);
  const minWidth=Math.min(STORYBOARD_DIALOG_MIN_WIDTH,maxWidth),minHeight=Math.min(STORYBOARD_DIALOG_MIN_HEIGHT,maxHeight);
  const width=clampStoryboard(Number.isFinite(+bounds.width)?+bounds.width:STORYBOARD_DIALOG_DEFAULT_WIDTH,minWidth,maxWidth);
  const height=clampStoryboard(Number.isFinite(+bounds.height)?+bounds.height:STORYBOARD_DIALOG_DEFAULT_HEIGHT,minHeight,maxHeight);
  const maxLeft=Math.max(margin,viewport.width-margin-width),maxTop=Math.max(margin,viewport.height-margin-height);
  const fallbackLeft=(viewport.width-width)/2,fallbackTop=(viewport.height-height)/2;
  const left=clampStoryboard(Number.isFinite(+bounds.left)?+bounds.left:fallbackLeft,margin,maxLeft);
  const top=clampStoryboard(Number.isFinite(+bounds.top)?+bounds.top:fallbackTop,margin,maxTop);
  return {left:Math.round(left),top:Math.round(top),width:Math.round(width),height:Math.round(height),minWidth,minHeight,maxWidth,maxHeight};
}
function getStoryboardDialogBounds(){
  const dlg=$('storyDlg'),rect=dlg.getBoundingClientRect();
  return {
    left:Number.isFinite(parseFloat(dlg.style.left))?parseFloat(dlg.style.left):rect.left,
    top:Number.isFinite(parseFloat(dlg.style.top))?parseFloat(dlg.style.top):rect.top,
    width:parseFloat(dlg.style.width)||rect.width||STORYBOARD_DIALOG_DEFAULT_WIDTH,
    height:parseFloat(dlg.style.height)||rect.height||STORYBOARD_DIALOG_DEFAULT_HEIGHT,
  };
}
function updateStoryboardDialogWindowButton(){
  const button=$('storyFullscreen'),key=storyboardDialogFullscreen?'storyboard.window.restore':'storyboard.window.fullscreen';
  button.dataset.i18n=key;button.dataset.i18nTitle=key;button.dataset.i18nAriaLabel=key;
  button.textContent=PreVisionI18n.t(key);button.title=PreVisionI18n.t(key);button.setAttribute('aria-label',PreVisionI18n.t(key));
  button.setAttribute('aria-pressed',String(storyboardDialogFullscreen));
}
function applyStoryboardDialogBounds(bounds={}){
  const dlg=$('storyDlg');
  let next;
  if(storyboardDialogFullscreen){
    const viewport=storyboardDialogViewport();next={left:0,top:0,width:viewport.width,height:viewport.height};
  }else next=clampStoryboardDialogBounds(bounds);
  dlg.style.left=next.left+'px';dlg.style.top=next.top+'px';dlg.style.width=next.width+'px';dlg.style.height=next.height+'px';
  storyboardResizeHandles().forEach(handle=>handle.setAttribute('aria-valuetext',next.width+' \u00d7 '+next.height));
  return next;
}
function setStoryboardResizeHandlesEnabled(enabled){
  storyboardResizeHandles().forEach(handle=>{handle.disabled=!enabled;handle.tabIndex=enabled?0:-1;handle.setAttribute('aria-hidden',String(!enabled));});
}
function resetStoryboardDialogWindow(){
  storyboardDialogFullscreen=false;storyboardDialogRestoreBounds=null;storyboardDialogResizeSession=null;
  $('storyDlg').classList.remove('story-fullscreen');document.body.classList.remove('story-dialog-resizing','story-dialog-resizing-nwse','story-dialog-resizing-nesw');
  setStoryboardResizeHandlesEnabled(true);
  updateStoryboardDialogWindowButton();return applyStoryboardDialogBounds({width:STORYBOARD_DIALOG_DEFAULT_WIDTH,height:STORYBOARD_DIALOG_DEFAULT_HEIGHT});
}
function setStoryboardDialogFullscreen(force){
  const next=force===undefined?!storyboardDialogFullscreen:!!force;
  if(next===storyboardDialogFullscreen){applyStoryboardDialogBounds(getStoryboardDialogBounds());return storyboardDialogFullscreen;}
  if(next)storyboardDialogRestoreBounds=getStoryboardDialogBounds();
  storyboardDialogFullscreen=next;$('storyDlg').classList.toggle('story-fullscreen',next);
  setStoryboardResizeHandlesEnabled(!next);
  if(next&&storyboardResizeHandles().includes(document.activeElement))$('storyFullscreen').focus();
  const applied=next?applyStoryboardDialogBounds():applyStoryboardDialogBounds(storyboardDialogRestoreBounds||{});
  if(!next)storyboardDialogRestoreBounds=null;
  updateStoryboardDialogWindowButton();
  return Object.assign({fullscreen:storyboardDialogFullscreen},applied);
}
function fitStoryboardDialogToViewport(){
  if(!$('storyDlg').open)return null;
  return applyStoryboardDialogBounds(getStoryboardDialogBounds());
}
function finishStoryboardDialogResize(event){
  if(!storyboardDialogResizeSession)return false;
  if(event?.pointerId!==undefined&&storyboardDialogResizeSession.pointerId!==undefined&&event.pointerId!==storyboardDialogResizeSession.pointerId)return false;
  const pointerId=storyboardDialogResizeSession.pointerId,handle=storyboardDialogResizeSession.handle;storyboardDialogResizeSession=null;
  document.body.classList.remove('story-dialog-resizing','story-dialog-resizing-nwse','story-dialog-resizing-nesw');
  try{if(pointerId!==undefined)handle?.releasePointerCapture(pointerId);}catch(_error){}
  event?.preventDefault?.();event?.stopPropagation?.();return true;
}
function beginStoryboardDialogResize(event){
  if(storyboardDialogFullscreen||event.button>0)return false;
  const handle=event.currentTarget,corner=handle?.dataset?.corner;
  if(!STORYBOARD_RESIZE_CORNERS.includes(corner)||handle.disabled)return false;
  const bounds=getStoryboardDialogBounds();
  storyboardDialogResizeSession={pointerId:event.pointerId,handle,corner,startX:event.clientX,startY:event.clientY,startWidth:bounds.width,startHeight:bounds.height,left:bounds.left,top:bounds.top,right:bounds.left+bounds.width,bottom:bounds.top+bounds.height};
  event.preventDefault?.();event.stopPropagation?.();document.body.classList.add('story-dialog-resizing','story-dialog-resizing-'+(corner==='nw'||corner==='se'?'nwse':'nesw'));handle.focus();
  try{if(event.pointerId!==undefined)handle.setPointerCapture(event.pointerId);}catch(_error){}
  return true;
}
function moveStoryboardDialogResize(event){
  const session=storyboardDialogResizeSession;if(!session)return false;
  if(event.pointerId!==undefined&&session.pointerId!==undefined&&event.pointerId!==session.pointerId)return false;
  event.preventDefault?.();event.stopPropagation?.();
  const west=session.corner.includes('w'),north=session.corner.includes('n');
  const dx=event.clientX-session.startX,dy=event.clientY-session.startY;
  const viewport=storyboardDialogViewport(),maxWidth=Math.max(1,viewport.width-STORYBOARD_DIALOG_MARGIN*2),maxHeight=Math.max(1,viewport.height-STORYBOARD_DIALOG_MARGIN*2);
  const width=clampStoryboard(session.startWidth+(west?-dx:dx),Math.min(STORYBOARD_DIALOG_MIN_WIDTH,maxWidth),maxWidth);
  const height=clampStoryboard(session.startHeight+(north?-dy:dy),Math.min(STORYBOARD_DIALOG_MIN_HEIGHT,maxHeight),maxHeight);
  applyStoryboardDialogBounds({left:west?session.right-width:session.left,top:north?session.bottom-height:session.top,width,height});
  return true;
}
function resizeStoryboardDialogByKeyboard(event){
  if(storyboardDialogFullscreen||!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home'].includes(event.key))return false;
  event.preventDefault?.();event.stopPropagation?.();
  const handle=event.currentTarget,corner=handle?.dataset?.corner;
  if(!STORYBOARD_RESIZE_CORNERS.includes(corner)||handle.disabled)return false;
  if(event.key==='Home'){resetStoryboardDialogWindow();handle.focus();return true;}
  const bounds=getStoryboardDialogBounds(),step=event.shiftKey?64:16,west=corner.includes('w'),north=corner.includes('n');
  const right=bounds.left+bounds.width,bottom=bounds.top+bounds.height;
  if(event.key==='ArrowLeft')bounds.width+=west?step:-step;
  if(event.key==='ArrowRight')bounds.width+=west?-step:step;
  if(event.key==='ArrowUp')bounds.height+=north?step:-step;
  if(event.key==='ArrowDown')bounds.height+=north?-step:step;
  const viewport=storyboardDialogViewport(),maxWidth=Math.max(1,viewport.width-STORYBOARD_DIALOG_MARGIN*2),maxHeight=Math.max(1,viewport.height-STORYBOARD_DIALOG_MARGIN*2);
  bounds.width=clampStoryboard(bounds.width,Math.min(STORYBOARD_DIALOG_MIN_WIDTH,maxWidth),maxWidth);
  bounds.height=clampStoryboard(bounds.height,Math.min(STORYBOARD_DIALOG_MIN_HEIGHT,maxHeight),maxHeight);
  if(west)bounds.left=right-bounds.width;if(north)bounds.top=bottom-bounds.height;
  applyStoryboardDialogBounds(bounds);return true;
}
function teardownStoryboardDialogWindow(){
  finishStoryboardDialogResize();storyboardDialogFullscreen=false;storyboardDialogRestoreBounds=null;
  $('storyDlg').classList.remove('story-fullscreen');setStoryboardResizeHandlesEnabled(true);updateStoryboardDialogWindowButton();
}
function storyboardDialogHeaderDoubleClick(event){
  let target=event.target;
  while(target&&target!==event.currentTarget){
    if(['BUTTON','INPUT','SELECT','TEXTAREA','A'].includes(target.tagName)||target.isContentEditable||target.getAttribute?.('role')==='button')return false;
    target=target.parentElement;
  }
  event.preventDefault?.();setStoryboardDialogFullscreen();return true;
}
function currentStoryboardSourceSnapshot(){
  return {sceneIndex:sceneIdx,scene:deepCopy(runtimeStageToData())};
}
function storyboardReasonText(code){return PreVisionI18n.t(STORYBOARD_REASON_LABEL_KEYS[code]||'storyboard.error.invalidPlan');}
function storyboardConfidence(value){return PreVisionI18n.t('storyboard.confidence.value',{value:Math.round(clampStoryboard(value,0,1)*100)});}
function mergeStoryboardPlanEdits(previous,next){
  if(!previous||!next)return next;
  const previousShots=new Map(previous.shots.map(shot=>[shot.id,shot]));
  next.shots.forEach(shot=>{
    const prior=previousShots.get(shot.id);
    if(!prior)return;
    shot.dur=clampStoryboard(Math.round(+prior.dur*2)/2,1,15);
    shot.fov=clampStoryboard(Math.round(+prior.fov),10,110);
    const mappedRole=prior.subjectRole&&next.roles.find(role=>role.id===prior.subjectRole);
    if(mappedRole){
      shot.subjectRole=mappedRole.id;
      shot.lockActorLabel=mappedRole.actorLabel;
      shot.eyeline=mappedRole.id==='secondary'?'left':mappedRole.id==='primary'?'right':'center';
    }else if(next.availableActors.some(actor=>actor.label===prior.lockActorLabel)){
      shot.subjectRole='';
      shot.lockActorLabel=prior.lockActorLabel;
      shot.eyeline='center';
    }
  });
  return next;
}
function appendStoryboardOption(select,value,label,selected){
  const option=document.createElement('option');option.value=value;option.textContent=label;option.selected=!!selected;
  if(selected)select.value=value;
  select.appendChild(option);return option;
}
function setStoryboardPlanState(stale=false){
  storyboardPlanStale=!!stale;
  const key=stale?'storyboard.preview.stale':'storyboard.preview.notApplied';
  $('storyPlanState').textContent=PreVisionI18n.t(key);
  $('storyPlanState').classList.toggle('stale',stale);
  $('storyFooterNote').textContent=PreVisionI18n.t(key);
  const validation=validateStoryboardPlan(pendingStoryboardPlan);
  $('storyApply').disabled=stale||!validation.valid;
}
function renderStoryboardPlan(){
  const plan=pendingStoryboardPlan;
  if(!plan){$('storyDialogBody').classList.remove('has-plan');$('storyPreview').hidden=true;$('storyApply').hidden=true;return;}
  $('storyDialogBody').classList.add('has-plan');
  $('storyPreview').hidden=false;$('storyApply').hidden=false;
  $('storyPreviewSummary').textContent=PreVisionI18n.t('storyboard.preview.summary',{beatCount:plan.beats.length,shotCount:plan.shots.length});
  const templateName=PreVisionI18n.t(sceneTemplateById(plan.templateId).nameKey);
  $('storyTemplateDecision').textContent=PreVisionI18n.t('storyboard.preview.templateDecision',{
    template:templateName,reason:storyboardReasonText(plan.templateDecision.reasonCode),confidence:storyboardConfidence(plan.templateDecision.confidence),
  });
  const roleList=$('storyRoleList');roleList.innerHTML='';
  const roleCandidates=plan.availableActors.filter(actor=>actor.kind==='char').length?plan.availableActors.filter(actor=>actor.kind==='char'):plan.availableActors;
  plan.roles.forEach(role=>{
    const row=document.createElement('div');row.className='story-role-row';
    const name=document.createElement('div');name.className='story-role-name';
    const roleType=document.createElement('small');roleType.textContent=PreVisionI18n.t(STORYBOARD_ROLE_LABEL_KEYS[role.id]||'storyboard.roles.primary');
    const source=document.createElement('span');source.textContent=role.sourceName?
      PreVisionI18n.t('storyboard.roles.detected',{name:role.sourceName}):PreVisionI18n.t('storyboard.roles.inferred');
    name.appendChild(roleType);name.appendChild(source);
    const field=document.createElement('label');field.className='story-field';
    const fieldLabel=document.createElement('span');fieldLabel.textContent=PreVisionI18n.t('storyboard.roles.sceneActor');
    const select=document.createElement('select');select.dataset.roleId=role.id;
    roleCandidates.forEach(actor=>appendStoryboardOption(select,actor.label,actor.label,actor.label===role.actorLabel));
    select.onchange=()=>{
      const mappings=Object.fromEntries(plan.roles.map(item=>[item.id,item.id===role.id?select.value:item.actorLabel]));
      const rebuilt=buildStoryboardPlan(plan.rawText,Object.assign({},plan.options,{roleMappings:mappings}),pendingStoryboardSource.scene);
      pendingStoryboardPlan=mergeStoryboardPlanEdits(plan,rebuilt);
      renderStoryboardPlan();
    };
    field.appendChild(fieldLabel);field.appendChild(select);row.appendChild(name);row.appendChild(field);roleList.appendChild(row);
  });
  const warnings=$('storyWarnings');warnings.innerHTML='';
  plan.warnings.forEach(warning=>{
    const item=document.createElement('div');item.className='story-warning';
    item.textContent=PreVisionI18n.t(STORYBOARD_WARNING_LABEL_KEYS[warning.code]||'storyboard.error.invalidPlan',{count:warning.count});warnings.appendChild(item);
  });
  const beatList=$('storyBeatList');beatList.innerHTML='';
  plan.beats.forEach(beat=>{
    const row=document.createElement('div');row.className='story-beat-row';
    const meta=document.createElement('div');meta.className='story-beat-meta';
    meta.textContent=PreVisionI18n.t('storyboard.beat.meta',{
      id:beat.id,type:PreVisionI18n.t(STORYBOARD_BEAT_TYPE_LABEL_KEYS[beat.type]||'storyboard.beat.type.action'),confidence:storyboardConfidence(beat.confidence),
    });
    const copy=document.createElement('div');copy.className='story-beat-text';copy.textContent=beat.text;
    if(beat.speakerName){
      const speaker=document.createElement('small');speaker.style.display='block';speaker.style.color='var(--tx3)';
      speaker.textContent=PreVisionI18n.t('storyboard.beat.speaker',{speaker:beat.speakerName});copy.appendChild(speaker);
    }
    const coverage=document.createElement('div');coverage.className='story-beat-cover';
    coverage.textContent=beat.mergeReasonCode?
      PreVisionI18n.t('storyboard.beat.merged',{shot:beat.coverageShotIds[0],reason:storyboardReasonText(beat.mergeReasonCode)}):
      PreVisionI18n.t('storyboard.beat.coveredBy',{shots:beat.coverageShotIds.join(', ')});
    row.appendChild(meta);row.appendChild(copy);row.appendChild(coverage);beatList.appendChild(row);
  });
  const shotList=$('storyShotList');shotList.innerHTML='';
  plan.shots.forEach((shot,index)=>{
    const card=document.createElement('article');card.className='story-shot-card';
    const title=document.createElement('h6');title.textContent=PreVisionI18n.t('storyboard.shot.title',{id:shot.id,composition:storyboardCompositionLabel(shot.compositionNameKey)});
    const meta=document.createElement('div');meta.className='story-shot-meta';
    meta.textContent=PreVisionI18n.t('storyboard.shot.meta',{
      confidence:storyboardConfidence(shot.confidence),axis:PreVisionI18n.t('storyboard.axis.sameSide'),eyeline:PreVisionI18n.t(STORYBOARD_EYELINE_LABEL_KEYS[shot.eyeline]||'storyboard.eyeline.center'),
    });
    const fields=document.createElement('div');fields.className='story-shot-fields';
    const subjectField=document.createElement('label');subjectField.className='story-field';
    const subjectLabel=document.createElement('span');subjectLabel.textContent=PreVisionI18n.t('storyboard.shot.subject');
    const subjectSelect=document.createElement('select');
    plan.availableActors.forEach(actor=>appendStoryboardOption(subjectSelect,actor.label,actor.label,actor.label===shot.lockActorLabel));
    subjectSelect.onchange=()=>{
      const next=deepCopy(pendingStoryboardPlan),target=next.shots[index];target.lockActorLabel=subjectSelect.value;
      const role=next.roles.find(item=>item.actorLabel===subjectSelect.value);target.subjectRole=role?.id||'';target.eyeline=role?.id==='secondary'?'left':role?.id==='primary'?'right':'center';
      pendingStoryboardPlan=next;renderStoryboardPlan();
    };
    subjectField.appendChild(subjectLabel);subjectField.appendChild(subjectSelect);
    const durationField=document.createElement('label');durationField.className='story-field';
    const durationLabel=document.createElement('span');durationLabel.textContent=PreVisionI18n.t('storyboard.shot.duration');
    const duration=document.createElement('input');duration.type='number';duration.min='1';duration.max='15';duration.step='.5';duration.value=shot.dur;
    duration.onchange=()=>{pendingStoryboardPlan.shots[index].dur=clampStoryboard(Math.round(+duration.value*2)/2,1,15);renderStoryboardPlan();};
    durationField.appendChild(durationLabel);durationField.appendChild(duration);
    const fovField=document.createElement('label');fovField.className='story-field';
    const fovLabel=document.createElement('span');fovLabel.textContent=PreVisionI18n.t('storyboard.shot.fov');
    const fov=document.createElement('input');fov.type='number';fov.min='10';fov.max='110';fov.step='1';fov.value=shot.fov;
    fov.onchange=()=>{pendingStoryboardPlan.shots[index].fov=clampStoryboard(Math.round(+fov.value),10,110);renderStoryboardPlan();};
    fovField.appendChild(fovLabel);fovField.appendChild(fov);
    fields.appendChild(subjectField);fields.appendChild(durationField);fields.appendChild(fovField);
    const reason=document.createElement('div');reason.className='story-shot-reason';
    reason.textContent=PreVisionI18n.t('storyboard.shot.reason',{reason:storyboardReasonText(shot.reasonCode)});
    const coverage=document.createElement('div');coverage.className='story-shot-coverage';
    coverage.textContent=PreVisionI18n.t('storyboard.shot.coverage',{beats:shot.beatIds.join(', ')});
    card.appendChild(title);card.appendChild(meta);card.appendChild(fields);card.appendChild(reason);card.appendChild(coverage);shotList.appendChild(card);
  });
  $('storyGen').textContent=PreVisionI18n.t('storyboard.action.reanalyze');
  setStoryboardPlanState(storyboardPlanStale);
}
function clearStoryboardPlan(){
  pendingStoryboardPlan=null;pendingStoryboardSource=null;storyboardPlanStale=false;
  $('storyDialogBody').classList.remove('has-plan');$('storyDialogSetup').scrollTop=0;$('storyPlanScroll').scrollTop=0;
  $('storyPreview').hidden=true;$('storyApply').hidden=true;$('storyApply').disabled=true;
  $('storyGen').textContent=PreVisionI18n.t('storyboard.action.analyze');
  $('storyPlanState').textContent=PreVisionI18n.t('storyboard.preview.notApplied');
  $('storyPlanState').classList.remove('stale');
  $('storyFooterNote').textContent=PreVisionI18n.t('storyboard.preview.notApplied');
}
function markStoryboardPlanStale(){if(pendingStoryboardPlan)setStoryboardPlanState(true);}
function analyzeStoryboardFromDialog(){
  const rawText=$('storyText').value;
  if(rawText.trim().length<4){alert(PreVisionI18n.t('storyboard.error.shortScript'));return null;}
  if(!pendingStoryboardSource)pendingStoryboardSource=currentStoryboardSourceSnapshot();
  const options={
    requestedTemplate:$('storyTemplate').value||'auto',
    mood:$('storyMood').value||'daily',
    pace:$('storyPace').value||'standard',
  };
  const plan=buildStoryboardPlan(rawText,options,pendingStoryboardSource.scene);
  if(!plan){alert(PreVisionI18n.t('storyboard.error.noBeats'));return null;}
  pendingStoryboardPlan=plan;storyboardPlanStale=false;renderStoryboardPlan();
  $('storyDialogSetup').scrollTop=0;$('storyPlanScroll').scrollTop=0;
  return plan;
}
function applyPendingStoryboardPlan(){
  if(automaticCaptureMutationBlocked())return false;
  if(!pendingStoryboardPlan||storyboardPlanStale){alert(PreVisionI18n.t('storyboard.error.stalePlan'));return false;}
  const validation=validateStoryboardPlan(pendingStoryboardPlan);
  if(!validation.valid){alert(PreVisionI18n.t('storyboard.error.invalidPlan'));return false;}
  const sourceIndex=pendingStoryboardSource?.sceneIndex;
  if(!Number.isInteger(sourceIndex)||sourceIndex!==sceneIdx){alert(PreVisionI18n.t('storyboard.error.stalePlan'));return false;}
  runtimeSyncScene();
  const sourceScene=project.scenes[sourceIndex],sceneData=storyboardPlanToScene(pendingStoryboardPlan,sourceScene,project.scenes.length+1);
  project.scenes.push(sceneData);
  $('storyDlg').close();teardownStoryboardDialogWindow();clearStoryboardPlan();
  runtimeLoadScene(project.scenes.length-1,true);setSceneRailLevel('shots');markDirty();
  return true;
}
$('aiStoryboard').onclick=()=>{
  clearStoryboardPlan();pendingStoryboardSource=currentStoryboardSourceSnapshot();
  $('storyText').value=curScene().script||'';
  $('storyTemplate').value=SCENE_TEMPLATES.some(template=>template.id===curScene().templateId)?curScene().templateId:'auto';
  resetStoryboardDialogWindow();
  showCommandModal($('storyDlg'));
};
$('storyGen').onclick=analyzeStoryboardFromDialog;
$('storyApply').onclick=applyPendingStoryboardPlan;
$('storyCancel').onclick=()=>{$('storyDlg').close();teardownStoryboardDialogWindow();clearStoryboardPlan();};
$('storyFullscreen').onclick=()=>setStoryboardDialogFullscreen();
$('storyDialogHead').addEventListener('dblclick',storyboardDialogHeaderDoubleClick);
storyboardResizeHandles().forEach(handle=>{
  handle.addEventListener('pointerdown',beginStoryboardDialogResize);
  handle.addEventListener('keydown',resizeStoryboardDialogByKeyboard);
  handle.addEventListener('lostpointercapture',finishStoryboardDialogResize);
});
window.addEventListener('pointermove',moveStoryboardDialogResize);
window.addEventListener('pointerup',finishStoryboardDialogResize);
window.addEventListener('pointercancel',finishStoryboardDialogResize);
window.addEventListener('blur',finishStoryboardDialogResize);
window.addEventListener('resize',fitStoryboardDialogToViewport);
$('storyDlg').addEventListener('cancel',event=>{
  if(storyboardDialogFullscreen){event.preventDefault();setStoryboardDialogFullscreen(false);return;}
  teardownStoryboardDialogWindow();clearStoryboardPlan();
});
$('storyText').addEventListener('input',markStoryboardPlanStale);
['storyTemplate','storyMood','storyPace'].forEach(id=>$(id).addEventListener('change',markStoryboardPlanStale));

export {
  STORYBOARD_PLAN_VERSION,
  STORY_MOOD_ADJUSTMENTS,
  STORY_PACE_MULTIPLIER,
  STORY_MOOD_LABEL_KEYS,
  STORY_PACE_LABEL_KEYS,
  STORYBOARD_REASON_LABEL_KEYS,
  STORYBOARD_ROLE_LABEL_KEYS,
  STORYBOARD_WARNING_LABEL_KEYS,
  STORYBOARD_BEAT_TYPE_LABEL_KEYS,
  STORYBOARD_EYELINE_LABEL_KEYS,
  STORYBOARD_ANALYSIS_LEXICON,
  STORYBOARD_SCENE_HEADING,
  STORYBOARD_QUOTE,
  STORYBOARD_PARENTHETICAL,
  STORYBOARD_STAGE_LIMIT,
  clampStoryboard,
  roundStoryboard,
  storyboardEscapeRegExp,
  storyboardTermCount,
  storyboardKeywordScore,
  splitStoryboardSegments,
  cleanStoryboardSpeaker,
  isStoryboardSpeakerCue,
  detectStoryboardSpeaker,
  classifyStoryboardSegment,
  analyzeStoryboardScript,
  parseBeats,
  scoreStoryboardTemplates,
  storyboardTemplateDecision,
  detectStoryTemplate,
  resolveStoryTemplateId,
  storyboardActorCatalog,
  resolveStoryboardRoles,
  storyboardActorForRole,
  storyboardRoleForBeat,
  storyboardAxis,
  storyboardShotGroups,
  storyboardCameraForShot,
  buildStoryboardPlan,
  validateStoryboardPlan,
  storyboardCompositionLabel,
  materializeStoryboardPlanShots,
  storyboardPlanToScene,
  genStoryboard,
  STORYBOARD_DIALOG_DEFAULT_WIDTH,
  STORYBOARD_DIALOG_DEFAULT_HEIGHT,
  STORYBOARD_DIALOG_MIN_WIDTH,
  STORYBOARD_DIALOG_MIN_HEIGHT,
  STORYBOARD_DIALOG_MARGIN,
  STORYBOARD_RESIZE_CORNERS,
  storyboardResizeHandles,
  storyboardDialogViewport,
  clampStoryboardDialogBounds,
  getStoryboardDialogBounds,
  updateStoryboardDialogWindowButton,
  applyStoryboardDialogBounds,
  setStoryboardResizeHandlesEnabled,
  resetStoryboardDialogWindow,
  setStoryboardDialogFullscreen,
  fitStoryboardDialogToViewport,
  finishStoryboardDialogResize,
  beginStoryboardDialogResize,
  moveStoryboardDialogResize,
  resizeStoryboardDialogByKeyboard,
  teardownStoryboardDialogWindow,
  storyboardDialogHeaderDoubleClick,
  currentStoryboardSourceSnapshot,
  storyboardReasonText,
  storyboardConfidence,
  mergeStoryboardPlanEdits,
  appendStoryboardOption,
  setStoryboardPlanState,
  renderStoryboardPlan,
  clearStoryboardPlan,
  markStoryboardPlanStale,
  analyzeStoryboardFromDialog,
  applyPendingStoryboardPlan,
};
