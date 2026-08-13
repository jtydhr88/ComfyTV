import crypto from 'node:crypto';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawn, spawnSync, execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const SCRIPT_DIRECTORY = path.dirname(SCRIPT_PATH);
const require = createRequire(import.meta.url);
const SHA256_PATTERN = /^[0-9a-f]{64}$/;
const COMMIT_PATTERN = /^[0-9a-f]{40}$/;
const SAFE_RELATIVE_PATTERN = /^(?!\/)(?!.*(?:^|\/)\.\.(?:\/|$))(?!.*\0).+$/;

export class LatestPreviewError extends Error {
  constructor(code, details = {}) {
    super(code);
    this.name = 'LatestPreviewError';
    this.code = code;
    this.details = details;
  }
}

function fail(code, details = {}) {
  throw new LatestPreviewError(code, details);
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function requireExactKeys(value, expected, label) {
  if (!isPlainObject(value)) fail('LATEST_PREVIEW_INVALID_OBJECT', { label });
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  if (JSON.stringify(actual) !== JSON.stringify(wanted)) {
    fail('LATEST_PREVIEW_UNEXPECTED_FIELDS', {
      label,
      expected: wanted.join(','),
      actual: actual.join(',')
    });
  }
}

function requireString(value, label, { maximum = 4096, pattern = null } = {}) {
  if (typeof value !== 'string' || !value || value.length > maximum || /[\u0000-\u001f\u007f]/u.test(value)) {
    fail('LATEST_PREVIEW_INVALID_STRING', { label });
  }
  if (pattern && !pattern.test(value)) fail('LATEST_PREVIEW_INVALID_STRING', { label });
  return value;
}

function requireRelativePath(value, label) {
  const normalized = requireString(value, label, { maximum: 512 });
  if (!SAFE_RELATIVE_PATTERN.test(normalized) || path.normalize(normalized) !== normalized) {
    fail('LATEST_PREVIEW_INVALID_RELATIVE_PATH', { label });
  }
  return normalized;
}

function resolveInside(root, relativePath, label) {
  const safeRelative = requireRelativePath(relativePath, label);
  const resolved = path.resolve(root, safeRelative);
  if (resolved !== root && !resolved.startsWith(`${root}${path.sep}`)) {
    fail('LATEST_PREVIEW_PATH_ESCAPE', { label });
  }
  return resolved;
}

function assertSupportedNode(policy) {
  const major = Number(process.versions.node.split('.')[0]);
  if (!Number.isInteger(major) ||
    major < policy.runtime.minimumNodeMajor ||
    major > policy.runtime.maximumNodeMajor) {
    fail('LATEST_PREVIEW_NODE_VERSION_UNSUPPORTED', {
      actual: process.versions.node,
      expected: `${policy.runtime.minimumNodeMajor}-${policy.runtime.maximumNodeMajor}`
    });
  }
}

async function readJson(filePath, label, {
  maximumBytes = 1024 * 1024,
  secureMode = false,
  afterOpen = null
} = {}) {
  let handle;
  try {
    const nonBlocking = Number.isInteger(fs.constants.O_NONBLOCK) ? fs.constants.O_NONBLOCK : 0;
    handle = await fsp.open(
      filePath,
      fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW | nonBlocking
    );
  } catch (error) {
    if (error.code === 'ENOENT') {
      fail('LATEST_PREVIEW_FILE_MISSING', { label, path: filePath, error: error.code });
    }
    if (['ELOOP', 'EMLINK', 'EFTYPE'].includes(error.code)) {
      fail('LATEST_PREVIEW_FILE_TYPE_INVALID', { label, path: filePath, error: error.code });
    }
    fail('LATEST_PREVIEW_FILE_OPEN_FAILED', {
      label,
      path: filePath,
      error: error.code || error.message
    });
  }
  try {
    if (afterOpen) await afterOpen({ handle, filePath });
    const stat = await handle.stat();
    if (!stat.isFile()) {
      fail('LATEST_PREVIEW_FILE_TYPE_INVALID', { label, path: filePath });
    }
    if (secureMode && (stat.mode & 0o777) !== 0o600) {
      fail('LATEST_PREVIEW_FILE_MODE_INVALID', {
        label,
        path: filePath,
        actual: (stat.mode & 0o777).toString(8),
        expected: '600'
      });
    }
    if (stat.size <= 0 || stat.size > maximumBytes) {
      fail('LATEST_PREVIEW_FILE_SIZE_INVALID', { label, path: filePath, bytes: stat.size });
    }
    let contents;
    try {
      contents = await handle.readFile({ encoding: 'utf8' });
    } catch (error) {
      fail('LATEST_PREVIEW_FILE_READ_FAILED', {
        label,
        path: filePath,
        error: error.code || error.message
      });
    }
    try {
      return JSON.parse(contents);
    } catch (error) {
      fail('LATEST_PREVIEW_JSON_INVALID', { label, path: filePath, error: error.message });
    }
  } finally {
    await handle.close().catch(() => {});
  }
}

async function assertRegularFile(filePath, label, { executable = false } = {}) {
  let stat;
  try {
    stat = await fsp.lstat(filePath);
  } catch (error) {
    fail('LATEST_PREVIEW_FILE_MISSING', { label, path: filePath, error: error.code || error.message });
  }
  if (!stat.isFile() || stat.isSymbolicLink()) {
    fail('LATEST_PREVIEW_FILE_TYPE_INVALID', { label, path: filePath });
  }
  if (executable && (stat.mode & 0o111) === 0) {
    fail('LATEST_PREVIEW_FILE_NOT_EXECUTABLE', { label, path: filePath });
  }
  return stat;
}

async function ensurePrivateDirectory(directoryPath, label, { create = false } = {}) {
  try {
    const stat = await fsp.lstat(directoryPath);
    if (!stat.isDirectory() || stat.isSymbolicLink()) {
      fail('LATEST_PREVIEW_DIRECTORY_TYPE_INVALID', { label, path: directoryPath });
    }
    if ((stat.mode & 0o077) !== 0) {
      fail('LATEST_PREVIEW_DIRECTORY_MODE_INVALID', {
        label,
        path: directoryPath,
        actual: (stat.mode & 0o777).toString(8)
      });
    }
  } catch (error) {
    if (!(error instanceof LatestPreviewError) && error.code === 'ENOENT' && create) {
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

export async function atomicWriteFile(filePath, contents, { mode = 0o600 } = {}) {
  const directory = path.dirname(filePath);
  const temporary = path.join(
    directory,
    `.${path.basename(filePath)}.${process.pid}.${crypto.randomBytes(6).toString('hex')}.tmp`
  );
  let handle;
  try {
    handle = await fsp.open(temporary, 'wx', mode);
    await handle.writeFile(contents);
    await handle.sync();
    await handle.close();
    handle = undefined;
    await fsp.rename(temporary, filePath);
    await fsp.chmod(filePath, mode);
    await fsyncDirectory(directory);
  } catch (error) {
    if (handle) await handle.close().catch(() => {});
    await fsp.unlink(temporary).catch(() => {});
    throw error;
  }
}

export async function sha256File(filePath) {
  const hash = crypto.createHash('sha256');
  const stream = fs.createReadStream(filePath);
  for await (const chunk of stream) hash.update(chunk);
  return hash.digest('hex');
}

export async function loadLauncherPolicy(policyPath) {
  const policy = await readJson(policyPath, 'launcher-policy');
  requireExactKeys(policy, ['schemaVersion', 'launcher', 'pointer', 'source', 'runtime', 'i18n'], 'policy');
  if (policy.schemaVersion !== 1) fail('LATEST_PREVIEW_POLICY_VERSION_UNSUPPORTED');
  requireExactKeys(policy.launcher, [
    'applicationBundleName',
    'bundleIdentifier',
    'displayName',
    'executableName',
    'iconFileName',
    'supportDirectoryName',
    'pointerFileName',
    'profileDirectoryName',
    'bootstrapDirectoryName',
    'launchStateFileName',
    'publishLockName'
  ], 'policy.launcher');
  requireExactKeys(policy.pointer, [
    'schemaVersion',
    'requiredTitleToken',
    'maximumBytes',
    'fileMode'
  ], 'policy.pointer');
  requireExactKeys(policy.source, [
    'generatedHtmlRelativePath',
    'buildScriptRelativePath',
    'mainRelativePath',
    'packageJsonRelativePath',
    'packageLockRelativePath',
    'electronPackageRelativePath',
    'electronVersionRelativePath',
    'electronBinaryRelativePath'
  ], 'policy.source');
  requireExactKeys(policy.runtime, [
    'minimumNodeMajor',
    'maximumNodeMajor',
    'maximumGitOutputBytes'
  ], 'policy.runtime');
  requireExactKeys(policy.i18n, [
    'defaultLocale',
    'supportedLocales',
    'messageKeys'
  ], 'policy.i18n');
  requireExactKeys(policy.i18n.messageKeys, ['title', 'preview', 'errorPrefix'], 'policy.i18n.messageKeys');
  for (const value of Object.values(policy.launcher)) requireString(value, 'policy.launcher value');
  for (const [key, value] of Object.entries(policy.source)) requireRelativePath(value, `policy.source.${key}`);
  requireString(policy.pointer.requiredTitleToken, 'policy.pointer.requiredTitleToken', { maximum: 100 });
  if (policy.pointer.schemaVersion !== 2 ||
    policy.pointer.fileMode !== '0600' ||
    !Number.isInteger(policy.pointer.maximumBytes) ||
    policy.pointer.maximumBytes < 1024) {
    fail('LATEST_PREVIEW_POINTER_POLICY_INVALID');
  }
  if (!Array.isArray(policy.i18n.supportedLocales) ||
    !policy.i18n.supportedLocales.includes(policy.i18n.defaultLocale)) {
    fail('LATEST_PREVIEW_LOCALE_POLICY_INVALID');
  }
  for (const locale of policy.i18n.supportedLocales) requireString(locale, 'supported locale', { maximum: 20 });
  for (const key of Object.values(policy.i18n.messageKeys)) {
    requireString(key, 'launcher message key', {
      maximum: 100,
      pattern: /^[a-z][a-zA-Z0-9]*(?:\.[a-z][a-zA-Z0-9]*)+$/
    });
  }
  assertSupportedNode(policy);
  return policy;
}

export function launcherPaths(homeDirectory, policy) {
  const home = path.resolve(requireString(homeDirectory, 'homeDirectory', { maximum: 4096 }));
  const supportRoot = path.join(home, 'Library', 'Application Support', policy.launcher.supportDirectoryName);
  return {
    home,
    applicationPath: path.join(home, 'Applications', policy.launcher.applicationBundleName),
    supportRoot,
    pointerPath: path.join(supportRoot, policy.launcher.pointerFileName),
    profilePath: path.join(supportRoot, policy.launcher.profileDirectoryName),
    bootstrapDirectory: path.join(supportRoot, policy.launcher.bootstrapDirectoryName),
    launchStatePath: path.join(supportRoot, policy.launcher.launchStateFileName),
    publishLockPath: path.join(supportRoot, policy.launcher.publishLockName)
  };
}

function git(worktreePath, argumentsList, policy, { encoding = 'utf8' } = {}) {
  try {
    return execFileSync('/usr/bin/git', ['-C', worktreePath, ...argumentsList], {
      encoding,
      maxBuffer: policy.runtime.maximumGitOutputBytes,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, GIT_NO_REPLACE_OBJECTS: '1', LC_ALL: 'C', LANG: 'C' }
    });
  } catch (error) {
    fail('LATEST_PREVIEW_GIT_FAILED', {
      operation: argumentsList.join(' '),
      status: error.status ?? 'unknown',
      stderr: String(error.stderr || '').trim().slice(0, 2000)
    });
  }
}

async function validateWorktree(worktreePath, expectedCommit, policy) {
  requireString(worktreePath, 'worktreePath', { maximum: 4096 });
  if (!path.isAbsolute(worktreePath)) fail('LATEST_PREVIEW_WORKTREE_NOT_ABSOLUTE');
  if (!COMMIT_PATTERN.test(expectedCommit)) fail('LATEST_PREVIEW_COMMIT_INVALID');
  let stat;
  try {
    stat = await fsp.lstat(worktreePath);
  } catch (error) {
    fail('LATEST_PREVIEW_WORKTREE_MISSING', { path: worktreePath, error: error.code || error.message });
  }
  if (!stat.isDirectory() || stat.isSymbolicLink()) {
    fail('LATEST_PREVIEW_WORKTREE_TYPE_INVALID', { path: worktreePath });
  }
  const realWorktree = await fsp.realpath(worktreePath);
  if (realWorktree !== path.resolve(worktreePath)) {
    fail('LATEST_PREVIEW_WORKTREE_REALPATH_MISMATCH', {
      supplied: worktreePath,
      actual: realWorktree
    });
  }
  const topLevel = git(realWorktree, ['rev-parse', '--show-toplevel'], policy).trim();
  if (await fsp.realpath(topLevel) !== realWorktree) {
    fail('LATEST_PREVIEW_WORKTREE_ROOT_MISMATCH', { expected: realWorktree, actual: topLevel });
  }
  const actualCommit = git(realWorktree, ['rev-parse', 'HEAD'], policy).trim();
  if (actualCommit !== expectedCommit) {
    fail('LATEST_PREVIEW_COMMIT_MISMATCH', { expected: expectedCommit, actual: actualCommit });
  }
  const dirty = git(realWorktree, ['status', '--porcelain=v1', '-z', '--untracked-files=all'], policy);
  if (dirty.length !== 0) {
    const paths = dirty.split('\0').filter(Boolean).slice(0, 20).join(' | ');
    fail('LATEST_PREVIEW_WORKTREE_DIRTY', { paths, entries: dirty.split('\0').filter(Boolean).length });
  }
  return realWorktree;
}

async function validateGeneratedHtml(worktreePath, policy) {
  const htmlPath = resolveInside(worktreePath, policy.source.generatedHtmlRelativePath, 'generated HTML');
  const buildScriptPath = resolveInside(worktreePath, policy.source.buildScriptRelativePath, 'build script');
  await assertRegularFile(htmlPath, 'generated HTML');
  await assertRegularFile(buildScriptPath, 'build script');
  let generated;
  const previousCwd = process.cwd();
  try {
    process.chdir(worktreePath);
    let buildModule;
    try {
      const url = pathToFileURL(buildScriptPath);
      url.searchParams.set('latest-preview-validation', crypto.randomUUID());
      buildModule = await import(url.href);
    } catch (error) {
      fail('LATEST_PREVIEW_BUILD_MODULE_FAILED', { error: error.message });
    }
    if (typeof buildModule.buildHtml !== 'function') fail('LATEST_PREVIEW_BUILD_API_MISSING');
    try {
      generated = buildModule.buildHtml();
    } catch (error) {
      fail('LATEST_PREVIEW_BUILD_VALIDATION_FAILED', { error: error.message });
    }
  } finally {
    process.chdir(previousCwd);
  }
  if (typeof generated !== 'string') fail('LATEST_PREVIEW_BUILD_OUTPUT_INVALID');
  const checkedIn = await fsp.readFile(htmlPath, 'utf8');
  if (checkedIn !== generated) {
    fail('LATEST_PREVIEW_GENERATED_HTML_STALE', {
      path: policy.source.generatedHtmlRelativePath,
      checkedInBytes: Buffer.byteLength(checkedIn),
      generatedBytes: Buffer.byteLength(generated)
    });
  }
  return {
    path: htmlPath,
    sha256: await sha256File(htmlPath)
  };
}

async function validateElectronDependency(worktreePath, policy) {
  const packagePath = resolveInside(worktreePath, policy.source.packageJsonRelativePath, 'package.json');
  const packageLockPath = resolveInside(worktreePath, policy.source.packageLockRelativePath, 'package-lock.json');
  const electronPackagePath = resolveInside(
    worktreePath,
    policy.source.electronPackageRelativePath,
    'installed Electron package'
  );
  const electronVersionPath = resolveInside(
    worktreePath,
    policy.source.electronVersionRelativePath,
    'installed Electron version'
  );
  const electronBinaryPath = resolveInside(
    worktreePath,
    policy.source.electronBinaryRelativePath,
    'Electron binary'
  );
  const mainPath = resolveInside(worktreePath, policy.source.mainRelativePath, 'Electron main');
  const [packageJson, packageLock, installedElectron] = await Promise.all([
    readJson(packagePath, 'package.json'),
    readJson(packageLockPath, 'package-lock.json', { maximumBytes: 16 * 1024 * 1024 }),
    readJson(electronPackagePath, 'installed Electron package')
  ]);
  await assertRegularFile(electronVersionPath, 'installed Electron version');
  await assertRegularFile(electronBinaryPath, 'Electron binary', { executable: true });
  await assertRegularFile(mainPath, 'Electron main');
  const declared = packageJson.devDependencies?.electron;
  const locked = packageLock.packages?.['node_modules/electron']?.version;
  const installed = installedElectron.version;
  const distVersion = (await fsp.readFile(electronVersionPath, 'utf8')).trim();
  if (![declared, locked, installed, distVersion].every(value => typeof value === 'string' && value === declared)) {
    fail('LATEST_PREVIEW_ELECTRON_VERSION_MISMATCH', {
      declared: declared || 'missing',
      locked: locked || 'missing',
      installed: installed || 'missing',
      dist: distVersion || 'missing'
    });
  }
  if (packageJson.main !== policy.source.mainRelativePath) {
    fail('LATEST_PREVIEW_MAIN_ENTRY_MISMATCH', {
      expected: policy.source.mainRelativePath,
      actual: packageJson.main || 'missing'
    });
  }
  return {
    version: declared,
    binaryPath: electronBinaryPath,
    binarySha256: await sha256File(electronBinaryPath),
    mainPath,
    packageLockSha256: await sha256File(packageLockPath)
  };
}

export async function inspectPreviewSource({
  worktreePath,
  sourceCommit,
  policy
}) {
  const realWorktree = await validateWorktree(worktreePath, sourceCommit, policy);
  const [html, electron] = await Promise.all([
    validateGeneratedHtml(realWorktree, policy),
    validateElectronDependency(realWorktree, policy)
  ]);
  return {
    worktreePath: realWorktree,
    sourceCommit,
    html,
    electron
  };
}

export function pointerFromInspection({ inspection, title, policy, publishedAt = new Date().toISOString() }) {
  const normalizedTitle = requireString(title, 'title', { maximum: 200 });
  if (!normalizedTitle.includes(policy.pointer.requiredTitleToken)) {
    fail('LATEST_PREVIEW_TITLE_TOKEN_MISSING', {
      required: policy.pointer.requiredTitleToken
    });
  }
  if (!Number.isFinite(Date.parse(publishedAt))) fail('LATEST_PREVIEW_PUBLISHED_AT_INVALID');
  return {
    schemaVersion: policy.pointer.schemaVersion,
    title: normalizedTitle,
    worktreePath: inspection.worktreePath,
    sourceCommit: inspection.sourceCommit,
    publishedAt,
    source: {
      generatedHtmlRelativePath: policy.source.generatedHtmlRelativePath,
      generatedHtmlSha256: inspection.html.sha256,
      buildScriptRelativePath: policy.source.buildScriptRelativePath,
      mainRelativePath: policy.source.mainRelativePath,
      packageLockRelativePath: policy.source.packageLockRelativePath,
      packageLockSha256: inspection.electron.packageLockSha256,
      electronBinaryRelativePath: policy.source.electronBinaryRelativePath,
      electronBinarySha256: inspection.electron.binarySha256,
      electronVersion: inspection.electron.version
    }
  };
}

function validatePointerShape(pointer, policy) {
  requireExactKeys(pointer, [
    'schemaVersion',
    'title',
    'worktreePath',
    'sourceCommit',
    'publishedAt',
    'source'
  ], 'pointer');
  requireExactKeys(pointer.source, [
    'generatedHtmlRelativePath',
    'generatedHtmlSha256',
    'buildScriptRelativePath',
    'mainRelativePath',
    'packageLockRelativePath',
    'packageLockSha256',
    'electronBinaryRelativePath',
    'electronBinarySha256',
    'electronVersion'
  ], 'pointer.source');
  if (pointer.schemaVersion !== policy.pointer.schemaVersion) {
    fail('LATEST_PREVIEW_POINTER_VERSION_UNSUPPORTED');
  }
  requireString(pointer.title, 'pointer.title', { maximum: 200 });
  if (!pointer.title.includes(policy.pointer.requiredTitleToken)) {
    fail('LATEST_PREVIEW_TITLE_TOKEN_MISSING', { required: policy.pointer.requiredTitleToken });
  }
  requireString(pointer.worktreePath, 'pointer.worktreePath', { maximum: 4096 });
  if (!path.isAbsolute(pointer.worktreePath)) fail('LATEST_PREVIEW_WORKTREE_NOT_ABSOLUTE');
  requireString(pointer.sourceCommit, 'pointer.sourceCommit', { pattern: COMMIT_PATTERN });
  if (!Number.isFinite(Date.parse(pointer.publishedAt))) fail('LATEST_PREVIEW_PUBLISHED_AT_INVALID');
  const fixedPaths = {
    generatedHtmlRelativePath: policy.source.generatedHtmlRelativePath,
    buildScriptRelativePath: policy.source.buildScriptRelativePath,
    mainRelativePath: policy.source.mainRelativePath,
    packageLockRelativePath: policy.source.packageLockRelativePath,
    electronBinaryRelativePath: policy.source.electronBinaryRelativePath
  };
  for (const [field, expected] of Object.entries(fixedPaths)) {
    if (pointer.source[field] !== expected) {
      fail('LATEST_PREVIEW_POINTER_POLICY_MISMATCH', {
        field,
        expected,
        actual: pointer.source[field]
      });
    }
  }
  if (!SHA256_PATTERN.test(pointer.source.generatedHtmlSha256) ||
    !SHA256_PATTERN.test(pointer.source.packageLockSha256) ||
    !SHA256_PATTERN.test(pointer.source.electronBinarySha256)) {
    fail('LATEST_PREVIEW_POINTER_HASH_INVALID');
  }
  requireString(pointer.source.electronVersion, 'pointer.source.electronVersion', { maximum: 50 });
  return pointer;
}

export async function readPreviewPointer(pointerPath, policy, { afterOpen = null } = {}) {
  return validatePointerShape(await readJson(pointerPath, 'preview pointer', {
    maximumBytes: policy.pointer.maximumBytes,
    secureMode: true,
    afterOpen
  }), policy);
}

export async function validatePublishedPreview({ pointer, policy }) {
  validatePointerShape(pointer, policy);
  const inspection = await inspectPreviewSource({
    worktreePath: pointer.worktreePath,
    sourceCommit: pointer.sourceCommit,
    policy
  });
  const comparisons = {
    generatedHtmlSha256: inspection.html.sha256,
    packageLockSha256: inspection.electron.packageLockSha256,
    electronBinarySha256: inspection.electron.binarySha256,
    electronVersion: inspection.electron.version
  };
  for (const [field, actual] of Object.entries(comparisons)) {
    if (pointer.source[field] !== actual) {
      fail('LATEST_PREVIEW_SOURCE_FINGERPRINT_MISMATCH', {
        field,
        expected: pointer.source[field],
        actual
      });
    }
  }
  return { pointer, inspection };
}

function requestedLocale(policy) {
  const candidates = [
    Intl.DateTimeFormat().resolvedOptions().locale,
    process.env.LC_ALL,
    process.env.LANG
  ].filter(Boolean);
  for (const candidate of candidates) {
    const normalized = String(candidate).toLowerCase();
    if (normalized.startsWith('zh') && policy.i18n.supportedLocales.includes('zh-CN')) return 'zh-CN';
    if (normalized.startsWith('en') && policy.i18n.supportedLocales.includes('en-US')) return 'en-US';
  }
  return policy.i18n.defaultLocale;
}

export function loadLauncherMessages(localeDirectory, policy, locale = requestedLocale(policy)) {
  const selected = policy.i18n.supportedLocales.includes(locale) ? locale : policy.i18n.defaultLocale;
  let messages;
  try {
    messages = require(path.join(localeDirectory, `${selected}.js`));
  } catch (error) {
    fail('LATEST_PREVIEW_LOCALE_LOAD_FAILED', { locale: selected, error: error.message });
  }
  for (const key of Object.values(policy.i18n.messageKeys)) {
    if (typeof messages[key] !== 'string' || !messages[key]) {
      fail('LATEST_PREVIEW_LOCALE_KEY_MISSING', { locale: selected, key });
    }
  }
  return { locale: selected, messages };
}

function appleScriptString(value) {
  return `"${String(value).replaceAll('\\', '\\\\').replaceAll('"', '\\"').replaceAll('\r', '').replaceAll('\n', '\\n')}"`;
}

function errorDetails(error) {
  const details = error instanceof LatestPreviewError ? error.details : { error: error.message };
  return Object.entries(details)
    .map(([key, value]) => `${key}=${String(value)}`)
    .join('\n')
    .slice(0, 5000);
}

export function showFailureDialog(error, { policy, localeDirectory } = {}) {
  const code = error instanceof LatestPreviewError ? error.code : 'LATEST_PREVIEW_UNEXPECTED_FAILURE';
  let title = 'PreVision Latest Preview';
  let prefix = 'Runtime error: ';
  try {
    if (policy && localeDirectory) {
      const { messages } = loadLauncherMessages(localeDirectory, policy);
      title = `${messages[policy.i18n.messageKeys.title]} · ${messages[policy.i18n.messageKeys.preview]}`;
      prefix = messages[policy.i18n.messageKeys.errorPrefix];
    }
  } catch {
    // The ASCII fallback remains available even if launcher localization is damaged.
  }
  const details = errorDetails(error);
  const message = `${prefix}[${code}]${details ? `\n${details}` : ''}`;
  process.stderr.write(`${title}: ${message}\n`);
  spawnSync('/usr/bin/osascript', [
    '-e',
    `display alert ${appleScriptString(title)} message ${appleScriptString(message)} as critical`
  ], {
    encoding: 'utf8',
    timeout: 30000,
    maxBuffer: 1024 * 1024,
    stdio: ['ignore', 'ignore', 'ignore']
  });
}

async function loadLauncherConfig(configPath) {
  const config = await readJson(configPath, 'launcher config', { maximumBytes: 64 * 1024 });
  requireExactKeys(config, [
    'schemaVersion',
    'installedAt',
    'installerSourceCommit',
    'installerBranch',
    'nodeExecutable',
    'resources'
  ], 'launcher config');
  requireExactKeys(config.resources, [
    'runtimeSha256',
    'policySha256',
    'localeSha256'
  ], 'launcher config resources');
  if (config.schemaVersion !== 1 ||
    !Number.isFinite(Date.parse(config.installedAt)) ||
    !COMMIT_PATTERN.test(config.installerSourceCommit) ||
    !path.isAbsolute(config.nodeExecutable) ||
    !SHA256_PATTERN.test(config.resources.runtimeSha256) ||
    !SHA256_PATTERN.test(config.resources.policySha256) ||
    !isPlainObject(config.resources.localeSha256)) {
    fail('LATEST_PREVIEW_LAUNCHER_CONFIG_INVALID');
  }
  return config;
}

async function verifyInstalledResources(resourcesDirectory, config, policy) {
  const runtimePath = path.join(resourcesDirectory, 'latest-preview-launcher-runtime.mjs');
  const policyPath = path.join(resourcesDirectory, 'latest-preview-launcher-policy.json');
  if (await sha256File(runtimePath) !== config.resources.runtimeSha256 ||
    await sha256File(policyPath) !== config.resources.policySha256) {
    fail('LATEST_PREVIEW_LAUNCHER_RESOURCE_MISMATCH');
  }
  for (const locale of policy.i18n.supportedLocales) {
    const expected = config.resources.localeSha256[locale];
    const localePath = path.join(resourcesDirectory, 'i18n', 'locales', `${locale}.js`);
    if (!SHA256_PATTERN.test(expected || '') || await sha256File(localePath) !== expected) {
      fail('LATEST_PREVIEW_LAUNCHER_LOCALE_MISMATCH', { locale });
    }
  }
  const configuredNode = await fsp.realpath(config.nodeExecutable).catch(() => '');
  const runningNode = await fsp.realpath(process.execPath).catch(() => '');
  if (!configuredNode || configuredNode !== runningNode) {
    fail('LATEST_PREVIEW_NODE_RUNTIME_MISMATCH', {
      configured: config.nodeExecutable,
      actual: process.execPath
    });
  }
}

function bootstrapSource({
  title,
  worktreePath,
  sourceCommit,
  mainPath,
  profilePath,
  launchStatePath
}) {
  const config = JSON.stringify({
    title,
    worktreePath,
    sourceCommit,
    mainPath,
    profilePath,
    sessionPath: path.join(profilePath, 'Session'),
    launchStatePath
  });
  return `'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { app } = require('electron');
const config = ${config};

function writeState(status, extra = {}) {
  const payload = JSON.stringify({
    schemaVersion: 1,
    status,
    pid: process.pid,
    title: config.title,
    sourceCommit: config.sourceCommit,
    worktreePath: config.worktreePath,
    profilePath: config.profilePath,
    updatedAt: new Date().toISOString(),
    ...extra
  }, null, 2) + '\\n';
  const temporary = config.launchStatePath + '.' + process.pid + '.tmp';
  const descriptor = fs.openSync(temporary, 'w', 0o600);
  try {
    fs.writeFileSync(descriptor, payload);
    fs.fsyncSync(descriptor);
  } finally {
    fs.closeSync(descriptor);
  }
  fs.renameSync(temporary, config.launchStatePath);
}

fs.mkdirSync(config.profilePath, { recursive: true, mode: 0o700 });
fs.mkdirSync(config.sessionPath, { recursive: true, mode: 0o700 });
app.setPath('userData', config.profilePath);
app.setPath('sessionData', config.sessionPath);
app.setName(config.title);
app.on('browser-window-created', (_event, window) => {
  const enforceTitle = () => window.setTitle(config.title);
  window.on('page-title-updated', event => {
    event.preventDefault();
    enforceTitle();
  });
  window.webContents.once('did-finish-load', () => {
    enforceTitle();
    writeState('ready', { observedWindowTitle: window.getTitle() });
  });
  enforceTitle();
  writeState('window-created', { observedWindowTitle: window.getTitle() });
});
process.env.PREVISION_LATEST_PREVIEW = '1';
process.env.PREVISION_LATEST_PREVIEW_SOURCE = config.sourceCommit;
process.chdir(config.worktreePath);
try {
  require(config.mainPath);
  app.setName(config.title);
  writeState('main-loaded');
} catch (error) {
  writeState('main-failed', { error: String(error && (error.stack || error.message) || error).slice(0, 4000) });
  throw error;
}
`;
}

async function prepareBootstrap(validated, paths) {
  await ensurePrivateDirectory(paths.supportRoot, 'support root');
  await ensurePrivateDirectory(paths.profilePath, 'isolated profile', { create: true });
  await ensurePrivateDirectory(paths.bootstrapDirectory, 'bootstrap directory', { create: true });
  const bootstrapPath = path.join(paths.bootstrapDirectory, 'latest-preview-bootstrap.cjs');
  const contents = bootstrapSource({
    title: validated.pointer.title,
    worktreePath: validated.inspection.worktreePath,
    sourceCommit: validated.pointer.sourceCommit,
    mainPath: validated.inspection.electron.mainPath,
    profilePath: paths.profilePath,
    launchStatePath: paths.launchStatePath
  });
  await atomicWriteFile(bootstrapPath, contents, { mode: 0o600 });
  return bootstrapPath;
}

async function spawnPreview(validated, paths, bootstrapPath) {
  const finalBinarySha256 = await sha256File(validated.inspection.electron.binaryPath);
  if (finalBinarySha256 !== validated.pointer.source.electronBinarySha256) {
    fail('LATEST_PREVIEW_SOURCE_FINGERPRINT_MISMATCH', {
      field: 'electronBinarySha256',
      expected: validated.pointer.source.electronBinarySha256,
      actual: finalBinarySha256
    });
  }
  const starting = {
    schemaVersion: 1,
    status: 'validated',
    pid: process.pid,
    title: validated.pointer.title,
    sourceCommit: validated.pointer.sourceCommit,
    worktreePath: validated.inspection.worktreePath,
    profilePath: paths.profilePath,
    updatedAt: new Date().toISOString()
  };
  await atomicWriteFile(paths.launchStatePath, `${JSON.stringify(starting, null, 2)}\n`, { mode: 0o600 });
  const child = spawn(validated.inspection.electron.binaryPath, [bootstrapPath], {
    cwd: validated.inspection.worktreePath,
    detached: true,
    stdio: 'ignore',
    env: {
      ...process.env,
      PREVISION_LATEST_PREVIEW: '1',
      PREVISION_LATEST_PREVIEW_SOURCE: validated.pointer.sourceCommit
    }
  });
  await new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('spawn', resolve);
  }).catch(error => fail('LATEST_PREVIEW_ELECTRON_SPAWN_FAILED', { error: error.message }));
  child.unref();
  return child.pid;
}

export async function runInstalledLauncher({
  resourcesDirectory = SCRIPT_DIRECTORY,
  homeDirectory = os.homedir(),
  launch = true
} = {}) {
  const policyPath = path.join(resourcesDirectory, 'latest-preview-launcher-policy.json');
  const configPath = path.join(resourcesDirectory, 'launcher-config.json');
  const localeDirectory = path.join(resourcesDirectory, 'i18n', 'locales');
  const policy = await loadLauncherPolicy(policyPath);
  const config = await loadLauncherConfig(configPath);
  await verifyInstalledResources(resourcesDirectory, config, policy);
  const paths = launcherPaths(homeDirectory, policy);
  await ensurePrivateDirectory(paths.supportRoot, 'support root');
  const pointer = await readPreviewPointer(paths.pointerPath, policy);
  const validated = await validatePublishedPreview({ pointer, policy });
  if (!launch) return { policy, paths, validated, pid: null };
  const bootstrapPath = await prepareBootstrap(validated, paths);
  const pid = await spawnPreview(validated, paths, bootstrapPath);
  return { policy, paths, validated, pid };
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === SCRIPT_PATH;
if (isMain) {
  let policy;
  const localeDirectory = path.join(SCRIPT_DIRECTORY, 'i18n', 'locales');
  try {
    policy = await loadLauncherPolicy(path.join(SCRIPT_DIRECTORY, 'latest-preview-launcher-policy.json'));
    await runInstalledLauncher();
  } catch (error) {
    showFailureDialog(error, { policy, localeDirectory });
    process.exitCode = 1;
  }
}
