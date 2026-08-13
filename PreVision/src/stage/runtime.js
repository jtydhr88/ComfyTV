/*
 * stage/runtime.js — stage runtime, serialization, terrain/collision, path editing,
 * point-sync, target locking, and preview animation (subsystems F + J, refactor P7a,
 * ADR-0013). Function bodies moved from src/app.js under the P1 bridge model.
 * UI refresh handlers, viewport framing helpers, labels/pose text, select-option UI,
 * timeline mutable state, and ground quick-preset UI remain in src/app.js.
 */
import { curScene, curShot, sceneDur } from '../core/store.js';
import {
  ACTOR_FIELDS,
  clampAuthoredCameraPointHeight,
  DEFAULT_ACTORS,
  SHOT_FIELDS,
  distributedPathTimes,
  ensureActorTimes,
  ensureCamAimTimes,
  ensureCamFovTimes,
  ensureCamKeys,
  ensureCamTimes,
  ensureEaseArray,
} from '../core/project-data.js';
import { actorCurve, normalizeEaseSpec } from '../core/timing-math.js';
import {
  cleanGroundAppearance,
  cleanSun,
  applyGroundAppearance,
  applySunSettings,
  buildSky,
  disposeOwnedObject3D,
  scene,
  shotCam,
} from './environment.js';
import {
  STAGE_LIMIT,
  DESERT_SIZE,
  DESERT_SEGMENTS,
  POSE_JOINTS,
  applyJoints,
  applyPose,
  makeBoard,
  makeBush,
  makeCar,
  makeCharacter,
  makeDesert,
  makeDog,
  makeHorse,
  makeSeahorse,
  makeHouse,
  makeLabel,
  makeMountain,
  makePillar,
  makeProp,
  makeRoad,
  makeRock,
  makeTree,
  makeWall,
  migrateHorseRideJoints,
  migrateSeahorseRideJoints,
  makeShipwreck,
  semanticProxyType,
  setActorSemanticType,
  labelY,
} from './factory.js';

function scalarMap(fields,adapter){
  const out=Object.create(null);
  fields.forEach(field=>{out[field.key]=adapter(field);});
  return out;
}
function v3(x,y,z){return new THREE.Vector3(x,y,z)}
function stageCoord(v,fallback=0){
  v=Number(v); return Number.isFinite(v)?Math.max(-STAGE_LIMIT,Math.min(STAGE_LIMIT,v)):fallback;
}
function clampStagePoint(p){ p.x=stageCoord(p.x); p.z=stageCoord(p.z); return p; }
function cleanDimensions(value,fallback){
  const f=fallback||{width:1,height:1,depth:1},src=value||{};
  return {
    width:+Math.max(.1,Math.min(80,Number.isFinite(+src.width)?+src.width:f.width)).toFixed(2),
    height:+Math.max(.1,Math.min(80,Number.isFinite(+src.height)?+src.height:f.height)).toFixed(2),
    depth:+Math.max(.1,Math.min(80,Number.isFinite(+src.depth)?+src.depth:f.depth)).toFixed(2)
  };
}
function actorJointsFromData(d){
  const pose=d.pose||'stand',joints=d.joints?Object.assign({},d.joints):Object.assign({},POSE_JOINTS[pose]||{});
  return joints;
}
const DEFAULT_GLOBAL_LOCK=DEFAULT_ACTORS[0].label;
function liveSceneDuration(){
  const live=sceneDur();
  if(live>0)return live;
  return Math.max(.1,(curScene()?.shots||[]).reduce((n,s)=>n+(+s.dur||0),0)||1);
}
function configureObjectShadows(obj,kind){
  if(kind==='board')return obj; // Photo boards stay unlit to avoid double lighting.
  obj.traverse(o=>{
    if(!o.isMesh)return;
    if(o.userData.collisionExempt)return;
    o.castShadow=true;o.receiveShadow=true;
  });
  return obj;
}
function buildActor(d){
  if(automaticCaptureMutationBlocked())return false;
  const legacyWizard=d.kind==='char'&&d.characterStyle==='wizard';
  const effectiveSemanticType=legacyWizard?'adult_male':d.semanticType;
  const semanticSpec=semanticProxyType(effectiveSemanticType);
  const actorScalars=scalarMap(ACTOR_FIELDS,field=>{
    if(field.key==='kind')return d.kind||'prop';
    if(field.key==='label')return d.label;
    if(field.key==='pose')return d.pose||'stand';
    if(field.key==='rotY')return Number.isFinite(d.rotY)?d.rotY:0;
    if(field.key==='height')return Number.isFinite(d.height)?d.height:(Number.isFinite(d.y)?d.y:0);
    if(field.key==='scale')return Number.isFinite(d.scale)?Math.max(.3,Math.min(3,d.scale)):1;
    if(field.key==='pathMode')return d.pathMode==='line'?'line':'curve';
    if(field.key==='timeLink')return ['cameraNodes','cameraFollow'].includes(d.timeLink)?d.timeLink:'independent';
    if(field.key==='timeOffset')return Number.isFinite(+d.timeOffset)?+d.timeOffset:0;
    throw new Error(`Unhandled actor runtime field: ${field.key}`);
  });
  const kind=semanticSpec?.kind||actorScalars.kind;
  const authoredScale=kind==='seahorse'
    ?Math.max(.85,Math.min(1.15,actorScalars.scale))
    :actorScalars.scale;
  let obj;
  if(kind==='char') obj=makeCharacter(semanticSpec?.color,effectiveSemanticType||'adult_male');
  else if(kind==='car') obj=makeCar();
  else if(kind==='wall') obj=makeWall();
  else if(kind==='pillar') obj=makePillar();
  else if(kind==='tree') obj=makeTree();
  else if(kind==='mount') obj=makeMountain();
  else if(kind==='house') obj=makeHouse();
  else if(kind==='rock') obj=makeRock();
  else if(kind==='bush') obj=makeBush();
  else if(kind==='dog') obj=makeDog(semanticSpec?.color);
  else if(kind==='road') obj=makeRoad();
  else if(kind==='desert') obj=makeDesert(Number.isInteger(d.terrainVersion)?d.terrainVersion:1);
  else if(kind==='board') obj=makeBoard(d.asset);
  else if(kind==='horse') obj=makeHorse();
  else if(kind==='seahorse') obj=makeSeahorse();
  else if(kind==='shipwreck') obj=makeShipwreck();
  else obj=makeProp();
  const elev=Math.max(0,Math.min(20,actorScalars.height));
  const pos=Array.isArray(d.pos)?d.pos:[0,0];
  obj.position.set(stageCoord(pos[0]),elev,stageCoord(pos[1]));
  obj.rotation.y=actorScalars.rotY;
  obj.scale.setScalar(authoredScale);
  configureObjectShadows(obj,kind);
  const label=makeLabel(actorScalars.label);
  label.position.set(0,labelY(kind,obj),0); obj.add(label);
  scene.add(obj);
  const a={obj, label:actorScalars.label, kind, semanticType:effectiveSemanticType||undefined, asset:d.asset, mount:d.mount||null, pose:actorScalars.pose,
    authoredRotY:obj.rotation.y,
    authoredScale,
    dimensions:d.dimensions?cleanDimensions(d.dimensions,semanticSpec?.dimensions):undefined,
    elev, pathMode:actorScalars.pathMode,
    joints:actorJointsFromData(d),
    pathTimes:Array.isArray(d.pathTimes)?d.pathTimes.map(Number):[],
    pathEase:Array.isArray(d.pathEase)?d.pathEase.map(normalizeEaseSpec):[],timeLink:actorScalars.timeLink,timeOffset:actorScalars.timeOffset,timeLinkShot:Number.isInteger(d.timeLinkShot)?d.timeLinkShot:0,
    pathPts:(d.path||[]).filter(p=>Array.isArray(p)&&p.length>=2).map(p=>v3(stageCoord(p[0]),0,stageCoord(p[1])))};
  if(semanticSpec)setActorSemanticType(a,semanticSpec.id,{resetDimensions:!d.dimensions});
  else if(effectiveSemanticType){a.semanticType=effectiveSemanticType;obj.userData.semanticType=effectiveSemanticType;}
  if(kind==='char') applyJoints(a);
  actors.push(a); alignActorToTerrain(a); return a;
}
function actorDataScalars(a,ctx){
  return scalarMap(ACTOR_FIELDS,field=>{
    if(field.key==='kind')return a.kind;
    if(field.key==='label')return a.label;
    if(field.key==='pose')return a.pose||'stand';
    if(field.key==='rotY')return +ctx.rot.toFixed(3);
    if(field.key==='height')return +ctx.elev.toFixed(2);
    if(field.key==='scale')return +ctx.scale.toFixed(2);
    if(field.key==='pathMode')return a.pathMode||'curve';
    if(field.key==='timeLink')return a.timeLink||'independent';
    if(field.key==='timeOffset')return +(a.timeOffset||0).toFixed(3);
    throw new Error(`Unhandled actor data field: ${field.key}`);
  });
}
function shotDataScalars(s){
  return scalarMap(SHOT_FIELDS,field=>{
    if(field.key==='name')return s.name;
    if(field.key==='desc')return s.desc;
    if(field.key==='dur')return s.dur;
    if(field.key==='lock')return s.lock;
    if(field.key==='fov')return s.fov;
    if(field.key==='camMode')return s.camMode||'curve';
    if(field.key==='timingMode')return s.timingMode==='arcLength'?'arcLength':s.timingMode==='custom'?'custom':'pointSync';
    if(field.key==='syncActor')return s.syncActor||'';
    if(field.key==='yaw')return s.yaw||0;
    if(field.key==='pitch')return s.pitch||0;
    throw new Error(`Unhandled shot data field: ${field.key}`);
  });
}
function shotRuntimeScalars(s){
  return scalarMap(SHOT_FIELDS,field=>{
    if(field.key==='name')return s.name;
    if(field.key==='desc')return s.desc;
    if(field.key==='dur')return s.dur;
    if(field.key==='lock')return s.lock;
    if(field.key==='fov')return s.fov;
    if(field.key==='camMode')return s.camMode==='line'?'line':'curve';
    if(field.key==='timingMode')return s.timingMode==='arcLength'?'arcLength':s.timingMode==='custom'?'custom':'pointSync';
    if(field.key==='syncActor')return s.syncActor||'';
    if(field.key==='yaw')return s.yaw||0;
    if(field.key==='pitch')return s.pitch||0;
    throw new Error(`Unhandled shot runtime field: ${field.key}`);
  });
}
function stageToData(){
  return {name:curScene().name, desc:curScene().desc, script:curScene().script, templateId:curScene().templateId||undefined, bg:curScene().bg, ground:cleanGroundAppearance(curScene().ground), sun:cleanSun(curScene().sun),
    actors:actors.map(a=>{const origin=a.pathPts.length>=2?a.pathPts[0]:a.obj.position,px=previewAuthoredActorValue(a,'position.x',origin.x),pz=previewAuthoredActorValue(a,'position.z',origin.z),authoredRot=Number.isFinite(a.authoredRotY)?a.authoredRotY:a.obj.rotation.y,rot=previewAuthoredActorValue(a,'rotation.y',authoredRot*180/Math.PI)*Math.PI/180,elev=a.elev||0,baseScale=Number.isFinite(a.authoredScale)?a.authoredScale:a.obj.scale.x,scale=previewAuthoredActorValue(a,'scale',baseScale),scalar=actorDataScalars(a,{rot,elev,scale});return {kind:scalar.kind, label:scalar.label, pose:scalar.pose,
      semanticType:a.semanticType||undefined, dimensions:a.dimensions?cleanDimensions(a.dimensions,semanticProxyType(a.semanticType)?.dimensions):undefined,
      asset:a.asset, mount:a.mount||undefined,
      joints:a.kind==='char'?(a.joints||{}):undefined,
      pos:[+px.toFixed(2),+pz.toFixed(2)], rotY:scalar.rotY,
      height:scalar.height, pathMode:scalar.pathMode,
      terrainVersion:a.kind==='desert'?(a.obj.userData.terrainVersion||1):undefined,
      scale:scalar.scale,
      pathTimes:ensureActorTimes(a).map(t=>+t.toFixed(3)),
      pathEase:ensureEaseArray(a,'pathEase',Math.max(0,a.pathPts.length-1)),timeLink:scalar.timeLink,timeOffset:scalar.timeOffset,timeLinkShot:a.timeLinkShot||0,
      path:a.pathPts.map(p=>[+p.x.toFixed(2),+p.z.toFixed(2)])};}),
    shots:shots.map(s=>{const scalar=shotDataScalars(s);return {name:scalar.name, desc:scalar.desc, dur:scalar.dur, lock:scalar.lock, fov:scalar.fov,camMode:scalar.camMode,
      timingMode:scalar.timingMode, syncActor:scalar.syncActor,
      yaw:scalar.yaw, pitch:scalar.pitch,
      reframeByAspect:s.reframeByAspect?globalThis.normalizeReframeByAspect(s.reframeByAspect):undefined,
      camTimes:ensureCamTimes(s).map(t=>+t.toFixed(3)),
      camEase:ensureEaseArray(s,'camEase',Math.max(0,s.camPts.length-1)),camAimTimes:ensureCamAimTimes(s).map(t=>+t.toFixed(3)),camAimEase:ensureEaseArray(s,'camAimEase',Math.max(0,s.camPts.length-1)),camFovTimes:ensureCamFovTimes(s).map(t=>+t.toFixed(3)),camFovEase:ensureEaseArray(s,'camFovEase',Math.max(0,s.camPts.length-1)),
      camAim:ensureCamKeys(s).map(k=>[+k.yaw.toFixed(2),+k.pitch.toFixed(2),+k.fov.toFixed(2)]),
      cam:s.camPts.map(p=>[+p.x.toFixed(2),+p.y.toFixed(2),+p.z.toFixed(2)])};})};
}
const COLLISION_EPS=.025;
function actorOwnWorldBox(a){
  const box=new THREE.Box3(); let found=false;
  a.obj.updateMatrixWorld(true);
  a.obj.traverse(o=>{
    if(!o.isMesh || o.visible===false || !o.geometry) return; // Sprite labels do not collide.
    if(!o.geometry.boundingBox && o.geometry.computeBoundingBox) o.geometry.computeBoundingBox();
    if(!o.geometry.boundingBox) return;
    const b=o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld);
    if(!found){ box.copy(b); found=true; } else box.union(b);
  });
  if(!found) box.setFromCenterAndSize(a.obj.position,new THREE.Vector3(.1,.1,.1));
  return box;
}
function actorCollisionOwnBox(a){
  const bounds=a?.obj?.userData?.collisionBounds;
  if(bounds&&Array.isArray(bounds.min)&&bounds.min.length===3&&Array.isArray(bounds.max)&&bounds.max.length===3){
    a.obj.updateMatrixWorld(true);
    return new THREE.Box3(
      new THREE.Vector3(bounds.min[0],bounds.min[1],bounds.min[2]),
      new THREE.Vector3(bounds.max[0],bounds.max[1],bounds.max[2])
    ).applyMatrix4(a.obj.matrixWorld);
  }
  return actorOwnWorldBox(a);
}
function desertLocalSurfaceHeight(d,x,z){
  const surface=d?.obj?.userData?.desertSurface,p=surface?.geometry?.attributes?.position;
  const size=d?.obj?.userData?.desertSize||DESERT_SIZE,segments=d?.obj?.userData?.desertSegments||DESERT_SEGMENTS;
  if(!p||segments<1)return 0;
  const half=size/2,step=size/segments;
  const gx=Math.max(0,Math.min(segments,(x+half)/step)),gz=Math.max(0,Math.min(segments,(z+half)/step));
  const col=Math.min(segments-1,Math.floor(gx)),row=Math.min(segments-1,Math.floor(gz));
  const u=gx-col,v=gz-row,stride=segments+1;
  const h00=p.getY(row*stride+col),h01=p.getY((row+1)*stride+col);
  const h10=p.getY(row*stride+col+1),h11=p.getY((row+1)*stride+col+1);
  /* Match PlaneGeometry's lower-left to upper-right diagonal and interpolate its two rendered triangles. */
  return u+v<=1
    ?h00+u*(h10-h00)+v*(h01-h00)
    :h11+(1-u)*(h01-h11)+(1-v)*(h10-h11);
}
function desertSurfaceHeightAt(x,z,ignored){
  let highest=0;
  actors.forEach(d=>{
    if(d===ignored||d.kind!=='desert'||!d.obj.visible)return;
    const scale=Math.max(.001,d.obj.scale.x),dx=x-d.obj.position.x,dz=z-d.obj.position.z;
    const c=Math.cos(d.obj.rotation.y),s=Math.sin(d.obj.rotation.y);
    const lx=(dx*c-dz*s)/scale,lz=(dx*s+dz*c)/scale,half=(d.obj.userData.desertSize||DESERT_SIZE)/2;
    if(Math.abs(lx)>half||Math.abs(lz)>half)return;
    highest=Math.max(highest,d.obj.position.y+desertLocalSurfaceHeight(d,lx,lz)*scale);
  });
  return highest;
}
function collisionExemptKind(kind){return ['board','desert','road'].includes(kind);}
function terrainSupportHeight(a,x=a?.obj.position.x,z=a?.obj.position.z){
  if(!a||a.mount||collisionExemptKind(a.kind))return 0;
  const box=actorCollisionOwnBox(a),dx=x-a.obj.position.x,dz=z-a.obj.position.z;
  const minX=box.min.x+dx,maxX=box.max.x+dx,minZ=box.min.z+dz,maxZ=box.max.z+dz;
  const samples=[0,.25,.5,.75,1],xs=samples.map(t=>minX+(maxX-minX)*t),zs=samples.map(t=>minZ+(maxZ-minZ)*t);
  let support=0;
  xs.forEach(px=>zs.forEach(pz=>{support=Math.max(support,desertSurfaceHeightAt(px,pz,a));}));
  return support;
}
function terrainPoseFloor(a){
  if(!a)return 0;
  const y=a.obj.position.y;
  a.obj.position.y=0;
  const min=actorCollisionOwnBox(a).min.y;
  a.obj.position.y=y;a.obj.updateMatrixWorld(true);
  return Math.max(0,-min);
}
function alignActorToTerrain(a){
  if(!a)return 0;
  if(a.mount){
    const host=actorByLabel(a.mount);
    if(host)syncMountedTransform(a,host);
    return a.obj.position.y;
  }
  const support=terrainSupportHeight(a);
  /* Pose and gait can move the lowest foot/hoof; compensate on dunes without changing flat-ground elevation semantics. */
  const poseFloor=support>0?terrainPoseFloor(a):0;
  a.obj.position.y=support+Math.max(Number(a.elev)||0,poseFloor);
  a.obj.updateMatrixWorld(true);
  return support;
}
function alignAllActorsToTerrain(){
  actors.filter(a=>a.kind==='desert').forEach(alignActorToTerrain);
  actors.filter(a=>!a.mount&&a.kind!=='desert').forEach(alignActorToTerrain);
  actors.filter(a=>a.mount).forEach(alignActorToTerrain);
}
function seahorseMountHost(a){
  if(!a||a.kind!=='char'||!a.mount)return null;
  const host=actorByLabel(a.mount);return host?.kind==='seahorse'?host:null;
}
function clampSeahorseScale(value){
  return Math.max(.85,Math.min(1.15,Number.isFinite(+value)?+value:1));
}
function syncSeahorseRiderScale(a,host=seahorseMountHost(a)){
  if(!a||!host)return false;
  const scale=clampSeahorseScale(host.obj.scale.x);
  host.obj.scale.setScalar(scale);a.obj.scale.setScalar(scale);
  return scale;
}
function syncMountedTransform(a,host){
  if(!a||!host) return;
  if(host.kind==='seahorse'){
    syncSeahorseRiderScale(a,host);
    const anchor=host.obj.userData.mountAnchor;
    if(anchor&&typeof anchor.getWorldPosition==='function'){
      host.obj.updateMatrixWorld(true);
      a.obj.position.copy(anchor.getWorldPosition(new THREE.Vector3()));
      a.obj.position.y+=a.elev||0;
      a.obj.rotation.y=host.obj.rotation.y;
      a.obj.updateMatrixWorld(true);
      return;
    }
  }
  const hp=host.obj.position;
  const sx=(host.obj.userData.seatX||0)*host.obj.scale.x, sz=(host.obj.userData.seatZ||0)*host.obj.scale.x;
  const ca=Math.cos(host.obj.rotation.y), sa=Math.sin(host.obj.rotation.y);
  a.obj.position.set(hp.x+sx*ca+sz*sa,
    hp.y+(host.obj.userData.seatY||1.3)*host.obj.scale.x+(a.elev||0),
    hp.z-sx*sa+sz*ca);
  a.obj.rotation.y=host.obj.rotation.y+(host.kind==='car'?Math.PI/2:0);
  a.obj.updateMatrixWorld(true);
}
function actorWorldBox(a){
  const box=actorOwnWorldBox(a);
  if(!a.mount){
    actors.forEach(rider=>{
      if(rider.mount!==a.label) return;
      syncMountedTransform(rider,a); box.union(actorOwnWorldBox(rider));
    });
  }
  return box;
}
function actorCollisionWorldBox(a){
  const box=actorCollisionOwnBox(a);
  if(!a.mount){
    actors.forEach(rider=>{
      if(rider.mount!==a.label)return;
      syncMountedTransform(rider,a);box.union(actorCollisionOwnBox(rider));
    });
  }
  return box;
}
function axisAlignedCollisionShape(box){
  return {
    box,
    center:{x:(box.min.x+box.max.x)/2,z:(box.min.z+box.max.z)/2},
    axisX:{x:1,z:0},axisZ:{x:0,z:1},
    halfX:(box.max.x-box.min.x)/2,halfZ:(box.max.z-box.min.z)/2
  };
}
function orientedCollisionShape(a,bounds){
  if(!bounds||!Array.isArray(bounds.min)||!Array.isArray(bounds.max))return axisAlignedCollisionShape(actorCollisionOwnBox(a));
  a.obj.updateMatrixWorld(true);
  const e=a.obj.matrixWorld.elements;
  const scaleX=Math.hypot(e[0],e[2]),scaleZ=Math.hypot(e[8],e[10]);
  const box=new THREE.Box3(
    new THREE.Vector3(bounds.min[0],bounds.min[1],bounds.min[2]),
    new THREE.Vector3(bounds.max[0],bounds.max[1],bounds.max[2])
  ).applyMatrix4(a.obj.matrixWorld);
  if(scaleX<1e-6||scaleZ<1e-6)return axisAlignedCollisionShape(box);
  const center=new THREE.Vector3(
    (bounds.min[0]+bounds.max[0])/2,
    (bounds.min[1]+bounds.max[1])/2,
    (bounds.min[2]+bounds.max[2])/2
  ).applyMatrix4(a.obj.matrixWorld);
  return {
    box,
    center:{x:center.x,z:center.z},
    axisX:{x:e[0]/scaleX,z:e[2]/scaleX},
    axisZ:{x:e[8]/scaleZ,z:e[10]/scaleZ},
    halfX:(bounds.max[0]-bounds.min[0])*scaleX/2,
    halfZ:(bounds.max[2]-bounds.min[2])*scaleZ/2
  };
}
function shipwreckCollisionShapes(a){
  const segments=a?.obj?.userData?.collisionSegments;
  if(Array.isArray(segments)&&segments.length)return segments.map(bounds=>orientedCollisionShape(a,bounds));
  return [orientedCollisionShape(a,a?.obj?.userData?.collisionBounds)];
}
function collisionShapesPenetrate(a,b,eps=COLLISION_EPS){
  if(Math.min(a.box.max.y,b.box.max.y)-Math.max(a.box.min.y,b.box.min.y)<=eps)return false;
  const dot=(left,right)=>left.x*right.x+left.z*right.z;
  const delta={x:b.center.x-a.center.x,z:b.center.z-a.center.z};
  const radius=(shape,axis)=>shape.halfX*Math.abs(dot(shape.axisX,axis))+shape.halfZ*Math.abs(dot(shape.axisZ,axis));
  return [a.axisX,a.axisZ,b.axisX,b.axisZ].every(axis=>
    radius(a,axis)+radius(b,axis)-Math.abs(dot(delta,axis))>eps);
}
function collisionPairPenetrates(a,b){
  /* Preserve legacy AABB behavior everywhere except the long ship hull. Its stable
     editor root supplies tapered yaw-oriented segments, so diagonal playback does
     not inflate a 6.3 × 23.2m envelope into a roughly 21 × 21m solid obstacle. */
  if(a.kind!=='shipwreck'&&b.kind!=='shipwreck'){
    return boxesPenetrate(actorCollisionWorldBox(a),actorCollisionWorldBox(b));
  }
  const left=a.kind==='shipwreck'?shipwreckCollisionShapes(a):[axisAlignedCollisionShape(actorCollisionWorldBox(a))];
  const right=b.kind==='shipwreck'?shipwreckCollisionShapes(b):[axisAlignedCollisionShape(actorCollisionWorldBox(b))];
  return left.some(leftShape=>right.some(rightShape=>collisionShapesPenetrate(leftShape,rightShape)));
}
function boxesPenetrate(a,b,eps=COLLISION_EPS){
  return Math.min(a.max.x,b.max.x)-Math.max(a.min.x,b.min.x)>eps
    && Math.min(a.max.y,b.max.y)-Math.max(a.min.y,b.min.y)>eps
    && Math.min(a.max.z,b.max.z)-Math.max(a.min.z,b.min.z)>eps;
}
function collisionPairIgnored(a,b){
  if(!a||!b||a===b||collisionExemptKind(a.kind)||collisionExemptKind(b.kind)) return true;
  if(a.mount===b.label||b.mount===a.label) return true;       // Rider and mount may touch.
  if(a.mount&&b.mount&&a.mount===b.mount) return true;        // Passengers on the same host.
  return false;
}
function collisionEnabled(){
  const c=document.getElementById('collisionOn');
  return c?c.checked:!(project&&project.settings&&project.settings.collision===false);
}
function actorPenetrates(a){
  if(!a||collisionExemptKind(a.kind)) return false;
  return actors.some(b=>!b.mount&&!collisionPairIgnored(a,b)&&collisionPairPenetrates(a,b));
}
function moveActorSafely(a,targetX,targetZ){
  if(automaticCaptureMutationBlocked())return false;
  targetX=stageCoord(targetX,a.obj.position.x); targetZ=stageCoord(targetZ,a.obj.position.z);
  const sx=a.obj.position.x, sz=a.obj.position.z;
  const setXZ=(x,z)=>{a.obj.position.x=x;a.obj.position.z=z;alignActorToTerrain(a);};
  if(!collisionEnabled()||collisionExemptKind(a.kind)||a.mount){ setXZ(targetX,targetZ); return a.obj.position.clone(); }
  alignActorToTerrain(a);
  const wasBad=actorPenetrates(a);
  const dx=targetX-sx, dz=targetZ-sz, dist=Math.hypot(dx,dz);
  if(dist<1e-5) return a.obj.position.clone();
  const size=actorCollisionWorldBox(a).getSize(new THREE.Vector3());
  const stride=Math.max(.06,Math.min(.35,Math.min(Math.max(size.x,.15),Math.max(size.z,.15))*.35));
  const steps=Math.min(400,Math.max(1,Math.ceil(dist/stride)));
  let last=0;
  for(let i=1;i<=steps;i++){
    const t=i/steps;
    setXZ(sx+dx*t,sz+dz*t);
    if(actorPenetrates(a)){
      if(wasBad){ // Already-overlapping objects may keep moving until they separate.
        last=t; continue;
      }
      let lo=last, hi=t;
      for(let k=0;k<10;k++){
        const m=(lo+hi)/2;
        setXZ(sx+dx*m,sz+dz*m);
        if(actorPenetrates(a)) hi=m; else lo=m;
      }
      setXZ(sx+dx*lo,sz+dz*lo);
      return a.obj.position.clone();
    }
    if(wasBad) return moveActorSafely(a,targetX,targetZ); // Once separated, resume normal collision.
    last=t;
  }
  return a.obj.position.clone();
}
function constrainActorPathPoint(a,from,to){
  to=v3(stageCoord(to.x,from&&from.x||0),0,stageCoord(to.z,from&&from.z||0));
  if(!a||!collisionEnabled()||collisionExemptKind(a.kind)||a.mount) return to;
  const save=a.obj.position.clone();
  a.obj.position.x=from.x;a.obj.position.z=from.z;alignActorToTerrain(a);
  const p=moveActorSafely(a,to.x,to.z);
  a.obj.position.copy(save);
  return v3(p.x,0,p.z);
}
function groundElevation(a){
  const y=a.obj.position.y;
  a.obj.position.y=0;
  const min=actorCollisionWorldBox(a).min.y;
  a.obj.position.y=y; a.obj.updateMatrixWorld(true);
  const v=Math.max(0,-min);
  return v<1e-4?0:v;
}
function setActorElevation(a,target){
  if(automaticCaptureMutationBlocked())return false;
  if(!a) return 0;
  const start=Number(a.elev)||0;
  target=Math.max(groundElevation(a),Math.min(20,Number(target)||0));
  const setRaw=v=>{
    a.elev=v;
    if(a.mount){
      const host=actorByLabel(a.mount);
      if(host) syncMountedTransform(a,host);
      else a.obj.position.y=v;
    } else alignActorToTerrain(a);
    a.obj.updateMatrixWorld(true);
  };
  if(!collisionEnabled()||collisionExemptKind(a.kind)){ setRaw(target); return a.elev; }
  setRaw(start); const wasBad=actorPenetrates(a);
  const steps=Math.max(1,Math.ceil(Math.abs(target-start)/.05)); let last=start;
  for(let i=1;i<=steps;i++){
    const v=start+(target-start)*(i/steps); setRaw(v);
    if(actorPenetrates(a)&&!wasBad){
      let lo=last, hi=v;
      for(let k=0;k<10;k++){
        const m=(lo+hi)/2; setRaw(m);
        if(actorPenetrates(a)) hi=m; else lo=m;
      }
      setRaw(lo); return a.elev;
    }
    last=v;
  }
  return a.elev;
}
function snapActorToGround(a){ if(automaticCaptureMutationBlocked())return false;return setActorElevation(a,groundElevation(a)); }
function setActorScaleSafely(a,value){
  if(automaticCaptureMutationBlocked())return false;
  if(!a) return 1;
  const linkedHost=seahorseMountHost(a);
  if(linkedHost){syncMountedTransform(a,linkedHost);return linkedHost.obj.scale.x;}
  const target=a.kind==='seahorse'
    ?clampSeahorseScale(value)
    :Math.max(.1,Math.min(80,Number.isFinite(+value)?+value:1));
  const linkedRiders=a.kind==='seahorse'?actors.filter(rider=>rider.mount===a.label):[];
  const old=Number.isFinite(a.authoredScale)?a.authoredScale:a.obj.scale.x,oldAuthoredScale=a.authoredScale,oldScale=a.obj.scale.clone(),wasBad=collisionEnabled()&&actorPenetrates(a);
  const oldRiderScales=linkedRiders.map(rider=>rider.obj.scale.clone());
  const oldDims=a.dimensions?Object.assign({},a.dimensions):null;
  a.authoredScale=target;
  if(a.semanticType)applySemanticDimensions(a);else a.obj.scale.setScalar(target);
  alignActorToTerrain(a);
  linkedRiders.forEach(rider=>syncMountedTransform(rider,a));
  if(collisionEnabled()&&!wasBad&&actorPenetrates(a)){
    a.authoredScale=oldAuthoredScale;a.obj.scale.copy(oldScale);a.dimensions=oldDims;
    linkedRiders.forEach((rider,index)=>{rider.obj.scale.copy(oldRiderScales[index]);syncMountedTransform(rider,a);});
    alignActorToTerrain(a);return old;
  }
  return target;
}
function placeActorWithoutOverlap(a){
  if(automaticCaptureMutationBlocked())return false;
  alignActorToTerrain(a);
  if(!a||!collisionEnabled()||!actorPenetrates(a)) return a;
  const x0=a.obj.position.x, z0=a.obj.position.z;
  for(let ring=1;ring<=12;ring++){
    const r=ring*.75, count=Math.max(8,ring*6);
    for(let i=0;i<count;i++){
      const ang=i/count*Math.PI*2;
      a.obj.position.x=x0+Math.cos(ang)*r; a.obj.position.z=z0+Math.sin(ang)*r;alignActorToTerrain(a);
      if(!actorPenetrates(a)) return a;
    }
  }
  a.obj.position.x=x0; a.obj.position.z=z0;alignActorToTerrain(a);return a;
}
function syncScene(){
  if(automaticCaptureMutationBlocked())return false;
  if(project&&project.scenes[sceneIdx])project.scenes[sceneIdx]=stageToData();return true;
}
function clearStage(){
  if(automaticCaptureMutationBlocked())return false;
  actors.forEach(a=>{scene.remove(a.obj);disposeOwnedObject3D(a.obj);}); actors=[]; selected=null;
}
function loadScene(i, skipSync){
  if(automaticCaptureMutationBlocked())return false;
  globalThis.clearUnifiedCameraDraft?.();
  globalThis.clearReframeDraft?.(false);
  globalThis.clearTimelineCameraPositionSelection?.(true);
  if(!skipSync) syncScene();
  sceneIdx=Math.max(0,Math.min(project.scenes.length-1,i));
  shotIdx=0; time=0; playing=false; playAllMode=false;
  clearStage();
  const sd=project.scenes[sceneIdx];
  sd.sun=cleanSun(sd.sun);sd.ground=cleanGroundAppearance(sd.ground);
  (sd.actors||[]).forEach(buildActor);
  /* Migrate after every host exists so project v5 actor order cannot broaden either
     mount-specific upgrade. Seahorse riders also adopt the documented linked scale. */
  actors.forEach(a=>{
    if(migrateHorseRideJoints(a)||migrateSeahorseRideJoints(a))applyJoints(a);
    const host=seahorseMountHost(a);if(host)syncMountedTransform(a,host);
  });
  alignAllActorsToTerrain();
  shots=(sd.shots||[]).map(s=>{
    const camPts=s.cam.map(c=>v3(c[0],c[1],c[2]));
    const raw=Array.isArray(s.camAim)?s.camAim:[];
    const scalar=shotRuntimeScalars(s);
    const camKeys=camPts.map((_,i)=>({yaw:+(raw[i]?.[0]??scalar.yaw),pitch:+(raw[i]?.[1]??scalar.pitch),fov:+(raw[i]?.[2]??scalar.fov??40)}));
    return {name:scalar.name,desc:scalar.desc,dur:scalar.dur,lock:scalar.lock,fov:scalar.fov,camMode:scalar.camMode,
      timingMode:scalar.timingMode,syncActor:scalar.syncActor,yaw:scalar.yaw,pitch:scalar.pitch,
      reframeByAspect:s.reframeByAspect?globalThis.normalizeReframeByAspect(s.reframeByAspect):undefined,
      camTimes:Array.isArray(s.camTimes)?s.camTimes.map(Number):[],camEase:Array.isArray(s.camEase)?s.camEase.map(normalizeEaseSpec):[],camAimTimes:Array.isArray(s.camAimTimes)?s.camAimTimes.map(Number):[],camAimEase:Array.isArray(s.camAimEase)?s.camAimEase.map(normalizeEaseSpec):[],camFovTimes:Array.isArray(s.camFovTimes)?s.camFovTimes.map(Number):[],camFovEase:Array.isArray(s.camFovEase)?s.camFovEase.map(normalizeEaseSpec):[],camPts,camKeys};
  });
  if(!shots.length)shots=[{name:PreVisionI18n.t('hierarchy.newShotName',{index:'01'}),desc:PreVisionI18n.t('hierarchy.customDescription'),dur:5,lock:DEFAULT_GLOBAL_LOCK,fov:40,camMode:'curve',timingMode:'pointSync',syncActor:'',camPts:[v3(-8,3,8),v3(-4,2,6)],camKeys:[{yaw:0,pitch:0,fov:40},{yaw:0,pitch:0,fov:40}]}];
  shots.forEach(s=>{ensureCamTimes(s);ensureCamAimTimes(s);ensureCamFovTimes(s);ensureEaseArray(s,'camEase',Math.max(0,s.camPts.length-1));ensureEaseArray(s,'camAimEase',Math.max(0,s.camPts.length-1));ensureEaseArray(s,'camFovEase',Math.max(0,s.camPts.length-1));});actors.forEach(a=>{ensureActorTimes(a);ensureEaseArray(a,'pathEase',Math.max(0,a.pathPts.length-1));});
  /* Legacy projects lack syncActor: prefer the lock target, then the first path with matching point count. */
  shots.forEach(s=>{
    if(s.syncActor)return;
    const locked=pathOwner(actorByLabel(s.lock)),matches=effectiveActorPaths().filter(a=>a.pathPts.length===s.camPts.length);
    s.syncActor=(locked&&locked.pathPts.length===s.camPts.length?locked:matches[0])?.label||'';
  });
  project.settings=project.settings||{collision:true,labels:true};
  const collisionBox=document.getElementById('collisionOn');
  if(collisionBox) collisionBox.checked=project.settings.collision!==false;
  const labelBox=document.getElementById('showLabels');
  if(labelBox) labelBox.checked=project.settings.labels!==false;
  applySunSettings(false);
  applyGroundAppearance();
  buildSky();
  syncAll();
  return true;
}
function actorByLabel(name){ return actors.find(a=>a.label===name); }
function pathOwner(a){ return a&&a.mount?(actorByLabel(a.mount)||a):a; }
function effectiveActorPaths(){
  const seen=new Set(),out=[];
  actors.forEach(src=>{const a=pathOwner(src);if(a&&!seen.has(a)&&a.pathPts.length>=2){seen.add(a);out.push(a);}});
  return out;
}
function syncTargetForShot(s){
  if(!s||s.timingMode!=='pointSync')return null;
  const a=pathOwner(actorByLabel(s.syncActor));
  return a&&a.pathPts.length===s.camPts.length?a:null;
}
function isPointSyncShot(s){return !!syncTargetForShot(s);}
function copyActorPathToCamera(label){
  if(automaticCaptureMutationBlocked())return false;
  const a=actorByLabel(label),owner=pathOwner(a),s=curShot();
  if(!owner||owner.pathPts.length<2||!s)return false;
  const first=owner.pathPts[0],last=owner.pathPts[owner.pathPts.length-1];
  const dir=last.clone().sub(first).setY(0);
  if(dir.lengthSq()<.001){for(let i=1;i<owner.pathPts.length;i++){dir.copy(owner.pathPts[i]).sub(first).setY(0);if(dir.lengthSq()>.001)break;}}
  if(dir.lengthSq()<.001)dir.set(0,0,1);dir.normalize();
  const side=new THREE.Vector3(dir.z,0,-dir.x),offset=3.5;
  const xs=owner.pathPts.map(p=>p.x),zs=owner.pathPts.map(p=>p.z);
  const clampDelta=(d,min,max)=>Math.max(-STAGE_LIMIT-min,Math.min(STAGE_LIMIT-max,d));
  const dx=clampDelta(side.x*offset,Math.min(...xs),Math.max(...xs)),dz=clampDelta(side.z*offset,Math.min(...zs),Math.max(...zs));
  const y=clampAuthoredCameraPointHeight(s.camPts[Math.max(0,Math.min(selCamPt,s.camPts.length-1))]?.y,2);
  const base=Object.assign({},ensureCamKeys(s)[Math.max(0,Math.min(selCamPt,s.camPts.length-1))]);
  s.camPts=owner.pathPts.map(p=>v3(p.x+dx,y,p.z+dz));
  s.camMode=owner.pathMode==='line'?'line':'curve';
  const sourceTimes=ensureActorTimes(owner),a0=sourceTimes[0]||0,a1=sourceTimes[sourceTimes.length-1]||a0+1,span=Math.max(.01,a1-a0);
  s.camTimes=sourceTimes.map(t=>(t-a0)/span*s.dur);
  s.camAimTimes=s.camTimes.slice();s.camFovTimes=s.camTimes.slice();s.camEase=ensureEaseArray(owner,'pathEase',owner.pathPts.length-1).map(x=>Object.assign({},x));s.camAimEase=s.camEase.map(x=>Object.assign({},x));s.camFovEase=s.camEase.map(x=>Object.assign({},x));
  s.timingMode='custom';s.syncActor=owner.label;
  s.camKeys=s.camPts.map(()=>Object.assign({},base));selCamPt=0;
  refreshCamPtUI();refreshTimingUI();refreshMotionTimeline();rebuildViz();globalThis.updatePrompt();markDirty();
  const note=document.getElementById('copyPathNote');if(note)note.textContent=PreVisionI18n.t('path.copySuccess',{label:owner.label,count:s.camPts.length,offset:Math.hypot(dx,dz).toFixed(1)});
  return true;
}
function addActorPathPoint(source,point,seedPoint){
  if(automaticCaptureMutationBlocked())return false;
  const a=pathOwner(source); if(!a) return null;
  let seeded=false;
  if(!a.pathPts.length){
    const base=seedPoint?v3(seedPoint.x,0,seedPoint.z):v3(a.obj.position.x,0,a.obj.position.z);
    a.pathPts.push(base); selActorPt=0; seeded=true;
    if(!point){
      const dir=v3(Math.sin(a.obj.rotation.y),0,Math.cos(a.obj.rotation.y)).multiplyScalar(2);
      point=base.clone().add(dir);
    }
  }
  let insertAt=a.pathPts.length;
  if(!point){
    const i=Math.max(0,Math.min(selActorPt,a.pathPts.length-1));
    if(i<a.pathPts.length-1){
      point=a.pathPts[i].clone().lerp(a.pathPts[i+1],.5); insertAt=i+1;
    } else if(a.pathPts.length>1){
      const ext=a.pathPts[i].clone().sub(a.pathPts[i-1]);
      if(ext.lengthSq()<.001) ext.set(Math.sin(a.obj.rotation.y),0,Math.cos(a.obj.rotation.y));
      point=a.pathPts[i].clone().add(ext.setLength(2));
    } else {
      point=a.pathPts[0].clone().add(v3(Math.sin(a.obj.rotation.y)*2,0,Math.cos(a.obj.rotation.y)*2));
    }
  }
  const from=a.pathPts[Math.max(0,insertAt-1)];
  const safe=constrainActorPathPoint(a,from,point);
  if(safe.distanceToSquared(from)<.0025){
    selActorPt=Math.max(0,insertAt-1); refreshActorPathUI(); rebuildViz(); if(seeded)markDirty(); return null;
  }
  a.pathPts.splice(insertAt,0,safe); selActorPt=insertAt;
  a.pathTimes=distributedPathTimes(a.pathPts,0,liveSceneDuration());
  ensureEaseArray(a,'pathEase',Math.max(0,a.pathPts.length-1));
  refreshActorPathUI(); refreshMotionTimeline(); rebuildViz(); markDirty(); return safe;
}
function removeActorPathPoint(source,idx=selActorPt){
  if(automaticCaptureMutationBlocked())return false;
  const a=pathOwner(source); if(!a||!a.pathPts.length) return false;
  idx=Math.max(0,Math.min(idx,a.pathPts.length-1));
  a.pathPts.splice(idx,1);if(Array.isArray(a.pathTimes))a.pathTimes.splice(idx,1);selActorPt=Math.max(0,Math.min(idx-1,a.pathPts.length-1));
  ensureEaseArray(a,'pathEase',Math.max(0,a.pathPts.length-1));
  refreshActorPathUI(); refreshMotionTimeline(); rebuildViz(); markDirty(); return true;
}
function lockTarget(name){
  const a=actorByLabel(name);
  if(!a) return new THREE.Vector3(0,1,0);
  /* Relative offsets ride on the object position; mounted riders inherit saddle height. */
  const explicit=Number.isFinite(a.obj.userData.lockTargetY)?a.obj.userData.lockTargetY*a.obj.scale.y:null;
  const rel={char:(a.pose==='lie'?0.4:a.pose==='sit'?0.9:a.pose==='crouch'?1:a.pose==='ride'?0.9:1.3),
    car:.9,horse:1.2,seahorse:1.65,shipwreck:4.8,wall:1.4,pillar:1.8,tree:2,mount:3,house:2,rock:.6,
    board:(a.obj.userData.boardH||3)/2}[a.kind]||.5;
  return a.obj.position.clone().add(new THREE.Vector3(0,explicit??rel,0));
}
const MANUAL_CAMERA_LOCK_VALUE='\u624b\u52a8\u671d\u5411';
function applyPreviewCameraAnimation(s,localTime){
  void s;void localTime;
  /* Camera playback has one authoritative source: shot camPts/camKeys/camTimes. */
}
function applyPreviewJointChannel(a,key,value){
  const r=a?.obj?.userData?.rig;if(!r)return false;const d=Math.PI/180;
  if(key==='bodyY')r.body.position.y=value;
  else if(key==='bodyRotX')r.body.rotation.x=value*d;
  else if(key==='neckX')r.neck.rotation.x=value*d;else if(key==='neckY')r.neck.rotation.y=value*d;
  else if(key==='spineX')r.spine.rotation.x=value*d;else if(key==='spineY')r.spine.rotation.y=value*d;else if(key==='spineZ')r.spine.rotation.z=value*d;
  else if(key==='shLX')r.shL.rotation.x=value*d;else if(key==='shLZ')r.shL.rotation.z=value*d;else if(key==='shRX')r.shR.rotation.x=value*d;else if(key==='shRZ')r.shR.rotation.z=value*d;
  else if(key==='elL')r.elL.rotation.x=value*d;else if(key==='elR')r.elR.rotation.x=value*d;
  else if(key==='wristLX')r.wristL.rotation.x=value*d;else if(key==='wristLZ')r.wristL.rotation.z=value*d;else if(key==='wristRX')r.wristR.rotation.x=value*d;else if(key==='wristRZ')r.wristR.rotation.z=value*d;
  else if(key==='hipLX')r.hipL.rotation.x=value*d;else if(key==='hipLZ')r.hipL.rotation.z=value*d;else if(key==='hipRX')r.hipR.rotation.x=value*d;else if(key==='hipRZ')r.hipR.rotation.z=value*d;
  else if(key==='kneeL')r.kneeL.rotation.x=value*d;else if(key==='kneeR')r.kneeR.rotation.x=value*d;
  else if(key==='ankleLX')r.ankleL.rotation.x=value*d;else if(key==='ankleLZ')r.ankleL.rotation.z=value*d;else if(key==='ankleRX')r.ankleR.rotation.x=value*d;else if(key==='ankleRZ')r.ankleR.rotation.z=value*d;
  else return false;return true;
}
function applyPreviewScaleSafely(a,target){
  const linkedHost=seahorseMountHost(a);
  if(linkedHost){syncMountedTransform(a,linkedHost);return false;}
  target=a.kind==='seahorse'?clampSeahorseScale(target):Math.max(.3,Math.min(3,+target||1));
  const linkedRiders=a.kind==='seahorse'?actors.filter(rider=>rider.mount===a.label):[];
  const old=a.obj.scale.clone(),oldRiderScales=linkedRiders.map(rider=>rider.obj.scale.clone()),wasBad=collisionEnabled()&&actorPenetrates(a);
  if(a.semanticType){
    const spec=semanticProxyType(a.semanticType),dims=cleanDimensions(a.dimensions,spec?.dimensions),base=spec?.dimensions||dims;
    a.obj.scale.set(Math.max(.05,dims.width/base.width)*target,Math.max(.05,dims.height/base.height)*target,Math.max(.05,dims.depth/base.depth)*target);
  }else a.obj.scale.setScalar(target);
  alignActorToTerrain(a);linkedRiders.forEach(rider=>syncMountedTransform(rider,a));
  if(collisionEnabled()&&!wasBad&&actorPenetrates(a)){
    a.obj.scale.copy(old);linkedRiders.forEach((rider,index)=>{rider.obj.scale.copy(oldRiderScales[index]);syncMountedTransform(rider,a);});
    alignActorToTerrain(a);return false;
  }
  return true;
}
function applyPreviewElevationSafely(a,target){
  const authored=Number(a.elev)||0,safe=setActorElevation(a,Math.max(0,Math.min(20,+target||0)));
  a.elev=authored;a.obj.updateMatrixWorld(true);return safe;
}
function applyPreviewActorAnimation(a,globalTime){
  const ownerKey=previewActorOwnerKey(a),state=previewOwnerState(ownerKey);if(!state)return;
  const hasX=!a.mount&&previewChannelActive(ownerKey,state,'position.x'),hasZ=!a.mount&&previewChannelActive(ownerKey,state,'position.z');
  if(hasX||hasZ)moveActorSafely(a,
    hasX?previewAnimatedValue(ownerKey,state,'position.x',globalTime,a.obj.position.x):a.obj.position.x,
    hasZ?previewAnimatedValue(ownerKey,state,'position.z',globalTime,a.obj.position.z):a.obj.position.z);
  if(previewChannelActive(ownerKey,state,'scale'))applyPreviewScaleSafely(a,previewAnimatedValue(ownerKey,state,'scale',globalTime,a.obj.scale.x));
  if(previewChannelActive(ownerKey,state,'elevation')){
    applyPreviewElevationSafely(a,previewAnimatedValue(ownerKey,state,'elevation',globalTime,a.elev||0));
  }else if(hasX||hasZ)alignActorToTerrain(a);
  if(!a.mount&&previewChannelActive(ownerKey,state,'rotation.y')){
    const old=a.obj.rotation.y,wasBad=collisionEnabled()&&actorPenetrates(a);
    a.obj.rotation.y=previewAnimatedValue(ownerKey,state,'rotation.y',globalTime,old*180/Math.PI)*Math.PI/180;alignActorToTerrain(a);
    if(collisionEnabled()&&!wasBad&&actorPenetrates(a)){a.obj.rotation.y=old;alignActorToTerrain(a);}
  }
  const jointValues={},pending=previewPendingEdits.get(ownerKey),channelIds=new Set([...Object.keys(state.channels||{}),...Array.from(pending?.keys?.()||[])]);let hasJoints=false;
  channelIds.forEach(channelId=>{
    if(!channelId.startsWith('joint.')||!previewChannelActive(ownerKey,state,channelId))return;
    const key=channelId.slice(6);jointValues[key]=previewAnimatedValue(ownerKey,state,channelId,globalTime,a.joints?.[key]||0);hasJoints=true;
  });
  if(hasJoints&&a.kind==='char')Object.entries(jointValues).forEach(([key,value])=>applyPreviewJointChannel(a,key,value));
  a.obj.updateMatrixWorld(true);
}

export {
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
  applyPreviewActorAnimation
};
