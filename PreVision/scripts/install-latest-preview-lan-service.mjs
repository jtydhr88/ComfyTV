import crypto from 'node:crypto';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  LatestPreviewLanError,
  lanServicePaths,
  loadLanPolicy,
  requireNonRootCurrentUid,
  validateActiveVersion
} from './latest-preview-lan-runtime.mjs';
import {
  atomicWriteFile,
  loadLauncherPolicy
} from './latest-preview-launcher-runtime.mjs';

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(SCRIPT_PATH), '..');
const LAN_POLICY_PATH = path.join(ROOT, 'qa', 'latest-preview-lan-policy.json');
const LAUNCHER_POLICY_PATH = path.join(ROOT, 'qa', 'latest-preview-launcher-policy.json');
const COMMIT_PATTERN = /^[0-9a-f]{40}$/;
const SHA256_PATTERN = /^[0-9a-f]{64}$/;

function fail(code, details = {}) {
  throw new LatestPreviewLanError(code, details);
}

function xmlEscape(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

function git(argumentsList, { allowFailure = false } = {}) {
  try {
    return execFileSync('/usr/bin/git', ['-C', ROOT, ...argumentsList], {
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: {
        ...process.env,
        GIT_NO_REPLACE_OBJECTS: '1',
        LC_ALL: 'C',
        LANG: 'C'
      }
    }).trim();
  } catch (error) {
    if (allowFailure) return null;
    fail('LAN_INSTALL_GIT_FAILED', {
      operation: argumentsList[0] || 'unknown',
      status: error.status ?? 'unknown'
    });
  }
}

async function ensureDirectory(directoryPath, label, {
  create = false,
  expectedMode = null,
  expectedUid = requireNonRootCurrentUid()
} = {}) {
  try {
    const stat = await fsp.lstat(directoryPath);
    if (!stat.isDirectory() || stat.isSymbolicLink()) fail('LAN_INSTALL_DIRECTORY_INVALID', { label });
    if (stat.uid !== expectedUid) fail('LAN_INSTALL_DIRECTORY_OWNER_INVALID', { label });
    if (expectedMode !== null && (stat.mode & 0o777) !== expectedMode) {
      fail('LAN_INSTALL_DIRECTORY_MODE_INVALID', { label });
    }
  } catch (error) {
    if (!(error instanceof LatestPreviewLanError) && error.code === 'ENOENT' && create) {
      await fsp.mkdir(directoryPath, {
        recursive: true,
        mode: expectedMode ?? 0o755
      });
      if (expectedMode !== null) await fsp.chmod(directoryPath, expectedMode);
      const created = await fsp.lstat(directoryPath);
      if (!created.isDirectory() || created.isSymbolicLink() || created.uid !== expectedUid) {
        fail('LAN_INSTALL_DIRECTORY_INVALID', { label });
      }
      return;
    }
    throw error;
  }
}

async function assertRegularSource(filePath, label) {
  const stat = await fsp.lstat(filePath).catch(error => {
    fail('LAN_INSTALL_SOURCE_MISSING', { label, error: error.code || 'unknown' });
  });
  if (!stat?.isFile() || stat.isSymbolicLink()) fail('LAN_INSTALL_SOURCE_INVALID', { label });
}

async function sha256File(filePath) {
  const handle = await fsp.open(
    filePath,
    fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW || 0) | (fs.constants.O_NONBLOCK || 0)
  );
  try {
    const stat = await handle.stat();
    if (!stat.isFile()) fail('LAN_INSTALL_FILE_TYPE_INVALID');
    return crypto.createHash('sha256').update(await handle.readFile()).digest('hex');
  } finally {
    await handle.close();
  }
}

async function copyRegularFile(sourcePath, destinationPath) {
  await assertRegularSource(sourcePath, path.basename(sourcePath));
  const source = await fsp.open(
    sourcePath,
    fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW || 0) | (fs.constants.O_NONBLOCK || 0)
  );
  const destination = await fsp.open(destinationPath, 'wx', 0o600);
  try {
    const stat = await source.stat();
    if (!stat.isFile()) fail('LAN_INSTALL_SOURCE_INVALID', { label: path.basename(sourcePath) });
    await destination.writeFile(await source.readFile());
    await destination.sync();
  } finally {
    await source.close().catch(() => {});
    await destination.close().catch(() => {});
  }
}

function resourceDestinations(lanPolicy) {
  const destinations = new Map();
  for (const relativePath of lanPolicy.source.installedResources) {
    const basename = path.posix.basename(relativePath);
    if (destinations.has(basename)) fail('LAN_INSTALL_RESOURCE_NAME_COLLISION');
    destinations.set(basename, relativePath);
  }
  return destinations;
}

function verifySourceProvenance(lanPolicy) {
  const branch = git(['branch', '--show-current']);
  const commit = git(['rev-parse', 'HEAD']);
  if (!branch || !COMMIT_PATTERN.test(commit)) fail('LAN_INSTALL_SOURCE_IDENTITY_INVALID');
  for (const relativePath of lanPolicy.source.installedResources) {
    if (git(['ls-files', '--error-unmatch', '--', relativePath], { allowFailure: true }) === null) {
      fail('LAN_INSTALL_SOURCE_UNTRACKED', { file: relativePath });
    }
  }
  const unstaged = git(['diff', '--name-only', '--', ...lanPolicy.source.installedResources]);
  const staged = git(['diff', '--cached', '--name-only', '--', ...lanPolicy.source.installedResources]);
  if (unstaged || staged) {
    fail('LAN_INSTALL_SOURCE_DIRTY', {
      unstaged: unstaged ? 'present' : 'none',
      staged: staged ? 'present' : 'none'
    });
  }
  return { branch, commit };
}

async function validateNodeExecutable(nodeExecutable) {
  const resolved = await fsp.realpath(nodeExecutable).catch(() => '');
  if (!resolved) fail('LAN_INSTALL_NODE_MISSING');
  const stat = await fsp.lstat(resolved);
  if (!stat.isFile() || stat.isSymbolicLink() || (stat.mode & 0o111) === 0) {
    fail('LAN_INSTALL_NODE_INVALID');
  }
  let version;
  try {
    version = execFileSync(resolved, ['--version'], {
      encoding: 'utf8',
      maxBuffer: 1024 * 1024,
      stdio: ['ignore', 'pipe', 'pipe']
    }).trim();
  } catch {
    fail('LAN_INSTALL_NODE_INVALID');
  }
  const major = Number(version.match(/^v(\d+)\./)?.[1]);
  if (major !== 24) {
    fail('LAN_INSTALL_NODE_VERSION_UNSUPPORTED', { version });
  }
  return { resolved, version };
}

export function createLatestPreviewLanLoaderSource(resourceNames, root) {
  const requiredResources = JSON.stringify([...resourceNames].sort());
  return `import crypto from 'node:crypto';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { registerHooks } from 'node:module';
import { pathToFileURL } from 'node:url';

const root = ${JSON.stringify(root)};
const activePath = path.join(root, 'active.json');
const shaPattern = /^[0-9a-f]{64}$/;
const commitPattern = /^[0-9a-f]{40}$/;
const versionPattern = /^[0-9a-f]{40}-[0-9a-f]{16}$/;
const requiredResources = ${requiredResources};
const expectedUid = process.getuid?.();
const anchor = globalThis.__PREVISION_LAN_LOADER_ANCHOR__;

function stop(code) {
  process.stderr.write(code + '\\n');
  process.exitCode = 1;
  throw new Error(code);
}

async function readSecure(filePath, maximum = 1024 * 1024) {
  const handle = await fsp.open(
    filePath,
    fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW || 0) | (fs.constants.O_NONBLOCK || 0)
  ).catch(() => stop('LAN_LOADER_FILE_OPEN_FAILED'));
  try {
    const stat = await handle.stat();
    if (!stat.isFile() || stat.uid !== expectedUid || (stat.mode & 0o777) !== 0o600 ||
        stat.size <= 0 || stat.size > maximum) {
      stop('LAN_LOADER_FILE_INVALID');
    }
    return await handle.readFile();
  } finally {
    await handle.close().catch(() => {});
  }
}

try {
  if (!Number.isInteger(expectedUid) || expectedUid <= 0 || process.geteuid?.() !== expectedUid ||
      !anchor || Object.keys(anchor).sort().join(',') !== 'loaderSha256,root,uid' ||
      anchor.root !== root || anchor.uid !== expectedUid || !shaPattern.test(anchor.loaderSha256 || '')) {
    stop('LAN_LOADER_ANCHOR_INVALID');
  }
  const active = JSON.parse((await readSecure(activePath, 64 * 1024)).toString('utf8'));
  const keys = Object.keys(active).sort().join(',');
  if (keys !== 'installedAt,loaderSha256,nodeExecutable,resources,schemaVersion,sourceCommit,versionName' ||
      active.schemaVersion !== 2 ||
      !commitPattern.test(active.sourceCommit || '') ||
      !versionPattern.test(active.versionName || '') ||
      !Number.isFinite(Date.parse(active.installedAt)) ||
      !path.isAbsolute(active.nodeExecutable) ||
      active.loaderSha256 !== anchor.loaderSha256 ||
      !active.resources ||
      typeof active.resources !== 'object' ||
      Array.isArray(active.resources)) {
    stop('LAN_LOADER_ACTIVE_INVALID');
  }
  if (JSON.stringify(Object.keys(active.resources).sort()) !== JSON.stringify(requiredResources)) {
    stop('LAN_LOADER_RESOURCE_SET_INVALID');
  }
  const configuredNode = await fsp.realpath(active.nodeExecutable).catch(() => '');
  const runningNode = await fsp.realpath(process.execPath).catch(() => '');
  if (!configuredNode || configuredNode !== runningNode) stop('LAN_LOADER_NODE_MISMATCH');
  const versionRoot = path.join(root, 'Versions', active.versionName);
  const versionRelation = path.relative(path.join(root, 'Versions'), versionRoot);
  if (!versionRelation || versionRelation.startsWith('..') || path.isAbsolute(versionRelation)) {
    stop('LAN_LOADER_VERSION_ESCAPE');
  }
  const verifiedSources = new Map();
  for (const [name, expected] of Object.entries(active.resources)) {
    if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(name) || !shaPattern.test(expected)) {
      stop('LAN_LOADER_RESOURCE_RECORD_INVALID');
    }
    const bytes = await readSecure(path.join(versionRoot, name), 64 * 1024 * 1024);
    const actual = crypto.createHash('sha256').update(bytes).digest('hex');
    if (actual !== expected) stop('LAN_LOADER_RESOURCE_HASH_MISMATCH');
    if (name.endsWith('.mjs')) {
      verifiedSources.set(pathToFileURL(path.join(versionRoot, name)).href, bytes);
    }
  }
  const serviceName = 'latest-preview-lan-service.mjs';
  if (!Object.hasOwn(active.resources, serviceName)) stop('LAN_LOADER_SERVICE_MISSING');
  if (typeof globalThis.__PREVISION_LAN_LOADER_TEST_AFTER_VERIFY__ === 'function') {
    await globalThis.__PREVISION_LAN_LOADER_TEST_AFTER_VERIFY__();
  }
  const serviceUrl = pathToFileURL(path.join(versionRoot, serviceName));
  serviceUrl.searchParams.set('prevision-verified', active.resources[serviceName]);
  verifiedSources.set(
    serviceUrl.href,
    verifiedSources.get(pathToFileURL(path.join(versionRoot, serviceName)).href)
  );
  const versionUrlPrefix = pathToFileURL(versionRoot + path.sep).href;
  const hooks = registerHooks({
    resolve(specifier, context, nextResolve) {
      let requested = null;
      try {
        if (specifier.startsWith('file:')) requested = new URL(specifier).href;
        else if (specifier.startsWith('.') && context.parentURL) {
          requested = new URL(specifier, context.parentURL).href;
        }
      } catch {
        stop('LAN_LOADER_MODULE_URL_INVALID');
      }
      if (requested && verifiedSources.has(requested)) {
        return { url: requested, shortCircuit: true };
      }
      if (requested?.startsWith(versionUrlPrefix)) stop('LAN_LOADER_UNDECLARED_MODULE');
      const resolved = nextResolve(specifier, context);
      if (resolved.url.startsWith(versionUrlPrefix) && !verifiedSources.has(resolved.url)) {
        stop('LAN_LOADER_UNDECLARED_MODULE');
      }
      return resolved;
    },
    load(url, context, nextLoad) {
      if (verifiedSources.has(url)) {
        return { format: 'module', source: verifiedSources.get(url), shortCircuit: true };
      }
      if (url.startsWith(versionUrlPrefix)) stop('LAN_LOADER_UNVERIFIED_MODULE');
      return nextLoad(url, context);
    }
  });
  const serviceModule = await import(serviceUrl.href);
  if (typeof serviceModule.runLatestPreviewLanService !== 'function') stop('LAN_LOADER_SERVICE_API_MISSING');
  await serviceModule.runLatestPreviewLanService({ resourcesDirectory: versionRoot });
  hooks.deregister();
} catch (error) {
  if (!process.exitCode) {
    const code = /^[A-Z0-9_]{3,100}$/.test(error && error.code || '')
      ? error.code
      : 'LAN_LOADER_START_FAILED';
    process.stderr.write(code + '\\n');
    process.exitCode = 1;
  }
}
`;
}

function loaderAnchorSource({ loaderPath, loaderSha256, root }) {
  return `import crypto from'node:crypto';import fs from'node:fs';import fsp from'node:fs/promises';const p=${JSON.stringify(loaderPath)},h=${JSON.stringify(loaderSha256)},r=${JSON.stringify(root)},u=process.getuid?.();if(!Number.isInteger(u)||u<=0||process.geteuid?.()!==u)throw Error('LAN_ANCHOR_UID_INVALID');const f=await fsp.open(p,fs.constants.O_RDONLY|(fs.constants.O_NOFOLLOW||0)|(fs.constants.O_NONBLOCK||0));let b;try{const s=await f.stat();if(!s.isFile()||s.uid!==u||(s.mode&511)!==448||s.size<=0||s.size>1048576)throw Error('LAN_ANCHOR_LOADER_INVALID');b=await f.readFile()}finally{await f.close()}if(crypto.createHash('sha256').update(b).digest('hex')!==h)throw Error('LAN_ANCHOR_HASH_MISMATCH');globalThis.__PREVISION_LAN_LOADER_ANCHOR__={loaderSha256:h,root:r,uid:u};await import('data:text/javascript;base64,'+b.toString('base64'));`;
}

function legacyLaunchAgentPlist({ lanPolicy, nodeExecutable, loaderPath, root }) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${xmlEscape(lanPolicy.service.label)}</string>
  <key>ProgramArguments</key>
  <array>
    <string>${xmlEscape(nodeExecutable)}</string>
    <string>${xmlEscape(loaderPath)}</string>
  </array>
  <key>WorkingDirectory</key>
  <string>${xmlEscape(root)}</string>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
  <key>ThrottleInterval</key>
  <integer>10</integer>
  <key>ProcessType</key>
  <string>Background</string>
  <key>StandardOutPath</key>
  <string>/dev/null</string>
  <key>StandardErrorPath</key>
  <string>/dev/null</string>
</dict>
</plist>
`;
}

function launchAgentPlist({ lanPolicy, nodeExecutable, loaderPath, loaderSha256, root }) {
  const anchor = loaderAnchorSource({ loaderPath, loaderSha256, root });
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${xmlEscape(lanPolicy.service.label)}</string>
  <key>ProgramArguments</key>
  <array>
    <string>${xmlEscape(nodeExecutable)}</string>
    <string>--input-type=module</string>
    <string>--eval</string>
    <string>${xmlEscape(anchor)}</string>
  </array>
  <key>WorkingDirectory</key>
  <string>${xmlEscape(root)}</string>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
  <key>ThrottleInterval</key>
  <integer>10</integer>
  <key>ProcessType</key>
  <string>Background</string>
  <key>StandardOutPath</key>
  <string>/dev/null</string>
  <key>StandardErrorPath</key>
  <string>/dev/null</string>
</dict>
</plist>
`;
}

function defaultLaunchctl(argumentsList) {
  return spawnSync('/bin/launchctl', argumentsList, {
    encoding: 'utf8',
    maxBuffer: 4 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'pipe']
  });
}

function launchDomain() {
  const uid = requireNonRootCurrentUid();
  return `gui/${uid}`;
}

function serviceTarget(lanPolicy) {
  return `${launchDomain()}/${lanPolicy.service.label}`;
}

function runLaunchctl(launchctlRunner, argumentsList, { allowFailure = false } = {}) {
  const result = launchctlRunner(argumentsList);
  if (!result || typeof result.status !== 'number') fail('LAN_INSTALL_LAUNCHCTL_RESULT_INVALID');
  if (result.status !== 0 && !allowFailure) {
    fail('LAN_INSTALL_LAUNCHCTL_FAILED', {
      operation: argumentsList[0] || 'unknown',
      status: result.status
    });
  }
  return result;
}

export function validateManagedEntryStat(stat, {
  label,
  expectedUid = requireNonRootCurrentUid(),
  expectedType,
  expectedMode
}) {
  if (!stat || stat.uid !== expectedUid ||
      (expectedType === 'file' && (!stat.isFile() || stat.isSymbolicLink())) ||
      (expectedType === 'directory' && (!stat.isDirectory() || stat.isSymbolicLink())) ||
      (expectedMode !== null && (stat.mode & 0o777) !== expectedMode)) {
    fail('LAN_INSTALL_MANAGED_ENTRY_INVALID', { label });
  }
  return stat;
}

async function safeOptionalFile(filePath, label, maximumBytes = 1024 * 1024, {
  expectedMode = null,
  expectedUid = requireNonRootCurrentUid()
} = {}) {
  let handle;
  try {
    handle = await fsp.open(
      filePath,
      fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW || 0) | (fs.constants.O_NONBLOCK || 0)
    );
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    fail('LAN_INSTALL_EXISTING_FILE_INVALID', { label });
  }
  try {
    const stat = await handle.stat();
    if (!stat.isFile() || stat.uid !== expectedUid || stat.size <= 0 || stat.size > maximumBytes ||
        (expectedMode !== null && (stat.mode & 0o777) !== expectedMode)) {
      fail('LAN_INSTALL_EXISTING_FILE_INVALID', { label });
    }
    return { bytes: await handle.readFile(), mode: stat.mode & 0o777, uid: stat.uid };
  } finally {
    await handle.close();
  }
}

async function restoreOptionalFile(filePath, prior, mode) {
  if (prior) {
    await atomicWriteFile(filePath, prior.bytes, { mode: prior.mode });
    return;
  }
  const stat = await fsp.lstat(filePath).catch(() => null);
  if (!stat) return;
  if (!stat.isFile() || stat.isSymbolicLink()) fail('LAN_INSTALL_ROLLBACK_FILE_INVALID');
  await fsp.unlink(filePath);
  await fsp.open(path.dirname(filePath), 'r').then(async handle => {
    try {
      await handle.sync();
    } finally {
      await handle.close();
    }
  });
}

async function readServiceState(statePath) {
  const existing = await safeOptionalFile(statePath, 'service state', 64 * 1024, {
    expectedMode: 0o600
  });
  if (!existing) return null;
  let state;
  try {
    state = JSON.parse(existing.bytes.toString('utf8'));
  } catch {
    fail('LAN_INSTALL_STATE_INVALID');
  }
  const safeKeys = [
    'schemaVersion',
    'status',
    'pid',
    'hostname',
    'address',
    'port',
    'targetCommit',
    'readyCommit',
    'errorCode',
    'updatedAt'
  ];
  if (!state || typeof state !== 'object' || Array.isArray(state) ||
      Object.keys(state).sort().join(',') !== [...safeKeys].sort().join(',') ||
      state.schemaVersion !== 1) {
    fail('LAN_INSTALL_STATE_INVALID');
  }
  return state;
}

function validateLegacyActiveVersion(active) {
  const keys = [
    'installedAt',
    'nodeExecutable',
    'resources',
    'schemaVersion',
    'sourceCommit',
    'versionName'
  ];
  if (!active || typeof active !== 'object' || Array.isArray(active) ||
      Object.keys(active).sort().join(',') !== keys.join(',') ||
      active.schemaVersion !== 1 ||
      !COMMIT_PATTERN.test(active.sourceCommit || '') ||
      !/^[0-9a-f]{40}-[0-9a-f]{16}$/.test(active.versionName || '') ||
      !Number.isFinite(Date.parse(active.installedAt)) ||
      !path.isAbsolute(active.nodeExecutable) ||
      !active.resources || typeof active.resources !== 'object' || Array.isArray(active.resources) ||
      Object.values(active.resources).some(value => !SHA256_PATTERN.test(value))) {
    fail('LAN_INSTALL_LEGACY_ACTIVE_INVALID');
  }
  return active;
}

async function readActiveVersion(activePath, { required = false, allowLegacy = false } = {}) {
  const existing = await safeOptionalFile(activePath, 'active version', 64 * 1024, {
    expectedMode: 0o600
  });
  if (!existing) {
    if (required) fail('LAN_INSTALL_ACTIVE_MISSING');
    return null;
  }
  let active;
  try {
    active = JSON.parse(existing.bytes.toString('utf8'));
  } catch {
    fail('LAN_INSTALL_ACTIVE_INVALID');
  }
  if (allowLegacy && active.schemaVersion === 1) return validateLegacyActiveVersion(active);
  return validateActiveVersion(active);
}

async function optionalManagedDirectory(directoryPath, label, expectedMode = 0o700) {
  const stat = await fsp.lstat(directoryPath).catch(error => {
    if (error.code === 'ENOENT') return null;
    throw error;
  });
  if (!stat) return null;
  return validateManagedEntryStat(stat, {
    label,
    expectedType: 'directory',
    expectedMode
  });
}

function assertOwnedLaunchAgent(plist, { active, lanPolicy, paths }) {
  if (!plist) return;
  if (!active) fail('LAN_INSTALL_EXISTING_PLIST_NOT_OWNED');
  const properties = {
    lanPolicy,
    nodeExecutable: active.nodeExecutable,
    loaderPath: paths.loaderPath,
    root: paths.root
  };
  const expected = active.schemaVersion === 1
    ? legacyLaunchAgentPlist(properties)
    : launchAgentPlist({ ...properties, loaderSha256: active.loaderSha256 });
  if (!plist.bytes.equals(Buffer.from(expected))) {
    fail('LAN_INSTALL_EXISTING_PLIST_NOT_OWNED');
  }
}

async function inspectManagedInstallation({ paths, lanPolicy, requireInstalled = false }) {
  requireNonRootCurrentUid();
  const support = await optionalManagedDirectory(paths.launcherSupportRoot, 'launcher support root');
  const root = await optionalManagedDirectory(paths.root, 'LAN service root');
  const launchAgents = await optionalManagedDirectory(path.dirname(paths.launchAgentPath), 'LaunchAgents', null);
  const active = await readActiveVersion(paths.activePath, {
    required: requireInstalled,
    allowLegacy: true
  });
  const loader = await safeOptionalFile(paths.loaderPath, 'loader', 1024 * 1024, {
    expectedMode: 0o700
  });
  const plist = await safeOptionalFile(paths.launchAgentPath, 'LaunchAgent', 1024 * 1024, {
    expectedMode: 0o600
  });
  const ready = await safeOptionalFile(paths.readyPath, 'ready', 64 * 1024, {
    expectedMode: 0o600
  });
  const state = await safeOptionalFile(paths.statePath, 'service state', 64 * 1024, {
    expectedMode: 0o600
  });
  if (requireInstalled && (!root || !active || !loader || !plist)) {
    fail('LAN_INSTALL_MANAGED_STATE_INCOMPLETE');
  }
  if ((active || loader || ready || state) && !root) fail('LAN_INSTALL_MANAGED_STATE_INCOMPLETE');
  if (active?.schemaVersion === 2 && loader &&
      crypto.createHash('sha256').update(loader.bytes).digest('hex') !== active.loaderSha256) {
    fail('LAN_INSTALL_LOADER_HASH_MISMATCH');
  }
  if (root) {
    const expectedNames = new Set([
      path.basename(paths.versionsRoot),
      path.basename(paths.stagingRoot),
      path.basename(paths.snapshotsRoot),
      path.basename(paths.activePath),
      path.basename(paths.readyPath),
      path.basename(paths.statePath),
      path.basename(paths.loaderPath)
    ]);
    for (const name of await fsp.readdir(paths.root)) {
      if (!expectedNames.has(name)) fail('LAN_INSTALL_MANAGED_ROOT_CONTENTS_INVALID');
    }
    for (const [directoryPath, label] of [
      [paths.versionsRoot, 'LAN versions root'],
      [paths.stagingRoot, 'LAN staging root'],
      [paths.snapshotsRoot, 'LAN snapshots root']
    ]) {
      await optionalManagedDirectory(directoryPath, label);
    }
    const versions = await fsp.readdir(paths.versionsRoot).catch(error => {
      if (error.code === 'ENOENT') return [];
      throw error;
    });
    for (const versionName of versions) {
      if (!/^[0-9a-f]{40}-[0-9a-f]{16}$/.test(versionName)) {
        fail('LAN_INSTALL_VERSION_INVALID');
      }
      const versionRoot = path.join(paths.versionsRoot, versionName);
      await optionalManagedDirectory(versionRoot, 'LAN version');
      for (const name of await fsp.readdir(versionRoot)) {
        await safeOptionalFile(path.join(versionRoot, name), 'LAN version resource', 64 * 1024 * 1024, {
          expectedMode: 0o600
        });
      }
    }
  }
  assertOwnedLaunchAgent(plist, { active, lanPolicy, paths });
  return { support, root, launchAgents, active, loader, plist, ready, state };
}

async function waitForReady(statePath, sourceCommit, timeoutMilliseconds, minimumUpdatedAt) {
  const deadline = Date.now() + timeoutMilliseconds;
  const minimumTimestamp = Date.parse(minimumUpdatedAt);
  while (Date.now() < deadline) {
    const state = await readServiceState(statePath).catch(() => null);
    if (state?.status === 'ready' &&
        Number.isInteger(state.pid) &&
        state.pid > 0 &&
        Date.parse(state.updatedAt) >= minimumTimestamp &&
        state.readyCommit &&
        state.readyCommit === state.targetCommit) {
      return state;
    }
    if (state?.status === 'error') {
      fail('LAN_INSTALL_SERVICE_REPORTED_ERROR', { errorCode: state.errorCode || 'unknown' });
    }
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  fail('LAN_INSTALL_SERVICE_READY_TIMEOUT', { sourceCommit });
}

async function installVersion({ lanPolicy, paths, sourceIdentity }) {
  const destinations = resourceDestinations(lanPolicy);
  const transactionRoot = await fsp.mkdtemp(path.join(paths.root, '.install-'));
  await fsp.chmod(transactionRoot, 0o700);
  const stagedVersion = path.join(transactionRoot, 'Version');
  await fsp.mkdir(stagedVersion, { mode: 0o700 });
  try {
    const hashes = {};
    for (const [destinationName, sourceRelativePath] of destinations) {
      const source = path.join(ROOT, ...sourceRelativePath.split('/'));
      const destination = path.join(stagedVersion, destinationName);
      await copyRegularFile(source, destination);
      hashes[destinationName] = await sha256File(destination);
    }
    const digest = crypto.createHash('sha256')
      .update(JSON.stringify(Object.entries(hashes).sort(([left], [right]) =>
        left === right ? 0 : left < right ? -1 : 1)))
      .digest('hex');
    const versionName = `${sourceIdentity.commit}-${digest.slice(0, 16)}`;
    const finalVersion = path.join(paths.versionsRoot, versionName);
    const existing = await fsp.lstat(finalVersion).catch(error => {
      if (error.code === 'ENOENT') return null;
      throw error;
    });
    if (existing) {
      validateManagedEntryStat(existing, {
        label: 'LAN version',
        expectedType: 'directory',
        expectedMode: 0o700
      });
      const actualEntries = (await fsp.readdir(finalVersion)).sort();
      const expectedEntries = Object.keys(hashes).sort();
      if (JSON.stringify(actualEntries) !== JSON.stringify(expectedEntries)) {
        fail('LAN_INSTALL_VERSION_CONTENTS_INVALID');
      }
      for (const [name, expected] of Object.entries(hashes)) {
        const resourcePath = path.join(finalVersion, name);
        const stat = await fsp.lstat(resourcePath);
        validateManagedEntryStat(stat, {
          label: 'LAN version resource',
          expectedType: 'file',
          expectedMode: 0o600
        });
        if (await sha256File(resourcePath) !== expected) {
          fail('LAN_INSTALL_VERSION_HASH_MISMATCH');
        }
      }
    } else {
      await fsp.rename(stagedVersion, finalVersion);
      await fsp.open(paths.versionsRoot, 'r').then(async handle => {
        try {
          await handle.sync();
        } finally {
          await handle.close();
        }
      });
    }
    await fsp.rm(transactionRoot, { recursive: true, force: true });
    return { versionName, hashes };
  } catch (error) {
    await fsp.rm(transactionRoot, { recursive: true, force: true }).catch(() => {});
    throw error;
  }
}

export async function installLatestPreviewLanService({
  homeDirectory = os.homedir(),
  nodeExecutable = process.execPath,
  verifyCommittedSources = true,
  launchctlRunner = defaultLaunchctl,
  waitForService = true,
  readyTimeoutMilliseconds = 120000
} = {}) {
  requireNonRootCurrentUid();
  if (process.platform !== 'darwin') fail('LAN_INSTALL_PLATFORM_UNSUPPORTED');
  const lanPolicy = await loadLanPolicy(LAN_POLICY_PATH);
  const launcherPolicy = await loadLauncherPolicy(LAUNCHER_POLICY_PATH);
  const node = await validateNodeExecutable(nodeExecutable);
  const sourceIdentity = verifyCommittedSources
    ? verifySourceProvenance(lanPolicy)
    : {
        branch: git(['branch', '--show-current']) || 'test',
        commit: git(['rev-parse', 'HEAD']) || '0'.repeat(40)
      };
  const paths = lanServicePaths(homeDirectory, launcherPolicy, lanPolicy);
  const priorManaged = await inspectManagedInstallation({ paths, lanPolicy });
  await ensureDirectory(paths.launcherSupportRoot, 'launcher support root', { create: true, expectedMode: 0o700 });
  await ensureDirectory(paths.root, 'LAN service root', { create: true, expectedMode: 0o700 });
  await ensureDirectory(paths.versionsRoot, 'LAN versions root', { create: true, expectedMode: 0o700 });
  await ensureDirectory(paths.stagingRoot, 'LAN staging root', { create: true, expectedMode: 0o700 });
  await ensureDirectory(paths.snapshotsRoot, 'LAN snapshots root', { create: true, expectedMode: 0o700 });
  await ensureDirectory(path.dirname(paths.launchAgentPath), 'LaunchAgents', { create: true });

  const installed = await installVersion({ lanPolicy, paths, sourceIdentity });
  const loaderBytes = Buffer.from(createLatestPreviewLanLoaderSource(
    Object.keys(installed.hashes),
    paths.root
  ));
  const loaderSha256 = crypto.createHash('sha256').update(loaderBytes).digest('hex');
  const active = validateActiveVersion({
    schemaVersion: 2,
    versionName: installed.versionName,
    sourceCommit: sourceIdentity.commit,
    installedAt: new Date().toISOString(),
    nodeExecutable: node.resolved,
    loaderSha256,
    resources: installed.hashes
  });
  const plistBytes = Buffer.from(launchAgentPlist({
    lanPolicy,
    nodeExecutable: node.resolved,
    loaderPath: paths.loaderPath,
    loaderSha256,
    root: paths.root
  }));
  const activeBytes = Buffer.from(`${JSON.stringify(active, null, 2)}\n`);
  const prior = {
    active: priorManaged.active
      ? await safeOptionalFile(paths.activePath, 'active version', 64 * 1024, { expectedMode: 0o600 })
      : null,
    loader: priorManaged.loader,
    plist: priorManaged.plist
  };
  const loadedBefore = runLaunchctl(
    launchctlRunner,
    ['print', serviceTarget(lanPolicy)],
    { allowFailure: true }
  );
  if (loadedBefore.status === 0 && !prior.plist) {
    fail('LAN_INSTALL_LOADED_JOB_NOT_OWNED');
  }
  if (prior.plist) {
    runLaunchctl(launchctlRunner, ['bootout', launchDomain(), paths.launchAgentPath], { allowFailure: true });
  }
  let activated = false;
  try {
    await atomicWriteFile(paths.loaderPath, loaderBytes, { mode: 0o700 });
    await atomicWriteFile(paths.activePath, activeBytes, { mode: 0o600 });
    await atomicWriteFile(paths.launchAgentPath, plistBytes, { mode: 0o600 });
    runLaunchctl(launchctlRunner, ['bootstrap', launchDomain(), paths.launchAgentPath]);
    activated = true;
    runLaunchctl(launchctlRunner, ['kickstart', '-k', serviceTarget(lanPolicy)]);
    const state = waitForService
      ? await waitForReady(
          paths.statePath,
          sourceIdentity.commit,
          readyTimeoutMilliseconds,
          active.installedAt
        )
      : null;
    return {
      sourceIdentity,
      nodeVersion: node.version,
      label: lanPolicy.service.label,
      state,
      active
    };
  } catch (error) {
    if (activated) {
      runLaunchctl(launchctlRunner, ['bootout', launchDomain(), paths.launchAgentPath], { allowFailure: true });
    }
    await restoreOptionalFile(paths.activePath, prior.active, 0o600).catch(() => {});
    await restoreOptionalFile(paths.loaderPath, prior.loader, 0o700).catch(() => {});
    await restoreOptionalFile(paths.launchAgentPath, prior.plist, 0o600).catch(() => {});
    if (prior.plist) {
      runLaunchctl(launchctlRunner, ['bootstrap', launchDomain(), paths.launchAgentPath], { allowFailure: true });
      runLaunchctl(launchctlRunner, ['kickstart', '-k', serviceTarget(lanPolicy)], { allowFailure: true });
    }
    throw error;
  }
}

async function loadPoliciesAndPaths(homeDirectory) {
  requireNonRootCurrentUid();
  const [lanPolicy, launcherPolicy] = await Promise.all([
    loadLanPolicy(LAN_POLICY_PATH),
    loadLauncherPolicy(LAUNCHER_POLICY_PATH)
  ]);
  return {
    lanPolicy,
    launcherPolicy,
    paths: lanServicePaths(homeDirectory, launcherPolicy, lanPolicy)
  };
}

export async function startLatestPreviewLanService({
  homeDirectory = os.homedir(),
  launchctlRunner = defaultLaunchctl
} = {}) {
  const { lanPolicy, paths } = await loadPoliciesAndPaths(homeDirectory);
  await inspectManagedInstallation({ paths, lanPolicy, requireInstalled: true });
  const print = runLaunchctl(launchctlRunner, ['print', serviceTarget(lanPolicy)], { allowFailure: true });
  if (print.status !== 0) {
    runLaunchctl(launchctlRunner, ['bootstrap', launchDomain(), paths.launchAgentPath]);
  }
  runLaunchctl(launchctlRunner, ['kickstart', '-k', serviceTarget(lanPolicy)]);
  return { label: lanPolicy.service.label };
}

export async function stopLatestPreviewLanService({
  homeDirectory = os.homedir(),
  launchctlRunner = defaultLaunchctl
} = {}) {
  const { lanPolicy, paths } = await loadPoliciesAndPaths(homeDirectory);
  await inspectManagedInstallation({ paths, lanPolicy, requireInstalled: true });
  runLaunchctl(launchctlRunner, ['bootout', launchDomain(), paths.launchAgentPath], { allowFailure: true });
  return { label: lanPolicy.service.label };
}

export async function restartLatestPreviewLanService(options = {}) {
  requireNonRootCurrentUid();
  await stopLatestPreviewLanService(options);
  return startLatestPreviewLanService(options);
}

export async function statusLatestPreviewLanService({
  homeDirectory = os.homedir(),
  launchctlRunner = defaultLaunchctl
} = {}) {
  const { lanPolicy, paths } = await loadPoliciesAndPaths(homeDirectory);
  const managed = await inspectManagedInstallation({ paths, lanPolicy });
  const launchctl = runLaunchctl(
    launchctlRunner,
    ['print', serviceTarget(lanPolicy)],
    { allowFailure: true }
  );
  const active = managed.active;
  const state = await readServiceState(paths.statePath).catch(error => ({
    schemaVersion: 1,
    status: 'error',
    pid: null,
    hostname: null,
    address: null,
    port: lanPolicy.service.port,
    targetCommit: null,
    readyCommit: null,
    errorCode: error.code || 'LAN_INSTALL_STATE_INVALID',
    updatedAt: new Date().toISOString()
  }));
  return {
    schemaVersion: 1,
    label: lanPolicy.service.label,
    loaded: launchctl.status === 0,
    installedSourceCommit: active?.sourceCommit || null,
    installedAt: active?.installedAt || null,
    state
  };
}

export async function uninstallLatestPreviewLanService({
  homeDirectory = os.homedir(),
  launchctlRunner = defaultLaunchctl
} = {}) {
  const { lanPolicy, paths } = await loadPoliciesAndPaths(homeDirectory);
  const managed = await inspectManagedInstallation({ paths, lanPolicy });
  const loaded = runLaunchctl(
    launchctlRunner,
    ['print', serviceTarget(lanPolicy)],
    { allowFailure: true }
  );
  if (loaded.status === 0 && !managed.plist) fail('LAN_UNINSTALL_LOADED_JOB_NOT_OWNED');
  if (managed.plist) {
    runLaunchctl(launchctlRunner, ['bootout', launchDomain(), paths.launchAgentPath], { allowFailure: true });
    const plist = await fsp.lstat(paths.launchAgentPath);
    validateManagedEntryStat(plist, {
      label: 'LaunchAgent',
      expectedType: 'file',
      expectedMode: 0o600
    });
    await fsp.unlink(paths.launchAgentPath);
  }
  if (managed.root) {
    validateManagedEntryStat(await fsp.lstat(paths.root), {
      label: 'LAN service root',
      expectedType: 'directory',
      expectedMode: 0o700
    });
    const supportReal = await fsp.realpath(paths.launcherSupportRoot);
    const rootReal = await fsp.realpath(paths.root);
    const relation = path.relative(supportReal, rootReal);
    if (!relation || relation.startsWith('..') || path.isAbsolute(relation)) fail('LAN_UNINSTALL_SCOPE_INVALID');
    await fsp.rm(rootReal, { recursive: true, force: false });
  }
  return { label: lanPolicy.service.label, removed: true };
}

function parseAction(argumentsList) {
  if (argumentsList.length !== 1 ||
      !['install', 'start', 'stop', 'restart', 'status', 'uninstall'].includes(argumentsList[0])) {
    fail('LAN_INSTALL_ARGUMENTS_INVALID');
  }
  return argumentsList[0];
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === SCRIPT_PATH;
if (isMain) {
  try {
    const action = parseAction(process.argv.slice(2));
    let result;
    if (action === 'install') result = await installLatestPreviewLanService();
    else if (action === 'start') result = await startLatestPreviewLanService();
    else if (action === 'stop') result = await stopLatestPreviewLanService();
    else if (action === 'restart') result = await restartLatestPreviewLanService();
    else if (action === 'status') result = await statusLatestPreviewLanService();
    else result = await uninstallLatestPreviewLanService();
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } catch (error) {
    process.stderr.write(`${error.code || 'LAN_INSTALL_FAILED'}\n`);
    process.exitCode = 1;
  }
}
