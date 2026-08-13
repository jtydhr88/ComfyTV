/*
 * Seedance 2.5 white-model export profile.
 *
 * This module deliberately owns only deterministic planning, byte-level manifest
 * metadata, and synchronous render-state overlays. It does not know about DOM,
 * project persistence, MediaRecorder, or Electron. The capture runtime injects the
 * live scene/renderer/camera collaborators at call time.
 */

const SEEDANCE_WHITE_MODEL_PROFILE=Object.freeze({
  id:'seedance-2.5-white-model-v1',
  fps:24,
  audio:false,
  maxShotDuration:29.5,
  continuationDuration:30,
  resolutionByAspect:Object.freeze({
    '16:9':Object.freeze([1920,1080]),
    '9:16':Object.freeze([1080,1920]),
    '1:1':Object.freeze([1440,1440]),
    '4:3':Object.freeze([1664,1248])
  }),
  whiteModel:Object.freeze({
    background:0xe8e8e5,
    clay:0xd8d8d3,
    ground:0xcacac4,
    roughness:.94,
    metalness:0
  })
});

function seedanceProfileError(code,message){const error=new Error(message);error.code=code;return error;}
function finite(value){return Number.isFinite(Number(value));}
function rounded(value,digits=6){return +Number(value).toFixed(digits);}
function deepFreeze(value){
  if(!value||typeof value!=='object'||Object.isFrozen(value))return value;
  Object.freeze(value);Object.values(value).forEach(deepFreeze);return value;
}

function planSeedanceWhiteModelPackage({scope='shot',sceneIndex=0,shotIndex=0,shots=[],aspect='16:9',fps=SEEDANCE_WHITE_MODEL_PROFILE.fps}={}){
  if(!['shot','scene'].includes(scope))throw seedanceProfileError('SEEDANCE_SCOPE_INVALID','Seedance white-model scope must be shot or scene.');
  if(!Number.isInteger(sceneIndex)||sceneIndex<0)throw seedanceProfileError('SEEDANCE_SCENE_INVALID','Seedance white-model scene index is invalid.');
  if(!Array.isArray(shots)||!shots.length)throw seedanceProfileError('SEEDANCE_SHOTS_EMPTY','Seedance white-model export requires at least one shot.');
  if(!Number.isInteger(fps)||fps<1||fps>120)throw seedanceProfileError('SEEDANCE_FPS_INVALID','Seedance white-model fps is invalid.');
  const resolution=SEEDANCE_WHITE_MODEL_PROFILE.resolutionByAspect[aspect];
  if(!resolution)throw seedanceProfileError('SEEDANCE_ASPECT_INVALID','Seedance white-model aspect is invalid.');
  const normalized=shots.map((shot,arrayIndex)=>{
    const index=Number.isInteger(shot?.index)?shot.index:arrayIndex,duration=Number(shot?.duration??shot?.dur);
    if(index<0||!finite(duration)||duration<=0)throw seedanceProfileError('SEEDANCE_SHOT_INVALID',`Seedance white-model shot ${arrayIndex+1} is invalid.`);
    if(duration>SEEDANCE_WHITE_MODEL_PROFILE.maxShotDuration+1e-9){
      const error=seedanceProfileError('SEEDANCE_SHOT_TOO_LONG',`Seedance white-model shot ${index+1} exceeds ${SEEDANCE_WHITE_MODEL_PROFILE.maxShotDuration}s.`);
      error.shotIndex=index;error.duration=duration;error.limit=SEEDANCE_WHITE_MODEL_PROFILE.maxShotDuration;throw error;
    }
    const sourceReframe=shot?.reframe;
    const reframe=sourceReframe&&typeof sourceReframe==='object'
      ?{offsetX:Number(sourceReframe.offsetX)||0,offsetY:Number(sourceReframe.offsetY)||0,zoom:Number(sourceReframe.zoom)||1}
      :null;
    return {index,duration:rounded(duration),reframe};
  });
  const selected=scope==='shot'?[normalized.find(shot=>shot.index===shotIndex)||normalized[0]]:normalized;
  let globalFrame=0,globalStart=0;
  const clips=selected.map((shot,clipIndex)=>{
    // Encoded video is a half-open sample sequence: N frames at N/fps seconds.
    // A separate endpoint sample would require N+1 frame durations and is not a
    // 5s/30fps media contract. The source shot end remains in `end`; its nearest
    // frozen sample is within one frame period.
    const frameCount=Math.max(1,Math.round(shot.duration*fps)),frames=[];
    for(let frame=0;frame<frameCount;frame++){
      const localTime=Math.min(shot.duration,frame/fps);
      frames.push(Object.freeze({
        globalFrame:globalFrame++,clipIndex,frame,sceneIndex,shotIndex:shot.index,
        localTime:rounded(localTime),globalTime:rounded(globalStart+localTime)
      }));
    }
    const clip=Object.freeze({
      clipIndex,sceneIndex,shotIndex:shot.index,duration:shot.duration,fps,frameCount,
      start:rounded(globalStart),end:rounded(globalStart+shot.duration),
      resolution:Object.freeze(resolution.slice()),aspect,reframe:shot.reframe,
      filename:`01_white_model_S${sceneIndex+1}C${shot.index+1}.${'mp4'}`,
      frames:Object.freeze(frames)
    });
    globalStart+=shot.duration;return clip;
  });
  const continuationGroups=[];let current=null;
  clips.forEach(clip=>{
    if(!current||current.duration+clip.duration>SEEDANCE_WHITE_MODEL_PROFILE.continuationDuration+1e-9){
      current={index:continuationGroups.length,duration:0,clipIndexes:[],shotIndexes:[],start:clip.start,end:clip.end};continuationGroups.push(current);
    }
    current.duration=rounded(current.duration+clip.duration);current.clipIndexes.push(clip.clipIndex);current.shotIndexes.push(clip.shotIndex);current.end=clip.end;
  });
  continuationGroups.forEach(group=>{group.label=`continuation-${group.index+1}`;deepFreeze(group);});
  return deepFreeze({
    schema:'prevision.seedance-white-model-plan/v1',profile:SEEDANCE_WHITE_MODEL_PROFILE.id,
    scope,sceneIndex,sourceShotIndex:shotIndex,aspect,resolution:resolution.slice(),fps,audio:false,
    totalDuration:rounded(globalStart),totalFrames:globalFrame,clips,continuationGroups
  });
}

function mp4Invalid(message){throw seedanceProfileError('SEEDANCE_MEDIA_INVALID',message);}
function mp4U16(view,offset,end,message){if(!Number.isSafeInteger(offset)||offset<0||offset+2>end)mp4Invalid(message);return view.getUint16(offset,false);}
function mp4U32(view,offset,end,message){if(!Number.isSafeInteger(offset)||offset<0||offset+4>end)mp4Invalid(message);return view.getUint32(offset,false);}
function mp4U64(view,offset,end,message){if(!Number.isSafeInteger(offset)||offset<0||offset+8>end)mp4Invalid(message);const value=(BigInt(view.getUint32(offset,false))<<32n)|BigInt(view.getUint32(offset+4,false));if(value>BigInt(Number.MAX_SAFE_INTEGER))mp4Invalid(message);return Number(value);}
function mp4Boxes(bytes,start=0,end=bytes?.byteLength??0){
  const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),boxes=[];let offset=start;
  if(!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start<0||end<start||end>bytes.byteLength)mp4Invalid('Encoded MP4 box bounds are invalid.');
  while(offset+8<=end){
    let size=mp4U32(view,offset,end,'Encoded MP4 box is truncated.'),header=8;
    const type=String.fromCharCode(...bytes.slice(offset+4,offset+8));
    if(size===1){size=mp4U64(view,offset+8,end,'Encoded MP4 extended box is truncated.');header=16;}
    if(size===0)size=end-offset;
    if(!Number.isSafeInteger(size)||size<header||size>end-offset)mp4Invalid('Encoded MP4 box is invalid or truncated.');
    boxes.push({type,start:offset,dataStart:offset+header,end:offset+size});offset+=size;
  }
  if(offset!==end)mp4Invalid('Encoded MP4 box alignment is invalid.');return boxes;
}
function mp4Child(bytes,box,type){return mp4Boxes(bytes,box.dataStart,box.end).filter(child=>child.type===type);}
function mp4Single(bytes,box,type){const found=mp4Child(bytes,box,type);return found.length===1?found[0]:null;}
function mp4VersionFlags(bytes,box,label){if(box.dataStart+4>box.end)mp4Invalid(`${label} is truncated.`);const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),word=mp4U32(view,box.dataStart,box.end,`${label} is truncated.`);return {version:word>>>24,flags:word&0x00ffffff};}
function mp4Handler(bytes,mdia){const hdlr=mp4Single(bytes,mdia,'hdlr');return hdlr&&hdlr.dataStart+12<=hdlr.end?String.fromCharCode(...bytes.slice(hdlr.dataStart+8,hdlr.dataStart+12)):'';}
function mp4MediaHeader(bytes,mdia){
  const mdhd=mp4Single(bytes,mdia,'mdhd');if(!mdhd)mp4Invalid('Encoded MP4 video timescale is missing.');const {version}=mp4VersionFlags(bytes,mdhd,'Encoded MP4 video header');
  if(version!==0&&version!==1)mp4Invalid('Encoded MP4 video header version is invalid.');const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),at=mdhd.dataStart+(version===1?20:12),durationAt=at+4;
  const timescale=mp4U32(view,at,mdhd.end,'Encoded MP4 video duration is truncated.'),duration=version===1?mp4U64(view,durationAt,mdhd.end,'Encoded MP4 video duration is truncated.'):mp4U32(view,durationAt,mdhd.end,'Encoded MP4 video duration is truncated.');
  if(!timescale)mp4Invalid('Encoded MP4 video timing is invalid.');return {timescale,duration};
}
function mp4AvcSampleEntry(bytes,stsd){
  const {version,flags}=mp4VersionFlags(bytes,stsd,'Encoded MP4 sample description');if(version!==0||flags)mp4Invalid('Encoded MP4 sample description version is invalid.');
  const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),count=mp4U32(view,stsd.dataStart+4,stsd.end,'Encoded MP4 sample description is truncated.'),start=stsd.dataStart+8;
  if(count!==1||start+8>stsd.end)mp4Invalid('Encoded MP4 video sample description is missing.');const size=mp4U32(view,start,stsd.end,'Encoded MP4 video sample entry is truncated.'),type=String.fromCharCode(...bytes.slice(start+4,start+8)),entryEnd=start+size;
  if(type!=='avc1'||size<86||entryEnd>stsd.end)mp4Invalid(`Encoded media is not a complete H.264/avc1 video sample entry (${type}/${size}/${entryEnd}/${stsd.end}).`);
  const avcC=mp4Single(bytes,{dataStart:start+86,end:entryEnd},'avcC');if(!avcC)mp4Invalid('Encoded H.264/avc1 sample entry is missing avcC.');
  const at=avcC.dataStart;if(at+7>avcC.end||bytes[at]!==1)mp4Invalid('Encoded H.264 avcC configuration is invalid.');let offset=at+6,spsCount=bytes[at+5]&31;
  if(!spsCount)mp4Invalid('Encoded H.264 avcC configuration has no SPS.');while(spsCount--){const length=mp4U16(view,offset,avcC.end,'Encoded H.264 avcC SPS is truncated.');offset+=2;if(!length||offset+length>avcC.end)mp4Invalid('Encoded H.264 avcC SPS is truncated.');offset+=length;}
  if(offset+1>avcC.end||!bytes[offset++])mp4Invalid('Encoded H.264 avcC configuration has no PPS.');const ppsCount=bytes[offset-1];for(let index=0;index<ppsCount;index++){const length=mp4U16(view,offset,avcC.end,'Encoded H.264 avcC PPS is truncated.');offset+=2;if(!length||offset+length>avcC.end)mp4Invalid('Encoded H.264 avcC PPS is truncated.');offset+=length;}
  return 'H264';
}
function mp4RangeInMdat(start,size,mdats){const end=start+size;if(!Number.isSafeInteger(start)||!Number.isSafeInteger(size)||size<=0||!Number.isSafeInteger(end)||!mdats.some(mdat=>start>=mdat.dataStart&&end<=mdat.end))mp4Invalid('Encoded MP4 sample bytes are missing or out of bounds.');}
function mp4SampleTable(bytes,mdia){const minf=mp4Single(bytes,mdia,'minf'),stbl=minf&&mp4Single(bytes,minf,'stbl'),stsd=stbl&&mp4Single(bytes,stbl,'stsd');if(!stbl||!stsd)mp4Invalid('Encoded MP4 video sample table is missing.');return {stbl,codec:mp4AvcSampleEntry(bytes,stsd)};}
function mp4NonFragmentedTiming(bytes,stbl,mdats){
  const stts=mp4Single(bytes,stbl,'stts');if(!stts)return null;const {version,flags}=mp4VersionFlags(bytes,stts,'Encoded MP4 sample timing');if(version!==0||flags)mp4Invalid('Encoded MP4 sample timing version is invalid.');
  const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),entries=mp4U32(view,stts.dataStart+4,stts.end,'Encoded MP4 sample timing is truncated.');let sampleCount=0,durationTicks=0,offset=stts.dataStart+8;
  for(let index=0;index<entries;index++,offset+=8){const samples=mp4U32(view,offset,stts.end,'Encoded MP4 sample timing is truncated.'),delta=mp4U32(view,offset+4,stts.end,'Encoded MP4 sample timing is truncated.');if(!samples||!delta)mp4Invalid('Encoded MP4 sample timing is invalid.');sampleCount+=samples;durationTicks+=samples*delta;if(!Number.isSafeInteger(sampleCount)||!Number.isSafeInteger(durationTicks))mp4Invalid('Encoded MP4 sample timing is unsafe.');}
  if(!sampleCount)return null;
  const stsz=mp4Single(bytes,stbl,'stsz'),stsc=mp4Single(bytes,stbl,'stsc'),stco=mp4Single(bytes,stbl,'stco')||mp4Single(bytes,stbl,'co64');if(!stsz||!stsc||!stco)mp4Invalid('Encoded MP4 sample byte tables are missing.');
  const sizeHeader=mp4VersionFlags(bytes,stsz,'Encoded MP4 sample sizes');if(sizeHeader.version!==0||sizeHeader.flags)mp4Invalid('Encoded MP4 sample size version is invalid.');const fixedSize=mp4U32(view,stsz.dataStart+4,stsz.end,'Encoded MP4 sample sizes are truncated.'),sizeCount=mp4U32(view,stsz.dataStart+8,stsz.end,'Encoded MP4 sample sizes are truncated.');
  if(sizeCount!==sampleCount)mp4Invalid('Encoded MP4 sample count does not match its sample sizes.');const sizes=[];offset=stsz.dataStart+12;for(let index=0;index<sampleCount;index++){const size=fixedSize||mp4U32(view,offset,stsz.end,'Encoded MP4 sample sizes are truncated.');if(!size)mp4Invalid('Encoded MP4 sample size is invalid.');sizes.push(size);if(!fixedSize)offset+=4;}
  const scHeader=mp4VersionFlags(bytes,stsc,'Encoded MP4 chunk map');if(scHeader.version!==0||scHeader.flags)mp4Invalid('Encoded MP4 chunk map version is invalid.');const scCount=mp4U32(view,stsc.dataStart+4,stsc.end,'Encoded MP4 chunk map is truncated.'),maps=[];offset=stsc.dataStart+8;
  for(let index=0;index<scCount;index++,offset+=12){const first=mp4U32(view,offset,stsc.end,'Encoded MP4 chunk map is truncated.'),per=mp4U32(view,offset+4,stsc.end,'Encoded MP4 chunk map is truncated.'),description=mp4U32(view,offset+8,stsc.end,'Encoded MP4 chunk map is truncated.');if((index===0&&first!==1)||(index>0&&first<=maps[index-1].first)||!per||description!==1)mp4Invalid('Encoded MP4 chunk map sample description is invalid.');maps.push({first,per});}
  if(!maps.length||maps[0].first!==1)mp4Invalid('Encoded MP4 chunk map is missing.');const coHeader=mp4VersionFlags(bytes,stco,'Encoded MP4 chunk offsets');if(coHeader.version!==0||coHeader.flags)mp4Invalid('Encoded MP4 chunk offsets version is invalid.');const chunkCount=mp4U32(view,stco.dataStart+4,stco.end,'Encoded MP4 chunk offsets are truncated.'),chunkOffsets=[];offset=stco.dataStart+8;
  for(let index=0;index<chunkCount;index++,offset+=stco.type==='co64'?8:4)chunkOffsets.push(stco.type==='co64'?mp4U64(view,offset,stco.end,'Encoded MP4 chunk offsets are truncated.'):mp4U32(view,offset,stco.end,'Encoded MP4 chunk offsets are truncated.'));
  let sampleIndex=0;for(let chunk=1;chunk<=chunkOffsets.length;chunk++){let map=maps[0];for(const candidate of maps){if(candidate.first<=chunk)map=candidate;else break;}let cursor=chunkOffsets[chunk-1];for(let index=0;index<map.per;index++){if(sampleIndex>=sizes.length)mp4Invalid('Encoded MP4 chunk map has excess samples.');const size=sizes[sampleIndex++];mp4RangeInMdat(cursor,size,mdats);cursor+=size;}}
  if(sampleIndex!==sampleCount)mp4Invalid('Encoded MP4 chunk map does not cover every sample.');return {sampleCount,durationTicks};
}
function mp4VideoTrackId(bytes,trak){const tkhd=mp4Single(bytes,trak,'tkhd');if(!tkhd)mp4Invalid('Encoded MP4 video track id is missing.');const {version}=mp4VersionFlags(bytes,tkhd,'Encoded MP4 track header');if(version!==0&&version!==1)mp4Invalid('Encoded MP4 track header version is invalid.');return mp4U32(new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),tkhd.dataStart+(version===1?20:12),tkhd.end,'Encoded MP4 video track id is missing.');}
function mp4Trex(bytes,moov,trackId){const mvex=mp4Single(bytes,moov,'mvex');if(!mvex)return null;const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);for(const trex of mp4Child(bytes,mvex,'trex')){const {version,flags}=mp4VersionFlags(bytes,trex,'Encoded MP4 trex');if(version!==0||flags)mp4Invalid('Encoded MP4 trex version is invalid.');if(mp4U32(view,trex.dataStart+4,trex.end,'Encoded MP4 trex is truncated.')===trackId){const description=mp4U32(view,trex.dataStart+8,trex.end,'Encoded MP4 trex is truncated.');if(description!==1)mp4Invalid('Encoded fragmented MP4 trex sample description is invalid.');return {description,duration:mp4U32(view,trex.dataStart+12,trex.end,'Encoded MP4 trex is truncated.'),size:mp4U32(view,trex.dataStart+16,trex.end,'Encoded MP4 trex is truncated.')};}}return null;}
function mp4FragmentDecodeTime(bytes,traf){
  const boxes=mp4Child(bytes,traf,'tfdt');if(boxes.length!==1)mp4Invalid('Encoded fragmented MP4 requires exactly one tfdt per video fragment.');const tfdt=boxes[0],head=mp4VersionFlags(bytes,tfdt,'Encoded fragmented MP4 tfdt');if((head.version!==0&&head.version!==1)||head.flags)mp4Invalid('Encoded fragmented MP4 tfdt version or flags are invalid.');const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),at=tfdt.dataStart+4;return {tfdt,version:head.version,value:head.version===1?mp4U64(view,at,tfdt.end,'Encoded fragmented MP4 tfdt is truncated.'):mp4U32(view,at,tfdt.end,'Encoded fragmented MP4 tfdt is truncated.')};
}
function mp4FragmentTiming(bytes,topBoxes,trackId,defaults,mdats){
  const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);let sampleCount=0,durationTicks=0,previousDecodeEnd=null,timelineGapTicks=0,timelineOverlapTicks=0;
  for(const moof of topBoxes.filter(box=>box.type==='moof'))for(const traf of mp4Child(bytes,moof,'traf')){
    const tfhd=mp4Single(bytes,traf,'tfhd');if(!tfhd)continue;const head=mp4VersionFlags(bytes,tfhd,'Encoded fragmented MP4 tfhd');if(head.version!==0||head.flags&~0x03003b)mp4Invalid('Encoded fragmented MP4 tfhd flags are invalid.');
    let offset=tfhd.dataStart+4;if(mp4U32(view,offset,tfhd.end,'Encoded fragmented MP4 tfhd is truncated.')!==trackId)continue;offset+=4;let base=moof.start;
    if(head.flags&1){base=mp4U64(view,offset,tfhd.end,'Encoded fragmented MP4 tfhd base offset is truncated.');offset+=8;}const description=head.flags&2?mp4U32(view,offset,tfhd.end,'Encoded fragmented MP4 tfhd is truncated.'):defaults?.description||0;if(head.flags&2)offset+=4;if(description!==1)mp4Invalid('Encoded fragmented MP4 tfhd sample description is invalid.');const defaultDuration=head.flags&8?mp4U32(view,offset,tfhd.end,'Encoded fragmented MP4 tfhd is truncated.'):defaults?.duration||0;if(head.flags&8)offset+=4;const defaultSize=head.flags&16?mp4U32(view,offset,tfhd.end,'Encoded fragmented MP4 tfhd is truncated.'):defaults?.size||0;if(head.flags&16)offset+=4;if(head.flags&32){mp4U32(view,offset,tfhd.end,'Encoded fragmented MP4 tfhd is truncated.');offset+=4;}if(offset!==tfhd.end)mp4Invalid('Encoded fragmented MP4 tfhd fields are invalid.');
    const decodeStart=mp4FragmentDecodeTime(bytes,traf).value;if(previousDecodeEnd===null)timelineGapTicks+=decodeStart;else if(decodeStart>previousDecodeEnd)timelineGapTicks+=decodeStart-previousDecodeEnd;else if(decodeStart<previousDecodeEnd)timelineOverlapTicks+=previousDecodeEnd-decodeStart;let decodeCursor=decodeStart;
    let nextDataOffset=null;for(const trun of mp4Child(bytes,traf,'trun')){const run=mp4VersionFlags(bytes,trun,'Encoded fragmented MP4 trun');if((run.version!==0&&run.version!==1)||run.flags&~0x000f05)mp4Invalid('Encoded fragmented MP4 trun flags are invalid.');const count=mp4U32(view,trun.dataStart+4,trun.end,'Encoded fragmented MP4 run is truncated.');let cursor=trun.dataStart+8,dataOffset=nextDataOffset;if(run.flags&1){if(cursor+4>trun.end)mp4Invalid('Encoded fragmented MP4 data offset is truncated.');dataOffset=base+view.getInt32(cursor,false);cursor+=4;}if(run.flags&4){mp4U32(view,cursor,trun.end,'Encoded fragmented MP4 first-sample flags are truncated.');cursor+=4;}if(!Number.isSafeInteger(dataOffset))dataOffset=moof.end;
      for(let index=0;index<count;index++){const duration=run.flags&0x100?mp4U32(view,cursor,trun.end,'Encoded fragmented MP4 sample duration is truncated.'):defaultDuration;if(run.flags&0x100)cursor+=4;const size=run.flags&0x200?mp4U32(view,cursor,trun.end,'Encoded fragmented MP4 sample size is truncated.'):defaultSize;if(run.flags&0x200)cursor+=4;if(run.flags&0x400){mp4U32(view,cursor,trun.end,'Encoded fragmented MP4 sample flags are truncated.');cursor+=4;}if(run.flags&0x800){mp4U32(view,cursor,trun.end,'Encoded fragmented MP4 composition time is truncated.');cursor+=4;}if(!duration||!size)mp4Invalid('Encoded fragmented MP4 sample defaults are missing.');mp4RangeInMdat(dataOffset,size,mdats);dataOffset+=size;sampleCount++;decodeCursor+=duration;if(!Number.isSafeInteger(sampleCount)||!Number.isSafeInteger(decodeCursor))mp4Invalid('Encoded fragmented MP4 timing is unsafe.');}
      if(cursor!==trun.end)mp4Invalid('Encoded fragmented MP4 trun fields are invalid.');nextDataOffset=dataOffset;
    }
    if(decodeCursor===decodeStart)mp4Invalid('Encoded fragmented MP4 video fragment has no samples.');previousDecodeEnd=decodeCursor;durationTicks=Math.max(durationTicks,decodeCursor);
  }
  return {sampleCount,durationTicks,timelineGapTicks,timelineOverlapTicks};
}
function inspectSeedanceMp4(bytes){
  bytes=bytes instanceof Uint8Array?bytes:new Uint8Array(bytes||[]);const topBoxes=mp4Boxes(bytes),moov=topBoxes.find(box=>box.type==='moov'),mdats=topBoxes.filter(box=>box.type==='mdat');if(!moov||!mdats.length)mp4Invalid('Encoded MP4 media metadata or sample bytes are missing.');
  const track=mp4Child(bytes,moov,'trak').map(trak=>({trak,mdia:mp4Single(bytes,trak,'mdia')})).find(({mdia})=>mdia&&mp4Handler(bytes,mdia)==='vide');if(!track)mp4Invalid('Encoded MP4 video track is missing.');
  const header=mp4MediaHeader(bytes,track.mdia),table=mp4SampleTable(bytes,track.mdia),normal=mp4NonFragmentedTiming(bytes,table.stbl,mdats),trackId=mp4VideoTrackId(bytes,track.trak),fragmented=normal?null:mp4FragmentTiming(bytes,topBoxes,trackId,mp4Trex(bytes,moov,trackId),mdats),timing=normal||fragmented;
  if(!timing.sampleCount||!timing.durationTicks)mp4Invalid('Encoded MP4 video sample timing is missing.');const duration=timing.durationTicks/header.timescale;
  if(!Number.isFinite(duration)||duration<=0)mp4Invalid('Encoded MP4 video duration is invalid.');return deepFreeze({container:'mp4',codec:table.codec,frameCount:timing.sampleCount,timescale:header.timescale,durationTicks:timing.durationTicks,duration:rounded(duration,6),fps:rounded(timing.sampleCount/duration,6),...(timing.timelineGapTicks?{timelineGapTicks:timing.timelineGapTicks}:{}),...(timing.timelineOverlapTicks?{timelineOverlapTicks:timing.timelineOverlapTicks}:{})});
}
function mp4WriteU64(view,offset,end,value,message){
  if(!Number.isSafeInteger(value)||value<0||!Number.isSafeInteger(offset)||offset<0||offset+8>end)mp4Invalid(message);
  const wide=BigInt(value);view.setUint32(offset,Number(wide>>32n),false);view.setUint32(offset+4,Number(wide&0xffffffffn),false);
}
function mp4ReadSizedUInt(view,offset,end,size,message){let value=0;if(!Number.isInteger(size)||size<1||size>4||offset<0||offset+size>end)mp4Invalid(message);for(let index=0;index<size;index++)value=value*256+view.getUint8(offset+index);if(!Number.isSafeInteger(value))mp4Invalid(message);return value;}
function mp4WriteFragmentDecodeTime(bytes,traf,value){const {tfdt,version}=mp4FragmentDecodeTime(bytes,traf),view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),at=tfdt.dataStart+4;if(version===1)mp4WriteU64(view,at,tfdt.end,value,'Encoded fragmented MP4 tfdt is truncated.');else{if(value>0xffffffff)mp4Invalid('Encoded fragmented MP4 tfdt cannot represent the normalized decode time.');view.setUint32(at,value,false);}}
function normalizeSeedanceMp4Timing(bytes,{frameCount,fps}={}){
  bytes=bytes instanceof Uint8Array?bytes:new Uint8Array(bytes||[]);const original=inspectSeedanceMp4(bytes);
  if(!Number.isInteger(frameCount)||frameCount<1||!Number.isFinite(fps)||fps<=0||original.container!=='mp4'||original.codec!=='H264'||original.frameCount!==frameCount){
    const error=seedanceProfileError('SEEDANCE_MEDIA_MISMATCH','Encoded MP4 samples cannot be normalized to the deterministic frame plan.');error.expected={frameCount,fps};error.actual=original;throw error;
  }
  const output=bytes.slice(),topBoxes=mp4Boxes(output),moov=topBoxes.find(box=>box.type==='moov');
  const track=moov&&mp4Child(output,moov,'trak').map(trak=>({trak,mdia:mp4Single(output,trak,'mdia')})).find(({mdia})=>mdia&&mp4Handler(output,mdia)==='vide');
  if(!moov||!track)mp4Invalid('Encoded MP4 video track is missing.');if(topBoxes.some(box=>box.type==='sidx'))mp4Invalid('Encoded fragmented MP4 sidx timing cannot be safely normalized.');if(mp4Child(output,track.trak,'edts').length)mp4Invalid('Encoded MP4 edit lists cannot be safely normalized.');const {stbl}=mp4SampleTable(output,track.mdia),stts=mp4Single(output,stbl,'stts'),view=new DataView(output.buffer,output.byteOffset,output.byteLength),header=mp4MediaHeader(output,track.mdia),sampleDelta=Math.round(header.timescale/fps);if(!sampleDelta)mp4Invalid('Encoded MP4 target sample timing is invalid.');
  let samples=0,entryCount=0,offset=0;if(stts){const timingHeader=mp4VersionFlags(output,stts,'Encoded MP4 sample timing');if(timingHeader.version!==0||timingHeader.flags)mp4Invalid('Encoded MP4 sample timing version is invalid.');entryCount=mp4U32(view,stts.dataStart+4,stts.end,'Encoded MP4 sample timing is truncated.');}
  if(entryCount){offset=stts.dataStart+8;for(let index=0;index<entryCount;index++,offset+=8){const count=mp4U32(view,offset,stts.end,'Encoded MP4 sample timing is truncated.');if(!count)mp4Invalid('Encoded MP4 sample timing is invalid.');samples+=count;view.setUint32(offset+4,sampleDelta,false);}}
  else{
    const trackId=mp4VideoTrackId(output,track.trak),mvex=mp4Single(output,moov,'mvex'),fragmentLayouts=new Map();let trexDuration=false;
    if(mvex)for(const trex of mp4Child(output,mvex,'trex')){if(mp4U32(view,trex.dataStart+4,trex.end,'Encoded MP4 trex is truncated.')===trackId){view.setUint32(trex.dataStart+12,sampleDelta,false);trexDuration=true;}}
    for(const moof of topBoxes.filter(box=>box.type==='moof')){const trafs=mp4Child(output,moof,'traf');for(let trafIndex=0;trafIndex<trafs.length;trafIndex++){const traf=trafs[trafIndex];
      const tfhd=mp4Single(output,traf,'tfhd');if(!tfhd)continue;const tfhdHeader=mp4VersionFlags(output,tfhd,'Encoded fragmented MP4 tfhd');if(mp4U32(view,tfhd.dataStart+4,tfhd.end,'Encoded fragmented MP4 tfhd is truncated.')!==trackId)continue;
      const fragmentStartFrame=samples;mp4WriteFragmentDecodeTime(output,traf,fragmentStartFrame*sampleDelta);
      let tfhdOffset=tfhd.dataStart+8;if(tfhdHeader.flags&1)tfhdOffset+=8;if(tfhdHeader.flags&2)tfhdOffset+=4;const tfhdDuration=!!(tfhdHeader.flags&8);if(tfhdDuration){view.setUint32(tfhdOffset,sampleDelta,false);tfhdOffset+=4;}if(tfhdHeader.flags&16)tfhdOffset+=4;if(tfhdHeader.flags&32)tfhdOffset+=4;if(tfhdOffset!==tfhd.end)mp4Invalid('Encoded fragmented MP4 tfhd fields are invalid.');
      const runs=[];for(const trun of mp4Child(output,traf,'trun')){const run=mp4VersionFlags(output,trun,'Encoded fragmented MP4 trun'),count=mp4U32(view,trun.dataStart+4,trun.end,'Encoded fragmented MP4 run is truncated.'),runStartFrame=samples;let cursor=trun.dataStart+8;if(run.flags&1)cursor+=4;if(run.flags&4)cursor+=4;if(!(run.flags&0x100)&&!tfhdDuration&&!trexDuration)mp4Invalid('Encoded fragmented MP4 sample duration cannot be normalized.');
        for(let index=0;index<count;index++){if(run.flags&0x100){view.setUint32(cursor,sampleDelta,false);cursor+=4;}if(run.flags&0x200)cursor+=4;if(run.flags&0x400)cursor+=4;if(run.flags&0x800)cursor+=4;}if(cursor!==trun.end)mp4Invalid('Encoded fragmented MP4 trun fields are invalid.');samples+=count;runs.push({startFrame:runStartFrame,count});}
      fragmentLayouts.set(`${moof.start}:${trafIndex+1}`,{runs});
    }}
    for(const mfra of topBoxes.filter(box=>box.type==='mfra'))for(const tfra of mp4Child(output,mfra,'tfra')){const head=mp4VersionFlags(output,tfra,'Encoded fragmented MP4 tfra');if((head.version!==0&&head.version!==1)||head.flags)mp4Invalid('Encoded fragmented MP4 tfra version or flags are invalid.');if(mp4U32(view,tfra.dataStart+4,tfra.end,'Encoded fragmented MP4 tfra is truncated.')!==trackId)continue;const packed=mp4U32(view,tfra.dataStart+8,tfra.end,'Encoded fragmented MP4 tfra is truncated.');if(packed>>>6)mp4Invalid('Encoded fragmented MP4 tfra reserved fields are invalid.');const trafSize=((packed>>>4)&3)+1,trunSize=((packed>>>2)&3)+1,sampleSize=(packed&3)+1,entries=mp4U32(view,tfra.dataStart+12,tfra.end,'Encoded fragmented MP4 tfra is truncated.');let cursor=tfra.dataStart+16;
      for(let index=0;index<entries;index++){const timeAt=cursor;cursor+=head.version===1?8:4;const moofOffset=head.version===1?mp4U64(view,cursor,tfra.end,'Encoded fragmented MP4 tfra is truncated.'):mp4U32(view,cursor,tfra.end,'Encoded fragmented MP4 tfra is truncated.');cursor+=head.version===1?8:4;const trafNumber=mp4ReadSizedUInt(view,cursor,tfra.end,trafSize,'Encoded fragmented MP4 tfra is truncated.');cursor+=trafSize;const trunNumber=mp4ReadSizedUInt(view,cursor,tfra.end,trunSize,'Encoded fragmented MP4 tfra is truncated.');cursor+=trunSize;const sampleNumber=mp4ReadSizedUInt(view,cursor,tfra.end,sampleSize,'Encoded fragmented MP4 tfra is truncated.');cursor+=sampleSize;const layout=fragmentLayouts.get(`${moofOffset}:${trafNumber}`),run=layout?.runs?.[trunNumber-1];if(!run||sampleNumber<1||sampleNumber>run.count)mp4Invalid('Encoded fragmented MP4 tfra target is invalid.');const normalizedTime=(run.startFrame+sampleNumber-1)*sampleDelta;if(head.version===1)mp4WriteU64(view,timeAt,tfra.end,normalizedTime,'Encoded fragmented MP4 tfra is truncated.');else{if(normalizedTime>0xffffffff)mp4Invalid('Encoded fragmented MP4 tfra cannot represent the normalized time.');view.setUint32(timeAt,normalizedTime,false);}}
      if(cursor!==tfra.end)mp4Invalid('Encoded fragmented MP4 tfra fields are invalid.');
    }
  }
  if(samples!==frameCount)mp4Invalid('Encoded MP4 sample timing does not match its frame count.');const mediaDuration=frameCount*sampleDelta;
  const mdhd=mp4Single(output,track.mdia,'mdhd'),mdhdVersion=mp4VersionFlags(output,mdhd,'Encoded MP4 video header').version,mdhdDurationAt=mdhd.dataStart+(mdhdVersion===1?24:16);
  if(mdhdVersion===1)mp4WriteU64(view,mdhdDurationAt,mdhd.end,mediaDuration,'Encoded MP4 video duration is truncated.');else view.setUint32(mdhdDurationAt,mediaDuration,false);
  const mvhd=mp4Single(output,moov,'mvhd');let movieTimescale=null,movieDuration=null;
  if(mvhd){const version=mp4VersionFlags(output,mvhd,'Encoded MP4 movie header').version;if(version!==0&&version!==1)mp4Invalid('Encoded MP4 movie header version is invalid.');const timescaleAt=mvhd.dataStart+(version===1?20:12),durationAt=timescaleAt+4;movieTimescale=mp4U32(view,timescaleAt,mvhd.end,'Encoded MP4 movie duration is truncated.');movieDuration=Math.round(mediaDuration/header.timescale*movieTimescale);if(version===1)mp4WriteU64(view,durationAt,mvhd.end,movieDuration,'Encoded MP4 movie duration is truncated.');else view.setUint32(durationAt,movieDuration,false);}
  const tkhd=mp4Single(output,track.trak,'tkhd');if(tkhd&&movieDuration!==null){const version=mp4VersionFlags(output,tkhd,'Encoded MP4 track header').version,durationAt=tkhd.dataStart+(version===1?28:20);if(durationAt+(version===1?8:4)<=tkhd.end){if(version===1)mp4WriteU64(view,durationAt,tkhd.end,movieDuration,'Encoded MP4 track duration is truncated.');else view.setUint32(durationAt,movieDuration,false);}}
  return output;
}
function assertSeedanceEncodedClip(clip,media){
  if(!clip||!media)throw seedanceProfileError('SEEDANCE_MEDIA_INVALID','Encoded Seedance clip metadata is missing.');
  const expectedFrames=clip.frameCount,frameMatch=media.frameCount===expectedFrames,durationMatch=Math.abs(media.duration-clip.duration)<=1/clip.fps+1e-9,fpsMatch=Math.abs(media.fps-clip.fps)<=1e-9,timelineMatch=!(Number(media.timelineGapTicks)||Number(media.timelineOverlapTicks));
  if(media.container!=='mp4'||media.codec!=='H264'||!frameMatch||!durationMatch||!fpsMatch||!timelineMatch){
    const error=seedanceProfileError('SEEDANCE_MEDIA_MISMATCH',`Encoded ${clip.filename} differs from the deterministic frame plan.`);error.expected={frameCount:expectedFrames,duration:clip.duration,fps:clip.fps};error.actual=media;throw error;
  }
  return media;
}
function seedanceTimestampScript(plan,{mediaByFilename=null}={}){
  if(!plan?.clips)throw seedanceProfileError('SEEDANCE_PLAN_INVALID','Seedance white-model plan is missing.');
  return deepFreeze({
    schema:'prevision.seedance-timestamps/v2',profile:plan.profile,planner:{fps:plan.fps,aspect:plan.aspect},
    clips:plan.clips.map(clip=>({
      filename:clip.filename,sceneIndex:clip.sceneIndex,shotIndex:clip.shotIndex,
      planned:{start:clip.start,end:clip.end,duration:clip.duration,fps:clip.fps,frameCount:clip.frameCount,resolution:clip.resolution.join('x'),aspect:clip.aspect,sceneIndex:clip.sceneIndex,shotIndex:clip.shotIndex},
      ...(mediaByFilename?{actual:mediaByFilename instanceof Map?mediaByFilename.get(clip.filename):mediaByFilename[clip.filename]}:{}),
      frames:clip.frames.map(frame=>({globalFrame:frame.globalFrame,frame:frame.frame,localTime:frame.localTime,globalTime:frame.globalTime}))
    }))
  });
}

function createSeedanceRestoreLedger(label='seedance-white-model'){
  const restorers=[];let restored=false;
  return {
    label,
    get size(){return restorers.length;},
    get restored(){return restored;},
    push(restore){if(restored)throw seedanceProfileError('SEEDANCE_LEDGER_CLOSED','Cannot append to a restored Seedance ledger.');if(typeof restore!=='function')throw new TypeError('Seedance ledger restore entry must be a function.');restorers.push(restore);return restore;},
    set(target,key,value){
      if(!target)throw new TypeError('Seedance ledger target is required.');
      const previous=target[key];restorers.push(()=>{target[key]=previous;});target[key]=value;return value;
    },
    restore(){
      if(restored)return false;restored=true;let firstError=null;
      for(let index=restorers.length-1;index>=0;index--){try{restorers[index]();}catch(error){firstError||=error;}}
      restorers.length=0;if(firstError)throw firstError;return true;
    }
  };
}

function seedanceEditorHelper(object,explicitHelpers){
  if(explicitHelpers?.has(object))return true;
  if(object?.isSprite||object?.isLine||object?.isLineSegments||object?.isPoints)return true;
  if(object?.userData?.editorOnly||object?.userData?.isHelper||object?.userData?.selectionHelper)return true;
  return /(?:helper|gizmo|handle|label|selection|outline|grid|cameraViz)/i.test(String(object?.name||''));
}

function withSeedanceWhiteModelRender({scene,renderer,camera,sky=null,ground=null,helpers=[],snapshotRenderer=null,restoreRenderer=null,snapshotCamera=null,restoreCamera=null,render,THREE=globalThis.THREE}={}){
  if(!scene?.traverse||typeof render!=='function'||!THREE?.MeshStandardMaterial||!THREE?.Color){
    throw seedanceProfileError('SEEDANCE_RENDER_INVALID','Seedance white-model render collaborators are incomplete.');
  }
  const ledger=createSeedanceRestoreLedger(),profile=SEEDANCE_WHITE_MODEL_PROFILE.whiteModel,explicitHelpers=new Set(helpers.filter(Boolean));
  const clay=new THREE.MeshStandardMaterial({color:profile.clay,roughness:profile.roughness,metalness:profile.metalness,map:null,fog:false});
  const groundClay=new THREE.MeshStandardMaterial({color:profile.ground,roughness:profile.roughness,metalness:profile.metalness,map:null,fog:false});
  let result,rendered=false;
  try{
    if(snapshotRenderer&&restoreRenderer&&renderer){const state=snapshotRenderer(renderer);ledger.push(()=>restoreRenderer(renderer,state));}
    if(snapshotCamera&&restoreCamera&&camera){const state=snapshotCamera(camera);ledger.push(()=>restoreCamera(camera,state));}
    ledger.set(scene,'background',new THREE.Color(profile.background));
    if(scene.fog?.color){const fogColor=scene.fog.color;ledger.push(()=>{scene.fog.color=fogColor;});scene.fog.color=new THREE.Color(profile.background);}
    if(sky)ledger.set(sky,'visible',false);
    scene.traverse(object=>{
      if(!object||object===scene)return;
      if(seedanceEditorHelper(object,explicitHelpers)){if(object.visible!==false)ledger.set(object,'visible',false);return;}
      if(object.isMesh&&object.material){ledger.set(object,'material',object===ground?groundClay:(Array.isArray(object.material)?object.material.map(()=>clay):clay));}
    });
    rendered=true;result=render();
    if(result&&typeof result.then==='function')throw seedanceProfileError('SEEDANCE_RENDER_ASYNC','Seedance white-model material override may wrap only one synchronous render.');
    return result;
  }finally{
    let restoreError=null;try{ledger.restore();}catch(error){restoreError=error;}
    try{clay.dispose();}catch(error){restoreError||=error;}try{groundClay.dispose();}catch(error){restoreError||=error;}
    if(restoreError)throw restoreError;
    if(!rendered&&result!==undefined)throw seedanceProfileError('SEEDANCE_RENDER_INVALID','Seedance white-model render did not execute.');
  }
}

/* Synchronous SHA-256 keeps manifest generation deterministic in browser, Electron,
 * and Node VM tests without adding a WebCrypto or Node capability to the runtime. */
function seedanceSha256(bytes){
  bytes=bytes instanceof Uint8Array?bytes:new Uint8Array(bytes||[]);
  const rotr=(value,bits)=>(value>>>bits)|(value<<(32-bits)),primes=[];let candidate=2;
  while(primes.length<64){let prime=true;for(let divisor=2;divisor*divisor<=candidate;divisor++)if(candidate%divisor===0){prime=false;break;}if(prime)primes.push(candidate);candidate++;}
  const h=primes.slice(0,8).map(prime=>(Math.sqrt(prime)%1*0x100000000)>>>0),k=primes.map(prime=>(Math.cbrt(prime)%1*0x100000000)>>>0);
  const bitLength=bytes.length*8,paddedLength=Math.ceil((bytes.length+9)/64)*64,padded=new Uint8Array(paddedLength);padded.set(bytes);padded[bytes.length]=0x80;
  const view=new DataView(padded.buffer);view.setUint32(paddedLength-8,Math.floor(bitLength/0x100000000),false);view.setUint32(paddedLength-4,bitLength>>>0,false);
  const words=new Uint32Array(64);
  for(let offset=0;offset<paddedLength;offset+=64){
    for(let index=0;index<16;index++)words[index]=view.getUint32(offset+index*4,false);
    for(let index=16;index<64;index++){const x=words[index-15],y=words[index-2],s0=rotr(x,7)^rotr(x,18)^(x>>>3),s1=rotr(y,17)^rotr(y,19)^(y>>>10);words[index]=(words[index-16]+s0+words[index-7]+s1)>>>0;}
    let [a,b,c,d,e,f,g,hh]=h;
    for(let index=0;index<64;index++){const s1=rotr(e,6)^rotr(e,11)^rotr(e,25),choose=(e&f)^(~e&g),t1=(hh+s1+choose+k[index]+words[index])>>>0,s0=rotr(a,2)^rotr(a,13)^rotr(a,22),majority=(a&b)^(a&c)^(b&c),t2=(s0+majority)>>>0;hh=g;g=f;f=e;e=(d+t1)>>>0;d=c;c=b;b=a;a=(t1+t2)>>>0;}
    [a,b,c,d,e,f,g,hh].forEach((value,index)=>{h[index]=(h[index]+value)>>>0;});
  }
  return h.map(value=>value.toString(16).padStart(8,'0')).join('');
}

function seedanceMime(filename){
  if(/\.mp4$/i.test(filename))return 'video/mp4';if(/\.webm$/i.test(filename))return 'video/webm';
  if(/\.png$/i.test(filename))return 'image/png';if(/\.json$/i.test(filename))return 'application/json';
  if(/\.txt$/i.test(filename))return 'text/plain;charset=utf-8';return 'application/octet-stream';
}

function buildSeedanceManifest({plan,entries,saveMethod='browser-download',appearanceReferences='user-provided-separately'}={}){
  if(!plan?.clips||!Array.isArray(entries)||!entries.length)throw seedanceProfileError('SEEDANCE_MANIFEST_INVALID','Seedance manifest inputs are incomplete.');
  const clipsByName=new Map(plan.clips.map(clip=>[clip.filename,clip]));
  const files=entries.map((entry,index)=>{
    const data=entry.data instanceof Uint8Array?entry.data:new Uint8Array(entry.data||[]),clip=clipsByName.get(entry.name);
    const actual=entry.media;
    if(clip&&!actual)throw seedanceProfileError('SEEDANCE_MEDIA_INVALID',`Encoded media metadata is missing: ${entry.name}`);
    if(clip)assertSeedanceEncodedClip(clip,actual);
    return {
      filename:entry.name,mime:entry.mime||seedanceMime(entry.name),bytes:data.byteLength,sha256:seedanceSha256(data),uploadOrder:index+1,
      ...(clip?{segment:{planned:{start:clip.start,end:clip.end,duration:clip.duration,fps:clip.fps,frameCount:clip.frameCount,resolution:clip.resolution.join('x'),aspect:clip.aspect,sceneIndex:clip.sceneIndex,shotIndex:clip.shotIndex},actual}}:{})
    };
  });
  return deepFreeze({
    schema:'prevision.seedance-white-model-manifest/v1',profile:plan.profile,saveMethod,
    semantics:{whiteModel:'structure-camera-blocking-scheduling-rhythm',appearance:appearanceReferences,doNotCopy:'clay-material-or-mechanical-motion'},
    audio:false,scope:plan.scope,planner:{fps:plan.fps,resolution:plan.resolution.join('x'),aspect:plan.aspect,totalDuration:plan.totalDuration,continuationGroups:plan.continuationGroups},files,
    uploadOrder:files.map(file=>file.filename)
  });
}

function parseSeedanceStoredZip(bytes){
  bytes=bytes instanceof Uint8Array?bytes:new Uint8Array(bytes||[]);
  const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),decoder=new TextDecoder(),entries=[];let offset=0;
  while(offset+30<=bytes.length&&view.getUint32(offset,true)===0x04034b50){
    const method=view.getUint16(offset+8,true),size=view.getUint32(offset+18,true),nameLength=view.getUint16(offset+26,true),extraLength=view.getUint16(offset+28,true);
    if(method!==0)throw seedanceProfileError('SEEDANCE_ZIP_COMPRESSION','Seedance manifest verification requires stored ZIP entries.');
    const nameStart=offset+30,dataStart=nameStart+nameLength+extraLength,dataEnd=dataStart+size;
    if(dataEnd>bytes.length)throw seedanceProfileError('SEEDANCE_ZIP_TRUNCATED','Seedance ZIP entry is truncated.');
    entries.push({name:decoder.decode(bytes.slice(nameStart,nameStart+nameLength)),data:bytes.slice(dataStart,dataEnd)});offset=dataEnd;
  }
  if(bytes.length<22||view.getUint32(bytes.length-22,true)!==0x06054b50)throw seedanceProfileError('SEEDANCE_ZIP_INVALID','Seedance ZIP end record is missing.');
  return entries;
}

function verifySeedanceZipManifest(bytes,manifest,{manifestName='04_manifest.json'}={}){
  if(!manifest?.files)throw seedanceProfileError('SEEDANCE_MANIFEST_INVALID','Seedance manifest is missing its file table.');
  const entries=parseSeedanceStoredZip(bytes),byName=new Map(entries.map(entry=>[entry.name,entry]));
  if(byName.size!==entries.length)throw seedanceProfileError('SEEDANCE_ZIP_DUPLICATE','Seedance ZIP contains duplicate filenames.');
  for(const file of manifest.files){
    const entry=byName.get(file.filename);
    if(!entry||entry.data.byteLength!==file.bytes||seedanceSha256(entry.data)!==file.sha256||seedanceMime(file.filename)!==file.mime){
      const error=seedanceProfileError('SEEDANCE_MANIFEST_MISMATCH',`Seedance ZIP entry does not match manifest: ${file.filename}`);error.filename=file.filename;throw error;
    }
    if(file.mime==='video/mp4'){
      if(!file.segment?.planned||!file.segment?.actual)throw seedanceProfileError('SEEDANCE_MANIFEST_MISMATCH',`Seedance encoded MP4 metadata is incomplete: ${file.filename}`);
      const actual=inspectSeedanceMp4(entry.data);
      if(JSON.stringify(actual)!==JSON.stringify(file.segment.actual))throw seedanceProfileError('SEEDANCE_MANIFEST_MISMATCH',`Seedance encoded MP4 metadata does not match manifest: ${file.filename}`);
      try{assertSeedanceEncodedClip({filename:file.filename,...file.segment.planned},actual);}catch(_error){throw seedanceProfileError('SEEDANCE_MANIFEST_MISMATCH',`Seedance encoded MP4 does not match its planned clip: ${file.filename}`);}
    }
  }
  const manifestEntry=byName.get(manifestName);
  if(!manifestEntry)throw seedanceProfileError('SEEDANCE_MANIFEST_MISSING','Seedance ZIP manifest entry is missing.');
  let storedManifest;try{storedManifest=JSON.parse(new TextDecoder().decode(manifestEntry.data));}
  catch(_error){throw seedanceProfileError('SEEDANCE_MANIFEST_INVALID','Seedance ZIP manifest JSON is invalid.');}
  if(JSON.stringify(storedManifest)!==JSON.stringify(manifest))throw seedanceProfileError('SEEDANCE_MANIFEST_MISMATCH','Seedance ZIP manifest bytes do not match the verified manifest.');
  const payloadNames=entries.map(entry=>entry.name).filter(name=>name!==manifestName);
  if(JSON.stringify(payloadNames)!==JSON.stringify(manifest.files.map(file=>file.filename))){
    throw seedanceProfileError('SEEDANCE_UPLOAD_ORDER_MISMATCH','Seedance ZIP payload order does not match manifest upload order.');
  }
  if(entries.length!==manifest.files.length+1)throw seedanceProfileError('SEEDANCE_ZIP_EXTRA_ENTRY','Seedance ZIP contains an undeclared entry.');
  const plannedFiles=manifest.files.filter(file=>file.mime==='video/mp4'),timestampEntry=byName.get('02_timestamps.json');
  if(plannedFiles.length&&!timestampEntry)throw seedanceProfileError('SEEDANCE_MANIFEST_MISSING','Seedance timestamp JSON is missing.');
  if(timestampEntry){
    let timestamps;try{timestamps=JSON.parse(new TextDecoder().decode(timestampEntry.data));}catch(_error){throw seedanceProfileError('SEEDANCE_MANIFEST_MISMATCH','Seedance timestamp JSON is invalid.');}
    const clips=Array.isArray(timestamps.clips)?timestamps.clips:[];
    if(clips.length!==plannedFiles.length||new Set(clips.map(clip=>clip?.filename)).size!==clips.length)throw seedanceProfileError('SEEDANCE_MANIFEST_MISMATCH','Seedance timestamp clips do not bind one-to-one with planned media.');
    for(const file of plannedFiles){const clip=clips.find(clip=>clip.filename===file.filename);if(!clip||JSON.stringify(clip.planned)!==JSON.stringify(file.segment.planned)||JSON.stringify(clip.actual)!==JSON.stringify(file.segment.actual))throw seedanceProfileError('SEEDANCE_MANIFEST_MISMATCH',`Seedance timestamp metadata does not match encoded media: ${file.filename}`);
      try{assertSeedanceEncodedClip({filename:file.filename,...clip.planned},clip.actual);}catch(_error){throw seedanceProfileError('SEEDANCE_MANIFEST_MISMATCH',`Seedance timestamp metadata does not match its planned clip: ${file.filename}`);}
    }
  }
  return true;
}

export {
  SEEDANCE_WHITE_MODEL_PROFILE,
  planSeedanceWhiteModelPackage,
  seedanceTimestampScript,
  inspectSeedanceMp4,
  normalizeSeedanceMp4Timing,
  assertSeedanceEncodedClip,
  createSeedanceRestoreLedger,
  withSeedanceWhiteModelRender,
  seedanceSha256,
  seedanceMime,
  buildSeedanceManifest,
  parseSeedanceStoredZip,
  verifySeedanceZipManifest
};
