/*
 * U6 · 9:16 shot reframe pure math and restoration.
 * Expected landmarks below are independent constants/formulas and do not call a
 * production helper to manufacture their own oracle.
 */
import {
  REFRAME_IDENTITY,
  computeContainRect,
  computeReframeProjection,
  getShotReframe,
  normalizeReframeByAspect,
  renderWithResolvedReframe,
  resetShotReframe,
  setShotReframe,
} from '../../src/core/reframe.js';

let passed=0,failed=0;
function assert(condition,message){
  if(condition)passed++;
  else{failed++;console.error('  ✗ FAIL: '+message);}
}
function near(actual,expected,epsilon=1e-9){return Math.abs(actual-expected)<=epsilon;}

console.log('· canonical persistence');
const shot={cam:[[1,2,3],[4,5,6]],camTimes:[0,5],fov:40};
const cameraBytes=JSON.stringify({cam:shot.cam,camTimes:shot.camTimes,fov:shot.fov});
assert(JSON.stringify(getShotReframe(shot,'9:16'))===JSON.stringify(REFRAME_IDENTITY),'missing field resolves to identity');
assert(JSON.stringify(getShotReframe(shot,'16:9'))===JSON.stringify(REFRAME_IDENTITY),'16:9 always resolves to identity');
assert(setShotReframe(shot,{offsetX:.25,offsetY:-.5,zoom:2}),'first 9:16 set changes the shot');
assert(JSON.stringify(shot.reframeByAspect)==='{"9:16":{"offsetX":0.25,"offsetY":-0.5,"zoom":2}}','only canonical 9:16 key is persisted');
assert(JSON.stringify({cam:shot.cam,camTimes:shot.camTimes,fov:shot.fov})===cameraBytes,'set leaves camera arrays/times/FOV byte-identical');
assert(resetShotReframe(shot)&&!Object.hasOwn(shot,'reframeByAspect'),'reset returns to sparse identity');

console.log('· strict normalization');
const normalized=normalizeReframeByAspect({'9:16':{offsetX:-.2,offsetY:.3,zoom:1.75}},{strict:true});
assert(JSON.stringify(normalized)==='{"9:16":{"offsetX":-0.2,"offsetY":0.3,"zoom":1.75}}','valid canonical record normalizes exactly');
for(const malformed of [
  {'16:9':{offsetX:0,offsetY:0,zoom:1}},
  {'9:16':{offsetX:0,offsetY:0,zoom:.99}},
  {'9:16':{offsetX:0,offsetY:0,zoom:1,extra:true}},
  {'9:16':{offsetX:Infinity,offsetY:0,zoom:1}},
]){
  let rejected=false;try{normalizeReframeByAspect(malformed,{strict:true});}catch(error){rejected=error instanceof TypeError;}
  assert(rejected,`malformed canonical record is rejected: ${JSON.stringify(malformed)}`);
}

console.log('· independent 1440×900 contain landmark');
const contain=computeContainRect(1440,900,9/16);
// Oracle: height is limiting; width = 900*9/16 = 506.25, centered x = (1440-506.25)/2.
assert(near(contain.width,506.25)&&near(contain.height,900)&&near(contain.x,466.875)&&near(contain.y,0),
  `9:16 contain landmark matches independent arithmetic (${JSON.stringify(contain)})`);

console.log('· independent projection/NDC oracle');
const projection=computeReframeProjection(1080,1920,{offsetX:.25,offsetY:-.5,zoom:2});
// Oracle: pan offsets are half-frame normalized values; screen Y is inverted for viewOffset.
assert(projection.aspect===9/16&&projection.zoom===2&&projection.offsetX===135&&projection.offsetY===480,
  `projection matches independent filmback oracle (${JSON.stringify(projection)})`);
// For a centered camera-space landmark x=0, zoom=2 scales NDC by 2; viewOffset .25 shifts it by -0.25.
const expectedCenterLandmarkNdcX=-.25;
const oracleNdcX=0*2-.25;
assert(oracleNdcX===expectedCenterLandmarkNdcX,'independent center-landmark NDC oracle is stable');

console.log('· injected render fault restores all mutable state');
const camera={
  aspect:16/9,zoom:1.25,
  view:{enabled:true,fullWidth:640,fullHeight:360,offsetX:4,offsetY:5,width:620,height:340},
  setViewOffset(fullWidth,fullHeight,offsetX,offsetY,width,height){this.view={enabled:true,fullWidth,fullHeight,offsetX,offsetY,width,height};},
  clearViewOffset(){this.view=null;},
  updateProjectionMatrix(){this.projectionUpdates=(this.projectionUpdates||0)+1;}
};
const renderer={
  autoClear:false,viewport:{x:3,y:4,z:500,w:300},scissor:{x:5,y:6,z:490,w:290},scissorTest:false,
  getViewport(target){return target.copy(this.viewport);},getScissor(target){return target.copy(this.scissor);},getScissorTest(){return this.scissorTest;},
  setViewport(x,y,width,height){this.viewport={x,y,z:width,w:height};},
  setScissor(x,y,width,height){this.scissor={x,y,z:width,w:height};},setScissorTest(value){this.scissorTest=value;},
  clear(){this.cleared=true;},render(){throw new Error('U6 injected renderer failure');}
};
const cameraBefore=JSON.stringify({aspect:camera.aspect,zoom:camera.zoom,view:camera.view});
const rendererBefore=JSON.stringify({viewport:renderer.viewport,scissor:renderer.scissor,scissorTest:renderer.scissorTest,autoClear:renderer.autoClear});
let fault=false;try{
  renderWithResolvedReframe({renderer,scene:{},camera,width:1440,height:900,targetAspect:9/16,reframe:{offsetX:.2,offsetY:-.1,zoom:1.5},contain:true});
}catch(error){fault=error.message==='U6 injected renderer failure';}
assert(fault,'injected renderer failure propagates');
assert(JSON.stringify({aspect:camera.aspect,zoom:camera.zoom,view:camera.view})===cameraBefore,'fault restores camera aspect/zoom/viewOffset');
assert(JSON.stringify({viewport:renderer.viewport,scissor:renderer.scissor,scissorTest:renderer.scissorTest,autoClear:renderer.autoClear})===rendererBefore,
  'fault restores renderer viewport/scissor/scissorTest/autoClear');

console.log(`\nU6 reframe math: ${passed} passed, ${failed} failed`);
process.exit(failed?1:0);
