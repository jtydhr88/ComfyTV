/*
 * export/capture.js - screenshots, workspace recording, deterministic capture,
 * Seedance packaging, and the ZIP writer (subsystems R + T, refactor P8, ADR-0015).
 *
 * This module is intentionally DOM-lazy and import-free so Node can directly import
 * { makeZip } for the C6 byte golden without initializing document, THREE, renderer,
 * MediaRecorder, or any stage module. Browser-only collaborators are resolved through
 * explicit call-time globals during the P8 bridge transition.
 */

const SEED_RES={'16:9':[1920,1080],'9:16':[1080,1920],'1:1':[1440,1440],'4:3':[1664,1248]};
// Manual camera/workspace recording remains a 30fps capture tool. Automatic
// exports resolve their separate fixed fps from the Seedance export profile.
const REC_FPS=30;
const REC_START_FALLBACK_WINDOW_MS=120;
const REC_START_FALLBACK_CONFIRMATIONS=2;
const REC_START_TIMEOUT_MS=1500;

function createRecordingScheduler(candidate=null){
  const production={now:()=>performance.now(),set:(fn,delay)=>setTimeout(fn,delay),clear:id=>clearTimeout(id),every:(fn,delay)=>setInterval(fn,delay),clearEvery:id=>clearInterval(id)};
  if(candidate===null||candidate===undefined)return production;
  if(['now','set','clear','every','clearEvery'].every(key=>typeof candidate[key]==='function'))return candidate;
  throw captureError('CAPTURE_SCHEDULER_INVALID','record.runtimeError');
}

let recCanvas=null;
let recRenderer=null, recording=false, recTrack=null, recTick=null, recStep=null, recStop=null;
let workspaceCanvas=null;
let screenRecorder=null,screenRecording=false,workspaceRecordingRun=0,workspaceFrameTimer=null,workspaceSnapshotTimer=null,workspaceHardCapTimer=null,workspaceSnapshot=null,workspaceSnapshotBusy=false,workspaceStream=null;
let captureTransaction=null,captureTransactionSequence=0,captureTargetPending=false,seedancePendingDownload=null,seedanceLastDiagnostic=null;

function ensureCaptureCanvases(){
  if(!globalThis.document?.createElement)throw new Error('Capture DOM unavailable');
  if(!recCanvas)recCanvas=document.createElement('canvas');
  if(!workspaceCanvas)workspaceCanvas=document.createElement('canvas');
  return {recCanvas,workspaceCanvas};
}
function frozenCurrentReframe(){
  const aspect=$('aspect').value;
  const value=typeof globalThis.currentResolvedReframe==='function'
    ?globalThis.currentResolvedReframe()
    :globalThis.resolveShotReframe(globalThis.curShot(),aspect);
  return Object.freeze(globalThis.copyReframe(value));
}
function renderSeedanceWhiteModelFrame(rendererInstance,width,height,reframe){
  return globalThis.withSeedanceWhiteModelRender({
    scene,renderer:rendererInstance,camera:shotCam,sky:globalThis.sky,ground:globalThis.ground,
    helpers:[globalThis.grid,globalThis.groundBorder,globalThis.vizGroup,globalThis.camBall,globalThis.sunHandle],
    snapshotRenderer:globalThis.snapshotRendererFrame,restoreRenderer:globalThis.restoreRendererFrame,
    snapshotCamera:globalThis.snapshotCameraProjection,restoreCamera:globalThis.restoreCameraProjection,
    render:()=>globalThis.renderWithResolvedReframe({
      renderer:rendererInstance,scene,camera:shotCam,width,height,targetAspect:width/height,reframe
    })
  });
}
function renderShotFrame(w,h,reframe=frozenCurrentReframe(),{whiteModel=false}={}){
  const previousExportLook=exportLookActive;
  const rt=document.createElement('canvas'); rt.width=w; rt.height=h;
  const r2=globalThis.configureRenderer(new THREE.WebGLRenderer({canvas:rt, antialias:true, preserveDrawingBuffer:true}));
  try{
    r2.setSize(w,h,false);globalThis.setExportLook(true);
    if(whiteModel)renderSeedanceWhiteModelFrame(r2,w,h,reframe);
    else globalThis.renderWithResolvedReframe({renderer:r2,scene,camera:shotCam,width:w,height:h,targetAspect:w/h,reframe});
    return rt.toDataURL('image/png');
  }finally{r2.dispose();globalThis.setExportLook(previousExportLook);}
}
async function exportCurrentFrame(){
  const suggestedName=tag()+'_frame.png',saveBridge=globalThis.previsionDesktop||desktop,reframe=frozenCurrentReframe();
  if(!saveBridge){await dl(renderShotFrame(...SEED_RES[$('aspect').value],reframe),suggestedName);return true;}
  const target=await chooseTopCaptureTarget('screenshot',suggestedName,{bridge:saveBridge});
  if(!target||target.canceled)return false;
  let bytes;
  try{bytes=dataURLtoU8(renderShotFrame(...SEED_RES[$('aspect').value],reframe));}
  catch(e){alert(PreVisionI18n.t('export.failed',{message:e.message}));return false;}
  const out=await saveTopCaptureBytes(target,bytes,'export',{bridge:saveBridge});
  return !out.canceled;
}
function closeTopCaptureMenus(){closeUIMenus();}
function flashTopSnap(){ $('topSnapLabel').textContent=PreVisionI18n.t('capture.screenshotDone');setTimeout(()=>$('topSnapLabel').textContent=PreVisionI18n.t('capture.screenshot'),1000); }
function setCaptureSaveState(key,path){
  const text=PreVisionI18n.t(key,{path}),node=$('saveState');node.textContent=text;node.title=text;
}
function captureDiagnostic(message,error){try{console.warn(message,error);}catch(_diagnosticError){return;}}
function setCaptureSaveStateSafely(key,path){try{setCaptureSaveState(key,typeof path==='function'?path():path);return true;}catch(error){captureDiagnostic('Capture status update failed:',error);return false;}}
function updateRecordingUISafely(message='Capture recording UI update failed:'){try{updateRecordingUI();return true;}catch(error){captureDiagnostic(message,error);return false;}}
async function chooseTopCaptureTarget(kind,suggestedName,{bridge=desktop}={}){
  if(!bridge)return null;
  if(captureTargetPending)return {canceled:true,pending:true};
  captureTargetPending=true;
  let out;
  try{
    out=await bridge.chooseCaptureTarget(kind,suggestedName);
  }catch(e){
    alert(PreVisionI18n.t(kind==='recording'?'record.saveFailed':'capture.saveFailed',{message:e.message}));
    return {canceled:true};
  }finally{captureTargetPending=false;}
  if(!out.canceled)setCaptureSaveStateSafely('capture.destinationChosen',()=>out.path);return out;
}
async function saveTopCaptureBytes(target,bytes,kind,{report=true,bridge=desktop}={}){
  let out;
  try{
    out=await bridge.saveCaptureTarget(target.token,bytes);
  }catch(e){
    if(report)alert(PreVisionI18n.t(kind==='recording'?'record.saveFailed':kind==='export'?'export.failed':'capture.saveFailed',{message:e.message}));
    return {canceled:true,error:e.message};
  }
  if(!out.canceled)setCaptureSaveStateSafely(kind==='recording'?'record.saved':kind==='export'?'export.saved':'capture.screenshotSaved',()=>out.path);return out;
}
async function saveTopCaptureBlob(target,blob,kind='recording',options={}){
  try{return await saveTopCaptureBytes(target,new Uint8Array(await blob.arrayBuffer()),kind,options);}
  catch(e){
    if(options.report!==false)alert(PreVisionI18n.t(kind==='recording'?'record.saveFailed':kind==='export'?'export.failed':'capture.saveFailed',{message:e.message}));
    return {canceled:true,error:e.message};
  }
}
async function captureWholePageFrame(){
  closeTopCaptureMenus();
  if(desktop){
    const target=await chooseTopCaptureTarget('screenshot','PreVision_workspace.png');
    if(!target||target.canceled)return false;
    try{const out=await desktop.captureWorkspace(target.token);if(!out.canceled){flashTopSnap();setCaptureSaveState('capture.screenshotSaved',out.path);}return !out.canceled;}
    catch(e){alert(PreVisionI18n.t('capture.saveFailed',{message:e.message}));return false;}
  }
  if(!navigator.mediaDevices||!navigator.mediaDevices.getDisplayMedia){alert(PreVisionI18n.t('capture.browserUnsupported'));return false;}
  let stream=null;
  try{
    stream=await navigator.mediaDevices.getDisplayMedia({video:true,audio:false});
    const video=document.createElement('video');video.srcObject=stream;video.muted=true;await video.play();
    if(!video.videoWidth)await new Promise(r=>{video.onloadedmetadata=r;setTimeout(r,800);});
    const cv=document.createElement('canvas');cv.width=video.videoWidth||window.innerWidth;cv.height=video.videoHeight||window.innerHeight;
    cv.getContext('2d').drawImage(video,0,0,cv.width,cv.height);
    dl(cv.toDataURL('image/png'),tag()+'_page.png');flashTopSnap();return true;
  }catch(e){if(e&&e.name!=='NotAllowedError')alert(PreVisionI18n.t('capture.browserFailed',{message:e.message}));return false;}
  finally{if(stream)stream.getTracks().forEach(t=>t.stop());}
}
function tag(){ return `PreVision_S${sceneIdx+1}C${shotIdx+1}`; }
function sceneJSON({sync=true}={}){
  if(sync)globalThis.syncScene();
  return JSON.stringify({project:$('projname').value, scene:globalThis.curScene().name, aspect:$('aspect').value,
    resolution:SEED_RES[$('aspect').value].join('x'), fps:automaticExportFps(), data:globalThis.stageToData()},null,2);
}
function captureError(code,key,message,variables=null){const error=new Error(message||PreVisionI18n.t(key,variables||undefined));error.code=code;error.i18nKey=key;error.i18nVars=variables;return error;}
function automaticExportFps(){
  const fps=Number(globalThis.SEEDANCE_WHITE_MODEL_PROFILE?.fps);
  if(!Number.isInteger(fps)||fps<1||fps>120)throw captureError('EXPORT_FPS_INVALID','export.videoMediaMismatch');
  return fps;
}
function currentCaptureTransaction(){return captureTransaction;}
const captureAutomaticCaptureMutationBlocked=(transaction=captureTransaction)=>!!transaction&&!transaction.manual&&!transaction.settled&&!(transaction.mutationDepth>0);
const captureDeferAutomaticCaptureMutation=(callback,transaction=captureTransaction)=>{
  if(!globalThis.automaticCaptureMutationBlocked(transaction))return callback();
  transaction.deferredMutations.push(callback);return true;
};
function withAutomaticCaptureMutation(transaction,callback){
  if(!transaction||transaction.manual)return callback();
  transaction.mutationDepth=(transaction.mutationDepth||0)+1;
  try{return callback();}finally{transaction.mutationDepth=Math.max(0,transaction.mutationDepth-1);}
}
function withAutomaticPointPreviewSuppressed(callback,{restoreRuntime=false}={}){
  const saved={camera:previewCamPt,actor:previewActorPoint,actors:Array.from(previewActorPoints.entries())};
  previewCamPt=null;previewActorPoint=null;previewActorPoints.clear();
  try{return callback();}finally{
    previewCamPt=saved.camera;previewActorPoint=saved.actor;previewActorPoints.clear();saved.actors.forEach(([actor,index])=>previewActorPoints.set(actor,index));
    if(restoreRuntime){globalThis.updateActors();globalThis.updateShotCam();}
  }
}
function withAutomaticCaptureSampling(transaction,callback){
  return withAutomaticCaptureMutation(transaction,()=>withAutomaticPointPreviewSuppressed(callback));
}
function captureAutomaticExportTarget(kind,{scope='shot'}={}){
  const sceneRef=globalThis.curScene(),shotRef=globalThis.curShot(),aspect=$('aspect').value,resolution=SEED_RES[aspect];
  const fps=automaticExportFps();
  const whiteModel=kind==='seedance-white';
  if(!project||!sceneRef||!resolution)throw captureError('CAPTURE_TARGET_MISSING','record.runtimeError');
  if(!shotRef){
    if(whiteModel)throw captureError('SEEDANCE_SHOTS_EMPTY','export.seedanceNoShots');
    throw captureError('CAPTURE_TARGET_MISSING','record.runtimeError');
  }
  const contentScene=globalThis.stageToData(),contentSceneJson=JSON.stringify(contentScene);
  const sourceRefs=kind==='scene'||whiteModel&&scope==='scene'?shots:[shotRef];
  const sourceShots=sourceRefs.map(ref=>{
    const index=shots.indexOf(ref);if(index<0)throw captureError('CAPTURE_TARGET_MISSING','record.runtimeError');
    const reframe=globalThis.resolveShotReframe(contentScene.shots[index],aspect);
    return Object.freeze({ref,index,duration:+ref.dur,reframe:Object.freeze(globalThis.copyReframe(reframe))});
  });
  const target={kind,projectRef:project,sceneRef,sceneIndex:sceneIdx,shotIndex:shotIdx,shots:Object.freeze(sourceShots),
    actorRefs:Object.freeze(actors.slice()),
    duration:sourceShots.reduce((sum,item)=>sum+item.duration,0),fps,aspect,resolution:Object.freeze(resolution.slice()),
    projectName:$('projname').value,sceneName:sceneRef.name,fileTag:`PreVision_S${sceneIdx+1}C${shotIdx+1}`,
    content:Object.freeze({scene:deepCopy(contentScene),shot:deepCopy(contentScene.shots[shotIdx]),sceneJson:contentSceneJson})};
  if(kind==='seedance')withAutomaticPointPreviewSuppressed(()=>{target.prompt=globalThis.genPrompt();target.sceneJson=sceneJSON({sync:false});},{restoreRuntime:true});
  if(whiteModel){
    target.scope=scope;
    try{target.plan=globalThis.planSeedanceWhiteModelPackage({scope,sceneIndex:sceneIdx,shotIndex:shotIdx,aspect,fps,shots:sourceShots});}
    catch(error){
      if(error?.code==='SEEDANCE_SHOT_TOO_LONG')throw captureError(error.code,'export.seedanceShotTooLong',null,
        {shot:error.shotIndex+1,duration:error.duration,limit:error.limit});
      if(error?.code==='SEEDANCE_SHOTS_EMPTY')throw captureError(error.code,'export.seedanceNoShots');
      throw error;
    }
    withAutomaticPointPreviewSuppressed(()=>{
      target.prompt=PreVisionI18n.t('export.seedanceWhitePrompt',{prompt:globalThis.genPrompt()});
      target.sceneJson=sceneJSON({sync:false});
    },{restoreRuntime:true});
  }
  return Object.freeze(target);
}
function automaticCaptureAssetIds(target){
  const data=target?.content?.scene,ids=new Set();
  [data?.bg?.asset,data?.ground?.asset,...(data?.actors||[]).map(actor=>actor?.asset)].forEach(id=>{if(typeof id==='string'&&project?.assets?.[id])ids.add(id);});
  return Array.from(ids);
}
async function prepareAutomaticCaptureTextures(transaction,target){
  if(!ownsCaptureTransaction(transaction))throw captureError('CAPTURE_CANCELLED','record.cancelled');
  const pending=automaticCaptureAssetIds(target).map(id=>globalThis.assetTexture(id)).filter(Boolean).map(texture=>globalThis.assetTextureReady.get(texture)||Promise.resolve(true));
  const outcome=await Promise.race([
    Promise.all(pending).then(results=>({type:'ready',results})),
    transaction.cancelPromise.then(()=>({type:'cancel'}))
  ]);
  if(outcome.type==='cancel'||!ownsCaptureTransaction(transaction))throw captureError('CAPTURE_CANCELLED','record.cancelled');
  if(outcome.results.some(loaded=>!loaded))throw captureError('CAPTURE_TEXTURE_FAILED','record.runtimeError');
  return true;
}
function bindAutomaticCaptureTarget(transaction,target){
  if(!ownsCaptureTransaction(transaction)||transaction.manual||!target)throw captureError('CAPTURE_MISMATCH','record.sessionMismatch');
  transaction.target=target;transaction.planIndex=0;
  if(historyPending&&historyCurrent){
    const scenes=project.scenes.slice();scenes[target.sceneIndex]=deepCopy(target.content.scene);
    const snapProject=Object.assign({},project,{name:target.projectName||project.name,aspect:target.aspect||project.aspect,assets:{},scenes});
    transaction.pendingHistoryState=JSON.stringify({project:snapProject,sceneIdx:target.sceneIndex,shotIdx:target.shotIndex,
      selectedLabel:selected&&selected.label,previewAnimation:serializePreviewAnimationState()});
  }
  return transaction;
}
function activateAutomaticCaptureShot(transaction,target=transaction?.target,planIndex=transaction?.planIndex||0){
  if(!ownsCaptureTransaction(transaction)||transaction.manual||!target||target.projectRef!==project||actors.length!==target.actorRefs.length||
    target.actorRefs.some((actor,index)=>actors[index]!==actor))
    throw captureError('CAPTURE_TARGET_LOST','record.runtimeError');
  const item=target.shots[planIndex];if(!item)throw captureError('CAPTURE_TARGET_LOST','record.runtimeError');
  return withAutomaticCaptureMutation(transaction,()=>{
    if(sceneIdx!==target.sceneIndex)sceneIdx=target.sceneIndex;
    if(shots[item.index]!==item.ref)throw captureError('CAPTURE_TARGET_LOST','record.runtimeError');
    if(shotIdx!==item.index){if(target.kind==='seedance-white')shotIdx=item.index;else setShot(item.index,false);}
    transaction.planIndex=planIndex;return item;
  });
}
function blockAutomaticCaptureUIEvent(event){
  if(!globalThis.automaticCaptureMutationBlocked())return false;
  const target=event?.target,stopControl=target?.id==='topRecord'||target?.id==='topRecordLabel'||target?.id==='seedanceCancel'||target?.closest?.('#topRecord, #seedanceCancel');
  if(stopControl)return false;
  event?.preventDefault?.();event?.stopImmediatePropagation?.();return true;
}
function settleAutomaticCaptureAuthoring(){
  if(dragging)globalThis.finishCanvasDrag({pointerId:dragging.pointerId});
  try{if(typeof window.dispatchEvent==='function'&&typeof Event==='function')window.dispatchEvent(new Event('blur'));}catch(_error){}
}
function prepareAutomaticCapture(kind,options={}){
  if(captureTransaction)throw captureError('CAPTURE_BUSY','record.busy');
  settleAutomaticCaptureAuthoring();
  return {restoreState:captureAutomaticCaptureState(),target:captureAutomaticExportTarget(kind,options)};
}
function beginCaptureTransaction(owner,{manual=false}={}){
  if(captureTransaction)throw captureError('CAPTURE_BUSY','record.busy');
  globalThis.clearUnifiedCameraDraft?.();
  if(!manual)settleAutomaticCaptureAuthoring();
  let signalCancel;const cancelPromise=new Promise(resolve=>{signalCancel=resolve;});
  const transaction={id:++captureTransactionSequence,owner,manual,settled:false,finalized:false,mutationDepth:0,target:null,planIndex:0,
    pendingHistoryState:null,deferredMutations:[],finalizeAfter:null,stop:null,cancelPromise,signalCancel};captureTransaction=transaction;
  try{updateRecordingUI();return transaction;}
  catch(error){captureTransaction=null;transaction.settled=true;transaction.stop=null;transaction.signalCancel?.();transaction.signalCancel=null;throw error;}
}
function ownsCaptureTransaction(transaction){return !!transaction&&captureTransaction===transaction&&!transaction.settled;}
function releaseCaptureTransaction(transaction){
  if(!transaction||transaction.settled||captureTransaction!==transaction)return false;transaction.settled=true;
  captureTransaction=null;transaction.stop=null;transaction.signalCancel?.();transaction.signalCancel=null;updateRecordingUI();return true;
}
function stopActiveCapture(){
  const transaction=captureTransaction;if(!transaction||typeof transaction.stop!=='function')return false;
  try{const stopped=transaction.stop();if(stopped&&transaction.manual===false)alert(PreVisionI18n.t('record.cancelled'));return stopped;}
  catch(error){return reportCaptureError(error);}
}
function reportCaptureError(error,key='record.failed'){
  if(!error||error.code==='CAPTURE_CANCELLED')return false;
  alert(PreVisionI18n.t(error.i18nKey||key,error.i18nVars||{message:error.message||PreVisionI18n.t('record.runtimeError')}));return false;
}
function snapshotCaptureSceneVisuals(){
  const entries=[];scene?.traverse?.(object=>{const materials=object?.material?(Array.isArray(object.material)?object.material:[object.material]):null;
    entries.push({object,visible:object?.visible,material:object?.material,materials:materials?.map(material=>({material,color:material?.color,map:material?.map,visible:material?.visible}))||null});});return entries;
}
function restoreCaptureSceneVisuals(entries){
  let error=null;(entries||[]).forEach(entry=>{try{const object=entry.object;if(!object)return;if(entry.materials){object.material=entry.material;entry.materials.forEach(snapshot=>{if(!snapshot.material)return;snapshot.material.color=snapshot.color;snapshot.material.map=snapshot.map;snapshot.material.visible=snapshot.visible;});}object.visible=entry.visible;}catch(restoreError){error||=restoreError;}});if(error)throw error;
}
function captureAutomaticCaptureState(){
  return {sceneIdx,shotIdx,time:clock.time,playing:clock.playing,playAllMode,sceneRailLevel,selectedLabel:selected?.label||'',selCamPt,selActorPt,previewCamPt,
    previewActorPoint:previewActorPoint?{label:previewActorPoint.actor?.label||'',idx:previewActorPoint.idx}:null,
    previewActorPoints:Array.from(previewActorPoints.entries()).map(([actor,index])=>[actor.label,index]),exportLookActive,
    inspectorOpen:Array.from(document.querySelectorAll('#rightScroll > details.sec')).map(section=>!!section.open),
    aspect:{w:aspectW,h:aspectH},
    projection:{
      camera:globalThis.snapshotCameraProjection(shotCam),
      renderer:globalThis.snapshotRendererFrame(renderer),
      pipRenderer:globalThis.snapshotRendererFrame(pipRenderer),
      recRenderer:recRenderer?globalThis.snapshotRendererFrame(recRenderer):null
    },
    history:{sequence:historyCommitSequence,lifecycle:historyLifecycleSequence,current:historyCurrent,pending:historyPending,undo:undoStack.slice(),timer:historyTimer},
    sceneVisuals:snapshotCaptureSceneVisuals()};
}
function restoreAutomaticCaptureState(state,{preserveEditorResources=false}={}){
  if(!state)return;
  if(sceneIdx!==state.sceneIdx)globalThis.loadScene(state.sceneIdx,true);
  else shotIdx=state.shotIdx;
  clock.seek(state.time);state.playing?clock.play():clock.pause();playAllMode=state.playAllMode;sceneRailLevel=state.sceneRailLevel||sceneRailLevel;
  globalThis.select(actors.find(actor=>actor.label===state.selectedLabel)||null);selCamPt=state.selCamPt;selActorPt=state.selActorPt;globalThis.clearPointPreview();previewCamPt=state.previewCamPt;
  state.previewActorPoints.forEach(([label,index])=>{const actor=globalThis.actorByLabel(label);if(actor)previewActorPoints.set(actor,index);});
  if(state.previewActorPoint){const actor=globalThis.actorByLabel(state.previewActorPoint.label);if(actor)previewActorPoint={actor,idx:state.previewActorPoint.idx};}
  Array.from(document.querySelectorAll('#rightScroll > details.sec')).forEach((section,index)=>{section.open=!!state.inspectorOpen[index];});
  if(state.aspect){aspectW=state.aspect.w;aspectH=state.aspect.h;}
  if(state.history&&historyCommitSequence===state.history.sequence&&historyLifecycleSequence===state.history.lifecycle){
    historyCurrent=state.history.current;historyPending=state.history.pending;undoStack=state.history.undo.slice();historyTimer=state.history.timer;updateUndoUI();
  }
  globalThis.updateActors();globalThis.updateShotCam();if(!preserveEditorResources)syncAll();refreshCamPtUI();refreshMotionTimeline();if(!preserveEditorResources)globalThis.rebuildViz();updateMonitor();refreshShotPanel();
  if(state.projection){
    globalThis.restoreCameraProjection(shotCam,state.projection.camera);
    globalThis.restoreRendererFrame(renderer,state.projection.renderer);
    globalThis.restoreRendererFrame(pipRenderer,state.projection.pipRenderer);
    if(recRenderer&&state.projection.recRenderer)globalThis.restoreRendererFrame(recRenderer,state.projection.recRenderer);
  }
  globalThis.setExportLook(state.exportLookActive);if(preserveEditorResources)restoreCaptureSceneVisuals(state.sceneVisuals);updatePlayBtn();
}
function finalizeCaptureTransaction(transaction,{restoreState=null,after=null,preserveEditorResources=false}={}){
  if(!transaction||transaction.finalized)return null;transaction.finalized=true;
  if(transaction.settled||captureTransaction!==transaction){transaction.finalizeAfter=null;return null;}
  const finalAfter=after||transaction.finalizeAfter,deferred=transaction.deferredMutations.splice(0);transaction.finalizeAfter=null;
  let error=null;
  try{if(restoreState)withAutomaticCaptureMutation(transaction,()=>restoreAutomaticCaptureState(restoreState,{preserveEditorResources}));}catch(finalizeError){error=finalizeError;}
  finally{
    try{releaseCaptureTransaction(transaction);}catch(finalizeError){error||=finalizeError;}
    finally{
      deferred.forEach(callback=>{try{callback();}catch(finalizeError){error||=finalizeError;}});
      try{finalAfter?.();}catch(finalizeError){error||=finalizeError;}
    }
  }
  return error;
}
function armAutomaticCapturePrelude(transaction,state){
  transaction.stop=()=>{if(!ownsCaptureTransaction(transaction))return false;const error=finalizeCaptureTransaction(transaction,{restoreState:state});if(error)throw error;return true;};
  updateRecordingUI();return transaction;
}
function preferredRecordingSpec(){
  const prefer=['video/mp4;codecs=avc1.640028','video/mp4','video/webm;codecs=vp9','video/webm'];
  const mimeType=(window.MediaRecorder&&MediaRecorder.isTypeSupported)?prefer.find(type=>MediaRecorder.isTypeSupported(type))||'':'';
  return {mimeType,ext:mimeType.includes('mp4')?'mp4':'webm'};
}
function preferredSeedanceWhiteRecordingSpec(){
  const prefer=['video/mp4;codecs=avc1.640028','video/mp4;codecs=avc1.42E01E','video/mp4;codecs=avc1'];
  const mimeType=(window.MediaRecorder&&MediaRecorder.isTypeSupported)?prefer.find(type=>MediaRecorder.isTypeSupported(type))||'':'';
  return {mimeType,ext:mimeType?'mp4':''};
}
function seedanceH264Mime(value){return /^video\/mp4\s*;\s*codecs\s*=\s*avc1(?:[.;]|$)/i.test(String(value||''));}
function workspaceRecordingBackground(){
  const root=document.documentElement||document.body,styles=getComputedStyle(root),token=styles.getPropertyValue('--workspace-record-bg').trim();
  return token||getComputedStyle(document.body).backgroundColor||'#0C1016';
}
function normalizeWorkspaceCaptureColors(clonedDocument){
  const view=clonedDocument.defaultView||window,probe=clonedDocument.createElement('canvas');probe.width=probe.height=1;
  const probeCtx=probe.getContext('2d',{willReadFrequently:true});if(!probeCtx)return;
  const toLegacyColor=value=>{
    probeCtx.clearRect(0,0,1,1);probeCtx.fillStyle='#000';
    try{probeCtx.fillStyle=value;probeCtx.fillRect(0,0,1,1);}
    catch(e){return value;}
    const pixel=probeCtx.getImageData(0,0,1,1).data,alpha=Math.round(pixel[3]/255*1000)/1000;
    return alpha===1?`rgb(${pixel[0]}, ${pixel[1]}, ${pixel[2]})`:`rgba(${pixel[0]}, ${pixel[1]}, ${pixel[2]}, ${alpha})`;
  };
  const normalizeValue=value=>String(value||'').replace(/color\([^)]*\)/gi,color=>toLegacyColor(color));
  const properties=['color','background-color','border-top-color','border-right-color','border-bottom-color','border-left-color',
    'outline-color','text-decoration-color','caret-color','column-rule-color','box-shadow','text-shadow','fill','stroke'];
  clonedDocument.querySelectorAll('*').forEach(node=>{
    const computed=view.getComputedStyle(node);
    properties.forEach(property=>{
      const value=computed.getPropertyValue(property);if(!/color\(/i.test(value))return;
      const normalized=normalizeValue(value);if(normalized!==value)node.style.setProperty(property,normalized,'important');
    });
  });
}
function mediaStreamTracks(stream,{video=false}={}){
  const getter=video?'getVideoTracks':'getTracks',read=stream?.[getter];
  if(typeof read!=='function')return video?[]:mediaStreamTracks(stream,{video:true});return Array.from(read.call(stream)||[]);
}
function stopMediaStreamTracks(stream){
  let error=null,tracks=[];
  try{tracks=mediaStreamTracks(stream);}catch(cleanupError){error=cleanupError;try{tracks=mediaStreamTracks(stream,{video:true});}catch(_videoError){tracks=[];}}
  tracks.forEach(track=>{try{track.onended=null;}catch(cleanupError){error||=cleanupError;}try{track.stop();}catch(cleanupError){error||=cleanupError;}});return error;
}
function clearWorkspaceRecordingRuntime(){
  let error=null;const attempt=fn=>{try{fn();}catch(cleanupError){error||=cleanupError;}};
  const frameTimer=workspaceFrameTimer,snapshotTimer=workspaceSnapshotTimer,hardCapTimer=workspaceHardCapTimer,stream=workspaceStream;
  workspaceFrameTimer=null;workspaceSnapshotTimer=null;workspaceHardCapTimer=null;workspaceStream=null;
  screenRecorder=null;screenRecording=false;workspaceSnapshot=null;workspaceSnapshotBusy=false;
  if(frameTimer)attempt(()=>clearInterval(frameTimer));if(snapshotTimer)attempt(()=>clearInterval(snapshotTimer));if(hardCapTimer)attempt(()=>clearTimeout(hardCapTimer));
  const streamError=stopMediaStreamTracks(stream);if(streamError)error||=streamError;attempt(updateRecordingUI);attempt(()=>$('monRec').style.display='none');return error;
}
function updateRecordingUI(){
  const active=!!captureTransaction||recording||screenRecording,top=$('topRecord');top.classList.toggle('recording',active);
  top.disabled=active&&typeof captureTransaction?.stop!=='function';
  $('topRecordLabel').textContent=active?PreVisionI18n.t('record.stop'):PreVisionI18n.t('record.start');
  $('topRecordMore').disabled=active;
  ['exportShot','exportAll','seedancePack'].forEach(id=>$(id).disabled=active);
  ['seedanceProfile','seedanceScope'].forEach(id=>$(id).disabled=active);
  const whiteActive=captureTransaction?.owner==='seedance-white-export'&&!captureTransaction.settled;
  $('seedanceCancel').hidden=!whiteActive;$('seedanceCancel').disabled=!whiteActive;
}
async function startWholePageRecording(){
  ensureCaptureCanvases();
  let recordSpec,suggestedName;
  try{closeTopCaptureMenus();recordSpec=preferredRecordingSpec();suggestedName=tag()+'_workspace_record.'+recordSpec.ext;}
  catch(error){return reportCaptureError(error,'record.workspaceFailed');}
  let transaction;
  try{transaction=beginCaptureTransaction('workspace-recording',{manual:true});}catch(error){reportCaptureError(error);return false;}
  let keepTransaction=false,run=0,error=null,result=false,abortWorkspaceInitialization=null,workspaceCallbackSettled=false;
  try{
    transaction.stop=()=>releaseCaptureTransaction(transaction);
    if(typeof html2canvas!=='function')throw captureError('CAPTURE_COMPONENT_MISSING','record.componentMissing');
    const target=desktop?await chooseTopCaptureTarget('recording',suggestedName):null;
    if(!ownsCaptureTransaction(transaction)||desktop&&(!target||target.canceled))throw captureError('CAPTURE_CANCELLED','record.cancelled');
    run=++workspaceRecordingRun;
    screenRecorder=null;screenRecording=true;transaction.stop=()=>{if(!ownsCaptureTransaction(transaction)||!screenRecording)return false;screenRecording=false;workspaceRecordingRun++;
      const cleanupError=clearWorkspaceRecordingRuntime(),finalizeError=finalizeCaptureTransaction(transaction);if(cleanupError||finalizeError)reportCaptureError(cleanupError||finalizeError,'record.workspaceFailed');return true;};updateRecordingUI();$('monRec').style.display='flex';
    workspaceCanvas.width=Math.max(2,Math.floor(document.documentElement.clientWidth/2)*2);
    workspaceCanvas.height=Math.max(2,Math.floor(document.documentElement.clientHeight/2)*2);
    const workspaceBackground=workspaceRecordingBackground();
    let failWorkspaceRecorder=null;
    const refreshSnapshot=async()=>{
      if(workspaceSnapshotBusy||!screenRecording||run!==workspaceRecordingRun)return;workspaceSnapshotBusy=true;
      try{
        const snapshot=await html2canvas(document.documentElement,{backgroundColor:workspaceBackground,logging:false,useCORS:true,scale:1,
          onclone:normalizeWorkspaceCaptureColors,
          width:workspaceCanvas.width,height:workspaceCanvas.height,windowWidth:workspaceCanvas.width,windowHeight:workspaceCanvas.height,scrollX:0,scrollY:0});
        if(run===workspaceRecordingRun&&screenRecording)workspaceSnapshot=snapshot;
      }catch(error){if(failWorkspaceRecorder)failWorkspaceRecorder(error);else throw error;}
      finally{if(run===workspaceRecordingRun)workspaceSnapshotBusy=false;}
    };
    await new Promise(r=>requestAnimationFrame(()=>r()));await refreshSnapshot();
    if(!screenRecording||run!==workspaceRecordingRun)return false;
    const ctx=workspaceCanvas.getContext('2d',{alpha:false});
    const drawWorkspaceFrame=()=>{
      if(!screenRecording)return;
      ctx.fillStyle=workspaceBackground;ctx.fillRect(0,0,workspaceCanvas.width,workspaceCanvas.height);
      if(workspaceSnapshot)ctx.drawImage(workspaceSnapshot,0,0,workspaceCanvas.width,workspaceCanvas.height);
      document.querySelectorAll('canvas').forEach(cv=>{if(cv===workspaceCanvas||!cv.width||!cv.height)return;
        const r=cv.getBoundingClientRect();if(r.width<1||r.height<1||r.right<=0||r.bottom<=0||r.left>=workspaceCanvas.width||r.top>=workspaceCanvas.height)return;
        try{ctx.drawImage(cv,r.left,r.top,r.width,r.height)}catch(_error){return;}
      });
    };
    drawWorkspaceFrame();const stream=workspaceCanvas.captureStream(30),chunks=[];workspaceStream=stream;
    const recorder=new MediaRecorder(stream,recordSpec.mimeType?{mimeType:recordSpec.mimeType,videoBitsPerSecond:16e6}:{videoBitsPerSecond:16e6});
    screenRecorder=recorder;
    let recorderSettled=false,stopRequested=false,runtimeCleaned=false;
    const clearWorkspaceRecorderHandlers=()=>{let cleanupError=null;['ondataavailable','onerror','onstop'].forEach(key=>{try{recorder[key]=null;}catch(handlerError){cleanupError||=handlerError;}});return cleanupError;};
    abortWorkspaceInitialization=()=>{if(recorderSettled)return null;recorderSettled=true;return clearWorkspaceRecorderHandlers();};
    const finishWorkspaceRecorder=()=>{
      if(runtimeCleaned)return null;runtimeCleaned=true;
      if(workspaceStream===stream)return clearWorkspaceRecordingRuntime();
      return stopMediaStreamTracks(stream);
    };
    recorder.ondataavailable=e=>{if(e.data&&e.data.size)chunks.push(e.data);};
    failWorkspaceRecorder=rawError=>{
      if(recorderSettled)return false;recorderSettled=true;workspaceCallbackSettled=true;let error=rawError?.error||rawError||captureError('CAPTURE_RUNTIME','record.runtimeError');
      const handlerError=clearWorkspaceRecorderHandlers();if(!error&&handlerError)error=handlerError;
      const cleanupError=finishWorkspaceRecorder();if(!error&&cleanupError)error=cleanupError;transaction.stop=null;
      try{updateRecordingUI();}catch(finalizeError){error||=finalizeError;}
      const finalizeError=finalizeCaptureTransaction(transaction);if(!error&&finalizeError)error=finalizeError;reportCaptureError(error,'record.workspaceFailed');return true;
    };
    recorder.onerror=failWorkspaceRecorder;
    stream.getTracks?.().forEach(track=>{track.onended=()=>{if(!recorderSettled)recorder.onerror?.({error:captureError('CAPTURE_TRACK_ENDED','record.runtimeError')});};});
    recorder.onstop=async()=>{
      if(recorderSettled)return false;recorderSettled=true;workspaceCallbackSettled=true;let error=null,saved=false;
      try{
        const type=recorder.mimeType||recordSpec.mimeType||'video/webm',b=new Blob(chunks,{type}),ext=type.includes('mp4')?'mp4':'webm';
        if(!stopRequested)throw captureError('CAPTURE_INCOMPLETE','record.incomplete');if(!b.size)throw captureError('CAPTURE_EMPTY','record.empty');
        const handlerWarning=clearWorkspaceRecorderHandlers(),cleanupWarning=finishWorkspaceRecorder();
        if(handlerWarning||cleanupWarning)captureDiagnostic('Workspace recording cleanup warning:',handlerWarning||cleanupWarning);
        transaction.stop=null;updateRecordingUISafely();
        if(desktop){const out=await saveTopCaptureBlob(target,b,'recording',{report:false});if(out.canceled)throw out.error?captureError('EXPORT_FAILED','record.saveFailed',out.error):captureError('EXPORT_CANCELLED','export.cancelled');}
        else await dl(URL.createObjectURL(b),tag()+'_workspace_record.'+ext);saved=true;
      }catch(captureFailure){error=captureFailure;}
      finally{
        const cleanupError=finishWorkspaceRecorder();if(cleanupError){if(saved)captureDiagnostic('Workspace recording cleanup warning:',cleanupError);else error||=cleanupError;}transaction.stop=null;
        if(!updateRecordingUISafely()&&!saved&&!error)error=captureError('CAPTURE_RUNTIME','record.runtimeError');
        const finalizeError=finalizeCaptureTransaction(transaction);if(finalizeError){if(saved)captureDiagnostic('Workspace recording finalize warning:',finalizeError);else error||=finalizeError;}
      }
      if(error)return reportCaptureError(error,'record.workspaceFailed');return true;
    };
    transaction.stop=()=>{if(!ownsCaptureTransaction(transaction)||stopRequested||recorderSettled)return false;stopRequested=true;let cleanupWarning=null;
      const stopTimer=(key,clear)=>{const timer=key==='frame'?workspaceFrameTimer:key==='snapshot'?workspaceSnapshotTimer:workspaceHardCapTimer;if(!timer)return;
        try{clear(timer);if(key==='frame')workspaceFrameTimer=null;else if(key==='snapshot')workspaceSnapshotTimer=null;else workspaceHardCapTimer=null;}catch(error){cleanupWarning||=error;}};
      stopTimer('frame',clearInterval);stopTimer('snapshot',clearInterval);stopTimer('hardCap',clearTimeout);
      try{recorder.stop();if(cleanupWarning)captureDiagnostic('Workspace recording stop warning:',cleanupWarning);return true;}
      catch(error){failWorkspaceRecorder(error);return false;}};
    recorder.start();if(recorderSettled||!ownsCaptureTransaction(transaction))throw captureError('CAPTURE_CANCELLED','record.cancelled');
    workspaceFrameTimer=setInterval(()=>{if(stopRequested)return;try{drawWorkspaceFrame();}catch(frameError){failWorkspaceRecorder(frameError);}},1000/30);
    workspaceSnapshotTimer=setInterval(refreshSnapshot,4000);
    workspaceHardCapTimer=setTimeout(()=>{if(screenRecorder===recorder&&screenRecording)stopWholePageRecording();},6*60*60*1000);
    keepTransaction=true;result=true;
  }catch(captureFailure){error=workspaceCallbackSettled?null:captureFailure;const abortError=abortWorkspaceInitialization?.();if(!error&&abortError&&!workspaceCallbackSettled)error=abortError;}
  finally{
    if(!keepTransaction){
      if(ownsCaptureTransaction(transaction)||run&&run===workspaceRecordingRun){if(run&&run===workspaceRecordingRun)workspaceRecordingRun++;const cleanupError=clearWorkspaceRecordingRuntime();if(!error&&cleanupError)error=cleanupError;}
      const finalizeError=finalizeCaptureTransaction(transaction);if(!error&&finalizeError)error=finalizeError;
    }
  }
  if(error)return reportCaptureError(error,'record.workspaceFailed');return result;
}
function stopWholePageRecording(transaction=captureTransaction){
  return ownsCaptureTransaction(transaction)&&transaction.owner==='workspace-recording'&&typeof transaction.stop==='function'?transaction.stop():false;
}
function setupRec(w,h){
  ensureCaptureCanvases();
  if(!recRenderer) recRenderer=globalThis.configureRenderer(new THREE.WebGLRenderer({canvas:recCanvas, antialias:true, preserveDrawingBuffer:true}));
  recRenderer.setPixelRatio(1); recRenderer.setSize(w,h,false);
}
function recordBlob(durSec, onStart, options={}){
  ensureCaptureCanvases();
  return new Promise((res,rej)=>{
    const manual=!!options.manual;
    let scheduler;try{scheduler=createRecordingScheduler(options.scheduler);}catch(error){rej(error);return;}
    let transaction=options.transaction;
    const expectedOwner=options.owner||'camera-export';
    try{if(!transaction)transaction=beginCaptureTransaction(expectedOwner,{manual});else if(!ownsCaptureTransaction(transaction)||transaction.owner!==expectedOwner||transaction.manual!==manual)throw captureError('CAPTURE_MISMATCH','record.sessionMismatch');}
    catch(error){return rej(error);}
    const target=manual?null:(options.target||transaction.target||null),framePlan=manual?null:(options.framePlan||null);
    let captureFps;
    try{captureFps=manual?REC_FPS:(framePlan?.fps??target?.fps??automaticExportFps());
      if(!Number.isInteger(captureFps)||captureFps<1||captureFps>120||!manual&&captureFps!==automaticExportFps())throw captureError('CAPTURE_MISMATCH','record.sessionMismatch');}
    catch(error){return rej(error);}
    const framePeriodMs=1000/captureFps;
    const manualReframe=manual?frozenCurrentReframe():null;
    try{if(target){if(!transaction.target)bindAutomaticCaptureTarget(transaction,target);else if(transaction.target!==target)throw captureError('CAPTURE_MISMATCH','record.sessionMismatch');}
      if(framePlan&&(!target||!Array.isArray(framePlan.frames)||!framePlan.frames.length||framePlan.fps!==captureFps||
        !target.shots.some(item=>item.index===framePlan.shotIndex)))throw captureError('CAPTURE_MISMATCH','record.sessionMismatch');}
    catch(error){return rej(error);}
    const releaseEncodingTransaction=()=>options.retainTransaction?false:releaseCaptureTransaction(transaction);
    if(typeof MediaRecorder==='undefined'){releaseEncodingTransaction();return rej(captureError('MEDIA_RECORDER_UNSUPPORTED','record.browserUnsupported'));}
    try{setupRec(...(target?target.resolution:SEED_RES[$('aspect').value]));}
    catch(error){releaseEncodingTransaction();return rej(error);}
    const streams=[];let stream=null,track=null;
    const stopEncodingStreams=()=>{let error=null;streams.forEach(createdStream=>{const cleanupError=stopMediaStreamTracks(createdStream);if(!error&&cleanupError)error=cleanupError;});return error;};
    const rejectInitialization=error=>{const cleanupError=stopEncodingStreams();recTrack=null;recStop=null;recStep=null;recording=false;let releaseError=null;
      try{releaseEncodingTransaction();}catch(finalizeError){releaseError=finalizeError;}return rej(error||cleanupError||releaseError||captureError('CAPTURE_RUNTIME','record.runtimeError'));};
    try{
      stream=recCanvas.captureStream(0);streams.push(stream);track=mediaStreamTracks(stream,{video:true})[0]||null;
      if(track&&typeof track.requestFrame==='function')recTrack=track;
      else{
        const legacyStopError=stopMediaStreamTracks(stream);if(legacyStopError)throw legacyStopError;
        stream=recCanvas.captureStream(captureFps);streams.push(stream);track=mediaStreamTracks(stream,{video:true})[0]||null;
        recTrack=track&&typeof track.requestFrame==='function'?track:null;
      }
    }catch(error){return rejectInitialization(error);}
    let recordSpec,mt;try{recordSpec=options.recordSpec||preferredRecordingSpec();mt=recordSpec.mimeType;}catch(error){return rejectInitialization(error);}
    let rec;
    try{rec=new MediaRecorder(stream,mt?{mimeType:mt,videoBitsPerSecond:16e6}:{videoBitsPerSecond:16e6});}
    catch(e){
      if(options.recordSpec)return rejectInitialization(e);
      try{rec=new MediaRecorder(stream);}catch(fallbackError){return rejectInitialization(fallbackError);}
    }
    if(framePlan&&!recTrack)return rejectInitialization(captureError('SEEDANCE_FRAME_CONTROL_UNAVAILABLE','export.seedanceMediaMismatch'));
    const chunks=[];const totalFrames=manual?Infinity:(framePlan?framePlan.frames.length:Math.max(2,Math.round(durSec*captureFps)+1));let framesPushed=0,renderedFrames=0,requestedFrames=0,primerFrames=0,nextPlannedFrameAt=0;
    let savedSpeed=null,restoreState=null,settled=false,done=false,hardCap=null,onVis=null,completion='unexpected',startTimer=null,startFallbackTimer=null,firstFrameTimer=null,drainTimer=null,drainAckTimer=null,stopRequestTimer=null,stopFallbackTimer=null;
    let recorderState=framePlan?'STARTING':'RECORDING',sampleOrigin=null,firstRequestedFrameAt=null,lastRequestedFrameAt=null,plannedDrainAt=null,plannedFramePrepared=false,awaitingDrainData=false,startListener=null,startFallbackConfirmations=0,startSource=null;
    const recorderEventOrigin=scheduler.now(),recorderEvents=[];
    const recorderEvent=(type,details={})=>{if(!framePlan)return null;const entry=Object.freeze({sequence:recorderEvents.length+1,type,atMs:Math.round((scheduler.now()-recorderEventOrigin)*1000)/1000,state:rec.state,...details});recorderEvents.push(entry);return entry;};
    recorderEvent('recorder-created',{mimeType:rec.mimeType||mt||'',trackReadyStates:(()=>{try{return mediaStreamTracks(stream).map(streamTrack=>streamTrack?.readyState??null);}catch(_error){return ['unavailable'];}})()});
    const recorderGeneration=transaction.id;
    const ownsRecorderGeneration=()=>!settled&&ownsCaptureTransaction(transaction)&&transaction.id===recorderGeneration;
    const recorderTrackReadyStates=()=>{try{return mediaStreamTracks(stream).map(streamTrack=>streamTrack?.readyState??null);}catch(_error){return ['unavailable'];}};
    const clearRecorderHandlers=()=>{let error=null;if(startListener&&typeof rec.removeEventListener==='function'){try{rec.removeEventListener('start',startListener);}catch(handlerError){error||=handlerError;}}startListener=null;['onstart','ondataavailable','onerror','onstop'].forEach(key=>{try{rec[key]=null;}catch(handlerError){error||=handlerError;}});return error;};
    const cleanupRecordingRuntime=()=>{
      let cleanupError=null;const attempt=fn=>{try{fn();}catch(error){cleanupError||=error;}};
      recording=false;if(recTrack===track)recTrack=null;if(recStop===transaction.stop)recStop=null;recStep=null;
      const tick=recTick,cap=hardCap,visibilityHandler=onVis,startWait=startTimer,startFallbackWait=startFallbackTimer,firstFrameWait=firstFrameTimer,drainWait=drainTimer,drainAckWait=drainAckTimer,requestWait=stopRequestTimer,fallbackTimer=stopFallbackTimer;
      recTick=null;hardCap=null;onVis=null;startTimer=null;startFallbackTimer=null;firstFrameTimer=null;drainTimer=null;drainAckTimer=null;stopRequestTimer=null;stopFallbackTimer=null;
      if(tick){attempt(()=>scheduler.clearEvery(tick));attempt(()=>scheduler.clear(tick));}if(cap)attempt(()=>scheduler.clear(cap));if(startWait)attempt(()=>scheduler.clear(startWait));if(startFallbackWait)attempt(()=>scheduler.clear(startFallbackWait));if(firstFrameWait)attempt(()=>scheduler.clear(firstFrameWait));if(drainWait)attempt(()=>scheduler.clear(drainWait));if(drainAckWait)attempt(()=>scheduler.clear(drainAckWait));if(requestWait)attempt(()=>scheduler.clear(requestWait));if(fallbackTimer)attempt(()=>scheduler.clear(fallbackTimer));if(visibilityHandler)attempt(()=>document.removeEventListener('visibilitychange',visibilityHandler));
      const handlerError=clearRecorderHandlers();if(handlerError)cleanupError||=handlerError;
      const streamError=stopEncodingStreams();if(streamError)cleanupError||=streamError;
      try{$('monRec').style.display='none';if(savedSpeed!==null)$('speed').value=savedSpeed;
        if(restoreState&&!options.retainTransaction)withAutomaticCaptureMutation(transaction,()=>restoreAutomaticCaptureState(restoreState,{preserveEditorResources:options.whiteModel===true}));else if(!options.retainTransaction){clock.pause();updatePlayBtn();}
      }catch(error){cleanupError||=error;}
      finally{try{releaseEncodingTransaction();}catch(error){cleanupError||=error;}try{updateRecordingUI();}catch(error){cleanupError||=error;}}
      return cleanupError;
    };
    const failRecording=error=>{
      if(settled)return false;settled=true;done=true;const cleanupError=cleanupRecordingRuntime();
      try{if(rec.state!=='inactive')rec.stop();}catch(_error){recStop=null;}
      rej(error?.error||error||cleanupError||new Error(PreVisionI18n.t('record.runtimeError')));return true;
    };
    try{
      savedSpeed=$('speed').value;restoreState=manual?null:(options.restoreState||captureAutomaticCaptureState());
      rec.ondataavailable=e=>{
        if(!ownsRecorderGeneration())return;
        recorderEvent('dataavailable',{bytes:Number(e.data?.size)||0});
        if(e.data&&e.data.size)chunks.push(e.data);
        if(framePlan&&recorderState==='DRAINING'&&awaitingDrainData&&e.data?.size){
          awaitingDrainData=false;if(drainAckTimer){scheduler.clear(drainAckTimer);drainAckTimer=null;}stopAfterDrain();
        }
      };
      rec.onerror=failRecording;
      if(framePlan)rec.onerror=event=>{recorderEvent('error',{message:event?.error?.message||event?.message||''});return failRecording(event);};
      if(settled||!ownsCaptureTransaction(transaction))return;
      mediaStreamTracks(stream).forEach(streamTrack=>{if(!settled)streamTrack.onended=()=>failRecording(captureError('CAPTURE_TRACK_ENDED','record.runtimeError'));});
      if(settled||!ownsCaptureTransaction(transaction))return;
      rec.onstop=()=>{
        if(!ownsRecorderGeneration())return false;
        recorderEvent('stop-event');
        if(framePlan&&recorderState!=='STOPPING')return failRecording(captureError('CAPTURE_INCOMPLETE','record.incomplete'));
        recorderState='STOPPED';settled=true;let b,mediaError;
        try{const type=rec.mimeType||'video/webm';b=new Blob(chunks,{type});b.ext=type.includes('mp4')?'mp4':'webm';
          if(framePlan)b.seedanceCaptureLedger=Object.freeze({plannedFrameCount:totalFrames,renderedFrameCount:renderedFrames,requestedFrameCount:requestedFrames,primerFrameCount:primerFrames,manualFrameControl:!!recTrack,startSource,
            firstRequestAtMs:firstRequestedFrameAt===null?null:Math.round((firstRequestedFrameAt-recorderEventOrigin)*1000)/1000,
            lastRequestAtMs:lastRequestedFrameAt===null?null:Math.round((lastRequestedFrameAt-recorderEventOrigin)*1000)/1000,
            requestSpanMs:firstRequestedFrameAt===null||lastRequestedFrameAt===null?null:Math.round((lastRequestedFrameAt-firstRequestedFrameAt)*1000)/1000,
            plannedDurationMs:Math.round(totalFrames*framePeriodMs*1000)/1000,
            drainTargetAtMs:plannedDrainAt===null?null:Math.round((plannedDrainAt-recorderEventOrigin)*1000)/1000,
            trackReadyStates:recorderTrackReadyStates(),chunkCount:chunks.length,chunkBytes:chunks.reduce((sum,chunk)=>sum+(Number(chunk?.size)||0),0),events:Object.freeze(recorderEvents.slice())});
          if(!b.size)mediaError=captureError('CAPTURE_EMPTY','record.empty');
          else if(completion!=='complete'&&completion!=='manual-stop')mediaError=captureError('CAPTURE_INCOMPLETE','record.incomplete');}
        catch(blobError){mediaError=blobError;}
        const cleanupWarning=cleanupRecordingRuntime();if(cleanupWarning)captureDiagnostic('Recording cleanup warning:',cleanupWarning);
        if(mediaError)rej(mediaError);else res(b);return !mediaError;
      };
      if(settled||!ownsCaptureTransaction(transaction))return;
      const activatePlannedFrame=sample=>{
        const planIndex=target.shots.findIndex(item=>item.index===sample?.shotIndex);
        if(planIndex<0)throw captureError('CAPTURE_TARGET_LOST','record.runtimeError');
        const planItem=activateAutomaticCaptureShot(transaction,target,planIndex);
        clock.seek(Math.max(0,Math.min(planItem.duration,Number(sample.localTime)||0)));return planItem;
      };
      const requestRenderedFrame=()=>{if(!recTrack||typeof recTrack.requestFrame!=='function')return false;
        const requestAt=scheduler.now();if(framePlan){if(firstRequestedFrameAt===null){firstRequestedFrameAt=requestAt;nextPlannedFrameAt=requestAt;}lastRequestedFrameAt=requestAt;}
        recTrack.requestFrame();requestedFrames++;if(framePlan&&(requestedFrames===1||requestedFrames===totalFrames))recorderEvent('frame-requested',{frame:requestedFrames,planned:totalFrames});return true;};
      const renderRecFrame=(sample,{request=true,planned=!!framePlan}={})=>{const planItem=framePlan?activatePlannedFrame(sample):(target?activateAutomaticCaptureShot(transaction,target,transaction.planIndex):null);
        withAutomaticCaptureSampling(transaction,()=>{globalThis.updateActors();globalThis.updateShotCam();});const previousExportLook=exportLookActive;
        const resolution=target?target.resolution:SEED_RES[$('aspect').value],reframe=framePlan?.reframe||planItem?.reframe||manualReframe;
        try{globalThis.setExportLook(true);
          if(options.whiteModel)renderSeedanceWhiteModelFrame(recRenderer,resolution[0],resolution[1],reframe);
          else globalThis.renderWithResolvedReframe({renderer:recRenderer,scene,camera:shotCam,width:resolution[0],height:resolution[1],targetAspect:resolution[0]/resolution[1],reframe});}
        finally{globalThis.setExportLook(previousExportLook);}
        if(framePlan&&planned)renderedFrames++;if(request)requestRenderedFrame();};
      const primePlannedRecorder=()=>{if(!framePlan||!ownsRecorderGeneration()||recorderState!=='STARTING'||primerFrames)return false;renderRecFrame(framePlan.frames[0],{request:false,planned:false});primerFrames++;recorderEvent('primer-frame-requested',{primer:primerFrames,planned:totalFrames});recTrack.requestFrame();return true;};
      const preparePlannedFrame=()=>{if(!framePlan||plannedFramePrepared||framesPushed>=totalFrames)return false;renderRecFrame(framePlan.frames[framesPushed],{request:false});plannedFramePrepared=true;updateScrub();return true;};
      let startWall=scheduler.now(),hiddenAt=0;
      const suspendRecordingDrive=()=>{let warning=null;
        if(recTick){try{scheduler.clearEvery(recTick);scheduler.clear(recTick);recTick=null;}catch(error){warning||=error;}}
        if(hardCap){try{scheduler.clear(hardCap);hardCap=null;}catch(error){warning||=error;}}
        if(onVis){try{document.removeEventListener('visibilitychange',onVis);onVis=null;}catch(error){warning||=error;}}
        return warning;
      };
      const stopAfterDrain=()=>{
        if(!ownsRecorderGeneration()||recorderState!=='DRAINING')return false;
        recorderState='STOPPING';
        try{stopFallbackTimer=scheduler.set(()=>{stopFallbackTimer=null;if(!settled)failRecording(captureError('CAPTURE_STOP_TIMEOUT','record.incomplete'));},1500);recorderEvent('stop-called');rec.stop();}
        catch(error){failRecording(error);return false;}return true;
      };
      const drainPlannedRecorder=()=>{
        if(!ownsRecorderGeneration()||recorderState!=='RECORDING')return false;
        recorderState='DRAINING';const plannedTimelineEnd=(firstRequestedFrameAt??scheduler.now())+totalFrames*framePeriodMs,tailDrainEnd=(lastRequestedFrameAt??scheduler.now())+framePeriodMs;plannedDrainAt=Math.max(plannedTimelineEnd,tailDrainEnd);const drainDelay=Math.max(0,plannedDrainAt-scheduler.now());
        recorderEvent('drain-started',{renderedFrameCount:renderedFrames,requestedFrameCount:requestedFrames,plannedTimelineEndAtMs:Math.round((plannedTimelineEnd-recorderEventOrigin)*1000)/1000,drainTargetAtMs:Math.round((plannedDrainAt-recorderEventOrigin)*1000)/1000,delayMs:Math.round(drainDelay*1000)/1000});
        try{drainTimer=scheduler.set(()=>{drainTimer=null;if(!ownsRecorderGeneration()||recorderState!=='DRAINING')return;
          try{awaitingDrainData=true;drainAckTimer=scheduler.set(()=>{drainAckTimer=null;if(awaitingDrainData)failRecording(captureError('CAPTURE_DRAIN_TIMEOUT','record.incomplete'));},1500);recorderEvent('request-data-called');rec.requestData();}
          catch(error){failRecording(error);}},drainDelay);}
        catch(error){failRecording(error);return false;}return true;
      };
      const finish=()=>{if(done||settled||!ownsCaptureTransaction(transaction))return false;done=true;completion=manual?'manual-stop':'complete';
        const driveWarning=suspendRecordingDrive();if(driveWarning)captureDiagnostic('Recording stop warning:',driveWarning);
        if(framePlan)return drainPlannedRecorder();
        try{stopRequestTimer=scheduler.set(()=>{stopRequestTimer=null;if(settled)return;try{stopFallbackTimer=scheduler.set(()=>{stopFallbackTimer=null;if(!settled)failRecording(captureError('CAPTURE_STOP_TIMEOUT','record.incomplete'));},1500);rec.stop();}catch(error){failRecording(error);}},120);}
        catch(error){failRecording(error);return false;}return true;};
      const cancel=()=>{if(settled||!ownsCaptureTransaction(transaction))return false;done=true;completion='cancelled';
        recorderEvent('cancel-requested');
        const driveWarning=suspendRecordingDrive();if(driveWarning)captureDiagnostic('Recording cancel warning:',driveWarning);
        settled=true;const cleanupWarning=cleanupRecordingRuntime();if(cleanupWarning)captureDiagnostic('Recording cleanup warning:',cleanupWarning);
        try{if(rec.state!=='inactive')rec.stop();}catch(_error){recStop=null;}rej(captureError('CAPTURE_CANCELLED','record.cancelled'));return true;};
      const schedulePlannedFrame=()=>{if(!framePlan||recorderState!=='RECORDING'||done||document.hidden||framesPushed>=totalFrames||recTick)return;
        nextPlannedFrameAt+=framePeriodMs;const delay=Math.max(0,nextPlannedFrameAt-scheduler.now());
        recTick=scheduler.set(()=>{recTick=null;if(done||document.hidden||recorderState!=='RECORDING')return;try{recStep();schedulePlannedFrame();}catch(error){failRecording(error);}},delay);
      };
      onVis=()=>{if(done)return;if(document.hidden){hiddenAt=scheduler.now();if(rec.state==='recording'){try{rec.pause();}catch(error){failRecording(error);}}}
        else{if(hiddenAt){startWall+=scheduler.now()-hiddenAt;hiddenAt=0;}if(rec.state==='paused'){try{rec.resume();}catch(error){failRecording(error);}}if(framePlan){nextPlannedFrameAt=scheduler.now();schedulePlannedFrame();}}};
      recStep=()=>{if(done||framePlan&&recorderState!=='RECORDING')return;
        if(framePlan){if(!plannedFramePrepared)preparePlannedFrame();requestRenderedFrame();plannedFramePrepared=false;framesPushed++;if(framesPushed>=totalFrames)return finish();preparePlannedFrame();return;}
        else if(target){let remaining=Math.min(target.duration,framesPushed===totalFrames-1?target.duration:framesPushed/captureFps),planIndex=0;
          while(planIndex<target.shots.length-1&&remaining>=target.shots[planIndex].duration){remaining-=target.shots[planIndex].duration;planIndex++;}
          const planItem=activateAutomaticCaptureShot(transaction,target,planIndex);clock.seek(Math.max(0,Math.min(planItem.duration,remaining)));
        }else{clock.seek(clock.time+1/captureFps);if(clock.time>=globalThis.curShot().dur){if(playAllMode&&shotIdx<shots.length-1){setShot(shotIdx+1,false);clock.seek(0);}else clock.seek(globalThis.curShot().dur);}}
        updateScrub();renderRecFrame();framesPushed++;if(framesPushed>=totalFrames)finish();};
      const startConfirmedRecording=(source='listener')=>{
        if(!ownsRecorderGeneration()||framePlan&&recorderState!=='STARTING')return false;
        if(startTimer){scheduler.clear(startTimer);startTimer=null;}
        if(startFallbackTimer){scheduler.clear(startFallbackTimer);startFallbackTimer=null;}
        recorderState='RECORDING';startSource=source;sampleOrigin=scheduler.now();startWall=sampleOrigin;recorderEvent('recording-confirmed',{source});
        $('speed').value='1.0x';onStart();if(target&&!framePlan){activateAutomaticCaptureShot(transaction,target,0);clock.seek(0);}clock.play();updatePlayBtn();recording=true;updateRecordingUI();$('monRec').style.display='flex';
        if(framePlan){
          const startFirstFrame=()=>{firstFrameTimer=null;if(!ownsRecorderGeneration()||recorderState!=='RECORDING'||done)return;recStep();schedulePlannedFrame();};
          if(source==='state-track-fallback')firstFrameTimer=scheduler.set(startFirstFrame,framePeriodMs);else startFirstFrame();
        }
        else{renderRecFrame();framesPushed++;recTick=scheduler.every(()=>{if(done||document.hidden)return;const owed=Math.min(framesPushed+3,Math.floor((scheduler.now()-startWall)/1000*captureFps)+1,totalFrames);
          try{while(framesPushed<owed)recStep();}catch(error){failRecording(error);}},framePeriodMs);
        }
        hardCap=scheduler.set(()=>manual?finish():failRecording(captureError('CAPTURE_TIMEOUT','record.incomplete')),manual?6*60*60*1000:durSec*5000+15000);return true;
      };
      transaction.stop=manual?finish:cancel;if(manual)recStop=transaction.stop;document.addEventListener('visibilitychange',onVis);
      if(framePlan){
        if(typeof rec.addEventListener!=='function')return failRecording(captureError('CAPTURE_START_LISTENER_UNAVAILABLE','record.runtimeError'));
        startListener=()=>{recorderEvent('start-event');startConfirmedRecording(primerFrames?'listener-after-primer':'listener');};
        rec.addEventListener('start',startListener,{once:true});
        startTimer=scheduler.set(()=>{startTimer=null;if(recorderState==='STARTING')failRecording(captureError('CAPTURE_START_TIMEOUT','record.runtimeError'));},REC_START_TIMEOUT_MS);
      }
      recorderEvent('start-called');rec.start();recorderEvent('start-returned');if(settled||!ownsCaptureTransaction(transaction))return;
      if(framePlan&&recorderState==='STARTING'){
        const fallbackReady=()=>{const states=recorderTrackReadyStates();return rec.state==='recording'&&states.length>0&&states.every(state=>state==='live');};
        const confirmFallback=()=>{startFallbackTimer=null;if(!ownsRecorderGeneration()||recorderState!=='STARTING'||!fallbackReady())return;startFallbackConfirmations++;recorderEvent('start-fallback-confirmed',{confirmation:startFallbackConfirmations});if(startFallbackConfirmations<REC_START_FALLBACK_CONFIRMATIONS){startFallbackTimer=scheduler.set(confirmFallback,framePeriodMs);return;}primePlannedRecorder();};
        startFallbackTimer=scheduler.set(confirmFallback,REC_START_FALLBACK_WINDOW_MS);
      }
      if(!framePlan){startConfirmedRecording();$('speed').value='1.0x';}
    }catch(error){return failRecording(error);}
  });
}
function automaticExportMediaContract(target){
  const fps=automaticExportFps();
  if(!target||target.fps!==fps||!Number.isFinite(target.duration)||target.duration<=0)throw captureError('CAPTURE_MISMATCH','record.sessionMismatch');
  const frameCount=Math.max(2,Math.round(target.duration*fps)+1);
  return Object.freeze({filename:`${target.kind||'video'}-export.mp4`,fps,frameCount,duration:frameCount/fps});
}
function automaticWebmInvalid(message){throw captureError('EXPORT_MEDIA_MISMATCH','export.videoMediaMismatch',message);}
function webmVint(bytes,offset,end,{id=false}={}){
  if(!Number.isSafeInteger(offset)||offset<0||offset>=end)automaticWebmInvalid('Encoded WebM element is truncated.');
  const first=bytes[offset];let width=1,marker=0x80;
  while(width<=8&&!(first&marker)){width++;marker>>=1;}
  if(width>8||id&&width>4||offset+width>end)automaticWebmInvalid('Encoded WebM variable integer is invalid or truncated.');
  let value=BigInt(id?first:first&(marker-1));
  for(let index=1;index<width;index++)value=(value<<8n)|BigInt(bytes[offset+index]);
  const unknown=!id&&value===(1n<<BigInt(width*7))-1n;
  if(value>BigInt(Number.MAX_SAFE_INTEGER))automaticWebmInvalid('Encoded WebM variable integer is unsafe.');
  return {width,value:Number(value),unknown};
}
function webmElement(bytes,offset,end){
  const id=webmVint(bytes,offset,end,{id:true}),size=webmVint(bytes,offset+id.width,end),dataStart=offset+id.width+size.width;
  const dataEnd=size.unknown?end:dataStart+size.value;
  if(dataStart>end||!Number.isSafeInteger(dataEnd)||dataEnd<dataStart||dataEnd>end)automaticWebmInvalid('Encoded WebM element bounds are invalid.');
  return {id:id.value,start:offset,dataStart,end:dataEnd,unknownSize:size.unknown};
}
function webmElements(bytes,start,end){
  const elements=[];let offset=start;
  while(offset<end){const element=webmElement(bytes,offset,end);elements.push(element);if(element.end<=offset)automaticWebmInvalid('Encoded WebM element made no progress.');offset=element.end;}
  if(offset!==end)automaticWebmInvalid('Encoded WebM element alignment is invalid.');return elements;
}
function webmUnsigned(bytes,element,label){
  const size=element.end-element.dataStart;if(size<1||size>8)automaticWebmInvalid(`${label} is invalid.`);let value=0n;
  for(let offset=element.dataStart;offset<element.end;offset++)value=(value<<8n)|BigInt(bytes[offset]);
  if(value>BigInt(Number.MAX_SAFE_INTEGER))automaticWebmInvalid(`${label} is unsafe.`);return Number(value);
}
function webmFloat(bytes,element,label){
  const size=element.end-element.dataStart,view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
  if(size!==4&&size!==8)automaticWebmInvalid(`${label} is invalid.`);const value=size===4?view.getFloat32(element.dataStart,false):view.getFloat64(element.dataStart,false);
  if(!Number.isFinite(value)||value<0)automaticWebmInvalid(`${label} is invalid.`);return value;
}
function webmText(bytes,element){let value='';for(let offset=element.dataStart;offset<element.end;offset++)value+=String.fromCharCode(bytes[offset]);return value;}
const WEBM_SEGMENT_CHILD_IDS=new Set([0x114d9b74,0x1549a966,0x1654ae6b,0x1f43b675,0x1c53bb6b,0x1254c367,0x1043a770,0x1941a469]);
function webmUnknownClusterEnd(bytes,start,end){
  let offset=start;
  while(offset<end){const id=webmVint(bytes,offset,end,{id:true}).value;if(WEBM_SEGMENT_CHILD_IDS.has(id))return offset;const child=webmElement(bytes,offset,end);if(child.unknownSize)automaticWebmInvalid('Encoded WebM cluster child has an unsupported unknown size.');offset=child.end;}
  return end;
}
function webmSegmentElements(bytes,segment){
  const elements=[];let offset=segment.dataStart;
  while(offset<segment.end){let element=webmElement(bytes,offset,segment.end);
    if(element.id===0x1f43b675&&element.unknownSize)element={...element,end:webmUnknownClusterEnd(bytes,element.dataStart,segment.end)};
    else if(element.unknownSize)automaticWebmInvalid('Encoded WebM segment child has an unsupported unknown size.');
    elements.push(element);if(element.end<=offset)automaticWebmInvalid('Encoded WebM segment made no progress.');offset=element.end;
  }
  return elements;
}
function webmVideoTrack(bytes,tracks){
  const video=[];
  for(const entry of webmElements(bytes,tracks.dataStart,tracks.end).filter(element=>element.id===0xae)){
    let number=null,type=null,defaultDurationNs=null,codec='';
    for(const field of webmElements(bytes,entry.dataStart,entry.end)){
      if(field.id===0xd7)number=webmUnsigned(bytes,field,'Encoded WebM track number');
      else if(field.id===0x83)type=webmUnsigned(bytes,field,'Encoded WebM track type');
      else if(field.id===0x23e383)defaultDurationNs=webmUnsigned(bytes,field,'Encoded WebM default frame duration');
      else if(field.id===0x86)codec=webmText(bytes,field);
    }
    if(type===1)video.push({number,defaultDurationNs,codec});
  }
  if(video.length!==1||!Number.isInteger(video[0].number)||video[0].number<1||!/^V_/i.test(video[0].codec))automaticWebmInvalid('Encoded WebM requires exactly one valid video track.');
  return video[0];
}
function webmBlockTimestamp(bytes,element,videoTrackNumber,clusterTimecode){
  const track=webmVint(bytes,element.dataStart,element.end),at=element.dataStart+track.width,view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
  if(at+4>element.end)automaticWebmInvalid('Encoded WebM video block is truncated.');const relative=view.getInt16(at,false),flags=bytes[at+2];
  if(flags&0x06)automaticWebmInvalid('Encoded WebM laced video blocks cannot be strictly sample-counted.');
  if(track.value!==videoTrackNumber)return null;const timecode=clusterTimecode+relative;
  if(!Number.isSafeInteger(timecode)||timecode<0)automaticWebmInvalid('Encoded WebM video timestamp is invalid.');return timecode;
}
function webmClusterTimestamps(bytes,cluster,videoTrackNumber){
  const children=webmElements(bytes,cluster.dataStart,cluster.end),timecodes=children.filter(element=>element.id===0xe7);
  if(timecodes.length!==1)automaticWebmInvalid('Encoded WebM cluster timecode is missing or ambiguous.');const clusterTimecode=webmUnsigned(bytes,timecodes[0],'Encoded WebM cluster timecode'),timestamps=[];
  for(const child of children){
    if(child.id===0xa3){const timestamp=webmBlockTimestamp(bytes,child,videoTrackNumber,clusterTimecode);if(timestamp!==null)timestamps.push(timestamp);}
    else if(child.id===0xa0){const blocks=webmElements(bytes,child.dataStart,child.end).filter(element=>element.id===0xa1);if(blocks.length!==1)automaticWebmInvalid('Encoded WebM block group is invalid.');const timestamp=webmBlockTimestamp(bytes,blocks[0],videoTrackNumber,clusterTimecode);if(timestamp!==null)timestamps.push(timestamp);}
  }
  return timestamps;
}
function inspectAutomaticExportWebm(input){
  const bytes=input instanceof Uint8Array?input:new Uint8Array(input||[]),top=webmElements(bytes,0,bytes.byteLength),meaningful=top.filter(element=>element.id!==0xec);
  if(meaningful.length<2||meaningful[0].id!==0x1a45dfa3)automaticWebmInvalid('Encoded media is not a complete EBML/WebM container.');const segments=meaningful.filter(element=>element.id===0x18538067);
  if(segments.length!==1)automaticWebmInvalid('Encoded WebM segment is missing or ambiguous.');const children=webmSegmentElements(bytes,segments[0]),infos=children.filter(element=>element.id===0x1549a966),tracks=children.filter(element=>element.id===0x1654ae6b),clusters=children.filter(element=>element.id===0x1f43b675);
  if(infos.length!==1||tracks.length!==1||!clusters.length)automaticWebmInvalid('Encoded WebM timing, tracks, or clusters are missing.');let timecodeScaleNs=1000000,duration=null;
  for(const field of webmElements(bytes,infos[0].dataStart,infos[0].end)){
    if(field.id===0x2ad7b1)timecodeScaleNs=webmUnsigned(bytes,field,'Encoded WebM timecode scale');
    else if(field.id===0x4489)duration=webmFloat(bytes,field,'Encoded WebM duration');
  }
  if(!Number.isSafeInteger(timecodeScaleNs)||timecodeScaleNs<1)automaticWebmInvalid('Encoded WebM timecode scale is invalid.');const track=webmVideoTrack(bytes,tracks[0]),timestampsTicks=clusters.flatMap(cluster=>webmClusterTimestamps(bytes,cluster,track.number));
  if(!timestampsTicks.length)automaticWebmInvalid('Encoded WebM video samples are missing.');for(let index=1;index<timestampsTicks.length;index++)if(timestampsTicks[index]<=timestampsTicks[index-1])automaticWebmInvalid('Encoded WebM video timestamps are not strictly increasing.');
  const spanNs=(timestampsTicks.at(-1)-timestampsTicks[0])*timecodeScaleNs,observedFps=timestampsTicks.length>1?(timestampsTicks.length-1)*1e9/spanNs:0;
  return Object.freeze({container:'webm',codec:track.codec,frameCount:timestampsTicks.length,timecodeScaleNs,defaultDurationNs:track.defaultDurationNs,duration:duration===null?null:duration*timecodeScaleNs/1e9,timestampsTicks:Object.freeze(timestampsTicks),fps:+observedFps.toFixed(6)});
}
function assertAutomaticExportWebm(contract,media){
  if(!contract||!media||media.container!=='webm'||media.frameCount!==contract.frameCount)automaticWebmInvalid('Encoded WebM sample count differs from the automatic export plan.');
  const periodNs=1e9/contract.fps,tickToleranceNs=media.timecodeScaleNs+1e-6,first=media.timestampsTicks[0];
  if(media.timecodeScaleNs>1000000)automaticWebmInvalid('Encoded WebM timecode scale is too coarse for strict fixed-cadence validation.');
  for(let index=0;index<media.timestampsTicks.length;index++){
    const actualNs=(media.timestampsTicks[index]-first)*media.timecodeScaleNs,expectedNs=index*periodNs;
    if(Math.abs(actualNs-expectedNs)>tickToleranceNs)automaticWebmInvalid('Encoded WebM video timestamps differ from the fixed export cadence.');
  }
  if(first!==0)automaticWebmInvalid('Encoded WebM video timeline does not start at zero.');
  if(media.defaultDurationNs!==null&&Math.abs(media.defaultDurationNs-periodNs)>1)automaticWebmInvalid('Encoded WebM default frame duration differs from the fixed export cadence.');
  if(media.duration!==null&&Math.abs(media.duration-contract.duration)>1/contract.fps+media.timecodeScaleNs/1e9+1e-9)automaticWebmInvalid('Encoded WebM duration differs from the automatic export plan.');
  return media;
}
async function normalizeAndValidateAutomaticExportBlob(blob,target){
  const contract=automaticExportMediaContract(target);
  try{
    const recorderBytes=new Uint8Array(await blob.arrayBuffer());
    if(blob?.ext==='mp4'&&/^video\/mp4(?:\s*;|$)/i.test(String(blob?.type||''))){
      const normalizedBytes=globalThis.normalizeSeedanceMp4Timing(recorderBytes,{frameCount:contract.frameCount,fps:contract.fps});
      const media=globalThis.inspectSeedanceMp4(normalizedBytes);globalThis.assertSeedanceEncodedClip(contract,media);
      const normalized=new Blob([normalizedBytes],{type:blob.type||'video/mp4'});normalized.ext='mp4';normalized.captureMedia=media;return normalized;
    }
    if(blob?.ext==='webm'&&/^video\/webm(?:\s*;|$)/i.test(String(blob?.type||''))){
      const media=assertAutomaticExportWebm(contract,inspectAutomaticExportWebm(recorderBytes)),validated=new Blob([recorderBytes],{type:blob.type||'video/webm'});
      validated.ext='webm';validated.captureMedia=media;return validated;
    }
    throw captureError('EXPORT_MEDIA_MISMATCH','export.videoMediaMismatch');
  }catch(error){throw captureError('EXPORT_MEDIA_MISMATCH','export.videoMediaMismatch',error?.message);}
}
async function exportCurrentShotVideo(){
  const saveBridge=globalThis.previsionDesktop||desktop;let saveTarget=null,recordSpec=null;
  if(saveBridge){
    try{recordSpec=preferredRecordingSpec();saveTarget=await chooseTopCaptureTarget('recording',tag()+`_previz_${SEED_RES[$('aspect').value].join('x')}.`+recordSpec.ext,{bridge:saveBridge});}
    catch(error){return reportCaptureError(error,'export.failed');}
    if(!saveTarget||saveTarget.canceled)return false;
  }
  let restoreState,target;try{({restoreState,target}=prepareAutomaticCapture('shot'));}catch(error){return reportCaptureError(error);}
  let transaction;try{transaction=beginCaptureTransaction('shot-export');}catch(error){return reportCaptureError(error);}
  let error=null,success=false;
  try{bindAutomaticCaptureTarget(transaction,target);armAutomaticCapturePrelude(transaction,restoreState);await prepareAutomaticCaptureTextures(transaction,target);const raw=await recordBlob(target.duration, ()=>{ clock.seek(0); playAllMode=false; },{transaction,owner:'shot-export',restoreState,retainTransaction:true,target,...(recordSpec?{recordSpec}:{})});transaction.stop=null;updateRecordingUISafely();const b=await normalizeAndValidateAutomaticExportBlob(raw,target);
    if(saveBridge){const out=await saveTopCaptureBlob(saveTarget,b,'export',{bridge:saveBridge,report:false});if(out.canceled)throw captureError('EXPORT_FAILED','export.failed',out.error||PreVisionI18n.t('record.runtimeError'));}
    else await dl(URL.createObjectURL(b), target.fileTag+`_previz_${target.resolution.join('x')}.`+b.ext);success=true; }
  catch(captureFailure){error=captureFailure;}finally{const finalizeError=finalizeCaptureTransaction(transaction,{restoreState});if(finalizeError){captureDiagnostic('Shot export finalize failed:',finalizeError);error=finalizeError;success=false;}}
  return error?reportCaptureError(error):success;
}
async function topRecordCamera(){
  if(captureTransaction){stopActiveCapture();return true;}
  let recordSpec,suggestedName;
  try{closeTopCaptureMenus();recordSpec=preferredRecordingSpec();suggestedName=tag()+`_previz_${SEED_RES[$('aspect').value].join('x')}.`+recordSpec.ext;}
  catch(error){return reportCaptureError(error);}
  let transaction;try{transaction=beginCaptureTransaction('camera-recording',{manual:true});}catch(error){return reportCaptureError(error);}
  let error=null,success=false;
  try{
    transaction.stop=()=>releaseCaptureTransaction(transaction);const target=desktop?await chooseTopCaptureTarget('recording',suggestedName):null;
    if(ownsCaptureTransaction(transaction)&&(!desktop||target&&!target.canceled)){
      const b=await recordBlob(globalThis.curShot().dur,()=>{clock.seek(0);playAllMode=false;},{manual:true,recordSpec,transaction,owner:'camera-recording',retainTransaction:true});transaction.stop=null;updateRecordingUISafely();
      if(desktop){const out=await saveTopCaptureBlob(target,b);success=!out.canceled;}
      else{await dl(URL.createObjectURL(b),tag()+`_previz_${SEED_RES[$('aspect').value].join('x')}.`+b.ext);success=true;}
    }
  }catch(captureFailure){error=captureFailure;}finally{const finalizeError=finalizeCaptureTransaction(transaction);if(finalizeError){if(success)captureDiagnostic('Camera recording finalize warning:',finalizeError);else error||=finalizeError;}}
  return error?reportCaptureError(error):success;
}
async function exportWholeSceneVideo(){
  const saveBridge=globalThis.previsionDesktop||desktop;let saveTarget=null,recordSpec=null;
  if(saveBridge){
    try{recordSpec=preferredRecordingSpec();saveTarget=await chooseTopCaptureTarget('recording',`PreVision_S${sceneIdx+1}_full_previz.`+recordSpec.ext,{bridge:saveBridge});}
    catch(error){return reportCaptureError(error,'export.failed');}
    if(!saveTarget||saveTarget.canceled)return false;
  }
  let restoreState,target;try{({restoreState,target}=prepareAutomaticCapture('scene'));}catch(error){return reportCaptureError(error);}
  let transaction;try{transaction=beginCaptureTransaction('scene-export');}catch(error){return reportCaptureError(error);}
  let error=null,success=false;
  try{bindAutomaticCaptureTarget(transaction,target);armAutomaticCapturePrelude(transaction,restoreState);await prepareAutomaticCaptureTextures(transaction,target);const raw=await recordBlob(target.duration, ()=>{ playAllMode=true; },{transaction,owner:'scene-export',restoreState,retainTransaction:true,target,...(recordSpec?{recordSpec}:{})});transaction.stop=null;updateRecordingUISafely();const b=await normalizeAndValidateAutomaticExportBlob(raw,target);
    if(saveBridge){const out=await saveTopCaptureBlob(saveTarget,b,'export',{bridge:saveBridge,report:false});if(out.canceled)throw captureError('EXPORT_FAILED','export.failed',out.error||PreVisionI18n.t('record.runtimeError'));}
    else await dl(URL.createObjectURL(b), `PreVision_S${target.sceneIndex+1}_full_previz.`+b.ext);success=true; }
  catch(captureFailure){error=captureFailure;}finally{const finalizeError=finalizeCaptureTransaction(transaction,{restoreState});if(finalizeError){captureDiagnostic('Scene export finalize failed:',finalizeError);error=finalizeError;success=false;}}
  return error?reportCaptureError(error):success;
}
function makeZip(files){
  const enc=new TextEncoder();
  const T=(()=>{const t=new Uint32Array(256);for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=c&1?0xEDB88320^(c>>>1):c>>>1;t[n]=c}return t})();
  const crc=d=>{let c=~0;for(let i=0;i<d.length;i++)c=T[(c^d[i])&255]^(c>>>8);return ~c>>>0};
  const parts=[],central=[];let off=0;
  files.forEach(f=>{
    const nm=enc.encode(f.name), c=crc(f.data), n=f.data.length;
    const lh=new DataView(new ArrayBuffer(30));
    lh.setUint32(0,0x04034b50,true);lh.setUint16(4,20,true);lh.setUint16(6,0x0800,true);
    lh.setUint32(14,c,true);lh.setUint32(18,n,true);lh.setUint32(22,n,true);lh.setUint16(26,nm.length,true);
    parts.push(new Uint8Array(lh.buffer),nm,f.data);
    const ch=new DataView(new ArrayBuffer(46));
    ch.setUint32(0,0x02014b50,true);ch.setUint16(4,20,true);ch.setUint16(6,20,true);ch.setUint16(8,0x0800,true);
    ch.setUint32(16,c,true);ch.setUint32(20,n,true);ch.setUint32(24,n,true);
    ch.setUint16(28,nm.length,true);ch.setUint32(42,off,true);
    central.push(new Uint8Array(ch.buffer),nm);
    off+=30+nm.length+n;
  });
  const cs=central.reduce((s,x)=>s+x.length,0);
  const end=new DataView(new ArrayBuffer(22));
  end.setUint32(0,0x06054b50,true);end.setUint16(8,files.length,true);end.setUint16(10,files.length,true);
  end.setUint32(12,cs,true);end.setUint32(16,off,true);
  return new Blob([...parts,...central,new Uint8Array(end.buffer)],{type:'application/zip'});
}
function dataURLtoU8(u){ const b=atob(u.split(',')[1]); const a=new Uint8Array(b.length); for(let i=0;i<b.length;i++)a[i]=b.charCodeAt(i); return a; }
function setSeedanceProgress(key,variables={},value=0){
  const bar=$('seedanceProgressBar');bar.hidden=false;bar.value=Math.max(0,Math.min(1,Number(value)||0));
  $('seedanceProgress').textContent=PreVisionI18n.t(key,variables);return true;
}
function currentSeedanceDiagnostic(){return seedanceLastDiagnostic;}
function setSeedanceDiagnostic(diagnostic,{open=false}={}){
  const now=new Date().toISOString(),snapshot=Object.freeze({...diagnostic,updatedAt:now,browser:globalThis.navigator?.userAgent||'unavailable'});seedanceLastDiagnostic=snapshot;
  const box=$('seedanceDiagnostics'),text=$('seedanceDiagnosticsText');
  if(box&&text){box.hidden=false;if(open)box.open=true;text.textContent=`${PreVisionI18n.t('export.seedanceDiagnosticsHint')}\n${JSON.stringify(snapshot,null,2)}`;}
  return snapshot;
}
function updateSeedanceDiagnostic(patch,{open=false}={}){return setSeedanceDiagnostic({...seedanceLastDiagnostic,...patch},{open});}
function clearSeedancePendingDownload(){seedancePendingDownload=null;return true;}
function seedancePendingDownloadIdentity(){return seedancePendingDownload?.selection||null;}
function seedancePendingContentFingerprint({scope,projectName,sceneName,sceneIndex,shotIndex,aspect,sceneJson}){
  const identity=JSON.stringify({scope,projectName,sceneName,sceneIndex,shotIndex:scope==='shot'?shotIndex:null,aspect,sceneJson});
  return globalThis.seedanceSha256(new TextEncoder().encode(identity));
}
function seedancePendingSelection(target,scope){
  return Object.freeze({scope,sceneIndex:target.sceneIndex,shotIndex:scope==='shot'?target.shotIndex:null,aspect:target.aspect,
    contentFingerprint:seedancePendingContentFingerprint({scope,projectName:target.projectName,sceneName:target.sceneName,sceneIndex:target.sceneIndex,
      shotIndex:target.shotIndex,aspect:target.aspect,sceneJson:target.content.sceneJson})});
}
function currentSeedancePendingSelection(scope){
  const currentScene=globalThis.curScene(),currentShot=globalThis.curShot();
  if(!project||!currentScene||!currentShot)return null;
  try{
    return Object.freeze({scope,sceneIndex:sceneIdx,shotIndex:scope==='shot'?shotIdx:null,aspect:$('aspect').value,
      contentFingerprint:seedancePendingContentFingerprint({scope,projectName:$('projname').value,sceneName:currentScene.name,sceneIndex:sceneIdx,
        shotIndex:shotIdx,aspect:$('aspect').value,sceneJson:JSON.stringify(globalThis.stageToData())})});
  }catch(error){captureDiagnostic('Seedance pending-package fingerprint failed:',error);return null;}
}
function seedancePendingMatchesCurrentSelection(pending=seedancePendingDownload){
  const selection=pending?.selection,scope=$('seedanceScope').value==='scene'?'scene':'shot';
  const current=currentSeedancePendingSelection(scope);
  return !!selection&&$('seedanceProfile').value==='white-model'&&!!current&&selection.scope===current.scope&&selection.sceneIndex===current.sceneIndex&&
    selection.shotIndex===current.shotIndex&&selection.aspect===current.aspect&&selection.contentFingerprint===current.contentFingerprint;
}
function updateSeedanceProfileUI({resetProgress=false}={}){
  const white=$('seedanceProfile').value==='white-model';$('seedanceScope').hidden=!white;
  if(!white)clearSeedancePendingDownload();
  $('seedanceProfileGuide').textContent=PreVisionI18n.t(white?'export.seedanceWhiteGuide':'export.seedanceStandardGuide');
  $('seedancePack').textContent=PreVisionI18n.t(white?(seedancePendingDownload?(seedancePendingDownload.requested?'export.seedanceDownloadAgain':'export.seedanceDownloadReady'):'export.seedanceWhitePack'):'export.seedancePack');
  if(!captureTransaction||captureTransaction.owner!=='seedance-white-export'){$('seedanceCancel').hidden=true;$('seedanceCancel').disabled=true;}
  if(resetProgress){$('seedanceProgressBar').hidden=true;$('seedanceProgressBar').value=0;$('seedanceProgress').textContent=PreVisionI18n.t('export.seedanceIdle');}
  return white;
}
async function downloadSeedanceWhiteModelPackage(event=null){
  const pending=seedancePendingDownload;if(!pending)return false;
  if(!seedancePendingMatchesCurrentSelection(pending)){clearSeedancePendingDownload();updateSeedanceProfileUI({resetProgress:true});return false;}
  try{
    const untrustedEvent=event?.isTrusted===false;
    const inactiveUserActivation=globalThis.navigator?.userActivation?.isActive===false;
    if(untrustedEvent||inactiveUserActivation){
      throw captureError('SEEDANCE_DOWNLOAD_GESTURE_REQUIRED','export.seedanceDownloadGestureRequired');
    }
    await dl(URL.createObjectURL(pending.blob),pending.fileName,{bridge:null});
    if(seedancePendingDownload===pending)seedancePendingDownload={...pending,requested:true};
    setSeedanceProgress('export.seedanceDownloadRequested',{name:pending.fileName},1);updateSeedanceProfileUI();return true;
  }catch(error){setSeedanceProgress(error.i18nKey||'export.failed',error.i18nVars||{message:error.message},1);return reportCaptureError(error,'export.failed');}
}
async function exportSeedanceWhiteModelPackage({scheduler=null}={}){
  const btn=$('seedancePack'),scope=$('seedanceScope').value==='scene'?'scene':'shot';
  if(btn.disabled)return false;clearSeedancePendingDownload();setSeedanceProgress('export.seedancePreparing',{},0);
  let restoreState,target,recordSpec;
  try{
    ({restoreState,target}=prepareAutomaticCapture('seedance-white',{scope}));recordSpec=preferredSeedanceWhiteRecordingSpec();
    if(recordSpec.ext!=='mp4'||!seedanceH264Mime(recordSpec.mimeType))throw captureError('SEEDANCE_MP4_UNAVAILABLE','export.seedanceMp4Unavailable');
  }catch(error){setSeedanceProgress(error.i18nKey||'export.failed',error.i18nVars||{message:error.message},0);return reportCaptureError(error,'export.failed');}
  let transaction;try{transaction=beginCaptureTransaction('seedance-white-export');}catch(error){return reportCaptureError(error);}
  let error=null,success=false,pendingDownload=null;
  try{
    bindAutomaticCaptureTarget(transaction,target);armAutomaticCapturePrelude(transaction,restoreState);await prepareAutomaticCaptureTextures(transaction,target);
    const entries=[],encoder=new TextEncoder(),clips=target.plan.clips;
    for(let index=0;index<clips.length;index++){
      const clip=clips[index];
      setSeedanceDiagnostic({schema:'prevision.seedance-white-model-diagnostic/v1',status:'recording',clipIndex:index+1,clipCount:clips.length,filename:clip.filename,expected:{frameCount:clip.frameCount,duration:clip.duration,fps:clip.fps},recorderActual:null,actual:null,captureLedger:null,mediaRecorderEvents:[],error:null});
      if(!ownsCaptureTransaction(transaction))throw captureError('CAPTURE_CANCELLED','record.cancelled');
      setSeedanceProgress('export.seedanceRecordingClip',{current:index+1,total:clips.length,shot:clip.shotIndex+1},index/clips.length*.8);
      const blob=await recordBlob(clip.duration,()=>{playAllMode=false;},{transaction,owner:'seedance-white-export',restoreState,retainTransaction:true,target,recordSpec,framePlan:clip,whiteModel:true,scheduler});
      if(!ownsCaptureTransaction(transaction))throw captureError('CAPTURE_CANCELLED','record.cancelled');
      if(blob.ext!=='mp4'||!seedanceH264Mime(blob.type))throw captureError('SEEDANCE_MP4_UNAVAILABLE','export.seedanceMp4Unavailable');
      const ledger=blob.seedanceCaptureLedger;
      updateSeedanceDiagnostic({status:'encoded',captureLedger:ledger||null,mediaRecorderEvents:ledger?.events||[]});
      if(!ledger||!ledger.manualFrameControl||ledger.plannedFrameCount!==clip.frameCount||ledger.renderedFrameCount!==clip.frameCount||ledger.requestedFrameCount!==clip.frameCount){
        updateSeedanceDiagnostic({status:'ledger-mismatch',error:{code:'SEEDANCE_MEDIA_MISMATCH',message:PreVisionI18n.t('export.seedanceMediaMismatch')}},{open:true});
        throw captureError('SEEDANCE_MEDIA_MISMATCH','export.seedanceMediaMismatch');
      }
      armAutomaticCapturePrelude(transaction,restoreState);
      const recorderBytes=new Uint8Array(await blob.arrayBuffer());
      if(!ownsCaptureTransaction(transaction))throw captureError('CAPTURE_CANCELLED','record.cancelled');
      let recorderMedia,media,clipBytes;try{recorderMedia=globalThis.inspectSeedanceMp4(recorderBytes);updateSeedanceDiagnostic({status:'normalizing-timeline',recorderActual:recorderMedia});clipBytes=globalThis.normalizeSeedanceMp4Timing(recorderBytes,{frameCount:clip.frameCount,fps:clip.fps});media=globalThis.inspectSeedanceMp4(clipBytes);updateSeedanceDiagnostic({status:'validating',actual:media});globalThis.assertSeedanceEncodedClip(clip,media);}
      catch(mediaError){updateSeedanceDiagnostic({status:'media-mismatch',recorderActual:recorderMedia||mediaError?.actual||null,actual:mediaError?.actual||media||recorderMedia||null,error:{code:mediaError?.code||'SEEDANCE_MEDIA_MISMATCH',message:mediaError?.message||PreVisionI18n.t('export.seedanceMediaMismatch')}},{open:true});throw captureError(mediaError.code||'SEEDANCE_MEDIA_MISMATCH','export.seedanceMediaMismatch',mediaError.message);}
      updateSeedanceDiagnostic({status:'media-valid',actual:media,error:null});
      entries.push({name:clip.filename,mime:'video/mp4',data:clipBytes,media});
    }
    if(!ownsCaptureTransaction(transaction))throw captureError('CAPTURE_CANCELLED','record.cancelled');
    setSeedanceProgress('export.seedancePackaging',{},.84);
    const mediaByFilename=new Map(entries.map(entry=>[entry.name,entry.media]));
    entries.push(
      {name:'02_timestamps.json',mime:'application/json',data:encoder.encode(JSON.stringify(globalThis.seedanceTimestampScript(target.plan,{mediaByFilename}),null,2))},
      {name:'03_prompt.txt',mime:'text/plain;charset=utf-8',data:encoder.encode(target.prompt)}
    );
    const manifest=globalThis.buildSeedanceManifest({plan:target.plan,entries,saveMethod:'browser-download',appearanceReferences:'user-provided-separately'});
    const manifestBytes=encoder.encode(JSON.stringify(manifest,null,2)),manifestName='04_manifest.json';
    const zip=makeZip([...entries,{name:manifestName,data:manifestBytes}]),zipBytes=new Uint8Array(await zip.arrayBuffer());
    setSeedanceProgress('export.seedanceVerifying',{},.94);
    try{globalThis.verifySeedanceZipManifest(zipBytes,manifest,{manifestName});}
    catch(verifyError){throw captureError('SEEDANCE_MANIFEST_MISMATCH','export.seedanceManifestMismatch',verifyError.message);}
    if(!ownsCaptureTransaction(transaction))throw captureError('CAPTURE_CANCELLED','record.cancelled');
    const fileName=`Seedance25_WhiteModel_S${target.sceneIndex+1}_${scope}_${target.resolution.join('x')}.zip`;
    pendingDownload={blob:zip,fileName,requested:false,selection:seedancePendingSelection(target,scope)};updateSeedanceDiagnostic({status:'ready-to-download',error:null});success=true;
  }catch(captureFailure){error=captureFailure;if(error?.code==='CAPTURE_CANCELLED')setSeedanceProgress('export.cancelled',{},0);
    else setSeedanceProgress(error.i18nKey||'export.failed',error.i18nVars||{message:error.message},0);
    if(!seedanceLastDiagnostic||!['media-mismatch','ledger-mismatch'].includes(seedanceLastDiagnostic.status))updateSeedanceDiagnostic({status:error?.code==='CAPTURE_CANCELLED'?'cancelled':'failed',error:{code:error?.code||'SEEDANCE_EXPORT_FAILED',message:error?.message||PreVisionI18n.t('record.runtimeError')}},{open:true});}
  finally{
    const finalizeError=finalizeCaptureTransaction(transaction,{restoreState,after:()=>updateSeedanceProfileUI(),preserveEditorResources:true});
    if(finalizeError){captureDiagnostic('Seedance white-model export finalize failed:',finalizeError);error=finalizeError;success=false;updateSeedanceDiagnostic({status:'finalize-failed',error:{code:finalizeError?.code||'SEEDANCE_EXPORT_FINALIZE',message:finalizeError?.message||PreVisionI18n.t('record.runtimeError')}},{open:true});}
  }
  if(error||!success||!pendingDownload){clearSeedancePendingDownload();return reportCaptureError(error||captureError('SEEDANCE_EXPORT_FINALIZE','export.failed'),'export.failed');}
  seedancePendingDownload=pendingDownload;setSeedanceProgress('export.seedanceReadyToDownload',{name:pendingDownload.fileName},1);updateSeedanceProfileUI();return true;
}
function initSeedancePack(){
  $('seedanceProfile').onchange=()=>updateSeedanceProfileUI({resetProgress:true});
  $('seedanceScope').onchange=()=>{clearSeedancePendingDownload();updateSeedanceProfileUI({resetProgress:true});};
  $('seedanceCancel').onclick=()=>stopActiveCapture();
  updateSeedanceProfileUI({resetProgress:true});
  $('seedancePack').onclick=async event=>{
    const btn=$('seedancePack'); if(btn.disabled) return false;
    if($('seedanceProfile').value==='white-model'){
      if(seedancePendingDownload&&seedancePendingMatchesCurrentSelection())return downloadSeedanceWhiteModelPackage(event);
      clearSeedancePendingDownload();return exportSeedanceWhiteModelPackage();
    }
    let restoreState,target;try{({restoreState,target}=prepareAutomaticCapture('seedance'));}catch(error){return reportCaptureError(error,'export.failed');}
    let transaction;try{transaction=beginCaptureTransaction('seedance-export');}catch(error){return reportCaptureError(error);}
    let error=null,success=false;
    try{
      bindAutomaticCaptureTarget(transaction,target);transaction.finalizeAfter=()=>{btn.disabled=false;btn.textContent=PreVisionI18n.t('export.seedancePack');};armAutomaticCapturePrelude(transaction,restoreState);btn.disabled=true;await prepareAutomaticCaptureTextures(transaction,target);
      const [w,h]=target.resolution;
      btn.textContent=PreVisionI18n.t('export.renderingFrames');
      activateAutomaticCaptureShot(transaction,target,0);clock.seek(0);withAutomaticCaptureSampling(transaction,()=>{globalThis.updateActors();globalThis.updateShotCam();});const f0=dataURLtoU8(renderShotFrame(w,h,target.shots[0].reframe));
      btn.textContent=PreVisionI18n.t('export.recordingPreview',{duration:target.shots[0].duration.toFixed(0)});
      if(!ownsCaptureTransaction(transaction))throw captureError('CAPTURE_CANCELLED','record.cancelled');
      const rawVideoBlob=await recordBlob(target.duration, ()=>{ clock.seek(0); playAllMode=false; },{transaction,owner:'seedance-export',restoreState,retainTransaction:true,target});
      transaction.stop=null;updateRecordingUISafely();const vidBlob=await normalizeAndValidateAutomaticExportBlob(rawVideoBlob,target);armAutomaticCapturePrelude(transaction,restoreState);btn.disabled=true;
      activateAutomaticCaptureShot(transaction,target,0);clock.seek(target.shots[0].duration);withAutomaticCaptureSampling(transaction,()=>globalThis.updateShotCam());const f1=dataURLtoU8(renderShotFrame(w,h,target.shots[0].reframe));
      const vid=new Uint8Array(await vidBlob.arrayBuffer());
      if(!ownsCaptureTransaction(transaction))throw captureError('CAPTURE_CANCELLED','record.cancelled');
      const enc=new TextEncoder();
      const zip=makeZip([
        {name:'01_previz_refvideo.'+(vidBlob.ext||'webm'), data:vid},
        {name:'02_firstframe.png', data:f0},
        {name:'03_lastframe.png', data:f1},
        {name:'04_prompt.txt', data:enc.encode(target.prompt)},
        {name:'05_shotdata.json', data:enc.encode(target.sceneJson)},
      ]);
      transaction.stop=null;updateRecordingUISafely();
      await dl(URL.createObjectURL(zip), `Seedance_${target.fileTag}_${w}x${h}.zip`);
      if(!ownsCaptureTransaction(transaction))throw captureError('CAPTURE_CANCELLED','record.cancelled');
      success=true;
    } catch(captureFailure){error=captureFailure;}
    finally {
      const finalizeError=finalizeCaptureTransaction(transaction,{restoreState,after:()=>{btn.disabled=false;btn.textContent=PreVisionI18n.t('export.seedancePack');}});
      if(finalizeError){captureDiagnostic('Seedance export finalize failed:',finalizeError);error=finalizeError;success=false;}
    }
    return error?reportCaptureError(error,'export.failed'):success;
  };
}
function initCaptureBindings(){
  ensureCaptureCanvases();
  $('aspect').onchange=e=>{
    if(globalThis.automaticCaptureMutationBlocked())return false;
    globalThis.clearReframeDraft?.(false);
    [aspectW,aspectH]=e.target.value.split(':').map(Number);
    const r=SEED_RES[e.target.value];
    $('resLabel').textContent=r[0]+'\u00d7'+r[1]; scheduleUIResize(false);globalThis.refreshReframeUI?.();globalThis.updatePrompt();markDirty();
  };
  $('snap').onclick=exportCurrentFrame;
  $('topSnap').onclick=e=>{e?.stopPropagation?.();toggleUIMenu('topSnapMenu','topSnap');};
  $('topSnapCamera').onclick=()=>{
    closeTopCaptureMenus();
    if(!desktop){exportCurrentFrame();flashTopSnap();return true;}
    return (async()=>{
      let bytes;const reframe=frozenCurrentReframe();
      try{bytes=dataURLtoU8(renderShotFrame(...SEED_RES[$('aspect').value],reframe));}
      catch(e){alert(PreVisionI18n.t('capture.saveFailed',{message:e.message}));return false;}
      const target=await chooseTopCaptureTarget('screenshot',tag()+'_frame.png');
      if(!target||target.canceled)return false;
      const out=await saveTopCaptureBytes(target,bytes,'screenshot');
      if(!out.canceled)flashTopSnap();
      return !out.canceled;
    })();
  };
  $('topSnapPage').onclick=captureWholePageFrame;
  $('exportJson').onclick=()=>dl('data:application/json;charset=utf-8,'+encodeURIComponent(sceneJSON()), tag()+'_data.json');
  $('exportShot').onclick=exportCurrentShotVideo;
  $('topRecord').onclick=topRecordCamera;
  $('topRecordMore').onclick=e=>{
    if(captureTransaction||recording||screenRecording)return;
    e?.stopPropagation?.();toggleUIMenu('topRecordMenu','topRecordMore');
  };
  $('topRecordPage').onclick=startWholePageRecording;
  $('exportAll').onclick=exportWholeSceneVideo;
  ['click','dblclick','pointerdown','beforeinput','input','change','submit','drop'].forEach(type=>document.addEventListener(type,blockAutomaticCaptureUIEvent,true));
  window.addEventListener('keydown',blockAutomaticCaptureUIEvent,true);
  initSeedancePack();
}

const defineCaptureGlobal=(name,get,set)=>Object.defineProperty(globalThis,name,{get,set,configurable:true});
defineCaptureGlobal('SEED_RES',()=>SEED_RES);
defineCaptureGlobal('REC_FPS',()=>REC_FPS);
defineCaptureGlobal('EXPORT_FPS',()=>automaticExportFps());
defineCaptureGlobal('recCanvas',()=>recCanvas);
defineCaptureGlobal('recRenderer',()=>recRenderer,value=>{recRenderer=value;});
defineCaptureGlobal('recording',()=>recording,value=>{recording=!!value;});
defineCaptureGlobal('recTrack',()=>recTrack,value=>{recTrack=value;});
defineCaptureGlobal('recTick',()=>recTick,value=>{recTick=value;});
defineCaptureGlobal('recStep',()=>recStep,value=>{recStep=value;});
defineCaptureGlobal('recStop',()=>recStop,value=>{recStop=value;});
defineCaptureGlobal('workspaceCanvas',()=>workspaceCanvas);
defineCaptureGlobal('screenRecorder',()=>screenRecorder,value=>{screenRecorder=value;});
defineCaptureGlobal('screenRecording',()=>screenRecording,value=>{screenRecording=!!value;});
defineCaptureGlobal('workspaceRecordingRun',()=>workspaceRecordingRun,value=>{workspaceRecordingRun=value;});
defineCaptureGlobal('workspaceFrameTimer',()=>workspaceFrameTimer,value=>{workspaceFrameTimer=value;});
defineCaptureGlobal('workspaceSnapshotTimer',()=>workspaceSnapshotTimer,value=>{workspaceSnapshotTimer=value;});
defineCaptureGlobal('workspaceHardCapTimer',()=>workspaceHardCapTimer,value=>{workspaceHardCapTimer=value;});
defineCaptureGlobal('workspaceSnapshot',()=>workspaceSnapshot,value=>{workspaceSnapshot=value;});
defineCaptureGlobal('workspaceSnapshotBusy',()=>workspaceSnapshotBusy,value=>{workspaceSnapshotBusy=!!value;});
defineCaptureGlobal('workspaceStream',()=>workspaceStream,value=>{workspaceStream=value;});
defineCaptureGlobal('captureTransaction',()=>captureTransaction,value=>{captureTransaction=value;});
defineCaptureGlobal('captureTransactionSequence',()=>captureTransactionSequence,value=>{captureTransactionSequence=value;});
defineCaptureGlobal('captureTargetPending',()=>captureTargetPending,value=>{captureTargetPending=!!value;});
[
  ['renderSeedanceWhiteModelFrame',renderSeedanceWhiteModelFrame],['renderShotFrame',renderShotFrame],['exportCurrentFrame',exportCurrentFrame],['closeTopCaptureMenus',closeTopCaptureMenus],
  ['flashTopSnap',flashTopSnap],['setCaptureSaveState',setCaptureSaveState],['captureDiagnostic',captureDiagnostic],
  ['setCaptureSaveStateSafely',setCaptureSaveStateSafely],['updateRecordingUISafely',updateRecordingUISafely],
  ['chooseTopCaptureTarget',chooseTopCaptureTarget],['saveTopCaptureBytes',saveTopCaptureBytes],['saveTopCaptureBlob',saveTopCaptureBlob],
  ['captureWholePageFrame',captureWholePageFrame],['tag',tag],['sceneJSON',sceneJSON],['captureError',captureError],
  ['currentCaptureTransaction',currentCaptureTransaction],
  ['captureAutomaticCaptureMutationBlocked',captureAutomaticCaptureMutationBlocked],
  ['captureDeferAutomaticCaptureMutation',captureDeferAutomaticCaptureMutation],
  ['withAutomaticCaptureMutation',withAutomaticCaptureMutation],
  ['withAutomaticPointPreviewSuppressed',withAutomaticPointPreviewSuppressed],['withAutomaticCaptureSampling',withAutomaticCaptureSampling],
  ['captureAutomaticExportTarget',captureAutomaticExportTarget],['automaticCaptureAssetIds',automaticCaptureAssetIds],
  ['prepareAutomaticCaptureTextures',prepareAutomaticCaptureTextures],['bindAutomaticCaptureTarget',bindAutomaticCaptureTarget],
  ['activateAutomaticCaptureShot',activateAutomaticCaptureShot],['blockAutomaticCaptureUIEvent',blockAutomaticCaptureUIEvent],
  ['settleAutomaticCaptureAuthoring',settleAutomaticCaptureAuthoring],['prepareAutomaticCapture',prepareAutomaticCapture],
  ['beginCaptureTransaction',beginCaptureTransaction],['ownsCaptureTransaction',ownsCaptureTransaction],
  ['releaseCaptureTransaction',releaseCaptureTransaction],['stopActiveCapture',stopActiveCapture],['reportCaptureError',reportCaptureError],
  ['captureAutomaticCaptureState',captureAutomaticCaptureState],['restoreAutomaticCaptureState',restoreAutomaticCaptureState],
  ['finalizeCaptureTransaction',finalizeCaptureTransaction],['armAutomaticCapturePrelude',armAutomaticCapturePrelude],
  ['preferredRecordingSpec',preferredRecordingSpec],['workspaceRecordingBackground',workspaceRecordingBackground],
  ['normalizeWorkspaceCaptureColors',normalizeWorkspaceCaptureColors],['mediaStreamTracks',mediaStreamTracks],
  ['stopMediaStreamTracks',stopMediaStreamTracks],['clearWorkspaceRecordingRuntime',clearWorkspaceRecordingRuntime],
  ['updateRecordingUI',updateRecordingUI],['startWholePageRecording',startWholePageRecording],
  ['stopWholePageRecording',stopWholePageRecording],['setupRec',setupRec],['recordBlob',recordBlob],
  ['automaticExportFps',automaticExportFps],['automaticExportMediaContract',automaticExportMediaContract],
  ['inspectAutomaticExportWebm',inspectAutomaticExportWebm],['assertAutomaticExportWebm',assertAutomaticExportWebm],['normalizeAndValidateAutomaticExportBlob',normalizeAndValidateAutomaticExportBlob],
  ['exportCurrentShotVideo',exportCurrentShotVideo],['topRecordCamera',topRecordCamera],
  ['exportWholeSceneVideo',exportWholeSceneVideo],['makeZip',makeZip],['dataURLtoU8',dataURLtoU8],
  ['setSeedanceProgress',setSeedanceProgress],['clearSeedancePendingDownload',clearSeedancePendingDownload],['seedancePendingDownloadIdentity',seedancePendingDownloadIdentity],['updateSeedanceProfileUI',updateSeedanceProfileUI],
  ['currentSeedanceDiagnostic',currentSeedanceDiagnostic],['setSeedanceDiagnostic',setSeedanceDiagnostic],['updateSeedanceDiagnostic',updateSeedanceDiagnostic],
  ['downloadSeedanceWhiteModelPackage',downloadSeedanceWhiteModelPackage],
  ['exportSeedanceWhiteModelPackage',exportSeedanceWhiteModelPackage],['initSeedancePack',initSeedancePack]
].forEach(([name,fn])=>defineCaptureGlobal(name,()=>fn));

export {
  SEED_RES,
  REC_FPS,
  renderSeedanceWhiteModelFrame,
  renderShotFrame,
  exportCurrentFrame,
  captureDiagnostic,
  setCaptureSaveStateSafely,
  captureWholePageFrame,
  captureError,
  currentCaptureTransaction,
  captureAutomaticCaptureMutationBlocked as automaticCaptureMutationBlocked,
  captureDeferAutomaticCaptureMutation as deferAutomaticCaptureMutation,
  startWholePageRecording,
  stopWholePageRecording,
  setupRec,
  recordBlob,
  automaticExportFps,
  automaticExportMediaContract,
  inspectAutomaticExportWebm,
  assertAutomaticExportWebm,
  normalizeAndValidateAutomaticExportBlob,
  exportCurrentShotVideo,
  makeZip,
  dataURLtoU8,
  setSeedanceProgress,
  currentSeedanceDiagnostic,
  setSeedanceDiagnostic,
  updateSeedanceDiagnostic,
  clearSeedancePendingDownload,
  seedancePendingDownloadIdentity,
  updateSeedanceProfileUI,
  downloadSeedanceWhiteModelPackage,
  exportSeedanceWhiteModelPackage,
  initSeedancePack,
  initCaptureBindings
};
