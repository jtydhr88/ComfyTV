/*
 * core/reframe.js — canonical 9:16 shot reframing and shared render projection.
 *
 * The persisted contract is intentionally narrow:
 *   shot.reframeByAspect['9:16'] = {offsetX, offsetY, zoom}
 * A missing value and every non-9:16 aspect resolve to identity. Camera tracks,
 * FOV, timing, and authored camera points are never changed by these helpers.
 */

const REFRAME_ASPECT='9:16';
const REFRAME_OFFSET_MIN=-1;
const REFRAME_OFFSET_MAX=1;
const REFRAME_ZOOM_MIN=1;
const REFRAME_ZOOM_MAX=4;
const REFRAME_IDENTITY=Object.freeze({offsetX:0,offsetY:0,zoom:1});

function clampReframeNumber(value,min,max,fallback=min){
  const number=Number(value);
  return Number.isFinite(number)?Math.max(min,Math.min(max,number)):fallback;
}
function copyReframe(value=REFRAME_IDENTITY){
  return {offsetX:value.offsetX,offsetY:value.offsetY,zoom:value.zoom};
}
function reframeIsIdentity(value){
  return !!value&&value.offsetX===0&&value.offsetY===0&&value.zoom===1;
}
function normalizeReframeValue(value,{strict=false,path='reframe'}={}){
  if(!value||typeof value!=='object'||Array.isArray(value)){
    if(strict)throw new TypeError(path);
    return copyReframe();
  }
  const keys=Object.keys(value);
  if(strict&&(keys.length!==3||!keys.includes('offsetX')||!keys.includes('offsetY')||!keys.includes('zoom')))throw new TypeError(path);
  const offsetX=Number(value.offsetX),offsetY=Number(value.offsetY),zoom=Number(value.zoom);
  if(strict&&(!Number.isFinite(offsetX)||offsetX<REFRAME_OFFSET_MIN||offsetX>REFRAME_OFFSET_MAX))throw new TypeError(`${path}.offsetX`);
  if(strict&&(!Number.isFinite(offsetY)||offsetY<REFRAME_OFFSET_MIN||offsetY>REFRAME_OFFSET_MAX))throw new TypeError(`${path}.offsetY`);
  if(strict&&(!Number.isFinite(zoom)||zoom<REFRAME_ZOOM_MIN||zoom>REFRAME_ZOOM_MAX))throw new TypeError(`${path}.zoom`);
  return {
    offsetX:clampReframeNumber(offsetX,REFRAME_OFFSET_MIN,REFRAME_OFFSET_MAX,0),
    offsetY:clampReframeNumber(offsetY,REFRAME_OFFSET_MIN,REFRAME_OFFSET_MAX,0),
    zoom:clampReframeNumber(zoom,REFRAME_ZOOM_MIN,REFRAME_ZOOM_MAX,1)
  };
}
function normalizeReframeByAspect(value,{strict=false,path='reframeByAspect'}={}){
  if(value===undefined)return undefined;
  if(!value||typeof value!=='object'||Array.isArray(value)){
    if(strict)throw new TypeError(path);
    return undefined;
  }
  const keys=Object.keys(value);
  if(strict&&keys.some(key=>key!==REFRAME_ASPECT))throw new TypeError(path);
  if(!Object.prototype.hasOwnProperty.call(value,REFRAME_ASPECT))return undefined;
  return {[REFRAME_ASPECT]:normalizeReframeValue(value[REFRAME_ASPECT],{strict,path:`${path}['${REFRAME_ASPECT}']`})};
}
function getShotReframe(shot,aspect=REFRAME_ASPECT){
  if(aspect!==REFRAME_ASPECT)return copyReframe();
  return normalizeReframeValue(shot?.reframeByAspect?.[REFRAME_ASPECT]);
}
function resolveShotReframe(shot,aspect=REFRAME_ASPECT,draft){
  if(aspect!==REFRAME_ASPECT)return copyReframe();
  return normalizeReframeValue(draft||shot?.reframeByAspect?.[REFRAME_ASPECT]);
}
function setShotReframe(shot,value,aspect=REFRAME_ASPECT){
  if(!shot||aspect!==REFRAME_ASPECT)return false;
  const next=normalizeReframeValue(value);
  const previous=getShotReframe(shot,aspect);
  if(previous.offsetX===next.offsetX&&previous.offsetY===next.offsetY&&previous.zoom===next.zoom)return false;
  if(reframeIsIdentity(next)){
    if(shot.reframeByAspect){
      delete shot.reframeByAspect[REFRAME_ASPECT];
      if(!Object.keys(shot.reframeByAspect).length)delete shot.reframeByAspect;
    }
  }else{
    shot.reframeByAspect={[REFRAME_ASPECT]:copyReframe(next)};
  }
  return true;
}
function resetShotReframe(shot,aspect=REFRAME_ASPECT){
  return setShotReframe(shot,REFRAME_IDENTITY,aspect);
}
function computeContainRect(containerWidth,containerHeight,targetAspect){
  const width=Math.max(1,Number(containerWidth)||1),height=Math.max(1,Number(containerHeight)||1);
  const aspect=Number(targetAspect)>0?Number(targetAspect):width/height;
  let renderWidth=width,renderHeight=renderWidth/aspect;
  if(renderHeight>height){renderHeight=height;renderWidth=renderHeight*aspect;}
  return {
    x:(width-renderWidth)/2,
    y:(height-renderHeight)/2,
    width:renderWidth,
    height:renderHeight
  };
}
function computeReframeProjection(width,height,reframe){
  const frameWidth=Math.max(1,Number(width)||1),frameHeight=Math.max(1,Number(height)||1);
  const resolved=normalizeReframeValue(reframe);
  return {
    aspect:frameWidth/frameHeight,
    zoom:resolved.zoom,
    fullWidth:frameWidth,
    fullHeight:frameHeight,
    offsetX:resolved.offsetX*frameWidth*.5,
    offsetY:-resolved.offsetY*frameHeight*.5,
    width:frameWidth,
    height:frameHeight
  };
}
function copyCameraView(view){
  if(!view)return null;
  return {
    enabled:!!view.enabled,fullWidth:view.fullWidth,fullHeight:view.fullHeight,
    offsetX:view.offsetX,offsetY:view.offsetY,width:view.width,height:view.height
  };
}
function snapshotCameraProjection(camera){
  return {aspect:camera.aspect,zoom:camera.zoom,view:copyCameraView(camera.view)};
}
function restoreCameraProjection(camera,state){
  camera.aspect=state.aspect;
  camera.zoom=state.zoom;
  if(state.view&&typeof camera.setViewOffset==='function'){
    camera.setViewOffset(state.view.fullWidth,state.view.fullHeight,state.view.offsetX,state.view.offsetY,state.view.width,state.view.height);
    if(camera.view)camera.view.enabled=state.view.enabled;
  }else if(typeof camera.clearViewOffset==='function')camera.clearViewOffset();
  camera.updateProjectionMatrix();
}
function applyCameraReframe(camera,width,height,reframe){
  const projection=computeReframeProjection(width,height,reframe);
  camera.aspect=projection.aspect;
  camera.zoom=projection.zoom;
  if(typeof camera.setViewOffset==='function'){
    camera.setViewOffset(
      projection.fullWidth,projection.fullHeight,projection.offsetX,projection.offsetY,
      projection.width,projection.height
    );
  }
  camera.updateProjectionMatrix();
  return projection;
}
function rendererBoxSnapshot(renderer,getter){
  if(typeof renderer?.[getter]!=='function')return null;
  const target={x:0,y:0,z:0,w:0,copy(value){this.x=value.x;this.y=value.y;this.z=value.z;this.w=value.w;return this;}};
  const result=renderer[getter](target)||target;
  return {x:result.x,y:result.y,width:result.z,height:result.w};
}
function snapshotRendererFrame(renderer){
  return {
    viewport:rendererBoxSnapshot(renderer,'getViewport'),
    scissor:rendererBoxSnapshot(renderer,'getScissor'),
    scissorTest:typeof renderer?.getScissorTest==='function'?renderer.getScissorTest():false,
    autoClear:renderer?.autoClear
  };
}
function restoreRendererFrame(renderer,state){
  if(state.viewport&&typeof renderer.setViewport==='function')renderer.setViewport(state.viewport.x,state.viewport.y,state.viewport.width,state.viewport.height);
  if(state.scissor&&typeof renderer.setScissor==='function')renderer.setScissor(state.scissor.x,state.scissor.y,state.scissor.width,state.scissor.height);
  if(typeof renderer.setScissorTest==='function')renderer.setScissorTest(state.scissorTest);
  if(state.autoClear!==undefined)renderer.autoClear=state.autoClear;
}
function renderWithResolvedReframe({renderer,scene,camera,width,height,targetAspect=width/height,reframe,contain=false}){
  const cameraState=snapshotCameraProjection(camera),rendererState=snapshotRendererFrame(renderer);
  const frame=contain?computeContainRect(width,height,targetAspect):{x:0,y:0,width,height};
  try{
    applyCameraReframe(camera,frame.width,frame.height,reframe);
    if(typeof renderer.setScissorTest==='function')renderer.setScissorTest(false);
    if(typeof renderer.setViewport==='function')renderer.setViewport(0,0,width,height);
    if(typeof renderer.clear==='function')renderer.clear(true,true,true);
    if(typeof renderer.setViewport==='function')renderer.setViewport(frame.x,frame.y,frame.width,frame.height);
    if(typeof renderer.setScissor==='function')renderer.setScissor(frame.x,frame.y,frame.width,frame.height);
    if(typeof renderer.setScissorTest==='function')renderer.setScissorTest(true);
    renderer.render(scene,camera);
    return {frame,projection:computeReframeProjection(frame.width,frame.height,reframe)};
  }finally{
    restoreRendererFrame(renderer,rendererState);
    restoreCameraProjection(camera,cameraState);
  }
}

export {
  REFRAME_ASPECT,
  REFRAME_IDENTITY,
  REFRAME_OFFSET_MIN,
  REFRAME_OFFSET_MAX,
  REFRAME_ZOOM_MIN,
  REFRAME_ZOOM_MAX,
  copyReframe,
  reframeIsIdentity,
  normalizeReframeValue,
  normalizeReframeByAspect,
  getShotReframe,
  resolveShotReframe,
  setShotReframe,
  resetShotReframe,
  computeContainRect,
  computeReframeProjection,
  snapshotCameraProjection,
  restoreCameraProjection,
  applyCameraReframe,
  snapshotRendererFrame,
  restoreRendererFrame,
  renderWithResolvedReframe
};
