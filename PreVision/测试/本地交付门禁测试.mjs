import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import {
  assertDeliveryLineage,
  assertPackagedBuildMatches,
  assertRepositoryUnchanged,
  validateBuildProvenance,
  validateDeliveryPolicy,
  validateDeliverySource
} from '../scripts/update-local-app.mjs';
import { runDelivery } from '../scripts/deliver-local-app.mjs';

const require = createRequire(import.meta.url);
const { createBuildProvenance } = require('../scripts/build-provenance.cjs');
const A = 'a'.repeat(40);
const B = 'b'.repeat(40);
const HASH = 'c'.repeat(64);
const source = Object.freeze({ commit: B, branch: 'feat/example', clean: true });
const installed = Object.freeze({
  schemaVersion: 1,
  product: 'PreVision',
  commit: A,
  branch: 'fix/previous',
  clean: true,
  deliveryEligible: true,
  builtAt: '2026-07-14T00:00:00.000Z'
});
const policy = Object.freeze({
  schemaVersion: 1,
  product: 'PreVision',
  fixedAppPath: '~/Applications/PreVision.app',
  buildInfoName: 'prevision-build.json',
  bootstrapSourceCommit: A,
  bootstrapInstalledAsarSha256: HASH
});
let passed = 0;
let failed = 0;

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

console.log('· 本地交付来源与分支防回退');

await test('只接受干净且有命名分支的提交', () => {
  assert.equal(validateDeliverySource(source), source);
  assert.throws(() => validateDeliverySource({ ...source, clean: false }), /clean committed worktree/);
  assert.throws(() => validateDeliverySource({ ...source, branch: '' }), /named Git branch/);
});

await test('构建来源必须是可交付的干净提交', () => {
  assert.equal(validateBuildProvenance(installed), installed);
  assert.throws(
    () => validateBuildProvenance({ ...installed, deliveryEligible: false }),
    /invalid or non-delivery build provenance/
  );
});

await test('交付策略必须固定 bootstrap 提交和安装包哈希', () => {
  assert.equal(validateDeliveryPolicy(policy), policy);
  assert.throws(() => validateDeliveryPolicy({ ...policy, bootstrapInstalledAsarSha256: '' }), /Invalid/);
});

await test('当前分支包含已安装来源时允许前进', async () => {
  const result = await assertDeliveryLineage({
    source,
    installedInfo: installed,
    installedHash: HASH,
    policy,
    isAncestor: async (ancestor, descendant) => ancestor === A && descendant === B
  });
  assert.equal(result.mode, 'tracked');
  assert.equal(result.previousCommit, A);
});

await test('兄弟分支不能覆盖包含其他新功能的安装包', async () => {
  await assert.rejects(
    assertDeliveryLineage({
      source,
      installedInfo: installed,
      installedHash: HASH,
      policy,
      isAncestor: async () => false
    }),
    /does not contain the installed PreVision source/
  );
});

await test('旧安装包只允许从精确 bootstrap 哈希迁移一次', async () => {
  const accepted = await assertDeliveryLineage({
    source,
    installedInfo: null,
    installedHash: HASH,
    policy,
    isAncestor: async () => true
  });
  assert.equal(accepted.mode, 'bootstrap');
  await assert.rejects(
    assertDeliveryLineage({
      source,
      installedInfo: null,
      installedHash: 'd'.repeat(64),
      policy,
      isAncestor: async () => true
    }),
    /does not match the bootstrap build/
  );
});

await test('首次安装没有旧来源时允许建立记录', async () => {
  const result = await assertDeliveryLineage({
    source,
    installedInfo: null,
    installedHash: null,
    policy,
    isAncestor: async () => false
  });
  assert.equal(result.mode, 'first-install');
});

await test('打包结果必须与当前提交和分支完全一致', () => {
  const packaged = { ...installed, commit: B, branch: source.branch };
  assert.equal(assertPackagedBuildMatches(packaged, source), packaged);
  assert.throws(
    () => assertPackagedBuildMatches({ ...packaged, commit: A }, source),
    /does not match the current delivery source/
  );
});

await test('打包过程中分支或工作区发生变化时拒绝安装', () => {
  assert.equal(assertRepositoryUnchanged(source, source), source);
  assert.throws(
    () => assertRepositoryUnchanged({ ...source, clean: false }, source),
    /clean committed worktree/
  );
  assert.throws(
    () => assertRepositoryUnchanged({ ...source, branch: 'fix/other' }, source),
    /changed while the app was being packaged/
  );
});

await test('Forge 只把明确的干净交付构建标为可安装', () => {
  const info = createBuildProvenance({
    env: {
      PREVISION_DELIVERY_BUILD: '1',
      PREVISION_SOURCE_COMMIT: B,
      PREVISION_SOURCE_BRANCH: source.branch,
      PREVISION_SOURCE_CLEAN: '1'
    },
    state: source,
    now: new Date('2026-07-14T00:00:00.000Z')
  });
  assert.equal(info.deliveryEligible, true);
  assert.equal(info.commit, B);
  assert.throws(() => createBuildProvenance({
    env: { PREVISION_DELIVERY_BUILD: '1' },
    state: { ...source, clean: false }
  }), /clean committed worktree/);
});

await test('一键交付严格按全量测试、更新、启动顺序执行', async () => {
  const order = [];
  const result = await runDelivery({
    nodeVersion: '22.0.0',
    test: async () => { order.push('test'); },
    update: async () => {
      order.push('update');
      return { targetPath: '/tmp/PreVision.app', sourceCommit: B };
    },
    launch: async appPath => { order.push(`launch:${appPath}`); }
  });
  assert.deepEqual(order, ['test', 'update', 'launch:/tmp/PreVision.app']);
  assert.equal(result.sourceCommit, B);
});

await test('全量测试失败时不会更新或启动固定 App', async () => {
  let updateCalled = false;
  await assert.rejects(runDelivery({
    nodeVersion: '22.0.0',
    test: async () => { throw new Error('test failed'); },
    update: async () => { updateCalled = true; },
    launch: async () => {}
  }), /test failed/);
  assert.equal(updateCalled, false);
});

await test('安装失败时不会启动旧入口冒充新版本', async () => {
  let launchCalled = false;
  await assert.rejects(runDelivery({
    nodeVersion: '22.0.0',
    test: async () => {},
    update: async () => { throw new Error('update failed'); },
    launch: async () => { launchCalled = true; }
  }), /update failed/);
  assert.equal(launchCalled, false);
});

console.log(`\n本地交付门禁结果: ${passed} 通过, ${failed} 失败`);
if (failed > 0) process.exit(1);
