/*
 * C6 · makeZip 字节级基准(纯函数)
 * 契约: 固定输入(两个小文件, 含中文文件名)→ makeZip 输出与
 *       qa/golden/zip/makezip-basic.bin 逐字节相同(架构地图 §5.3)。
 *       钉死 CRC32 表、local header、UTF-8 flag(0x0800)、中央目录偏移。
 *       C5(素材包结构)管"包对不对", C6 管"zip 写入器本身没被动过"。
 * golden 验证记录: 录制时经 Python zipfile testzip 全 CRC 校验 + 中文文件名解码确认。
 * 运行: node 测试/回归/C6_makezip_bytes.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { makeZip } from '../../src/export/capture.js';
import { root } from './harness/vm-app.mjs';
import { zipFixtureFiles } from './golden_sources.mjs';

let passed = 0, failed = 0;
function assert(cond, msg) {
  if (cond) { passed++; }
  else { failed++; console.error('  ✗ FAIL: ' + msg); }
}

console.log('· makeZip 固定输入字节比对');
const golden = fs.readFileSync(path.join(root, 'qa', 'golden', 'zip', 'makezip-basic.bin'));
const files = zipFixtureFiles();
const blob = makeZip(files);
const bytes = Buffer.from(await blob.arrayBuffer());
assert(blob.type === 'application/zip', `Blob MIME 为 application/zip(实际 ${blob.type})`);
assert(bytes.length === golden.length, `字节数一致(golden ${golden.length}, 实际 ${bytes.length})`);
assert(bytes.equals(golden), 'makeZip 输出与 golden 逐字节相同');

/* 结构自检(独立于 golden 的最小 zip 解析, 防基准文件本身悄悄坏掉) */
console.log('· zip 结构自检(EOCD/中央目录/UTF-8 flag/CRC)');
const eocdOffset = bytes.length - 22;
assert(bytes.readUInt32LE(eocdOffset) === 0x06054b50, 'EOCD 签名在尾部 22 字节处(store 型无注释)');
assert(bytes.readUInt16LE(eocdOffset + 8) === files.length && bytes.readUInt16LE(eocdOffset + 10) === files.length,
  `EOCD 条目数 = ${files.length}`);
const centralSize = bytes.readUInt32LE(eocdOffset + 12);
const centralOffset = bytes.readUInt32LE(eocdOffset + 16);
assert(centralOffset + centralSize === eocdOffset, '中央目录大小+偏移与 EOCD 位置吻合');

/* CRC32(与应用同款多项式 0xEDB88320, 独立实现交叉验证) */
const crcTable = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c; } return t; })();
const crc32 = d => { let c = ~0; for (let i = 0; i < d.length; i++) c = crcTable[(c ^ d[i]) & 255] ^ (c >>> 8); return ~c >>> 0; };

let cursor = centralOffset;
const enc = new TextEncoder();
for (const file of files) {
  const nameBytes = enc.encode(file.name);
  assert(bytes.readUInt32LE(cursor) === 0x02014b50, `${file.name}: 中央目录条目签名`);
  assert(bytes.readUInt16LE(cursor + 8) === 0x0800, `${file.name}: 通用标志 UTF-8 位(0x0800)置位`);
  assert(bytes.readUInt32LE(cursor + 16) === crc32(file.data), `${file.name}: 中央目录 CRC32 与自算值相符`);
  assert(bytes.readUInt32LE(cursor + 20) === file.data.length && bytes.readUInt32LE(cursor + 24) === file.data.length,
    `${file.name}: store 型压缩前后大小一致`);
  const nameLen = bytes.readUInt16LE(cursor + 28);
  assert(Buffer.compare(bytes.subarray(cursor + 46, cursor + 46 + nameLen), Buffer.from(nameBytes)) === 0,
    `${file.name}: 文件名 UTF-8 字节一致`);
  const localOffset = bytes.readUInt32LE(cursor + 42);
  assert(bytes.readUInt32LE(localOffset) === 0x04034b50, `${file.name}: local header 签名在记录的偏移处`);
  const dataStart = localOffset + 30 + nameLen;
  assert(Buffer.compare(bytes.subarray(dataStart, dataStart + file.data.length), Buffer.from(file.data)) === 0,
    `${file.name}: 数据区字节原样(store 无压缩)`);
  cursor += 46 + nameLen;
}

console.log(`\nC6 makeZip 字节基准: ${passed} 通过, ${failed} 失败`);
process.exit(failed ? 1 : 0);
