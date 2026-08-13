/* P9 inspector fragment: right rail, lists, monitor, confirmation, and UI bindings. */
const GROUND_QUICK_PRESETS={
  checker:{style:'checker'},
  light:{style:'color',color:GROUND_CHECKER_LIGHT},
  dark:{style:'color',color:GROUND_CHECKER_DARK}
};
const GROUND_QUICK_BUTTONS={checker:'groundQuickChecker',light:'groundQuickLight',dark:'groundQuickDark'};
function currentGroundQuickPreset(appearance=currentGroundAppearance()){
  if(appearance.style==='checker')return 'checker';
  if(appearance.style!=='color')return '';
  if(appearance.color===GROUND_CHECKER_LIGHT)return 'light';
  if(appearance.color===GROUND_CHECKER_DARK)return 'dark';
  return '';
}
/* Camera visualization and viewport interaction are owned by viewport/interact.js. */
/* ============ 播放系统 ============ */
function replaceSelectOptions(select,options,current=''){
  select.innerHTML='';
  options.forEach(item=>{const option=document.createElement('option');option.value=item.value;option.textContent=item.label;option.selected=item.value===current;select.appendChild(option);});
  select.value=options.some(item=>item.value===current)?current:(options[0]?.value||'');
}
function refreshCopyPathUI(){
  const sel=document.getElementById('copyPathSel'),count=document.getElementById('copyPathCount'),btn=document.getElementById('copyPathToCam');
  if(!sel)return;
  const keep=sel.value,paths=effectiveActorPaths();
  replaceSelectOptions(sel,[{value:'',label:PreVisionI18n.t('path.copyPlaceholder')}].concat(paths.map(a=>{
    const cv=actorCurve(a),len=cv?cv.getLength():0;
    return {value:a.label,label:PreVisionI18n.t('path.copyOption',{label:a.label,count:a.pathPts.length,length:len.toFixed(1),mode:PreVisionI18n.t(a.pathMode==='line'?'path.mode.line':'path.mode.curve')})};
  })),paths.some(a=>a.label===keep)?keep:'');
  if(count)count.textContent=PreVisionI18n.t('runtime.path.copyCount',{count:paths.length});
  if(btn)btn.disabled=!sel.value;
}
function refreshTimingUI(){
  const s=curShot(),mode=document.getElementById('pathTimingMode'),sel=document.getElementById('syncActorSel'),status=document.getElementById('timingStatus');
  if(!s||!mode||!sel)return;
  s.timingMode=s.timingMode==='arcLength'?'arcLength':s.timingMode==='custom'?'custom':'pointSync';
  const paths=effectiveActorPaths(),keep=s.syncActor||'';
  mode.value=s.timingMode;
  replaceSelectOptions(sel,[{value:'',label:PreVisionI18n.t('path.timingPlaceholder')}].concat(paths.map(a=>({value:a.label,label:PreVisionI18n.t(a.pathPts.length===s.camPts.length?'path.timingOptionReady':'path.timingOptionMismatch',{label:a.label,count:a.pathPts.length})}))),paths.some(a=>a.label===keep)?keep:'');
  sel.disabled=s.timingMode!=='pointSync';
  if(!status)return;
  if(s.timingMode==='custom') status.textContent=PreVisionI18n.t('runtime.timing.custom');
  else if(s.timingMode==='arcLength') status.textContent=PreVisionI18n.t('runtime.timing.arcLength');
  else if(!s.syncActor) status.textContent=PreVisionI18n.t('runtime.timing.selectSync');
  else {
    const a=pathOwner(actorByLabel(s.syncActor));
    status.textContent=!a?PreVisionI18n.t('runtime.timing.missingSync'):a.pathPts.length!==s.camPts.length
      ?PreVisionI18n.t('runtime.timing.mismatch',{cameraCount:s.camPts.length,label:a.label,actorCount:a.pathPts.length})
      :PreVisionI18n.t('runtime.timing.synced',{label:a.label,count:s.camPts.length});
  }
}
function previewChannelHasKeys(state,channelId){return previewSortedKeys(state,channelId).length>0;}
/* Playback and viewport interaction are owned by their P8 modules. */

/* ============ UI ============ */
function refreshObjectTransformUI(){
  const a=selected, sc=$('objScale'), sl=$('scaleLabel'), note=$('objScaleNote'),hy=$('objHeight'), hl=$('objHeightLabel'), snap=$('snapGround'), locate=$('locateActor');
  const seahorseHost=a?.kind==='char'&&a.mount&&actorByLabel(a.mount)?.kind==='seahorse'?actorByLabel(a.mount):null;
  const narrowScale=a?.kind==='seahorse'||!!seahorseHost;
  if(sc){
    sc.min=narrowScale ? 0.85 : 0.3;sc.max=narrowScale ? 1.15 : 3;sc.step=.05;
    sc.disabled=!a||!!seahorseHost;if(a)sc.value=Number.isFinite(a.authoredScale)?a.authoredScale:a.obj.scale.x;
    sc.title=narrowScale?PreVisionI18n.t(seahorseHost?'model.scale.linked':'model.scale.supported',{min:'0.85',max:'1.15'}):'';
  }
  if(sl) sl.textContent=a?(Number.isFinite(a.authoredScale)?a.authoredScale:a.obj.scale.x).toFixed(2)+'x':'–';
  if(note){
    note.hidden=!narrowScale;
    note.textContent=narrowScale?PreVisionI18n.t(seahorseHost?'model.scale.linked':'model.scale.supported',{min:'0.85',max:'1.15'}):'';
  }
  if(hy){ hy.disabled=!a; if(a) hy.value=a.elev||0; }
  if(hl) hl.textContent=a?((a.mount?'+':'')+(a.elev||0).toFixed(1)+'m'):'–';
  if(locate) locate.disabled=!a;
  if(snap){ snap.disabled=!a||!!a.mount; snap.title=a&&a.mount?PreVisionI18n.t('runtime.snap.mounted'):PreVisionI18n.t('runtime.snap.ground'); }
  refreshSemanticProxyUI();
}
function refreshSemanticProxyUI(){
  const a=selected,sel=$('semanticTypeSel'),typeLabel=$('semanticTypeLabel'),dimLabel=$('semanticDimensionsLabel');
  const inputs=[$('semanticWidth'),$('semanticHeight'),$('semanticDepth')],reset=$('semanticResetSize');
  if(sel&&!(sel.options?.length||sel.children?.length)){
    sel.innerHTML='<option value="">'+PreVisionI18n.t('semantic.type.none')+'</option>'+SEMANTIC_PROXY_TYPES.map(t=>`<option value="${t.id}">${PreVisionI18n.t(t.labelKey)}</option>`).join('');
  }
  const known=semanticProxyType(a?.semanticType),enabled=!!a;
  if(sel){sel.disabled=!enabled;sel.value=known?known.id:'';}
  if(typeLabel)typeLabel.textContent=a?(known?PreVisionI18n.t(known.labelKey):(a.semanticType||PreVisionI18n.t('semantic.type.none'))):'–';
  const dims=a?.dimensions?cleanDimensions(a.dimensions,known?.dimensions):null;
  if(dimLabel)dimLabel.textContent=dims?`${dims.width}×${dims.height}×${dims.depth}m`:'–';
  inputs.forEach((input,i)=>{
    if(!input)return;input.disabled=!enabled||!known;
    if(dims)input.value=[dims.width,dims.height,dims.depth][i];
    else input.value='';
  });
  if(reset)reset.disabled=!enabled||!known;
}
function applySemanticDimensionInput(){
  if(automaticCaptureMutationBlocked())return false;
  if(!selected||!semanticProxyType(selected.semanticType))return;
  const next=cleanDimensions({
    width:parseFloat($('semanticWidth').value),
    height:parseFloat($('semanticHeight').value),
    depth:parseFloat($('semanticDepth').value)
  },semanticProxyType(selected.semanticType).dimensions);
  const before=selected.dimensions?Object.assign({},selected.dimensions):null;
  const oldScale=selected.obj.scale.clone();
  selected.dimensions=next;applySemanticDimensions(selected);alignActorToTerrain(selected);
  if(collisionEnabled()&&actorPenetrates(selected)){
    selected.dimensions=before;selected.obj.scale.copy(oldScale);alignActorToTerrain(selected);
  }
  refreshObjectTransformUI();rebuildViz();updatePrompt();markDirty();
}
function refreshAfterSemanticProxyChange(){
  refreshObjectTransformUI();refreshActorPathUI();refreshObjList();refreshSceneRail();refreshMotionTimeline();rebuildViz();updatePrompt();markDirty();
}
function refreshActorPathUI(){
  const src=selected, a=pathOwner(src), has=!!a, n=has?a.pathPts.length:0;
  if(has) selActorPt=Math.max(0,Math.min(selActorPt,Math.max(0,n-1))); else selActorPt=0;
  $('pathTarget').textContent=has?(src&&src.mount?`${src.label} → ${a.label}`:a.label):PreVisionI18n.t('runtime.selection.none');
  $('actorPathMode').disabled=!has; if(has) $('actorPathMode').value=a.pathMode||'curve';
  $('actorPtLabel').textContent=n?PreVisionI18n.t('runtime.point.index',{current:selActorPt+1,total:n}):PreVisionI18n.t('runtime.point.zero');
  const p=n?a.pathPts[selActorPt]:null;
  const synced=p&&syncTargetForShot(curShot())===a;
  const arrive=p?(synced?nodeArrivalTime(selActorPt,n,curShot().dur):ensureActorTimes(a)[selActorPt]):0;
  $('actorPtPos').textContent=p?PreVisionI18n.t('runtime.actorPoint.position',{index:selActorPt+1,scope:PreVisionI18n.t(synced?'runtime.scope.shot':'runtime.scope.scene'),time:arrive.toFixed(1),x:p.x.toFixed(1),z:p.z.toFixed(1),height:(a.elev||0).toFixed(1),scale:a.obj.scale.x.toFixed(2)}):PreVisionI18n.t('runtime.actorPoint.empty');
  $('prevActorPt').disabled=!has||n<2||selActorPt<=0;
  $('nextActorPt').disabled=!has||n<2||selActorPt>=n-1;
  $('addActorPt').disabled=!has; $('delActorPt').disabled=!has||!n; $('clearActorPath').disabled=!has||!n;
}
function makeRailText(parent,tag,className,text){
  const node=document.createElement(tag);node.className=className;node.textContent=text||'';parent.appendChild(node);return node;
}
function makeRailAction(className,label,glyph,handler){
  const button=document.createElement('button');button.type='button';button.className=className;button.title=label;button.setAttribute('aria-label',label);button.textContent=glyph;
  button.onclick=event=>{event.stopPropagation();if(automaticCaptureMutationBlocked())return false;handler();};return button;
}
function makeRailCardKeyboard(card,activate){
  card.tabIndex=0;card.setAttribute('role','button');
  card.onkeydown=event=>{if((event.key==='Enter'||event.key===' ')&&!event.target.closest('button')){event.preventDefault();activate();}};
}
function updateSceneRailChrome(){
  const shotLevel=sceneRailLevel==='shots'&&!!curScene();
  $('railBack').hidden=!shotLevel;$('aiStoryboard').hidden=shotLevel;$('addScene').hidden=shotLevel;$('addshot').hidden=!shotLevel;
  const projectName=$('projname').value||project?.name||'';
  $('railTitle').textContent=shotLevel
    ?PreVisionI18n.t('hierarchy.sceneTitle',{name:curScene().name,count:shots.length})
    :PreVisionI18n.t('hierarchy.projectTitle',{name:projectName,count:project?.scenes?.length||0});
  $('railTitle').title=shotLevel?curScene().name:projectName;
}
function setSceneRailLevel(level){
  sceneRailLevel=level==='shots'&&curScene()?'shots':'scenes';refreshSceneRail();return sceneRailLevel;
}
function renderSceneRail(el){
  project.scenes.forEach((sd,i)=>{
    const isCur=i===sceneIdx,data=isCur?stageToData():sd,sceneShots=data.shots||[],total=sceneShots.reduce((sum,shot)=>sum+shot.dur,0);
    const card=document.createElement('div');card.className='rail-card scene scene-card'+(isCur?' sel':'');card.dataset.sceneIndex=String(i);card.title=data.name;
    const head=document.createElement('div');head.className='sname';card.appendChild(head);
    makeRailText(head,'b','',`${String(i+1).padStart(2,'0')} ${data.name.replace(/^[^\d]*\d+\s*·\s*/,'')}`);
    const actions=document.createElement('span');actions.className='rail-actions';head.appendChild(actions);
    actions.appendChild(makeRailAction('rename',PreVisionI18n.t('hierarchy.sceneNamePrompt'),'✎',()=>{
      const next=prompt(PreVisionI18n.t('hierarchy.sceneNamePrompt'),data.name);
      if(next){if(isCur)curScene().name=next;else sd.name=next;refreshSceneRail();markDirty();}
    }));
    actions.appendChild(makeRailAction('del',PreVisionI18n.t('hierarchy.deleteScene'),'×',()=>{
      if(project.scenes.length<=1){alert(PreVisionI18n.t('hierarchy.keepOneScene'));return;}
      showConfirm(PreVisionI18n.t('hierarchy.deleteSceneConfirm',{name:data.name}),()=>{
        if(automaticCaptureMutationBlocked())return false;
        remapPreviewOwnerKeys('scene',i);
        project.scenes.splice(i,1);
        if(i===sceneIdx)loadScene(Math.max(0,i-1),true);
        else{if(i<sceneIdx)sceneIdx--;refreshSceneRail();}
        markDirty();
      });
    }));
    makeRailText(card,'span','sdesc',data.desc||'');
    makeRailText(card,'div','smeta',PreVisionI18n.t('hierarchy.sceneMeta',{count:sceneShots.length,duration:total.toFixed(1)}));
    const bars=document.createElement('div');bars.className='bars';card.appendChild(bars);
    sceneShots.forEach(shot=>{const bar=document.createElement('i');bar.style.width=(total?shot.dur/total*100:100)+'%';bars.appendChild(bar);});
    const enter=()=>{if(i!==sceneIdx)loadScene(i);setSceneRailLevel('shots');};card.onclick=enter;makeRailCardKeyboard(card,enter);el.appendChild(card);
  });
}
function renderShotRail(el){
  shots.forEach((shot,i)=>{
    const card=document.createElement('div');card.className='rail-card shot-card'+(i===shotIdx?' sel':'');card.dataset.shotIndex=String(i);card.title=`${shot.name} · ${shot.desc||''}`;
    const thumbWrap=document.createElement('div');thumbWrap.className='shot-thumb-wrap';card.appendChild(thumbWrap);
    const canvas=document.createElement('canvas');canvas.className='shot-thumb';canvas.width=192;canvas.height=108;thumbWrap.appendChild(canvas);
    makeRailText(thumbWrap,'span','shot-index',`C${String(i+1).padStart(2,'0')}`);
    const actions=document.createElement('span');actions.className='rail-actions';thumbWrap.appendChild(actions);
    actions.appendChild(makeRailAction('rename',PreVisionI18n.t('hierarchy.shotNamePrompt'),'✎',()=>{
      const next=prompt(PreVisionI18n.t('hierarchy.shotNamePrompt'),shot.name);if(next){shot.name=next;refreshSceneRail();markDirty();}
    }));
    actions.appendChild(makeRailAction('del',PreVisionI18n.t('hierarchy.deleteShot'),'×',()=>deleteShot(i)));
    const copy=document.createElement('div');copy.className='shot-copy';card.appendChild(copy);
    makeRailText(copy,'b','shot-name',shot.name);makeRailText(copy,'span','shot-desc',shot.desc||'');
    makeRailText(copy,'span','shot-meta',PreVisionI18n.t('hierarchy.shotMeta',{duration:shot.dur.toFixed(1),focal:focalOf(shot.fov)}));
    const selectShot=()=>setShot(i,true);card.onclick=selectShot;makeRailCardKeyboard(card,selectShot);el.appendChild(card);
  });
  scheduleThumbs();
}
function refreshSceneRail(){
  const el=$('scenelist');if(!el||!project)return;el.innerHTML='';updateSceneRailChrome();
  if(sceneRailLevel==='shots')renderShotRail(el);else renderSceneRail(el);
  $('shotinfo').textContent=shots.length?PreVisionI18n.t('hierarchy.currentShot',{current:shotIdx+1,total:shots.length,description:curShot().desc||''}):'';
}
function deleteShot(i){
  if(automaticCaptureMutationBlocked())return false;
  if(shots.length<=1){alert(PreVisionI18n.t('hierarchy.keepOneShot'));return;}
  showConfirm(PreVisionI18n.t('hierarchy.deleteShotConfirm',{name:shots[i].name}),()=>{
    if(automaticCaptureMutationBlocked())return false;
    const deletedStart=shots.slice(0,i).reduce((sum,shot)=>sum+shot.dur,0),deletedDuration=shots[i].dur;removePreviewShotTimeRange(i,deletedStart,deletedDuration);
    remapPreviewOwnerKeys('camera',i);
    shots.splice(i,1);
    actors.forEach(a=>{if((a.timeLinkShot||0)===i)a.timeLink='independent';else if((a.timeLinkShot||0)>i)a.timeLinkShot--;});
    if(shotIdx>=shots.length) shotIdx=shots.length-1;
    setShot(shotIdx,true);refreshSceneRail();markDirty();
  });
  return true;
}
/* ---- 自绘确认框(替代原生 confirm) ---- */
let confirmCb=null;
function showConfirm(msg, cb){
  confirmCb=cb;
  $('confirmMsg').textContent=msg;
  showCommandModal($('confirmDlg'));
}
$('confirmOk').onclick=()=>{ $('confirmDlg').close(); const cb=confirmCb; confirmCb=null; if(cb) cb(); };
$('confirmCancel').onclick=()=>{ $('confirmDlg').close(); confirmCb=null; };
function refreshObjList(){
  const el=$('objlist'); if(!el) return; el.innerHTML='';
  actors.forEach(a=>{
    const d=document.createElement('div'); d.className='objitem'+(selected===a?' sel':'');
    const high=(a.elev||0)>5, edge=Math.abs(a.obj.position.x)>25||Math.abs(a.obj.position.z)>25;
    const meta=high?`↑${(a.elev||0).toFixed(1)}m`:(edge?PreVisionI18n.t('runtime.stage.edge'):'' );
    const dot=document.createElement('span');dot.className='dot';
    const label=document.createElement('span');label.className='objlabel';label.textContent=a.label;
    const metaNode=document.createElement('span');metaNode.className='objmeta'+(high||edge?' warn':'');metaNode.textContent=meta;
    d.appendChild(dot);d.appendChild(label);d.appendChild(metaNode);
    d.onclick=()=>select(a);
    d.ondblclick=()=>{
      if(automaticCaptureMutationBlocked())return false;
      const nn=prompt(PreVisionI18n.t('runtime.actor.renamePrompt'), a.label);
      if(nn && !actorByLabel(nn)){
        // 更新锁定/挂载引用
        shots.forEach(s=>{ if(s.lock===a.label) s.lock=nn; if(s.syncActor===a.label) s.syncActor=nn; });
        actors.forEach(x=>{ if(x.mount===a.label) x.mount=nn; });
        a.label=nn;
        a.obj.children.filter(c=>c.isSprite&&c.userData?.isLabel).forEach(c=>{a.obj.remove(c);disposeOwnedObject3D(c);});
        const lb=makeLabel(nn); lb.position.set(0,labelY(a.kind,a.obj),0); a.obj.add(lb);
        refreshObjList(); refreshLockSel(); updatePrompt(); markDirty();
      }
    };
    el.appendChild(d);
  });
  refreshLockSel();
  if(typeof refreshMountSel==='function') refreshMountSel();
}
function refreshLockSel(){
  const sel=$('lockSel'); if(!sel) return;
  const cur=curShot()?curShot().lock:PROJECT_LOCK_GLOBAL;
  replaceSelectOptions(sel,[{value:PROJECT_LOCK_GLOBAL,label:PreVisionI18n.t('camera.lockGlobal')},{value:PROJECT_LOCK_MANUAL,label:PreVisionI18n.t('camera.lockManual')}].concat(actors.map(a=>({value:a.label,label:a.label}))),cur);
}
function refreshAimUI(){
  const s=curShot(); if(!s) return;
  const manual=s.lock===PROJECT_LOCK_MANUAL,draft=currentUnifiedCameraDraftPose();
  const k=draft?.key||ensureCamKeys(s)[Math.max(0,Math.min(selCamPt,s.camPts.length-1))]||{yaw:s.yaw||0,pitch:s.pitch||0,fov:s.fov};
  $('yaw').disabled=!manual; $('pitch').disabled=!manual;
  $('yaw').value=manual?k.yaw:(s.yaw||0); $('pitch').value=manual?k.pitch:(s.pitch||0);
  $('yawLabel').textContent=PreVisionI18n.t('runtime.camera.angle',{value:(manual?k.yaw:(s.yaw||0)).toFixed(0),suffix:manual?PreVisionI18n.t('runtime.camera.pointSuffix',{index:selCamPt+1}):PreVisionI18n.t('runtime.camera.lockedSuffix')});
  $('pitchLabel').textContent=PreVisionI18n.t('runtime.camera.angle',{value:(manual?k.pitch:(s.pitch||0)).toFixed(0),suffix:manual?PreVisionI18n.t('runtime.camera.pointSuffix',{index:selCamPt+1}):PreVisionI18n.t('runtime.camera.lockedSuffix')});
  const fov=k.fov;
  $('fov').value=fov; $('fovLabel').textContent=PreVisionI18n.t('runtime.camera.fov',{value:fov.toFixed(0),focal:focalOf(fov),suffix:manual?PreVisionI18n.t('runtime.camera.pointSuffix',{index:selCamPt+1}):''});
}
function refreshCamPtUI(){
  const s=curShot(); if(!s) return;
  selCamPt=Math.max(0,Math.min(selCamPt, s.camPts.length-1));
  const draft=currentUnifiedCameraDraftPose(),p=draft?.position||s.camPts[selCamPt];
  const cv=shotCurve(s),u=cv?curveProgressAtControlPoint(cv,p,selCamPt,s.camPts.length):0;
  $('camPtY').value=p.y;
  const arrive=draft?.time??(s.timingMode==='custom'?ensureCamTimes(s)[selCamPt]:isPointSyncShot(s)?nodeArrivalTime(selCamPt,s.camPts.length,s.dur):u*s.dur);
  $('cphLabel').textContent=PreVisionI18n.t('runtime.camera.pointHeader',{current:selCamPt+1,total:s.camPts.length,time:arrive.toFixed(1),height:p.y.toFixed(1)});
  $('camPtPos').textContent=PreVisionI18n.t('runtime.camera.pointPosition',{index:selCamPt+1,x:p.x.toFixed(1),y:p.y.toFixed(1),z:p.z.toFixed(1)});
  refreshAimUI();
}
let shotDurationDraft=null;
function shotDurationRangeMaximum(value){
  return Math.max(20,Math.ceil(Math.max(SHOT_DURATION_MIN,+value||SHOT_DURATION_MIN)*10)/10);
}
function refreshShotDurationControls(s,{keepFeedback=false}={}){
  const slider=$('shotDur'),input=$('shotDurValue'),feedback=$('shotDurFeedback'),
    committed=Math.max(SHOT_DURATION_MIN,+s.dur||SHOT_DURATION_MIN),
    draft=shotDurationDraft?.shot===s&&Number.isFinite(shotDurationDraft.value)?shotDurationDraft.value:null,
    value=draft===null?committed:draft;
  slider.max=shotDurationRangeMaximum(Math.max(committed,value));
  slider.value=value.toFixed(1);input.value=value.toFixed(1);
  if(!keepFeedback&&feedback)feedback.textContent=PreVisionI18n.t('shot.durationHint');
}
function beginShotDurationDraft(){
  if(automaticCaptureMutationBlocked())return null;
  const shot=curShot();if(!shot)return null;
  if(shotDurationDraft?.shot!==shot)shotDurationDraft=null;
  if(!shotDurationDraft)shotDurationDraft={shot,oldDuration:+shot.dur,value:+shot.dur};
  return shotDurationDraft;
}
function previewShotDurationValue(rawValue,source){
  const draft=beginShotDurationDraft(),value=Number(rawValue),slider=$('shotDur'),input=$('shotDurValue');
  if(!draft)return false;
  draft.value=value;
  if(Number.isFinite(value)){
    const rounded=Math.round(value*10)/10;
    slider.max=shotDurationRangeMaximum(Math.max(+draft.shot.dur||0,rounded));
    if(source!=='slider'&&rounded>=SHOT_DURATION_MIN)slider.value=String(rounded);
    if(source!=='number')input.value=rounded.toFixed(1);
  }
  return true;
}
function cancelShotDurationDraft({keepFeedback=false}={}){
  const shot=shotDurationDraft?.shot||curShot();shotDurationDraft=null;
  if(shot)refreshShotDurationControls(shot,{keepFeedback});
  return {ok:true,cancelled:true};
}
function shotDurationFeedback(result){
  const feedback=$('shotDurFeedback');if(!feedback)return;
  const reason=result?.reason||'unsafeMaterialization',key={
    invalidDuration:'shot.durationReject.invalid',
    invalidShot:'shot.durationReject.unsafe',
    malformedScene:'shot.durationReject.unsafe',
    malformedCamera:'shot.durationReject.unsafe',
    malformedActor:'shot.durationReject.unsafe',
    unsafeMaterialization:'shot.durationReject.unsafe',
    unsafePointSync:'shot.durationReject.pointSync',
    unsafePreview:'shot.durationReject.unsafe',
    cameraKeyCut:'shot.durationReject.cameraKey',
    actorKeyCut:'shot.durationReject.actorKey',
    sceneKeyCut:'shot.durationReject.sceneKey',
    linkedTiming:'shot.durationReject.linked',
    stalePlan:'shot.durationReject.stale'
  }[reason]||'shot.durationReject.unsafe';
  feedback.textContent=PreVisionI18n.t(key,{
    minimum:SHOT_DURATION_MIN.toFixed(1),label:result?.label||'',time:Number.isFinite(+result?.time)?(+result.time).toFixed(1):'–'
  });
}
function commitShotDurationDraft(rawValue){
  if(automaticCaptureMutationBlocked())return {ok:false,reason:'captureBlocked'};
  const shot=curShot(),numeric=Number(rawValue);
  if(!shot)return {ok:false,reason:'invalidShot'};
  if(!shotDurationDraft&&Number.isFinite(numeric)&&Math.abs(Math.round(numeric*10)/10-(+shot.dur||0))<1e-9)return {ok:true,noChange:true};
  beginShotDurationDraft();
  const plan=planRuntimeShotDurationChange(numeric);
  if(!plan.ok){shotDurationFeedback(plan);cancelShotDurationDraft({keepFeedback:true});return plan;}
  if(plan.noChange){cancelShotDurationDraft();return {ok:true,noChange:true};}
  commitHistoryCapture();
  const applied=applyRuntimeShotDurationChange(plan);
  if(!applied.ok){shotDurationFeedback(applied);cancelShotDurationDraft({keepFeedback:true});return applied;}
  shotDurationDraft=null;
  time=Math.min(time,shot.dur);
  if(time>=shot.dur){playing=false;playAllMode=false;updatePlayBtn();}
  refreshSceneRail();refreshShotPanel();refreshTimingUI();refreshMotionTimeline();updateActors();updateShotCam();rebuildViz();updateScrub();updatePathLen();updatePrompt();scheduleThumbs();
  markDirty();
  const feedback=$('shotDurFeedback');if(feedback)feedback.textContent=PreVisionI18n.t('shot.durationChanged',{duration:shot.dur.toFixed(1)});
  return {ok:true,plan};
}
function refreshShotPanel(){
  const s=curShot(); if(!s) return;
  if(shotDurationDraft?.shot!==s)shotDurationDraft=null;
  refreshShotDurationControls(s);
  refreshLockSel(); refreshAimUI(); refreshCamPtUI();
  updateMonitor();
  updatePrompt();
}
function updatePathLen(){
  const s=curShot(); if(!s) return;
  const cv=shotCurve(s);
  $('pathLen').textContent=PreVisionI18n.t('runtime.camera.pathLength',{length:cv?PreVisionI18n.t('runtime.camera.meters',{value:cv.getLength().toFixed(1)}):PreVisionI18n.t('runtime.camera.fixed'),duration:s.dur.toFixed(1)});
}
function updateScrub(){
  if(!shots.length) return;
  const g=shotStart(shotIdx)+Math.min(time,curShot().dur);
  $('tc').textContent=fmt(g)+' / '+fmt(sceneDur());
  updateMotionPlayhead();
  updateMonTc();
}
/* ---- 监视器状态 ---- */
function updateMonTc(){
  const s=curShot(); if(!s) return;
  const mt=$('monTc'); if(!mt) return;
  mt.innerHTML=fmt(Math.min(time,s.dur))+' <i>/ '+fmt(s.dur)+'</i>';
  const f=$('monBarFill'); if(f) f.style.width=(Math.min(time/s.dur,1)*100)+'%';
  const ml=$('monLens');
  if(ml) ml.textContent=PreVisionI18n.t('runtime.monitor.cameraMeta',{focal:focalOf(shotCam.fov),height:camBall.position.y.toFixed(1),angle:s.lock===PROJECT_LOCK_MANUAL?PreVisionI18n.t('runtime.monitor.angleSuffix',{value:Math.round(shotCam.rotation.x*180/Math.PI)}):''});
}
function updateMonitor(){
  const s=curShot(); if(!s) return;
  const t=$('monTitle');
  const pv=(previewCamPt!==null?PreVisionI18n.t('runtime.monitor.cameraPointSuffix',{index:previewCamPt+1}):'')+(previewActorPoint?PreVisionI18n.t('runtime.monitor.actorPointSuffix',{label:previewActorPoint.actor.label,index:previewActorPoint.idx+1}):'')+((previewCamPt!==null||previewActorPoint)?PreVisionI18n.t('runtime.monitor.independentSuffix'):'' );
  if(t) t.textContent=PreVisionI18n.t('runtime.monitor.title',{scene:sceneIdx+1,shot:shotIdx+1,name:s.name.replace(/^\d+\s*/,''),preview:pv});
  updateMonTc();
}
function fmt(s){return `${String(Math.floor(s/60)).padStart(2,'0')}:${(s%60).toFixed(1).padStart(4,'0')}`}
function updatePlayBtn(){
  const active=!!playing,label=$('playBtnLabel'),icon=$('playBtnIcon'),button=$('playBtn');
  label.textContent=active?PreVisionI18n.t('playback.pause'):PreVisionI18n.t('playback.preview');icon.setAttribute('href',active?'#i-pause':'#i-play');button.setAttribute('aria-label',active?PreVisionI18n.t('playback.pausePreview'):PreVisionI18n.t('playback.startPreview'));
}
function setShot(i, resetTime){
  if(automaticCaptureMutationBlocked())return false;
  clearUnifiedCameraDraft();
  globalThis.clearReframeDraft?.(false);
  clearTimelineCameraPositionSelection(true);
  shotIdx=Math.max(0,Math.min(shots.length-1,i));
  if(resetTime){clearPointPreview();time=0;playing=false;updatePlayBtn();selCamPt=0;}
  refreshSceneRail();refreshShotPanel();refreshMotionTimeline();rebuildViz();updateScrub();
  return true;
}
/* RefreshHub wiring (refactor P4, ADR-0010): the 22 refresh functions register once and
 * are dispatched by core/store.js `refresh` in its fixed flush order. Transitional home
 * for the registrations is app.js (function declarations hoist, so forward references
 * are safe); each registration moves out with its owning UI module in P5-P9.
 * P5 (ADR-0011): 'prompt' registered in export/prompt.js with updatePrompt.
 * P8 (ADR-0015): 'viz' registered in viewport/interact.js with rebuildViz — 20 here,
 * 22 total. */
refresh.register('sceneRail',refreshSceneRail);
refresh.register('objList',refreshObjList);
refresh.register('shotPanel',refreshShotPanel);
refresh.register('camPt',refreshCamPtUI);
refresh.register('aim',refreshAimUI);
refresh.register('lock',refreshLockSel);
refresh.register('transform',refreshObjectTransformUI);
refresh.register('semantic',refreshSemanticProxyUI);
refresh.register('actorPath',refreshActorPathUI);
refresh.register('timing',refreshTimingUI);
refresh.register('joint',refreshJointUI);
refresh.register('mount',refreshMountSel);
refresh.register('sun',refreshSunUI);
refresh.register('ground',refreshGroundUI);
refresh.register('bg',refreshBgUI);
refresh.register('motionTimeline',refreshMotionTimeline);
refresh.register('scrub',updateScrub);
refresh.register('playBtn',updatePlayBtn);
refresh.register('monitor',updateMonitor);
refresh.register('thumbs',scheduleThumbs);
function syncAll(){refresh.all();}

/* ============ 控件事件 ============ */
(function initUIChrome(){
  [['menuProjectTrigger','menuProject'],['menuEditTrigger','menuEdit'],['menuViewTrigger','menuView'],['themeTrigger','themeMenu']]
    .forEach(([triggerId,menuId])=>{$(triggerId).onclick=e=>{e?.stopPropagation?.();toggleUIMenu(menuId,triggerId);};});
  [['themeGraphite','graphite'],['themeMist','mist'],['themeTwilight','twilight'],['themeAmber','amber']]
    .forEach(([id,theme])=>{$(id).onclick=()=>{setUITheme(theme);closeUIMenus();};});
  [['menuNew','btnNew'],['menuOpen','btnOpen'],['menuSave','btnSave'],['menuUndo','undoBtn']]
    .forEach(([menuId,targetId])=>{$(menuId).onclick=()=>{closeUIMenus();$(targetId).click();};});
  $('menuDelete').onclick=()=>{closeUIMenus();routeTimelineDeleteCommand();};
  $('menuLeft').onclick=()=>{closeUIMenus();setLeftPanelState($('appWorkspace').dataset.left==='expanded'?'rail':'expanded');};
  $('menuRight').onclick=()=>{closeUIMenus();setRightPanelState($('appWorkspace').dataset.right==='expanded'?'rail':'expanded');};
  $('menuTimeline').onclick=()=>{closeUIMenus();cycleTimelineState();};
  $('menuFocus').onclick=()=>{closeUIMenus();setDirectorFocus();};
  $('railBack').onclick=()=>setSceneRailLevel('scenes');
  $('railToggle').onclick=()=>setLeftPanelState('rail');
  $('modeScenes').onclick=()=>setLeftPanelState($('appWorkspace').dataset.left==='expanded'?'rail':'expanded');
  [['rightRailCamera',0],['rightRailActors',1],['rightRailPath',2],['rightRailLighting',3]].forEach(([id,index])=>{$(id).onclick=()=>openInspector(index,id);});
  $('rightToggle').onclick=()=>setRightPanelState('rail');
  $('rightRailExpand').onclick=()=>{
    if($('appWorkspace').classList.contains('director-focus')){$('right').classList.add('peek');scheduleUIResize();}
    else setRightPanelState('expanded');
  };
  $('timelineMode').onclick=$('modeTimeline').onclick=cycleTimelineState;
  $('directorFocus').onclick=$('modeFocus').onclick=()=>setDirectorFocus();
  document.addEventListener('pointerdown',e=>{
    if(!e.target.closest?.('.app-menu-wrap,.top-action-wrap'))closeUIMenus();
    if(($('appWorkspace').dataset.right==='peek'||$('right').classList.contains('peek'))&&!e.target.closest?.('#right,#modeRail'))restoreRightPanelAfterPeek();
  });
})();
$('playBtn').onclick=()=>{if(automaticCaptureMutationBlocked())return false;if(!shots.length)return;clearPointPreview();if(time>=curShot().dur&&!playAllMode)time=0;playAllMode=false;playing=!playing;updatePlayBtn();updateMonitor();};
$('playShot').onclick=()=>{if(automaticCaptureMutationBlocked())return false;clearPointPreview();time=0;playAllMode=false;playing=true;updatePlayBtn();updateMonitor();};
$('playAll').onclick=()=>{if(automaticCaptureMutationBlocked())return false;clearPointPreview();setShot(0,true);playAllMode=true;playing=true;updatePlayBtn();updateMonitor();};
$('prevShot').onclick=()=>setShot(shotIdx-1,true);
$('nextShot').onclick=()=>setShot(shotIdx+1,true);
/* ---- 监视器: 三分线/安全框开关 ---- */
$('monGrid').onclick=()=>{
  const on=$('monGrid').classList.toggle('on');
  $('monThirds').style.display=$('monSafe').style.display=on?'':'none';
};
$('modeMove').onclick=()=>setDragMode('move');
$('modeRot').onclick=()=>setDragMode('rot');
function refreshCameraFollowUI(){
  const button=$('camDrive'),label=$('camDriveLabel');if(!button)return;
  button.classList.toggle('on',camDriveMode);button.setAttribute('aria-pressed',camDriveMode?'true':'false');
  const labelText=PreVisionI18n.t(camDriveMode?'toolbar.followCameraActive':'toolbar.followCamera');
  if(label)label.textContent=labelText;button.setAttribute('aria-label',labelText);
  button.title=PreVisionI18n.t(camDriveMode?'toolbar.followCameraOnTitle':'toolbar.followCameraOffTitle');
}
$('camDrive').onclick=()=>{camDriveMode=!camDriveMode;refreshCameraFollowUI();};
refreshCameraFollowUI();
const toggleReframeFromEntry=()=>{
  const active=globalThis.toggleReframeEditor();
  if(active)requestAnimationFrame(()=>$('gl').focus?.({preventScroll:true}));
  return active;
};
$('reframeEdit').onclick=$('reframeEditRight').onclick=toggleReframeFromEntry;
$('reframeZoomOut').onclick=()=>globalThis.adjustReframeZoom(-.12);
$('reframeZoomIn').onclick=()=>globalThis.adjustReframeZoom(.12);
$('reframeReset').onclick=()=>globalThis.resetCurrentShotReframe();
globalThis.refreshReframeUI();
$('fitAll').onclick=fitAllActors;
$('keys').onclick=()=>showCommandModal($('keysDlg'));
$('viewsel').onchange=e=>{
  const v=e.target.value;
  if(v==='top'){orbit.phi=.25;orbit.dist=30}
  else if(v==='horiz'){orbit.phi=1.45;orbit.dist=18}
  else{orbit.phi=1.05;orbit.dist=22}
  applyOrbit();
};
$('showDispatch').onchange=rebuildViz; $('showCamline').onchange=rebuildViz;
const shotDurationSlider=$('shotDur'),shotDurationInput=$('shotDurValue');
let shotDurationPointerId=null;
shotDurationSlider.onpointerdown=e=>{beginShotDurationDraft();shotDurationPointerId=e.pointerId;shotDurationSlider.setPointerCapture?.(e.pointerId);};
shotDurationSlider.oninput=e=>previewShotDurationValue(e.target.value,'slider');
shotDurationSlider.onpointerup=e=>{
  if(shotDurationPointerId!==null&&e.pointerId!==shotDurationPointerId)return;
  shotDurationPointerId=null;shotDurationSlider.releasePointerCapture?.(e.pointerId);commitShotDurationDraft(e.currentTarget.value);
};
shotDurationSlider.onpointercancel=e=>{
  if(shotDurationPointerId!==null&&e.pointerId!==shotDurationPointerId)return;
  shotDurationPointerId=null;cancelShotDurationDraft();
};
shotDurationSlider.onchange=e=>commitShotDurationDraft(e.target.value);
shotDurationSlider.onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();commitShotDurationDraft(e.currentTarget.value);}else if(e.key==='Escape'){e.preventDefault();cancelShotDurationDraft();}};
shotDurationInput.onfocus=()=>{beginShotDurationDraft();shotDurationInput.select?.();};
shotDurationInput.oninput=e=>previewShotDurationValue(e.target.value,'number');
shotDurationInput.onkeydown=e=>{
  if(e.key==='Enter'){e.preventDefault();commitShotDurationDraft(e.currentTarget.value);e.currentTarget.blur?.();}
  else if(e.key==='Escape'){e.preventDefault();cancelShotDurationDraft();e.currentTarget.blur?.();}
};
shotDurationInput.onblur=e=>commitShotDurationDraft(e.currentTarget.value);
$('lockSel').onchange=e=>{if(automaticCaptureMutationBlocked())return false;if(curShot()){curShot().lock=e.target.value;ensureCamKeys(curShot());refreshAimUI();rebuildViz();updatePrompt();markDirty()}};
$('yaw').oninput=e=>{
  if(automaticCaptureMutationBlocked())return false;const s=curShot();if(!s||s.lock!==PROJECT_LOCK_MANUAL)return false;
  const value=parseInt(e.target.value);if(!Number.isFinite(value))return false;
  if(cameraEditUsesTransientDraft(selCamPt)){beginUnifiedCameraDraft(selCamPt);updateUnifiedCameraDraft({yaw:value});refreshAimUI();rebuildVizLight();updatePrompt();return true;}
  ensureCamKeys(s)[selCamPt].yaw=value;s.yaw=value;notePreviewEdit(previewCameraOwnerKey(),['yaw']);refreshAimUI();rebuildVizLight();updatePrompt();markDirty();return true;
};
$('pitch').oninput=e=>{
  if(automaticCaptureMutationBlocked())return false;const s=curShot();if(!s||s.lock!==PROJECT_LOCK_MANUAL)return false;
  const value=parseInt(e.target.value);if(!Number.isFinite(value))return false;
  if(cameraEditUsesTransientDraft(selCamPt)){beginUnifiedCameraDraft(selCamPt);updateUnifiedCameraDraft({pitch:value});refreshAimUI();rebuildVizLight();updatePrompt();return true;}
  ensureCamKeys(s)[selCamPt].pitch=value;s.pitch=value;notePreviewEdit(previewCameraOwnerKey(),['pitch']);refreshAimUI();rebuildVizLight();updatePrompt();markDirty();return true;
};
$('camPtY').oninput=e=>{
  if(automaticCaptureMutationBlocked())return false;
  const s=curShot(); if(!s) return;
  const raw=e?.target?.value,numeric=typeof raw==='string'&&raw.trim()===''?NaN:Number(raw);
  if(!Number.isFinite(numeric)){refreshCamPtUI();return false;}
  if(cameraEditUsesTransientDraft(selCamPt)){
    const draft=beginUnifiedCameraDraft(selCamPt),height=clampAuthoredCameraPointHeight(numeric,draft?.position.y);
    updateUnifiedCameraDraft({'position.y':height});refreshCamPtUI();rebuildVizLight();updateShotCam();return true;
  }
  const p=s.camPts[Math.min(selCamPt,s.camPts.length-1)];
  p.y=clampAuthoredCameraPointHeight(numeric,p.y);
  notePreviewEdit(previewCameraOwnerKey(),{'position.y':p.y});refreshCamPtUI(); rebuildVizLight();updateShotCam();markDirty();
};

/* ---- 运镜点增删 ---- */
$('prevCamPt').onclick=()=>{const s=curShot();if(!s)return;previewCameraPoint(Math.max(0,selCamPt-1));};
$('nextCamPt').onclick=()=>{const s=curShot();if(!s)return;previewCameraPoint(Math.min(s.camPts.length-1,selCamPt+1));};
$('addPt').onclick=()=>{
  if(automaticCaptureMutationBlocked())return false;
  const s=curShot(); if(!s) return;
  const i=Math.min(selCamPt, s.camPts.length-1);
  let np;
  if(i<s.camPts.length-1) np=s.camPts[i].clone().lerp(s.camPts[i+1],.5);          // 中点插入
  else if(s.camPts.length>1) np=s.camPts[i].clone().add(s.camPts[i].clone().sub(s.camPts[i-1]).multiplyScalar(.6)); // 末端延伸
  else np=s.camPts[i].clone().add(v3(1.5,0,1.5));
  np.y=clampAuthoredCameraPointHeight(np.y,clampAuthoredCameraPointHeight(s.camPts[i]?.y));
  const keys=ensureCamKeys(s),a=keys[i],b=keys[Math.min(i+1,keys.length-1)]||a;
  const nk={yaw:a.yaw+(b.yaw-a.yaw)*.5,pitch:a.pitch+(b.pitch-a.pitch)*.5,fov:a.fov+(b.fov-a.fov)*.5};
  s.camPts.splice(i+1,0,np); keys.splice(i+1,0,nk); selCamPt=i+1;
  s.camTimes=distributedPathTimes(s.camPts,0,s.dur);s.camAimTimes=s.camTimes.slice();s.camFovTimes=s.camTimes.slice();ensureEaseArray(s,'camEase',s.camPts.length-1);ensureEaseArray(s,'camAimEase',s.camPts.length-1);ensureEaseArray(s,'camFovEase',s.camPts.length-1);s.timingMode='custom';
  refreshCamPtUI(); refreshTimingUI(); refreshMotionTimeline(); rebuildViz(); markDirty();
};
$('delPt').onclick=()=>{
  if(automaticCaptureMutationBlocked())return false;
  return executeCameraPositionPointDeletion([Math.min(selCamPt,Math.max(0,(curShot()?.camPts.length||1)-1))]);
};
$('copyPathSel').onchange=e=>{$('copyPathToCam').disabled=!e.target.value;};
$('copyPathToCam').onclick=()=>{if($('copyPathSel').value)copyActorPathToCamera($('copyPathSel').value);};
$('pathTimingMode').onchange=e=>{if(automaticCaptureMutationBlocked())return false;const s=curShot();if(!s)return;s.timingMode=e.target.value==='arcLength'?'arcLength':e.target.value==='custom'?'custom':'pointSync';refreshTimingUI();refreshMotionTimeline();updateActors();updateShotCam();updatePrompt();markDirty();};
$('syncActorSel').onchange=e=>{if(automaticCaptureMutationBlocked())return false;const s=curShot();if(!s)return;s.syncActor=e.target.value;refreshTimingUI();updateActors();updateShotCam();updatePrompt();markDirty();};

/* ---- 六种运镜预设(以起幅点为基准,围绕锁定目标生成) ---- */
function applyPreset(type){
  if(automaticCaptureMutationBlocked())return false;
  const s=curShot(); if(!s) return;
  const baseKey=Object.assign({},ensureCamKeys(s)[0]);
  const tgt=lockTarget(s.lock==='手动朝向'?'全局':s.lock);
  const p0=s.camPts[0].clone();
  const off=p0.clone().sub(tgt); off.y=0;
  const d=Math.max(1.5, off.length()); const dir=off.normalize();
  const side=v3(dir.z,0,-dir.x);
  let pts;
  if(type==='push') pts=[p0, tgt.clone().addScaledVector(dir, Math.max(1.2,d*.35)).setY(Math.max(.5,p0.y*.75))];
  else if(type==='pull') pts=[p0, tgt.clone().addScaledVector(dir, d*2.2).setY(p0.y*1.4+.3)];
  else if(type==='orbit'){
    pts=[]; const a0=Math.atan2(p0.x-tgt.x, p0.z-tgt.z);
    for(let i=0;i<=3;i++){ const a=a0+(i/3)*(Math.PI/2); pts.push(v3(tgt.x+Math.sin(a)*d, p0.y, tgt.z+Math.cos(a)*d)); }
  }
  else if(type==='truck') pts=[p0.clone().addScaledVector(side,-d*.45), p0.clone().addScaledVector(side,d*.45)];
  else if(type==='crane') pts=[v3(p0.x,Math.max(.5,p0.y*.35),p0.z), v3(p0.x,p0.y*2+1.5,p0.z)];
  else pts=[p0]; // static
  const fallbackHeight=clampAuthoredCameraPointHeight(p0.y);
  pts.forEach(point=>{point.y=clampAuthoredCameraPointHeight(point.y,fallbackHeight);});
  s.camPts=pts;s.camMode='curve';s.camKeys=pts.map(()=>Object.assign({},baseKey));s.camTimes=distributedPathTimes(pts,0,s.dur);s.camAimTimes=s.camTimes.slice();s.camFovTimes=s.camTimes.slice();s.camEase=[];s.camAimEase=[];s.camFovEase=[];ensureEaseArray(s,'camEase',pts.length-1);ensureEaseArray(s,'camAimEase',pts.length-1);ensureEaseArray(s,'camFovEase',pts.length-1);s.timingMode='custom';selCamPt=0;
  refreshCamPtUI(); rebuildViz(); updatePrompt(); markDirty();
}
$('pPush').onclick=()=>applyPreset('push');
$('pPull').onclick=()=>applyPreset('pull');
$('pOrbit').onclick=()=>applyPreset('orbit');
$('pTruck').onclick=()=>applyPreset('truck');
$('pCrane').onclick=()=>applyPreset('crane');
$('pStatic').onclick=()=>applyPreset('static');

/* ---- 所见即所得: 当前观察视角一键设为起幅/落幅 ---- */
function viewAim(){
  const dir=orbit.target.clone().sub(viewCam.position).normalize();
  return {yaw:Math.round(Math.atan2(-dir.x,-dir.z)*180/Math.PI),
          pitch:Math.round(Math.asin(Math.max(-1,Math.min(1,dir.y)))*180/Math.PI)};
}
function writeViewAimToKey(s,i){
  const a=viewAim(),k=ensureCamKeys(s)[i];
  k.yaw=a.yaw;k.pitch=a.pitch;s.yaw=a.yaw;s.pitch=a.pitch;
}
function writeCurrentView(positionToo){
  if(automaticCaptureMutationBlocked())return false;
  const s=curShot();if(!s)return;
  s.lock='手动朝向';refreshLockSel();
  const i=Math.max(0,Math.min(selCamPt,s.camPts.length-1));
  if(positionToo){const previousHeight=s.camPts[i].y;s.camPts[i].copy(viewCam.position);s.camPts[i].y=clampAuthoredCameraPointHeight(s.camPts[i].y,previousHeight);}
  writeViewAimToKey(s,i);
  const point=s.camPts[i],key=ensureCamKeys(s)[i],values={yaw:key.yaw,pitch:key.pitch};
  if(positionToo)Object.assign(values,{'position.x':point.x,'position.y':point.y,'position.z':point.z});
  const ownerKey=previewCameraOwnerKey();notePreviewEdit(ownerKey,values);
  refreshCamPtUI();refreshTimingUI();refreshMotionTimeline();rebuildViz();updateShotCam();
  finishPreviewEdit(ownerKey);updatePrompt();markDirty();
}
function setEndpointFromView(isStart){
  if(automaticCaptureMutationBlocked())return false;
  const s=curShot(); if(!s) return;
  const p=viewCam.position.clone();
  if(isStart){const target=s.camPts[0];p.y=clampAuthoredCameraPointHeight(p.y,target.y);target.copy(p);}
  else if(s.camPts.length<2){p.y=clampAuthoredCameraPointHeight(p.y,clampAuthoredCameraPointHeight(s.camPts[0]?.y));s.camPts.push(p);s.camTimes=distributedPathTimes(s.camPts,0,s.dur);s.camAimTimes=s.camTimes.slice();s.camFovTimes=s.camTimes.slice();ensureEaseArray(s,'camEase',s.camPts.length-1);ensureEaseArray(s,'camAimEase',s.camPts.length-1);ensureEaseArray(s,'camFovEase',s.camPts.length-1);}
  else {const target=s.camPts[s.camPts.length-1];p.y=clampAuthoredCameraPointHeight(p.y,target.y);target.copy(p);}
  selCamPt=isStart?0:s.camPts.length-1;
  ensureCamKeys(s);
  if(s.lock==='手动朝向') writeViewAimToKey(s,selCamPt);
  refreshCamPtUI(); rebuildViz(); updatePrompt(); markDirty();
}
$('setCurrentView').onclick=()=>writeCurrentView(true);
$('setCurrentAim').onclick=()=>writeCurrentView(false);
$('setStart').onclick=()=>setEndpointFromView(true);
$('setEnd').onclick=()=>setEndpointFromView(false);

/* ---- 选中对象缩放 ---- */
$('objScale').oninput=e=>{
  if(automaticCaptureMutationBlocked())return false;
  if(!selected){ $('scaleLabel').textContent=PreVisionI18n.t('runtime.selection.none'); return; }
  const v=parseFloat(e.target.value);
  const actual=setActorScaleSafely(selected,v);
  if(selected.kind==='desert')alignAllActorsToTerrain();
  e.target.value=actual;
  $('scaleLabel').textContent=actual.toFixed(2)+'x';
  refreshObjectTransformUI();
  notePreviewEdit(previewActorOwnerKey(selected),['scale']);
  markDirty();
};
/* ---- 对象高度 / 贴地 / 碰撞开关 ---- */
$('objHeight').oninput=e=>{
  if(automaticCaptureMutationBlocked())return false;
  if(!selected){ $('objHeightLabel').textContent=PreVisionI18n.t('runtime.selection.none'); return; }
  const actual=setActorElevation(selected,parseFloat(e.target.value));
  if(selected.kind==='desert')alignAllActorsToTerrain();
  e.target.value=actual; $('objHeightLabel').textContent=(selected.mount?'+':'')+actual.toFixed(1)+'m';
  rebuildVizLight();notePreviewEdit(previewActorOwnerKey(selected),['elevation']);updatePrompt(); markDirty();
};
$('snapGround').onclick=()=>{
  if(automaticCaptureMutationBlocked())return false;
  if(!selected||selected.mount) return;
  snapActorToGround(selected);if(selected.kind==='desert')alignAllActorsToTerrain();refreshObjectTransformUI(); rebuildViz(); updatePrompt(); markDirty();
};
$('locateActor').onclick=()=>{ if(selected) focusActor(selected); };
$('collisionOn').onchange=e=>{
  if(automaticCaptureMutationBlocked())return false;
  project.settings=project.settings||{}; project.settings.collision=!!e.target.checked; markDirty();
};
$('showLabels').onchange=e=>{
  if(automaticCaptureMutationBlocked())return false;
  project.settings=project.settings||{}; project.settings.labels=!!e.target.checked;
  updateLabelVisibility(camDriveMode); markDirty();
};

/* ---- 角色 / 道具调度点控制 ---- */
$('actorPathMode').onchange=e=>{
  if(automaticCaptureMutationBlocked())return false;
  const a=pathOwner(selected); if(!a) return;
  a.pathMode=e.target.value==='line'?'line':'curve'; rebuildViz(); updatePrompt(); markDirty();
};
$('prevActorPt').onclick=()=>{const a=pathOwner(selected);if(!a||!a.pathPts.length)return;previewActorPathPoint(a,Math.max(0,selActorPt-1));};
$('nextActorPt').onclick=()=>{const a=pathOwner(selected);if(!a||!a.pathPts.length)return;previewActorPathPoint(a,Math.min(a.pathPts.length-1,selActorPt+1));};
$('addActorPt').onclick=()=>{ if(selected) addActorPathPoint(selected); };
$('delActorPt').onclick=()=>{ if(selected) removeActorPathPoint(selected); };
$('clearActorPath').onclick=()=>{
  if(automaticCaptureMutationBlocked())return false;
  const a=pathOwner(selected); if(!a) return;
  a.pathPts=[];a.pathTimes=[];a.pathEase=[];selActorPt=0;refreshActorPathUI();refreshMotionTimeline();rebuildViz();updatePrompt();markDirty();
};
$('fov').oninput=e=>{
  if(automaticCaptureMutationBlocked())return false;const s=curShot();if(!s)return false;const value=parseInt(e.target.value);if(!Number.isFinite(value))return false;
  if(cameraEditUsesTransientDraft(selCamPt)){beginUnifiedCameraDraft(selCamPt);updateUnifiedCameraDraft({fov:value});refreshAimUI();refreshSceneRail();updateShotCam();updateMonitor();updatePrompt();return true;}
  ensureCamKeys(s)[selCamPt].fov=value;s.fov=value;refreshAimUI();refreshSceneRail();notePreviewEdit(previewCameraOwnerKey(),['fov']);updateShotCam();updateMonitor();updatePrompt();markDirty();return true;
};
['yaw','pitch','camPtY','fov'].forEach(id=>$(id).addEventListener('change',()=>finishPreviewEdit(previewCameraOwnerKey())));
['objScale','objHeight'].forEach(id=>$(id).addEventListener('change',()=>{if(selected)finishPreviewEdit(previewActorOwnerKey(selected));}));
$('projname').oninput=()=>{if(automaticCaptureMutationBlocked())return false;updateSceneRailChrome();markDirty();};
$('delShot').onclick=()=>deleteShot(shotIdx);

/* 对象增删 */
function addDirectorProxy(semanticType,labelKey){
  const index=actors.filter(a=>a.semanticType===semanticType).length+1;
  const a=placeActorWithoutOverlap(buildActor({kind:'char',semanticType,label:PreVisionI18n.t(labelKey,{index}),pos:[Math.random()*6-3,Math.random()*6-3],rotY:0,path:[]}));
  select(a);refreshAfterSemanticProxyChange();
}
$('addAdultMale').onclick=()=>addDirectorProxy('adult_male','model.default.adultMale');
$('addAdultFemale').onclick=()=>addDirectorProxy('adult_female','model.default.adultFemale');
$('addChild').onclick=()=>addDirectorProxy('child','model.default.child');
$('addProp').onclick=()=>{ placeActorWithoutOverlap(buildActor({kind:'prop',label:PreVisionI18n.t('model.default.prop',{index:actors.filter(a=>a.kind==='prop').length+1}),pos:[Math.random()*6-3,Math.random()*6-3],rotY:0,path:[]})); refreshObjList(); rebuildViz(); markDirty(); };
$('addCar').onclick=()=>{ placeActorWithoutOverlap(buildActor({kind:'car',label:PreVisionI18n.t('model.default.vehicle',{index:actors.filter(a=>a.kind==='car').length+1}),pos:[Math.random()*8-4,Math.random()*8-4],rotY:0,path:[]})); refreshObjList(); rebuildViz(); markDirty(); };
$('addHorse').onclick=()=>{ placeActorWithoutOverlap(buildActor({kind:'horse',label:PreVisionI18n.t('model.default.horse',{index:actors.filter(a=>a.kind==='horse').length+1}),pos:[Math.random()*6-3,Math.random()*6-3],rotY:0,path:[]})); refreshObjList(); rebuildViz(); markDirty(); };
$('addSeahorse').onclick=()=>{
  const index=actors.filter(a=>a.kind==='seahorse').length+1;
  const a=placeActorWithoutOverlap(buildActor({kind:'seahorse',label:PreVisionI18n.t('model.default.seahorse',{index}),pos:[Math.random()*6-3,Math.random()*6-3],rotY:0,path:[]}));
  select(a);refreshObjList();refreshSceneRail();rebuildViz();markDirty();
};
$('addShipwreck').onclick=()=>{
  const index=actors.filter(a=>a.kind==='shipwreck').length+1;
  const a=placeActorWithoutOverlap(buildActor({kind:'shipwreck',label:PreVisionI18n.t('model.default.shipwreck',{index}),pos:[0,0],rotY:0,path:[]}));
  select(a);refreshObjList();refreshSceneRail();rebuildViz();markDirty();
};
['addAdultMale','addAdultFemale','addChild','addProp','addCar','addHorse','addSeahorse','addShipwreck'].forEach(id=>{const authoringHandler=$(id).onclick;$(id).onclick=(...args)=>automaticCaptureMutationBlocked()?false:authoringHandler(...args);});
$('addSemanticProxy').onclick=()=>{
  if(automaticCaptureMutationBlocked())return false;
  const spec=SEMANTIC_PROXY_TYPES[0],index=actors.filter(a=>a.semanticType).length+1;
  const a=placeActorWithoutOverlap(buildActor({kind:spec.kind,semanticType:spec.id,label:PreVisionI18n.t('semantic.defaultLabel',{index}),pos:[Math.random()*6-3,Math.random()*6-3],rotY:0,path:[]}));
  select(a);refreshAfterSemanticProxyChange();
};
$('semanticTypeSel').onchange=e=>{
  if(automaticCaptureMutationBlocked())return false;
  if(!selected)return;
  const id=e.target.value;
  if(!id){selected.semanticType=undefined;selected.dimensions=undefined;delete selected.obj.userData.semanticType;delete selected.obj.userData.semanticDimensions;refreshAfterSemanticProxyChange();return;}
  replaceActorSemanticType(selected,id,{resetDimensions:false});
  refreshAfterSemanticProxyChange();
};
['semanticWidth','semanticHeight','semanticDepth'].forEach(id=>{const el=$(id);if(el)el.onchange=applySemanticDimensionInput;});
$('semanticResetSize').onclick=()=>{
  if(automaticCaptureMutationBlocked())return false;
  if(!selected)return;
  const spec=semanticProxyType(selected.semanticType);if(!spec)return;
  selected.dimensions=cleanDimensions(spec.dimensions,spec.dimensions);applySemanticDimensions(selected);alignActorToTerrain(selected);
  refreshAfterSemanticProxyChange();
};
/* 环境库: spread=随机散布范围(m), 山体等大件生成在外围 */
const ENVIRONMENT_LABEL_KEYS={wall:'environment.object.wall',pillar:'environment.object.pillar',tree:'environment.object.tree',mount:'environment.object.mountain',house:'environment.object.house',rock:'environment.object.rock',desert:'environment.object.desert'};
const addEnv=(kind,spread)=>()=>{
  if(automaticCaptureMutationBlocked())return false;
  const index=actors.filter(a=>a.kind===kind).length+1,centered=kind==='desert';
  placeActorWithoutOverlap(buildActor({kind,label:PreVisionI18n.t(ENVIRONMENT_LABEL_KEYS[kind],{index}),
    pos:centered?[0,0]:[Math.random()*spread-spread/2,Math.random()*spread-spread/2],rotY:0,path:[]}));
  if(kind==='desert')alignAllActorsToTerrain();
  refreshObjList(); rebuildViz(); markDirty();
};
$('addWall').onclick=addEnv('wall',6);
$('addPillar').onclick=addEnv('pillar',6);
$('addTree').onclick=addEnv('tree',12);
$('addMount').onclick=addEnv('mount',30);
$('addHouse').onclick=addEnv('house',18);
$('addRock').onclick=addEnv('rock',8);
$('addDesert').onclick=addEnv('desert',0);
/* 姿态库按钮 */
function setPose(p){
  if(automaticCaptureMutationBlocked())return false;
  if(!selected||selected.kind!=='char'){ alert(PreVisionI18n.t('actor.selectCharacterFirst')); return; }
  selected.pose=p; applyPose(selected); alignActorToTerrain(selected);
  $('poseLabel').textContent=poseText(p);
  const values={};animatableJointKeys().forEach(key=>values['joint.'+key]=+(selected.joints?.[key]||0));
  refreshJointUI();const ownerKey=previewActorOwnerKey(selected);notePreviewEdit(ownerKey,values);finishPreviewEdit(ownerKey);updatePrompt(); markDirty();
  return true;
}
$('poseStand').onclick=()=>setPose('stand');
$('poseSit').onclick=()=>setPose('sit');
$('poseCrouch').onclick=()=>setPose('crouch');
$('poseLie').onclick=()=>setPose('lie');
$('poseRide').onclick=()=>setPose('ride');

/* ---- 骑乘/挂载: 人物吸附到坐骑鞍位, 随坐骑移动与转向 ---- */
function refreshMountSel(){
  const sel=$('mountSel'); if(!sel) return;
  const noneValue='__none__',cur=(selected&&selected.kind==='char'&&selected.mount)||noneValue;
  const hosts=actors.filter(a=>!['char','board','desert','shipwreck'].includes(a.kind)).map(a=>a.label);
  sel.innerHTML='';
  [[noneValue,PreVisionI18n.t('actor.mount.none')],...hosts.map(label=>[label,label])].forEach(([value,label])=>{
    const option=document.createElement('option');option.value=value;option.textContent=label;sel.appendChild(option);
  });
  sel.value=cur;
  sel.disabled=!(selected&&selected.kind==='char');
}
$('mountSel').onchange=e=>{
  if(automaticCaptureMutationBlocked())return false;
  if(!selected||selected.kind!=='char'){ return; }
  const v=e.target.value;
  if(v==='__none__'){
    selected.mount=null;
    setPose('stand');
    snapActorToGround(selected);
  } else {
    const host=actorByLabel(v);
    if(host&&host.pathPts.length<2&&selected.pathPts.length>=2){
      host.pathPts=selected.pathPts.map(p=>p.clone()); host.pathMode=selected.pathMode||'curve';
      host.pathTimes=ensureActorTimes(selected).slice();host.pathEase=ensureEaseArray(selected,'pathEase',selected.pathPts.length-1).map(x=>Object.assign({},x));host.timeLink=selected.timeLink;host.timeOffset=selected.timeOffset;host.timeLinkShot=selected.timeLinkShot;selected.pathPts=[];selected.pathTimes=[];selected.pathEase=[]; // 首次挂载时把人物原走位与时间移交给坐骑
    }
    clearPreviewChannels(previewActorOwnerKey(selected),['position.x','position.z','rotation.y']);
    selected.mount=v; selected.elev=0;
    setPose('ride');   // 自动切换骑乘姿态(可再手动改)
  }
  updateActors(); refreshObjectTransformUI(); refreshActorPathUI(); rebuildViz(); updatePrompt(); markDirty();
};

/* ---- Articulated pose tuning: head, torso, shoulders, elbows, wrists, hips, knees and ankles. ---- */
const JOINT_DEFS=[
  {k:'neckY',labelKey:'actor.joints.neckYaw',axisKey:'actor.joints.axis.yaw',min:-70,max:70},
  {k:'neckX',labelKey:'actor.joints.neckPitch',axisKey:'actor.joints.axis.pitch',min:-40,max:45},
  {k:'spineX',labelKey:'actor.joints.torsoBend',axisKey:'actor.joints.axis.forwardBack',min:-25,max:95,b:{k:'spineZ',axisKey:'actor.joints.axis.sideBend',min:-45,max:45}},
  {k:'spineY',labelKey:'actor.joints.torsoTwist',axisKey:'actor.joints.axis.twist',min:-70,max:70},
  {k:'shLX',labelKey:'actor.joints.leftShoulder',axisKey:'actor.joints.axis.forwardBack',min:-180,max:60,b:{k:'shLZ',axisKey:'actor.joints.axis.raiseSide',min:-95,max:0}},
  {k:'shRX',labelKey:'actor.joints.rightShoulder',axisKey:'actor.joints.axis.forwardBack',min:-180,max:60,b:{k:'shRZ',axisKey:'actor.joints.axis.raiseSide',min:0,max:95}},
  {k:'elL',labelKey:'actor.joints.leftElbow',axisKey:'actor.joints.axis.flex',min:-140,max:0},
  {k:'elR',labelKey:'actor.joints.rightElbow',axisKey:'actor.joints.axis.flex',min:-140,max:0},
  {k:'wristLX',labelKey:'actor.joints.leftWrist',axisKey:'actor.joints.axis.flex',min:-80,max:80,b:{k:'wristLZ',axisKey:'actor.joints.axis.sideBend',min:-45,max:45}},
  {k:'wristRX',labelKey:'actor.joints.rightWrist',axisKey:'actor.joints.axis.flex',min:-80,max:80,b:{k:'wristRZ',axisKey:'actor.joints.axis.sideBend',min:-45,max:45}},
  {k:'hipLX',labelKey:'actor.joints.leftHip',axisKey:'actor.joints.axis.forwardBack',min:-120,max:35,b:{k:'hipLZ',axisKey:'actor.joints.axis.abduction',min:-50,max:10}},
  {k:'hipRX',labelKey:'actor.joints.rightHip',axisKey:'actor.joints.axis.forwardBack',min:-120,max:35,b:{k:'hipRZ',axisKey:'actor.joints.axis.abduction',min:-10,max:50}},
  {k:'kneeL',labelKey:'actor.joints.leftKnee',axisKey:'actor.joints.axis.flex',min:0,max:140},
  {k:'kneeR',labelKey:'actor.joints.rightKnee',axisKey:'actor.joints.axis.flex',min:0,max:140},
  {k:'ankleLX',labelKey:'actor.joints.leftAnkle',axisKey:'actor.joints.axis.flex',min:-55,max:55,b:{k:'ankleLZ',axisKey:'actor.joints.axis.sideBend',min:-35,max:35}},
  {k:'ankleRX',labelKey:'actor.joints.rightAnkle',axisKey:'actor.joints.axis.flex',min:-55,max:55,b:{k:'ankleRZ',axisKey:'actor.joints.axis.sideBend',min:-35,max:35}},
];
function animatableJointKeys(){return ['bodyY','bodyRotX',...JOINT_DEFS.flatMap(item=>item.b?[item.k,item.b.k]:[item.k])];}
function refreshJointOptions(){
  const sel=$('jointSel'),current=sel.value||JOINT_DEFS[0].k;
  sel.innerHTML=JOINT_DEFS.map(j=>`<option value="${j.k}">${PreVisionI18n.t(j.labelKey)}</option>`).join('');
  sel.value=JOINT_DEFS.some(j=>j.k===current)?current:JOINT_DEFS[0].k;
}
refreshJointOptions();
function jointDef(){ return JOINT_DEFS.find(j=>j.k===$('jointSel').value)||JOINT_DEFS[0]; }
function refreshJointUI(){
  const d=jointDef(), a=(selected&&selected.kind==='char')?selected:null;
  const controls=$('characterControls'),A=$('jointA'),B=$('jointB'),bRow=$('jointAxisB');
  if(controls){controls.hidden=!a;controls.setAttribute('aria-hidden',a?'false':'true');}
  const axisA=PreVisionI18n.t(d.axisKey),axisB=d.b?PreVisionI18n.t(d.b.axisKey):'';
  $('jointAxisALabel').textContent=axisA;A.setAttribute('aria-label',axisA);
  A.min=d.min; A.max=d.max; A.value=a?(a.joints[d.k]||0):0; A.disabled=!a;
  if(d.b){
    bRow.hidden=false;$('jointAxisBLabel').textContent=axisB;B.setAttribute('aria-label',axisB);
    B.min=d.b.min;B.max=d.b.max;B.value=a?(a.joints[d.b.k]||0):0;B.disabled=!a;
  } else bRow.hidden=true;
  $('jointVal').textContent=a?((a.joints[d.k]||0)+'°'+(d.b?' / '+(a.joints[d.b.k]||0)+'°':'')):'–';
}
function tweakJoint(key,deg){
  if(automaticCaptureMutationBlocked())return false;
  if(!selected||selected.kind!=='char') return;
  if(!selected.joints)selected.joints={};
  selected.joints[key]=deg;
  selected.pose='custom';   // 手动微调后按"预演所示姿态"写进提示词
  applyJoints(selected); alignActorToTerrain(selected);
  $('poseLabel').textContent=poseText('custom');
  refreshJointUI();notePreviewEdit(previewActorOwnerKey(selected),['joint.'+key]);updatePrompt(); markDirty();
}
$('jointSel').onchange=refreshJointUI;
$('jointA').oninput=e=>tweakJoint(jointDef().k, parseInt(e.target.value));
$('jointB').oninput=e=>{ const d=jointDef(); if(d.b) tweakJoint(d.b.k, parseInt(e.target.value)); };
['jointA','jointB'].forEach(id=>$(id).addEventListener('change',()=>{if(selected)finishPreviewEdit(previewActorOwnerKey(selected));}));
$('jointReset').onclick=()=>{
  if(!selected||selected.kind!=='char'){ alert(PreVisionI18n.t('actor.selectCharacterFirst')); return; }
  setPose(POSE_JOINTS[selected.pose]?selected.pose:'stand');
};
$('delActor').onclick=()=>{
  if(automaticCaptureMutationBlocked())return false;
  if(!selected){ alert(PreVisionI18n.t('runtime.actor.selectFirst')); return; }
  if(actors.length<=1){ alert(PreVisionI18n.t('runtime.actor.keepOne')); return; }
  shots.forEach(s=>{ if(s.lock===selected.label) s.lock='全局'; if(s.syncActor===selected.label) s.syncActor=''; });
  const released=actors.filter(x=>x.mount===selected.label);
  released.forEach(x=>{ x.mount=null; x.elev=0; if(x.kind==='char'){x.pose='stand';applyPose(x);} });
  const deletedIndex=actors.indexOf(selected);scene.remove(selected.obj);disposeOwnedObject3D(selected.obj);remapPreviewOwnerKeys('actor',deletedIndex);actors.splice(deletedIndex,1);
  released.forEach(x=>snapActorToGround(x));   // 坐骑被删, 骑手恢复站立并贴地
  alignAllActorsToTerrain();
  select(null); rebuildViz(); refreshObjList(); updatePrompt(); markDirty();
};

/* 镜头/场景增删 */
$('addshot').onclick=()=>{
  if(automaticCaptureMutationBlocked())return false;
  const sync=effectiveActorPaths().find(a=>a.pathPts.length===2);
  shots.push({name:PreVisionI18n.t('hierarchy.newShotName',{index:String(shots.length+1).padStart(2,'0')}),desc:PreVisionI18n.t('hierarchy.customDescription'),dur:3,
    lock:actors[0]?actors[0].label:'全局',fov:40,camMode:'curve',timingMode:'custom',syncActor:sync?sync.label:'',camTimes:[0,3],camPts:[v3(6,3,6),v3(4,2,4)],camKeys:[{yaw:0,pitch:0,fov:40},{yaw:0,pitch:0,fov:40}]});
  setShot(shots.length-1,true);refreshSceneRail();markDirty();
};
$('addScene').onclick=()=>{
  const box=$('tplBtns'); box.innerHTML='';
  const blank=makeBlankScene(project.scenes.length+1),blankButton=document.createElement('button'),blankTitle=document.createElement('b'),blankMeta=document.createElement('span');
  blankButton.className='tplbtn';blankTitle.textContent=PreVisionI18n.t('scene.blank.optionName');
  blankMeta.textContent=PreVisionI18n.t('sceneTemplate.optionMeta',{description:PreVisionI18n.t('scene.blank.optionDescription'),count:blank.shots.length});
  blankButton.appendChild(blankTitle);blankButton.appendChild(blankMeta);
  blankButton.onclick=()=>{ $('tplDlg').close(); newBlankScene(); };
  box.appendChild(blankButton);
  SCENE_TEMPLATES.forEach((template,index)=>{
    const text=sceneTemplateText(template),button=document.createElement('button'),title=document.createElement('b'),meta=document.createElement('span');
    button.className='tplbtn';title.textContent=text.name;
    meta.textContent=PreVisionI18n.t('sceneTemplate.optionMeta',{description:text.desc,count:template.shots.length});
    button.appendChild(title);button.appendChild(meta);
    button.onclick=()=>{ $('tplDlg').close(); newSceneFromTpl(index); };
    box.appendChild(button);
  });
  showCommandModal($('tplDlg'));
};
function newBlankScene(){
  if(automaticCaptureMutationBlocked())return false;
  clearPointPreview();
  syncScene();
  project.scenes.push(makeBlankScene(project.scenes.length+1));
  loadScene(project.scenes.length-1, true);
  setSceneRailLevel('shots');
  markDirty();
  $('saveState').textContent=PreVisionI18n.t('scene.blank.created');
  return true;
}
function newSceneFromTpl(i){
  if(automaticCaptureMutationBlocked())return false;
  syncScene();
  const template=materializeSceneTemplate(SCENE_TEMPLATES[i]||SCENE_TEMPLATES[0]);
  template.name=PreVisionI18n.t('scene.defaultName',{index:project.scenes.length+1,name:template.name});
  project.scenes.push(template);
  loadScene(project.scenes.length-1, true);
  setSceneRailLevel('shots');
  markDirty();
  return true;
}

/* ---- Offline storyboard planner (subsystem P) moved to features/storyboard.js
 * (refactor P5, ADR-0011), dialog window family and top-level bindings included. The
 * planner's mutable state lives there behind a transitional globalThis accessor shim
 * (ADR-0009 mechanism), so external bare reads keep working. ---- */
import {
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
} from './features/storyboard.js';
