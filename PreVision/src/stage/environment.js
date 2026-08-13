/*
 * stage/environment.js — renderer, sun, assets, sky, ground, labels, and export look
 * (subsystems B + H, refactor P6, ADR-0012). Function bodies and top-level
 * initialization moved from src/app.js with behavior intact; comments translated to
 * English for the src/ i18n policy. Runtime-only free references that still belong to
 * later stages (runtime/viz/capture/inspector) resolve through the existing bridge
 * globals at call time, matching the P1-P5 transition model. Runtime-owned
 * actorWorldBox, terrainSupportHeight, and syncScene stay explicit call-time globals.
 */
import { curScene } from '../core/store.js';

/* ============ Base scene ============ */
const canvas = document.getElementById('gl');
let configuredRendererCount=0;
function configureRenderer(r){
  configuredRendererCount++;
  r.shadowMap.enabled=true;
  r.shadowMap.type=THREE.PCFSoftShadowMap;
  return r;
}
const renderer = new THREE.WebGLRenderer({canvas, antialias:true, preserveDrawingBuffer:true});
configureRenderer(renderer);
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0a0a0a);
scene.fog = new THREE.Fog(0x0a0a0a, 75, 220);
const viewCam = new THREE.PerspectiveCamera(50, 1, .1, 500);
const shotCam = new THREE.PerspectiveCamera(40, 16/9, .1, 500);
const ambientLight=new THREE.AmbientLight(0xffffff,.28);scene.add(ambientLight);
const key = new THREE.DirectionalLight(0xffffff, .9);
key.position.set(8, 14, 6); key.castShadow = true;
key.shadow.mapSize.set(2048, 2048);
key.shadow.camera.left=-25; key.shadow.camera.right=25; key.shadow.camera.top=25; key.shadow.camera.bottom=-25;
key.shadow.camera.near=.1;key.shadow.camera.far=140;key.shadow.bias=-.00015;key.shadow.normalBias=.025;key.shadow.radius=2;
const sunTarget=new THREE.Object3D();scene.add(sunTarget);key.target=sunTarget;scene.add(key);
const DEFAULT_SUN=Object.freeze({enabled:true,pos:[8,14,6],intensity:.9,temp:5600,ambient:.28,softness:2,quality:'standard'});
function cleanSun(raw){
  raw=raw||{};const p=Array.isArray(raw.pos)?raw.pos:DEFAULT_SUN.pos;
  return {enabled:raw.enabled!==false,
    pos:[Math.max(-30,Math.min(30,+p[0]||0)),Math.max(1,Math.min(30,+p[1]||DEFAULT_SUN.pos[1])),Math.max(-30,Math.min(30,+p[2]||0))],
    intensity:Math.max(0,Math.min(3,Number.isFinite(+raw.intensity)?+raw.intensity:DEFAULT_SUN.intensity)),
    temp:Math.max(2500,Math.min(9000,Number.isFinite(+raw.temp)?+raw.temp:DEFAULT_SUN.temp)),
    ambient:Math.max(0,Math.min(1,Number.isFinite(+raw.ambient)?+raw.ambient:DEFAULT_SUN.ambient)),
    softness:Math.max(0,Math.min(5,Number.isFinite(+raw.softness)?+raw.softness:DEFAULT_SUN.softness)),
    quality:['performance','standard','high'].includes(raw.quality)?raw.quality:'standard'};
}
function kelvinColor(k){
  const t=k/100;let r,g,b;
  if(t<=66){r=255;g=99.4708025861*Math.log(t)-161.1195681661;b=t<=19?0:138.5177312231*Math.log(t-10)-305.0447927307;}
  else {r=329.698727446*Math.pow(t-60,-.1332047592);g=288.1221695283*Math.pow(t-60,-.0755148492);b=255;}
  const c=v=>Math.max(0,Math.min(255,v))/255;
  return new THREE.Color(c(r),c(g),c(b));
}
function currentSun(){
  const s=curScene();if(!s)return cleanSun();
  const sun=cleanSun(s.sun);if(!automaticCaptureMutationBlocked())s.sun=sun;return automaticCaptureMutationBlocked()?sun:s.sun;
}
function fitSunShadowCamera(){
  const box=new THREE.Box3();box.makeEmpty();
  actors.forEach(a=>{
    const b=globalThis.actorWorldBox(a);if(finiteBox(b))box.union(b);
    a.pathPts.forEach(p=>box.expandByPoint(new THREE.Vector3(p.x,(a.elev||0)+globalThis.terrainSupportHeight(a,p.x,p.z),p.z)));
  });
  const center=new THREE.Vector3(0,1,0),size=new THREE.Vector3(8,4,8);
  if(!box.isEmpty()){box.getCenter(center);box.getSize(size);center.y=Math.max(1,center.y);}
  const extent=Math.max(12,Math.min(35,Math.max(size.x,size.z)*.65+8));
  sunTarget.position.copy(center);const c=key.shadow.camera;
  c.left=-extent;c.right=extent;c.top=extent;c.bottom=-extent;c.near=.1;c.far=Math.max(80,size.y+70);c.updateProjectionMatrix();
  return center;
}
function applySunSettings(refresh=true){
  const s=currentSun(),center=fitSunShadowCamera(),off=new THREE.Vector3(...s.pos);
  if(off.lengthSq()<4)off.set(...DEFAULT_SUN.pos);
  key.position.copy(center).add(off);key.visible=s.enabled;key.intensity=s.intensity;key.color.copy(kelvinColor(s.temp));
  key.shadow.radius=s.softness;ambientLight.intensity=s.ambient;
  const q={performance:1024,standard:2048,high:4096}[s.quality];
  if(key.userData.shadowSize!==q){key.userData.shadowSize=q;key.shadow.mapSize.set(q,q);if(key.shadow.map){key.shadow.map.dispose();key.shadow.map=null;}}
  key.updateMatrixWorld(true);sunTarget.updateMatrixWorld(true);
  if(refresh&&typeof refreshSunUI==='function')refreshSunUI();
  return s;
}
function sunGizmoPosition(){
  const dir=key.position.clone().sub(sunTarget.position);
  if(dir.lengthSq()<.01)dir.set(...DEFAULT_SUN.pos);
  return sunTarget.position.clone().add(dir.normalize().multiplyScalar(7));
}
const disposedOwnedThreeResources=new WeakSet(),sharedThreeTextures=new WeakSet();
function markSharedThreeTexture(texture){if(texture?.isTexture)sharedThreeTextures.add(texture);return texture;}
function isSharedThreeTexture(texture){return !!texture&&sharedThreeTextures.has(texture);}
function collectOwnedMaterialTextures(material,textures){
  const values=Object.values(material||{});
  Object.values(material?.uniforms||{}).forEach(uniform=>values.push(uniform?.value));
  values.forEach(value=>{
    const candidates=Array.isArray(value)?value:[value];
    candidates.forEach(texture=>{if(texture?.isTexture&&!isSharedThreeTexture(texture))textures.add(texture);});
  });
}
function disposeOwnedThreeResource(resource){
  if(!resource?.dispose||disposedOwnedThreeResources.has(resource))return false;
  disposedOwnedThreeResources.add(resource);resource.dispose();return true;
}
function disposeOwnedObject3D(root){
  const geometries=new Set(),materials=new Set(),textures=new Set();
  if(!root?.traverse)return {geometries:0,materials:0,textures:0};
  root.traverse(object=>{
    /* THREE.Sprite instances share one engine-owned geometry in r128; only their material/map belongs to the label. */
    if(!object.isSprite&&object.geometry?.dispose)geometries.add(object.geometry);
    [].concat(object.material||[]).forEach(material=>{
      if(!material?.dispose)return;
      materials.add(material);collectOwnedMaterialTextures(material,textures);
    });
  });
  let textureCount=0,materialCount=0,geometryCount=0;
  textures.forEach(texture=>{if(disposeOwnedThreeResource(texture))textureCount++;});
  materials.forEach(material=>{if(disposeOwnedThreeResource(material))materialCount++;});
  geometries.forEach(geometry=>{if(disposeOwnedThreeResource(geometry))geometryCount++;});
  return {geometries:geometryCount,materials:materialCount,textures:textureCount};
}
/* Checker ground: motion-parallax reference for tracking shots. */
const GROUND_CHECKER_LIGHT='#3a3e48',GROUND_CHECKER_DARK='#292c34',GROUND_CHECKER_REPEAT=2.5;
const groundTex=(()=>{ const cv=document.createElement('canvas'); cv.width=cv.height=256;
  const c=cv.getContext('2d');
  for(let y=0;y<8;y++)for(let x=0;x<8;x++){ c.fillStyle=(x+y)%2?GROUND_CHECKER_LIGHT:GROUND_CHECKER_DARK; c.fillRect(x*32,y*32,32,32); }
  const t=new THREE.CanvasTexture(cv); t.wrapS=t.wrapT=THREE.RepeatWrapping; t.repeat.set(GROUND_CHECKER_REPEAT,GROUND_CHECKER_REPEAT); return t; })();
markSharedThreeTexture(groundTex);
/* The ground is the director-stage spatial reference; keep it outside distance fog. */
const ground = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), new THREE.MeshStandardMaterial({map:groundTex, roughness:.95, fog:false}));
ground.rotation.x = -Math.PI/2; ground.receiveShadow = true; scene.add(ground);
const grid = new THREE.GridHelper(60, 30, 0x666d7a, 0x444a55); grid.position.y=.01;
([].concat(grid.material)).forEach(m=>{m.fog=false;m.transparent=true;m.opacity=.82;});
scene.add(grid);
const groundBorderPts=[[-30,-30],[30,-30],[30,30],[-30,30]].map(p=>new THREE.Vector3(p[0],.018,p[1]));
const groundBorder=new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(groundBorderPts),
  new THREE.LineBasicMaterial({color:0x737b89,transparent:true,opacity:.8,fog:false}));
scene.add(groundBorder);

const orbit = {theta:.6, phi:1.05, dist:22, target:new THREE.Vector3(0,1,0)};
function applyOrbit(){
  viewCam.position.set(
    orbit.target.x + orbit.dist*Math.sin(orbit.phi)*Math.sin(orbit.theta),
    orbit.target.y + orbit.dist*Math.cos(orbit.phi),
    orbit.target.z + orbit.dist*Math.sin(orbit.phi)*Math.cos(orbit.theta));
  viewCam.lookAt(orbit.target);
}
function setOrbitPivotKeepView(point){
  const off=viewCam.position.clone().sub(point),dist=Math.max(.01,off.length());
  orbit.target.copy(point);orbit.dist=dist;
  orbit.theta=Math.atan2(off.x,off.z);
  orbit.phi=Math.max(.08,Math.min(1.52,Math.acos(Math.max(-1,Math.min(1,off.y/dist)))));
  applyOrbit();
}
applyOrbit();
/* ============ Scene background: 720-degree sky sphere and image assets ============ */
let assetTex=Object.create(null);   // assetId -> THREE.Texture cache; replaced atomically with the active project
const assetTextureReady=new WeakMap();
let sky=null;
const SKY_BASE_R=60;
function disposeAssetTextureCache(cache,ids=Object.keys(cache||{})){
  let textures=0;
  new Set(ids).forEach(id=>{
    const texture=cache&&cache[id];if(!texture)return;
    delete cache[id];sharedThreeTextures.delete(texture);
    try{if(disposeOwnedThreeResource(texture))textures++;}
    catch(error){console.error('Asset texture disposal failed',error);}
  });
  return textures;
}
function addAsset(dataURL, w, h){
  if(automaticCaptureMutationBlocked())return false;
  const id='a'+Math.random().toString(36).slice(2,9);
  project.assets=project.assets||{};
  project.assets[id]={d:dataURL, w:w, h:h};
  return id;
}
/* Image import: recompress to cap storage size (panorama <=4096x2048, board <=2048). */
function importImage(file, maxW, maxH, cb){
  if(automaticCaptureMutationBlocked())return false;
  let committed=false;
  const rd=new FileReader();
  rd.onload=()=>{
    const img=new Image();
    img.onload=()=>{
      if(committed)return;committed=true;
      const k=Math.min(1, maxW/img.width, maxH/img.height);
      const w=Math.max(1,Math.round(img.width*k)), h=Math.max(1,Math.round(img.height*k));
      const cv=document.createElement('canvas'); cv.width=w; cv.height=h;
      cv.getContext('2d').drawImage(img,0,0,w,h);
      const dataURL=cv.toDataURL('image/jpeg',.85);
      deferAutomaticCaptureMutation(()=>cb(addAsset(dataURL,w,h)));
    };
    img.src=rd.result;
  };
  rd.readAsDataURL(file);return true;
}
function assetTexture(id){
  const a=project.assets && project.assets[id]; if(!a) return null;
  if(!assetTex[id]){
    const img=new Image();
    const t=markSharedThreeTexture(new THREE.Texture(img));assetTex[id]=t;
    let settleReady,settled=false;const ready=new Promise(resolve=>{settleReady=resolve;});assetTextureReady.set(t,ready);
    const settle=loaded=>{if(settled)return;settled=true;if(loaded)t.needsUpdate=true;settleReady(loaded);};
    img.onload=()=>settle(true);img.onerror=()=>settle(false);
    img.src=a.d;
    if(img.complete && img.width)settle(true);
  }
  return assetTex[id];
}
function hasBg(){ const b=project&&curScene()&&curScene().bg; return !!(b&&b.asset); }
function buildSky(){
  if(sky){ scene.remove(sky); disposeOwnedObject3D(sky); sky=null; }
  const bg=curScene()&&curScene().bg;
  if(bg && bg.asset && project.assets && project.assets[bg.asset]){
    const tex=assetTexture(bg.asset);
    const R=bg.radius||SKY_BASE_R, camH=bg.y!==undefined?bg.y:1.6, gp=bg.gp!==false;
    const geo=new THREE.SphereGeometry(R, 96, 64);
    geo.scale(-1,1,1);   // Inner face points inward without mirroring, matching panorama convention.
    /* Ground-projected skybox: flatten only the nearby ground cone to y=-camH-0.02
       (2cm lower to avoid z-fighting). Horizon content beyond 0.85R stays spherical,
       because forcing distant photo content flat creates radial streaks. */
    if(gp && camH>0.2){
      const p=geo.attributes.position;
      /* Projection disk is decoupled from environment radius: cover only cameraHeight*12,
         where texture density is usable and actors move. Farther ground/sea stays spherical. */
      const maxT=Math.min(R*0.85, camH*12);
      for(let i=0;i<p.count;i++){
        const x=p.getX(i), y=p.getY(i), z=p.getZ(i);
        const len=Math.sqrt(x*x+y*y+z*z)||1;
        const dx=x/len, dy=y/len, dz=z/len;
        if(dy<-0.001){
          const t=(camH+.02)/(-dy);
          if(t<=maxT) p.setXYZ(i, dx*t, -(camH+.02), dz*t);
        }
      }
      geo.computeVertexNormals();
    }
    sky=new THREE.Mesh(geo, new THREE.MeshBasicMaterial({map:tex, fog:false}));
    sky.rotation.y=(bg.yaw||0)*Math.PI/180;
    sky.position.y=camH;   // Sphere center equals capture-camera height, so projected photo ground lands at y=0.
    sky.userData={radius:R, gp:gp&&camH>0.2, camH};
    scene.add(sky);
  }
  if(typeof refreshBgUI==='function') refreshBgUI();
}
/* Export look: hide editor helpers; with a background, keep only ground shadows and hide the grid. */
const groundDefaultMat=ground.material;
const shadowOnlyMat=new THREE.ShadowMaterial({opacity:.35});
const GROUND_STYLES=['checker','white','black','color','image'],GROUND_DEFAULT_COLOR='#707781';
let groundHelpersVisible=true;
function cleanGroundAppearance(raw){
  raw=raw&&typeof raw==='object'?raw:{};
  let style=GROUND_STYLES.includes(raw.style)?raw.style:'checker';
  const color=typeof raw.color==='string'&&/^#[0-9a-f]{6}$/i.test(raw.color)?raw.color.toLowerCase():GROUND_DEFAULT_COLOR;
  const asset=typeof raw.asset==='string'&&project&&project.assets&&project.assets[raw.asset]?raw.asset:null;
  if(style==='image'&&!asset)style='checker';
  if(style==='color')return {style,color};
  if(style==='image')return {style,asset};
  return {style};
}
function currentGroundAppearance(){
  const sd=curScene();if(!sd)return {style:'checker'};
  const appearance=cleanGroundAppearance(sd.ground);if(!automaticCaptureMutationBlocked())sd.ground=appearance;return appearance;
}
function applyGroundAppearance(){
  const appearance=currentGroundAppearance();
  groundDefaultMat.map=appearance.style==='checker'?groundTex:appearance.style==='image'?assetTexture(appearance.asset):null;
  groundDefaultMat.color.set(appearance.style==='white'?0xffffff:appearance.style==='black'?0x000000:appearance.style==='color'?appearance.color:0xffffff);
  groundDefaultMat.needsUpdate=true;groundHelpersVisible=appearance.style==='checker';
  if(ground.material!==shadowOnlyMat)ground.material=groundDefaultMat;
  grid.visible=groundHelpersVisible;groundBorder.visible=groundHelpersVisible;
  if(typeof refreshGroundUI==='function')refreshGroundUI();
  return appearance;
}
function setGroundAppearance(next){
  if(automaticCaptureMutationBlocked())return false;
  if(!curScene())return null;
  curScene().ground=cleanGroundAppearance(next);
  const appearance=applyGroundAppearance();markDirty();
  return appearance;
}
const labelWorldPos=new THREE.Vector3();
function updateLabelScales(cam){
  const vp=document.getElementById('viewport'), h=Math.max(240,(vp&&vp.clientHeight)||600);
  const tan=Math.tan(cam.fov*Math.PI/360);
  actors.forEach(a=>a.obj.children.forEach(s=>{
    if(!s.isSprite) return;
    s.getWorldPosition(labelWorldPos);
    const dist=Math.max(.5,cam.position.distanceTo(labelWorldPos));
    const worldPerPx=2*dist*tan/h, px=(s.userData.textLen||2)>3?78:56, sy=Math.max(.001,a.obj.scale.x);
    s.scale.set(px*worldPerPx/sy,24*worldPerPx/sy,1);
  }));
}
function updateLabelVisibility(exportOn){
  const enabled=document.getElementById('showLabels')?.checked!==false;
  actors.forEach(a=>{
    const hostWithRider=actors.some(r=>r.mount===a.label);
    a.obj.children.forEach(c=>{if(c.isSprite)c.visible=!exportOn&&enabled&&!hostWithRider;});
  });
}
let exportLookActive=false;
/* Transitional live global shims (P6): the bridge Object.assign creates snapshots, so
 * these mutable owners install accessors themselves. They remain configurable for P9. */
const defineEnvironmentGlobal=(name,get,set)=>Object.defineProperty(globalThis,name,{get,set,configurable:true});
defineEnvironmentGlobal('configuredRendererCount',()=>configuredRendererCount,v=>{configuredRendererCount=v;});
defineEnvironmentGlobal('assetTex',()=>assetTex,v=>{assetTex=v;});
defineEnvironmentGlobal('sky',()=>sky,v=>{sky=v;});
defineEnvironmentGlobal('exportLookActive',()=>exportLookActive,v=>{exportLookActive=v;});
function setExportLook(on){
  exportLookActive=!!on;
  vizGroup.visible=!on; camBall.visible=!on&&cameraVizVisibleIn('viewport');
  updateLabelVisibility(on);
  const bgOn=hasBg();
  ground.material=(on&&bgOn)?shadowOnlyMat:groundDefaultMat;
  grid.visible=!(on&&bgOn)&&groundHelpersVisible;
  groundBorder.visible=!(on&&bgOn)&&groundHelpersVisible;
}
function gcAssets(){
  if(automaticCaptureMutationBlocked())return false;
  if(!project || !project.assets) return;
  const used=new Set();
  globalThis.syncScene();
  project.scenes.forEach(sd=>{
    if(sd.bg&&sd.bg.asset) used.add(sd.bg.asset);
    if(sd.ground&&sd.ground.asset) used.add(sd.ground.asset);
    (sd.actors||[]).forEach(a=>{ if(a.asset) used.add(a.asset); });
  });
  const orphaned=new Set(Object.keys(project.assets).filter(id=>!used.has(id)));
  Object.keys(assetTex).forEach(id=>{if(!used.has(id)||!project.assets[id])orphaned.add(id);});
  orphaned.forEach(id=>{delete project.assets[id];disposeAssetTextureCache(assetTex,[id]);});
}

export {
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
  GROUND_STYLES,
  GROUND_DEFAULT_COLOR,
  cleanGroundAppearance,
  currentGroundAppearance,
  applyGroundAppearance,
  setGroundAppearance,
  labelWorldPos,
  updateLabelScales,
  updateLabelVisibility,
  setExportLook,
  gcAssets,
};
