/* P9 persistence fragment: history, autosave, project open/save, and downloads. */
/* ---- 本地持久化 ---- */
const AUTOSAVE_KEY='previz_autosave_v3';
function cloneProjectAssets(assets){
  const out=Object.create(null);
  Object.keys(assets||{}).forEach(id=>{const asset=assets[id];out[id]={d:asset.d,w:asset.w,h:asset.h};});
  return out;
}
function isRestorableProject(data){try{normalizeProjectData(data);return true;}catch(_error){return false;}}
function readStartupProject(storage){
  if(arguments.length===0){
    try{storage=globalThis.localStorage;}catch(error){return {state:'unavailable',project:newProject(),error};}
  }
  let raw;
  try{
    if(!storage||typeof storage.getItem!=='function')throw new Error('Storage unavailable');
    raw=storage.getItem(AUTOSAVE_KEY);
  }catch(error){return {state:'unavailable',project:newProject(),error};}
  if(raw===null)return {state:'firstRun',project:makeFirstRunWelcomeProject()};
  let value;
  try{value=JSON.parse(raw);}catch(error){return {state:'invalid',project:newProject(),raw,error};}
  try{return {state:'restored',project:normalizeProjectData(value),raw};}
  catch(error){return {state:'invalid',project:newProject(),raw,error};}
}
function startupStatusKey(state){
  return state==='restored'?'startup.restored':state==='invalid'?'startup.invalidAutosave':state==='unavailable'?'startup.storageUnavailable':'';
}
let startupState='firstRun';
function activateStartupProject(startup,beforeLoad){
  startupState=startup.state;project=startup.project;project.version=PROJECT_VERSION;
  project.assets=project.assets||{};project.settings=project.settings||{collision:true,labels:true};
  $('projname').value=project.name||PreVisionI18n.t('project.untitled');
  if(project.aspect&&SEED_RES[project.aspect]){
    $('aspect').value=project.aspect;
    [aspectW,aspectH]=project.aspect.split(':').map(Number);
    const r=SEED_RES[project.aspect];$('resLabel').textContent=r[0]+'×'+r[1];
  }
  const statusKey=startupStatusKey(startupState);if(statusKey)$('saveState').textContent=PreVisionI18n.t(statusKey);
  $('collisionOn').checked=project.settings.collision!==false;
  $('showLabels').checked=project.settings.labels!==false;
  if(typeof beforeLoad==='function')beforeLoad();
  sceneRailLevel='scenes';loadScene(0,true);return project;
}
let dirtyTimer=null;
const UNDO_LIMIT=100;
let undoStack=[], historyCurrent=null, historyTimer=null, historyPending=false, historyRestoring=false,historyCommitSequence=0,historyLifecycleSequence=0;
let historyAssetBank=Object.create(null);
function updateUndoUI(){
  const b=document.getElementById('undoBtn'); if(!b) return;
  b.disabled=undoStack.length===0;
  b.title=undoStack.length?PreVisionI18n.t('runtime.undo.available',{count:undoStack.length}):PreVisionI18n.t('runtime.undo.empty');
}
function captureHistoryState(){
  Object.assign(historyAssetBank,project.assets||{});
  const scenes=project.scenes.slice();
  if(scenes[sceneIdx]) scenes[sceneIdx]=stageToData();
  const snapProject=Object.assign({},project,{
    name:$('projname').value||project.name,
    aspect:$('aspect').value||project.aspect,
    assets:{}, scenes
  });
  return JSON.stringify({project:snapProject,sceneIdx,shotIdx,selectedLabel:selected&&selected.label,previewAnimation:serializePreviewAnimationState()});
}
function commitHistoryCapture(){
  historyLifecycleSequence++;
  if(historyTimer){ clearTimeout(historyTimer); historyTimer=null; }
  if(!historyPending||historyRestoring||!historyCurrent) return;
  historyPending=false;
  const automaticTransaction=automaticCaptureMutationBlocked()?currentCaptureTransaction():null;
  let next;
  if(automaticTransaction?.pendingHistoryState){
    Object.assign(historyAssetBank,project.assets||{});next=automaticTransaction.pendingHistoryState;automaticTransaction.pendingHistoryState=null;
  }else next=captureHistoryState();
  if(next===historyCurrent) return;
  undoStack.push(historyCurrent);
  if(undoStack.length>UNDO_LIMIT) undoStack.shift();
  historyCurrent=next;historyCommitSequence++;updateUndoUI();
}
function queueHistoryCapture(){
  if(historyRestoring||!historyCurrent) return;
  historyPending=true;
  if(historyTimer) clearTimeout(historyTimer);
  if(typeof previewAutoTransactions!=='undefined'&&previewAutoTransactions.size){historyTimer=null;return;}
  historyTimer=setTimeout(commitHistoryCapture,250);
}
function commitPreviewHistoryTransaction(before=historyCurrent){
  if(historyRestoring||!before)return false;
  if(historyTimer){clearTimeout(historyTimer);historyTimer=null;}
  historyPending=false;
  let nextState;try{nextState=JSON.parse(before);}catch(_e){return false;}
  nextState.previewAnimation=serializePreviewAnimationState();
  const next=JSON.stringify(nextState);if(next===before)return false;
  undoStack.push(before);if(undoStack.length>UNDO_LIMIT)undoStack.shift();
  historyCurrent=next;historyCommitSequence++;updateUndoUI();return true;
}
function initHistory(){
  if(automaticCaptureMutationBlocked())return false;
  undoStack=[]; historyPending=false; historyRestoring=false;
  if(historyTimer) clearTimeout(historyTimer); historyTimer=null;
  historyAssetBank=cloneProjectAssets(project.assets||{});
  historyCurrent=captureHistoryState();historyCommitSequence++;updateUndoUI();
}
function undoLast(){
  if(automaticCaptureMutationBlocked())return false;
  globalThis.clearUnifiedCameraDraft?.();
  commitHistoryCapture();
  if(!undoStack.length){ updateUndoUI(); return; }
  const prev=JSON.parse(undoStack.pop());
  historyRestoring=true;
  try{
    Object.assign(historyAssetBank,project.assets||{});
    project=prev.project;
    project.assets=cloneProjectAssets(historyAssetBank);
    project.settings=project.settings||{collision:true,labels:true};
    $('projname').value=project.name||PreVisionI18n.t('project.untitled');
    if(project.aspect&&SEED_RES[project.aspect]){
      $('aspect').value=project.aspect;
      [aspectW,aspectH]=project.aspect.split(':').map(Number);
      const r=SEED_RES[project.aspect]; $('resLabel').textContent=r[0]+'×'+r[1];
    }
    const si=Math.max(0,Math.min(project.scenes.length-1,prev.sceneIdx||0));
    restorePreviewAnimationState(prev.previewAnimation);
    loadScene(si,true);
    if(shots.length) setShot(Math.max(0,Math.min(shots.length-1,prev.shotIdx||0)),true);
    select(actors.find(a=>a.label===prev.selectedLabel)||null);
    historyCurrent=captureHistoryState();
    markDirty();
  }finally{ historyRestoring=false; }
  updateUndoUI();
  $('saveState').textContent=PreVisionI18n.t('runtime.undo.restored',{count:undoStack.length});
}
function markDirty(){
  if(automaticCaptureMutationBlocked())return false;
  queueHistoryCapture();
  if(dirtyTimer) clearTimeout(dirtyTimer);
  dirtyTimer=setTimeout(flushPendingAutosave,800);
  return true;
}
function flushPendingAutosave(){
  if(!dirtyTimer)return false;
  clearTimeout(dirtyTimer);dirtyTimer=null;
  try{
    const target=automaticCaptureMutationBlocked()?currentCaptureTransaction()?.target:null;
    let autosaveProject=project;
    if(target){
      const scenes=project.scenes.slice();scenes[target.sceneIndex]=deepCopy(target.content.scene);
      autosaveProject=Object.assign({},project,{name:target.projectName,aspect:target.aspect,modified:new Date().toISOString(),scenes});
    }else{
      syncScene();gcAssets();project.name=$('projname').value;project.aspect=$('aspect').value;project.modified=new Date().toISOString();
    }
    try{
      localStorage.setItem(AUTOSAVE_KEY,JSON.stringify(autosaveProject));
      const t=new Date();
      $('saveState').textContent=PreVisionI18n.t('project.autosavedAt',{time:String(t.getHours()).padStart(2,'0')+':'+String(t.getMinutes()).padStart(2,'0')+':'+String(t.getSeconds()).padStart(2,'0')});
    }catch(error){
      try{
        localStorage.setItem(AUTOSAVE_KEY,JSON.stringify(Object.assign({},autosaveProject,{assets:{}})));
        $('saveState').textContent=PreVisionI18n.t('project.autosaveLite');
      }catch(liteError){$('saveState').textContent=PreVisionI18n.t('project.autosaveFailed');}
    }
  }catch(error){
    try{$('saveState').textContent=PreVisionI18n.t('project.autosaveFailed');}catch(statusError){}
  }
  return true;
}
window.addEventListener('pagehide',flushPendingAutosave);
window.addEventListener('beforeunload',flushPendingAutosave);
document.getElementById('undoBtn').onclick=undoLast;
async function saveProjectFile({bridge=desktop,download=dl,createObjectURL=blob=>URL.createObjectURL(blob)}={}){
  if(automaticCaptureMutationBlocked())return false;
  syncScene(); gcAssets();
  project.name=$('projname').value; project.aspect=$('aspect').value;
  project.modified=new Date().toISOString();
  const contents=JSON.stringify(project,null,2),name=project.name+'.previz.json';
  if(bridge){
    try{
      const out=await (bridge===desktop?desktop.saveProject(name,contents):bridge.saveProject(name,contents));if(out.canceled)return false;
      $('saveState').textContent=PreVisionI18n.t('project.savedPath',{path:out.path});return true;
    }catch(e){alert(PreVisionI18n.t('project.saveFailed',{message:e?.message||String(e)}));return false;}
  }else{
    try{
      await download(createObjectURL(new Blob([contents],{type:'application/json;charset=utf-8'})),name,{bridge:null});
      $('saveState').textContent=PreVisionI18n.t('project.savedLocal');return true;
    }catch(e){
      $('saveState').textContent=PreVisionI18n.t('project.saveFailed',{message:e?.message||String(e)});return false;
    }
  }
}
function clonePreviewMap(source,valueKind='map'){
  return Array.from(source.entries()).map(([key,value])=>[key,valueKind==='set'?Array.from(value):Array.from(value.entries())]);
}
function captureProjectOpenPreviewState(){
  return {serialized:serializePreviewAnimationState(),selection:Object.assign({},previewMotionSelection),autoKey:previewAutoKey,
    expanded:Array.from(motionExpandedGroups),known:Array.from(motionKnownGroups),pending:clonePreviewMap(previewPendingEdits),
    autoTransactions:Array.from(previewAutoTransactions),autoChannels:clonePreviewMap(previewAutoChannels,'set'),
    motionSelected:Object.assign({},motionSelected),motionSelection:Array.from(motionSelection),motionClipboard:motionClipboard?deepCopy(motionClipboard):null};
}
function restoreProjectOpenPreviewState(state){
  restorePreviewAnimationState(state.serialized);previewMotionSelection=Object.assign({},state.selection);previewAutoKey=!!state.autoKey;
  motionExpandedGroups.clear();state.expanded.forEach(value=>motionExpandedGroups.add(value));motionKnownGroups.clear();state.known.forEach(value=>motionKnownGroups.add(value));
  previewPendingEdits.clear();state.pending.forEach(([key,entries])=>previewPendingEdits.set(key,new Map(entries)));
  previewAutoTransactions.clear();state.autoTransactions.forEach(value=>previewAutoTransactions.add(value));
  previewAutoChannels.clear();state.autoChannels.forEach(([key,values])=>previewAutoChannels.set(key,new Set(values)));
  motionSelected=Object.assign({},state.motionSelected);motionSelection.clear();state.motionSelection.forEach(value=>motionSelection.add(value));motionClipboard=state.motionClipboard?deepCopy(state.motionClipboard):null;
  updatePreviewKeyControls();
}
function captureProjectOpenSnapshot(){
  const scenes=project.scenes.map((sceneData,index)=>deepCopy(index===sceneIdx?stageToData():sceneData));
  const projectData=Object.assign({},project,{name:$('projname').value||project.name,aspect:$('aspect').value||project.aspect,assets:cloneProjectAssets(project.assets||{}),scenes});
  return {project:projectData,sceneIdx,shotIdx,time,playing,playAllMode,sceneRailLevel,selectedLabel:selected?.label||'',selCamPt,selActorPt,
    pointPreview:{camera:previewCamPt,actor:previewActorPoint?{label:previewActorPoint.actor?.label||'',idx:previewActorPoint.idx}:null,
      actors:Array.from(previewActorPoints.entries()).map(([actor,index])=>[actor.label,index])},preview:captureProjectOpenPreviewState(),assetTex,
    aspectW,aspectH,startupState,ui:{projectName:$('projname').value,aspect:$('aspect').value,resLabel:$('resLabel').textContent,saveState:$('saveState').textContent,
      collision:$('collisionOn').checked,labels:$('showLabels').checked},history:{undoStack:undoStack.slice(),historyCurrent,historyPending,historyRestoring,
      historyTimer,historyAssetBank:cloneProjectAssets(historyAssetBank)}};
}
function restoreProjectOpenSnapshot(snapshot,{historyTimerWasReset=false}={}){
  project=snapshot.project;assetTex=snapshot.assetTex;aspectW=snapshot.aspectW;aspectH=snapshot.aspectH;startupState=snapshot.startupState;
  restoreProjectOpenPreviewState(snapshot.preview);
  $('projname').value=snapshot.ui.projectName;$('aspect').value=snapshot.ui.aspect;$('resLabel').textContent=snapshot.ui.resLabel;$('saveState').textContent=snapshot.ui.saveState;
  $('collisionOn').checked=snapshot.ui.collision;$('showLabels').checked=snapshot.ui.labels;
  sceneRailLevel=snapshot.sceneRailLevel;loadScene(snapshot.sceneIdx,true);setShot(Math.max(0,Math.min(shots.length-1,snapshot.shotIdx)),false);
  time=snapshot.time;playing=snapshot.playing;playAllMode=snapshot.playAllMode;selCamPt=snapshot.selCamPt;selActorPt=snapshot.selActorPt;
  select(actors.find(actor=>actor.label===snapshot.selectedLabel)||null);clearPointPreview();previewCamPt=snapshot.pointPreview.camera;
  snapshot.pointPreview.actors.forEach(([label,index])=>{const actor=actors.find(item=>item.label===label);if(actor)previewActorPoints.set(actor,index);});
  if(snapshot.pointPreview.actor){const actor=actors.find(item=>item.label===snapshot.pointPreview.actor.label);if(actor)previewActorPoint={actor,idx:snapshot.pointPreview.actor.idx};}
  undoStack=snapshot.history.undoStack.slice();historyCurrent=snapshot.history.historyCurrent;historyPending=snapshot.history.historyPending;historyRestoring=snapshot.history.historyRestoring;
  historyAssetBank=cloneProjectAssets(snapshot.history.historyAssetBank);if(historyTimerWasReset&&snapshot.history.historyTimer)historyTimer=setTimeout(commitHistoryCapture,250);else historyTimer=snapshot.history.historyTimer;
  scheduleUIResize(false);
  updateActors();updateShotCam();syncAll();updateUndoUI();
}
function applyNormalizedProject(normalized){
  project=normalized;assetTex=Object.create(null);$('projname').value=project.name||PreVisionI18n.t('project.untitled');
  $('aspect').value=project.aspect;[aspectW,aspectH]=project.aspect.split(':').map(Number);const resolution=SEED_RES[project.aspect];$('resLabel').textContent=resolution[0]+'×'+resolution[1];
  $('collisionOn').checked=project.settings.collision!==false;$('showLabels').checked=project.settings.labels!==false;
  clearPreviewAnimationState();motionExpandedGroups.clear();motionKnownGroups.clear();motionSelection.clear();motionClipboard=null;clearPointPreview();
  sceneRailLevel='scenes';loadScene(0,true);select(null);scheduleUIResize(false);
}
function reportProjectOpenError(error){
  const key=error?.code==='PREVISION_INVALID_PROJECT'?'project.invalidFile':'project.openFailed';
  alert(PreVisionI18n.t(key,{message:error?.message||PreVisionI18n.t('project.invalidFile')}));
}
function openProjectData(data){
  if(automaticCaptureMutationBlocked())return false;
  let normalized;try{normalized=normalizeProjectData(data);}catch(error){reportProjectOpenError(error);return false;}
  let snapshot;try{snapshot=captureProjectOpenSnapshot();}catch(error){reportProjectOpenError(error);return false;}
  let historyTimerWasReset=false;
  try{
    applyNormalizedProject(normalized);historyTimerWasReset=true;initHistory();markDirty();
  }catch(error){
    const rejectedAssetTex=assetTex;
    try{restoreProjectOpenSnapshot(snapshot,{historyTimerWasReset});}catch(restoreError){console.error('Project rollback failed',restoreError);}
    finally{if(rejectedAssetTex!==snapshot.assetTex)disposeAssetTextureCache(rejectedAssetTex);}
    reportProjectOpenError(error);return false;
  }
  disposeAssetTextureCache(snapshot.assetTex);return true;
}

/* Ground quick presets/buttons remain inspector UI ownership; they read environment colors through the bridge. */
/* 项目管理 */
function activateNewProject(loadSceneForNewProject=loadScene){
  if(automaticCaptureMutationBlocked())return false;
  let snapshot;try{snapshot=captureProjectOpenSnapshot();}catch(error){reportProjectOpenError(error);return false;}
  try{
    assetTex=Object.create(null);
    clearPreviewAnimationState();
    project=newProject(); $('projname').value=project.name;
    sceneRailLevel='scenes';loadSceneForNewProject(0,true);
  }catch(error){
    const rejectedAssetTex=assetTex;
    try{restoreProjectOpenSnapshot(snapshot);}catch(restoreError){console.error('Project rollback failed',restoreError);}
    finally{if(rejectedAssetTex!==snapshot.assetTex)disposeAssetTextureCache(rejectedAssetTex);}
    reportProjectOpenError(error);return false;
  }
  disposeAssetTextureCache(snapshot.assetTex);markDirty();return true;
}
$('btnNew').onclick=()=>{
  showConfirm(PreVisionI18n.t('runtime.project.newConfirm'),()=>{
    activateNewProject();
  });
};
$('btnSave').onclick=saveProjectFile;
async function openDesktopProject(){
  if(automaticCaptureMutationBlocked())return false;
  try{
    const out=await desktop.openProject();if(out.canceled)return;
    if(automaticCaptureMutationBlocked())return false;
    if(openProjectData(JSON.parse(out.contents)))$('saveState').textContent=PreVisionI18n.t('project.openedPath',{path:out.path});
  }catch(err){alert(PreVisionI18n.t('project.openFailed',{message:err.message}));}
}
$('btnOpen').onclick=()=>desktop?openDesktopProject():$('fileOpen').click();
function bindDesktopProjectCommands(bridge=desktop,commands={open:openDesktopProject,save:saveProjectFile}){
  if(!bridge)return false;
  bridge.onMenuOpenProject(()=>runWorkspaceCommand(commands.open));
  bridge.onMenuSaveProject(()=>runWorkspaceCommand(commands.save));
  return true;
}
bindDesktopProjectCommands();
$('fileOpen').onchange=e=>{
  const f=e.target.files[0]; if(!f) return;
  const r=new FileReader();
  r.onload=()=>{ try{ openProjectData(JSON.parse(r.result)); }catch(err){ alert(PreVisionI18n.t('project.openFailed',{message:err.message})); } };
  r.readAsText(f); e.target.value='';
};

/* Capture, recording, and Seedance bindings are owned by export/capture.js. */

/* ---- genPrompt camera-move analyzer (subsystem S) moved to export/prompt.js
 * (refactor P5, ADR-0011). Its RefreshHub 'prompt' registration moved with it; the
 * copyPrompt clipboard binding below stays here until its owning stage. ---- */
import { focalOf, charNDC, sampleShotState, genPrompt, updatePrompt } from './export/prompt.js';
$('copyPrompt').onclick=()=>{
  const t=genPrompt();
  if(navigator.clipboard) navigator.clipboard.writeText(t).then(()=>{$('copyPrompt').textContent=PreVisionI18n.t('runtime.prompt.copied');setTimeout(()=>$('copyPrompt').textContent=PreVisionI18n.t('runtime.prompt.copy'),1200)});
  else { updatePrompt(); alert(PreVisionI18n.t('runtime.prompt.manualCopy')); }
};

async function dl(url,name,{bridge=desktop,fetcher=window.fetch}={}){
  const isBlob=String(url).startsWith('blob:');let revoked=false;
  const revoke=()=>{if(!isBlob||revoked)return;revoked=true;try{URL.revokeObjectURL(url);}catch(error){captureDiagnostic('Blob URL revoke failed:',error);}};
  if(bridge){
    let out;
    try{
      const response=await fetcher(url),bytes=new Uint8Array(await response.arrayBuffer());
      out=await (bridge===desktop?desktop.saveExport(name,bytes):bridge.saveExport(name,bytes));
    }catch(e){throw e?.code?e:captureError('EXPORT_FAILED','export.failed',e.message);}
    finally{revoke();}
    if(out.canceled)throw captureError('EXPORT_CANCELLED','export.cancelled');
    setCaptureSaveStateSafely('export.saved',()=>out.path);return out;
  }
  let a=null,cleanupScheduled=false,cleaned=false;
  const cleanup=()=>{if(cleaned)return;cleaned=true;try{a?.remove();}catch(error){captureDiagnostic('Download anchor cleanup failed:',error);}finally{revoke();}};
  try{
    a=document.createElement('a');a.href=url;a.download=name;a.style.display='none';document.body.appendChild(a);a.click();
    try{setTimeout(cleanup,1000);cleanupScheduled=true;}catch(_timerError){cleanup();}return {canceled:false};
  }catch(error){throw error?.code?error:captureError('EXPORT_FAILED','export.failed',error.message);}
  finally{if(!cleanupScheduled)cleanup();}
}
initCaptureBindings();
