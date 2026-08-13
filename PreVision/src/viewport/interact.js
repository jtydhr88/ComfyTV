/*
 * viewport/interact.js - viewport framing, camera visualization, and canvas interaction
 * (subsystems I + L, refactor P8, ADR-0015). Live mutable owners install globalThis
 * accessors because the P1 bridge Object.assign would otherwise snapshot arrays and
 * drag state that are replaced during rebuilds and pointer gestures.
 */
import { $, curShot, refresh } from '../core/store.js';
import { clampAuthoredCameraPointHeight, ensureCamKeys, shotCurve } from '../core/project-data.js';
import { actorCurve } from '../core/timing-math.js';
import {
  REFRAME_ASPECT,
  copyReframe,
  normalizeReframeValue,
  resolveShotReframe,
  setShotReframe,
  resetShotReframe,
} from '../core/reframe.js';
import {
  canvas,
  scene,
  viewCam,
  sunTarget,
  orbit,
  applyOrbit,
  setOrbitPivotKeepView,
  disposeOwnedObject3D,
  applySunSettings,
  currentSun,
  sunGizmoPosition,
} from '../stage/environment.js';
import { STAGE_LIMIT } from '../stage/factory.js';
import {
  v3,
  actorWorldBox,
  terrainSupportHeight,
  pathOwner,
  effectiveActorPaths,
  moveActorSafely,
  constrainActorPathPoint,
  alignActorToTerrain,
  alignAllActorsToTerrain,
  collisionEnabled,
  actorPenetrates,
} from '../stage/runtime.js';

const viewportFiniteBox=(box)=>{
  return box && [box.min.x,box.min.y,box.min.z,box.max.x,box.max.y,box.max.z].every(Number.isFinite);
};
function frameBounds(box,pad=1.3){
  if(!viewportFiniteBox(box)||box.isEmpty()) return false;
  const center=box.getCenter(new THREE.Vector3()), size=box.getSize(new THREE.Vector3());
  const radius=Math.max(.8,size.length()/2);
  orbit.target.copy(center);
  orbit.dist=Math.max(5,Math.min(180,radius/Math.sin(viewCam.fov*Math.PI/360)*pad));
  orbit.phi=1.0; applyOrbit(); return true;
}
function fitAllActors(){
  const box=new THREE.Box3(); box.makeEmpty();
  actors.forEach(a=>{ const b=actorWorldBox(a); if(viewportFiniteBox(b)) box.union(b); });
  if(!frameBounds(box,1.45)){ orbit.target.set(0,1,0); orbit.dist=26; orbit.phi=1.0; applyOrbit(); }
}
function focusActor(a){ if(a) frameBounds(actorWorldBox(a),1.8); }

const CAMERA_VIZ_VISIBILITY=Object.freeze({viewport:true,workspace:true,monitor:false,camera:false,thumbnail:false,seedance:false});
const viewportCameraVizVisibleIn=(surface)=>CAMERA_VIZ_VISIBILITY[surface]===true;
const vizGroup = new THREE.Group(); scene.add(vizGroup);
let camHandles=[], pathHandles=[], camRoutePickables=[],sunHandle=null;
const camBall = new THREE.Group();
{
  camBall.name='professionalCameraGizmo';
  const material=(color,extra={})=>new THREE.MeshBasicMaterial(Object.assign({color,depthTest:true,depthWrite:true,fog:false,toneMapped:false},extra));
  const materials={
    body:material(0x303538),dark:material(0x15181a),black:material(0x090b0d),metal:material(0x626b6e),
    screen:material(0x16323b),glass:material(0x174650),screenLine:material(0x86aeb4),red:material(0xd6423a),green:material(0x7ecb91)
  };
  const geometries={
    body:new THREE.BoxGeometry(.56,.42,.34),sidePanel:new THREE.BoxGeometry(.022,.34,.285),battery:new THREE.BoxGeometry(.46,.34,.15),
    basePlate:new THREE.BoxGeometry(.42,.055,.31),rail:new THREE.CylinderGeometry(.018,.018,.5,12),mount:new THREE.CylinderGeometry(.2,.2,.075,28),
    barrel:new THREE.CylinderGeometry(.18,.19,.19,28),focusRing:new THREE.CylinderGeometry(.195,.195,.105,28),front:new THREE.CylinderGeometry(.145,.175,.21,28),
    glass:new THREE.CylinderGeometry(.12,.12,.014,28),highlight:new THREE.CylinderGeometry(.032,.032,.016,18),screenFrame:new THREE.BoxGeometry(.028,.22,.28),
    screen:new THREE.BoxGeometry(.012,.18,.24),screenLineA:new THREE.BoxGeometry(.008,.014,.13),screenLineB:new THREE.BoxGeometry(.008,.011,.09),
    hinge:new THREE.CylinderGeometry(.025,.025,.12,14),dial:new THREE.CylinderGeometry(.052,.052,.027,20),buttonRing:new THREE.CylinderGeometry(.043,.043,.022,20),
    recordButton:new THREE.CylinderGeometry(.031,.031,.028,20),smallButton:new THREE.CylinderGeometry(.016,.016,.018,14),statusLight:new THREE.SphereGeometry(.016,12,8),
    tallyLight:new THREE.BoxGeometry(.018,.032,.055),topPlate:new THREE.BoxGeometry(.3,.038,.21),handleSupport:new THREE.BoxGeometry(.08,.11,.065),
    topHandle:new THREE.BoxGeometry(.09,.055,.36),antennaBase:new THREE.CylinderGeometry(.024,.024,.055,14),antenna:new THREE.CylinderGeometry(.011,.013,.34,12),
    antennaSmallBase:new THREE.CylinderGeometry(.02,.02,.045,14),antennaSmall:new THREE.CylinderGeometry(.009,.011,.23,12)
  };
  const coreParts=[];
  const addMesh=(name,geometry,meshMaterial,position,rotation=[0,0,0],core=true)=>{
    const part=new THREE.Mesh(geometry,meshMaterial);part.name=name;part.position.set(...position);part.rotation.set(...rotation);camBall.add(part);if(core)coreParts.push(part);return part;
  };
  const body=addMesh('cameraBody',geometries.body,materials.body,[0,0,.055]);
  addMesh('cameraBodySidePanel',geometries.sidePanel,materials.metal,[.291,.005,.05]);
  addMesh('cameraRearBattery',geometries.battery,materials.dark,[0,-.015,.3]);
  addMesh('cameraBasePlate',geometries.basePlate,materials.black,[0,-.235,.065]);
  addMesh('cameraBottomRailLeft',geometries.rail,materials.metal,[-.155,-.285,-.015],[Math.PI/2,0,0]);
  addMesh('cameraBottomRailRight',geometries.rail,materials.metal,[.155,-.285,-.015],[Math.PI/2,0,0]);
  addMesh('cameraLensMount',geometries.mount,materials.metal,[0,0,-.15],[Math.PI/2,0,0]);
  addMesh('cameraLensBarrel',geometries.barrel,materials.dark,[0,0,-.28],[Math.PI/2,0,0]);
  addMesh('cameraFocusRing',geometries.focusRing,materials.body,[0,0,-.425],[Math.PI/2,0,0]);
  addMesh('cameraLensFront',geometries.front,materials.black,[0,0,-.58],[Math.PI/2,0,0]);
  addMesh('cameraLensGlass',geometries.glass,materials.glass,[0,0,-.692],[Math.PI/2,0,0]);
  addMesh('cameraLensHighlight',geometries.highlight,material(0x79b4bd,{transparent:true,opacity:.72,depthWrite:false}),[-.026,.03,-.701],[Math.PI/2,0,0]);
  addMesh('cameraScreenHinge',geometries.hinge,materials.metal,[.31,.07,.14],[0,0,0]);
  addMesh('cameraSideScreenFrame',geometries.screenFrame,materials.black,[.345,.07,-.015]);
  addMesh('cameraSideScreen',geometries.screen,materials.screen,[.365,.07,-.015]);
  addMesh('cameraScreenLineA',geometries.screenLineA,materials.screenLine,[.373,.11,-.025]);
  addMesh('cameraScreenLineB',geometries.screenLineB,materials.screenLine,[.373,.07,-.025]);
  addMesh('cameraSideDial',geometries.dial,materials.metal,[.318,.1,.17],[0,0,Math.PI/2]);
  addMesh('cameraRecordRing',geometries.buttonRing,materials.metal,[.316,-.11,.03],[0,0,Math.PI/2]);
  addMesh('cameraRecordButton',geometries.recordButton,materials.red,[.331,-.11,.03],[0,0,Math.PI/2]);
  addMesh('cameraStatusLight',geometries.statusLight,materials.green,[.32,-.035,-.07]);
  addMesh('cameraTallyLight',geometries.tallyLight,materials.red,[.315,.145,-.065]);
  [[-.1,-.08],[-.1,.01],[-.1,.1]].forEach(([y,z],index)=>addMesh(`cameraControlButton${index+1}`,geometries.smallButton,materials.metal,[.322,y,z],[0,0,Math.PI/2]));
  addMesh('cameraTopPlate',geometries.topPlate,materials.metal,[0,.23,.075]);
  addMesh('cameraHandleSupportFront',geometries.handleSupport,materials.dark,[-.08,.285,-.055]);
  addMesh('cameraHandleSupportRear',geometries.handleSupport,materials.dark,[-.08,.285,.205]);
  addMesh('cameraTopHandle',geometries.topHandle,materials.body,[-.08,.345,.075]);
  addMesh('cameraAntennaBasePrimary',geometries.antennaBase,materials.metal,[.18,.265,.2],[0,0,-.12],false);
  addMesh('cameraAntennaPrimary',geometries.antenna,materials.dark,[.202,.46,.2],[0,0,-.12],false);
  addMesh('cameraAntennaBaseSecondary',geometries.antennaSmallBase,materials.metal,[-.19,.26,.14],[0,0,.12],false);
  addMesh('cameraAntennaSecondary',geometries.antennaSmall,materials.dark,[-.205,.395,.14],[0,0,.12],false);
  const edge=new THREE.LineSegments(new THREE.EdgesGeometry(geometries.body),new THREE.LineBasicMaterial({color:0x9aa4a8,transparent:true,opacity:.38,depthTest:true,depthWrite:false,fog:false,toneMapped:false}));
  edge.name='cameraBodyEdge';edge.position.copy(body.position);camBall.add(edge);
  camBall.updateMatrixWorld(true);
  const coreBox=new THREE.Box3();coreParts.forEach(part=>coreBox.expandByObject(part));
  const coreSphere=coreBox.getBoundingSphere(new THREE.Sphere());
  const fullSphere=new THREE.Box3().setFromObject(camBall).getBoundingSphere(new THREE.Sphere());
  camBall.userData={baseCoreDiameter:coreSphere.radius*2,baseCoreCenter:coreSphere.center.clone(),fullBoundsRadius:fullSphere.radius,fullBoundsCenter:fullSphere.center.clone(),pixelDiameter:48,hitPixelDiameter:27,currentPixelDiameter:48,corePartNames:coreParts.map(part=>part.name)};
}
const cameraVizScene=new THREE.Scene();cameraVizScene.name='cameraVizScene';cameraVizScene.add(camBall);
const cameraVizCam=new THREE.PerspectiveCamera(50,1,.0001,100000);cameraVizCam.name='cameraVizCamera';
const cameraVizBoundsCenter=new THREE.Vector3(),cameraVizForward=new THREE.Vector3();
function syncCameraVizCamera(sourceCam){
  cameraVizCam.position.copy(sourceCam.position);cameraVizCam.quaternion.copy(sourceCam.quaternion);cameraVizCam.scale.copy(sourceCam.scale);
  cameraVizCam.fov=sourceCam.fov;cameraVizCam.aspect=sourceCam.aspect;cameraVizCam.zoom=sourceCam.zoom;
  cameraVizCam.focus=sourceCam.focus;cameraVizCam.filmGauge=sourceCam.filmGauge;cameraVizCam.filmOffset=sourceCam.filmOffset;
  cameraVizCam.view=sourceCam.view?Object.assign({},sourceCam.view):null;
  sourceCam.getWorldDirection(cameraVizForward);
  cameraVizBoundsCenter.copy(camBall.userData.fullBoundsCenter||camBall.position).multiply(camBall.scale).applyQuaternion(camBall.quaternion).add(camBall.position);
  const boundsDepth=cameraVizBoundsCenter.sub(sourceCam.position).dot(cameraVizForward);
  const boundsRadius=(camBall.userData.fullBoundsRadius||1)*Math.max(Math.abs(camBall.scale.x),Math.abs(camBall.scale.y),Math.abs(camBall.scale.z));
  cameraVizCam.near=Math.max(.00001,boundsDepth-boundsRadius*2);
  cameraVizCam.far=Math.max(cameraVizCam.near*2,boundsDepth+boundsRadius*2);
  cameraVizCam.updateProjectionMatrix();cameraVizCam.updateMatrixWorld(true);
  return cameraVizCam;
}
const camScaleForward=new THREE.Vector3(),camScaleOffset=new THREE.Vector3(),camScaleCoreCenter=new THREE.Vector3();
function cameraVizResourceStats(){
  const geometries=new Set(),materials=new Set();let objects=0;
  cameraVizScene.traverse(object=>{objects++;if(object.geometry)geometries.add(object.geometry);[].concat(object.material||[]).forEach(m=>{if(m)materials.add(m);});});
  return {objects,geometries:geometries.size,materials:materials.size};
}
const viewportRebuildViz=()=>{
  disposeOwnedObject3D(vizGroup);vizGroup.clear(); camHandles=[]; pathHandles=[]; camRoutePickables=[];sunHandle=null;
  const s=curShot(); if(!s) return;
  applySunSettings(false);
  const sun=currentSun();
  if(sun.enabled){
    sunHandle=new THREE.Mesh(new THREE.SphereGeometry(.38,16,12),new THREE.MeshBasicMaterial({color:0xffc928,depthTest:false}));
    sunHandle.position.copy(sunGizmoPosition());sunHandle.renderOrder=125;
    sunHandle.userData={type:'sun',baseRadius:.38,pixelRadius:12};vizGroup.add(sunHandle);
    const beam=new THREE.Line(new THREE.BufferGeometry().setFromPoints([sunHandle.position.clone(),sunTarget.position.clone()]),
      new THREE.LineDashedMaterial({color:0xffc928,dashSize:.65,gapSize:.35,transparent:true,opacity:.7,depthTest:false}));
    beam.computeLineDistances();beam.renderOrder=124;vizGroup.add(beam);
  }
  if(document.getElementById('showCamline').checked){
    const cv=shotCurve(s);
    if(cv){
      const route=new THREE.Line(new THREE.BufferGeometry().setFromPoints(cv.getPoints(80)),
        new THREE.LineBasicMaterial({color:0xe0312e}));
      route.userData={type:'camRoute'};vizGroup.add(route);camRoutePickables.push(route);
    }
    s.camPts.forEach((p,i)=>{
      const isSel=i===selCamPt;
      const h=new THREE.Mesh(new THREE.SphereGeometry(isSel?.24:.18,12,10),
        new THREE.MeshBasicMaterial({color:isSel?0xffffff:(i===0?0xff8866:0xe0312e),depthTest:!isSel,depthWrite:!isSel,transparent:isSel,opacity:isSel?0:1}));
      h.renderOrder=isSel?108:2;
      h.position.copy(p); h.userData={type:'camPt',idx:i,baseRadius:isSel?.24:.18,pixelRadius:isSel?13.5:7,hitTargetOnly:isSel};
      vizGroup.add(h);camHandles.push(h);camRoutePickables.push(h);
      const drop=new THREE.Line(new THREE.BufferGeometry().setFromPoints([p, v3(p.x,0,p.z)]),
        new THREE.LineDashedMaterial({color:isSel?0xffffff:0x662222, dashSize:.2, gapSize:.15}));
      drop.computeLineDistances(); vizGroup.add(drop);
      if(s.lock==='\u624b\u52a8\u671d\u5411'){
        const k=ensureCamKeys(s)[i], tip=p.clone().addScaledVector(cameraAimDirection(k),isSel?2:1.35);
        vizGroup.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([p,tip]),
          new THREE.LineBasicMaterial({color:isSel?0x8fb8ff:0x5b8def,fog:false})));
      }
    });
  }
  if(document.getElementById('showDispatch').checked){
    actors.forEach(a=>{
      if(a.mount) return;
      const cv=actorCurve(a);
      if(cv){
        const count=a.pathMode==='line'?Math.max(1,(a.pathPts.length-1)*2):50;
        const terrainPoints=cv.getPoints(count).map(p=>p.clone().setY((a.elev||0)+terrainSupportHeight(a,p.x,p.z)+.03));
        const line=new THREE.Line(new THREE.BufferGeometry().setFromPoints(terrainPoints),
          new THREE.LineBasicMaterial({color:0xcc8822}));
        vizGroup.add(line);
        for(let i=1;i<=3;i++){
          const t=i/4, pos=cv.getPoint(t), tan=cv.getTangent(t);
          const cone=new THREE.Mesh(new THREE.ConeGeometry(.14,.4,8), new THREE.MeshBasicMaterial({color:0xcc8822}));
          cone.position.copy(pos).setY((a.elev||0)+terrainSupportHeight(a,pos.x,pos.z)+.1);
          cone.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0), tan.setY(0).normalize());
          vizGroup.add(cone);
        }
      }
      a.pathPts.forEach((p,i)=>{
        const isSel=pathOwner(selected)===a&&i===selActorPt;
        const h=new THREE.Mesh(new THREE.SphereGeometry(isSel?.19:.14,10,8),new THREE.MeshBasicMaterial({color:isSel?0xffffff:0xffdd44,depthTest:!isSel}));
        h.renderOrder=isSel?120:2;
        h.position.copy(p).setY((a.elev||0)+terrainSupportHeight(a,p.x,p.z)+.08); h.userData={type:'actorPt',actor:a,idx:i,baseRadius:isSel?.19:.14,pixelRadius:isSel?9:7};vizGroup.add(h);pathHandles.push(h);
      });
    });
  }
  refreshCopyPathUI();
  refreshTimingUI();
  updatePathLen(); globalThis.updatePrompt();
};
let vizTimer=null;
function rebuildVizLight(){ if(vizTimer) return; vizTimer=setTimeout(()=>{vizTimer=null;globalThis.rebuildViz()},30); }
function worldUnitsPerCssPixel(cam,position,viewportHeight){
  cam.getWorldDirection(camScaleForward);
  const depth=Math.max(.005,camScaleOffset.copy(position).sub(cam.position).dot(camScaleForward));
  const zoom=Math.max(.01,cam.zoom||1),tan=Math.tan(cam.fov*Math.PI/360);
  return 2*depth*tan/(Math.max(1,viewportHeight)*zoom);
}
function updateVizScales(cam){
  const vp=document.getElementById('viewport'),h=Math.max(1,(vp&&vp.clientHeight)||canvas.clientHeight||1);
  [...camHandles,...pathHandles,...(sunHandle?[sunHandle]:[])].forEach(o=>{
    const worldPerPx=worldUnitsPerCssPixel(cam,o.position,h);
    const sc=worldPerPx*(o.userData.pixelRadius||7)/Math.max(.01,o.userData.baseRadius||.15);
    o.scale.setScalar(Math.max(.00001,Math.min(100,sc)));
  });
  const targetPx=camBall.userData.pixelDiameter||48;
  const baseCoreDiameter=Math.max(.01,camBall.userData.baseCoreDiameter||1),baseCoreCenter=camBall.userData.baseCoreCenter||camBall.position;
  let ballScale=worldUnitsPerCssPixel(cam,camBall.position,h)*targetPx/baseCoreDiameter;
  for(let i=0;i<3;i++){
    camScaleCoreCenter.copy(baseCoreCenter).multiplyScalar(ballScale).applyQuaternion(camBall.quaternion).add(camBall.position);
    ballScale=worldUnitsPerCssPixel(cam,camScaleCoreCenter,h)*targetPx/baseCoreDiameter;
  }
  camBall.scale.setScalar(Math.max(.00001,Math.min(100,ballScale)));
  camBall.userData.currentPixelDiameter=targetPx;
}

let reframeEditMode=false,reframeDraft=null,reframePointer=null,reframeWheelTimer=null;
function reframeCaptureBlocked(){
  const transaction=globalThis.currentCaptureTransaction?.();
  return (!!transaction&&!transaction.settled)||globalThis.automaticCaptureMutationBlocked();
}
function currentAspectKey(){return `${aspectW}:${aspectH}`;}
function reframeAvailable(){return currentAspectKey()===REFRAME_ASPECT;}
function reframeEditorActive(){return reframeAvailable()&&reframeEditMode;}
function currentResolvedReframe(shot=curShot()){
  const draft=reframeDraft&&reframeDraft.shot===shot?reframeDraft.value:null;
  return resolveShotReframe(shot,currentAspectKey(),draft);
}
function refreshReframeUI(){
  const available=reframeAvailable(),value=currentResolvedReframe();
  const buttons=[$('reframeEdit'),$('reframeEditRight')].filter(Boolean),controls=$('reframeControls'),badge=$('monReframeBadge'),status=$('reframeStatus');
  buttons.forEach(button=>{
    button.hidden=!available;button.classList.toggle('on',available&&reframeEditMode);
    button.setAttribute('aria-pressed',available&&reframeEditMode?'true':'false');
  });
  if(controls)controls.hidden=!available||!reframeEditMode;
  if(badge)badge.hidden=!available;
  if(status)status.textContent=PreVisionI18n.t('reframe.status',{
    zoom:value.zoom.toFixed(2),x:value.offsetX.toFixed(2),y:value.offsetY.toFixed(2)
  });
}
function releaseReframePointer(){
  const pointer=reframePointer;reframePointer=null;
  if(!pointer)return false;
  try{canvas.releasePointerCapture(pointer.pointerId);}catch(_error){}
  return true;
}
function clearReframeDraft(exitEditor=false){
  if(reframeWheelTimer){clearTimeout(reframeWheelTimer);reframeWheelTimer=null;}
  reframeDraft=null;releaseReframePointer();
  if(exitEditor)reframeEditMode=false;
  refreshReframeUI();return true;
}
function beginReframeDraft(){
  const shot=curShot();if(!shot||!reframeAvailable())return null;
  if(!reframeDraft||reframeDraft.shot!==shot)reframeDraft={shot,value:copyReframe(resolveShotReframe(shot,REFRAME_ASPECT)),committed:false};
  return reframeDraft;
}
function commitReframeDraft(){
  const draft=reframeDraft;if(!draft||draft.committed)return false;
  if(reframeCaptureBlocked()){clearReframeDraft(false);return false;}
  draft.committed=true;releaseReframePointer();reframeDraft=null;
  const changed=draft.shot===curShot()&&setShotReframe(draft.shot,draft.value,REFRAME_ASPECT);
  if(changed)markDirty();
  refreshReframeUI();return changed;
}
function cancelReframeDraft(){return clearReframeDraft(false);}
function reframeCommandAllowed(event){
  if(event?.isComposing||reframeCaptureBlocked())return false;
  const target=event?.target;
  if(target?.matches?.('input,textarea,select,[contenteditable="true"]'))return false;
  return typeof globalThis.workspaceOwnsGlobalCommand!=='function'||globalThis.workspaceOwnsGlobalCommand(event);
}
function adjustReframeZoom(delta,{commit=true}={}){
  if(!reframeCommandAllowed()||!reframeEditorActive())return false;
  const draft=beginReframeDraft();if(!draft)return false;
  draft.value=normalizeReframeValue({...draft.value,zoom:draft.value.zoom*Math.exp(delta)});
  refreshReframeUI();
  if(commit)commitReframeDraft();
  return true;
}
function resetCurrentShotReframe(){
  if(!reframeCommandAllowed()||!reframeAvailable())return false;
  cancelReframeDraft();const changed=resetShotReframe(curShot(),REFRAME_ASPECT);
  if(changed)markDirty();refreshReframeUI();return changed;
}
function toggleReframeEditor(){
  if(!reframeCommandAllowed()||!reframeAvailable())return false;
  if(reframeEditMode)clearReframeDraft(true);else{reframeEditMode=true;refreshReframeUI();}
  return reframeEditMode;
}
function beginReframePointer(e){
  if(!reframeEditorActive()||e.button!==0||!reframeCommandAllowed(e))return false;
  const draft=beginReframeDraft();if(!draft)return false;
  reframePointer={pointerId:e.pointerId,x:e.clientX,y:e.clientY,start:copyReframe(draft.value)};
  try{canvas.setPointerCapture(e.pointerId);}catch(_error){}
  e.preventDefault?.();return true;
}
function moveReframePointer(e){
  if(!reframePointer||!matchesActivePointer(e,reframePointer.pointerId))return false;
  const rect=canvas.getBoundingClientRect(),dx=(e.clientX-reframePointer.x)/Math.max(1,rect.width),dy=(e.clientY-reframePointer.y)/Math.max(1,rect.height);
  reframeDraft.value=normalizeReframeValue({
    ...reframeDraft.value,
    offsetX:reframePointer.start.offsetX-dx*2/reframeDraft.value.zoom,
    offsetY:reframePointer.start.offsetY+dy*2/reframeDraft.value.zoom
  });
  refreshReframeUI();e.preventDefault?.();return true;
}
function finishReframePointer(e,{cancel=false}={}){
  if(!reframePointer||!matchesActivePointer(e,reframePointer.pointerId))return false;
  releaseReframePointer();
  return cancel?cancelReframeDraft():commitReframeDraft();
}

function matchesActivePointer(event,pointerId){return event?.pointerId===undefined||pointerId===undefined||event.pointerId===pointerId;}
let dragging=null, dragMode='move', rotStartX=0, rotStart=0;
const ray=new THREE.Raycaster(), mouse=new THREE.Vector2();
ray.params.Line.threshold=.4;
const groundPlane=new THREE.Plane(new THREE.Vector3(0,1,0),0);
function pick(e){
  const r=canvas.getBoundingClientRect();
  mouse.set(((e.clientX-r.left)/r.width)*2-1, -((e.clientY-r.top)/r.height)*2+1);
  ray.setFromCamera(mouse, viewCam);
}
function highlight(obj,on){
  obj?.traverse(o=>{ if(o.isMesh && o.material.emissive) o.material.emissive.setHex(on?(o.material.userData.selectionEmissive||0x552222):0x000000); });
}
function translateCameraRoute(original,rawX,rawZ){
  if(globalThis.automaticCaptureMutationBlocked())return false;
  const s=curShot();if(!s||!original.length)return new THREE.Vector2();
  const xs=original.map(p=>p.x),zs=original.map(p=>p.z);
  const dx=Math.max(-STAGE_LIMIT-Math.min(...xs),Math.min(STAGE_LIMIT-Math.max(...xs),rawX));
  const dz=Math.max(-STAGE_LIMIT-Math.min(...zs),Math.min(STAGE_LIMIT-Math.max(...zs),rawZ));
  s.camPts.forEach((p,i)=>p.set(original[i].x+dx,original[i].y,original[i].z+dz));
  return new THREE.Vector2(dx,dz);
}
function onCanvasPointerDown(e){
  if(reframeCaptureBlocked())return false;
  if(reframeEditorActive())return beginReframePointer(e);
  if(camDriveMode)return;
  if(dragging&&!matchesActivePointer(e,dragging.pointerId))return;
  try{canvas.setPointerCapture(e.pointerId);}catch(_e){}
  pick(e);
  if(e.button===2){
    const hit=ray.intersectObjects(camRoutePickables,false)[0];
    const anchor=new THREE.Vector3();
    if(hit&&ray.ray.intersectPlane(groundPlane,anchor)){
      dragging={camRoute:true,anchor:anchor.clone(),original:curShot().camPts.map(p=>p.clone()),moved:false,pointerId:e.pointerId};
      if(e.preventDefault)e.preventDefault();
    } else dragging={viewPan:true,moved:false,pointerId:e.pointerId};
    return;
  }
  const hs=ray.intersectObjects([...camHandles,...pathHandles,...(sunHandle?[sunHandle]:[])]);
  if(hs.length){
    const h=hs[0].object, d=h.userData;
    dragging={handle:h, moved:false, pointerId:e.pointerId};
    if(d.type==='camPt'){
      const draft=beginUnifiedCameraDraft(d.idx);
      if(draft){dragging.cameraDraft=true;h.position.copy(draft.position);}
      else globalThis.previewCameraPoint(d.idx);
    }
    else if(d.type==='actorPt'){
      select(d.actor);globalThis.previewActorPathPoint(d.actor,d.idx);
    }
    return;
  }
  const hits=ray.intersectObjects(actors.map(a=>a.obj), true);
  if(hits.length){
    let g=hits[0].object; while(g.parent && !actors.find(a=>a.obj===g)) g=g.parent;
    const a=actors.find(x=>x.obj===g);
    if(a){
      globalThis.clearPointPreview();
      select(a);
      const owner=pathOwner(a);
      dragging={actor:owner, source:a, mode:dragMode,
        startPos:owner.obj.position.clone(), moved:false, lastSafeRot:owner.obj.rotation.y, pointerId:e.pointerId};
      rotStartX=e.clientX; rotStart=owner.obj.rotation.y;
    }
  } else {
    globalThis.clearPointPreview();select(null);
    const pivot=new THREE.Vector3();
    if(!ray.ray.intersectPlane(groundPlane,pivot))pivot.copy(orbit.target);
    setOrbitPivotKeepView(pivot);
    dragging={viewOrbit:true,moved:false,pointerId:e.pointerId};
  }
}
function onCanvasPointerMove(e){
  if(reframeCaptureBlocked())return false;
  if(reframeEditorActive())return moveReframePointer(e);
  if(camDriveMode) return;
  if(dragging&&!matchesActivePointer(e,dragging.pointerId))return;
  if(dragging&&dragging.camRoute&&e.buttons===2){
    pick(e);const pt=new THREE.Vector3();
    if(ray.ray.intersectPlane(groundPlane,pt)){
      const raw=pt.clone().sub(dragging.anchor),delta=translateCameraRoute(dragging.original,raw.x,raw.z);
      dragging.moved=Math.abs(delta.x)+Math.abs(delta.y)>.001;refreshCamPtUI();rebuildVizLight();
    }
    return;
  }
  if(dragging&&dragging.viewPan&&e.buttons===2){
    const s=orbit.dist*.0015;
    viewCam.updateMatrixWorld(true);
    const right=new THREE.Vector3().setFromMatrixColumn(viewCam.matrix,0);
    const up=new THREE.Vector3().setFromMatrixColumn(viewCam.matrix,1);
    orbit.target.addScaledVector(right,-e.movementX*s).addScaledVector(up,e.movementY*s);
    dragging.moved=dragging.moved||Math.abs(e.movementX)+Math.abs(e.movementY)>0;applyOrbit();return;
  }
  if(dragging&&dragging.viewOrbit&&e.buttons===1){
    orbit.theta-=e.movementX*.008;
    orbit.phi=Math.max(.08,Math.min(1.52,orbit.phi-e.movementY*.008));
    dragging.moved=dragging.moved||Math.abs(e.movementX)+Math.abs(e.movementY)>0;applyOrbit();return;
  }
  if(!dragging) return;
  pick(e);
  const pt=new THREE.Vector3();
  if(dragging.handle){
    const h=dragging.handle, d=h.userData;
    if(d.type==='sun'){
      const sun=currentSun(),before=sun.pos.slice();
      if(e.altKey) sun.pos[1]=Math.max(1,Math.min(30,sun.pos[1]-e.movementY*.08));
      else {
        const plane=new THREE.Plane(new THREE.Vector3(0,1,0),-h.position.y);
        if(ray.ray.intersectPlane(plane,pt)){
          const len=Math.max(7,new THREE.Vector3(...sun.pos).length()),dir=pt.sub(sunTarget.position);
          if(dir.lengthSq()>.1){dir.normalize().multiplyScalar(len);sun.pos[0]=Math.max(-30,Math.min(30,dir.x));sun.pos[2]=Math.max(-30,Math.min(30,dir.z));}
        }
      }
      applySunSettings(false);h.position.copy(sunGizmoPosition());
      if(sun.pos.some((v,i)=>Math.abs(v-before[i])>.001))dragging.moved=true;
      refreshSunUI();rebuildVizLight();
    } else if(d.type==='camPt'){
      const draft=dragging.cameraDraft?currentUnifiedCameraDraftPose():null,p=draft?.position||curShot().camPts[d.idx],before=p.clone();
      if(e.altKey){p.y=clampAuthoredCameraPointHeight(p.y-e.movementY*.03,p.y);h.position.y=p.y;}
      else{
        const plane=new THREE.Plane(new THREE.Vector3(0,1,0),-h.position.y);
        if(ray.ray.intersectPlane(plane,pt)){p.set(pt.x,h.position.y,pt.z);h.position.set(pt.x,h.position.y,pt.z);}
      }
      if(p.distanceToSquared(before)>.0001){
        dragging.moved=true;
        if(dragging.cameraDraft)updateUnifiedCameraDraft({'position.x':p.x,'position.y':p.y,'position.z':p.z});
        else notePreviewEdit(previewCameraOwnerKey(),{'position.x':p.x,'position.y':p.y,'position.z':p.z});
      }
      refreshCamPtUI(); rebuildVizLight();
    } else if(d.type==='actorPt'){
      if(ray.ray.intersectPlane(groundPlane, pt)){
        const old=d.actor.pathPts[d.idx], safe=constrainActorPathPoint(d.actor,old,pt);
        if(safe.distanceToSquared(old)>.0001) dragging.moved=true;
        old.copy(safe); h.position.set(safe.x,(d.actor.elev||0)+terrainSupportHeight(d.actor,safe.x,safe.z)+.08,safe.z);
        refreshActorPathUI(); rebuildVizLight();
      }
    }
    return;
  }
  if(dragging.actor){
    if(dragging.mode==='move'){
      if(ray.ray.intersectPlane(groundPlane, pt)){
        const a=dragging.actor, before=a.obj.position.clone();
        moveActorSafely(a,pt.x,pt.z);
        if(a.kind==='desert')alignAllActorsToTerrain();
        if(a.obj.position.distanceToSquared(before)>.0001) dragging.moved=true;
        if(dragging.moved)notePreviewEdit(previewActorOwnerKey(a),['position.x','position.z']);
        if(dragging.mode==='move'&&a.pathPts.length){ a.pathPts[0].set(a.obj.position.x,0,a.obj.position.z); rebuildVizLight(); }
      }
    } else {
      const a=dragging.actor, old=a.obj.rotation.y;
      a.obj.rotation.y=rotStart+(e.clientX-rotStartX)*.02;alignActorToTerrain(a);
      if(collisionEnabled()&&actorPenetrates(a)){a.obj.rotation.y=old;alignActorToTerrain(a);}
      else { dragging.lastSafeRot=a.obj.rotation.y; dragging.moved=true; }
      if(a.kind==='desert')alignAllActorsToTerrain();
      if(dragging.moved)notePreviewEdit(previewActorOwnerKey(a),['rotation.y']);
    }
  }
}
function finishCanvasDrag(e){
  const d=dragging;
  if(!d||!matchesActivePointer(e,d.pointerId))return;
  dragging=null;
  try{canvas.releasePointerCapture(d.pointerId??e?.pointerId);}catch(_e){}
  if(d.moved&&d.actor&&d.mode==='rotate')d.actor.authoredRotY=d.lastSafeRot;
  if(d.moved&&d.actor&&!d.viewOrbit&&!d.viewPan){const ownerKey=previewActorOwnerKey(d.actor);notePreviewEdit(ownerKey,d.mode==='move'?['position.x','position.z']:['rotation.y']);finishPreviewEdit(ownerKey);}
  if(d.moved&&d.handle?.userData.type==='camPt'){const ownerKey=previewCameraOwnerKey();finishPreviewEdit(ownerKey);}
  if(d.moved&&!d.viewOrbit&&!d.viewPan&&!d.cameraDraft) markDirty();
  if(d.cameraDraft){updateShotCam();refreshCamPtUI();rebuildVizLight();}
  else if(d.handle&&d.handle.userData.type==='camPt'&&previewCamPt!==null)globalThis.previewCameraPoint(d.handle.userData.idx);
  else if(d.handle&&d.handle.userData.type==='actorPt'&&previewActorPoint)globalThis.previewActorPathPoint(d.handle.userData.actor,d.handle.userData.idx);
  refreshActorPathUI(); refreshObjectTransformUI();
}
function onCanvasPointerUp(e){if(finishReframePointer(e))return true;return finishCanvasDrag(e);}
function onCanvasPointerCancel(e){if(finishReframePointer(e,{cancel:true}))return true;return finishCanvasDrag(e);}
canvas.addEventListener('pointerdown',onCanvasPointerDown);
canvas.addEventListener('pointermove',onCanvasPointerMove);
canvas.addEventListener('pointerup',onCanvasPointerUp);canvas.addEventListener('pointercancel',onCanvasPointerCancel);canvas.addEventListener('lostpointercapture',onCanvasPointerUp);window.addEventListener('pointerup',onCanvasPointerUp);window.addEventListener('pointercancel',onCanvasPointerCancel);window.addEventListener('blur',e=>{if(reframeDraft)commitReframeDraft();onCanvasPointerUp(e);});
canvas.addEventListener('contextmenu', e=>e.preventDefault());
canvas.addEventListener('wheel', e=>{
  if(reframeEditorActive()){
    if(reframeCommandAllowed(e)){
      e.preventDefault();adjustReframeZoom(-e.deltaY*.0015,{commit:false});
      if(reframeWheelTimer)clearTimeout(reframeWheelTimer);
      reframeWheelTimer=setTimeout(()=>{reframeWheelTimer=null;commitReframeDraft();},180);
    }
    return;
  }
  orbit.dist=Math.max(4,Math.min(80,orbit.dist*(1+e.deltaY*.001))); applyOrbit();
}, {passive:false});
document.addEventListener('keydown',e=>{
  if(!reframeEditorActive()||!reframeCommandAllowed(e))return;
  if(e.key==='Escape'){e.preventDefault();cancelReframeDraft();}
  else if(e.key==='Enter'&&reframeDraft){e.preventDefault();commitReframeDraft();}
},true);
function select(a,preserveCameraPosition=false){
  if(globalThis.automaticCaptureMutationBlocked())return false;
  if(!preserveCameraPosition)globalThis.clearTimelineCameraPositionSelection?.(true);
  const changed=selected!==a;
  if(selected) highlight(selected.obj,false);
  selected=a; if(a) highlight(a.obj,true);
  if(a&&typeof previewActorOwnerKey==='function')motionExpandedGroups.add(previewActorOwnerKey(a));
  if(changed) selActorPt=0;
  refreshObjectTransformUI(); refreshActorPathUI();
  const pl=$('poseLabel');
  if(pl) pl.textContent=(a&&a.kind==='char')?poseText(a.pose||'stand'):'–';
  refreshJointUI();
  if(typeof refreshMountSel==='function') refreshMountSel();
  refreshObjList();
}
function setDragMode(mode){
  dragMode=mode;
  ['modeMove','modeRot'].forEach(id=>$(id).classList.remove('on'));
  $(mode==='rot'?'modeRot':'modeMove').classList.add('on');
}

const defineViewportGlobal=(name,get,set)=>Object.defineProperty(globalThis,name,{get,set,configurable:true});
defineViewportGlobal('vizGroup',()=>vizGroup);
defineViewportGlobal('camHandles',()=>camHandles,value=>{camHandles=value;});
defineViewportGlobal('pathHandles',()=>pathHandles,value=>{pathHandles=value;});
defineViewportGlobal('camRoutePickables',()=>camRoutePickables,value=>{camRoutePickables=value;});
defineViewportGlobal('sunHandle',()=>sunHandle,value=>{sunHandle=value;});
defineViewportGlobal('camBall',()=>camBall);
defineViewportGlobal('cameraVizScene',()=>cameraVizScene);
defineViewportGlobal('cameraVizCam',()=>cameraVizCam);
defineViewportGlobal('vizTimer',()=>vizTimer,value=>{vizTimer=value;});
defineViewportGlobal('dragging',()=>dragging,value=>{dragging=value;});
defineViewportGlobal('dragMode',()=>dragMode,value=>{dragMode=value;});
defineViewportGlobal('rotStartX',()=>rotStartX,value=>{rotStartX=value;});
defineViewportGlobal('rotStart',()=>rotStart,value=>{rotStart=value;});
defineViewportGlobal('ray',()=>ray);
defineViewportGlobal('mouse',()=>mouse);
defineViewportGlobal('groundPlane',()=>groundPlane);
defineViewportGlobal('matchesActivePointer',()=>matchesActivePointer);
defineViewportGlobal('viewportFiniteBox',()=>viewportFiniteBox,()=>{});
defineViewportGlobal('viewportCameraVizVisibleIn',()=>viewportCameraVizVisibleIn,()=>{});
defineViewportGlobal('viewportRebuildViz',()=>viewportRebuildViz,()=>{});
defineViewportGlobal('reframeEditorActive',()=>reframeEditorActive,()=>{});
defineViewportGlobal('currentResolvedReframe',()=>currentResolvedReframe,()=>{});
defineViewportGlobal('refreshReframeUI',()=>refreshReframeUI,()=>{});
defineViewportGlobal('clearReframeDraft',()=>clearReframeDraft,()=>{});
defineViewportGlobal('toggleReframeEditor',()=>toggleReframeEditor,()=>{});
defineViewportGlobal('adjustReframeZoom',()=>adjustReframeZoom,()=>{});
defineViewportGlobal('resetCurrentShotReframe',()=>resetCurrentShotReframe,()=>{});

refresh.register('viz',viewportRebuildViz);

export {
  viewportFiniteBox as finiteBox,
  frameBounds,
  fitAllActors,
  focusActor,
  CAMERA_VIZ_VISIBILITY,
  viewportCameraVizVisibleIn as cameraVizVisibleIn,
  cameraVizResourceStats,
  syncCameraVizCamera,
  viewportRebuildViz as rebuildViz,
  rebuildVizLight,
  worldUnitsPerCssPixel,
  updateVizScales,
  matchesActivePointer,
  pick,
  highlight,
  translateCameraRoute,
  onCanvasPointerDown,
  onCanvasPointerMove,
  onCanvasPointerUp,
  finishCanvasDrag,
  currentResolvedReframe,
  reframeEditorActive,
  refreshReframeUI,
  clearReframeDraft,
  toggleReframeEditor,
  adjustReframeZoom,
  resetCurrentShotReframe,
  select,
  setDragMode
};
