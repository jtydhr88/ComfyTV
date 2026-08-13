/*
 * U4 · normalizeProjectData 恶意/畸形输入表(首批, 架构地图 §G 安全边界)
 * 判定标准(两条腿, 每个 case 必居其一):
 *   a) 归一化成功 → 输出必须通过 schema 自检: 再次 normalizeProjectData 逐字节等价
 *      (幂等 = 输出本身是合法 v5), 且附带的 check() 人工验算断言全部成立;
 *   b) 拒绝 → 只允许抛 code==='PREVISION_INVALID_PROJECT' 的受控错误,
 *      任何其他异常类型(TypeError/RangeError/栈溢出)都算 FAIL —— 即"不抛(意外)异常"。
 * 每个 case 的预期行为写在 note 里供人工验算(录制基准前已逐条对照源码核实)。
 * 运行: node 测试/回归/U4_normalize_malformed.mjs
 */
import { bootApp } from './harness/vm-app.mjs';
import {
  applyCameraPositionPointDeletion,
  applyShotDurationChange,
  planCameraPositionPointDeletion,
  planShotDurationChange,
} from '../../src/core/project-data.js';

let passed = 0, failed = 0;
function assert(cond, msg) {
  if (cond) { passed++; }
  else { failed++; console.error('  ✗ FAIL: ' + msg); }
}

const app = bootApp();
const T = app.T;

/* 最小合法项目模板(每个 case 在其上做变异) */
function minimalProject(mutate) {
  const base = {
    app: 'PreVision', version: 5, name: '畸形输入试验', aspect: '16:9',
    assets: {}, settings: { collision: true, labels: true },
    scenes: [{
      name: '场景', desc: '', script: '',
      actors: [{ kind: 'char', label: '甲', pos: [0, 0], rotY: 0, path: [] }],
      shots: [{ name: '镜头', dur: 5, fov: 40, lock: '全局', cam: [[0, 2, 6], [1, 2, 5]] }],
    }],
  };
  if (mutate) mutate(base);
  return base;
}

const CASES = [
  {
    name: '01 null 输入',
    note: '预期: isPlainRecord(null)=false → invalidProject("project")。不产生 TypeError。',
    input: () => null,
    expect: 'invalid',
  },
  {
    name: '02 非对象输入(数字)',
    note: '预期: 同上, 走 invalidProject("project") 拒绝分支。',
    input: () => 42,
    expect: 'invalid',
  },
  {
    name: '03 缺 app 字段',
    note: '预期: data.app!=="PreVision" → invalidProject("project")。',
    input: () => ({ version: 5, scenes: [] }),
    expect: 'invalid',
  },
  {
    name: '04 scenes 类型错(字符串)',
    note: '预期: Array.isArray 失败 → invalidProject("project.scenes")。',
    input: () => ({ app: 'PreVision', version: 5, scenes: 'not-an-array' }),
    expect: 'invalid',
  },
  {
    name: '05 坐标 NaN/Infinity',
    note: '预期: projectFinite 用 Number.isFinite 把关 → invalidProject("…pos[0]")。' +
      'NaN 不可能来自 JSON, 只可能是内存构造攻击面, 必须拒绝而非静默清洗。',
    input: () => minimalProject(p => { p.scenes[0].actors[0].pos = [NaN, Infinity]; }),
    expect: 'invalid',
  },
  {
    name: '06 越界值 pos=±999 / height=99 / scale=9',
    note: '预期(现状行为固化): normalizeProjectData 只做类型/结构校验, 不做数值钳制 —— ' +
      '999/99/9 与历史 camera 15/29.9/30/47m 原样保留。STAGE_LIMIT=±29.5 的钳制发生在画布交互层(clampStagePoint), ' +
      '不在文件加载路径。若未来把钳制挪进 normalize, 此 case 应红并触发有意的基准变更。',
    input: () => minimalProject(p => {
      p.scenes[0].actors[0].pos = [999, -999];
      p.scenes[0].actors[0].height = 99;
      p.scenes[0].actors[0].scale = 9;
      p.scenes[0].shots[0].cam = [[0, 15, 6], [1, 29.9, 5], [2, 30, 4], [3, 47, 3]];
    }),
    check(out) {
      const a = out.scenes[0].actors[0];
      const cameraHeights=out.scenes[0].shots[0].cam.map(point=>point[1]);
      assert(a.pos[0] === 999 && a.pos[1] === -999 && a.height === 99 && a.scale === 9
        && JSON.stringify(cameraHeights)==='[15,29.9,30,47]',
        '06: actor 越界与历史 camera 高度被原样保留(不在 normalize 层钳制)');
    },
  },
  {
    name: '07 未知顶层键与未知 actor 键',
    note: '预期: 白名单重建 —— junk/evil 等未知键不进入输出(防未知负载穿透存档)。',
    input: () => {
      const p = minimalProject();
      p.junk = { droppable: true };
      p.scenes[0].evil = 'x';
      p.scenes[0].actors[0].unknownField = 'y';
      return p;
    },
    check(out) {
      assert(!('junk' in out) && !('evil' in out.scenes[0]) && !('unknownField' in out.scenes[0].actors[0]),
        '07: 未知键被白名单剔除');
    },
  },
  {
    name: '08 __proto__/constructor 危险键(原型污染)',
    note: '预期: assets 表用 Object.create(null) 重建 → "__proto__" 只能成为自有键, ' +
      '不改写原型链; 全局 Object.prototype 不得被污染。joints 走 PROJECT_JOINT_KEYS ' +
      '白名单 → "__proto__"/"constructor" 直接丢弃。',
    input: () => {
      /* 必须经 JSON.parse 构造: 字面量 {__proto__:…} 是设置原型而不是自有键 */
      const p = minimalProject();
      p.assets = JSON.parse('{"__proto__":{"d":"data:image/png;base64,AAAA","w":8,"h":8},"constructor":{"d":"data:image/png;base64,AAAA","w":8,"h":8}}');
      p.scenes[0].actors[0].joints = JSON.parse('{"__proto__":{"polluted":1},"neckX":5}');
      return p;
    },
    check(out) {
      assert(({}).polluted === undefined && Object.prototype.polluted === undefined,
        '08: Object.prototype 未被污染');
      assert(Object.getPrototypeOf(out.assets) === null
        && Object.keys(out.assets).sort().join(',') === '__proto__,constructor',
        '08: 危险键在 null 原型表上退化为普通自有键');
      assert(out.scenes[0].actors[0].joints.neckX === 5
        && !Object.keys(out.scenes[0].actors[0].joints).includes('__proto__'),
        '08: joints 白名单丢弃危险键、保留合法关节');
    },
  },
  {
    name: '09 未知 semanticType 与未知 kind',
    note: '预期: semanticType 任意字符串安全保留(前向兼容, 渲染层兜底); ' +
      'kind 未知同样保留字符串(buildActor 运行时兜底为通用代理), normalize 不拒绝。',
    input: () => minimalProject(p => {
      p.scenes[0].actors[0].semanticType = 'quantum-flux-capacitor';
      p.scenes[0].actors.push({ kind: 'unheard-of-kind', label: '乙', pos: [2, 2], path: [] });
    }),
    check(out) {
      assert(out.scenes[0].actors[0].semanticType === 'quantum-flux-capacitor',
        '09: 未知 semanticType 安全保留');
      assert(out.scenes[0].actors[1].kind === 'unheard-of-kind', '09: 未知 kind 保留交由运行时兜底');
    },
  },
  {
    name: '10 悬挂 asset 引用(背景/地面/对象)',
    note: '预期: 三路降级 —— bg.asset 不存在→bg:null; ground image asset 不存在→回退 checker; ' +
      'actor.asset 不存在→删除该引用(对象保留)。quota-lite 自动保存降级依赖这条路径。',
    input: () => minimalProject(p => {
      p.scenes[0].bg = { asset: 'ghost-pano', yaw: 0 };
      p.scenes[0].ground = { style: 'image', asset: 'ghost-ground' };
      p.scenes[0].actors[0].asset = 'ghost-board';
    }),
    check(out) {
      const s = out.scenes[0];
      assert(s.bg === null && s.ground.style === 'checker' && s.actors[0].asset === undefined,
        '10: 悬挂引用按 背景清空/地面回退棋盘/对象去引用 降级');
    },
  },
  {
    name: '11 timeLinkShot 越界',
    note: '预期: timeLinkShot=7 超出镜头数 → 修复为 timeLink:"independent"+timeLinkShot:0 ' +
      '(normalizeProjectScene 的修复先于 validateProjectSceneReferences, 不拒绝)。',
    input: () => minimalProject(p => {
      p.scenes[0].actors[0].timeLink = 'cameraNodes';
      p.scenes[0].actors[0].timeLinkShot = 7;
    }),
    check(out) {
      const a = out.scenes[0].actors[0];
      assert(a.timeLink === 'independent' && a.timeLinkShot === 0, '11: 越界 timeLinkShot 修复为独立计时');
    },
  },
  {
    name: '12 pathTimes 越界+乱序',
    note: '预期: repairProjectPathTimes 兜底 —— 钳到 [0,场景时长] 并强制严格递增(步长≥0.01), ' +
      '尾值超时长时整体重分布; 不拒绝。',
    input: () => minimalProject(p => {
      p.scenes[0].actors[0].path = [[0, 0], [1, 1], [2, 2]];
      p.scenes[0].actors[0].pathTimes = [4, 2, 99];
    }),
    check(out) {
      const t = out.scenes[0].actors[0].pathTimes;
      const dur = out.scenes[0].shots.reduce((s, x) => s + x.dur, 0);
      assert(t.length === 3 && t.every((v, i) => v >= 0 && v <= dur && (i === 0 || v > t[i - 1])),
        `12: pathTimes 修复到时长内且严格递增(实际 ${JSON.stringify(t)})`);
    },
  },
  {
    name: '13 深度嵌套损坏(cam 点少一维)',
    note: '预期: projectTuple(point,3) 长度校验 → invalidProject("…cam[1]"), 精确指路径。',
    input: () => minimalProject(p => { p.scenes[0].shots[0].cam = [[0, 2, 6], [1, 2]]; }),
    expect: 'invalid',
  },
  {
    name: '14 actor label 重复',
    note: '预期: validateProjectSceneReferences 用 Set 查重 → invalidProject("…label")。' +
      'label 是 mount/lock/syncActor 的外键, 重复会破坏所有引用语义。',
    input: () => minimalProject(p => {
      p.scenes[0].actors.push({ kind: 'prop', label: '甲', pos: [1, 1], path: [] });
    }),
    expect: 'invalid',
  },
  {
    name: '15 mount 自引用成环',
    note: '预期: 环检测(seen 集合)→ invalidProject("…mount"), 防运行时挂载死循环。',
    input: () => minimalProject(p => {
      p.scenes[0].actors[0].mount = '乙';
      p.scenes[0].actors.push({ kind: 'horse', label: '乙', mount: '甲', pos: [1, 1], path: [] });
    }),
    expect: 'invalid',
  },
  {
    name: '16 未知缓动类型',
    note: '预期: PROJECT_EASE_TYPES 枚举白名单 → invalidProject("…camEase[0]")。',
    input: () => minimalProject(p => { p.scenes[0].shots[0].camEase = ['bounce']; }),
    expect: 'invalid',
  },
  {
    name: '17 多缺陷 actor 优先级: 缺 label 先于坏 kind',
    note: '预期: normalizeProjectActor 保持 baseline 验证顺序 label→kind。' +
      '同时缺 label 且 kind 非字符串时, first error 必须仍是 label。',
    input: () => minimalProject(p => {
      delete p.scenes[0].actors[0].label;
      p.scenes[0].actors[0].kind = 42;
    }),
    expect: 'invalid',
    expectMessage: 'project.scenes[0].actors[0].label',
  },
  {
    name: '18 多缺陷 shot 优先级: 坏 cam 先于 NaN fov',
    note: '预期: normalizeProjectShot 保持 baseline 验证顺序 name/dur→cam→modes→tail scalars。' +
      '同时 cam 损坏且 fov=NaN 时, first error 必须仍来自 cam。',
    input: () => minimalProject(p => {
      p.scenes[0].shots[0].cam = [[0, 2, 6], [1, 2]];
      p.scenes[0].shots[0].fov = NaN;
    }),
    expect: 'invalid',
    expectMessage: 'project.scenes[0].shots[0].cam[1]',
  },
  {
    name: '19 legacy wizard 迁移且旧人物缺字段回退',
    note: '预期: kind=char 且 characterStyle=wizard 安全消费为 adult_male，并删除 characterStyle；' +
      '同项目内缺字段的旧 v1-v5 普通人物不被补 semanticType，二次 normalize 幂等。',
    input: () => minimalProject(p => {
      p.scenes[0].actors[0].characterStyle = 'wizard';
      p.scenes[0].actors[0].dimensions = {width:.7,height:1.9,depth:.42};
      p.scenes[0].actors[0].scale = 1.08;
      p.scenes[0].actors.push({kind:'char',label:'旧人物',pos:[1,1],path:[]});
    }),
    check(out) {
      assert(out.scenes[0].actors[0].semanticType==='adult_male'&&
        !Object.hasOwn(out.scenes[0].actors[0],'characterStyle')&&out.scenes[0].actors[0].dimensions.height===1.9&&out.scenes[0].actors[0].scale===1.08&&
        !Object.hasOwn(out.scenes[0].actors[1],'semanticType')&&!Object.hasOwn(out.scenes[0].actors[1],'characterStyle'),
        '19: wizard 迁移为 adult_male 且尺寸/scale 保留，旧普通 char 不补视觉默认字段');
    },
  },
  {
    name: '20 未知 characterStyle',
    note: '预期: characterStyle 是受控可选枚举；未知未来值不得悄悄改变外观语义。',
    input: () => minimalProject(p => { p.scenes[0].actors[0].characterStyle='necromancer'; }),
    expect: 'invalid',
  },
  {
    name: '21 非人物使用 wizard characterStyle',
    note: '预期: wizard 只能修饰既有 kind=char；不能伪装成新 kind 或污染普通道具。',
    input: () => minimalProject(p => {
      p.scenes[0].actors[0].kind='prop';p.scenes[0].actors[0].characterStyle='wizard';
    }),
    expect: 'invalid',
  },
  {
    name: '22 characterStyle 类型错',
    note: '预期: 非字符串 characterStyle 走 projectString 的受控 PREVISION_INVALID_PROJECT。',
    input: () => minimalProject(p => { p.scenes[0].actors[0].characterStyle={wizard:true}; }),
    expect: 'invalid',
  },
  {
    name: '23 camera 高度 Infinity',
    note: '预期: 项目载入边界继续拒绝非有限 camera 坐标，不把 Infinity 清洗或夹到30。',
    input: () => minimalProject(p => { p.scenes[0].shots[0].cam[1][1]=Infinity; }),
    expect: 'invalid',
    expectMessage: 'project.scenes[0].shots[0].cam[1][1]',
  },
];
for(let version=1;version<=5;version++){
  CASES.push({
    name:`旧项目 v${version} >20s 时序保真`,
    note:'预期: 有限 >20s duration、camera times/ease 与 actor/prop pathTimes/ease 原样归一化到 v5，不因 UI range 或 schema 兼容路径漂移。',
    input:()=>minimalProject(project=>{
      project.version=version;
      const shot=project.scenes[0].shots[0];
      shot.dur=25.7;shot.timingMode='custom';
      shot.camTimes=[0,23.4];shot.camAimTimes=[.1,23.5];shot.camFovTimes=[.2,23.6];
      shot.camEase=['easeIn'];shot.camAimEase=['easeOut'];shot.camFovEase=['easeInOut'];
      const actor=project.scenes[0].actors[0];
      actor.path=[[0,0],[1,1]];actor.pathTimes=[1.1,23.4];actor.pathEase=['constant'];
      project.scenes[0].actors.push({kind:'prop',label:'旧道具',pos:[2,2],path:[[2,2],[3,3]],pathTimes:[2.2,22.2],pathEase:['easeOut']});
    }),
    check(out){
      const shot=out.scenes[0].shots[0],actor=out.scenes[0].actors[0],prop=out.scenes[0].actors[1];
      assert(out.version===5&&shot.dur===25.7&&JSON.stringify(shot.camTimes)==='[0,23.4]'&&JSON.stringify(shot.camAimTimes)==='[0.1,23.5]'&&
        JSON.stringify(shot.camFovTimes)==='[0.2,23.6]'&&shot.camEase[0].type==='easeIn'&&shot.camAimEase[0].type==='easeOut'&&shot.camFovEase[0].type==='easeInOut'&&
        JSON.stringify(actor.pathTimes)==='[1.1,23.4]'&&actor.pathEase[0].type==='constant'&&JSON.stringify(prop.pathTimes)==='[2.2,22.2]'&&prop.pathEase[0].type==='easeOut',
        `v${version}: duration/camera/actor/prop times 与 ease 保存重开不漂移`);
    }
  });
  CASES.push({
    name:`旧项目 v${version} 缺 reframeByAspect`,
    note:'预期: 缺字段按 identity，不补持久键，保存格式仍归一化为 v5。',
    input:()=>minimalProject(project=>{project.version=version;}),
    check(out){
      const shot=out.scenes[0].shots[0];
      assert(out.version===5&&!Object.hasOwn(shot,'reframeByAspect'),`v${version}: 缺字段保持 sparse identity 且不升 schema`);
    }
  });
}
CASES.push(
  {
    name:'9:16 canonical reframe 合法且 camera 字节不变',
    note:'预期: 只接受固定三字段，原 camera/FOV/times 不发生联动归一化。',
    input:()=>minimalProject(project=>{
      const shot=project.scenes[0].shots[0];
      shot.camTimes=[0,5];shot.camAimTimes=[0,5];shot.camFovTimes=[0,5];
      shot.reframeByAspect={'9:16':{offsetX:.25,offsetY:-.5,zoom:2}};
    }),
    check(out){
      const shot=out.scenes[0].shots[0];
      assert(JSON.stringify(shot.reframeByAspect)==='{\"9:16\":{\"offsetX\":0.25,\"offsetY\":-0.5,\"zoom\":2}}'&&
        JSON.stringify(shot.cam)==='[[0,2,6],[1,2,5]]'&&shot.fov===40&&JSON.stringify(shot.camTimes)==='[0,5]',
        'canonical reframe 精确保留且 camera/FOV/times 不漂移');
    }
  },
  ...[
    {'16:9':{offsetX:0,offsetY:0,zoom:1}},
    {'9:16':{offsetX:0,offsetY:0,zoom:.5}},
    {'9:16':{offsetX:0,offsetY:0,zoom:1,extra:true}},
    {'9:16':{offsetX:2,offsetY:0,zoom:1}},
  ].map((reframeByAspect,index)=>({
    name:`reframe 畸形拒绝 ${index+1}`,
    note:'预期: 未知 aspect、越界值或额外字段均受控拒绝。',
    input:()=>minimalProject(project=>{project.scenes[0].shots[0].reframeByAspect=reframeByAspect;}),
    expect:'invalid'
  }))
);

for (const testCase of CASES) {
  console.log('· ' + testCase.name);
  let out = null, error = null;
  const input=testCase.input(),inputBefore=JSON.stringify(input);
  try { out = T.normalizeProjectData(input); } catch (e) { error = e; }
  if (testCase.expect === 'invalid') {
    assert(error !== null && error.code === 'PREVISION_INVALID_PROJECT',
      `${testCase.name}: 必须以受控 invalidProject 拒绝(实际 ${error ? error.constructor.name + ':' + error.message : '未拒绝'})`);
    if (testCase.expectMessage) {
      assert(error?.message === testCase.expectMessage,
        `${testCase.name}: first error path 保持 ${testCase.expectMessage}(实际 ${error?.message || '未拒绝'})`);
    }
  } else {
    assert(error === null, `${testCase.name}: 不得抛异常(实际 ${error?.constructor?.name}: ${error?.message})`);
    if (error) continue;
    assert(JSON.stringify(input)===inputBefore,`${testCase.name}: normalize 不得原地修改输入对象`);
    /* schema 自检: 输出再过一遍 normalize 必须逐字节等价(幂等 ⇒ 输出是合法 v5) */
    let secondPass = null, secondError = null;
    try { secondPass = T.normalizeProjectData(JSON.parse(JSON.stringify(out))); } catch (e) { secondError = e; }
    assert(secondError === null && JSON.stringify(secondPass) === JSON.stringify(out),
      `${testCase.name}: 输出通过 schema 自检(normalize 幂等)`);
    if (testCase.check) testCase.check(out);
  }
}

console.log('· 24 摄影机位置点纯计划/原子应用');
class TestPoint {
  constructor(x,y,z){this.x=x;this.y=y;this.z=z;}
  distanceTo(other){return Math.hypot(this.x-other.x,this.y-other.y,this.z-other.z);}
}
const cameraShot={
  dur:12,timingMode:'custom',syncActor:'',
  camPts:[new TestPoint(0,2,0),new TestPoint(1,2,0),new TestPoint(2,2,0),new TestPoint(3,2,0)],
  camKeys:[
    {yaw:0,pitch:0,fov:40},{yaw:10,pitch:1,fov:41},{yaw:20,pitch:2,fov:42},{yaw:30,pitch:3,fov:43}
  ],
  camTimes:[2,4,8,11],camAimTimes:[2.1,4.1,8.1,11.1],camFovTimes:[2.2,4.2,8.2,11.2],
  camEase:[{type:'easeIn'},{type:'easeOut'},{type:'constant'}],
  camAimEase:[{type:'linear'},{type:'easeInOut'},{type:'easeOut'}],
  camFovEase:[{type:'easeOut'},{type:'easeIn'},{type:'linear'}]
};
const followActor={
  label:'跟随对象',timeLink:'cameraFollow',timeLinkShot:0,timeOffset:1,
  pathPts:[new TestPoint(0,0,0),new TestPoint(1,0,0),new TestPoint(2,0,0)],pathTimes:[0,1,2]
};
const cameraBefore=JSON.stringify(cameraShot),followBefore=JSON.stringify(followActor.pathTimes);
const deletionPlan=planCameraPositionPointDeletion(cameraShot,[1],{linkedActors:[followActor],shotOffset:5,sceneDuration:30});
assert(deletionPlan.ok&&JSON.stringify(cameraShot)===cameraBefore&&JSON.stringify(followActor.pathTimes)===followBefore,
  '24: 计划阶段不修改摄影机或联动对象');
assert(JSON.stringify(deletionPlan.camera.camTimes)==='[2,8,11]'&&
  JSON.stringify(deletionPlan.camera.camAimTimes)==='[2.1,8.1,11.1]'&&
  JSON.stringify(deletionPlan.camera.camFovTimes)==='[2.2,8.2,11.2]',
  '24: 三套绝对时间按幸存点同步保留，不 ripple');
assert(JSON.stringify(deletionPlan.camera.camEase.map(item=>item.type))==='["easeIn","constant"]'&&
  JSON.stringify(deletionPlan.camera.camAimEase.map(item=>item.type))==='["linear","easeOut"]'&&
  JSON.stringify(deletionPlan.camera.camFovEase.map(item=>item.type))==='["easeOut","linear"]',
  '24: 三套 outgoing ease 均按左幸存者的原索引映射');
cameraShot.camTimes[0]=2.5;
const staleDeletion=applyCameraPositionPointDeletion(deletionPlan);
assert(!staleDeletion.ok&&staleDeletion.reason==='stalePlan'&&cameraShot.camPts.length===4&&followActor.pathTimes.length===3,
  '24: plan 后数组被原位修改时 apply 拒绝且摄影机/联动对象零写入');
cameraShot.camTimes[0]=2;
const appliedDeletion=applyCameraPositionPointDeletion(deletionPlan);
assert(appliedDeletion.ok&&cameraShot.camPts.length===3&&cameraShot.camKeys.length===3&&
  cameraShot.camTimes.length===3&&cameraShot.camAimTimes.length===3&&cameraShot.camFovTimes.length===3&&
  cameraShot.camEase.length===2&&cameraShot.camAimEase.length===2&&cameraShot.camFovEase.length===2,
  '24: 一次 apply 同步替换八组摄影机数组');
assert(JSON.stringify(followActor.pathTimes)==='[8,12.5,17]',
  '24: cameraFollow 依照删除后的摄影机活动区间重新派生对象绝对时间');

console.log('· 25 摄影机位置点拒绝零写入');
const rejectedShot={
  dur:5,timingMode:'pointSync',syncActor:'同步对象',
  camPts:[new TestPoint(0,2,0),new TestPoint(1,2,0)],
  camKeys:[{yaw:0,pitch:0,fov:40},{yaw:0,pitch:0,fov:40}],
  camTimes:[0,5],camAimTimes:[0,5],camFovTimes:[0,5],
  camEase:[{type:'linear'}],camAimEase:[{type:'linear'}],camFovEase:[{type:'linear'}]
};
const syncActor={label:'同步对象',pathPts:[new TestPoint(0,0,0),new TestPoint(1,0,0)]};
const rejectedBefore=JSON.stringify(rejectedShot);
const pointSyncRejected=planCameraPositionPointDeletion(rejectedShot,[1],{pointSyncExpected:true,pointSyncActor:syncActor});
assert(!pointSyncRejected.ok&&pointSyncRejected.reason==='pointSyncMismatch'&&JSON.stringify(rejectedShot)===rejectedBefore,
  '25: pointSync 删除后节点数不匹配时在 apply 前拒绝且摄影机零写入');
const keepOneRejected=planCameraPositionPointDeletion(rejectedShot,[0,1],{});
assert(!keepOneRejected.ok&&keepOneRejected.reason==='minimumPoint'&&JSON.stringify(rejectedShot)===rejectedBefore,
  '25: 删除到零点被拒绝且至少保留一点');
const nodeActor={label:'节点对象',timeLink:'cameraNodes',pathPts:[new TestPoint(0,0,0),new TestPoint(1,0,0)]};
const nodeRejected=planCameraPositionPointDeletion(Object.assign({},rejectedShot,{timingMode:'custom',syncActor:''}),[1],{linkedActors:[nodeActor]});
assert(!nodeRejected.ok&&nodeRejected.reason==='cameraNodesMismatch'&&JSON.stringify(nodeActor.pathPts).includes('"x":1'),
  '25: cameraNodes 删除后节点数不匹配时不改演员路径');
const stringKeyShot=Object.assign({},rejectedShot,{
  timingMode:'custom',syncActor:'',
  camKeys:[{yaw:'0',pitch:0,fov:40},{yaw:0,pitch:0,fov:40}]
});
const stringKeyRejected=planCameraPositionPointDeletion(stringKeyShot,[1],{});
assert(!stringKeyRejected.ok&&stringKeyRejected.reason==='malformedCamera',
  '25: 数字字符串摄影机 key 不进入删除计划，避免保留会破坏序列化的非数值字段');

console.log('· 26 镜头时长纯计划/原子应用');
const durationShot={
  dur:5,timingMode:'custom',syncActor:'',
  camPts:[new TestPoint(0,2,0),new TestPoint(1,2,0)],
  camKeys:[{yaw:0,pitch:0,fov:40},{yaw:0,pitch:0,fov:40}],
  camTimes:[0,2],camAimTimes:[0,2],camFovTimes:[0,2],
  camEase:[{type:'easeIn'}],camAimEase:[{type:'easeOut'}],camFovEase:[{type:'linear'}]
};
const durationActor={
  label:'时长演员',kind:'char',timeLink:'independent',timeLinkShot:0,timeOffset:0,
  pathPts:[new TestPoint(0,0,0),new TestPoint(1,0,0)],pathTimes:[1,2],pathEase:[{type:'easeInOut'}]
};
const durationBefore=JSON.stringify({shot:durationShot,actor:durationActor});
const durationPlan=planShotDurationChange(durationShot,5.1,{shots:[durationShot],shotIndex:0,actors:[durationActor],
  materializedCamera:{camTimes:[0,2],camAimTimes:[0,2],camFovTimes:[0,2]},previewKeys:[],previewFingerprint:'u4'});
assert(durationPlan.ok&&JSON.stringify({shot:durationShot,actor:durationActor})===durationBefore,
  '26: 计划阶段不修改 duration/camera/actor/ease');
assert(applyShotDurationChange(durationPlan).ok&&durationShot.dur===5.1&&JSON.stringify(durationShot.camTimes)==='[0,2]'&&JSON.stringify(durationActor.pathTimes)==='[1,2]',
  '26: 0.1s 原子应用只改 duration，camera/actor 绝对秒不漂移');
durationShot.dur=5;durationShot.camTimes=[0,4];durationShot.camAimTimes=[0,4];durationShot.camFovTimes=[0,4];
const durationRejectedBefore=JSON.stringify({shot:durationShot,actor:durationActor});
const durationRejected=planShotDurationChange(durationShot,3,{shots:[durationShot],shotIndex:0,actors:[durationActor],
  materializedCamera:{camTimes:[0,4],camAimTimes:[0,4],camFovTimes:[0,4]},previewKeys:[]});
assert(!durationRejected.ok&&durationRejected.reason==='cameraKeyCut'&&JSON.stringify({shot:durationShot,actor:durationActor})===durationRejectedBefore,
  '26: 缩短截断关键帧时在 apply 前拒绝且输入逐字节不变');

console.log(`\nU4 畸形输入表(${CASES.length} case + 两组原子边界): ${passed} 通过, ${failed} 失败`);
process.exit(failed ? 1 : 0);
