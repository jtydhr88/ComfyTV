import crypto from 'node:crypto';
import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import {
  LatestPreviewError,
  atomicWriteFile,
  launcherPaths,
  loadLauncherPolicy,
  sha256File
} from './latest-preview-launcher-runtime.mjs';

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(SCRIPT_PATH), '..');
const POLICY_PATH = path.join(ROOT, 'qa', 'latest-preview-launcher-policy.json');
const require = createRequire(import.meta.url);
const SOURCE_FILES = Object.freeze([
  'scripts/install-latest-preview-launcher.mjs',
  'scripts/latest-preview-launcher-runtime.mjs',
  'qa/latest-preview-launcher-policy.json',
  'i18n/locales/zh-CN.js',
  'i18n/locales/en-US.js',
  'assets/PreVisionIcon.icns'
]);

function fail(code, details = {}) {
  throw new LatestPreviewError(code, details);
}

function xmlEscape(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

function shellSingleQuote(value) {
  return `'${String(value).replaceAll("'", "'\"'\"'")}'`;
}

function appleScriptString(value) {
  return `"${String(value)
    .replaceAll('\\', '\\\\')
    .replaceAll('"', '\\"')
    .replaceAll('\r', '')
    .replaceAll('\n', '\\n')}"`;
}

function git(argumentsList, { allowFailure = false } = {}) {
  try {
    return execFileSync('/usr/bin/git', ['-C', ROOT, ...argumentsList], {
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, GIT_NO_REPLACE_OBJECTS: '1', LC_ALL: 'C', LANG: 'C' }
    }).trim();
  } catch (error) {
    if (allowFailure) return null;
    fail('LATEST_PREVIEW_INSTALLER_GIT_FAILED', {
      operation: argumentsList.join(' '),
      status: error.status ?? 'unknown'
    });
  }
}

async function assertDirectory(directoryPath, label, { create = false, privateMode = false } = {}) {
  try {
    const stat = await fsp.lstat(directoryPath);
    if (!stat.isDirectory() || stat.isSymbolicLink()) {
      fail('LATEST_PREVIEW_INSTALL_DIRECTORY_INVALID', { label, path: directoryPath });
    }
    if (privateMode && (stat.mode & 0o077) !== 0) {
      fail('LATEST_PREVIEW_INSTALL_DIRECTORY_MODE_INVALID', {
        label,
        path: directoryPath,
        actual: (stat.mode & 0o777).toString(8)
      });
    }
  } catch (error) {
    if (!(error instanceof LatestPreviewError) && error.code === 'ENOENT' && create) {
      await fsp.mkdir(directoryPath, { recursive: true, mode: privateMode ? 0o700 : 0o755 });
      if (privateMode) await fsp.chmod(directoryPath, 0o700);
      return;
    }
    throw error;
  }
}

async function assertRegularSource(sourcePath, label) {
  let stat;
  try {
    stat = await fsp.lstat(sourcePath);
  } catch (error) {
    fail('LATEST_PREVIEW_INSTALL_SOURCE_MISSING', { label, path: sourcePath, error: error.code || error.message });
  }
  if (!stat.isFile() || stat.isSymbolicLink()) {
    fail('LATEST_PREVIEW_INSTALL_SOURCE_INVALID', { label, path: sourcePath });
  }
}

function verifySourceProvenance() {
  const branch = git(['branch', '--show-current']);
  const commit = git(['rev-parse', 'HEAD']);
  if (!branch || !/^[0-9a-f]{40}$/.test(commit)) {
    fail('LATEST_PREVIEW_INSTALL_SOURCE_IDENTITY_INVALID');
  }
  for (const file of SOURCE_FILES) {
    if (git(['ls-files', '--error-unmatch', '--', file], { allowFailure: true }) === null) {
      fail('LATEST_PREVIEW_INSTALL_SOURCE_UNTRACKED', { file });
    }
  }
  const unstaged = git(['diff', '--name-only', '--', ...SOURCE_FILES]);
  const staged = git(['diff', '--cached', '--name-only', '--', ...SOURCE_FILES]);
  if (unstaged || staged) {
    fail('LATEST_PREVIEW_INSTALL_SOURCE_DIRTY', {
      unstaged: unstaged || 'none',
      staged: staged || 'none'
    });
  }
  return { branch, commit };
}

function infoPlist(policy) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleDevelopmentRegion</key>
  <string>zh_CN</string>
  <key>CFBundleDisplayName</key>
  <string>${xmlEscape(policy.launcher.displayName)}</string>
  <key>CFBundleExecutable</key>
  <string>${xmlEscape(policy.launcher.executableName)}</string>
  <key>CFBundleIconFile</key>
  <string>${xmlEscape(policy.launcher.iconFileName)}</string>
  <key>CFBundleIdentifier</key>
  <string>${xmlEscape(policy.launcher.bundleIdentifier)}</string>
  <key>CFBundleInfoDictionaryVersion</key>
  <string>6.0</string>
  <key>CFBundleName</key>
  <string>${xmlEscape(policy.launcher.displayName)}</string>
  <key>CFBundlePackageType</key>
  <string>APPL</string>
  <key>CFBundleShortVersionString</key>
  <string>1.0</string>
  <key>CFBundleVersion</key>
  <string>1</string>
  <key>LSMinimumSystemVersion</key>
  <string>13.0</string>
  <key>LSUIElement</key>
  <true/>
  <key>NSHighResolutionCapable</key>
  <true/>
</dict>
</plist>
`;
}

function launcherExecutable(nodeExecutable) {
  return `#!/bin/sh
set -eu
SELF_DIR=$(CDPATH= cd -- "$(/usr/bin/dirname -- "$0")" && /bin/pwd -P)
RESOURCES_DIR=$(CDPATH= cd -- "$SELF_DIR/../Resources" && /bin/pwd -P)
NODE_EXECUTABLE=${shellSingleQuote(nodeExecutable)}
if [ ! -x "$NODE_EXECUTABLE" ]; then
  LANGUAGES=$(/usr/bin/defaults read -g AppleLanguages 2>/dev/null || true)
  case "$LANGUAGES" in
    *zh*) FALLBACK="$RESOURCES_DIR/fallback-zh-CN.applescript" ;;
    *) FALLBACK="$RESOURCES_DIR/fallback-en-US.applescript" ;;
  esac
  if [ -f "$FALLBACK" ]; then /usr/bin/osascript "$FALLBACK" >/dev/null 2>&1 || true; fi
  exit 72
fi
exec "$NODE_EXECUTABLE" "$RESOURCES_DIR/latest-preview-launcher-runtime.mjs"
`;
}

function fallbackAppleScript(messages, policy) {
  const title = `${messages[policy.i18n.messageKeys.title]} · ${messages[policy.i18n.messageKeys.preview]}`;
  const message = `${messages[policy.i18n.messageKeys.errorPrefix]}[LATEST_PREVIEW_NODE_RUNTIME_MISSING]`;
  return `display alert ${appleScriptString(title)} message ${appleScriptString(message)} as critical\n`;
}

async function copyRegularFile(sourcePath, destinationPath, mode = 0o644) {
  await assertRegularSource(sourcePath, path.basename(sourcePath));
  await fsp.copyFile(sourcePath, destinationPath);
  await fsp.chmod(destinationPath, mode);
}

function bundleIdentifier(appPath) {
  const infoPath = path.join(appPath, 'Contents', 'Info.plist');
  try {
    return execFileSync('/usr/bin/plutil', [
      '-extract',
      'CFBundleIdentifier',
      'raw',
      '-o',
      '-',
      infoPath
    ], {
      encoding: 'utf8',
      maxBuffer: 1024 * 1024,
      stdio: ['ignore', 'pipe', 'pipe']
    }).trim();
  } catch (error) {
    fail('LATEST_PREVIEW_INSTALL_BUNDLE_ID_UNREADABLE', {
      path: appPath,
      status: error.status ?? 'unknown'
    });
  }
}

async function assertLauncherBundle(appPath, policy, { verifySignature = true } = {}) {
  let stat;
  try {
    stat = await fsp.lstat(appPath);
  } catch (error) {
    fail('LATEST_PREVIEW_INSTALL_BUNDLE_MISSING', { path: appPath, error: error.code || error.message });
  }
  if (!stat.isDirectory() || stat.isSymbolicLink()) {
    fail('LATEST_PREVIEW_INSTALL_BUNDLE_TYPE_INVALID', { path: appPath });
  }
  const identifier = bundleIdentifier(appPath);
  if (identifier !== policy.launcher.bundleIdentifier) {
    fail('LATEST_PREVIEW_INSTALL_BUNDLE_ID_MISMATCH', {
      path: appPath,
      expected: policy.launcher.bundleIdentifier,
      actual: identifier
    });
  }
  const executable = path.join(appPath, 'Contents', 'MacOS', policy.launcher.executableName);
  const executableStat = await fsp.lstat(executable).catch(() => null);
  if (!executableStat?.isFile() || executableStat.isSymbolicLink() || (executableStat.mode & 0o111) === 0) {
    fail('LATEST_PREVIEW_INSTALL_EXECUTABLE_INVALID', { path: executable });
  }
  if (verifySignature) {
    try {
      execFileSync('/usr/bin/codesign', ['--verify', '--deep', '--strict', appPath], {
        stdio: ['ignore', 'ignore', 'pipe'],
        maxBuffer: 4 * 1024 * 1024
      });
    } catch (error) {
      fail('LATEST_PREVIEW_INSTALL_SIGNATURE_INVALID', {
        path: appPath,
        status: error.status ?? 'unknown'
      });
    }
  }
}

async function removeOwnedBundle(appPath, policy) {
  await assertLauncherBundle(appPath, policy, { verifySignature: false });
  await fsp.rm(appPath, { recursive: true, force: false });
}

async function buildStagedBundle({
  stageApp,
  policy,
  nodeExecutable,
  sourceIdentity,
  signBundle
}) {
  const contents = path.join(stageApp, 'Contents');
  const macosDirectory = path.join(contents, 'MacOS');
  const resourcesDirectory = path.join(contents, 'Resources');
  const localeDirectory = path.join(resourcesDirectory, 'i18n', 'locales');
  await fsp.mkdir(macosDirectory, { recursive: true, mode: 0o755 });
  await fsp.mkdir(localeDirectory, { recursive: true, mode: 0o755 });

  const runtimeSource = path.join(ROOT, 'scripts', 'latest-preview-launcher-runtime.mjs');
  const policySource = POLICY_PATH;
  const iconSource = path.join(ROOT, 'assets', 'PreVisionIcon.icns');
  const runtimeDestination = path.join(resourcesDirectory, 'latest-preview-launcher-runtime.mjs');
  const policyDestination = path.join(resourcesDirectory, 'latest-preview-launcher-policy.json');
  await Promise.all([
    copyRegularFile(runtimeSource, runtimeDestination),
    copyRegularFile(policySource, policyDestination),
    copyRegularFile(iconSource, path.join(resourcesDirectory, policy.launcher.iconFileName))
  ]);

  const localeHashes = {};
  for (const locale of policy.i18n.supportedLocales) {
    const source = path.join(ROOT, 'i18n', 'locales', `${locale}.js`);
    const destination = path.join(localeDirectory, `${locale}.js`);
    await copyRegularFile(source, destination);
    const messages = require(source);
    for (const key of Object.values(policy.i18n.messageKeys)) {
      if (typeof messages[key] !== 'string' || !messages[key]) {
        fail('LATEST_PREVIEW_INSTALL_LOCALE_KEY_MISSING', { locale, key });
      }
    }
    await fsp.writeFile(
      path.join(resourcesDirectory, `fallback-${locale}.applescript`),
      fallbackAppleScript(messages, policy),
      { mode: 0o644 }
    );
    localeHashes[locale] = await sha256File(destination);
  }

  const config = {
    schemaVersion: 1,
    installedAt: new Date().toISOString(),
    installerSourceCommit: sourceIdentity.commit,
    installerBranch: sourceIdentity.branch,
    nodeExecutable,
    resources: {
      runtimeSha256: await sha256File(runtimeDestination),
      policySha256: await sha256File(policyDestination),
      localeSha256: localeHashes
    }
  };
  await fsp.writeFile(path.join(resourcesDirectory, 'launcher-config.json'), `${JSON.stringify(config, null, 2)}\n`, {
    mode: 0o644
  });
  await fsp.writeFile(path.join(contents, 'Info.plist'), infoPlist(policy), { mode: 0o644 });
  const executablePath = path.join(macosDirectory, policy.launcher.executableName);
  await fsp.writeFile(executablePath, launcherExecutable(nodeExecutable), { mode: 0o755 });
  await fsp.chmod(executablePath, 0o755);

  if (signBundle) {
    try {
      execFileSync('/usr/bin/codesign', [
        '--force',
        '--deep',
        '--sign',
        '-',
        '--timestamp=none',
        stageApp
      ], {
        stdio: ['ignore', 'ignore', 'pipe'],
        maxBuffer: 4 * 1024 * 1024
      });
    } catch (error) {
      fail('LATEST_PREVIEW_INSTALL_SIGNING_FAILED', {
        status: error.status ?? 'unknown',
        stderr: String(error.stderr || '').trim().slice(0, 2000)
      });
    }
  }
  await assertLauncherBundle(stageApp, policy, { verifySignature: signBundle });
}

export async function installLatestPreviewLauncher({
  homeDirectory = os.homedir(),
  repositoryRoot = ROOT,
  nodeExecutable = process.execPath,
  verifyCommittedSources = true,
  signBundle = true,
  beforeActivate = null
} = {}) {
  if (path.resolve(repositoryRoot) !== ROOT) {
    fail('LATEST_PREVIEW_INSTALL_REPOSITORY_MISMATCH');
  }
  const policy = await loadLauncherPolicy(POLICY_PATH);
  const resolvedNode = await fsp.realpath(nodeExecutable).catch(() => '');
  if (!resolvedNode) fail('LATEST_PREVIEW_INSTALL_NODE_MISSING', { path: nodeExecutable });
  const nodeStat = await fsp.lstat(resolvedNode);
  if (!nodeStat.isFile() || nodeStat.isSymbolicLink() || (nodeStat.mode & 0o111) === 0) {
    fail('LATEST_PREVIEW_INSTALL_NODE_INVALID', { path: resolvedNode });
  }
  const sourceIdentity = verifyCommittedSources
    ? verifySourceProvenance()
    : {
        branch: git(['branch', '--show-current']) || 'test',
        commit: git(['rev-parse', 'HEAD']) || '0'.repeat(40)
      };
  const paths = launcherPaths(homeDirectory, policy);
  const applicationsDirectory = path.dirname(paths.applicationPath);
  await assertDirectory(applicationsDirectory, 'Applications', { create: true });
  await assertDirectory(paths.supportRoot, 'support root', { create: true, privateMode: true });

  const existingStat = await fsp.lstat(paths.applicationPath).catch(error => {
    if (error.code === 'ENOENT') return null;
    throw error;
  });
  if (existingStat) {
    await assertLauncherBundle(paths.applicationPath, policy, { verifySignature: signBundle });
  }

  const transactionRoot = path.join(
    paths.supportRoot,
    `.launcher-install-${process.pid}-${crypto.randomBytes(6).toString('hex')}`
  );
  const stageApp = path.join(transactionRoot, policy.launcher.applicationBundleName);
  const backupApp = path.join(paths.supportRoot, '.launcher-install-backup.app');
  if (await fsp.lstat(backupApp).catch(() => null)) {
    fail('LATEST_PREVIEW_INSTALL_BACKUP_PRESENT', { path: backupApp });
  }
  await fsp.mkdir(transactionRoot, { recursive: false, mode: 0o700 });
  let backedUp = false;
  let activated = false;
  try {
    await buildStagedBundle({
      stageApp,
      policy,
      nodeExecutable: resolvedNode,
      sourceIdentity,
      signBundle
    });
    if (beforeActivate) await beforeActivate({ stageApp, targetApp: paths.applicationPath });
    if (existingStat) {
      await fsp.rename(paths.applicationPath, backupApp);
      backedUp = true;
    }
    await fsp.rename(stageApp, paths.applicationPath);
    activated = true;
    await fsp.rmdir(transactionRoot);
    await assertLauncherBundle(paths.applicationPath, policy, { verifySignature: signBundle });
    await fsp.open(applicationsDirectory, 'r').then(async handle => {
      try { await handle.sync(); } finally { await handle.close(); }
    });
    if (backedUp) {
      await removeOwnedBundle(backupApp, policy);
      backedUp = false;
    }
    return {
      applicationPath: paths.applicationPath,
      supportRoot: paths.supportRoot,
      sourceIdentity,
      nodeExecutable: resolvedNode
    };
  } catch (error) {
    if (activated) {
      await removeOwnedBundle(paths.applicationPath, policy).catch(() => {});
      activated = false;
    }
    if (backedUp) {
      await fsp.rename(backupApp, paths.applicationPath).catch(() => {});
      backedUp = false;
    }
    await fsp.rm(transactionRoot, { recursive: true, force: true }).catch(() => {});
    throw error;
  }
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === SCRIPT_PATH;
if (isMain) {
  try {
    if (process.argv.length !== 2) fail('LATEST_PREVIEW_INSTALL_ARGUMENTS_UNSUPPORTED');
    const result = await installLatestPreviewLauncher();
    console.log(`Latest preview launcher installed: ${result.applicationPath}`);
    console.log(`Installer source: ${result.sourceIdentity.commit} (${result.sourceIdentity.branch})`);
    console.log(`Node runtime: ${result.nodeExecutable}`);
  } catch (error) {
    console.error(`${error.code || 'LATEST_PREVIEW_INSTALL_FAILED'}: ${error.message}`);
    if (error.details) console.error(JSON.stringify(error.details));
    process.exitCode = 1;
  }
}
