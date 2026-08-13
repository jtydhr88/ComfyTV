import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {
  APP_BUNDLE_NAME,
  EXPECTED_BUNDLE_ID,
  UPDATE_LOCK_NAME,
  UPDATE_WORKSPACE_NAME,
  createUpdateMarker,
  defaultTargetPath,
  installLocalApp,
  parseCliArguments,
  runUpdate,
  updateLockPath,
  updateWorkspacePath,
  validateAppPath,
  validateNodeVersion
} from '../scripts/update-local-app.mjs';

let passed = 0;
let failed = 0;
const TEST_SOURCE_COMMIT = 'a'.repeat(40);
const TEST_BUILD_INFO = Object.freeze({
  schemaVersion: 1,
  product: 'PreVision',
  commit: TEST_SOURCE_COMMIT,
  branch: 'test/local-delivery',
  clean: true,
  deliveryEligible: true,
  builtAt: '2026-07-14T00:00:00.000Z'
});

async function test(name, fn) {
  try {
    await fn();
    passed += 1;
    console.log(`  ✓ ${name}`);
  } catch (error) {
    failed += 1;
    console.error(`  ✗ FAIL: ${name}`);
    console.error(error?.stack || error);
  }
}

async function withTempDirectory(fn) {
  const realTempRoot = await fs.realpath(os.tmpdir());
  const root = await fs.mkdtemp(path.join(realTempRoot, 'prevision-local-install-test-'));
  try {
    await fn(root);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
}

function escapeXml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

async function createFakeApp(appPath, {
  bundleId = EXPECTED_BUNDLE_ID,
  version = '0.7.0',
  asar = 'fake-app-asar',
  signatureValid = true
} = {}) {
  const contents = path.join(appPath, 'Contents');
  await fs.mkdir(path.join(contents, 'Resources'), { recursive: true });
  await fs.mkdir(path.join(contents, '_CodeSignature'), { recursive: true });
  await fs.writeFile(path.join(contents, 'Info.plist'), [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<plist version="1.0"><dict>',
    '<key>CFBundleIdentifier</key>',
    `<string>${escapeXml(bundleId)}</string>`,
    '<key>CFBundleShortVersionString</key>',
    `<string>${escapeXml(version)}</string>`,
    '</dict></plist>'
  ].join('\n'));
  await fs.writeFile(path.join(contents, 'Resources', 'app.asar'), asar);
  await fs.writeFile(
    path.join(contents, '_CodeSignature', 'test-status'),
    signatureValid ? 'valid' : 'invalid'
  );
}

async function readPlistValue(appPath, key) {
  const plist = await fs.readFile(path.join(appPath, 'Contents', 'Info.plist'), 'utf8');
  const match = plist.match(new RegExp(`<key>${key}<\\/key>\\s*<string>([^<]*)<\\/string>`));
  if (!match) throw new Error(`Missing ${key} in fake Info.plist`);
  return match[1];
}

async function readAsar(appPath) {
  return fs.readFile(path.join(appPath, 'Contents', 'Resources', 'app.asar'), 'utf8');
}

async function writeSentinel(targetPath, value) {
  await fs.mkdir(targetPath, { recursive: true });
  await fs.writeFile(path.join(targetPath, 'sentinel.txt'), value);
}

async function readSentinel(targetPath) {
  return fs.readFile(path.join(targetPath, 'sentinel.txt'), 'utf8');
}

async function listNames(directory) {
  return (await fs.readdir(directory)).sort();
}

async function pathExists(targetPath) {
  try {
    await fs.lstat(targetPath);
    return true;
  } catch (error) {
    if (error?.code === 'ENOENT') return false;
    throw error;
  }
}

function canonicalPackagedApp(repositoryRoot) {
  return path.join(
    repositoryRoot,
    'out',
    'PreVision-darwin-arm64',
    APP_BUNDLE_NAME
  );
}

async function writeUpdateLock(targetPath, ownerPid, ownerIdentity) {
  const lockPath = updateLockPath(targetPath);
  const marker = createUpdateMarker(targetPath, ownerPid, ownerIdentity);
  await fs.mkdir(path.dirname(lockPath), { recursive: true });
  await fs.writeFile(lockPath, `${JSON.stringify(marker)}\n`);
  return { lockPath, marker };
}

async function createBoundWorkspace(targetPath, lockPath) {
  const workspacePath = updateWorkspacePath(targetPath);
  const ownerPath = path.join(workspacePath, 'Owner.lock');
  await fs.mkdir(workspacePath, { recursive: true });
  await fs.link(lockPath, ownerPath);
  const lockStats = await fs.lstat(lockPath);
  const ownerStats = await fs.lstat(ownerPath);
  assert.equal(ownerStats.dev, lockStats.dev);
  assert.equal(ownerStats.ino, lockStats.ino);
  return { workspacePath, ownerPath };
}

function testDependencies(overrides = {}) {
  return {
    inspectBundle: async appPath => ({
      bundleId: await readPlistValue(appPath, 'CFBundleIdentifier'),
      version: await readPlistValue(appPath, 'CFBundleShortVersionString')
    }),
    verifySignature: async appPath => {
      const status = await fs.readFile(
        path.join(appPath, 'Contents', '_CodeSignature', 'test-status'),
        'utf8'
      );
      return status === 'valid';
    },
    inspectBuildInfo: async () => TEST_BUILD_INFO,
    inspectRepository: async () => ({
      commit: TEST_SOURCE_COMMIT,
      branch: TEST_BUILD_INFO.branch,
      clean: true
    }),
    readDeliveryPolicy: async () => ({
      schemaVersion: 1,
      product: 'PreVision',
      fixedAppPath: '~/Applications/PreVision.app',
      buildInfoName: 'prevision-build.json',
      bootstrapSourceCommit: 'b'.repeat(40),
      bootstrapInstalledAsarSha256: 'c'.repeat(64)
    }),
    isAncestor: async () => true,
    isRunning: async () => false,
    copyApp: (source, destination) => fs.cp(source, destination, {
      recursive: true,
      errorOnExist: true,
      force: false
    }),
    getProcessIdentity: async pid => ({
      status: 'present',
      identity: `test-process:${pid}:current-owner`
    }),
    rename: (source, destination) => fs.rename(source, destination),
    remove: (target, options = {}) => fs.rm(target, {
      recursive: true,
      force: true,
      ...options
    }),
    hashApp: readAsar,
    link: (...args) => fs.link(...args),
    readFile: (...args) => fs.readFile(...args),
    realpath: (...args) => fs.realpath(...args),
    writeFile: (...args) => fs.writeFile(...args),
    ...overrides
  };
}

console.log('· 本地应用安装路径与环境保护');

await test('固定入口使用指定 home 下的 Applications/PreVision.app', async () => {
  await withTempDirectory(async root => {
    const fakeHome = path.join(root, 'home');
    assert.equal(APP_BUNDLE_NAME, 'PreVision.app');
    assert.equal(EXPECTED_BUNDLE_ID, 'com.prevision.director');
    assert.equal(
      defaultTargetPath(fakeHome),
      path.join(fakeHome, 'Applications', 'PreVision.app')
    );
  });
});

await test('Node 20–24 兼容范围会接受支持版本并拒绝越界版本', async () => {
  for (const version of ['v20.0.0', 'v22.15.1', 'v24.9.0']) {
    assert.doesNotThrow(() => validateNodeVersion(version));
  }
  for (const version of ['v19.9.0', 'v25.0.0', 'v26.3.0']) {
    assert.throws(() => validateNodeVersion(version));
  }
});

await test('更新入口会在不兼容环境或运行中进程下阻止构建', async () => {
  await withTempDirectory(async root => {
    let buildCalls = 0;
    const build = async () => { buildCalls += 1; };
    const common = {
      repositoryRoot: root,
      sourcePath: canonicalPackagedApp(root),
      targetPath: path.join(root, 'Applications', APP_BUNDLE_NAME),
      platform: 'darwin',
      build,
      deps: testDependencies()
    };

    await assert.rejects(() => runUpdate({ ...common, nodeVersion: '26.3.0' }));
    await assert.rejects(() => runUpdate({ ...common, nodeVersion: '24.14.0', platform: 'linux' }));
    await assert.rejects(() => runUpdate({
      ...common,
      nodeVersion: '24.14.0',
      deps: testDependencies({ isRunning: async () => true })
    }));
    assert.equal(buildCalls, 0);
  });
});

await test('runUpdate 拒绝非 canonical packaged source 且零写入', async () => {
  await withTempDirectory(async root => {
    const source = path.join(root, 'foreign-output', APP_BUNDLE_NAME);
    const target = path.join(root, 'Applications', APP_BUNDLE_NAME);
    await createFakeApp(source, { asar: 'non-canonical-source-must-remain' });
    await createFakeApp(target, { asar: 'target-before-non-canonical-refusal' });

    let buildCalls = 0;
    const writes = [];
    const deps = testDependencies({
      mkdir: async (...args) => {
        writes.push('mkdir');
        return fs.mkdir(...args);
      },
      writeFile: async (...args) => {
        writes.push('writeFile');
        return fs.writeFile(...args);
      },
      link: async (...args) => {
        writes.push('link');
        return fs.link(...args);
      },
      copyApp: async (...args) => {
        writes.push('copyApp');
        return fs.cp(args[0], args[1], { recursive: true });
      },
      rename: async (...args) => {
        writes.push('rename');
        return fs.rename(...args);
      },
      remove: async removePath => {
        writes.push('remove');
        return fs.rm(removePath, { recursive: true, force: true });
      }
    });

    await assert.rejects(() => runUpdate({
      repositoryRoot: root,
      sourcePath: source,
      targetPath: target,
      nodeVersion: '22.0.0',
      platform: 'darwin',
      build: async () => { buildCalls += 1; },
      deps
    }), /only packages and cleans the repository output/i);

    assert.equal(buildCalls, 0);
    assert.deepEqual(writes, []);
    assert.equal(await readAsar(source), 'non-canonical-source-must-remain');
    assert.equal(await readAsar(target), 'target-before-non-canonical-refusal');
    assert.deepEqual(await listNames(path.dirname(target)), [APP_BUNDLE_NAME]);
  });
});

await test('runUpdate 拒绝 source 与 target 互为祖先路径且零写入', async () => {
  await withTempDirectory(async root => {
    const sourceAncestorRepository = path.join(root, 'source-ancestor-repository');
    const sourceAncestor = canonicalPackagedApp(sourceAncestorRepository);
    const targetInsideSource = path.join(sourceAncestor, 'nested', APP_BUNDLE_NAME);
    const targetAncestor = path.join(root, 'target-ancestor', APP_BUNDLE_NAME);
    const targetAncestorRepository = path.join(targetAncestor, 'repository');
    const sourceInsideTarget = canonicalPackagedApp(targetAncestorRepository);
    const scenarios = [
      {
        repositoryRoot: sourceAncestorRepository,
        sourcePath: sourceAncestor,
        targetPath: targetInsideSource
      },
      {
        repositoryRoot: targetAncestorRepository,
        sourcePath: sourceInsideTarget,
        targetPath: targetAncestor
      }
    ];

    let buildCalls = 0;
    const writes = [];
    const deps = testDependencies({
      mkdir: async (...args) => {
        writes.push('mkdir');
        return fs.mkdir(...args);
      },
      writeFile: async (...args) => {
        writes.push('writeFile');
        return fs.writeFile(...args);
      },
      link: async (...args) => {
        writes.push('link');
        return fs.link(...args);
      },
      copyApp: async (...args) => {
        writes.push('copyApp');
        return fs.cp(args[0], args[1], { recursive: true });
      },
      rename: async (...args) => {
        writes.push('rename');
        return fs.rename(...args);
      },
      remove: async removePath => {
        writes.push('remove');
        return fs.rm(removePath, { recursive: true, force: true });
      }
    });

    for (const scenario of scenarios) {
      await assert.rejects(() => runUpdate({
        ...scenario,
        nodeVersion: '22.0.0',
        platform: 'darwin',
        build: async () => { buildCalls += 1; },
        deps
      }), /must be disjoint paths/i);
    }

    assert.equal(buildCalls, 0);
    assert.deepEqual(writes, []);
    assert.deepEqual(await listNames(root), []);
  });
});

await test('runUpdate 会在 build 前恢复中断入口，build 失败后仍清理交易文件', async () => {
  await withTempDirectory(async root => {
    const applications = path.join(root, 'Applications');
    const source = canonicalPackagedApp(root);
    const target = path.join(applications, APP_BUNDLE_NAME);
    const workspace = updateWorkspacePath(target);
    const backup = path.join(workspace, 'Previous-PreVision.app');
    const staged = path.join(workspace, 'Staged-PreVision.app');
    const { lockPath } = await writeUpdateLock(target, 810001, 'stale-build-owner');
    await createBoundWorkspace(target, lockPath);
    await createFakeApp(backup, { asar: 'old-build-restored-before-build' });
    await createFakeApp(staged, { asar: 'abandoned-before-build' });

    let buildCalls = 0;
    let targetWasRestoredBeforeBuild = false;
    const build = async () => {
      buildCalls += 1;
      targetWasRestoredBeforeBuild = await readAsar(target) === 'old-build-restored-before-build';
      assert.equal(await pathExists(workspace), true);
      assert.equal(await pathExists(lockPath), true);
      throw new Error('injected build failure after recovery');
    };

    await assert.rejects(() => runUpdate({
      repositoryRoot: root,
      sourcePath: source,
      targetPath: target,
      nodeVersion: '22.0.0',
      platform: 'darwin',
      build,
      deps: testDependencies({
        getProcessIdentity: async pid => pid === process.pid
          ? { status: 'present', identity: `test-process:${pid}:current-owner` }
          : { status: 'absent' }
      })
    }), /injected build failure/);

    assert.equal(buildCalls, 1);
    assert.equal(targetWasRestoredBeforeBuild, true);
    assert.equal(await readAsar(target), 'old-build-restored-before-build');
    assert.equal(await pathExists(workspace), false);
    assert.equal(await pathExists(lockPath), false);
    assert.deepEqual(await listNames(applications), [APP_BUNDLE_NAME]);
  });
});

await test('同一目标的两个 runUpdate 不会并发 build', async () => {
  await withTempDirectory(async root => {
    const applications = path.join(root, 'Applications');
    const source = canonicalPackagedApp(root);
    const target = path.join(applications, APP_BUNDLE_NAME);
    const workspace = updateWorkspacePath(target);
    const lock = updateLockPath(target);
    await createFakeApp(source, { asar: 'single-concurrent-build' });

    let releaseBuild;
    let announceBuild;
    const buildGate = new Promise(resolve => { releaseBuild = resolve; });
    const buildEntered = new Promise(resolve => { announceBuild = resolve; });
    let buildCalls = 0;
    let activeBuilds = 0;
    let maxConcurrentBuilds = 0;
    const build = async () => {
      buildCalls += 1;
      activeBuilds += 1;
      maxConcurrentBuilds = Math.max(maxConcurrentBuilds, activeBuilds);
      announceBuild();
      if (buildCalls > 1) {
        activeBuilds -= 1;
        throw new Error('unexpected concurrent build');
      }
      try {
        await buildGate;
      } finally {
        activeBuilds -= 1;
      }
    };
    const options = {
      repositoryRoot: root,
      sourcePath: source,
      targetPath: target,
      nodeVersion: '22.0.0',
      platform: 'darwin',
      build,
      deps: testDependencies()
    };

    const firstUpdate = runUpdate(options);
    await buildEntered;
    let secondError = null;
    try {
      await runUpdate(options);
    } catch (error) {
      secondError = error;
    } finally {
      releaseBuild();
    }
    const result = await firstUpdate;
    assert.ok(secondError);
    assert.match(secondError.message, /already active|acquired the lock/i);
    assert.equal(result.targetPath, target);
    assert.equal(buildCalls, 1);
    assert.equal(maxConcurrentBuilds, 1);
    assert.equal(await readAsar(target), 'single-concurrent-build');
    assert.equal(await pathExists(workspace), false);
    assert.equal(await pathExists(lock), false);
  });
});

await test('runUpdate 成功后删除 packaged source 并保留正确的固定入口', async () => {
  await withTempDirectory(async root => {
    const source = canonicalPackagedApp(root);
    const target = path.join(root, 'Applications', APP_BUNDLE_NAME);
    await createFakeApp(target, { asar: 'old-installed-build' });

    let buildCalls = 0;
    const result = await runUpdate({
      repositoryRoot: root,
      sourcePath: source,
      targetPath: target,
      nodeVersion: '22.0.0',
      platform: 'darwin',
      build: async () => {
        buildCalls += 1;
        await createFakeApp(source, { asar: 'latest-packaged-build' });
      },
      deps: testDependencies()
    });

    assert.equal(buildCalls, 1);
    assert.equal(result.cleanupWarning, null);
    assert.equal(await pathExists(source), false);
    assert.equal(await readAsar(target), 'latest-packaged-build');
  });
});

await test('runUpdate build 失败时保留已有 packaged source 供诊断', async () => {
  await withTempDirectory(async root => {
    const source = canonicalPackagedApp(root);
    const target = path.join(root, 'Applications', APP_BUNDLE_NAME);
    await createFakeApp(source, { asar: 'diagnostic-build-before-failure' });
    await createFakeApp(target, { asar: 'installed-build-before-failure' });

    await assert.rejects(() => runUpdate({
      repositoryRoot: root,
      sourcePath: source,
      targetPath: target,
      nodeVersion: '22.0.0',
      platform: 'darwin',
      build: async () => {
        throw new Error('injected packaging failure');
      },
      deps: testDependencies()
    }), /injected packaging failure/);

    assert.equal(await readAsar(source), 'diagnostic-build-before-failure');
    assert.equal(await readAsar(target), 'installed-build-before-failure');
  });
});

await test('runUpdate 安装失败时保留新生成的 packaged source 供诊断', async () => {
  await withTempDirectory(async root => {
    const source = canonicalPackagedApp(root);
    const target = path.join(root, 'Applications', APP_BUNDLE_NAME);
    await createFakeApp(target, { asar: 'installed-build-before-copy-failure' });

    await assert.rejects(() => runUpdate({
      repositoryRoot: root,
      sourcePath: source,
      targetPath: target,
      nodeVersion: '22.0.0',
      platform: 'darwin',
      build: async () => {
        await createFakeApp(source, { asar: 'diagnostic-build-after-copy-failure' });
      },
      deps: testDependencies({
        copyApp: async (from, to) => {
          assert.equal(from, source);
          assert.match(to, /Staged-PreVision\.app$/);
          throw new Error('injected packaged app copy failure');
        }
      })
    }), /injected packaged app copy failure/);

    assert.equal(await readAsar(source), 'diagnostic-build-after-copy-failure');
    assert.equal(await readAsar(target), 'installed-build-before-copy-failure');
  });
});

await test('packaged source 在清理前 inode 身份变化时保留并返回 warning', async () => {
  await withTempDirectory(async root => {
    const source = canonicalPackagedApp(root);
    const target = path.join(root, 'Applications', APP_BUNDLE_NAME);
    const displacedSource = path.join(path.dirname(source), 'Original-PreVision.app');
    const lock = updateLockPath(target);
    await createFakeApp(target, { asar: 'old-build-before-source-identity-change' });

    let originalSourceStats = null;
    let sourceIdentityReplaced = false;
    const result = await runUpdate({
      repositoryRoot: root,
      sourcePath: source,
      targetPath: target,
      nodeVersion: '22.0.0',
      platform: 'darwin',
      build: async () => {
        await createFakeApp(source, { asar: 'verified-build-before-source-identity-change' });
        originalSourceStats = await fs.lstat(source);
      },
      deps: testDependencies({
        hashApp: async appPath => {
          const hash = await readAsar(appPath);
          const isPostInstallTargetCheck = path.resolve(appPath) === path.resolve(target)
            && !await pathExists(lock);
          if (isPostInstallTargetCheck && !sourceIdentityReplaced) {
            await fs.rename(source, displacedSource);
            await createFakeApp(source, {
              asar: 'verified-build-before-source-identity-change'
            });
            sourceIdentityReplaced = true;
          }
          return hash;
        }
      })
    });

    const retainedSourceStats = await fs.lstat(source);
    const displacedSourceStats = await fs.lstat(displacedSource);
    assert.equal(sourceIdentityReplaced, true);
    assert.match(result.cleanupWarning, /changed identity before cleanup/i);
    assert.equal(await readAsar(target), 'verified-build-before-source-identity-change');
    assert.equal(await readAsar(source), 'verified-build-before-source-identity-change');
    assert.notEqual(retainedSourceStats.ino, originalSourceStats.ino);
    assert.equal(displacedSourceStats.dev, originalSourceStats.dev);
    assert.equal(displacedSourceStats.ino, originalSourceStats.ino);
  });
});

await test('packaged source 进入 quarantine 时 inode 被替换会停止删除并恢复 source 路径', async () => {
  await withTempDirectory(async root => {
    const source = canonicalPackagedApp(root);
    const target = path.join(root, 'Applications', APP_BUNDLE_NAME);
    const displacedSource = path.join(path.dirname(source), 'Original-PreVision.app');
    await createFakeApp(target, { asar: 'old-build-before-quarantine-identity-change' });

    let originalSourceStats = null;
    let quarantinePath = null;
    let quarantineIdentityReplaced = false;
    const renameWithQuarantineReplacement = async (from, to) => {
      const isEnteringQuarantine = path.resolve(from) === path.resolve(source)
        && path.dirname(to) === path.dirname(source)
        && path.basename(to).startsWith('.prevision-packaged-source-cleanup-');
      if (isEnteringQuarantine && !quarantineIdentityReplaced) {
        quarantinePath = to;
        await fs.rename(from, to);
        await fs.rename(to, displacedSource);
        await createFakeApp(to, { asar: 'verified-build-before-quarantine-identity-change' });
        quarantineIdentityReplaced = true;
        return;
      }
      await fs.rename(from, to);
    };

    const result = await runUpdate({
      repositoryRoot: root,
      sourcePath: source,
      targetPath: target,
      nodeVersion: '22.0.0',
      platform: 'darwin',
      build: async () => {
        await createFakeApp(source, {
          asar: 'verified-build-before-quarantine-identity-change'
        });
        originalSourceStats = await fs.lstat(source);
      },
      deps: testDependencies({ rename: renameWithQuarantineReplacement })
    });

    const restoredSourceStats = await fs.lstat(source);
    const displacedSourceStats = await fs.lstat(displacedSource);
    assert.equal(quarantineIdentityReplaced, true);
    assert.ok(quarantinePath);
    assert.match(result.cleanupWarning, /changed identity while entering cleanup quarantine/i);
    assert.equal(await readAsar(target), 'verified-build-before-quarantine-identity-change');
    assert.equal(await readAsar(source), 'verified-build-before-quarantine-identity-change');
    assert.equal(await pathExists(quarantinePath), false);
    assert.notEqual(restoredSourceStats.ino, originalSourceStats.ino);
    assert.equal(displacedSourceStats.dev, originalSourceStats.dev);
    assert.equal(displacedSourceStats.ino, originalSourceStats.ino);
  });
});

await test('packaged source 清理失败只返回 cleanupWarning 且不回滚已验证新入口', async () => {
  await withTempDirectory(async root => {
    const source = canonicalPackagedApp(root);
    const target = path.join(root, 'Applications', APP_BUNDLE_NAME);
    await createFakeApp(target, { asar: 'old-build-before-source-cleanup' });

    let quarantineCleanupCalls = 0;
    let quarantinePath = null;
    const result = await runUpdate({
      repositoryRoot: root,
      sourcePath: source,
      targetPath: target,
      nodeVersion: '22.0.0',
      platform: 'darwin',
      build: async () => {
        await createFakeApp(source, { asar: 'verified-build-with-retained-source' });
      },
      deps: testDependencies({
        remove: async removePath => {
          const isPackagedSourceQuarantine = path.dirname(removePath) === path.dirname(source)
            && path.basename(removePath).startsWith('.prevision-packaged-source-cleanup-');
          if (isPackagedSourceQuarantine) {
            quarantineCleanupCalls += 1;
            quarantinePath = removePath;
            throw new Error('injected packaged source cleanup failure');
          }
          await fs.rm(removePath, { recursive: true, force: true });
        }
      })
    });

    assert.equal(quarantineCleanupCalls, 1);
    assert.ok(quarantinePath);
    assert.match(result.cleanupWarning, /packaged source cleanup failed/i);
    assert.equal(await readAsar(target), 'verified-build-with-retained-source');
    assert.equal(await readAsar(source), 'verified-build-with-retained-source');
    assert.equal(await pathExists(quarantinePath), false);
    assert.deepEqual(await listNames(path.dirname(source)), [APP_BUNDLE_NAME]);
    assert.equal(await pathExists(updateWorkspacePath(target)), false);
    assert.equal(await pathExists(updateLockPath(target)), false);
  });
});

await test('installLocalApp 直接安装不删除 packaged source', async () => {
  await withTempDirectory(async root => {
    const source = path.join(root, 'build', APP_BUNDLE_NAME);
    const target = path.join(root, 'Applications', APP_BUNDLE_NAME);
    await createFakeApp(source, { asar: 'direct-install-source-must-remain' });

    const result = await installLocalApp({
      sourcePath: source,
      targetPath: target,
      deps: testDependencies()
    });

    assert.equal(result.cleanupWarning, null);
    assert.equal(await readAsar(target), 'direct-install-source-must-remain');
    assert.equal(await readAsar(source), 'direct-install-source-must-remain');
  });
});

await test('安装路径必须是绝对路径且 bundle 名严格为 PreVision.app', async () => {
  assert.throws(() => validateAppPath(path.join('relative', APP_BUNDLE_NAME)));
  assert.throws(() => validateAppPath(path.join(path.sep, 'tmp', 'PreVision Copy.app')));
  assert.throws(() => validateAppPath(path.join(path.sep, 'tmp', 'PreVision')));
  assert.equal(
    validateAppPath(path.join(path.sep, 'tmp', APP_BUNDLE_NAME)),
    path.join(path.sep, 'tmp', APP_BUNDLE_NAME)
  );
});

await test('生产命令行不允许用参数改写固定源路径或目标路径', async () => {
  assert.deepEqual(parseCliArguments([]), {});
  for (const args of [
    ['--target', path.join(path.sep, 'tmp', APP_BUNDLE_NAME)],
    ['--source', path.join(path.sep, 'tmp', APP_BUNDLE_NAME)],
    ['--target'],
    ['--source'],
    ['--unknown']
  ]) {
    assert.throws(() => parseCliArguments(args));
  }
});

await test('源路径与安装目标相同时拒绝操作', async () => {
  await withTempDirectory(async root => {
    const appPath = path.join(root, APP_BUNDLE_NAME);
    await createFakeApp(appPath, { asar: 'must-remain' });
    await assert.rejects(() => installLocalApp({
      sourcePath: appPath,
      targetPath: appPath,
      deps: testDependencies()
    }));
    assert.equal(await readAsar(appPath), 'must-remain');
  });
});

await test('符号链接目标会被拒绝且不修改链接对象', async () => {
  await withTempDirectory(async root => {
    const applications = path.join(root, 'Applications');
    const source = path.join(root, 'build', APP_BUNDLE_NAME);
    const realTarget = path.join(root, 'victim', APP_BUNDLE_NAME);
    const target = path.join(applications, APP_BUNDLE_NAME);
    await createFakeApp(source, { asar: 'new-build' });
    await createFakeApp(realTarget, { asar: 'linked-old-build' });
    await fs.mkdir(applications, { recursive: true });
    await fs.symlink(realTarget, target);

    await assert.rejects(() => installLocalApp({
      sourcePath: source,
      targetPath: target,
      deps: testDependencies()
    }));

    assert.equal((await fs.lstat(target)).isSymbolicLink(), true);
    assert.equal(await readAsar(realTarget), 'linked-old-build');
    assert.deepEqual(await listNames(applications), [APP_BUNDLE_NAME]);
  });
});

await test('目标父路径的任一祖先是符号链接时会在写入前拒绝', async () => {
  await withTempDirectory(async root => {
    const realHome = path.join(root, 'real-home');
    const linkedHome = path.join(root, 'linked-home');
    const realApplications = path.join(realHome, 'Applications');
    const source = path.join(root, 'build', APP_BUNDLE_NAME);
    const target = path.join(linkedHome, 'Applications', APP_BUNDLE_NAME);
    const sentinel = path.join(realApplications, 'must-not-change.txt');
    await fs.mkdir(realApplications, { recursive: true });
    await fs.writeFile(sentinel, 'ancestor-link-sentinel');
    await createFakeApp(source, { asar: 'must-not-be-installed-through-link' });
    await fs.symlink(realHome, linkedHome);

    const writes = [];
    const deps = testDependencies({
      mkdir: async (...args) => {
        writes.push('mkdir');
        return fs.mkdir(...args);
      },
      mkdtemp: async (...args) => {
        writes.push('mkdtemp');
        return fs.mkdtemp(...args);
      },
      copyApp: async (...args) => {
        writes.push('copyApp');
        return fs.cp(args[0], args[1], { recursive: true });
      },
      rename: async (...args) => {
        writes.push('rename');
        return fs.rename(...args);
      },
      remove: async (...args) => {
        writes.push('remove');
        return fs.rm(args[0], { recursive: true, force: true });
      },
      writeFile: async (...args) => {
        writes.push('writeFile');
        return fs.writeFile(...args);
      }
    });

    await assert.rejects(() => installLocalApp({ sourcePath: source, targetPath: target, deps }));
    assert.deepEqual(writes, []);
    assert.equal(await fs.readFile(sentinel, 'utf8'), 'ancestor-link-sentinel');
    assert.deepEqual(await listNames(realApplications), ['must-not-change.txt']);
  });
});

await test('源 App 的任一祖先是符号链接时会在 mkdir/write/link 前拒绝', async () => {
  await withTempDirectory(async root => {
    const realBuild = path.join(root, 'real-build');
    const linkedBuild = path.join(root, 'linked-build');
    const realSource = path.join(realBuild, APP_BUNDLE_NAME);
    const source = path.join(linkedBuild, APP_BUNDLE_NAME);
    const targetParent = path.join(root, 'missing-home', 'Applications');
    const target = path.join(targetParent, APP_BUNDLE_NAME);
    await createFakeApp(realSource, { asar: 'source-behind-ancestor-link' });
    await fs.symlink(realBuild, linkedBuild);

    const writes = [];
    const deps = testDependencies({
      mkdir: async (...args) => {
        writes.push('mkdir');
        return fs.mkdir(...args);
      },
      writeFile: async (...args) => {
        writes.push('writeFile');
        return fs.writeFile(...args);
      },
      link: async (...args) => {
        writes.push('link');
        return fs.link(...args);
      },
      copyApp: async (...args) => {
        writes.push('copyApp');
        return fs.cp(args[0], args[1], { recursive: true });
      },
      rename: async (...args) => {
        writes.push('rename');
        return fs.rename(...args);
      },
      remove: async removePath => {
        writes.push('remove');
        return fs.rm(removePath, { recursive: true, force: true });
      }
    });

    await assert.rejects(() => installLocalApp({ sourcePath: source, targetPath: target, deps }));

    assert.deepEqual(writes, []);
    assert.equal(await readAsar(realSource), 'source-behind-ancestor-link');
    assert.equal(await pathExists(targetParent), false);
  });
});

console.log('· 精确更新、身份校验与回滚');

await test('首次安装与同版本再安装都只更新固定入口', async () => {
  await withTempDirectory(async root => {
    const fakeHome = path.join(root, 'home');
    const applications = path.join(fakeHome, 'Applications');
    const target = defaultTargetPath(fakeHome);
    const source = path.join(root, 'build', APP_BUNDLE_NAME);
    const copy = path.join(applications, 'PreVision Copy.app');
    const oldBackup = path.join(applications, 'PreVision.app.backup-existing');
    const otherDirectoryApp = path.join(root, 'other-directory', APP_BUNDLE_NAME);

    await fs.mkdir(applications, { recursive: true });
    await createFakeApp(source, { version: '0.7.0', asar: 'same-version-build-one' });
    await writeSentinel(copy, 'copy-must-remain');
    await writeSentinel(oldBackup, 'backup-must-remain');
    await writeSentinel(otherDirectoryApp, 'other-directory-must-remain');

    const first = await installLocalApp({
      sourcePath: source,
      targetPath: target,
      deps: testDependencies()
    });
    assert.equal(first.targetPath, target);
    assert.equal(first.bundleId, EXPECTED_BUNDLE_ID);
    assert.equal(first.version, '0.7.0');
    assert.equal(await readAsar(target), 'same-version-build-one');

    await fs.rm(source, { recursive: true, force: true });
    await createFakeApp(source, { version: '0.7.0', asar: 'same-version-build-two' });
    const second = await installLocalApp({
      sourcePath: source,
      targetPath: target,
      deps: testDependencies()
    });

    assert.equal(second.targetPath, target);
    assert.equal(second.version, '0.7.0');
    assert.equal(await readAsar(target), 'same-version-build-two');
    assert.equal(await readSentinel(copy), 'copy-must-remain');
    assert.equal(await readSentinel(oldBackup), 'backup-must-remain');
    assert.equal(await readSentinel(otherDirectoryApp), 'other-directory-must-remain');
    assert.deepEqual(await listNames(applications), [
      APP_BUNDLE_NAME,
      'PreVision Copy.app',
      'PreVision.app.backup-existing'
    ].sort());
  });
});

await test('上次中断留下已标记的旧 App 时会先恢复入口再安全更新', async () => {
  await withTempDirectory(async root => {
    const applications = path.join(root, 'Applications');
    const source = path.join(root, 'build', APP_BUNDLE_NAME);
    const target = path.join(applications, APP_BUNDLE_NAME);
    const workspace = updateWorkspacePath(target);
    const backup = path.join(workspace, 'Previous-PreVision.app');
    const staged = path.join(workspace, 'Staged-PreVision.app');
    const { lockPath: lock } = await writeUpdateLock(
      target,
      987654321,
      'stale-interrupted-owner'
    );
    await createBoundWorkspace(target, lock);
    await createFakeApp(backup, { asar: 'interrupted-old-build' });
    await createFakeApp(staged, { asar: 'abandoned-staged-build' });
    await createFakeApp(source, { asar: 'recovery-followed-by-new-build' });

    assert.equal(path.basename(workspace), UPDATE_WORKSPACE_NAME);
    assert.equal(await pathExists(target), false);
    let restoredBeforeCopy = false;
    const deps = testDependencies({
      getProcessIdentity: async pid => pid === process.pid
        ? { status: 'present', identity: `test-process:${pid}:current-owner` }
        : { status: 'absent' },
      copyApp: async (from, to) => {
        restoredBeforeCopy = await readAsar(target) === 'interrupted-old-build';
        await fs.cp(from, to, { recursive: true, errorOnExist: true, force: false });
      }
    });

    const result = await installLocalApp({ sourcePath: source, targetPath: target, deps });

    assert.equal(restoredBeforeCopy, true);
    assert.equal(result.cleanupWarning, null);
    assert.equal(await readAsar(target), 'recovery-followed-by-new-build');
    assert.equal(await pathExists(workspace), false);
    assert.equal(await pathExists(lock), false);
    assert.deepEqual(await listNames(applications), [APP_BUNDLE_NAME]);
  });
});

await test('固定锁中的外部 ownerIdentity 仍活跃时拒绝更新且零写入', async () => {
  await withTempDirectory(async root => {
    const applications = path.join(root, 'Applications');
    const source = path.join(root, 'build', APP_BUNDLE_NAME);
    const target = path.join(applications, APP_BUNDLE_NAME);
    const workspace = updateWorkspacePath(target);
    const ownerPid = 820001;
    const ownerIdentity = 'external-owner-same-process-start';
    await createFakeApp(source, { asar: 'must-not-install-while-owner-active' });
    await createFakeApp(target, { asar: 'active-owner-target' });
    const { lockPath } = await writeUpdateLock(target, ownerPid, ownerIdentity);
    await createBoundWorkspace(target, lockPath);
    await fs.writeFile(path.join(workspace, 'active-owner-sentinel.txt'), 'must-remain');
    const originalLock = await fs.readFile(lockPath, 'utf8');

    const writes = [];
    const deps = testDependencies({
      getProcessIdentity: async pid => {
        assert.equal(pid, ownerPid);
        return { status: 'present', identity: ownerIdentity };
      },
      mkdir: async (...args) => {
        writes.push('mkdir');
        return fs.mkdir(...args);
      },
      link: async (...args) => {
        writes.push('link');
        return fs.link(...args);
      },
      copyApp: async (...args) => {
        writes.push('copyApp');
        return fs.cp(args[0], args[1], { recursive: true });
      },
      rename: async (...args) => {
        writes.push('rename');
        return fs.rename(...args);
      },
      remove: async removePath => {
        writes.push('remove');
        return fs.rm(removePath, { recursive: true, force: true });
      },
      writeFile: async (...args) => {
        writes.push('writeFile');
        return fs.writeFile(...args);
      }
    });

    await assert.rejects(() => installLocalApp({ sourcePath: source, targetPath: target, deps }));

    assert.deepEqual(writes, []);
    assert.equal(await readAsar(target), 'active-owner-target');
    assert.equal(await fs.readFile(lockPath, 'utf8'), originalLock);
    assert.equal(
      await fs.readFile(path.join(workspace, 'active-owner-sentinel.txt'), 'utf8'),
      'must-remain'
    );
  });
});

await test('外部锁的进程 identity 状态为 unknown 时 fail-closed 且零写入', async () => {
  await withTempDirectory(async root => {
    const applications = path.join(root, 'Applications');
    const source = path.join(root, 'build', APP_BUNDLE_NAME);
    const target = path.join(applications, APP_BUNDLE_NAME);
    const workspace = updateWorkspacePath(target);
    const ownerPid = 825001;
    await createFakeApp(source, { asar: 'must-not-install-with-unknown-owner' });
    await createFakeApp(target, { asar: 'unknown-owner-target' });
    const { lockPath } = await writeUpdateLock(target, ownerPid, 'unverifiable-owner-identity');
    const { ownerPath } = await createBoundWorkspace(target, lockPath);
    const sentinel = path.join(workspace, 'unknown-owner-sentinel.txt');
    await fs.writeFile(sentinel, 'must-remain');
    const originalLock = await fs.readFile(lockPath, 'utf8');

    const writes = [];
    const deps = testDependencies({
      getProcessIdentity: async pid => {
        assert.equal(pid, ownerPid);
        return { status: 'unknown' };
      },
      mkdir: async (...args) => {
        writes.push('mkdir');
        return fs.mkdir(...args);
      },
      writeFile: async (...args) => {
        writes.push('writeFile');
        return fs.writeFile(...args);
      },
      link: async (...args) => {
        writes.push('link');
        return fs.link(...args);
      },
      copyApp: async (...args) => {
        writes.push('copyApp');
        return fs.cp(args[0], args[1], { recursive: true });
      },
      rename: async (...args) => {
        writes.push('rename');
        return fs.rename(...args);
      },
      remove: async removePath => {
        writes.push('remove');
        return fs.rm(removePath, { recursive: true, force: true });
      }
    });

    await assert.rejects(
      () => installLocalApp({ sourcePath: source, targetPath: target, deps }),
      /cannot confirm/i
    );

    assert.deepEqual(writes, []);
    assert.equal(await readAsar(target), 'unknown-owner-target');
    assert.equal(await fs.readFile(lockPath, 'utf8'), originalLock);
    assert.equal(await fs.readFile(ownerPath, 'utf8'), originalLock);
    assert.equal(await fs.readFile(sentinel, 'utf8'), 'must-remain');
  });
});

await test('PID 被复用但进程 identity 不同时视为 stale 并恢复更新', async () => {
  await withTempDirectory(async root => {
    const applications = path.join(root, 'Applications');
    const source = path.join(root, 'build', APP_BUNDLE_NAME);
    const target = path.join(applications, APP_BUNDLE_NAME);
    const workspace = updateWorkspacePath(target);
    const backup = path.join(workspace, 'Previous-PreVision.app');
    const ownerPid = 830001;
    const { lockPath } = await writeUpdateLock(target, ownerPid, 'old-process-start-identity');
    await createBoundWorkspace(target, lockPath);
    await createFakeApp(backup, { asar: 'old-build-from-reused-pid' });
    await createFakeApp(source, { asar: 'new-build-after-pid-reuse' });

    let reusedPidChecks = 0;
    let restoredBeforeCopy = false;
    const deps = testDependencies({
      getProcessIdentity: async pid => {
        if (pid === ownerPid) {
          reusedPidChecks += 1;
          return { status: 'present', identity: 'same-pid-but-new-process-start-identity' };
        }
        return { status: 'present', identity: `test-process:${pid}:current-owner` };
      },
      copyApp: async (from, to) => {
        restoredBeforeCopy = await readAsar(target) === 'old-build-from-reused-pid';
        await fs.cp(from, to, { recursive: true, errorOnExist: true, force: false });
      }
    });

    const result = await installLocalApp({ sourcePath: source, targetPath: target, deps });

    assert.equal(reusedPidChecks, 1);
    assert.equal(restoredBeforeCopy, true);
    assert.equal(result.cleanupWarning, null);
    assert.equal(await readAsar(target), 'new-build-after-pid-reuse');
    assert.equal(await pathExists(workspace), false);
    assert.equal(await pathExists(lockPath), false);
  });
});

await test('提交后清理旧备份部分失败不回滚新 App，下次更新会收敛残留', async () => {
  await withTempDirectory(async root => {
    const applications = path.join(root, 'Applications');
    const source = path.join(root, 'build', APP_BUNDLE_NAME);
    const target = path.join(applications, APP_BUNDLE_NAME);
    const workspace = updateWorkspacePath(target);
    const lock = updateLockPath(target);
    const backup = path.join(workspace, 'Previous-PreVision.app');
    const backupSignature = path.join(
      backup,
      'Contents',
      '_CodeSignature'
    );
    await createFakeApp(target, { asar: 'old-build-before-cleanup-warning' });
    await createFakeApp(source, { asar: 'verified-new-build' });

    let cleanupFailureInjected = false;
    const removeWithPartialFailure = async removePath => {
      if (path.resolve(removePath) === path.resolve(backup) && !cleanupFailureInjected) {
        cleanupFailureInjected = true;
        await fs.rm(backupSignature, { recursive: true, force: true });
        throw new Error('injected partial post-commit cleanup failure');
      }
      await fs.rm(removePath, { recursive: true, force: true });
    };

    const first = await installLocalApp({
      sourcePath: source,
      targetPath: target,
      deps: testDependencies({ remove: removeWithPartialFailure })
    });

    assert.equal(cleanupFailureInjected, true);
    assert.match(first.cleanupWarning, /cleanup failed/i);
    assert.equal(await readAsar(target), 'verified-new-build');
    assert.equal(await pathExists(workspace), true);
    assert.equal(await pathExists(lock), true);
    const retainedMarker = JSON.parse(await fs.readFile(lock, 'utf8'));
    assert.equal(retainedMarker.bundleId, EXPECTED_BUNDLE_ID);
    assert.equal(retainedMarker.targetPath, target);
    assert.equal(typeof retainedMarker.ownerIdentity, 'string');
    assert.equal(typeof retainedMarker.transactionId, 'string');
    assert.equal(await pathExists(backup), true);
    assert.equal(await pathExists(backupSignature), false);

    await fs.rm(source, { recursive: true, force: true });
    await createFakeApp(source, { asar: 'newer-build-after-recovery-cleanup' });
    const second = await installLocalApp({
      sourcePath: source,
      targetPath: target,
      deps: testDependencies()
    });

    assert.equal(second.cleanupWarning, null);
    assert.equal(await readAsar(target), 'newer-build-after-recovery-cleanup');
    assert.equal(await pathExists(workspace), false);
    assert.equal(await pathExists(lock), false);
    assert.deepEqual(await listNames(applications), [APP_BUNDLE_NAME]);
  });
});

await test('commit record hardlink 成功后删除 commit temp 失败不得回滚已验证新 App', async () => {
  await withTempDirectory(async root => {
    const applications = path.join(root, 'Applications');
    const source = path.join(root, 'build', APP_BUNDLE_NAME);
    const target = path.join(applications, APP_BUNDLE_NAME);
    const workspace = updateWorkspacePath(target);
    const lock = updateLockPath(target);
    const commitRecord = path.join(workspace, 'Committed.json');
    await createFakeApp(source, { asar: 'new-build-with-durable-commit-link' });
    await createFakeApp(target, { asar: 'old-build-before-durable-commit' });

    let commitTempRemovalFailed = false;
    let commitHardlinkVerified = false;
    const removeWithCommitTempFailure = async removePath => {
      const removeName = path.basename(removePath);
      const isCommitTemp = path.dirname(removePath) === workspace
        && /^Committed\.[0-9a-f-]{36}\.tmp$/i.test(removeName);
      if (isCommitTemp && !commitTempRemovalFailed) {
        const tempStats = await fs.lstat(removePath);
        const recordStats = await fs.lstat(commitRecord);
        commitHardlinkVerified = tempStats.dev === recordStats.dev && tempStats.ino === recordStats.ino;
        commitTempRemovalFailed = true;
        throw new Error('injected commit temp unlink failure after durable hardlink');
      }
      await fs.rm(removePath, { recursive: true, force: true });
    };

    const result = await installLocalApp({
      sourcePath: source,
      targetPath: target,
      deps: testDependencies({ remove: removeWithCommitTempFailure })
    });

    assert.equal(commitTempRemovalFailed, true);
    assert.equal(commitHardlinkVerified, true);
    assert.equal(result.cleanupWarning, null);
    assert.equal(await readAsar(target), 'new-build-with-durable-commit-link');
    assert.equal(await pathExists(workspace), false);
    assert.equal(await pathExists(lock), false);
    assert.deepEqual(await listNames(applications), [APP_BUNDLE_NAME]);
  });
});

await test('提交后 workspace 部分清理失败时固定 lock 保持完整并可于下次收敛', async () => {
  await withTempDirectory(async root => {
    const applications = path.join(root, 'Applications');
    const source = path.join(root, 'build', APP_BUNDLE_NAME);
    const target = path.join(applications, APP_BUNDLE_NAME);
    const workspace = updateWorkspacePath(target);
    const lock = updateLockPath(target);
    await createFakeApp(source, { asar: 'new-target-before-workspace-cleanup-warning' });

    let workspaceCleanupFailed = false;
    let retainedPreparingWorkspace = null;
    const removeWithPartialWorkspaceFailure = async removePath => {
      const removeName = path.basename(removePath);
      const isPreparingWorkspace = path.dirname(removePath) === applications
        && removeName.startsWith(`${UPDATE_WORKSPACE_NAME}.`)
        && !removeName.startsWith(`${UPDATE_LOCK_NAME}.`)
        && removeName.endsWith('.tmp');
      if (isPreparingWorkspace && !workspaceCleanupFailed) {
        workspaceCleanupFailed = true;
        retainedPreparingWorkspace = removePath;
        await fs.rm(path.join(removePath, 'Committed.json'), { force: true });
        throw new Error('injected partial workspace cleanup failure');
      }
      await fs.rm(removePath, { recursive: true, force: true });
    };

    const first = await installLocalApp({
      sourcePath: source,
      targetPath: target,
      deps: testDependencies({ remove: removeWithPartialWorkspaceFailure })
    });

    assert.equal(workspaceCleanupFailed, true);
    assert.match(first.cleanupWarning, /cleanup failed/i);
    assert.equal(await readAsar(target), 'new-target-before-workspace-cleanup-warning');
    assert.equal(await pathExists(workspace), false);
    assert.ok(retainedPreparingWorkspace);
    assert.equal(await pathExists(retainedPreparingWorkspace), true);
    assert.equal(await pathExists(lock), true);
    assert.equal((await fs.lstat(lock)).isFile(), true);
    assert.equal((await fs.lstat(lock)).isSymbolicLink(), false);
    const marker = JSON.parse(await fs.readFile(lock, 'utf8'));
    assert.equal(marker.schemaVersion, 1);
    assert.equal(marker.bundleId, EXPECTED_BUNDLE_ID);
    assert.equal(marker.targetPath, target);
    assert.equal(marker.ownerPid, process.pid);
    assert.equal(typeof marker.ownerIdentity, 'string');
    assert.match(marker.transactionId, /^[0-9a-f-]{36}$/i);

    await fs.rm(source, { recursive: true, force: true });
    await createFakeApp(source, { asar: 'newer-target-after-workspace-convergence' });
    const second = await installLocalApp({
      sourcePath: source,
      targetPath: target,
      deps: testDependencies()
    });

    assert.equal(second.cleanupWarning, null);
    assert.equal(await readAsar(target), 'newer-target-after-workspace-convergence');
    assert.equal(await pathExists(workspace), false);
    assert.equal(await pathExists(retainedPreparingWorkspace), false);
    assert.equal(await pathExists(lock), false);
    assert.deepEqual(await listNames(applications), [APP_BUNDLE_NAME]);
  });
});

await test('workspace 清理期间固定锁被替换时保留 foreign lock 并返回 cleanupWarning', async () => {
  await withTempDirectory(async root => {
    const applications = path.join(root, 'Applications');
    const source = path.join(root, 'build', APP_BUNDLE_NAME);
    const target = path.join(applications, APP_BUNDLE_NAME);
    const workspace = updateWorkspacePath(target);
    const lock = updateLockPath(target);
    const foreignLockContents = 'foreign-lock-replaced-during-cleanup\n';
    await createFakeApp(source, { asar: 'verified-target-before-lock-replacement' });

    let lockWasReplaced = false;
    let removedPreparingWorkspace = null;
    const removeAndReplaceLock = async removePath => {
      const removeName = path.basename(removePath);
      const isPreparingWorkspace = path.dirname(removePath) === applications
        && removeName.startsWith(`${UPDATE_WORKSPACE_NAME}.`)
        && !removeName.startsWith(`${UPDATE_LOCK_NAME}.`)
        && removeName.endsWith('.tmp');
      if (isPreparingWorkspace && !lockWasReplaced) {
        removedPreparingWorkspace = removePath;
        await fs.rm(removePath, { recursive: true, force: true });
        await fs.rm(lock, { force: true });
        await fs.writeFile(lock, foreignLockContents);
        lockWasReplaced = true;
        return;
      }
      await fs.rm(removePath, { recursive: true, force: true });
    };

    const result = await installLocalApp({
      sourcePath: source,
      targetPath: target,
      deps: testDependencies({ remove: removeAndReplaceLock })
    });

    assert.equal(lockWasReplaced, true);
    assert.ok(removedPreparingWorkspace);
    assert.match(result.cleanupWarning, /cleanup failed/i);
    assert.equal(await readAsar(target), 'verified-target-before-lock-replacement');
    assert.equal(await pathExists(workspace), false);
    assert.equal(await pathExists(removedPreparingWorkspace), false);
    assert.equal(await fs.readFile(lock, 'utf8'), foreignLockContents);
    assert.deepEqual(await listNames(applications), [APP_BUNDLE_NAME, UPDATE_LOCK_NAME].sort());
  });
});

await test('stale 有效锁不得接管未用 Owner.lock hardlink 绑定的 foreign workspace', async () => {
  await withTempDirectory(async root => {
    const applications = path.join(root, 'Applications');
    const source = path.join(root, 'build', APP_BUNDLE_NAME);
    const target = path.join(applications, APP_BUNDLE_NAME);
    const workspace = updateWorkspacePath(target);
    const ownerPath = path.join(workspace, 'Owner.lock');
    const sentinel = path.join(workspace, 'foreign-workspace-sentinel.txt');
    await createFakeApp(source, { asar: 'must-not-enter-foreign-workspace' });
    await createFakeApp(target, { asar: 'target-before-foreign-workspace-refusal' });
    const { lockPath } = await writeUpdateLock(target, 840001, 'stale-foreign-owner');
    const lockContents = await fs.readFile(lockPath, 'utf8');
    await fs.mkdir(workspace, { recursive: true });
    await fs.writeFile(ownerPath, lockContents);
    await fs.writeFile(sentinel, 'foreign-workspace-must-remain');
    const lockStats = await fs.lstat(lockPath);
    const ownerStats = await fs.lstat(ownerPath);
    assert.notEqual(ownerStats.ino, lockStats.ino);

    const writes = [];
    const deps = testDependencies({
      getProcessIdentity: async pid => pid === process.pid
        ? { status: 'present', identity: `test-process:${pid}:current-owner` }
        : { status: 'absent' },
      mkdir: async (...args) => {
        writes.push('mkdir');
        return fs.mkdir(...args);
      },
      writeFile: async (...args) => {
        writes.push('writeFile');
        return fs.writeFile(...args);
      },
      link: async (...args) => {
        writes.push('link');
        return fs.link(...args);
      },
      copyApp: async (...args) => {
        writes.push('copyApp');
        return fs.cp(args[0], args[1], { recursive: true });
      },
      rename: async (...args) => {
        writes.push('rename');
        return fs.rename(...args);
      },
      remove: async removePath => {
        writes.push('remove');
        return fs.rm(removePath, { recursive: true, force: true });
      }
    });

    await assert.rejects(
      () => installLocalApp({ sourcePath: source, targetPath: target, deps }),
      /not owned by this update/i
    );

    assert.deepEqual(writes, []);
    assert.equal(await readAsar(target), 'target-before-foreign-workspace-refusal');
    assert.equal(await fs.readFile(lockPath, 'utf8'), lockContents);
    assert.equal(await fs.readFile(ownerPath, 'utf8'), lockContents);
    assert.equal(await fs.readFile(sentinel, 'utf8'), 'foreign-workspace-must-remain');
  });
});

await test('未识别的固定更新锁会原样拒绝且不触碰 App', async () => {
  await withTempDirectory(async root => {
    const applications = path.join(root, 'Applications');
    const source = path.join(root, 'build', APP_BUNDLE_NAME);
    const target = path.join(applications, APP_BUNDLE_NAME);
    const workspace = updateWorkspacePath(target);
    const lock = updateLockPath(target);
    const workspaceSentinel = path.join(workspace, 'unknown-workspace-sentinel.txt');
    const unknownMarker = `${JSON.stringify({
      ...createUpdateMarker(target, 987654321),
      schemaVersion: 999
    })}\n`;
    await createFakeApp(source, { asar: 'must-not-install' });
    await createFakeApp(target, { asar: 'known-good-target' });
    await fs.writeFile(lock, unknownMarker);
    await createBoundWorkspace(target, lock);
    await fs.writeFile(workspaceSentinel, 'must-remain');

    const writes = [];
    const deps = testDependencies({
      mkdir: async (...args) => {
        writes.push('mkdir');
        return fs.mkdir(...args);
      },
      copyApp: async (...args) => {
        writes.push('copyApp');
        return fs.cp(args[0], args[1], { recursive: true });
      },
      rename: async (...args) => {
        writes.push('rename');
        return fs.rename(...args);
      },
      remove: async removePath => {
        writes.push('remove');
        return fs.rm(removePath, { recursive: true, force: true });
      },
      writeFile: async (...args) => {
        writes.push('writeFile');
        return fs.writeFile(...args);
      }
    });

    await assert.rejects(() => installLocalApp({ sourcePath: source, targetPath: target, deps }));

    assert.deepEqual(writes, []);
    assert.equal(await readAsar(target), 'known-good-target');
    assert.equal(await fs.readFile(lock, 'utf8'), unknownMarker);
    assert.equal(await fs.readFile(workspaceSentinel, 'utf8'), 'must-remain');
    assert.deepEqual(await listNames(applications), [
      APP_BUNDLE_NAME,
      UPDATE_LOCK_NAME,
      UPDATE_WORKSPACE_NAME
    ].sort());
  });
});

await test('已有目标 bundle ID 不匹配时原样拒绝覆盖', async () => {
  await withTempDirectory(async root => {
    const applications = path.join(root, 'Applications');
    const source = path.join(root, 'build', APP_BUNDLE_NAME);
    const target = path.join(applications, APP_BUNDLE_NAME);
    await createFakeApp(source, { asar: 'valid-new-build' });
    await createFakeApp(target, { bundleId: 'example.not-prevision', asar: 'foreign-app' });

    await assert.rejects(() => installLocalApp({
      sourcePath: source,
      targetPath: target,
      deps: testDependencies()
    }));

    assert.equal(await readPlistValue(target, 'CFBundleIdentifier'), 'example.not-prevision');
    assert.equal(await readAsar(target), 'foreign-app');
    assert.deepEqual(await listNames(applications), [APP_BUNDLE_NAME]);
  });
});

await test('源 bundle ID 错误或签名验证失败时不修改旧入口', async () => {
  await withTempDirectory(async root => {
    const applications = path.join(root, 'Applications');
    const source = path.join(root, 'build', APP_BUNDLE_NAME);
    const target = path.join(applications, APP_BUNDLE_NAME);
    await createFakeApp(target, { asar: 'known-good-old-build' });
    await createFakeApp(source, { bundleId: 'example.wrong-source', asar: 'wrong-id-build' });

    await assert.rejects(() => installLocalApp({
      sourcePath: source,
      targetPath: target,
      deps: testDependencies()
    }));
    assert.equal(await readAsar(target), 'known-good-old-build');

    await fs.rm(source, { recursive: true, force: true });
    await createFakeApp(source, { asar: 'bad-signature-build', signatureValid: false });
    await assert.rejects(() => installLocalApp({
      sourcePath: source,
      targetPath: target,
      deps: testDependencies()
    }));

    assert.equal(await readAsar(target), 'known-good-old-build');
    assert.deepEqual(await listNames(applications), [APP_BUNDLE_NAME]);
  });
});

await test('有 PreVision 进程运行时拒绝替换且不强制退出', async () => {
  await withTempDirectory(async root => {
    const applications = path.join(root, 'Applications');
    const source = path.join(root, 'build', APP_BUNDLE_NAME);
    const target = path.join(applications, APP_BUNDLE_NAME);
    await createFakeApp(source, { asar: 'new-build' });
    await createFakeApp(target, { asar: 'running-old-build' });
    let runningChecks = 0;

    await assert.rejects(() => installLocalApp({
      sourcePath: source,
      targetPath: target,
      deps: testDependencies({
        isRunning: async (bundleId, checkedTarget) => {
          runningChecks += 1;
          assert.equal(bundleId, EXPECTED_BUNDLE_ID);
          assert.equal(checkedTarget, target);
          return true;
        }
      })
    }));

    assert.ok(runningChecks >= 1);
    assert.equal(await readAsar(target), 'running-old-build');
    assert.deepEqual(await listNames(applications), [APP_BUNDLE_NAME]);
  });
});

await test('旧目标备份后的 rename 失败会回滚且不遗留本次临时目录', async () => {
  await withTempDirectory(async root => {
    const applications = path.join(root, 'Applications');
    const source = path.join(root, 'build', APP_BUNDLE_NAME);
    const target = path.join(applications, APP_BUNDLE_NAME);
    await createFakeApp(source, { asar: 'new-build-that-must-not-land' });
    await createFakeApp(target, { asar: 'old-build-to-restore' });

    let oldTargetMoved = false;
    let swapFailureInjected = false;
    const rename = async (from, to) => {
      const fromPath = path.resolve(from);
      const toPath = path.resolve(to);
      if (fromPath === path.resolve(target)) oldTargetMoved = true;
      if (oldTargetMoved && !swapFailureInjected && toPath === path.resolve(target)) {
        swapFailureInjected = true;
        throw new Error('injected stage-to-target rename failure');
      }
      await fs.rename(from, to);
    };

    await assert.rejects(() => installLocalApp({
      sourcePath: source,
      targetPath: target,
      deps: testDependencies({ rename })
    }));

    assert.equal(oldTargetMoved, true);
    assert.equal(swapFailureInjected, true);
    assert.equal(await readAsar(target), 'old-build-to-restore');
    assert.deepEqual(await listNames(applications), [APP_BUNDLE_NAME]);
  });
});

await test('最终安装校验失败会恢复旧入口并清理拒绝的新包', async () => {
  await withTempDirectory(async root => {
    const applications = path.join(root, 'Applications');
    const source = path.join(root, 'build', APP_BUNDLE_NAME);
    const target = path.join(applications, APP_BUNDLE_NAME);
    await createFakeApp(source, { asar: 'new-build-that-fails-final-verification' });
    await createFakeApp(target, { asar: 'old-build-to-restore-after-verification' });

    await assert.rejects(() => installLocalApp({
      sourcePath: source,
      targetPath: target,
      deps: testDependencies({
        hashApp: async appPath => {
          if (path.resolve(appPath) === path.resolve(target)) return 'unexpected-final-hash';
          return readAsar(appPath);
        }
      })
    }));

    assert.equal(await readAsar(target), 'old-build-to-restore-after-verification');
    assert.deepEqual(await listNames(applications), [APP_BUNDLE_NAME]);
  });
});

console.log(`\n本地应用安装结果: ${passed} 通过, ${failed} 失败`);
if (failed) process.exit(1);
