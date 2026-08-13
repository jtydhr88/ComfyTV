import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { extractFile } = require('@electron/asar');
const { BUILD_INFO_NAME } = require('./build-provenance.cjs');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const appPath = path.join(os.homedir(), 'Applications', 'PreVision.app');
const archivePath = path.join(appPath, 'Contents', 'Resources', 'app.asar');

function git(args) {
  return execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
}

function gitIsAncestor(ancestor, descendant) {
  try {
    execFileSync('git', ['merge-base', '--is-ancestor', ancestor, descendant], {
      cwd: root,
      stdio: 'ignore'
    });
    return true;
  } catch {
    return false;
  }
}

try {
  if (process.argv.length > 2) throw new Error('app:status does not accept arguments.');
  const info = JSON.parse(extractFile(archivePath, BUILD_INFO_NAME).toString('utf8'));
  const currentCommit = git(['rev-parse', 'HEAD']);
  const currentBranch = git(['symbolic-ref', '--quiet', '--short', 'HEAD']);
  const containsInstalled = gitIsAncestor(info.commit, currentCommit);
  console.log(`Installed source: ${info.commit} (${info.branch})`);
  console.log(`Current source:   ${currentCommit} (${currentBranch})`);
  console.log(`Contains installed source: ${containsInstalled ? 'yes' : 'no'}`);
  console.log(`Exact installed source: ${currentCommit === info.commit ? 'yes' : 'no'}`);
  if (!containsInstalled) process.exitCode = 2;
} catch (error) {
  console.error(`Cannot verify the fixed PreVision app source: ${error.message}`);
  process.exitCode = 1;
}
