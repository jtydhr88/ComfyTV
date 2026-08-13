/*
 * playback/engine.js - playback loop, dual-viewport rendering, and point previews
 * (subsystem K, refactor P8, ADR-0015). Live mutable owners install their own
 * globalThis accessors because the P1 bridge Object.assign would otherwise snapshot
 * primitives such as aspectW/aspectH/camDriveMode/playAllMode.
 */
import { $, clock, curShot, sceneDur, shotStart } from '../core/store.js';
import { ensureActorTimes, ensureCamKeys, ensureCamTimes, ensureEaseArray, shotCurve } from '../core/project-data.js';
import { renderWithResolvedReframe, resolveShotReframe } from '../core/reframe.js';
import {
  actorCurve,
  pointIndexedPosition,
  pointIndexedTangent,
  sampleCameraKey,
  sampleTimedCameraKey,
  timedPathState,
} from '../core/timing-math.js';
import {
  configureRenderer,
  renderer,
  scene,
  setExportLook,
  shotCam,
  updateLabelScales,
  viewCam,
} from '../stage/environment.js';
import {
  actorByLabel,
  actorPenetrates,
  alignActorToTerrain,
  alignAllActorsToTerrain,
  applyPreviewActorAnimation,
  applyPreviewCameraAnimation,
  collisionEnabled,
  isPointSyncShot,
  lockTarget,
  moveActorSafely,
  pathOwner,
  syncMountedTransform,
  syncTargetForShot,
} from '../stage/runtime.js';

const pipCanvas=document.getElementById('pipgl');
const pipRenderer=configureRenderer(new THREE.WebGLRenderer({canvas:pipCanvas, antialias:true, preserveDrawingBuffer:true}));
let aspectW=16, aspectH=9, camDriveMode=false, playAllMode=false;
let previewCamPt=null,previewActorPoint=null;
const previewActorPoints=new Map();
const renderLayoutCache={main:{w:0,h:0,dpr:0},pip:{w:0,h:0,dpr:0,aspect:0}};
let last=performance.now();
let viewCamDummy=null;

const definePlaybackGlobal=(name,get,set)=>Object.defineProperty(globalThis,name,{get,set,configurable:true});
definePlaybackGlobal('pipCanvas',()=>pipCanvas,()=>{});
definePlaybackGlobal('pipRenderer',()=>pipRenderer,()=>{});
definePlaybackGlobal('aspectW',()=>aspectW,value=>{aspectW=value;});
definePlaybackGlobal('aspectH',()=>aspectH,value=>{aspectH=value;});
definePlaybackGlobal('camDriveMode',()=>camDriveMode,value=>{camDriveMode=!!value;});
definePlaybackGlobal('playAllMode',()=>playAllMode,value=>{playAllMode=!!value;});
definePlaybackGlobal('previewCamPt',()=>previewCamPt,value=>{previewCamPt=value;});
definePlaybackGlobal('previewActorPoint',()=>previewActorPoint,value=>{previewActorPoint=value;});
definePlaybackGlobal('previewActorPoints',()=>previewActorPoints,()=>{});
definePlaybackGlobal('renderLayoutCache',()=>renderLayoutCache,()=>{});
definePlaybackGlobal('viewCamDummy',()=>viewCamDummy,value=>{viewCamDummy=value;});

function applyPathHeading(a,yaw){
  if(a.kind!=='shipwreck'){a.obj.rotation.y=yaw;return true;}
  const old=a.obj.rotation.y,wasBad=collisionEnabled()&&actorPenetrates(a);
  a.obj.rotation.y=yaw;alignActorToTerrain(a);
  if(collisionEnabled()&&!wasBad&&actorPenetrates(a)){a.obj.rotation.y=old;alignActorToTerrain(a);return false;}
  return true;
}

const playbackUpdateShotCam=()=>{
  const s=curShot(); if(!s) return;
  const shotTime=clock.time, cv=shotCurve(s), t=Math.min(shotTime/s.dur,1);
  const ease=t*t*(3-2*t);
  const nodeSync=isPointSyncShot(s);
  const custom=s.timingMode==='custom',timed=custom?timedPathState(s.camPts,ensureCamTimes(s),shotTime,ensureEaseArray(s,'camEase',Math.max(0,s.camPts.length-1)),cv):null;
  const pathU=custom?timed.u:ease;
  const pointPreview=previewCamPt!==null&&!clock.playing;
  if(pointPreview)camBall.position.copy(s.camPts[Math.max(0,Math.min(previewCamPt,s.camPts.length-1))]);
  else if(cv) camBall.position.copy((nodeSync||custom)?pointIndexedPosition(s.camPts,s.camMode,cv,pathU):cv.getPointAt(ease));
  else camBall.position.copy(s.camPts[0]);
  shotCam.position.copy(camBall.position);
  const k=pointPreview?ensureCamKeys(s)[Math.max(0,Math.min(previewCamPt,s.camPts.length-1))]:custom?sampleTimedCameraKey(s,shotTime):sampleCameraKey(s,pathU,nodeSync);
  shotCam.fov=k.fov;
  if(s.lock==='\u624b\u52a8\u671d\u5411'){
    shotCam.rotation.order='YXZ';
    shotCam.rotation.set(k.pitch*Math.PI/180, k.yaw*Math.PI/180, 0);
  } else {
    shotCam.lookAt(lockTarget(s.lock));
  }
  shotCam.updateProjectionMatrix();if(!pointPreview)applyPreviewCameraAnimation(s,shotTime);
  if(!clock.playing)globalThis.applyUnifiedCameraDraftToRuntime?.(s,shotTime);
  camBall.quaternion.copy(shotCam.quaternion); // Icon orientation matches the real shot direction.
};
const playbackUpdateActors=()=>{
  if(!shots.length) return;
  const shotTime=clock.time,s=curShot(),globalSeconds=shotStart(shotIdx)+Math.min(shotTime,s.dur),globalT=globalSeconds/sceneDur();
  const localT=Math.min(shotTime/s.dur,1),localEase=localT*localT*(3-2*localT),syncActor=syncTargetForShot(s);
  actors.forEach(a=>{
    if(a.mount) return;   // Riders follow the mount; handled in the second pass.
    if(dragging&&dragging.actor===a) return; // Do not snap an object back to path sampling during canvas dragging.
    if(a.pathPts.length<2){applyPreviewActorAnimation(a,globalSeconds);return;}
    const cv=actorCurve(a);
    const nodeSync=a===syncActor&&s.timingMode!=='custom';
    const timed=nodeSync?null:timedPathState(a.pathPts,ensureActorTimes(a),globalSeconds,ensureEaseArray(a,'pathEase',Math.max(0,a.pathPts.length-1)),cv);
    const moveT=nodeSync?localEase:timed.u;
    const p=(nodeSync||a.pathMode==='line')?pointIndexedPosition(a.pathPts,a.pathMode,cv,moveT):cv.getPoint(moveT);
    moveActorSafely(a,p.x,p.z);
    const tan=((nodeSync||a.pathMode==='line')?pointIndexedTangent(a.pathPts,a.pathMode,cv,moveT):cv.getTangent(Math.min(moveT,.999))).setY(0);
    if(tan.lengthSq()>1e-4){
      if(['char','horse','seahorse','shipwreck'].includes(a.kind))applyPathHeading(a,Math.atan2(tan.x,tan.z));
      if(a.kind==='car')  a.obj.rotation.y=Math.atan2(tan.x,tan.z)-Math.PI/2;
    }
    const len=cv.getLength(), segDur=nodeSync?s.dur:Math.max(.01,ensureActorTimes(a)[Math.min(a.pathPts.length-1,(timed?.segment||0)+1)]-ensureActorTimes(a)[timed?.segment||0]);
    const segLen=nodeSync?len:a.pathPts[Math.min(a.pathPts.length-1,(timed?.segment||0)+1)].distanceTo(a.pathPts[timed?.segment||0]);
    const spd=(nodeSync?len:segLen)/segDur;
    const walking=(nodeSync?(moveT>0&&moveT<1):!!timed?.active) && spd>0.05;
    /* Procedural gait: hip/knee/shoulder swing while walking. Non-standing poses stay keyed by joints. */
    const rig=a.obj.userData.rig;
    if(rig && (a.pose||'stand')==='stand'){
      const ph=moveT*len*Math.PI/0.38;
      const sw=walking?Math.min(.62,.28+spd*.3):0;
      rig.hipL.rotation.x=Math.sin(ph)*sw;  rig.hipR.rotation.x=-Math.sin(ph)*sw;
      rig.kneeL.rotation.x=Math.max(0,-Math.sin(ph))*sw*1.2;
      rig.kneeR.rotation.x=Math.max(0,Math.sin(ph))*sw*1.2;
      rig.shL.rotation.x=-Math.sin(ph)*sw*.6; rig.shR.rotation.x=Math.sin(ph)*sw*.6;
      rig.spine.rotation.x=walking?.06:0;
    }
    /* Horse diagonal gait: FL+BR / FR+BL alternate. */
    const hl=a.obj.userData.horseLegs;
    if(hl){
      const ph2=moveT*len*Math.PI/0.6;
      const sw2=walking?Math.min(.5,.2+spd*.22):0;
      hl.FL.rotation.x=Math.sin(ph2)*sw2; hl.BR.rotation.x=Math.sin(ph2)*sw2;
      hl.FR.rotation.x=-Math.sin(ph2)*sw2; hl.BL.rotation.x=-Math.sin(ph2)*sw2;
    }
    if(a.kind==='desert')alignAllActorsToTerrain();
    else alignActorToTerrain(a);
    applyPreviewActorAnimation(a,globalSeconds);
  });
  /* Independent object path previews: previewing object A never changes camera, time, or another object. */
  if(!clock.playing)previewActorPoints.forEach((rawI,rawActor)=>{
    const a=pathOwner(rawActor);if(!a||!a.pathPts.length)return;
    const i=Math.max(0,Math.min(rawI,a.pathPts.length-1)),p=a.pathPts[i];
    a.obj.position.x=p.x;a.obj.position.z=p.z;alignActorToTerrain(a);
    const cv=actorCurve(a),u=cv?actorPointProgress(a,i):0,tan=cv?cv.getTangentAt(Math.min(u,.999)).setY(0):null;
    if(tan&&tan.lengthSq()>1e-4){if(['char','horse','seahorse','shipwreck'].includes(a.kind))applyPathHeading(a,Math.atan2(tan.x,tan.z));if(a.kind==='car')a.obj.rotation.y=Math.atan2(tan.x,tan.z)-Math.PI/2;}
    if(a.kind==='desert')alignAllActorsToTerrain();else alignActorToTerrain(a);
  });
  /* Second pass: riders stick to the mount saddle and inherit its heading. */
  actors.forEach(a=>{
    if(!a.mount) return;
    const host=actorByLabel(a.mount);
    if(!host) return;
    syncMountedTransform(a,host);applyPreviewActorAnimation(a,globalSeconds);
  });
};
function resize(force=false){
  const vp=document.getElementById('viewport');
  const vw=Math.max(1,vp.clientWidth),vh=Math.max(1,vp.clientHeight),dpr=Math.max(1,window.devicePixelRatio||1);
  const mainDprChanged=renderLayoutCache.main.dpr!==dpr,mainSizeChanged=renderLayoutCache.main.w!==vw||renderLayoutCache.main.h!==vh;
  if(mainDprChanged){renderer.setPixelRatio(dpr);renderLayoutCache.main.dpr=dpr;}
  if(force||mainSizeChanged||mainDprChanged){renderer.setSize(vw,vh,false);renderLayoutCache.main.w=vw;renderLayoutCache.main.h=vh;}
  if(force||mainSizeChanged){viewCam.aspect=vw/vh;viewCam.updateProjectionMatrix();}
  const holder=document.getElementById('pip');
  const pw=Math.max(160,(holder&&holder.clientWidth)||216),ph=Math.round(pw*aspectH/aspectW),projectAspect=aspectW/aspectH;
  const pipDprChanged=renderLayoutCache.pip.dpr!==dpr,pipSizeChanged=renderLayoutCache.pip.w!==pw||renderLayoutCache.pip.h!==ph,aspectChanged=renderLayoutCache.pip.aspect!==projectAspect;
  if(pipDprChanged){pipRenderer.setPixelRatio(dpr);renderLayoutCache.pip.dpr=dpr;}
  if(force||pipSizeChanged||pipDprChanged){pipRenderer.setSize(pw,ph,false);renderLayoutCache.pip.w=pw;renderLayoutCache.pip.h=ph;}
  pipCanvas.style.width='100%'; pipCanvas.style.height='auto';
  if(force||aspectChanged){shotCam.aspect=projectAspect;shotCam.updateProjectionMatrix();renderLayoutCache.pip.aspect=projectAspect;}
  return force||mainSizeChanged||mainDprChanged||pipSizeChanged||pipDprChanged||aspectChanged;
}
let playbackResizeBindingsReady=false;
function initPlaybackResizeBindings(){
  if(playbackResizeBindingsReady)return;
  playbackResizeBindingsReady=true;
  window.addEventListener('resize',()=>scheduleUIResize(false));
  if(typeof ResizeObserver==='function'){
    const viewportResizeObserver=new ResizeObserver(()=>scheduleUIResize(false));
    viewportResizeObserver.observe(document.getElementById('viewport'));
    viewportResizeObserver.observe(document.getElementById('pip'));
  }
}
function renderDirectorViewport(){
  setExportLook(false);
  renderer.render(scene,viewCam);
  const previousAutoClear=renderer.autoClear;
  renderer.autoClear=false;
  try{
    renderer.clearDepth();
    if(globalThis.cameraVizVisibleIn('viewport')&&camBall.visible)renderer.render(cameraVizScene,globalThis.syncCameraVizCamera(viewCam));
  }finally{renderer.autoClear=previousAutoClear;}
}
function resolvedPlaybackReframe(){
  return typeof globalThis.currentResolvedReframe==='function'
    ?globalThis.currentResolvedReframe()
    :resolveShotReframe(curShot(),`${aspectW}:${aspectH}`);
}
function renderShotSurface(targetRenderer,width,height,{contain=false}={}){
  return renderWithResolvedReframe({
    renderer:targetRenderer,scene,camera:shotCam,width,height,
    targetAspect:aspectW/aspectH,reframe:resolvedPlaybackReframe(),contain
  });
}
function loop(now){
  requestAnimationFrame(loop);
  const dt=(now-last)/1000; last=now;
  if(clock.playing && shots.length && !recording){   // Recording is advanced by deterministic 30Hz recTick, not rAF.
    clock.tick(dt*parseFloat(document.getElementById('speed').value));
    if(clock.time>=curShot().dur){
      if(playAllMode && shotIdx<shots.length-1){ setShot(shotIdx+1,false); clock.seek(0); }
      else { clock.pause(); clock.seek(curShot().dur); updatePlayBtn(); }
    }
    updateScrub();
  }
  flushScheduledUIResize();
  globalThis.updateActors(); globalThis.updateShotCam();
  updateLabelScales(viewCam);
  globalThis.updateVizScales(viewCam);
  if(camDriveMode||globalThis.reframeEditorActive?.()){
    const vp=document.getElementById('viewport');
    setExportLook(true);renderShotSurface(renderer,Math.max(1,vp.clientWidth),Math.max(1,vp.clientHeight),{contain:true});
  }
  else renderDirectorViewport();
  setExportLook(true);
  renderShotSurface(pipRenderer,Math.max(1,renderLayoutCache.pip.w),Math.max(1,renderLayoutCache.pip.h));
  setExportLook(camDriveMode);
}
function clearPointPreview(){if(globalThis.automaticCaptureMutationBlocked())return false;globalThis.clearUnifiedCameraDraft?.();previewCamPt=null;previewActorPoint=null;previewActorPoints.clear();}
function previewCameraPoint(i){
  if(globalThis.automaticCaptureMutationBlocked())return false;
  globalThis.clearUnifiedCameraDraft?.();
  const s=curShot();if(!s)return;
  globalThis.clearTimelineCameraPositionSelection?.();
  const label=motionTrack('camera','')?.label||'';
  selCamPt=Math.max(0,Math.min(i,s.camPts.length-1));motionSelected={type:'camera',label,index:selCamPt};motionSelection.clear();previewCamPt=selCamPt;clock.pause();playAllMode=false;
  globalThis.updateShotCam();refreshCamPtUI();refreshMotionTimeline();globalThis.rebuildViz();updateScrub();updatePlayBtn();updateMonitor();
}
function previewActorPathPoint(source,i){
  if(globalThis.automaticCaptureMutationBlocked())return false;
  const a=pathOwner(source);if(!a||!a.pathPts.length)return;
  globalThis.clearTimelineCameraPositionSelection?.();
  selActorPt=Math.max(0,Math.min(i,a.pathPts.length-1));motionSelected={type:'actor',label:a.label,index:selActorPt};motionSelection.clear();motionSelection.add(`actor|${a.label}|${selActorPt}`);previewActorPoint={actor:a,idx:selActorPt};previewActorPoints.set(a,selActorPt);clock.pause();playAllMode=false;
  globalThis.updateActors();globalThis.updateShotCam();refreshActorPathUI();refreshMotionTimeline();globalThis.rebuildViz();updateScrub();updatePlayBtn();updateMonitor();
}

definePlaybackGlobal('playbackUpdateShotCam',()=>playbackUpdateShotCam,()=>{});
definePlaybackGlobal('playbackUpdateActors',()=>playbackUpdateActors,()=>{});
definePlaybackGlobal('resize',()=>resize,()=>{});
definePlaybackGlobal('renderDirectorViewport',()=>renderDirectorViewport,()=>{});
definePlaybackGlobal('renderShotSurface',()=>renderShotSurface,()=>{});
definePlaybackGlobal('loop',()=>loop,()=>{});
definePlaybackGlobal('clearPointPreview',()=>clearPointPreview,()=>{});
definePlaybackGlobal('previewCameraPoint',()=>previewCameraPoint,()=>{});
definePlaybackGlobal('previewActorPathPoint',()=>previewActorPathPoint,()=>{});

export {
  pipRenderer,
  renderLayoutCache,
  playbackUpdateShotCam as updateShotCam,
  playbackUpdateActors as updateActors,
  resize,
  initPlaybackResizeBindings,
  renderDirectorViewport,
  renderShotSurface,
  loop,
  clearPointPreview,
  previewCameraPoint,
  previewActorPathPoint
};
