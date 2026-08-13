import assert from 'assert/strict';
import path from 'path';
import { resolveProbeCommand } from '../scripts/run-project-input-probe.mjs';

const root = path.resolve('/workspace/prevision');
const linuxHeadless = resolveProbeCommand({ platform: 'linux', env: {}, rootDir: root });
assert.equal(linuxHeadless.command, 'xvfb-run');
assert.deepEqual(linuxHeadless.args.slice(0, 2), ['-a', path.join(root, 'node_modules', '.bin', 'electron')]);
assert.match(linuxHeadless.args[2], /项目输入DOM探针\.cjs$/);
assert.equal(linuxHeadless.needsXvfb, true);

const linuxDisplay = resolveProbeCommand({ platform: 'linux', env: { DISPLAY: ':99' }, rootDir: root });
assert.match(linuxDisplay.command, /node_modules[/\\]\.bin[/\\]electron$/);
assert.equal(linuxDisplay.needsXvfb, false);

const windows = resolveProbeCommand({ platform: 'win32', env: {}, rootDir: root });
assert.equal(windows.command, path.join(root, 'node_modules', 'electron', 'dist', 'electron.exe'));
assert.equal(windows.needsXvfb, false);

const darwin = resolveProbeCommand({ platform: 'darwin', env: {}, rootDir: root });
assert.equal(darwin.command, path.join(root, 'node_modules', '.bin', 'electron'));
assert.equal(darwin.args[0], path.join(root, '测试', '项目输入DOM探针.cjs'));
assert.equal(darwin.needsXvfb, false);

console.log('Project input probe launcher: 11 passed, 0 failed');
