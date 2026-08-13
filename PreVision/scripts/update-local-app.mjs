import { createHash, randomUUID } from 'node:crypto';
import { execFile, spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import {
  access,
  link,
  lstat,
  mkdir,
  readFile,
  realpath,
  rename,
  rm,
  writeFile
} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { extractFile } = require('@electron/asar');
const { BUILD_INFO_NAME } = require('./build-provenance.cjs');

export const APP_BUNDLE_NAME = 'PreVision.app';
export const EXPECTED_BUNDLE_ID = 'com.prevision.director';
export const UPDATE_WORKSPACE_NAME = '.prevision-update';
export const UPDATE_LOCK_NAME = '.prevision-update.lock';

const APP_EXECUTABLE_NAME = 'PreVision';
const UPDATE_SCHEMA_VERSION = 1;
const COMMIT_RECORD_NAME = 'Committed.json';
const WORKSPACE_OWNER_NAME = 'Owner.lock';
const SCRIPT_PATH = fileURLToPath(import.meta.url);
const REPOSITORY_ROOT = path.resolve(path.dirname(SCRIPT_PATH), '..');
const DELIVERY_POLICY_PATH = path.join(REPOSITORY_ROOT, 'qa', 'local-delivery-policy.json');
const COMMIT_PATTERN = /^[0-9a-f]{40}$/;
const activeTargets = new Set();

export function defaultTargetPath(home = os.homedir()) {
  return path.join(home, 'Applications', APP_BUNDLE_NAME);
}

export function validateNodeVersion(version = process.versions.node) {
  const match = String(version).trim().match(/^v?(\d+)(?:\.|$)/);
  const major = match ? Number.parseInt(match[1], 10) : Number.NaN;
  if (!Number.isInteger(major) || major < 20 || major > 24) {
    throw new Error(`PreVision local updates require Node.js 20-24; received ${version}.`);
  }
  return major;
}

export function validateAppPath(target) {
  if (typeof target !== 'string' || target.length === 0 || !path.isAbsolute(target)) {
    throw new Error('The PreVision app path must be absolute.');
  }
  const normalized = path.normalize(target);
  if (path.basename(normalized) !== APP_BUNDLE_NAME) {
    throw new Error(`The app path must end with ${APP_BUNDLE_NAME}.`);
  }
  return normalized;
}

function runExecFile(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    execFile(command, args, { encoding: 'utf8', maxBuffer: 1024 * 1024, ...options }, (error, stdout, stderr) => {
      if (error) {
        error.stdout = stdout;
        error.stderr = stderr;
        reject(error);
        return;
      }
      resolve({ stdout, stderr });
    });
  });
}

async function inspectRepositoryProduction(repositoryRoot) {
  const commit = (await runExecFile('git', ['rev-parse', 'HEAD'], { cwd: repositoryRoot })).stdout.trim();
  const branch = (await runExecFile('git', ['symbolic-ref', '--quiet', '--short', 'HEAD'], { cwd: repositoryRoot })).stdout.trim();
  const status = (await runExecFile('git', [
    'status',
    '--porcelain=v1',
    '--untracked-files=all'
  ], { cwd: repositoryRoot })).stdout;
  return { commit, branch, clean: status.trim() === '' };
}

async function inspectBuildInfoProduction(appPath) {
  try {
    const archivePath = path.join(appPath, 'Contents', 'Resources', 'app.asar');
    return JSON.parse(extractFile(archivePath, BUILD_INFO_NAME).toString('utf8'));
  } catch {
    return null;
  }
}

async function readDeliveryPolicyProduction(repositoryRoot = REPOSITORY_ROOT) {
  const policyPath = repositoryRoot === REPOSITORY_ROOT
    ? DELIVERY_POLICY_PATH
    : path.join(repositoryRoot, 'qa', 'local-delivery-policy.json');
  return JSON.parse(await readFile(policyPath, 'utf8'));
}

async function isAncestorProduction(repositoryRoot, ancestor, descendant) {
  try {
    await runExecFile('git', ['merge-base', '--is-ancestor', ancestor, descendant], { cwd: repositoryRoot });
    return true;
  } catch (error) {
    if (error?.code === 1) return false;
    throw error;
  }
}

export function validateDeliverySource(source) {
  if (!source || !COMMIT_PATTERN.test(source.commit || '')) {
    throw new Error('Cannot determine the committed PreVision delivery source.');
  }
  if (typeof source.branch !== 'string' || source.branch.length === 0 || /[\r\n\u0000]/.test(source.branch)) {
    throw new Error('PreVision local delivery requires a named Git branch.');
  }
  if (source.clean !== true) {
    throw new Error('PreVision local delivery requires a clean committed worktree.');
  }
  return source;
}

export function validateBuildProvenance(info, label = 'PreVision app') {
  const valid = info
    && info.schemaVersion === 1
    && info.product === 'PreVision'
    && COMMIT_PATTERN.test(info.commit || '')
    && typeof info.branch === 'string'
    && info.branch.length > 0
    && !/[\r\n\u0000]/.test(info.branch)
    && info.clean === true
    && info.deliveryEligible === true
    && typeof info.builtAt === 'string'
    && Number.isFinite(Date.parse(info.builtAt));
  if (!valid) throw new Error(`${label} has invalid or non-delivery build provenance.`);
  return info;
}

export function validateDeliveryPolicy(policy) {
  const valid = policy
    && policy.schemaVersion === 1
    && policy.product === 'PreVision'
    && policy.buildInfoName === BUILD_INFO_NAME
    && COMMIT_PATTERN.test(policy.bootstrapSourceCommit || '')
    && /^[0-9a-f]{64}$/.test(policy.bootstrapInstalledAsarSha256 || '');
  if (!valid) throw new Error('Invalid PreVision local delivery policy.');
  return policy;
}

export async function assertDeliveryLineage({
  source,
  installedInfo = null,
  installedHash = null,
  policy,
  isAncestor
}) {
  validateDeliverySource(source);
  validateDeliveryPolicy(policy);
  if (!installedHash) return { mode: 'first-install', previousCommit: null };
  if (installedInfo) {
    const previous = validateBuildProvenance(installedInfo, 'Installed PreVision app');
    if (!await isAncestor(previous.commit, source.commit)) {
      throw new Error(
        `This branch does not contain the installed PreVision source ${previous.commit.slice(0, 7)}. Integrate the latest delivered commit before updating the app.`
      );
    }
    return { mode: 'tracked', previousCommit: previous.commit };
  }
  if (installedHash !== policy.bootstrapInstalledAsarSha256) {
    throw new Error('The installed PreVision app has no trusted source record and does not match the bootstrap build.');
  }
  if (!await isAncestor(policy.bootstrapSourceCommit, source.commit)) {
    throw new Error('This branch does not contain the trusted bootstrap delivery commit.');
  }
  return { mode: 'bootstrap', previousCommit: policy.bootstrapSourceCommit };
}

export function assertPackagedBuildMatches(info, source) {
  const packaged = validateBuildProvenance(info, 'Packaged PreVision app');
  if (packaged.commit !== source.commit || packaged.branch !== source.branch) {
    throw new Error('The packaged PreVision app does not match the current delivery source.');
  }
  return packaged;
}

export function assertRepositoryUnchanged(current, expected) {
  const source = validateDeliverySource(current);
  if (source.commit !== expected.commit || source.branch !== expected.branch) {
    throw new Error('The PreVision source branch changed while the app was being packaged.');
  }
  return source;
}

async function inspectBundleProduction(appPath) {
  const plistPath = path.join(appPath, 'Contents', 'Info.plist');
  const bundleId = (await runExecFile('/usr/libexec/PlistBuddy', [
    '-c',
    'Print :CFBundleIdentifier',
    plistPath
  ])).stdout.trim();
  const version = (await runExecFile('/usr/libexec/PlistBuddy', [
    '-c',
    'Print :CFBundleShortVersionString',
    plistPath
  ])).stdout.trim();
  return { bundleId, version };
}

async function verifySignatureProduction(appPath) {
  await runExecFile('/usr/bin/codesign', ['--verify', '--deep', '--strict', appPath]);
  return true;
}

async function copyAppProduction(sourcePath, destinationPath) {
  await runExecFile('/usr/bin/ditto', [sourcePath, destinationPath]);
}

async function hashAppProduction(appPath) {
  const contents = await readFile(path.join(appPath, 'Contents', 'Resources', 'app.asar'));
  return createHash('sha256').update(contents).digest('hex');
}

async function isRunningProduction() {
  const { stdout } = await runExecFile('/bin/ps', ['-axo', 'comm=']);
  return stdout
    .split('\n')
    .some(command => path.basename(command.trim()) === APP_EXECUTABLE_NAME);
}

async function getProcessIdentityProduction(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return { status: 'absent' };
  try {
    process.kill(pid, 0);
  } catch (error) {
    if (error?.code === 'ESRCH') return { status: 'absent' };
    return { status: 'unknown' };
  }
  try {
    const { stdout } = await runExecFile('/bin/ps', [
      '-p',
      String(pid),
      '-o',
      'lstart=',
      '-o',
      'command='
    ]);
    const identity = stdout.trim().replace(/\s+/g, ' ');
    return identity ? { status: 'present', identity } : { status: 'unknown' };
  } catch {
    return { status: 'unknown' };
  }
}

async function lstatIfPresent(appPath, stat = lstat) {
  try {
    return await stat(appPath);
  } catch (error) {
    if (error?.code === 'ENOENT') return null;
    throw error;
  }
}

function assertDirectoryNotSymlink(appPath, stats, label) {
  if (!stats) throw new Error(`${label} does not exist: ${appPath}`);
  if (stats.isSymbolicLink()) throw new Error(`${label} must not be a symbolic link: ${appPath}`);
  if (!stats.isDirectory()) throw new Error(`${label} must be a directory: ${appPath}`);
}

function assertExpectedBundle(bundle, appPath, label) {
  if (!bundle || bundle.bundleId !== EXPECTED_BUNDLE_ID) {
    throw new Error(
      `${label} has bundle ID ${bundle?.bundleId || '(missing)'}; expected ${EXPECTED_BUNDLE_ID}: ${appPath}`
    );
  }
}

function pathComponents(absolutePath) {
  const normalized = path.normalize(absolutePath);
  const { root } = path.parse(normalized);
  const relative = normalized.slice(root.length);
  const parts = relative.split(path.sep).filter(Boolean);
  const components = [root];
  let current = root;
  for (const part of parts) {
    current = path.join(current, part);
    components.push(current);
  }
  return components;
}

async function assertExistingDirectoryChain(directory, deps, label) {
  for (const component of pathComponents(directory)) {
    const stats = await lstatIfPresent(component, deps.lstat);
    assertDirectoryNotSymlink(component, stats, label);
  }
}

async function assertExistingDirectoryPrefix(directory, deps, label) {
  let missingParent = false;
  for (const component of pathComponents(directory)) {
    const stats = await lstatIfPresent(component, deps.lstat);
    if (!stats) {
      missingParent = true;
      continue;
    }
    if (missingParent) {
      throw new Error(`${label} has an inconsistent path prefix: ${component}`);
    }
    assertDirectoryNotSymlink(component, stats, label);
  }
}

async function preflightSourcePath(sourcePath, deps, { mustExist = false } = {}) {
  await assertExistingDirectoryPrefix(path.dirname(sourcePath), deps, 'Packaged app parent directory');
  const sourceStats = await lstatIfPresent(sourcePath, deps.lstat);
  if (sourceStats) {
    assertDirectoryNotSymlink(sourcePath, sourceStats, 'Packaged PreVision app');
  } else if (mustExist) {
    throw new Error(`Packaged PreVision app does not exist: ${sourcePath}`);
  }
}

async function ensureDirectoryChain(directory, deps, label) {
  for (const component of pathComponents(directory)) {
    let stats = await lstatIfPresent(component, deps.lstat);
    if (!stats) {
      await deps.mkdir(component, { mode: 0o755 });
      stats = await lstatIfPresent(component, deps.lstat);
    }
    assertDirectoryNotSymlink(component, stats, label);
  }
}

export function updateWorkspacePath(targetPath) {
  return path.join(path.dirname(validateAppPath(targetPath)), UPDATE_WORKSPACE_NAME);
}

export function updateLockPath(targetPath) {
  return path.join(path.dirname(validateAppPath(targetPath)), UPDATE_LOCK_NAME);
}

export function createUpdateMarker(
  targetPath,
  ownerPid = process.pid,
  ownerIdentity = `pid:${ownerPid}:test-owner`,
  transactionId = randomUUID()
) {
  return {
    schemaVersion: UPDATE_SCHEMA_VERSION,
    bundleId: EXPECTED_BUNDLE_ID,
    targetPath: validateAppPath(targetPath),
    ownerPid,
    ownerIdentity,
    transactionId
  };
}

function assertValidMarker(marker, targetPath, markerPath) {
  const valid = marker
    && marker.schemaVersion === UPDATE_SCHEMA_VERSION
    && marker.bundleId === EXPECTED_BUNDLE_ID
    && marker.targetPath === targetPath
    && Number.isInteger(marker.ownerPid)
    && marker.ownerPid > 0
    && typeof marker.ownerIdentity === 'string'
    && marker.ownerIdentity.length > 0
    && typeof marker.transactionId === 'string'
    && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(marker.transactionId);
  if (!valid) {
    throw new Error(`Unrecognized PreVision update lock; refusing to modify it: ${markerPath}`);
  }
  return marker;
}

async function validateKnownApp(appPath, deps, label) {
  const stats = await lstatIfPresent(appPath, deps.lstat);
  assertDirectoryNotSymlink(appPath, stats, label);
  const bundle = await deps.inspectBundle(appPath);
  assertExpectedBundle(bundle, appPath, label);
  if (await deps.verifySignature(appPath) === false) {
    throw new Error(`${label} has an invalid signature: ${appPath}`);
  }
  return bundle;
}

function dependencySet(overrides = {}) {
  return {
    inspectBundle: inspectBundleProduction,
    inspectBuildInfo: inspectBuildInfoProduction,
    inspectRepository: inspectRepositoryProduction,
    readDeliveryPolicy: readDeliveryPolicyProduction,
    isAncestor: isAncestorProduction,
    verifySignature: verifySignatureProduction,
    isRunning: isRunningProduction,
    copyApp: copyAppProduction,
    hashApp: hashAppProduction,
    getProcessIdentity: getProcessIdentityProduction,
    link,
    lstat,
    mkdir,
    readFile,
    realpath,
    rename,
    remove: appPath => rm(appPath, { recursive: true, force: true }),
    writeFile,
    ...overrides
  };
}

function assertRegularFileNotSymlink(filePath, stats, label) {
  if (!stats) throw new Error(`${label} does not exist: ${filePath}`);
  if (stats.isSymbolicLink()) throw new Error(`${label} must not be a symbolic link: ${filePath}`);
  if (!stats.isFile()) throw new Error(`${label} must be a regular file: ${filePath}`);
}

function transactionPaths(targetPath, marker = null) {
  const workspacePath = updateWorkspacePath(targetPath);
  const lockPath = updateLockPath(targetPath);
  const transactionId = marker?.transactionId;
  const preparingWorkspacePath = transactionId
    ? `${workspacePath}.${transactionId}.tmp`
    : null;
  return {
    targetPath,
    marker,
    workspacePath,
    lockPath,
    tempLockPath: transactionId ? `${lockPath}.${transactionId}.tmp` : null,
    preparingWorkspacePath,
    preparingOwnerPath: preparingWorkspacePath
      ? path.join(preparingWorkspacePath, WORKSPACE_OWNER_NAME)
      : null,
    workspaceOwnerPath: path.join(workspacePath, WORKSPACE_OWNER_NAME),
    stagedPath: path.join(workspacePath, 'Staged-PreVision.app'),
    backupPath: path.join(workspacePath, 'Previous-PreVision.app'),
    rejectedPath: path.join(workspacePath, 'Rejected-PreVision.app'),
    commitRecordPath: path.join(workspacePath, COMMIT_RECORD_NAME),
    commitTempPath: transactionId
      ? path.join(workspacePath, `Committed.${transactionId}.tmp`)
      : null,
    lockOwned: false,
    lockDevice: null,
    lockInode: null,
    preparingWorkspaceOwned: false,
    workspaceOwned: false
  };
}

async function readUpdateMarker(lockPath, targetPath, deps) {
  const stats = await lstatIfPresent(lockPath, deps.lstat);
  assertRegularFileNotSymlink(lockPath, stats, 'PreVision update lock');
  let marker;
  try {
    marker = JSON.parse(await deps.readFile(lockPath, 'utf8'));
  } catch {
    throw new Error(`Unrecognized PreVision update lock; refusing to modify it: ${lockPath}`);
  }
  return assertValidMarker(marker, targetPath, lockPath);
}

async function readCommitRecord(transaction, deps) {
  const stats = await lstatIfPresent(transaction.commitRecordPath, deps.lstat);
  if (!stats) return null;
  assertRegularFileNotSymlink(transaction.commitRecordPath, stats, 'PreVision commit record');
  let record;
  try {
    record = JSON.parse(await deps.readFile(transaction.commitRecordPath, 'utf8'));
  } catch {
    throw new Error(`Unrecognized PreVision commit record: ${transaction.commitRecordPath}`);
  }
  const valid = record
    && record.schemaVersion === UPDATE_SCHEMA_VERSION
    && record.transactionId === transaction.marker.transactionId
    && typeof record.sourceHash === 'string'
    && record.sourceHash.length > 0;
  if (!valid) {
    throw new Error(`Unrecognized PreVision commit record: ${transaction.commitRecordPath}`);
  }
  return record;
}

async function removeIfPresent(removePath, deps) {
  if (removePath && await lstatIfPresent(removePath, deps.lstat)) {
    await deps.remove(removePath);
  }
}

async function assertOwnedLock(transaction, deps) {
  const stats = await lstatIfPresent(transaction.lockPath, deps.lstat);
  assertRegularFileNotSymlink(transaction.lockPath, stats, 'PreVision update lock');
  if (transaction.lockDevice !== null
    && (stats.dev !== transaction.lockDevice || stats.ino !== transaction.lockInode)) {
    throw new Error(`The PreVision update lock file identity changed unexpectedly: ${transaction.lockPath}`);
  }
  const marker = await readUpdateMarker(transaction.lockPath, transaction.targetPath, deps);
  if (marker.transactionId !== transaction.marker.transactionId) {
    throw new Error(`The PreVision update lock changed unexpectedly: ${transaction.lockPath}`);
  }
}

async function assertWorkspaceBound(transaction, workspacePath, ownerPath, deps) {
  const workspaceStats = await lstatIfPresent(workspacePath, deps.lstat);
  assertDirectoryNotSymlink(workspacePath, workspaceStats, 'PreVision recovery workspace');
  const lockStats = await lstatIfPresent(transaction.lockPath, deps.lstat);
  const ownerStats = await lstatIfPresent(ownerPath, deps.lstat);
  assertRegularFileNotSymlink(transaction.lockPath, lockStats, 'PreVision update lock');
  assertRegularFileNotSymlink(ownerPath, ownerStats, 'PreVision workspace owner');
  const ownerMarker = await readUpdateMarker(ownerPath, transaction.targetPath, deps);
  if (ownerMarker.transactionId !== transaction.marker.transactionId
    || lockStats.dev !== ownerStats.dev
    || lockStats.ino !== ownerStats.ino) {
    throw new Error(`The PreVision recovery workspace is not owned by this update: ${workspacePath}`);
  }
}

async function cleanupTransactionArtifacts(transaction, deps) {
  // The verified app is never part of cleanup. Recovery files go first and the
  // complete, independently stored ownership lock is deliberately removed last.
  if (transaction.lockOwned) await assertOwnedLock(transaction, deps);
  if (transaction.preparingWorkspaceOwned) {
    const ownerStats = await lstatIfPresent(transaction.preparingOwnerPath, deps.lstat);
    if (ownerStats) {
      await assertWorkspaceBound(
        transaction,
        transaction.preparingWorkspacePath,
        transaction.preparingOwnerPath,
        deps
      );
    }
    await removeIfPresent(transaction.preparingWorkspacePath, deps);
    transaction.preparingWorkspaceOwned = false;
  }
  if (transaction.workspaceOwned) {
    await assertWorkspaceBound(
      transaction,
      transaction.workspacePath,
      transaction.workspaceOwnerPath,
      deps
    );
    for (const cleanupPath of [
      transaction.backupPath,
      transaction.stagedPath,
      transaction.rejectedPath
    ]) {
      await removeIfPresent(cleanupPath, deps);
    }
    await deps.rename(transaction.workspacePath, transaction.preparingWorkspacePath);
    transaction.workspaceOwned = false;
    transaction.preparingWorkspaceOwned = true;
  }
  if (transaction.preparingWorkspaceOwned) {
    await removeIfPresent(transaction.preparingWorkspacePath, deps);
    transaction.preparingWorkspaceOwned = false;
  }
  await removeIfPresent(transaction.tempLockPath, deps);
  if (transaction.lockOwned) {
    await assertOwnedLock(transaction, deps);
    await deps.remove(transaction.lockPath);
    transaction.lockOwned = false;
  }
}

async function recoverInterruptedUpdate(targetPath, deps) {
  const workspacePath = updateWorkspacePath(targetPath);
  const lockPath = updateLockPath(targetPath);
  const workspaceStats = await lstatIfPresent(workspacePath, deps.lstat);
  const lockStats = await lstatIfPresent(lockPath, deps.lstat);

  if (!lockStats) {
    if (workspaceStats) {
      throw new Error(`Unrecognized PreVision recovery workspace; refusing to modify it: ${workspacePath}`);
    }
    return { recovered: false, workspacePath, lockPath };
  }

  const marker = await readUpdateMarker(lockPath, targetPath, deps);
  if (marker.ownerPid !== process.pid) {
    const ownerState = await deps.getProcessIdentity(marker.ownerPid);
    if (ownerState?.status === 'unknown') {
      throw new Error(`Cannot confirm whether another PreVision update is still running (PID ${marker.ownerPid}).`);
    }
    if (ownerState?.status !== 'present' && ownerState?.status !== 'absent') {
      throw new Error(`Invalid process identity result for PreVision update PID ${marker.ownerPid}.`);
    }
    if (ownerState.status === 'present' && ownerState.identity === marker.ownerIdentity) {
      throw new Error(`Another PreVision update is still running (PID ${marker.ownerPid}).`);
    }
  }

  const transaction = transactionPaths(targetPath, marker);
  transaction.lockOwned = true;
  transaction.lockDevice = lockStats.dev;
  transaction.lockInode = lockStats.ino;
  const preparingStats = await lstatIfPresent(transaction.preparingWorkspacePath, deps.lstat);
  if (workspaceStats) {
    await assertWorkspaceBound(transaction, workspacePath, transaction.workspaceOwnerPath, deps);
    transaction.workspaceOwned = true;
  }
  if (preparingStats) {
    assertDirectoryNotSymlink(
      transaction.preparingWorkspacePath,
      preparingStats,
      'PreVision preparing workspace'
    );
    const preparingOwnerStats = await lstatIfPresent(transaction.preparingOwnerPath, deps.lstat);
    if (preparingOwnerStats) {
      await assertWorkspaceBound(
        transaction,
        transaction.preparingWorkspacePath,
        transaction.preparingOwnerPath,
        deps
      );
    }
    transaction.preparingWorkspaceOwned = true;
  }
  const targetStats = await lstatIfPresent(targetPath, deps.lstat);
  const backupStats = workspaceStats
    ? await lstatIfPresent(transaction.backupPath, deps.lstat)
    : null;
  const commitRecord = workspaceStats ? await readCommitRecord(transaction, deps) : null;

  if (!targetStats && backupStats) {
    await validateKnownApp(transaction.backupPath, deps, 'Recovered previous PreVision app');
    await deps.rename(transaction.backupPath, targetPath);
    await validateKnownApp(targetPath, deps, 'Restored PreVision app');
  } else if (targetStats && backupStats && !commitRecord) {
    // The swap was interrupted before the new app was committed. Prefer the
    // last verified entry and keep the interrupted bundle isolated until cleanup.
    await validateKnownApp(targetPath, deps, 'Interrupted PreVision app');
    await validateKnownApp(transaction.backupPath, deps, 'Recovered previous PreVision app');
    await deps.rename(targetPath, transaction.rejectedPath);
    await deps.rename(transaction.backupPath, targetPath);
    await validateKnownApp(targetPath, deps, 'Restored PreVision app');
  } else if (targetStats) {
    await validateKnownApp(targetPath, deps, 'Installed PreVision app');
    if (commitRecord && await deps.hashApp(targetPath) !== commitRecord.sourceHash) {
      throw new Error('The committed PreVision app no longer matches its recovery record.');
    }
  }

  await cleanupTransactionArtifacts(transaction, deps);
  return { recovered: true, workspacePath, lockPath };
}

async function acquireUpdateLock(targetPath, deps) {
  const ownerState = await deps.getProcessIdentity(process.pid);
  if (ownerState?.status !== 'present'
    || typeof ownerState.identity !== 'string'
    || ownerState.identity.length === 0) {
    throw new Error('Could not determine the updater process identity.');
  }
  const marker = createUpdateMarker(targetPath, process.pid, ownerState.identity);
  const transaction = transactionPaths(targetPath, marker);
  let tempCreated = false;
  let lockCreated = false;
  try {
    await deps.writeFile(
      transaction.tempLockPath,
      `${JSON.stringify(marker)}\n`,
      { encoding: 'utf8', flag: 'wx', mode: 0o600 }
    );
    tempCreated = true;
    await deps.link(transaction.tempLockPath, transaction.lockPath);
    lockCreated = true;
    transaction.lockOwned = true;
    const lockStats = await deps.lstat(transaction.lockPath);
    transaction.lockDevice = lockStats.dev;
    transaction.lockInode = lockStats.ino;
    await deps.remove(transaction.tempLockPath);
    tempCreated = false;
    return transaction;
  } catch (error) {
    try {
      if (tempCreated) await deps.remove(transaction.tempLockPath);
      if (lockCreated && await lstatIfPresent(transaction.lockPath, deps.lstat)) {
        await assertOwnedLock(transaction, deps);
        await deps.remove(transaction.lockPath);
      }
    } catch (cleanupError) {
      throw new AggregateError(
        [error, cleanupError],
        `Could not acquire or clean the PreVision update lock: ${transaction.lockPath}`
      );
    }
    if (error?.code === 'EEXIST') {
      throw new Error(`Another PreVision update acquired the lock: ${transaction.lockPath}`);
    }
    throw error;
  }
}

async function beginUpdateTransaction(targetPath, deps) {
  if (activeTargets.has(targetPath)) {
    throw new Error(`A PreVision update for this target is already active: ${targetPath}`);
  }
  activeTargets.add(targetPath);

  let transaction = null;
  try {
    if (await deps.isRunning(EXPECTED_BUNDLE_ID, targetPath)) {
      throw new Error('PreVision is running. Quit every PreVision window before updating the local app.');
    }
    await ensureDirectoryChain(path.dirname(targetPath), deps, 'Target Applications directory');
    await recoverInterruptedUpdate(targetPath, deps);
    transaction = await acquireUpdateLock(targetPath, deps);
    await deps.mkdir(transaction.preparingWorkspacePath, { mode: 0o700 });
    transaction.preparingWorkspaceOwned = true;
    await deps.link(transaction.lockPath, transaction.preparingOwnerPath);
    await deps.rename(transaction.preparingWorkspacePath, transaction.workspacePath);
    transaction.preparingWorkspaceOwned = false;
    transaction.workspaceOwned = true;
    return transaction;
  } catch (error) {
    if (transaction) {
      try {
        await cleanupTransactionArtifacts(transaction, deps);
      } catch (cleanupError) {
        throw new AggregateError(
          [error, cleanupError],
          `Could not initialize or clean the PreVision update transaction: ${transaction.workspacePath}`
        );
      }
    }
    throw error;
  } finally {
    if (!transaction?.workspaceOwned) activeTargets.delete(targetPath);
  }
}

async function markTransactionCommitted(transaction, sourceHash, deps) {
  const record = {
    schemaVersion: UPDATE_SCHEMA_VERSION,
    transactionId: transaction.marker.transactionId,
    sourceHash
  };
  let tempCreated = false;
  let commitLinked = false;
  try {
    await deps.writeFile(
      transaction.commitTempPath,
      `${JSON.stringify(record)}\n`,
      { encoding: 'utf8', flag: 'wx', mode: 0o600 }
    );
    tempCreated = true;
    await deps.link(transaction.commitTempPath, transaction.commitRecordPath);
    commitLinked = true;
  } catch (error) {
    if (tempCreated) {
      try {
        await deps.remove(transaction.commitTempPath);
      } catch (cleanupError) {
        throw new AggregateError([error, cleanupError], 'Could not record the verified PreVision update.');
      }
    }
    throw error;
  }
  try {
    await deps.remove(transaction.commitTempPath);
    tempCreated = false;
  } catch {
    // The hard-linked commit record is already the durable commit point. Leave
    // the redundant temp link for normal transaction cleanup; never roll back a
    // verified app because post-commit cleanup was interrupted.
  }
  return commitLinked;
}

function preserveRecoveryFiles(error) {
  error.preservePreVisionRecovery = true;
  return error;
}

async function performInstall(sourcePath, transaction, deps) {
  const { targetPath } = transaction;
  await assertExistingDirectoryChain(path.dirname(sourcePath), deps, 'Packaged app parent directory');
  const sourceBundle = await validateKnownApp(sourcePath, deps, 'Packaged PreVision app');
  const sourceRealPath = await deps.realpath(sourcePath);
  const sourceHash = await deps.hashApp(sourcePath);

  let targetStats = await lstatIfPresent(targetPath, deps.lstat);
  const targetInitiallyExists = Boolean(targetStats);
  let targetInitialHash = null;
  if (targetStats) {
    await validateKnownApp(targetPath, deps, 'Installed PreVision app');
    if (await deps.realpath(targetPath) === sourceRealPath) {
      throw new Error('The packaged source and installed target resolve to the same app.');
    }
    targetInitialHash = await deps.hashApp(targetPath);
  }

  await deps.copyApp(sourcePath, transaction.stagedPath);
  const stagedBundle = await validateKnownApp(transaction.stagedPath, deps, 'Staged PreVision app');
  if (await deps.hashApp(transaction.stagedPath) !== sourceHash) {
    throw new Error('Staged PreVision app does not match the packaged app.');
  }

  if (await deps.isRunning(EXPECTED_BUNDLE_ID, targetPath)) {
    throw new Error('PreVision started during the update. Quit PreVision and run the update again.');
  }

  targetStats = await lstatIfPresent(targetPath, deps.lstat);
  if (Boolean(targetStats) !== targetInitiallyExists) {
    throw new Error('The installed PreVision app changed during the update. Run the update again.');
  }
  if (targetStats) {
    await validateKnownApp(targetPath, deps, 'Installed PreVision app');
    if (await deps.hashApp(targetPath) !== targetInitialHash) {
      throw new Error('The installed PreVision app changed during the update. Run the update again.');
    }
    await deps.rename(targetPath, transaction.backupPath);
  }

  try {
    await deps.rename(transaction.stagedPath, targetPath);
  } catch (installError) {
    if (targetInitiallyExists) {
      try {
        await deps.rename(transaction.backupPath, targetPath);
      } catch (rollbackError) {
        throw preserveRecoveryFiles(new AggregateError(
          [installError, rollbackError],
          `PreVision installation failed and rollback was incomplete. Recovery files remain at ${transaction.workspacePath}.`
        ));
      }
    }
    throw installError;
  }

  let installedBundle;
  try {
    installedBundle = await validateKnownApp(targetPath, deps, 'Installed PreVision app');
    if (await deps.hashApp(targetPath) !== sourceHash) {
      throw new Error('Installed PreVision app does not match the packaged app.');
    }
    await markTransactionCommitted(transaction, sourceHash, deps);
  } catch (verificationError) {
    try {
      await deps.rename(targetPath, transaction.rejectedPath);
      if (targetInitiallyExists) await deps.rename(transaction.backupPath, targetPath);
    } catch (rollbackError) {
      throw preserveRecoveryFiles(new AggregateError(
        [verificationError, rollbackError],
        `The installed PreVision app failed verification and rollback was incomplete. Recovery files remain at ${transaction.workspacePath}.`
      ));
    }
    throw verificationError;
  }

  let cleanupWarning = null;
  try {
    await cleanupTransactionArtifacts(transaction, deps);
  } catch (cleanupError) {
    cleanupWarning = `Installed app is valid, but recovery workspace cleanup failed: ${transaction.workspacePath} (${cleanupError.message})`;
  }
  return {
    targetPath,
    bundleId: installedBundle.bundleId || stagedBundle.bundleId || sourceBundle.bundleId,
    version: installedBundle.version,
    sourceHash,
    cleanupWarning
  };
}

async function finishFailedTransaction(transaction, deps, originalError) {
  if (originalError?.preservePreVisionRecovery) throw originalError;
  try {
    await cleanupTransactionArtifacts(transaction, deps);
  } catch (cleanupError) {
    throw new AggregateError(
      [originalError, cleanupError],
      `The PreVision update failed and recovery cleanup was incomplete: ${transaction.workspacePath}`
    );
  }
  throw originalError;
}

function appendCleanupWarning(existingWarning, nextWarning) {
  return [existingWarning, nextWarning].filter(Boolean).join(' ');
}

function pathsOverlapAsAncestor(firstPath, secondPath) {
  const firstToSecond = path.relative(firstPath, secondPath);
  const secondToFirst = path.relative(secondPath, firstPath);
  const isInside = relativePath => relativePath === ''
    || (!relativePath.startsWith(`..${path.sep}`) && relativePath !== '..' && !path.isAbsolute(relativePath));
  return isInside(firstToSecond) || isInside(secondToFirst);
}

async function cleanupPackagedSource(sourcePath, targetPath, expectedHash, deps) {
  await assertExistingDirectoryChain(path.dirname(sourcePath), deps, 'Packaged app parent directory');
  const initialStats = await lstatIfPresent(sourcePath, deps.lstat);
  assertDirectoryNotSymlink(sourcePath, initialStats, 'Packaged PreVision app pending cleanup');
  await validateKnownApp(sourcePath, deps, 'Packaged PreVision app pending cleanup');
  if (await deps.hashApp(sourcePath) !== expectedHash) {
    throw new Error('The packaged PreVision app changed after installation; leaving it for inspection.');
  }

  await validateKnownApp(targetPath, deps, 'Installed PreVision app before source cleanup');
  if (await deps.hashApp(targetPath) !== expectedHash) {
    throw new Error('The installed PreVision app no longer matches the packaged app; leaving the source for inspection.');
  }

  const finalStats = await lstatIfPresent(sourcePath, deps.lstat);
  assertDirectoryNotSymlink(sourcePath, finalStats, 'Packaged PreVision app pending cleanup');
  if (finalStats.dev !== initialStats.dev || finalStats.ino !== initialStats.ino) {
    throw new Error('The packaged PreVision app changed identity before cleanup; leaving it for inspection.');
  }

  const quarantinePath = path.join(
    path.dirname(sourcePath),
    `.prevision-packaged-source-cleanup-${randomUUID()}`
  );
  let quarantined = false;
  try {
    await deps.rename(sourcePath, quarantinePath);
    quarantined = true;
    const quarantineStats = await lstatIfPresent(quarantinePath, deps.lstat);
    assertDirectoryNotSymlink(quarantinePath, quarantineStats, 'Quarantined packaged PreVision app');
    if (quarantineStats.dev !== initialStats.dev || quarantineStats.ino !== initialStats.ino) {
      throw new Error('The packaged PreVision app changed identity while entering cleanup quarantine.');
    }
    await validateKnownApp(quarantinePath, deps, 'Quarantined packaged PreVision app');
    if (await deps.hashApp(quarantinePath) !== expectedHash) {
      throw new Error('The quarantined packaged PreVision app changed; leaving it for inspection.');
    }
    await validateKnownApp(targetPath, deps, 'Installed PreVision app before final source cleanup');
    if (await deps.hashApp(targetPath) !== expectedHash) {
      throw new Error('The installed PreVision app changed during source cleanup; restoring the packaged source.');
    }
    const removalStats = await lstatIfPresent(quarantinePath, deps.lstat);
    assertDirectoryNotSymlink(quarantinePath, removalStats, 'Quarantined packaged PreVision app');
    if (removalStats.dev !== initialStats.dev || removalStats.ino !== initialStats.ino) {
      throw new Error('The quarantined packaged PreVision app changed identity before removal.');
    }
    await deps.remove(quarantinePath);
    if (await lstatIfPresent(quarantinePath, deps.lstat)) {
      throw new Error(`The quarantined packaged PreVision app still exists: ${quarantinePath}`);
    }
    quarantined = false;
    if (await lstatIfPresent(sourcePath, deps.lstat)) {
      throw new Error('A new packaged source appeared during cleanup; leaving it for inspection.');
    }
  } catch (error) {
    if (quarantined && await lstatIfPresent(quarantinePath, deps.lstat)
      && !await lstatIfPresent(sourcePath, deps.lstat)) {
      try {
        await deps.rename(quarantinePath, sourcePath);
        quarantined = false;
      } catch (restoreError) {
        throw new AggregateError(
          [error, restoreError],
          `Packaged source cleanup failed and its quarantine could not be restored: ${quarantinePath}`
        );
      }
    }
    throw error;
  }
}

/**
 * Install a packaged PreVision bundle at one fixed path.
 *
 * System operations are injectable so the swap and rollback behavior can be
 * tested without invoking macOS tools or modifying a real Applications folder.
 */
export async function installLocalApp(options = {}) {
  const sourcePath = validateAppPath(
    options.sourcePath || path.join(REPOSITORY_ROOT, 'out', 'PreVision-darwin-arm64', APP_BUNDLE_NAME)
  );
  const targetPath = validateAppPath(options.targetPath || defaultTargetPath());
  if (sourcePath === targetPath) {
    throw new Error('The packaged source and installed target must be different paths.');
  }

  const deps = dependencySet(options.deps);
  await preflightSourcePath(sourcePath, deps, { mustExist: true });
  const transaction = await beginUpdateTransaction(targetPath, deps);
  try {
    return await performInstall(sourcePath, transaction, deps);
  } catch (error) {
    return await finishFailedTransaction(transaction, deps, error);
  } finally {
    activeTargets.delete(targetPath);
  }
}

async function findNpmExecPath(explicitPath, nodeExecPath) {
  const candidates = [
    explicitPath,
    process.env.npm_execpath,
    path.resolve(path.dirname(nodeExecPath), '..', 'lib', 'node_modules', 'npm', 'bin', 'npm-cli.js')
  ].filter(Boolean);
  for (const candidate of candidates) {
    try {
      await access(candidate);
      return candidate;
    } catch {
      // Try the next location.
    }
  }
  throw new Error('Cannot locate npm-cli.js. Run this updater through npm or provide npmExecPath.');
}

function runNpmPackage({ nodeExecPath, npmExecPath, cwd, buildEnv = {} }) {
  return new Promise((resolve, reject) => {
    const child = spawn(nodeExecPath, [
      npmExecPath,
      'run',
      'package'
    ], {
      cwd,
      env: { ...process.env, ...buildEnv },
      stdio: 'inherit'
    });
    child.once('error', reject);
    child.once('exit', (code, signal) => {
      if (code === 0) resolve();
      else reject(new Error(`PreVision packaging failed (${signal || `exit ${code}`}).`));
    });
  });
}

export async function runUpdate(options = {}) {
  validateNodeVersion(options.nodeVersion || process.versions.node);
  const platform = options.platform || process.platform;
  if (platform !== 'darwin') {
    throw new Error(`PreVision local app updates require macOS; received ${platform}.`);
  }

  const repositoryRoot = path.resolve(options.repositoryRoot || REPOSITORY_ROOT);
  const expectedSourcePath = path.join(
    repositoryRoot,
    'out',
    'PreVision-darwin-arm64',
    APP_BUNDLE_NAME
  );
  const sourcePath = validateAppPath(
    options.sourcePath || expectedSourcePath
  );
  const targetPath = validateAppPath(options.targetPath || defaultTargetPath());
  if (sourcePath !== expectedSourcePath) {
    throw new Error(`app:update only packages and cleans the repository output: ${expectedSourcePath}`);
  }
  if (pathsOverlapAsAncestor(sourcePath, targetPath)) {
    throw new Error('The packaged source and installed target must be disjoint paths.');
  }
  const deps = dependencySet(options.deps);
  const deliverySource = validateDeliverySource(await deps.inspectRepository(repositoryRoot));
  const deliveryPolicy = validateDeliveryPolicy(await deps.readDeliveryPolicy(repositoryRoot));
  await preflightSourcePath(sourcePath, deps);
  const transaction = await beginUpdateTransaction(targetPath, deps);
  try {
    const installedStats = await lstatIfPresent(targetPath, deps.lstat);
    let installedHash = null;
    let installedInfo = null;
    if (installedStats) {
      await validateKnownApp(targetPath, deps, 'Installed PreVision app');
      installedHash = await deps.hashApp(targetPath);
      installedInfo = await deps.inspectBuildInfo(targetPath);
    }
    const lineage = await assertDeliveryLineage({
      source: deliverySource,
      installedInfo,
      installedHash,
      policy: deliveryPolicy,
      isAncestor: (ancestor, descendant) => deps.isAncestor(
        repositoryRoot,
        ancestor,
        descendant
      )
    });
    const nodeExecPath = options.nodeExecPath || process.execPath;
    const build = options.build || options.deps?.build || runNpmPackage;
    const npmExecPath = build === runNpmPackage
      ? await findNpmExecPath(options.npmExecPath, nodeExecPath)
      : options.npmExecPath || process.env.npm_execpath;

    await build({
      nodeExecPath,
      npmExecPath,
      cwd: repositoryRoot,
      platform: 'darwin',
      arch: 'arm64',
      buildEnv: {
        PREVISION_DELIVERY_BUILD: '1',
        PREVISION_SOURCE_COMMIT: deliverySource.commit,
        PREVISION_SOURCE_BRANCH: deliverySource.branch,
        PREVISION_SOURCE_CLEAN: '1'
      }
    });

    assertRepositoryUnchanged(
      await deps.inspectRepository(repositoryRoot),
      deliverySource
    );
    const packagedInfo = assertPackagedBuildMatches(
      await deps.inspectBuildInfo(sourcePath),
      deliverySource
    );
    const result = await performInstall(sourcePath, transaction, deps);
    result.sourceCommit = packagedInfo.commit;
    result.sourceBranch = packagedInfo.branch;
    result.previousCommit = lineage.previousCommit;
    try {
      await cleanupPackagedSource(sourcePath, targetPath, result.sourceHash, deps);
    } catch (cleanupError) {
      result.cleanupWarning = appendCleanupWarning(
        result.cleanupWarning,
        `Installed app is valid, but packaged source cleanup failed: ${sourcePath} (${cleanupError.message})`
      );
    }
    return result;
  } catch (error) {
    return await finishFailedTransaction(transaction, deps, error);
  } finally {
    activeTargets.delete(targetPath);
  }
}

export function parseCliArguments(argv) {
  if (argv.length > 0) {
    throw new Error('app:update always uses the fixed local PreVision path and does not accept path overrides.');
  }
  return {};
}

if (process.argv[1] && path.resolve(process.argv[1]) === SCRIPT_PATH) {
  try {
    const result = await runUpdate(parseCliArguments(process.argv.slice(2)));
    console.log(`Installed PreVision ${result.version || ''} at ${result.targetPath}`.replace('  ', ' '));
    console.log(`Delivery source ${result.sourceCommit.slice(0, 7)} (${result.sourceBranch})`);
    if (result.cleanupWarning) console.warn(result.cleanupWarning);
  } catch (error) {
    console.error(`PreVision local update failed: ${error.message}`);
    process.exitCode = 1;
  }
}
