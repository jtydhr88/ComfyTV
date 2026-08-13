/*
 * export/prompt.js — genPrompt camera-move analyzer (subsystem S, refactor P5,
 * ADR-0011). Derives the structured Seedance prompt from the 3D scene: lens focal
 * length, camera height, move type/speed, per-actor motion state, count declarations
 * and negative constraints. Function bodies moved verbatim from src/app.js. The Chinese
 * literals are genPrompt OUTPUT CONTRACT DATA VALUES (architecture map §5.4; the C3
 * golden pins the output byte-for-byte), kept as \uXXXX escapes under the ascii-charset
 * mechanism (ADR-0008) — values unchanged, not language keys. Chinese comments
 * translated to English (recorded deviation, ADR-0011).
 *
 * updatePrompt is the RefreshHub 'prompt' refresh function; its refresh.register moved
 * here with it (P5 migration discipline, ADR-0010: the hub registry stores function
 * references, so registration must live in the owning module).
 *
 * Transitional free references resolved through globals at call time only: updateActors,
 * updateShotCam, poseText (app.js/playback owners migrate in P8); actors via the core
 * store shim (ADR-0009). P6 added true imports for environment-owned shotCam, hasBg,
 * and currentSun. P7 added true imports for runtime-owned actorByLabel and lockTarget.
 */
import { $, clock, curShot, refresh } from '../core/store.js';
import { ensureCamKeys, shotCurve } from '../core/project-data.js';
import { currentSun, hasBg, shotCam } from '../stage/environment.js';
import { ENV_KINDS } from '../stage/factory.js';
import { actorByLabel as runtimeActorByLabel, lockTarget as runtimeLockTarget } from '../stage/runtime.js';

/* ===== Camera-move analyzer ===== */
function focalOf(fovDeg){ return Math.round(12/Math.tan(fovDeg*Math.PI/360)); }
function charNDC(){
  shotCam.updateMatrixWorld();
  return actors.map(a=>{
    const p=a.obj.position.clone().setY(1.0).project(shotCam);
    return {label:a.label, kind:a.kind, pose:a.pose, mount:a.mount, x:p.x, dist:shotCam.position.distanceTo(a.obj.position),
      world:a.obj.position.clone(),
      visible:Math.abs(p.x)<1.1 && Math.abs(p.y)<1.1 && p.z<1};
  });
}
function sampleShotState(){
  const s=curShot(), lease=clock.lease(); clock.pause();
  const st={};
  clock.seek(0); updateActors(); updateShotCam();
  st.cam0=shotCam.position.clone(); st.tgt0=runtimeLockTarget(s.lock); st.ndc0=charNDC();
  clock.seek(s.dur); updateActors(); updateShotCam();
  st.cam1=shotCam.position.clone(); st.tgt1=runtimeLockTarget(s.lock); st.ndc1=charNDC();
  lease.restore(); updateActors(); updateShotCam();
  return st;
}
function genPrompt(){
  const s=curShot(); if(!s) return '';
  const st=sampleShotState();
  const manual=s.lock==='\u624b\u52a8\u671d\u5411',fov0=manual?ensureCamKeys(s)[0].fov:s.fov;
  const f=focalOf(fov0), fdesc=f<24?'\u5e7f\u89d2':f<40?'\u4e2d\u7126':f<70?'\u4e2d\u957f\u7126':'\u957f\u7126';
  const cv=shotCurve(s), L=cv?cv.getLength():0, v=L/s.dur;
  const d0=st.cam0.distanceTo(st.tgt0), d1=st.cam1.distanceTo(st.tgt1);
  const moves=[];
  if(L<.3) moves.push('\u56fa\u5b9a\u673a\u4f4d');
  else if(manual){
    const dh=st.cam1.y-st.cam0.y;
    if(dh>.8) moves.push('\u5347\u9ad8'+dh.toFixed(1)+'m'); else if(dh<-.8) moves.push('\u4e0b\u964d'+(-dh).toFixed(1)+'m');
    moves.push('\u6cbf\u65e2\u5b9a\u8def\u5f84\u5e73\u79fb(\u671d\u5411\u4e0e\u7126\u8ddd\u6309\u673a\u4f4d\u70b9\u5e73\u6ed1\u8fc7\u6e21)');
  }
  else{
    if(d1<d0*.82) moves.push('\u63a8\u8fd1'); else if(d1>d0*1.22) moves.push('\u62c9\u8fdc');
    const a0=Math.atan2(st.cam0.x-st.tgt0.x, st.cam0.z-st.tgt0.z);
    const a1=Math.atan2(st.cam1.x-st.tgt1.x, st.cam1.z-st.tgt1.z);
    let sweep=(a1-a0)*180/Math.PI; while(sweep>180)sweep-=360; while(sweep<-180)sweep+=360;
    if(Math.abs(sweep)>20) moves.push((sweep>0?'\u5411\u5de6':'\u5411\u53f3')+'\u73af\u7ed5\u7ea6'+Math.round(Math.abs(sweep))+'\u00b0');
    const dh=st.cam1.y-st.cam0.y;
    if(dh>.8) moves.push('\u5347\u9ad8'+dh.toFixed(1)+'m'); else if(dh<-.8) moves.push('\u4e0b\u964d'+(-dh).toFixed(1)+'m');
    if(!moves.length) moves.push('\u5e73\u79fb\u8ddf\u968f');
  }
  const speed=L<.3?'':(v<.4?'\u6781\u7f13\u6162':v<1?'\u7f13\u6162':v<2.5?'\u4e2d\u901f':'\u5feb\u901f');
  const h=st.cam0.y;
  const p0=manual?ensureCamKeys(s)[0].pitch:(s.pitch||0);
  const pitch=manual
    ? (p0>10?'\u4ef0\u62cd'+p0+'\u00b0':p0<-10?'\u4fef\u62cd'+(-p0)+'\u00b0':'\u5e73\u62cd')
    : (h<st.tgt0.y-.25?'\u4ef0\u62cd':h>st.tgt0.y+2?'\u4fef\u62cd':'\u5e73\u62cd');
  const hdesc=h<.9?'\u6781\u4f4e\u673a\u4f4d':h<1.4?'\u4f4e\u673a\u4f4d':h<2.2?'\u5e38\u89c4\u673a\u4f4d':h<4?'\u9ad8\u673a\u4f4d':'\u4fef\u77b0\u673a\u4f4d';
  const jb=d=>{const fr=1.75/(2*d*Math.tan(fov0*Math.PI/360)); return fr>1.1?'\u7279\u5199':fr>.65?'\u8fd1\u666f':fr>.4?'\u4e2d\u666f':fr>.22?'\u5168\u666f':'\u8fdc\u666f'};
  const posx=x=>x<-.3?'\u753b\u9762\u5de6\u4fa7':x>.3?'\u753b\u9762\u53f3\u4fa7':'\u753b\u9762\u4e2d\u90e8';
  /* Actor/prop blocking: explicit motion state + count declaration + prop naming (field feedback: anything undeclared gets improvised by the model) */
  const charLines=[], propLines=[], countParts=[];
  st.ndc0.forEach((c,i)=>{
    const c1=st.ndc1[i];
    const moveDist=c.world.distanceTo(c1.world);
    const moved=moveDist>0.3;
    if(c.kind==='char'){
      countParts.push(`\u3010\u89d2\u8272:${c.label}\u3011\u4ec51\u4e2a`);
      if(!c.visible&&(!c1||!c1.visible)){ charLines.push(`\u3010\u89d2\u8272:${c.label}\u3011\u5728\u753b\u5916,\u4e0d\u51fa\u73b0\u5728\u753b\u9762\u4e2d`); return; }
      /* Rider: declare the person rides on the mount and moves with it (both spatial relation and motion come from the mount) */
      if(c.mount){
        const hostA=runtimeActorByLabel(c.mount);
        const hn=hostA?(['horse','seahorse'].includes(hostA.kind)?'\u52a8\u7269':hostA.kind==='car'?'\u8f66\u8f86':'\u9053\u5177'):'\u9053\u5177';
        const rideWord=hostA&&['horse','seahorse'].includes(hostA.kind)?'\u9a91':'\u4e58\u5750';
        let t=`\u3010\u89d2\u8272:${c.label}\u3011${rideWord}\u5728\u3010${hn}:${c.mount}\u3011\u4e0a,\u4f4d\u4e8e${posx(c.x)}(${jb(c.dist)})`;
        t+=moved?`,\u968f\u5750\u9a91\u4ee5\u7ea6${(moveDist/s.dur).toFixed(1)}m/s \u4ece${posx(c.x)}\u79fb\u52a8\u5230${posx(c1.x)},\u5168\u7a0b\u4e0d\u4e0b${hostA&&hostA.kind==='car'?'\u8f66':hostA&&hostA.kind==='seahorse'?'\u6d77\u9a6c':'\u9a6c'}`
          :`,\u4eba\u4e0e\u5750\u9a91\u4fdd\u6301\u539f\u5730`;
        charLines.push(t);
        return;
      }
      const pz=poseText(c.pose||'stand'), standing=(c.pose||'stand')==='stand';
      let t=`\u3010\u89d2\u8272:${c.label}\u3011\u4f4d\u4e8e${posx(c.x)}(${jb(c.dist)}${standing?'':'\u3001'+pz})`;
      t+=moved?(standing?`,\u4ee5\u7ea6${(moveDist/s.dur).toFixed(1)}m/s \u4ece${posx(c.x)}\u8d70\u5411${posx(c1.x)}`
          :`,\u4fdd\u6301${pz}\u4e0d\u8d77\u8eab,\u968f\u9884\u6f14\u8def\u7ebf\u4ece${posx(c.x)}\u79fb\u52a8\u5230${posx(c1.x)}`)
        :(standing?`,\u4fdd\u6301\u539f\u5730\u7ad9\u7acb\u3001\u65e0\u4f4d\u79fb`:`,\u5168\u7a0b\u4fdd\u6301${pz}\u3001\u65e0\u4f4d\u79fb\u4e0d\u8d77\u8eab`);
      charLines.push(t);
    } else {
      if(c.kind==='board') return;   // boards ARE the background; the "scene follows the reference video" sentence covers them
      if(!c.visible&&(!c1||!c1.visible)) return;
      if(c.kind==='horse') countParts.push(`\u3010\u52a8\u7269:${c.label}\u3011\u4ec51\u5339`);
      if(c.kind==='seahorse') countParts.push(`\u3010\u52a8\u7269:${c.label}\u3011\u4ec51\u53ea`);
      const isEnv=ENV_KINDS.includes(c.kind);
      const noun=c.kind==='car'?'\u8f66\u8f86':['horse','seahorse'].includes(c.kind)?'\u52a8\u7269':isEnv?'\u73af\u5883':'\u9053\u5177';
      propLines.push(`\u3010${noun}:${c.label}\u3011\u4f4d\u4e8e${posx(c.x)}${moved?`,\u6309\u9884\u6f14\u8def\u7ebf\u79fb\u52a8`:isEnv?`,\u4e3a\u56fa\u5b9a\u5e03\u666f\u3001\u4e0d\u79fb\u52a8\u4e0d\u53d8\u5f62`:`,\u4fdd\u6301\u9759\u6b62`}`);
    }
  });
  const lockActor=runtimeActorByLabel(s.lock);
  const mk=manual?ensureCamKeys(s):[],mk0=mk[0],mk1=mk[mk.length-1];
  const lockText=manual?`\u6309${mk.length}\u4e2a\u624b\u52a8\u673a\u4f4d\u5173\u952e\u5e27\u62cd\u6444(\u65b9\u4f4d${Math.round(mk0.yaw)}\u00b0\u2192${Math.round(mk1.yaw)}\u00b0,\u4fef\u4ef0${Math.round(mk0.pitch)}\u00b0\u2192${Math.round(mk1.pitch)}\u00b0),\u4e0d\u5f3a\u5236\u8ddf\u968f\u5bf9\u8c61`
    :(s.lock==='\u5168\u5c40'?'\u4e0d\u9501\u5b9a\u5bf9\u8c61,\u4fdd\u6301\u5168\u5c40\u6784\u56fe'
    :`\u5168\u7a0b\u9501\u5b9a\u8ddf\u62cd\u3010${lockActor&&lockActor.kind!=='char'?(lockActor.kind==='car'?'\u8f66\u8f86':lockActor.kind==='seahorse'?'\u52a8\u7269':'\u9053\u5177'):'\u89d2\u8272'}:${s.lock}\u3011`);
  const bgActive=hasBg()||actors.some(a=>a.kind==='board');
  const sun=currentSun(),sunAz=Math.atan2(sun.pos[0],sun.pos[2])*180/Math.PI,sunEl=Math.atan2(sun.pos[1],Math.hypot(sun.pos[0],sun.pos[2]))*180/Math.PI;
  const tempDesc=sun.temp<4000?'\u6696\u8272\u4f4e\u8272\u6e29':sun.temp>7000?'\u51b7\u8272\u9ad8\u8272\u6e29':'\u81ea\u7136\u65e5\u5149';
  const lightText=sun.enabled
    ?`\u4f7f\u7528${tempDesc}\u592a\u9633\u5149(${Math.round(sun.temp)}K),\u592a\u9633\u65b9\u4f4d\u7ea6${Math.round(sunAz)}\u00b0\u3001\u9ad8\u5ea6\u7ea6${Math.round(sunEl)}\u00b0,\u4eba\u7269\u3001\u9053\u5177\u4e0e\u73af\u5883\u4ea7\u751f\u65b9\u5411\u4e00\u81f4\u4e14\u7b26\u5408\u906e\u6321\u5173\u7cfb\u7684\u81ea\u7136\u9634\u5f71\u3002\n`
    :`\u4f7f\u7528\u5747\u5300\u67d4\u548c\u73af\u5883\u5149,\u4e0d\u51fa\u73b0\u660e\u786e\u592a\u9633\u76f4\u5c04\u9634\u5f71\u3002\n`;
  return `\u3010\u4efb\u52a1\u7c7b\u578b\u3011\u89c6\u9891\u7247\u6bb5\u521b\u4f5c\n`
    +`\u3010\u751f\u6210\u65f6\u957f\u3011${s.dur.toFixed(0)}\u79d2\n`
    +`\u3010\u751f\u6210\u9700\u6c42\u3011\u57fa\u4e8e\u3010@\u89c6\u98911\u3011\u63d0\u4f9b\u7684\u8fd0\u955c\u8f68\u8ff9\u3001\u901f\u5ea6\u4e0e\u4eba\u7269\u8d70\u4f4d\u7a7a\u95f4\u5173\u7cfb,\u751f\u6210\u4e00\u4e2a${s.dur.toFixed(0)}\u79d2\u7684${$('aspect').value}\u89c6\u9891\u3002`
    +(bgActive
      ?`\u573a\u666f\u73af\u5883\u4ee5\u3010@\u89c6\u98911\u3011\u753b\u9762\u4e2d\u7684\u771f\u5b9e\u80cc\u666f\u4e3a\u51c6:\u4fdd\u6301\u73af\u5883\u3001\u5efa\u7b51\u4e0e\u5730\u8c8c\u4e00\u81f4,\u4e0d\u91cd\u65b0\u8bbe\u8ba1\u573a\u666f(\u53ef\u5728\u6b64\u8865\u5145:\u5149\u7ebf\u6c1b\u56f4\u3001\u753b\u9762\u98ce\u683c)\u3002\n`
      :`\u573a\u666f\u4e3a(\u5728\u6b64\u8865\u5145:\u73af\u5883\u3001\u65f6\u4ee3\u3001\u753b\u9762\u98ce\u683c\u3001\u5149\u7ebf\u6c1b\u56f4)\u3002\n`)
    +lightText
    +`\u753b\u9762\u4e2d,${charLines.join(';')||'\u65e0\u89d2\u8272'}${propLines.length?';'+propLines.join(';'):''}\u3002\n`
    +`${countParts.length?`\u89d2\u8272\u6570\u91cf\u56fa\u5b9a:${countParts.join('\u3001')};\u82e5\u53c2\u8003\u56fe\u4e3a\u591a\u59ff\u6001\u4eba\u7269\u677f,\u5747\u4e3a\u540c\u4e00\u89d2\u8272\u7684\u4e0d\u540c\u59ff\u6001,\u753b\u9762\u4e2d\u53ea\u51fa\u73b0\u4e00\u6b21\u3002\n`:''}`
    +`\u4f7f\u7528\u7b49\u6548\u7126\u8ddd\u7ea6${f}mm\u7684${fdesc}\u955c\u5934,${hdesc}(\u9ad8${h.toFixed(1)}m)${pitch}\u3002`
    +`\u8fd0\u955c\u65b9\u5f0f:${moves.join('\u3001')}${speed?`,${speed}\u8fd0\u955c(\u7ea6${v.toFixed(1)}m/s,\u8def\u5f84${L.toFixed(1)}m)`:''},\u6444\u5f71\u673a${lockText}\u3002\n`
    /* v2.1: gait-hedging declaration (R2 field test: the mannequin's mechanical gait gets style-transferred onto real humans) */
    +(charLines.some(l=>l.includes('m/s'))?`\u4eba\u7269\u884c\u8d70\u4e0e\u52a8\u4f5c\u91c7\u7528\u81ea\u7136\u771f\u5b9e\u7684\u4eba\u7c7b\u59ff\u6001(\u91cd\u5fc3\u8d77\u4f0f\u3001\u819d\u76d6\u5f2f\u66f2\u3001\u624b\u81c2\u81ea\u7136\u6446\u52a8);\u53c2\u8003\u89c6\u9891\u4e2d\u7684\u7d20\u6a21\u4eba\u5076\u4ec5\u63d0\u4f9b\u8d70\u4f4d\u3001\u901f\u5ea6\u4e0e\u8282\u594f,\u4e0d\u8981\u590d\u523b\u5176\u673a\u68b0\u6b65\u6001\u3002\n`:'')
    +`\u9664\u4e0a\u8ff0\u6307\u5b9a\u8fd0\u52a8\u5916,\u6240\u6709\u89d2\u8272\u4e0e\u7269\u4f53\u4fdd\u6301\u539f\u4f4d;\u4e0d\u8981\u65b0\u589e\u672a\u63d0\u53ca\u7684\u89d2\u8272\u3001\u751f\u7269\u6216\u8f66\u8f86\u3002\u4e94\u5b98\u6e05\u6670\u4e0d\u53d8\u5f62\u3001\u52a8\u4f5c\u81ea\u7136\u6d41\u7545\u3001\u753b\u9762\u7a33\u5b9a\u3002`;
}
function updatePrompt(){ const el=$('promptView'); if(el) el.textContent=genPrompt(); }

/* RefreshHub topic registration \u2014 moved from the app.js registration block with its
 * function (P5); the other 21 topics stay in app.js until their modules migrate. */
refresh.register('prompt',updatePrompt);

export { focalOf, charNDC, sampleShotState, genPrompt, updatePrompt };
