/*
 * Fixed LAN latest-preview service contract tests.
 * Uses only Git object reads and temporary home/support directories.
 */
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  LatestPreviewLanError,
  LatestPreviewSnapshotManager,
  authorizeLanRequest,
  buildSnapshot,
  lanServicePaths,
  loadLanPolicy,
  requireNonRootCurrentUid,
  selectPhysicalLanNetwork
} from '../scripts/latest-preview-lan-runtime.mjs';
import {
  createLatestPreviewLanLoaderSource,
  installLatestPreviewLanService,
  statusLatestPreviewLanService,
  uninstallLatestPreviewLanService,
  validateManagedEntryStat
} from '../scripts/install-latest-preview-lan-service.mjs';
import { loadLauncherPolicy } from '../scripts/latest-preview-launcher-runtime.mjs';
import { createRequestHandler } from '../scripts/web-runtime-lib.mjs';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const lanPolicyPath = path.join(repositoryRoot, 'qa', 'latest-preview-lan-policy.json');
const launcherPolicyPath = path.join(repositoryRoot, 'qa', 'latest-preview-launcher-policy.json');
let passed = 0;
let failed = 0;

async function test(name, body) {
  try {
    await body();
    passed += 1;
    console.log(`  ✓ ${name}`);
  } catch (error) {
    failed += 1;
    console.error(`  ✗ ${name}`);
    console.error(`    ${error.stack || error.message}`);
  }
}

async function withTempDirectory(body) {
  const directory = await fsp.mkdtemp(path.join(os.tmpdir(), 'prevision-lan-test-'));
  try {
    return await body(directory);
  } finally {
    await fsp.rm(directory, { recursive: true, force: true });
  }
}

function git(argumentsList, { encoding = 'utf8' } = {}) {
  return execFileSync('/usr/bin/git', ['-C', repositoryRoot, ...argumentsList], {
    encoding,
    maxBuffer: 64 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: {
      ...process.env,
      GIT_NO_REPLACE_OBJECTS: '1',
      LC_ALL: 'C',
      LANG: 'C'
    }
  });
}

function fingerprint(pointer) {
  return crypto.createHash('sha256').update(JSON.stringify(pointer)).digest('hex');
}

function fakePointer(sourceCommit) {
  return {
    schemaVersion: 2,
    title: 'PreVision NOT INTEGRATED',
    worktreePath: repositoryRoot,
    sourceCommit,
    publishedAt: '2026-07-29T00:00:00.000Z',
    source: {
      generatedHtmlRelativePath: '预见PreVision.html',
      generatedHtmlSha256: '0'.repeat(64),
      buildScriptRelativePath: 'scripts/build-app.mjs',
      mainRelativePath: 'electron/main.cjs',
      packageLockRelativePath: 'package-lock.json',
      packageLockSha256: '1'.repeat(64),
      electronBinaryRelativePath: 'node_modules/electron/dist/Electron.app/Contents/MacOS/Electron',
      electronBinarySha256: '2'.repeat(64),
      electronVersion: '43.1.0'
    }
  };
}

function fakeLaunchctl({ failBootstrap = false } = {}) {
  const calls = [];
  let loaded = false;
  const runner = argumentsList => {
    calls.push([...argumentsList]);
    let status = 0;
    if (argumentsList[0] === 'print') status = loaded ? 0 : 1;
    else if (argumentsList[0] === 'bootout') loaded = false;
    else if (argumentsList[0] === 'bootstrap') {
      status = failBootstrap ? 1 : 0;
      if (!status) loaded = true;
    }
    return { status, stdout: '', stderr: status ? 'injected failure' : '' };
  };
  return { calls, runner };
}

console.log('· LAN policy and network boundary');

await test('policy fixes 4174, private snapshots, physical interfaces, and exact resources', async () => {
  const policy = await loadLanPolicy(lanPolicyPath);
  assert.equal(policy.service.port, 4174);
  assert.equal(policy.service.healthPath, '/__prevision/health');
  assert.equal(policy.snapshot.retainedReadySnapshots, 2);
  assert.deepEqual(policy.network.privateIpv4Ranges, [
    '10.0.0.0/8',
    '172.16.0.0/12',
    '192.168.0.0/16'
  ]);
  assert.ok(policy.source.installedResources.includes('scripts/web-runtime-lib.mjs'));
  assert.ok(policy.source.installedResources.includes('scripts/latest-preview-launcher-runtime.mjs'));
});

await test('network selection accepts one private default en interface and rejects VPN/public ambiguity', async () => {
  const policy = await loadLanPolicy(lanPolicyPath);
  const selected = selectPhysicalLanNetwork(policy, {
    routeInterface: 'en12',
    hostname: 'MacBook-Pro.local',
    networkInterfaces: {
      en12: [{
        address: '192.168.1.200',
        netmask: '255.255.255.0',
        family: 'IPv4',
        internal: false
      }],
      utun4: [{
        address: '198.18.0.1',
        netmask: '255.255.255.252',
        family: 'IPv4',
        internal: false
      }]
    }
  });
  assert.equal(selected.interfaceName, 'en12');
  assert.equal(selected.address, '192.168.1.200');
  assert.deepEqual(selected.allowedHosts, ['macbook-pro.local', '192.168.1.200']);
  assert.throws(() => selectPhysicalLanNetwork(policy, {
    routeInterface: 'utun4',
    hostname: 'MacBook-Pro.local',
    networkInterfaces: {
      utun4: [{
        address: '10.0.0.2',
        netmask: '255.255.255.0',
        family: 'IPv4',
        internal: false
      }]
    }
  }), /LAN_DEFAULT_ROUTE_NOT_PHYSICAL/);
  assert.throws(() => selectPhysicalLanNetwork(policy, {
    routeInterface: 'en0',
    hostname: 'MacBook-Pro.local',
    networkInterfaces: {
      en0: [{
        address: '203.0.113.10',
        netmask: '255.255.255.0',
        family: 'IPv4',
        internal: false
      }]
    }
  }), /LAN_PRIVATE_ADDRESS_AMBIGUOUS/);
});

await test('request authorization requires exact listener, same private subnet, Host, and port', async () => {
  const network = {
    interfaceName: 'en12',
    address: '192.168.1.200',
    netmask: '255.255.255.0',
    hostname: 'macbook-pro.local',
    port: 4174,
    allowedHosts: ['macbook-pro.local', '192.168.1.200']
  };
  const request = (overrides = {}) => ({
    headers: { host: 'macbook-pro.local:4174', ...(overrides.headers || {}) },
    socket: {
      localAddress: '192.168.1.200',
      localPort: 4174,
      remoteAddress: '192.168.1.22',
      ...(overrides.socket || {})
    }
  });
  assert.equal(authorizeLanRequest(request(), network), true);
  assert.equal(authorizeLanRequest(request({ headers: { host: '192.168.1.200:4174' } }), network), true);
  assert.equal(authorizeLanRequest(request({ headers: { host: 'attacker.local:4174' } }), network), false);
  assert.equal(authorizeLanRequest(request({ socket: { remoteAddress: '192.168.2.22' } }), network), false);
  assert.equal(authorizeLanRequest(request({ socket: { remoteAddress: '100.64.0.2' } }), network), false);
  assert.equal(authorizeLanRequest(request({ socket: { localAddress: '0.0.0.0' } }), network), false);
});

await test('root execution and foreign-owned managed entries fail closed before service actions', async () => {
  assert.throws(
    () => requireNonRootCurrentUid(() => 0, () => 0),
    /LAN_ROOT_EXECUTION_FORBIDDEN/
  );
  const foreign = {
    uid: process.getuid() + 1,
    mode: 0o100600,
    isFile: () => true,
    isDirectory: () => false,
    isSymbolicLink: () => false
  };
  assert.throws(() => validateManagedEntryStat(foreign, {
    label: 'foreign fixture',
    expectedUid: process.getuid(),
    expectedType: 'file',
    expectedMode: 0o600
  }), /LAN_INSTALL_MANAGED_ENTRY_INVALID/);
  const owned = { ...foreign, uid: process.getuid() };
  assert.equal(validateManagedEntryStat(owned, {
    label: 'owned fixture',
    expectedUid: process.getuid(),
    expectedType: 'file',
    expectedMode: 0o600
  }), owned);
  await withTempDirectory(async homeDirectory => {
    const launchctl = fakeLaunchctl();
    const originalGetuid = process.getuid;
    const originalGeteuid = process.geteuid;
    try {
      process.getuid = () => 0;
      process.geteuid = () => 0;
      await assert.rejects(statusLatestPreviewLanService({
        homeDirectory,
        launchctlRunner: launchctl.runner
      }), /LAN_ROOT_EXECUTION_FORBIDDEN/);
      assert.equal(launchctl.calls.length, 0);

      process.getuid = () => originalGetuid.call(process) + 1;
      process.geteuid = () => originalGetuid.call(process) + 1;
      const launcherPolicy = await loadLauncherPolicy(launcherPolicyPath);
      await fsp.mkdir(
        path.join(homeDirectory, 'Library', 'Application Support', launcherPolicy.launcher.supportDirectoryName),
        { recursive: true, mode: 0o700 }
      );
      await assert.rejects(statusLatestPreviewLanService({
        homeDirectory,
        launchctlRunner: launchctl.runner
      }), /LAN_INSTALL_MANAGED_ENTRY_INVALID/);
      assert.equal(launchctl.calls.length, 0);
    } finally {
      process.getuid = originalGetuid;
      process.geteuid = originalGeteuid;
    }
  });
});

console.log('· Git-object Web snapshot and rollback');

await test('snapshot build materializes only exact commit blobs into a private verified ready directory', async () => {
  await withTempDirectory(async directory => {
    const policy = await loadLanPolicy(lanPolicyPath);
    const commit = git(['rev-parse', 'HEAD']).trim();
    const html = git(['show', `${commit}:预见PreVision.html`], { encoding: null });
    const pointer = fakePointer(commit);
    pointer.source.generatedHtmlSha256 = crypto.createHash('sha256').update(html).digest('hex');
    const paths = {
      root: path.join(directory, 'LanService'),
      stagingRoot: path.join(directory, 'LanService', 'Staging'),
      snapshotsRoot: path.join(directory, 'LanService', 'Snapshots')
    };
    await fsp.mkdir(paths.stagingRoot, { recursive: true, mode: 0o700 });
    await fsp.mkdir(paths.snapshotsRoot, { recursive: true, mode: 0o700 });
    const snapshot = await buildSnapshot({
      pointer,
      fingerprint: fingerprint(pointer),
      paths,
      policy
    });
    assert.equal(snapshot.metadata.sourceCommit, commit);
    assert.equal(snapshot.deployment.routes.has('/'), true);
    assert.equal(snapshot.deployment.routes.has('/director/'), true);
    assert.equal((await fsp.lstat(snapshot.snapshotRoot)).isSymbolicLink(), false);
    assert.equal((await fsp.lstat(path.join(snapshot.snapshotRoot, 'web', 'prevision-web-manifest.json'))).isFile(), true);
    assert.equal(await fsp.lstat(path.join(snapshot.snapshotRoot, 'Source')).catch(() => null), null);

    const invalidPointer = structuredClone(pointer);
    invalidPointer.source.generatedHtmlSha256 = 'f'.repeat(64);
    await assert.rejects(buildSnapshot({
      pointer: invalidPointer,
      fingerprint: fingerprint(invalidPointer),
      paths,
      policy
    }), /LAN_POINTER_GENERATED_HTML_MISMATCH/);
    assert.deepEqual(await fsp.readdir(paths.stagingRoot), []);
  });
});

await test('active snapshot corruption atomically invalidates ready state and recovers only after full verification', async () => {
  await withTempDirectory(async homeDirectory => {
    const lanPolicy = await loadLanPolicy(lanPolicyPath);
    const launcherPolicy = await loadLauncherPolicy(launcherPolicyPath);
    const paths = lanServicePaths(homeDirectory, launcherPolicy, lanPolicy);
    await fsp.mkdir(paths.launcherSupportRoot, { recursive: true, mode: 0o700 });
    await fsp.chmod(paths.launcherSupportRoot, 0o700);
    const commit = git(['rev-parse', 'HEAD']).trim();
    const html = git(['show', `${commit}:预见PreVision.html`], { encoding: null });
    const pointer = fakePointer(commit);
    pointer.source.generatedHtmlSha256 = crypto.createHash('sha256').update(html).digest('hex');
    const manager = new LatestPreviewSnapshotManager({
      paths,
      lanPolicy,
      launcherPolicy,
      pointerReader: async () => structuredClone(pointer),
      sourceValidator: async () => ({ inspection: { worktreePath: repositoryRoot } })
    });
    await manager.initialize();
    assert.equal((await manager.ensureCurrent()).metadata.sourceCommit, commit);

    const corruptions = [
      ['manifest truncation', 'prevision-web-manifest.json', async (target, bytes, mode) => {
        await fsp.writeFile(target, bytes.subarray(0, Math.max(1, bytes.length - 1)));
        await fsp.chmod(target, mode);
      }],
      ['asset truncation', 'i18n/runtime.js', async (target, bytes, mode) => {
        await fsp.writeFile(target, bytes.subarray(0, Math.max(1, bytes.length - 1)));
        await fsp.chmod(target, mode);
      }],
      ['asset symlink', 'i18n/runtime.js', async (target, bytes) => {
        const backup = path.join(homeDirectory, 'symlink-target.js');
        await fsp.writeFile(backup, bytes, { mode: 0o600 });
        await fsp.unlink(target);
        await fsp.symlink(backup, target);
      }],
      ['asset FIFO', 'i18n/runtime.js', async target => {
        await fsp.unlink(target);
        execFileSync('/usr/bin/mkfifo', [target]);
        await fsp.chmod(target, 0o600);
      }]
    ];
    for (const [label, relativePath, corrupt] of corruptions) {
      const target = path.join(manager.active.webRoot, relativePath);
      const original = await fsp.readFile(target);
      const originalMode = (await fsp.lstat(target)).mode & 0o777;
      await corrupt(target, original, originalMode);
      assert.equal(await manager.ensureCurrent(), null, label);
      assert.equal(manager.active, null, label);
      assert.equal(manager.lastState.status, 'error', label);
      assert.equal(manager.lastState.readyCommit, null, label);
      assert.doesNotMatch(JSON.stringify(manager.lastState), /Users|Application Support|prevision-lan-test/);
      await fsp.rm(target, { force: true });
      await fsp.writeFile(target, original, { mode: originalMode });
      await fsp.chmod(target, originalMode);
      assert.equal((await manager.ensureCurrent()).metadata.sourceCommit, commit, `${label} recovery`);
      assert.equal(manager.lastState.status, 'ready', `${label} recovery`);
    }

    const raceTarget = path.join(manager.active.webRoot, 'i18n/runtime.js');
    const raceOriginal = await fsp.readFile(raceTarget);
    const raceMode = (await fsp.lstat(raceTarget)).mode & 0o777;
    await fsp.writeFile(raceTarget, raceOriginal.subarray(0, raceOriginal.length - 1));
    await fsp.chmod(raceTarget, raceMode);
    const response = {
      headersSent: false,
      statusCode: null,
      body: '',
      writeHead(statusCode) {
        this.statusCode = statusCode;
        this.headersSent = true;
      },
      end(body = '') {
        this.body += String(body);
      },
      destroy() {
        this.destroyed = true;
      }
    };
    const handler = createRequestHandler(manager.active.deployment, {
      address: () => ({ address: '192.168.1.200', port: 4174 })
    }, {
      allowedHosts: ['192.168.1.200'],
      deploymentFailureStatus: 503,
      onDeploymentFailure: error => manager.invalidateActive(error)
    });
    await handler({
      method: 'GET',
      url: '/i18n/runtime.js',
      headers: { host: '192.168.1.200:4174' }
    }, response);
    assert.equal(response.statusCode, 503);
    assert.equal(response.body, 'Preview Unavailable\n');
    assert.equal(manager.lastState.status, 'error');
    assert.equal(manager.lastState.readyCommit, null);
    await fsp.writeFile(raceTarget, raceOriginal, { mode: raceMode });
    await fsp.chmod(raceTarget, raceMode);
    assert.equal((await manager.ensureCurrent()).metadata.sourceCommit, commit);
  });
});

await test('failed pointer update keeps the prior ready record and exposes only a redacted error state', async () => {
  await withTempDirectory(async homeDirectory => {
    const lanPolicy = await loadLanPolicy(lanPolicyPath);
    const launcherPolicy = await loadLauncherPolicy(launcherPolicyPath);
    const paths = lanServicePaths(homeDirectory, launcherPolicy, lanPolicy);
    await fsp.mkdir(paths.launcherSupportRoot, { recursive: true, mode: 0o700 });
    let target = fakePointer('a'.repeat(40));
    const manager = new LatestPreviewSnapshotManager({
      paths,
      lanPolicy,
      launcherPolicy,
      pointerReader: async () => structuredClone(target),
      sourceValidator: async () => {},
      snapshotBuilder: async ({ pointer, fingerprint: targetFingerprint }) => {
        if (pointer.sourceCommit.startsWith('b')) {
          throw new LatestPreviewLanError('LAN_INJECTED_BUILD_FAILURE', {
            path: path.join(homeDirectory, 'must-not-leak')
          });
        }
        return {
          metadata: {
            schemaVersion: 1,
            snapshotName: `${pointer.sourceCommit}-${'1'.repeat(16)}-${targetFingerprint.slice(0, 16)}`,
            sourceCommit: pointer.sourceCommit,
            pointerFingerprint: targetFingerprint,
            manifestSha256: '1'.repeat(64),
            builtAt: new Date().toISOString()
          },
          deployment: {}
        };
      }
    });
    await manager.initialize();
    const first = await manager.ensureCurrent();
    assert.equal(first.metadata.sourceCommit, 'a'.repeat(40));
    const readyBefore = await fsp.readFile(paths.readyPath, 'utf8');

    target = fakePointer('b'.repeat(40));
    const failedUpdate = await manager.ensureCurrent();
    assert.equal(failedUpdate, null);
    assert.equal(manager.active.metadata.sourceCommit, 'a'.repeat(40));
    assert.equal(await fsp.readFile(paths.readyPath, 'utf8'), readyBefore);
    assert.equal(manager.lastState.status, 'error');
    assert.equal(manager.lastState.targetCommit, 'b'.repeat(40));
    assert.equal(manager.lastState.readyCommit, 'a'.repeat(40));
    assert.equal(manager.lastState.errorCode, 'LAN_INJECTED_BUILD_FAILURE');
    assert.doesNotMatch(JSON.stringify(manager.lastState), new RegExp(homeDirectory.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  });
});

await test('verified loader bytes remain the executed bytes after same-path replacement', async () => {
  await withTempDirectory(async root => {
    root = await fsp.realpath(root);
    const versionsRoot = path.join(root, 'Versions');
    const versionName = `${'a'.repeat(40)}-${'b'.repeat(16)}`;
    const versionRoot = path.join(versionsRoot, versionName);
    const serviceName = 'latest-preview-lan-service.mjs';
    const servicePath = path.join(versionRoot, serviceName);
    const safeSource = Buffer.from(
      'export async function runLatestPreviewLanService(){globalThis.__LAN_SAFE_EXECUTED__=true;}'
    );
    const maliciousSource = Buffer.from(
      'globalThis.__LAN_MALICIOUS_EXECUTED__=true;export async function runLatestPreviewLanService(){}'
    );
    await fsp.mkdir(versionRoot, { recursive: true, mode: 0o700 });
    await fsp.chmod(root, 0o700);
    await fsp.chmod(versionsRoot, 0o700);
    await fsp.chmod(versionRoot, 0o700);
    await fsp.writeFile(servicePath, safeSource, { mode: 0o600 });
    await fsp.chmod(servicePath, 0o600);
    const loader = Buffer.from(createLatestPreviewLanLoaderSource([serviceName], root));
    const loaderSha256 = crypto.createHash('sha256').update(loader).digest('hex');
    const active = {
      schemaVersion: 2,
      versionName,
      sourceCommit: 'a'.repeat(40),
      installedAt: new Date().toISOString(),
      nodeExecutable: await fsp.realpath(process.execPath),
      loaderSha256,
      resources: {
        [serviceName]: crypto.createHash('sha256').update(safeSource).digest('hex')
      }
    };
    await fsp.writeFile(path.join(root, 'active.json'), `${JSON.stringify(active)}\n`, { mode: 0o600 });
    await fsp.chmod(path.join(root, 'active.json'), 0o600);
    globalThis.__PREVISION_LAN_LOADER_ANCHOR__ = {
      loaderSha256,
      root,
      uid: process.getuid()
    };
    globalThis.__PREVISION_LAN_LOADER_TEST_AFTER_VERIFY__ = async () => {
      await fsp.rename(servicePath, `${servicePath}.verified`);
      await fsp.writeFile(servicePath, maliciousSource, { mode: 0o600 });
      await fsp.chmod(servicePath, 0o600);
    };
    const originalStderrWrite = process.stderr.write;
    let loaderError = '';
    process.stderr.write = chunk => {
      loaderError += String(chunk);
      return true;
    };
    try {
      await import(`data:text/javascript;base64,${loader.toString('base64')}#${crypto.randomUUID()}`);
      assert.equal(globalThis.__LAN_SAFE_EXECUTED__, true, loaderError);
      assert.equal(globalThis.__LAN_MALICIOUS_EXECUTED__, undefined);
    } finally {
      process.stderr.write = originalStderrWrite;
      process.exitCode = undefined;
      delete globalThis.__PREVISION_LAN_LOADER_ANCHOR__;
      delete globalThis.__PREVISION_LAN_LOADER_TEST_AFTER_VERIFY__;
      delete globalThis.__LAN_SAFE_EXECUTED__;
      delete globalThis.__LAN_MALICIOUS_EXECUTED__;
    }
  });
});

console.log('· User LaunchAgent installer transaction');

await test('installer is repeatable and restores active resources and plist after bootstrap failure', async () => {
  await withTempDirectory(async homeDirectory => {
    const successful = fakeLaunchctl();
    const first = await installLatestPreviewLanService({
      homeDirectory,
      nodeExecutable: process.execPath,
      verifyCommittedSources: false,
      launchctlRunner: successful.runner,
      waitForService: false
    });
    assert.match(first.active.versionName, /^[0-9a-f]{40}-[0-9a-f]{16}$/);
    assert.ok(successful.calls.some(call => call[0] === 'bootstrap'));
    assert.ok(successful.calls.some(call => call[0] === 'kickstart'));

    const lanPolicy = await loadLanPolicy(lanPolicyPath);
    const launcherPolicy = await loadLauncherPolicy(launcherPolicyPath);
    const paths = lanServicePaths(homeDirectory, launcherPolicy, lanPolicy);
    const activeBefore = await fsp.readFile(paths.activePath);
    const loaderBefore = await fsp.readFile(paths.loaderPath);
    const plistBefore = await fsp.readFile(paths.launchAgentPath);
    const callsBeforeLookalike = successful.calls.length;
    await fsp.writeFile(
      paths.launchAgentPath,
      Buffer.concat([plistBefore, Buffer.from('<!-- lookalike managed label -->\n')]),
      { mode: 0o600 }
    );
    await assert.rejects(statusLatestPreviewLanService({
      homeDirectory,
      launchctlRunner: successful.runner
    }), /LAN_INSTALL_EXISTING_PLIST_NOT_OWNED/);
    assert.equal(successful.calls.length, callsBeforeLookalike);
    await fsp.writeFile(paths.launchAgentPath, [
      '<plist><dict>',
      `<string>${first.label}</string>`,
      '<string>latest-preview-lan-loader.mjs</string>',
      '</dict></plist>\n'
    ].join(''), { mode: 0o600 });
    await assert.rejects(uninstallLatestPreviewLanService({
      homeDirectory,
      launchctlRunner: successful.runner
    }), /LAN_INSTALL_EXISTING_PLIST_NOT_OWNED/);
    assert.equal(successful.calls.length, callsBeforeLookalike);
    assert.equal((await fsp.lstat(paths.root)).isDirectory(), true);
    await fsp.writeFile(paths.launchAgentPath, plistBefore, { mode: 0o600 });
    await fsp.chmod(paths.launchAgentPath, 0o600);

    const failing = fakeLaunchctl({ failBootstrap: true });
    await assert.rejects(installLatestPreviewLanService({
      homeDirectory,
      nodeExecutable: process.execPath,
      verifyCommittedSources: false,
      launchctlRunner: failing.runner,
      waitForService: false
    }), /LAN_INSTALL_LAUNCHCTL_FAILED/);
    assert.deepEqual(await fsp.readFile(paths.activePath), activeBefore);
    assert.deepEqual(await fsp.readFile(paths.loaderPath), loaderBefore);
    assert.deepEqual(await fsp.readFile(paths.launchAgentPath), plistBefore);

    const status = await statusLatestPreviewLanService({
      homeDirectory,
      launchctlRunner: successful.runner
    });
    assert.equal(status.loaded, true);
    assert.equal(status.installedSourceCommit, first.active.sourceCommit);
    assert.doesNotMatch(JSON.stringify(status), /Application Support|LaunchAgents|prevision-lan-test/);

    const removed = await uninstallLatestPreviewLanService({
      homeDirectory,
      launchctlRunner: successful.runner
    });
    assert.equal(removed.removed, true);
    assert.equal(await fsp.lstat(paths.root).catch(() => null), null);
    assert.equal(await fsp.lstat(paths.pointerPath).catch(() => null), null);
  });
});

console.log(`\nLAN latest-preview result: ${passed} passed, ${failed} failed`);
if (failed) process.exitCode = 1;
