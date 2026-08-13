import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defaultTargetPath, runUpdate, validateNodeVersion } from './update-local-app.mjs';

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const REPOSITORY_ROOT = path.resolve(path.dirname(SCRIPT_PATH), '..');

function runChild(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: 'inherit', ...options });
    child.once('error', reject);
    child.once('exit', (code, signal) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} failed (${signal || `exit ${code}`}).`));
    });
  });
}

async function runFullTestsProduction() {
  const npmExecPath = process.env.npm_execpath;
  if (!npmExecPath) throw new Error('Cannot locate npm-cli.js. Run delivery through npm.');
  await runChild(process.execPath, [npmExecPath, 'run', 'test:full'], {
    cwd: REPOSITORY_ROOT,
    env: process.env
  });
}

async function launchProduction(appPath) {
  await runChild('/usr/bin/open', [appPath]);
}

export async function runDelivery(options = {}) {
  validateNodeVersion(options.nodeVersion || process.versions.node);
  const test = options.test || runFullTestsProduction;
  const update = options.update || runUpdate;
  const launch = options.launch || launchProduction;
  await test();
  const result = await update(options.updateOptions || {});
  await launch(result.targetPath);
  return result;
}

if (process.argv[1] && path.resolve(process.argv[1]) === SCRIPT_PATH) {
  try {
    if (process.argv.length > 2) throw new Error('app:deliver does not accept arguments.');
    const result = await runDelivery();
    console.log(`Delivered and opened PreVision ${result.sourceCommit.slice(0, 7)} at ${result.targetPath}.`);
    if (result.cleanupWarning) console.warn(result.cleanupWarning);
  } catch (error) {
    console.error(`PreVision local delivery failed: ${error.message}`);
    process.exitCode = 1;
  }
}
