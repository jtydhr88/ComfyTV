/*
 * core/timing-math.js — time-sampling and easing math (subsystem E, refactor P1).
 * Pure functions moved verbatim from src/app.js (bodies byte-identical, ADR-0007).
 * No DOM access. The P1 transitional free references to app.js globals
 * (distributedPathTimes, ensureCamKeys, ensureCamAimTimes, ensureCamFovTimes,
 * ensureEaseArray, cameraKeyProgress) became real imports from core/project-data.js
 * in P2 (ADR-0008) — a deliberate core-internal cycle with that module (it imports
 * normalizeEaseSpec from here); all cross-module references are call-time function
 * calls, safe under ESM/esbuild evaluation order. Remaining free reference:
 *   - THREE                                  (vendor bundle, global by contract)
 * Camera path support: smooth Catmull-Rom or per-segment lines (actorCurve); both are
 * sampled at constant speed by arc length. Point-indexed sampling keeps the same
 * normalized progress on same-index control points regardless of segment lengths.
 */
import {
  distributedPathTimes,
  ensureCamKeys,
  ensureCamAimTimes,
  ensureCamFovTimes,
  ensureEaseArray,
  cameraKeyProgress,
} from './project-data.js';
function normalizeEaseSpec(spec){
  if(typeof spec==='string')return {type:spec};
  const type=['constant','linear','easeIn','easeOut','easeInOut','custom'].includes(spec?.type)?spec.type:'linear';
  return type==='custom'?{type,x1:Math.max(0,Math.min(1,+spec.x1||.33)),y1:Math.max(0,Math.min(1,+spec.y1||0)),x2:Math.max(0,Math.min(1,+spec.x2||.67)),y2:Math.max(0,Math.min(1,+spec.y2||1))}:{type};
}
function cubicBezierEase(x,spec){
  const x1=spec.x1,y1=spec.y1,x2=spec.x2,y2=spec.y2;
  const bez=(t,a,b)=>3*(1-t)*(1-t)*t*a+3*(1-t)*t*t*b+t*t*t;
  let lo=0,hi=1;for(let i=0;i<18;i++){const m=(lo+hi)/2;if(bez(m,x1,x2)<x)lo=m;else hi=m;}return bez((lo+hi)/2,y1,y2);
}
function applyEaseSpec(spec,t){
  t=Math.max(0,Math.min(1,t));spec=normalizeEaseSpec(spec);
  if(spec.type==='easeIn')return t*t;
  if(spec.type==='easeOut')return 1-(1-t)*(1-t);
  if(spec.type==='easeInOut')return t*t*(3-2*t);
  if(spec.type==='custom')return cubicBezierEase(t,spec);
  return t;
}
function segmentArcParameter(curve,segment,count,ratio){
  if(!curve||count<2)return (segment+ratio)/Math.max(1,count-1);
  const u0=segment/(count-1),u1=(segment+1)/(count-1),samples=30,us=[u0],lens=[0];let total=0,prev=curve.getPoint(u0);
  for(let i=1;i<=samples;i++){const u=u0+(u1-u0)*i/samples,p=curve.getPoint(u);total+=p.distanceTo(prev);us.push(u);lens.push(total);prev=p;}
  const target=total*ratio;let i=1;while(i<lens.length&&lens[i]<target)i++;if(i>=lens.length)return u1;
  const f=(target-lens[i-1])/Math.max(1e-6,lens[i]-lens[i-1]);return us[i-1]+(us[i]-us[i-1])*f;
}
function timedPathState(points,times,at,eases,curve){
  const n=points.length;if(n<2)return {u:0,active:false,segment:0,local:0};
  at=+at||0;times=times&&times.length===n?times:distributedPathTimes(points,0,1);
  if(at<=times[0])return {u:0,active:false,segment:0,local:0};
  if(at>=times[n-1])return {u:1,active:false,segment:n-2,local:1};
  let i=0;while(i<n-2&&at>times[i+1])i++;
  const raw=Math.max(0,Math.min(1,(at-times[i])/Math.max(.001,times[i+1]-times[i]))),spec=normalizeEaseSpec(eases?.[i]||'linear'),local=applyEaseSpec(spec,raw);
  const u=spec.type==='constant'?segmentArcParameter(curve,i,n,raw):(i+local)/(n-1);
  return {u,active:true,segment:i,local,raw};
}
function timedValueState(values,times,at,eases){
  const n=values.length;if(!n)return {i:0,f:0};if(n===1)return {i:0,f:0};
  if(at<=times[0])return {i:0,f:0};if(at>=times[n-1])return {i:n-2,f:1};let i=0;while(i<n-2&&at>times[i+1])i++;
  return {i,f:applyEaseSpec(eases?.[i]||'linear',(at-times[i])/Math.max(.001,times[i+1]-times[i]))};
}
function curveProgressAtControlPoint(curve,point,index,total){
  if(index<=0)return 0;if(index>=total-1)return 1;
  let best=0,bestD=Infinity;
  for(let i=0;i<=240;i++){const u=i/240,d=curve.getPointAt(u).distanceToSquared(point);if(d<bestD){bestD=d;best=u;}}
  return best;
}
function unwrapAngles(values){
  const out=[values[0]||0];
  for(let i=1;i<values.length;i++){
    let v=values[i]||0, prev=out[i-1];
    while(v-prev>180)v-=360; while(v-prev<-180)v+=360; out.push(v);
  }
  return out;
}
function hermiteAt(values,us,u){
  if(values.length<2)return values[0]||0;
  let i=0; while(i<us.length-2&&u>us[i+1])i++;
  const u0=us[i],u1=us[i+1],h=Math.max(1e-6,u1-u0),x=Math.max(0,Math.min(1,(u-u0)/h));
  const slope=j=>{
    if(j<=0)return (values[1]-values[0])/Math.max(1e-6,us[1]-us[0]);
    if(j>=values.length-1)return (values[j]-values[j-1])/Math.max(1e-6,us[j]-us[j-1]);
    return (values[j+1]-values[j-1])/Math.max(1e-6,us[j+1]-us[j-1]);
  };
  const x2=x*x,x3=x2*x;
  return (2*x3-3*x2+1)*values[i]+(x3-2*x2+x)*h*slope(i)+(-2*x3+3*x2)*values[i+1]+(x3-x2)*h*slope(i+1);
}
function sampleCameraKey(s,u,nodeAligned=false){
  const keys=ensureCamKeys(s),us=nodeAligned?keys.map((_,i)=>keys.length<2?0:i/(keys.length-1)):cameraKeyProgress(s);
  return {
    yaw:hermiteAt(unwrapAngles(keys.map(k=>k.yaw||0)),us,u),
    pitch:Math.max(-85,Math.min(85,hermiteAt(keys.map(k=>k.pitch||0),us,u))),
    fov:Math.max(10,Math.min(110,hermiteAt(keys.map(k=>k.fov||s.fov||40),us,u)))
  };
}
function sampleTimedCameraKey(s,at){
  const keys=ensureCamKeys(s),aim=timedValueState(keys,ensureCamAimTimes(s),at,ensureEaseArray(s,'camAimEase',Math.max(0,keys.length-1))),fov=timedValueState(keys,ensureCamFovTimes(s),at,ensureEaseArray(s,'camFovEase',Math.max(0,keys.length-1)));
  const a=keys[aim.i]||keys[0],b=keys[Math.min(keys.length-1,aim.i+1)]||a,fa=aim.f;
  let dy=(b.yaw||0)-(a.yaw||0);while(dy>180)dy-=360;while(dy<-180)dy+=360;
  const c=keys[fov.i]||keys[0],d=keys[Math.min(keys.length-1,fov.i+1)]||c;
  return {yaw:(a.yaw||0)+dy*fa,pitch:Math.max(-85,Math.min(85,(a.pitch||0)+((b.pitch||0)-(a.pitch||0))*fa)),fov:Math.max(10,Math.min(110,(c.fov||s.fov||40)+((d.fov||s.fov||40)-(c.fov||s.fov||40))*fov.f))};
}
function actorCurve(a){
  if(!a || a.pathPts.length<2) return null;
  if(a.pathMode==='line'){
    const cv=new THREE.CurvePath();
    for(let i=0;i<a.pathPts.length-1;i++) cv.add(new THREE.LineCurve3(a.pathPts[i],a.pathPts[i+1]));
    return cv;
  }
  return new THREE.CatmullRomCurve3(a.pathPts,false,'centripetal');
}
function pointIndexedPosition(points,mode,curve,u){
  u=Math.max(0,Math.min(1,u));
  if(!points.length)return new THREE.Vector3();
  if(points.length===1)return points[0].clone();
  if(mode!=='line')return curve.getPoint(u);
  const q=u*(points.length-1),i=Math.min(points.length-2,Math.floor(q)),f=q-i;
  return points[i].clone().lerp(points[i+1],f);
}
function pointIndexedTangent(points,mode,curve,u){
  u=Math.max(0,Math.min(.999999,u));
  if(points.length<2)return new THREE.Vector3(0,0,1);
  if(mode!=='line')return curve.getTangent(u);
  const i=Math.min(points.length-2,Math.floor(u*(points.length-1)));
  return points[i+1].clone().sub(points[i]).normalize();
}
function inverseSmoothProgress(u){
  u=Math.max(0,Math.min(1,u));let lo=0,hi=1;
  for(let i=0;i<24;i++){const m=(lo+hi)/2,v=m*m*(3-2*m);if(v<u)lo=m;else hi=m;}
  return (lo+hi)/2;
}
function nodeArrivalTime(index,count,dur){return count<2?0:inverseSmoothProgress(index/(count-1))*dur;}

export {
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
};
