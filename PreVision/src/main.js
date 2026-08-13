
/* Runtime error bar */
window.addEventListener('error', e=>{
  let bar=document.getElementById('errbar');
  if(!bar){ bar=document.createElement('div'); bar.id='errbar';
    bar.style.cssText='position:fixed;left:0;right:0;bottom:0;background:var(--danger);color:var(--on-danger);padding:8px 14px;font:12px monospace;z-index:9999;white-space:pre-wrap';
    document.body.appendChild(bar); }
  bar.textContent=PreVisionI18n.t('error.runtimePrefix')+e.message+' @'+(e.lineno||'?');
});
if(typeof THREE==='undefined'){ document.body.innerHTML='<div style="color:var(--tx1);padding:40px">'+PreVisionI18n.t('error.threeMissing')+'</div>'; throw new Error('THREE missing'); }
const desktop=window.previsionDesktop||null;
/* `$` moved to core/store.js (refactor P3, ADR-0009); reaches here via the bridge. */
let modalCommandSequence=0;
const modalCommandOrder=new WeakMap();
const modalCommandCleanupBound=new WeakSet();
let modalSelectorSupported=null;
function isNativeModalDialog(node){
  if(node?.tagName!=='DIALOG'||!node.open)return false;
  if(modalSelectorSupported!==false&&typeof node.matches==='function'){
    try{const matched=node.matches(':modal');modalSelectorSupported=true;return matched;}
    catch(_error){modalSelectorSupported=false;}
  }
  return modalCommandOrder.has(node);
}
function isCommandNodeVisible(node,includeAncestors){
  let current=node;
  while(current){
    if(current.hidden||current.getAttribute?.('aria-hidden')==='true')return false;
    if(typeof getComputedStyle==='function'){
      const style=getComputedStyle(current);
      if(style?.display==='none'||style?.visibility==='hidden'||style?.visibility==='collapse')return false;
    }
    current=includeAncestors?current.parentElement:null;
  }
  return true;
}
function isVisibleCommandModal(node){
  const nativeDialog=isNativeModalDialog(node);
  const ariaDialog=node?.getAttribute?.('role')==='dialog'&&node.getAttribute('aria-modal')==='true';
  if(!nativeDialog&&!ariaDialog)return false;
  return isCommandNodeVisible(node,!nativeDialog);
}
function commandModalCandidates(){
  const nodes=[...document.querySelectorAll('dialog'),...document.querySelectorAll('[role="dialog"]')];
  return [...new Set(nodes)].filter(node=>{
    const visible=isVisibleCommandModal(node);if(!visible)modalCommandOrder.delete(node);return visible;
  });
}
function rememberModalCommandOwner(owner){
  if(!modalCommandCleanupBound.has(owner)){
    owner.addEventListener?.('close',()=>modalCommandOrder.delete(owner));modalCommandCleanupBound.add(owner);
  }
  modalCommandOrder.set(owner,++modalCommandSequence);return owner;
}
function showCommandModal(owner){
  if(!owner||typeof owner.showModal!=='function')return false;
  if(!owner.open){owner.showModal();rememberModalCommandOwner(owner);}
  else if(isVisibleCommandModal(owner)&&!modalCommandOrder.has(owner))rememberModalCommandOwner(owner);
  return isVisibleCommandModal(owner);
}
function currentModalCommandOwner(){
  const owners=commandModalCandidates();if(!owners.length)return null;
  const activeOwner=document.activeElement?.closest?.('dialog, [role="dialog"]');
  const activeAriaOwner=activeOwner?.tagName!=='DIALOG'&&activeOwner?.getAttribute?.('role')==='dialog'&&activeOwner.getAttribute('aria-modal')==='true';
  const prioritizeActive=owners.includes(activeOwner)&&(activeAriaOwner||!modalCommandOrder.has(activeOwner));
  owners.forEach(owner=>{if(!modalCommandOrder.has(owner))rememberModalCommandOwner(owner);});
  if(prioritizeActive)rememberModalCommandOwner(activeOwner);
  return owners.reduce((top,owner)=>modalCommandOrder.get(owner)>modalCommandOrder.get(top)?owner:top);
}
function currentCommandOwner(){return currentModalCommandOwner()||$('appWorkspace')||document.body;}
function workspaceOwnsGlobalCommand(event){
  if(event?.defaultPrevented||event?.isComposing)return false;
  return currentCommandOwner()===($('appWorkspace')||document.body);
}
function runWorkspaceCommand(command,event){return workspaceOwnsGlobalCommand(event)&&!automaticCaptureMutationBlocked()?command():false;}
if(desktop)document.getElementById('desktopBadge').style.display='inline-block';
const topSnapPageKey=desktop?'capture.workspace':'capture.pageOrWindow',topSnapHintKey=desktop?'capture.workspaceHint':'capture.systemPickerHint';
document.getElementById('topSnapPageLabel').setAttribute('data-i18n',topSnapPageKey);
document.getElementById('topSnapPageHint').setAttribute('data-i18n',topSnapHintKey);
document.getElementById('topSnapPageLabel').textContent=PreVisionI18n.t(topSnapPageKey);
document.getElementById('topSnapPageHint').textContent=PreVisionI18n.t(topSnapHintKey);

/* @p9:ui-shell */
function semanticLabel(id){const spec=semanticProxyType(id);return spec?PreVisionI18n.t(spec.labelKey):PreVisionI18n.t('semantic.type.none');}
const POSE_ZH=Object.fromEntries(Object.entries(POSE_LABEL_KEYS).map(([pose,key])=>[pose,PreVisionI18n.t(key)]));
function poseText(pose){return PreVisionI18n.t(POSE_LABEL_KEYS[pose]||POSE_LABEL_KEYS.stand);}
/* ============ Data model: project -> scene -> shot ============ */
/* ---- Contract layer (project schema factories/templates, ensure- and repair- track
 * fixups, the normalizeProject whitelist family, contract constants) moved to
 * core/project-data.js (refactor P2, ADR-0008). Same bridge mechanism as P1 (ADR-0007):
 * the build strips these imports and re-exposes every name on globalThis, keeping runtime
 * global semantics identical to the pre-split single script. ---- */
import {
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
  clampAuthoredCameraPointHeight,
  PROJECT_EASE_TYPES,
  PROJECT_LOCK_GLOBAL,
  PROJECT_LOCK_MANUAL,
  PROJECT_LOCK_SENTINELS,
  PROJECT_POSES,
  PROJECT_JOINT_KEYS,
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
} from './core/project-data.js';
function deepCopy(o){ return JSON.parse(JSON.stringify(o)); }
function sceneTemplateById(id){return SCENE_TEMPLATES.find(template=>template.id===id)||SCENE_TEMPLATES[0];}
function sceneTemplateText(template){return {name:PreVisionI18n.t(template.nameKey),desc:PreVisionI18n.t(template.descKey)};}

/* ---- Core store + PlaybackClock moved to core/store.js (refactor P3, ADR-0009). The
 * eight core globals (project/sceneIdx/shotIdx/actors/shots/selected/time/playing) now
 * live in the store module behind a transitional globalThis accessor shim installed at
 * its module top level, so every remaining bare read/write below keeps working unchanged.
 * Their former top-level `let` declarations here are deleted — a script-level lexical
 * binding would shadow a globalThis accessor. curScene/curShot/sceneDur/shotStart and
 * `$` moved verbatim; time/playing writers migrate to the clock verb API stage by stage
 * (this stage converts only the plan §2.1 borrowers still using manual save/restore). ---- */
import {
  $,
  clock,
  curScene,
  curShot,
  refresh,
  sceneDur,
  shotStart,
} from './core/store.js';
let sceneRailLevel='scenes';
let selCamPt=0; // Selected camera control point index.
let selActorPt=0; // Selected actor path control point index.

/* ---- Time-sampling pure functions moved to core/timing-math.js (refactor P1, ADR-0007).
 * At build time scripts/build-app.mjs strips this import and lets esbuild bundle the
 * modules into a leading bridge block that re-exposes the same names on globalThis,
 * so runtime global semantics stay identical to the pre-split single script. ---- */
import {
  normalizeEaseSpec,
  cubicBezierEase,
  applyEaseSpec,
  segmentArcParameter,
  timedPathState,
  timedValueState,
  curveProgressAtControlPoint,
  unwrapAngles,
  hermiteAt,
  sampleCameraKey,
  sampleTimedCameraKey,
  actorCurve,
  pointIndexedPosition,
  pointIndexedTangent,
  inverseSmoothProgress,
  nodeArrivalTime,
} from './core/timing-math.js';
import {
  REFRAME_ASPECT,
  REFRAME_IDENTITY,
  copyReframe,
  reframeIsIdentity,
  normalizeReframeValue,
  normalizeReframeByAspect,
  getShotReframe,
  resolveShotReframe,
  setShotReframe,
  resetShotReframe,
  computeContainRect,
  computeReframeProjection,
  snapshotCameraProjection,
  restoreCameraProjection,
  applyCameraReframe,
  snapshotRendererFrame,
  restoreRendererFrame,
  renderWithResolvedReframe,
} from './core/reframe.js';
/* ---- Stage runtime (subsystems F + J) moved to stage/runtime.js (refactor P7a,
 * ADR-0013). The build strips this import and re-exposes the names on globalThis.
 * UI refresh handlers, viewport framing helpers, labels/pose text, and timeline
 * mutable state stay in app.js. ---- */
import {
  v3,
  stageCoord,
  clampStagePoint,
  cleanDimensions,
  actorJointsFromData,
  DEFAULT_GLOBAL_LOCK,
  liveSceneDuration,
  configureObjectShadows,
  buildActor,
  stageToData,
  COLLISION_EPS,
  actorOwnWorldBox,
  desertLocalSurfaceHeight,
  desertSurfaceHeightAt,
  collisionExemptKind,
  terrainSupportHeight,
  terrainPoseFloor,
  alignActorToTerrain,
  alignAllActorsToTerrain,
  syncMountedTransform,
  actorWorldBox,
  boxesPenetrate,
  collisionPairIgnored,
  collisionEnabled,
  actorPenetrates,
  moveActorSafely,
  constrainActorPathPoint,
  groundElevation,
  setActorElevation,
  snapActorToGround,
  setActorScaleSafely,
  placeActorWithoutOverlap,
  syncScene,
  clearStage,
  loadScene,
  actorByLabel,
  pathOwner,
  effectiveActorPaths,
  syncTargetForShot,
  isPointSyncShot,
  copyActorPathToCamera,
  addActorPathPoint,
  removeActorPathPoint,
  lockTarget,
  MANUAL_CAMERA_LOCK_VALUE,
  applyPreviewCameraAnimation,
  applyPreviewJointChannel,
  applyPreviewScaleSafely,
  applyPreviewElevationSafely,
  applyPreviewActorAnimation,
} from './stage/runtime.js';
/* ---- Playback loop and dual-viewport rendering moved to playback/engine.js
 * (refactor P8, ADR-0015). Live mutable owners such as aspectW/aspectH,
 * camDriveMode, playAllMode, and point-preview state are exposed by accessors
 * inside that module to avoid bridge snapshots. ---- */
import { initPlaybackResizeBindings } from './playback/engine.js';
function updateShotCam(){return globalThis.playbackUpdateShotCam(...arguments);}
function updateActors(){return globalThis.playbackUpdateActors(...arguments);}
/* ---- Viewport framing, camera visualization, and canvas interaction moved to
 * viewport/interact.js (refactor P8, ADR-0015). Live mutable owners such as
 * camHandles/pathHandles/sunHandle/dragging are exposed by accessors inside that
 * module to avoid bridge snapshots. ---- */
import {
  frameBounds,
  fitAllActors,
  focusActor,
  cameraVizResourceStats,
  syncCameraVizCamera,
  rebuildVizLight,
  worldUnitsPerCssPixel,
  updateVizScales,
  pick,
  highlight,
  translateCameraRoute,
  onCanvasPointerDown,
  onCanvasPointerMove,
  onCanvasPointerUp,
  finishCanvasDrag,
  select,
  setDragMode,
} from './viewport/interact.js';
function finiteBox(){return globalThis.viewportFiniteBox(...arguments);}
function cameraVizVisibleIn(){return globalThis.viewportCameraVizVisibleIn(...arguments);}
function rebuildViz(){return globalThis.viewportRebuildViz(...arguments);}
/* ---- Seedance 2.5 white-model planning and synchronous render overlay. The pure
 * profile stays separate from capture state; the P1 bridge exposes these named
 * helpers to export/capture.js at call time. ---- */
import {
  SEEDANCE_WHITE_MODEL_PROFILE,
  planSeedanceWhiteModelPackage,
  seedanceTimestampScript,
  inspectSeedanceMp4,
  normalizeSeedanceMp4Timing,
  assertSeedanceEncodedClip,
  createSeedanceRestoreLedger,
  withSeedanceWhiteModelRender,
  seedanceSha256,
  buildSeedanceManifest,
  verifySeedanceZipManifest,
} from './export/seedance-profile.js';
/* ---- Capture, recording, and Seedance packaging moved to export/capture.js
 * (refactor P8, ADR-0015). Live mutable owners such as captureTransaction,
 * recRenderer, recording, and workspace timers are exposed by accessors inside
 * that module to avoid bridge snapshots. ---- */
import {
  initCaptureBindings,
} from './export/capture.js';
function automaticCaptureMutationBlocked(){return globalThis.captureAutomaticCaptureMutationBlocked(...arguments);}
function deferAutomaticCaptureMutation(){return globalThis.captureDeferAutomaticCaptureMutation(...arguments);}
function actorPointProgress(a,index){
  const cv=actorCurve(a);return cv?curveProgressAtControlPoint(cv,a.pathPts[index],index,a.pathPts.length):0;
}
function cameraAimDirection(k){
  return new THREE.Vector3(0,0,-1).applyEuler(new THREE.Euler((k.pitch||0)*Math.PI/180,(k.yaw||0)*Math.PI/180,0,'YXZ')).normalize();
}

/* Stage runtime functions now live in stage/runtime.js. */
/* @p9:persistence */
/* @p9:inspector */
/* @p9:timeline */
/* ---- 场景太阳: 方向光 + 统一阴影参数 ---- */
function refreshSunUI(){
  const s=currentSun(),ids=['sunX','sunY','sunZ','sunIntensity','sunTemp','sunAmbient','sunSoft'];
  $('sunOn').checked=s.enabled;$('sunX').value=s.pos[0];$('sunY').value=s.pos[1];$('sunZ').value=s.pos[2];
  $('sunIntensity').value=s.intensity;$('sunTemp').value=s.temp;$('sunAmbient').value=s.ambient;$('sunSoft').value=s.softness;$('sunQuality').value=s.quality;
  $('sunXLabel').textContent=s.pos[0].toFixed(1)+'m';$('sunYLabel').textContent=s.pos[1].toFixed(1)+'m';$('sunZLabel').textContent=s.pos[2].toFixed(1)+'m';
  $('sunIntensityLabel').textContent=s.intensity.toFixed(2);$('sunTempLabel').textContent=Math.round(s.temp)+'K';
  $('sunAmbientLabel').textContent=s.ambient.toFixed(2);$('sunSoftLabel').textContent=s.softness.toFixed(1);
  ids.forEach(id=>$(id).disabled=!s.enabled);$('sunQuality').disabled=!s.enabled;
  const az=Math.atan2(s.pos[0],s.pos[2])*180/Math.PI,el=Math.atan2(s.pos[1],Math.hypot(s.pos[0],s.pos[2]))*180/Math.PI;
  $('sunStatus').textContent=s.enabled
    ?PreVisionI18n.t('runtime.sun.enabled',{azimuth:Math.round(az),elevation:Math.round(el)})
    :PreVisionI18n.t('runtime.sun.disabled');
}
function updateSunFromUI(){
  if(automaticCaptureMutationBlocked())return false;
  const s=currentSun();s.pos=[+$('sunX').value,+$('sunY').value,+$('sunZ').value];s.intensity=+$('sunIntensity').value;
  s.temp=+$('sunTemp').value;s.ambient=+$('sunAmbient').value;s.softness=+$('sunSoft').value;s.quality=$('sunQuality').value;
  applySunSettings(false);refreshSunUI();rebuildVizLight();updatePrompt();markDirty();
}
$('sunOn').onchange=e=>{if(automaticCaptureMutationBlocked())return false;currentSun().enabled=!!e.target.checked;applySunSettings(false);refreshSunUI();rebuildViz();updatePrompt();markDirty();};
['sunX','sunY','sunZ','sunIntensity','sunTemp','sunAmbient','sunSoft'].forEach(id=>$(id).oninput=updateSunFromUI);
$('sunQuality').onchange=updateSunFromUI;
function setSunPreset(pos,temp,intensity,ambient,softness){
  if(automaticCaptureMutationBlocked())return false;
  const s=currentSun();Object.assign(s,{enabled:true,pos:pos.slice(),temp,intensity,ambient,softness});
  applySunSettings(false);refreshSunUI();rebuildViz();updatePrompt();markDirty();
}
$('sunMorning').onclick=()=>setSunPreset([-14,5,10],3600,.75,.24,2.75);
$('sunNoon').onclick=()=>setSunPreset([4,24,3],5600,1.1,.32,1.25);
$('sunSunset').onclick=()=>setSunPreset([16,3,-8],3000,.65,.22,3.25);

/* ---- 场景背景: 加载与调节 ---- */
let bgLoadMode='pano';
const GROUND_STYLE_KEYS={checker:'ground.checker',white:'ground.white',black:'ground.black',color:'ground.customColor',image:'ground.customImage'};
function refreshGroundUI(){
  if(!project||!curScene())return;
  const appearance=currentGroundAppearance(),quickPreset=currentGroundQuickPreset(appearance),select=$('groundStyle'),color=$('groundColor'),load=$('loadGroundImage'),status=$('groundStyleStatus');
  if(select)select.value=appearance.style;
  if(color){color.value=appearance.style==='color'?appearance.color:GROUND_DEFAULT_COLOR;color.disabled=appearance.style!=='color';}
  if(load)load.textContent=appearance.style==='image'?PreVisionI18n.t('ground.changeImage'):PreVisionI18n.t('ground.importImage');
  Object.entries(GROUND_QUICK_BUTTONS).forEach(([preset,id])=>{
    const button=$(id),active=preset===quickPreset;if(!button)return;
    button.classList.toggle('on',active);button.setAttribute('aria-pressed',String(active));
  });
  if(status){
    const asset=appearance.style==='image'&&project.assets&&project.assets[appearance.asset];
    const statusKey=quickPreset==='light'?'ground.lightGray':quickPreset==='dark'?'ground.darkGray':GROUND_STYLE_KEYS[appearance.style];
    status.textContent=appearance.style==='image'&&asset?PreVisionI18n.t('ground.imageDimensions',{width:asset.w,height:asset.h}):PreVisionI18n.t(statusKey);
  }
}
function refreshBgUI(){
  const bg=curScene()&&curScene().bg, on=!!(bg&&bg.asset);
  ['panoYaw','panoRad','panoY','clearPano','panoGP'].forEach(id=>{ const el=$(id); if(el) el.disabled=!on; });
  if(!$('panoYawLabel')) return;
  const camH=on?(bg.y!==undefined?bg.y:1.6):0;
  $('panoYawLabel').textContent=on?(bg.yaw||0)+'°':'–';
  $('panoRadLabel').textContent=on?(bg.radius||SKY_BASE_R)+'m':'–';
  $('panoYLabel').textContent=on?camH.toFixed(1)+'m':'–';
  if(on){ $('panoYaw').value=bg.yaw||0; $('panoRad').value=bg.radius||SKY_BASE_R; $('panoY').value=camH; $('panoGP').checked=bg.gp!==false; }
  refreshGroundUI();
}
$('groundStyle').onchange=e=>{
  const style=e.target.value,current=currentGroundAppearance();
  if(style==='image'&&current.style!=='image'){$('groundFile').click();e.target.value=current.style;return;}
  setGroundAppearance(style==='color'?{style,color:current.color||$('groundColor').value||GROUND_DEFAULT_COLOR}:style==='image'?current:{style});
};
$('groundColor').oninput=e=>setGroundAppearance({style:'color',color:e.target.value});
Object.entries(GROUND_QUICK_BUTTONS).forEach(([preset,id])=>{$(id).onclick=()=>setGroundAppearance(GROUND_QUICK_PRESETS[preset]);});
$('loadGroundImage').onclick=()=>$('groundFile').click();
$('groundFile').onchange=e=>{
  const f=e.target.files&&e.target.files[0];if(!f)return;e.target.value='';
  importImage(f,2048,2048,id=>setGroundAppearance({style:'image',asset:id}));
};
$('loadPano').onclick=()=>{ bgLoadMode='pano'; $('bgFile').click(); };
$('addBoard').onclick=()=>{ bgLoadMode='board'; $('bgFile').click(); };
$('bgFile').onchange=e=>{
  const f=e.target.files && e.target.files[0]; if(!f) return; e.target.value='';
  if(bgLoadMode==='pano'){
    importImage(f, 4096, 2048, id=>{
      const a=project.assets[id];
      if(a && Math.abs(a.w/a.h-2)>0.35) alert(PreVisionI18n.t('runtime.panorama.ratioWarning',{ratio:(a.w/a.h).toFixed(2)}));
      curScene().bg={asset:id, yaw:0, radius:SKY_BASE_R, y:1.6, gp:true};
      buildSky(); updatePrompt(); markDirty();
    });
  } else {
    importImage(f, 2048, 2048, id=>{
      buildActor({kind:'board', label:'板'+(actors.filter(x=>x.kind==='board').length+1), asset:id, pos:[0,-10], rotY:0, path:[]});
      refreshObjList(); updatePrompt(); markDirty();
    });
  }
};
$('panoYaw').oninput=e=>{if(automaticCaptureMutationBlocked())return false;const bg=curScene().bg; if(!bg) return; bg.yaw=parseInt(e.target.value);
  if(sky) sky.rotation.y=bg.yaw*Math.PI/180; $('panoYawLabel').textContent=bg.yaw+'°'; markDirty(); };
$('panoRad').oninput=e=>{if(automaticCaptureMutationBlocked())return false;const bg=curScene().bg; if(!bg) return; bg.radius=parseInt(e.target.value);
  buildSky(); markDirty(); };   // 半径影响地面投影, 重建几何
$('panoY').oninput=e=>{if(automaticCaptureMutationBlocked())return false;const bg=curScene().bg; if(!bg) return; bg.y=parseFloat(e.target.value);
  buildSky(); markDirty(); };   // 拍摄高度影响地面投影, 重建几何
$('panoGP').onchange=e=>{if(automaticCaptureMutationBlocked())return false;const bg=curScene().bg; if(!bg) return; bg.gp=!!e.target.checked;
  buildSky(); markDirty(); };
$('clearPano').onclick=()=>{
  if(automaticCaptureMutationBlocked())return false;
  if(!hasBg()) return;
  curScene().bg=null; buildSky(); updatePrompt(); markDirty();
};

/* ---- 数值拖拽(UE 式 scrubbing): 按住数值标签左右拖修改对应滑杆 ---- */
function attachScrub(labelId, inputId){
  const lb=$(labelId), inp=$(inputId); if(!lb||!inp) return;
  lb.classList.add('scrubbable'); lb.title=PreVisionI18n.t('runtime.scrub.title');
  lb.addEventListener('pointerdown', e=>{
    if(e.preventDefault) e.preventDefault();
    const pointerId=e.pointerId,startX=e.clientX, start=parseFloat(inp.value)||0;let active=true;
    try{lb.setPointerCapture(pointerId);}catch(_e){}
    const min=parseFloat(inp.min), max=parseFloat(inp.max), step=parseFloat(inp.step)||1;
    const scale=(max-min)/240;   // 拖满 240px = 全量程
    const move=ev=>{
      if(ev.pointerId!==undefined&&pointerId!==undefined&&ev.pointerId!==pointerId)return;
      let v=start+(ev.clientX-startX)*scale;
      v=Math.round(v/step)*step;
      v=Math.max(min,Math.min(max,+v.toFixed(2)));
      inp.value=v;
      if(inp.oninput) inp.oninput({target:inp});
    };
    const up=ev=>{
      if(ev?.pointerId!==undefined&&pointerId!==undefined&&ev.pointerId!==pointerId)return;
      if(!active)return;active=false;window.removeEventListener('pointermove',move);window.removeEventListener('pointerup',up);window.removeEventListener('pointercancel',up);window.removeEventListener('blur',up);lb.removeEventListener('lostpointercapture',up);
      try{lb.releasePointerCapture(pointerId);}catch(_e){}if(typeof Event==='function')inp.dispatchEvent(new Event('change',{bubbles:true}));
    };
    window.addEventListener('pointermove',move);window.addEventListener('pointerup',up);window.addEventListener('pointercancel',up);window.addEventListener('blur',up);lb.addEventListener('lostpointercapture',up);
  });
}
[['fovLabel','fov'],['cphLabel','camPtY'],
 ['yawLabel','yaw'],['pitchLabel','pitch'],['scaleLabel','objScale'],['objHeightLabel','objHeight'],['jointVal','jointA'],
 ['sunXLabel','sunX'],['sunYLabel','sunY'],['sunZLabel','sunZ'],['sunIntensityLabel','sunIntensity'],['sunTempLabel','sunTemp'],['sunAmbientLabel','sunAmbient'],['sunSoftLabel','sunSoft'],
 ['panoYawLabel','panoYaw'],['panoRadLabel','panoRad'],['panoYLabel','panoY']]
  .forEach(([l,i])=>attachScrub(l,i));

/* 快捷键 */
function isTextEditingTarget(target){
  if(target?.isContentEditable||target?.tagName==='TEXTAREA')return true;
  if(target?.tagName!=='INPUT')return false;
  const type=(target.getAttribute?.('type')||target.type||'text').toLowerCase();return ['text','search','email','url','tel','password'].includes(type);
}
function isEditableShortcutTarget(target){
  for(let node=target;node;node=node.parentElement){
    if(node.isContentEditable)return true;
    if(['INPUT','TEXTAREA','SELECT'].includes(node.tagName))return true;
    const contentEditable=node.getAttribute?.('contenteditable');
    if(contentEditable!==null&&String(contentEditable).toLowerCase()!=='false')return true;
  }
  return false;
}
function isProjectFileAccelerator(event){
  return !!(event.ctrlKey||event.metaKey)&&!event.altKey&&!event.shiftKey&&['s','o'].includes(String(event.key||'').toLowerCase());
}
function isBareWorkspaceShortcut(event){return !event.ctrlKey&&!event.metaKey&&!event.altKey&&!event.shiftKey;}
window.addEventListener('keydown', e=>{
  if(e.defaultPrevented||e.isComposing||e.keyCode===229)return;
  if(!workspaceOwnsGlobalCommand(e)){
    if(isProjectFileAccelerator(e))e.preventDefault();
    if(e.key==='Escape')e.stopPropagation();
    return;
  }
  if((e.ctrlKey||e.metaKey)&&e.shiftKey&&(e.key==='f'||e.key==='F')){e.preventDefault();setDirectorFocus();return;}
  if(e.key==='Escape'){
    if(UI_MENU_PAIRS.some(([menuId])=>$(menuId).classList.contains('open'))){closeUIMenus();e.preventDefault();return;}
    if($('appWorkspace').dataset.right==='peek'||$('right').classList.contains('peek')){restoreRightPanelAfterPeek();e.preventDefault();return;}
    if($('appWorkspace').classList.contains('director-focus')){setDirectorFocus(false);e.preventDefault();return;}
    if(globalThis.cancelUnifiedCameraDraft?.()){e.preventDefault();return;}
    select(null);return;
  }
  if((e.ctrlKey||e.metaKey)&&!e.altKey&&!e.shiftKey&&(e.key==='z'||e.key==='Z')){
    if(isEditableShortcutTarget(e.target))return;
    e.preventDefault();undoLast();return;
  }
  if((e.ctrlKey||e.metaKey)&&(e.key==='s'||e.key==='S')){ e.preventDefault(); saveProjectFile(); return; }
  if(!isBareWorkspaceShortcut(e))return;
  const textEditing=isTextEditingTarget(e.target);
  if(e.code==='Space'){
    if(textEditing)return;e.preventDefault();if(!e.repeat)$('playBtn').click();return;
  }
  if(e.code==='KeyK'){
    if(textEditing)return;e.preventDefault();if(!e.repeat)commitPendingPreviewKeys('manual');return;
  }
  if(['INPUT','TEXTAREA','SELECT'].includes(e.target?.tagName)||e.target?.isContentEditable) return;
  if(e.key==='ArrowLeft')$('prevShot').click();
  else if(e.key==='ArrowRight')$('nextShot').click();
  else if(e.key==='g'||e.key==='G')$('modeMove').click();
  else if(e.key==='r'||e.key==='R')$('modeRot').click();
  else if(e.key==='c'||e.key==='C')$('camDrive').click();
  else if(e.key==='f'||e.key==='F')$('fitAll').click();
  else if(e.key==='Delete'||e.key==='Backspace'){e.preventDefault();routeTimelineDeleteCommand();}
});

/* ============ 启动: 恢复自动保存或新建 ============ */
(function boot(){
  activateStartupProject(readStartupProject(),()=>{
    setLeftPanelState(uiRead(RAILC_KEY)==='1'?'rail':'expanded',false);
    setRightPanelState(uiRead(RIGHTC_KEY)==='1'?'rail':'expanded',false);
  });
  uiAppReady=true;
  const savedTimeline=uiRead(TIMELINE_STATE_KEY),legacyTimeline=uiRead('previz_motion_open');
  setTimelineState(initialTimelineState(savedTimeline,legacyTimeline),false);
  setDirectorFocus(false);
  initHistory();
  if(!flushScheduledUIResize())resize(true);requestAnimationFrame(loop);
})();
