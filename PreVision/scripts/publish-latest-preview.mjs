import crypto from 'node:crypto';
import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  LatestPreviewError,
  atomicWriteFile,
  inspectPreviewSource,
  launcherPaths,
  loadLauncherPolicy,
  pointerFromInspection
} from './latest-preview-launcher-runtime.mjs';

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(SCRIPT_PATH), '..');
const POLICY_PATH = path.join(ROOT, 'qa', 'latest-preview-launcher-policy.json');

function fail(code, details = {}) {
  throw new LatestPreviewError(code, details);
}

async function ensurePrivateDirectory(directoryPath) {
  try {
    const stat = await fsp.lstat(directoryPath);
    if (!stat.isDirectory() || stat.isSymbolicLink()) {
      fail('LATEST_PREVIEW_PUBLISH_DIRECTORY_INVALID', { path: directoryPath });
    }
    if ((stat.mode & 0o077) !== 0) {
      fail('LATEST_PREVIEW_PUBLISH_DIRECTORY_MODE_INVALID', {
        path: directoryPath,
        actual: (stat.mode & 0o777).toString(8)
      });
    }
  } catch (error) {
    if (!(error instanceof LatestPreviewError) && error.code === 'ENOENT') {
      await fsp.mkdir(directoryPath, { recursive: true, mode: 0o700 });
      await fsp.chmod(directoryPath, 0o700);
      return;
    }
    throw error;
  }
}

async function assertExistingPointerSafe(pointerPath) {
  let stat;
  try {
    stat = await fsp.lstat(pointerPath);
  } catch (error) {
    if (error.code === 'ENOENT') return;
    throw error;
  }
  if (!stat.isFile() || stat.isSymbolicLink()) {
    fail('LATEST_PREVIEW_PUBLISH_POINTER_TYPE_INVALID', { path: pointerPath });
  }
  if ((stat.mode & 0o777) !== 0o600) {
    fail('LATEST_PREVIEW_PUBLISH_POINTER_MODE_INVALID', {
      path: pointerPath,
      actual: (stat.mode & 0o777).toString(8)
    });
  }
}

async function acquirePublishLock(lockPath) {
  try {
    await fsp.mkdir(lockPath, { mode: 0o700 });
  } catch (error) {
    if (error.code === 'EEXIST') {
      fail('LATEST_PREVIEW_PUBLISH_LOCKED', { path: lockPath });
    }
    throw error;
  }
  try {
    const owner = {
      schemaVersion: 1,
      pid: process.pid,
      createdAt: new Date().toISOString(),
      nonce: crypto.randomBytes(16).toString('hex')
    };
    await fsp.writeFile(path.join(lockPath, 'owner.json'), `${JSON.stringify(owner, null, 2)}\n`, {
      mode: 0o600,
      flag: 'wx'
    });
  } catch (error) {
    await fsp.rm(lockPath, { recursive: true, force: true }).catch(() => {});
    throw error;
  }
}

async function releasePublishLock(lockPath) {
  const stat = await fsp.lstat(lockPath).catch(() => null);
  if (!stat?.isDirectory() || stat.isSymbolicLink()) {
    fail('LATEST_PREVIEW_PUBLISH_LOCK_RELEASE_INVALID', { path: lockPath });
  }
  await fsp.rm(lockPath, { recursive: true, force: false });
}

export async function publishLatestPreview({
  worktreePath,
  sourceCommit,
  title,
  homeDirectory = os.homedir(),
  publishedAt = new Date().toISOString(),
  beforeCommit = null
}) {
  const policy = await loadLauncherPolicy(POLICY_PATH);
  const paths = launcherPaths(homeDirectory, policy);
  await ensurePrivateDirectory(paths.supportRoot);
  await assertExistingPointerSafe(paths.pointerPath);
  await acquirePublishLock(paths.publishLockPath);
  try {
    const inspection = await inspectPreviewSource({
      worktreePath,
      sourceCommit,
      policy
    });
    const pointer = pointerFromInspection({
      inspection,
      title,
      policy,
      publishedAt
    });
    if (beforeCommit) await beforeCommit({ pointer, pointerPath: paths.pointerPath });
    await atomicWriteFile(paths.pointerPath, `${JSON.stringify(pointer, null, 2)}\n`, { mode: 0o600 });
    return { pointer, pointerPath: paths.pointerPath, supportRoot: paths.supportRoot };
  } finally {
    await releasePublishLock(paths.publishLockPath);
  }
}

function parseArguments(argumentsList) {
  const allowed = new Set(['--worktree', '--commit', '--title']);
  const values = {};
  for (let index = 0; index < argumentsList.length; index += 2) {
    const name = argumentsList[index];
    const value = argumentsList[index + 1];
    if (!allowed.has(name) || !value || value.startsWith('--')) {
      fail('LATEST_PREVIEW_PUBLISH_ARGUMENTS_INVALID');
    }
    values[name.slice(2)] = value;
  }
  if (argumentsList.length !== 6 || !values.worktree || !values.commit || !values.title) {
    fail('LATEST_PREVIEW_PUBLISH_ARGUMENTS_INVALID');
  }
  return values;
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === SCRIPT_PATH;
if (isMain) {
  try {
    const options = parseArguments(process.argv.slice(2));
    const result = await publishLatestPreview({
      worktreePath: options.worktree,
      sourceCommit: options.commit,
      title: options.title
    });
    console.log(`Latest preview pointer published: ${result.pointerPath}`);
    console.log(`Source: ${result.pointer.sourceCommit}`);
    console.log(`Worktree: ${result.pointer.worktreePath}`);
    console.log(`Title: ${result.pointer.title}`);
  } catch (error) {
    console.error(`${error.code || 'LATEST_PREVIEW_PUBLISH_FAILED'}: ${error.message}`);
    if (error.details) console.error(JSON.stringify(error.details));
    process.exitCode = 1;
  }
}
