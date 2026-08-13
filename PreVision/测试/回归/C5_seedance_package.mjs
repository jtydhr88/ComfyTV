/*
 * C5 · Seedance package structure
 * Contract: the real Seedance button emits the five-file stored ZIP package in
 * exact order, with frozen prompt/JSON identity and an ASCII-safe package name.
 * Run: node 测试/回归/C5_seedance_package.mjs
 */
import { bootApp } from './harness/vm-app.mjs';

let passed = 0, failed = 0;
function assert(cond, msg) {
  if (cond) passed++;
  else { failed++; console.error('  ✗ FAIL: ' + msg); }
}

const crcTable = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();
const crc32 = d => { let c = ~0; for (let i = 0; i < d.length; i++) c = crcTable[(c ^ d[i]) & 255] ^ (c >>> 8); return ~c >>> 0; };
const seedanceResolution = {
  '16:9': [1920, 1080],
  '9:16': [1080, 1920],
  '1:1': [1440, 1440],
  '4:3': [1664, 1248],
};
const snapshotJson = value => JSON.parse(JSON.stringify(value));
const mp4Bytes = (...values) => new Uint8Array(values);
const mp4Text = value => mp4Bytes(...[...value].map(char => char.charCodeAt(0)));
const mp4U16 = value => mp4Bytes((value >>> 8) & 255, value & 255);
const mp4U32 = value => mp4Bytes((value >>> 24) & 255, (value >>> 16) & 255, (value >>> 8) & 255, value & 255);
const mp4Join = (...parts) => { const out = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0)); let offset = 0; for (const part of parts) { out.set(part, offset); offset += part.length; } return out; };
const mp4Box = (type, ...parts) => { const payload = mp4Join(...parts); return mp4Join(mp4U32(payload.length + 8), mp4Text(type), payload); };
function makeH264Mp4({ frameCount, fps }) {
  const timescale = 24000, sampleDelta = timescale / fps;
  const mdhd = mp4Box('mdhd', mp4Bytes(0, 0, 0, 0), mp4U32(0), mp4U32(0), mp4U32(timescale), mp4U32(frameCount * sampleDelta), mp4Bytes(0, 0, 0, 0));
  const hdlr = mp4Box('hdlr', mp4Bytes(0, 0, 0, 0), mp4U32(0), mp4Text('vide'), mp4Bytes(0, 0, 0, 0));
  const avcC = mp4Box('avcC', mp4Join(mp4Bytes(1, 0x64, 0, 0x1f, 0xff, 0xe1), mp4U16(2), mp4Bytes(0x67, 0), mp4Bytes(1), mp4U16(2), mp4Bytes(0x68, 0)));
  const avc1 = mp4Join(mp4U32(86 + avcC.length), mp4Text('avc1'), mp4Join(new Uint8Array(6), mp4U16(1), new Uint8Array(70)), avcC);
  const stsd = mp4Box('stsd', mp4Bytes(0, 0, 0, 0), mp4U32(1), avc1), stts = mp4Box('stts', mp4Bytes(0, 0, 0, 0), mp4U32(1), mp4U32(frameCount), mp4U32(sampleDelta));
  const stsz = mp4Box('stsz', mp4Bytes(0, 0, 0, 0), mp4U32(4), mp4U32(frameCount)), stsc = mp4Box('stsc', mp4Bytes(0, 0, 0, 0), mp4U32(1), mp4U32(1), mp4U32(frameCount), mp4U32(1));
  const moovForOffset = offset => mp4Box('moov', mp4Box('trak', mp4Box('tkhd', mp4Bytes(0, 0, 0, 0), mp4U32(0), mp4U32(0), mp4U32(1), mp4U32(0)), mp4Box('mdia', mdhd, hdlr, mp4Box('minf', mp4Box('stbl', stsd, stts, stsz, stsc, mp4Box('stco', mp4Bytes(0, 0, 0, 0), mp4U32(1), mp4U32(offset)))))));
  const ftyp = mp4Box('ftyp', mp4Text('isom'), mp4U32(0), mp4Text('isom')), placeholder = moovForOffset(0), mdat = mp4Box('mdat', new Uint8Array(frameCount * 4));
  return mp4Join(ftyp, moovForOffset(ftyp.length + placeholder.length + 8), mdat);
}

function parseStoredZip(bytes) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const decoder = new TextDecoder();
  const local = [];
  let offset = 0;
  while (offset + 30 <= bytes.length && view.getUint32(offset, true) === 0x04034b50) {
    const flags = view.getUint16(offset + 6, true);
    const compression = view.getUint16(offset + 8, true);
    const crc = view.getUint32(offset + 14, true);
    const size = view.getUint32(offset + 18, true);
    const nameLength = view.getUint16(offset + 26, true);
    const extraLength = view.getUint16(offset + 28, true);
    const nameStart = offset + 30, dataStart = nameStart + nameLength + extraLength;
    const name = decoder.decode(bytes.slice(nameStart, nameStart + nameLength));
    const data = bytes.slice(dataStart, dataStart + size);
    local.push({ name, flags, compression, crc, size, data, localOffset: offset });
    offset = dataStart + size;
  }
  assert(view.getUint32(bytes.length - 22, true) === 0x06054b50, 'EOCD present at zip tail');
  const centralOffset = view.getUint32(bytes.length - 22 + 16, true);
  const central = [];
  let cursor = centralOffset;
  while (cursor + 46 <= bytes.length && view.getUint32(cursor, true) === 0x02014b50) {
    const flags = view.getUint16(cursor + 8, true);
    const compression = view.getUint16(cursor + 10, true);
    const crc = view.getUint32(cursor + 16, true);
    const size = view.getUint32(cursor + 20, true);
    const nameLength = view.getUint16(cursor + 28, true);
    const localOffset = view.getUint32(cursor + 42, true);
    const name = decoder.decode(bytes.slice(cursor + 46, cursor + 46 + nameLength));
    central.push({ name, flags, compression, crc, size, localOffset });
    cursor += 46 + nameLength;
  }
  return { local, central };
}

console.log('· real Seedance ZIP package');
const { sandbox, T, el, flushTimeouts } = bootApp();
let seedanceZip = null, downloadName = '';
const originalCreateObjectURL = sandbox.URL.createObjectURL;
const originalAppendChild = sandbox.document.body.appendChild;
sandbox.URL.createObjectURL = blob => {
  if (blob?.type === 'application/zip') seedanceZip = blob;
  return originalCreateObjectURL(blob);
};
sandbox.document.body.appendChild = function(child) {
  if (child?.download) downloadName = child.download;
  return originalAppendChild.call(this, child);
};

let lastRecorder = null;
sandbox.MediaRecorder = class {
  static isTypeSupported() { return true; }
  constructor(_stream, options = {}) { this.mimeType = options.mimeType || 'video/webm'; this.state = 'inactive'; lastRecorder = this; }
  start() { this.state = 'recording'; }
  stop() { this.state = 'inactive'; const target = T.captureTransaction?.target, contract = { frameCount: Math.max(2, Math.round(target.duration * target.fps) + 1), fps: target.fps }; this.ondataavailable?.({ data: new Blob([makeH264Mp4(contract)], { type: this.mimeType }) }); this.onstop?.(); }
  pause() { this.state = 'paused'; }
  resume() { this.state = 'recording'; }
};

const expectedPrompt = T.genPrompt();
const expectedData = snapshotJson(T.stageToData());
const expectedAspect = el('aspect').value;
const expectedMeta = {
  project: el('projname').value,
  scene: T.curScene().name,
  aspect: expectedAspect,
  resolution: seedanceResolution[expectedAspect].join('x'),
  fps: 24,
};
const expectedSceneJson = JSON.stringify({ ...expectedMeta, data: expectedData }, null, 2);
const expectedSceneIndex = T.sceneIdx;
const expectedShotIndex = Math.max(0, T.shotIdx);

const run = el('seedancePack').onclick();
const target = T.captureTransaction?.target;
T.forceCaptureNavigation(0, Math.max(0, T.shots.length - 1));
await new Promise(resolve => setImmediate(resolve));
for (let i = 0; i < 2400 && T.captureTransaction && T.captureState.recStep; i++) T.captureState.recStep();
flushTimeouts();
const result = await run;
sandbox.URL.createObjectURL = originalCreateObjectURL;
sandbox.document.body.appendChild = originalAppendChild;

assert(result === true && seedanceZip && target?.kind === 'seedance', 'Seedance export completed and yielded a zip');
assert(lastRecorder && lastRecorder.mimeType.includes('mp4'), 'reference video uses observed MediaRecorder output');
assert(/^[\x00-\x7F]+$/.test(downloadName) && /^Seedance_.*_\d+x\d+\.zip$/.test(downloadName), `package name is ASCII-safe (${downloadName})`);

const bytes = seedanceZip ? new Uint8Array(await seedanceZip.arrayBuffer()) : new Uint8Array();
const { local, central } = parseStoredZip(bytes);
const expectedNames = ['01_previz_refvideo.mp4', '02_firstframe.png', '03_lastframe.png', '04_prompt.txt', '05_shotdata.json'];
assert(JSON.stringify(local.map(e => e.name)) === JSON.stringify(expectedNames), 'local entry names and order match Seedance contract');
assert(JSON.stringify(central.map(e => e.name)) === JSON.stringify(expectedNames), 'central directory names and order match Seedance contract');

for (let i = 0; i < expectedNames.length; i++) {
  const entry = local[i], dir = central[i];
  assert(entry.flags === 0x0800 && dir.flags === 0x0800, `${entry.name}: UTF-8 flag set in local and central headers`);
  assert(entry.compression === 0 && dir.compression === 0, `${entry.name}: stored method`);
  assert(entry.data.length > 0 && entry.size === entry.data.length && dir.size === entry.data.length, `${entry.name}: nonempty stored payload`);
  assert(entry.crc === crc32(entry.data) && dir.crc === entry.crc, `${entry.name}: CRC32 matches payload`);
  assert(dir.localOffset === entry.localOffset, `${entry.name}: central offset points to local header`);
}

const decoder = new TextDecoder();
const byName = new Map(local.map(entry => [entry.name, entry]));
const promptEntry = decoder.decode(byName.get('04_prompt.txt')?.data || new Uint8Array());
const sceneEntry = decoder.decode(byName.get('05_shotdata.json')?.data || new Uint8Array());
const parsedScene = JSON.parse(sceneEntry || '{}');
assert(target?.sceneIndex === expectedSceneIndex && target?.shotIndex === expectedShotIndex, 'transaction target froze source identity before navigation');
assert(promptEntry === expectedPrompt, 'prompt entry matches independent pre-click prompt');
assert(sceneEntry === expectedSceneJson, 'JSON entry matches independent pre-click scene JSON');
assert(parsedScene.project === expectedMeta.project, 'shotdata project matches pre-click metadata');
assert(parsedScene.scene === expectedMeta.scene, 'shotdata scene matches pre-click metadata');
assert(parsedScene.aspect === expectedMeta.aspect, 'shotdata aspect matches pre-click metadata');
assert(parsedScene.resolution === expectedMeta.resolution, 'shotdata resolution matches pre-click metadata');
assert(parsedScene.fps === expectedMeta.fps, 'shotdata fps matches pre-click metadata');
assert(JSON.stringify(parsedScene.data) === JSON.stringify(expectedData), 'shotdata data matches independent pre-click stage snapshot');
assert(!T.captureTransaction, 'Seedance transaction is released after success');

console.log(`\nC5 Seedance package: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
