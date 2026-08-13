import crypto from 'node:crypto';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  LatestPreviewError,
  atomicWriteFile,
  launcherPaths,
  loadLauncherPolicy,
  readPreviewPointer,
  validatePublishedPreview
} from './latest-preview-launcher-runtime.mjs';
import {
  DEPLOYMENT_MANIFEST_PATH,
  buildWeb,
  createRequestHandler,
  loadDeployment,
  validateContract,
  validateRelativePath
} from './web-runtime-lib.mjs';

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const SCRIPT_DIRECTORY = path.dirname(SCRIPT_PATH);
const SHA256_PATTERN = /^[0-9a-f]{64}$/;
const COMMIT_PATTERN = /^[0-9a-f]{40}$/;
const SNAPSHOT_NAME_PATTERN = /^[0-9a-f]{40}-[0-9a-f]{16}-[0-9a-f]{16}$/;
const VERSION_NAME_PATTERN = /^[0-9a-f]{40}-[0-9a-f]{16}$/;
const SAFE_ERROR_CODE_PATTERN = /^[A-Z0-9_]{3,100}$/;
const IPV4_PATTERN = /^(?:0|[1-9][0-9]{0,2})(?:\.(?:0|[1-9][0-9]{0,2})){3}$/;

export class LatestPreviewLanError extends Error {
  constructor(code, details = {}) {
    super(code);
    this.name = 'LatestPreviewLanError';
    this.code = code;
    this.details = details;
  }
}

function fail(code, details = {}) {
  throw new LatestPreviewLanError(code, details);
}

export function requireNonRootCurrentUid(getUid = process.getuid, getEffectiveUid = process.geteuid) {
  const uid = typeof getUid === 'function' ? getUid.call(process) : null;
  const effectiveUid = typeof getEffectiveUid === 'function' ? getEffectiveUid.call(process) : uid;
  if (!Number.isInteger(uid) || uid <= 0 || effectiveUid !== uid) {
    fail(uid === 0 ? 'LAN_ROOT_EXECUTION_FORBIDDEN' : 'LAN_CURRENT_UID_INVALID');
  }
  return uid;
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function requireExactKeys(value, expected, label) {
  if (!isPlainObject(value)) fail('LAN_INVALID_OBJECT', { label });
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  if (JSON.stringify(actual) !== JSON.stringify(wanted)) {
    fail('LAN_UNEXPECTED_FIELDS', { label });
  }
}

function requireString(value, label, { maximum = 4096, pattern = null } = {}) {
  if (typeof value !== 'string' || !value || value.length > maximum ||
      /[\u0000-\u001f\u007f]/u.test(value) || (pattern && !pattern.test(value))) {
    fail('LAN_INVALID_STRING', { label });
  }
  return value;
}

function requireSafeName(value, label) {
  const normalized = requireString(value, label, { maximum: 128 });
  if (normalized.includes('/') || normalized.includes('\\') || normalized === '.' || normalized === '..') {
    fail('LAN_INVALID_NAME', { label });
  }
  return normalized;
}

function requireInteger(value, label, minimum, maximum) {
  if (!Number.isInteger(value) || value < minimum || value > maximum) {
    fail('LAN_INVALID_INTEGER', { label });
  }
  return value;
}

async function readSecureJson(filePath, label, maximumBytes = 1024 * 1024) {
  const expectedUid = requireNonRootCurrentUid();
  let handle;
  try {
    handle = await fsp.open(
      filePath,
      fs.constants.O_RDONLY |
        (fs.constants.O_NOFOLLOW || 0) |
        (fs.constants.O_NONBLOCK || 0)
    );
  } catch (error) {
    if (error.code === 'ENOENT') fail('LAN_FILE_MISSING', { label });
    fail('LAN_FILE_OPEN_FAILED', { label, error: error.code || 'unknown' });
  }
  try {
    const stat = await handle.stat();
    if (!stat.isFile()) fail('LAN_FILE_TYPE_INVALID', { label });
    if (stat.uid !== expectedUid) fail('LAN_FILE_OWNER_INVALID', { label });
    if ((stat.mode & 0o777) !== 0o600) fail('LAN_FILE_MODE_INVALID', { label });
    if (stat.size <= 0 || stat.size > maximumBytes) fail('LAN_FILE_SIZE_INVALID', { label });
    const contents = await handle.readFile({ encoding: 'utf8' });
    try {
      return JSON.parse(contents);
    } catch {
      fail('LAN_JSON_INVALID', { label });
    }
  } finally {
    await handle.close().catch(() => {});
  }
}

async function ensurePrivateDirectory(directoryPath, label, { create = false } = {}) {
  const expectedUid = requireNonRootCurrentUid();
  try {
    const stat = await fsp.lstat(directoryPath);
    if (!stat.isDirectory() || stat.isSymbolicLink()) fail('LAN_DIRECTORY_TYPE_INVALID', { label });
    if (stat.uid !== expectedUid) fail('LAN_DIRECTORY_OWNER_INVALID', { label });
    if ((stat.mode & 0o077) !== 0) fail('LAN_DIRECTORY_MODE_INVALID', { label });
  } catch (error) {
    if (!(error instanceof LatestPreviewLanError) && error.code === 'ENOENT' && create) {
      await fsp.mkdir(directoryPath, { recursive: true, mode: 0o700 });
      await fsp.chmod(directoryPath, 0o700);
      return;
    }
    throw error;
  }
}

async function fsyncDirectory(directoryPath) {
  const handle = await fsp.open(directoryPath, 'r');
  try {
    await handle.sync();
  } finally {
    await handle.close();
  }
}

async function fsyncTree(rootDirectory) {
  const entries = await fsp.readdir(rootDirectory, { withFileTypes: true });
  for (const entry of entries) {
    const absolute = path.join(rootDirectory, entry.name);
    const stat = await fsp.lstat(absolute);
    if (stat.isSymbolicLink()) fail('LAN_SNAPSHOT_SYMLINK_FORBIDDEN');
    if (stat.isDirectory()) {
      await fsyncTree(absolute);
      await fsyncDirectory(absolute);
    } else if (stat.isFile()) {
      const handle = await fsp.open(absolute, 'r');
      try {
        await handle.sync();
      } finally {
        await handle.close();
      }
    } else {
      fail('LAN_SNAPSHOT_SPECIAL_FILE_FORBIDDEN');
    }
  }
  await fsyncDirectory(rootDirectory);
}

function sha256Bytes(bytes) {
  return crypto.createHash('sha256').update(bytes).digest('hex');
}

async function sha256File(filePath) {
  const handle = await fsp.open(
    filePath,
    fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW || 0) | (fs.constants.O_NONBLOCK || 0)
  );
  try {
    const stat = await handle.stat();
    if (!stat.isFile()) fail('LAN_FILE_TYPE_INVALID', { label: 'hash source' });
    return sha256Bytes(await handle.readFile());
  } finally {
    await handle.close();
  }
}

export async function loadLanPolicy(policyPath = path.join(
  SCRIPT_DIRECTORY,
  '..',
  'qa',
  'latest-preview-lan-policy.json'
)) {
  let policy;
  try {
    policy = JSON.parse(await fsp.readFile(policyPath, 'utf8'));
  } catch {
    fail('LAN_POLICY_INVALID');
  }
  requireExactKeys(policy, ['schemaVersion', 'service', 'snapshot', 'network', 'source'], 'policy');
  if (policy.schemaVersion !== 1) fail('LAN_POLICY_VERSION_UNSUPPORTED');
  requireExactKeys(policy.service, [
    'label',
    'supportDirectoryName',
    'versionsDirectoryName',
    'activeFileName',
    'readyFileName',
    'stateFileName',
    'loaderFileName',
    'port',
    'healthPath',
    'refreshIntervalMilliseconds',
    'networkCheckIntervalMilliseconds',
    'shutdownGraceMilliseconds'
  ], 'policy.service');
  requireString(policy.service.label, 'policy.service.label', {
    maximum: 100,
    pattern: /^[a-z0-9][a-z0-9.-]+$/
  });
  for (const key of [
    'supportDirectoryName',
    'versionsDirectoryName',
    'activeFileName',
    'readyFileName',
    'stateFileName',
    'loaderFileName'
  ]) {
    requireSafeName(policy.service[key], `policy.service.${key}`);
  }
  requireInteger(policy.service.port, 'policy.service.port', 1024, 65535);
  if (typeof policy.service.healthPath !== 'string' ||
      !/^\/__[a-z0-9/-]+$/.test(policy.service.healthPath)) {
    fail('LAN_POLICY_HEALTH_PATH_INVALID');
  }
  requireInteger(
    policy.service.refreshIntervalMilliseconds,
    'policy.service.refreshIntervalMilliseconds',
    500,
    60000
  );
  requireInteger(
    policy.service.networkCheckIntervalMilliseconds,
    'policy.service.networkCheckIntervalMilliseconds',
    1000,
    60000
  );
  requireInteger(
    policy.service.shutdownGraceMilliseconds,
    'policy.service.shutdownGraceMilliseconds',
    500,
    30000
  );

  requireExactKeys(policy.snapshot, [
    'schemaVersion',
    'stagingDirectoryName',
    'snapshotsDirectoryName',
    'metadataFileName',
    'maximumGitOutputBytes',
    'maximumPointerBytes',
    'retainedReadySnapshots'
  ], 'policy.snapshot');
  if (policy.snapshot.schemaVersion !== 1) fail('LAN_SNAPSHOT_POLICY_VERSION_UNSUPPORTED');
  for (const key of ['stagingDirectoryName', 'snapshotsDirectoryName', 'metadataFileName']) {
    requireSafeName(policy.snapshot[key], `policy.snapshot.${key}`);
  }
  requireInteger(policy.snapshot.maximumGitOutputBytes, 'policy.snapshot.maximumGitOutputBytes', 1024, 256 * 1024 * 1024);
  requireInteger(policy.snapshot.maximumPointerBytes, 'policy.snapshot.maximumPointerBytes', 1024, 1024 * 1024);
  requireInteger(policy.snapshot.retainedReadySnapshots, 'policy.snapshot.retainedReadySnapshots', 2, 4);

  requireExactKeys(policy.network, [
    'physicalInterfacePattern',
    'rejectedInterfacePrefixes',
    'hostnameSuffix',
    'privateIpv4Ranges'
  ], 'policy.network');
  requireString(policy.network.physicalInterfacePattern, 'policy.network.physicalInterfacePattern', { maximum: 100 });
  try {
    new RegExp(policy.network.physicalInterfacePattern);
  } catch {
    fail('LAN_POLICY_INTERFACE_PATTERN_INVALID');
  }
  if (!Array.isArray(policy.network.rejectedInterfacePrefixes) ||
      !policy.network.rejectedInterfacePrefixes.length ||
      policy.network.rejectedInterfacePrefixes.some(value =>
        typeof value !== 'string' || !/^[a-z0-9]+$/.test(value))) {
    fail('LAN_POLICY_REJECTED_INTERFACES_INVALID');
  }
  if (policy.network.hostnameSuffix !== '.local') fail('LAN_POLICY_HOSTNAME_SUFFIX_INVALID');
  if (JSON.stringify(policy.network.privateIpv4Ranges) !==
      JSON.stringify(['10.0.0.0/8', '172.16.0.0/12', '192.168.0.0/16'])) {
    fail('LAN_POLICY_PRIVATE_RANGES_INVALID');
  }

  requireExactKeys(policy.source, [
    'launcherPolicyRelativePath',
    'webContractRelativePath',
    'installedResources'
  ], 'policy.source');
  validateRelativePath(policy.source.launcherPolicyRelativePath, 'launcherPolicyRelativePath');
  validateRelativePath(policy.source.webContractRelativePath, 'webContractRelativePath');
  if (!Array.isArray(policy.source.installedResources) || !policy.source.installedResources.length) {
    fail('LAN_POLICY_RESOURCES_INVALID');
  }
  const uniqueResources = new Set();
  for (const resource of policy.source.installedResources) {
    validateRelativePath(resource, 'installed resource');
    if (uniqueResources.has(resource)) fail('LAN_POLICY_RESOURCES_INVALID');
    uniqueResources.add(resource);
  }
  return policy;
}

export function lanServicePaths(homeDirectory, launcherPolicy, lanPolicy) {
  const launcher = launcherPaths(homeDirectory, launcherPolicy);
  const root = path.join(launcher.supportRoot, lanPolicy.service.supportDirectoryName);
  return {
    launcherSupportRoot: launcher.supportRoot,
    pointerPath: launcher.pointerPath,
    root,
    versionsRoot: path.join(root, lanPolicy.service.versionsDirectoryName),
    activePath: path.join(root, lanPolicy.service.activeFileName),
    readyPath: path.join(root, lanPolicy.service.readyFileName),
    statePath: path.join(root, lanPolicy.service.stateFileName),
    loaderPath: path.join(root, lanPolicy.service.loaderFileName),
    stagingRoot: path.join(root, lanPolicy.snapshot.stagingDirectoryName),
    snapshotsRoot: path.join(root, lanPolicy.snapshot.snapshotsDirectoryName),
    launchAgentPath: path.join(
      homeDirectory,
      'Library',
      'LaunchAgents',
      `${lanPolicy.service.label}.plist`
    )
  };
}

function git(worktreePath, argumentsList, policy, { encoding = null } = {}) {
  try {
    return execFileSync('/usr/bin/git', ['-C', worktreePath, ...argumentsList], {
      encoding,
      maxBuffer: policy.snapshot.maximumGitOutputBytes,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: {
        ...process.env,
        GIT_NO_REPLACE_OBJECTS: '1',
        LC_ALL: 'C',
        LANG: 'C'
      }
    });
  } catch (error) {
    fail('LAN_GIT_OPERATION_FAILED', {
      operation: argumentsList[0] || 'unknown',
      status: error.status ?? 'unknown'
    });
  }
}

function parseTreeRecords(bytes) {
  if (!Buffer.isBuffer(bytes)) fail('LAN_GIT_TREE_OUTPUT_INVALID');
  const records = [];
  for (const rawRecord of bytes.toString('utf8').split('\0')) {
    if (!rawRecord) continue;
    const separator = rawRecord.indexOf('\t');
    if (separator < 0) fail('LAN_GIT_TREE_OUTPUT_INVALID');
    const header = rawRecord.slice(0, separator);
    const relativePath = rawRecord.slice(separator + 1);
    const match = header.match(/^(100644|100755) blob ([0-9a-f]{40,64})$/);
    if (!match) fail('LAN_GIT_TREE_ENTRY_UNSAFE');
    validateRelativePath(relativePath, 'Git tree path');
    records.push({ mode: match[1], objectId: match[2], relativePath });
  }
  return records;
}

function exactBlobRecord(worktreePath, commit, relativePath, policy) {
  const records = parseTreeRecords(git(
    worktreePath,
    ['ls-tree', '-z', '--full-tree', commit, '--', relativePath],
    policy
  ));
  if (records.length !== 1 || records[0].relativePath !== relativePath) {
    fail('LAN_GIT_REQUIRED_BLOB_MISSING', { label: relativePath });
  }
  return records[0];
}

function gitBlob(worktreePath, objectId, policy) {
  return git(worktreePath, ['cat-file', 'blob', objectId], policy);
}

async function writePrivateBlob(root, record, bytes) {
  const absolute = path.join(root, ...record.relativePath.split('/'));
  const relation = path.relative(root, absolute);
  if (!relation || relation.startsWith('..') || path.isAbsolute(relation)) fail('LAN_MATERIALIZE_PATH_ESCAPE');
  await fsp.mkdir(path.dirname(absolute), { recursive: true, mode: 0o700 });
  const handle = await fsp.open(absolute, 'wx', 0o600);
  try {
    await handle.writeFile(bytes);
    await handle.sync();
  } finally {
    await handle.close();
  }
}

async function materializeWebInputs({ pointer, policy, transactionRoot }) {
  const worktreePath = pointer.worktreePath;
  const commit = pointer.sourceCommit;
  const contractPath = policy.source.webContractRelativePath;
  const contractRecord = exactBlobRecord(worktreePath, commit, contractPath, policy);
  const contractBytes = gitBlob(worktreePath, contractRecord.objectId, policy);
  let contract;
  try {
    contract = validateContract(JSON.parse(contractBytes.toString('utf8')));
  } catch (error) {
    fail('LAN_WEB_CONTRACT_INVALID', { error: error.message });
  }
  const records = new Map([[contractPath, { record: contractRecord, bytes: contractBytes }]]);
  for (const relativePath of [
    contract.director.source,
    ...contract.requiredFiles.map(item => item.source)
  ]) {
    const record = exactBlobRecord(worktreePath, commit, relativePath, policy);
    records.set(relativePath, { record, bytes: gitBlob(worktreePath, record.objectId, policy) });
  }
  const homePrefix = `${contract.home.sourceDirectory}/`;
  const homeRecords = parseTreeRecords(git(
    worktreePath,
    ['ls-tree', '-r', '-z', '--full-tree', commit, '--', contract.home.sourceDirectory],
    policy
  ));
  for (const record of homeRecords) {
    if (!record.relativePath.startsWith(homePrefix)) fail('LAN_HOME_TREE_SCOPE_INVALID');
    records.set(record.relativePath, {
      record,
      bytes: gitBlob(worktreePath, record.objectId, policy)
    });
  }
  const generated = records.get(pointer.source.generatedHtmlRelativePath);
  if (!generated || sha256Bytes(generated.bytes) !== pointer.source.generatedHtmlSha256) {
    fail('LAN_POINTER_GENERATED_HTML_MISMATCH');
  }
  const materializedRoot = path.join(transactionRoot, 'Source');
  await fsp.mkdir(materializedRoot, { recursive: false, mode: 0o700 });
  for (const [relativePath, item] of [...records.entries()].sort(([left], [right]) =>
    left === right ? 0 : left < right ? -1 : 1)) {
    if (item.record.relativePath !== relativePath) fail('LAN_MATERIALIZE_RECORD_MISMATCH');
    await writePrivateBlob(materializedRoot, item.record, item.bytes);
  }
  return { materializedRoot, contract };
}

function pointerFingerprint(pointer) {
  return sha256Bytes(Buffer.from(JSON.stringify(pointer)));
}

function snapshotMetadata(pointer, fingerprint, snapshotName, manifestSha256) {
  return {
    schemaVersion: 1,
    snapshotName,
    sourceCommit: pointer.sourceCommit,
    pointerFingerprint: fingerprint,
    manifestSha256,
    builtAt: new Date().toISOString()
  };
}

function validateSnapshotMetadata(metadata, policy) {
  requireExactKeys(metadata, [
    'schemaVersion',
    'snapshotName',
    'sourceCommit',
    'pointerFingerprint',
    'manifestSha256',
    'builtAt'
  ], 'snapshot metadata');
  if (metadata.schemaVersion !== policy.snapshot.schemaVersion ||
      !SNAPSHOT_NAME_PATTERN.test(metadata.snapshotName) ||
      !COMMIT_PATTERN.test(metadata.sourceCommit) ||
      !SHA256_PATTERN.test(metadata.pointerFingerprint) ||
      !SHA256_PATTERN.test(metadata.manifestSha256) ||
      !Number.isFinite(Date.parse(metadata.builtAt))) {
    fail('LAN_SNAPSHOT_METADATA_INVALID');
  }
  return metadata;
}

function validateReadyRecord(ready, policy) {
  requireExactKeys(ready, [
    'schemaVersion',
    'snapshotName',
    'sourceCommit',
    'pointerFingerprint',
    'manifestSha256',
    'updatedAt'
  ], 'ready record');
  if (ready.schemaVersion !== policy.snapshot.schemaVersion ||
      !SNAPSHOT_NAME_PATTERN.test(ready.snapshotName) ||
      !COMMIT_PATTERN.test(ready.sourceCommit) ||
      !SHA256_PATTERN.test(ready.pointerFingerprint) ||
      !SHA256_PATTERN.test(ready.manifestSha256) ||
      !Number.isFinite(Date.parse(ready.updatedAt))) {
    fail('LAN_READY_RECORD_INVALID');
  }
  return ready;
}

async function loadSnapshot(paths, policy, expected) {
  const snapshotRoot = path.join(paths.snapshotsRoot, expected.snapshotName);
  const relation = path.relative(paths.snapshotsRoot, snapshotRoot);
  if (!relation || relation.startsWith('..') || path.isAbsolute(relation)) fail('LAN_SNAPSHOT_PATH_ESCAPE');
  await ensurePrivateDirectory(snapshotRoot, 'snapshot root');
  const metadata = validateSnapshotMetadata(await readSecureJson(
    path.join(snapshotRoot, policy.snapshot.metadataFileName),
    'snapshot metadata',
    64 * 1024
  ), policy);
  for (const key of ['snapshotName', 'sourceCommit', 'pointerFingerprint', 'manifestSha256']) {
    if (metadata[key] !== expected[key]) fail('LAN_SNAPSHOT_READY_MISMATCH', { field: key });
  }
  const webRoot = path.join(snapshotRoot, 'web');
  const deployment = await loadDeployment(webRoot);
  const expectedUid = requireNonRootCurrentUid();
  for (const file of deployment.files.values()) {
    const stat = await fsp.lstat(file.absolute);
    if (!stat.isFile() || stat.isSymbolicLink() || stat.uid !== expectedUid) {
      fail('LAN_SNAPSHOT_FILE_INVALID');
    }
  }
  const actualManifestSha256 = await sha256File(path.join(webRoot, DEPLOYMENT_MANIFEST_PATH));
  if (actualManifestSha256 !== metadata.manifestSha256) fail('LAN_SNAPSHOT_MANIFEST_MISMATCH');
  return { snapshotRoot, webRoot, metadata, deployment };
}

export async function buildSnapshot({ pointer, fingerprint, paths, policy }) {
  const transactionRoot = await fsp.mkdtemp(path.join(paths.stagingRoot, '.build-'));
  await fsp.chmod(transactionRoot, 0o700);
  let committed = false;
  try {
    const { materializedRoot } = await materializeWebInputs({
      pointer,
      policy,
      transactionRoot
    });
    const built = await buildWeb({
      repositoryRoot: materializedRoot,
      contractPath: policy.source.webContractRelativePath,
      outputDirectory: 'dist/web'
    });
    await loadDeployment(built.outputDirectory);
    const manifestSha256 = await sha256File(path.join(
      built.outputDirectory,
      DEPLOYMENT_MANIFEST_PATH
    ));
    const snapshotName = `${pointer.sourceCommit}-${manifestSha256.slice(0, 16)}-${fingerprint.slice(0, 16)}`;
    if (!SNAPSHOT_NAME_PATTERN.test(snapshotName)) fail('LAN_SNAPSHOT_NAME_INVALID');
    const finalRoot = path.join(paths.snapshotsRoot, snapshotName);
    const existing = await fsp.lstat(finalRoot).catch(error => {
      if (error.code === 'ENOENT') return null;
      throw error;
    });
    if (existing) {
      const loaded = await loadSnapshot(paths, policy, {
        snapshotName,
        sourceCommit: pointer.sourceCommit,
        pointerFingerprint: fingerprint,
        manifestSha256
      });
      await fsp.rm(transactionRoot, { recursive: true, force: true });
      committed = true;
      return loaded;
    }
    const stagedSnapshot = path.join(transactionRoot, 'Snapshot');
    await fsp.mkdir(stagedSnapshot, { mode: 0o700 });
    await fsp.rename(built.outputDirectory, path.join(stagedSnapshot, 'web'));
    const metadata = snapshotMetadata(pointer, fingerprint, snapshotName, manifestSha256);
    await atomicWriteFile(
      path.join(stagedSnapshot, policy.snapshot.metadataFileName),
      `${JSON.stringify(metadata, null, 2)}\n`,
      { mode: 0o600 }
    );
    await fsyncTree(stagedSnapshot);
    await fsp.rename(stagedSnapshot, finalRoot);
    await fsyncDirectory(paths.snapshotsRoot);
    const deployment = await loadDeployment(path.join(finalRoot, 'web'));
    committed = true;
    await fsp.rm(transactionRoot, { recursive: true, force: true });
    return { snapshotRoot: finalRoot, webRoot: path.join(finalRoot, 'web'), metadata, deployment };
  } finally {
    if (!committed) {
      await fsp.rm(transactionRoot, { recursive: true, force: true }).catch(() => {});
    }
  }
}

async function cleanupSnapshots(paths, policy, keepNames) {
  const keep = new Set(keepNames.filter(Boolean));
  const entries = await fsp.readdir(paths.snapshotsRoot, { withFileTypes: true });
  const removable = [];
  for (const entry of entries) {
    if (!SNAPSHOT_NAME_PATTERN.test(entry.name) || keep.has(entry.name)) continue;
    const absolute = path.join(paths.snapshotsRoot, entry.name);
    const stat = await fsp.lstat(absolute).catch(() => null);
    if (!stat?.isDirectory() || stat.isSymbolicLink()) continue;
    try {
      const metadata = validateSnapshotMetadata(await readSecureJson(
        path.join(absolute, policy.snapshot.metadataFileName),
        'snapshot cleanup metadata',
        64 * 1024
      ), policy);
      if (metadata.snapshotName === entry.name) removable.push(absolute);
    } catch {
      // Unknown or damaged entries remain untouched for manual inspection.
    }
  }
  for (const absolute of removable) {
    await fsp.rm(absolute, { recursive: true, force: false });
  }
  if (removable.length) await fsyncDirectory(paths.snapshotsRoot);
}

function publicErrorCode(error) {
  const candidate = error instanceof LatestPreviewLanError || error instanceof LatestPreviewError
    ? error.code
    : 'LAN_UNEXPECTED_FAILURE';
  return SAFE_ERROR_CODE_PATTERN.test(candidate || '') ? candidate : 'LAN_UNEXPECTED_FAILURE';
}

function safeServiceState({
  status,
  network = null,
  targetCommit = null,
  readyCommit = null,
  errorCode = null,
  pid = process.pid
}) {
  return {
    schemaVersion: 1,
    status,
    pid,
    hostname: network?.hostname || null,
    address: network?.address || null,
    port: network?.port || null,
    targetCommit: COMMIT_PATTERN.test(targetCommit || '') ? targetCommit : null,
    readyCommit: COMMIT_PATTERN.test(readyCommit || '') ? readyCommit : null,
    errorCode: errorCode && SAFE_ERROR_CODE_PATTERN.test(errorCode) ? errorCode : null,
    updatedAt: new Date().toISOString()
  };
}

export class LatestPreviewSnapshotManager {
  constructor({
    paths,
    lanPolicy,
    launcherPolicy,
    network = null,
    pointerReader = null,
    sourceValidator = validatePublishedPreview,
    snapshotBuilder = buildSnapshot
  }) {
    this.paths = paths;
    this.lanPolicy = lanPolicy;
    this.launcherPolicy = launcherPolicy;
    this.network = network;
    this.pointerReader = pointerReader;
    this.sourceValidator = sourceValidator;
    this.snapshotBuilder = snapshotBuilder;
    this.active = null;
    this.invalidSnapshotName = null;
    this.refreshPromise = null;
    this.verificationPromise = null;
    this.lastState = safeServiceState({ status: 'starting', network });
  }

  async initialize() {
    await ensurePrivateDirectory(this.paths.launcherSupportRoot, 'launcher support root');
    await ensurePrivateDirectory(this.paths.root, 'LAN service root', { create: true });
    await ensurePrivateDirectory(this.paths.stagingRoot, 'LAN staging root', { create: true });
    await ensurePrivateDirectory(this.paths.snapshotsRoot, 'LAN snapshots root', { create: true });
    await this.writeState(this.lastState);
  }

  async writeState(state) {
    this.lastState = state;
    await atomicWriteFile(this.paths.statePath, `${JSON.stringify(state, null, 2)}\n`, { mode: 0o600 });
  }

  async readTargetPointer() {
    const pointer = this.pointerReader
      ? await this.pointerReader()
      : await readPreviewPointer(this.paths.pointerPath, this.launcherPolicy);
    return { pointer, fingerprint: pointerFingerprint(pointer) };
  }

  async loadReadyIfCurrent(pointer, fingerprint) {
    let ready;
    try {
      ready = validateReadyRecord(await readSecureJson(
        this.paths.readyPath,
        'LAN ready pointer',
        64 * 1024
      ), this.lanPolicy);
    } catch (error) {
      if (error instanceof LatestPreviewLanError && error.code === 'LAN_FILE_MISSING') return null;
      throw error;
    }
    if (ready.sourceCommit !== pointer.sourceCommit || ready.pointerFingerprint !== fingerprint) return null;
    if (ready.snapshotName === this.invalidSnapshotName) return null;
    return loadSnapshot(this.paths, this.lanPolicy, ready);
  }

  async invalidateActive(error, target = null) {
    const invalid = this.active;
    this.active = null;
    if (invalid?.metadata?.snapshotName) this.invalidSnapshotName = invalid.metadata.snapshotName;
    await this.writeState(safeServiceState({
      status: 'error',
      network: this.network,
      targetCommit: target?.pointer?.sourceCommit || invalid?.metadata?.sourceCommit || null,
      readyCommit: null,
      errorCode: publicErrorCode(error)
    })).catch(() => {});
  }

  async verifyActive(target) {
    const candidate = this.active;
    if (!candidate) return null;
    if (candidate.metadata.pointerFingerprint !== target.fingerprint ||
        candidate.metadata.sourceCommit !== target.pointer.sourceCommit) {
      return null;
    }
    if (!this.verificationPromise) {
      this.verificationPromise = (async () => {
        const manifest = candidate.deployment.files.get(DEPLOYMENT_MANIFEST_PATH);
        if (!manifest || !Number.isInteger(manifest.size) || manifest.size <= 0) {
          fail('LAN_ACTIVE_MANIFEST_RECORD_INVALID');
        }
        const manifestPath = path.join(candidate.webRoot, DEPLOYMENT_MANIFEST_PATH);
        const stat = await fsp.lstat(manifestPath);
        if (!stat.isFile() || stat.isSymbolicLink() || stat.size !== manifest.size ||
            stat.uid !== requireNonRootCurrentUid()) {
          fail('LAN_ACTIVE_MANIFEST_INVALID');
        }
        return loadSnapshot(this.paths, this.lanPolicy, candidate.metadata);
      })().finally(() => {
        this.verificationPromise = null;
      });
    }
    try {
      const verified = await this.verificationPromise;
      if (this.active === candidate) this.active = verified;
      return verified;
    } catch (error) {
      if (this.active === candidate) await this.invalidateActive(error, target);
      throw error;
    }
  }

  async refresh(pointer, fingerprint) {
    await this.writeState(safeServiceState({
      status: 'building',
      network: this.network,
      targetCommit: pointer.sourceCommit,
      readyCommit: this.active?.metadata.sourceCommit || null
    }));
    const validated = await this.sourceValidator({ pointer, policy: this.launcherPolicy });
    const buildPointer = validated?.inspection?.worktreePath
      ? { ...pointer, worktreePath: validated.inspection.worktreePath }
      : pointer;
    const snapshot = await this.snapshotBuilder({
      pointer: buildPointer,
      fingerprint,
      paths: this.paths,
      policy: this.lanPolicy
    });
    const current = await this.readTargetPointer();
    if (current.fingerprint !== fingerprint) fail('LAN_POINTER_CHANGED_DURING_BUILD');
    let previousName = this.active?.metadata.snapshotName || null;
    if (!previousName) {
      try {
        previousName = validateReadyRecord(await readSecureJson(
          this.paths.readyPath,
          'previous LAN ready pointer',
          64 * 1024
        ), this.lanPolicy).snapshotName;
      } catch {
        previousName = null;
      }
    }
    const ready = {
      schemaVersion: this.lanPolicy.snapshot.schemaVersion,
      snapshotName: snapshot.metadata.snapshotName,
      sourceCommit: snapshot.metadata.sourceCommit,
      pointerFingerprint: snapshot.metadata.pointerFingerprint,
      manifestSha256: snapshot.metadata.manifestSha256,
      updatedAt: new Date().toISOString()
    };
    await atomicWriteFile(this.paths.readyPath, `${JSON.stringify(ready, null, 2)}\n`, { mode: 0o600 });
    this.active = snapshot;
    this.invalidSnapshotName = null;
    await this.writeState(safeServiceState({
      status: 'ready',
      network: this.network,
      targetCommit: pointer.sourceCommit,
      readyCommit: snapshot.metadata.sourceCommit
    }));
    await cleanupSnapshots(this.paths, this.lanPolicy, [
      snapshot.metadata.snapshotName,
      previousName
    ]).catch(() => {});
    return snapshot;
  }

  async ensureCurrent() {
    let target;
    try {
      target = await this.readTargetPointer();
      if (this.active) {
        const verified = await this.verifyActive(target);
        if (verified) return verified;
      }
      if (!this.active) {
        const ready = await this.loadReadyIfCurrent(target.pointer, target.fingerprint);
        if (ready) {
          this.active = ready;
          await this.writeState(safeServiceState({
            status: 'ready',
            network: this.network,
            targetCommit: target.pointer.sourceCommit,
            readyCommit: ready.metadata.sourceCommit
          }));
          return ready;
        }
      }
      if (!this.refreshPromise) {
        this.refreshPromise = this.refresh(target.pointer, target.fingerprint)
          .finally(() => {
            this.refreshPromise = null;
          });
      }
      return await this.refreshPromise;
    } catch (error) {
      await this.writeState(safeServiceState({
        status: 'error',
        network: this.network,
        targetCommit: target?.pointer?.sourceCommit || null,
        readyCommit: this.active?.metadata.sourceCommit || null,
        errorCode: publicErrorCode(error)
      })).catch(() => {});
      return null;
    }
  }
}

function ipv4ToInteger(value) {
  if (!IPV4_PATTERN.test(value)) fail('LAN_IPV4_INVALID');
  const octets = value.split('.').map(Number);
  if (octets.some(octet => octet < 0 || octet > 255)) fail('LAN_IPV4_INVALID');
  return octets.reduce((result, octet) => ((result << 8) | octet) >>> 0, 0);
}

function isPrivateIpv4(value) {
  const numeric = ipv4ToInteger(value);
  return ((numeric & 0xff000000) >>> 0) === 0x0a000000 ||
    ((numeric & 0xfff00000) >>> 0) === 0xac100000 ||
    ((numeric & 0xffff0000) >>> 0) === 0xc0a80000;
}

function normalizeRemoteAddress(value) {
  if (typeof value !== 'string') return '';
  return value.startsWith('::ffff:') ? value.slice('::ffff:'.length) : value;
}

function defaultRouteInterface() {
  let output;
  try {
    output = execFileSync('/sbin/route', ['-n', 'get', 'default'], {
      encoding: 'utf8',
      maxBuffer: 1024 * 1024,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, LC_ALL: 'C', LANG: 'C' }
    });
  } catch {
    fail('LAN_DEFAULT_ROUTE_UNAVAILABLE');
  }
  const matches = [...output.matchAll(/^\s*interface:\s*(\S+)\s*$/gm)].map(match => match[1]);
  if (matches.length !== 1) fail('LAN_DEFAULT_ROUTE_AMBIGUOUS');
  return matches[0];
}

function localHostname(suffix) {
  let value;
  try {
    value = execFileSync('/usr/sbin/scutil', ['--get', 'LocalHostName'], {
      encoding: 'utf8',
      maxBuffer: 1024 * 1024,
      stdio: ['ignore', 'pipe', 'ignore']
    }).trim();
  } catch {
    fail('LAN_LOCAL_HOSTNAME_UNAVAILABLE');
  }
  if (!/^[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?$/.test(value)) {
    fail('LAN_LOCAL_HOSTNAME_INVALID');
  }
  return `${value}${suffix}`;
}

export function selectPhysicalLanNetwork(lanPolicy, {
  networkInterfaces = os.networkInterfaces(),
  routeInterface = defaultRouteInterface(),
  hostname = localHostname(lanPolicy.network.hostnameSuffix)
} = {}) {
  const interfacePattern = new RegExp(lanPolicy.network.physicalInterfacePattern);
  const rejected = lanPolicy.network.rejectedInterfacePrefixes;
  if (!interfacePattern.test(routeInterface) ||
      rejected.some(prefix => routeInterface.toLowerCase().startsWith(prefix))) {
    fail('LAN_DEFAULT_ROUTE_NOT_PHYSICAL');
  }
  const candidates = (networkInterfaces[routeInterface] || []).filter(item =>
    item &&
    item.family === 'IPv4' &&
    item.internal === false &&
    isPrivateIpv4(item.address) &&
    IPV4_PATTERN.test(item.netmask || '')
  );
  if (candidates.length !== 1) fail('LAN_PRIVATE_ADDRESS_AMBIGUOUS');
  const candidate = candidates[0];
  const mask = ipv4ToInteger(candidate.netmask);
  const inverse = (~mask) >>> 0;
  if ((inverse & (inverse + 1)) !== 0) fail('LAN_NETMASK_INVALID');
  const network = {
    interfaceName: routeInterface,
    address: candidate.address,
    netmask: candidate.netmask,
    hostname: hostname.toLowerCase(),
    port: lanPolicy.service.port,
    allowedHosts: [hostname.toLowerCase(), candidate.address]
  };
  return Object.freeze({
    ...network,
    allowedHosts: Object.freeze([...network.allowedHosts])
  });
}

export function networkStillMatches(network, networkInterfaces = os.networkInterfaces(), routeInterface = defaultRouteInterface()) {
  if (routeInterface !== network.interfaceName) return false;
  return (networkInterfaces[network.interfaceName] || []).some(item =>
    item?.family === 'IPv4' &&
    item.internal === false &&
    item.address === network.address &&
    item.netmask === network.netmask
  );
}

export function authorizeLanRequest(request, network) {
  const socket = request.socket;
  if (!socket || normalizeRemoteAddress(socket.localAddress) !== network.address ||
      socket.localPort !== network.port) {
    return false;
  }
  const remote = normalizeRemoteAddress(socket.remoteAddress);
  if (!IPV4_PATTERN.test(remote) || !isPrivateIpv4(remote)) return false;
  const mask = ipv4ToInteger(network.netmask);
  if (((ipv4ToInteger(remote) & mask) >>> 0) !== ((ipv4ToInteger(network.address) & mask) >>> 0)) {
    return false;
  }
  const host = String(request.headers.host || '');
  const match = host.match(/^([A-Za-z0-9.-]+):(\d{1,5})$/);
  return Boolean(match) &&
    Number(match[2]) === network.port &&
    network.allowedHosts.includes(match[1].toLowerCase());
}

function baseResponseHeaders(contentType) {
  return {
    'Content-Type': contentType,
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'no-referrer',
    'Cross-Origin-Opener-Policy': 'same-origin',
    'Cross-Origin-Resource-Policy': 'same-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), serial=()'
  };
}

function sendBody(response, method, statusCode, contentType, body) {
  const bytes = Buffer.isBuffer(body) ? body : Buffer.from(body);
  response.writeHead(statusCode, {
    ...baseResponseHeaders(contentType),
    'Content-Length': String(bytes.length)
  });
  if (method === 'HEAD') response.end();
  else response.end(bytes);
}

function healthPayload(manager) {
  const state = manager.lastState;
  return {
    schemaVersion: 1,
    status: state.status,
    sourceCommit: state.targetCommit,
    readyCommit: state.readyCommit,
    errorCode: state.errorCode,
    hostname: state.hostname,
    address: state.address,
    port: state.port,
    updatedAt: state.updatedAt
  };
}

export async function startLanPreviewService({
  homeDirectory = os.homedir(),
  resourcesDirectory = SCRIPT_DIRECTORY,
  lanPolicyPath = path.join(resourcesDirectory, 'latest-preview-lan-policy.json'),
  launcherPolicyPath = path.join(resourcesDirectory, 'latest-preview-launcher-policy.json'),
  networkOptions = {}
} = {}) {
  requireNonRootCurrentUid();
  const lanPolicy = await loadLanPolicy(lanPolicyPath);
  const launcherPolicy = await loadLauncherPolicy(launcherPolicyPath);
  const paths = lanServicePaths(homeDirectory, launcherPolicy, lanPolicy);
  const network = selectPhysicalLanNetwork(lanPolicy, networkOptions);
  const manager = new LatestPreviewSnapshotManager({
    paths,
    lanPolicy,
    launcherPolicy,
    network
  });
  await manager.initialize();
  await manager.ensureCurrent();

  let server;
  server = http.createServer((request, response) => {
    (async () => {
      const method = request.method || 'GET';
      if (!authorizeLanRequest(request, network)) {
        sendBody(response, method, 403, 'text/plain; charset=utf-8', 'Forbidden\n');
        return;
      }
      if (request.url?.split('?', 1)[0] === lanPolicy.service.healthPath) {
        await manager.ensureCurrent();
        sendBody(
          response,
          method,
          manager.lastState.status === 'ready' ? 200 : 503,
          'application/json; charset=utf-8',
          `${JSON.stringify(healthPayload(manager))}\n`
        );
        return;
      }
      const snapshot = await manager.ensureCurrent();
      if (!snapshot) {
        sendBody(response, method, 503, 'text/plain; charset=utf-8', 'Preview Unavailable\n');
        return;
      }
      const handler = createRequestHandler(snapshot.deployment, server, {
        allowedHosts: network.allowedHosts,
        deploymentFailureStatus: 503,
        onDeploymentFailure: error => manager.invalidateActive(error)
      });
      await handler(request, response);
    })().catch(() => {
      if (!response.headersSent) {
        sendBody(response, request.method || 'GET', 500, 'text/plain; charset=utf-8', 'Internal Server Error\n');
      } else {
        response.destroy();
      }
    });
  });
  await new Promise((resolve, reject) => {
    const onError = error => {
      server.off('listening', onListening);
      reject(error);
    };
    const onListening = () => {
      server.off('error', onError);
      resolve();
    };
    server.once('error', onError);
    server.once('listening', onListening);
    server.listen(network.port, network.address);
  });
  const address = server.address();
  if (!address || typeof address === 'string' ||
      address.address !== network.address ||
      address.port !== network.port) {
    await new Promise(resolve => server.close(resolve));
    fail('LAN_LISTENER_BIND_MISMATCH');
  }

  const refreshTimer = setInterval(() => {
    manager.ensureCurrent().catch(() => {});
  }, lanPolicy.service.refreshIntervalMilliseconds);
  refreshTimer.unref();
  let networkChanged = false;
  const networkTimer = setInterval(() => {
    try {
      if (networkStillMatches(network)) return;
    } catch {
      // Any uncertainty about the active route is treated as a network change.
    }
    if (networkChanged) return;
    networkChanged = true;
    manager.writeState(safeServiceState({
      status: 'error',
      network,
      targetCommit: manager.lastState.targetCommit,
      readyCommit: manager.lastState.readyCommit,
      errorCode: 'LAN_NETWORK_CHANGED_RESTART_REQUIRED'
    })).finally(() => {
      clearInterval(refreshTimer);
      server.close(() => {
        process.exitCode = 75;
      });
    });
  }, lanPolicy.service.networkCheckIntervalMilliseconds);
  networkTimer.unref();

  let closed = false;
  const close = async () => {
    if (closed) return;
    closed = true;
    clearInterval(refreshTimer);
    clearInterval(networkTimer);
    await new Promise((resolve, reject) => {
      server.close(error => error ? reject(error) : resolve());
    });
  };
  return {
    server,
    manager,
    network,
    lanPolicy,
    launcherPolicy,
    paths,
    origin: `http://${network.hostname}:${network.port}`,
    fallbackOrigin: `http://${network.address}:${network.port}`,
    close
  };
}

export function validateActiveVersion(active) {
  requireExactKeys(active, [
    'schemaVersion',
    'versionName',
    'sourceCommit',
    'installedAt',
    'nodeExecutable',
    'loaderSha256',
    'resources'
  ], 'active version');
  if (active.schemaVersion !== 2 ||
      !VERSION_NAME_PATTERN.test(active.versionName) ||
      !COMMIT_PATTERN.test(active.sourceCommit) ||
      !Number.isFinite(Date.parse(active.installedAt)) ||
      !path.isAbsolute(active.nodeExecutable) ||
      !SHA256_PATTERN.test(active.loaderSha256) ||
      !isPlainObject(active.resources)) {
    fail('LAN_ACTIVE_VERSION_INVALID');
  }
  for (const [relativePath, sha256] of Object.entries(active.resources)) {
    validateRelativePath(relativePath, 'active resource');
    if (!SHA256_PATTERN.test(sha256)) fail('LAN_ACTIVE_VERSION_INVALID');
  }
  return active;
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === SCRIPT_PATH;
if (isMain) {
  console.error('LAN_RUNTIME_LIBRARY_ONLY');
  process.exitCode = 64;
}
