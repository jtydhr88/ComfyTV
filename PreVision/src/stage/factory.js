/*
 * stage/factory.js — modeling factory (subsystem C, refactor P5, ADR-0011).
 * Procedural builders for every stage object — character (full articulated rig), car,
 * horse, prop, dog, environment pieces, desert terrain, scene boards, sprite labels —
 * plus the semantic-proxy catalog and the pose/joint system. Moved verbatim from
 * src/app.js (function bodies unchanged; Chinese comments translated to English per the
 * src/ i18n policy — recorded deviation, ADR-0011). Same bridge mechanism as P1-P4.
 *
 * Beyond the split-plan list, these internal helpers moved with the family because they
 * are referenced only by factory functions (ADR-0008 repairIndexTimes precedent):
 * mat/envMat/flatMat (material shorthands), SEMANTIC_PROXY_BY_ID, applySemanticMaterial,
 * actorRebuildData, LEGACY_RIDE_JOINT_DEFAULTS, horseRideHost, and the
 * DESERT_SIZE/DESERT_SEGMENTS/DESERT_EDGE_HEIGHT terrain constants (the remnant's
 * desert sampling helpers keep reading the latter two through the bridge globals).
 *
 * Transitional free references resolved through globals at call time only (owners
 * migrate in later stages): THREE (vendor contract global); automaticCaptureMutationBlocked
 * (export/capture, P8); cleanDimensions, buildActor, alignAllActorsToTerrain, actorByLabel
 * (stage/runtime.js, resolved through the call-time global bridge); selActorPt (app.js); actors/selected/project via the core store
 * globalThis shim (ADR-0009). P6 added true imports for environment-owned scene,
 * disposeOwnedObject3D, and assetTexture.
 */
import { normalizeEaseSpec } from '../core/timing-math.js';
import { assetTexture, disposeOwnedObject3D, scene } from './environment.js';

const STAGE_LIMIT=29.5; // usable placement range of the 60m checker ground; keeps near-horizon clicks from flinging objects hundreds of meters away
/* ============ Object factory ============ */
const mat = c => new THREE.MeshStandardMaterial({color:c, roughness:.6});
const SEMANTIC_PROXY_TYPES=[
  {id:'adult_male',kind:'char',category:'person',labelKey:'semantic.type.adultMale',color:0x2f6bff,dimensions:{width:.65,height:1.78,depth:.38}},
  {id:'adult_female',kind:'char',category:'person',labelKey:'semantic.type.adultFemale',color:0xf0445e,dimensions:{width:.58,height:1.66,depth:.34}},
  {id:'child',kind:'char',category:'person',labelKey:'semantic.type.child',color:0xffd43b,dimensions:{width:.42,height:1.2,depth:.28}},
  {id:'dog',kind:'dog',category:'animal',labelKey:'semantic.type.dog',color:0x9a6b42,dimensions:{width:.45,height:.65,depth:1.05}},
  {id:'suv',kind:'car',category:'vehicle',labelKey:'semantic.type.suv',color:0x415a68,dimensions:{width:2.1,height:1.75,depth:4.6}},
  {id:'tree_a',kind:'tree',category:'environment',labelKey:'semantic.type.treeA',color:0x5f7a4b,dimensions:{width:2.2,height:4.4,depth:2.2}},
  {id:'tree_b',kind:'tree',category:'environment',labelKey:'semantic.type.treeB',color:0x3f6f62,dimensions:{width:1.55,height:5.2,depth:1.55}},
  {id:'rock',kind:'rock',category:'environment',labelKey:'semantic.type.rock',color:0x87827a,dimensions:{width:1.4,height:.75,depth:1.1}},
  {id:'bush',kind:'bush',category:'environment',labelKey:'semantic.type.bush',color:0x5f7f4d,dimensions:{width:1.6,height:.9,depth:1.25}},
  {id:'house_block',kind:'house',category:'environment',labelKey:'semantic.type.houseBlock',color:0x8b8174,dimensions:{width:4.4,height:3.8,depth:3.5}},
  {id:'road',kind:'road',category:'environment',labelKey:'semantic.type.road',color:0x3d4147,dimensions:{width:3.8,height:.1,depth:14}}
];
const SEMANTIC_PROXY_BY_ID=new Map(SEMANTIC_PROXY_TYPES.map(t=>[t.id,t]));
function semanticProxyType(id){return typeof id==='string'?(SEMANTIC_PROXY_BY_ID.get(id)||null):null;}
function applySemanticMaterial(obj,color){
  obj.traverse(o=>{
    if(!o.isMesh||!o.material||o.userData.keepMaterial)return;
    if(o.material.color)o.material.color.setHex(color);
  });
}
function applySemanticDimensions(a){
  if(automaticCaptureMutationBlocked())return false;
  if(!a||!a.semanticType)return;
  const spec=semanticProxyType(a.semanticType);
  const dims=globalThis.cleanDimensions(a.dimensions,spec?.dimensions);
  a.dimensions=dims;
  const base=spec?.dimensions||dims;
  const authoredScale=Number.isFinite(a.authoredScale)?a.authoredScale:1;
  a.obj.scale.set(
    Math.max(.05,dims.width/base.width)*authoredScale,
    Math.max(.05,dims.height/base.height)*authoredScale,
    Math.max(.05,dims.depth/base.depth)*authoredScale
  );
  a.obj.userData.semanticDimensions=dims;
}
function setActorSemanticType(a,id,{resetDimensions=false}={}){
  if(automaticCaptureMutationBlocked())return false;
  if(!a)return;
  const spec=semanticProxyType(id);
  if(!spec)return;
  a.semanticType=spec.id;
  a.obj.userData.semanticType=spec.id;
  if(resetDimensions||!a.dimensions)a.dimensions=globalThis.cleanDimensions(spec.dimensions,spec.dimensions);
  applySemanticMaterial(a.obj,spec.color);
  applySemanticDimensions(a);
}
function actorRebuildData(a){
  if(!a)return null;
  return {kind:a.kind,label:a.label,semanticType:a.semanticType,dimensions:a.dimensions?Object.assign({},a.dimensions):undefined,
    asset:a.asset,mount:a.mount||null,pose:a.pose||'stand',joints:a.joints?Object.assign({},a.joints):undefined,
    pos:[a.obj.position.x,a.obj.position.z],rotY:a.obj.rotation.y,height:a.elev||0,scale:Number.isFinite(a.authoredScale)?a.authoredScale:a.obj.scale.x,
    pathMode:a.pathMode||'curve',pathTimes:Array.isArray(a.pathTimes)?a.pathTimes.slice():[],
    pathEase:Array.isArray(a.pathEase)?a.pathEase.map(normalizeEaseSpec):[],
    timeLink:a.timeLink||'independent',timeOffset:a.timeOffset||0,timeLinkShot:a.timeLinkShot||0,
    path:(a.pathPts||[]).map(p=>[p.x,p.z])};
}
function replaceActorSemanticType(a,id,{resetDimensions=false}={}){
  if(automaticCaptureMutationBlocked())return false;
  const spec=semanticProxyType(id);
  if(!a||!spec)return a;
  const idx=actors.indexOf(a);
  if(idx<0)return a;
  const data=actorRebuildData(a)||{};
  const previousDims=a.dimensions?Object.assign({},a.dimensions):null;
  data.kind=spec.kind;data.semanticType=spec.id;data.dimensions=resetDimensions||!previousDims?globalThis.cleanDimensions(spec.dimensions,spec.dimensions):previousDims;
  data.mount=spec.kind==='char'?data.mount:null;
  scene.remove(a.obj);disposeOwnedObject3D(a.obj);
  actors.splice(idx,1);
  const rebuilt=globalThis.buildActor(data);
  const tail=actors.indexOf(rebuilt);
  if(tail>=0){actors.splice(tail,1);actors.splice(idx,0,rebuilt);}
  selected=rebuilt;selActorPt=0;globalThis.alignAllActorsToTerrain();
  return rebuilt;
}
/* ---- Director proxy character: one category color, readable face and joint rings ---- */
function makeCharacter(color=0x2f6bff,semanticType='adult_male'){
  const g=new THREE.Group();
  const spec=semanticProxyType(semanticType)||semanticProxyType('adult_male');
  const primary=mat(color),featureMat=mat(0x121826),whiteMat=mat(0xffffff);
  const keep=mesh=>{mesh.userData.keepMaterial=true;return mesh;};
  const jointRing=(name,radius,colorMaterial=featureMat)=>{
    const ring=keep(new THREE.Mesh(new THREE.TorusGeometry(radius,.012,6,14),colorMaterial));ring.name=name;return ring;
  };
  const body=new THREE.Group();body.name='bodyRoot';g.add(body);   // whole-figure transforms (lie down / crouch lowering) act on body
  const rig={body};
  const pelvis=new THREE.Mesh(new THREE.CylinderGeometry(.155,.135,.22,8),primary);pelvis.name='pelvis';
  pelvis.position.y=1.0; pelvis.castShadow=true; body.add(pelvis);
  const belt=keep(new THREE.Mesh(new THREE.CylinderGeometry(.153,.153,.035,10),featureMat));belt.name='waistMarker';belt.position.y=1.085;body.add(belt);
  /* waist (spine pivot) -> ribcage/neck/head/both arms all hang off the waist */
  const spine=new THREE.Group();spine.name='spine';spine.position.y=1.06;body.add(spine);rig.spine=spine;
  const chest=new THREE.Mesh(new THREE.CylinderGeometry(.185,.14,.5,8),primary);chest.name='torso';
  chest.position.y=.28; chest.castShadow=true; spine.add(chest);
  const shoulderLine=new THREE.Mesh(new THREE.BoxGeometry(.37,.075,.17),primary);shoulderLine.name='shoulderLine';shoulderLine.position.y=.48;spine.add(shoulderLine);
  const forward=keep(new THREE.Mesh(new THREE.ConeGeometry(.055,.11,3),whiteMat));forward.name='torsoForwardMarker';forward.position.set(0,.31,.151);forward.rotation.x=Math.PI/2;spine.add(forward);
  const neck=new THREE.Group();neck.name='neck';neck.position.y=.54;spine.add(neck);rig.neck=neck;
  const neckM=new THREE.Mesh(new THREE.CylinderGeometry(.05,.06,.1,7),primary);neckM.name='neckMesh';neckM.position.y=.04;neck.add(neckM);
  const head=new THREE.Mesh(new THREE.SphereGeometry(.12,12,9),primary);
  head.name='head'; head.position.y=.17; head.scale.y=1.15; head.castShadow=true; neck.add(head);
  /* Facial features stay under neck; local +Z remains the readable forward axis. */
  const face=new THREE.Group(); face.name='face'; neck.add(face);
  const named=(mesh,name)=>{keep(mesh);mesh.name=name;face.add(mesh);return mesh;};
  const eye=(side,name)=>{
    const white=named(new THREE.Mesh(new THREE.SphereGeometry(.031,10,7),whiteMat),name);
    white.position.set(side*.047,.198,.106);white.scale.set(1.08,.68,.48);
    const pupil=named(new THREE.Mesh(new THREE.SphereGeometry(.012,8,6),featureMat),name==='eyeL'?'pupilL':'pupilR');
    pupil.position.set(side*.047,.198,.127);pupil.scale.set(.92,1,.52);
    const brow=named(new THREE.Mesh(new THREE.BoxGeometry(.058,.012,.01),featureMat),name==='eyeL'?'browL':'browR');
    brow.position.set(side*.049,.238,.116);brow.rotation.z=side*.1;
    return {white,pupil,brow};
  };
  eye(-1,'eyeL');eye(1,'eyeR');
  const nose=named(new THREE.Mesh(new THREE.ConeGeometry(.021,.07,6),featureMat),'nose');nose.position.set(0,.163,.143);nose.rotation.x=Math.PI/2;
  const mouth=named(new THREE.Mesh(new THREE.BoxGeometry(.072,.014,.011),featureMat),'mouth');mouth.position.set(0,.119,.126);
  const earL=named(new THREE.Mesh(new THREE.SphereGeometry(.029,8,6),featureMat),'earL');earL.position.set(-.124,.17,0);earL.scale.set(.58,1,.45);
  const earR=named(earL.clone(),'earR');earR.position.x=.122;
  /* Arm chain: shoulder -> upper arm -> elbow -> forearm -> wrist -> hand. */
  const arm=side=>{ const s=side==='L'?-1:1;
    const suffix=side==='L'?'L':'R',sh=new THREE.Group();sh.name=`shoulder${suffix}`;sh.position.set(s*.225,.48,0);spine.add(sh);
    const shoulderBall=new THREE.Mesh(new THREE.SphereGeometry(.074,8,7),primary);shoulderBall.name=`shoulderBall${suffix}`;sh.add(shoulderBall);
    sh.add(jointRing(`shoulderMarker${suffix}`,.078,whiteMat));
    const up=new THREE.Mesh(new THREE.CylinderGeometry(.057,.05,.3,7),primary);up.name=`upperArm${suffix}`;up.position.y=-.17;up.castShadow=true;sh.add(up);
    const el=new THREE.Group();el.name=`elbow${suffix}`;el.position.y=-.33;sh.add(el);
    const elbowBall=new THREE.Mesh(new THREE.SphereGeometry(.054,8,7),primary);elbowBall.name=`elbowBall${suffix}`;el.add(elbowBall);
    el.add(jointRing(`elbowMarker${suffix}`,.057));
    const fo=new THREE.Mesh(new THREE.CylinderGeometry(.047,.042,.27,7),primary);fo.name=`forearm${suffix}`;fo.position.y=-.155;fo.castShadow=true;el.add(fo);
    const wrist=new THREE.Group();wrist.name=`wrist${suffix}`;wrist.position.y=-.29;el.add(wrist);
    const wristBall=new THREE.Mesh(new THREE.SphereGeometry(.042,8,7),primary);wristBall.name=`wristBall${suffix}`;wrist.add(wristBall);
    wrist.add(jointRing(`wristMarker${suffix}`,.045,whiteMat));
    const hand=new THREE.Mesh(new THREE.SphereGeometry(.052,8,7),primary);hand.name=`hand${suffix}`;hand.position.y=-.03;hand.scale.set(.8,1.25,.8);wrist.add(hand);
    return {sh,el,wrist};
  };
  const aL=arm('L'), aR=arm('R');
  rig.shL=aL.sh; rig.elL=aL.el; rig.wristL=aL.wrist;
  rig.shR=aR.sh; rig.elR=aR.el; rig.wristR=aR.wrist;
  /* Leg chain: hip -> thigh -> knee -> lower leg -> ankle -> foot. */
  const leg=side=>{ const s=side==='L'?-1:1;
    const suffix=side==='L'?'L':'R',hip=new THREE.Group();hip.name=`hip${suffix}`;hip.position.set(s*.10,.98,0);body.add(hip);
    const hipBall=new THREE.Mesh(new THREE.SphereGeometry(.072,8,7),primary);hipBall.name=`hipBall${suffix}`;hip.add(hipBall);
    hip.add(jointRing(`hipMarker${suffix}`,.075));
    const th=new THREE.Mesh(new THREE.CylinderGeometry(.075,.06,.46,7),primary);th.name=`thigh${suffix}`;th.position.y=-.25;th.castShadow=true;hip.add(th);
    const kn=new THREE.Group();kn.name=`knee${suffix}`;kn.position.y=-.48;hip.add(kn);
    const kneeBall=new THREE.Mesh(new THREE.SphereGeometry(.064,8,7),primary);kneeBall.name=`kneeBall${suffix}`;kn.add(kneeBall);
    kn.add(jointRing(`kneeMarker${suffix}`,.067,whiteMat));
    const ca=new THREE.Mesh(new THREE.CylinderGeometry(.057,.044,.42,7),primary);ca.name=`lowerLeg${suffix}`;ca.position.y=-.23;ca.castShadow=true;kn.add(ca);
    const ankle=new THREE.Group();ankle.name=`ankle${suffix}`;ankle.position.y=-.43;kn.add(ankle);
    const ankleBall=new THREE.Mesh(new THREE.SphereGeometry(.045,8,7),primary);ankleBall.name=`ankleBall${suffix}`;ankle.add(ankleBall);
    ankle.add(jointRing(`ankleMarker${suffix}`,.048));
    const ft=new THREE.Mesh(new THREE.BoxGeometry(.105,.078,.25),primary);ft.name=`foot${suffix}`;ft.position.set(0,-.0325,.065);ft.castShadow=true;ankle.add(ft);
    return {hip,kn,ankle};
  };
  const lL=leg('L'), lR=leg('R');
  rig.hipL=lL.hip; rig.kneeL=lL.kn; rig.ankleL=lL.ankle;
  rig.hipR=lR.hip; rig.kneeR=lR.kn; rig.ankleR=lR.ankle;
  if(spec.id==='adult_female'){
    shoulderLine.scale.x=.9;
    [rig.shL,rig.shR].forEach(sh=>{sh.position.x*=.9;});
  }else if(spec.id==='child'){
    head.scale.multiplyScalar(1.28);face.scale.setScalar(1.25);
    shoulderLine.scale.x=.78;
    [rig.shL,rig.shR].forEach(sh=>{sh.position.x*=.8;sh.scale.y=.84;});
    [rig.hipL,rig.hipR].forEach(hip=>{hip.position.x*=.88;hip.scale.y=.78;});
  }
  g.updateMatrixWorld(true);
  const rawBounds=new THREE.Box3().setFromObject(body),rawSize=rawBounds.getSize(new THREE.Vector3());
  body.scale.set(spec.dimensions.width/rawSize.x,spec.dimensions.height/rawSize.y,spec.dimensions.depth/rawSize.z);
  g.userData.semanticType=spec.id;
  g.userData.labelY=spec.dimensions.height+.3;
  g.userData.lockTargetY=spec.dimensions.height*.62;
  g.userData.rig=rig;
  g.userData.face=face;
  g.userData.parts={body,torso:chest,pelvis,head,face,forward};
  g.userData.proxyProfile={semanticType:spec.id,color:spec.color,dimensions:Object.assign({},spec.dimensions)};
  g.userData.limbs={legL:rig.hipL,legR:rig.hipR,armL:rig.shL,armR:rig.shR}; // legacy reference aliases
  return g;
}
/* ---- Pose system: presets = joint-angle combos, manual tweaks = custom ---- */
const POSE_LABEL_KEYS={stand:'actor.pose.label.stand',sit:'actor.pose.label.sit',crouch:'actor.pose.label.crouch',lie:'actor.pose.label.lie',ride:'actor.pose.label.ride',custom:'actor.pose.label.custom'};
/* Joint angles in degrees; bodyY = whole-figure lift (m), bodyRotX = whole-figure tip-over (deg) */
const POSE_JOINTS={
  stand:{},
  sit:{bodyY:-.75, spineX:8, hipLX:-84, hipRX:-84, kneeL:22, kneeR:22, shLX:-20, shRX:-20, elL:-30, elR:-30},
  crouch:{bodyY:-.55, spineX:42, hipLX:-100, hipRX:-100, kneeL:125, kneeR:125, shLX:-40, shRX:-40, elL:-60, elR:-60},
  lie:{bodyRotX:-90, bodyY:.14},
  /* Ride: wide hip abduction drops both knees to the horse's flanks so thighs don't cut through the body; shins fall roughly vertical */
  ride:{bodyY:-.92, spineX:6, hipLX:-55, hipRX:-55, hipLZ:-42, hipRZ:42, kneeL:70, kneeR:70, shLX:-32, shRX:-32, elL:-55, elR:-55},
};
const HORSE_RIDE_JOINTS=Object.assign({},POSE_JOINTS.ride,{bodyY:-.82,hipLZ:-46,hipRZ:46,kneeL:72,kneeR:72});
const SEAHORSE_RIDE_JOINTS=Object.assign({},POSE_JOINTS.ride,{
  bodyY:-.84,spineX:5,
  hipLX:-50,hipRX:-50,hipLZ:-49,hipRZ:49,
  kneeL:82,kneeR:82,ankleLX:-12,ankleRX:-12,
  shLX:-34,shRX:-34,elL:-62,elR:-62
});
const SEAHORSE_SCALE_MIN=.85,SEAHORSE_SCALE_MAX=1.15;
const LEGACY_RIDE_JOINT_DEFAULTS={bodyY:-.92,hipLZ:-42,hipRZ:42,kneeL:70,kneeR:70};
function horseRideHost(a){return a&&a.mount?globalThis.actorByLabel(a.mount):null;}
function migrateHorseRideJoints(a){
  const host=horseRideHost(a);
  if(!a||a.kind!=='char'||a.pose!=='ride'||host?.kind!=='horse'||!a.joints)return false;
  let changed=false;
  Object.entries(LEGACY_RIDE_JOINT_DEFAULTS).forEach(([key,legacy])=>{
    if(Number.isFinite(a.joints[key])&&Math.abs(a.joints[key]-legacy)<.001){a.joints[key]=HORSE_RIDE_JOINTS[key];changed=true;}
  });
  return changed;
}
function migrateSeahorseRideJoints(a){
  const host=horseRideHost(a);
  if(!a||a.kind!=='char'||a.pose!=='ride'||host?.kind!=='seahorse'||!a.joints)return false;
  const isGeneric=Object.entries(POSE_JOINTS.ride).every(([key,legacy])=>Math.abs((Number.isFinite(a.joints[key])?a.joints[key]:0)-legacy)<.001);
  if(isGeneric){a.joints=Object.assign({},a.joints,SEAHORSE_RIDE_JOINTS);return true;}
  let changed=false;
  Object.entries(POSE_JOINTS.ride).forEach(([key,legacy])=>{
    if(Number.isFinite(a.joints[key])&&Math.abs(a.joints[key]-legacy)<.001&&SEAHORSE_RIDE_JOINTS[key]!==legacy){
      a.joints[key]=SEAHORSE_RIDE_JOINTS[key];changed=true;
    }
  });
  return changed;
}
function applyJoints(a){
  if(a.kind!=='char'||!a.obj.userData.rig) return;
  const r=a.obj.userData.rig, j=a.joints||{}, d=Math.PI/180;
  r.body.position.y=j.bodyY||0;
  r.body.rotation.x=(j.bodyRotX||0)*d;
  r.neck.rotation.set((j.neckX||0)*d,(j.neckY||0)*d,0);
  r.spine.rotation.set((j.spineX||0)*d,(j.spineY||0)*d,(j.spineZ||0)*d);
  r.shL.rotation.set((j.shLX||0)*d,0,(j.shLZ||0)*d);
  r.shR.rotation.set((j.shRX||0)*d,0,(j.shRZ||0)*d);
  r.elL.rotation.x=(j.elL||0)*d;  r.elR.rotation.x=(j.elR||0)*d;
  r.wristL.rotation.set((j.wristLX||0)*d,0,(j.wristLZ||0)*d);
  r.wristR.rotation.set((j.wristRX||0)*d,0,(j.wristRZ||0)*d);
  r.hipL.rotation.set((j.hipLX||0)*d, 0, (j.hipLZ||0)*d);
  r.hipR.rotation.set((j.hipRX||0)*d, 0, (j.hipRZ||0)*d);
  r.kneeL.rotation.x=(j.kneeL||0)*d; r.kneeR.rotation.x=(j.kneeR||0)*d;
  r.ankleL.rotation.set((j.ankleLX||0)*d,0,(j.ankleLZ||0)*d);
  r.ankleR.rotation.set((j.ankleRX||0)*d,0,(j.ankleRZ||0)*d);
}
function applyPose(a){
  if(automaticCaptureMutationBlocked())return false;
  if(a.kind!=='char') return;
  const hostKind=a.pose==='ride'?horseRideHost(a)?.kind:null;
  const preset=hostKind==='horse'?HORSE_RIDE_JOINTS:hostKind==='seahorse'?SEAHORSE_RIDE_JOINTS:POSE_JOINTS[a.pose];
  if(preset) a.joints=Object.assign({},preset);
  applyJoints(a);
}
function makeCar(){
  const g=new THREE.Group(); const m=mat(0xe8e8e8), dk=mat(0x24272c);
  /* Body layering: chassis skirt + body + cabin */
  const chassis=new THREE.Mesh(new THREE.BoxGeometry(4.3,.42,1.8),m); chassis.position.y=.55; chassis.castShadow=true;
  const bodyM=new THREE.Mesh(new THREE.BoxGeometry(4.3,.46,1.76),m); bodyM.position.y=.99; bodyM.castShadow=true;
  const cabin=new THREE.Mesh(new THREE.BoxGeometry(2.05,.58,1.66),m); cabin.position.set(-.25,1.5,0); cabin.castShadow=true;
  /* Front/rear windshields (slanted) + dark side-window band */
  const winF=new THREE.Mesh(new THREE.BoxGeometry(.06,.6,1.56),dk); winF.position.set(.85,1.46,0); winF.rotation.z=.42;
  const winB=new THREE.Mesh(new THREE.BoxGeometry(.06,.58,1.56),dk); winB.position.set(-1.36,1.46,0); winB.rotation.z=-.5;
  const winS=new THREE.Mesh(new THREE.BoxGeometry(1.9,.4,1.7),dk); winS.position.set(-.25,1.52,0);
  /* Bumpers + lights */
  const bpF=new THREE.Mesh(new THREE.BoxGeometry(.22,.26,1.86),dk); bpF.position.set(2.18,.52,0);
  const bpB=new THREE.Mesh(new THREE.BoxGeometry(.22,.26,1.86),dk); bpB.position.set(-2.18,.52,0);
  const lampL=new THREE.Mesh(new THREE.BoxGeometry(.08,.13,.34),mat(0xf2ecc8)); lampL.name='headlightL';lampL.position.set(2.16,1.02,.6);
  const lampR=lampL.clone(); lampR.name='headlightR';lampR.position.z=-.6;
  const grille=new THREE.Mesh(new THREE.BoxGeometry(.07,.23,.8),dk);grille.name='frontGrille';grille.position.set(2.295,.8,0);
  const tailL=new THREE.Mesh(new THREE.BoxGeometry(.08,.15,.3),mat(0xb3312c));tailL.name='tailLightL';tailL.position.set(-2.17,1.02,.62);
  const tailR=tailL.clone();tailR.name='tailLightR';tailR.position.z=-.62;
  const mirror=(z,name)=>{const x=new THREE.Mesh(new THREE.BoxGeometry(.18,.1,.08),dk);x.name=name;x.position.set(.52,1.55,z);return x;};
  const mirrorL=mirror(.91,'mirrorL'),mirrorR=mirror(-.91,'mirrorR');
  g.add(chassis,bodyM,cabin,winF,winB,winS,bpF,bpB,lampL,lampR,grille,tailL,tailR,mirrorL,mirrorR);
  /* Tires + hubs */
  [[-1.42,.38,.92],[1.42,.38,.92],[-1.42,.38,-.92],[1.42,.38,-.92]].forEach(p=>{
    const tire=new THREE.Mesh(new THREE.CylinderGeometry(.37,.37,.24,16),dk);
    tire.rotation.x=Math.PI/2; tire.position.set(...p); tire.castShadow=true; g.add(tire);
    const hub=new THREE.Mesh(new THREE.CylinderGeometry(.19,.19,.26,10),mat(0x9a9a9a));
    hub.rotation.x=Math.PI/2; hub.position.set(...p); g.add(hub);
  });
  g.userData.carParts={grille,mirrors:[mirrorL,mirrorR],tailLights:[tailL,tailR],headlights:[lampL,lampR]};
  return g;
}
/* Horse: quadruped mount, seatY = saddle height (used by the mount system), diagonal gait prevents foot sliding */
function makeHorse(){
  const g=new THREE.Group();
  const coat=new THREE.MeshStandardMaterial({color:0xf5f5f2,roughness:.9,metalness:0}), coatShade=new THREE.MeshStandardMaterial({color:0xe8e6df,roughness:.92,metalness:0}), maneMat=new THREE.MeshStandardMaterial({color:0x77736d,roughness:.95,side:THREE.DoubleSide}), hoofMat=mat(0x292827), tackMat=mat(0x4f3527), blanketMat=mat(0x756b5c), eyeMat=mat(0x111214), muzzleMat=mat(0xc8c4bc);
  coat.userData.selectionEmissive=0x17100d;coatShade.userData.selectionEmissive=0x17100d;muzzleMat.userData.selectionEmissive=0x17100d;
  const named=(mesh,name,parent=g)=>{mesh.name=name;if(mesh.isMesh){mesh.castShadow=true;mesh.receiveShadow=true;}parent.add(mesh);return mesh;};
  const ellipsoid=(name,pos,scale,material=coat,parent=g)=>{
    const mesh=named(new THREE.Mesh(new THREE.SphereGeometry(.5,24,18),material),name,parent);
    mesh.position.set(...pos);mesh.scale.set(...scale);return mesh;
  };
  const ringForm=(name,rings,pos,scale,material=coat,parent=g)=>{
    const sides=24,verts=[],indices=[];
    rings.forEach(r=>{for(let i=0;i<sides;i++){const a=i/sides*Math.PI*2;verts.push(Math.cos(a)*r.rx,r.y+Math.sin(a)*r.ry,r.z);}});
    for(let r=0;r<rings.length-1;r++)for(let i=0;i<sides;i++){
      const a=r*sides+i,b=r*sides+(i+1)%sides,c=(r+1)*sides+i,d=(r+1)*sides+(i+1)%sides;
      indices.push(a,b,c,b,d,c);
    }
    const rear=verts.length/3,front=rear+1;verts.push(0,rings[0].y,rings[0].z,0,rings[rings.length-1].y,rings[rings.length-1].z);
    for(let i=0;i<sides;i++){const n=(i+1)%sides;indices.push(rear,n,i,front,(rings.length-1)*sides+i,(rings.length-1)*sides+n);}
    const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(verts,3));geo.setIndex(indices);geo.computeVertexNormals();
    const mesh=named(new THREE.Mesh(geo,material),name,parent);mesh.position.set(...pos);mesh.scale.set(...scale);return mesh;
  };
  const body=ringForm('horseBody',[
    {z:-.52,y:.03,rx:.18,ry:.24},{z:-.42,y:.04,rx:.48,ry:.48},{z:-.22,y:.03,rx:.5,ry:.5},{z:0,y:0,rx:.46,ry:.46},
    {z:.22,y:.02,rx:.42,ry:.47},{z:.39,y:.05,rx:.43,ry:.52},{z:.52,y:.02,rx:.22,ry:.3}
  ],[0,1.23,-.05],[.76,.7,1.95]);
  const chest=ellipsoid('horseChest',[0,1.21,.72],[.48,.55,.3],coatShade);
  const rump=ellipsoid('horseRump',[0,1.24,-.78],[.54,.56,.34],coatShade);
  const withers=ellipsoid('horseWithers',[0,1.5,.42],[.5,.25,.38],coatShade);
  const shoulders=[-1,1].map((side,i)=>{const m=ellipsoid('horseShoulder'+i,[side*.27,1.21,.57],[.24,.58,.38],coatShade);m.rotation.x=-.18;return m;});
  const haunches=[-1,1].map((side,i)=>{const m=ellipsoid('horseHaunch'+i,[side*.28,1.21,-.67],[.27,.62,.42],coatShade);m.rotation.x=.14;return m;});
  const neck=named(new THREE.Mesh(new THREE.CylinderGeometry(.13,.24,.9,16),coat),'horseNeck');neck.position.set(0,1.68,.7);neck.rotation.x=.72;neck.scale.x=.88;
  const upperNeck=named(new THREE.Mesh(new THREE.CylinderGeometry(.08,.15,.62,16),coatShade),'horseUpperNeck');upperNeck.position.set(0,2,1.05);upperNeck.rotation.x=.45;upperNeck.scale.x=.86;
  const headRig=new THREE.Group();headRig.name='horseHeadRig';headRig.position.set(0,2.12,1.5);headRig.rotation.x=.14;g.add(headRig);
  const head=ringForm('horseHead',[
    {z:-.5,y:.08,rx:.32,ry:.34},{z:-.28,y:.05,rx:.48,ry:.48},{z:0,y:0,rx:.38,ry:.4},{z:.28,y:-.04,rx:.29,ry:.29},{z:.5,y:-.08,rx:.31,ry:.24}
  ],[0,0,0],[.31,.33,.74],coat,headRig);
  const cheek=ellipsoid('horseCheek',[0,0,-.23],[.23,.25,.22],coatShade,headRig);
  const jaw=ellipsoid('horseJaw',[0,-.12,.14],[.15,.1,.22],muzzleMat,headRig);
  const muzzle=ellipsoid('horseMuzzle',[0,-.08,.38],[.18,.12,.22],muzzleMat,headRig);muzzle.rotation.x=-.03;
  const ear=(x,name,tilt)=>{const e=named(new THREE.Mesh(new THREE.ConeGeometry(.02,.17,8),coatShade),name,headRig);e.position.set(x,.25,-.24);e.rotation.set(-.12,0,tilt);return e;};
  const earL=ear(-.065,'horseEarL',-.1),earR=ear(.065,'horseEarR',.1);
  const eye=(x,name)=>{const e=named(new THREE.Mesh(new THREE.SphereGeometry(.0075,10,8),eyeMat),name,headRig);e.position.set(x,.07,-.02);e.scale.set(.72,1,.45);return e;};
  const eyeL=eye(-.124,'horseEyeL'),eyeR=eye(.124,'horseEyeR');
  const nostril=(x,name)=>{const n=named(new THREE.Mesh(new THREE.SphereGeometry(.0055,9,6),eyeMat),name,headRig);n.position.set(x,-.06,.49);n.scale.set(1.3,.65,.38);return n;};
  const nostrilL=nostril(-.064,'horseNostrilL'),nostrilR=nostril(.064,'horseNostrilR');
  const maneSection=(i,y0,z0,y1,z1)=>{
    const geo=new THREE.BufferGeometry(),verts=new Float32Array([0,y0,z0, 0,y1,z1, 0,y1+.015,z1-.105, 0,y0+.015,z0-.085]);
    geo.setAttribute('position',new THREE.BufferAttribute(verts,3));geo.setIndex([0,1,2,0,2,3]);geo.computeVertexNormals();
    return named(new THREE.Mesh(geo,maneMat),'horseMane'+i);
  };
  const mane=[maneSection(0,1.4,.38,1.64,.52),maneSection(1,1.62,.53,1.87,.71),maneSection(2,1.85,.72,2.08,.9),maneSection(3,2.06,.91,2.25,1.08)];
  const tailTube=(name,points,radius)=>named(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p))),12,radius,7,false),maneMat),name);
  const tailStem=tailTube('horseTailStem',[[0,1.29,-1.03],[0,1.16,-1.16],[-.015,1.01,-1.25]],.033);
  const tailMid=tailTube('horseTailMid',[[-.015,1.02,-1.25],[.015,.83,-1.34],[.035,.63,-1.38]],.043);
  const tailTuft=tailTube('horseTailTuft',[[.035,.64,-1.38],[0,.42,-1.4],[-.04,.22,-1.34]],.056);
  /* Low-profile saddle follows the back instead of floating as a thick oval platform. */
  const saddleBlanket=ellipsoid('horseSaddleBlanket',[0,1.525,-.07],[.55,.03,.58],blanketMat);
  const saddle=ellipsoid('horseSaddle',[0,1.555,-.04],[.38,.04,.42],tackMat);
  const saddlePommel=ellipsoid('horseSaddlePommel',[0,1.575,.16],[.24,.035,.06],tackMat);
  const saddleCantle=ellipsoid('horseSaddleCantle',[0,1.58,-.25],[.26,.04,.065],tackMat);
  const bridle=named(new THREE.Mesh(new THREE.TorusGeometry(.075,.006,7,24),tackMat),'horseBridle',headRig);bridle.position.set(0,-.07,.4);bridle.scale.set(.72,.66,1);
  const bit=named(new THREE.Mesh(new THREE.CylinderGeometry(.008,.008,.24,8),tackMat),'horseBit',headRig);bit.position.set(0,-.115,.32);bit.rotation.z=Math.PI/2;
  const axisY=new THREE.Vector3(0,1,0);
  const segment=(parent,a,b,ra,rb,name)=>{
    const delta=b.clone().sub(a),mesh=named(new THREE.Mesh(new THREE.CylinderGeometry(ra,rb,delta.length(),8),coat),name,parent);
    mesh.position.copy(a).add(b).multiplyScalar(.5);mesh.quaternion.setFromUnitVectors(axisY,delta.normalize());return mesh;
  };
  const joint=(parent,p,r,name)=>{const j=named(new THREE.Mesh(new THREE.SphereGeometry(r,10,8),coatShade),name,parent);j.position.copy(p);j.scale.set(1,.55,.72);return j;};
  const leg=(key,x,z,hind=false)=>{
    const root=new THREE.Group();root.name='horseLeg'+key;root.position.set(x,1.3,z);g.add(root);
    const V=(x,y,z)=>new THREE.Vector3(x,y,z);
    const points=hind?[V(0,0,0),V(0,-.34,.14),V(0,-.72,-.14),V(0,-1,-.1),V(0,-1.205,.07)]:[V(0,0,0),V(0,-.42,-.03),V(0,-.88,.015),V(0,-1.205,.075)];
    const radii=hind?[[.09,.065],[.061,.042],[.041,.027],[.028,.02]]:[[.068,.052],[.047,.03],[.029,.02]];
    const segments=points.slice(1).map((p,i)=>segment(root,points[i],p,radii[i][0],radii[i][1],'horseBone'+key+i));
    const joints=points.slice(1,-1).map((p,i)=>joint(root,p,hind?(i===0?.055:i===1?.04:.028):(i===0?.04:.028),'horseJoint'+key+i));
    const hoof=named(new THREE.Mesh(new THREE.CylinderGeometry(.055,.073,.1,8),hoofMat),'horseHoof'+key,root);hoof.position.set(0,-1.242,.095);hoof.rotation.x=-.06;hoof.scale.z=1.45;
    return {root,segments,joints,hoof};
  };
  const FL=leg('FL',-.25,.63),FR=leg('FR',.25,.63),BL=leg('BL',-.26,-.67,true),BR=leg('BR',.26,-.67,true);
  g.userData.horseLegs={FL:FL.root,FR:FR.root,BL:BL.root,BR:BR.root};
  g.userData.seatY=1.555; g.userData.seatZ=-.05;
  g.userData.horseParts={coat:body,chest,rump,withers,shoulders,haunches,neck,upperNeck,headRig,head,cheek,jaw,muzzle,ears:[earL,earR],eyes:[eyeL,eyeR],nostrils:[nostrilL,nostrilR],mane,tail:[tailStem,tailMid,tailTuft],saddle,saddleBlanket,saddlePommel,saddleCantle,bridle,bit,hooves:[FL.hoof,FR.hoof,BL.hoof,BR.hoof],legSegments:{FL:FL.segments,FR:FR.segments,BL:BL.segments,BR:BR.segments}};
  return g;
}
/* Seahorse: upright rideable silhouette with its own anchor and pose contract.
   It intentionally has no horseLegs alias, so the quadruped gait can never leak in. */
function makeSeahorse(){
  const g=new THREE.Group();
  const shell=new THREE.MeshStandardMaterial({color:0xb8aa7b,roughness:.82,metalness:.08,flatShading:true});
  const shellDark=new THREE.MeshStandardMaterial({color:0x756b51,roughness:.88,metalness:.04,flatShading:true});
  const ridgeMat=new THREE.MeshStandardMaterial({color:0xd2c38f,roughness:.78,metalness:.1,flatShading:true});
  const tackMat=new THREE.MeshStandardMaterial({color:0x513620,roughness:.72,metalness:.05});
  const tackMetal=new THREE.MeshStandardMaterial({color:0xb18138,roughness:.38,metalness:.55});
  const eyeMat=mat(0x111214);
  const named=(obj,name,parent=g)=>{obj.name=name;if(obj.isMesh){obj.castShadow=true;obj.receiveShadow=true;}parent.add(obj);return obj;};
  const ellipsoid=(name,pos,scale,material=shell,parent=g)=>{
    const mesh=named(new THREE.Mesh(new THREE.SphereGeometry(.5,18,14),material),name,parent);
    mesh.position.set(...pos);mesh.scale.set(...scale);return mesh;
  };
  const body=ellipsoid('seahorseBody',[0,1.32,-.02],[.94,1.35,.78]);
  const chest=ellipsoid('seahorseChest',[0,1.62,.17],[.68,.82,.6],ridgeMat);
  const neckCurve=new THREE.CatmullRomCurve3([
    new THREE.Vector3(0,1.58,.12),new THREE.Vector3(0,1.86,.22),
    new THREE.Vector3(0,2.12,.32),new THREE.Vector3(0,2.28,.42)
  ]);
  const neck=named(new THREE.Mesh(new THREE.TubeGeometry(neckCurve,18,.23,10,false),shell),'seahorseNeck');
  const head=ellipsoid('seahorseHead',[0,2.34,.48],[.42,.48,.48],shell);
  const cheek=ellipsoid('seahorseCheek',[0,2.27,.55],[.34,.3,.36],ridgeMat);
  const snout=named(new THREE.Mesh(new THREE.CylinderGeometry(.055,.105,.78,12),shell),'seahorseSnout');
  snout.position.set(0,2.22,.88);snout.rotation.x=Math.PI/2;
  const muzzle=ellipsoid('seahorseMuzzle',[0,2.22,1.27],[.15,.12,.18],shellDark);
  const eye=(x,name)=>{
    const socket=ellipsoid(name+'Socket',[x,2.4,.66],[.15,.15,.12],ridgeMat);
    const pupil=ellipsoid(name,[x*1.08,2.405,.72],[.052,.065,.04],eyeMat);
    return {socket,pupil};
  };
  const eyeL=eye(-.16,'seahorseEyeL'),eyeR=eye(.16,'seahorseEyeR');
  const tailCurve=new THREE.CatmullRomCurve3([
    new THREE.Vector3(0,1.08,-.18),new THREE.Vector3(0,.78,-.43),
    new THREE.Vector3(0,.38,-.65),new THREE.Vector3(0,.16,-.49),
    new THREE.Vector3(0,.16,-.18),new THREE.Vector3(0,.34,-.08),
    new THREE.Vector3(0,.47,-.25)
  ]);
  const tail=named(new THREE.Mesh(new THREE.TubeGeometry(tailCurve,30,.11,9,false),shell),'seahorseCurledTail');
  const finGeo=new THREE.BufferGeometry();
  finGeo.setAttribute('position',new THREE.Float32BufferAttribute([
    0,1.24,-.39, -.47,1.18,-.55, 0,1.77,-.47,
    0,1.24,-.39, 0,1.77,-.47, .47,1.18,-.55
  ],3));
  finGeo.computeVertexNormals();
  const dorsalFin=named(new THREE.Mesh(finGeo,new THREE.MeshStandardMaterial({color:0x9bb1a2,roughness:.55,transparent:true,opacity:.82,side:THREE.DoubleSide})),'seahorseDorsalFin');
  const armorPlates=[];
  [
    [1.04,-.12,.42,.82],[1.25,-.04,.47,.9],[1.46,.05,.45,.88],
    [1.72,.16,.34,.78],[1.94,.26,.28,.7],[2.14,.35,.23,.62]
  ].forEach(([y,z,r,s],i)=>{
    const plate=named(new THREE.Mesh(new THREE.TorusGeometry(r,.035,7,18),ridgeMat),'seahorseArmorPlate'+i);
    plate.position.set(0,y,z);plate.scale.set(s,1,1);armorPlates.push(plate);
  });
  const spines=[];
  [[1.03,-.46,.2],[1.32,-.48,.24],[1.62,-.43,.22],[1.91,.02,.18],[2.15,.19,.15],[2.45,.34,.14]].forEach(([y,z,len],i)=>{
    const spine=named(new THREE.Mesh(new THREE.ConeGeometry(.055,len,7),ridgeMat),'seahorseSpine'+i);
    spine.position.set(0,y,z-len*.35);spine.rotation.x=-Math.PI/2;spines.push(spine);
  });
  const saddleBlanket=named(new THREE.Mesh(new THREE.BoxGeometry(.92,.075,.68),shellDark),'seahorseSaddleBlanket');
  saddleBlanket.position.set(0,1.73,-.01);
  const saddle=named(new THREE.Mesh(new THREE.BoxGeometry(.72,.11,.52),tackMat),'seahorseSaddle');
  saddle.position.set(0,1.79,.01);
  const pommel=named(new THREE.Mesh(new THREE.BoxGeometry(.7,.2,.09),tackMat),'seahorseSaddlePommel');
  pommel.position.set(0,1.88,.23);pommel.rotation.x=-.18;
  const chestBand=named(new THREE.Mesh(new THREE.TorusGeometry(.49,.042,8,24),tackMat),'seahorseChestBand');
  chestBand.position.set(0,1.47,.11);chestBand.rotation.x=Math.PI/2;chestBand.scale.z=.78;
  const axisY=new THREE.Vector3(0,1,0);
  const strapSegment=(a,b,name)=>{
    const delta=b.clone().sub(a);
    const mesh=named(new THREE.Mesh(new THREE.CylinderGeometry(.018,.018,delta.length(),7),tackMat),name);
    mesh.position.copy(a).add(b).multiplyScalar(.5);mesh.quaternion.setFromUnitVectors(axisY,delta.normalize());return mesh;
  };
  const stirrups=[];
  [-1,1].forEach((side,i)=>{
    const top=new THREE.Vector3(side*.37,1.76,.02),bottom=new THREE.Vector3(side*.55,.94,.05);
    const strap=strapSegment(top,bottom,'seahorseStirrupStrap'+i);
    const ring=named(new THREE.Mesh(new THREE.TorusGeometry(.12,.018,7,18),tackMetal),'seahorseStirrup'+i);
    ring.position.copy(bottom);ring.scale.set(.72,1,1);stirrups.push({strap,ring});
  });
  const bridle=named(new THREE.Mesh(new THREE.TorusGeometry(.13,.018,7,20),tackMat),'seahorseBridle');
  bridle.position.set(0,2.23,1.08);bridle.scale.set(.7,.78,1);
  const mountAnchor=new THREE.Object3D();mountAnchor.name='seahorseMountAnchor';mountAnchor.position.set(0,1.83,.01);g.add(mountAnchor);
  g.userData.mountAnchor=mountAnchor;
  g.userData.seatY=1.83;g.userData.seatZ=.01;
  g.userData.supportedScaleMin=SEAHORSE_SCALE_MIN;g.userData.supportedScaleMax=SEAHORSE_SCALE_MAX;
  g.userData.collisionBounds={min:[-.62,.08,-.76],max:[.62,2.58,1.36]};
  g.userData.labelY=3.05;
  g.userData.lockTargetY=1.65;
  g.userData.seahorseParts={body,chest,neck,head,cheek,snout,muzzle,eyes:[eyeL,eyeR],tail,dorsalFin,armorPlates,spines,saddle,saddleBlanket,pommel,chestBand,stirrups,bridle,mountAnchor};
  return g;
}
function makeShipHullGeometry(){
  const stations=[
    {z:-12,w:.22,top:3.25,mid:1.95,bottom:1.25},
    {z:-9,w:2.25,top:3.05,mid:1.55,bottom:.28},
    {z:-3,w:3.05,top:2.92,mid:1.35,bottom:-.18},
    {z:4,w:2.9,top:2.95,mid:1.4,bottom:-.08},
    {z:9,w:1.9,top:3.18,mid:1.8,bottom:.75},
    {z:12,w:.18,top:3.65,mid:2.8,bottom:2.15}
  ];
  const vertices=[],indices=[],ringSize=6;
  stations.forEach(s=>{
    vertices.push(
      -s.w,s.top,s.z, -s.w*.82,s.mid,s.z, -s.w*.28,s.bottom,s.z,
      s.w*.28,s.bottom,s.z, s.w*.82,s.mid,s.z, s.w,s.top,s.z
    );
  });
  for(let i=0;i<stations.length-1;i++)for(let side=0;side<ringSize-1;side++){
    const a=i*ringSize+side,b=a+1,c=(i+1)*ringSize+side,d=c+1;
    indices.push(a,b,c,b,d,c);
  }
  const geo=new THREE.BufferGeometry();
  geo.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geo.setIndex(indices);geo.computeVertexNormals();
  return geo;
}
/* A deterministic ~24m wrecked wooden ship. All damage and heel live under the visual
   group so the editor root remains a stable authoring transform. */
function makeShipwreck(){
  const g=new THREE.Group(),visual=new THREE.Group();visual.name='shipwreckVisual';visual.position.y=.5;visual.rotation.set(-.018,0,.065);g.add(visual);
  const hullMat=new THREE.MeshStandardMaterial({color:0x5f3b25,roughness:.92,metalness:0,flatShading:true});
  const plankMat=mat(0x7b4d2d),edgeMat=mat(0x35261d),deckMat=mat(0x87603a),insideMat=mat(0x181715),ropeMat=new THREE.LineBasicMaterial({color:0x514537});
  const hull=new THREE.Mesh(makeShipHullGeometry(),hullMat);hull.name='shipwreckHull';hull.castShadow=true;hull.receiveShadow=true;visual.add(hull);
  const sidePlanks=[];
  [-1,1].forEach(side=>[.78,1.36,1.96].forEach((y,i)=>{
    const plank=new THREE.Mesh(new THREE.BoxGeometry(.11,.16,17.5),i===1?plankMat:edgeMat);
    plank.name=`shipwreckSidePlank${side<0?'L':'R'}${i}`;plank.position.set(side*2.63,y,-.3);plank.rotation.x=(i-1)*.018;visual.add(plank);sidePlanks.push(plank);
  }));
  const deckA=new THREE.Mesh(new THREE.BoxGeometry(5.45,.16,9.2),deckMat);deckA.name='shipwreckDeckA';deckA.position.set(0,3.0,-5.7);visual.add(deckA);
  const deckB=new THREE.Mesh(new THREE.BoxGeometry(4.75,.16,7.8),deckMat);deckB.name='shipwreckDeckB';deckB.position.set(0,3.14,7.2);deckB.rotation.x=-.025;visual.add(deckB);
  const deckBeams=[];
  [-9,-6.5,-4,4.1,6.4,8.6].forEach((z,i)=>{
    const beam=new THREE.Mesh(new THREE.BoxGeometry(i<3?5.7:5,.13,.24),edgeMat);
    beam.name='shipwreckDeckBeam'+i;beam.position.set(0,i<3?3.13:3.26,z);visual.add(beam);deckBeams.push(beam);
  });
  const hatchVoid=new THREE.Mesh(new THREE.BoxGeometry(1.8,.09,2.25),insideMat);hatchVoid.name='shipwreckHatchOpening';hatchVoid.position.set(.45,3.27,6.2);visual.add(hatchVoid);
  const hatchRim=[];
  [[.45,3.35,5.04,2.05,.13,.15],[.45,3.35,7.36,2.05,.13,.15],[-.61,3.35,6.2,.15,.13,2.45],[1.51,3.35,6.2,.15,.13,2.45]].forEach((p,i)=>{
    const rim=new THREE.Mesh(new THREE.BoxGeometry(p[3],p[4],p[5]),edgeMat);rim.name='shipwreckHatchRim'+i;rim.position.set(p[0],p[1],p[2]);visual.add(rim);hatchRim.push(rim);
  });
  const holeShape=new THREE.Shape();
  holeShape.moveTo(-2.15,-.72);holeShape.lineTo(-1.05,-1.02);holeShape.lineTo(-.25,-.72);holeShape.lineTo(.48,-1.15);
  holeShape.lineTo(1.78,-.66);holeShape.lineTo(2.28,.06);holeShape.lineTo(1.35,.74);holeShape.lineTo(.35,.55);
  holeShape.lineTo(-.55,.93);holeShape.lineTo(-1.55,.5);holeShape.closePath();
  const brokenOpening=new THREE.Mesh(new THREE.ShapeGeometry(holeShape),insideMat);
  brokenOpening.name='shipwreckBrokenOpening';brokenOpening.position.set(3.01,1.43,1.05);brokenOpening.rotation.y=Math.PI/2;visual.add(brokenOpening);
  const exposedRibs=[];
  [-.8,.05,.9,1.78,2.58].forEach((z,i)=>{
    const rib=new THREE.Mesh(new THREE.CylinderGeometry(.085,.115,2.35,7),edgeMat);
    rib.name='shipwreckExposedRib'+i;rib.position.set(3.13,1.43,z);rib.rotation.set(.04,0,(i-2)*.055);visual.add(rib);exposedRibs.push(rib);
  });
  const tornEdges=[];
  [[3.12,2.62,-1.1,.18,.22,4.4],[3.13,.35,1.1,.18,.2,4.3]].forEach((p,i)=>{
    const edge=new THREE.Mesh(new THREE.BoxGeometry(p[3],p[4],p[5]),edgeMat);
    edge.name='shipwreckTornEdge'+i;edge.position.set(p[0],p[1],p[2]);edge.rotation.x=(i?-.12:.11);visual.add(edge);tornEdges.push(edge);
  });
  const mastRig=new THREE.Group();mastRig.name='shipwreckMainMastRig';mastRig.position.set(-.25,0,1.35);mastRig.rotation.z=-.14;visual.add(mastRig);
  const mainMast=new THREE.Mesh(new THREE.CylinderGeometry(.17,.28,7.5,10),edgeMat);mainMast.name='shipwreckBrokenMainMast';mainMast.position.y=6.65;mastRig.add(mainMast);
  const mastSplinter=new THREE.Mesh(new THREE.ConeGeometry(.24,.72,7),plankMat);mastSplinter.name='shipwreckMastSplinter';mastSplinter.position.set(.08,10.55,0);mastSplinter.rotation.z=-.35;mastRig.add(mastSplinter);
  const yardLow=new THREE.Mesh(new THREE.CylinderGeometry(.1,.13,6.4,8),edgeMat);yardLow.name='shipwreckYardLow';yardLow.position.y=6.65;yardLow.rotation.z=Math.PI/2;mastRig.add(yardLow);
  const yardHigh=new THREE.Mesh(new THREE.CylinderGeometry(.075,.1,4.9,8),edgeMat);yardHigh.name='shipwreckYardHigh';yardHigh.position.set(.18,8.55,0);yardHigh.rotation.z=Math.PI/2+.08;mastRig.add(yardHigh);
  const stumpRig=new THREE.Group();stumpRig.name='shipwreckStumpRig';stumpRig.position.set(.35,0,-6.45);stumpRig.rotation.z=.18;visual.add(stumpRig);
  const mastStump=new THREE.Mesh(new THREE.CylinderGeometry(.18,.26,2.55,9),edgeMat);mastStump.name='shipwreckMastStump';mastStump.position.y=4.15;stumpRig.add(mastStump);
  const brokenYard=new THREE.Mesh(new THREE.CylinderGeometry(.07,.11,3.3,7),edgeMat);brokenYard.name='shipwreckBrokenYard';brokenYard.position.set(-.4,4.8,0);brokenYard.rotation.z=Math.PI/2+.22;stumpRig.add(brokenYard);
  const riggingPoints=[
    0,10.2,1.35, 0,3.25,11.5, 0,10.2,1.35, 0,3.05,-10.8,
    -3.05,6.65,1.35, -2.7,3,-8.5, 3.05,6.65,1.35, 2.55,3.05,8.8,
    -2.25,8.55,1.35, -2.65,3.08,7.7, 2.5,8.55,1.35, 2.7,3,-5.7,
    -.1,5.42,-6.45, -2.65,3.05,-10.2, -.1,5.42,-6.45, 2.55,3.05,-2.9
  ];
  const riggingGeo=new THREE.BufferGeometry();riggingGeo.setAttribute('position',new THREE.Float32BufferAttribute(riggingPoints,3));
  const rigging=new THREE.LineSegments(riggingGeo,ropeMat);rigging.name='shipwreckRigging';visual.add(rigging);
  const sternFragment=new THREE.Group();sternFragment.name='shipwreckSternFragment';sternFragment.position.set(0,.05,-9.65);sternFragment.rotation.set(.12,.045,-.08);visual.add(sternFragment);
  const sternDeck=new THREE.Mesh(new THREE.BoxGeometry(4.25,.2,2.7),deckMat);sternDeck.name='shipwreckSternDeckFragment';sternDeck.position.y=3.08;sternFragment.add(sternDeck);
  const sternRail=new THREE.Mesh(new THREE.BoxGeometry(4.45,.15,.18),edgeMat);sternRail.name='shipwreckSternRail';sternRail.position.set(0,3.72,-1.25);sternFragment.add(sternRail);
  const railPosts=[];
  [-2,-1,0,1,2].forEach((x,i)=>{
    const post=new THREE.Mesh(new THREE.CylinderGeometry(.055,.07,.72,7),edgeMat);post.name='shipwreckRailPost'+i;post.position.set(x,3.42,-1.25);sternFragment.add(post);railPosts.push(post);
  });
  g.userData.collisionBounds={min:[-3.15,0,-11.6],max:[3.15,3.35,11.6]};
  g.userData.collisionSegments=[
    {min:[-.75,0,-11.6],max:[.75,3.35,-10.8]},
    {min:[-1.65,0,-10.8],max:[1.65,3.35,-9.6]},
    {min:[-2.45,0,-9.6],max:[2.45,3.35,-7.5]},
    {min:[-3.15,0,-7.5],max:[3.15,3.35,-2]},
    {min:[-3.15,0,-2],max:[3.15,3.35,4.5]},
    {min:[-2.9,0,4.5],max:[2.9,3.35,7.5]},
    {min:[-2.25,0,7.5],max:[2.25,3.35,9.5]},
    {min:[-1.45,0,9.5],max:[1.45,3.35,10.7]},
    {min:[-.7,0,10.7],max:[.7,3.35,11.6]}
  ];
  g.userData.labelY=12.2;
  g.userData.lockTargetY=4.8;
  g.userData.shipwreckParts={visual,hull,sidePlanks,decks:[deckA,deckB],deckBeams,hatchVoid,hatchRim,brokenOpening,exposedRibs,tornEdges,mainMast,mastSplinter,yards:[yardLow,yardHigh,brokenYard],mastStump,rigging,sternFragment,sternDeck,sternRail,railPosts};
  return g;
}
function makeProp(){
  const g=new THREE.Group(), wood=mat(0x9b633d), trim=mat(0x5c3826), metal=mat(0x35383d);
  const body=new THREE.Mesh(new THREE.BoxGeometry(.84,.82,.84),wood);body.name='crateBody';body.position.y=.41;
  const lid=new THREE.Mesh(new THREE.BoxGeometry(.94,.07,.94),trim);lid.name='crateLid';lid.position.y=.855;
  const edge=new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(.84,.82,.84)),new THREE.LineBasicMaterial({color:0x4b2d20}));edge.position.y=.41;
  g.add(body,lid,edge);
  const cornerPosts=[];[-1,1].forEach(x=>[-1,1].forEach(z=>{const p=new THREE.Mesh(new THREE.BoxGeometry(.075,.84,.075),trim);p.name='crateCorner';p.position.set(x*.405,.42,z*.405);g.add(p);cornerPosts.push(p);}));
  const braces=[[-.455,.62],[.455,-.62]].map(([z,r],i)=>{const b=new THREE.Mesh(new THREE.BoxGeometry(.075,.68,.055),trim);b.name='crateBrace'+i;b.position.set(0,.43,z);b.rotation.z=r;g.add(b);return b;});
  const handles=[-1,1].map((side,i)=>{const h=new THREE.Mesh(new THREE.TorusGeometry(.105,.014,6,14,Math.PI),metal);h.name='crateHandle'+i;h.position.set(side*.455,.52,0);h.rotation.y=Math.PI/2;h.rotation.z=side<0?Math.PI/2:-Math.PI/2;g.add(h);return h;});
  const lidSlats=[-.3,0,.3].map((x,i)=>{const s=new THREE.Mesh(new THREE.BoxGeometry(.27,.035,.88),wood);s.name='crateLidSlat'+i;s.position.set(x,.905,0);g.add(s);return s;});
  g.userData.propParts={body,lid,cornerPosts,braces,handles,lidSlats};
  return g;
}
/* ---- Scene environment: walls/pillars (foreground references that boost wide-angle perspective and spatial depth) ---- */
const envMat=()=>new THREE.MeshStandardMaterial({color:0x7d786c, roughness:.9});
function makeWall(){
  const g=new THREE.Group();
  const w=new THREE.Mesh(new THREE.BoxGeometry(4,2.8,.25), envMat());
  w.position.y=1.4; w.castShadow=true; w.receiveShadow=true;
  g.add(w); return g;
}
function makePillar(){
  const g=new THREE.Group();
  const p=new THREE.Mesh(new THREE.CylinderGeometry(.32,.38,3.6,14), envMat());
  p.position.y=1.8; p.castShadow=true;
  const base=new THREE.Mesh(new THREE.BoxGeometry(1,.24,1), envMat());
  base.position.y=.12; base.castShadow=true;
  g.add(p,base); return g;
}
/* Environment library (after LibTV director-desk building-block story spaces): low-poly realism — deterministic vertex jitter + flat shading */
function jitterGeo(geo, amp, minY){
  /* Deterministic jitter hashed from vertex coordinates: co-located vertices shift identically, so seams never tear */
  const p=geo.attributes.position;
  const h=(x,y,z)=>{const s=Math.sin(x*127.1+y*311.7+z*74.7)*43758.5453; return s-Math.floor(s);};
  for(let i=0;i<p.count;i++){
    const x=p.getX(i), y=p.getY(i), z=p.getZ(i);
    if(y<minY) continue;   // bottom ring stays grounded
    p.setXYZ(i, x+(h(x,y,z)-.5)*amp, y+(h(y,z,x)-.5)*amp*.5, z+(h(z,x,y)-.5)*amp);
  }
  geo.computeVertexNormals(); return geo;
}
const flatMat=c=>new THREE.MeshStandardMaterial({color:c, roughness:.95, flatShading:true});
function makeTree(){
  const g=new THREE.Group();
  const trunk=new THREE.Mesh(new THREE.CylinderGeometry(.11,.21,1.5,9), mat(0x6b5a4a));
  trunk.position.y=.75; trunk.castShadow=true; g.add(trunk);
  const clump=(x,y,z,r,col)=>{
    const s=new THREE.Mesh(jitterGeo(new THREE.SphereGeometry(r,9,7),r*.22,-99), flatMat(col));
    s.position.set(x,y,z); s.castShadow=true; g.add(s);
  };
  clump(0,2.3,0,1.15,0x66754f); clump(.55,3.05,.25,.75,0x71805a); clump(-.5,2.7,-.3,.65,0x5f6e4a);
  return g;
}
function makeMountain(){
  const g=new THREE.Group();
  const peak=(r,h,x,z,col)=>{
    const m=new THREE.Mesh(jitterGeo(new THREE.ConeGeometry(r,h,9,4),r*.16,-h/2+.05), flatMat(col));
    m.position.set(x,h/2,z); m.castShadow=true; g.add(m);
  };
  peak(7,6.5,0,0,0x75716a); peak(4.2,3.8,4,1.8,0x7d7972);
  return g;
}
function makeHouse(){
  const g=new THREE.Group();
  const base=new THREE.Mesh(new THREE.BoxGeometry(4.3,.18,3.5), mat(0x6e6a60)); base.position.y=.09;
  const body=new THREE.Mesh(new THREE.BoxGeometry(4,2.6,3.2), envMat());
  body.position.y=1.48; body.castShadow=true; body.receiveShadow=true;
  const roof=new THREE.Mesh(new THREE.CylinderGeometry(0,2.95,1.7,4), flatMat(0x5f5a52));
  roof.position.y=3.62; roof.rotation.y=Math.PI/4; roof.castShadow=true;
  const chimney=new THREE.Mesh(new THREE.BoxGeometry(.34,.9,.34), mat(0x6a655d));
  chimney.position.set(-1.2,3.9,.5); chimney.castShadow=true;
  const door=new THREE.Mesh(new THREE.BoxGeometry(.72,1.5,.08), mat(0x4a4440));
  door.position.set(-.9,.93,1.63);
  const win=x=>{const w=new THREE.Mesh(new THREE.BoxGeometry(.8,.7,.06), mat(0x2c3038)); w.position.set(x,1.75,1.64); return w;};
  g.add(base,body,roof,chimney,door,win(.4),win(1.4));
  return g;
}
function makeRock(){
  const g=new THREE.Group();
  const r=new THREE.Mesh(jitterGeo(new THREE.DodecahedronGeometry(.75),.18,-99), flatMat(0x82807c));
  r.position.y=.48; r.scale.set(1.35,.75,1); r.rotation.y=.5; r.castShadow=true;
  g.add(r); return g;
}
function makeBush(){
  const g=new THREE.Group();
  const base=new THREE.Mesh(jitterGeo(new THREE.SphereGeometry(.55,9,7),.12,-99),flatMat(0x5f7f4d));
  base.position.y=.45;base.scale.set(1.35,.72,1.05);base.castShadow=true;
  const lobeL=new THREE.Mesh(jitterGeo(new THREE.SphereGeometry(.38,8,6),.1,-99),flatMat(0x6f8c59));
  lobeL.position.set(-.42,.62,.06);lobeL.scale.set(1,.72,.82);lobeL.castShadow=true;
  const lobeR=lobeL.clone();lobeR.position.x=.42;lobeR.position.z=-.05;
  g.add(base,lobeL,lobeR);g.userData.semanticBounds={width:1.6,height:.9,depth:1.25};return g;
}
function makeDog(color=0x9a6b42){
  const g=new THREE.Group(),coat=flatMat(color),dark=flatMat(0x2d2520);
  const body=new THREE.Mesh(new THREE.BoxGeometry(.48,.36,.92),coat);body.position.y=.45;body.castShadow=true;
  const chest=new THREE.Mesh(new THREE.SphereGeometry(.24,12,8),coat);chest.position.set(0,.5,.36);chest.scale.set(1,.9,.82);chest.castShadow=true;
  const head=new THREE.Mesh(new THREE.SphereGeometry(.2,12,8),coat);head.position.set(0,.72,.72);head.scale.set(.9,1,.82);head.castShadow=true;
  const muzzle=new THREE.Mesh(new THREE.BoxGeometry(.2,.12,.18),coat);muzzle.position.set(0,.68,.88);muzzle.castShadow=true;
  const nose=new THREE.Mesh(new THREE.SphereGeometry(.04,8,6),dark);nose.position.set(0,.69,.99);nose.userData.keepMaterial=true;
  const ear=(x)=>{const e=new THREE.Mesh(new THREE.ConeGeometry(.055,.24,6),dark);e.position.set(x,.91,.69);e.rotation.z=x<0?.45:-.45;e.castShadow=true;e.userData.keepMaterial=true;return e;};
  const tail=new THREE.Mesh(new THREE.CylinderGeometry(.025,.035,.42,7),coat);tail.position.set(0,.62,-.58);tail.rotation.x=-.8;tail.castShadow=true;
  [-.16,.16].forEach(x=>[-.28,.32].forEach(z=>{const leg=new THREE.Mesh(new THREE.CylinderGeometry(.045,.055,.42,7),coat);leg.position.set(x,.21,z);leg.castShadow=true;g.add(leg);}));
  g.add(body,chest,head,muzzle,nose,ear(-.11),ear(.11),tail);g.userData.semanticBounds={width:.45,height:.65,depth:1.05};return g;
}
function makeRoad(){
  const g=new THREE.Group();
  const roadMat=new THREE.MeshStandardMaterial({color:0x3d4147,roughness:.98,metalness:0});
  const stripeMat=new THREE.MeshBasicMaterial({color:0xd8d0aa});
  const deck=new THREE.Mesh(new THREE.BoxGeometry(3.8,.05,14),roadMat);
  deck.position.y=.025;deck.receiveShadow=true;deck.userData.collisionExempt=true;
  for(let z=-5;z<=5;z+=2.5){
    const stripe=new THREE.Mesh(new THREE.BoxGeometry(.09,.012,.9),stripeMat);
    stripe.position.set(0,.061,z);stripe.userData.collisionExempt=true;stripe.userData.keepMaterial=true;g.add(stripe);
  }
  g.add(deck);g.userData.collisionExempt=true;g.userData.semanticBounds={width:3.8,height:.05,depth:14};return g;
}
const DESERT_SIZE=24,DESERT_SEGMENTS=40,DESERT_EDGE_HEIGHT=.12;
function desertHeightProfile(x,z){
  const half=DESERT_SIZE/2,radial=Math.max(Math.abs(x),Math.abs(z))/half;
  const edgeT=Math.max(0,Math.min(1,(radial-.78)/.22));
  const envelope=1-edgeT*edgeT*(3-2*edgeT);
  const dune=.72
    +Math.sin(x*.42+Math.sin(z*.16)*1.5)*.36
    +Math.sin(z*.31-x*.12+1.1)*.24
    +Math.cos((x+z)*.17+Math.sin(x*.2))*.15;
  return DESERT_EDGE_HEIGHT+Math.max(.08,dune)*envelope;
}
function makeDesert(terrainVersion=1){
  const g=new THREE.Group(),geo=new THREE.PlaneGeometry(DESERT_SIZE,DESERT_SIZE,DESERT_SEGMENTS,DESERT_SEGMENTS);
  geo.rotateX(-Math.PI/2);
  const p=geo.attributes.position,colors=[];
  const low=new THREE.Color(0xb87836),mid=new THREE.Color(0xd69a4d),high=new THREE.Color(0xf0c777);
  for(let i=0;i<p.count;i++){
    const x=p.getX(i),z=p.getZ(i),y=desertHeightProfile(x,z),t=Math.max(0,Math.min(1,(y-DESERT_EDGE_HEIGHT)/1.35));
    p.setY(i,y);
    const c=(t<.55?low.clone().lerp(mid,t/.55):mid.clone().lerp(high,(t-.55)/.45));
    colors.push(c.r,c.g,c.b);
  }
  geo.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
  geo.computeVertexNormals();geo.computeBoundingBox();geo.computeBoundingSphere();
  const surface=new THREE.Mesh(geo,new THREE.MeshStandardMaterial({vertexColors:true,roughness:1,metalness:0,side:THREE.DoubleSide}));
  surface.name='desertSurface';surface.castShadow=true;surface.receiveShadow=true;
  const base=new THREE.Mesh(new THREE.BoxGeometry(DESERT_SIZE,DESERT_EDGE_HEIGHT,DESERT_SIZE),flatMat(0xa96831));
  base.name='desertBase';base.position.y=DESERT_EDGE_HEIGHT/2;base.castShadow=true;base.receiveShadow=true;
  g.add(base,surface);
  g.userData.desertSize=DESERT_SIZE;g.userData.desertSegments=DESERT_SEGMENTS;g.userData.desertSurface=surface;g.userData.terrainVersion=terrainVersion;
  return g;
}
/* Scene board: a 2D scene image as a theater flat, giving real foreground parallax; MeshBasic ignores lighting so the photo stays true */
function makeBoard(assetId){
  const g=new THREE.Group();
  const a=(project&&project.assets)?project.assets[assetId]:null;
  const w=8, h=a?Math.max(1,w*a.h/a.w):4.5;
  const tex=assetTexture(assetId);
  const p=new THREE.Mesh(new THREE.PlaneGeometry(w,h),
    new THREE.MeshBasicMaterial(tex?{map:tex,side:THREE.DoubleSide,fog:false}:{color:0x555a63,side:THREE.DoubleSide}));
  p.position.y=h/2;
  g.add(p);
  g.userData.boardH=h;
  return g;
}
const ENV_KINDS=['wall','pillar','tree','mount','house','rock','desert','board'];
function makeLabel(text){
  const cv=document.createElement('canvas'); cv.width=128; cv.height=48;
  const c=cv.getContext('2d'); c.fillStyle='#111318d9'; c.beginPath();
  if(c.roundRect) c.roundRect(10,7,108,34,7); else c.rect(10,7,108,34);
  c.fill();
  c.fillStyle='#f2f3f5'; c.font=`600 ${text.length>3?16:20}px sans-serif`; c.textAlign='center'; c.textBaseline='middle';
  c.fillText(text,64,24);
  const s=new THREE.Sprite(new THREE.SpriteMaterial({map:new THREE.CanvasTexture(cv), depthTest:false}));
  s.scale.set(1,.36,1); s.renderOrder=99; s.userData={isLabel:true,textLen:text.length}; return s;
}
function labelY(kind,obj){
  if(Number.isFinite(obj?.userData?.labelY))return obj.userData.labelY;
  return kind==='board'?(obj.userData.boardH+.5):({char:2.15,wall:3.3,pillar:4.1,tree:4.4,mount:7.2,house:5,rock:1.7,desert:2.35,horse:2.35,seahorse:3.05,shipwreck:12.2,dog:1.05,bush:1.35,road:.45}[kind]||2.2);
}

export {
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
  SEAHORSE_RIDE_JOINTS,
  SEAHORSE_SCALE_MIN,
  SEAHORSE_SCALE_MAX,
  LEGACY_RIDE_JOINT_DEFAULTS,
  horseRideHost,
  migrateHorseRideJoints,
  migrateSeahorseRideJoints,
  applyJoints,
  applyPose,
  makeCar,
  makeHorse,
  makeSeahorse,
  makeShipHullGeometry,
  makeShipwreck,
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
};
