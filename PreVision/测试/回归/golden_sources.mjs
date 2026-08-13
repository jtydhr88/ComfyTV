/*
 * golden 项目的"施工图": 手工构造的 *输入* 项目(允许键序/精度随意)。
 * 真正的 golden(qa/golden/projects/*.previz.json)由 record_golden.mjs 驱动
 * 当前版本应用 openProjectData → saveProjectFile canonical 化后产出 —— 手工 JSON
 * 永远不直接当基准(键序/精度会假红, 见 回归测试清单.md C1)。
 */

/* 1×1 透明 PNG(合法 data URI; VM 里 Image stub 不解码, 真浏览器也能载入) */
const PNG_1PX = 'data:image/png;base64,iVBORw0KGgoAAAABAAAAAQCAYAAAAf8/9hAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

/* golden 2: 骑乘挂载 + 720°全景背景(GP 地面投影) + 地面贴图 + 沙漠地形 + 语义代理 + 图板 */
export function ridePanoSource() {
  return {
    app: 'PreVision', version: 5, name: '骑乘全景', aspect: '16:9',
    created: '2026-01-01T00:00:00.000Z',
    assets: {
      pano: { d: PNG_1PX, w: 4096, h: 2048 },
      groundimg: { d: PNG_1PX, w: 1024, h: 1024 },
      boardimg: { d: PNG_1PX, w: 1024, h: 512 },
    },
    settings: { collision: true, labels: true },
    scenes: [{
      name: '沙漠驰骋', desc: '骑手穿越沙漠全景', script: '黄昏, 骑手策马穿过沙丘。',
      bg: { asset: 'pano', yaw: 0.35, radius: 60, y: 1.6, gp: true },
      ground: { style: 'image', asset: 'groundimg' },
      sun: { enabled: true, pos: [8, 14, 6], intensity: 0.9, temp: 5600, ambient: 0.28, softness: 2, quality: 'standard' },
      actors: [
        { kind: 'horse', label: '白马', pos: [1.5, 2.5], rotY: 0.2,
          path: [[1.5, 2.5], [3.0, 0.5], [4.5, -1.5], [6.0, -3.0]], pathMode: 'curve',
          timeLink: 'independent', timeOffset: 0 },
        { kind: 'char', label: '骑手', pose: 'ride', mount: '白马', pos: [1.5, 2.5], rotY: 0, path: [],
          joints: { neckX: 8, spineX: -4 } },
        { kind: 'dog', label: '猎犬', pos: [-2, 3], rotY: 0.5, pathMode: 'line',
          path: [[-2, 3], [0, 1], [2, -1]],
          pathTimes: [0, 4, 9],
          pathEase: ['easeIn', { type: 'custom', x1: 0.4, y1: 0, x2: 0.6, y2: 1 }] },
        { kind: 'prop', label: '行李箱', pos: [-4, -2], rotY: 1.1, height: 0, scale: 1.2,
          semanticType: 'crate', dimensions: { width: 0.8, height: 1.1, depth: 0.5 } },
        { kind: 'desert', label: '沙丘地形', pos: [18, 18], rotY: 0, scale: 1, terrainVersion: 1 },
        { kind: 'board', label: '远景图板', asset: 'boardimg', pos: [0, -20], rotY: 0, height: 2, scale: 2 },
      ],
      shots: [
        { name: '跟拍', desc: '侧面跟拍骑手', dur: 6, fov: 42, lock: '骑手',
          camMode: 'curve', timingMode: 'pointSync', syncActor: '白马',
          cam: [[-4, 2.2, 6], [-2, 2.0, 4], [0, 1.9, 2], [2, 1.8, 0]] },
        { name: '大全景', desc: '广角环境交代', dur: 5, fov: 24, lock: '全局',
          camMode: 'line', timingMode: 'arcLength', yaw: 15, pitch: -5,
          cam: [[-10, 6, 12], [-6, 5, 10]] },
        { name: '低机位冲刺', desc: '低机位仰拍马蹄', dur: 4, fov: 32, lock: '白马',
          camMode: 'curve', timingMode: 'arcLength',
          cam: [[3, 0.6, -4], [5, 0.7, -5]] },
      ],
    }],
  };
}

/* golden 3: 手动朝向逐点 camKeys + 自定义贝塞尔缓动 + custom 计时 + pointSync + 多场景 */
export function camworkSource() {
  return {
    app: 'PreVision', version: 5, name: '运镜实验', aspect: '9:16',
    created: '2026-01-01T00:00:00.000Z',
    assets: {},
    settings: { collision: false, labels: false },
    scenes: [
      {
        name: '走位与运镜', desc: '演员走位 + 三种计时模式', script: '演员从画左走到画右。',
        ground: { style: 'color', color: '#3a4a5a' },
        sun: { enabled: false, pos: [8, 14, 6], intensity: 0.9, temp: 5600, ambient: 0.28, softness: 2, quality: 'performance' },
        actors: [
          { kind: 'char', label: '演员', pose: 'stand', pos: [-5, 0], rotY: 1.5708,
            path: [[-5, 0], [-2, 1], [1, -0.5], [4, 0.5]], pathMode: 'curve',
            timeLink: 'cameraNodes', timeLinkShot: 1 },
          { kind: 'tree', label: '前景树', pos: [6, -4], rotY: 0, scale: 1.5 },
        ],
        shots: [
          { name: '手动朝向摇移', desc: '逐点朝向关键帧 + 自定义缓动', dur: 5, fov: 40, lock: '手动朝向',
            camMode: 'curve', timingMode: 'custom',
            cam: [[-8, 3, 8], [-4, 2.5, 6], [0, 2, 4]],
            camAim: [[-30, -10, 40], [0, -5, 45], [30, 0, 55]],
            camTimes: [0, 1.5, 5],
            camEase: [{ type: 'custom', x1: 0.25, y1: 0.1, x2: 0.25, y2: 1 }, 'easeInOut'],
            camAimTimes: [0, 2, 5],
            camAimEase: ['linear', { type: 'custom', x1: 0.42, y1: 0, x2: 0.58, y2: 1 }],
            camFovTimes: [0, 2.5, 5],
            camFovEase: ['easeOut', 'easeIn'] },
          { name: '节点同步跟拍', desc: '与演员按同序号节点同步', dur: 6, fov: 50, lock: '演员',
            camMode: 'curve', timingMode: 'pointSync', syncActor: '演员',
            cam: [[-7, 1.8, 4], [-4, 1.8, 5], [-1, 1.8, 4], [2, 1.8, 5]] },
        ],
      },
      {
        name: '静物空景', desc: '第二场景: 覆盖多场景序列化', script: '',
        ground: { style: 'white' },
        actors: [
          { kind: 'rock', label: '岩石', pos: [0, 0], rotY: 0.7, scale: 2 },
        ],
        shots: [
          { name: '固定机位', desc: '空景固定机位', dur: 3, fov: 35, lock: '全局',
            cam: [[0, 1.6, 6]] },
        ],
      },
    ],
  };
}

/* C2: v3 时代老格式样本(从 normalizeProjectData 源码反推的字段形态):
 *   - 顶层缺 assets/settings/aspect/modified
 *   - actor 用 y 表示高度(现名 height), 缺 pathMode/timeLink/pathTimes/pathEase/scale
 *   - pathEase 用字符串(老式), 镜头缺 camAim/camTimes/camEase/timingMode/syncActor
 *   - 场景缺 ground/sun/bg
 */
export function v3LegacySource() {
  return {
    app: 'PreVision', version: 3, name: '老项目v3',
    scenes: [{
      name: '旧场景',
      actors: [
        { kind: 'char', label: '主角', pos: [0, 0], rotY: 0, y: 0.5,
          path: [[0, 0], [2, 1], [4, 0]], pathEase: ['linear', 'easeIn'] },
        { kind: 'prop', label: '箱子', pos: [3, -2] },
      ],
      shots: [
        { name: '旧镜头A', dur: 5, fov: 40, lock: '主角', cam: [[-6, 2, 6], [-3, 2, 4]] },
        { name: '旧镜头B', dur: 4, cam: [[0, 3, 8]] },
      ],
    }],
  };
}

/* C2: v4 时代老格式样本:
 *   - 有 camAim 但缺 camAimTimes/camFovTimes(v5 新增的逐点计时)
 *   - settings 只有 collision(缺 labels), bg 缺 gp/radius/y
 *   - actor 有 pathTimes 但越界(应被 repair 到场景时长内)
 */
export function v4LegacySource() {
  return {
    app: 'PreVision', version: 4, name: '老项目v4', aspect: '4:3',
    created: '2025-06-15T08:00:00.000Z',
    assets: { sky: { d: PNG_1PX, w: 2048, h: 1024 } },
    settings: { collision: false },
    scenes: [{
      name: '旧场景v4', desc: '带全景与相机朝向',
      bg: { asset: 'sky', yaw: 1.2 },
      actors: [
        { kind: 'car', label: '汽车', pos: [-8, 0], rotY: 1.57,
          path: [[-8, 0], [0, 0], [8, 0]], pathTimes: [0, 3, 99] },
      ],
      shots: [
        { name: '车头跟拍', dur: 6, fov: 45, lock: '汽车',
          cam: [[-10, 2, 5], [0, 2, 5], [10, 2, 5]],
          camAim: [[-20, 0, 45], [0, 0, 45], [20, 0, 45]] },
      ],
    }],
  };
}

/* C2/C4: version 6 未来版本样本(必须走 invalidProject 拒绝分支) */
export function futureSource() {
  return {
    app: 'PreVision', version: 6, name: '来自未来',
    scenes: [{ name: 'S', actors: [], shots: [{ name: 'C', dur: 5, cam: [[0, 2, 6]] }] }],
  };
}

/* C6: makeZip 固定输入(含中文文件名 → 钉死 UTF-8 flag 与 CRC) */
export function zipFixtureFiles() {
  const enc = new TextEncoder();
  const binary = new Uint8Array(256);
  for (let i = 0; i < 256; i++) binary[i] = i;
  return [
    { name: '01_readme.txt', data: enc.encode('PreVision makeZip byte-level baseline\nrecorded with frozen clock 2026-01-01\n') },
    { name: '中文文件名_样例.bin', data: binary },
  ];
}
