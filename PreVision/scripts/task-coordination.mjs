import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';
import { fileURLToPath } from 'url';

const scriptFile = fileURLToPath(import.meta.url);
const root = path.resolve(path.dirname(scriptFile), '..');
const gitRoot = process.env.PREVISION_COORDINATION_GIT_ROOT
  ? path.resolve(process.env.PREVISION_COORDINATION_GIT_ROOT)
  : root;
const taxonomy = JSON.parse(fs.readFileSync(path.join(root, 'qa', 'task-scope-taxonomy.json'), 'utf8'));
const args = process.argv.slice(2);
const command = args[0] || 'status';
const jsonOutput = args.includes('--json');
const allowedOwners = taxonomy.dispatchOwners || ['01', '02', '03', '04'];
const reservationPolicy = taxonomy.reservationPolicy || { defaultTtlMinutes: 30, maxTtlMinutes: 120 };
const lifecyclePolicy = taxonomy.taskLifecycle || {};
const lifecycleStates = lifecyclePolicy.states || [
  'RESERVED', 'WAITING', 'ACTIVE', 'REVIEW', 'HANDED_OFF',
  'INTEGRATING', 'RELEASED', 'ARCHIVE_PENDING', 'ARCHIVED'
];
const reservationStates = lifecyclePolicy.reservationStates || ['RESERVED', 'WAITING'];
const claimStates = lifecyclePolicy.claimStates || ['ACTIVE', 'REVIEW', 'HANDED_OFF', 'INTEGRATING'];
const terminalStates = lifecyclePolicy.terminalStates || ['RELEASED', 'ARCHIVE_PENDING', 'ARCHIVED'];
const executionVisibilityPolicy = lifecyclePolicy.executionVisibility || {};
const executionVisibilityStates = executionVisibilityPolicy.values || [
  'DESKTOP_LIVE', 'BACKGROUND_ONLY', 'WAITING', 'UNKNOWN'
];
const defaultExecutionVisibility = executionVisibilityPolicy.default || 'UNKNOWN';
const externalStates = lifecyclePolicy.externalStates || {
  rollout: ['present', 'missing', 'unknown'],
  threadRecord: ['present', 'missing', 'unknown'],
  sidebar: ['present', 'absent', 'stale', 'unknown'],
  name: ['set', 'failed', 'unknown'],
  turn: ['not-started', 'started', 'completed', 'disconnected', 'unknown'],
  turnOwner: ['desktop', 'background', 'none', 'unknown']
};
const maxWriteSlots = taxonomy.maxConcurrentWriteTasks;
const coordinationRegistryPolicy = taxonomy.coordinationRegistry || {};
const registrySchemaVersion = coordinationRegistryPolicy.schemaVersion || 3;
const coordinationVersion = coordinationRegistryPolicy.coordinationVersion || 3;
const lockSchemaVersion = 2;
const legacyGuardSchemaVersion = 1;
const lockKind = 'prevision-task-coordination-v3-lock';
const recoveryLockKind = 'prevision-task-coordination-v3-recovery';
const legacyGuardKind = 'prevision-task-coordination-v3-legacy-guard';
const lockRetryCount = 500;
const lockRetryMilliseconds = 20;
const lockReadRetryCount = 50;
const forbiddenTextPattern = /[\u0000-\u001f\u007f-\u009f\u2028\u2029]/u;
const processIdentityPattern = /^process-start:(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun) (?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) (?:[1-9]|[12][0-9]|3[01]) [0-9]{2}:[0-9]{2}:[0-9]{2} [0-9]{4}$/;
const allowedTransitions = {
  RESERVED: ['RESERVED', 'WAITING', 'ACTIVE'],
  WAITING: ['WAITING', 'ACTIVE'],
  ACTIVE: ['ACTIVE', 'REVIEW', 'RELEASED'],
  REVIEW: ['REVIEW', 'ACTIVE', 'HANDED_OFF', 'RELEASED'],
  HANDED_OFF: ['HANDED_OFF', 'REVIEW', 'INTEGRATING', 'RELEASED'],
  INTEGRATING: ['INTEGRATING', 'HANDED_OFF', 'RELEASED'],
  RELEASED: ['ARCHIVE_PENDING', 'ARCHIVED'],
  ARCHIVE_PENDING: ['ARCHIVE_PENDING', 'ARCHIVED'],
  ARCHIVED: []
};

function rawGit(argsList, options = {}) {
  const { env = {}, ...rest } = options;
  return execFileSync('git', argsList, {
    ...rest,
    env: { ...process.env, ...env, GIT_NO_REPLACE_OBJECTS: '1' }
  });
}

function option(name, fallback = '') {
  const index = args.indexOf(`--${name}`);
  if (index < 0) return fallback;
  const value = args[index + 1];
  if (name === 'reservation') return value || fallback;
  return value && !value.startsWith('--') ? value : fallback;
}

function hasOption(name) {
  return args.includes(`--${name}`);
}

function listOption(name) {
  return option(name).split(',').map(value => value.trim()).filter(Boolean);
}

function git(argsList, fallback = '') {
  try {
    return rawGit(argsList, { cwd: gitRoot, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return fallback;
  }
}

function registryPath() {
  if (process.env.PREVISION_TASK_REGISTRY) return path.resolve(process.env.PREVISION_TASK_REGISTRY);
  const common = git(['rev-parse', '--git-common-dir'], '.git');
  const commonPath = path.isAbsolute(common) ? common : path.resolve(root, common);
  return path.join(commonPath, 'prevision-active-tasks.json');
}

const registryFile = registryPath();
const legacyLockFile = `${registryFile}.lock`;
const legacyGuardMarkerFile = path.join(legacyLockFile, 'guard.json');
const lockFile = `${registryFile}.coordination-v3.lock`;
const recoveryLockFile = `${lockFile}.recovery`;
const reservationSecretFile = `${registryFile}.reservation-secret`;
const sharedLauncherRoot = path.join(
  path.dirname(registryFile),
  'prevision-task-coordination-launcher-v3'
);
const sharedLauncherVersions = path.join(sharedLauncherRoot, 'versions');
const sharedLauncherActive = path.join(sharedLauncherRoot, 'active.json');

function emptyRegistry() {
  return {
    schemaVersion: registrySchemaVersion,
    coordinationVersion,
    revision: '',
    updatedAt: '',
    claims: [],
    reservations: [],
    tasks: [],
    integrityIssues: []
  };
}

function wait(milliseconds) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, milliseconds);
}

function assertSecureRegularFile(file, label) {
  const stat = fs.lstatSync(file);
  if (stat.isSymbolicLink()) throw new Error(`${label} must not be a symbolic link.`);
  if (!stat.isFile()) throw new Error(`${label} must be a regular file.`);
  const permissions = stat.mode & 0o777;
  if (permissions !== 0o600) {
    throw new Error(`${label} permissions must be 0600.`);
  }
  return stat;
}

function lstatIfPresent(file) {
  try {
    return fs.lstatSync(file);
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
}

function currentProcessIdentity(pid = process.pid) {
  if (!Number.isInteger(pid) || pid <= 0) return { status: 'absent' };
  try {
    process.kill(pid, 0);
  } catch (error) {
    if (error.code === 'ESRCH') return { status: 'absent' };
    return { status: 'unknown' };
  }
  try {
    const identity = execFileSync('/bin/ps', [
      '-p',
      String(pid),
      '-o',
      'lstart='
    ], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      env: { ...process.env, LC_ALL: 'C', LANG: 'C', TZ: 'UTC0' }
    }).trim().replace(/\s+/g, ' ');
    const canonicalIdentity = identity ? `process-start:${identity}` : '';
    return processIdentityPattern.test(canonicalIdentity)
      ? { status: 'present', identity: canonicalIdentity }
      : { status: 'unknown' };
  } catch {
    return { status: 'unknown' };
  }
}

function createLockMarker(kind) {
  const owner = currentProcessIdentity();
  if (owner.status !== 'present') {
    throw new Error('Cannot determine task coordination lock owner identity.');
  }
  return {
    schemaVersion: lockSchemaVersion,
    kind,
    pid: process.pid,
    ownerIdentity: owner.identity,
    nonce: crypto.randomBytes(24).toString('hex'),
    acquiredAt: new Date().toISOString()
  };
}

function validateLockMarker(marker, expectedKind, label) {
  const valid = marker &&
    marker.schemaVersion === lockSchemaVersion &&
    marker.kind === expectedKind &&
    Number.isInteger(marker.pid) &&
    marker.pid > 0 &&
    typeof marker.ownerIdentity === 'string' &&
    processIdentityPattern.test(marker.ownerIdentity) &&
    typeof marker.nonce === 'string' &&
    /^[0-9a-f]{48}$/.test(marker.nonce) &&
    typeof marker.acquiredAt === 'string' &&
    Number.isFinite(Date.parse(marker.acquiredAt));
  if (!valid) throw new Error(`${label} is malformed; refusing automatic recovery.`);
  return marker;
}

function transientLockReadError(message) {
  const error = new Error(message);
  error.code = 'ESTALE';
  return error;
}

function lockReadTestHook(file) {
  const signal = process.env.PREVISION_COORDINATION_TEST_LOCK_READ_SIGNAL;
  const proceed = process.env.PREVISION_COORDINATION_TEST_LOCK_READ_PROCEED;
  if (!signal || !proceed || file !== lockFile || lstatIfPresent(signal)) return;
  fs.writeFileSync(signal, 'opened\n', { mode: 0o600, flag: 'wx' });
  for (let attempt = 0; attempt < lockRetryCount; attempt++) {
    if (lstatIfPresent(proceed)) return;
    wait(lockRetryMilliseconds);
  }
  throw new Error('Timed out waiting for the deterministic lock-read test hook.');
}

function readLockRecord(file, expectedKind, label) {
  for (let attempt = 0; attempt < lockReadRetryCount; attempt++) {
    let descriptor;
    try {
      descriptor = fs.openSync(
        file,
        fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW || 0)
      );
      lockReadTestHook(file);
      const before = fs.fstatSync(descriptor);
      if (!before.isFile()) throw new Error(`${label} must be a regular file.`);
      if ((before.mode & 0o777) !== 0o600) {
        throw new Error(`${label} permissions must be 0600.`);
      }
      const raw = fs.readFileSync(descriptor, 'utf8');
      const after = fs.fstatSync(descriptor);
      if (before.dev !== after.dev || before.ino !== after.ino) {
        throw transientLockReadError(`${label} identity changed while reading.`);
      }
      const pathStat = fs.lstatSync(file);
      if (pathStat.isSymbolicLink()) throw new Error(`${label} must not be a symbolic link.`);
      if (!pathStat.isFile()) throw new Error(`${label} must be a regular file.`);
      if ((pathStat.mode & 0o777) !== 0o600) {
        throw new Error(`${label} permissions must be 0600.`);
      }
      if (pathStat.dev !== after.dev || pathStat.ino !== after.ino) {
        throw transientLockReadError(`${label} was replaced while reading.`);
      }
      let marker;
      try {
        marker = JSON.parse(raw);
      } catch {
        throw new Error(`${label} is malformed; refusing automatic recovery.`);
      }
      return { stat: after, marker: validateLockMarker(marker, expectedKind, label) };
    } catch (error) {
      if (['ENOENT', 'ESTALE'].includes(error.code) && attempt + 1 < lockReadRetryCount) {
        wait(lockRetryMilliseconds);
        continue;
      }
      if (error.code === 'ELOOP') {
        throw new Error(`${label} must not be a symbolic link.`);
      }
      throw error;
    } finally {
      if (descriptor !== undefined) {
        try { fs.closeSync(descriptor); } catch { /* preserve the read result */ }
      }
    }
  }
  throw new Error(`${label} changed repeatedly while reading; retry the command.`);
}

function createOwnedLock(file, kind, label) {
  const marker = createLockMarker(kind);
  const candidate = `${file}.candidate-${process.pid}-${marker.nonce}`;
  let descriptor;
  let createdStat;
  let published = false;
  try {
    descriptor = fs.openSync(candidate, 'wx', 0o600);
    const stat = fs.fstatSync(descriptor);
    createdStat = stat;
    if ((stat.mode & 0o777) !== 0o600) {
      throw new Error(`${label} permissions must be 0600.`);
    }
    fs.writeFileSync(descriptor, `${JSON.stringify(marker)}\n`);
    fs.fsyncSync(descriptor);
    fs.linkSync(candidate, file);
    published = true;
    fs.unlinkSync(candidate);
    return { descriptor, marker, dev: stat.dev, ino: stat.ino, file, kind, label };
  } catch (error) {
    if (descriptor !== undefined) {
      try { fs.closeSync(descriptor); } catch { /* preserve the original error */ }
    }
    if (published && createdStat) {
      try {
        const stat = fs.lstatSync(file);
        if (stat.dev === createdStat.dev && stat.ino === createdStat.ino) {
          fs.unlinkSync(file);
        }
      } catch { /* preserve the original error */ }
    }
    try {
      const stat = fs.lstatSync(candidate);
      if (!createdStat || (stat.dev === createdStat.dev && stat.ino === createdStat.ino)) {
        fs.unlinkSync(candidate);
      }
    } catch { /* preserve the original error */ }
    throw error;
  }
}

function lockCandidateEntries(file) {
  const directory = path.dirname(file);
  const prefix = `${path.basename(file)}.candidate-`;
  return fs.readdirSync(directory)
    .filter(name => name.startsWith(prefix))
    .map(name => path.join(directory, name));
}

function cleanupStaleLockCandidates(file, kind, label, ownedCandidate = '') {
  for (const candidate of lockCandidateEntries(file)) {
    if (candidate === ownedCandidate) continue;
    const suffix = path.basename(candidate).slice(`${path.basename(file)}.candidate-`.length);
    const match = suffix.match(/^([1-9][0-9]*)-([0-9a-f]{48})$/);
    if (!match) {
      throw new Error(`${label} candidate name is malformed; refusing automatic cleanup.`);
    }
    const candidatePid = Number(match[1]);
    const owner = currentProcessIdentity(candidatePid);
    if (owner.status === 'unknown') {
      throw new Error(`${label} candidate owner identity is unknown; refusing automatic cleanup.`);
    }
    if (owner.status === 'present') {
      continue;
    }
    const { stat, marker } = readLockRecord(candidate, kind, `${label} candidate`);
    if (marker.pid !== Number(match[1]) || marker.nonce !== match[2]) {
      throw new Error(`${label} candidate identity does not match its file name.`);
    }
    const published = lstatIfPresent(file);
    if (published && published.dev === stat.dev && published.ino === stat.ino) {
      continue;
    }
    const current = fs.lstatSync(candidate);
    if (current.isSymbolicLink() || !current.isFile() ||
      current.dev !== stat.dev || current.ino !== stat.ino ||
      (current.mode & 0o777) !== 0o600) {
      throw new Error(`${label} candidate changed during cleanup.`);
    }
    fs.unlinkSync(candidate);
  }
}

function sameOwnedLock(ownership) {
  try {
    const { stat, marker } = readLockRecord(
      ownership.file,
      ownership.kind,
      ownership.label
    );
    return stat.dev === ownership.dev &&
      stat.ino === ownership.ino &&
      marker.pid === ownership.marker.pid &&
      marker.ownerIdentity === ownership.marker.ownerIdentity &&
      marker.nonce === ownership.marker.nonce;
  } catch {
    return false;
  }
}

function releaseOwnedLock(ownership) {
  try { fs.closeSync(ownership.descriptor); } catch { /* already closed */ }
  if (ownership.file === recoveryLockFile) {
    if (sameOwnedLock(ownership)) fs.unlinkSync(ownership.file);
    return;
  }
  for (let attempt = 0; attempt < lockRetryCount; attempt++) {
    const recovery = acquireRecoveryLock();
    if (!recovery) {
      wait(lockRetryMilliseconds);
      continue;
    }
    try {
      if (sameOwnedLock(ownership)) fs.unlinkSync(ownership.file);
    } finally {
      releaseOwnedLock(recovery);
    }
    return;
  }
}

function legacyGuardRecord() {
  return {
    schemaVersion: legacyGuardSchemaVersion,
    kind: legacyGuardKind,
    registrySchemaVersion,
    createdAt: new Date().toISOString()
  };
}

function validateLegacyGuardRecord(guard) {
  if (guard?.schemaVersion !== legacyGuardSchemaVersion ||
    guard?.kind !== legacyGuardKind ||
    guard?.registrySchemaVersion !== registrySchemaVersion ||
    typeof guard.createdAt !== 'string' ||
    !Number.isFinite(Date.parse(guard.createdAt))) {
    throw new Error('Legacy task coordination write guard is malformed.');
  }
}

function createLegacyGuardDirectory(directory) {
  fs.mkdirSync(directory, { mode: 0o700 });
  const directoryStat = fs.lstatSync(directory);
  if (directoryStat.isSymbolicLink() || !directoryStat.isDirectory() ||
    (directoryStat.mode & 0o777) !== 0o700) {
    throw new Error('Legacy task coordination write guard directory permissions must be 0700.');
  }
  const markerFile = path.join(directory, 'guard.json');
  let descriptor;
  try {
    descriptor = fs.openSync(markerFile, 'wx', 0o600);
    const markerStat = fs.fstatSync(descriptor);
    if ((markerStat.mode & 0o777) !== 0o600) {
      throw new Error('Legacy task coordination write guard marker permissions must be 0600.');
    }
    fs.writeFileSync(descriptor, `${JSON.stringify(legacyGuardRecord())}\n`);
    fs.fsyncSync(descriptor);
    fs.closeSync(descriptor);
    descriptor = undefined;
    const directoryDescriptor = fs.openSync(directory, 'r');
    try {
      fs.fsyncSync(directoryDescriptor);
    } finally {
      fs.closeSync(directoryDescriptor);
    }
  } catch (error) {
    if (descriptor !== undefined) fs.closeSync(descriptor);
    try { fs.unlinkSync(markerFile); } catch { /* marker was not committed */ }
    try { fs.rmdirSync(directory); } catch { /* preserve original error */ }
    throw error;
  }
}

function removeLegacyGuardDirectory(directory) {
  try { fs.unlinkSync(path.join(directory, 'guard.json')); } catch { /* marker absent */ }
  try { fs.unlinkSync(path.join(directory, 'read-wrapper.mjs')); } catch { /* wrapper absent */ }
  try { fs.rmdirSync(directory); } catch { /* directory absent or no longer ours */ }
}

function fsyncParentDirectory(file) {
  const descriptor = fs.openSync(path.dirname(file), 'r');
  try {
    fs.fsyncSync(descriptor);
  } finally {
    fs.closeSync(descriptor);
  }
}

function ensureSecureDirectory(directory, label) {
  fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
  fs.chmodSync(directory, 0o700);
  const stat = fs.lstatSync(directory);
  if (stat.isSymbolicLink() || !stat.isDirectory() || (stat.mode & 0o777) !== 0o700) {
    throw new Error(`${label} must be a 0700 directory.`);
  }
}

function writeAtomicSecureFile(file, content, label, { hardenParent = true } = {}) {
  const existing = lstatIfPresent(file);
  if (existing) {
    assertSecureRegularFile(file, label);
    if (fs.readFileSync(file, 'utf8') === content) return;
  }
  if (hardenParent) {
    ensureSecureDirectory(path.dirname(file), `${label} parent`);
  } else {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const parent = fs.lstatSync(path.dirname(file));
    if (parent.isSymbolicLink() || !parent.isDirectory()) {
      throw new Error(`${label} parent must be a real directory.`);
    }
  }
  const temporary = `${file}.${process.pid}.${crypto.randomBytes(8).toString('hex')}.tmp`;
  let descriptor;
  try {
    descriptor = fs.openSync(temporary, 'wx', 0o600);
    fs.writeFileSync(descriptor, content);
    fs.fsyncSync(descriptor);
    fs.closeSync(descriptor);
    descriptor = undefined;
    fs.renameSync(temporary, file);
    fs.chmodSync(file, 0o600);
    assertSecureRegularFile(file, label);
    fsyncParentDirectory(file);
  } catch (error) {
    if (descriptor !== undefined) {
      try { fs.closeSync(descriptor); } catch { /* preserve original error */ }
    }
    try { fs.unlinkSync(temporary); } catch { /* no temporary file */ }
    throw error;
  }
}

function writeAtomicWorktreeFile(file, content, label) {
  const existing = fs.lstatSync(file);
  if (existing.isSymbolicLink() || !existing.isFile()) {
    throw new Error(`${label} must be a regular file.`);
  }
  const temporary = `${file}.${process.pid}.${crypto.randomBytes(8).toString('hex')}.tmp`;
  let descriptor;
  try {
    descriptor = fs.openSync(temporary, 'wx', 0o644);
    fs.writeFileSync(descriptor, content);
    fs.fsyncSync(descriptor);
    fs.closeSync(descriptor);
    descriptor = undefined;
    fs.renameSync(temporary, file);
    fs.chmodSync(file, 0o644);
    fsyncParentDirectory(file);
  } catch (error) {
    if (descriptor !== undefined) {
      try { fs.closeSync(descriptor); } catch { /* preserve original error */ }
    }
    try { fs.unlinkSync(temporary); } catch { /* no temporary file */ }
    throw error;
  }
}

function sharedLauncherDigest(scriptBytes, taxonomyBytes) {
  return crypto.createHash('sha256')
    .update('prevision-task-coordination-launcher-v3\0')
    .update(scriptBytes)
    .update('\0')
    .update(taxonomyBytes)
    .digest('hex');
}

function ensureSharedLauncher() {
  const scriptBytes = fs.readFileSync(scriptFile, 'utf8');
  const taxonomyBytes = fs.readFileSync(path.join(root, 'qa', 'task-scope-taxonomy.json'), 'utf8');
  const digest = sharedLauncherDigest(scriptBytes, taxonomyBytes);
  const versionRoot = path.join(sharedLauncherVersions, digest);
  ensureSecureDirectory(sharedLauncherRoot, 'Shared task coordination launcher root');
  ensureSecureDirectory(sharedLauncherVersions, 'Shared task coordination launcher versions');
  ensureSecureDirectory(versionRoot, 'Shared task coordination launcher version');
  ensureSecureDirectory(path.join(versionRoot, 'scripts'), 'Shared launcher scripts directory');
  ensureSecureDirectory(path.join(versionRoot, 'qa'), 'Shared launcher QA directory');
  writeAtomicSecureFile(
    path.join(versionRoot, 'scripts', 'task-coordination.mjs'),
    scriptBytes,
    'Shared task coordination launcher script'
  );
  writeAtomicSecureFile(
    path.join(versionRoot, 'qa', 'task-scope-taxonomy.json'),
    taxonomyBytes,
    'Shared task coordination launcher taxonomy'
  );
  writeAtomicSecureFile(
    sharedLauncherActive,
    `${JSON.stringify({
      schemaVersion: 1,
      coordinationVersion,
      digest
    })}\n`,
    'Shared task coordination launcher pointer'
  );
  return { digest, versionRoot };
}

function legacyWorktreeShimContent() {
  return [
    "import fs from 'fs';",
    "import path from 'path';",
    "import { execFileSync, spawnSync } from 'child_process';",
    "import { fileURLToPath } from 'url';",
    "const worktreeRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');",
    "const command = process.argv[2] || 'status';",
    "if (!['status', 'check'].includes(command)) {",
    "  console.error('This legacy Worktree is read-only for coordination. Use a current Worktree for reserve/claim/transition/release.');",
    '  process.exit(1);',
    '}',
    'let launcherRoot;',
    'if (process.env.PREVISION_TASK_REGISTRY) {',
    "  launcherRoot = path.join(path.dirname(path.resolve(process.env.PREVISION_TASK_REGISTRY)), 'prevision-task-coordination-launcher-v3');",
    '} else {',
    "  const common = execFileSync('git', ['rev-parse', '--git-common-dir'], { cwd: worktreeRoot, encoding: 'utf8' }).trim();",
    "  launcherRoot = path.join(path.isAbsolute(common) ? common : path.resolve(worktreeRoot, common), 'prevision-task-coordination-launcher-v3');",
    '}',
    "const activeFile = path.join(launcherRoot, 'active.json');",
    'let active;',
    'try {',
    "  active = JSON.parse(fs.readFileSync(activeFile, 'utf8'));",
    '} catch {',
    "  console.error('The shared task coordination launcher is missing or malformed; this legacy Worktree remains disabled.');",
    '  process.exit(1);',
    '}',
    "if (active?.schemaVersion !== 1 || active?.coordinationVersion !== 3 || !/^[0-9a-f]{64}$/.test(active.digest || '')) {",
    "  console.error('The shared task coordination launcher pointer is invalid; this legacy Worktree remains disabled.');",
    '  process.exit(1);',
    '}',
    "const coordinator = path.join(launcherRoot, 'versions', active.digest, 'scripts', 'task-coordination.mjs');",
    'const result = spawnSync(process.execPath, [coordinator, ...process.argv.slice(2)], {',
    "  stdio: 'inherit',",
    '  env: { ...process.env, PREVISION_COORDINATION_GIT_ROOT: worktreeRoot }',
    '});',
    'process.exit(result.status ?? 1);',
    ''
  ].join('\n');
}

function migrateLegacyWorktree() {
  const actor = option('actor');
  if (actor !== '00') throw new Error('Only 00 may migrate a legacy Worktree coordination entry.');
  const expectedSource = option('legacy-source');
  requireExistingCommit(expectedSource, '--legacy-source');
  const requestedRoot = validateText(option('worktree'), '--worktree', { max: 1000 });
  const targetRoot = fs.realpathSync(requestedRoot);
  const targetStat = fs.lstatSync(targetRoot);
  if (targetStat.isSymbolicLink() || !targetStat.isDirectory()) {
    throw new Error('--worktree must resolve to a real Git Worktree directory.');
  }
  withLock(() => {
    const commonDirectory = directory => {
      const common = rawGit(['rev-parse', '--git-common-dir'], {
        cwd: directory,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore']
      }).trim();
      return fs.realpathSync(path.isAbsolute(common) ? common : path.resolve(directory, common));
    };
    if (commonDirectory(targetRoot) !== commonDirectory(gitRoot)) {
      throw new Error('Legacy Worktree must belong to the same Git common-dir as the authoritative coordinator.');
    }
    const targetHead = rawGit(['rev-parse', 'HEAD'], {
      cwd: targetRoot,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore']
    }).trim();
    if (targetHead !== expectedSource) {
      throw new Error('Legacy Worktree HEAD does not match --legacy-source; refusing migration.');
    }
    const targetScript = path.join(targetRoot, 'scripts', 'task-coordination.mjs');
    const targetPackage = path.join(targetRoot, 'package.json');
    const expectedScript = rawGit(['show', `${expectedSource}:scripts/task-coordination.mjs`], {
      cwd: gitRoot,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore']
    });
    const expectedPackage = JSON.parse(rawGit(['show', `${expectedSource}:package.json`], {
      cwd: gitRoot,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore']
    }));
    const actualPackage = JSON.parse(fs.readFileSync(targetPackage, 'utf8'));
    const taskScripts = packageValue => Object.fromEntries(Object.entries(packageValue.scripts || {})
      .filter(([name]) => name.startsWith('task:'))
      .sort(([left], [right]) => left.localeCompare(right)));
    if (JSON.stringify(taskScripts(actualPackage)) !== JSON.stringify(taskScripts(expectedPackage))) {
      throw new Error('Every legacy Worktree task:* npm entry must exactly match the trusted source; extra or modified coordination entries are forbidden.');
    }
    const shim = legacyWorktreeShimContent();
    const currentScript = fs.readFileSync(targetScript, 'utf8');
    if (currentScript !== expectedScript && currentScript !== shim) {
      throw new Error('Legacy Worktree coordination script is modified; refusing to overwrite it.');
    }
    const staged = nulSeparatedGitPaths([
      'diff', '--cached', '--name-only', '-z'
    ], targetRoot, 'legacy Worktree staged paths');
    const untracked = nulSeparatedGitPaths([
      'ls-files', '--others', '--exclude-standard', '-z'
    ], targetRoot, 'legacy Worktree untracked paths');
    const unstaged = nulSeparatedGitPaths([
      'diff', '--name-only', '-z'
    ], targetRoot, 'legacy Worktree unstaged paths');
    const allowedUnstaged = currentScript === shim ? ['scripts/task-coordination.mjs'] : [];
    if (staged.length || untracked.length || !sameList(unstaged.sort(), allowedUnstaged)) {
      throw new Error('Legacy Worktree migration requires a provably clean Worktree; only the exact installed read-only shim may remain unstaged on an idempotent rerun.');
    }
    const launcher = ensureSharedLauncher();
    writeAtomicWorktreeFile(targetScript, shim, 'Migrated legacy Worktree coordination shim');
    printResult('LEGACY WORKTREE READ ENTRY MIGRATED', {
      worktree: path.basename(targetRoot),
      sourceCommit: expectedSource,
      launcherDigest: launcher.digest,
      writeCommandsDisabled: true,
      standardReadCommands: ['npm run task:status', 'npm run task:check']
    });
  });
}

function validateLegacyGuardDirectory() {
  const stat = fs.lstatSync(legacyLockFile);
  if (stat.isSymbolicLink()) {
    throw new Error('Legacy task coordination write guard must not be a symbolic link.');
  }
  if (!stat.isDirectory() || (stat.mode & 0o777) !== 0o700) {
    throw new Error('Legacy task coordination write guard must be a 0700 directory.');
  }
  assertSecureRegularFile(legacyGuardMarkerFile, 'Legacy task coordination write guard marker');
  let guard;
  try {
    guard = JSON.parse(fs.readFileSync(legacyGuardMarkerFile, 'utf8'));
  } catch {
    throw new Error('Legacy task coordination write guard is malformed.');
  }
  validateLegacyGuardRecord(guard);
  const obsoleteWrapper = path.join(legacyLockFile, 'read-wrapper.mjs');
  const obsoleteStat = lstatIfPresent(obsoleteWrapper);
  if (obsoleteStat) {
    assertSecureRegularFile(obsoleteWrapper, 'Obsolete legacy task coordination read wrapper');
    fs.unlinkSync(obsoleteWrapper);
    fsyncParentDirectory(obsoleteWrapper);
  }
}

function validatePreviewLegacyGuardFile() {
  assertSecureRegularFile(legacyLockFile, 'Legacy task coordination preview guard');
  let guard;
  try {
    guard = JSON.parse(fs.readFileSync(legacyLockFile, 'utf8'));
  } catch {
    throw new Error('A legacy task coordination writer is active or left an unrecognized lock; refusing v3 access.');
  }
  validateLegacyGuardRecord(guard);
}

function ensureLegacyWriteGuard() {
  fs.mkdirSync(path.dirname(registryFile), { recursive: true });
  for (let attempt = 0; attempt < lockRetryCount; attempt++) {
    const stat = lstatIfPresent(legacyLockFile);
    if (!stat) {
      const replacement = `${legacyLockFile}.directory-${crypto.randomBytes(8).toString('hex')}`;
      try {
        createLegacyGuardDirectory(replacement);
        fs.renameSync(replacement, legacyLockFile);
        fsyncParentDirectory(legacyLockFile);
        return;
      } catch (error) {
        removeLegacyGuardDirectory(replacement);
        if (['EEXIST', 'ENOTEMPTY'].includes(error.code)) continue;
        throw error;
      }
    }
    if (stat.isSymbolicLink()) {
      throw new Error('Legacy task coordination write guard must not be a symbolic link.');
    }
    if (stat.isDirectory()) {
      validateLegacyGuardDirectory();
      return;
    }
    if (stat.isFile()) {
      validatePreviewLegacyGuardFile();
      throw new Error(
        'Legacy preview guard is a regular file. Automatic file-to-directory migration is forbidden because it creates a c037 write window; perform an offline migration only after 00 proves all legacy writers are stopped, then fsync the parent directory.'
      );
    }
    wait(lockRetryMilliseconds);
  }
  throw new Error('A legacy task coordination writer is active or left an unrecognized lock; refusing v3 access.');
}

function acquireRecoveryLock() {
  try {
    return createOwnedLock(recoveryLockFile, recoveryLockKind, 'Task coordination recovery lock');
  } catch (error) {
    if (error.code !== 'EEXIST') throw error;
    let marker;
    try {
      ({ marker } = readLockRecord(
        recoveryLockFile,
        recoveryLockKind,
        'Task coordination recovery lock'
      ));
    } catch (readError) {
      if (readError.code === 'ENOENT') return null;
      throw readError;
    }
    const owner = currentProcessIdentity(marker.pid);
    if (owner.status === 'present') return null;
    if (owner.status === 'unknown') {
      throw new Error('Task coordination recovery lock owner is alive or unverifiable; refusing automatic unlink.');
    }
    throw new Error('A stale task coordination recovery lock requires manual inspection; refusing automatic unlink.');
  }
}

function createMainLockIfAbsent() {
  try {
    return createOwnedLock(lockFile, lockKind, 'Task registry lock');
  } catch (error) {
    if (error.code === 'EEXIST') return null;
    throw error;
  }
}

function acquireLock() {
  ensureLegacyWriteGuard();
  for (let attempt = 0; attempt < lockRetryCount; attempt++) {
    if (lstatIfPresent(recoveryLockFile)) {
      let recovery;
      try {
        recovery = readLockRecord(
          recoveryLockFile,
          recoveryLockKind,
          'Task coordination recovery lock'
        );
      } catch (error) {
        if (error.code === 'ENOENT') continue;
        throw error;
      }
      const recoveryOwner = currentProcessIdentity(recovery.marker.pid);
      if (recoveryOwner.status !== 'present') {
        throw new Error('A stale task coordination recovery lock requires manual inspection; refusing automatic unlink.');
      }
      wait(lockRetryMilliseconds);
      continue;
    }
    const created = createMainLockIfAbsent();
    if (created) {
      cleanupStaleLockCandidates(lockFile, lockKind, 'Task registry lock');
      cleanupStaleLockCandidates(recoveryLockFile, recoveryLockKind, 'Task coordination recovery lock');
      return created;
    }

    let observed;
    try {
      observed = readLockRecord(lockFile, lockKind, 'Task registry lock');
    } catch (error) {
      if (error.code === 'ENOENT') continue;
      throw error;
    }
    const owner = currentProcessIdentity(observed.marker.pid);
    if (owner.status === 'present') {
      wait(lockRetryMilliseconds);
      continue;
    }
    if (owner.status === 'unknown') {
      throw new Error('Cannot verify task registry lock owner identity; refusing automatic recovery.');
    }

    const recovery = acquireRecoveryLock();
    if (!recovery) {
      wait(lockRetryMilliseconds);
      continue;
    }
    try {
      const current = lstatIfPresent(lockFile);
      if (!current) continue;
      if (current.isSymbolicLink() || !current.isFile() ||
        (current.mode & 0o777) !== 0o600) {
        throw new Error('Task registry lock changed to an unsafe file; refusing recovery.');
      }
      if (current.dev !== observed.stat.dev || current.ino !== observed.stat.ino) continue;
      const reread = readLockRecord(lockFile, lockKind, 'Task registry lock');
      if (reread.marker.nonce !== observed.marker.nonce ||
        reread.marker.ownerIdentity !== observed.marker.ownerIdentity ||
        reread.marker.pid !== observed.marker.pid) {
        continue;
      }
      const currentOwner = currentProcessIdentity(reread.marker.pid);
      if (currentOwner.status === 'present') {
        continue;
      }
      if (currentOwner.status === 'unknown') {
        throw new Error('Cannot verify stale task registry lock owner identity; refusing recovery.');
      }
      fs.unlinkSync(lockFile);
      cleanupStaleLockCandidates(lockFile, lockKind, 'Task registry lock');
      const takeover = createMainLockIfAbsent();
      if (takeover) {
        cleanupStaleLockCandidates(lockFile, lockKind, 'Task registry lock');
        cleanupStaleLockCandidates(recoveryLockFile, recoveryLockKind, 'Task coordination recovery lock');
        return takeover;
      }
    } finally {
      releaseOwnedLock(recovery);
    }
  }
  throw new Error('Task registry is busy. Retry the command.');
}

function withLock(callback) {
  const ownership = acquireLock();
  try {
    const result = callback();
    const hold = Number(process.env.PREVISION_COORDINATION_TEST_HOLD_LOCK_MS || 0);
    if (Number.isFinite(hold) && hold > 0) wait(hold);
    return result;
  } finally {
    releaseOwnedLock(ownership);
  }
}

function unique(values) {
  return [...new Set(values)].sort();
}

function intersection(left, right) {
  const rightSet = new Set(right);
  return left.filter(value => rightSet.has(value));
}

function sameList(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function validateKnown(label, values, allowed) {
  const unknown = values.filter(value => !allowed.includes(value));
  if (unknown.length) throw new Error(`Unknown ${label}: ${unknown.join(', ')}. Use qa/task-scope-taxonomy.json.`);
}

function validateTaskId(taskId) {
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{1,119}$/.test(taskId)) {
    throw new Error('--task must be 2-120 safe identifier characters.');
  }
}

function validateSourceCommit(sourceCommit) {
  if (!/^[0-9a-f]{40}$/.test(sourceCommit)) {
    throw new Error('--source must be an exact lowercase 40-character Git commit.');
  }
}

function requireExistingCommit(commit, label) {
  validateSourceCommit(commit);
  try {
    const type = rawGit(['cat-file', '-t', commit], {
      cwd: gitRoot,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore']
    }).trim();
    if (type !== 'commit') throw new Error(`${label} must resolve to a Git commit object.`);
  } catch {
    throw new Error(`${label} must resolve to an existing Git commit object.`);
  }
}

function requireAncestor(ancestor, descendant, label) {
  try {
    rawGit(['merge-base', '--is-ancestor', ancestor, descendant], {
      cwd: gitRoot,
      stdio: 'ignore'
    });
  } catch {
    throw new Error(label);
  }
}

function stablePatchId(commit, label) {
  requireExistingCommit(commit, label);
  const parentCount = Number(rawGit(['rev-list', '--parents', '-n', '1', commit], {
    cwd: gitRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore']
  }).trim().split(/\s+/).length - 1);
  if (parentCount > 1) throw new Error(`${label} must not be a merge commit.`);
  const patch = rawGit([
    'show',
    '--pretty=format:',
    '--binary',
    '--no-ext-diff',
    commit
  ], {
    cwd: gitRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore']
  });
  const output = rawGit(['patch-id', '--stable'], {
    cwd: gitRoot,
    input: patch,
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'ignore']
  }).trim();
  const patchId = output.split(/\s+/)[0] || '';
  if (!/^[0-9a-f]{40}$/.test(patchId)) {
    throw new Error(`${label} must produce a stable non-empty patch-id.`);
  }
  return patchId;
}

function currentGitHead() {
  return rawGit(['rev-parse', 'HEAD'], {
    cwd: gitRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore']
  }).trim();
}

function currentGitBranch() {
  const branch = rawGit(['branch', '--show-current'], {
    cwd: gitRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore']
  }).trim();
  if (!branch) throw new Error('Central integration verification requires a named Git branch.');
  return branch;
}

function commitsBetween(ancestor, descendant) {
  requireAncestor(
    ancestor,
    descendant,
    'The claimed baseline must be an ancestor of the central integration HEAD.'
  );
  const output = rawGit(['rev-list', '--reverse', `${ancestor}..${descendant}`], {
    cwd: gitRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore']
  }).trim();
  return output ? output.split(/\r?\n/) : [];
}

function normalizeCommitList(raw, label) {
  const commits = String(raw || '').split(',').map(value => value.trim()).filter(Boolean);
  if (!commits.length) throw new Error(`${label} requires at least one exact Git commit.`);
  if (new Set(commits).size !== commits.length) {
    throw new Error(`${label} must not contain duplicate commits.`);
  }
  for (const commit of commits) requireExistingCommit(commit, label);
  return commits;
}

function validateTaskCommitChain(sourceCommit, commits, label) {
  let previous = sourceCommit;
  for (const commit of commits) {
    requireAncestor(previous, commit, `${label} must form an ordered descendant chain from the claimed baseline.`);
    if (previous === commit) throw new Error(`${label} must contain commits after the claimed baseline.`);
    previous = commit;
  }
}

function validateExactTaskCommitList(sourceCommit, taskHead, commits, label) {
  requireExistingCommit(taskHead, `${label} task HEAD`);
  validateTaskCommitChain(sourceCommit, commits, label);
  if (commits.at(-1) !== taskHead) {
    throw new Error(`${label} must end at the exact task HEAD.`);
  }
  const expected = commitsBetween(sourceCommit, taskHead);
  if (!sameList(commits, expected)) {
    throw new Error(`${label} must exactly equal the complete ordered baseline..task HEAD commit list.`);
  }
}

function validateFiles(files) {
  for (const file of files) {
    const segments = file.split(/[\\/]/);
    if (path.isAbsolute(file) || /^[A-Za-z]:[\\/]/.test(file) || forbiddenTextPattern.test(file) ||
      segments.includes('..') || segments.includes('.') || segments.includes('')) {
      throw new Error('--files must contain normalized repository-relative paths without parent traversal.');
    }
  }
}

function decodeGitPath(bytes, label) {
  let value;
  try {
    value = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    throw new Error(`${label} contains a path that is not valid UTF-8.`);
  }
  validateFiles([value]);
  return value;
}

function nulSeparatedGitPaths(argsList, directory = gitRoot, label = 'Git paths') {
  const output = rawGit(argsList, {
    cwd: directory,
    encoding: 'buffer',
    stdio: ['ignore', 'pipe', 'ignore']
  });
  const paths = [];
  let start = 0;
  for (let index = 0; index < output.length; index++) {
    if (output[index] !== 0) continue;
    if (index > start) paths.push(decodeGitPath(output.subarray(start, index), label));
    start = index + 1;
  }
  if (start !== output.length) {
    throw new Error(`${label} was not NUL terminated.`);
  }
  return paths;
}

function repositoryTreeEntries(commit, label) {
  requireExistingCommit(commit, label);
  const output = rawGit(['ls-tree', '-rz', '--full-tree', commit], {
    cwd: gitRoot,
    encoding: 'buffer',
    stdio: ['ignore', 'pipe', 'ignore']
  });
  const entries = new Map();
  let start = 0;
  for (let index = 0; index < output.length; index++) {
    if (output[index] !== 0) continue;
    const record = output.subarray(start, index);
    const tab = record.indexOf(9);
    if (tab <= 0) throw new Error(`${label} contains a malformed Git tree entry.`);
    const header = record.subarray(0, tab).toString('ascii');
    const match = /^(\d{6}) (blob|tree|commit) ([0-9a-f]{40,64})$/.exec(header);
    if (!match) throw new Error(`${label} contains a malformed Git tree entry header.`);
    const file = decodeGitPath(record.subarray(tab + 1), `${label} tree`);
    if (entries.has(file)) throw new Error(`${label} contains a duplicate Git tree path.`);
    entries.set(file, { mode: match[1], type: match[2], object: match[3] });
    start = index + 1;
  }
  if (start !== output.length) throw new Error(`${label} Git tree output was not NUL terminated.`);
  return entries;
}

function treeEntryIdentity(entry) {
  return entry ? `${entry.mode} ${entry.type} ${entry.object}` : '';
}

function commitBlobContent(entries, file, label) {
  const entry = entries.get(file);
  if (!entry || entry.type !== 'blob') throw new Error(`${label} must be a Git blob.`);
  const bytes = rawGit(['cat-file', 'blob', entry.object], {
    cwd: gitRoot,
    encoding: 'buffer',
    stdio: ['ignore', 'pipe', 'ignore']
  });
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    throw new Error(`${label} must contain valid UTF-8 text.`);
  }
}

function normalizeScope(scope) {
  const modules = unique(scope.modules || []);
  const uiSurfaces = unique(scope.uiSurfaces || []);
  const dataAreas = unique(scope.dataAreas || []);
  const files = unique(scope.files || []);
  validateKnown('module', modules, taxonomy.modules);
  validateKnown('UI surface', uiSurfaces, taxonomy.uiSurfaces);
  validateKnown('data area', dataAreas, taxonomy.dataAreas);
  validateFiles(files);
  return { modules, uiSurfaces, dataAreas, files };
}

const releaseScopeSnapshotKeys = [
  'taskId', 'title', 'branch', 'sourceCommit', 'owner',
  'modules', 'uiSurfaces', 'dataAreas', 'files'
];

function scopeSnapshotForClaim(claim) {
  return {
    taskId: claim.taskId,
    title: claim.title,
    branch: claim.branch,
    sourceCommit: claim.sourceCommit,
    owner: claim.owner,
    modules: [...claim.modules],
    uiSurfaces: [...claim.uiSurfaces],
    dataAreas: [...claim.dataAreas],
    files: [...claim.files]
  };
}

function scopeSnapshotFingerprint(snapshot) {
  return crypto.createHash('sha256')
    .update('prevision-release-scope-v1\0')
    .update(JSON.stringify(snapshot))
    .digest('hex');
}

function normalizeReleaseScopeSnapshot(item, taskId) {
  if (!hasOnlyKeys(item, releaseScopeSnapshotKeys) ||
    !releaseScopeSnapshotKeys.every(key => Object.hasOwn(item, key))) {
    throw new Error(`Malformed release scope snapshot for ${taskId}.`);
  }
  validateTaskId(item.taskId);
  if (item.taskId !== taskId) throw new Error(`Release scope snapshot task mismatch for ${taskId}.`);
  const owner = validateText(item.owner, `release scope owner for ${taskId}`, { max: 50 });
  if (owner !== 'legacy' && !allowedOwners.includes(owner)) {
    throw new Error(`Malformed release scope owner for ${taskId}.`);
  }
  requireExistingCommit(item.sourceCommit, `release scope source commit for ${taskId}`);
  return {
    taskId,
    title: validateText(item.title, `release scope title for ${taskId}`, { max: 200 }),
    branch: validateText(item.branch, `release scope branch for ${taskId}`, { max: 200 }),
    sourceCommit: item.sourceCommit,
    owner,
    ...normalizeScope(item)
  };
}

function validateDate(value, label) {
  if (typeof value !== 'string' || !Number.isFinite(Date.parse(value))) {
    throw new Error(`${label} must be an ISO date.`);
  }
}

function validateText(value, label, { required = true, max = 500 } = {}) {
  if (value === undefined || value === null || value === '') {
    if (required) throw new Error(`${label} must not be empty.`);
    return '';
  }
  if (typeof value !== 'string' || !value.trim() || value !== value.trim() ||
    value.length > max || forbiddenTextPattern.test(value)) {
    throw new Error(`${label} must be one canonical safe line without surrounding whitespace, no longer than ${max} characters.`);
  }
  return value;
}

function normalizeExternal(item = {}) {
  if (!item || typeof item !== 'object' || Array.isArray(item)) {
    throw new Error('Malformed external task mirror.');
  }
  const external = {
    clientId: validateText(item.clientId, 'external clientId', { required: false, max: 200 }),
    threadId: validateText(item.threadId, 'external threadId', { required: false, max: 200 }),
    rolloutState: item.rolloutState || 'unknown',
    threadRecordState: item.threadRecordState || 'unknown',
    sidebarState: item.sidebarState || 'unknown',
    nameState: item.nameState || 'unknown',
    turnState: item.turnState || 'not-started',
    turnOwner: item.turnOwner || 'unknown',
    executionVisibility: item.executionVisibility || defaultExecutionVisibility,
    desktopLiveObserved: item.desktopLiveObserved === true
  };
  if (item.desktopLiveObserved !== undefined && typeof item.desktopLiveObserved !== 'boolean') {
    throw new Error('Malformed Desktop live observation flag.');
  }
  if (!externalStates.rollout.includes(external.rolloutState)) {
    throw new Error(`Malformed rollout state: ${external.rolloutState}.`);
  }
  if (!externalStates.threadRecord.includes(external.threadRecordState)) {
    throw new Error(`Malformed thread record state: ${external.threadRecordState}.`);
  }
  if (!externalStates.sidebar.includes(external.sidebarState)) {
    throw new Error(`Malformed sidebar state: ${external.sidebarState}.`);
  }
  if (!externalStates.name.includes(external.nameState)) {
    throw new Error(`Malformed name state: ${external.nameState}.`);
  }
  if (!externalStates.turn.includes(external.turnState)) {
    throw new Error(`Malformed turn state: ${external.turnState}.`);
  }
  if (!externalStates.turnOwner.includes(external.turnOwner)) {
    throw new Error(`Malformed turn owner: ${external.turnOwner}.`);
  }
  if (!executionVisibilityStates.includes(external.executionVisibility)) {
    throw new Error(`Malformed execution visibility: ${external.executionVisibility}.`);
  }
  if (external.executionVisibility === 'DESKTOP_LIVE' &&
    (!external.clientId || !external.threadId ||
      !external.desktopLiveObserved || external.turnOwner !== 'desktop' ||
      external.turnState !== 'started' ||
      external.sidebarState !== 'present' ||
      external.rolloutState !== 'present' ||
      external.threadRecordState !== 'present' ||
      external.nameState !== 'set')) {
    throw new Error('DESKTOP_LIVE requires present rollout/thread/sidebar records, name=set, turnOwner=desktop, an observed started turn, and a present sidebar entry.');
  }
  if (external.executionVisibility !== 'DESKTOP_LIVE' && external.desktopLiveObserved) {
    throw new Error('Desktop live observation may only be true for DESKTOP_LIVE.');
  }
  external.dedupKey = external.threadId
    ? [external.clientId, external.threadId].filter(Boolean).join('/')
    : item.taskId;
  return external;
}

function normalizeHistoryEntry(item, taskId) {
  if (!item || typeof item !== 'object' || Array.isArray(item)) {
    throw new Error(`Malformed lifecycle history for ${taskId}.`);
  }
  if (item.from !== null && item.from !== undefined && !lifecycleStates.includes(item.from)) {
    throw new Error(`Malformed lifecycle history source for ${taskId}.`);
  }
  if (!lifecycleStates.includes(item.to)) throw new Error(`Malformed lifecycle history target for ${taskId}.`);
  validateDate(item.at, `lifecycle history time for ${taskId}`);
  const executionVisibility = item.executionVisibility || defaultExecutionVisibility;
  if (!executionVisibilityStates.includes(executionVisibility)) {
    throw new Error(`Malformed lifecycle history execution visibility for ${taskId}.`);
  }
  const turnState = item.turnState || 'unknown';
  const turnOwner = item.turnOwner || 'unknown';
  if (!externalStates.turn.includes(turnState)) {
    throw new Error(`Malformed lifecycle history turn state for ${taskId}.`);
  }
  if (!externalStates.turnOwner.includes(turnOwner)) {
    throw new Error(`Malformed lifecycle history turn owner for ${taskId}.`);
  }
  return {
    from: item.from ?? null,
    to: item.to,
    at: item.at,
    actor: validateText(item.actor, `lifecycle history actor for ${taskId}`),
    owner: validateText(item.owner, `lifecycle history owner for ${taskId}`),
    nextResponsible: validateText(item.nextResponsible, `lifecycle history next responsibility for ${taskId}`),
    reason: validateText(item.reason, `lifecycle history reason for ${taskId}`),
    executionVisibility,
    threadId: validateText(item.threadId, `lifecycle history thread id for ${taskId}`, {
      required: false,
      max: 200
    }),
    clientId: validateText(item.clientId, `lifecycle history client id for ${taskId}`, {
      required: false,
      max: 200
    }),
    turnState,
    turnOwner,
    stopVerified: item.stopVerified === true
  };
}

function normalizeStopVerification(item, taskId) {
  if (!item || typeof item !== 'object' || Array.isArray(item)) {
    throw new Error(`Malformed stop verification for ${taskId}.`);
  }
  validateDate(item.verifiedAt, `stop verification time for ${taskId}`);
  if (!['desktop', 'background'].includes(item.turnOwner)) {
    throw new Error(`Stop verification turn owner for ${taskId} must be desktop or background.`);
  }
  return {
    verifiedAt: item.verifiedAt,
    actor: validateText(item.actor, `stop verification actor for ${taskId}`, { max: 100 }),
    reason: validateText(item.reason, `stop verification reason for ${taskId}`, { max: 500 }),
    turnOwner: item.turnOwner,
    threadId: validateText(item.threadId, `stop verification thread id for ${taskId}`, {
      required: false,
      max: 200
    }),
    clientId: validateText(item.clientId, `stop verification client id for ${taskId}`, {
      required: false,
      max: 200
    })
  };
}

function normalizeReviewEvidence(item, taskId) {
  if (!item || typeof item !== 'object' || Array.isArray(item)) {
    throw new Error(`Malformed review evidence for ${taskId}.`);
  }
  validateDate(item.recordedAt, `review evidence time for ${taskId}`);
  requireExistingCommit(item.sourceCommit, `review source commit for ${taskId}`);
  if (!Array.isArray(item.taskCommits) || !Array.isArray(item.patchIds) ||
    item.taskCommits.length === 0 || item.taskCommits.length !== item.patchIds.length) {
    throw new Error(`Review evidence for ${taskId} must contain matching task commits and patch ids.`);
  }
  const taskCommits = item.taskCommits.map(commit => {
    requireExistingCommit(commit, `reviewed task commit for ${taskId}`);
    return commit;
  });
  const taskHead = item.taskHead || taskCommits.at(-1);
  validateExactTaskCommitList(
    item.sourceCommit,
    taskHead,
    taskCommits,
    `Review evidence for ${taskId}`
  );
  const patchIds = item.patchIds.map((patchId, index) => {
    if (!/^[0-9a-f]{40}$/.test(patchId) ||
      stablePatchId(taskCommits[index], `reviewed task commit for ${taskId}`) !== patchId) {
      throw new Error(`Review evidence patch id mismatch for ${taskId}.`);
    }
    return patchId;
  });
  const normalized = {
    recordedAt: item.recordedAt,
    recordedBy: validateText(item.recordedBy, `review recorder for ${taskId}`, { max: 100 }),
    sourceCommit: item.sourceCommit,
    taskHead,
    taskCommits,
    patchIds
  };
  if (item.acceptedAt !== undefined || item.acceptedBy !== undefined) {
    validateDate(item.acceptedAt, `review acceptance time for ${taskId}`);
    normalized.acceptedAt = item.acceptedAt;
    normalized.acceptedBy = validateText(item.acceptedBy, `review acceptance actor for ${taskId}`, {
      max: 100
    });
  }
  if (item.closeout !== undefined) {
    normalized.closeout = verifyMechanicalCloseoutEvidence(taskId, taskHead, item.closeout);
  }
  return normalized;
}

function validateHistoryContinuity(task) {
  if (!task.history.length) throw new Error(`Lifecycle history for ${task.taskId} must not be empty.`);
  for (let index = 0; index < task.history.length; index++) {
    const entry = task.history[index];
    if (entry.owner !== task.owner) {
      throw new Error(`Lifecycle history owner mismatch for ${task.taskId}.`);
    }
    if (index === 0) {
      if (entry.from !== null || entry.at !== task.createdAt) {
        throw new Error(`Lifecycle history for ${task.taskId} must begin at createdAt with from=null.`);
      }
    } else {
      const previous = task.history[index - 1];
      if (entry.from !== previous.to || !allowedTransitions[previous.to]?.includes(entry.to) ||
        Date.parse(entry.at) < Date.parse(previous.at)) {
        throw new Error(`Lifecycle history continuity is invalid for ${task.taskId}.`);
      }
      const previousThread = previous.threadId;
      const previousClient = previous.clientId;
      if (previousThread && entry.threadId !== previousThread) {
        throw new Error(`Canonical thread history cannot be cleared or replaced for ${task.taskId}.`);
      }
      if (previousClient && entry.clientId !== previousClient) {
        throw new Error(`Canonical client history cannot be cleared or replaced for ${task.taskId}.`);
      }
    }
  }
  const last = task.history.at(-1);
  if (last.to !== task.state || last.at !== task.stateUpdatedAt ||
    last.actor !== task.lastActor || last.nextResponsible !== task.nextResponsible ||
    last.reason !== task.reason ||
    last.executionVisibility !== task.external.executionVisibility ||
    last.threadId !== task.external.threadId ||
    last.clientId !== task.external.clientId ||
    last.turnState !== task.external.turnState ||
    last.turnOwner !== task.external.turnOwner ||
    last.stopVerified !== Boolean(task.stopVerification)) {
    throw new Error(`Lifecycle history tail does not match current task state for ${task.taskId}.`);
  }
  if (terminalStates.includes(task.state)) {
    const releaseEntry = task.history.find(entry => entry.to === 'RELEASED');
    if (!releaseEntry || !task.release || releaseEntry.at !== task.release.releasedAt ||
      releaseEntry.actor !== task.release.actor) {
      throw new Error(`Terminal lifecycle history does not match release evidence for ${task.taskId}.`);
    }
  }
}

function normalizeTaskRecord(item, { legacyPreview = false } = {}) {
  if (!item || typeof item !== 'object' || Array.isArray(item)) throw new Error('Malformed task lifecycle record.');
  validateTaskId(item.taskId);
  const title = validateText(item.title, `title for lifecycle ${item.taskId}`, { max: 200 });
  const owner = validateText(item.owner, `owner for lifecycle ${item.taskId}`, { max: 50 });
  if (owner !== 'legacy' && !allowedOwners.includes(owner)) {
    throw new Error(`Malformed owner for lifecycle ${item.taskId}.`);
  }
  if (!lifecycleStates.includes(item.state)) throw new Error(`Malformed lifecycle state for ${item.taskId}.`);
  validateDate(item.createdAt, `createdAt for lifecycle ${item.taskId}`);
  validateDate(item.stateUpdatedAt, `stateUpdatedAt for lifecycle ${item.taskId}`);
  const external = normalizeExternal({ taskId: item.taskId, ...(item.external || {}) });
  const history = Array.isArray(item.history)
    ? item.history.map((entry, index) => normalizeHistoryEntry({
      ...entry,
      ...(index === item.history.length - 1 && entry.threadId === undefined
        ? { threadId: external.threadId }
        : {}),
      ...(index === item.history.length - 1 && entry.clientId === undefined
        ? { clientId: external.clientId }
        : {}),
      ...(index === item.history.length - 1 && entry.turnState === undefined
        ? { turnState: external.turnState }
        : {}),
      ...(index === item.history.length - 1 && entry.turnOwner === undefined
        ? { turnOwner: external.turnOwner }
        : {}),
      ...(index === item.history.length - 1 && entry.stopVerified === undefined
        ? { stopVerified: Boolean(item.stopVerification) }
        : {})
    }, item.taskId))
    : (() => { throw new Error(`Malformed lifecycle history for ${item.taskId}.`); })();
  const normalized = {
    taskId: item.taskId,
    title,
    owner,
    state: item.state,
    createdAt: item.createdAt,
    stateUpdatedAt: item.stateUpdatedAt,
    lastActor: validateText(item.lastActor, `last actor for ${item.taskId}`),
    nextResponsible: validateText(item.nextResponsible, `next responsibility for ${item.taskId}`),
    reason: validateText(item.reason, `reason for ${item.taskId}`),
    external,
    history
  };
  if (item.stopVerification !== undefined && item.stopVerification !== null) {
    normalized.stopVerification = normalizeStopVerification(item.stopVerification, item.taskId);
    if (external.turnState !== 'completed' ||
      external.turnOwner !== normalized.stopVerification.turnOwner ||
      external.threadId !== normalized.stopVerification.threadId ||
      external.clientId !== normalized.stopVerification.clientId) {
      throw new Error(`Stop verification no longer matches the canonical completed turn for ${item.taskId}.`);
    }
  }
  if (item.reviewEvidence !== undefined && item.reviewEvidence !== null) {
    normalized.reviewEvidence = normalizeReviewEvidence(item.reviewEvidence, item.taskId);
  }
  if (item.release !== undefined) {
    if (!item.release || typeof item.release !== 'object' || Array.isArray(item.release)) {
      throw new Error(`Malformed release evidence for ${item.taskId}.`);
    }
    validateDate(item.release.releasedAt, `release time for ${item.taskId}`);
    const outcome = item.release.outcome;
    if (!['integrated', 'cancelled'].includes(outcome)) {
      throw new Error(`Malformed release outcome for ${item.taskId}.`);
    }
    normalized.release = {
      outcome,
      releasedAt: item.release.releasedAt,
      actor: validateText(item.release.actor, `release actor for ${item.taskId}`),
      sourceCommit: validateText(item.release.sourceCommit, `release source commit for ${item.taskId}`, {
        required: outcome !== 'cancelled',
        max: 40
      }),
      integrationCommit: validateText(item.release.integrationCommit, `integration commit for ${item.taskId}`, {
        required: outcome !== 'cancelled',
        max: 40
      }),
      integrationBranch: validateText(item.release.integrationBranch, `integration branch for ${item.taskId}`, {
        required: outcome !== 'cancelled',
        max: 200
      }),
      finalRegression: validateText(item.release.finalRegression, `final regression for ${item.taskId}`, {
        required: outcome !== 'cancelled',
        max: 20
      })
    };
    if (item.release.scopeSnapshot !== undefined || item.release.scopeFingerprint !== undefined) {
      const scopeSnapshot = normalizeReleaseScopeSnapshot(item.release.scopeSnapshot, item.taskId);
      const scopeFingerprint = validateText(
        item.release.scopeFingerprint,
        `release scope fingerprint for ${item.taskId}`,
        { max: 64 }
      );
      if (!/^[0-9a-f]{64}$/.test(scopeFingerprint) ||
        scopeSnapshotFingerprint(scopeSnapshot) !== scopeFingerprint) {
        throw new Error(`Release scope fingerprint mismatch for ${item.taskId}.`);
      }
      normalized.release.scopeSnapshot = scopeSnapshot;
      normalized.release.scopeFingerprint = scopeFingerprint;
    }
    if (normalized.release.sourceCommit &&
      !/^[0-9a-f]{40}$/.test(normalized.release.sourceCommit)) {
      throw new Error(`Malformed release source commit for ${item.taskId}.`);
    }
    if (normalized.release.integrationCommit &&
      !/^[0-9a-f]{40}$/.test(normalized.release.integrationCommit)) {
      throw new Error(`Malformed integration commit for ${item.taskId}.`);
    }
    if (outcome === 'integrated') {
      requireExistingCommit(normalized.release.sourceCommit, `release source commit for ${item.taskId}`);
      requireExistingCommit(normalized.release.integrationCommit, `integration commit for ${item.taskId}`);
    }
    if (outcome === 'integrated') {
      if (!Array.isArray(item.release.taskCommits) ||
        !Array.isArray(item.release.reviewedTaskCommits) ||
        !Array.isArray(item.release.integrationMap) ||
        item.release.taskCommits.length === 0 ||
        item.release.taskCommits.length !== item.release.integrationMap.length) {
        throw new Error(`Integrated release mapping for ${item.taskId} is incomplete.`);
      }
      normalized.release.reviewedTaskCommits = item.release.reviewedTaskCommits.map(commit => {
        requireExistingCommit(commit, `released reviewed task commit for ${item.taskId}`);
        return commit;
      });
      normalized.release.taskCommits = item.release.taskCommits.map(commit => {
        requireExistingCommit(commit, `released task commit for ${item.taskId}`);
        return commit;
      });
      normalized.release.integrationMap = item.release.integrationMap.map((mapping, index) => {
        if (!mapping || typeof mapping !== 'object' || Array.isArray(mapping)) {
          throw new Error(`Malformed integration mapping for ${item.taskId}.`);
        }
        const taskCommit = normalized.release.taskCommits[index];
        if (mapping.taskCommit !== taskCommit ||
          mapping.taskPatchId !== stablePatchId(taskCommit, `released task commit for ${item.taskId}`)) {
          throw new Error(`Integration mapping task evidence mismatch for ${item.taskId}.`);
        }
        requireExistingCommit(mapping.integrationCommit, `mapped integration commit for ${item.taskId}`);
        const integrationPatchId = stablePatchId(
          mapping.integrationCommit,
          `mapped integration commit for ${item.taskId}`
        );
        if (mapping.integrationPatchId !== integrationPatchId ||
          mapping.taskPatchId !== integrationPatchId) {
          throw new Error(`Integration patch-id mapping mismatch for ${item.taskId}.`);
        }
        requireAncestor(
          mapping.integrationCommit,
          normalized.release.integrationCommit,
          `Mapped integration commit must be contained in integration HEAD for ${item.taskId}.`
        );
        return {
          taskCommit,
          taskPatchId: mapping.taskPatchId,
          integrationCommit: mapping.integrationCommit,
          integrationPatchId
        };
      });
    }
    normalized.release.cancelConfirmed = item.release.cancelConfirmed === true;
    if (normalized.release.actor !== '00') {
      throw new Error(`Release actor for ${item.taskId} must be 00.`);
    }
    if (outcome === 'integrated' &&
      (!normalized.release.sourceCommit || !normalized.release.taskCommits ||
        !normalized.release.integrationCommit ||
        !normalized.release.integrationBranch ||
        normalized.release.finalRegression !== 'passed')) {
      throw new Error(`Integrated release evidence for ${item.taskId} is incomplete.`);
    }
    if (outcome === 'integrated') {
      validateTaskCommitChain(
        normalized.release.sourceCommit,
        normalized.release.taskCommits,
        `Released task commits for ${item.taskId}`
      );
      requireAncestor(
        normalized.release.sourceCommit,
        normalized.release.integrationCommit,
        `Release evidence for ${item.taskId} requires the claimed baseline to be an ancestor of integration HEAD.`
      );
      if (!normalized.reviewEvidence?.acceptedAt ||
        normalized.reviewEvidence.sourceCommit !== normalized.release.sourceCommit ||
        !sameList(normalized.reviewEvidence.taskCommits, normalized.release.reviewedTaskCommits) ||
        !sameList(acceptedTaskCommits(normalized.reviewEvidence), normalized.release.taskCommits)) {
        throw new Error(`Integrated release evidence for ${item.taskId} must be bound to the accepted review commit list.`);
      }
      const expectedMapping = integrationMapping(
        normalized.release.sourceCommit,
        normalized.release.taskCommits,
        normalized.release.integrationCommit
      );
      if (JSON.stringify(expectedMapping) !== JSON.stringify(normalized.release.integrationMap)) {
        throw new Error(`Integrated release mapping for ${item.taskId} is not the complete ordered one-to-one mapping.`);
      }
    }
    if (outcome === 'cancelled' && !normalized.release.cancelConfirmed) {
      throw new Error(`Cancelled release evidence for ${item.taskId} is incomplete.`);
    }
  }
  if (['REVIEW', 'HANDED_OFF', 'INTEGRATING'].includes(normalized.state) &&
    !normalized.reviewEvidence) {
    throw new Error(`${normalized.state} lifecycle ${item.taskId} requires reviewed task commit evidence.`);
  }
  if (['HANDED_OFF', 'INTEGRATING'].includes(normalized.state) &&
    !normalized.reviewEvidence?.acceptedAt) {
    throw new Error(`${normalized.state} lifecycle ${item.taskId} requires accepted review evidence.`);
  }
  if (['REVIEW', 'HANDED_OFF', 'INTEGRATING', ...terminalStates].includes(normalized.state) &&
    (!normalized.stopVerification || external.turnState !== 'completed')) {
    throw new Error(`${normalized.state} lifecycle ${item.taskId} requires a persisted completed-turn stop verification.`);
  }
  if (normalized.state === 'ARCHIVED' &&
    (external.sidebarState !== 'absent' ||
      external.rolloutState !== 'present' ||
      external.threadRecordState !== 'present' ||
      external.nameState !== 'set')) {
    throw new Error(`ARCHIVED lifecycle ${item.taskId} requires retained rollout/thread/name evidence and a verified absent sidebar entry.`);
  }
  if (!legacyPreview && !terminalStates.includes(normalized.state) && normalized.owner !== 'legacy' &&
    ['WAITING', 'ACTIVE', 'REVIEW', 'HANDED_OFF', 'INTEGRATING'].includes(normalized.state) &&
    (!external.threadId || !external.clientId)) {
    throw new Error(`Non-terminal lifecycle ${item.taskId} must retain its canonical thread and client identifiers.`);
  }
  validateHistoryContinuity(normalized);
  return normalized;
}

function normalizeClaim(item, legacySchema = false) {
  if (!item || typeof item !== 'object' || Array.isArray(item)) throw new Error('Malformed task claim.');
  validateTaskId(item.taskId);
  if (!['read', 'write'].includes(item.mode)) throw new Error(`Malformed mode for claim ${item.taskId}.`);
  const title = validateText(item.title, `title for claim ${item.taskId}`, { max: 200 });
  const branch = validateText(item.branch, `branch for claim ${item.taskId}`, { max: 200 });
  requireExistingCommit(item.sourceCommit, `source commit for claim ${item.taskId}`);
  validateDate(item.updatedAt, `updatedAt for claim ${item.taskId}`);
  const scope = normalizeScope(item);
  const legacy = item.mode === 'write' && (legacySchema || item.legacy === true || !item.owner);
  const owner = legacy ? 'legacy' : (item.owner || 'reviewer');
  if (item.mode === 'write' && owner !== 'legacy' && !allowedOwners.includes(owner)) {
    throw new Error(`Malformed owner for claim ${item.taskId}.`);
  }
  if (item.reservationTokenHash !== undefined && !/^[0-9a-f]{64}$/i.test(item.reservationTokenHash)) {
    throw new Error(`Malformed reservation token hash for claim ${item.taskId}.`);
  }
  if (item.reservationId !== undefined &&
    !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(item.reservationId)) {
    throw new Error(`Malformed reservation id for claim ${item.taskId}.`);
  }
  return {
    taskId: item.taskId,
    title,
    branch,
    sourceCommit: item.sourceCommit,
    mode: item.mode,
    owner,
    legacy,
    ...scope,
    updatedAt: item.updatedAt,
    ...(item.reservationId ? { reservationId: item.reservationId } : {}),
    ...(item.reservationTokenHash ? { reservationTokenHash: item.reservationTokenHash } : {})
  };
}

function normalizeReservation(item) {
  if (!item || typeof item !== 'object' || Array.isArray(item)) throw new Error('Malformed task reservation.');
  validateTaskId(item.taskId);
  const title = validateText(item.title, `title for reservation ${item.taskId}`, { max: 200 });
  if (!allowedOwners.includes(item.owner)) throw new Error(`Malformed owner for reservation ${item.taskId}.`);
  requireExistingCommit(item.sourceCommit, `source commit for reservation ${item.taskId}`);
  if (typeof item.reservationId !== 'string' ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(item.reservationId)) {
    throw new Error(`Malformed reservation id for ${item.taskId}.`);
  }
  if (!/^[0-9a-f]{64}$/i.test(item.tokenHash)) throw new Error(`Malformed token hash for reservation ${item.taskId}.`);
  if (item.requestKeyHash !== undefined && !/^[0-9a-f]{64}$/i.test(item.requestKeyHash)) {
    throw new Error(`Malformed request key hash for reservation ${item.taskId}.`);
  }
  const tokenGeneration = item.tokenGeneration === undefined ? 1 : item.tokenGeneration;
  if (!Number.isInteger(tokenGeneration) || tokenGeneration < 1) {
    throw new Error(`Malformed token generation for reservation ${item.taskId}.`);
  }
  validateDate(item.createdAt, `createdAt for reservation ${item.taskId}`);
  validateDate(item.expiresAt, `expiresAt for reservation ${item.taskId}`);
  if (Date.parse(item.expiresAt) <= Date.parse(item.createdAt)) {
    throw new Error(`Reservation ${item.taskId} must expire after creation.`);
  }
  return {
    reservationId: item.reservationId,
    tokenHash: item.tokenHash,
    ...(item.requestKeyHash ? { requestKeyHash: item.requestKeyHash } : {}),
    tokenGeneration,
    taskId: item.taskId,
    title,
    owner: item.owner,
    sourceCommit: item.sourceCommit,
    ...normalizeScope(item),
    createdAt: item.createdAt,
    expiresAt: item.expiresAt
  };
}

function synthesizeTaskRecord(item, state) {
  const timestamp = item.createdAt || item.updatedAt;
  const owner = item.owner || 'legacy';
  const external = normalizeExternal({ taskId: item.taskId });
  const reason = owner === 'legacy'
    ? 'Legacy active claim migrated without changing ownership or slot occupancy.'
    : 'Reservation migrated without changing token, TTL, scope, or slot occupancy.';
  return {
    taskId: item.taskId,
    title: item.title,
    owner,
    state,
    createdAt: timestamp,
    stateUpdatedAt: timestamp,
    lastActor: owner === 'legacy' ? 'legacy-migration' : owner,
    nextResponsible: state === 'RESERVED' ? `${owner}-sidebar-create` : `${owner}-worker`,
    reason,
    external,
    history: [{
      from: null,
      to: state,
      at: timestamp,
      actor: owner === 'legacy' ? 'legacy-migration' : owner,
      owner,
      nextResponsible: state === 'RESERVED' ? `${owner}-sidebar-create` : `${owner}-worker`,
      reason,
      executionVisibility: external.executionVisibility,
      threadId: external.threadId,
      clientId: external.clientId,
      turnState: external.turnState,
      turnOwner: external.turnOwner,
      stopVerified: false
    }]
  };
}

function normalizeIntegrityIssue(item) {
  if (!item || typeof item !== 'object' || Array.isArray(item)) {
    throw new Error('Malformed task registry integrity issue.');
  }
  validateTaskId(item.taskId);
  if (!['legacy-release-lifecycle-orphan', 'reservation-cancellation-tombstone'].includes(item.type)) {
    throw new Error(`Malformed task registry integrity issue type for ${item.taskId}.`);
  }
  if (item.type === 'legacy-release-lifecycle-orphan' && !claimStates.includes(item.previousState)) {
    throw new Error(`Malformed task registry integrity issue state for ${item.taskId}.`);
  }
  if (item.type === 'reservation-cancellation-tombstone' &&
    !reservationStates.includes(item.previousState)) {
    throw new Error(`Malformed task registry cancellation state for ${item.taskId}.`);
  }
  validateDate(item.observedAt, `integrity issue time for ${item.taskId}`);
  const normalized = {
    type: item.type,
    taskId: item.taskId,
    title: validateText(item.title, `integrity issue title for ${item.taskId}`, { max: 200 }),
    owner: validateText(item.owner, `integrity issue owner for ${item.taskId}`, { max: 50 }),
    previousState: item.previousState,
    observedAt: item.observedAt,
    reason: validateText(item.reason, `integrity issue reason for ${item.taskId}`)
  };
  if (item.type === 'reservation-cancellation-tombstone') {
    normalized.actor = validateText(item.actor, `cancellation actor for ${item.taskId}`, { max: 100 });
    normalized.evidence = validateText(item.evidence, `cancellation evidence for ${item.taskId}`, { max: 500 });
    normalized.reservationId = validateText(
      item.reservationId,
      `cancelled reservation id for ${item.taskId}`,
      { max: 36 }
    );
    if (item.requestKeyHash !== undefined) {
      if (!/^[0-9a-f]{64}$/i.test(item.requestKeyHash)) {
        throw new Error(`Malformed cancelled request key hash for ${item.taskId}.`);
      }
      normalized.requestKeyHash = item.requestKeyHash;
    }
  }
  if (item.resolvedAt !== undefined || item.resolvedBy !== undefined ||
    item.resolutionReason !== undefined || item.stopEvidence !== undefined) {
    if (item.type !== 'legacy-release-lifecycle-orphan') {
      throw new Error(`Only orphan integrity issues may be resolved for ${item.taskId}.`);
    }
    validateDate(item.resolvedAt, `integrity issue resolution time for ${item.taskId}`);
    normalized.resolvedAt = item.resolvedAt;
    normalized.resolvedBy = validateText(item.resolvedBy, `integrity issue resolver for ${item.taskId}`, {
      max: 100
    });
    if (normalized.resolvedBy !== '00') {
      throw new Error(`Integrity issue ${item.taskId} may only be resolved by 00.`);
    }
    normalized.resolutionReason = validateText(
      item.resolutionReason,
      `integrity issue resolution reason for ${item.taskId}`,
      { max: 500 }
    );
    normalized.stopEvidence = validateText(
      item.stopEvidence,
      `integrity issue stop evidence for ${item.taskId}`,
      { max: 500 }
    );
  }
  return normalized;
}

function migrationIssueForOrphan(task) {
  return normalizeIntegrityIssue({
    type: 'legacy-release-lifecycle-orphan',
    taskId: task.taskId,
    title: task.title,
    owner: task.owner,
    previousState: task.state,
    observedAt: task.stateUpdatedAt,
    reason: 'A pre-v3 script removed the write claim without lifecycle release evidence; preserved as an unresolved integrity issue that blocks new reservations.'
  });
}

function ensureRegistryConsistency(registry) {
  const taskIds = [...registry.claims, ...registry.reservations].map(item => item.taskId);
  if (new Set(taskIds).size !== taskIds.length) {
    throw new Error('Task registry contains duplicate task identifiers.');
  }
  const lifecycleTaskIds = registry.tasks.map(item => item.taskId);
  if (new Set(lifecycleTaskIds).size !== lifecycleTaskIds.length) {
    throw new Error('Task registry contains duplicate lifecycle identifiers.');
  }
  const issueKeys = registry.integrityIssues.map(item =>
    `${item.type}:${item.taskId}:${item.reservationId || ''}`);
  if (new Set(issueKeys).size !== issueKeys.length) {
    throw new Error('Task registry contains duplicate integrity issue identifiers.');
  }
  const blockingIssueTaskIds = registry.integrityIssues
    .filter(item => item.type === 'legacy-release-lifecycle-orphan' && !item.resolvedAt)
    .map(item => item.taskId);
  if (blockingIssueTaskIds.some(taskId =>
    lifecycleTaskIds.includes(taskId) || taskIds.includes(taskId))) {
    throw new Error('Unresolved active-orphan integrity issues must not overlap active reservations, claims, or lifecycle tasks.');
  }
  for (const reservation of registry.reservations) {
    const task = registry.tasks.find(item => item.taskId === reservation.taskId);
    if (!task || !reservationStates.includes(task.state)) {
      throw new Error(`Reservation ${reservation.taskId} must have a RESERVED or WAITING lifecycle record.`);
    }
    if (task.owner !== reservation.owner || task.title !== reservation.title) {
      throw new Error(`Reservation ${reservation.taskId} lifecycle identity does not match.`);
    }
    if (task.state === 'WAITING' && task.external.executionVisibility !== 'WAITING') {
      throw new Error(`WAITING lifecycle ${reservation.taskId} must use WAITING execution visibility.`);
    }
  }
  for (const claim of registry.claims.filter(item => item.mode === 'write')) {
    const task = registry.tasks.find(item => item.taskId === claim.taskId);
    if (!task || !claimStates.includes(task.state)) {
      throw new Error(`Write claim ${claim.taskId} must have an active lifecycle record.`);
    }
    if (task.owner !== claim.owner || task.title !== claim.title) {
      throw new Error(`Write claim ${claim.taskId} lifecycle identity does not match.`);
    }
  }
  for (const task of registry.tasks) {
    const reservation = registry.reservations.find(item => item.taskId === task.taskId);
    const claim = registry.claims.find(item => item.taskId === task.taskId && item.mode === 'write');
    if (reservationStates.includes(task.state) && !reservation) {
      throw new Error(`Lifecycle ${task.taskId} is ${task.state} without a reservation.`);
    }
    if (claimStates.includes(task.state) && !claim) {
      throw new Error(`Lifecycle ${task.taskId} is ${task.state} without a write claim.`);
    }
    if (terminalStates.includes(task.state) && (reservation || claim)) {
      throw new Error(`Terminal lifecycle ${task.taskId} must not occupy a write slot.`);
    }
    if (terminalStates.includes(task.state) && !task.release) {
      throw new Error(`Terminal lifecycle ${task.taskId} requires release outcome evidence.`);
    }
    if (!terminalStates.includes(task.state) && task.release) {
      throw new Error(`Non-terminal lifecycle ${task.taskId} must not contain release evidence.`);
    }
    if (terminalStates.includes(task.state) &&
      task.external.executionVisibility === 'DESKTOP_LIVE') {
      throw new Error(`Terminal lifecycle ${task.taskId} must not remain DESKTOP_LIVE.`);
    }
  }
  const canonicalThreads = new Map();
  for (const task of registry.tasks.filter(item => !terminalStates.includes(item.state))) {
    const threadId = task.external.threadId;
    if (!threadId) continue;
    const existingTaskId = canonicalThreads.get(threadId);
    if (existingTaskId && existingTaskId !== task.taskId) {
      throw new Error(
        `Canonical thread ${threadId} is reused by active tasks ${existingTaskId} and ${task.taskId}.`
      );
    }
    canonicalThreads.set(threadId, task.taskId);
  }
}

function hasOnlyKeys(value, allowed) {
  return value && typeof value === 'object' && !Array.isArray(value) &&
    Object.keys(value).every(key => allowed.includes(key));
}

function validateCloseoutScopeBindings(registry) {
  for (const task of registry.tasks) {
    const closeout = task.reviewEvidence?.closeout;
    if (!closeout) continue;
    const claim = registry.claims.find(item => item.mode === 'write' && item.taskId === task.taskId);
    if (claim) {
      verifyMechanicalCloseoutEvidence(
        task.taskId,
        task.reviewEvidence.taskHead,
        closeout,
        { claim }
      );
      continue;
    }
    if (!terminalStates.includes(task.state) || !task.release?.scopeSnapshot ||
      !task.release.scopeFingerprint ||
      scopeSnapshotFingerprint(task.release.scopeSnapshot) !== task.release.scopeFingerprint) {
      throw new Error(`Mechanical closeout evidence for ${task.taskId} is not bound to an active claim or immutable release scope snapshot.`);
    }
    verifyMechanicalCloseoutEvidence(
      task.taskId,
      task.reviewEvidence.taskHead,
      closeout,
      { claim: task.release.scopeSnapshot }
    );
  }
}

function readRegistry() {
  const registryStat = lstatIfPresent(registryFile);
  if (!registryStat) return emptyRegistry();
  assertSecureRegularFile(registryFile, 'Task registry');
  let parsed;
  try {
    parsed = JSON.parse(fs.readFileSync(registryFile, 'utf8'));
  } catch {
    throw new Error('Task registry is malformed; refusing to continue.');
  }
  let registry;
  let needsLifecycleMigration = false;
  if (parsed?.schemaVersion === registrySchemaVersion) {
    if (parsed.coordinationVersion !== coordinationVersion ||
      typeof parsed.revision !== 'string' ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(parsed.revision) ||
      typeof parsed.updatedAt !== 'string' || !Number.isFinite(Date.parse(parsed.updatedAt)) ||
      !Array.isArray(parsed.claims) ||
      !Array.isArray(parsed.reservations) ||
      !Array.isArray(parsed.tasks) ||
      !Array.isArray(parsed.integrityIssues)) {
      throw new Error('Malformed coordinationVersion 3 task registry; refusing to continue.');
    }
    registry = {
      schemaVersion: registrySchemaVersion,
      coordinationVersion,
      revision: parsed.revision,
      updatedAt: parsed.updatedAt,
      claims: parsed.claims.map(item => normalizeClaim(item)),
      reservations: parsed.reservations.map(item => normalizeReservation(item)),
      tasks: parsed.tasks.map(item => normalizeTaskRecord(item)),
      integrityIssues: parsed.integrityIssues.map(item => normalizeIntegrityIssue(item))
    };
  } else if (parsed?.schemaVersion === 1 &&
    parsed.coordinationVersion === undefined &&
    Array.isArray(parsed.claims) &&
    hasOnlyKeys(parsed, ['schemaVersion', 'claims']) &&
    !Object.hasOwn(parsed, 'reservations') &&
    !Object.hasOwn(parsed, 'tasks')) {
    registry = {
      ...emptyRegistry(),
      coordinationVersion,
      claims: parsed.claims.map(item => normalizeClaim(item, true)),
    };
    needsLifecycleMigration = true;
  } else if (parsed?.schemaVersion === 1 &&
    parsed.coordinationVersion === coordinationVersion &&
    Array.isArray(parsed.claims) &&
    Array.isArray(parsed.reservations) &&
    Array.isArray(parsed.tasks) &&
    hasOnlyKeys(parsed, [
      'schemaVersion', 'coordinationVersion', 'claims', 'reservations', 'tasks', 'integrityIssues'
    ]) &&
    (parsed.integrityIssues === undefined || Array.isArray(parsed.integrityIssues))) {
    registry = {
      ...emptyRegistry(),
      coordinationVersion,
      claims: parsed.claims.map(item => normalizeClaim(item)),
      reservations: parsed.reservations.map(item => normalizeReservation(item)),
      tasks: parsed.tasks.map(item => normalizeTaskRecord(item, { legacyPreview: true })),
      integrityIssues: (parsed.integrityIssues || []).map(item => normalizeIntegrityIssue(item))
    };
    for (const task of [...registry.tasks]) {
      const hasClaim = registry.claims.some(item => item.mode === 'write' && item.taskId === task.taskId);
      if (claimStates.includes(task.state) && !hasClaim) {
        registry.tasks = registry.tasks.filter(item => item !== task);
        if (!registry.integrityIssues.some(item => item.taskId === task.taskId)) {
          registry.integrityIssues.push(migrationIssueForOrphan(task));
        }
      }
    }
  } else if (parsed?.schemaVersion === 2 &&
    Array.isArray(parsed.claims) &&
    Array.isArray(parsed.reservations) &&
    hasOnlyKeys(parsed, ['schemaVersion', 'claims', 'reservations']) &&
    !Object.hasOwn(parsed, 'tasks')) {
    registry = {
      ...emptyRegistry(),
      coordinationVersion,
      claims: parsed.claims.map(item => normalizeClaim(item)),
      reservations: parsed.reservations.map(item => normalizeReservation(item)),
    };
    needsLifecycleMigration = true;
  } else if (parsed?.schemaVersion === 1 &&
    parsed.coordinationVersion === 2 &&
    Array.isArray(parsed.claims) &&
    Array.isArray(parsed.reservations) &&
    hasOnlyKeys(parsed, ['schemaVersion', 'coordinationVersion', 'claims', 'reservations']) &&
    !Object.hasOwn(parsed, 'tasks')) {
    registry = {
      ...emptyRegistry(),
      coordinationVersion,
      claims: parsed.claims.map(item => normalizeClaim(item)),
      reservations: parsed.reservations.map(item => normalizeReservation(item))
    };
    needsLifecycleMigration = true;
  } else {
    throw new Error('Unsupported or malformed task registry schema.');
  }
  if (needsLifecycleMigration) {
    for (const claim of registry.claims.filter(item => item.mode === 'write')) {
      if (!registry.tasks.some(item => item.taskId === claim.taskId)) {
        registry.tasks.push(synthesizeTaskRecord(claim, 'ACTIVE'));
      }
    }
    for (const reservation of registry.reservations) {
      if (!registry.tasks.some(item => item.taskId === reservation.taskId)) {
        registry.tasks.push(synthesizeTaskRecord(reservation, 'RESERVED'));
      }
    }
  }
  validateCloseoutScopeBindings(registry);
  ensureRegistryConsistency(registry);
  return registry;
}

function writeRegistry(registry) {
  validateCloseoutScopeBindings(registry);
  ensureRegistryConsistency(registry);
  if (lstatIfPresent(registryFile)) assertSecureRegularFile(registryFile, 'Task registry');
  fs.mkdirSync(path.dirname(registryFile), { recursive: true });
  const temporary = `${registryFile}.${process.pid}.${crypto.randomBytes(6).toString('hex')}.tmp`;
  const revision = crypto.randomUUID();
  const updatedAt = new Date().toISOString();
  registry.schemaVersion = registrySchemaVersion;
  registry.coordinationVersion = coordinationVersion;
  registry.revision = revision;
  registry.updatedAt = updatedAt;
  const payload = `${JSON.stringify({
    schemaVersion: registrySchemaVersion,
    coordinationVersion,
    revision,
    updatedAt,
    claims: registry.claims,
    reservations: registry.reservations,
    tasks: registry.tasks,
    integrityIssues: registry.integrityIssues
  }, null, 2)}\n`;
  let descriptor;
  let renamed = false;
  try {
    descriptor = fs.openSync(temporary, 'wx', 0o600);
    const temporaryStat = fs.fstatSync(descriptor);
    if ((temporaryStat.mode & 0o777) !== 0o600) {
      throw new Error('Task registry temporary file permissions must be 0600.');
    }
    fs.writeFileSync(descriptor, payload);
    fs.fsyncSync(descriptor);
    fs.closeSync(descriptor);
    descriptor = undefined;
    fs.renameSync(temporary, registryFile);
    renamed = true;
    assertSecureRegularFile(registryFile, 'Task registry');
    const directory = fs.openSync(path.dirname(registryFile), 'r');
    try {
      if (process.env.PREVISION_COORDINATION_TEST_FAIL_DIRECTORY_FSYNC === 'yes') {
        const injected = new Error('Injected directory fsync failure after registry rename.');
        injected.code = 'EIO';
        throw injected;
      }
      fs.fsyncSync(directory);
    } finally {
      fs.closeSync(directory);
    }
    return { status: 'confirmed', revision, updatedAt };
  } catch (error) {
    if (descriptor !== undefined) fs.closeSync(descriptor);
    try { fs.unlinkSync(temporary); } catch { /* no temporary file to clean */ }
    if (renamed) {
      try {
        assertSecureRegularFile(registryFile, 'Task registry');
        if (fs.readFileSync(registryFile, 'utf8') === payload) {
          return {
            status: 'uncertain',
            revision,
            updatedAt,
            warning: 'Registry rename is visible but directory fsync failed; query task:status by revision before retrying.'
          };
        }
      } catch {
        // Fall through to the original persistence failure.
      }
    }
    throw error;
  }
}

function buildTaskSpec({ requireOwner = false } = {}) {
  const taskId = option('task');
  if (!taskId) throw new Error('Missing --task <task-id>.');
  validateTaskId(taskId);
  const mode = option('mode', 'write');
  if (!['read', 'write'].includes(mode)) throw new Error('--mode must be read or write.');
  const title = validateText(option('title', taskId), '--title', { max: 200 });
  const sourceCommit = option('source', git(['rev-parse', 'HEAD'], 'unknown'));
  requireExistingCommit(sourceCommit, '--source');
  const scope = normalizeScope({
    modules: listOption('modules'),
    uiSurfaces: listOption('surfaces'),
    dataAreas: listOption('data'),
    files: listOption('files')
  });
  if (mode === 'write' && !scope.modules.length && !scope.uiSurfaces.length && !scope.dataAreas.length && !scope.files.length) {
    throw new Error('A write task must declare at least one module, surface, data area, or file.');
  }
  const owner = option('owner');
  if (requireOwner && !allowedOwners.includes(owner)) {
    throw new Error(`--owner must be one of ${allowedOwners.join(', ')}.`);
  }
  if (owner && mode === 'write' && !allowedOwners.includes(owner)) {
    throw new Error(`--owner must be one of ${allowedOwners.join(', ')}.`);
  }
  if (owner && mode === 'read' && ![...allowedOwners, 'reviewer'].includes(owner)) {
    throw new Error(`Read --owner must be reviewer or one of ${allowedOwners.join(', ')}.`);
  }
  return { taskId, title, sourceCommit, mode, owner: owner || 'unassigned', ...scope };
}

function buildClaim(spec, overrides = {}) {
  return {
    taskId: spec.taskId,
    title: spec.title,
    branch: validateText(
      option('branch', git(['branch', '--show-current'], 'detached')),
      '--branch',
      { max: 200 }
    ),
    sourceCommit: spec.sourceCommit,
    mode: spec.mode,
    owner: overrides.owner || spec.owner || 'reviewer',
    legacy: overrides.legacy === true,
    modules: spec.modules,
    uiSurfaces: spec.uiSurfaces,
    dataAreas: spec.dataAreas,
    files: spec.files,
    updatedAt: new Date().toISOString(),
    ...(overrides.reservationId ? { reservationId: overrides.reservationId } : {}),
    ...(overrides.reservationTokenHash ? { reservationTokenHash: overrides.reservationTokenHash } : {})
  };
}

function externalPatchFromOptions() {
  const mapping = {
    clientId: 'client-id',
    threadId: 'thread-id',
    rolloutState: 'rollout-state',
    threadRecordState: 'thread-record-state',
    sidebarState: 'sidebar-state',
    nameState: 'name-state',
    turnState: 'turn-state',
    turnOwner: 'turn-owner',
    executionVisibility: 'execution-visibility'
  };
  const patch = {};
  for (const [field, cliName] of Object.entries(mapping)) {
    if (hasOption(cliName)) {
      const value = option(cliName);
      if (!value) throw new Error(`--${cliName} must not be empty.`);
      patch[field] = value;
    }
  }
  if (patch.executionVisibility && patch.executionVisibility !== 'DESKTOP_LIVE' &&
    !hasOption('desktop-live-observed')) {
    patch.desktopLiveObserved = false;
  }
  if (hasOption('desktop-live-observed')) {
    const observed = option('desktop-live-observed');
    if (!['yes', 'no'].includes(observed)) {
      throw new Error('--desktop-live-observed must be yes or no.');
    }
    patch.desktopLiveObserved = observed === 'yes';
  }
  return patch;
}

function mergeExternal(task, patch) {
  const current = task.external || normalizeExternal({ taskId: task.taskId });
  if (Object.hasOwn(patch, 'threadId') && !patch.threadId) {
    throw new Error('The canonical thread id cannot be cleared.');
  }
  if (Object.hasOwn(patch, 'clientId') && !patch.clientId) {
    throw new Error('The canonical client id cannot be cleared.');
  }
  if (patch.threadId && current.threadId && patch.threadId !== current.threadId) {
    throw new Error('The canonical thread id cannot change; recover the same sidebar task.');
  }
  if (patch.clientId && current.clientId && patch.clientId !== current.clientId) {
    throw new Error('The canonical client id cannot change; recover the same sidebar task.');
  }
  const candidate = { taskId: task.taskId, ...current, ...patch };
  const losesLiveEvidence = current.executionVisibility === 'DESKTOP_LIVE' &&
    !hasOption('execution-visibility') &&
    ((hasOption('turn-state') && patch.turnState !== 'started') ||
      (hasOption('sidebar-state') && patch.sidebarState !== 'present') ||
      (hasOption('rollout-state') && patch.rolloutState !== 'present') ||
      (hasOption('thread-record-state') && patch.threadRecordState !== 'present') ||
      (hasOption('name-state') && patch.nameState !== 'set'));
  if (losesLiveEvidence) {
    candidate.executionVisibility = defaultExecutionVisibility;
    candidate.desktopLiveObserved = false;
  }
  return normalizeExternal(candidate);
}

function terminalExternal(external) {
  if (external.executionVisibility !== 'DESKTOP_LIVE') return external;
  return normalizeExternal({
    ...external,
    executionVisibility: defaultExecutionVisibility,
    desktopLiveObserved: false
  });
}

function buildLifecycleRecord(candidate, state, actor, nextResponsible, reason, external = {}) {
  const now = new Date().toISOString();
  const normalizedExternal = normalizeExternal({ taskId: candidate.taskId, ...external });
  return {
    taskId: candidate.taskId,
    title: candidate.title,
    owner: candidate.owner,
    state,
    createdAt: now,
    stateUpdatedAt: now,
    lastActor: actor,
    nextResponsible,
    reason,
    external: normalizedExternal,
    history: [{
      from: null,
      to: state,
      at: now,
      actor,
      owner: candidate.owner,
      nextResponsible,
      reason,
      executionVisibility: normalizedExternal.executionVisibility,
      threadId: normalizedExternal.threadId,
      clientId: normalizedExternal.clientId,
      turnState: normalizedExternal.turnState,
      turnOwner: normalizedExternal.turnOwner,
      stopVerified: false
    }]
  };
}

function applyLifecycleTransition(task, to, {
  actor,
  nextResponsible,
  reason,
  external,
  release,
  stopVerification,
  reviewEvidence,
  clearStopVerification = false,
  clearReviewEvidence = false,
  at
} = {}) {
  const now = at || release?.releasedAt || new Date().toISOString();
  const from = task.state;
  task.state = to;
  task.stateUpdatedAt = now;
  task.lastActor = actor;
  task.nextResponsible = nextResponsible;
  task.reason = reason;
  if (external) task.external = terminalStates.includes(to) ? terminalExternal(external) : external;
  if (release) task.release = release;
  if (stopVerification) task.stopVerification = stopVerification;
  if (clearStopVerification) delete task.stopVerification;
  if (reviewEvidence) task.reviewEvidence = reviewEvidence;
  if (clearReviewEvidence) delete task.reviewEvidence;
  task.history.push({
    from,
    to,
    at: now,
    actor,
    owner: task.owner,
    nextResponsible,
    reason,
    executionVisibility: task.external?.executionVisibility || defaultExecutionVisibility,
    threadId: task.external?.threadId || '',
    clientId: task.external?.clientId || '',
    turnState: task.external?.turnState || 'unknown',
    turnOwner: task.external?.turnOwner || 'unknown',
    stopVerified: Boolean(task.stopVerification)
  });
}

function requireTransitionMetadata() {
  return {
    actor: validateText(option('actor'), '--actor', { max: 100 }),
    nextResponsible: validateText(option('next'), '--next', { max: 100 }),
    reason: validateText(option('reason'), '--reason', { max: 500 })
  };
}

function requireCanonicalSidebar(external, { waiting = false } = {}) {
  if (!external.threadId || !external.clientId) {
    throw new Error('A canonical sidebar task requires --thread-id and --client-id.');
  }
  if (external.rolloutState !== 'present' || external.threadRecordState !== 'present' ||
    external.sidebarState !== 'present' || external.nameState !== 'set') {
    throw new Error('The canonical sidebar task must be present in rollout, thread/list or DB, and sidebar, with its name set.');
  }
  const expectedTurn = waiting ? 'completed' : 'started';
  if (external.turnState !== expectedTurn) {
    throw new Error(waiting
      ? 'WAITING requires a completed short WAITING turn after reading notifications through turn/completed.'
      : 'ACTIVE claim requires the canonical thread turn to be started and its client to keep reading through turn/completed.');
  }
  if (waiting && external.executionVisibility !== 'WAITING') {
    throw new Error('WAITING lifecycle requires --execution-visibility WAITING.');
  }
  if (!waiting && !['DESKTOP_LIVE', 'BACKGROUND_ONLY'].includes(external.executionVisibility)) {
    throw new Error('ACTIVE claim requires explicit --execution-visibility DESKTOP_LIVE or BACKGROUND_ONLY.');
  }
}

function isExpired(reservation, now = Date.now()) {
  return Date.parse(reservation.expiresAt) <= now;
}

function activeReservations(registry) {
  return registry.reservations.filter(item => !isExpired(item));
}

function occupiedEntries(registry) {
  return [
    ...registry.claims.filter(item => item.mode === 'write').map(item => ({ kind: 'claim', ...item })),
    ...activeReservations(registry).map(item => ({ kind: 'reservation', branch: '', ...item }))
  ];
}

function unresolvedOrphans(registry) {
  return registry.integrityIssues.filter(item =>
    item.type === 'legacy-release-lifecycle-orphan' && !item.resolvedAt);
}

function slotSummary(registry) {
  const writeClaims = registry.claims.filter(item => item.mode === 'write').length;
  const active = activeReservations(registry).length;
  const expired = registry.reservations.length - active;
  const orphans = unresolvedOrphans(registry).length;
  return {
    occupied: writeClaims + active + orphans,
    capacity: maxWriteSlots,
    writeClaims,
    activeReservations: active,
    expiredReservations: expired,
    unresolvedOrphans: orphans,
    integrityBlocked: orphans > 0
  };
}

function sanitizeClaim(claim) {
  const { reservationTokenHash, ...safe } = claim;
  return safe;
}

function sanitizeReservation(reservation) {
  const { tokenHash, requestKeyHash, ...safe } = reservation;
  return { ...safe, status: isExpired(reservation) ? 'expired' : 'active' };
}

function lifecycleSummary(registry) {
  const count = state => registry.tasks.filter(item => item.state === state).length;
  return {
    reservationWaiting: count('RESERVED') + count('WAITING'),
    active: count('ACTIVE'),
    reviewHandedOff: count('REVIEW') + count('HANDED_OFF'),
    integrationArchivePending: count('INTEGRATING') + count('RELEASED') + count('ARCHIVE_PENDING'),
    archived: count('ARCHIVED'),
    byState: Object.fromEntries(lifecycleStates.map(state => [state, count(state)])),
    byExecutionVisibility: Object.fromEntries(executionVisibilityStates.map(visibility => [
      visibility,
      registry.tasks.filter(item => item.external.executionVisibility === visibility).length
    ]))
  };
}

function snapshot(registry) {
  return {
    schemaVersion: registrySchemaVersion,
    coordinationVersion,
    revision: registry.revision,
    updatedAt: registry.updatedAt,
    slots: slotSummary(registry),
    claims: registry.claims.map(sanitizeClaim),
    reservations: registry.reservations.map(sanitizeReservation),
    lifecycle: lifecycleSummary(registry),
    tasks: registry.tasks.map(item => ({
      ...item,
      external: { ...item.external },
      history: item.history.map(entry => ({ ...entry })),
      ...(item.release ? { release: { ...item.release } } : {})
    })),
    integrityIssues: registry.integrityIssues.map(item => ({ ...item }))
  };
}

function conflictForPair(left, right) {
  const overlap = {
    modules: intersection(left.modules, right.modules),
    uiSurfaces: intersection(left.uiSurfaces, right.uiSurfaces),
    dataAreas: intersection(left.dataAreas, right.dataAreas),
    files: intersection(left.files, right.files)
  };
  const crossDepartment = allowedOwners.includes(left.owner) &&
    allowedOwners.includes(right.owner) &&
    left.owner !== right.owner;
  const base = {
    entryType: `${left.kind}/${right.kind}`,
    taskId: `${left.taskId} ↔ ${right.taskId}`,
    title: `${left.title} ↔ ${right.title}`,
    owner: `${left.owner}/${right.owner}`,
    overlap,
    crossDepartment
  };
  if (overlap.modules.length || overlap.uiSurfaces.length || overlap.dataAreas.length) {
    return {
      kind: 'hard',
      value: {
        ...base,
        type: 'scope-overlap',
        consequence: crossDepartment
          ? 'Cross-department concurrent writes can change the same behavior, UI contract, or persisted data semantics.'
          : 'Concurrent writes can change the same behavior, UI contract, or persisted data semantics.',
        recommendation: crossDepartment
          ? `Escalate to 00; integrate ${left.taskId} before ${right.taskId}, or explicitly reverse that order after resolving ownership.`
          : `Integrate ${left.taskId} before ${right.taskId}, or remove the overlapping scope.`
      }
    };
  }
  if (overlap.files.length) {
    return {
      kind: 'soft',
      value: {
        ...base,
        type: 'file-only-overlap',
        consequence: 'The tasks are logically separate but may produce a textual merge conflict.',
        recommendation: `Notify 00 to preserve both accepted changes; suggested mechanical order is ${left.taskId} then ${right.taskId}.`
      }
    };
  }
  return null;
}

function analyzeRegistry(registry) {
  const occupied = occupiedEntries(registry);
  const hard = [];
  const soft = [];
  for (let leftIndex = 0; leftIndex < occupied.length; leftIndex++) {
    for (let rightIndex = leftIndex + 1; rightIndex < occupied.length; rightIndex++) {
      const result = conflictForPair(occupied[leftIndex], occupied[rightIndex]);
      if (result) (result.kind === 'hard' ? hard : soft).push(result.value);
    }
  }
  for (const issue of unresolvedOrphans(registry)) {
    hard.unshift({
      type: 'unresolved-active-orphan',
      entryType: 'integrity-issue',
      taskId: issue.taskId,
      title: issue.title,
      owner: issue.owner,
      overlap: { modules: [], uiSurfaces: [], dataAreas: [], files: [] },
      consequence: 'A removed claim may still have an active writer, so slot occupancy is not trustworthy.',
      recommendation: '00 must verify the writer stopped and resolve the integrity issue before dispatching another write task.'
    });
  }
  return { hard, soft };
}

function analyze(registry, candidate, { excludeReservationId = '' } = {}) {
  const hard = [];
  const soft = [];
  if (candidate.mode === 'read') return { hard, soft };
  const orphaned = unresolvedOrphans(registry);
  if (orphaned.length) {
    hard.push({
      type: 'unresolved-active-orphan',
      activeWriteTasks: orphaned.map(item => ({
        entryType: 'integrity-issue',
        taskId: item.taskId,
        title: item.title,
        owner: item.owner,
        branch: ''
      })),
      consequence: 'A claim may have been removed while its writer was still active; capacity cannot be trusted.',
      recommendation: '00 must verify the writer stopped and resolve the integrity issue before any new reservation.'
    });
    return { hard, soft };
  }
  const occupied = occupiedEntries(registry).filter(item => item.reservationId !== excludeReservationId);
  for (const existing of occupied) {
    const overlap = {
      modules: intersection(candidate.modules, existing.modules),
      uiSurfaces: intersection(candidate.uiSurfaces, existing.uiSurfaces),
      dataAreas: intersection(candidate.dataAreas, existing.dataAreas),
      files: intersection(candidate.files, existing.files)
    };
    const crossDepartment = allowedOwners.includes(candidate.owner) &&
      allowedOwners.includes(existing.owner) &&
      candidate.owner !== existing.owner;
    if (overlap.modules.length || overlap.uiSurfaces.length || overlap.dataAreas.length) {
      hard.push({
        type: 'scope-overlap',
        entryType: existing.kind,
        taskId: existing.taskId,
        title: existing.title,
        owner: existing.owner,
        branch: existing.branch || '',
        overlap,
        crossDepartment,
        consequence: crossDepartment
          ? 'Cross-department concurrent writes can change the same behavior, UI contract, or persisted data semantics.'
          : 'Concurrent writes can change the same behavior, UI contract, or persisted data semantics.',
        recommendation: crossDepartment
          ? 'Escalate to 00 with both owners and integrate the existing task first, or remove the overlapping scope.'
          : 'Integrate the existing task first, or split the new task so the overlapping scope is removed.'
      });
    } else if (overlap.files.length) {
      soft.push({
        type: 'file-only-overlap',
        entryType: existing.kind,
        taskId: existing.taskId,
        title: existing.title,
        owner: existing.owner,
        branch: existing.branch || '',
        overlap,
        consequence: 'The tasks are logically separate but may produce a textual merge conflict.',
        recommendation: 'Notify 00 of an explicit integration order and preserve both accepted changes during mechanical integration.'
      });
    }
  }
  if (!hard.length && occupied.length >= maxWriteSlots) {
    hard.push({
      type: 'write-capacity-exceeded',
      activeWriteTasks: occupied.map(item => ({
        entryType: item.kind,
        taskId: item.taskId,
        title: item.title,
        owner: item.owner,
        branch: item.branch || ''
      })),
      consequence: 'Active write claims and unexpired reservations share the two available write slots.',
      recommendation: 'Resume or finish an occupied task; only 00 may release an active claim after integration or confirmed cancellation.'
    });
  }
  return { hard, soft };
}

function printConflicts(payload) {
  if (payload.hard?.length) {
    console.log('HARD CONFLICT');
    for (const item of payload.hard) {
      console.log(`- ${item.type}: owner=${item.owner || 'multiple'} task=${item.title || item.taskId || 'capacity limit'} entry=${item.entryType || 'slots'}`);
      if (item.overlap?.modules?.length) console.log(`  modules: ${item.overlap.modules.join(', ')}`);
      if (item.overlap?.uiSurfaces?.length) console.log(`  surfaces: ${item.overlap.uiSurfaces.join(', ')}`);
      if (item.overlap?.dataAreas?.length) console.log(`  data: ${item.overlap.dataAreas.join(', ')}`);
      console.log(`  consequence: ${item.consequence}`);
      console.log(`  recommendation: ${item.recommendation}`);
    }
  }
  if (payload.soft?.length) {
    console.log('SOFT CONFLICT');
    for (const item of payload.soft) {
      console.log(`- owner=${item.owner} task=${item.title} entry=${item.entryType}: ${item.overlap.files.join(', ')}`);
      console.log(`  consequence: ${item.consequence}`);
      console.log(`  recommendation: ${item.recommendation}`);
    }
  }
}

function printSnapshot(state) {
  console.log(`Write slots: ${state.slots.occupied}/${state.slots.capacity} ` +
    `(claims=${state.slots.writeClaims}, reservations=${state.slots.activeReservations}, ` +
    `orphans=${state.slots.unresolvedOrphans}, expired=${state.slots.expiredReservations})`);
  if (!state.claims.length) console.log('No active task claims.');
  else {
    console.log(`Active task claims: ${state.claims.length}`);
    for (const item of state.claims) {
      console.log(`- [${item.mode}] owner=${item.owner} task=${item.taskId}: ${item.title} (${item.branch})${item.legacy ? ' [legacy]' : ''}`);
      const scopes = [
        item.modules.length ? `modules=${item.modules.join(',')}` : '',
        item.uiSurfaces.length ? `surfaces=${item.uiSurfaces.join(',')}` : '',
        item.dataAreas.length ? `data=${item.dataAreas.join(',')}` : '',
        item.files.length ? `files=${item.files.join(',')}` : ''
      ].filter(Boolean);
      if (scopes.length) console.log(`  ${scopes.join(' | ')}`);
    }
  }
  if (!state.reservations.length) console.log('No task reservations.');
  else {
    console.log(`Task reservations: ${state.reservations.length}`);
    for (const item of state.reservations) {
      console.log(`- [${item.status}] owner=${item.owner} task=${item.taskId}: ${item.title} baseline=${item.sourceCommit} expires=${item.expiresAt}`);
    }
  }
  if (!state.tasks.length) console.log('No lifecycle task records.');
  else {
    console.log(`Lifecycle task records: ${state.tasks.length}`);
    for (const item of state.tasks) {
      const external = item.external;
      const visibilityLabel = external.executionVisibility === 'BACKGROUND_ONLY'
        ? 'BACKGROUND_ONLY/后台施工'
        : external.executionVisibility;
      console.log(`- [${item.state}] visibility=${visibilityLabel} owner=${item.owner} task=${item.taskId} actor=${item.lastActor} next=${item.nextResponsible} updated=${item.stateUpdatedAt}`);
      console.log(`  external: thread=${external.threadId || '-'} client=${external.clientId || '-'} dedup=${external.dedupKey || '-'} rollout=${external.rolloutState} db=${external.threadRecordState} sidebar=${external.sidebarState} name=${external.nameState} turn=${external.turnState} turnOwner=${external.turnOwner} desktopLiveObserved=${external.desktopLiveObserved}`);
      console.log(`  reason: ${item.reason}`);
    }
  }
  if (state.integrityIssues?.length) {
    console.log(`Integrity issues: ${state.integrityIssues.length}`);
    for (const issue of state.integrityIssues) {
      console.log(`- [${issue.type}] owner=${issue.owner} task=${issue.taskId} previous=${issue.previousState} observed=${issue.observedAt}`);
      console.log(`  reason: ${issue.reason}`);
    }
  }
}

function printResult(label, payload) {
  if (jsonOutput) {
    console.log(JSON.stringify(payload, null, 2));
    return;
  }
  console.log(label);
  if (payload.registry) printSnapshot(payload.registry);
  printConflicts(payload);
}

function status() {
  withLock(() => {
    const registry = readRegistry();
    const conflicts = analyzeRegistry(registry);
    const state = { ...snapshot(registry), conflicts };
    if (jsonOutput) {
      console.log(JSON.stringify(state, null, 2));
      return;
    }
    printSnapshot(state);
    printConflicts(conflicts);
  });
}

function duplicateTaskEntry(registry, taskId) {
  return registry.tasks.find(item => item.taskId === taskId) ||
    registry.claims.find(item => item.taskId === taskId) ||
    registry.reservations.find(item => item.taskId === taskId) ||
    registry.integrityIssues.find(item =>
      item.type === 'legacy-release-lifecycle-orphan' &&
      !item.resolvedAt &&
      item.taskId === taskId);
}

function check() {
  const candidate = buildTaskSpec();
  withLock(() => {
    const registry = readRegistry();
    const duplicate = duplicateTaskEntry(registry, candidate.taskId);
    const analysis = analyze(registry, candidate);
    if (duplicate) {
      analysis.hard.unshift({
        type: 'duplicate-task',
        entryType: registry.claims.includes(duplicate) ? 'claim' :
          (registry.reservations.includes(duplicate) ? 'reservation' :
            (registry.integrityIssues.includes(duplicate) ? 'integrity-issue' : `lifecycle:${duplicate.state}`)),
        taskId: duplicate.taskId,
        title: duplicate.title,
        owner: duplicate.owner,
        consequence: 'A task identifier may have only one canonical reservation or claim.',
        recommendation: 'Resume the canonical task; cancel its reservation or wait for 00 to release its active claim before replacing it.'
      });
    }
    printResult(analysis.hard.length ? 'Task scope rejected.' : 'No hard conflicts.', {
      candidate,
      registry: snapshot(registry),
      ...analysis
    });
    if (analysis.hard.length) process.exitCode = 2;
  });
}

function reserve() {
  const candidate = buildTaskSpec({ requireOwner: true });
  if (candidate.mode !== 'write') throw new Error('Reservations are only valid for write tasks.');
  const requestKey = validateText(option('request-key'), '--request-key', { max: 200 });
  const requestKeyDigest = tokenHash(requestKey);
  withLock(() => {
    const registry = readRegistry();
    const cancelledRequest = registry.integrityIssues.find(item =>
      item.type === 'reservation-cancellation-tombstone' &&
      item.requestKeyHash === requestKeyDigest);
    if (cancelledRequest) {
      throw new Error('This request key belongs to a compensated or expired reservation and cannot be replayed; use a new request key for an intentional redispatch.');
    }
    const recoverable = registry.reservations.find(item =>
      item.requestKeyHash === requestKeyDigest);
    if (recoverable) {
      if (!sameReservationSpec(recoverable, candidate)) {
        throw new Error('The idempotent request key already belongs to a different reservation specification.');
      }
      const token = recoverableReservationToken(
        recoverable.reservationId,
        requestKeyDigest,
        recoverable.tokenGeneration
      );
      if (recoverable.tokenHash !== tokenHash(token)) {
        throw new Error('The reservation predates recoverable request-key tokens; preserve it and escalate to 00 instead of rotating its token.');
      }
      const persistence = {
        status: 'unchanged',
        revision: registry.revision,
        updatedAt: registry.updatedAt
      };
      const payload = {
        reservation: sanitizeReservation(recoverable),
        task: snapshot(registry).tasks.find(item => item.taskId === candidate.taskId),
        token,
        recovered: true,
        persistence,
        slots: slotSummary(registry),
        hard: [],
        soft: analyze(registry, candidate, {
          excludeReservationId: recoverable.reservationId
        }).soft
      };
      if (process.env.PREVISION_COORDINATION_TEST_CLOSE_STDOUT_AFTER_WRITE === 'yes') {
        process.stdout.destroy();
        return;
      }
      printResult('RESERVATION TOKEN RECOVERED', payload);
      if (!jsonOutput) console.log(`reservation token: ${token}`);
      return;
    }
    const duplicate = duplicateTaskEntry(registry, candidate.taskId);
    if (duplicate) {
      printResult('Task reservation rejected.', {
        candidate,
        registry: snapshot(registry),
        hard: [{
          type: 'duplicate-task',
          entryType: registry.claims.includes(duplicate) ? 'claim' :
            (registry.reservations.includes(duplicate) ? 'reservation' :
              (registry.integrityIssues.includes(duplicate) ? 'integrity-issue' : `lifecycle:${duplicate.state}`)),
          taskId: duplicate.taskId,
          title: duplicate.title,
          owner: duplicate.owner,
          consequence: 'A task identifier may have only one canonical reservation or claim, including expired reservations.',
          recommendation: 'Resume the canonical task; cancel an unclaimed reservation or wait for 00 to release an active claim.'
        }],
        soft: []
      });
      process.exitCode = 2;
      return;
    }
    const analysis = analyze(registry, candidate);
    if (analysis.hard.length) {
      printResult('Task reservation rejected.', { candidate, registry: snapshot(registry), ...analysis });
      process.exitCode = 2;
      return;
    }
    const ttlMinutes = Number(option('ttl-minutes', String(reservationPolicy.defaultTtlMinutes)));
    if (!Number.isFinite(ttlMinutes) || ttlMinutes <= 0 || ttlMinutes > reservationPolicy.maxTtlMinutes) {
      throw new Error(`--ttl-minutes must be greater than 0 and at most ${reservationPolicy.maxTtlMinutes}.`);
    }
    const createdAt = new Date();
    const reservationId = crypto.randomUUID();
    const tokenGeneration = 1;
    const token = recoverableReservationToken(
      reservationId,
      requestKeyDigest,
      tokenGeneration
    );
    const reservation = {
      reservationId,
      tokenHash: crypto.createHash('sha256').update(token).digest('hex'),
      requestKeyHash: requestKeyDigest,
      tokenGeneration,
      taskId: candidate.taskId,
      title: candidate.title,
      owner: candidate.owner,
      sourceCommit: candidate.sourceCommit,
      modules: candidate.modules,
      uiSurfaces: candidate.uiSurfaces,
      dataAreas: candidate.dataAreas,
      files: candidate.files,
      createdAt: createdAt.toISOString(),
      expiresAt: new Date(createdAt.getTime() + ttlMinutes * 60000).toISOString()
    };
    registry.reservations.push(reservation);
    registry.tasks.push(buildLifecycleRecord(
      candidate,
      'RESERVED',
      candidate.owner,
      `${candidate.owner}-sidebar-create`,
      'Write slot reserved atomically; create and name the canonical sidebar task immediately.',
      { turnState: 'not-started', turnOwner: 'none' }
    ));
    const persistence = writeRegistry(registry);
    if (process.env.PREVISION_COORDINATION_TEST_CLOSE_STDOUT_AFTER_WRITE === 'yes') {
      process.stdout.destroy();
      return;
    }
    printResult('RESERVED', {
      reservation: sanitizeReservation(reservation),
      task: snapshot(registry).tasks.find(item => item.taskId === candidate.taskId),
      token,
      persistence,
      slots: slotSummary(registry),
      ...analysis
    });
    if (!jsonOutput) console.log(`reservation token: ${token}`);
  });
}

function sameReservationSpec(reservation, spec) {
  return reservation.taskId === spec.taskId &&
    reservation.title === spec.title &&
    reservation.sourceCommit === spec.sourceCommit &&
    (!hasOption('owner') || reservation.owner === spec.owner) &&
    sameList(reservation.modules, spec.modules) &&
    sameList(reservation.uiSurfaces, spec.uiSurfaces) &&
    sameList(reservation.dataAreas, spec.dataAreas) &&
    sameList(reservation.files, spec.files);
}

function legacyClaimMatches(claim, candidate) {
  const requested = buildClaim(candidate, { owner: 'legacy', legacy: true });
  return claim.taskId === requested.taskId &&
    claim.title === requested.title &&
    claim.branch === requested.branch &&
    claim.sourceCommit === requested.sourceCommit &&
    claim.mode === requested.mode &&
    sameList(claim.modules, requested.modules) &&
    sameList(claim.uiSurfaces, requested.uiSurfaces) &&
    sameList(claim.dataAreas, requested.dataAreas) &&
    sameList(claim.files, requested.files);
}

function tokenHash(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function reservationSecret() {
  const existing = lstatIfPresent(reservationSecretFile);
  if (existing) {
    assertSecureRegularFile(reservationSecretFile, 'Reservation recovery secret');
    const value = fs.readFileSync(reservationSecretFile, 'utf8').trim();
    if (!/^[0-9a-f]{64}$/.test(value)) {
      throw new Error('Reservation recovery secret is malformed; refusing token recovery.');
    }
    return Buffer.from(value, 'hex');
  }
  const secret = crypto.randomBytes(32);
  writeAtomicSecureFile(
    reservationSecretFile,
    `${secret.toString('hex')}\n`,
    'Reservation recovery secret',
    { hardenParent: false }
  );
  return secret;
}

function recoverableReservationToken(reservationId, requestKeyDigest, generation = 1) {
  return crypto.createHmac('sha256', reservationSecret())
    .update(`reservation-token-v1\0${reservationId}\0${requestKeyDigest}\0${generation}`)
    .digest('base64url');
}

function reservationForToken(registry, token) {
  const digest = tokenHash(token);
  return {
    digest,
    reservation: registry.reservations.find(item => crypto.timingSafeEqual(
      Buffer.from(item.tokenHash, 'hex'),
      Buffer.from(digest, 'hex')
    ))
  };
}

function requireStoppedTurn(task, label) {
  if (task.external.turnState !== 'completed' ||
    !['desktop', 'background'].includes(task.external.turnOwner) ||
    !task.stopVerification ||
    task.stopVerification.turnOwner !== task.external.turnOwner ||
    task.stopVerification.threadId !== task.external.threadId ||
    task.stopVerification.clientId !== task.external.clientId) {
    throw new Error(`${label} requires a separately persisted completed-turn stop verification.`);
  }
}

function reviewCommitListFromOptions() {
  const raw = option('task-commits') || option('task-commit');
  return normalizeCommitList(raw, '--task-commit/--task-commits');
}

function buildReviewEvidence(claim, metadata) {
  const taskCommits = reviewCommitListFromOptions();
  const taskHead = currentGitHead();
  if (currentGitBranch() !== claim.branch) {
    throw new Error('REVIEW evidence must be frozen from the claimed task branch.');
  }
  validateExactTaskCommitList(claim.sourceCommit, taskHead, taskCommits, 'Reviewed task commits');
  return {
    recordedAt: new Date().toISOString(),
    recordedBy: metadata.actor,
    sourceCommit: claim.sourceCommit,
    taskHead,
    taskCommits,
    patchIds: taskCommits.map(commit => stablePatchId(commit, 'reviewed task commit'))
  };
}

function closeoutAcceptancePair(claim) {
  const active = claim.files.filter(file => file.startsWith('docs/plans/active/') && file.endsWith('.md'));
  const completed = claim.files.filter(file => file.startsWith('docs/plans/completed/') &&
    file.endsWith('.md') && file !== 'docs/plans/completed/README.md');
  for (const activeFile of active) {
    const name = path.basename(activeFile);
    const completedFile = completed.find(file => path.basename(file) === name);
    if (completedFile) return { activeFile, completedFile };
  }
  return null;
}

const mechanicalCloseoutEvidenceKeys = [
  'commit', 'parent', 'patchId', 'files', 'activeFile', 'completedFile', 'indexFile',
  'reviewedActiveEntry', 'completedEntry', 'reviewedIndexEntry', 'completedIndexEntry',
  'statusTransition', 'indexAddition', 'recordedAt', 'recordedBy'
];

function verifyMechanicalCloseoutEvidence(taskId, taskHead, storedEvidence, metadata = {}) {
  if (!storedEvidence || typeof storedEvidence !== 'object' || Array.isArray(storedEvidence) ||
    !hasOnlyKeys(storedEvidence, mechanicalCloseoutEvidenceKeys) ||
    !mechanicalCloseoutEvidenceKeys.every(key => Object.hasOwn(storedEvidence, key))) {
    throw new Error(`Malformed mechanical closeout evidence for ${taskId}.`);
  }
  validateDate(storedEvidence.recordedAt, `closeout evidence time for ${taskId}`);
  const recordedBy = validateText(
    storedEvidence.recordedBy,
    `closeout recorder for ${taskId}`,
    { max: 100 }
  );
  const closeoutCommit = validateText(
    storedEvidence.commit,
    `closeout commit for ${taskId}`,
    { max: 40 }
  );
  requireExistingCommit(closeoutCommit, '--closeout-commit');
  const parents = rawGit(['rev-list', '--parents', '-n', '1', closeoutCommit], {
    cwd: gitRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore']
  }).trim().split(/\s+/).slice(1);
  if (parents.length !== 1 || parents[0] !== taskHead) {
    throw new Error('Mechanical closeout must be one commit whose sole parent is the reviewed task HEAD.');
  }
  const changed = nulSeparatedGitPaths([
    'diff', '--no-renames', '--name-only', '-z', taskHead, closeoutCommit
  ], gitRoot, 'mechanical closeout changed paths').sort();
  const indexFile = 'docs/plans/completed/README.md';
  const activeFiles = changed.filter(file =>
    file.startsWith('docs/plans/active/') && file.endsWith('.md'));
  const completedFiles = changed.filter(file =>
    file.startsWith('docs/plans/completed/') && file.endsWith('.md') && file !== indexFile);
  if (changed.length !== 3 || activeFiles.length !== 1 || completedFiles.length !== 1 ||
    !changed.includes(indexFile) || path.basename(activeFiles[0]) !== path.basename(completedFiles[0])) {
    throw new Error('Mechanical closeout may only move the canonical acceptance and update completed/README.md.');
  }
  const activeFile = activeFiles[0];
  const completedFile = completedFiles[0];
  const reviewedTree = repositoryTreeEntries(taskHead, 'reviewed task HEAD');
  const completedTree = repositoryTreeEntries(closeoutCommit, 'mechanical closeout commit');
  if (!reviewedTree.has(activeFile) || reviewedTree.has(completedFile) ||
    completedTree.has(activeFile) || !completedTree.has(completedFile)) {
    throw new Error('Reviewed HEAD must contain only the active acceptance, and closeout must contain only its completed counterpart.');
  }
  const reviewedActiveEntry = reviewedTree.get(activeFile);
  const completedPlanEntry = completedTree.get(completedFile);
  const reviewedIndexTreeEntry = reviewedTree.get(indexFile);
  const completedIndexTreeEntry = completedTree.get(indexFile);
  if ([reviewedActiveEntry, completedPlanEntry, reviewedIndexTreeEntry, completedIndexTreeEntry]
    .some(entry => entry?.mode !== '100644' || entry?.type !== 'blob') ||
    reviewedActiveEntry.mode !== completedPlanEntry.mode ||
    reviewedActiveEntry.type !== completedPlanEntry.type ||
    reviewedIndexTreeEntry.mode !== completedIndexTreeEntry.mode ||
    reviewedIndexTreeEntry.type !== completedIndexTreeEntry.type) {
    throw new Error('Mechanical closeout acceptance and completed index must remain regular 100644 Markdown blobs with unchanged mode and type.');
  }
  const activeContent = commitBlobContent(reviewedTree, activeFile, 'reviewed active acceptance');
  const completedContent = commitBlobContent(completedTree, completedFile, 'completed acceptance');
  const statusPattern = /^(- 状态：)active(?=(?:（[^\r\n]*）)?\r?$)/gmu;
  const statusMatches = [...activeContent.matchAll(statusPattern)];
  if (statusMatches.length !== 1 || activeContent.replace(statusPattern, '$1completed') !== completedContent) {
    throw new Error('Mechanical closeout completed content must equal reviewed active content with exactly one deterministic active-to-completed state migration.');
  }
  const reviewedIndex = commitBlobContent(reviewedTree, indexFile, 'reviewed completed index');
  const completedIndex = commitBlobContent(completedTree, indexFile, 'closeout completed index');
  const separator = reviewedIndex.endsWith('\n') ? '' : '\n';
  const indexSuffix = completedIndex.slice(reviewedIndex.length);
  const escapedName = path.basename(completedFile).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const canonicalLink = new RegExp(`^${separator.replace('\n', '\\n')}- \\[[^\\]\\r\\n]+\\]\\(${escapedName}\\)\\n$`);
  if (!completedIndex.startsWith(reviewedIndex) || !canonicalLink.test(indexSuffix)) {
    throw new Error('Mechanical closeout completed index may only append one canonical link without modifying existing content.');
  }
  const calculated = {
    commit: closeoutCommit,
    parent: taskHead,
    patchId: stablePatchId(closeoutCommit, 'mechanical closeout commit'),
    files: changed,
    activeFile,
    completedFile,
    indexFile,
    reviewedActiveEntry: treeEntryIdentity(reviewedTree.get(activeFile)),
    completedEntry: treeEntryIdentity(completedTree.get(completedFile)),
    reviewedIndexEntry: treeEntryIdentity(reviewedTree.get(indexFile)),
    completedIndexEntry: treeEntryIdentity(completedTree.get(indexFile)),
    statusTransition: 'single-active-to-completed',
    indexAddition: indexSuffix,
    recordedAt: storedEvidence.recordedAt,
    recordedBy
  };
  for (const key of mechanicalCloseoutEvidenceKeys) {
    if (key === 'recordedAt' || key === 'recordedBy') continue;
    if (JSON.stringify(storedEvidence[key]) !== JSON.stringify(calculated[key])) {
      throw new Error(`Mechanical closeout evidence for ${taskId} drifted from Git object facts at ${key}.`);
    }
  }
  if (metadata.claim) {
    const pair = closeoutAcceptancePair(metadata.claim);
    if (!pair || pair.activeFile !== activeFile || pair.completedFile !== completedFile ||
      !metadata.claim.files.includes(indexFile)) {
      throw new Error('This task scope does not declare the exact active/completed acceptance pair and completed index.');
    }
  }
  return calculated;
}

function validateMechanicalCloseout(claim, reviewEvidence, closeoutCommit, actor) {
  const evidence = {
    commit: closeoutCommit,
    parent: reviewEvidence.taskHead,
    patchId: '',
    files: [],
    activeFile: '',
    completedFile: '',
    indexFile: '',
    reviewedActiveEntry: '',
    completedEntry: '',
    reviewedIndexEntry: '',
    completedIndexEntry: '',
    statusTransition: '',
    indexAddition: '',
    recordedAt: new Date().toISOString(),
    recordedBy: actor
  };
  const pair = closeoutAcceptancePair(claim);
  if (!pair) {
    throw new Error('This task scope does not declare an active/completed acceptance pair for mechanical closeout.');
  }
  const changed = nulSeparatedGitPaths([
    'diff', '--no-renames', '--name-only', '-z', reviewEvidence.taskHead, closeoutCommit
  ], gitRoot, 'mechanical closeout changed paths').sort();
  const reviewedTree = repositoryTreeEntries(reviewEvidence.taskHead, 'reviewed task HEAD');
  const completedTree = repositoryTreeEntries(closeoutCommit, 'mechanical closeout commit');
  const indexFile = 'docs/plans/completed/README.md';
  const reviewedIndex = commitBlobContent(reviewedTree, indexFile, 'reviewed completed index');
  const completedIndex = commitBlobContent(completedTree, indexFile, 'closeout completed index');
  Object.assign(evidence, {
    parent: reviewEvidence.taskHead,
    patchId: stablePatchId(closeoutCommit, 'mechanical closeout commit'),
    files: changed,
    activeFile: pair.activeFile,
    completedFile: pair.completedFile,
    indexFile,
    reviewedActiveEntry: treeEntryIdentity(reviewedTree.get(pair.activeFile)),
    completedEntry: treeEntryIdentity(completedTree.get(pair.completedFile)),
    reviewedIndexEntry: treeEntryIdentity(reviewedTree.get(indexFile)),
    completedIndexEntry: treeEntryIdentity(completedTree.get(indexFile)),
    statusTransition: 'single-active-to-completed',
    indexAddition: completedIndex.slice(reviewedIndex.length)
  });
  return verifyMechanicalCloseoutEvidence(
    claim.taskId,
    reviewEvidence.taskHead,
    evidence,
    { claim }
  );
}

function acceptedTaskCommits(reviewEvidence) {
  return reviewEvidence.closeout
    ? [...reviewEvidence.taskCommits, reviewEvidence.closeout.commit]
    : [...reviewEvidence.taskCommits];
}

function verifyStop() {
  const taskId = option('task');
  if (!taskId) throw new Error('Missing --task <task-id>.');
  validateTaskId(taskId);
  const metadata = requireTransitionMetadata();
  const evidence = validateText(option('evidence'), '--evidence', { max: 500 });
  withLock(() => {
    const registry = readRegistry();
    const task = registry.tasks.find(item => item.taskId === taskId);
    if (!task || terminalStates.includes(task.state)) {
      throw new Error('Stop verification requires a non-terminal authoritative lifecycle record.');
    }
    if (reservationStates.includes(task.state)) {
      const token = option('reservation');
      if (!token) throw new Error('Reservation stop verification requires --reservation <token>.');
      const { reservation } = reservationForToken(registry, token);
      if (!reservation || reservation.taskId !== taskId) {
        throw new Error('Invalid reservation token; stop verification was not recorded.');
      }
    }
    const patch = externalPatchFromOptions();
    if (patch.turnState !== 'completed') {
      throw new Error('task:verify-stop requires --turn-state completed.');
    }
    const external = mergeExternal(task, patch);
    if (!['desktop', 'background'].includes(external.turnOwner)) {
      throw new Error('Stop verification requires a verified desktop or background turn owner.');
    }
    const stopVerification = {
      verifiedAt: new Date().toISOString(),
      actor: metadata.actor,
      reason: evidence,
      turnOwner: external.turnOwner,
      threadId: external.threadId,
      clientId: external.clientId
    };
    applyLifecycleTransition(task, task.state, {
      ...metadata,
      external,
      stopVerification,
      at: stopVerification.verifiedAt
    });
    const claim = registry.claims.find(item => item.taskId === taskId && item.mode === 'write');
    if (claim) claim.updatedAt = task.stateUpdatedAt;
    const persistence = writeRegistry(registry);
    printResult('TURN STOP VERIFIED', {
      task,
      persistence,
      registry: snapshot(registry),
      ...analyzeRegistry(registry)
    });
  });
}

function transition() {
  const taskId = option('task');
  if (!taskId) throw new Error('Missing --task <task-id>.');
  validateTaskId(taskId);
  const to = option('to');
  if (!lifecycleStates.includes(to)) throw new Error(`--to must be one of ${lifecycleStates.join(', ')}.`);
  const metadata = requireTransitionMetadata();
  withLock(() => {
    const registry = readRegistry();
    const task = registry.tasks.find(item => item.taskId === taskId);
    if (!task) throw new Error('No authoritative lifecycle record for this task.');
    if (!allowedTransitions[task.state]?.includes(to)) {
      throw new Error(`Illegal lifecycle transition ${task.state} -> ${to}.`);
    }
    if (reservationStates.includes(task.state) && to === 'ACTIVE') {
      throw new Error('Reservation conversion to ACTIVE must use task:claim with its token.');
    }
    if (terminalStates.includes(to)) {
      throw new Error('Terminal transitions require task:release or task:archive.');
    }
    if (to === 'INTEGRATING' && metadata.actor !== '00') {
      throw new Error('Only 00 may move a handed-off task into INTEGRATING.');
    }

    const patch = externalPatchFromOptions();
    if (patch.turnState === 'completed' && task.external.turnState !== 'completed') {
      throw new Error('A running or uncertain turn must be completed through task:verify-stop before lifecycle transition.');
    }
    const external = mergeExternal(task, patch);
    if (reservationStates.includes(task.state)) {
      const token = option('reservation');
      if (!token) throw new Error('Reservation lifecycle updates require --reservation <token>.');
      const { reservation } = reservationForToken(registry, token);
      if (!reservation || reservation.taskId !== taskId) {
        throw new Error('Invalid reservation token; lifecycle state was preserved.');
      }
      if (task.state === 'RESERVED' && to === 'WAITING') {
        requireCanonicalSidebar(external, { waiting: true });
      }

      const ttlOption = option('ttl-minutes');
      if (ttlOption) {
        if (to === 'WAITING') requireCanonicalSidebar(external, { waiting: true });
        const ttlMinutes = Number(ttlOption);
        if (!Number.isFinite(ttlMinutes) || ttlMinutes <= 0 || ttlMinutes > reservationPolicy.maxTtlMinutes) {
          throw new Error(`--ttl-minutes must be greater than 0 and at most ${reservationPolicy.maxTtlMinutes}.`);
        }
        const analysis = analyze(registry, {
          ...reservation,
          mode: 'write'
        }, { excludeReservationId: reservation.reservationId });
        if (analysis.hard.length) {
          printResult('Reservation renewal rejected; lifecycle and TTL preserved.', {
            task,
            reservation: sanitizeReservation(reservation),
            registry: snapshot(registry),
            ...analysis
          });
          process.exitCode = 2;
          return;
        }
        reservation.expiresAt = new Date(Date.now() + ttlMinutes * 60000).toISOString();
      } else if (isExpired(reservation)) {
        throw new Error('Reservation expired; renew the same canonical task with --ttl-minutes or cancel after compensation.');
      }
    }

    const claim = registry.claims.find(item => item.taskId === taskId && item.mode === 'write');
    let reviewEvidence = task.reviewEvidence;
    let clearReviewEvidence = false;
    let clearStopVerification = false;
    if (to === 'REVIEW' && task.state === 'ACTIVE') {
      if (!claim) throw new Error('REVIEW requires an active write claim.');
      requireStoppedTurn(task, 'REVIEW');
      reviewEvidence = buildReviewEvidence(claim, metadata);
    } else if (to === 'HANDED_OFF') {
      requireStoppedTurn(task, 'HANDED_OFF');
      if (!reviewEvidence || option('review-accepted') !== 'yes') {
        throw new Error('HANDED_OFF requires --review-accepted yes for the recorded exact task commit list.');
      }
      if (hasOption('task-commit') || hasOption('task-commits')) {
        const accepted = reviewCommitListFromOptions();
        if (!sameList(accepted, reviewEvidence.taskCommits)) {
          throw new Error('Review acceptance commit list must exactly match the recorded REVIEW evidence.');
        }
      }
      reviewEvidence = {
        ...reviewEvidence,
        acceptedAt: new Date().toISOString(),
        acceptedBy: metadata.actor
      };
      const closeoutCommit = option('closeout-commit');
      const closeoutPair = closeoutAcceptancePair(claim);
      if (closeoutPair && !closeoutCommit) {
        throw new Error('HANDED_OFF requires a strictly validated --closeout-commit for the acceptance move and completed index update.');
      }
      if (closeoutCommit) {
        reviewEvidence.closeout = validateMechanicalCloseout(
          claim,
          reviewEvidence,
          closeoutCommit,
          metadata.actor
        );
      }
    } else if (to === 'INTEGRATING') {
      requireStoppedTurn(task, 'INTEGRATING');
      if (!reviewEvidence?.acceptedAt) {
        throw new Error('INTEGRATING requires accepted independent review evidence.');
      }
    }
    if (to === 'ACTIVE' && task.state === 'REVIEW') {
      clearReviewEvidence = true;
      clearStopVerification = true;
    }
    if (['started', 'disconnected', 'unknown'].includes(external.turnState) &&
      external.turnState !== task.external.turnState) {
      clearStopVerification = true;
      if (!['ACTIVE', 'RESERVED', 'WAITING'].includes(to)) {
        throw new Error('A new or uncertain running turn may only be recorded before review or integration.');
      }
    }
    applyLifecycleTransition(task, to, {
      ...metadata,
      external,
      ...(reviewEvidence ? { reviewEvidence } : {}),
      clearReviewEvidence,
      clearStopVerification
    });
    if (claim) claim.updatedAt = task.stateUpdatedAt;
    const persistence = writeRegistry(registry);
    printResult(`LIFECYCLE ${task.state}`, {
      task,
      persistence,
      registry: snapshot(registry),
      ...analyzeRegistry(registry)
    });
  });
}

function claim() {
  const candidate = buildTaskSpec();
  const token = option('reservation');
  withLock(() => {
    const registry = readRegistry();
    if (candidate.mode === 'read') {
      if (token) throw new Error('Read claims do not use reservations.');
      if (registry.reservations.some(item => item.taskId === candidate.taskId)) {
        throw new Error('The task identifier is already reserved for a write task.');
      }
      const existing = registry.claims.find(item => item.taskId === candidate.taskId);
      if (existing?.mode === 'write') {
        throw new Error('The task identifier already belongs to an active write claim.');
      }
      const analysis = analyze(registry, candidate);
      printResult('READ-ONLY SCOPE CHECK; no authoritative claim was persisted.', {
        candidate,
        registry: snapshot(registry),
        ...analysis
      });
      return;
    }

    if (!token) {
      const existing = registry.claims.find(item => item.taskId === candidate.taskId);
      if (existing?.legacy && legacyClaimMatches(existing, candidate)) {
        printResult('LEGACY CLAIM RETAINED; future write tasks require task:reserve and --reservation.', {
          claim: sanitizeClaim(existing),
          registry: snapshot(registry),
          hard: [],
          soft: analyze({ ...registry, claims: registry.claims.filter(item => item.taskId !== existing.taskId) }, candidate).soft
        });
        return;
      }
      if (existing) throw new Error('This task already has an active claim; resume it instead of claiming again.');
      throw new Error('New write claims require --reservation <token>. Run task:reserve before creating the sidebar task.');
    }

    const { digest, reservation } = reservationForToken(registry, token);
    if (!reservation) {
      const converted = registry.claims.find(item => item.reservationTokenHash === digest);
      if (converted) throw new Error('Reservation already converted to an active claim; active claims require task:release by 00.');
      throw new Error('Invalid reservation token.');
    }
    if (isExpired(reservation)) {
      throw new Error('Reservation expired; it remains recorded and may be cancelled, but cannot be claimed.');
    }
    if (!sameReservationSpec(reservation, candidate)) {
      throw new Error('Reservation task, title, baseline, owner, or declared scope does not exactly match the claim.');
    }
    if (registry.claims.some(item => item.taskId === candidate.taskId)) {
      throw new Error('The task already has an active claim.');
    }
    const task = registry.tasks.find(item => item.taskId === candidate.taskId);
    if (!task || !reservationStates.includes(task.state)) {
      throw new Error('Reservation is missing its recoverable RESERVED/WAITING lifecycle state.');
    }
    const metadata = requireTransitionMetadata();
    const external = mergeExternal(task, externalPatchFromOptions());
    requireCanonicalSidebar(external);
    const analysis = analyze(registry, { ...candidate, owner: reservation.owner }, {
      excludeReservationId: reservation.reservationId
    });
    if (analysis.hard.length) {
      printResult('Reservation conversion rejected; reservation preserved.', {
        candidate,
        reservation: sanitizeReservation(reservation),
        registry: snapshot(registry),
        ...analysis
      });
      process.exitCode = 2;
      return;
    }
    const activeClaim = buildClaim(candidate, {
      owner: reservation.owner,
      legacy: false,
      reservationId: reservation.reservationId,
      reservationTokenHash: reservation.tokenHash
    });
    registry.reservations = registry.reservations.filter(item => item.reservationId !== reservation.reservationId);
    registry.claims.push(activeClaim);
    applyLifecycleTransition(task, 'ACTIVE', {
      ...metadata,
      external,
      clearStopVerification: true,
      clearReviewEvidence: true
    });
    const persistence = writeRegistry(registry);
    printResult('CLAIMED FROM RESERVATION', {
      claim: sanitizeClaim(activeClaim),
      persistence,
      registry: snapshot(registry),
      ...analysis
    });
  });
}

function cancelReservation() {
  const token = option('reservation');
  if (!token) throw new Error('Missing --reservation <token>.');
  const digest = tokenHash(token);
  if (hasOption('turn-state') || hasOption('turn-owner')) {
    throw new Error('Cancellation cannot rewrite turn state or owner; persist stop verification in a separate command.');
  }
  withLock(() => {
    const registry = readRegistry();
    const reservation = registry.reservations.find(item => item.tokenHash === digest);
    if (!reservation) {
      const converted = registry.claims.find(item => item.reservationTokenHash === digest);
      if (converted) {
        throw new Error('Reservation already converted to an active claim; only 00 may release the claim after integration or confirmed cancellation.');
      }
      throw new Error('Invalid reservation token.');
    }
    const requestedTask = option('task');
    if (requestedTask && requestedTask !== reservation.taskId) {
      throw new Error('Reservation token does not match --task; reservation preserved.');
    }
    const task = registry.tasks.find(item => item.taskId === reservation.taskId);
    if (!task || !reservationStates.includes(task.state)) {
      throw new Error('Reservation lifecycle is missing or no longer cancellable.');
    }
    const actor = validateText(option('actor'), '--actor', { max: 100 });
    const reason = validateText(option('reason'), '--reason', { max: 500 });
    const evidence = validateText(option('evidence'), '--evidence', { max: 500 });
    const external = mergeExternal(task, externalPatchFromOptions());
    if (option('compensation-confirmed') !== 'yes') {
      throw new Error('Reservation cancellation requires --compensation-confirmed yes after explicit three-way triage; UNKNOWN or uncertain creation results must preserve the same task.');
    }
    if (external.rolloutState !== 'missing' || external.threadRecordState !== 'missing' ||
      external.sidebarState !== 'absent') {
      throw new Error('Compensated cancellation requires explicit rollout=missing, thread-record=missing, and sidebar=absent; UNKNOWN is not cancellable.');
    }
    const explicitlyNotRunning =
      (external.turnState === 'not-started' && external.turnOwner === 'none') ||
      (external.turnState === 'completed' &&
        ['desktop', 'background'].includes(external.turnOwner) &&
        task.stopVerification &&
        task.stopVerification.turnOwner === external.turnOwner &&
        task.stopVerification.threadId === external.threadId &&
        task.stopVerification.clientId === external.clientId);
    if (!explicitlyNotRunning) {
      throw new Error('Compensated cancellation requires an explicitly non-running turn: not-started/none or completed with a verified desktop/background owner. started, disconnected, unknown, or unverified ownership must preserve the task.');
    }
    registry.reservations = registry.reservations.filter(item => item.reservationId !== reservation.reservationId);
    registry.tasks = registry.tasks.filter(item => item.taskId !== reservation.taskId);
    registry.integrityIssues.push(normalizeIntegrityIssue({
      type: 'reservation-cancellation-tombstone',
      taskId: reservation.taskId,
      title: reservation.title,
      owner: reservation.owner,
      previousState: task.state,
      observedAt: new Date().toISOString(),
      actor,
      reason,
      evidence,
      reservationId: reservation.reservationId,
      requestKeyHash: reservation.requestKeyHash
    }));
    const persistence = writeRegistry(registry);
    if (jsonOutput) {
      console.log(JSON.stringify({
        cancelled: true,
        reservation: sanitizeReservation(reservation),
        persistence,
        slots: slotSummary(registry)
      }, null, 2));
    } else {
      console.log(`CANCELLED RESERVATION owner=${reservation.owner} task=${reservation.taskId}`);
      console.log(`Write slots: ${slotSummary(registry).occupied}/${maxWriteSlots}`);
    }
  });
}

function resolveIntegrity() {
  const taskId = option('task');
  if (!taskId) throw new Error('Missing --task <task-id>.');
  validateTaskId(taskId);
  const actor = option('actor');
  if (actor !== '00') throw new Error('Only 00 may resolve an active-orphan integrity issue.');
  const reason = validateText(option('reason'), '--reason', { max: 500 });
  const stopEvidence = validateText(option('stop-evidence'), '--stop-evidence', { max: 500 });
  withLock(() => {
    const registry = readRegistry();
    const issue = registry.integrityIssues.find(item =>
      item.type === 'legacy-release-lifecycle-orphan' && item.taskId === taskId);
    if (!issue) throw new Error('No active-orphan integrity issue exists for this task.');
    if (issue.resolvedAt) throw new Error('The active-orphan integrity issue is already resolved.');
    issue.resolvedAt = new Date().toISOString();
    issue.resolvedBy = actor;
    issue.resolutionReason = reason;
    issue.stopEvidence = stopEvidence;
    const persistence = writeRegistry(registry);
    printResult('INTEGRITY ISSUE RESOLVED', {
      issue,
      persistence,
      registry: snapshot(registry),
      ...analyzeRegistry(registry)
    });
  });
}

function integrationMapping(sourceCommit, taskCommits, integrationCommit) {
  const integrationCommits = commitsBetween(sourceCommit, integrationCommit);
  const candidates = integrationCommits.map(commit => {
    try {
      return { commit, patchId: stablePatchId(commit, 'central integration commit') };
    } catch {
      return null;
    }
  }).filter(Boolean);
  const taskEvidence = taskCommits.map(taskCommit => ({
    commit: taskCommit,
    patchId: stablePatchId(taskCommit, 'accepted task commit')
  }));
  const taskCounts = new Map();
  const centralCounts = new Map();
  for (const item of taskEvidence) {
    taskCounts.set(item.patchId, (taskCounts.get(item.patchId) || 0) + 1);
  }
  for (const item of candidates) {
    if (taskCounts.has(item.patchId)) {
      centralCounts.set(item.patchId, (centralCounts.get(item.patchId) || 0) + 1);
    }
  }
  for (const [patchId, count] of taskCounts) {
    if (centralCounts.get(patchId) !== count) {
      throw new Error(
        `Central integration HEAD must contain exactly ${count} distinct ordered stable patch-id matches for accepted patch ${patchId}.`
      );
    }
  }
  let previousIndex = -1;
  const used = new Set();
  const mapping = taskEvidence.map(taskItem => {
    const index = candidates.findIndex((candidate, candidateIndex) =>
      candidateIndex > previousIndex &&
      candidate.patchId === taskItem.patchId &&
      candidate.commit !== taskItem.commit &&
      !used.has(candidate.commit));
    if (index < 0) {
      throw new Error('Central integration patch sequence is missing, reordered, or reuses a commit.');
    }
    previousIndex = index;
    used.add(candidates[index].commit);
    return {
      taskCommit: taskItem.commit,
      taskPatchId: taskItem.patchId,
      integrationCommit: candidates[index].commit,
      integrationPatchId: candidates[index].patchId
    };
  });
  const taskHead = taskCommits.at(-1);
  const changedPaths = nulSeparatedGitPaths([
    'diff', '--no-renames', '--name-only', '-z', sourceCommit, taskHead
  ], gitRoot, 'accepted task changed paths');
  if (changedPaths.length) {
    const taskTree = repositoryTreeEntries(taskHead, 'accepted task HEAD');
    const integrationTree = repositoryTreeEntries(integrationCommit, 'central integration HEAD');
    for (const file of changedPaths) {
      const taskEntry = treeEntryIdentity(taskTree.get(file));
      const integrationEntry = treeEntryIdentity(integrationTree.get(file));
      if (taskEntry !== integrationEntry) {
        throw new Error('Central integration final tree/net diff is not equivalent to the complete accepted task change.');
      }
    }
    if (new Set(changedPaths).size !== changedPaths.length) {
      throw new Error('Central integration final tree/net diff is not equivalent to the complete accepted task change.');
    }
  }
  return mapping;
}

function release() {
  const taskId = option('task');
  if (!taskId) throw new Error('Missing --task <task-id>.');
  validateTaskId(taskId);
  withLock(() => {
    const registry = readRegistry();
    const readClaim = registry.claims.find(item => item.taskId === taskId && item.mode === 'read');
    if (readClaim) {
      const actor = option('actor');
      if (!['00', readClaim.owner].includes(actor)) {
        throw new Error('A deprecated read claim may only be removed by its recorded owner or 00.');
      }
      registry.claims = registry.claims.filter(item => item !== readClaim);
      const persistence = writeRegistry(registry);
      const payload = {
        taskId,
        released: true,
        deprecatedReadClaim: true,
        persistence,
        slots: slotSummary(registry)
      };
      if (jsonOutput) console.log(JSON.stringify(payload, null, 2));
      else console.log(`REMOVED DEPRECATED READ CLAIM ${taskId}`);
      return;
    }
    const claim = registry.claims.find(item => item.taskId === taskId && item.mode === 'write');
    if (!claim && registry.reservations.some(item => item.taskId === taskId)) {
      throw new Error('Task has a reservation, not an active claim; use task:cancel-reservation with its token.');
    }
    if (!claim) throw new Error(`No active write claim for ${taskId}.`);
    const task = registry.tasks.find(item => item.taskId === taskId);
    if (!task || !claimStates.includes(task.state)) {
      throw new Error('Active claim is missing its lifecycle state.');
    }
    const actor = option('actor');
    if (actor !== '00') throw new Error('Only 00 may release an active write claim.');
    const outcome = option('outcome');
    if (!['integrated', 'cancelled'].includes(outcome)) {
      throw new Error('--outcome must be integrated or cancelled.');
    }
    const nextResponsible = validateText(option('next'), '--next', { max: 100 });
    const reason = validateText(option('reason'), '--reason', { max: 500 });
    requireStoppedTurn(task, 'RELEASED');
    let integrationCommit = '';
    let integrationBranch = '';
    let taskCommits = [];
    let reviewedTaskCommits = [];
    let integrationMap = [];
    let finalRegression = '';
    if (outcome === 'integrated') {
      if (task.state !== 'INTEGRATING') {
        throw new Error('Integrated release requires the task to be INTEGRATING.');
      }
      if (!task.reviewEvidence?.acceptedAt) {
        throw new Error('Integrated release requires accepted independent review evidence.');
      }
      reviewedTaskCommits = reviewCommitListFromOptions();
      if (!sameList(reviewedTaskCommits, task.reviewEvidence.taskCommits)) {
        throw new Error('Released task commit list must exactly match the accepted review evidence.');
      }
      const closeoutCommit = option('closeout-commit');
      if ((task.reviewEvidence.closeout?.commit || '') !== closeoutCommit) {
        throw new Error('Released mechanical closeout commit must exactly match the accepted handoff evidence.');
      }
      taskCommits = acceptedTaskCommits(task.reviewEvidence);
      integrationCommit = option('integration-commit');
      requireExistingCommit(integrationCommit, '--integration-commit');
      const currentHead = currentGitHead();
      integrationBranch = currentGitBranch();
      if (integrationCommit !== currentHead) {
        throw new Error('--integration-commit must be the current central integration HEAD.');
      }
      if (integrationBranch === claim.branch) {
        throw new Error('Integrated release must run from a central integration branch, not the claimed task branch.');
      }
      requireAncestor(
        claim.sourceCommit,
        integrationCommit,
        'Integrated release requires the claimed baseline to be an ancestor of central integration HEAD.'
      );
      integrationMap = integrationMapping(claim.sourceCommit, taskCommits, integrationCommit);
      finalRegression = option('final-regression');
      if (finalRegression !== 'passed') {
        throw new Error('Integrated release requires --final-regression passed.');
      }
    } else if (option('cancel-confirmed') !== 'yes') {
      throw new Error('Cancelled release requires --cancel-confirmed yes from 00.');
    }
    const releaseExternal = mergeExternal(task, externalPatchFromOptions());
    if (releaseExternal.turnState !== 'completed' ||
      releaseExternal.turnOwner !== task.stopVerification.turnOwner ||
      releaseExternal.threadId !== task.stopVerification.threadId ||
      releaseExternal.clientId !== task.stopVerification.clientId) {
      throw new Error('RELEASED cannot alter or restart the separately verified completed turn.');
    }
    const releasedAt = new Date().toISOString();
    const scopeSnapshot = scopeSnapshotForClaim(claim);
    registry.claims = registry.claims.filter(item => item !== claim);
    applyLifecycleTransition(task, 'RELEASED', {
      actor,
      nextResponsible,
      reason,
      external: releaseExternal,
      release: {
        outcome,
        releasedAt,
        actor,
        sourceCommit: claim.sourceCommit,
        reviewedTaskCommits,
        taskCommits,
        integrationCommit,
        integrationBranch,
        integrationMap,
        finalRegression,
        scopeSnapshot,
        scopeFingerprint: scopeSnapshotFingerprint(scopeSnapshot),
        cancelConfirmed: outcome === 'cancelled'
      }
    });
    const persistence = writeRegistry(registry);
    const payload = { taskId, released: true, task, persistence, slots: slotSummary(registry) };
    if (jsonOutput) console.log(JSON.stringify(payload, null, 2));
    else {
      console.log(`RELEASED ${taskId} outcome=${outcome}`);
      console.log(`Write slots: ${payload.slots.occupied}/${maxWriteSlots}`);
    }
  });
}

function archive() {
  const taskId = option('task');
  if (!taskId) throw new Error('Missing --task <task-id>.');
  validateTaskId(taskId);
  const actor = option('actor');
  if (actor !== '00') throw new Error('Only 00 may record sidebar archive results.');
  const result = option('result');
  if (!['success', 'failed'].includes(result)) throw new Error('--result must be success or failed.');
  const nextResponsible = validateText(option('next'), '--next', { max: 100 });
  const reason = validateText(option('reason'), '--reason', { max: 500 });
  withLock(() => {
    const registry = readRegistry();
    const task = registry.tasks.find(item => item.taskId === taskId);
    if (!task) throw new Error('No authoritative lifecycle record for this task.');
    if (!['RELEASED', 'ARCHIVE_PENDING'].includes(task.state)) {
      throw new Error(`Archive is not allowed from ${task.state}; release must complete first.`);
    }
    requireStoppedTurn(task, 'Archive');
    const external = mergeExternal(task, externalPatchFromOptions());
    if (external.turnState !== 'completed' ||
      external.turnOwner !== task.stopVerification.turnOwner ||
      external.threadId !== task.stopVerification.threadId ||
      external.clientId !== task.stopVerification.clientId) {
      throw new Error('Archive cannot alter or restart the separately verified completed turn.');
    }
    if (result === 'success') {
      if (external.sidebarState !== 'absent') {
        throw new Error('Successful archive requires --sidebar-state absent after verification.');
      }
      if (task.release?.outcome === 'integrated' &&
        (task.release.finalRegression !== 'passed' || !task.release.taskCommits?.length ||
          !task.release.integrationCommit || !task.release.integrationMap?.length)) {
        throw new Error('Integrated tasks require reviewed task commit, integration commit, and final regression evidence before archive.');
      }
      if (task.release?.outcome === 'cancelled' && option('manual-confirmed') !== 'yes') {
        throw new Error('Cancelled tasks require --manual-confirmed yes before archive.');
      }
      applyLifecycleTransition(task, 'ARCHIVED', {
        actor,
        nextResponsible,
        reason,
        external
      });
    } else {
      applyLifecycleTransition(task, 'ARCHIVE_PENDING', {
        actor,
        nextResponsible,
        reason,
        external
      });
    }
    const persistence = writeRegistry(registry);
    if (jsonOutput) console.log(JSON.stringify({
      taskId,
      result,
      task,
      persistence,
      slots: slotSummary(registry)
    }, null, 2));
    else console.log(`${task.state} ${taskId}; next=${task.nextResponsible}`);
  });
}

try {
  if (command === 'status') status();
  else if (command === 'check') check();
  else if (command === 'reserve') reserve();
  else if (command === 'claim') claim();
  else if (command === 'transition') transition();
  else if (command === 'verify-stop') verifyStop();
  else if (command === 'cancel-reservation') cancelReservation();
  else if (command === 'resolve-integrity') resolveIntegrity();
  else if (command === 'migrate-legacy-worktree') migrateLegacyWorktree();
  else if (command === 'release') release();
  else if (command === 'archive') archive();
  else throw new Error(`Unknown command: ${command}`);
} catch (error) {
  console.error(`Task coordination error: ${error.message}`);
  process.exitCode = 1;
}
