/*
 * C7 · Seedance 2.5 white-model profile
 * Pure contract coverage for deterministic sampling, continuation groups,
 * synchronous clay overrides, exactly-once LIFO restoration, and ZIP manifests.
 */
import {
  SEEDANCE_WHITE_MODEL_PROFILE,
  buildSeedanceManifest,
  createSeedanceRestoreLedger,
  assertSeedanceEncodedClip,
  inspectSeedanceMp4,
  normalizeSeedanceMp4Timing,
  parseSeedanceStoredZip,
  planSeedanceWhiteModelPackage,
  seedanceSha256,
  seedanceTimestampScript,
  verifySeedanceZipManifest,
  withSeedanceWhiteModelRender,
} from '../../src/export/seedance-profile.js';
import { makeZip } from '../../src/export/capture.js';
import { bootApp } from './harness/vm-app.mjs';

let passed=0,failed=0;
function assert(condition,message){if(condition)passed++;else{failed++;console.error('  ✗ FAIL: '+message);}}
function expectCode(fn,code,message){let actual='';try{fn();}catch(error){actual=error.code;}assert(actual===code,`${message} (${actual||'no error'})`);}
function bytes(...values){return Uint8Array.from(values);}
function u16(value){return bytes((value>>>8)&255,value&255);}
function text(value){return bytes(...[...value].map(char=>char.charCodeAt(0)));}
function u32(value){return bytes((value>>>24)&255,(value>>>16)&255,(value>>>8)&255,value&255);}
function join(...parts){const length=parts.reduce((sum,part)=>sum+part.length,0),out=new Uint8Array(length);let offset=0;for(const part of parts){out.set(part,offset);offset+=part.length;}return out;}
function box(type,...parts){const payload=join(...parts);return join(u32(payload.length+8),text(type),payload);}
function makeH264Mp4({frameCount=1,timescale=90000,sampleDelta=3750,includeMdat=true,sampleOffsetDelta=0,sampleDescriptionIndex=1,truncateAvcC=false,truncateEntry=false}={}){
  const mdhd=box('mdhd',bytes(0,0,0,0),u32(0),u32(0),u32(timescale),u32(frameCount*sampleDelta),bytes(0,0,0,0));
  const hdlr=box('hdlr',bytes(0,0,0,0),u32(0),text('vide'),bytes(0,0,0,0));
  const avcCData=join(bytes(1,0x64,0,0x1f,0xff,0xe1),u16(2),bytes(0x67,0),bytes(1),u16(2),bytes(0x68,0));
  const avcC=box('avcC',truncateAvcC?avcCData.slice(0,-2):avcCData),entry=join(u32(86+avcC.length),text('avc1'),join(new Uint8Array(6),u16(1),new Uint8Array(70)),avcC),avc1=truncateEntry?entry.slice(0,-1):entry;
  const stsd=box('stsd',bytes(0,0,0,0),u32(1),avc1);
  const stts=box('stts',bytes(0,0,0,0),u32(1),u32(frameCount),u32(sampleDelta));
  const stsz=box('stsz',bytes(0,0,0,0),u32(4),u32(frameCount)),stsc=box('stsc',bytes(0,0,0,0),u32(1),u32(1),u32(frameCount),u32(sampleDescriptionIndex));
  const moovForOffset=offset=>{
    const stco=box('stco',bytes(0,0,0,0),u32(1),u32(offset));
    return box('moov',box('trak',box('tkhd',bytes(0,0,0,0),u32(0),u32(0),u32(1),u32(0)),box('mdia',mdhd,hdlr,box('minf',box('stbl',stsd,stts,stsz,stsc,stco)))));
  };
  const ftyp=box('ftyp',text('isom'),u32(0),text('isom')),placeholder=moovForOffset(0),mdat=box('mdat',new Uint8Array(frameCount*4));
  const moov=moovForOffset(ftyp.length+placeholder.length+8+sampleOffsetDelta);
  return includeMdat?join(ftyp,moov,mdat):join(ftyp,moov);
}
function makeFragmentedH264Mp4({frameCount=1,fragmentFrames=null,fragmentDecodeTimes=null,timescale=90000,sampleDelta=3750,durationSource='trex',tfhdSampleDescriptionIndex=null,trexSampleDescriptionIndex=1,truncateRun=false,includeMfra=false,includeSidx=false,includeElst=false}={}){
  const fragmentCounts=fragmentFrames||[frameCount],decodeTimes=fragmentDecodeTimes||fragmentCounts.map((_,index)=>fragmentCounts.slice(0,index).reduce((sum,count)=>sum+count,0)*sampleDelta);
  const avcCData=join(bytes(1,0x64,0,0x1f,0xff,0xe1),u16(2),bytes(0x67,0),bytes(1),u16(2),bytes(0x68,0));
  const avcC=box('avcC',avcCData),avc1=join(u32(86+avcC.length),text('avc1'),join(new Uint8Array(6),u16(1),new Uint8Array(70)),avcC);
  const stsd=box('stsd',bytes(0,0,0,0),u32(1),avc1),mdhd=box('mdhd',bytes(0,0,0,0),u32(0),u32(0),u32(timescale),u32(0),bytes(0,0,0,0)),hdlr=box('hdlr',bytes(0,0,0,0),u32(0),text('vide'),bytes(0,0,0,0));
  const trex=box('trex',bytes(0,0,0,0),u32(1),u32(trexSampleDescriptionIndex),u32(sampleDelta),u32(4),u32(0));
  const edit=includeElst?box('edts',box('elst',bytes(0,0,0,0),u32(1),u32(fragmentCounts.reduce((sum,count)=>sum+count,0)*sampleDelta),u32(0),u16(1),u16(0))):new Uint8Array();
  const moov=box('moov',box('trak',box('tkhd',bytes(0,0,0,0),u32(0),u32(0),u32(1),u32(0)),edit,box('mdia',mdhd,hdlr,box('minf',box('stbl',stsd)))),box('mvex',trex));
  const makeMoof=(count,decodeTime,dataOffset)=>{
    const tfhdFlags=0x00020000|(tfhdSampleDescriptionIndex===null?0:2)|(durationSource==='tfhd'?0x18:0),tfhd=box('tfhd',u32(tfhdFlags),u32(1),...(tfhdSampleDescriptionIndex===null?[]:[u32(tfhdSampleDescriptionIndex)]),...(durationSource==='tfhd'?[u32(sampleDelta),u32(4)]:[]));
    const trunFlags=0x000001|(durationSource==='trun'?0x300:0),runPayload=join(u32(trunFlags),u32(count),u32(dataOffset),...(durationSource==='trun'?Array.from({length:count},()=>join(u32(sampleDelta),u32(4))):[]));
    return box('moof',box('traf',tfhd,box('tfdt',bytes(0,0,0,0),u32(decodeTime)),box('trun',truncateRun?runPayload.slice(0,-2):runPayload)));
  };
  const ftyp=box('ftyp',text('isom'),u32(0),text('isom')),segments=[],moofStarts=[];let fileOffset=ftyp.length+moov.length+(includeSidx?24:0);
  fragmentCounts.forEach((count,index)=>{const placeholder=makeMoof(count,decodeTimes[index],0),moof=makeMoof(count,decodeTimes[index],placeholder.length+8),mdat=box('mdat',new Uint8Array(count*4));moofStarts.push(fileOffset);segments.push(moof,mdat);fileOffset+=moof.length+mdat.length;});
  let mfra=new Uint8Array();if(includeMfra){const tfraEntries=join(...moofStarts.map((moofStart,index)=>join(u32(decodeTimes[index]),u32(moofStart),bytes(1,1,1)))),tfra=box('tfra',bytes(0,0,0,0),u32(1),u32(0),u32(moofStarts.length),tfraEntries),mfraSize=8+tfra.length+16;mfra=box('mfra',tfra,box('mfro',bytes(0,0,0,0),u32(mfraSize)));}
  return join(ftyp,moov,...(includeSidx?[box('sidx',new Uint8Array(16))]:[]),...segments,mfra);
}
function mp4ForPlan(T,index=0){const target=T.captureTransaction?.target,clips=target?.plan?.clips||[],clip=clips[Math.min(index,Math.max(0,clips.length-1))];if(clip)return makeH264Mp4({frameCount:clip.frameCount,sampleDelta:90000/clip.fps});const fps=target?.fps,frameCount=Math.max(2,Math.round(target.duration*fps)+1);return makeH264Mp4({frameCount,sampleDelta:90000/fps});}
function installStartEventTarget(recorder){
  const listeners=new Set();
  recorder.addEventListener=(type,listener,options={})=>{if(type==='start')listeners.add({listener,once:options?.once===true});};
  recorder.removeEventListener=(type,listener)=>{if(type==='start')for(const entry of listeners){if(entry.listener===listener)listeners.delete(entry);}};
  recorder.emitStart=()=>{for(const entry of [...listeners]){entry.listener.call(recorder,{type:'start',target:recorder});if(entry.once)listeners.delete(entry);}};
  return recorder;
}
function createControlledScheduler(){
  let now=0,sequence=0;const timers=[];
  const set=(fn,delay=0)=>{const timer={id:++sequence,at:now+Number(delay||0),fn,canceled:false};timers.push(timer);return timer;};
  const clear=timer=>{if(timer)timer.canceled=true;};
  const advanceTo=target=>{for(;;){const due=timers.filter(timer=>!timer.canceled&&timer.at<=target).sort((a,b)=>a.at-b.at||a.id-b.id)[0];if(!due)break;due.canceled=true;now=due.at;due.fn();}now=target;};
  const runAll=()=>{while(timers.some(timer=>!timer.canceled)){const next=timers.filter(timer=>!timer.canceled).sort((a,b)=>a.at-b.at||a.id-b.id)[0];advanceTo(next.at);}};
  return {now:()=>now,set,clear,every:set,clearEvery:clear,advanceTo,runAll,elapse:duration=>{now+=Number(duration)||0;},pending:()=>timers.filter(timer=>!timer.canceled).map(timer=>timer.at)};
}

console.log('· deterministic clip and sampling planner');
const shotPlan=planSeedanceWhiteModelPackage({scope:'shot',sceneIndex:2,shotIndex:4,aspect:'9:16',shots:[{index:4,duration:5,reframe:{offsetX:.2,offsetY:-.1,zoom:1.4}}]});
assert(shotPlan.resolution.join('x')==='1080x1920'&&shotPlan.clips.length===1&&shotPlan.totalFrames===120,'9:16 five-second shot uses the 120-sample half-open 24fps media contract');
assert(shotPlan.clips[0].frames[0].localTime===0&&Math.abs(shotPlan.clips[0].frames.at(-1).localTime-(5-1/24))<1e-6,'shot sampling freezes 0s through the final representable 24fps sample without inventing an extra endpoint frame');
assert(shotPlan.clips[0].frames.every((frame,index)=>frame.globalFrame===index&&frame.frame===index),'globalFrame and clip frame are monotonic and gap-free');
const script=seedanceTimestampScript(shotPlan);
assert(script.clips[0].frames.length===shotPlan.clips[0].frameCount&&script.clips[0].frames[37].localTime===shotPlan.clips[0].frames[37].localTime,'timestamp script is derived byte-for-byte from planner samples');

for(const duration of [29.501,29.999,30,30.001,60]){
  expectCode(()=>planSeedanceWhiteModelPackage({shots:[{index:0,duration}]}),'SEEDANCE_SHOT_TOO_LONG',`shot ${duration}s is rejected before capture`);
}
expectCode(()=>planSeedanceWhiteModelPackage({shots:[]}),'SEEDANCE_SHOTS_EMPTY','shots=[] is rejected before capture');
const neutral=planSeedanceWhiteModelPackage({shots:[{index:0,duration:.5}]});
assert(neutral.clips.length===1&&neutral.clips[0].frameCount===12,'empty-content neutral shot remains exportable when a valid shot exists');

function groups(durations){return planSeedanceWhiteModelPackage({scope:'scene',shots:durations.map((duration,index)=>({index,duration}))}).continuationGroups.map(group=>group.duration);}
assert(JSON.stringify(groups([12,18]))===JSON.stringify([30]),'12+18 stays in one deterministic continuation group');
assert(JSON.stringify(groups([12,18.001]))===JSON.stringify([12,18.001]),'12+18.001 deterministically continues in a second group');
assert(JSON.stringify(groups([10,10,10]))===JSON.stringify([30]),'10+10+10 stays in one exact 30s group');
assert(JSON.stringify(groups([12,19,5]))===JSON.stringify([12,24]),'12+19+5 greedily creates deterministic 12 / 24 groups without truncation');
const scenePlan=planSeedanceWhiteModelPackage({scope:'scene',sceneIndex:0,shots:[{index:0,duration:12},{index:1,duration:19},{index:2,duration:5}]});
const sceneFrames=scenePlan.clips.flatMap(clip=>clip.frames);
assert(new Set(sceneFrames.map(frame=>frame.globalFrame)).size===sceneFrames.length&&sceneFrames.every((frame,index)=>frame.globalFrame===index),'whole-scene globalFrame values contain no duplicate or missing indexes');
assert(scenePlan.clips.every(clip=>clip.frames[0].shotIndex===clip.shotIndex&&clip.frames.at(-1).localTime<clip.duration&&clip.duration-clip.frames.at(-1).localTime<=1/24+1e-6),'each scene clip freezes its own shot identity and a final sample within one 24fps period of the source endpoint');

console.log('· LIFO exactly-once restoration ledger');
const order=[],ledger=createSeedanceRestoreLedger('c7'),state={value:'original'};
ledger.push(()=>order.push('first'));ledger.set(state,'value','temporary');ledger.push(()=>order.push('last'));
assert(state.value==='temporary'&&ledger.restore()===true&&state.value==='original','ledger restores the exact original property value');
assert(JSON.stringify(order)===JSON.stringify(['last','first'])&&ledger.restore()===false,'ledger restores in LIFO order exactly once');
expectCode(()=>ledger.push(()=>{}),'SEEDANCE_LEDGER_CLOSED','restored ledger rejects late entries');

console.log('· synchronous one-render clay override');
class Color{constructor(value){this.value=value;}}
class MeshStandardMaterial{constructor(options){Object.assign(this,options);this.disposed=0;}dispose(){this.disposed++;}}
const originalActorMaterial={name:'actor-material',color:{hex:0x2f6bff},map:{id:'actor-map'}},originalGroundMaterial={name:'ground-material'};
const actor={isMesh:true,visible:true,material:originalActorMaterial,children:[]},label={isSprite:true,visible:true,children:[]},ground={isMesh:true,visible:true,material:originalGroundMaterial,children:[]},grid={isLine:true,visible:true,children:[]},sky={isMesh:true,visible:true,material:{name:'sky'},children:[]};
actor.children.push(label);const roots=[actor,ground,grid,sky],scene={background:{name:'background'},fog:{color:{name:'fog'}},traverse(visitor){const walk=node=>{visitor(node);(node.children||[]).forEach(walk);};roots.forEach(walk);}};
const renderer={token:'renderer-original'},camera={token:'camera-original'};let renderCount=0,observed=null;
const result=withSeedanceWhiteModelRender({scene,renderer,camera,sky,ground,helpers:[grid],THREE:{Color,MeshStandardMaterial},snapshotRenderer:value=>({...value}),restoreRenderer:(value,snapshot)=>Object.assign(value,snapshot),snapshotCamera:value=>({...value}),restoreCamera:(value,snapshot)=>Object.assign(value,snapshot),render(){
  renderCount++;observed={actorMaterial:actor.material,labelVisible:label.visible,gridVisible:grid.visible,skyVisible:sky.visible,background:scene.background.value};renderer.token='renderer-mutated';camera.token='camera-mutated';return 'frame';
}});
assert(result==='frame'&&renderCount===1&&observed.actorMaterial!==originalActorMaterial&&observed.actorMaterial.map===null,'clay override wraps exactly one synchronous render with texture-free material');
assert(observed.labelVisible===false&&observed.gridVisible===false&&observed.skyVisible===false&&observed.background===SEEDANCE_WHITE_MODEL_PROFILE.whiteModel.background,'labels, grid, sky and original background are hidden/replaced only inside white render');
assert(actor.material===originalActorMaterial&&ground.material===originalGroundMaterial&&label.visible&&grid.visible&&sky.visible&&scene.background.name==='background'&&scene.fog.color.name==='fog','material identity/map/color/visibility/background/fog restore exactly after render');
assert(renderer.token==='renderer-original'&&camera.token==='camera-original','renderer and camera snapshots restore after render');
let throwRestored=false;try{withSeedanceWhiteModelRender({scene,ground,sky,helpers:[grid],THREE:{Color,MeshStandardMaterial},render(){throw new Error('render fault');}});}catch(error){throwRestored=error.message==='render fault'&&actor.material===originalActorMaterial&&label.visible&&grid.visible&&sky.visible;}
assert(throwRestored,'render throw still restores every object exactly');
expectCode(()=>withSeedanceWhiteModelRender({scene,ground,sky,THREE:{Color,MeshStandardMaterial},render(){return Promise.resolve();}}),'SEEDANCE_RENDER_ASYNC','async material override is rejected and restored immediately');

console.log('· actual encoded-media metadata and ZIP manifest verification');
const encodedFixture=makeH264Mp4({frameCount:shotPlan.clips[0].frameCount}),fixtureMedia=inspectSeedanceMp4(encodedFixture);
assert(fixtureMedia.codec==='H264'&&fixtureMedia.frameCount===120&&Math.abs(fixtureMedia.duration-5)<=1e-6&&fixtureMedia.fps===24,'ISO-BMFF H.264 sample timing is parsed from encoded-media bytes rather than a Blob label');
const slowRecorderFixture=makeH264Mp4({frameCount:120,sampleDelta:3906}),slowRecorderMedia=inspectSeedanceMp4(slowRecorderFixture),normalizedFixture=normalizeSeedanceMp4Timing(slowRecorderFixture,{frameCount:120,fps:24}),normalizedMedia=inspectSeedanceMp4(normalizedFixture);
assert(slowRecorderMedia.duration===5.208&&slowRecorderMedia.fps<24&&normalizedMedia.frameCount===120&&normalizedMedia.duration===5&&normalizedMedia.fps===24&&assertSeedanceEncodedClip(shotPlan.clips[0],normalizedMedia)===normalizedMedia,'container sample timing is normalized to the frozen 24fps plan without changing the exact H.264 sample count');
expectCode(()=>normalizeSeedanceMp4Timing(makeH264Mp4({frameCount:119}),{frameCount:120,fps:24}),'SEEDANCE_MEDIA_MISMATCH','timeline normalization refuses to hide an actual dropped frame');
expectCode(()=>inspectSeedanceMp4(makeH264Mp4({frameCount:121,includeMdat:false})),'SEEDANCE_MEDIA_INVALID','an avc1 sample table without mdat sample bytes is rejected');
expectCode(()=>inspectSeedanceMp4(makeH264Mp4({frameCount:121,truncateEntry:true})),'SEEDANCE_MEDIA_INVALID','a truncated avc1 sample entry is rejected');
expectCode(()=>inspectSeedanceMp4(makeH264Mp4({frameCount:121,sampleOffsetDelta:482})),'SEEDANCE_MEDIA_INVALID','an out-of-range non-fragmented sample offset is rejected');
expectCode(()=>inspectSeedanceMp4(makeH264Mp4({frameCount:121,sampleDescriptionIndex:2})),'SEEDANCE_MEDIA_INVALID','non-fragmented stsc rejects a sample description index that does not select the sole avc1 entry');
for(const durationSource of ['trun','tfhd','trex']){const fragmented=inspectSeedanceMp4(makeFragmentedH264Mp4({frameCount:121,durationSource}));assert(fragmented.frameCount===121&&fragmented.durationTicks===121*3750&&fragmented.fps===24,`fragmented MP4 uses ${durationSource} sample-duration defaults with mdat byte bounds`);}
for(const durationSource of ['trun','tfhd','trex']){const normalizedFragment=inspectSeedanceMp4(normalizeSeedanceMp4Timing(makeFragmentedH264Mp4({frameCount:120,sampleDelta:3906,durationSource}),{frameCount:120,fps:24}));assert(normalizedFragment.frameCount===120&&normalizedFragment.duration===5&&normalizedFragment.fps===24,`fragmented ${durationSource} timing normalizes to the exact 120-frame 24fps container timeline`);}
const gappedFragment=makeFragmentedH264Mp4({fragmentFrames:[81,39],fragmentDecodeTimes:[0,83905],timescale:24000,sampleDelta:1014,durationSource:'trun',includeMfra:true}),gappedMedia=inspectSeedanceMp4(gappedFragment);
assert(gappedMedia.frameCount===120&&gappedMedia.durationTicks===83905+39*1014&&gappedMedia.duration>5.1&&gappedMedia.timelineGapTicks===1771,'fragmented inspection includes tfdt decode gaps instead of hiding them behind summed sample durations');
expectCode(()=>assertSeedanceEncodedClip(shotPlan.clips[0],gappedMedia),'SEEDANCE_MEDIA_MISMATCH','strict validation rejects a fragmented MP4 whose decode timeline contains a gap');
const normalizedGapped=normalizeSeedanceMp4Timing(gappedFragment,{frameCount:120,fps:24}),normalizedGappedMedia=inspectSeedanceMp4(normalizedGapped),tfraNeedle=text('tfra'),tfraTypeAt=normalizedGapped.findIndex((_,index)=>tfraNeedle.every((byte,offset)=>normalizedGapped[index+offset]===byte)),tfraView=new DataView(normalizedGapped.buffer,normalizedGapped.byteOffset,normalizedGapped.byteLength),secondTfraTime=tfraView.getUint32(tfraTypeAt+31,false);
assert(normalizedGappedMedia.duration===5&&normalizedGappedMedia.fps===24&&!normalizedGappedMedia.timelineGapTicks&&!normalizedGappedMedia.timelineOverlapTicks&&secondTfraTime===81000,'multi-moof tfdt and matching mfra/tfra random-access times normalize to one continuous 120-frame timeline');
const overlappingFragment=makeFragmentedH264Mp4({fragmentFrames:[81,39],fragmentDecodeTimes:[0,80000],timescale:24000,sampleDelta:1000,durationSource:'trun'}),overlappingMedia=inspectSeedanceMp4(overlappingFragment);
assert(overlappingMedia.frameCount===120&&overlappingMedia.durationTicks===119000&&overlappingMedia.timelineOverlapTicks===1000,'fragmented inspection persistently exposes a tfdt overlap without treating it as a structurally unreadable MP4');
expectCode(()=>assertSeedanceEncodedClip(shotPlan.clips[0],overlappingMedia),'SEEDANCE_MEDIA_MISMATCH','strict validation rejects a fragmented MP4 whose decode timeline overlaps');
const normalizedOverlap=inspectSeedanceMp4(normalizeSeedanceMp4Timing(overlappingFragment,{frameCount:120,fps:24}));
assert(normalizedOverlap.duration===5&&normalizedOverlap.fps===24&&!normalizedOverlap.timelineGapTicks&&!normalizedOverlap.timelineOverlapTicks&&assertSeedanceEncodedClip(shotPlan.clips[0],normalizedOverlap)===normalizedOverlap,'normalization repairs an exact-sample Chrome-style overlap before strict validation');
expectCode(()=>normalizeSeedanceMp4Timing(makeFragmentedH264Mp4({frameCount:120,includeSidx:true}),{frameCount:120,fps:24}),'SEEDANCE_MEDIA_INVALID','fragmented sidx timing is rejected rather than left stale');
expectCode(()=>normalizeSeedanceMp4Timing(makeFragmentedH264Mp4({frameCount:120,includeElst:true}),{frameCount:120,fps:24}),'SEEDANCE_MEDIA_INVALID','edit-list timing is conservatively rejected rather than partially rewritten');
expectCode(()=>inspectSeedanceMp4(makeFragmentedH264Mp4({frameCount:121,tfhdSampleDescriptionIndex:2})),'SEEDANCE_MEDIA_INVALID','fragmented tfhd rejects a sample description index that does not select the sole avc1 entry');
expectCode(()=>inspectSeedanceMp4(makeFragmentedH264Mp4({frameCount:121,trexSampleDescriptionIndex:2})),'SEEDANCE_MEDIA_INVALID','fragmented trex rejects a default sample description index that does not select the sole avc1 entry');
expectCode(()=>inspectSeedanceMp4(makeFragmentedH264Mp4({frameCount:121,durationSource:'trun',truncateRun:true})),'SEEDANCE_MEDIA_INVALID','a truncated fragmented trun rejects with a media-validation error');
assert(assertSeedanceEncodedClip(shotPlan.clips[0],fixtureMedia)===fixtureMedia,'encoded H.264 metadata is accepted only when it agrees with the deterministic plan');
expectCode(()=>assertSeedanceEncodedClip(shotPlan.clips[0],inspectSeedanceMp4(makeH264Mp4({frameCount:118}))),'SEEDANCE_MEDIA_MISMATCH','frame-drop fault injection blocks an encoded MP4 whose sample table differs from the planner');
expectCode(()=>assertSeedanceEncodedClip(shotPlan.clips[0],inspectSeedanceMp4(makeH264Mp4({frameCount:120,sampleDelta:3734}))),'SEEDANCE_MEDIA_MISMATCH','strict validation rejects a wrong frame rate even when duration remains inside the one-frame clock tolerance');
const encoder=new TextEncoder(),mediaByFilename=new Map([[shotPlan.clips[0].filename,fixtureMedia]]),scriptWithMedia=seedanceTimestampScript(shotPlan,{mediaByFilename}),entries=[
  {name:shotPlan.clips[0].filename,data:encodedFixture,mime:'video/mp4',media:fixtureMedia},
  {name:'02_timestamps.json',data:encoder.encode(JSON.stringify(scriptWithMedia)),mime:'application/json'},
  {name:'03_prompt.txt',data:encoder.encode('@白模1 structure only'),mime:'text/plain;charset=utf-8'},
];
const manifest=buildSeedanceManifest({plan:shotPlan,entries});
const manifestBytes=encoder.encode(JSON.stringify(manifest,null,2));
const zip=makeZip([...entries,{name:'04_manifest.json',data:manifestBytes}]);
const zipBytes=new Uint8Array(await zip.arrayBuffer());
assert(verifySeedanceZipManifest(zipBytes,manifest),'manifest filename/MIME/bytes/SHA-256/order are recomputed from actual ZIP payloads');
assert(manifest.files[0].segment?.planned.resolution==='1080x1920'&&manifest.files[0].segment?.planned.aspect==='9:16'&&manifest.files[0].segment?.actual.frameCount===120&&manifest.files[0].segment?.actual.fps===24,'manifest distinguishes deterministic planned segment fields from parsed encoded-media facts');
assert(manifest.saveMethod==='browser-download'&&manifest.semantics.whiteModel.includes('structure')&&manifest.semantics.appearance==='user-provided-separately','manifest states browser download and separates white structure from later appearance references');
assert(seedanceSha256(encoder.encode('abc'))==='ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad','SHA-256 matches the standard abc vector');
const tampered=zipBytes.slice(),needle=text('avc1'),at=tampered.findIndex((_,index)=>needle.every((byte,offset)=>tampered[index+offset]===byte));if(at>=0)tampered[at]^=1;
expectCode(()=>verifySeedanceZipManifest(tampered,manifest),'SEEDANCE_MANIFEST_MISMATCH','tampered actual ZIP payload is rejected');
const droppedBytes=makeH264Mp4({frameCount:118}),droppedMedia=inspectSeedanceMp4(droppedBytes),forgedManifest=JSON.parse(JSON.stringify(manifest)),forgedScript=JSON.parse(JSON.stringify(scriptWithMedia));
forgedManifest.files[0].bytes=droppedBytes.byteLength;forgedManifest.files[0].sha256=seedanceSha256(droppedBytes);forgedManifest.files[0].segment.actual=droppedMedia;forgedScript.clips[0].actual=droppedMedia;
const forgedTimestamp=encoder.encode(JSON.stringify(forgedScript)),timestampFile=forgedManifest.files.find(file=>file.filename==='02_timestamps.json');timestampFile.bytes=forgedTimestamp.byteLength;timestampFile.sha256=seedanceSha256(forgedTimestamp);
const forgedManifestBytes=encoder.encode(JSON.stringify(forgedManifest)),forgedZip=new Uint8Array(await makeZip([{...entries[0],data:droppedBytes},{...entries[1],data:forgedTimestamp},entries[2],{name:'04_manifest.json',data:forgedManifestBytes}]).arrayBuffer());
expectCode(()=>verifySeedanceZipManifest(forgedZip,forgedManifest),'SEEDANCE_MANIFEST_MISMATCH','planned 120 versus actual 118 is rejected even when ZIP, manifest, and timestamp metadata are self-consistent');

console.log('· real white-model capture transaction and normal-export isolation');
const app=bootApp(),{sandbox,T,el,flushTimeouts}=app;
flushTimeouts();
el('aspect').value='9:16';el('seedanceProfile').value='white-model';el('seedanceScope').value='scene';T.updateSeedanceProfileUI({resetProgress:true});
T.shots.splice(3);T.shots.forEach((shot,index)=>{
  shot.dur=5;shot.timingMode=['custom','arcLength','pointSync'][index];shot.lock=index===1?'':T.actors[0].label;
  shot.reframeByAspect={'9:16':{offsetX:[-.2,.15,.35][index],offsetY:[.1,-.2,0][index],zoom:[1.1,1.4,1.8][index]}};
});
T.actors.forEach((actor,index)=>{actor.timeLink=['independent','cameraNodes','cameraFollow'][index%3];actor.timeLinkShot=Math.min(index,2);actor.timeOffset=index?.2:0;});
T.setShot(0,false);sandbox.setExportLook(false);T.stageToData();flushTimeouts();
const projectBefore=JSON.stringify(T.project),stageBefore=JSON.stringify(T.stageToData()),historyBefore=JSON.stringify(T.historySnapshot),writesBefore=app.storage._writes;

let recorderSequence=0,lastDownloadName='';
 sandbox.MediaRecorder=class {
  static isTypeSupported(type){return /^video\/mp4(?:;|$)/i.test(type);}
  constructor(_stream,options={}){this.mimeType=options.mimeType||'';this.state='inactive';this.sequence=++recorderSequence;installStartEventTarget(this);}
  start(){this.state='recording';this.emitStart();}
  requestData(){this.ondataavailable?.({data:new Blob([mp4ForPlan(T,this.sequence-1)],{type:this.mimeType})});}
  stop(){if(this.state==='inactive')return;this.state='inactive';this.ondataavailable?.({data:new Blob([mp4ForPlan(T,this.sequence-1)],{type:this.mimeType})});this.onstop?.();}
  pause(){this.state='paused';}resume(){this.state='recording';}
};
const originalAppendChild=sandbox.document.body.appendChild;
sandbox.document.body.appendChild=function(child){if(child?.download)lastDownloadName=child.download;return originalAppendChild.call(this,child);};

const persistentRoots=new Set([T.ground,T.sky,...T.actors.map(actor=>actor.obj)].filter(Boolean));
function isPersistentObject(object){let current=object;while(current&&current!==T.scene){if(persistentRoots.has(current))return true;current=current.parent;}return false;}
function sceneState(){
  const state=[];T.scene.traverse(object=>{if(!isPersistentObject(object))return;const materials=object.material?(Array.isArray(object.material)?object.material:[object.material]):[];
    state.push({object,visible:object.visible,materials:materials.map(material=>({material,color:material?.color?.getHex?.(),map:material?.map}))});});return state;
}
function exactSceneState(expected){
  const actual=sceneState();return actual.length===expected.length&&actual.every((entry,index)=>entry.object===expected[index].object&&entry.visible===expected[index].visible&&
    entry.materials.length===expected[index].materials.length&&entry.materials.every((material,materialIndex)=>material.material===expected[index].materials[materialIndex].material&&
      material.color===expected[index].materials[materialIndex].color&&material.map===expected[index].materials[materialIndex].map));
}
function sceneStateDiff(expected){const actual=sceneState();for(let index=0;index<Math.max(actual.length,expected.length);index++){
  const a=actual[index],b=expected[index];if(!a||!b||a.object!==b.object||a.visible!==b.visible||a.materials.length!==b.materials.length)return {index,name:a?.object?.name,visible:[a?.visible,b?.visible],materials:[a?.materials.length,b?.materials.length]};
  for(let materialIndex=0;materialIndex<a.materials.length;materialIndex++)if(a.materials[materialIndex].material!==b.materials[materialIndex].material||a.materials[materialIndex].color!==b.materials[materialIndex].color||a.materials[materialIndex].map!==b.materials[materialIndex].map)return {index,name:a.object?.name,type:a.object?.type,materialIndex,identity:a.materials[materialIndex].material===b.materials[materialIndex].material,actualColor:a.materials[materialIndex].color,expectedColor:b.materials[materialIndex].color,mapIdentity:a.materials[materialIndex].map===b.materials[materialIndex].map};
}return null;}
function materialFingerprint(scene){const entries=[];scene.traverse(object=>{const materials=object.material?(Array.isArray(object.material)?object.material:[object.material]):[];entries.push({object,visible:object.visible,materials:materials.map(material=>({material,color:material?.color,map:material?.map,materialVisible:material?.visible}))});});return entries;}
function materialFingerprintDiff(scene,expected){const actual=materialFingerprint(scene);const describe=entry=>entry&&{name:entry.object?.name,type:entry.object?.type,uuid:entry.object?.uuid,parent:entry.object?.parent?.name};for(let index=0;index<Math.max(actual.length,expected.length);index++){const before=expected[index],after=actual[index];if(!before||!after||before.object!==after.object)return {index,before:describe(before),after:describe(after),reason:'object'};if(before.visible!==after.visible)return {index,object:describe(after),before:before.visible,after:after.visible,reason:'visible'};if(before.materials.length!==after.materials.length)return {index,name:after.object?.name,reason:'material-count'};for(let materialIndex=0;materialIndex<before.materials.length;materialIndex++){const a=after.materials[materialIndex],b=before.materials[materialIndex];if(a.material!==b.material||a.color!==b.color||a.map!==b.map||a.materialVisible!==b.materialVisible)return {index,name:after.object?.name,materialIndex,reason:'material',identity:a.material===b.material,color:a.color===b.color,map:a.map===b.map,visible:a.materialVisible===b.materialVisible};}}return null;}
function exactMaterialFingerprint(scene,expected){return materialFingerprintDiff(scene,expected)===null;}
const editorState=sceneState(),renderSamples=[];let ordinarySawClay=false;
const editorMaterialFingerprint=materialFingerprint(T.scene);
const clayColors=new Set([SEEDANCE_WHITE_MODEL_PROFILE.whiteModel.clay,SEEDANCE_WHITE_MODEL_PROFILE.whiteModel.ground]);
sandbox.THREE.WebGLRenderer.prototype.render=function(renderScene){
  let allClay=true,meshCount=0;const materialFacts=[];renderScene.traverse(object=>{if(!object.isMesh||!object.material)return;meshCount++;
    let visible=object.visible!==false,parent=object.parent;while(visible&&parent){visible=parent.visible!==false;parent=parent.parent;}if(!visible)return;
    const materials=Array.isArray(object.material)?object.material:[object.material];materials.forEach(material=>materialFacts.push([object.name,material?.color?.getHex?.(),material?.map]));if(materials.some(material=>!clayColors.has(material?.color?.getHex?.())||material.map!==null))allClay=false;});
  if(this===T.recRenderer)renderSamples.push({shotIndex:T.shotIdx,localTime:T.time,allClay,meshCount,materialFacts});else if(allClay&&meshCount)ordinarySawClay=true;
};
const liveHelpers=[sandbox.grid,sandbox.groundBorder,sandbox.vizGroup,sandbox.camBall,sandbox.sunHandle].filter(Boolean),helperVisibility=liveHelpers.map(helper=>helper.visible);
T.renderSeedanceWhiteModelFrame(T.renderer,1080,1920,{offsetX:0,offsetY:0,zoom:1});
assert(exactSceneState(editorState)&&liveHelpers.every((helper,index)=>helper.visible===helperVisibility[index]),'real single-frame white override restores persistent meshes and helper visibility immediately');
ordinarySawClay=false;

const whiteRun=T.exportSeedanceWhiteModelPackage();
await new Promise(resolve=>setImmediate(resolve));
const liveTarget=T.captureTransaction?.target,livePlan=liveTarget?.plan;
assert(liveTarget?.kind==='seedance-white'&&livePlan?.clips.length===3&&livePlan.aspect==='9:16','real white export freezes a three-clip 9:16 scene plan');
let frameRestoreExact=true,directorIsolationExact=true;
for(const clip of livePlan?.clips||[]){
  await new Promise(resolve=>setImmediate(resolve));
  frameRestoreExact&&=exactSceneState(editorState);T.renderer.render(T.scene,T.shotCam);directorIsolationExact&&=exactSceneState(editorState);
  for(let index=1;index<clip.frameCount;index++){
    T.captureState.recStep?.();frameRestoreExact&&=exactSceneState(editorState);
    if(index===1||index===Math.floor(clip.frameCount/2)||index===clip.frameCount-1){T.renderer.render(T.scene,T.shotCam);directorIsolationExact&&=exactSceneState(editorState);}
  }
  flushTimeouts();await new Promise(resolve=>setImmediate(resolve));
}
const whiteResult=await whiteRun;
assert(whiteResult===true&&lastDownloadName===''&&el('seedancePack').textContent===sandbox.PreVisionI18n.t('export.seedanceDownloadReady'),'generation completes without falsely claiming an unconfirmed asynchronous browser download');
const gestureRejected=await el('seedancePack').onclick({isTrusted:false});
assert(gestureRejected===false&&lastDownloadName===''&&el('seedanceProgress').textContent===sandbox.PreVisionI18n.t('export.seedanceDownloadGestureRequired')&&el('seedancePack').textContent===sandbox.PreVisionI18n.t('export.seedanceDownloadReady'),'an untrusted download attempt fails visibly and retains the verified package for a real retry');
const whiteDownloadRequested=await el('seedancePack').onclick();
assert(whiteDownloadRequested===true&&/^Seedance25_WhiteModel_S1_scene_1080x1920\.zip$/.test(lastDownloadName),'a second explicit user action enters the real browser-download chain for the verified white-model package');
assert(frameRestoreExact&&directorIsolationExact&&!ordinarySawClay&&exactMaterialFingerprint(T.scene,editorMaterialFingerprint),`every encoded white render and final transaction restore editor material identity/color/map/visible before interleaved director renders (frame=${frameRestoreExact}, director=${directorIsolationExact}, materialFingerprint=${exactMaterialFingerprint(T.scene,editorMaterialFingerprint)}, materialDiff=${JSON.stringify(materialFingerprintDiff(T.scene,editorMaterialFingerprint))}, ordinaryClay=${ordinarySawClay}, diff=${JSON.stringify(sceneStateDiff(editorState))})`);
assert(renderSamples.length===livePlan.totalFrames&&renderSamples.every(sample=>sample.allClay&&sample.meshCount>0),`every planned encoded frame is clay and no planned frame is dropped or duplicated (${renderSamples.length}/${livePlan.totalFrames}, nonClay=${renderSamples.filter(sample=>!sample.allClay).length}, first=${JSON.stringify(renderSamples[0]?.materialFacts?.filter(([,color,map])=>!clayColors.has(color)||map!==null).slice(0,3))})`);
const plannedSamples=livePlan.clips.flatMap(clip=>clip.frames.map(frame=>({shotIndex:frame.shotIndex,localTime:frame.localTime})));
assert(renderSamples.every((sample,index)=>sample.shotIndex===plannedSamples[index].shotIndex&&Math.abs(sample.localTime-plannedSamples[index].localTime)<1e-9),'actual updateActors/updateShotCam frame times come from the exact timestamp planner sequence');
for(const requested of [0,.37,2.91,5]){const nearest=livePlan.clips[0].frames.reduce((best,frame)=>Math.abs(frame.localTime-requested)<Math.abs(best.localTime-requested)?frame:best);assert(Math.abs(nearest.localTime-requested)<=1/24+1e-6,`camera sample ${requested}s is represented within one 24fps frame`);}
for(const requested of [0,1.11,4.72,5]){const nearest=livePlan.clips[0].frames.reduce((best,frame)=>Math.abs(frame.localTime-requested)<Math.abs(best.localTime-requested)?frame:best);assert(Math.abs(nearest.localTime-requested)<=1/24+1e-6,`actor sample ${requested}s is represented within one 24fps frame`);}

const generatedZip=sandbox.__objectUrls.find(blob=>blob?.type==='application/zip'),generatedBytes=new Uint8Array(await generatedZip.arrayBuffer());
const generatedEntries=parseSeedanceStoredZip(generatedBytes),generatedManifest=JSON.parse(new TextDecoder().decode(generatedEntries.find(entry=>entry.name==='04_manifest.json').data));
assert(verifySeedanceZipManifest(generatedBytes,generatedManifest),'runtime package manifest re-verifies against actual ZIP bytes and hashes');
assert(JSON.stringify(generatedManifest.planner?.continuationGroups)===JSON.stringify(livePlan.continuationGroups)&&generatedManifest.files.filter(file=>file.segment).length===3,'runtime manifest preserves continuation groups and one segment record per shot clip');
assert(JSON.stringify(T.project)===projectBefore&&JSON.stringify(T.stageToData())===stageBefore&&JSON.stringify(T.historySnapshot)===historyBefore&&app.storage._writes===writesBefore,'success leaves project/stage/history/autosave byte-equivalent to transaction start');

console.log('· frame delivery and encoded-media binding');
const propertyAckApp=bootApp(),propertyAckT=propertyAckApp.T,propertyAckEl=propertyAckApp.el;
propertyAckApp.flushTimeouts();propertyAckEl('seedanceProfile').value='white-model';propertyAckEl('seedanceScope').value='shot';propertyAckT.shots[0].dur=.5;propertyAckT.updateSeedanceProfileUI();
let propertyStartDispatches=0,propertyAckRequests=0;
propertyAckApp.sandbox.MediaRecorder=class {
  static isTypeSupported(type){return /^video\/mp4/i.test(type);}constructor(stream,options={}){this.mimeType=options.mimeType;this.state='inactive';installStartEventTarget(this);const track=stream.getVideoTracks()[0],requestFrame=track.requestFrame;track.requestFrame=()=>{propertyAckRequests++;return requestFrame.call(track);};}
  start(){propertyStartDispatches++;this.onstart?.();}
  requestData(){this.ondataavailable?.({data:new Blob([mp4ForPlan(propertyAckT)],{type:this.mimeType})});}
  stop(){this.state='inactive';this.onstop?.();}pause(){this.state='paused';}resume(){this.state='recording';}
};
const propertyAckRun=propertyAckT.exportSeedanceWhiteModelPackage();await new Promise(resolve=>setImmediate(resolve));propertyAckApp.flushTimeouts();const propertyAckResult=await propertyAckRun;
assert(propertyAckResult===false&&propertyStartDispatches===1&&propertyAckRequests===0&&!propertyAckT.captureTransaction,'a recorder that only invokes the legacy onstart property times out before frame 0; listener-before-start is required for the acknowledged generation');
const startAckApp=bootApp(),startAckT=startAckApp.T,startAckEl=startAckApp.el,startAckOrder=[];
startAckApp.flushTimeouts();startAckEl('seedanceProfile').value='white-model';startAckEl('seedanceScope').value='shot';startAckT.shots[0].dur=.5;startAckT.updateSeedanceProfileUI();
let emitStartAck=null,startAckRequests=0;
startAckApp.sandbox.MediaRecorder=class {
  static isTypeSupported(type){return /^video\/mp4/i.test(type);}constructor(stream,options={}){this.mimeType=options.mimeType;this.state='inactive';installStartEventTarget(this);const track=stream.getVideoTracks()[0],requestFrame=track.requestFrame;track.requestFrame=()=>{startAckRequests++;startAckOrder.push(`frame:${startAckRequests}`);return requestFrame.call(track);};}
  start(){this.state='recording';startAckOrder.push('start-called');emitStartAck=()=>{startAckOrder.push('start-event');this.emitStart();};}
  requestData(){startAckOrder.push('requestData');startAckOrder.push('dataavailable');this.ondataavailable?.({data:new Blob([mp4ForPlan(startAckT)],{type:this.mimeType})});}
  stop(){if(this.state==='inactive')return;this.state='inactive';startAckOrder.push('stop');startAckOrder.push('onstop');this.onstop?.();}
  pause(){this.state='paused';}resume(){this.state='recording';}
};
const startAckRun=startAckT.exportSeedanceWhiteModelPackage();await new Promise(resolve=>setImmediate(resolve));const startAckPlan=startAckT.captureTransaction?.target?.plan?.clips?.[0];
assert(!!emitStartAck&&startAckRequests===0&&startAckOrder.join(',')==='start-called','a delayed MediaRecorder start acknowledgement receives zero requestFrame calls before the encoder confirms recording');
emitStartAck();await new Promise(resolve=>setImmediate(resolve));for(let frame=1;frame<(startAckPlan?.frameCount||0);frame++)startAckT.captureState.recStep?.();startAckApp.flushTimeouts();const startAckResult=await startAckRun;
assert(startAckResult===true&&startAckRequests===startAckPlan.frameCount&&startAckOrder.indexOf('start-event')<startAckOrder.indexOf('frame:1')&&startAckOrder.indexOf('requestData')<startAckOrder.indexOf('dataavailable')&&startAckOrder.indexOf('dataavailable')<startAckOrder.indexOf('stop')&&startAckOrder.indexOf('stop')<startAckOrder.indexOf('onstop'),'start ack gates all 120 planned requests and the final requestData/dataavailable/stop/onstop drain order is deterministic');
const startAckDiagnostic=startAckApp.sandbox.currentSeedanceDiagnostic(),startAckDiagnosticTypes=startAckDiagnostic?.mediaRecorderEvents?.map(event=>event.type)||[];
assert(startAckDiagnostic?.status==='ready-to-download'&&startAckDiagnostic.captureLedger?.plannedFrameCount===startAckPlan.frameCount&&startAckDiagnostic.captureLedger?.requestedFrameCount===startAckPlan.frameCount&&
  startAckDiagnosticTypes.indexOf('start-event')<startAckDiagnosticTypes.indexOf('frame-requested')&&startAckDiagnosticTypes.indexOf('request-data-called')<startAckDiagnosticTypes.indexOf('dataavailable')&&startAckDiagnosticTypes.indexOf('dataavailable')<startAckDiagnosticTypes.indexOf('stop-called')&&startAckDiagnosticTypes.indexOf('stop-called')<startAckDiagnosticTypes.indexOf('stop-event'),
  `the persistent diagnostic exposes expected/actual media, the capture ledger, and MediaRecorder start/drain/data/stop order (${JSON.stringify(startAckDiagnostic)})`);
const cadenceApp=bootApp(),cadenceT=cadenceApp.T,cadenceEl=cadenceApp.el,cadenceClock=createControlledScheduler(),cadenceRequests=[],cadenceFramePeriod=1000/24;
cadenceApp.flushTimeouts();cadenceEl('seedanceProfile').value='white-model';cadenceEl('seedanceScope').value='shot';cadenceT.shots[0].dur=.5;cadenceT.updateSeedanceProfileUI();
const CadenceRenderer=cadenceApp.sandbox.THREE.WebGLRenderer;let cadenceRenderCalls=0;cadenceApp.sandbox.THREE.WebGLRenderer=class extends CadenceRenderer{render(){cadenceRenderCalls++;cadenceClock.elapse(cadenceRenderCalls===15?50:20);return super.render(...arguments);}};
let cadenceRequestDataAt=null;
cadenceApp.sandbox.MediaRecorder=class {
  static isTypeSupported(type){return /^video\/mp4/i.test(type);}constructor(stream,options={}){this.mimeType=options.mimeType;this.state='inactive';installStartEventTarget(this);const track=stream.getVideoTracks()[0],requestFrame=track.requestFrame;track.requestFrame=()=>{cadenceRequests.push(cadenceClock.now());return requestFrame.call(track);};}
  start(){this.state='recording';this.emitStart();}requestData(){cadenceRequestDataAt=cadenceClock.now();this.ondataavailable?.({data:new Blob([mp4ForPlan(cadenceT)],{type:this.mimeType})});}stop(){if(this.state==='inactive')return;this.state='inactive';this.onstop?.();}pause(){this.state='paused';}resume(){this.state='recording';}
};
const cadenceRun=cadenceT.exportSeedanceWhiteModelPackage({scheduler:cadenceClock});await new Promise(resolve=>setImmediate(resolve));await new Promise(resolve=>setImmediate(resolve));const cadencePlan=cadenceT.captureTransaction?.target?.plan?.clips?.[0];cadenceClock.runAll();const cadenceResult=await cadenceRun,cadenceDiagnostic=cadenceApp.sandbox.currentSeedanceDiagnostic(),cadenceSpan=cadenceRequests.at(-1)-cadenceRequests[0],cadencePenultimateSpan=cadenceRequests.at(-2)-cadenceRequests[0],cadenceTailDrain=cadenceRequestDataAt-cadenceRequests.at(-1);
assert(cadenceResult===true&&cadenceRequests.length===cadencePlan.frameCount&&Math.abs(cadencePenultimateSpan-(cadencePlan.frameCount-2)*cadenceFramePeriod)<1e-6&&cadenceSpan>(cadencePlan.frameCount-1)*cadenceFramePeriod&&Math.abs(cadenceTailDrain-cadenceFramePeriod)<1e-6&&cadenceDiagnostic.captureLedger?.renderedFrameCount===cadencePlan.frameCount&&Math.abs(cadenceDiagnostic.captureLedger?.requestSpanMs-cadenceSpan)<.001,'frames are pre-rendered before absolute requestFrame slots, and a late final render still receives one complete tail-frame drain before dataavailable/onstop');
const fallbackApp=bootApp(),fallbackT=fallbackApp.T,fallbackEl=fallbackApp.el;
fallbackApp.flushTimeouts();fallbackEl('seedanceProfile').value='white-model';fallbackEl('seedanceScope').value='shot';fallbackT.shots[0].dur=.5;fallbackT.updateSeedanceProfileUI();
const fallbackClock=createControlledScheduler();let fallbackRequests=0,fallbackLateListener=null,fallbackFirstFrameAt=null;
fallbackApp.sandbox.MediaRecorder=class {
  static isTypeSupported(type){return /^video\/mp4/i.test(type);}constructor(stream,options={}){this.mimeType=options.mimeType;this.state='inactive';installStartEventTarget(this);const add=this.addEventListener.bind(this);this.addEventListener=(type,listener,opts)=>{if(type==='start')fallbackLateListener=listener;add(type,listener,opts);};const track=stream.getVideoTracks()[0];track.readyState='live';const requestFrame=track.requestFrame;track.requestFrame=()=>{fallbackRequests++;fallbackFirstFrameAt??=fallbackClock.now();return requestFrame.call(track);};}
  start(){this.state='recording';}requestData(){this.ondataavailable?.({data:new Blob([mp4ForPlan(fallbackT)],{type:this.mimeType})});}stop(){if(this.state==='inactive')return;this.state='inactive';this.onstop?.();}pause(){this.state='paused';}resume(){this.state='recording';}
};
const fallbackRun=fallbackT.exportSeedanceWhiteModelPackage({scheduler:fallbackClock});await new Promise(resolve=>setImmediate(resolve));await new Promise(resolve=>setImmediate(resolve));const fallbackPendingBeforeAdvance=fallbackClock.pending(),fallbackPlan=fallbackT.captureTransaction?.target?.plan?.clips?.[0],framePeriod=1000/24,fallbackWindow=120,startTimeout=1500;
fallbackClock.advanceTo(fallbackWindow-.001);const noFrameBeforeWindow=fallbackRequests===0;
fallbackClock.advanceTo(fallbackWindow);const noFrameAfterFirstConfirmation=fallbackRequests===0;
fallbackClock.advanceTo(fallbackWindow+framePeriod-.001);const noFrameBeforeSecondConfirmation=fallbackRequests===0;
fallbackClock.advanceTo(fallbackWindow+framePeriod+.01);const primerRequested=fallbackRequests===1&&fallbackFirstFrameAt>=fallbackWindow+framePeriod&&fallbackFirstFrameAt<fallbackWindow+framePeriod+.01;
fallbackLateListener?.({type:'start'});const listenerStartedPlan=fallbackRequests===2;fallbackLateListener?.({type:'start'});const duplicateStartIgnored=fallbackRequests===2;
fallbackClock.runAll();const fallbackResult=await fallbackRun,fallbackDiagnostic=fallbackApp.sandbox.currentSeedanceDiagnostic();
assert(fallbackResult===true&&noFrameBeforeWindow&&noFrameAfterFirstConfirmation&&noFrameBeforeSecondConfirmation&&primerRequested&&listenerStartedPlan&&duplicateStartIgnored&&fallbackRequests===fallbackPlan.frameCount+1&&fallbackDiagnostic.captureLedger?.primerFrameCount===1&&fallbackDiagnostic.captureLedger?.requestedFrameCount===fallbackPlan.frameCount&&fallbackDiagnostic.captureLedger?.startSource==='listener-after-primer',`two state/live confirmations request one uncounted primer, the real start event gates all planned frames, and duplicate start delivery stays inert (${JSON.stringify({fallbackResult,fallbackPendingBeforeAdvance,noFrameBeforeWindow,noFrameAfterFirstConfirmation,noFrameBeforeSecondConfirmation,primerRequested,listenerStartedPlan,duplicateStartIgnored,fallbackRequests,planned:fallbackPlan?.frameCount,firstAt:fallbackFirstFrameAt,ledger:fallbackDiagnostic.captureLedger})})`);
const fallbackDropApp=bootApp(),fallbackDropT=fallbackDropApp.T,fallbackDropEl=fallbackDropApp.el;
fallbackDropApp.flushTimeouts();fallbackDropEl('seedanceProfile').value='white-model';fallbackDropEl('seedanceScope').value='shot';fallbackDropT.shots[0].dur=.5;fallbackDropT.updateSeedanceProfileUI();
const fallbackDropClock=createControlledScheduler();let fallbackDropRequests=0,fallbackDropStart=null;
fallbackDropApp.sandbox.MediaRecorder=class {
  static isTypeSupported(type){return /^video\/mp4/i.test(type);}constructor(stream,options={}){this.mimeType=options.mimeType;this.state='inactive';installStartEventTarget(this);const add=this.addEventListener.bind(this);this.addEventListener=(type,listener,opts)=>{if(type==='start')fallbackDropStart=listener;add(type,listener,opts);};const track=stream.getVideoTracks()[0];track.readyState='live';const requestFrame=track.requestFrame;track.requestFrame=()=>{fallbackDropRequests++;return requestFrame.call(track);};}
  start(){this.state='recording';}requestData(){this.ondataavailable?.({data:new Blob([makeH264Mp4({frameCount:11})],{type:this.mimeType})});}stop(){this.state='inactive';this.onstop?.();}pause(){this.state='paused';}resume(){this.state='recording';}
};
const fallbackDropRun=fallbackDropT.exportSeedanceWhiteModelPackage({scheduler:fallbackDropClock});await new Promise(resolve=>setImmediate(resolve));await new Promise(resolve=>setImmediate(resolve));const fallbackDropPlan=fallbackDropT.captureTransaction?.target?.plan?.clips?.[0];fallbackDropClock.advanceTo(fallbackWindow+framePeriod+.01);const fallbackDropPrimerRequests=fallbackDropRequests;fallbackDropStart?.({type:'start'});fallbackDropClock.runAll();const fallbackDropResult=await fallbackDropRun;
assert(fallbackDropResult===false&&fallbackDropPrimerRequests===1&&fallbackDropRequests===fallbackDropPlan.frameCount+1&&fallbackDropApp.sandbox.__objectUrls.length===0,`a primer plus real start confirmation still rejects an 11-sample encoded result against the frozen 12-frame plan before ZIP/download (${JSON.stringify({fallbackDropResult,fallbackDropPrimerRequests,fallbackDropRequests,planned:fallbackDropPlan?.frameCount,urls:fallbackDropApp.sandbox.__objectUrls.length})})`);
const fallbackStateRejectApp=bootApp(),fallbackStateRejectT=fallbackStateRejectApp.T,fallbackStateRejectEl=fallbackStateRejectApp.el;
fallbackStateRejectApp.flushTimeouts();fallbackStateRejectEl('seedanceProfile').value='white-model';fallbackStateRejectEl('seedanceScope').value='shot';fallbackStateRejectT.shots[0].dur=.5;fallbackStateRejectT.updateSeedanceProfileUI();
const fallbackStateRejectClock=createControlledScheduler();let fallbackStateRejectRequests=0;
fallbackStateRejectApp.sandbox.MediaRecorder=class {
  static isTypeSupported(type){return /^video\/mp4/i.test(type);}constructor(stream,options={}){this.mimeType=options.mimeType;this.state='inactive';installStartEventTarget(this);const track=stream.getVideoTracks()[0],requestFrame=track.requestFrame;track.requestFrame=()=>{fallbackStateRejectRequests++;return requestFrame.call(track);};}
  start(){}requestData(){}stop(){this.state='inactive';}pause(){this.state='paused';}resume(){this.state='recording';}
};
const fallbackStateRejectRun=fallbackStateRejectT.exportSeedanceWhiteModelPackage({scheduler:fallbackStateRejectClock});await new Promise(resolve=>setImmediate(resolve));await new Promise(resolve=>setImmediate(resolve));fallbackStateRejectClock.advanceTo(startTimeout);const fallbackStateRejectResult=await fallbackStateRejectRun;
assert(fallbackStateRejectResult===false&&fallbackStateRejectRequests===0&&!fallbackStateRejectT.captureTransaction,'fallback rejects when recorder state is not recording and leaves no generation alive');
const fallbackTrackRejectApp=bootApp(),fallbackTrackRejectT=fallbackTrackRejectApp.T,fallbackTrackRejectEl=fallbackTrackRejectApp.el;
fallbackTrackRejectApp.flushTimeouts();fallbackTrackRejectEl('seedanceProfile').value='white-model';fallbackTrackRejectEl('seedanceScope').value='shot';fallbackTrackRejectT.shots[0].dur=.5;fallbackTrackRejectT.updateSeedanceProfileUI();
const fallbackTrackRejectClock=createControlledScheduler();let fallbackTrackRejectRequests=0;
fallbackTrackRejectApp.sandbox.MediaRecorder=class {
  static isTypeSupported(type){return /^video\/mp4/i.test(type);}constructor(stream,options={}){this.mimeType=options.mimeType;this.state='inactive';installStartEventTarget(this);const track=stream.getVideoTracks()[0];track.readyState='ended';const requestFrame=track.requestFrame;track.requestFrame=()=>{fallbackTrackRejectRequests++;return requestFrame.call(track);};}
  start(){this.state='recording';}requestData(){}stop(){this.state='inactive';}pause(){this.state='paused';}resume(){this.state='recording';}
};
const fallbackTrackRejectRun=fallbackTrackRejectT.exportSeedanceWhiteModelPackage({scheduler:fallbackTrackRejectClock});await new Promise(resolve=>setImmediate(resolve));await new Promise(resolve=>setImmediate(resolve));fallbackTrackRejectClock.advanceTo(startTimeout);const fallbackTrackRejectResult=await fallbackTrackRejectRun;
assert(fallbackTrackRejectResult===false&&fallbackTrackRejectRequests===0&&!fallbackTrackRejectT.captureTransaction,'fallback rejects when any capture track is not live and leaves no generation alive');
const fallbackCancelApp=bootApp(),fallbackCancelT=fallbackCancelApp.T,fallbackCancelEl=fallbackCancelApp.el;
fallbackCancelApp.flushTimeouts();fallbackCancelEl('seedanceProfile').value='white-model';fallbackCancelEl('seedanceScope').value='shot';fallbackCancelT.shots[0].dur=.5;fallbackCancelT.updateSeedanceProfileUI();
const fallbackCancelClock=createControlledScheduler();let fallbackCancelRequests=0;
fallbackCancelApp.sandbox.MediaRecorder=class {
  static isTypeSupported(type){return /^video\/mp4/i.test(type);}constructor(stream,options={}){this.mimeType=options.mimeType;this.state='inactive';installStartEventTarget(this);const track=stream.getVideoTracks()[0];track.readyState='live';const requestFrame=track.requestFrame;track.requestFrame=()=>{fallbackCancelRequests++;return requestFrame.call(track);};}
  start(){this.state='recording';}requestData(){}stop(){this.state='inactive';}pause(){this.state='paused';}resume(){this.state='recording';}
};
const fallbackCancelRun=fallbackCancelT.exportSeedanceWhiteModelPackage({scheduler:fallbackCancelClock});await new Promise(resolve=>setImmediate(resolve));await new Promise(resolve=>setImmediate(resolve));const fallbackCancelled=fallbackCancelT.stopActiveCapture();fallbackCancelClock.runAll();const fallbackCancelResult=await fallbackCancelRun;
assert(fallbackCancelled&&fallbackCancelResult===false&&fallbackCancelRequests===0&&!fallbackCancelT.captureTransaction,'cancel makes pending state-track fallback and listener callbacks inert before frame 0');
const lateAckApp=bootApp(),lateAckT=lateAckApp.T,lateAckEl=lateAckApp.el;
lateAckApp.flushTimeouts();lateAckEl('seedanceProfile').value='white-model';lateAckEl('seedanceScope').value='shot';lateAckT.shots[0].dur=.5;lateAckT.updateSeedanceProfileUI();
let capturedLateStart=null,lateStartRemovals=0,lateAckRequests=0;
lateAckApp.sandbox.MediaRecorder=class {
  static isTypeSupported(type){return /^video\/mp4/i.test(type);}constructor(stream,options={}){this.mimeType=options.mimeType;this.state='inactive';installStartEventTarget(this);const add=this.addEventListener.bind(this),remove=this.removeEventListener.bind(this);this.addEventListener=(type,listener,options)=>{if(type==='start')capturedLateStart=listener;add(type,listener,options);};this.removeEventListener=(type,listener)=>{if(type==='start')lateStartRemovals++;remove(type,listener);};const track=stream.getVideoTracks()[0],requestFrame=track.requestFrame;track.requestFrame=()=>{lateAckRequests++;return requestFrame.call(track);};}
  start(){this.state='recording';}requestData(){}stop(){this.state='inactive';}pause(){this.state='paused';}resume(){this.state='recording';}
};
const lateAckRun=lateAckT.exportSeedanceWhiteModelPackage();await new Promise(resolve=>setImmediate(resolve));const lateAckStopped=lateAckT.stopActiveCapture(),lateAckResult=await lateAckRun;capturedLateStart?.({type:'start'});
assert(lateAckStopped&&lateAckResult===false&&lateStartRemovals===1&&lateAckRequests===0&&!lateAckT.captureTransaction,'cancel removes the start listener, and a captured late start callback cannot request frame 0 or revive its generation');
const deliveryApp=bootApp(),deliveryT=deliveryApp.T,deliveryEl=deliveryApp.el,requestFrameCounts=[];
deliveryApp.flushTimeouts();deliveryEl('seedanceProfile').value='white-model';deliveryEl('seedanceScope').value='shot';deliveryT.shots[0].dur=.5;deliveryT.updateSeedanceProfileUI();
deliveryApp.sandbox.MediaRecorder=class {
  static isTypeSupported(type){return /^video\/mp4/i.test(type);}constructor(stream,options={}){this.mimeType=options.mimeType;this.state='inactive';installStartEventTarget(this);const track=stream.getVideoTracks()[0],originalRequestFrame=track.requestFrame;let count=0;track.requestFrame=()=>{count++;return originalRequestFrame.call(track);};requestFrameCounts.push({get count(){return count;}});}
  start(){this.state='recording';this.emitStart();}requestData(){this.ondataavailable?.({data:new Blob([mp4ForPlan(deliveryT)],{type:this.mimeType})});}stop(){if(this.state==='inactive')return;this.state='inactive';this.ondataavailable?.({data:new Blob([mp4ForPlan(deliveryT)],{type:this.mimeType})});this.onstop?.();}
  pause(){this.state='paused';}resume(){this.state='recording';}
};
const deliveryRun=deliveryT.exportSeedanceWhiteModelPackage();await new Promise(resolve=>setImmediate(resolve));const deliveryPlan=deliveryT.captureTransaction?.target?.plan?.clips?.[0];
for(let frame=1;frame<(deliveryPlan?.frameCount||0);frame++)deliveryT.captureState.recStep?.();deliveryApp.flushTimeouts();const deliveryResult=await deliveryRun;
assert(deliveryResult===true&&requestFrameCounts.length===1&&requestFrameCounts[0].count===deliveryPlan.frameCount,`every frozen white-model sample is delivered exactly once through CanvasCaptureMediaStreamTrack.requestFrame before encoded-media verification (${JSON.stringify({requestFrameCounts:requestFrameCounts.map(track=>track.count),planned:deliveryPlan?.frameCount})})`);

renderSamples.length=0;ordinarySawClay=false;el('seedanceProfile').value='standard';T.updateSeedanceProfileUI({resetProgress:true});
const normalRun=el('seedancePack').onclick();await new Promise(resolve=>setImmediate(resolve));
for(let index=0;index<livePlan.clips[0].frameCount+2;index++)T.captureState.recStep?.();flushTimeouts();const normalResult=await normalRun;
assert(normalResult===true&&renderSamples.length>0&&renderSamples.every(sample=>!sample.allClay),'ordinary Seedance export immediately after white export retains original colored materials');
assert(exactSceneState(editorState)&&JSON.stringify(T.project)===projectBefore&&JSON.stringify(T.stageToData())===stageBefore&&app.storage._writes===writesBefore,`ordinary export after white remains isolated and performs no project/autosave write (scene=${exactSceneState(editorState)}, project=${JSON.stringify(T.project)===projectBefore}, stage=${JSON.stringify(T.stageToData())===stageBefore}, writes=${app.storage._writes}/${writesBefore})`);
sandbox.document.body.appendChild=originalAppendChild;

console.log('· preflight and generation isolation matrix');
const mediaMismatchApp=bootApp(),mediaMismatchT=mediaMismatchApp.T,mediaMismatchEl=mediaMismatchApp.el;
mediaMismatchApp.flushTimeouts();mediaMismatchEl('aspect').value='16:9';mediaMismatchEl('seedanceProfile').value='white-model';mediaMismatchEl('seedanceScope').value='shot';mediaMismatchT.shots[0].dur=.5;mediaMismatchT.updateSeedanceProfileUI();
const mismatchFrameCount=mediaMismatchT.captureTransaction?.target?.plan?.clips?.[0]?.frameCount||Math.round(mediaMismatchT.shots[0].dur*24);
mediaMismatchApp.sandbox.MediaRecorder=class {
  static isTypeSupported(type){return /^video\/mp4/i.test(type);}constructor(_stream,options={}){this.mimeType=options.mimeType;this.state='inactive';installStartEventTarget(this);}
  start(){this.state='recording';this.emitStart();}requestData(){this.ondataavailable?.({data:new Blob([makeH264Mp4({frameCount:mismatchFrameCount-1})],{type:this.mimeType})});}stop(){if(this.state==='inactive')return;this.state='inactive';this.ondataavailable?.({data:new Blob([makeH264Mp4({frameCount:mismatchFrameCount-1})],{type:this.mimeType})});this.onstop?.();}
  pause(){this.state='paused';}resume(){this.state='recording';}
};
const mismatchProject=JSON.stringify(mediaMismatchT.project),mismatchStage=JSON.stringify(mediaMismatchT.stageToData()),mismatchHistory=JSON.stringify(mediaMismatchT.historySnapshot),mismatchWrites=mediaMismatchApp.storage._writes,mismatchMaterials=materialFingerprint(mediaMismatchT.scene);
const mismatchRun=mediaMismatchT.exportSeedanceWhiteModelPackage();await new Promise(resolve=>setImmediate(resolve));for(let frame=0;frame<24;frame++)mediaMismatchT.captureState.recStep?.();mediaMismatchApp.flushTimeouts();const mismatchResult=await mismatchRun;
assert(mismatchResult===false&&mediaMismatchApp.sandbox.__objectUrls.length===0&&mediaMismatchEl('seedanceProgress').textContent===mediaMismatchApp.sandbox.PreVisionI18n.t('export.seedanceMediaMismatch'),`a valid H.264 MP4 with one dropped encoded sample fails closed before ZIP/download and exposes the media mismatch (${JSON.stringify({mismatchResult,urls:mediaMismatchApp.sandbox.__objectUrls.length,progress:mediaMismatchEl('seedanceProgress').textContent,expected:mediaMismatchApp.sandbox.PreVisionI18n.t('export.seedanceMediaMismatch')})})`);
const mismatchDiagnostic=mediaMismatchApp.sandbox.currentSeedanceDiagnostic();
assert(mismatchDiagnostic?.status==='media-mismatch'&&mismatchDiagnostic.expected?.frameCount===mismatchFrameCount&&mismatchDiagnostic.actual?.frameCount===mismatchFrameCount-1&&
  mismatchDiagnostic.captureLedger?.renderedFrameCount===mismatchFrameCount&&mismatchDiagnostic.captureLedger?.requestedFrameCount===mismatchFrameCount&&mediaMismatchEl('seedanceDiagnostics').hidden===false&&mediaMismatchEl('seedanceDiagnostics').open===true&&
  mediaMismatchEl('seedanceDiagnosticsText').textContent.includes('"actual"')&&mediaMismatchEl('seedanceDiagnosticsText').textContent.includes('"mediaRecorderEvents"'),
  `strict mismatch keeps a visible copyable diagnostic without producing a ZIP (${JSON.stringify(mismatchDiagnostic)})`);
assert(JSON.stringify(mediaMismatchT.project)===mismatchProject&&JSON.stringify(mediaMismatchT.stageToData())===mismatchStage&&JSON.stringify(mediaMismatchT.historySnapshot)===mismatchHistory&&mediaMismatchApp.storage._writes===mismatchWrites&&exactMaterialFingerprint(mediaMismatchT.scene,mismatchMaterials),`encoded-media mismatch leaves project/stage/history/autosave and every editor material identity byte-equivalent to transaction start (${JSON.stringify(materialFingerprintDiff(mediaMismatchT.scene,mismatchMaterials))})`);
const finalizeFaultApp=bootApp(),finalizeFaultT=finalizeFaultApp.T,finalizeFaultEl=finalizeFaultApp.el;
finalizeFaultApp.flushTimeouts();finalizeFaultEl('seedanceProfile').value='white-model';finalizeFaultEl('seedanceScope').value='shot';finalizeFaultT.shots[0].dur=.5;finalizeFaultT.updateSeedanceProfileUI();
let failRestore=false,faultOnStop=true,recorderStarts=0,downloadAttempts=0;const originalFaultUpdateActors=finalizeFaultApp.sandbox.updateActors,originalFaultAppend=finalizeFaultApp.sandbox.document.body.appendChild;
finalizeFaultApp.sandbox.updateActors=(...args)=>{if(failRestore)throw new Error('restore fault');return originalFaultUpdateActors(...args);};
finalizeFaultApp.sandbox.document.body.appendChild=function(child){if(child?.download)downloadAttempts++;return originalFaultAppend.call(this,child);};
finalizeFaultApp.sandbox.MediaRecorder=class {
  static isTypeSupported(type){return /^video\/mp4/i.test(type);}constructor(_stream,options={}){this.mimeType=options.mimeType;this.state='inactive';installStartEventTarget(this);}
  start(){this.state='recording';recorderStarts++;this.emitStart();}requestData(){this.ondataavailable?.({data:new Blob([mp4ForPlan(finalizeFaultT)],{type:this.mimeType})});}stop(){if(this.state==='inactive')return;this.state='inactive';this.ondataavailable?.({data:new Blob([mp4ForPlan(finalizeFaultT)],{type:this.mimeType})});this.onstop?.();if(faultOnStop)failRestore=true;}
  pause(){this.state='paused';}resume(){this.state='recording';}
};
const finalizeFaultRun=finalizeFaultT.exportSeedanceWhiteModelPackage();await new Promise(resolve=>setImmediate(resolve));for(let frame=0;frame<20;frame++)finalizeFaultT.captureState.recStep?.();finalizeFaultApp.flushTimeouts();const finalizeFaultResult=await finalizeFaultRun;
const finalizeFaultDiagnostic=finalizeFaultApp.sandbox.currentSeedanceDiagnostic(),pendingCleared=finalizeFaultEl('seedancePack').textContent===finalizeFaultApp.sandbox.PreVisionI18n.t('export.seedanceWhitePack')&&downloadAttempts===0&&finalizeFaultApp.sandbox.__objectUrls.length===0;
failRestore=false;faultOnStop=false;const retryAfterFinalizeFailure=finalizeFaultEl('seedancePack').onclick();await new Promise(resolve=>setImmediate(resolve));const retryStarted=finalizeFaultT.captureTransaction?.owner==='seedance-white-export'&&recorderStarts>1;finalizeFaultT.stopActiveCapture();await retryAfterFinalizeFailure;
assert(finalizeFaultResult===false&&pendingCleared&&finalizeFaultDiagnostic?.status==='finalize-failed'&&finalizeFaultDiagnostic?.error?.message==='restore fault'&&retryStarted,`a restore/finalize failure clears the unpublished pending ZIP, replaces ready diagnostics with the failure, and the next click starts a new generation (${JSON.stringify({finalizeFaultResult,pendingCleared,finalizeFaultDiagnostic,retryStarted,recorderStarts,downloadAttempts,button:finalizeFaultEl('seedancePack').textContent,transaction:finalizeFaultT.captureTransaction?.owner})})`);
const preflightApp=bootApp(),preflightT=preflightApp.T,preflightEl=preflightApp.el;
preflightEl('aspect').value='16:9';preflightEl('seedanceProfile').value='white-model';preflightEl('seedanceScope').value='shot';preflightT.shots[0].dur=30;preflightT.updateSeedanceProfileUI();
preflightApp.sandbox.MediaRecorder=class {static isTypeSupported(){return true;}};
const preflightProject=JSON.stringify(preflightT.project),preflightStage=JSON.stringify(preflightT.stageToData()),preflightWrites=preflightApp.storage._writes;
const preflightFirst=await preflightT.exportSeedanceWhiteModelPackage(),preflightSecond=await preflightT.exportSeedanceWhiteModelPackage();
assert(preflightFirst===false&&preflightSecond===false&&!preflightT.captureTransaction&&preflightApp.sandbox.__objectUrls.length===0,'consecutive over-limit preflights reject before transaction, recorder, ZIP, or download');
assert(JSON.stringify(preflightT.project)===preflightProject&&JSON.stringify(preflightT.stageToData())===preflightStage&&preflightApp.storage._writes===preflightWrites,'repeated preflight rejection leaves project/stage/autosave unchanged');

const cancelApp=bootApp(),cancelT=cancelApp.T,cancelEl=cancelApp.el,cancelRecorders=[];
cancelApp.flushTimeouts();cancelEl('aspect').value='16:9';cancelEl('seedanceProfile').value='white-model';cancelEl('seedanceScope').value='shot';cancelT.shots[0].dur=.5;cancelT.updateSeedanceProfileUI();
cancelApp.sandbox.MediaRecorder=class {
  static isTypeSupported(type){return /^video\/mp4/i.test(type);}constructor(_stream,options={}){this.mimeType=options.mimeType;this.state='inactive';installStartEventTarget(this);cancelRecorders.push(this);}
  start(){this.state='recording';this.emitStart();}requestData(){this.ondataavailable?.({data:new Blob([mp4ForPlan(cancelT)],{type:this.mimeType})});}stop(){if(this.state==='inactive')return;this.state='inactive';this.ondataavailable?.({data:new Blob([mp4ForPlan(cancelT)],{type:this.mimeType})});this.onstop?.();}
  pause(){this.state='paused';}resume(){this.state='recording';}
};
const cancelMaterials=materialFingerprint(cancelT.scene),canceledRun=cancelT.exportSeedanceWhiteModelPackage();await new Promise(resolve=>setImmediate(resolve));
const canceledGeneration=cancelT.captureTransaction?.id,lateOnstop=cancelRecorders[0]?.onstop,cancelStopped=cancelT.stopActiveCapture(),canceledResult=await canceledRun;
assert(cancelStopped&&canceledResult===false&&!cancelT.captureTransaction&&cancelApp.sandbox.__objectUrls.length===0&&exactMaterialFingerprint(cancelT.scene,cancelMaterials),`A white-model cancel restores every editor material identity and produces no partial ZIP (${JSON.stringify(materialFingerprintDiff(cancelT.scene,cancelMaterials))})`);
cancelEl('seedanceProfile').value='standard';cancelT.updateSeedanceProfileUI();const normalAfterCancel=cancelEl('seedancePack').onclick();await new Promise(resolve=>setImmediate(resolve));
const normalGeneration=cancelT.captureTransaction?.id;lateOnstop?.();const lateKeptGeneration=cancelT.captureTransaction?.id===normalGeneration;
for(let index=0;index<40;index++)cancelT.captureState.recStep?.();cancelApp.flushTimeouts();const normalAfterCancelResult=await normalAfterCancel;
assert(normalAfterCancelResult===true&&normalGeneration>canceledGeneration&&lateKeptGeneration,'A late onstop cannot settle or mutate the newer B ordinary-export generation');

const retryApp=bootApp(),retryT=retryApp.T,retryEl=retryApp.el;retryApp.flushTimeouts();retryEl('aspect').value='16:9';retryEl('seedanceProfile').value='white-model';retryEl('seedanceScope').value='shot';retryT.shots[0].dur=.5;retryT.updateSeedanceProfileUI();
let failConstructor=true;
retryApp.sandbox.MediaRecorder=class {
  static isTypeSupported(type){return /^video\/mp4/i.test(type);}constructor(_stream,options={}){if(failConstructor){failConstructor=false;throw new Error('encoder constructor fault');}this.mimeType=options.mimeType;this.state='inactive';installStartEventTarget(this);}
  start(){this.state='recording';this.emitStart();}requestData(){this.ondataavailable?.({data:new Blob([mp4ForPlan(retryT)],{type:this.mimeType})});}stop(){if(this.state==='inactive')return;this.state='inactive';this.ondataavailable?.({data:new Blob([mp4ForPlan(retryT)],{type:this.mimeType})});this.onstop?.();}
  pause(){this.state='paused';}resume(){this.state='recording';}
};
const encoderFailure=await retryT.exportSeedanceWhiteModelPackage();
assert(encoderFailure===false&&!retryT.captureTransaction&&retryApp.sandbox.__objectUrls.length===0,'encoder constructor failure restores A and writes no inconsistent package');
const retryRun=retryT.exportSeedanceWhiteModelPackage();await new Promise(resolve=>setImmediate(resolve));for(let index=0;index<40;index++)retryT.captureState.recStep?.();retryApp.flushTimeouts();const retryResult=await retryRun;
const retrySelection=retryApp.sandbox.seedancePendingDownloadIdentity(),retrySelectionKeys=Object.keys(retrySelection||{});
assert(/^[0-9a-f]{64}$/.test(retrySelection?.contentFingerprint||'')&&!retrySelectionKeys.some(key=>['projectRef','sceneRef','shotRef'].includes(key)),
  `pending download keeps a deterministic content fingerprint without retaining project, scene, or shot object references (${JSON.stringify(retrySelectionKeys)})`);
const retryDownload=await retryEl('seedancePack').onclick();
assert(retryResult===true&&retryDownload===true&&!retryT.captureTransaction&&retryApp.sandbox.__objectUrls.some(blob=>blob?.type==='application/zip'),'a fresh B white-model generation and explicit download request succeed after encoder failure without inheriting A state');
retryT.shots[0].yaw=17;retryT.syncScene();retryT.markDirty();retryApp.flushTimeouts();
const sameShotProject=JSON.stringify(retryT.project),sameShotStage=JSON.stringify(retryT.stageToData()),sameShotHistory=JSON.stringify(retryT.historySnapshot),sameShotWrites=retryApp.storage._writes;
const staleDirectUrlCount=retryApp.sandbox.__objectUrls.length,staleDirectDownload=await retryApp.sandbox.downloadSeedanceWhiteModelPackage();
assert(staleDirectDownload===false&&retryApp.sandbox.__objectUrls.length===staleDirectUrlCount&&retryApp.sandbox.seedancePendingDownloadIdentity()===null,
  'the direct download entry point rejects and clears a same-shot stale package before creating a blob URL');
const sameShotRun=retryEl('seedancePack').onclick();await new Promise(resolve=>setImmediate(resolve));const sameShotTarget=retryT.captureTransaction?.target,sameShotStopped=retryT.stopActiveCapture();retryApp.flushTimeouts();const sameShotResult=await sameShotRun;
assert(sameShotTarget?.shotIndex===0&&sameShotTarget?.content?.scene?.shots?.[0]?.yaw===17&&sameShotStopped===true&&sameShotResult===false,
  `editing the same shot object invalidates the cached package and starts a fresh content-bound generation (${JSON.stringify({targetShot:sameShotTarget?.shotIndex,yaw:sameShotTarget?.content?.scene?.shots?.[0]?.yaw,sameShotStopped,sameShotResult})})`);
const sameShotZeroWrite={project:JSON.stringify(retryT.project)===sameShotProject,stage:JSON.stringify(retryT.stageToData())===sameShotStage,history:JSON.stringify(retryT.historySnapshot)===sameShotHistory,autosave:retryApp.storage._writes===sameShotWrites};
assert(Object.values(sameShotZeroWrite).every(Boolean),`same-shot stale-package regeneration/cancel adds no project, stage, history, or autosave write (${JSON.stringify(sameShotZeroWrite)})`);
const refreshedC1Run=retryT.exportSeedanceWhiteModelPackage();await new Promise(resolve=>setImmediate(resolve));for(let index=0;index<40;index++)retryT.captureState.recStep?.();retryApp.flushTimeouts();const refreshedC1Result=await refreshedC1Run;
assert(refreshedC1Result===true,'the edited C1 package can be regenerated and retained for a later explicit download');
retryT.shots[1].dur=.5;retryT.syncScene();retryT.setShot(1,true);const staleSelectionProject=JSON.stringify(retryT.project),staleSelectionStage=JSON.stringify(retryT.stageToData()),staleSelectionHistory=JSON.stringify(retryT.historySnapshot),staleSelectionWrites=retryApp.storage._writes;
const selectedShotRun=retryEl('seedancePack').onclick();await new Promise(resolve=>setImmediate(resolve));const selectedShotTarget=retryT.captureTransaction?.target,selectedShotStopped=retryT.stopActiveCapture();retryApp.flushTimeouts();const selectedShotResult=await selectedShotRun;
assert(selectedShotTarget?.shotIndex===1&&selectedShotTarget?.plan?.clips?.[0]?.shotIndex===1&&selectedShotTarget?.plan?.clips?.[0]?.filename==='01_white_model_S1C2.mp4'&&selectedShotStopped===true&&selectedShotResult===false,
  `switching the current shot invalidates the cached C1 package and starts a fresh C2 generation instead of re-downloading stale bytes (${JSON.stringify({targetShot:selectedShotTarget?.shotIndex,clip:selectedShotTarget?.plan?.clips?.[0]?.filename,selectedShotStopped,selectedShotResult})})`);
const staleSelectionZeroWrite={project:JSON.stringify(retryT.project)===staleSelectionProject,stage:JSON.stringify(retryT.stageToData())===staleSelectionStage,history:JSON.stringify(retryT.historySnapshot)===staleSelectionHistory,autosave:retryApp.storage._writes===staleSelectionWrites};
assert(Object.values(staleSelectionZeroWrite).every(Boolean),
  `stale-package invalidation and selected-shot regeneration/cancel leave project, stage, history, and autosave byte-equivalent (${JSON.stringify(staleSelectionZeroWrite)})`);

const sceneIdentityApp=bootApp(),sceneIdentityT=sceneIdentityApp.T,sceneIdentityEl=sceneIdentityApp.el;sceneIdentityApp.flushTimeouts();sceneIdentityEl('aspect').value='16:9';sceneIdentityEl('seedanceProfile').value='white-model';sceneIdentityEl('seedanceScope').value='scene';sceneIdentityT.shots.slice(0,2).forEach(shot=>{shot.dur=.5;});sceneIdentityT.shots.splice(2);sceneIdentityT.syncScene();sceneIdentityT.updateSeedanceProfileUI();let sceneRecorderIndex=0;
sceneIdentityApp.sandbox.MediaRecorder=class {
  static isTypeSupported(type){return /^video\/mp4/i.test(type);}constructor(_stream,options={}){this.mimeType=options.mimeType;this.state='inactive';this.index=sceneRecorderIndex++;installStartEventTarget(this);}
  start(){this.state='recording';this.emitStart();}requestData(){this.ondataavailable?.({data:new Blob([mp4ForPlan(sceneIdentityT,this.index)],{type:this.mimeType})});}stop(){if(this.state==='inactive')return;this.state='inactive';this.ondataavailable?.({data:new Blob([mp4ForPlan(sceneIdentityT,this.index)],{type:this.mimeType})});this.onstop?.();}
  pause(){this.state='paused';}resume(){this.state='recording';}
};
const sceneIdentityRun=sceneIdentityT.exportSeedanceWhiteModelPackage();for(let clip=0;clip<2;clip++){await new Promise(resolve=>setImmediate(resolve));for(let frame=0;frame<40;frame++)sceneIdentityT.captureState.recStep?.();sceneIdentityApp.flushTimeouts();await new Promise(resolve=>setImmediate(resolve));}const sceneIdentityReady=await sceneIdentityRun;
const sceneIdentityDownload=await sceneIdentityEl('seedancePack').onclick();
assert(sceneIdentityReady===true&&sceneIdentityDownload===true&&!sceneIdentityT.captureTransaction,'an unchanged scene-scope package remains available for its explicit download action');
sceneIdentityT.shots[0].yaw=23;sceneIdentityT.syncScene();sceneIdentityT.markDirty();sceneIdentityApp.flushTimeouts();const sceneIdentityProject=JSON.stringify(sceneIdentityT.project),sceneIdentityStage=JSON.stringify(sceneIdentityT.stageToData()),sceneIdentityHistory=JSON.stringify(sceneIdentityT.historySnapshot),sceneIdentityWrites=sceneIdentityApp.storage._writes;
const changedSceneRun=sceneIdentityEl('seedancePack').onclick();await new Promise(resolve=>setImmediate(resolve));const changedSceneTarget=sceneIdentityT.captureTransaction?.target,changedSceneStopped=sceneIdentityT.stopActiveCapture();sceneIdentityApp.flushTimeouts();const changedSceneResult=await changedSceneRun;
assert(changedSceneTarget?.scope==='scene'&&changedSceneTarget?.content?.scene?.shots?.[0]?.yaw===23&&changedSceneStopped===true&&changedSceneResult===false,
  `editing content inside the same scene invalidates its cached scene package (${JSON.stringify({scope:changedSceneTarget?.scope,yaw:changedSceneTarget?.content?.scene?.shots?.[0]?.yaw,changedSceneStopped,changedSceneResult})})`);
const changedSceneZeroWrite={project:JSON.stringify(sceneIdentityT.project)===sceneIdentityProject,stage:JSON.stringify(sceneIdentityT.stageToData())===sceneIdentityStage,history:JSON.stringify(sceneIdentityT.historySnapshot)===sceneIdentityHistory,autosave:sceneIdentityApp.storage._writes===sceneIdentityWrites};
assert(Object.values(changedSceneZeroWrite).every(Boolean),`scene-content stale-package regeneration/cancel adds no project, stage, history, or autosave write (${JSON.stringify(changedSceneZeroWrite)})`);

console.log('· v1-v5 real white-export execution table');
const compatibilityRows=[];
for(const version of [1,2,3,4,5]){
  const versionApp=bootApp(),versionT=versionApp.T,versionEl=versionApp.el,legacy=JSON.parse(JSON.stringify(versionT.project));legacy.version=version;
  legacy.aspect='9:16';legacy.scenes[0].shots=legacy.scenes[0].shots.slice(0,1);legacy.scenes[0].shots[0].dur=.5;
  legacy.scenes[0].shots[0].lock=version%2?legacy.scenes[0].actors[0]?.label||'':'';legacy.scenes[0].shots[0].reframeByAspect={'9:16':{offsetX:(version-3)*.1,offsetY:0,zoom:1+version*.1}};
  const opened=versionT.openProjectData(legacy);versionApp.flushTimeouts();versionEl('aspect').value='9:16';versionEl('seedanceProfile').value='white-model';versionEl('seedanceScope').value='shot';versionT.updateSeedanceProfileUI();
  versionApp.sandbox.MediaRecorder=class {
    static isTypeSupported(type){return /^video\/mp4/i.test(type);}constructor(_stream,options={}){this.mimeType=options.mimeType;this.state='inactive';installStartEventTarget(this);}
    start(){this.state='recording';this.emitStart();}requestData(){this.ondataavailable?.({data:new Blob([mp4ForPlan(versionT)],{type:this.mimeType})});}stop(){if(this.state==='inactive')return;this.state='inactive';this.ondataavailable?.({data:new Blob([mp4ForPlan(versionT)],{type:this.mimeType})});this.onstop?.();}
    pause(){this.state='paused';}resume(){this.state='recording';}
  };
  versionApp.sandbox.clock[version%2?'play':'pause']();versionT.setTime(.2);versionT.updateActors();versionT.updateShotCam();
  const normalizedVersion=versionT.project.version,versionStage=JSON.stringify(versionT.stageToData()),versionBefore=JSON.stringify(versionT.project),versionWrites=versionApp.storage._writes;
  const versionRun=versionT.exportSeedanceWhiteModelPackage();await new Promise(resolve=>setImmediate(resolve));for(let frame=0;frame<20;frame++)versionT.captureState.recStep?.();versionApp.flushTimeouts();const exported=await versionRun;
  const projectSame=JSON.stringify(versionT.project)===versionBefore,stageSame=JSON.stringify(versionT.stageToData())===versionStage,writesSame=versionApp.storage._writes===versionWrites;
  compatibilityRows.push({sourceVersion:version,normalizedVersion,opened,exported,aspect:versionT.project.aspect,follow:versionT.shots[0].lock===versionT.actors[0]?.label,playingAtStart:version%2===1,
    zeroWrite:projectSame&&stageSame&&writesSame,projectSame,stageSame,writesSame});
}
assert(compatibilityRows.every(row=>row.opened&&row.normalizedVersion===5&&row.exported&&row.aspect==='9:16'&&row.zeroWrite),`v1-v5 projects normalize and execute real 9:16 white export with zero writes (${JSON.stringify(compatibilityRows)})`);
assert(compatibilityRows.some(row=>row.follow)&&compatibilityRows.some(row=>!row.follow)&&compatibilityRows.some(row=>row.playingAtStart)&&compatibilityRows.some(row=>!row.playingAtStart),`v1-v5 execution table covers Follow on/off and playing/paused transaction starts (${JSON.stringify(compatibilityRows)})`);

console.log(`\nC7 Seedance white-model profile: ${passed} passed, ${failed} failed`);
process.exit(failed?1:0);
