/*
 * C1 · .previz.json v5 加载→保存 round-trip(字节级)
 * 契约: golden v5 文件经 openProjectData(normalize)→装载→不做任何编辑→saveProjectFile
 *       的序列化输出与输入文件逐字节相同(架构地图 §5.1)。
 * 钉死: 字段白名单、默认值补齐、数字精度(pos/path 2 位、rotY 3 位、camAim 2 位)、
 *       键序、JSON.stringify(project,null,2) 格式、modified 时间戳语义(Date 已冻结)。
 * 运行: node 测试/回归/C1_previz_roundtrip.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { bootApp, captureSave, root, FROZEN_ISO } from './harness/vm-app.mjs';
import { ACTOR_FIELDS, SHOT_FIELDS } from '../../src/core/project-data.js';

let passed = 0, failed = 0;
function assert(cond, msg) {
  if (cond) { passed++; }
  else { failed++; console.error('  ✗ FAIL: ' + msg); }
}

const projectsDir = path.join(root, 'qa', 'golden', 'projects');
const goldenFiles = fs.readdirSync(projectsDir).filter(f => f.endsWith('.previz.json')).sort();
assert(goldenFiles.length >= 3, `golden 项目至少 3 个(最小集: welcome/ride-pano/camwork), 实际 ${goldenFiles.length}`);

const expectedActorFields = ['kind','label','pose','rotY','height','scale','pathMode','timeLink','timeOffset'];
const expectedShotFields = ['name','desc','dur','lock','fov','camMode','timingMode','syncActor','yaw','pitch'];
const actorHandwritten = new Set(['pos','path','pathTimes','pathEase','mount','joints','semanticType','dimensions','asset','terrainVersion','timeLinkShot']);
const shotHandwritten = new Set(['cam','camAim','camTimes','camEase','camAimTimes','camAimEase','camFovTimes','camFovEase','reframeByAspect']);

function fieldKeys(fields, label) {
  const keys = fields.map(field => field && field.key);
  assert(keys.length > 0 && keys.every(key => typeof key === 'string' && key.trim() === key && key.length > 0),
    `${label}: 字段表 key 非空且无首尾空白`);
  assert(new Set(keys).size === keys.length, `${label}: 字段表 key 唯一`);
  return keys;
}
function assertExactKeys(actual, expected, label) {
  assert(JSON.stringify(actual) === JSON.stringify(expected),
    `${label}: 字段表首批标量 key 精确匹配(${actual.join(',')})`);
}
function assertDisjoint(keys, handwritten, label) {
  const overlap = keys.filter(key => handwritten.has(key));
  assert(overlap.length === 0, `${label}: 字段表 key 与手写白名单互斥(${overlap.join(',')})`);
}
const actorFieldKeys = fieldKeys(ACTOR_FIELDS, 'ACTOR_FIELDS');
const shotFieldKeys = fieldKeys(SHOT_FIELDS, 'SHOT_FIELDS');
assertExactKeys(actorFieldKeys, expectedActorFields, 'ACTOR_FIELDS');
assertExactKeys(shotFieldKeys, expectedShotFields, 'SHOT_FIELDS');
assertDisjoint(actorFieldKeys, actorHandwritten, 'actor');
assertDisjoint(shotFieldKeys, shotHandwritten, 'shot');
const actorCovered = new Set([...actorFieldKeys, ...actorHandwritten]);
const shotCovered = new Set([...shotFieldKeys, ...shotHandwritten]);

for (const file of goldenFiles) {
  console.log('· ' + file);
  const goldenText = fs.readFileSync(path.join(projectsDir, file), 'utf8');
  const app = bootApp(); // 每个 golden 一个全新 VM: 与录制时的确定性环境逐一对应
  const opened = app.T.openProjectData(JSON.parse(goldenText));
  assert(opened === true && app.sandbox.__alerts.length === 0,
    `${file}: openProjectData 接受 golden 且无告警(alerts=${JSON.stringify(app.sandbox.__alerts)})`);
  if (!opened) continue;
  const saved = await captureSave(app.T);
  assert(saved.name === app.T.project.name + '.previz.json',
    `${file}: 保存文件名 = <项目名>.previz.json(实际 ${saved.name})`);
  if (saved.contents === goldenText) {
    passed++;
  } else {
    failed++;
    console.error(`  ✗ FAIL: ${file}: 加载→保存输出与 golden 不逐字节一致`);
    const a = goldenText.split('\n'), b = saved.contents.split('\n');
    for (let i = 0, shown = 0; i < Math.max(a.length, b.length) && shown < 8; i++) {
      if (a[i] !== b[i]) { console.error(`    行 ${i + 1}: ${JSON.stringify(a[i])} → ${JSON.stringify(b[i])}`); shown++; }
    }
  }
  const parsed = JSON.parse(goldenText);
  assert(parsed.app === 'PreVision' && parsed.version === 5 && parsed.modified === FROZEN_ISO,
    `${file}: golden 本体是 v5 且 modified 为冻结时钟值(录制环境自检)`);
  parsed.scenes.forEach((scene, sceneIndex) => {
    scene.actors.forEach((actor, actorIndex) => {
      const uncovered = Object.keys(actor).filter(key => !actorCovered.has(key));
      assert(uncovered.length === 0,
        `${file}: scene ${sceneIndex} actor ${actorIndex} 键均由字段表或手写白名单覆盖(${uncovered.join(',')})`);
    });
    scene.shots.forEach((shot, shotIndex) => {
      const uncovered = Object.keys(shot).filter(key => !shotCovered.has(key));
      assert(uncovered.length === 0,
        `${file}: scene ${sceneIndex} shot ${shotIndex} 键均由字段表或手写白名单覆盖(${uncovered.join(',')})`);
    });
  });
}

const packSource=JSON.parse(fs.readFileSync(path.join(projectsDir,goldenFiles[0]),'utf8'));
const packScene=packSource.scenes[0];
packScene.actors.push(
  {kind:'shipwreck',label:'C1-沉船',pose:'stand',pos:[-8,-6],rotY:.2,height:0,scale:1,pathMode:'curve',timeLink:'independent',timeOffset:0,path:[],pathTimes:[],pathEase:[]},
  {kind:'seahorse',label:'C1-海马',pose:'stand',pos:[1,1],rotY:0,height:0,scale:1.08,pathMode:'curve',timeLink:'independent',timeOffset:0,
    path:[[1,1],[2,2],[3,2],[4,1],[5,0]],pathTimes:[0,1,2,3,4],pathEase:[{type:'linear'},{type:'linear'},{type:'linear'},{type:'linear'}]},
  {kind:'char',characterStyle:'wizard',label:'C1-旧巫师骑手',pose:'ride',mount:'C1-海马',joints:{bodyY:-.84,neckY:18,wristRX:32,hipLX:-50,hipLZ:-49,hipRX:-50,hipRZ:49,kneeL:82,kneeR:82},
    dimensions:{width:.7,height:1.9,depth:.42},pos:[1,1],rotY:0,height:.2,scale:1.08,pathMode:'curve',timeLink:'independent',timeOffset:.15,
    path:[[1,1],[2,1.5]],pathTimes:[0,4],pathEase:[{type:'easeInOut'}]}
);
const packFirst=bootApp(),packOpened=packFirst.T.openProjectData(packSource);
assert(packOpened===true&&packFirst.sandbox.__alerts.length===0,'model-pack: 首次打开 v5 扩展项目成功且无告警');
if(packOpened){
  const savedOnce=await captureSave(packFirst.T);
  const parsedOnce=JSON.parse(savedOnce.contents),actorsOnce=parsedOnce.scenes[0].actors;
  const packSecond=bootApp(),openedAgain=packSecond.T.openProjectData(parsedOnce);
  assert(openedAgain===true&&packSecond.sandbox.__alerts.length===0,'model-pack: 第二次打开首次保存结果成功且无告警');
  if(openedAgain){
    const savedTwice=await captureSave(packSecond.T);
    assert(savedTwice.contents===savedOnce.contents,
      'model-pack: legacy wizard 首次迁移后，沉船、海马和人物代理第二次 open→save 字节完全稳定');
  }
  assert(actorsOnce.find(actor=>actor.label==='C1-沉船')?.kind==='shipwreck'&&
    actorsOnce.find(actor=>actor.label==='C1-海马')?.kind==='seahorse'&&
    actorsOnce.find(actor=>actor.label==='C1-旧巫师骑手')?.semanticType==='adult_male'&&
    !Object.hasOwn(actorsOnce.find(actor=>actor.label==='C1-旧巫师骑手')||{},'characterStyle')&&
    actorsOnce.find(actor=>actor.label==='C1-旧巫师骑手')?.mount==='C1-海马'&&
    actorsOnce.find(actor=>actor.label==='C1-旧巫师骑手')?.pose==='ride'&&
    actorsOnce.find(actor=>actor.label==='C1-旧巫师骑手')?.joints?.wristRX===32&&
    actorsOnce.find(actor=>actor.label==='C1-旧巫师骑手')?.scale===1.08&&
    actorsOnce.find(actor=>actor.label==='C1-旧巫师骑手')?.dimensions?.height===1.9&&
    actorsOnce.find(actor=>actor.label==='C1-旧巫师骑手')?.path?.length===2,
    'model-pack: legacy wizard 保存为 adult_male，mount、pose/joints、scale、合法尺寸和路径零丢失');
  assert(actorsOnce.filter(actor=>actor.kind==='char'&&actor.label!=='C1-旧巫师骑手').every(actor=>!Object.hasOwn(actor,'semanticType')&&!Object.hasOwn(actor,'characterStyle')),
    'model-pack: 旧普通 char 不会因蓝色运行时视觉默认被静默补写 semanticType/characterStyle');
}

const reframeSource=JSON.parse(fs.readFileSync(path.join(projectsDir,goldenFiles[0]),'utf8'));
const reframeShot=reframeSource.scenes[0].shots[0];
const reframeCameraBytes=JSON.stringify({
  cam:reframeShot.cam,camAim:reframeShot.camAim,camTimes:reframeShot.camTimes,
  camAimTimes:reframeShot.camAimTimes,camFovTimes:reframeShot.camFovTimes,fov:reframeShot.fov
});
reframeShot.reframeByAspect={'9:16':{offsetX:.2,offsetY:-.35,zoom:1.8}};
const reframeFirst=bootApp(),reframeOpened=reframeFirst.T.openProjectData(reframeSource);
assert(reframeOpened===true&&reframeFirst.sandbox.__alerts.length===0,'reframe: v5 项目加载 canonical 9:16 字段');
if(reframeOpened){
  const savedOnce=await captureSave(reframeFirst.T),parsedOnce=JSON.parse(savedOnce.contents),savedShot=parsedOnce.scenes[0].shots[0];
  assert(parsedOnce.version===5&&JSON.stringify(savedShot.reframeByAspect)===JSON.stringify(reframeShot.reframeByAspect),
    'reframe: 保存仍为 v5 且 canonical 字段逐值往返');
  assert(JSON.stringify({
    cam:savedShot.cam,camAim:savedShot.camAim,camTimes:savedShot.camTimes,
    camAimTimes:savedShot.camAimTimes,camFovTimes:savedShot.camFovTimes,fov:savedShot.fov
  })===reframeCameraBytes,'reframe: camera 数组、路径、FOV、times 字节不变');
  const reframeSecond=bootApp(),openedAgain=reframeSecond.T.openProjectData(parsedOnce);
  assert(openedAgain===true,'reframe: 首次保存结果可再次打开');
  if(openedAgain){
    const savedTwice=await captureSave(reframeSecond.T);
    assert(savedTwice.contents===savedOnce.contents,'reframe: 连续两次 open→save 字节稳定');
  }
}

console.log(`\nC1 round-trip: ${passed} 通过, ${failed} 失败`);
process.exit(failed ? 1 : 0);
