/* ============ UI Shell v3: themes, panels, and Director Focus ============ */
const THEME_KEY='previz_ui_theme',RAILC_KEY='previz_railc',RIGHTC_KEY='previz_rightc',TIMELINE_STATE_KEY='previz_timeline_state';
const UI_THEMES=['graphite','mist','twilight','amber'];
const UI_THEME_KEYS={graphite:'theme.graphite',mist:'theme.mist',twilight:'theme.twilight',amber:'theme.amber'};
const UI_THEME_BUTTONS={graphite:'themeGraphite',mist:'themeMist',twilight:'themeTwilight',amber:'themeAmber'};
const UI_MENU_PAIRS=[['menuProject','menuProjectTrigger'],['menuEdit','menuEditTrigger'],['menuView','menuViewTrigger'],['themeMenu','themeTrigger'],['topSnapMenu','topSnap'],['topRecordMenu','topRecordMore']];
let lastRightStable='expanded',uiAppReady=false,uiResizePending=false,uiResizeForce=false;
let inspectorScrollRequest=0,inspectorScrollCleanup=null,inspectorRightLayoutPending=false,inspectorScrollPending=false;
function uiRead(key){try{return localStorage.getItem(key)}catch(_e){return null}}
function uiWrite(key,value){try{localStorage.setItem(key,String(value))}catch(_e){}}
function scheduleUIResize(force=true){uiResizePending=true;uiResizeForce=uiResizeForce||force;}
function flushScheduledUIResize(){
  if(!uiResizePending)return false;
  const force=uiResizeForce;uiResizePending=false;uiResizeForce=false;
  resize(force);if(typeof updateMotionPlayhead==='function')updateMotionPlayhead();return true;
}
initPlaybackResizeBindings();
function updateLayoutStatus(){
  const w=$('appWorkspace'),out=$('statusLayout');if(!w||!out)return;
  const left=w.dataset.left==='rail'?PreVisionI18n.t('panel.scene.rail'):PreVisionI18n.t('panel.scene.expanded');
  const right=w.dataset.right==='expanded'?PreVisionI18n.t('panel.properties.expanded'):(w.dataset.right==='peek'?PreVisionI18n.t('panel.properties.drawer'):PreVisionI18n.t('panel.properties.rail'));
  const timeline=w.dataset.timeline==='full'?PreVisionI18n.t('timeline.tracks'):PreVisionI18n.t('timeline.compact');
  out.textContent=`${left} · ${right} · ${timeline}`;
}
function setUITheme(theme,persist=true){
  const next=UI_THEMES.includes(theme)?theme:'graphite',root=document.documentElement||document.body;
  root.dataset.theme=next;
  const label=PreVisionI18n.t(UI_THEME_KEYS[next]);if($('themeLabel'))$('themeLabel').textContent=label;if($('statusTheme'))$('statusTheme').textContent=label;
  Object.entries(UI_THEME_BUTTONS).forEach(([name,id])=>{const button=$(id);if(button){button.classList.toggle('on',name===next);button.setAttribute('aria-checked',name===next?'true':'false');}});
  if(persist)uiWrite(THEME_KEY,next);
  if(uiAppReady)requestAnimationFrame(()=>drawMotionCurve());
  return next;
}
function setLeftPanelState(state,persist=true){
  const next=state==='rail'?'rail':'expanded',rail=$('sceneRail'),workspace=$('appWorkspace'),toggle=$('railToggle');
  workspace.dataset.left=next;rail.classList.toggle('collapsed',next==='rail');$('modeScenes').classList.toggle('on',next==='expanded');
  const toggleLabel=next==='expanded'?PreVisionI18n.t('panel.scene.collapse'):PreVisionI18n.t('panel.scene.expand');
  toggle.setAttribute('aria-expanded',next==='expanded'?'true':'false');toggle.setAttribute('aria-label',toggleLabel);toggle.title=toggleLabel;
  if(persist)uiWrite(RAILC_KEY,next==='rail'?'1':'0');updateLayoutStatus();scheduleUIResize();return next;
}
function setRightPanelState(state,persist=true){
  cancelInspectorScroll();
  const next=['expanded','rail','peek'].includes(state)?state:'expanded',right=$('right'),workspace=$('appWorkspace');
  if(next!=='peek')lastRightStable=next;
  workspace.dataset.right=next;workspace.classList.toggle('right-collapsed',next!=='expanded');right.classList.toggle('collapsed',next!=='expanded');right.classList.toggle('peek',next==='peek');
  inspectorRightLayoutPending=true;
  $('rightToggle').setAttribute('aria-expanded',next==='expanded'?'true':'false');
  if(persist&&next!=='peek')uiWrite(RIGHTC_KEY,next==='rail'?'1':'0');updateLayoutStatus();scheduleUIResize();return next;
}
function restoreRightPanelAfterPeek(){
  cancelInspectorScroll();
  if($('appWorkspace').dataset.right==='peek')setRightPanelState(lastRightStable,false);
  else if($('right').classList.contains('peek')){$('right').classList.remove('peek');scheduleUIResize();}
}
function setTimelineState(state,persist=true){
  const next=state==='hidden'||state==='filmstrip'?'hidden':'full',workspace=$('appWorkspace'),panel=$('motionPanel'),toggle=$('motionToggle'),railMode=$('modeTimeline');
  workspace.dataset.timeline=next;panel.classList.toggle('open',next==='full');toggle.classList.toggle('on',next==='full');toggle.setAttribute('aria-expanded',next==='full'?'true':'false');
  toggle.title=next==='full'?PreVisionI18n.t('timeline.collapseTracks'):PreVisionI18n.t('timeline.expandTracks');
  const railLabel=next==='full'?PreVisionI18n.t('timeline.currentFull'):PreVisionI18n.t('timeline.currentCompact');
  railMode.dataset.tooltip=railLabel;railMode.setAttribute('aria-label',railLabel);
  if(persist){uiWrite(TIMELINE_STATE_KEY,next);uiWrite('previz_motion_open',next==='full'?'1':'0');}
  if(project)refreshMotionTimeline();updateLayoutStatus();scheduleUIResize();return next;
}
function initialTimelineState(saved,legacy){
  if(saved==='full'||saved==='hidden')return saved;
  if(saved==='filmstrip')return 'hidden';
  return legacy==='0'?'hidden':'full';
}
function cycleTimelineState(){return setTimelineState($('appWorkspace').dataset.timeline==='full'?'hidden':'full');}
function setDirectorFocus(force){
  cancelInspectorScroll();
  const workspace=$('appWorkspace'),on=typeof force==='boolean'?force:!workspace.classList.contains('director-focus');workspace.classList.toggle('director-focus',on);
  inspectorRightLayoutPending=true;
  if(!on&&workspace.dataset.right!=='peek')$('right').classList.remove('peek');
  ['directorFocus','modeFocus'].forEach(id=>{const button=$(id);button.classList.toggle('on',on);button.setAttribute('aria-pressed',on?'true':'false');});
  if($('statusProject'))$('statusProject').textContent=on?PreVisionI18n.t('status.focusLocalProject'):PreVisionI18n.t('status.localProject');scheduleUIResize();return on;
}
function closeUIMenus(except=''){
  UI_MENU_PAIRS.forEach(([menuId,triggerId])=>{if(menuId===except)return;const menu=$(menuId),trigger=$(triggerId);if(menu)menu.classList.remove('open');if(trigger)trigger.setAttribute('aria-expanded','false');});
}
function toggleUIMenu(menuId,triggerId){
  const menu=$(menuId),trigger=$(triggerId),open=!menu.classList.contains('open');closeUIMenus();if(open){menu.classList.add('open');trigger.setAttribute('aria-expanded','true');}return open;
}
function cancelInspectorScroll(){
  inspectorScrollRequest++;
  inspectorScrollPending=false;
  if(inspectorScrollCleanup){inspectorScrollCleanup();inspectorScrollCleanup=null;}
}
function inspectorScrollIsSettled(){return !inspectorScrollPending&&!inspectorRightLayoutPending;}
function scrollInspectorSummary(target,requestId){
  if(requestId!==inspectorScrollRequest)return;
  const scroll=$('rightScroll'),summary=target?.querySelector?.('summary');
  if(!scroll||!summary||typeof scroll.getBoundingClientRect!=='function'||typeof summary.getBoundingClientRect!=='function'){
    try{target?.scrollIntoView?.({block:'nearest'});}catch(_e){}scheduleUIResize();return;
  }
  const outer=scroll.getBoundingClientRect(),rect=summary.getBoundingClientRect();
  const delta=rect.top<outer.top?rect.top-outer.top:(rect.bottom>outer.bottom?rect.bottom-outer.bottom:0);
  if(delta){
    const max=Math.max(0,(scroll.scrollHeight||0)-(scroll.clientHeight||0)),top=Math.max(0,Math.min(max,(scroll.scrollTop||0)+delta));
    if(typeof scroll.scrollTo==='function')scroll.scrollTo({top,behavior:'auto'});else scroll.scrollTop=top;
  }
  scheduleUIResize();
}
function inspectorScrollGeometry(target,scroll,right){
  const summary=target?.querySelector?.('summary');
  if(!scroll||!right||!summary||typeof scroll.getBoundingClientRect!=='function'||typeof right.getBoundingClientRect!=='function'||typeof summary.getBoundingClientRect!=='function')return null;
  const outer=scroll.getBoundingClientRect(),rightRect=right.getBoundingClientRect(),summaryRect=summary.getBoundingClientRect();
  const values=[rightRect.width,rightRect.height,outer.top,outer.bottom,outer.width,outer.height,summaryRect.top,summaryRect.bottom,summaryRect.height,scroll.scrollTop||0];
  return values.every(Number.isFinite)?values:null;
}
function sameInspectorScrollGeometry(a,b){return !!a&&!!b&&a.length===b.length&&a.every((value,index)=>Math.abs(value-b[index])<.5);}
function scheduleInspectorScroll(target){
  cancelInspectorScroll();
  const requestId=++inspectorScrollRequest,scroll=$('rightScroll'),right=$('right');inspectorScrollPending=true;let done=false,resizeObserver=null,frame=0;
  const finish=()=>{
    if(done||requestId!==inspectorScrollRequest)return;done=true;
    inspectorRightLayoutPending=false;inspectorScrollPending=false;inspectorScrollCleanup?.();inspectorScrollCleanup=null;scrollInspectorSummary(target,requestId);
  };
  const cancel=()=>{if(requestId===inspectorScrollRequest)cancelInspectorScroll();};
  const cleanup=()=>{
    if(!scroll||!right)return;
    resizeObserver?.disconnect?.();resizeObserver=null;if(frame&&typeof cancelAnimationFrame==='function')cancelAnimationFrame(frame);frame=0;
    ['wheel','touchstart','pointerdown','keydown'].forEach(type=>scroll.removeEventListener?.(type,cancel));
  };
  const waitForStableGeometry=()=>{
    let lastGeometry=null,stableFrames=0,resizeRevision=0,seenRevision=0;
    if(typeof ResizeObserver==='function'&&right){resizeObserver=new ResizeObserver(()=>{resizeRevision++;stableFrames=0;});resizeObserver.observe(right);}
    const check=()=>{
      if(requestId!==inspectorScrollRequest)return;
      const geometry=inspectorScrollGeometry(target,scroll,right);
      if(!geometry){finish();return;}
      const running=typeof right.getAnimations==='function'&&right.getAnimations({subtree:false}).some(animation=>animation.playState==='running');
      if(running||!sameInspectorScrollGeometry(geometry,lastGeometry)||seenRevision!==resizeRevision)stableFrames=0;else stableFrames++;
      lastGeometry=geometry;seenRevision=resizeRevision;
      if(stableFrames>=2)finish();else frame=requestAnimationFrame(check);
    };
    frame=requestAnimationFrame(check);
  };
  inspectorScrollCleanup=cleanup;
  ['wheel','touchstart','pointerdown','keydown'].forEach(type=>scroll?.addEventListener?.(type,cancel,{passive:true}));
  waitForStableGeometry();
}
function openInspector(index,sourceId){
  const sections=Array.from(document.querySelectorAll('#rightScroll > details.sec')),target=sections[index];if(!target)return;
  const focus=$('appWorkspace').classList.contains('director-focus'),needsWidthTransition=!focus&&$('appWorkspace').dataset.right!=='expanded';
  if(focus){$('right').classList.add('peek');scheduleUIResize();}
  else if(needsWidthTransition)setRightPanelState('expanded');target.open=true;
  document.querySelectorAll('.right-rail-btn').forEach(button=>button.classList.remove('on'));if(sourceId&&$(sourceId))$(sourceId).classList.add('on');
  scheduleInspectorScroll(target);
}
setUITheme(uiRead(THEME_KEY)||'graphite',true);

/* ---- Environment and assets (subsystems B + H) moved to stage/environment.js
 * (refactor P6, ADR-0012). Mutable owners configuredRendererCount/assetTex/sky/
 * exportLookActive are provided by that module's live accessor shim, so they are
 * intentionally not imported through the bridge snapshot list. ---- */
import {
  canvas,
  configureRenderer,
  renderer,
  scene,
  viewCam,
  shotCam,
  ambientLight,
  key,
  sunTarget,
  DEFAULT_SUN,
  cleanSun,
  kelvinColor,
  currentSun,
  fitSunShadowCamera,
  applySunSettings,
  sunGizmoPosition,
  markSharedThreeTexture,
  isSharedThreeTexture,
  collectOwnedMaterialTextures,
  disposeOwnedThreeResource,
  disposeOwnedObject3D,
  GROUND_CHECKER_LIGHT,
  GROUND_CHECKER_DARK,
  GROUND_CHECKER_REPEAT,
  groundTex,
  ground,
  grid,
  groundBorder,
  orbit,
  applyOrbit,
  setOrbitPivotKeepView,
  assetTextureReady,
  SKY_BASE_R,
  disposeAssetTextureCache,
  addAsset,
  importImage,
  assetTexture,
  hasBg,
  buildSky,
  groundDefaultMat,
  shadowOnlyMat,
  GROUND_DEFAULT_COLOR,
  cleanGroundAppearance,
  currentGroundAppearance,
  applyGroundAppearance,
  setGroundAppearance,
  updateLabelScales,
  updateLabelVisibility,
  setExportLook,
  gcAssets,
} from './stage/environment.js';
/* Source anchor for the legacy smoke regex after P6 bridge reprinting:
 * function buildSky(){ if(sky){ scene.remove(sky); disposeOwnedObject3D(sky); sky=null; } */
/* ---- Modeling factory (subsystem C) moved to stage/factory.js (refactor P5,
 * ADR-0011). Same bridge mechanism as P1-P4 (ADR-0007): the build strips these imports
 * and re-exposes every name on globalThis, keeping runtime global semantics identical
 * to the pre-split single script. Semantic/pose helpers still shared with the remnant
 * (semanticLabel, POSE_ZH, poseText) stay below
 * until their own stage. ---- */
import {
  STAGE_LIMIT,
  mat,
  SEMANTIC_PROXY_TYPES,
  SEMANTIC_PROXY_BY_ID,
  semanticProxyType,
  applySemanticMaterial,
  applySemanticDimensions,
  setActorSemanticType,
  actorRebuildData,
  replaceActorSemanticType,
  makeCharacter,
  POSE_LABEL_KEYS,
  POSE_JOINTS,
  HORSE_RIDE_JOINTS,
  LEGACY_RIDE_JOINT_DEFAULTS,
  horseRideHost,
  migrateHorseRideJoints,
  applyJoints,
  applyPose,
  makeCar,
  makeHorse,
  makeProp,
  envMat,
  makeWall,
  makePillar,
  jitterGeo,
  flatMat,
  makeTree,
  makeMountain,
  makeHouse,
  makeRock,
  makeBush,
  makeDog,
  makeRoad,
  DESERT_SIZE,
  DESERT_SEGMENTS,
  DESERT_EDGE_HEIGHT,
  desertHeightProfile,
  makeDesert,
  makeBoard,
  ENV_KINDS,
  makeLabel,
  labelY,
} from './stage/factory.js';

/* Right rail resizing is shell state: it only affects local UI preferences and render sizing. */
const RIGHTW_KEY='previz_rightw';
(function initRightResize(){
  const bar=document.getElementById('dragbar'), right=document.getElementById('right');
  const minWidth=280,defaultWidth=336,maxWidth=()=>Math.max(minWidth,window.innerWidth<=1160?300:Math.floor(window.innerWidth*.5));
  const applyWidth=w=>{
    const max=maxWidth(),value=Math.max(minWidth,Math.min(max,w));right.style.width=value+'px';
    bar.setAttribute('aria-valuemin',String(minWidth));bar.setAttribute('aria-valuemax',String(max));bar.setAttribute('aria-valuenow',String(value));return value;
  };
  const saved=parseInt(uiRead(RIGHTW_KEY)||'');
  if(saved>=minWidth) applyWidth(saved);else applyWidth(defaultWidth);
  let on=false;
  bar.addEventListener('pointerdown',e=>{
    if(right.classList.contains('collapsed')||$('appWorkspace').classList.contains('director-focus'))return;
    on=true;bar.classList.add('on');right.classList.add('resizing');bar.focus();
    if(bar.setPointerCapture&&e.pointerId!==undefined)bar.setPointerCapture(e.pointerId);
  });
  window.addEventListener('pointermove',e=>{if(on){applyWidth(window.innerWidth-e.clientX);scheduleUIResize(false);}});
  const finish=()=>{if(!on)return;on=false;bar.classList.remove('on');right.classList.remove('resizing');try{localStorage.setItem(RIGHTW_KEY,parseInt(right.style.width)||defaultWidth);}catch(_error){}scheduleUIResize(false);};
  window.addEventListener('pointerup',finish);window.addEventListener('pointercancel',finish);
  bar.addEventListener('dblclick',()=>{if(!right.classList.contains('collapsed')){applyWidth(defaultWidth);uiWrite(RIGHTW_KEY,defaultWidth);scheduleUIResize(false);}});
  bar.addEventListener('keydown',e=>{if(right.classList.contains('collapsed')||!['ArrowLeft','ArrowRight','Home'].includes(e.key))return;e.preventDefault();e.stopPropagation();const current=parseInt(right.style.width)||defaultWidth;applyWidth(e.key==='Home'?defaultWidth:current+(e.key==='ArrowLeft'?16:-16));uiWrite(RIGHTW_KEY,parseInt(right.style.width)||defaultWidth);scheduleUIResize(false);});
  window.addEventListener('resize',()=>{applyWidth(parseInt(right.style.width)||right.getBoundingClientRect().width||defaultWidth);scheduleUIResize(false);});
})();
