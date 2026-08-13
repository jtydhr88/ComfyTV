/*
 * core/project-data.js — .previz.json v5 contract layer (subsystems D + G front half, refactor P2).
 * Single definition point for the project schema: factories/scene templates, time-track
 * repair (the ensure- and repair- families), the untrusted-input normalization family
 * (normalizeProject- and project- prefixed whitelist functions), and contract constants/enums.
 * All bodies moved verbatim from src/app.js (byte-identical, ADR-0008); Han string literals
 * are \uXXXX-escaped and moved comments translated to English per the src/ i18n policy —
 * string values are unchanged.
 * Deliberate core-internal import cycle with core/timing-math.js (documented in ADR-0008):
 * ensureEaseArray -> normalizeEaseSpec (here -> timing-math) while the two sampleCameraKey
 * variants import the ensureCam-/ensureEaseArray/cameraKeyProgress family from this module.
 * All cross-module references are call-time function calls, safe under ESM/esbuild
 * evaluation order.
 * Transitional free references (resolved via globals until their owner modules are
 * extracted):
 *   - THREE                                    (vendor bundle, global by contract; shotCurve)
 *   - PreVisionI18n                            (i18n runtime, external script global;
 *     factory/template text)
 *   - deepCopy / sceneTemplateById / sceneTemplateText (app.js; not in the P3 store
 *     migration list — remain app.js globals until their owner modules land, P9;
 *     used by materializeSceneTemplate & newProject)
 *   - liveSceneDuration                        (stage/runtime.js owner; resolved
 *     through the call-time global bridge to keep core -> stage imports out;
 *     used by ensureActorTimes)
 *   - SEED_RES                                 (app.js, moves to export/capture.js in P8;
 *     aspect whitelist in normalizeProjectData)
 *   - DEFAULT_SUN                              (stage/environment.js owner from P6; intentionally
 *     resolved as a bridge global at call time to keep core -> stage imports out)
 *   - SKY_BASE_R                               (stage/environment.js owner from P6; intentionally
 *     resolved as a bridge global at call time to keep core -> stage imports out)
 */
import { normalizeEaseSpec } from './timing-math.js';
import { normalizeReframeByAspect } from './reframe.js';

const DEFAULT_ACTORS = [
  {kind:'char', label:'A·\u4e3b\u4f53', pos:[1.5,2.5], rotY:0, path:[[1.5,2.5],[2.5,.5],[3.2,-1.2]]},
  {kind:'char', label:'B', pos:[3.5,-2], rotY:0, path:[[3.5,-2],[2.8,-.8]]},
  {kind:'car',  label:'\u8f66', pos:[-4,0], rotY:0, path:[[-4,0],[-7,1.5]]},
  {kind:'prop', label:'\u9053\u5177', pos:[0,-1], rotY:0, path:[]},
];
const SCENE_TEMPLATES = [
  {id:'dialogue',nameKey:'sceneTemplate.dialogue.name',descKey:'sceneTemplate.dialogue.desc',actors:[DEFAULT_ACTORS[0],DEFAULT_ACTORS[1],DEFAULT_ACTORS[3]],shots:[
    {nameKey:'sceneTemplate.dialogue.shot1.name',descKey:'sceneTemplate.dialogue.shot1.desc',dur:5,lock:DEFAULT_ACTORS[0].label,fov:38,cam:[[-6,2.4,8],[-4.8,2.2,6.8]]},
    {nameKey:'sceneTemplate.dialogue.shot2.name',descKey:'sceneTemplate.dialogue.shot2.desc',dur:4,lock:DEFAULT_ACTORS[1].label,fov:42,cam:[[.2,1.75,3.2]]},
    {nameKey:'sceneTemplate.dialogue.shot3.name',descKey:'sceneTemplate.dialogue.shot3.desc',dur:4,lock:DEFAULT_ACTORS[0].label,fov:42,cam:[[4.8,1.75,-.8]]},
    {nameKey:'sceneTemplate.dialogue.shot4.name',descKey:'sceneTemplate.dialogue.shot4.desc',dur:3.5,lock:DEFAULT_ACTORS[1].label,fov:30,cam:[[5.5,1.65,.4]]}]},
  {id:'performance',nameKey:'sceneTemplate.performance.name',descKey:'sceneTemplate.performance.desc',actors:[DEFAULT_ACTORS[0],DEFAULT_ACTORS[3]],shots:[
    {nameKey:'sceneTemplate.performance.shot1.name',descKey:'sceneTemplate.performance.shot1.desc',dur:5,lock:DEFAULT_ACTORS[0].label,fov:38,cam:[[7,2.7,9]]},
    {nameKey:'sceneTemplate.performance.shot2.name',descKey:'sceneTemplate.performance.shot2.desc',dur:4.5,lock:DEFAULT_ACTORS[0].label,fov:36,cam:[[6,2.1,7],[4.8,1.8,5.8]]},
    {nameKey:'sceneTemplate.performance.shot3.name',descKey:'sceneTemplate.performance.shot3.desc',dur:4,lock:DEFAULT_ACTORS[0].label,fov:28,cam:[[4.5,1.65,4.7]]},
    {nameKey:'sceneTemplate.performance.shot4.name',descKey:'sceneTemplate.performance.shot4.desc',dur:3.5,lock:DEFAULT_ACTORS[0].label,fov:42,cam:[[1.5,1.7,7]]}]},
  {id:'chase',nameKey:'sceneTemplate.chase.name',descKey:'sceneTemplate.chase.desc',actors:[DEFAULT_ACTORS[0],DEFAULT_ACTORS[2]],shots:[
    {nameKey:'sceneTemplate.chase.shot1.name',descKey:'sceneTemplate.chase.shot1.desc',dur:3.5,lock:DEFAULT_ACTORS[0].label,fov:58,cam:[[-12,4,12],[-9,3,9]]},
    {nameKey:'sceneTemplate.chase.shot2.name',descKey:'sceneTemplate.chase.shot2.desc',dur:3,lock:DEFAULT_ACTORS[0].label,fov:62,cam:[[-3,1.3,6],[1,1.3,4],[5,1.3,1]]},
    {nameKey:'sceneTemplate.chase.shot3.name',descKey:'sceneTemplate.chase.shot3.desc',dur:2.5,lock:DEFAULT_ACTORS[2].label,fov:50,cam:[[-7,1.2,-4],[-4,1.2,-5]]},
    {nameKey:'sceneTemplate.chase.shot4.name',descKey:'sceneTemplate.chase.shot4.desc',dur:4,lock:DEFAULT_ACTORS[0].label,fov:35,cam:[[10,4,-9],[13,6,-12]]}]},
  {id:'establishing',nameKey:'sceneTemplate.establishing.name',descKey:'sceneTemplate.establishing.desc',actors:[DEFAULT_ACTORS[0],DEFAULT_ACTORS[2],DEFAULT_ACTORS[3]],shots:[
    {nameKey:'sceneTemplate.establishing.shot1.name',descKey:'sceneTemplate.establishing.shot1.desc',dur:6,lock:DEFAULT_ACTORS[0].label,fov:32,cam:[[-14,8,14]]},
    {nameKey:'sceneTemplate.establishing.shot2.name',descKey:'sceneTemplate.establishing.shot2.desc',dur:4.5,lock:DEFAULT_ACTORS[3].label,fov:45,cam:[[-5,1.4,8]]},
    {nameKey:'sceneTemplate.establishing.shot3.name',descKey:'sceneTemplate.establishing.shot3.desc',dur:5,lock:DEFAULT_ACTORS[0].label,fov:40,cam:[[-9,3,4],[0,3,7],[9,3,4]]},
    {nameKey:'sceneTemplate.establishing.shot4.name',descKey:'sceneTemplate.establishing.shot4.desc',dur:5.5,lock:DEFAULT_ACTORS[2].label,fov:30,cam:[[12,5,-10]]}]},
];
function makeNeutralShot(){
  return {
    name:PreVisionI18n.t('scene.blank.shotName'),
    desc:PreVisionI18n.t('scene.blank.shotDescription'),
    dur:5,
    lock:'\u5168\u5c40',
    fov:40,
    camMode:'curve',
    timingMode:'custom',
    syncActor:'',
    yaw:0,
    pitch:0,
    cam:[[6,3,6]]
  };
}
function makeBlankScene(index=1){
  const safeIndex=Number.isInteger(index)&&index>0?index:1;
  return {
    name:PreVisionI18n.t('scene.blank.name',{index:safeIndex}),
    desc:PreVisionI18n.t('scene.blank.description'),
    actors:[],
    shots:[makeNeutralShot()],
    ground:{style:'checker'}
  };
}
function materializeSceneTemplate(template){
  const out=deepCopy(template),text=sceneTemplateText(template);
  out.templateId=out.id;out.name=text.name;out.desc=text.desc;
  delete out.id;delete out.nameKey;delete out.descKey;
  out.shots.forEach(shot=>{
    shot.name=PreVisionI18n.t(shot.nameKey);shot.desc=PreVisionI18n.t(shot.descKey);
    delete shot.nameKey;delete shot.descKey;
  });
  return out;
}
function newProject(){
  const initial=materializeSceneTemplate(sceneTemplateById('dialogue'));
  return {app:'PreVision', version:5, name:PreVisionI18n.t('project.untitled'), aspect:'16:9', assets:{}, settings:{collision:true,labels:true},
    created:new Date().toISOString(), scenes:[Object.assign(initial,{name:PreVisionI18n.t('scene.defaultName',{index:1,name:initial.name}),ground:{style:'checker'}})]};
}
function makeFirstRunWelcomeProject(){
  const horseLabel=PreVisionI18n.t('welcome.actor.horse'),riderLabel=PreVisionI18n.t('welcome.actor.rider');
  const shotText=index=>({
    name:PreVisionI18n.t(`sceneTemplate.performance.shot${index}.name`),
    desc:PreVisionI18n.t(`sceneTemplate.performance.shot${index}.desc`)
  });
  const shot=(index,dur,fov,cam)=>Object.assign(shotText(index),{dur,lock:riderLabel,fov,cam});
  const scene={
    name:PreVisionI18n.t('welcome.scene.name'),desc:PreVisionI18n.t('welcome.scene.description'),
    actors:[
      {kind:'horse',label:horseLabel,pos:[1.5,2.5],rotY:0,path:[[1.5,2.5],[2.5,.5],[3.2,-1.2]]},
      {kind:'char',label:riderLabel,pos:[1.5,2.5],rotY:0,pose:'ride',mount:horseLabel,path:[]}
    ],
    shots:[
      shot(1,5,38,[[-6,2.4,8],[-4.8,2.2,6.8]]),
      shot(2,4,42,[[.2,1.75,3.2]]),
      shot(3,4,42,[[4.8,1.75,-.8]]),
      shot(4,3.5,30,[[5.5,1.65,.4]])
    ],
    ground:{style:'checker'},
    sun:{enabled:true,pos:[-12.3,14,-7.3],intensity:.9,temp:5600,ambient:.28,softness:2,quality:'standard'}
  };
  return {app:'PreVision',version:5,name:PreVisionI18n.t('project.untitled'),aspect:'16:9',assets:{},settings:{collision:true,labels:true},created:new Date().toISOString(),scenes:[scene]};
}
function shotCurve(s){
  if(s.camPts.length<2)return null;
  if(s.camMode==='line'){
    const cv=new THREE.CurvePath();for(let i=0;i<s.camPts.length-1;i++)cv.add(new THREE.LineCurve3(s.camPts[i],s.camPts[i+1]));return cv;
  }
  return new THREE.CatmullRomCurve3(s.camPts,false,'centripetal');
}
function ensureCamKeys(s){
  if(!s.camKeys) s.camKeys=[];
  while(s.camKeys.length<s.camPts.length){
    const last=s.camKeys[s.camKeys.length-1]||{yaw:s.yaw||0,pitch:s.pitch||0,fov:s.fov||40};
    s.camKeys.push({yaw:+last.yaw||0,pitch:+last.pitch||0,fov:+last.fov||s.fov||40});
  }
  if(s.camKeys.length>s.camPts.length) s.camKeys.length=s.camPts.length;
  return s.camKeys;
}
function distributedPathTimes(points,start,end){
  const n=points.length;if(!n)return [];
  start=Math.max(0,+start||0);end=Math.max(start,+end||start);
  if(n===1)return [start];
  const ds=[0];let total=0;
  for(let i=1;i<n;i++){total+=points[i].distanceTo(points[i-1]);ds.push(total);}
  return ds.map((d,i)=>start+(end-start)*(total>1e-6?d/total:i/(n-1)));
}
function repairPathTimes(points,times,start,end){
  if(!Array.isArray(times)||times.length!==points.length||times.some(v=>!Number.isFinite(+v)))return distributedPathTimes(points,start,end);
  const out=times.map(v=>Math.max(start,Math.min(end,+v)));
  for(let i=1;i<out.length;i++)out[i]=Math.max(out[i],out[i-1]+.01);
  if(out.length&&out[out.length-1]>end){
    const span=Math.max(.01,out[out.length-1]-out[0]);
    return out.map(v=>start+(v-out[0])/span*Math.max(0,end-start));
  }
  return out;
}
function ensureCamTimes(s){
  const next=repairPathTimes(s.camPts,s.camTimes,0,Math.max(.1,s.dur));if(Array.isArray(s.camTimes))s.camTimes.splice(0,s.camTimes.length,...next);else s.camTimes=next;
  return s.camTimes;
}
function repairIndexTimes(count,times,start,end,fallback){
  if(Array.isArray(times)&&times.length===count&&times.every(v=>Number.isFinite(+v))){
    const out=times.map(v=>Math.max(start,Math.min(end,+v)));for(let i=1;i<out.length;i++)out[i]=Math.max(out[i],out[i-1]+.01);return out[out.length-1]<=end?out:Array.from({length:count},(_,i)=>start+(end-start)*(count<2?0:i/(count-1)));
  }
  if(Array.isArray(fallback)&&fallback.length===count)return fallback.slice();
  return Array.from({length:count},(_,i)=>start+(end-start)*(count<2?0:i/(count-1)));
}
function ensureCamAimTimes(s){const next=repairIndexTimes(ensureCamKeys(s).length,s.camAimTimes,0,Math.max(.1,s.dur),ensureCamTimes(s));if(Array.isArray(s.camAimTimes))s.camAimTimes.splice(0,s.camAimTimes.length,...next);else s.camAimTimes=next;return s.camAimTimes;}
function ensureCamFovTimes(s){const next=repairIndexTimes(ensureCamKeys(s).length,s.camFovTimes,0,Math.max(.1,s.dur),ensureCamTimes(s));if(Array.isArray(s.camFovTimes))s.camFovTimes.splice(0,s.camFovTimes.length,...next);else s.camFovTimes=next;return s.camFovTimes;}
function ensureActorTimes(a){
  const next=repairPathTimes(a.pathPts,a.pathTimes,0,globalThis.liveSceneDuration());if(Array.isArray(a.pathTimes))a.pathTimes.splice(0,a.pathTimes.length,...next);else a.pathTimes=next;
  return a.pathTimes;
}
function ensureEaseArray(holder,key,count){
  const src=Array.isArray(holder[key])?holder[key]:[],next=Array.from({length:Math.max(0,count)},(_,i)=>normalizeEaseSpec(src[i]||'linear'));if(Array.isArray(holder[key]))holder[key].splice(0,holder[key].length,...next);else holder[key]=next;return holder[key];
}
function cameraPositionDeleteFailure(reason,details={}){
  return Object.assign({ok:false,reason},details);
}
function cameraPositionDeleteTrackIsValid(values,count,{keys=false}={}){
  if(!Array.isArray(values)||values.length!==count)return false;
  if(keys)return values.every(value=>value&&typeof value==='object'&&['yaw','pitch','fov'].every(key=>Number.isFinite(value[key])));
  return values.every((value,index)=>Number.isFinite(value)&&(index===0||value>=values[index-1]));
}
function cameraPositionDeleteEases(values,survivors){
  return survivors.slice(0,-1).map(index=>Object.assign({},normalizeEaseSpec(Array.isArray(values)?values[index]:'linear')));
}
function cameraPositionDeleteShotFingerprint(shot){
  return JSON.stringify({
    dur:shot.dur,timingMode:shot.timingMode,syncActor:shot.syncActor,
    camPts:shot.camPts.map(point=>[point.x,point.y,point.z]),
    camKeys:shot.camKeys.map(key=>[key.yaw,key.pitch,key.fov]),
    camTimes:shot.camTimes,camAimTimes:shot.camAimTimes,camFovTimes:shot.camFovTimes,
    camEase:shot.camEase,camAimEase:shot.camAimEase,camFovEase:shot.camFovEase
  });
}
function cameraPositionDeleteActorFingerprint(actor){
  return JSON.stringify({
    timeLink:actor.timeLink,timeLinkShot:actor.timeLinkShot,timeOffset:actor.timeOffset,
    pathPts:Array.isArray(actor.pathPts)?actor.pathPts.map(point=>[point.x,point.y,point.z]):actor.pathPts,
    pathTimes:actor.pathTimes
  });
}
function planCameraPositionPointDeletion(shot,requestedIndices,context={}){
  const count=Array.isArray(shot?.camPts)?shot.camPts.length:0;
  if(!count||!shot.camPts.every(point=>point&&['x','y','z'].every(axis=>Number.isFinite(point[axis]))))return cameraPositionDeleteFailure('malformedCamera');
  if(!Array.isArray(requestedIndices)||!requestedIndices.length)return cameraPositionDeleteFailure('invalidSelection');
  const indices=requestedIndices.map(Number);
  if(indices.some(index=>!Number.isInteger(index)||index<0||index>=count)||new Set(indices).size!==indices.length)return cameraPositionDeleteFailure('invalidSelection');
  indices.sort((a,b)=>a-b);
  if(count-indices.length<1)return cameraPositionDeleteFailure('minimumPoint');
  const synchronizedTracks=[
    ['camKeys',true],['camTimes',false],['camAimTimes',false],['camFovTimes',false]
  ];
  if(synchronizedTracks.some(([key,keys])=>!cameraPositionDeleteTrackIsValid(shot[key],count,{keys})))return cameraPositionDeleteFailure('malformedCamera');
  const deleted=new Set(indices),survivors=Array.from({length:count},(_,index)=>index).filter(index=>!deleted.has(index));
  const nextOriginalIndex=survivors.filter(index=>index<indices[0]).pop()??survivors[0],nextIndex=survivors.indexOf(nextOriginalIndex),postCount=survivors.length;
  if(context.pointSyncExpected){
    const actor=context.pointSyncActor;
    if(!actor||!Array.isArray(actor.pathPts)||actor.pathPts.length!==postCount){
      return cameraPositionDeleteFailure('pointSyncMismatch',{label:actor?.label||shot.syncActor||'',pathCount:actor?.pathPts?.length??0,cameraCount:postCount});
    }
  }
  const linkedActors=[...new Set((Array.isArray(context.linkedActors)?context.linkedActors:[]).filter(Boolean))];
  const nodeMismatch=linkedActors.find(actor=>actor.timeLink==='cameraNodes'&&(!Array.isArray(actor.pathPts)||actor.pathPts.length!==postCount));
  if(nodeMismatch)return cameraPositionDeleteFailure('cameraNodesMismatch',{label:nodeMismatch.label||'',pathCount:nodeMismatch.pathPts?.length??0,cameraCount:postCount});
  const camera={
    camPts:survivors.map(index=>shot.camPts[index]),
    camKeys:survivors.map(index=>({yaw:shot.camKeys[index].yaw,pitch:shot.camKeys[index].pitch,fov:shot.camKeys[index].fov})),
    camTimes:survivors.map(index=>shot.camTimes[index]),
    camAimTimes:survivors.map(index=>shot.camAimTimes[index]),
    camFovTimes:survivors.map(index=>shot.camFovTimes[index]),
    camEase:cameraPositionDeleteEases(shot.camEase,survivors),
    camAimEase:cameraPositionDeleteEases(shot.camAimEase,survivors),
    camFovEase:cameraPositionDeleteEases(shot.camFovEase,survivors),
  };
  const shotOffset=Number.isFinite(+context.shotOffset)?+context.shotOffset:0;
  const sceneDuration=Number.isFinite(+context.sceneDuration)?Math.max(0,+context.sceneDuration):Infinity;
  const actorUpdates=linkedActors.filter(actor=>actor.timeLink==='cameraNodes'||actor.timeLink==='cameraFollow').map(actor=>{
    const offset=shotOffset+(Number.isFinite(+actor.timeOffset)?+actor.timeOffset:0),points=Array.isArray(actor.pathPts)?actor.pathPts:[];
    const proposed=actor.timeLink==='cameraNodes'
      ?camera.camTimes.map(value=>value+offset)
      :distributedPathTimes(points,(camera.camTimes[0]||0)+offset,(camera.camTimes[camera.camTimes.length-1]||shot.dur||0)+offset);
    return {
      actor,pathTimes:repairPathTimes(points,proposed,0,sceneDuration),
      pathPts:actor.pathPts,sourcePathTimes:actor.pathTimes,fingerprint:cameraPositionDeleteActorFingerprint(actor)
    };
  });
  return {
    ok:true,shot,indices,survivors,nextIndex,nextOriginalIndex,originalCount:count,postCount,camera,actorUpdates,
    precondition:{
      camPts:shot.camPts,camKeys:shot.camKeys,camTimes:shot.camTimes,camAimTimes:shot.camAimTimes,camFovTimes:shot.camFovTimes,
      camEase:shot.camEase,camAimEase:shot.camAimEase,camFovEase:shot.camFovEase,
      fingerprint:cameraPositionDeleteShotFingerprint(shot)
    }
  };
}
function applyCameraPositionPointDeletion(plan){
  if(!plan?.ok||!plan.shot||!plan.precondition)return cameraPositionDeleteFailure(plan?.reason||'invalidSelection');
  const shot=plan.shot,source=plan.precondition;
  if(['camPts','camKeys','camTimes','camAimTimes','camFovTimes','camEase','camAimEase','camFovEase'].some(key=>shot[key]!==source[key])||
    cameraPositionDeleteShotFingerprint(shot)!==source.fingerprint||
    plan.actorUpdates.some(update=>update.actor?.pathPts!==update.pathPts||update.actor?.pathTimes!==update.sourcePathTimes||
      cameraPositionDeleteActorFingerprint(update.actor)!==update.fingerprint))return cameraPositionDeleteFailure('stalePlan');
  Object.assign(shot,plan.camera);
  plan.actorUpdates.forEach(update=>{update.actor.pathTimes=update.pathTimes;});
  return {ok:true};
}
const SHOT_DURATION_MIN=.5;
function shotDurationFailure(reason,details={}){
  return Object.assign({ok:false,reason},details);
}
function shotDurationTrackIsValid(values,count,limit=Infinity){
  return Array.isArray(values)&&values.length===count&&values.every((value,index)=>{
    return Number.isFinite(value)&&value>=0&&value<=limit+1e-9&&(index===0||value>=values[index-1]);
  });
}
function shotDurationSceneOffset(shots,index){
  return shots.slice(0,index).reduce((sum,item)=>sum+(Number.isFinite(item?.dur)?item.dur:0),0);
}
function shotDurationShotFingerprint(shot){
  return JSON.stringify({
    dur:shot.dur,timingMode:shot.timingMode,syncActor:shot.syncActor,
    camPts:Array.isArray(shot.camPts)?shot.camPts.map(point=>[point?.x,point?.y,point?.z]):shot.camPts,
    camKeys:Array.isArray(shot.camKeys)?shot.camKeys.map(key=>[key?.yaw,key?.pitch,key?.fov]):shot.camKeys,
    camTimes:shot.camTimes,camAimTimes:shot.camAimTimes,camFovTimes:shot.camFovTimes,
    camEase:shot.camEase,camAimEase:shot.camAimEase,camFovEase:shot.camFovEase
  });
}
function shotDurationActorFingerprint(actor){
  return JSON.stringify({
    timeLink:actor?.timeLink,timeLinkShot:actor?.timeLinkShot,timeOffset:actor?.timeOffset,
    pathPts:Array.isArray(actor?.pathPts)?actor.pathPts.map(point=>[point?.x,point?.y,point?.z]):actor?.pathPts,
    pathTimes:actor?.pathTimes,pathEase:actor?.pathEase
  });
}
function planShotDurationChange(shot,nextValue,context={}){
  const shots=Array.isArray(context.shots)?context.shots:[],shotIndex=Number.isInteger(context.shotIndex)?context.shotIndex:shots.indexOf(shot);
  if(!shot||shotIndex<0||shots[shotIndex]!==shot)return shotDurationFailure('invalidShot');
  const oldDuration=shot.dur,nextDuration=Math.round(+nextValue*10)/10;
  if(!Number.isFinite(oldDuration)||oldDuration<SHOT_DURATION_MIN||!Number.isFinite(nextDuration)||nextDuration<SHOT_DURATION_MIN)return shotDurationFailure('invalidDuration',{minimum:SHOT_DURATION_MIN});
  if(Math.abs(nextDuration-oldDuration)<1e-9)return {ok:true,noChange:true,shot,oldDuration,nextDuration};
  if(shots.some(item=>!Number.isFinite(item?.dur)||item.dur<SHOT_DURATION_MIN))return shotDurationFailure('malformedScene');
  const actors=[...new Set((Array.isArray(context.actors)?context.actors:[]).filter(Boolean))];
  const count=Array.isArray(shot.camPts)?shot.camPts.length:0,keyCount=Array.isArray(shot.camKeys)?shot.camKeys.length:0;
  const segmentCount=Math.max(0,count-1),cameraPoseValid=count&&keyCount===count&&
    shot.camPts.every(point=>[point?.x,point?.y,point?.z].every(Number.isFinite))&&
    shot.camKeys.every(key=>[key?.yaw,key?.pitch,key?.fov].every(Number.isFinite));
  const cameraEaseValid=['camEase','camAimEase','camFovEase'].every(key=>Array.isArray(shot[key])&&shot[key].length===segmentCount);
  if(!cameraPoseValid||!cameraEaseValid)return shotDurationFailure('malformedCamera');
  const materialized=context.materializedCamera||{};
  const camera={
    camTimes:Array.isArray(materialized.camTimes)?materialized.camTimes.slice():null,
    camAimTimes:Array.isArray(materialized.camAimTimes)?materialized.camAimTimes.slice():null,
    camFovTimes:Array.isArray(materialized.camFovTimes)?materialized.camFovTimes.slice():null
  };
  if(!shotDurationTrackIsValid(camera.camTimes,count,oldDuration)||
    !shotDurationTrackIsValid(camera.camAimTimes,keyCount,oldDuration)||
    !shotDurationTrackIsValid(camera.camFovTimes,keyCount,oldDuration)||
    [camera.camTimes,camera.camAimTimes,camera.camFovTimes].some(times=>Math.abs(times[0]||0)>1e-9))return shotDurationFailure('unsafeMaterialization');
  const ratio=nextDuration/oldDuration,scaleCameraTimes=times=>times.map((value,index)=>index===0?0:value*ratio);
  const cameraUpdate={
    timingMode:'custom',
    camTimes:scaleCameraTimes(camera.camTimes),
    camAimTimes:scaleCameraTimes(camera.camAimTimes),
    camFovTimes:scaleCameraTimes(camera.camFovTimes)
  };
  const oldStart=shotDurationSceneOffset(shots,shotIndex),oldEnd=oldStart+oldDuration;
  const oldSceneDuration=shots.reduce((sum,item)=>sum+item.dur,0),newSceneDuration=oldSceneDuration+(nextDuration-oldDuration);
  const shrinking=nextDuration<oldDuration;
  const linkedActors=actors.filter(actor=>(actor.timeLink==='cameraNodes'||actor.timeLink==='cameraFollow')&&
    Math.max(0,Number.isInteger(actor.timeLinkShot)?actor.timeLinkShot:0)>=shotIndex),linkedSet=new Set(linkedActors);
  const previewKeys=Array.isArray(context.previewKeys)?context.previewKeys:[];
  if(previewKeys.some(key=>{
    if(!key||!['camera','actor'].includes(key.domain)||!Number.isFinite(+key.time)||+key.time<0)return true;
    if(key.domain==='actor')return !key.owner||+key.time>oldSceneDuration+1e-9;
    return !Number.isInteger(key.shotIndex)||!shots[key.shotIndex]||+key.time>shots[key.shotIndex].dur+1e-9;
  }))return shotDurationFailure('unsafePreview');
  const actorKeySets=[];
  for(const actor of actors){
    const pointCount=Array.isArray(actor.pathPts)?actor.pathPts.length:0,times=actor.pathTimes;
    if(!shotDurationTrackIsValid(times,pointCount,oldSceneDuration))return shotDurationFailure('malformedActor',{label:actor.label||''});
    if(!linkedSet.has(actor))times.forEach(value=>actorKeySets.push({actor,time:+value,sidecar:false}));
  }
  previewKeys.filter(key=>key.domain==='actor').forEach(key=>actorKeySets.push({actor:key.owner||null,time:+key.time,sidecar:true,channelId:key.channelId||''}));
  if(shrinking){
    const sceneCut=actorKeySets.find(key=>key.time>newSceneDuration+1e-9);
    if(sceneCut)return shotDurationFailure('sceneKeyCut',{label:sceneCut.actor?.label||'',time:sceneCut.time,sidecar:sceneCut.sidecar,channelId:sceneCut.channelId||''});
  }
  const actorUpdates=[],actorPreconditions=[];
  for(const actor of linkedActors){
    const points=Array.isArray(actor.pathPts)?actor.pathPts:null;
    if(!points)return shotDurationFailure('malformedActor',{label:actor.label||''});
    const targetIndex=Math.max(0,Number.isInteger(actor.timeLinkShot)?actor.timeLinkShot:0),pointCount=points.length;
    let pathTimes;
    if(targetIndex===shotIndex){
      const offset=oldStart+(Number.isFinite(+actor.timeOffset)?+actor.timeOffset:0);
      if(actor.timeLink==='cameraNodes'){
        if(pointCount!==cameraUpdate.camTimes.length)return shotDurationFailure('linkedTiming',{label:actor.label||'',link:actor.timeLink,linkShot:targetIndex});
        pathTimes=cameraUpdate.camTimes.map(value=>value+offset);
      }else{
        pathTimes=distributedPathTimes(points,(cameraUpdate.camTimes[0]||0)+offset,
          cameraUpdate.camTimes[cameraUpdate.camTimes.length-1]+offset);
      }
    }else pathTimes=actor.pathTimes.map(value=>value+(nextDuration-oldDuration));
    if(!shotDurationTrackIsValid(pathTimes,pointCount,newSceneDuration))return shotDurationFailure('linkedTiming',{label:actor.label||'',link:actor.timeLink,linkShot:targetIndex});
    actorUpdates.push({actor,pathTimes});
    actorPreconditions.push({actor,pathPts:actor.pathPts,sourcePathTimes:actor.pathTimes,fingerprint:shotDurationActorFingerprint(actor)});
  }
  if(shot.timingMode==='pointSync'&&shot.syncActor){
    const actor=context.pointSyncActor,times=Array.isArray(context.pointSyncActorTimes)?context.pointSyncActorTimes.slice():null;
    const pointCount=Array.isArray(actor?.pathPts)?actor.pathPts.length:0;
    if(!actor||pointCount!==count||!shotDurationTrackIsValid(times,pointCount,oldSceneDuration))return shotDurationFailure('unsafePointSync',{label:actor?.label||shot.syncActor||''});
    if(!Array.isArray(actor.pathTimes)||actor.pathTimes.length!==times.length||
      actor.pathTimes.some((value,index)=>!Number.isFinite(value)||Math.abs(value-times[index])>1e-9)){
      return shotDurationFailure('unsafePointSync',{label:actor.label||shot.syncActor||''});
    }
    if(!actorPreconditions.some(precondition=>precondition.actor===actor))actorPreconditions.push({
      actor,pathPts:actor.pathPts,sourcePathTimes:actor.pathTimes,fingerprint:shotDurationActorFingerprint(actor)
    });
  }
  return {
    ok:true,shot,oldDuration,nextDuration,ratio,oldStart,oldEnd,oldSceneDuration,newSceneDuration,
    cameraUpdate,actorUpdates,
    actorPreconditions,
    precondition:{
      dur:shot.dur,timingMode:shot.timingMode,camTimes:shot.camTimes,camAimTimes:shot.camAimTimes,camFovTimes:shot.camFovTimes,
      fingerprint:shotDurationShotFingerprint(shot),previewFingerprint:context.previewFingerprint
    }
  };
}
function applyShotDurationChange(plan){
  if(!plan?.ok||plan.noChange)return plan?.ok?{ok:true,noChange:true}:shotDurationFailure(plan?.reason||'invalidDuration');
  const shot=plan.shot,source=plan.precondition;
  if(!shot||!source||shot.dur!==source.dur||shot.timingMode!==source.timingMode||
    shot.camTimes!==source.camTimes||shot.camAimTimes!==source.camAimTimes||shot.camFovTimes!==source.camFovTimes||
    shotDurationShotFingerprint(shot)!==source.fingerprint||
    plan.actorPreconditions.some(precondition=>precondition.actor?.pathPts!==precondition.pathPts||
      precondition.actor?.pathTimes!==precondition.sourcePathTimes||
      shotDurationActorFingerprint(precondition.actor)!==precondition.fingerprint))return shotDurationFailure('stalePlan');
  shot.dur=plan.nextDuration;
  if(plan.cameraUpdate)Object.assign(shot,plan.cameraUpdate);
  plan.actorUpdates.forEach(update=>{update.actor.pathTimes=update.pathTimes;});
  return {ok:true};
}
/* Camera keyframes align by path arc length; yaw is unwrapped first, then interpolated with a C1-continuous Hermite spline. */
function cameraKeyProgress(s){
  const us=[0]; let total=0;
  for(let i=1;i<s.camPts.length;i++){ total+=s.camPts[i].distanceTo(s.camPts[i-1]); us.push(total); }
  if(total<1e-6) return us.map((_,i)=>s.camPts.length<2?0:i/(s.camPts.length-1));
  return us.map(v=>v/total);
}
const PROJECT_VERSION=5;
const CAMERA_POINT_HEIGHT_MIN=.2;
const CAMERA_POINT_HEIGHT_MAX=30;
function clampAuthoredCameraPointHeight(value,fallback=CAMERA_POINT_HEIGHT_MIN){
  const numeric=typeof value==='string'&&value.trim()===''?NaN:Number(value);
  if(Number.isFinite(numeric))return Math.max(CAMERA_POINT_HEIGHT_MIN,Math.min(CAMERA_POINT_HEIGHT_MAX,numeric));
  const previous=typeof fallback==='string'&&fallback.trim()===''?NaN:Number(fallback);
  return Number.isFinite(previous)?previous:CAMERA_POINT_HEIGHT_MIN;
}
function isPlainRecord(value){
  if(!value||typeof value!=='object'||Array.isArray(value))return false;
  const proto=Object.getPrototypeOf(value);return proto===null||(Object.prototype.toString.call(value)==='[object Object]'&&Object.getPrototypeOf(proto)===null);
}
const PROJECT_EASE_TYPES=new Set(['constant','linear','easeIn','easeOut','easeInOut','custom']);
const PROJECT_LOCK_GLOBAL='\u5168\u5c40',PROJECT_LOCK_MANUAL='\u624b\u52a8\u671d\u5411';
const PROJECT_LOCK_SENTINELS=new Set(['',PROJECT_LOCK_GLOBAL,PROJECT_LOCK_MANUAL]);
const PROJECT_POSES=new Set(['stand','sit','crouch','lie','ride','custom']);
const PROJECT_JOINT_KEYS=new Set([
  'bodyY','bodyRotX','neckX','neckY','spineX','spineY','spineZ','shLX','shLZ','shRX','shRZ','elL','elR',
  'wristLX','wristLZ','wristRX','wristRZ','hipLX','hipLZ','hipRX','hipRZ','kneeL','kneeR','ankleLX','ankleLZ','ankleRX','ankleRZ'
]);
const PROJECT_PATH_MODES=new Set(['line','curve']);
const PROJECT_TIME_LINKS=new Set(['independent','cameraNodes','cameraFollow']);
const PROJECT_TIMING_MODES=new Set(['pointSync','arcLength','custom']);
const ACTOR_FIELDS=Object.freeze([
  {key:'kind',type:'string',defaultValue:'prop',allowEmpty:false,normalizePhase:'actorHead',normalizeOrder:20},
  {key:'label',type:'string',required:true,allowEmpty:false,normalizePhase:'actorHead',normalizeOrder:10},
  {key:'pose',type:'string',defaultValue:'stand',allowEmpty:false,values:PROJECT_POSES,normalizePhase:'actorHead',normalizeOrder:30},
  {key:'rotY',type:'number',defaultValue:0,normalizePhase:'actorTail',normalizeOrder:80},
  {key:'height',type:'number',defaultValue:0,legacyKey:'y',normalizePhase:'actorTail',normalizeOrder:90},
  {key:'scale',type:'number',defaultValue:1,normalizePhase:'actorTail',normalizeOrder:100},
  {key:'pathMode',type:'string',defaultValue:'curve',values:PROJECT_PATH_MODES,normalizePhase:'actorHead',normalizeOrder:40},
  {key:'timeLink',type:'string',defaultValue:'independent',values:PROJECT_TIME_LINKS,normalizePhase:'actorHead',normalizeOrder:50},
  {key:'timeOffset',type:'number',defaultValue:0,normalizePhase:'actorTail',normalizeOrder:110}
]);
const SHOT_FIELDS=Object.freeze([
  {key:'name',type:'string',required:true,allowEmpty:false,normalizePhase:'shotHead',normalizeOrder:10},
  {key:'desc',type:'string',defaultValue:'',normalizePhase:'shotTail',normalizeOrder:50},
  {key:'dur',type:'number',required:true,positive:true,normalizePhase:'shotHead',normalizeOrder:20},
  {key:'lock',type:'string',defaultValue:PROJECT_LOCK_GLOBAL,emptyDefault:true,normalizePhase:'shotTail',normalizeOrder:60},
  {key:'fov',type:'number',defaultValue:40,normalizePhase:'shotTail',normalizeOrder:70},
  {key:'camMode',type:'string',defaultValue:'curve',values:PROJECT_PATH_MODES,normalizePhase:'shotModes',normalizeOrder:30},
  {key:'timingMode',type:'string',defaultValue:'pointSync',values:PROJECT_TIMING_MODES,normalizePhase:'shotModes',normalizeOrder:40},
  {key:'syncActor',type:'string',defaultValue:'',emptyDefault:true,normalizePhase:'shotTail',normalizeOrder:80},
  {key:'yaw',type:'number',defaultValue:0,normalizePhase:'shotTail',normalizeOrder:90},
  {key:'pitch',type:'number',defaultValue:0,normalizePhase:'shotTail',normalizeOrder:100}
]);
function invalidProject(path){const error=new Error(path||'project');error.code='PREVISION_INVALID_PROJECT';throw error;}
function projectOwn(record,key){return Object.hasOwn?Object.hasOwn(record,key):Object.prototype.hasOwnProperty.call(record,key);}
function projectString(value,path,{optional=false,allowEmpty=true}={}){
  if(value===undefined&&optional)return undefined;
  if(typeof value!=='string'||(!allowEmpty&&!value.length))invalidProject(path);
  return value;
}
function projectFinite(value,path,{optional=false,defaultValue}={}){
  if(value===undefined&&optional)return defaultValue;
  if(typeof value!=='number'||!Number.isFinite(value))invalidProject(path);
  return value;
}
function projectTuple(value,size,path){
  if(!Array.isArray(value)||value.length!==size)invalidProject(path);
  return value.map((item,index)=>projectFinite(item,`${path}[${index}]`));
}
function normalizeProjectEase(value,path){
  if(typeof value==='string'){
    if(!PROJECT_EASE_TYPES.has(value))invalidProject(path);
    return {type:value};
  }
  if(!isPlainRecord(value)||!PROJECT_EASE_TYPES.has(value.type))invalidProject(path);
  if(value.type!=='custom')return {type:value.type};
  return {type:'custom',x1:projectFinite(value.x1,`${path}.x1`),y1:projectFinite(value.y1,`${path}.y1`),x2:projectFinite(value.x2,`${path}.x2`),y2:projectFinite(value.y2,`${path}.y2`)};
}
function normalizeProjectArray(value,path,normalizer,{optional=false}={}){
  if(value===undefined&&optional)return [];
  if(!Array.isArray(value))invalidProject(path);
  return value.map((item,index)=>normalizer(item,`${path}[${index}]`));
}
function projectDistributedTimes(points,start,end){
  if(!points.length)return [];if(points.length===1)return [start];
  const distances=[0];let total=0;
  for(let i=1;i<points.length;i++){let squared=0;for(let axis=0;axis<points[i].length;axis++){const delta=points[i][axis]-points[i-1][axis];squared+=delta*delta;}const distance=Math.sqrt(squared);total+=distance;if(!Number.isFinite(distance)||!Number.isFinite(total))return Array.from({length:points.length},(_,index)=>start+(end-start)*index/(points.length-1));distances.push(total);}
  return distances.map((distance,index)=>start+(end-start)*(total>1e-6?distance/total:index/(points.length-1)));
}
function repairProjectPathTimes(points,times,start,end){
  if(times.length!==points.length)return projectDistributedTimes(points,start,end);
  const out=times.map(value=>Math.max(start,Math.min(end,value)));
  for(let i=1;i<out.length;i++)out[i]=Math.max(out[i],out[i-1]+.01);
  if(out.length&&out[out.length-1]>end){const span=Math.max(.01,out[out.length-1]-out[0]);return out.map(value=>start+(value-out[0])/span*Math.max(0,end-start));}
  return out;
}
function repairProjectIndexTimes(count,times,start,end,fallback){
  if(times.length===count){const out=times.map(value=>Math.max(start,Math.min(end,value)));for(let i=1;i<out.length;i++)out[i]=Math.max(out[i],out[i-1]+.01);if(!out.length||out[out.length-1]<=end)return out;return Array.from({length:count},(_,index)=>start+(end-start)*(count<2?0:index/(count-1)));}
  if(fallback.length===count)return fallback.slice();
  return Array.from({length:count},(_,index)=>start+(end-start)*(count<2?0:index/(count-1)));
}
function repairProjectEases(eases,count){
  return Array.from({length:Math.max(0,count)},(_,index)=>eases[index]||{type:'linear'}).map(spec=>Object.assign({},spec));
}
function normalizeProjectAssets(value){
  if(value===undefined)return Object.create(null);
  if(!isPlainRecord(value))invalidProject('project.assets');
  const out=Object.create(null);
  Object.keys(value).forEach(id=>{
    const asset=value[id],path=`project.assets[${JSON.stringify(id)}]`;
    if(!isPlainRecord(asset)||typeof asset.d!=='string')invalidProject(path);
    const w=projectFinite(asset.w,`${path}.w`),h=projectFinite(asset.h,`${path}.h`);
    if(w<=0||h<=0)invalidProject(path);
    out[id]={d:asset.d,w,h};
  });
  return out;
}
function normalizeProjectJoints(value,path){
  if(value===undefined)return undefined;
  if(!isPlainRecord(value))invalidProject(path);
  const out=Object.create(null);
  PROJECT_JOINT_KEYS.forEach(key=>{if(projectOwn(value,key))out[key]=projectFinite(value[key],`${path}.${key}`);});
  return out;
}
function normalizeProjectDimensions(value,path){
  if(value===undefined)return undefined;
  if(!isPlainRecord(value))invalidProject(path);
  const out={};
  ['width','height','depth'].forEach(key=>{const n=projectFinite(value[key],`${path}.${key}`);if(n<=0)invalidProject(`${path}.${key}`);out[key]=n;});
  return out;
}
function projectScalarSource(value,field){
  return field.legacyKey&&value[field.key]===undefined?value[field.legacyKey]:value[field.key];
}
function normalizeProjectScalarField(value,path,field){
  const fieldPath=`${path}.${field.key}`,source=projectScalarSource(value,field);
  let out;
  if(field.type==='number'){
    out=projectFinite(source,fieldPath,{optional:field.required!==true,defaultValue:field.defaultValue});
    if(field.positive&&out<=0)invalidProject(fieldPath);
  }else{
    out=projectString(source,fieldPath,{optional:field.required!==true,allowEmpty:field.allowEmpty!==false});
    if((out===undefined||(field.emptyDefault&&out===''))&&projectOwn(field,'defaultValue'))out=field.defaultValue;
    if(field.values&&!field.values.has(out))invalidProject(fieldPath);
  }
  return out;
}
function normalizeProjectScalars(value,path,fields,phase,out=Object.create(null)){
  fields
    .filter(field=>field.normalizePhase===phase)
    .slice()
    .sort((a,b)=>a.normalizeOrder-b.normalizeOrder)
    .forEach(field=>{out[field.key]=normalizeProjectScalarField(value,path,field);});
  return out;
}
function normalizeProjectActor(value,path){
  if(!isPlainRecord(value))invalidProject(path);
  const scalars=normalizeProjectScalars(value,path,ACTOR_FIELDS,'actorHead');
  const points=normalizeProjectArray(value.path,`${path}.path`,(point,pointPath)=>projectTuple(point,2,pointPath),{optional:true});
  const times=normalizeProjectArray(value.pathTimes,`${path}.pathTimes`,projectFinite,{optional:true});
  const eases=normalizeProjectArray(value.pathEase,`${path}.pathEase`,normalizeProjectEase,{optional:true});
  const pos=value.pos===undefined?[0,0]:projectTuple(value.pos,2,`${path}.pos`);
  normalizeProjectScalars(value,path,ACTOR_FIELDS,'actorTail',scalars);
  const out={kind:scalars.kind,label:scalars.label,pose:scalars.pose,pos,
    rotY:scalars.rotY,height:scalars.height,
    scale:scalars.scale,pathMode:scalars.pathMode,timeLink:scalars.timeLink,
    timeOffset:scalars.timeOffset,path:points,pathTimes:times,pathEase:repairProjectEases(eases,Math.max(0,points.length-1))};
  let semanticType=value.semanticType!==undefined?projectString(value.semanticType,`${path}.semanticType`):undefined;
  if(value.characterStyle!==undefined){
    const style=projectString(value.characterStyle,`${path}.characterStyle`,{allowEmpty:false});
    if(style!=='wizard'||scalars.kind!=='char')invalidProject(`${path}.characterStyle`);
    semanticType='adult_male';
  }
  if(value.mount!==undefined&&value.mount!==null)out.mount=projectString(value.mount,`${path}.mount`,{allowEmpty:false});
  if(semanticType!==undefined)out.semanticType=semanticType;
  if(value.asset!==undefined)out.asset=projectString(value.asset,`${path}.asset`,{allowEmpty:false});
  if(value.timeLinkShot!==undefined){if(!Number.isInteger(value.timeLinkShot))invalidProject(`${path}.timeLinkShot`);out.timeLinkShot=value.timeLinkShot;}
  if(value.terrainVersion!==undefined){if(!Number.isInteger(value.terrainVersion)||value.terrainVersion<1)invalidProject(`${path}.terrainVersion`);out.terrainVersion=value.terrainVersion;}
  const joints=normalizeProjectJoints(value.joints,`${path}.joints`);if(joints!==undefined)out.joints=joints;
  const dimensions=normalizeProjectDimensions(value.dimensions,`${path}.dimensions`);if(dimensions!==undefined)out.dimensions=dimensions;
  return out;
}
function normalizeProjectShot(value,path){
  if(!isPlainRecord(value))invalidProject(path);
  const scalars=normalizeProjectScalars(value,path,SHOT_FIELDS,'shotHead');
  const dur=scalars.dur;
  const cam=normalizeProjectArray(value.cam,`${path}.cam`,(point,pointPath)=>projectTuple(point,3,pointPath));if(!cam.length)invalidProject(`${path}.cam`);
  normalizeProjectScalars(value,path,SHOT_FIELDS,'shotModes',scalars);
  normalizeProjectScalars(value,path,SHOT_FIELDS,'shotTail',scalars);
  const out={name:scalars.name,desc:scalars.desc,dur:scalars.dur,
    lock:scalars.lock,fov:scalars.fov,
    camMode:scalars.camMode,timingMode:scalars.timingMode,syncActor:scalars.syncActor,
    yaw:scalars.yaw,pitch:scalars.pitch,cam};
  const camAim=normalizeProjectArray(value.camAim,`${path}.camAim`,(point,pointPath)=>projectTuple(point,3,pointPath),{optional:true});
  if(value.camAim!==undefined)out.camAim=cam.map((_,index)=>camAim[index]?camAim[index].slice():[out.yaw,out.pitch,out.fov]);
  const camTimes=normalizeProjectArray(value.camTimes,`${path}.camTimes`,projectFinite,{optional:true});out.camTimes=repairProjectPathTimes(cam,camTimes,0,Math.max(.1,dur));
  const aimTimes=normalizeProjectArray(value.camAimTimes,`${path}.camAimTimes`,projectFinite,{optional:true});out.camAimTimes=repairProjectIndexTimes(cam.length,aimTimes,0,Math.max(.1,dur),out.camTimes);
  const fovTimes=normalizeProjectArray(value.camFovTimes,`${path}.camFovTimes`,projectFinite,{optional:true});out.camFovTimes=repairProjectIndexTimes(cam.length,fovTimes,0,Math.max(.1,dur),out.camTimes);
  ['camEase','camAimEase','camFovEase'].forEach(key=>{const eases=normalizeProjectArray(value[key],`${path}.${key}`,normalizeProjectEase,{optional:true});out[key]=repairProjectEases(eases,Math.max(0,cam.length-1));});
  try{
    const reframeByAspect=normalizeReframeByAspect(value.reframeByAspect,{strict:true,path:`${path}.reframeByAspect`});
    if(reframeByAspect!==undefined)out.reframeByAspect=reframeByAspect;
  }catch(error){invalidProject(error.message||`${path}.reframeByAspect`);}
  return out;
}
function normalizeProjectGround(value,path,assets){
  if(value===undefined)return {style:'checker'};
  if(!isPlainRecord(value))invalidProject(path);
  const style=value.style===undefined?'checker':projectString(value.style,`${path}.style`);if(!['checker','white','black','color','image'].includes(style))invalidProject(`${path}.style`);
  if(style==='color'){
    const color=projectString(value.color,`${path}.color`);if(!/^#[0-9a-f]{6}$/i.test(color))invalidProject(`${path}.color`);return {style,color:color.toLowerCase()};
  }
  if(style==='image'){
    const asset=projectString(value.asset,`${path}.asset`,{allowEmpty:false});return projectOwn(assets,asset)?{style,asset}:{style:'checker'};
  }
  return {style};
}
function normalizeProjectSun(value,path){
  if(value===undefined)return Object.assign({},DEFAULT_SUN,{pos:DEFAULT_SUN.pos.slice()});
  if(!isPlainRecord(value))invalidProject(path);
  const quality=value.quality===undefined?DEFAULT_SUN.quality:projectString(value.quality,`${path}.quality`);if(!['performance','standard','high'].includes(quality))invalidProject(`${path}.quality`);
  if(value.enabled!==undefined&&typeof value.enabled!=='boolean')invalidProject(`${path}.enabled`);
  return {enabled:value.enabled!==false,pos:value.pos===undefined?DEFAULT_SUN.pos.slice():projectTuple(value.pos,3,`${path}.pos`),
    intensity:projectFinite(value.intensity,`${path}.intensity`,{optional:true,defaultValue:DEFAULT_SUN.intensity}),
    temp:projectFinite(value.temp,`${path}.temp`,{optional:true,defaultValue:DEFAULT_SUN.temp}),
    ambient:projectFinite(value.ambient,`${path}.ambient`,{optional:true,defaultValue:DEFAULT_SUN.ambient}),
    softness:projectFinite(value.softness,`${path}.softness`,{optional:true,defaultValue:DEFAULT_SUN.softness}),quality};
}
function normalizeProjectBackground(value,path,assets){
  if(value===undefined||value===null)return null;
  if(!isPlainRecord(value))invalidProject(path);
  const asset=projectString(value.asset,`${path}.asset`,{allowEmpty:false});if(!projectOwn(assets,asset))return null;
  if(value.gp!==undefined&&typeof value.gp!=='boolean')invalidProject(`${path}.gp`);
  return {asset,yaw:projectFinite(value.yaw,`${path}.yaw`,{optional:true,defaultValue:0}),radius:projectFinite(value.radius,`${path}.radius`,{optional:true,defaultValue:SKY_BASE_R}),
    y:projectFinite(value.y,`${path}.y`,{optional:true,defaultValue:1.6}),gp:value.gp!==false};
}
function validateProjectSceneReferences(scene,path,assets){
  const labels=new Set();
  scene.actors.forEach((actor,index)=>{
    if(labels.has(actor.label))invalidProject(`${path}.actors[${index}].label`);labels.add(actor.label);
    if(actor.asset&&!projectOwn(assets,actor.asset))delete actor.asset;
  });
  const mounts=new Map(scene.actors.map(actor=>[actor.label,actor.mount||'']));
  scene.actors.forEach((actor,index)=>{
    if(actor.mount&&!labels.has(actor.mount))invalidProject(`${path}.actors[${index}].mount`);
    const seen=new Set([actor.label]);let next=actor.mount;
    while(next){if(seen.has(next))invalidProject(`${path}.actors[${index}].mount`);seen.add(next);next=mounts.get(next)||'';}
    if(actor.timeLinkShot!==undefined&&actor.timeLinkShot>=scene.shots.length)invalidProject(`${path}.actors[${index}].timeLinkShot`);
  });
  const sceneDuration=scene.shots.reduce((sum,shot)=>sum+shot.dur,0);
  scene.actors.forEach((actor,index)=>actor.pathTimes.forEach((value,timeIndex)=>{if(value>sceneDuration)invalidProject(`${path}.actors[${index}].pathTimes[${timeIndex}]`);}));
  scene.shots.forEach((shot,index)=>{
    if(!PROJECT_LOCK_SENTINELS.has(shot.lock)&&!labels.has(shot.lock))invalidProject(`${path}.shots[${index}].lock`);
    if(shot.syncActor&&!labels.has(shot.syncActor))invalidProject(`${path}.shots[${index}].syncActor`);
  });
}
function normalizeProjectScene(value,path,assets){
  if(!isPlainRecord(value))invalidProject(path);
  if(!Array.isArray(value.actors)||!Array.isArray(value.shots)||!value.shots.length)invalidProject(path);
  const out={name:projectString(value.name,`${path}.name`,{allowEmpty:false}),desc:projectString(value.desc,`${path}.desc`,{optional:true})||'',
    script:projectString(value.script,`${path}.script`,{optional:true})||'',actors:value.actors.map((actor,index)=>normalizeProjectActor(actor,`${path}.actors[${index}]`)),
    shots:value.shots.map((shot,index)=>normalizeProjectShot(shot,`${path}.shots[${index}]`)),ground:normalizeProjectGround(value.ground,`${path}.ground`,assets),
    sun:normalizeProjectSun(value.sun,`${path}.sun`),bg:normalizeProjectBackground(value.bg,`${path}.bg`,assets)};
  if(value.templateId!==undefined)out.templateId=projectString(value.templateId,`${path}.templateId`);
  const duration=out.shots.reduce((sum,shot)=>sum+shot.dur,0);if(!Number.isFinite(duration))invalidProject(`${path}.shots.duration`);
  out.actors.forEach(actor=>{actor.pathTimes=repairProjectPathTimes(actor.path,actor.pathTimes,0,duration);if(actor.timeLinkShot!==undefined&&(actor.timeLinkShot<0||actor.timeLinkShot>=out.shots.length)){actor.timeLink='independent';actor.timeLinkShot=0;}});
  validateProjectSceneReferences(out,path,assets);return out;
}
function normalizeProjectData(data){
  if(!isPlainRecord(data)||data.app!=='PreVision')invalidProject('project');
  if(data.version!==undefined&&(!Number.isInteger(data.version)||data.version<1||data.version>PROJECT_VERSION))invalidProject('project.version');
  if(!Array.isArray(data.scenes)||!data.scenes.length)invalidProject('project.scenes');
  const assets=normalizeProjectAssets(data.assets),aspect=data.aspect===undefined?'16:9':projectString(data.aspect,'project.aspect');
  if(!projectOwn(SEED_RES,aspect))invalidProject('project.aspect');
  if(data.settings!==undefined&&!isPlainRecord(data.settings))invalidProject('project.settings');
  const settings=data.settings||{};if(settings.collision!==undefined&&typeof settings.collision!=='boolean')invalidProject('project.settings.collision');if(settings.labels!==undefined&&typeof settings.labels!=='boolean')invalidProject('project.settings.labels');
  const out={app:'PreVision',version:PROJECT_VERSION,name:projectString(data.name,'project.name',{optional:true})||'',aspect,assets,
    settings:{collision:settings.collision!==false,labels:settings.labels!==false},scenes:data.scenes.map((scene,index)=>normalizeProjectScene(scene,`project.scenes[${index}]`,assets))};
  if(data.created!==undefined)out.created=projectString(data.created,'project.created');
  if(data.modified!==undefined)out.modified=projectString(data.modified,'project.modified');
  return out;
}

export {
  DEFAULT_ACTORS,
  SCENE_TEMPLATES,
  makeNeutralShot,
  makeBlankScene,
  materializeSceneTemplate,
  newProject,
  makeFirstRunWelcomeProject,
  shotCurve,
  ensureCamKeys,
  distributedPathTimes,
  repairPathTimes,
  ensureCamTimes,
  repairIndexTimes,
  ensureCamAimTimes,
  ensureCamFovTimes,
  ensureActorTimes,
  ensureEaseArray,
  planCameraPositionPointDeletion,
  applyCameraPositionPointDeletion,
  SHOT_DURATION_MIN,
  planShotDurationChange,
  applyShotDurationChange,
  cameraKeyProgress,
  PROJECT_VERSION,
  CAMERA_POINT_HEIGHT_MIN,
  CAMERA_POINT_HEIGHT_MAX,
  clampAuthoredCameraPointHeight,
  PROJECT_EASE_TYPES,
  PROJECT_LOCK_GLOBAL,
  PROJECT_LOCK_MANUAL,
  PROJECT_LOCK_SENTINELS,
  PROJECT_POSES,
  PROJECT_JOINT_KEYS,
  ACTOR_FIELDS,
  SHOT_FIELDS,
  isPlainRecord,
  invalidProject,
  projectOwn,
  projectString,
  projectFinite,
  projectTuple,
  normalizeProjectEase,
  normalizeProjectArray,
  projectDistributedTimes,
  repairProjectPathTimes,
  repairProjectIndexTimes,
  repairProjectEases,
  normalizeProjectAssets,
  normalizeProjectJoints,
  normalizeProjectDimensions,
  normalizeProjectActor,
  normalizeProjectShot,
  normalizeProjectGround,
  normalizeProjectSun,
  normalizeProjectBackground,
  validateProjectSceneReferences,
  normalizeProjectScene,
  normalizeProjectData,
};
