import { spawnSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export function resolveProbeCommand({ platform = process.platform, env = process.env, rootDir = root } = {}) {
  const electron = platform === 'win32'
    ? path.join(rootDir, 'node_modules', 'electron', 'dist', 'electron.exe')
    : path.join(rootDir, 'node_modules', '.bin', 'electron');
  const probe = path.join(rootDir, '测试', '项目输入DOM探针.cjs');
  if (platform === 'linux' && !env.DISPLAY) return { command: 'xvfb-run', args: ['-a', electron, probe], needsXvfb: true };
  return { command: electron, args: [probe], needsXvfb: false };
}

export function runProbe(options = {}) {
  const spec = resolveProbeCommand(options);
  const result = spawnSync(spec.command, spec.args, { cwd: options.rootDir || root, env: options.env || process.env, stdio: 'inherit' });
  if (result.error) {
    if (spec.needsXvfb && result.error.code === 'ENOENT') {
      throw new Error('Electron DOM probe requires xvfb-run when Linux DISPLAY is unavailable. Install the xvfb package; the probe was not skipped.');
    }
    throw result.error;
  }
  if (result.status !== 0) throw new Error(`Electron DOM probe failed with exit code ${result.status ?? 'unknown'}.`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { runProbe(); }
  catch (error) { console.error(error?.message || error); process.exitCode = 1; }
}
