/* P9 timeline fragment: preview animation state, tracks, playhead, and thumbnails. */
let motionSelected={type:'camera',label:'',index:0},motionSelection=new Set(),motionClipboard=null,cameraPositionCommandSelection=null;
const MOTION_COLORS=['#E5484D','#F2B84B','#58A6FF','#B47CFF','#58C58B','#E47FA8','#B6C15A'];
const previewAnimationStore=new Map(),previewPendingEdits=new Map(),previewAutoTransactions=new Set(),previewAutoChannels=new Map(),motionExpandedGroups=new Set(),motionKnownGroups=new Set();
const cameraTimelinePendingOwners=new Set();
const PREVIEW_KEY_EPS=1/60;
const MOTION_TIME_STEP=.1,MOTION_MAGNET_STEP=.5,MOTION_MAGNET_RADIUS_PX=8;
let previewMotionSerial=0,previewAutoKey=false,motionSnapEnabled=true,motionAdvancedOpen=false,motionSceneGlobal=false,motionGroupsInitialized=false,previewMotionSelection={ownerKey:'',channelId:'',keyId:'',groupId:''},unifiedCameraDraft=null,motionSnapHighlight=null,motionSnapStatusActive=false,motionSnapStatusText='';
function quantizeMotionTime(value){const result=Math.round((Number.isFinite(+value)?+value:0)/MOTION_TIME_STEP)*MOTION_TIME_STEP;return Object.is(result,-0)?0:+result.toFixed(1);}
function resolveMotionDragTime(rawTime,{min=0,max=Infinity,pixelsPerSecond=0,bypass=false}={}){
  const bounded=Math.max(min,Math.min(max,Number.isFinite(+rawTime)?+rawTime:0));
  if(!motionSnapEnabled||bypass)return {time:bounded,snapped:false};
  const gridMin=Math.ceil((min-1e-9)/MOTION_TIME_STEP)*MOTION_TIME_STEP,gridMax=Number.isFinite(max)?Math.floor((max+1e-9)/MOTION_TIME_STEP)*MOTION_TIME_STEP:Infinity;
  if(gridMax<gridMin-1e-9)return {time:bounded,snapped:false,blocked:true};
  const fallback=Math.max(gridMin,Math.min(gridMax,quantizeMotionTime(bounded)));
  if(!Number.isFinite(pixelsPerSecond)||pixelsPerSecond<=0)return {time:+fallback.toFixed(1),snapped:false};
  const magnet=quantizeMotionTime(Math.round(bounded/MOTION_MAGNET_STEP)*MOTION_MAGNET_STEP);
  if(magnet>=gridMin-1e-9&&magnet<=gridMax+1e-9&&Math.abs(magnet-bounded)*pixelsPerSecond<=MOTION_MAGNET_RADIUS_PX)return {time:magnet,snapped:true};
  return {time:+fallback.toFixed(1),snapped:false};
}
function resolveManualMotionScrubTime(rawTime,pixelsPerSecond,bypass=false){
  return resolveMotionDragTime(rawTime,{min:0,max:motionTimelineDuration(),pixelsPerSecond,bypass});
}
function clearMotionSnapFeedback(){
  const guide=$('motionSnapGuide');if(guide)guide.hidden=true;
  if(motionSnapHighlight)motionSnapHighlight.classList.remove('motion-snapped');motionSnapHighlight=null;
  if(motionSnapStatusActive){const status=$('motionStatus');if(status&&status.textContent===motionSnapStatusText)status.textContent='';motionSnapStatusActive=false;motionSnapStatusText='';}
}
function setMotionSnapStatus(time){
  const status=$('motionStatus');if(!status)return;
  motionSnapStatusText=PreVisionI18n.t('timeline.snap.status',{time:(+time||0).toFixed(1)});status.textContent=motionSnapStatusText;motionSnapStatusActive=true;
}
function setMotionDragStatus(time){
  const status=$('motionStatus');if(!status)return;
  motionSnapStatusText=PreVisionI18n.t('timeline.drag.status',{time:(Number.isFinite(+time)?+time:0).toFixed(3)});status.textContent=motionSnapStatusText;motionSnapStatusActive=true;
}
function showMotionSnapFeedback(time,lane,element){
  const guide=$('motionSnapGuide'),rows=$('motionRows');
  if(guide&&rows&&lane){const laneRect=lane.getBoundingClientRect(),rowsRect=rows.getBoundingClientRect(),dur=motionTimelineDuration();guide.style.left=(laneRect.left-rowsRect.left+Math.max(0,Math.min(1,time/Math.max(.1,dur)))*laneRect.width)+'px';guide.hidden=false;}
  if(motionSnapHighlight!==element){if(motionSnapHighlight)motionSnapHighlight.classList.remove('motion-snapped');motionSnapHighlight=element||null;if(motionSnapHighlight)motionSnapHighlight.classList.add('motion-snapped');}
  setMotionSnapStatus(time);
}
function previewMotionId(prefix){previewMotionSerial+=1;return `${prefix}${previewMotionSerial.toString(36)}`;}
function previewOwnerState(ownerKey,create=false){
  let state=previewAnimationStore.get(ownerKey);
  if(!state&&create){state={schema:1,groups:[],channels:{},base:{}};previewAnimationStore.set(ownerKey,state);}
  return state||null;
}
function previewSortedKeys(state,channelId){
  const channel=state?.channels?.[channelId];
  if(!channel)return [];
  const keys=Array.isArray(channel)?channel:(Array.isArray(channel.keys)?channel.keys:[]);
  keys.sort((a,b)=>a.time-b.time||String(a.id).localeCompare(String(b.id)));return keys;
}
function prunePreviewGroups(state){
  if(!state)return;
  const used=new Set();Object.keys(state.channels||{}).forEach(channelId=>previewSortedKeys(state,channelId).forEach(key=>used.add(key.groupId)));
  state.groups=(state.groups||[]).filter(group=>used.has(group.id));
}
function recordPreviewKeyGroup(ownerKey,values,timeValue,source='manual'){
  if(automaticCaptureMutationBlocked())return false;
  const state=previewOwnerState(ownerKey,true),limit=previewOwnerDescriptor(ownerKey)?previewOwnerLimit(ownerKey):Infinity,time=Math.max(0,Math.min(limit,+timeValue||0)),entries=Object.entries(values||{}).filter(([,value])=>Number.isFinite(+value));
  if(!entries.length)return null;
  let group=state.groups.find(item=>Math.abs(item.time-time)<=PREVIEW_KEY_EPS);
  if(!group){group={id:previewMotionId('g'),time,source:source==='auto'?'auto':'manual'};state.groups.push(group);state.groups.sort((a,b)=>a.time-b.time);}
  entries.forEach(([channelId,rawValue])=>{
    if(!state.channels[channelId])state.channels[channelId]={keys:[]};
    const keys=previewSortedKeys(state,channelId),value=+rawValue;
    let key=keys.find(item=>Math.abs(item.time-time)<=PREVIEW_KEY_EPS);
    if(key){key.value=value;key.groupId=group.id;}
    else{key={id:previewMotionId('k'),groupId:group.id,time,value,ease:{type:'linear'}};keys.push(key);}
    keys.sort((a,b)=>a.time-b.time||String(a.id).localeCompare(String(b.id)));
    state.base[channelId]=value;
  });
  prunePreviewGroups(state);
  return group;
}
function movePreviewChannelKey(ownerKey,channelId,keyId,nextTime){
  if(automaticCaptureMutationBlocked())return false;
  const state=previewOwnerState(ownerKey),keys=previewSortedKeys(state,channelId),key=keys.find(item=>item.id===keyId);
  if(!key||!Number.isFinite(+nextTime))return false;
  const index=keys.indexOf(key),limit=previewOwnerDescriptor(ownerKey)?previewOwnerLimit(ownerKey):Infinity;
  const lo=index>0?keys[index-1].time+PREVIEW_KEY_EPS:0,hi=index<keys.length-1?keys[index+1].time-PREVIEW_KEY_EPS:limit;
  key.time=Math.max(lo,Math.min(hi,+nextTime));keys.sort((a,b)=>a.time-b.time||String(a.id).localeCompare(String(b.id)));return true;
}
function previewGroupShiftBounds(state,groupId,limit){
  const group=state?.groups?.find(item=>item.id===groupId),range=previewGroupRange(state,groupId);if(!group||!range)return null;
  let lo=Math.max(-range.start,-group.time),hi=Math.min(limit-range.end,limit-group.time);
  Object.keys(state.channels||{}).forEach(channelId=>{
    const keys=previewSortedKeys(state,channelId),moving=keys.filter(key=>key.groupId===groupId),fixed=keys.filter(key=>key.groupId!==groupId);
    moving.forEach(key=>{
      const prev=fixed.filter(item=>item.time<key.time).pop(),next=fixed.find(item=>item.time>key.time);
      if(prev)lo=Math.max(lo,prev.time+PREVIEW_KEY_EPS-key.time);
      if(next)hi=Math.min(hi,next.time-PREVIEW_KEY_EPS-key.time);
    });
  });
  return {lo,hi,range,group};
}
function movePreviewKeyGroup(ownerKey,groupId,delta){
  if(automaticCaptureMutationBlocked())return false;
  const state=previewOwnerState(ownerKey),group=state?.groups?.find(item=>item.id===groupId);if(!group||!Number.isFinite(+delta))return false;
  const limit=previewOwnerDescriptor(ownerKey)?previewOwnerLimit(ownerKey):Infinity,bounds=previewGroupShiftBounds(state,groupId,limit);if(!bounds)return false;
  const {lo,hi}=bounds;
  const shift=Math.max(lo,Math.min(hi,+delta));group.time=Math.max(0,Math.min(limit,group.time+shift));
  Object.keys(state.channels).forEach(channelId=>previewSortedKeys(state,channelId).forEach(key=>{if(key.groupId===groupId)key.time=Math.max(0,Math.min(limit,key.time+shift));}));
  state.groups.sort((a,b)=>a.time-b.time);return true;
}
function previewGroupRange(state,groupId){
  const group=state?.groups?.find(item=>item.id===groupId);if(!group)return null;
  const times=[];Object.keys(state.channels||{}).forEach(channelId=>previewSortedKeys(state,channelId).forEach(key=>{if(key.groupId===groupId)times.push(key.time);}));
  return {start:times.length?Math.min(...times):group.time,end:times.length?Math.max(...times):group.time,anchor:group.time,count:times.length};
}
function samplePreviewChannel(stateOrOwnerKey,channelId,at,fallback){
  const state=typeof stateOrOwnerKey==='string'?previewOwnerState(stateOrOwnerKey):stateOrOwnerKey,keys=previewSortedKeys(state,channelId);
  if(!keys.length)return fallback;if(keys.length===1||at<=keys[0].time)return keys[0].value;if(at>=keys[keys.length-1].time)return keys[keys.length-1].value;
  let i=0;while(i<keys.length-2&&at>keys[i+1].time)i++;
  const a=keys[i],b=keys[i+1],span=Math.max(.0001,b.time-a.time),f=applyEaseSpec(a.ease||'linear',(at-a.time)/span);
  if(channelId==='rotation.y'||channelId==='yaw'){
    let d=b.value-a.value;while(d>180)d-=360;while(d<-180)d+=360;return a.value+d*f;
  }
  return a.value+(b.value-a.value)*f;
}
function serializePreviewAnimationState(){
  const entries=Array.from(previewAnimationStore.entries()).filter(([ownerKey])=>{
    let owner;try{owner=JSON.parse(ownerKey);}catch(_e){owner=null;}
    return !(Array.isArray(owner)&&owner[1]==='camera');
  });
  return JSON.stringify({serial:previewMotionSerial,entries});
}
function restorePreviewAnimationState(serialized){
  if(automaticCaptureMutationBlocked())return false;
  previewAnimationStore.clear();let data=null;try{data=typeof serialized==='string'?JSON.parse(serialized):serialized;}catch(_e){data=null;}
  if(data&&Array.isArray(data.entries))data.entries.forEach(entry=>{
    if(!Array.isArray(entry)||typeof entry[0]!=='string'||entry[1]?.schema!==1)return;
    let owner;try{owner=JSON.parse(entry[0]);}catch(_e){owner=null;}
    if(Array.isArray(owner)&&owner[1]==='camera')return;
    previewAnimationStore.set(entry[0],entry[1]);
  });
  previewMotionSerial=Math.max(0,+data?.serial||0);previewPendingEdits.clear();previewAutoTransactions.clear();previewAutoChannels.clear();cameraTimelinePendingOwners.clear();updatePreviewKeyControls();return true;
}
function clearPreviewAnimationState(){if(automaticCaptureMutationBlocked())return false;previewAnimationStore.clear();previewPendingEdits.clear();previewAutoTransactions.clear();previewAutoChannels.clear();cameraTimelinePendingOwners.clear();previewMotionSelection={ownerKey:'',channelId:'',keyId:'',groupId:''};previewMotionSerial=0;updatePreviewKeyControls();return true;}
function clearPreviewChannels(ownerKey,channelIds){
  if(automaticCaptureMutationBlocked())return false;
  const state=previewOwnerState(ownerKey),blocked=new Set(channelIds||[]);if(!state||!blocked.size)return 0;let count=0;
  blocked.forEach(channelId=>{if(state.channels?.[channelId]){delete state.channels[channelId];count++;}if(state.base)delete state.base[channelId];previewPendingEdits.get(ownerKey)?.delete(channelId);previewAutoChannels.get(ownerKey)?.delete(channelId);});
  if(!previewPendingEdits.get(ownerKey)?.size)previewPendingEdits.delete(ownerKey);
  if(!previewAutoChannels.get(ownerKey)?.size){previewAutoChannels.delete(ownerKey);previewAutoTransactions.delete(ownerKey);}
  prunePreviewGroups(state);updatePreviewKeyControls();return count;
}
function normalizePreviewState(state){
  Object.keys(state?.channels||{}).forEach(channelId=>{
    const keys=previewSortedKeys(state,channelId),merged=[];
    keys.forEach(key=>{const last=merged[merged.length-1];if(last&&Math.abs(last.time-key.time)<=PREVIEW_KEY_EPS){last.value=key.value;last.groupId=key.groupId;}else merged.push(key);});
    state.channels[channelId].keys=merged;
  });
  prunePreviewGroups(state);
}
function retimePreviewForShotDuration(index,oldDuration,newDuration){
  void index;void oldDuration;void newDuration;
  return false;
}
function shotDurationPreviewKeys(){
  const keys=[];
  previewAnimationStore.forEach((state,ownerKey)=>{
    let parts;try{parts=JSON.parse(ownerKey);}catch(_e){return;}
    if(!Array.isArray(parts)||parts[0]!==sceneIdx||parts[1]!=='actor')return;
    const domain=parts[1],owner=actors[parts[2]];
    Object.entries(state?.channels||{}).forEach(([channelId,channel])=>{
      const values=Array.isArray(channel)?channel:(Array.isArray(channel?.keys)?channel.keys:[]);
      values.forEach(key=>keys.push({domain,owner,shotIndex:domain==='camera'?parts[2]:undefined,channelId,time:+key?.time}));
    });
  });
  return keys;
}
function materializeShotDurationCamera(s){
  const count=Array.isArray(s?.camPts)?s.camPts.length:0,keyCount=Array.isArray(s?.camKeys)?s.camKeys.length:0,duration=+s?.dur;
  if(!count||count!==keyCount||!Number.isFinite(duration))return null;
  if(s.timingMode==='custom')return {
    camTimes:Array.isArray(s.camTimes)?s.camTimes.slice():null,
    camAimTimes:Array.isArray(s.camAimTimes)?s.camAimTimes.slice():null,
    camFovTimes:Array.isArray(s.camFovTimes)?s.camFovTimes.slice():null
  };
  const nodeAligned=s.timingMode==='pointSync'&&!!syncTargetForShot(s),curve=shotCurve(s);
  const exactArrival=(progress,index,total)=>index===0?0:index===total-1?duration:inverseSmoothProgress(progress)*duration;
  const positionTimes=s.camPts.map((point,index)=>{
    if(nodeAligned)return exactArrival(count<2?0:index/(count-1),index,count);
    const progress=curve?curveProgressAtControlPoint(curve,point,index,count):0;
    return exactArrival(progress,index,count);
  });
  const keyProgress=nodeAligned?s.camKeys.map((_,index)=>keyCount<2?0:index/(keyCount-1)):cameraKeyProgress(s);
  const keyTimes=keyProgress.map((progress,index)=>exactArrival(progress,index,keyCount));
  return {camTimes:positionTimes,camAimTimes:keyTimes.slice(),camFovTimes:keyTimes.slice()};
}
function planRuntimeShotDurationChange(nextDuration){
  const shot=curShot();if(!shot)return {ok:false,reason:'invalidShot'};
  const materializedCamera=materializeShotDurationCamera(shot);
  if(!materializedCamera)return {ok:false,reason:'unsafeMaterialization'};
  const pointSyncActor=shot.timingMode==='pointSync'&&shot.syncActor?syncTargetForShot(shot):null;
  const pointSyncActorTimes=pointSyncActor
    ?materializedCamera.camTimes.map(value=>shotStart(shotIdx)+value)
    :null;
  const previewFingerprint=serializePreviewAnimationState();
  return planShotDurationChange(shot,nextDuration,{
    shots,shotIndex:shotIdx,actors,materializedCamera,previewKeys:shotDurationPreviewKeys(),
    pointSyncActor,pointSyncActorTimes,previewFingerprint
  });
}
function applyRuntimeShotDurationChange(plan){
  if(!plan?.ok)return plan;
  if(plan.noChange)return {ok:true,noChange:true};
  if(serializePreviewAnimationState()!==plan.precondition?.previewFingerprint)return {ok:false,reason:'stalePlan'};
  return applyShotDurationChange(plan);
}
function removePreviewShotTimeRange(index,start,duration){
  if(automaticCaptureMutationBlocked())return false;
  const end=start+duration;
  previewAnimationStore.forEach((state,ownerKey)=>{
    let parts;try{parts=JSON.parse(ownerKey);}catch(_e){return;}if(!Array.isArray(parts)||parts[0]!==sceneIdx||parts[1]!=='actor')return;
    Object.keys(state.channels||{}).forEach(channelId=>{
      const kept=previewSortedKeys(state,channelId).filter(key=>key.time<start-PREVIEW_KEY_EPS||key.time>end-PREVIEW_KEY_EPS);
      kept.forEach(key=>{if(key.time>=end-PREVIEW_KEY_EPS)key.time=Math.max(start,key.time-duration);});state.channels[channelId].keys=kept;
    });
    (state.groups||[]).forEach(group=>{if(group.time>=end-PREVIEW_KEY_EPS)group.time-=duration;else if(group.time>=start-PREVIEW_KEY_EPS)group.time=start;});normalizePreviewState(state);
  });
}
function remapPreviewOwnerKeys(kind,deletedIndex,deletedScene=sceneIdx){
  if(automaticCaptureMutationBlocked())return false;
  const mapKey=ownerKey=>{
    let parts;try{parts=JSON.parse(ownerKey);}catch(_e){return ownerKey;}
    if(!Array.isArray(parts))return ownerKey;
    if(kind==='scene'){
      if(parts[0]===deletedIndex)return '';
      if(parts[0]>deletedIndex)parts[0]-=1;
    }else if(parts[0]===deletedScene&&parts[1]===kind){
      if(parts[2]===deletedIndex)return '';
      if(parts[2]>deletedIndex)parts[2]-=1;
    }
    return JSON.stringify(parts);
  };
  const remapMap=source=>{const entries=[];source.forEach((value,key)=>{const next=mapKey(key);if(next)entries.push([next,value]);});source.clear();entries.forEach(([key,value])=>source.set(key,value));};
  const remapSet=source=>{const values=[];source.forEach(key=>{const next=mapKey(key);if(next)values.push(next);});source.clear();values.forEach(key=>source.add(key));};
  remapMap(previewAnimationStore);remapMap(previewPendingEdits);remapMap(previewAutoChannels);remapSet(previewAutoTransactions);remapSet(motionExpandedGroups);remapSet(motionKnownGroups);
  previewMotionSelection.ownerKey=mapKey(previewMotionSelection.ownerKey);
  updatePreviewKeyControls();
}
function previewActorOwnerKey(actor){const index=actors.indexOf(actor);return index<0?'':JSON.stringify([sceneIdx,'actor',index]);}
function previewCameraOwnerKey(index=shotIdx){return JSON.stringify([sceneIdx,'camera',Math.max(0,index)]);}
function previewOwnerDescriptor(ownerKey){
  let parts;try{parts=JSON.parse(ownerKey);}catch(_e){return null;}if(!Array.isArray(parts)||parts[0]!==sceneIdx)return null;
  if(parts[1]==='actor'){const owner=actors[parts[2]];return owner?{type:'actor',owner,index:parts[2]}:null;}
  if(parts[1]==='camera'){const owner=shots[parts[2]];return owner?{type:'camera',owner,index:parts[2]}:null;}
  return null;
}
function previewOwnerTime(ownerKey){const descriptor=previewOwnerDescriptor(ownerKey);return descriptor?.type==='camera'?Math.max(0,Math.min(descriptor.owner.dur,time)):shotStart(shotIdx)+Math.max(0,Math.min(curShot()?.dur||0,time));}
function previewOwnerLimit(ownerKey){const descriptor=previewOwnerDescriptor(ownerKey);return descriptor?.type==='camera'?Math.max(.1,descriptor.owner.dur):Math.max(.1,sceneDur());}
function previewOwnerOffset(ownerKey){const descriptor=previewOwnerDescriptor(ownerKey);return descriptor?.type==='camera'?shotStart(descriptor.index):0;}
function previewAuthoredActorValue(actor,channelId,fallback){
  const value=previewOwnerState(previewActorOwnerKey(actor))?.base?.[channelId];return Number.isFinite(+value)?+value:fallback;
}
function previewReadValue(ownerKey,channelId){
  const descriptor=previewOwnerDescriptor(ownerKey);if(!descriptor)return NaN;
  if(descriptor.type==='camera'){
    const s=descriptor.owner;if(descriptor.index!==shotIdx)return NaN;
    if(channelId==='position.x')return camBall.position.x;if(channelId==='position.y')return camBall.position.y;if(channelId==='position.z')return camBall.position.z;
    if(channelId==='yaw')return Number.isFinite(+$('yaw')?.value)?+$('yaw').value:shotCam.rotation.y*180/Math.PI;
    if(channelId==='pitch')return Number.isFinite(+$('pitch')?.value)?+$('pitch').value:shotCam.rotation.x*180/Math.PI;
    if(channelId==='fov')return Number.isFinite(+$('fov')?.value)?+$('fov').value:shotCam.fov;
    return NaN;
  }
  const a=descriptor.owner;
  if(channelId==='position.x')return a.obj.position.x;if(channelId==='position.z')return a.obj.position.z;if(channelId==='elevation')return a.elev||0;
  if(channelId==='rotation.y')return a.obj.rotation.y*180/Math.PI;if(channelId==='scale')return a.obj.scale.x;
  if(channelId.startsWith('joint.'))return +(a.joints?.[channelId.slice(6)]||0);return NaN;
}
function previewPendingValue(ownerKey,channelId){
  const pending=previewPendingEdits.get(ownerKey);if(!pending?.has(channelId))return undefined;
  const value=+pending.get(channelId);return Number.isFinite(value)?value:undefined;
}
function previewChannelActive(ownerKey,state,channelId){return previewPendingValue(ownerKey,channelId)!==undefined||previewChannelHasKeys(state,channelId);}
function previewAnimatedValue(ownerKey,state,channelId,at,fallback){
  const pending=previewPendingValue(ownerKey,channelId);return pending!==undefined?pending:samplePreviewChannel(state,channelId,at,fallback);
}
function unifiedCameraDraftIsCurrent(){
  return !!unifiedCameraDraft&&unifiedCameraDraft.sceneIndex===sceneIdx&&unifiedCameraDraft.shotIndex===shotIdx&&
    Math.abs(unifiedCameraDraft.time-Math.max(0,Math.min(curShot()?.dur||0,+time||0)))<=PREVIEW_KEY_EPS;
}
function currentUnifiedCameraDraftPose(){
  if(!unifiedCameraDraftIsCurrent())return null;
  return {time:unifiedCameraDraft.time,position:unifiedCameraDraft.position,key:unifiedCameraDraft.key};
}
function clearUnifiedCameraDraft(){
  const had=!!unifiedCameraDraft,ownerKey=unifiedCameraDraft?.ownerKey;
  unifiedCameraDraft=null;if(ownerKey)cameraTimelinePendingOwners.delete(ownerKey);updatePreviewKeyControls();return had;
}
function cancelUnifiedCameraDraft(){
  if(!clearUnifiedCameraDraft())return false;
  updateShotCam();refreshCamPtUI();refreshMotionTimeline();rebuildVizLight();updateScrub();updateMonitor();return true;
}
function cameraEditUsesTransientDraft(index=selCamPt){
  const s=curShot();if(!s)return false;
  if(unifiedCameraDraftIsCurrent())return true;
  const times=ensureCamTimes(s),safeIndex=Math.max(0,Math.min(index,times.length-1)),at=Math.max(0,Math.min(s.dur,+time||0));
  return Math.abs((times[safeIndex]||0)-at)>PREVIEW_KEY_EPS;
}
function applyUnifiedCameraDraftToRuntime(s=curShot(),at=time){
  if(!unifiedCameraDraftIsCurrent()||s!==curShot()||Math.abs(unifiedCameraDraft.time-(+at||0))>PREVIEW_KEY_EPS)return false;
  const pose=unifiedCameraDraft;shotCam.position.copy(pose.position);camBall.position.copy(pose.position);shotCam.fov=pose.key.fov;
  shotCam.rotation.order='YXZ';
  if(s.lock===PROJECT_LOCK_MANUAL)shotCam.rotation.set(pose.key.pitch*Math.PI/180,pose.key.yaw*Math.PI/180,0);
  else{
    shotCam.lookAt(lockTarget(s.lock));
    pose.key.yaw=shotCam.rotation.y*180/Math.PI;pose.key.pitch=shotCam.rotation.x*180/Math.PI;
  }
  shotCam.updateProjectionMatrix();camBall.quaternion.copy(shotCam.quaternion);return true;
}
function beginUnifiedCameraDraft(index=selCamPt){
  if(automaticCaptureMutationBlocked()||!cameraEditUsesTransientDraft(index))return null;
  if(unifiedCameraDraftIsCurrent())return unifiedCameraDraft;
  const selectedPreview=previewCamPt;
  clearUnifiedCameraDraft();previewCamPt=null;updateShotCam();previewCamPt=selectedPreview;
  const s=curShot(),pose={
    position:shotCam.position.clone(),
    key:{yaw:shotCam.rotation.y*180/Math.PI,pitch:shotCam.rotation.x*180/Math.PI,fov:Math.max(10,Math.min(110,+shotCam.fov||+s.fov||40))}
  };
  unifiedCameraDraft={sceneIndex:sceneIdx,shotIndex:shotIdx,time:Math.max(0,Math.min(s.dur,+time||0)),ownerKey:previewCameraOwnerKey(),position:pose.position,key:pose.key};
  applyUnifiedCameraDraftToRuntime();return unifiedCameraDraft;
}
function updateUnifiedCameraDraft(values={}){
  const draft=unifiedCameraDraftIsCurrent()?unifiedCameraDraft:beginUnifiedCameraDraft();if(!draft)return false;
  if(Number.isFinite(+values['position.x']))draft.position.x=+values['position.x'];
  if(Number.isFinite(+values['position.y']))draft.position.y=clampAuthoredCameraPointHeight(+values['position.y'],draft.position.y);
  if(Number.isFinite(+values['position.z']))draft.position.z=+values['position.z'];
  if(Number.isFinite(+values.yaw))draft.key.yaw=+values.yaw;if(Number.isFinite(+values.pitch))draft.key.pitch=+values.pitch;
  if(Number.isFinite(+values.fov))draft.key.fov=Math.max(10,Math.min(110,+values.fov));
  cameraTimelinePendingOwners.add(draft.ownerKey);applyUnifiedCameraDraftToRuntime();updatePreviewKeyControls();return true;
}
globalThis.clearUnifiedCameraDraft=clearUnifiedCameraDraft;
globalThis.cancelUnifiedCameraDraft=cancelUnifiedCameraDraft;
globalThis.applyUnifiedCameraDraftToRuntime=applyUnifiedCameraDraftToRuntime;
function currentUnifiedCameraPose(){
  const s=curShot();if(!s)return null;
  const draft=currentUnifiedCameraDraftPose();if(draft)return {position:draft.position.clone(),key:Object.assign({},draft.key)};
  const position=shotCam.position.clone();position.y=clampAuthoredCameraPointHeight(position.y,s.camPts?.[0]?.y);
  const rotation=shotCam.rotation,yaw=rotation.y*180/Math.PI,pitch=rotation.x*180/Math.PI;
  return {position,key:{yaw:Number.isFinite(yaw)?yaw:0,pitch:Number.isFinite(pitch)?pitch:0,fov:Math.max(10,Math.min(110,+shotCam.fov||+s.fov||40))}};
}
function refreshUnifiedCameraTimeline(index,statusKey,details={}){
  const s=curShot();if(!s)return;
  clearPointPreview();clock.pause();playAllMode=false;clock.seek(Math.max(0,+ensureCamTimes(s)[index]||0));
  selCamPt=index;previewCamPt=index;motionSelected={type:'camera',label:PreVisionI18n.t('timeline.group.camera'),index};
  motionSelection.clear();motionSelection.add(motionKeyId(motionTrack('camera',''),index));
  cameraPositionCommandSelection={sceneIndex:sceneIdx,shotIndex:shotIdx,domain:'legacy-camera-position',indices:new Set([index])};
  updateActors();updateShotCam();refreshCamPtUI();refreshTimingUI();refreshMotionTimeline();rebuildViz();updateScrub();updateMotionPlayhead();updatePlayBtn();updateMonitor();updatePrompt();scheduleThumbs();
  const status=$('motionStatus');if(status&&statusKey)status.textContent=PreVisionI18n.t(statusKey,details);
}
function recordUnifiedCameraKeyframe(source='manual'){
  if(automaticCaptureMutationBlocked())return {ok:false,reason:'captureBlocked'};
  const s=curShot(),pose=currentUnifiedCameraPose();if(!s||!pose)return {ok:false,reason:'invalidShot'};
  const points=s.camPts,keys=ensureCamKeys(s),times=ensureCamTimes(s),aimTimes=ensureCamAimTimes(s),fovTimes=ensureCamFovTimes(s);
  if(!Array.isArray(points)||!points.length||[keys,times,aimTimes,fovTimes].some(track=>track.length!==points.length))return {ok:false,reason:'malformedCamera'};
  const at=Math.abs(time)<=PREVIEW_KEY_EPS?0:Math.max(0,Math.min(s.dur,+time||0));
  let index=times.findIndex(value=>Math.abs(value-at)<=PREVIEW_KEY_EPS),updated=index>=0;
  commitHistoryCapture();
  if(updated){
    points[index].copy(pose.position);keys[index]=Object.assign({},pose.key);times[index]=at;aimTimes[index]=at;fovTimes[index]=at;
  }else{
    index=times.findIndex(value=>value>at);if(index<0)index=times.length;
    points.splice(index,0,pose.position);keys.splice(index,0,Object.assign({},pose.key));times.splice(index,0,at);aimTimes.splice(index,0,at);fovTimes.splice(index,0,at);
  }
  times[0]=0;aimTimes.splice(0,aimTimes.length,...times);fovTimes.splice(0,fovTimes.length,...times);s.timingMode='custom';s.fov=pose.key.fov;
  ensureEaseArray(s,'camEase',Math.max(0,points.length-1));ensureEaseArray(s,'camAimEase',Math.max(0,points.length-1));ensureEaseArray(s,'camFovEase',Math.max(0,points.length-1));
  clearPreviewChannels(previewCameraOwnerKey(),['position.x','position.y','position.z','yaw','pitch','fov']);
  clearUnifiedCameraDraft();cameraTimelinePendingOwners.delete(previewCameraOwnerKey());queueHistoryCapture();markDirty();
  refreshUnifiedCameraTimeline(index,updated?'timeline.key.cameraUpdated':'timeline.key.cameraRecorded',{time:at.toFixed(2)});
  return {ok:true,index,time:at,updated,source};
}
function clearUnifiedCameraAnimation(){
  if(automaticCaptureMutationBlocked())return {ok:false,reason:'captureBlocked'};
  const s=curShot();if(!s?.camPts?.length)return {ok:false,reason:'invalidShot'};
  const keys=ensureCamKeys(s),firstPoint=s.camPts[0].clone(),firstKey=Object.assign({},keys[0]);
  commitHistoryCapture();s.camPts.splice(0,s.camPts.length,firstPoint);s.camKeys.splice(0,s.camKeys.length,firstKey);
  s.camTimes=[0];s.camAimTimes=[0];s.camFovTimes=[0];s.camEase=[];s.camAimEase=[];s.camFovEase=[];s.timingMode='custom';
  clearPreviewChannels(previewCameraOwnerKey(),['position.x','position.y','position.z','yaw','pitch','fov']);
  cameraTimelinePendingOwners.delete(previewCameraOwnerKey());queueHistoryCapture();markDirty();
  refreshUnifiedCameraTimeline(0,'timeline.clear.success');return {ok:true};
}
function updatePreviewKeyControls(){
  const add=$('motionAddKey'),auto=$('motionAutoKey'),snap=$('motionSnap'),advanced=$('motionAdvanced'),scope=$('motionTimeScope'),count=Array.from(previewPendingEdits.values()).reduce((sum,set)=>sum+set.size,0)+cameraTimelinePendingOwners.size;
  if(add){add.classList.toggle('pending',count>0);add.disabled=!curShot();add.title=PreVisionI18n.t(count?'timeline.key.pending':'timeline.key.addTitle');}
  if(auto){auto.setAttribute('aria-pressed',previewAutoKey?'true':'false');auto.title=PreVisionI18n.t(previewAutoKey?'timeline.auto.on':'timeline.auto.off');}
  if(snap){snap.setAttribute('aria-pressed',motionSnapEnabled?'true':'false');snap.textContent=PreVisionI18n.t('timeline.snap.label');snap.title=PreVisionI18n.t('timeline.snap.title');}
  if(advanced){advanced.setAttribute('aria-expanded',motionAdvancedOpen?'true':'false');advanced.setAttribute('aria-pressed',motionAdvancedOpen?'true':'false');advanced.title=PreVisionI18n.t(motionAdvancedOpen?'timeline.advanced.hide':'timeline.advanced.show');}
  if(scope){scope.setAttribute('aria-pressed',motionSceneGlobal?'true':'false');scope.textContent=PreVisionI18n.t(motionSceneGlobal?'timeline.scope.global':'timeline.scope.shot');scope.title=PreVisionI18n.t(motionSceneGlobal?'timeline.scope.showShot':'timeline.scope.showGlobal');}
}
function notePreviewEdit(ownerKey,channelIds){
  if(automaticCaptureMutationBlocked())return false;
  if(!ownerKey)return;
  const descriptor=previewOwnerDescriptor(ownerKey);
  if(descriptor?.type==='camera'){cameraTimelinePendingOwners.add(ownerKey);updatePreviewKeyControls();return true;}
  const state=previewOwnerState(ownerKey,true),pending=previewPendingEdits.get(ownerKey)||new Map();
  const entries=Array.isArray(channelIds)?channelIds.map(channelId=>[channelId,previewReadValue(ownerKey,channelId)]):Object.entries(channelIds||{});
  const autoChannels=previewAutoKey?(previewAutoChannels.get(ownerKey)||new Set()):null;
  entries.forEach(([channelId,rawValue])=>{const value=+rawValue;if(Number.isFinite(value)){pending.set(channelId,value);state.base[channelId]=value;if(autoChannels)autoChannels.add(channelId);}});
  if(pending.size){previewPendingEdits.set(ownerKey,pending);if(previewAutoKey&&autoChannels.size){previewAutoChannels.set(ownerKey,autoChannels);previewAutoTransactions.add(ownerKey);if(historyTimer){clearTimeout(historyTimer);historyTimer=null;historyPending=true;}}}updatePreviewKeyControls();
}
function commitPendingPreviewKeys(source='manual',onlyOwnerKey='',queueHistory=true,channelFilter=null){
  if(automaticCaptureMutationBlocked())return false;
  let count=0;
  const cameraOwner=previewCameraOwnerKey(),includeCamera=!onlyOwnerKey||onlyOwnerKey===cameraOwner;
  if(includeCamera){const recorded=recordUnifiedCameraKeyframe(source);if(recorded.ok)count++;}
  const ownerKeys=(onlyOwnerKey?[onlyOwnerKey]:Array.from(previewPendingEdits.keys())).filter(ownerKey=>{const descriptor=previewOwnerDescriptor(ownerKey);return !!descriptor&&descriptor.type==='actor';});
  ownerKeys.forEach(ownerKey=>{
    const pending=previewPendingEdits.get(ownerKey);if(!pending?.size)return;const allowed=channelFilter instanceof Set?channelFilter:null,entries=Array.from(pending.entries()).filter(([channelId])=>!allowed||allowed.has(channelId)),values=Object.fromEntries(entries);if(!entries.length)return;
    if(recordPreviewKeyGroup(ownerKey,values,previewOwnerTime(ownerKey),source)){count+=entries.length;entries.forEach(([channelId])=>pending.delete(channelId));if(!pending.size)previewPendingEdits.delete(ownerKey);motionExpandedGroups.add(ownerKey);}
  });
  updatePreviewKeyControls();
  if(count){if(queueHistory)queueHistoryCapture();refreshMotionTimeline();$('motionStatus').textContent=PreVisionI18n.t('timeline.key.recorded',{count});}
  else if(!onlyOwnerKey)$('motionStatus').textContent=PreVisionI18n.t('timeline.key.noPending');
  return count;
}
function finishPreviewEdit(ownerKey){
  if(automaticCaptureMutationBlocked())return false;
  if(previewOwnerDescriptor(ownerKey)?.type==='camera'){
    if(!cameraTimelinePendingOwners.has(ownerKey))return 0;
    if(!previewAutoKey)return 0;
    return recordUnifiedCameraKeyframe('auto').ok?1:0;
  }
  if(!previewAutoKey||!previewAutoTransactions.has(ownerKey))return 0;
  const channels=previewAutoChannels.get(ownerKey)||new Set(),count=commitPendingPreviewKeys('auto',ownerKey,false,channels);previewAutoChannels.delete(ownerKey);previewAutoTransactions.delete(ownerKey);
  if(count){queueHistoryCapture();commitHistoryCapture();}
  return count;
}
function motionKeyId(track,index){return `${track.type}|${track.label}|${index}`;}
function cameraPositionSelectionIsCurrent(){
  return !!cameraPositionCommandSelection&&cameraPositionCommandSelection.sceneIndex===sceneIdx&&cameraPositionCommandSelection.shotIndex===shotIdx&&cameraPositionCommandSelection.domain==='legacy-camera-position';
}
function clearTimelineCameraPositionSelection(clearMotion=false){
  cameraPositionCommandSelection=null;if(clearMotion)motionSelection.clear();
}
function setTimelineCameraPositionSelection(track,index,additive=false){
  if(!cameraPositionSelectionIsCurrent())cameraPositionCommandSelection={sceneIndex:sceneIdx,shotIndex:shotIdx,domain:'legacy-camera-position',indices:new Set()};
  const indices=cameraPositionCommandSelection.indices,id=motionKeyId(track,index);
  if(additive&&indices.has(index)){indices.delete(index);motionSelection.delete(id);}
  else{
    if(!additive){indices.clear();motionSelection.clear();}
    indices.add(index);motionSelection.add(id);
  }
  if(!indices.size)clearTimelineCameraPositionSelection();
}
function currentCameraPositionCommandIndices(){
  if(!cameraPositionSelectionIsCurrent()){clearTimelineCameraPositionSelection();return [];}
  return Array.from(cameraPositionCommandSelection.indices).sort((a,b)=>a-b);
}
globalThis.clearTimelineCameraPositionSelection=clearTimelineCameraPositionSelection;
function motionTrack(type,label){
  if(type==='camera'||type==='cameraAim'||type==='cameraFov'){
    const s=curShot();if(!s)return null;
    if(type==='cameraAim')return {type,label:PreVisionI18n.t('timeline.channel.aim'),owner:s,points:ensureCamKeys(s),times:ensureCamAimTimes(s),ease:ensureEaseArray(s,'camAimEase',Math.max(0,s.camPts.length-1)),easeKey:'camAimEase',offset:shotStart(shotIdx),min:0,max:s.dur,color:'#F28B50',sub:true,disabled:!!$('yaw')?.disabled};
    if(type==='cameraFov')return {type,label:PreVisionI18n.t('timeline.channel.fov'),owner:s,points:ensureCamKeys(s),times:ensureCamFovTimes(s),ease:ensureEaseArray(s,'camFovEase',Math.max(0,s.camPts.length-1)),easeKey:'camFovEase',offset:shotStart(shotIdx),min:0,max:s.dur,color:'#D06CE6',sub:true};
    return {type,label:PreVisionI18n.t('timeline.channel.position'),owner:s,points:s.camPts,times:ensureCamTimes(s),ease:ensureEaseArray(s,'camEase',Math.max(0,s.camPts.length-1)),easeKey:'camEase',offset:shotStart(shotIdx),min:0,max:s.dur,color:'#E5484D'};
  }
  const a=pathOwner(actorByLabel(label));if(!a)return null;
  return {type:'actor',label:a.label,owner:a,points:a.pathPts,times:ensureActorTimes(a),ease:ensureEaseArray(a,'pathEase',Math.max(0,a.pathPts.length-1)),easeKey:'pathEase',offset:0,min:0,max:sceneDur(),color:MOTION_COLORS[1+Math.max(0,effectiveActorPaths().indexOf(a))%(MOTION_COLORS.length-1)]};
}
function motionTimelineDuration(){return Math.max(.1,motionSceneGlobal?sceneDur():(curShot()?.dur||0));}
function motionTrackDisplayOffset(track){if(!track)return 0;return motionSceneGlobal?track.offset:(track.type.startsWith('camera')?0:track.offset);}
function setCustomTrackTiming(track){
  if(automaticCaptureMutationBlocked())return false;
  if(track.type.startsWith('camera'))track.owner.timingMode='custom';
  else shots.forEach(s=>{if(pathOwner(actorByLabel(s.syncActor))===track.owner)s.timingMode='custom';});
}
function synchronizeUnifiedCameraTimes(shot,sourceTimes){
  const times=sourceTimes.slice();times[0]=0;
  ensureCamTimes(shot).splice(0,shot.camTimes.length,...times);
  ensureCamAimTimes(shot).splice(0,shot.camAimTimes.length,...times);
  ensureCamFovTimes(shot).splice(0,shot.camFovTimes.length,...times);
  return times;
}
function updateMotionPlayhead(){
  const rows=$('motionRows'),ph=$('motionPlayhead'),dur=motionTimelineDuration();if(!rows||!ph||!dur)return;
  const laneEl=rows.querySelector('.motion-lane'),rowsRect=rows.getBoundingClientRect(),laneRect=laneEl?.getBoundingClientRect();
  const label=laneRect?Math.max(0,laneRect.left-rowsRect.left):parseFloat(getComputedStyle(rows).getPropertyValue('--track-label'))||160;
  const lane=Math.max(1,laneRect?.width||rows.clientWidth-label),value=motionSceneGlobal?shotStart(shotIdx)+Math.min(time,curShot()?.dur||0):Math.min(time,curShot()?.dur||0),f=Math.max(0,Math.min(1,value/dur));
  ph.style.left=(label+lane*f)+'px';ph.setAttribute('aria-valuemin','0');ph.setAttribute('aria-valuemax',dur.toFixed(2));ph.setAttribute('aria-valuenow',value.toFixed(2));
}
function scrubSceneTime(seconds,finalize=false){
  if(automaticCaptureMutationBlocked())return false;
  if(!shots.length)return;
  seconds=Math.max(0,Math.min(sceneDur(),seconds));let acc=0,idx=shots.length-1,local=shots[idx].dur;
  for(let i=0;i<shots.length;i++){if(seconds<=acc+shots[i].dur||i===shots.length-1){idx=i;local=seconds-acc;break;}acc+=shots[i].dur;}
  const changed=idx!==shotIdx;if(changed)clearTimelineCameraPositionSelection(true);shotIdx=idx;clock.seek(Math.max(0,Math.min(shots[idx].dur,local)));clock.pause();playAllMode=false;clearPointPreview();updatePlayBtn();
  if(changed){refreshSceneRail();refreshShotPanel();rebuildViz();}
  updateActors();updateShotCam();updateScrub();updateMonitor();
  if(finalize||changed)refreshMotionTimeline();else updateMotionPlayhead();
}
function seekSceneTime(seconds){return scrubSceneTime(seconds,true);}
function scrubMotionTimelineTime(seconds,finalize=false){
  if(motionSceneGlobal)return scrubSceneTime(seconds,finalize);
  if(automaticCaptureMutationBlocked()||!curShot())return false;
  clock.seek(Math.max(0,Math.min(curShot().dur,seconds)));clock.pause();playAllMode=false;clearPointPreview();updatePlayBtn();
  updateActors();updateShotCam();updateScrub();updateMonitor();
  if(finalize)refreshMotionTimeline();else updateMotionPlayhead();
  return true;
}
function previewChannelLabel(channelId){
  const keys={
    'position.x':'timeline.channel.positionX','position.y':'timeline.channel.positionY','position.z':'timeline.channel.positionZ',
    elevation:'timeline.channel.elevation','rotation.y':'timeline.channel.rotationY',scale:'timeline.channel.scale',
    yaw:'timeline.channel.yaw',pitch:'timeline.channel.pitch',fov:'timeline.channel.fov'
  };
  if(keys[channelId])return PreVisionI18n.t(keys[channelId]);
  if(channelId.startsWith('joint.')){
    const jointKey=channelId.slice(6);
    if(jointKey==='bodyY')return PreVisionI18n.t('timeline.channel.bodyVertical');
    if(jointKey==='bodyRotX')return PreVisionI18n.t('timeline.channel.bodyRotation');
    const def=typeof JOINT_DEFS!=='undefined'?JOINT_DEFS.find(item=>item.k===jointKey||item.b?.k===jointKey):null;
    if(!def)return PreVisionI18n.t('timeline.channel.joint',{name:jointKey});
    const axisKey=def.k===jointKey?def.axisKey:def.b?.axisKey;
    return PreVisionI18n.t('timeline.channel.jointAxis',{name:PreVisionI18n.t(def.labelKey),axis:PreVisionI18n.t(axisKey)});
  }
  return channelId;
}
function motionGroupDescriptors(){
  const groups=[],cameraKey=previewCameraOwnerKey(shotIdx);
  groups.push({ownerKey:cameraKey,label:`${PreVisionI18n.t('timeline.group.camera')} · C${shotIdx+1}`,color:'#E5484D',
    legacy:[motionTrack('camera',''),motionTrack('cameraAim',''),motionTrack('cameraFov','')].filter(Boolean)});
  actors.forEach((actor,index)=>{
    if(actor.kind==='desert')return;
    const ownerKey=previewActorOwnerKey(actor),color=MOTION_COLORS[1+index%(MOTION_COLORS.length-1)],legacy=[];
    if(pathOwner(actor)===actor&&actor.pathPts.length)legacy.push(motionTrack('actor',actor.label));
    groups.push({ownerKey,label:`${PreVisionI18n.t('timeline.group.object')} · ${actor.label}`,color,legacy:legacy.filter(Boolean)});
  });
  groups.forEach(group=>{if(!motionKnownGroups.has(group.ownerKey)){motionKnownGroups.add(group.ownerKey);motionExpandedGroups.add(group.ownerKey);}});
  motionGroupsInitialized=true;return groups;
}
function previewSupportedChannels(group,state){
  const descriptor=previewOwnerDescriptor(group.ownerKey),channels=[];
  if(descriptor?.type==='camera')return [];
  if(descriptor?.type==='actor'){
    if(!descriptor.owner.mount)channels.push('position.x','position.z','rotation.y');
    channels.push('elevation','scale');
    if(descriptor.owner.kind==='char'&&descriptor.owner===selected)animatableJointKeys().forEach(key=>channels.push('joint.'+key));
  }
  const hidden=descriptor?.type==='actor'&&descriptor.owner.mount?new Set(['position.x','position.z','rotation.y']):null;
  Object.keys(state?.channels||{}).forEach(channelId=>{if(!hidden?.has(channelId))channels.push(channelId);});
  return [...new Set(channels)];
}
function makeMotionLabel(className,color,text){
  const label=document.createElement('div');label.className=className;label.style.setProperty('--track-color',color);
  const dot=document.createElement('i');const span=document.createElement('span');span.textContent=text;label.appendChild(dot);label.appendChild(span);return label;
}
function appendMotionSegments(lane,times,eases,dur){
  times.slice(0,-1).forEach((start,index)=>{
    const end=times[index+1];if(!Number.isFinite(start)||!Number.isFinite(end)||end<=start)return;
    const segment=document.createElement('span');segment.className='motion-segment';segment.setAttribute('aria-hidden','true');
    segment.dataset.segment=String(index);segment.dataset.ease=normalizeEaseSpec(eases?.[index]||'linear').type;
    segment.style.left=(start/dur*100)+'%';segment.style.width=((end-start)/dur*100)+'%';lane.appendChild(segment);
  });
}
function createLegacyMotionRow(track,dur,displayOffset=track.offset){
  const globals=track.times.map(value=>value+displayOffset),start=globals[0]??displayOffset,end=globals[globals.length-1]??displayOffset;
  const row=document.createElement('div');row.className='motion-row motion-channel-row'+(motionSelected.type===track.type&&motionSelected.label===track.label?' sel':'')+(track.disabled?' disabled':'');
  row.style.setProperty('--track-color',track.color);row.dataset.type=track.type;row.dataset.label=track.label;row.dataset.legacy='true';row.dataset.trackRole='channel';
  const label=makeMotionLabel('motion-label motion-channel-name',track.color,track.unifiedCamera?PreVisionI18n.t('timeline.group.camera'):(track.type==='actor'?PreVisionI18n.t('timeline.channel.path'):track.label));
  const lane=document.createElement('div');lane.className='motion-lane';
  const clip=document.createElement('div');clip.className='motion-clip';clip.style.left=(start/dur*100)+'%';clip.style.width=(Math.max(.2,(end-start)/dur*100))+'%';
  const grip=document.createElement('button');grip.className='motion-clip-grip';grip.dataset.role='clip';grip.style.left=((start+end)/2/dur*100)+'%';grip.textContent='↔';grip.title=PreVisionI18n.t('timeline.clip.dragGrip');grip.setAttribute('aria-label',grip.title);
  lane.appendChild(clip);appendMotionSegments(lane,globals,track.ease,dur);lane.appendChild(grip);
  globals.forEach((globalTime,index)=>{
    const selectable=track.type==='camera',key=document.createElement(selectable?'button':'span');
    const selected=selectable
      ?cameraPositionSelectionIsCurrent()&&cameraPositionCommandSelection.indices.has(index)
      :motionSelection.has(motionKeyId(track,index))||(motionSelected.type===track.type&&motionSelected.label===track.label&&motionSelected.index===index);
    key.className='motion-key'+(index===0?' first foundation':'')+(index===globals.length-1?' last':'')+(selected?' sel':'');
    if(selectable){
      key.type='button';key.setAttribute('aria-label',PreVisionI18n.t(index===0?'timeline.key.cameraFoundationAria':'timeline.key.cameraPositionAria',{index:index+1,time:globalTime.toFixed(2)}));
      key.setAttribute('aria-pressed',selected?'true':'false');if(index===0)key.dataset.foundation='true';
    }
    key.dataset.role='key';key.dataset.index=String(index);key.style.left=(globalTime/dur*100)+'%';key.title=PreVisionI18n.t(index===0?'timeline.key.foundationTitle':'timeline.key.pointTitle',{index:index+1,time:globalTime.toFixed(2)});lane.appendChild(key);
  });
  row.appendChild(label);row.appendChild(lane);return row;
}
function createUnifiedCameraDetailRow(channelId,label,color,times,eases,dur,offset){
  const row=document.createElement('div');row.className='motion-row motion-channel-row motion-camera-detail';row.style.setProperty('--track-color',color);row.dataset.trackRole='camera-detail';
  row.dataset.detailChannel=channelId;
  const name=makeMotionLabel('motion-label motion-channel-name',color,label),lane=document.createElement('div');lane.className='motion-lane',globals=times.map(value=>value+offset);
  appendMotionSegments(lane,globals,eases,dur);
  globals.forEach((globalTime,index)=>{
    const key=document.createElement('span');key.className='motion-key'+(index===0?' first foundation':'');key.setAttribute('aria-hidden','true');
    key.style.left=(globalTime/dur*100)+'%';key.title=PreVisionI18n.t(index===0?'timeline.key.foundationTitle':'timeline.key.pointTitle',{index:index+1,time:globalTime.toFixed(2)});lane.appendChild(key);
  });
  row.appendChild(name);row.appendChild(lane);return row;
}
function createPreviewChannelRow(group,channelId,state,dur){
  const row=document.createElement('div');row.className='motion-row motion-channel-row'+(previewSortedKeys(state,channelId).length?'':' empty');row.style.setProperty('--track-color',group.color);
  row.dataset.previewOwner=group.ownerKey;row.dataset.channel=channelId;row.dataset.channelId=channelId;row.dataset.trackRole='channel';
  const label=makeMotionLabel('motion-label motion-channel-name',group.color,previewChannelLabel(channelId)),lane=document.createElement('div');lane.className='motion-lane';
  const offset=previewOwnerOffset(group.ownerKey),keys=previewSortedKeys(state,channelId);
  appendMotionSegments(lane,keys.map(item=>item.time+offset),keys.map(item=>item.ease),dur);
  keys.forEach((item,index)=>{
    const globalTime=item.time+offset,key=document.createElement('span');key.className='motion-key'+(previewMotionSelection.keyId===item.id?' sel':'');
    key.dataset.role='preview-key';key.dataset.keyId=item.id;key.style.left=(globalTime/dur*100)+'%';key.title=PreVisionI18n.t('timeline.key.pointTitle',{index:index+1,time:globalTime.toFixed(2)});lane.appendChild(key);
  });
  row.appendChild(label);row.appendChild(lane);return row;
}
function createMotionGroupRow(group,state,dur){
  const expanded=motionExpandedGroups.has(group.ownerKey),row=document.createElement('div');row.className='motion-row motion-group-row';row.style.setProperty('--track-color',group.color);
  row.dataset.previewOwner=group.ownerKey;row.dataset.trackRole='group';row.setAttribute('aria-expanded',expanded?'true':'false');
  const label=document.createElement('div');label.className='motion-label motion-group-label';const toggle=document.createElement('button');toggle.className='motion-group-toggle';toggle.dataset.role='group-toggle';toggle.setAttribute('aria-expanded',expanded?'true':'false');
  toggle.title=PreVisionI18n.t(expanded?'timeline.group.collapse':'timeline.group.expand');toggle.setAttribute('aria-label',toggle.title);
  const dot=document.createElement('i'),name=document.createElement('span');name.textContent=group.label;label.appendChild(toggle);label.appendChild(dot);label.appendChild(name);
  const lane=document.createElement('div');lane.className='motion-lane';const offset=previewOwnerOffset(group.ownerKey);
  (state?.groups||[]).forEach((item,index)=>{
    const range=previewGroupRange(state,item.id);if(!range)return;const start=(range.start+offset)/dur*100,end=(range.end+offset)/dur*100,anchor=(item.time+offset)/dur*100;
    const span=document.createElement('span');span.className='motion-group-span';span.dataset.groupId=item.id;span.style.left=start+'%';span.style.width=Math.max(.18,end-start)+'%';
    const key=document.createElement('span');key.className='motion-group-key'+(end-start>.15?' split':'');key.dataset.role='preview-group';key.dataset.groupId=item.id;key.style.left=anchor+'%';
    key.title=PreVisionI18n.t('timeline.key.pointTitle',{index:index+1,time:(item.time+offset).toFixed(2)});lane.appendChild(span);lane.appendChild(key);
  });
  row.appendChild(label);row.appendChild(lane);return row;
}
function refreshMotionTimeline(){
  const panel=$('motionPanel'),ruler=$('motionRuler'),rows=$('motionRows');if(!panel||!ruler||!rows)return;
  const dur=motionTimelineDuration(),open=panel.classList.contains('open');
  panel.style.setProperty('--timeline-minor-step',(MOTION_TIME_STEP/dur*100)+'%');panel.style.setProperty('--timeline-half-step',(MOTION_MAGNET_STEP/dur*100)+'%');
  $('motionToggle')?.classList.toggle('on',open);
  ruler.innerHTML='';
  const rulerWidth=Math.max(1,ruler.clientWidth||ruler.getBoundingClientRect?.().width||800),pixelsPerSecond=rulerWidth/dur,halfLabelStride=Math.max(1,Math.ceil(34/Math.max(1,pixelsPerSecond*MOTION_MAGNET_STEP))),lastTenth=Math.floor(dur*10+1e-7);
  for(let tenth=0;tenth<=lastTenth;tenth++){
    const at=tenth/10,left=at/dur*100,major=tenth%10===0,half=tenth%5===0,mark=document.createElement('i');
    mark.className='motion-ruler-mark'+(major?' major':half?' half':'');mark.style.left=left+'%';mark.setAttribute('aria-hidden','true');ruler.appendChild(mark);
    if(half&&(major||(tenth/5)%halfLabelStride===0)){const label=document.createElement('span');label.className='motion-tick'+(major?' major':' half');label.style.left=left+'%';label.textContent=at.toFixed(1)+'s';ruler.appendChild(label);}
  }
  if(!motionSceneGlobal){const end=document.createElement('span');end.className='motion-shot-end-label';end.textContent=PreVisionI18n.t('timeline.scope.shotEnd');end.title=end.textContent;ruler.appendChild(end);}
  clearMotionSnapFeedback();rows.innerHTML='';const playhead=document.createElement('div');playhead.id='motionPlayhead';playhead.setAttribute('role','slider');playhead.setAttribute('aria-label',PreVisionI18n.t('timeline.ruler.scrub'));rows.appendChild(playhead);
  const snapGuide=document.createElement('div');snapGuide.id='motionSnapGuide';snapGuide.className='motion-snap-guide';snapGuide.hidden=true;snapGuide.setAttribute('aria-hidden','true');rows.appendChild(snapGuide);
  if(!motionSceneGlobal){const end=document.createElement('div');end.className='motion-shot-end-line';end.setAttribute('aria-hidden','true');rows.appendChild(end);}
  const cameraTrack=motionTrack('camera','');
  const cameraOffset=motionTrackDisplayOffset(cameraTrack);
  if(cameraTrack)rows.appendChild(createLegacyMotionRow(Object.assign({},cameraTrack,{unifiedCamera:true}),dur,cameraOffset));
  if(motionAdvancedOpen&&cameraTrack){
    const s=cameraTrack.owner,offset=cameraOffset,times=ensureCamTimes(s),aimTimes=ensureCamAimTimes(s),fovTimes=ensureCamFovTimes(s);
    ['positionX','positionY','positionZ'].forEach((channel,index)=>rows.appendChild(createUnifiedCameraDetailRow(
      channel,PreVisionI18n.t(`timeline.channel.${channel}`),['#E5484D','#F2B84B','#58A6FF'][index],times,s.camEase,dur,offset)));
    rows.appendChild(createUnifiedCameraDetailRow('aim',PreVisionI18n.t('timeline.channel.aim'),'#F28B50',aimTimes,s.camAimEase,dur,offset));
    rows.appendChild(createUnifiedCameraDetailRow('fov',PreVisionI18n.t('timeline.channel.fov'),'#D06CE6',fovTimes,s.camFovEase,dur,offset));
  }
  if(motionSceneGlobal){
    motionGroupDescriptors().forEach(group=>{
      if(previewOwnerDescriptor(group.ownerKey)?.type!=='actor')return;
      const state=previewOwnerState(group.ownerKey);rows.appendChild(createMotionGroupRow(group,state,dur));
      if(!motionExpandedGroups.has(group.ownerKey))return;
      group.legacy.forEach(track=>rows.appendChild(createLegacyMotionRow(track,dur,motionTrackDisplayOffset(track))));
      previewSupportedChannels(group,state).forEach(channelId=>rows.appendChild(createPreviewChannelRow(group,channelId,state,dur)));
    });
  }
  updateMotionPlayhead();refreshMotionInspector();updatePreviewKeyControls();
}
function motionRowLaneChildren(row){
  const hasClass=(node,name)=>node?.classList?.contains(name)||String(node?.className||'').split(/\s+/).includes(name);
  const lane=Array.from(row?.children||[]).find(child=>hasClass(child,'motion-lane'));
  return {hasClass,children:Array.from(lane?.children||[])};
}
function updatePreviewMotionPositions(ownerKey){
  const rows=$('motionRows'),state=previewOwnerState(ownerKey);if(!rows||!state)return;
  const dur=Math.max(.1,sceneDur()),offset=previewOwnerOffset(ownerKey);
  Array.from(rows.children||[]).forEach(row=>{
    if(row.dataset?.previewOwner!==ownerKey)return;
    const lane=motionRowLaneChildren(row);
    if(row.dataset.trackRole==='group'){
      lane.children.filter(key=>lane.hasClass(key,'motion-group-key')).forEach(key=>{const group=state.groups.find(item=>item.id===key.dataset.groupId);if(group)key.style.left=((group.time+offset)/dur*100)+'%';});
      lane.children.filter(span=>lane.hasClass(span,'motion-group-span')).forEach(span=>{const range=previewGroupRange(state,span.dataset.groupId);if(!range)return;const start=(range.start+offset)/dur*100,end=(range.end+offset)/dur*100;span.style.left=start+'%';span.style.width=Math.max(.18,end-start)+'%';});
    }else if(row.dataset.channel){
      const keys=previewSortedKeys(state,row.dataset.channel);
      lane.children.filter(segment=>lane.hasClass(segment,'motion-segment')).forEach((segment,index)=>{
        const start=keys[index],end=keys[index+1];if(!start||!end)return;
        segment.dataset.ease=normalizeEaseSpec(start.ease||'linear').type;
        segment.style.left=((start.time+offset)/dur*100)+'%';
        segment.style.width=(Math.max(0,end.time-start.time)/dur*100)+'%';
      });
      lane.children.filter(key=>lane.hasClass(key,'motion-key')&&key.dataset.keyId).forEach(key=>{const item=keys.find(candidate=>candidate.id===key.dataset.keyId);if(item)key.style.left=((item.time+offset)/dur*100)+'%';});
    }
  });
}
function selectMotionKey(track,index,seek=true,render=true){
  index=Math.max(0,Math.min(track.points.length-1,index));motionSelected={type:track.type,label:track.label,index};
  if(track.type.startsWith('camera')){selCamPt=index;select(null,true);refreshCamPtUI();}
  else{select(track.owner,true);selActorPt=index;refreshActorPathUI();}
  if(seek)seekSceneTime(track.times[index]+track.offset);else if(render)refreshMotionTimeline();
  rebuildViz();
}
function cameraPositionDeleteFeedback(reason,details={}){
  const keys={
    minimumPoint:'timeline.delete.keepOne',invalidSelection:'timeline.delete.invalidSelection',stalePlan:'timeline.delete.invalidSelection',
    foundationFrame:'timeline.delete.foundation',malformedCamera:'timeline.delete.malformedCamera',
    pointSyncMismatch:'timeline.delete.pointSyncMismatch',cameraNodesMismatch:'timeline.delete.cameraNodesMismatch'
  };
  const message=PreVisionI18n.t(keys[reason]||'timeline.delete.invalidSelection',details),status=$('motionStatus'),saveState=$('saveState');
  if(status)status.textContent=message;if(saveState)saveState.textContent=message;return message;
}
function executeCameraPositionPointDeletion(indices){
  if(automaticCaptureMutationBlocked())return {ok:false,reason:'captureBlocked'};
  const s=curShot();if(!s){cameraPositionDeleteFeedback('invalidSelection');return {ok:false,reason:'invalidSelection'};}
  if(indices.some(index=>index===0)){const rejected={ok:false,reason:'foundationFrame'};cameraPositionDeleteFeedback(rejected.reason);return rejected;}
  const pointSyncExpected=s.timingMode==='pointSync'&&!!s.syncActor,pointSyncActor=pointSyncExpected?pathOwner(actorByLabel(s.syncActor)):null;
  const linkedActors=[],seen=new Set();
  actors.forEach(actor=>{
    if(seen.has(actor)||(actor.timeLink!=='cameraNodes'&&actor.timeLink!=='cameraFollow')||(actor.timeLinkShot||0)!==shotIdx)return;
    seen.add(actor);linkedActors.push(actor);
  });
  const plan=planCameraPositionPointDeletion(s,indices,{pointSyncExpected,pointSyncActor,linkedActors,shotOffset:shotStart(shotIdx),sceneDuration:sceneDur()});
  if(!plan.ok){cameraPositionDeleteFeedback(plan.reason,plan);return plan;}
  commitHistoryCapture();
  const applied=applyCameraPositionPointDeletion(plan);
  if(!applied.ok){cameraPositionDeleteFeedback(applied.reason,applied);return applied;}
  const deletedTail=plan.indices.includes(plan.originalCount-1),nextIndex=deletedTail?Math.max(0,s.camPts.length-1):plan.nextIndex;
  clearPointPreview();clock.pause();playAllMode=false;clock.seek(Math.max(0,+s.camTimes[nextIndex]||0));
  previewCamPt=nextIndex;selCamPt=nextIndex;select(null,true);
  const label=PreVisionI18n.t('timeline.channel.position');
  motionSelected={type:'camera',label,index:nextIndex};motionSelection.clear();motionSelection.add(`camera|${label}|${nextIndex}`);
  cameraPositionCommandSelection={sceneIndex:sceneIdx,shotIndex:shotIdx,domain:'legacy-camera-position',indices:new Set([nextIndex])};
  updateActors();updateShotCam();refreshCamPtUI();refreshTimingUI();refreshMotionTimeline();rebuildViz();updateScrub();updateMotionPlayhead();updatePlayBtn();updateMonitor();updatePrompt();scheduleThumbs();markDirty();
  const status=$('motionStatus');if(status)status.textContent=PreVisionI18n.t('timeline.delete.success',{count:plan.indices.length});
  return Object.assign({ok:true},plan);
}
function routeTimelineDeleteCommand(){
  const indices=currentCameraPositionCommandIndices();
  if(!indices.length){cameraPositionDeleteFeedback('invalidSelection');return {owned:true,ok:false,reason:'invalidSelection'};}
  return Object.assign({owned:true},executeCameraPositionPointDeletion(indices));
}
function updateMotionRowPositions(row,track){
  if(!row||!track)return;const dur=motionTimelineDuration(),offset=motionTrackDisplayOffset(track),globals=track.times.map(v=>v+offset);
  const lane=motionRowLaneChildren(row),clip=lane.children.find(child=>lane.hasClass(child,'motion-clip')),
    grip=lane.children.find(child=>lane.hasClass(child,'motion-clip-grip'));
  if(clip){const start=globals[0]??track.offset,end=globals[globals.length-1]??track.offset;clip.style.left=(start/dur*100)+'%';clip.style.width=(Math.max(.2,(end-start)/dur*100))+'%';if(grip)grip.style.left=((start+end)/2/dur*100)+'%';}
  lane.children.filter(segment=>lane.hasClass(segment,'motion-segment')).forEach((segment,index)=>{
    const start=globals[index],end=globals[index+1];if(start===undefined||end===undefined)return;
    segment.dataset.ease=normalizeEaseSpec(track.ease?.[index]||'linear').type;
    segment.style.left=(start/dur*100)+'%';segment.style.width=(Math.max(0,end-start)/dur*100)+'%';
  });
  lane.children.filter(key=>lane.hasClass(key,'motion-key')).forEach((key,i)=>{if(globals[i]!==undefined){key.style.left=(globals[i]/dur*100)+'%';key.title=PreVisionI18n.t('timeline.key.pointTitle',{index:i+1,time:globals[i].toFixed(2)});}});
}
function currentMotionTrack(){return motionTrack(motionSelected.type,motionSelected.label);}
function currentMotionSegment(track=currentMotionTrack()){return !track||track.points.length<2?0:Math.max(0,Math.min(track.points.length-2,motionSelected.index));}
function applyActorTimeLink(a){
  if(automaticCaptureMutationBlocked())return false;
  if(!a||a.timeLink==='independent')return;const si=Math.max(0,Math.min(shots.length-1,a.timeLinkShot||0)),s=shots[si];if(!s)return;
  const base=ensureCamTimes(s),offset=shotStart(si)+(a.timeOffset||0);let times;
  if(a.timeLink==='cameraNodes'&&a.pathPts.length===base.length)times=base.map(t=>t+offset);
  else times=distributedPathTimes(a.pathPts,(base[0]||0)+offset,(base[base.length-1]||s.dur)+offset);
  a.pathTimes=repairPathTimes(a.pathPts,times,0,sceneDur());
}
function applyLinkedActorsForShot(si){actors.forEach(a=>{if(a.timeLink!=='independent'&&(a.timeLinkShot||0)===si)applyActorTimeLink(a);});}
function drawMotionCurve(){
  const c=$('motionCurve');if(!c)return;const ctx=c.getContext('2d'),track=currentMotionTrack(),seg=currentMotionSegment(track),spec=normalizeEaseSpec(track?.ease?.[seg]||'linear'),w=c.width,h=c.height,p=16;
  const token=(name,fallback)=>typeof getComputedStyle==='function'?(getComputedStyle(document.documentElement||document.body).getPropertyValue(name).trim()||fallback):fallback;
  ctx.clearRect(0,0,w,h);ctx.strokeStyle=token('--grid-major','#262a31');ctx.lineWidth=1;for(let i=0;i<=4;i++){const x=p+(w-2*p)*i/4,y=p+(h-2*p)*i/4;ctx.beginPath();ctx.moveTo(x,p);ctx.lineTo(x,h-p);ctx.stroke();ctx.beginPath();ctx.moveTo(p,y);ctx.lineTo(w-p,y);ctx.stroke();}
  ctx.strokeStyle=track?.color||'#E5484D';ctx.lineWidth=3;ctx.beginPath();for(let i=0;i<=60;i++){const x=i/60,y=applyEaseSpec(spec,x),px=p+x*(w-2*p),py=h-p-y*(h-2*p);if(i)ctx.lineTo(px,py);else ctx.moveTo(px,py);}ctx.stroke();
  if(spec.type==='custom'){const pts=[[spec.x1,spec.y1],[spec.x2,spec.y2]];ctx.strokeStyle=token('--tx2','#6f7785');ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(p,h-p);ctx.lineTo(p+spec.x1*(w-2*p),h-p-spec.y1*(h-2*p));ctx.moveTo(w-p,p);ctx.lineTo(p+spec.x2*(w-2*p),h-p-spec.y2*(h-2*p));ctx.stroke();pts.forEach(([x,y])=>{ctx.fillStyle=token('--key-selected','#fff');ctx.beginPath();ctx.arc(p+x*(w-2*p),h-p-y*(h-2*p),6,0,Math.PI*2);ctx.fill();});}
}
function refreshMotionInspector(){
  const track=currentMotionTrack(),seg=currentMotionSegment(track),ease=$('motionEase'),link=$('motionLink'),off=$('motionOffset'),status=$('motionStatus');if(!ease||!link||!off)return;
  ease.disabled=!track||track.points.length<2;ease.value=normalizeEaseSpec(track?.ease?.[seg]||'linear').type;
  const actor=track?.type==='actor'?track.owner:null;link.disabled=!actor;off.disabled=!actor||actor.timeLink==='independent';link.value=actor?.timeLink||'independent';off.value=(actor?.timeOffset||0).toFixed(1);
  const count=motionSelection.size||1;if(status)status.textContent=track?PreVisionI18n.t('timeline.status.segment',{track:track.label,segment:Math.min(seg+1,Math.max(1,track.points.length-1)),start:track.times[seg]?.toFixed(2)??'0.00',end:track.times[seg+1]?.toFixed(2)??'0.00',count}):PreVisionI18n.t('timeline.status.selectTrack');drawMotionCurve();
}
(function initMotionInspector(){
  const ease=$('motionEase'),link=$('motionLink'),off=$('motionOffset'),curve=$('motionCurve');if(!ease||!link||!off||!curve)return;
  ease.onchange=()=>{if(automaticCaptureMutationBlocked())return false;const tr=currentMotionTrack();if(!tr||tr.points.length<2)return;let segs=Array.from(motionSelection).map(id=>id.split('|')).filter(p=>p[0]===tr.type&&p[1]===tr.label).map(p=>Math.min(tr.points.length-2,+p[2]));if(!segs.length)segs=[currentMotionSegment(tr)];[...new Set(segs)].forEach(seg=>{const old=normalizeEaseSpec(tr.ease[seg]);tr.ease[seg]=ease.value==='custom'?(old.type==='custom'?old:{type:'custom',x1:.33,y1:0,x2:.67,y2:1}):{type:ease.value};});drawMotionCurve();updateActors();updateShotCam();markDirty();};
  link.onchange=()=>{if(automaticCaptureMutationBlocked())return false;const tr=currentMotionTrack();if(!tr||tr.type!=='actor')return;if(link.value==='cameraNodes'&&tr.points.length!==curShot().camPts.length){tr.owner.timeLink='independent';link.value='independent';$('motionStatus').textContent=PreVisionI18n.t('timeline.status.nodeMismatch',{label:tr.label,pathCount:tr.points.length,cameraCount:curShot().camPts.length});return;}tr.owner.timeLink=link.value;tr.owner.timeLinkShot=shotIdx;applyActorTimeLink(tr.owner);refreshMotionTimeline();updateActors();markDirty();};
  off.onchange=()=>{if(automaticCaptureMutationBlocked())return false;const tr=currentMotionTrack();if(!tr||tr.type!=='actor')return;tr.owner.timeOffset=Math.max(-30,Math.min(30,+off.value||0));applyActorTimeLink(tr.owner);refreshMotionTimeline();updateActors();markDirty();};
  let curveDragSession=null;
  const pos=e=>{const r=curve.getBoundingClientRect(),p=16/2,x=Math.max(0,Math.min(1,((e.clientX-r.left)/r.width*curve.width-16)/(curve.width-32))),y=Math.max(0,Math.min(1,1-(((e.clientY-r.top)/r.height*curve.height-16)/(curve.height-32))));return {x,y};};
  const finishCurveDrag=e=>{
    const session=curveDragSession;if(!session||!matchesActivePointer(e,session.pointerId))return;
    curveDragSession=null;window.removeEventListener('pointermove',moveCurveDrag);window.removeEventListener('pointerup',finishCurveDrag);window.removeEventListener('pointercancel',finishCurveDrag);window.removeEventListener('blur',finishCurveDrag);curve.removeEventListener('lostpointercapture',finishCurveDrag);
    try{curve.releasePointerCapture(session.pointerId);}catch(_e){}curve.style.cursor=session.cursor;if(JSON.stringify(session.spec)!==session.before)markDirty();
  };
  const moveCurveDrag=e=>{
    const session=curveDragSession;if(!session||!matchesActivePointer(e,session.pointerId))return;
    if(curve.isConnected===false||session.track.points.length<2||session.track.ease[session.segment]!==session.spec){finishCurveDrag(e);return;}
    const q=pos(e),s=session.spec;if(session.handle===0){s.x1=Math.min(q.x,s.x2-.01);s.y1=q.y;}else{s.x2=Math.max(q.x,s.x1+.01);s.y2=q.y;}
    drawMotionCurve();updateActors();updateShotCam();
  };
  curve.addEventListener('pointerdown',e=>{
    if(automaticCaptureMutationBlocked())return false;
    if(curveDragSession||(e.isPrimary!==undefined&&!e.isPrimary)||(e.button!==undefined&&e.button!==0))return;
    const tr=currentMotionTrack();if(!tr||tr.points.length<2)return;const seg=currentMotionSegment(tr);commitHistoryCapture();const before=JSON.stringify(normalizeEaseSpec(tr.ease[seg]));
    if(normalizeEaseSpec(tr.ease[seg]).type!=='custom'){tr.ease[seg]={type:'custom',x1:.33,y1:0,x2:.67,y2:1};ease.value='custom';}
    const s=tr.ease[seg],q=pos(e),pointerId=e.pointerId;curveDragSession={pointerId,handle:Math.hypot(q.x-s.x1,q.y-s.y1)<=Math.hypot(q.x-s.x2,q.y-s.y2)?0:1,track:tr,segment:seg,spec:s,before,cursor:curve.style.cursor||''};curve.style.cursor='grabbing';
    try{curve.setPointerCapture(pointerId);}catch(_e){}window.addEventListener('pointermove',moveCurveDrag);window.addEventListener('pointerup',finishCurveDrag);window.addEventListener('pointercancel',finishCurveDrag);window.addEventListener('blur',finishCurveDrag);curve.addEventListener('lostpointercapture',finishCurveDrag);
  });
})();

/* Shot thumbnails are timeline-owned and preserve the historical 180ms debounce. */
let thumbR=null, thumbTimer=null;
function scheduleThumbs(){ if(thumbTimer) clearTimeout(thumbTimer); thumbTimer=setTimeout(renderShotThumbs,180); }
function renderShotThumbs(){
  thumbTimer=null;
  const cvs=document.querySelectorAll('#scenelist canvas.shot-thumb');
  if(!cvs.length || !shots.length)return;
  if(!thumbR){thumbR=configureRenderer(new THREE.WebGLRenderer({canvas:document.createElement('canvas'),antialias:true,preserveDrawingBuffer:true}));thumbR.setSize(160,90,false);thumbR.setPixelRatio(1);}
  const saveT=time,saveI=shotIdx,saveP=playing;playing=false;setExportLook(true);shotCam.aspect=16/9;shotCam.updateProjectionMatrix();
  shots.forEach((s,i)=>{const cv=cvs[i];if(!cv)return;shotIdx=i;time=0;updateActors();updateShotCam();thumbR.render(scene,shotCam);const ctx=cv.getContext('2d');if(ctx&&ctx.drawImage)ctx.drawImage(thumbR.domElement,0,0,cv.width,cv.height);});
  setExportLook(false);shotIdx=saveI;time=saveT;playing=saveP;shotCam.aspect=aspectW/aspectH;shotCam.updateProjectionMatrix();updateActors();updateShotCam();
}
function copyMotionKeys(){
  const tr=currentMotionTrack();if(!tr)return false;let idx=Array.from(motionSelection).map(id=>id.split('|')).filter(p=>p[0]===tr.type&&p[1]===tr.label).map(p=>+p[2]).sort((a,b)=>a-b);if(!idx.length)idx=[motionSelected.index];idx=idx.filter(i=>i>=0&&i<tr.points.length);if(!idx.length)return false;
  const t0=tr.times[idx[0]];motionClipboard={type:tr.type,items:idx.map(i=>({dt:tr.times[i]-t0,point:tr.type==='actor'||tr.type==='camera'?tr.points[i].toArray():null,key:tr.type.startsWith('camera')?Object.assign({},ensureCamKeys(tr.owner)[i]):null}))};
  $('motionStatus').textContent=PreVisionI18n.t('timeline.status.copied',{count:idx.length,label:tr.label});return true;
}
function pasteMotionKeys(){
  if(automaticCaptureMutationBlocked())return false;
  const tr=currentMotionTrack(),clip=motionClipboard;if(!tr||!clip||clip.type!==tr.type||!clip.items.length)return false;
  const global=shotStart(shotIdx)+time,target=Math.max(tr.min,Math.min(tr.max,global-tr.offset)),span=clip.items[clip.items.length-1].dt,base=Math.max(tr.min,Math.min(tr.max-span,target));
  if(tr.type==='actor'||tr.type==='camera'){
    if(tr.type==='camera'&&clip.items.some(item=>!Array.isArray(item.point)||item.point.length<3||!item.point.slice(0,3).every(Number.isFinite)))return false;
    const camKeys=tr.type==='camera'?ensureCamKeys(tr.owner):null,aimTimes=tr.type==='camera'?ensureCamAimTimes(tr.owner):null,fovTimes=tr.type==='camera'?ensureCamFovTimes(tr.owner):null;
    clip.items.forEach(item=>{
      const t=base+item.dt,at=tr.times.findIndex(v=>v>t),i=at<0?tr.times.length:at,p=new THREE.Vector3().fromArray(item.point);
      if(tr.type==='camera')p.y=clampAuthoredCameraPointHeight(p.y);
      tr.times.splice(i,0,t);tr.points.splice(i,0,p);
      if(tr.type==='camera'){
        camKeys.splice(i,0,Object.assign({},item.key));aimTimes.splice(i,0,t);fovTimes.splice(i,0,t);
      }
    });
    ensureEaseArray(tr.owner,tr.easeKey,Math.max(0,tr.points.length-1));
    if(tr.type==='camera'){ensureEaseArray(tr.owner,'camAimEase',Math.max(0,tr.points.length-1));ensureEaseArray(tr.owner,'camFovEase',Math.max(0,tr.points.length-1));}
  }else{
    const keys=ensureCamKeys(tr.owner),start=Math.max(0,tr.times.findIndex(v=>v>=base));clip.items.forEach((item,j)=>{const i=Math.min(keys.length-1,start+j);if(tr.type==='cameraAim'){keys[i].yaw=item.key.yaw;keys[i].pitch=item.key.pitch;}else keys[i].fov=item.key.fov;tr.times[i]=Math.max(tr.min,Math.min(tr.max,base+item.dt));});
    const repaired=repairIndexTimes(tr.times.length,tr.times,tr.min,tr.max);tr.times.splice(0,tr.times.length,...repaired);
  }
  setCustomTrackTiming(tr);motionSelection.clear();refreshMotionTimeline();refreshCamPtUI();refreshActorPathUI();rebuildViz();updateActors();updateShotCam();markDirty();$('motionStatus').textContent=PreVisionI18n.t('timeline.status.pasted',{count:clip.items.length});return true;
}
(function initMotionClipboard(){
  $('motionCopy').onclick=copyMotionKeys;$('motionPaste').onclick=pasteMotionKeys;
  window.addEventListener('keydown',e=>{if(!workspaceOwnsGlobalCommand(e))return;const tag=document.activeElement?.tagName;if(!e.metaKey||e.altKey||['INPUT','TEXTAREA','SELECT'].includes(tag))return;if(e.key.toLowerCase()==='c'&&copyMotionKeys())e.preventDefault();if(e.key.toLowerCase()==='v'&&pasteMotionKeys())e.preventDefault();});
})();
(function initMotionTimeline(){
  const rows=$('motionRows'),ruler=$('motionRuler'),panel=$('motionPanel'),toggle=$('motionToggle'),handle=$('motionResizeHandle'),addKey=$('motionAddKey'),autoKey=$('motionAutoKey'),snap=$('motionSnap'),advanced=$('motionAdvanced'),scope=$('motionTimeScope'),clearCamera=$('motionClearCamera');if(!rows||!ruler||!panel||!toggle||!handle)return;
  const HEIGHT_KEY='previz_motion_h',minHeight=112;
  const maxHeight=()=>Math.max(minHeight,Math.min(300,Math.floor(window.innerHeight*.42)));
  const recommendedHeight=()=>Math.max(170,Math.min(240,Math.floor(window.innerHeight*.26)));
  const applyHeight=(value,persist=false)=>{
    const h=Math.max(minHeight,Math.min(maxHeight(),Math.round(value)||recommendedHeight()));
    panel.style.height=h+'px';panel.style.maxHeight=maxHeight()+'px';panel.classList.toggle('compact',h<210);
    if(persist)try{localStorage.setItem(HEIGHT_KEY,String(h));}catch(_e){}
    scheduleUIResize(false);
    return h;
  };
  applyHeight(parseInt(uiRead(HEIGHT_KEY)||'')||recommendedHeight());
  toggle.onclick=()=>setTimelineState($('appWorkspace').dataset.timeline==='full'?'hidden':'full');
  if(addKey)addKey.onclick=()=>commitPendingPreviewKeys('manual');
  if(autoKey)autoKey.onclick=()=>{
    if(previewAutoKey)Array.from(previewAutoTransactions).forEach(ownerKey=>finishPreviewEdit(ownerKey));
    else commitHistoryCapture();
    previewAutoKey=!previewAutoKey;updatePreviewKeyControls();$('motionStatus').textContent=PreVisionI18n.t(previewAutoKey?'timeline.auto.on':'timeline.auto.off');
  };
  if(snap)snap.onclick=()=>{motionSnapEnabled=!motionSnapEnabled;clearMotionSnapFeedback();updatePreviewKeyControls();$('motionStatus').textContent=PreVisionI18n.t(motionSnapEnabled?'timeline.snap.on':'timeline.snap.off');};
  if(advanced)advanced.onclick=()=>{motionAdvancedOpen=!motionAdvancedOpen;updatePreviewKeyControls();refreshMotionTimeline();};
  if(scope)scope.onclick=()=>{motionSceneGlobal=!motionSceneGlobal;clearTimelineCameraPositionSelection(true);updatePreviewKeyControls();refreshMotionTimeline();};
  if(clearCamera)clearCamera.onclick=()=>clearUnifiedCameraAnimation();
  updatePreviewKeyControls();
  let sizing=false,sizingPointerId=null,startY=0,startHeight=0;
  handle.addEventListener('pointerdown',e=>{
    if(sizing&&!matchesActivePointer(e,sizingPointerId))return;
    e.preventDefault();sizing=true;sizingPointerId=e.pointerId;startY=e.clientY;startHeight=panel.getBoundingClientRect().height;panel.classList.add('resizing');$('timeline').classList.add('resizing');
    try{handle.setPointerCapture(e.pointerId);}catch(_e){}
  });
  window.addEventListener('pointermove',e=>{if(sizing&&matchesActivePointer(e,sizingPointerId))applyHeight(startHeight+startY-e.clientY);});
  const finishSizing=e=>{
    if(!sizing||!matchesActivePointer(e,sizingPointerId))return;sizing=false;panel.classList.remove('resizing');$('timeline').classList.remove('resizing');
    try{handle.releasePointerCapture(sizingPointerId);}catch(_e){}sizingPointerId=null;
    applyHeight(parseInt(panel.style.height)||panel.getBoundingClientRect().height,true);
  };
  window.addEventListener('pointerup',finishSizing);window.addEventListener('pointercancel',finishSizing);window.addEventListener('blur',finishSizing);handle.addEventListener('lostpointercapture',finishSizing);
  handle.addEventListener('dblclick',()=>applyHeight(recommendedHeight(),true));
  window.addEventListener('resize',()=>applyHeight(parseInt(panel.style.height)||recommendedHeight()));
  let scrubState=null,scrubFrame=0;
  const scrubSeconds=clientX=>{const rect=ruler.getBoundingClientRect(),dur=motionTimelineDuration();return Math.max(0,Math.min(dur,(clientX-rect.left)/Math.max(1,rect.width)*dur));};
  const flushScrub=finalize=>{
    if(!scrubState)return null;
    const dur=motionTimelineDuration(),rect=ruler.getBoundingClientRect(),resolved=resolveManualMotionScrubTime(scrubSeconds(scrubState.clientX),rect.width/Math.max(.1,dur),scrubState.bypass);
    scrubFrame=0;scrubMotionTimelineTime(resolved.time,finalize);scrubState.lastSnapTime=resolved.snapped?resolved.time:null;
    if(!finalize){if(resolved.snapped)showMotionSnapFeedback(resolved.time,rows.querySelector('.motion-lane'),$('motionPlayhead'));else{clearMotionSnapFeedback();setMotionDragStatus(resolved.time);}}
    return resolved;
  };
  const moveScrub=e=>{
    if(!scrubState||e.pointerId!==scrubState.pointerId)return;scrubState.clientX=e.clientX;scrubState.bypass=!!e.altKey;
    if(!scrubFrame)scrubFrame=requestAnimationFrame(()=>flushScrub(false));
  };
  const finishScrub=e=>{
    if(!scrubState||(e?.pointerId!==undefined&&e.pointerId!==scrubState.pointerId))return;
    const completed=e?.type==='pointerup';if(completed&&Number.isFinite(e?.clientX))scrubState.clientX=e.clientX;if(completed) scrubState.bypass=!!e.altKey;
    if(scrubFrame&&typeof cancelAnimationFrame==='function')cancelAnimationFrame(scrubFrame);scrubFrame=0;flushScrub(true);
    const state=scrubState;scrubState=null;ruler.classList.remove('scrubbing');window.removeEventListener('pointermove',moveScrub);window.removeEventListener('pointerup',finishScrub);window.removeEventListener('pointercancel',finishScrub);window.removeEventListener('blur',finishScrub);state.capture.removeEventListener('lostpointercapture',finishScrub);
    try{state.capture.releasePointerCapture(state.pointerId);}catch(_e){}const finalSnap=completed?state.lastSnapTime:null;clearMotionSnapFeedback();if(Number.isFinite(finalSnap))setMotionSnapStatus(finalSnap);
  };
  const startScrub=(e,capture)=>{
    if(automaticCaptureMutationBlocked())return false;
    if(e.button!==undefined&&e.button!==0)return;e.preventDefault();e.stopPropagation();clearMotionSnapFeedback();scrubState={pointerId:e.pointerId,clientX:e.clientX,bypass:!!e.altKey,lastSnapTime:null,capture};ruler.classList.add('scrubbing');
    try{capture.setPointerCapture(e.pointerId);}catch(_e){}flushScrub(false);
    window.addEventListener('pointermove',moveScrub);window.addEventListener('pointerup',finishScrub);window.addEventListener('pointercancel',finishScrub);window.addEventListener('blur',finishScrub);capture.addEventListener('lostpointercapture',finishScrub);
  };
  const scrubLanePointer=(e,lane)=>{
    const rect=lane.getBoundingClientRect(),dur=motionTimelineDuration(),raw=(e.clientX-rect.left)/Math.max(1,rect.width)*dur,
      resolved=resolveManualMotionScrubTime(raw,rect.width/Math.max(.1,dur),!!e.altKey);
    scrubMotionTimelineTime(resolved.time,true);clearMotionSnapFeedback();if(resolved.snapped)setMotionSnapStatus(resolved.time);else setMotionDragStatus(resolved.time);
  };
  ruler.addEventListener('pointerdown',e=>startScrub(e,ruler));
  rows.addEventListener('pointerdown',e=>{
    if(automaticCaptureMutationBlocked())return false;
    if(e.target.id==='motionPlayhead'){startScrub(e,rows);return;}
    const row=e.target.closest('.motion-row');if(!row)return;
    const role=e.target.dataset.role;
    const ownerKey=row.dataset.previewOwner;
    if(role==='group-toggle'&&ownerKey){
      e.preventDefault();if(motionExpandedGroups.has(ownerKey))motionExpandedGroups.delete(ownerKey);else motionExpandedGroups.add(ownerKey);refreshMotionTimeline();return;
    }
    if(ownerKey&&e.target.closest('.motion-label')&&!row.dataset.legacy){
      clearTimelineCameraPositionSelection();
      const descriptor=previewOwnerDescriptor(ownerKey);if(descriptor?.type==='actor')select(descriptor.owner);else select(null);return;
    }
    if(ownerKey&&(role==='preview-key'||role==='preview-group')){
      clearTimelineCameraPositionSelection();
      e.preventDefault();e.stopPropagation();const state=previewOwnerState(ownerKey);if(!state)return;
      commitHistoryCapture();const previewHistoryBefore=historyCurrent;
      const channelId=row.dataset.channel||'',keyId=e.target.dataset.keyId||'',groupId=e.target.dataset.groupId||'',lane=row.querySelector('.motion-lane'),rect=lane.getBoundingClientRect(),startX=e.clientX,limit=previewOwnerLimit(ownerKey),snapshot=JSON.parse(JSON.stringify(state)),pixelsPerSecond=rect.width/motionTimelineDuration();
      previewMotionSelection={ownerKey,channelId,keyId,groupId};
      const selectedKey=role==='preview-key'?previewSortedKeys(state,channelId).find(item=>item.id===keyId):null;
      const localAt=role==='preview-group'?(state.groups.find(item=>item.id===groupId)?.time||0):(selectedKey?.time||0);
      scrubSceneTime(localAt+previewOwnerOffset(ownerKey),false);
      const pointerId=e.pointerId;try{rows.setPointerCapture(pointerId);}catch(_e){}
      let lastSnapTime=null;clearMotionSnapFeedback();
      const move=ev=>{
        if(!matchesActivePointer(ev,pointerId))return;
        const dt=(ev.clientX-startX)/Math.max(1,rect.width)*motionTimelineDuration();previewAnimationStore.set(ownerKey,JSON.parse(JSON.stringify(snapshot)));
        let resolved=null;
        if(role==='preview-key'){
          const originals=previewSortedKeys(snapshot,channelId),original=originals.find(item=>item.id===keyId),index=originals.indexOf(original);if(!original)return;
          const min=index>0?originals[index-1].time+PREVIEW_KEY_EPS:0,max=index<originals.length-1?originals[index+1].time-PREVIEW_KEY_EPS:limit;
          resolved=resolveMotionDragTime(original.time+dt,{min,max,pixelsPerSecond,bypass:!!ev.altKey});if(resolved.blocked)return;movePreviewChannelKey(ownerKey,channelId,keyId,resolved.time);
        }else{
          const bounds=previewGroupShiftBounds(snapshot,groupId,limit),group=snapshot.groups.find(item=>item.id===groupId);if(!bounds||!group)return;
          resolved=resolveMotionDragTime(group.time+Math.max(bounds.lo,Math.min(bounds.hi,dt)),{min:group.time+bounds.lo,max:group.time+bounds.hi,pixelsPerSecond,bypass:!!ev.altKey});if(resolved.blocked)return;movePreviewKeyGroup(ownerKey,groupId,resolved.time-group.time);
        }
        const activeState=previewOwnerState(ownerKey),activeTime=role==='preview-key'?previewSortedKeys(activeState,channelId).find(item=>item.id===keyId)?.time:activeState.groups.find(item=>item.id===groupId)?.time;
        if(Number.isFinite(activeTime))scrubSceneTime(activeTime+previewOwnerOffset(ownerKey),false);
        const displayTime=activeTime+previewOwnerOffset(ownerKey),snapped=resolved?.snapped&&Math.abs(activeTime-resolved.time)<1e-7;
        if(snapped){lastSnapTime=displayTime;showMotionSnapFeedback(displayTime,lane,e.target);}else{lastSnapTime=null;clearMotionSnapFeedback();setMotionDragStatus(displayTime);}
        updatePreviewMotionPositions(ownerKey);
      };
      let active=true;const up=ev=>{if(!active||!matchesActivePointer(ev,pointerId))return;active=false;window.removeEventListener('pointermove',move);window.removeEventListener('pointerup',up);window.removeEventListener('pointercancel',up);window.removeEventListener('blur',up);rows.removeEventListener('lostpointercapture',up);try{rows.releasePointerCapture(pointerId);}catch(_e){}const completed=ev?.type==='pointerup',finalSnap=completed?lastSnapTime:null;clearMotionSnapFeedback();commitPreviewHistoryTransaction(previewHistoryBefore);refreshMotionTimeline();if(Number.isFinite(finalSnap))setMotionSnapStatus(finalSnap);};
      window.addEventListener('pointermove',move);window.addEventListener('pointerup',up);window.addEventListener('pointercancel',up);window.addEventListener('blur',up);rows.addEventListener('lostpointercapture',up);return;
    }
    if(ownerKey&&!row.dataset.legacy){
      clearTimelineCameraPositionSelection();
      const lane=e.target.closest('.motion-lane');if(lane)scrubLanePointer(e,lane);return;
    }
    const track=motionTrack(row.dataset.type,row.dataset.label);if(!track)return;
    if(e.target.closest('.motion-label')){clearTimelineCameraPositionSelection();motionSelected={type:track.type,label:track.label,index:0};motionSelection.clear();if(track.type==='actor')select(track.owner);else select(null);refreshMotionTimeline();return;}
    if(!role){const lane=e.target.closest('.motion-lane');if(lane)scrubLanePointer(e,lane);return;}
    e.preventDefault();e.stopPropagation();
    const lane=row.querySelector('.motion-lane'),rect=lane.getBoundingClientRect(),startX=e.clientX,original=track.times.slice(),idx=+(e.target.dataset.index||0),displayOffset=motionTrackDisplayOffset(track),pixelsPerSecond=rect.width/motionTimelineDuration();
    if(role==='key'){
      if(track.type==='camera')setTimelineCameraPositionSelection(track,idx,e.shiftKey);
      else{clearTimelineCameraPositionSelection();const id=motionKeyId(track,idx);if(e.shiftKey){if(motionSelection.has(id))motionSelection.delete(id);else motionSelection.add(id);}else if(!motionSelection.has(id)){motionSelection.clear();motionSelection.add(id);}}
      e.target.focus?.({preventScroll:true});selectMotionKey(track,idx,false,false);row.querySelectorAll('.motion-key').forEach((k,i)=>{
        const selected=track.type==='camera'
          ?cameraPositionSelectionIsCurrent()&&cameraPositionCommandSelection.indices.has(i)
          :motionSelection.has(motionKeyId(track,i));
        k.classList.toggle('sel',selected);if(track.type==='camera')k.setAttribute('aria-pressed',selected?'true':'false');
      });
    }else clearTimelineCameraPositionSelection();
    const selectedIdx=role==='key'?Array.from(motionSelection).map(id=>id.split('|')).filter(p=>p[0]===track.type&&p[1]===track.label).map(p=>+p[2]).sort((a,b)=>a-b):[];
    const pointerId=e.pointerId;let moved=false,lastSnapTime=null;clearMotionSnapFeedback();try{rows.setPointerCapture(pointerId);}catch(_e){}
    const move=ev=>{
      if(!matchesActivePointer(ev,pointerId))return;
      if(!moved&&Math.abs(ev.clientX-startX)<3)return;
      const dt=(ev.clientX-startX)/Math.max(1,rect.width)*motionTimelineDuration();
      let snapResult=null,anchorIndex=0;
      if(role==='key'){
        const moving=(selectedIdx.length?selectedIdx:[idx]).filter(index=>track.type!=='camera'||index!==0);if(!moving.length)return;const movingSet=new Set(moving);let lo=-Infinity,hi=Infinity;
        moving.forEach(i=>{lo=Math.max(lo,(i&&!movingSet.has(i-1)?original[i-1]+.05:track.min)-original[i]);hi=Math.min(hi,(i<original.length-1&&!movingSet.has(i+1)?original[i+1]-.05:track.max)-original[i]);});
        anchorIndex=moving.includes(idx)?idx:moving[0];const boundedShift=Math.max(lo,Math.min(hi,dt));
        snapResult=resolveMotionDragTime(original[anchorIndex]+boundedShift,{min:original[anchorIndex]+lo,max:original[anchorIndex]+hi,pixelsPerSecond,bypass:!!ev.altKey});
        if(snapResult.blocked)return;
        const shift=snapResult.time-original[anchorIndex];moving.forEach(i=>track.times[i]=original[i]+shift);
      }else{
        const min0=original[0]??0,max0=original[original.length-1]??0,shift=Math.max(track.min-min0,Math.min(track.max-max0,dt));
        snapResult=resolveMotionDragTime(min0+shift,{min:track.min,max:track.max-(max0-min0),pixelsPerSecond,bypass:!!ev.altKey});
        if(snapResult.blocked)return;
        const quantizedShift=snapResult.time-min0;track.times.splice(0,track.times.length,...original.map(v=>v+quantizedShift));
      }
      const snapped=snapResult?.snapped;
      if(snapped){lastSnapTime=snapResult.time+displayOffset;const highlight=role==='key'?row.querySelector(`.motion-key[data-index="${anchorIndex}"]`):e.target;showMotionSnapFeedback(lastSnapTime,lane,highlight);}else{lastSnapTime=null;clearMotionSnapFeedback();setMotionDragStatus(snapResult.time+displayOffset);}
      if(!track.times.some((value,index)=>Math.abs(value-original[index])>1e-9))return;
      moved=true;
      setCustomTrackTiming(track);if(track.type==='camera'){synchronizeUnifiedCameraTimes(track.owner,track.times);applyLinkedActorsForShot(shotIdx);}updateMotionRowPositions(row,track);updateActors();updateShotCam();updateScrub();
    };
    let active=true;const up=ev=>{if(!active||!matchesActivePointer(ev,pointerId))return;active=false;window.removeEventListener('pointermove',move);window.removeEventListener('pointerup',up);window.removeEventListener('pointercancel',up);window.removeEventListener('blur',up);rows.removeEventListener('lostpointercapture',up);try{rows.releasePointerCapture(pointerId);}catch(_e){}const completed=ev?.type==='pointerup',finalSnap=completed?lastSnapTime:null;clearMotionSnapFeedback();refreshTimingUI();refreshMotionTimeline();refreshCamPtUI();refreshActorPathUI();if(moved)markDirty();if(Number.isFinite(finalSnap))setMotionSnapStatus(finalSnap);};
    window.addEventListener('pointermove',move);window.addEventListener('pointerup',up);window.addEventListener('pointercancel',up);window.addEventListener('blur',up);rows.addEventListener('lostpointercapture',up);
  });
  rows.addEventListener('keydown',e=>{
    if(e.isComposing||e.keyCode===229||!['Enter',' '].includes(e.key))return;
    const key=e.target.closest?.('.motion-key'),row=key?.closest?.('.motion-row');if(!key||key.dataset.role!=='key'||!row||row.dataset.legacy!=='true'||row.dataset.type!=='camera')return;
    const track=motionTrack('camera','');if(!track)return;e.preventDefault();e.stopPropagation();
    const index=+(key.dataset.index||0);setTimelineCameraPositionSelection(track,index,e.shiftKey);selectMotionKey(track,index,true,true);
  });
  window.addEventListener('resize',updateMotionPlayhead);
})();
/* 镜头缩略图: 复用小尺寸渲染器, 抽每镜首帧 */
