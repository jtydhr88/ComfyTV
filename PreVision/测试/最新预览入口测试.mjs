import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { installLatestPreviewLauncher } from '../scripts/install-latest-preview-launcher.mjs';
import { publishLatestPreview } from '../scripts/publish-latest-preview.mjs';
import {
  LatestPreviewError,
  inspectPreviewSource,
  launcherPaths,
  loadLauncherPolicy,
  readPreviewPointer,
  runInstalledLauncher,
  validatePublishedPreview
} from '../scripts/latest-preview-launcher-runtime.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const POLICY_PATH = path.join(ROOT, 'qa', 'latest-preview-launcher-policy.json');
const require = createRequire(import.meta.url);
const MACHINE_PATH_PREFIX = `/${'Users'}/`;
let passed = 0;
let failed = 0;

function check(condition, message) {
  try {
    assert.ok(condition, message);
    passed += 1;
  } catch (error) {
    failed += 1;
    console.error(`  FAIL: ${error.message}`);
  }
}

async function checkRejects(operation, expectedCode, message) {
  try {
    await operation();
    check(false, `${message}: expected ${expectedCode}`);
  } catch (error) {
    check(error instanceof LatestPreviewError && error.code === expectedCode,
      `${message}: actual ${error.code || error.message}`);
  }
}

function git(cwd, argumentsList) {
  return execFileSync('/usr/bin/git', ['-C', cwd, ...argumentsList], {
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, GIT_NO_REPLACE_OBJECTS: '1', LC_ALL: 'C', LANG: 'C' }
  }).trim();
}

async function write(filePath, contents, mode = 0o644) {
  await fsp.mkdir(path.dirname(filePath), { recursive: true });
  await fsp.writeFile(filePath, contents, { mode });
  await fsp.chmod(filePath, mode);
}

async function makePreviewFixture(parentDirectory) {
  const fixture = path.join(parentDirectory, 'preview-worktree');
  await fsp.mkdir(fixture, { recursive: true });
  await write(path.join(fixture, '.gitignore'), 'node_modules/\n');
  await write(path.join(fixture, 'expected.html'), '<!doctype html><title>Fixture Preview</title>\n');
  await write(path.join(fixture, '预见PreVision.html'), '<!doctype html><title>Fixture Preview</title>\n');
  await write(
    path.join(fixture, 'scripts', 'build-app.mjs'),
    `import fs from 'node:fs';\nimport path from 'node:path';\nimport { fileURLToPath } from 'node:url';\nconst root = path.resolve(fileURLToPath(new URL('../', import.meta.url)));\nexport function buildHtml(){return process.cwd() === root ? fs.readFileSync(new URL('../expected.html', import.meta.url), 'utf8') : '<!doctype html><title>Wrong cwd</title>\\n';}\n`
  );
  await write(path.join(fixture, 'electron', 'main.cjs'), "'use strict';\n");
  await write(path.join(fixture, 'package.json'), `${JSON.stringify({
    name: 'preview-fixture',
    version: '1.0.0',
    main: 'electron/main.cjs',
    devDependencies: { electron: '43.1.0' }
  }, null, 2)}\n`);
  await write(path.join(fixture, 'package-lock.json'), `${JSON.stringify({
    name: 'preview-fixture',
    version: '1.0.0',
    lockfileVersion: 3,
    requires: true,
    packages: {
      '': {
        name: 'preview-fixture',
        version: '1.0.0',
        devDependencies: { electron: '43.1.0' }
      },
      'node_modules/electron': {
        version: '43.1.0'
      }
    }
  }, null, 2)}\n`);
  await write(
    path.join(fixture, 'node_modules', 'electron', 'package.json'),
    `${JSON.stringify({ name: 'electron', version: '43.1.0' }, null, 2)}\n`
  );
  await write(path.join(fixture, 'node_modules', 'electron', 'dist', 'version'), '43.1.0\n');
  await write(
    path.join(fixture, 'node_modules', 'electron', 'dist', 'Electron.app', 'Contents', 'MacOS', 'Electron'),
    '#!/bin/sh\nexit 0\n',
    0o755
  );
  git(fixture, ['init', '-q']);
  git(fixture, ['config', 'user.name', 'PreVision Test']);
  git(fixture, ['config', 'user.email', 'prevision-test@example.invalid']);
  git(fixture, ['add', '.']);
  git(fixture, ['commit', '-q', '-m', 'fixture']);
  return {
    path: await fsp.realpath(fixture),
    commit: git(fixture, ['rev-parse', 'HEAD'])
  };
}

async function sha256(filePath) {
  return crypto.createHash('sha256').update(await fsp.readFile(filePath)).digest('hex');
}

const scratch = await fsp.mkdtemp(path.join(os.tmpdir(), 'prevision-latest-preview-test-'));
try {
  const policy = await loadLauncherPolicy(POLICY_PATH);
  const home = path.join(scratch, 'home');
  await fsp.mkdir(home, { recursive: true });
  const paths = launcherPaths(home, policy);
  const fixedSentinel = path.join(home, 'Applications', 'PreVision.app', 'sentinel.txt');
  await write(fixedSentinel, 'fixed-app-untouched\n');

  console.log('· Policy and language-key boundary');
  check(policy.schemaVersion === 1 && policy.pointer.schemaVersion === 2,
    'policy schema is version 1 and fingerprinted pointer schema is version 2');
  check(policy.pointer.requiredTitleToken === 'NOT INTEGRATED', 'pointer requires an explicit non-integrated title');
  check(!JSON.stringify(policy).includes(MACHINE_PATH_PREFIX), 'policy contains no committed machine path');
  for (const locale of policy.i18n.supportedLocales) {
    const messages = require(path.join(ROOT, 'i18n', 'locales', `${locale}.js`));
    for (const key of Object.values(policy.i18n.messageKeys)) {
      check(typeof messages[key] === 'string' && messages[key].length > 0,
        `${locale} provides launcher message key ${key}`);
    }
  }
  for (const relative of [
    'scripts/install-latest-preview-launcher.mjs',
    'scripts/publish-latest-preview.mjs',
    'scripts/latest-preview-launcher-runtime.mjs'
  ]) {
    const source = await fsp.readFile(path.join(ROOT, relative), 'utf8');
    check(!source.includes(MACHINE_PATH_PREFIX), `${relative} contains no committed machine path`);
    check(!/\b(?:killall|pkill)\b/.test(source), `${relative} does not kill unrelated processes`);
  }

  console.log('· Minimal launcher installation and rollback');
  const installed = await installLatestPreviewLauncher({
    homeDirectory: home,
    verifyCommittedSources: false,
    signBundle: false
  });
  check(installed.applicationPath === paths.applicationPath, 'installer writes only the dedicated launcher bundle');
  check(await fsp.readFile(fixedSentinel, 'utf8') === 'fixed-app-untouched\n',
    'installer leaves the fixed App sentinel untouched');
  const executable = path.join(
    installed.applicationPath,
    'Contents',
    'MacOS',
    policy.launcher.executableName
  );
  const executableStat = await fsp.lstat(executable);
  check(executableStat.isFile() && (executableStat.mode & 0o111) !== 0,
    'launcher contains a small executable entry');
  check(!(await fsp.lstat(installed.applicationPath)).isSymbolicLink(), 'launcher bundle is not a symlink');
  const configPath = path.join(installed.applicationPath, 'Contents', 'Resources', 'launcher-config.json');
  const installedConfig = JSON.parse(await fsp.readFile(configPath, 'utf8'));
  const installedRuntime = await fsp.readFile(
    path.join(installed.applicationPath, 'Contents', 'Resources', 'latest-preview-launcher-runtime.mjs'),
    'utf8'
  );
  check(!Object.hasOwn(installedConfig, 'sourceCommit'),
    'launcher config does not bake a preview commit; the external pointer remains authoritative');
  check(!`${JSON.stringify(installedConfig)}\n${installedRuntime}`.includes('0'.repeat(40)),
    'installed text resources contain no all-zero commit placeholder');
  const beforeRollback = await sha256(configPath);
  await checkRejects(
    () => installLatestPreviewLauncher({
      homeDirectory: home,
      verifyCommittedSources: false,
      signBundle: false,
      beforeActivate: async () => { throw new LatestPreviewError('INJECTED_INSTALL_FAILURE'); }
    }),
    'INJECTED_INSTALL_FAILURE',
    'injected pre-activation failure is reported'
  );
  check(await sha256(configPath) === beforeRollback, 'failed reinstall preserves the previous launcher');
  check(await fsp.readFile(fixedSentinel, 'utf8') === 'fixed-app-untouched\n',
    'failed reinstall still leaves the fixed App untouched');

  const wrongHome = path.join(scratch, 'wrong-home');
  const wrongPaths = launcherPaths(wrongHome, policy);
  await write(
    path.join(wrongPaths.applicationPath, 'Contents', 'Info.plist'),
    `<?xml version="1.0"?><plist version="1.0"><dict><key>CFBundleIdentifier</key><string>invalid.bundle</string></dict></plist>\n`
  );
  await checkRejects(
    () => installLatestPreviewLauncher({
      homeDirectory: wrongHome,
      verifyCommittedSources: false,
      signBundle: false
    }),
    'LATEST_PREVIEW_INSTALL_BUNDLE_ID_MISMATCH',
    'identity-mismatched target is rejected'
  );
  check((await fsp.readFile(path.join(wrongPaths.applicationPath, 'Contents', 'Info.plist'), 'utf8'))
    .includes('invalid.bundle'), 'identity-mismatched target is not overwritten');

  console.log('· Atomic pointer publication and exact source validation');
  const fixture = await makePreviewFixture(scratch);
  await checkRejects(
    () => publishLatestPreview({
      worktreePath: fixture.path,
      sourceCommit: fixture.commit,
      title: 'Fixture Preview',
      homeDirectory: home
    }),
    'LATEST_PREVIEW_TITLE_TOKEN_MISSING',
    'publisher refuses an integrated-looking title'
  );
  const published = await publishLatestPreview({
    worktreePath: fixture.path,
    sourceCommit: fixture.commit,
    title: 'Fixture Preview — NOT INTEGRATED',
    homeDirectory: home
  });
  const pointerStat = await fsp.lstat(published.pointerPath);
  check(pointerStat.isFile() && !pointerStat.isSymbolicLink(), 'published pointer is a regular file');
  check((pointerStat.mode & 0o777) === 0o600, 'published pointer is mode 0600');
  check(published.pointer.sourceCommit === fixture.commit, 'pointer records the exact source commit');
  check(published.pointer.worktreePath === fixture.path, 'pointer records the exact real worktree');
  check(published.pointer.title.includes('NOT INTEGRATED'), 'pointer title remains visibly non-integrated');
  check(await sha256(path.join(fixture.path, policy.source.electronBinaryRelativePath)) ===
    published.pointer.source.electronBinarySha256,
    'pointer records the locked Electron binary SHA-256');
  check(process.cwd() === ROOT, 'source validation restores the launcher working directory');

  const displacedPointer = path.join(paths.supportRoot, 'opened-pointer.json');
  const maliciousPointer = path.join(paths.supportRoot, 'malicious-pointer.json');
  const maliciousPayload = structuredClone(published.pointer);
  maliciousPayload.title = 'Malicious replacement — NOT INTEGRATED';
  await write(maliciousPointer, `${JSON.stringify(maliciousPayload, null, 2)}\n`, 0o600);
  const inodeBoundPointer = await readPreviewPointer(published.pointerPath, policy, {
    afterOpen: async () => {
      await fsp.rename(published.pointerPath, displacedPointer);
      await fsp.symlink(maliciousPointer, published.pointerPath);
    }
  });
  check(inodeBoundPointer.title === published.pointer.title,
    'pointer read remains bound to the inode opened before a deterministic path swap');
  await checkRejects(
    () => readPreviewPointer(published.pointerPath, policy),
    'LATEST_PREVIEW_FILE_TYPE_INVALID',
    'runtime rejects a pointer path that is already a symlink'
  );
  await fsp.unlink(published.pointerPath);
  await fsp.rename(displacedPointer, published.pointerPath);
  const fifoPointer = path.join(paths.supportRoot, 'pointer.fifo');
  execFileSync('/usr/bin/mkfifo', [fifoPointer], { stdio: 'ignore' });
  await checkRejects(
    () => readPreviewPointer(fifoPointer, policy),
    'LATEST_PREVIEW_FILE_TYPE_INVALID',
    'non-blocking pointer open rejects a FIFO before attempting to read it'
  );
  await fsp.unlink(fifoPointer);

  const pointerBeforeFailure = await fsp.readFile(published.pointerPath, 'utf8');
  await checkRejects(
    () => publishLatestPreview({
      worktreePath: fixture.path,
      sourceCommit: fixture.commit,
      title: 'Replacement — NOT INTEGRATED',
      homeDirectory: home,
      beforeCommit: async () => { throw new LatestPreviewError('INJECTED_POINTER_FAILURE'); }
    }),
    'INJECTED_POINTER_FAILURE',
    'injected pointer transaction failure is reported'
  );
  check(await fsp.readFile(published.pointerPath, 'utf8') === pointerBeforeFailure,
    'failed pointer transaction preserves the previous complete pointer');

  const resourcesDirectory = path.join(installed.applicationPath, 'Contents', 'Resources');
  const validation = await runInstalledLauncher({
    resourcesDirectory,
    homeDirectory: home,
    launch: false
  });
  check(validation.validated.pointer.sourceCommit === fixture.commit,
    'installed runtime validates the exact published commit');
  check(validation.validated.inspection.electron.version === '43.1.0',
    'installed runtime validates the locked Electron version');
  check(validation.validated.inspection.html.sha256 === published.pointer.source.generatedHtmlSha256,
    'installed runtime validates generated HTML bytes');
  check(validation.validated.inspection.electron.binarySha256 ===
    published.pointer.source.electronBinarySha256,
    'installed runtime validates the locked Electron binary bytes');

  console.log('· Fail-closed pointer, tree, dependency, and profile paths');
  const missingPointerHome = path.join(scratch, 'missing-pointer-home');
  await fsp.mkdir(
    path.join(missingPointerHome, 'Library', 'Application Support', policy.launcher.supportDirectoryName),
    { recursive: true, mode: 0o700 }
  );
  await checkRejects(
    () => runInstalledLauncher({
      resourcesDirectory,
      homeDirectory: missingPointerHome,
      launch: false
    }),
    'LATEST_PREVIEW_FILE_MISSING',
    'runtime does not fall back when the pointer is missing'
  );

  const dirtyFile = path.join(fixture.path, 'expected.html');
  const originalExpected = await fsp.readFile(dirtyFile, 'utf8');
  await fsp.appendFile(dirtyFile, '<!-- dirty -->\n');
  await checkRejects(
    () => runInstalledLauncher({ resourcesDirectory, homeDirectory: home, launch: false }),
    'LATEST_PREVIEW_WORKTREE_DIRTY',
    'runtime rejects a dirty source worktree'
  );
  await fsp.writeFile(dirtyFile, originalExpected);
  check(git(fixture.path, ['status', '--porcelain']) === '', 'fixture is clean again after dirty-tree injection');

  const mismatchedPointer = structuredClone(published.pointer);
  mismatchedPointer.sourceCommit = '0'.repeat(40);
  await checkRejects(
    () => validatePublishedPreview({ pointer: mismatchedPointer, policy }),
    'LATEST_PREVIEW_COMMIT_MISMATCH',
    'runtime rejects a commit mismatch'
  );

  const electronBinary = path.join(
    fixture.path,
    policy.source.electronBinaryRelativePath
  );
  const originalElectronBinary = await fsp.readFile(electronBinary);
  await fsp.writeFile(electronBinary, '#!/bin/sh\nexit 9\n', { mode: 0o755 });
  await fsp.chmod(electronBinary, 0o755);
  check(git(fixture.path, ['status', '--porcelain']) === '',
    'same-version Electron binary replacement remains outside Git status');
  await checkRejects(
    () => validatePublishedPreview({ pointer: published.pointer, policy }),
    'LATEST_PREVIEW_SOURCE_FINGERPRINT_MISMATCH',
    'runtime rejects same-version executable Electron binary replacement after publication'
  );
  await fsp.writeFile(electronBinary, originalElectronBinary, { mode: 0o755 });
  await fsp.chmod(electronBinary, 0o755);
  const restoredBinaryValidation = await validatePublishedPreview({
    pointer: published.pointer,
    policy
  });
  check(restoredBinaryValidation.inspection.electron.binarySha256 ===
    published.pointer.source.electronBinarySha256,
    'restored locked Electron binary remains a valid safety control');
  const missingElectron = `${electronBinary}.missing`;
  await fsp.rename(electronBinary, missingElectron);
  await checkRejects(
    () => runInstalledLauncher({ resourcesDirectory, homeDirectory: home, launch: false }),
    'LATEST_PREVIEW_FILE_MISSING',
    'runtime rejects a missing locked Electron binary'
  );
  await fsp.rename(missingElectron, electronBinary);

  await fsp.symlink(path.join(scratch, 'outside-profile'), paths.profilePath);
  await checkRejects(
    () => runInstalledLauncher({ resourcesDirectory, homeDirectory: home, launch: true }),
    'LATEST_PREVIEW_DIRECTORY_TYPE_INVALID',
    'runtime rejects a symlinked isolated profile before spawning Electron'
  );
  await fsp.unlink(paths.profilePath);

  await fsp.writeFile(path.join(fixture.path, 'expected.html'), '<!doctype html><title>New Build</title>\n');
  git(fixture.path, ['add', 'expected.html']);
  git(fixture.path, ['commit', '-q', '-m', 'stale generated html fixture']);
  const staleCommit = git(fixture.path, ['rev-parse', 'HEAD']);
  await checkRejects(
    () => inspectPreviewSource({
      worktreePath: fixture.path,
      sourceCommit: staleCommit,
      policy
    }),
    'LATEST_PREVIEW_GENERATED_HTML_STALE',
    'runtime rejects a clean commit whose generated HTML is stale'
  );

  console.log('· Command entry contract');
  const packageJson = JSON.parse(await fsp.readFile(path.join(ROOT, 'package.json'), 'utf8'));
  check(packageJson.scripts['preview:launcher:install'] === 'node scripts/install-latest-preview-launcher.mjs',
    'package exposes the controlled installer');
  check(packageJson.scripts['preview:publish'] === 'node scripts/publish-latest-preview.mjs',
    'package exposes the controlled pointer publisher');
  check(packageJson.scripts['test:latest-preview'] === 'node 测试/最新预览入口测试.mjs',
    'package exposes the directed launcher test');
} finally {
  await fsp.rm(scratch, { recursive: true, force: true });
}

console.log(`\n最新预览入口测试：${passed} 通过，${failed} 失败`);
if (failed) process.exitCode = 1;
