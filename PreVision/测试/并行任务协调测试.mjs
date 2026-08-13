import crypto from 'crypto';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { execFileSync, spawn, spawnSync } from 'child_process';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const script = path.join(root, 'scripts', 'task-coordination.mjs');
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'prevision-task-coordination-'));
const baseline = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
const baselineParent = execFileSync('git', ['rev-parse', 'HEAD^'], {
  cwd: root,
  encoding: 'utf8'
}).trim();
const legacyBaseline = 'c037a4b32ddc4557336f27af44300633281e2df4';
const rejectedR3Commit = '2f6cd51fc9b045576e04e8900a9d7533b92f8f20';
const rejectedR4Commit = '5dd075c6c70949edb65da36609d20ebc99761ddf';
const rejectedR5Commit = '40d4d71b747d22a314bc472d293a0c1866ff0a35';
const legacyRoot = path.join(temporary, 'legacy-c037');
const legacyScript = path.join(legacyRoot, 'scripts', 'task-coordination.mjs');
execFileSync('git', ['worktree', 'add', '--detach', legacyRoot, legacyBaseline], {
  cwd: root,
  stdio: 'ignore'
});
let legacyWorktreeRegistered = true;
process.on('exit', () => {
  if (!legacyWorktreeRegistered) return;
  spawnSync('git', ['worktree', 'remove', '--force', legacyRoot], {
    cwd: root,
    stdio: 'ignore'
  });
});
const rejectedR3Root = path.join(temporary, 'rejected-r3-2f6');
const rejectedR3Script = path.join(rejectedR3Root, 'scripts', 'task-coordination.mjs');
fs.mkdirSync(path.dirname(rejectedR3Script), { recursive: true });
fs.mkdirSync(path.join(rejectedR3Root, 'qa'), { recursive: true });
fs.writeFileSync(
  rejectedR3Script,
  execFileSync('git', ['show', `${rejectedR3Commit}:scripts/task-coordination.mjs`], {
    cwd: root,
    encoding: 'utf8'
  })
);
fs.writeFileSync(
  path.join(rejectedR3Root, 'qa', 'task-scope-taxonomy.json'),
  execFileSync('git', ['show', `${rejectedR3Commit}:qa/task-scope-taxonomy.json`], {
    cwd: root,
    encoding: 'utf8'
  })
);
const rejectedR4Root = path.join(temporary, 'rejected-r4-5dd');
const rejectedR4Script = path.join(rejectedR4Root, 'scripts', 'task-coordination.mjs');
fs.mkdirSync(path.dirname(rejectedR4Script), { recursive: true });
fs.mkdirSync(path.join(rejectedR4Root, 'qa'), { recursive: true });
fs.writeFileSync(
  rejectedR4Script,
  execFileSync('git', ['show', `${rejectedR4Commit}:scripts/task-coordination.mjs`], {
    cwd: root,
    encoding: 'utf8'
  })
);
fs.writeFileSync(
  path.join(rejectedR4Root, 'qa', 'task-scope-taxonomy.json'),
  execFileSync('git', ['show', `${rejectedR4Commit}:qa/task-scope-taxonomy.json`], {
    cwd: root,
    encoding: 'utf8'
  })
);
const rejectedR5Root = path.join(temporary, 'rejected-r5-40d');
const rejectedR5Script = path.join(rejectedR5Root, 'scripts', 'task-coordination.mjs');
fs.mkdirSync(path.dirname(rejectedR5Script), { recursive: true });
fs.mkdirSync(path.join(rejectedR5Root, 'qa'), { recursive: true });
fs.writeFileSync(
  rejectedR5Script,
  execFileSync('git', ['show', `${rejectedR5Commit}:scripts/task-coordination.mjs`], {
    cwd: root,
    encoding: 'utf8'
  })
);
fs.writeFileSync(
  path.join(rejectedR5Root, 'qa', 'task-scope-taxonomy.json'),
  execFileSync('git', ['show', `${rejectedR5Commit}:qa/task-scope-taxonomy.json`], {
    cwd: root,
    encoding: 'utf8'
  })
);
let passed = 0;
let failed = 0;
const rejectedR3OracleFailures = [];
const rejectedR4OracleFailures = [];
const rejectedR5OracleFailures = [];
const currentOraclePasses = [];

function assert(condition, message) {
  if (condition) passed++;
  else {
    failed++;
    console.error(`  ✗ FAIL: ${message}`);
  }
}

function sameMembers(left, right) {
  return left.length === right.length &&
    [...left].sort().every((value, index) => value === [...right].sort()[index]);
}

function registryPath(name) {
  return path.join(temporary, `${name}.json`);
}

function writeRegistry(file, value) {
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
  fs.chmodSync(file, 0o600);
}

function lstatIfPresentForTest(file) {
  try {
    return fs.lstatSync(file);
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
}

function processIdentity(pid = process.pid) {
  const identity = execFileSync('/bin/ps', [
    '-p',
    String(pid),
    '-o',
    'lstart='
  ], {
    encoding: 'utf8',
    env: { ...process.env, LC_ALL: 'C', LANG: 'C', TZ: 'UTC0' }
  }).trim().replace(/\s+/g, ' ');
  return `process-start:${identity}`;
}

function lockMarker(pid, ownerIdentity, nonce = crypto.randomBytes(24).toString('hex')) {
  return {
    schemaVersion: 2,
    kind: 'prevision-task-coordination-v3-lock',
    pid,
    ownerIdentity,
    nonce,
    acquiredAt: new Date().toISOString()
  };
}

const canonicalDeadIdentity = 'process-start:Mon Jan 1 00:00:00 2001';

function run(command, options = {}) {
  const registry = options.registry || registryPath('default');
  const result = spawnSync(process.execPath, [script, ...command], {
    cwd: root,
    env: { ...process.env, PREVISION_TASK_REGISTRY: registry, ...(options.env || {}) },
    encoding: 'utf8'
  });
  if (options.code !== undefined) assert(result.status === options.code,
    `${command.join(' ')} 退出码应为 ${options.code}，实际 ${result.status}; stderr=${result.stderr.trim()}`);
  if (options.includes) assert(result.stdout.includes(options.includes),
    `${command.join(' ')} 应输出 ${options.includes}`);
  if (options.stderrIncludes) assert(result.stderr.includes(options.stderrIncludes),
    `${command.join(' ')} stderr 应输出 ${options.stderrIncludes}; actual=${result.stderr.trim()}`);
  return result;
}

function runAsync(command, registry, env = {}) {
  return new Promise(resolve => {
    const child = spawn(process.execPath, [script, ...command], {
      cwd: root,
      env: { ...process.env, PREVISION_TASK_REGISTRY: registry, ...env },
      stdio: ['ignore', 'pipe', 'pipe']
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', chunk => { stdout += chunk; });
    child.stderr.on('data', chunk => { stderr += chunk; });
    child.on('close', status => resolve({ status, stdout, stderr }));
  });
}

function startAsync(command, registry, env = {}) {
  const child = spawn(process.execPath, [script, ...command], {
    cwd: root,
    env: { ...process.env, PREVISION_TASK_REGISTRY: registry, ...env },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  let stdout = '';
  let stderr = '';
  child.stdout.on('data', chunk => { stdout += chunk; });
  child.stderr.on('data', chunk => { stderr += chunk; });
  return {
    child,
    completed: new Promise(resolve => {
      child.on('close', status => resolve({ status, stdout, stderr }));
    })
  };
}

async function waitFor(predicate, message, timeout = 3000) {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    if (predicate()) return;
    await new Promise(resolve => setTimeout(resolve, 10));
  }
  assert(false, message);
}

function runLegacy(command, registry) {
  return spawnSync(process.execPath, [legacyScript, ...command], {
    cwd: legacyRoot,
    env: { ...process.env, PREVISION_TASK_REGISTRY: registry },
    encoding: 'utf8'
  });
}

function runRejectedR4(command, registry, gitDirectory = root) {
  return spawnSync(process.execPath, [rejectedR4Script, ...command], {
    cwd: rejectedR4Root,
    env: {
      ...process.env,
      PREVISION_TASK_REGISTRY: registry,
      PREVISION_COORDINATION_GIT_ROOT: gitDirectory
    },
    encoding: 'utf8'
  });
}

function runRejectedR5(command, registry, gitDirectory = root) {
  return spawnSync(process.execPath, [rejectedR5Script, ...command], {
    cwd: rejectedR5Root,
    env: {
      ...process.env,
      PREVISION_TASK_REGISTRY: registry,
      PREVISION_COORDINATION_GIT_ROOT: gitDirectory
    },
    encoding: 'utf8'
  });
}

function runLegacyAsync(command, registry, env = {}) {
  return new Promise(resolve => {
    const child = spawn(process.execPath, [legacyScript, ...command], {
      cwd: legacyRoot,
      env: { ...process.env, PREVISION_TASK_REGISTRY: registry, ...env },
      stdio: ['ignore', 'pipe', 'pipe']
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', chunk => { stdout += chunk; });
    child.stderr.on('data', chunk => { stderr += chunk; });
    child.on('close', status => resolve({ status, stdout, stderr }));
  });
}

function startRejectedR3(command, registry, env = {}) {
  const child = spawn(process.execPath, [rejectedR3Script, ...command], {
    cwd: rejectedR3Root,
    env: {
      ...process.env,
      PREVISION_TASK_REGISTRY: registry,
      PREVISION_COORDINATION_GIT_ROOT: root,
      ...env
    },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  let stdout = '';
  let stderr = '';
  child.stdout.on('data', chunk => { stdout += chunk; });
  child.stderr.on('data', chunk => { stderr += chunk; });
  return {
    child,
    completed: new Promise(resolve => {
      child.on('close', status => resolve({ status, stdout, stderr }));
    })
  };
}

function cancellationArgs(token, taskId) {
  return [
    'cancel-reservation',
    '--reservation', token,
    '--task', taskId,
    '--compensation-confirmed', 'yes',
    '--rollout-state', 'missing',
    '--thread-record-state', 'missing',
    '--sidebar-state', 'absent',
    '--actor', '04',
    '--reason', 'Compensated creation failure after explicit three-way absence verification.',
    '--evidence', 'rollout=missing;thread-record=missing;sidebar=absent;turn=not-started;owner=none'
  ];
}

function writeArgs(taskId, owner, module, file = `${taskId}.md`) {
  return [
    '--task', taskId,
    '--title', taskId,
    '--owner', owner,
    '--request-key', `request-${taskId}-${owner}`,
    '--source', baseline,
    '--modules', module,
    '--files', file
  ];
}

function parseJson(result, label) {
  try {
    return JSON.parse(result.stdout);
  } catch {
    assert(false, `${label} 应输出有效 JSON`);
    return {};
  }
}

function reserve(taskId, owner, module, registry, file) {
  const result = run(['reserve', ...writeArgs(taskId, owner, module, file), '--json'], {
    registry,
    code: 0
  });
  return parseJson(result, `${taskId} reserve`);
}

function claimArgs(taskId, module, token, file = `${taskId}.md`) {
  return [
    'claim',
    '--reservation', token,
    '--task', taskId,
    '--title', taskId,
    '--branch', `work/${taskId}`,
    '--source', baseline,
    '--modules', module,
    '--files', file,
    '--actor', `worker:${taskId}`,
    '--next', `worker:${taskId}`,
    '--reason', 'Canonical sidebar worker started implementation.',
    '--thread-id', `thread-${taskId}`,
    '--client-id', `client-${taskId}`,
    '--rollout-state', 'present',
    '--thread-record-state', 'present',
    '--sidebar-state', 'present',
    '--name-state', 'set',
    '--turn-state', 'started',
    '--turn-owner', 'background',
    '--execution-visibility', 'BACKGROUND_ONLY',
    '--json'
  ];
}

function transitionArgs(taskId, to, actor, next, reason, extra = []) {
  return [
    'transition',
    '--task', taskId,
    '--to', to,
    '--actor', actor,
    '--next', next,
    '--reason', reason,
    ...extra,
    '--json'
  ];
}

function establishWaiting(taskId, owner, token, threadId, clientId, registry, env = {}) {
  run(transitionArgs(
    taskId,
    'RESERVED',
    owner,
    `${owner}-waiting-checkpoint`,
    'The canonical short WAITING turn started.',
    [
      '--reservation', token,
      '--thread-id', threadId,
      '--client-id', clientId,
      '--rollout-state', 'present',
      '--thread-record-state', 'present',
      '--sidebar-state', 'present',
      '--name-state', 'set',
      '--turn-state', 'started',
      '--turn-owner', 'background',
      '--execution-visibility', 'BACKGROUND_ONLY'
    ]
  ), { registry, code: 0, env });
  run([
    'verify-stop',
    '--task', taskId,
    '--reservation', token,
    '--actor', owner,
    '--next', `${owner}-start-signal`,
    '--reason', 'The short WAITING turn completed.',
    '--evidence', 'turn/completed was observed and the background owner stopped.',
    '--turn-state', 'completed',
    '--execution-visibility', 'WAITING',
    '--json'
  ], { registry, code: 0, env });
  run(transitionArgs(
    taskId,
    'WAITING',
    owner,
    `${owner}-start-signal`,
    'The same canonical task is waiting for its start signal.',
    ['--reservation', token]
  ), { registry, code: 0, env });
}

function beginGitLifecycle({ taskId, registry, gitDirectory, source, branch, files }) {
  execFileSync('git', ['checkout', branch], { cwd: gitDirectory, stdio: 'ignore' });
  const env = { PREVISION_COORDINATION_GIT_ROOT: gitDirectory };
  const reservation = parseJson(run([
    'reserve',
    '--task', taskId,
    '--title', taskId,
    '--owner', '04',
    '--request-key', `request-${taskId}`,
    '--source', source,
    '--modules', 'testing',
    '--files', files.join(','),
    '--json'
  ], { registry, code: 0, env }), `${taskId} Git lifecycle reserve`);
  run([
    'claim',
    '--reservation', reservation.token,
    '--task', taskId,
    '--title', taskId,
    '--branch', branch,
    '--source', source,
    '--modules', 'testing',
    '--files', files.join(','),
    '--actor', `worker:${taskId}`,
    '--next', `worker:${taskId}`,
    '--reason', 'The canonical task branch started its implementation turn.',
    '--thread-id', `thread-${taskId}`,
    '--client-id', `client-${taskId}`,
    '--rollout-state', 'present',
    '--thread-record-state', 'present',
    '--sidebar-state', 'present',
    '--name-state', 'set',
    '--turn-state', 'started',
    '--turn-owner', 'background',
    '--execution-visibility', 'BACKGROUND_ONLY',
    '--json'
  ], { registry, code: 0, env });
  run([
    'verify-stop',
    '--task', taskId,
    '--actor', `worker:${taskId}`,
    '--next', `worker:${taskId}`,
    '--reason', 'The task implementation turn completed.',
    '--evidence', 'The canonical background turn completed and its owner stopped.',
    '--turn-state', 'completed',
    '--execution-visibility', 'BACKGROUND_ONLY',
    '--json'
  ], { registry, code: 0, env });
  return { env, reservation };
}

console.log('· 固定入口自治与中央集成职责边界');
const agentsPolicy = fs.readFileSync(path.join(root, 'AGENTS.md'), 'utf8');
const workflowPolicy = fs.readFileSync(path.join(root, 'docs', 'DEVELOPMENT_WORKFLOW.md'), 'utf8');
const adrPolicy = fs.readFileSync(
  path.join(root, 'docs', 'decisions', '0005-department-autonomous-dispatch-and-atomic-write-reservations.md'),
  'utf8'
);
const routingPolicy = fs.readFileSync(path.join(root, 'docs', 'CODEX_MODEL_ROUTING.md'), 'utf8');
const fixedEntryPolicies = [agentsPolicy, workflowPolicy, adrPolicy];
assert(fixedEntryPolicies.every(content => content.includes('固定 `01`–`04`')), '规则文件必须一致覆盖固定 01–04');
assert(fixedEntryPolicies.every(content => content.includes('自治派发')), '固定 01–04 必须具备分管自治派发职责');
assert(fixedEntryPolicies.every(content => content.includes('固定 `00`') && content.includes('机械集成')),
  '固定 00 必须保留中央机械集成职责');
assert(fixedEntryPolicies.every(content => content.includes('**MUST NOT**') && content.includes('write claim')),
  '固定入口仍不得亲自实现或持有 write claim');
assert(fixedEntryPolicies.every(content => content.includes('用户侧栏可见') && content.includes('独立短期临时工')),
  '所有实际写入必须继续由用户侧栏可见独立临时工完成');
assert(fixedEntryPolicies.every(content => content.includes('reserve') && content.includes('cancel')),
  '规则文件必须覆盖原子预留和失败取消');
assert(fixedEntryPolicies.every(content => content.includes('停滞') && content.includes('重复任务')),
  '规则文件必须覆盖停滞恢复和重复任务去重');
assert(fixedEntryPolicies.every(content => content.includes('WAITING') &&
  content.includes('INTEGRATING') && content.includes('ARCHIVE_PENDING')),
  '规则文件必须覆盖等待、集成和归档失败的权威生命周期');
assert(fixedEntryPolicies.every(content => content.includes('thread/start') &&
  content.includes('thread/name/set') && content.includes('turn/completed')),
  '规则文件必须定义真实侧栏 thread 和通知消费协议');
assert(fixedEntryPolicies.every(content => content.includes('DESKTOP_LIVE') &&
  content.includes('BACKGROUND_ONLY') && content.includes('侧栏可见任务') &&
  content.includes('侧栏可见运行')),
  '规则文件必须区分任务条目存在、Desktop 实时运行和后台施工');
assert(workflowPolicy.includes('去敏的真实 ghost 故障样本') &&
  workflowPolicy.includes('heartbeat permission') &&
  workflowPolicy.includes('thread description') &&
  workflowPolicy.includes('thread-client-id') &&
  workflowPolicy.includes('三方核对') &&
  workflowPolicy.includes('不提交真实 task/thread 标识'),
  '开发流程必须以去敏样本覆盖真实 ghost task 的 renderer atom 分裂和三方核对');
assert(routingPolicy.includes('R0') && routingPolicy.includes('R1') && routingPolicy.includes('R2') && routingPolicy.includes('R3'),
  '模型路由必须覆盖 R0-R3');
assert(routingPolicy.includes('Fast') && routingPolicy.includes('Ultra') && routingPolicy.includes('独立只读 reviewer'),
  '模型路由必须覆盖额度开关和独立 reviewer');

console.log('· 三个真实并发 reserve 恰好两个成功');
const concurrentRegistry = registryPath('three-concurrent');
const concurrentResults = await Promise.all([
  runAsync(['reserve', ...writeArgs('reserve-a', '01', 'display'), '--json'], concurrentRegistry),
  runAsync(['reserve', ...writeArgs('reserve-b', '02', 'camera'), '--json'], concurrentRegistry),
  runAsync(['reserve', ...writeArgs('reserve-c', '03', 'actor'), '--json'], concurrentRegistry)
]);
assert(concurrentResults.filter(result => result.status === 0).length === 2, '三个并发 reserve 必须恰好两个成功');
assert(concurrentResults.filter(result => result.status === 2).length === 1, '第三个并发 reserve 必须因容量以退出码 2 失败');
assert(concurrentResults.some(result => result.stdout.includes('write-capacity-exceeded')),
  '第三个 reserve 必须报告共享写槽容量已满');
const concurrentTokens = concurrentResults
  .filter(result => result.status === 0)
  .map(result => JSON.parse(result.stdout).token);
assert(concurrentTokens.length === 2 && new Set(concurrentTokens).size === 2 &&
  concurrentTokens.every(token => /^[A-Za-z0-9_-]{43}$/.test(token)),
  '成功 reservation 必须返回彼此不同的 32 字节不可猜 token');
const concurrentStatus = parseJson(run(['status', '--json'], {
  registry: concurrentRegistry,
  code: 0
}), '并发 reserve status');
assert(concurrentStatus.slots.occupied === 2 && concurrentStatus.reservations.length === 2,
  '并发 reserve 后登记必须完整且占用两个槽');

console.log('· active claim 与 reservation 共同限制为两个写槽');
const mixedRegistry = registryPath('mixed-capacity');
writeRegistry(mixedRegistry, {
  schemaVersion: 1,
  claims: [{
    taskId: 'legacy-active',
    title: 'legacy-active',
    branch: 'fix/legacy-active',
    sourceCommit: baseline,
    mode: 'write',
    modules: ['layout'],
    uiSurfaces: [],
    dataAreas: [],
    files: ['legacy.md'],
    updatedAt: new Date().toISOString()
  }]
});
reserve('mixed-reservation', '02', 'camera', mixedRegistry);
run(['reserve', ...writeArgs('mixed-third', '03', 'actor')], {
  registry: mixedRegistry,
  code: 2,
  includes: 'write-capacity-exceeded'
});
const mixedStatus = parseJson(run(['status', '--json'], { registry: mixedRegistry, code: 0 }), '混合槽 status');
assert(mixedStatus.slots.writeClaims === 1 && mixedStatus.slots.activeReservations === 1 &&
  mixedStatus.slots.occupied === 2, 'legacy active claim 与 reservation 必须共同占两个槽');
assert(mixedStatus.claims[0].owner === 'legacy' && mixedStatus.claims[0].legacy === true,
  'legacy schema v1 claim 必须可读且显式标记兼容状态');
const mixedRaw = JSON.parse(fs.readFileSync(mixedRegistry, 'utf8'));
assert(mixedRaw.schemaVersion === 3 && mixedRaw.coordinationVersion === 3 &&
  typeof mixedRaw.revision === 'string' &&
  Array.isArray(mixedRaw.reservations) && Array.isArray(mixedRaw.tasks),
  '正式登记必须升级为严格 schemaVersion 3，并持久化 revision 与完整生命周期');
const legacyRewrite = {
  ...mixedRaw,
  claims: mixedRaw.claims.filter(item => item.taskId !== 'legacy-active')
};
legacyRewrite.claims.push({ ...mixedRaw.claims[0], updatedAt: new Date().toISOString() });
writeRegistry(mixedRegistry, legacyRewrite);
const afterLegacyRewrite = parseJson(run(['status', '--json'], {
  registry: mixedRegistry,
  code: 0
}), 'legacy rewrite status');
assert(afterLegacyRewrite.claims.length === 1 && afterLegacyRewrite.reservations.length === 1 &&
  afterLegacyRewrite.slots.occupied === 2,
  '旧 claims-only 写法保留未知 reservations 时，新脚本必须继续完整读取登记');
run(['claim', '--task', 'legacy-active', '--title', 'legacy-active', '--mode', 'read',
  '--owner', 'reviewer', '--source', baseline, '--modules', 'layout', '--files', 'legacy.md'], {
  registry: mixedRegistry,
  code: 1,
  stderrIncludes: 'already belongs to an active write claim'
});

console.log('· owner、重复 task 与普通 write claim 绕过均拒绝');
const validationRegistry = registryPath('validation');
run(['reserve', ...writeArgs('bad-owner', '05', 'display')], {
  registry: validationRegistry,
  code: 1,
  stderrIncludes: '--owner must be one of 01, 02, 03, 04'
});
const canonical = reserve('canonical-task', '01', 'display', validationRegistry);
run(['reserve', ...writeArgs('canonical-task', '02', 'camera')], {
  registry: validationRegistry,
  code: 2,
  includes: 'duplicate-task'
});
run(['claim', '--task', 'bypass-task', '--title', 'bypass-task', '--source', baseline,
  '--modules', 'camera', '--files', 'bypass.md'], {
  registry: validationRegistry,
  code: 1,
  stderrIncludes: 'New write claims require --reservation'
});
run(['reserve', ...writeArgs('path-traversal', '02', 'camera', '../outside.md')], {
  registry: validationRegistry,
  code: 1,
  stderrIncludes: 'normalized repository-relative paths'
});
run(['reserve',
  '--task', 'spaced-title',
  '--title', ' spaced title',
  '--owner', '02',
  '--source', baseline,
  '--modules', 'camera',
  '--files', 'spaced-title.md'], {
  registry: validationRegistry,
  code: 1,
  stderrIncludes: 'canonical safe line'
});
run(['reserve',
  '--task', 'newline-title',
  '--title', 'line one\nline two',
  '--owner', '02',
  '--source', baseline,
  '--modules', 'camera',
  '--files', 'newline-title.md'], {
  registry: validationRegistry,
  code: 1,
  stderrIncludes: 'canonical safe line'
});
run(['reserve',
  '--task', 'long-title',
  '--title', 'x'.repeat(201),
  '--owner', '02',
  '--source', baseline,
  '--modules', 'camera',
  '--files', 'long-title.md'], {
  registry: validationRegistry,
  code: 1,
  stderrIncludes: 'no longer than 200'
});
run(['reserve',
  '--task', 'uppercase-source',
  '--title', 'uppercase-source',
  '--owner', '02',
  '--source', baseline.toUpperCase(),
  '--modules', 'camera',
  '--files', 'uppercase-source.md'], {
  registry: validationRegistry,
  code: 1,
  stderrIncludes: 'exact lowercase'
});
run(['reserve',
  '--task', 'missing-source',
  '--title', 'missing-source',
  '--owner', '02',
  '--request-key', 'request-missing-source-02',
  '--source', 'a'.repeat(40),
  '--modules', 'camera',
  '--files', 'missing-source.md'], {
  registry: validationRegistry,
  code: 1,
  stderrIncludes: 'existing Git commit object'
});
for (const [name, unsafeTitle] of [
  ['tab-title', 'line\twith-tab'],
  ['escape-title', `line${String.fromCharCode(0x1b)}escape`],
  ['c1-title', `line${String.fromCharCode(0x85)}c1`],
  ['unicode-line-separator', 'line\u2028separator'],
  ['unicode-paragraph-separator', 'line\u2029separator']
]) {
  run(['reserve',
    '--task', name,
    '--title', unsafeTitle,
    '--owner', '02',
    '--source', baseline,
    '--modules', 'camera',
    '--files', `${name}.md`], {
    registry: validationRegistry,
    code: 1,
    stderrIncludes: 'canonical safe line'
  });
}
const validationStatus = parseJson(run(['status', '--json'], {
  registry: validationRegistry,
  code: 0
}), 'validation status');
assert(validationStatus.reservations.length === 1 &&
  validationStatus.reservations[0].taskId === canonical.reservation.taskId,
  '非法 owner、重复 task 与绕过 claim 不得改变规范 reservation');

console.log('· 只读 reviewer 不持久化权威 claim，历史 read claim 可显式清理');
const readOnlyRegistry = registryPath('read-only-no-claim');
run(['claim', '--task', 'read-only-review', '--title', 'read-only-review', '--mode', 'read',
  '--owner', 'reviewer', '--source', baseline, '--modules', 'testing',
  '--files', 'read-only-review.md', '--json'], {
  registry: readOnlyRegistry,
  code: 0,
  includes: 'read-only-review'
});
const readOnlyStatus = parseJson(run(['status', '--json'], {
  registry: readOnlyRegistry,
  code: 0
}), 'read-only status');
assert(readOnlyStatus.claims.length === 0 && readOnlyStatus.slots.occupied === 0,
  '新的只读检查不得写入 claim、占槽或制造 duplicate task');
const deprecatedReadRaw = {
  schemaVersion: 3,
  coordinationVersion: 3,
  revision: crypto.randomUUID(),
  updatedAt: new Date().toISOString(),
  claims: [],
  reservations: [],
  tasks: [],
  integrityIssues: []
};
deprecatedReadRaw.claims.push({
  taskId: 'deprecated-read-claim',
  title: 'deprecated-read-claim',
  branch: 'review/deprecated-read-claim',
  sourceCommit: baseline,
  mode: 'read',
  owner: 'reviewer',
  legacy: false,
  modules: ['testing'],
  uiSurfaces: [],
  dataAreas: [],
  files: ['deprecated-read-claim.md'],
  updatedAt: new Date().toISOString()
});
writeRegistry(readOnlyRegistry, deprecatedReadRaw);
run(['release', '--task', 'deprecated-read-claim', '--actor', 'reviewer', '--json'], {
  registry: readOnlyRegistry,
  code: 0,
  includes: '"deprecatedReadClaim": true'
});
const readCleanupStatus = parseJson(run(['status', '--json'], {
  registry: readOnlyRegistry,
  code: 0
}), 'deprecated read cleanup status');
assert(readCleanupStatus.claims.length === 0,
  '升级前残留 read claim 必须有确定性清理路径，不能永久污染 task ID');

console.log('· rename 后目录 fsync 失败返回可查询的不确定提交而不丢 token');
const uncertainRegistry = registryPath('uncertain-directory-fsync');
const uncertainResult = run([
  'reserve',
  ...writeArgs('uncertain-reserve', '04', 'testing'),
  '--json'
], {
  registry: uncertainRegistry,
  code: 0,
  env: { PREVISION_COORDINATION_TEST_FAIL_DIRECTORY_FSYNC: 'yes' }
});
const uncertainPayload = parseJson(uncertainResult, 'uncertain persistence reserve');
assert(uncertainPayload.persistence?.status === 'uncertain' &&
  typeof uncertainPayload.persistence?.revision === 'string' &&
  typeof uncertainPayload.token === 'string',
  'rename 已可见但目录 fsync 失败时必须返回 token、revision 和 uncertain 状态');
const uncertainStatus = parseJson(run(['status', '--json'], {
  registry: uncertainRegistry,
  code: 0
}), 'uncertain persistence status');
assert(uncertainStatus.revision === uncertainPayload.persistence.revision &&
  uncertainStatus.reservations.some(item => item.taskId === 'uncertain-reserve'),
  '不确定提交必须可通过 task:status revision 查询并恢复，禁止盲目重试');

console.log('· reserve stdout 断连后可用幂等 request key 单飞恢复同一可用 token');
const disconnectedOutputRegistry = registryPath('reserve-output-disconnect');
const disconnectedArgs = [
  'reserve',
  ...writeArgs('output-disconnect', '04', 'testing'),
  '--json'
];
const disconnectedOutput = run(disconnectedArgs, {
  registry: disconnectedOutputRegistry,
  code: 0,
  env: { PREVISION_COORDINATION_TEST_CLOSE_STDOUT_AFTER_WRITE: 'yes' }
});
assert(disconnectedOutput.stdout === '',
  '确定性 stdout 断连 fixture 必须在登记提交后丢失一次性 token 输出');
const disconnectedCommitted = parseJson(run(['status', '--json'], {
  registry: disconnectedOutputRegistry,
  code: 0
}), 'stdout disconnect committed status');
assert(disconnectedCommitted.reservations.length === 1 &&
  disconnectedCommitted.reservations[0].taskId === 'output-disconnect' &&
  disconnectedCommitted.reservations[0].tokenGeneration === 1,
  'stdout 断连后已提交 reservation 必须仍可按 task/request key 查询');
const concurrentRecoveries = await Promise.all([
  runAsync(disconnectedArgs, disconnectedOutputRegistry),
  runAsync(disconnectedArgs, disconnectedOutputRegistry)
]);
assert(concurrentRecoveries.every(result => result.status === 0),
  '同一 request key 的并发 replay 必须都成功');
const recoveredPayloads = concurrentRecoveries.map((result, index) =>
  parseJson(result, `stdout disconnect concurrent token recovery ${index + 1}`));
const recoveredOutput = recoveredPayloads[0];
assert(recoveredPayloads.every(payload =>
  payload.recovered === true &&
  payload.reservation.tokenGeneration === 1 &&
  payload.token === recoveredOutput.token) &&
  typeof recoveredOutput.token === 'string',
  '并发 replay 的所有成功响应必须返回同 generation、同一仍可用 token');
currentOraclePasses.push('concurrent-request-key-single-flight');
run([
  'reserve',
  '--task', 'output-disconnect',
  '--title', 'output-disconnect',
  '--owner', '04',
  '--request-key', 'request-output-disconnect-04',
  '--source', baseline,
  '--modules', 'camera',
  '--files', 'output-disconnect.md'
], {
  registry: disconnectedOutputRegistry,
  code: 1,
  stderrIncludes: 'different reservation specification'
});
run(cancellationArgs(recoveredOutput.token, 'output-disconnect'), {
  registry: disconnectedOutputRegistry,
  code: 0,
  includes: 'CANCELLED RESERVATION'
});
run(disconnectedArgs, {
  registry: disconnectedOutputRegistry,
  code: 1,
  stderrIncludes: 'cannot be replayed'
});
const redispatchedOutputArgs = disconnectedArgs.map(value =>
  value === 'request-output-disconnect-04'
    ? 'request-output-disconnect-04-redispatch'
    : value);
const redispatchedOutput = parseJson(run(redispatchedOutputArgs, {
  registry: disconnectedOutputRegistry,
  code: 0
}), 'same task id redispatch');
assert(redispatchedOutput.reservation.taskId === 'output-disconnect' &&
  redispatchedOutput.reservation.reservationId !== recoveredOutput.reservation.reservationId &&
  redispatchedOutput.token !== recoveredOutput.token,
  'compensated cancellation 后同 task ID 可用新 request key 合法重派，新 generation 不得复用旧 token');
run(claimArgs('output-disconnect', 'testing', recoveredOutput.token), {
  registry: disconnectedOutputRegistry,
  code: 1,
  stderrIncludes: 'Invalid reservation token'
});
run(cancellationArgs(redispatchedOutput.token, 'output-disconnect'), {
  registry: disconnectedOutputRegistry,
  code: 0
});
const rejectedReplayRegistry = registryPath('rejected-r3-request-replay');
const rejectedReplayArgs = [
  'reserve',
  '--task', 'rejected-replay',
  '--title', 'rejected-replay',
  '--owner', '04',
  '--request-key', 'request-rejected-replay',
  '--source', baseline,
  '--modules', 'testing',
  '--files', 'rejected-replay.md',
  '--json'
];
const rejectedInitialReplay = await startRejectedR3(
  rejectedReplayArgs,
  rejectedReplayRegistry
).completed;
const rejectedConcurrentReplay = await Promise.all([
  startRejectedR3(rejectedReplayArgs, rejectedReplayRegistry).completed,
  startRejectedR3(rejectedReplayArgs, rejectedReplayRegistry).completed
]);
const rejectedReplayPayloads = rejectedConcurrentReplay
  .filter(result => result.status === 0)
  .map(result => JSON.parse(result.stdout));
const rejectedReplayUnsafe = rejectedInitialReplay.status === 0 &&
  (rejectedReplayPayloads.length !== 2 ||
    rejectedReplayPayloads[0].token !== rejectedReplayPayloads[1].token ||
    rejectedReplayPayloads[0].reservation.tokenGeneration !==
      rejectedReplayPayloads[1].reservation.tokenGeneration);
assert(rejectedReplayUnsafe,
  '真实 2f6cd51 必须复现并发 request-key replay 不能让所有成功响应返回同一可用 token 的旧失败 oracle');
if (rejectedReplayUnsafe) {
  rejectedR3OracleFailures.push('concurrent-request-key-not-single-flight');
}

console.log('· reservation token 前导连字符仍按 token 解析');
const leadingTokenRegistry = registryPath('leading-token');
reserve('leading-token-task', '04', 'testing', leadingTokenRegistry);
const leadingToken = '--leading-token-compatibility';
const leadingTokenRaw = JSON.parse(fs.readFileSync(leadingTokenRegistry, 'utf8'));
leadingTokenRaw.reservations[0].tokenHash = crypto.createHash('sha256').update(leadingToken).digest('hex');
writeRegistry(leadingTokenRegistry, leadingTokenRaw);
run(claimArgs('leading-token-task', 'testing', leadingToken), {
  registry: leadingTokenRegistry,
  code: 0
});
const leadingTokenStatus = parseJson(run(['status', '--json'], {
  registry: leadingTokenRegistry,
  code: 0
}), 'leading token status');
assert(leadingTokenStatus.claims.length === 1 && leadingTokenStatus.reservations.length === 0,
  '以连字符开头的随机 token 不得被误判为 CLI option');

console.log('· 错误 token、基线/范围不一致与转换失败保留 reservation');
const conversionFailureRegistry = registryPath('conversion-failure');
const conversionFailure = reserve('conversion-failure', '02', 'camera', conversionFailureRegistry);
run(claimArgs('conversion-failure', 'camera', 'wrong-token'), {
  registry: conversionFailureRegistry,
  code: 1,
  stderrIncludes: 'Invalid reservation token'
});
run([
  'claim', '--reservation', conversionFailure.token,
  '--task', 'conversion-failure', '--title', 'conversion-failure',
  '--branch', 'work/conversion-failure', '--source', baselineParent,
  '--modules', 'camera', '--files', 'conversion-failure.md'
], {
  registry: conversionFailureRegistry,
  code: 1,
  stderrIncludes: 'does not exactly match'
});
run(claimArgs('conversion-failure', 'actor', conversionFailure.token), {
  registry: conversionFailureRegistry,
  code: 1,
  stderrIncludes: 'does not exactly match'
});
run([
  'claim', '--reservation', conversionFailure.token,
  '--task', 'conversion-failure', '--title', 'conversion-failure',
  '--branch', 'work/conversion-failure', '--source', baseline,
  '--modules', 'camera', '--files', 'conversion-failure.md',
  '--actor', 'worker:conversion-failure',
  '--next', 'worker:conversion-failure',
  '--reason', 'Missing external mirror fixture.'
], {
  registry: conversionFailureRegistry,
  code: 1,
  stderrIncludes: 'requires --thread-id and --client-id'
});
let failureRaw = JSON.parse(fs.readFileSync(conversionFailureRegistry, 'utf8'));
failureRaw.claims.push({
  taskId: 'late-conflict',
  title: 'late-conflict',
  branch: 'fix/late-conflict',
  sourceCommit: baseline,
  mode: 'write',
  owner: '03',
  legacy: false,
  modules: ['camera'],
  uiSurfaces: [],
  dataAreas: [],
  files: ['late.md'],
  updatedAt: new Date().toISOString()
});
failureRaw.schemaVersion = 2;
delete failureRaw.coordinationVersion;
delete failureRaw.revision;
delete failureRaw.updatedAt;
delete failureRaw.tasks;
delete failureRaw.integrityIssues;
writeRegistry(conversionFailureRegistry, failureRaw);
const lateConflictResult = run(claimArgs('conversion-failure', 'camera', conversionFailure.token), {
  registry: conversionFailureRegistry,
  code: 2
});
const lateConflictPayload = parseJson(lateConflictResult, 'late conflict conversion');
assert(lateConflictPayload.hard?.some(item => item.type === 'scope-overlap') &&
  lateConflictPayload.reservation?.taskId === 'conversion-failure',
  '转换时出现新硬冲突必须返回冲突并保留原 reservation');
const preservedStatus = parseJson(run(['status', '--json'], {
  registry: conversionFailureRegistry,
  code: 0
}), 'preserved status');
assert(preservedStatus.reservations.some(item => item.taskId === 'conversion-failure'),
  '任何 claim 转换失败都不得丢失 reservation');
assert(preservedStatus.conflicts?.hard?.some(item =>
  item.taskId.includes('conversion-failure') &&
  item.owner.includes('02') && item.owner.includes('03') &&
  item.overlap.modules.includes('camera') &&
  item.recommendation.includes('00')),
  'task:status 必须展示登记内跨部门硬冲突 owner、任务、重叠范围与推荐顺序');

console.log('· 执行可见性缺失时 fail closed，Desktop live 必须有实际观察证据');
const missingVisibilityRegistry = registryPath('missing-visibility');
const missingVisibility = reserve('missing-visibility', '01', 'testing', missingVisibilityRegistry);
const missingVisibilityClaim = claimArgs(
  'missing-visibility',
  'testing',
  missingVisibility.token
);
const visibilityIndex = missingVisibilityClaim.indexOf('--execution-visibility');
missingVisibilityClaim.splice(visibilityIndex, 2);
run(missingVisibilityClaim, {
  registry: missingVisibilityRegistry,
  code: 1,
  stderrIncludes: 'requires explicit --execution-visibility'
});
const unknownVisibilityStatus = parseJson(run(['status', '--json'], {
  registry: missingVisibilityRegistry,
  code: 0
}), 'unknown visibility status');
assert(unknownVisibilityStatus.tasks[0].external.executionVisibility === 'UNKNOWN' &&
  unknownVisibilityStatus.lifecycle.byExecutionVisibility.UNKNOWN === 1 &&
  unknownVisibilityStatus.reservations.length === 1,
  '缺失 execution visibility 必须显示 UNKNOWN、保留 reservation，且不能推断为 DESKTOP_LIVE');
const unknownVisibilityText = run(['status'], {
  registry: missingVisibilityRegistry,
  code: 0
});
assert(unknownVisibilityText.stdout.includes('[RESERVED] visibility=UNKNOWN') &&
  !unknownVisibilityText.stdout.includes('[RESERVED] visibility=DESKTOP_LIVE'),
  '文本 status 不得把 missing/UNKNOWN visibility 展示为 DESKTOP_LIVE');

const desktopLiveRegistry = registryPath('desktop-live');
const desktopLive = reserve('desktop-live', '03', 'layout', desktopLiveRegistry);
const unobservedDesktopClaim = claimArgs('desktop-live', 'layout', desktopLive.token);
unobservedDesktopClaim[unobservedDesktopClaim.indexOf('BACKGROUND_ONLY')] = 'DESKTOP_LIVE';
unobservedDesktopClaim[unobservedDesktopClaim.indexOf('background')] = 'desktop';
run(unobservedDesktopClaim, {
  registry: desktopLiveRegistry,
  code: 1,
  stderrIncludes: 'DESKTOP_LIVE requires'
});
const unknownOwnerDesktopClaim = [...unobservedDesktopClaim];
unknownOwnerDesktopClaim.splice(unknownOwnerDesktopClaim.indexOf('--turn-owner'), 2);
unknownOwnerDesktopClaim.splice(unknownOwnerDesktopClaim.indexOf('--json'), 0,
  '--desktop-live-observed', 'yes');
run(unknownOwnerDesktopClaim, {
  registry: desktopLiveRegistry,
  code: 1,
  stderrIncludes: 'DESKTOP_LIVE requires'
});
for (const [label, optionName, value] of [
  ['missing rollout', '--rollout-state', 'missing'],
  ['missing thread record', '--thread-record-state', 'missing'],
  ['failed name', '--name-state', 'failed']
]) {
  const incompleteDesktopClaim = [...unobservedDesktopClaim];
  incompleteDesktopClaim.splice(incompleteDesktopClaim.indexOf('--json'), 0,
    '--desktop-live-observed', 'yes');
  incompleteDesktopClaim[incompleteDesktopClaim.indexOf(optionName) + 1] = value;
  run(incompleteDesktopClaim, {
    registry: desktopLiveRegistry,
    code: 1,
    stderrIncludes: 'present rollout/thread/sidebar records'
  });
  assert(true, `DESKTOP_LIVE 必须拒绝 ${label}`);
}
const observedDesktopClaim = [...unobservedDesktopClaim];
observedDesktopClaim.splice(observedDesktopClaim.indexOf('--json'), 0,
  '--desktop-live-observed', 'yes');
run(observedDesktopClaim, {
  registry: desktopLiveRegistry,
  code: 0
});
const desktopLiveStatus = parseJson(run(['status', '--json'], {
  registry: desktopLiveRegistry,
  code: 0
}), 'desktop live status');
assert(desktopLiveStatus.tasks[0].external.executionVisibility === 'DESKTOP_LIVE' &&
  desktopLiveStatus.tasks[0].external.desktopLiveObserved === true &&
  desktopLiveStatus.slots.occupied === 1,
  '只有显式记录 Desktop-owned turn 实际观察后才能展示 DESKTOP_LIVE，且不改变写槽');
run([
  'verify-stop',
  '--task', 'desktop-live',
  '--actor', 'worker:desktop-live',
  '--next', 'worker:desktop-live',
  '--reason', 'Desktop-owned live turn ended; continue the same task through a background checkpoint.',
  '--evidence', 'The Desktop-owned turn emitted turn/completed and the owner stopped.',
  '--execution-visibility', 'BACKGROUND_ONLY',
  '--turn-state', 'completed',
  '--json'
], { registry: desktopLiveRegistry, code: 0 });
const desktopToBackgroundStatus = parseJson(run(['status', '--json'], {
  registry: desktopLiveRegistry,
  code: 0
}), 'desktop to background status');
assert(desktopToBackgroundStatus.tasks[0].external.executionVisibility === 'BACKGROUND_ONLY' &&
  desktopToBackgroundStatus.tasks[0].external.desktopLiveObserved === false &&
  desktopToBackgroundStatus.slots.occupied === 1,
  'DESKTOP_LIVE 降级为 BACKGROUND_ONLY 时必须清除 live 观察标记且保持同一 claim/槽');

const liveCompletedRegistry = registryPath('desktop-live-completed');
const liveCompleted = reserve('desktop-live-completed', '03', 'layout', liveCompletedRegistry);
const liveCompletedClaim = claimArgs('desktop-live-completed', 'layout', liveCompleted.token);
liveCompletedClaim[liveCompletedClaim.indexOf('BACKGROUND_ONLY')] = 'DESKTOP_LIVE';
liveCompletedClaim[liveCompletedClaim.indexOf('background')] = 'desktop';
liveCompletedClaim.splice(liveCompletedClaim.indexOf('--json'), 0,
  '--desktop-live-observed', 'yes');
run(liveCompletedClaim, { registry: liveCompletedRegistry, code: 0 });
run([
  'verify-stop',
  '--task', 'desktop-live-completed',
  '--actor', 'worker:desktop-live-completed',
  '--next', 'worker:desktop-live-completed',
  '--reason', 'Desktop-owned turn completed; visibility must fail closed automatically.',
  '--evidence', 'The Desktop-owned turn emitted turn/completed and the owner stopped.',
  '--turn-state', 'completed',
  '--json'
], { registry: liveCompletedRegistry, code: 0 });
const liveCompletedStatus = parseJson(run(['status', '--json'], {
  registry: liveCompletedRegistry,
  code: 0
}), 'completed Desktop live status');
assert(liveCompletedStatus.tasks[0].external.executionVisibility === 'UNKNOWN' &&
  liveCompletedStatus.tasks[0].external.desktopLiveObserved === false,
  'turn completed 后不得保留 DESKTOP_LIVE，缺失新证据必须自动降级 UNKNOWN');

const malformedLiveRegistry = registryPath('malformed-live-evidence');
const malformedLive = reserve('malformed-live-evidence', '03', 'layout', malformedLiveRegistry);
const malformedLiveRaw = JSON.parse(fs.readFileSync(malformedLiveRegistry, 'utf8'));
malformedLiveRaw.tasks[0].external.executionVisibility = 'DESKTOP_LIVE';
malformedLiveRaw.tasks[0].external.desktopLiveObserved = true;
malformedLiveRaw.tasks[0].external.turnState = 'completed';
malformedLiveRaw.tasks[0].external.turnOwner = 'desktop';
writeRegistry(malformedLiveRegistry, malformedLiveRaw);
run(['status'], {
  registry: malformedLiveRegistry,
  code: 1,
  stderrIncludes: 'DESKTOP_LIVE requires'
});

console.log('· reservation 原子转换且不重复占槽');
const conversionRegistry = registryPath('conversion-success');
const conversion = reserve('convert-task', '04', 'testing', conversionRegistry);
const claimed = parseJson(run(claimArgs('convert-task', 'testing', conversion.token), {
  registry: conversionRegistry,
  code: 0
}), 'claim conversion');
assert(claimed.registry.slots.occupied === 1 && claimed.registry.claims.length === 1 &&
  claimed.registry.reservations.length === 0, '转换必须用一个 claim 原子替换一个 reservation');
assert(claimed.claim.owner === '04' && claimed.claim.legacy === false,
  '转换后的 active claim 必须继承 owner 且不是 legacy');
run([
  'release',
  '--task', 'convert-task',
  '--actor', '00',
  '--outcome', 'cancelled',
  '--cancel-confirmed', 'yes',
  '--next', '00-archive',
  '--reason', 'A still-running turn must not release its slot.'
], {
  registry: conversionRegistry,
  code: 1,
  stderrIncludes: 'completed-turn stop verification'
});
run(claimArgs('convert-task', 'testing', conversion.token), {
  registry: conversionRegistry,
  code: 1,
  stderrIncludes: 'already converted'
});
run(['cancel-reservation', '--reservation', conversion.token], {
  registry: conversionRegistry,
  code: 1,
  stderrIncludes: 'only 00 may release'
});
const claimedRaw = JSON.parse(fs.readFileSync(conversionRegistry, 'utf8'));
claimedRaw.claims[0].updatedAt = '2000-01-01T00:00:00.000Z';
writeRegistry(conversionRegistry, claimedRaw);
const oldClaimStatus = parseJson(run(['status', '--json'], {
  registry: conversionRegistry,
  code: 0
}), 'old active claim status');
assert(oldClaimStatus.slots.occupied === 1 && oldClaimStatus.claims.length === 1,
  'active claim 无论更新时间多旧都不得自动过期');

console.log('· 权威生命周期覆盖等待、实现、复审、交接、集成、释放与归档');
const lifecycleRegistry = registryPath('lifecycle');
const integrationRoot = path.join(temporary, 'integration-git');
fs.mkdirSync(integrationRoot, { recursive: true });
execFileSync('git', ['init', '-b', 'central'], { cwd: integrationRoot, stdio: 'ignore' });
execFileSync('git', ['config', 'user.name', 'Coordination Test'], { cwd: integrationRoot });
execFileSync('git', ['config', 'user.email', 'coordination@example.invalid'], { cwd: integrationRoot });
fs.writeFileSync(path.join(integrationRoot, 'fixture.txt'), 'base\n');
execFileSync('git', ['add', 'fixture.txt'], { cwd: integrationRoot });
execFileSync('git', ['commit', '-m', 'base'], { cwd: integrationRoot, stdio: 'ignore' });
const integrationBase = execFileSync('git', ['rev-parse', 'HEAD'], {
  cwd: integrationRoot,
  encoding: 'utf8'
}).trim();
execFileSync('git', ['checkout', '-b', 'task/lifecycle'], {
  cwd: integrationRoot,
  stdio: 'ignore'
});
fs.appendFileSync(path.join(integrationRoot, 'fixture.txt'), 'reviewed change\n');
execFileSync('git', ['add', 'fixture.txt'], { cwd: integrationRoot });
execFileSync('git', ['commit', '-m', 'reviewed task change'], {
  cwd: integrationRoot,
  stdio: 'ignore'
});
const reviewedTaskCommit = execFileSync('git', ['rev-parse', 'HEAD'], {
  cwd: integrationRoot,
  encoding: 'utf8'
}).trim();
execFileSync('git', ['checkout', 'central'], { cwd: integrationRoot, stdio: 'ignore' });
fs.writeFileSync(path.join(integrationRoot, 'central.txt'), 'central integration preparation\n');
execFileSync('git', ['add', 'central.txt'], { cwd: integrationRoot });
execFileSync('git', ['commit', '-m', 'central preparation'], {
  cwd: integrationRoot,
  stdio: 'ignore'
});
execFileSync('git', ['cherry-pick', reviewedTaskCommit], {
  cwd: integrationRoot,
  stdio: 'ignore'
});
const integrationHead = execFileSync('git', ['rev-parse', 'HEAD'], {
  cwd: integrationRoot,
  encoding: 'utf8'
}).trim();
assert(reviewedTaskCommit !== integrationHead,
  '真实 cherry-pick fixture 必须产生不同 commit object');
const lifecycleEnv = { PREVISION_COORDINATION_GIT_ROOT: integrationRoot };
const lifecycleReserve = run([
  'reserve',
  '--task', 'lifecycle-task',
  '--title', 'lifecycle-task',
  '--owner', '04',
  '--request-key', 'request-lifecycle-task-04',
  '--source', integrationBase,
  '--modules', 'testing',
  '--files', 'lifecycle-task.md',
  '--json'
], {
  registry: lifecycleRegistry,
  code: 0,
  env: lifecycleEnv
});
const lifecycle = parseJson(lifecycleReserve, 'lifecycle reserve');
let lifecycleStatus = parseJson(run(['status', '--json'], {
  registry: lifecycleRegistry,
  code: 0,
  env: lifecycleEnv
}), 'lifecycle reserved');
assert(lifecycleStatus.tasks[0].state === 'RESERVED' &&
  lifecycleStatus.tasks[0].nextResponsible === '04-sidebar-create',
  'reserve 必须原子建立 RESERVED 权威状态、owner 和下一责任人');
run(transitionArgs(
  'lifecycle-task',
  'RESERVED',
  '04',
  '04-waiting-checkpoint',
  'The canonical background WAITING checkpoint started.',
  [
    '--reservation', lifecycle.token,
    '--thread-id', 'thread-lifecycle-task',
    '--client-id', 'client-lifecycle-task',
    '--rollout-state', 'present',
    '--thread-record-state', 'present',
    '--sidebar-state', 'present',
    '--name-state', 'set',
    '--turn-state', 'started',
    '--turn-owner', 'background',
    '--execution-visibility', 'BACKGROUND_ONLY'
  ]
), { registry: lifecycleRegistry, code: 0, env: lifecycleEnv });
run([
  'verify-stop',
  '--task', 'lifecycle-task',
  '--reservation', lifecycle.token,
  '--actor', '04',
  '--next', '04-start-signal',
  '--reason', 'WAITING checkpoint completed; Desktop live execution is not asserted.',
  '--evidence', 'The short WAITING turn emitted turn/completed and its background owner stopped.',
  '--turn-state', 'completed',
  '--execution-visibility', 'WAITING',
  '--json'
], { registry: lifecycleRegistry, code: 0, env: lifecycleEnv });
run(transitionArgs(
  'lifecycle-task',
  'WAITING',
  '04',
  '04-start-signal',
  'The verified WAITING checkpoint is now awaiting the same task start signal.',
  ['--reservation', lifecycle.token]
), { registry: lifecycleRegistry, code: 0, env: lifecycleEnv });
lifecycleStatus = parseJson(run(['status', '--json'], {
  registry: lifecycleRegistry,
  code: 0,
  env: lifecycleEnv
}), 'lifecycle waiting');
assert(lifecycleStatus.lifecycle.byState.WAITING === 1 &&
  lifecycleStatus.lifecycle.byExecutionVisibility.WAITING === 1 &&
  lifecycleStatus.tasks[0].external.executionVisibility === 'WAITING' &&
  lifecycleStatus.tasks[0].external.dedupKey ===
    'client-lifecycle-task/thread-lifecycle-task',
  'WAITING 必须显示真实 thread/client 去重键、后台连接完整性和 WAITING 可见性分类');
run([
  'claim',
  '--reservation', lifecycle.token,
  '--task', 'lifecycle-task',
  '--title', 'lifecycle-task',
  '--branch', 'task/lifecycle',
  '--source', integrationBase,
  '--modules', 'testing',
  '--files', 'lifecycle-task.md',
  '--actor', 'worker:lifecycle-task',
  '--next', 'worker:lifecycle-task',
  '--reason', 'The same canonical thread received its implementation start turn.',
  '--thread-id', 'thread-lifecycle-task',
  '--client-id', 'client-lifecycle-task',
  '--rollout-state', 'present',
  '--thread-record-state', 'present',
  '--sidebar-state', 'present',
  '--name-state', 'set',
  '--turn-state', 'started',
  '--turn-owner', 'background',
  '--execution-visibility', 'BACKGROUND_ONLY',
  '--json'
], { registry: lifecycleRegistry, code: 0, env: lifecycleEnv });
run(['archive', '--task', 'lifecycle-task', '--actor', '00', '--result', 'success',
  '--next', '00-done', '--reason', 'too early', '--sidebar-state', 'absent'], {
  registry: lifecycleRegistry,
  code: 1,
  stderrIncludes: 'release must complete first',
  env: lifecycleEnv
});
run(transitionArgs('lifecycle-task', 'ACTIVE', 'worker:lifecycle-task', '04-reconnect',
  'Client disconnected after turn/start; keep the same claim and thread.',
  ['--thread-id', 'thread-lifecycle-task', '--client-id', 'client-lifecycle-task', '--turn-state', 'disconnected']),
{ registry: lifecycleRegistry, code: 0, env: lifecycleEnv });
run([
  'reserve',
  '--task', 'lifecycle-task',
  '--title', 'lifecycle-task',
  '--owner', '04',
  '--request-key', 'replacement-lifecycle-task-04',
  '--source', integrationBase,
  '--modules', 'testing',
  '--files', 'lifecycle-task.md'
], {
  registry: lifecycleRegistry,
  code: 2,
  includes: 'duplicate-task',
  env: lifecycleEnv
});
run(transitionArgs('lifecycle-task', 'ACTIVE', '04-reconnect', 'worker:lifecycle-task',
  'Reconnected to the same thread and resumed notification consumption.',
  ['--thread-id', 'thread-lifecycle-task', '--client-id', 'client-lifecycle-task', '--turn-state', 'started']),
{ registry: lifecycleRegistry, code: 0, env: lifecycleEnv });
run(transitionArgs('lifecycle-task', 'REVIEW', 'worker:lifecycle-task', 'reviewer:lifecycle-task',
  'A running turn must not enter review.',
  ['--task-commit', reviewedTaskCommit]), {
  registry: lifecycleRegistry,
  code: 1,
  stderrIncludes: 'completed-turn stop verification',
  env: lifecycleEnv
});
run([
  'verify-stop',
  '--task', 'lifecycle-task',
  '--actor', 'worker:lifecycle-task',
  '--next', 'worker:lifecycle-task',
  '--reason', 'Background turn completed, but Desktop live in-progress state was not observed; keep the same task.',
  '--evidence', 'The background turn emitted turn/completed and its owner stopped.',
  '--turn-state', 'completed',
  '--execution-visibility', 'BACKGROUND_ONLY',
  '--json'
], { registry: lifecycleRegistry, code: 0, env: lifecycleEnv });
const backgroundOnlyStatus = parseJson(run(['status', '--json'], {
  registry: lifecycleRegistry,
  code: 0,
  env: lifecycleEnv
}), 'background-only completion status');
assert(backgroundOnlyStatus.tasks.length === 1 &&
  backgroundOnlyStatus.tasks[0].state === 'ACTIVE' &&
  backgroundOnlyStatus.tasks[0].external.executionVisibility === 'BACKGROUND_ONLY' &&
  backgroundOnlyStatus.claims.length === 1 &&
  backgroundOnlyStatus.slots.occupied === 1,
  '后台 turn 成功但 Desktop live 缺失时必须保留同一 thread/claim 并标记 BACKGROUND_ONLY');
const backgroundOnlyText = run(['status'], {
  registry: lifecycleRegistry,
  code: 0,
  env: lifecycleEnv
});
assert(backgroundOnlyText.stdout.includes('visibility=BACKGROUND_ONLY/后台施工'),
  '文本 status 必须把 BACKGROUND_ONLY 明确展示为后台施工');
execFileSync('git', ['checkout', 'task/lifecycle'], {
  cwd: integrationRoot,
  stdio: 'ignore'
});
run(transitionArgs('lifecycle-task', 'REVIEW', 'worker:lifecycle-task', 'reviewer:lifecycle-task',
  'Implementation and task-level tests completed; independent read-only review is next.',
  ['--task-commit', reviewedTaskCommit]),
{ registry: lifecycleRegistry, code: 0, env: lifecycleEnv });
lifecycleStatus = parseJson(run(['status', '--json'], {
  registry: lifecycleRegistry,
  code: 0,
  env: lifecycleEnv
}), 'lifecycle review');
assert(lifecycleStatus.lifecycle.reviewHandedOff === 1 &&
  lifecycleStatus.lifecycle.byExecutionVisibility.BACKGROUND_ONLY === 1 &&
  lifecycleStatus.tasks[0].external.executionVisibility === 'BACKGROUND_ONLY' &&
  lifecycleStatus.slots.occupied === 1 && lifecycleStatus.claims.length === 1,
  'BACKGROUND_ONLY 的 REVIEW/HANDED_OFF 阶段必须保留 active claim 并继续占写槽');
run(transitionArgs('lifecycle-task', 'ACTIVE', 'reviewer:lifecycle-task', 'worker:lifecycle-task',
  'Independent review requested rework; invalidate the prior review and stop evidence.'),
{ registry: lifecycleRegistry, code: 0, env: lifecycleEnv });
run(transitionArgs('lifecycle-task', 'REVIEW', 'worker:lifecycle-task', 'reviewer:lifecycle-task',
  'Rework cannot reuse the prior stop verification even when no new turn was explicitly started.',
  ['--task-commit', reviewedTaskCommit]), {
  registry: lifecycleRegistry,
  code: 1,
  stderrIncludes: 'completed-turn stop verification',
  env: lifecycleEnv
});
run([
  'verify-stop',
  '--task', 'lifecycle-task',
  '--actor', 'worker:lifecycle-task',
  '--next', 'worker:lifecycle-task',
  '--reason', 'The correction attempt independently reverified the stopped canonical turn.',
  '--evidence', 'A fresh stop verification was recorded for the current correction attempt.',
  '--turn-state', 'completed',
  '--execution-visibility', 'BACKGROUND_ONLY',
  '--json'
], { registry: lifecycleRegistry, code: 0, env: lifecycleEnv });
run(transitionArgs('lifecycle-task', 'REVIEW', 'worker:lifecycle-task', 'reviewer:lifecycle-task',
  'The correction attempt now has fresh stop evidence and the complete exact commit list.',
  ['--task-commit', reviewedTaskCommit]),
{ registry: lifecycleRegistry, code: 0, env: lifecycleEnv });
run(transitionArgs('lifecycle-task', 'INTEGRATING', '04', '00-integration',
  'illegal skip'), {
  registry: lifecycleRegistry,
  code: 1,
  stderrIncludes: 'Illegal lifecycle transition',
  env: lifecycleEnv
});
run(transitionArgs('lifecycle-task', 'HANDED_OFF', 'reviewer:lifecycle-task', '00-integration',
  'Independent read-only review passed and department acceptance handed off the commit.',
  ['--review-accepted', 'yes', '--task-commit', reviewedTaskCommit]),
{ registry: lifecycleRegistry, code: 0, env: lifecycleEnv });
execFileSync('git', ['checkout', 'central'], {
  cwd: integrationRoot,
  stdio: 'ignore'
});
run(transitionArgs('lifecycle-task', 'INTEGRATING', '04', '00-integration',
  'non-central integration'), {
  registry: lifecycleRegistry,
  code: 1,
  stderrIncludes: 'Only 00',
  env: lifecycleEnv
});
run(transitionArgs('lifecycle-task', 'INTEGRATING', '00', '00-final-regression',
  '00 started mechanical integration and final regression.'),
{ registry: lifecycleRegistry, code: 0, env: lifecycleEnv });
run(['release', '--task', 'lifecycle-task', '--actor', '00', '--outcome', 'integrated',
  '--task-commit', '0'.repeat(40), '--integration-commit', integrationHead,
  '--final-regression', 'passed',
  '--next', '00-archive', '--reason', 'A syntactically valid but nonexistent object must fail.'], {
  registry: lifecycleRegistry,
  code: 1,
  stderrIncludes: 'existing Git commit object',
  env: lifecycleEnv
});
run(['release', '--task', 'lifecycle-task', '--actor', '00', '--outcome', 'integrated',
  '--task-commit', integrationHead, '--integration-commit', integrationHead,
  '--final-regression', 'passed',
  '--next', '00-archive', '--reason', 'The integration commit cannot impersonate the reviewed task commit.'], {
  registry: lifecycleRegistry,
  code: 1,
  stderrIncludes: 'exactly match the accepted review evidence',
  env: lifecycleEnv
});
run(['release', '--task', 'lifecycle-task', '--actor', '00', '--outcome', 'integrated',
  '--task-commit', reviewedTaskCommit, '--integration-commit', integrationBase,
  '--final-regression', 'passed',
  '--next', '00-archive', '--reason', 'An older commit is not the current central integration HEAD.'], {
  registry: lifecycleRegistry,
  code: 1,
  stderrIncludes: 'current central integration HEAD',
  env: lifecycleEnv
});
run(['release', '--task', 'lifecycle-task', '--actor', '00', '--outcome', 'integrated',
  '--task-commit', reviewedTaskCommit, '--integration-commit', integrationHead, '--final-regression', 'failed',
  '--next', '00-archive', '--reason', 'Regression failed.'], {
  registry: lifecycleRegistry,
  code: 1,
  stderrIncludes: 'final-regression passed',
  env: lifecycleEnv
});
lifecycleStatus = parseJson(run(['status', '--json'], {
  registry: lifecycleRegistry,
  code: 0,
  env: lifecycleEnv
}), 'lifecycle failed release');
assert(lifecycleStatus.tasks[0].state === 'INTEGRATING' &&
  lifecycleStatus.slots.occupied === 1,
  'release 失败必须保留 INTEGRATING 状态和 active claim');
run(['release', '--task', 'lifecycle-task', '--actor', '00', '--outcome', 'integrated',
  '--task-commit', reviewedTaskCommit, '--integration-commit', integrationHead, '--final-regression', 'passed',
  '--next', '00-archive', '--reason', 'Mechanical integration and final regression passed.', '--json'], {
  registry: lifecycleRegistry,
  code: 0,
  env: lifecycleEnv
});
lifecycleStatus = parseJson(run(['status', '--json'], {
  registry: lifecycleRegistry,
  code: 0,
  env: lifecycleEnv
}), 'lifecycle released');
assert(lifecycleStatus.tasks[0].state === 'RELEASED' &&
  lifecycleStatus.slots.occupied === 0 && lifecycleStatus.claims.length === 0 &&
  lifecycleStatus.tasks[0].release.taskCommits[0] === reviewedTaskCommit &&
  lifecycleStatus.tasks[0].release.integrationMap[0].integrationCommit === integrationHead,
  '只有 00 带受审提交、真实 cherry-pick patch-id 映射和最终回归证据 release 后才释放写槽');
run(['archive', '--task', 'lifecycle-task', '--actor', '00', '--result', 'failed',
  '--next', '00-archive-retry', '--reason', 'Sidebar archive call failed.',
  '--sidebar-state', 'present', '--json'], {
  registry: lifecycleRegistry,
  code: 0,
  env: lifecycleEnv
});
lifecycleStatus = parseJson(run(['status', '--json'], {
  registry: lifecycleRegistry,
  code: 0,
  env: lifecycleEnv
}), 'lifecycle archive pending');
assert(lifecycleStatus.tasks[0].state === 'ARCHIVE_PENDING' &&
  lifecycleStatus.lifecycle.integrationArchivePending === 1,
  '归档失败必须保留 ARCHIVE_PENDING，可重试且不得重建任务');
run(['archive', '--task', 'lifecycle-task', '--actor', '00', '--result', 'success',
  '--next', 'none', '--reason', 'Sidebar archive retry succeeded and absence was verified.',
  '--sidebar-state', 'absent', '--json'], {
  registry: lifecycleRegistry,
  code: 0,
  env: lifecycleEnv
});
lifecycleStatus = parseJson(run(['status', '--json'], {
  registry: lifecycleRegistry,
  code: 0,
  env: lifecycleEnv
}), 'lifecycle archived');
assert(lifecycleStatus.tasks[0].state === 'ARCHIVED' &&
  lifecycleStatus.tasks[0].external.executionVisibility === 'BACKGROUND_ONLY' &&
  lifecycleStatus.lifecycle.archived === 1,
  '成功归档必须保留 ARCHIVED 权威记录、执行可见性和完整历史');
for (const [name, mutate, expected] of [
  ['sidebar-present', task => { task.external.sidebarState = 'present'; },
    'requires retained rollout/thread/name evidence'],
  ['rollout-missing', task => { task.external.rolloutState = 'missing'; },
    'requires retained rollout/thread/name evidence'],
  ['name-failed', task => { task.external.nameState = 'failed'; },
    'requires retained rollout/thread/name evidence']
]) {
  const malformedArchiveRegistry = registryPath(`archive-invariant-${name}`);
  const malformedArchive = JSON.parse(fs.readFileSync(lifecycleRegistry, 'utf8'));
  mutate(malformedArchive.tasks[0]);
  writeRegistry(malformedArchiveRegistry, malformedArchive);
  run(['status'], {
    registry: malformedArchiveRegistry,
    code: 1,
    stderrIncludes: expected,
    env: lifecycleEnv
  });
}
assert(lifecycleStatus.tasks[0].history.length >= 9 &&
  lifecycleStatus.tasks[0].history.every(entry =>
    entry.owner && entry.actor && entry.at && entry.nextResponsible && entry.reason),
  '每次 lifecycle 变化必须记录 owner、actor、时间、下一责任人和原因');
for (const [name, mutate, expected] of [
  ['broken-from', raw => {
    raw.tasks[0].history[2].from = 'ARCHIVED';
  }, 'history continuity is invalid'],
  ['illegal-transition', raw => {
    raw.tasks[0].history[1].to = 'ARCHIVED';
  }, 'history continuity is invalid'],
  ['tail-mismatch', raw => {
    raw.tasks[0].history.at(-1).reason = 'forged tail reason';
  }, 'history tail does not match'],
  ['release-history-mismatch', raw => {
    raw.tasks[0].release.releasedAt = '2099-01-01T00:00:00.000Z';
  }, 'does not match release evidence']
]) {
  const malformedHistoryRegistry = registryPath(`history-${name}`);
  const malformedHistory = JSON.parse(fs.readFileSync(lifecycleRegistry, 'utf8'));
  mutate(malformedHistory);
  writeRegistry(malformedHistoryRegistry, malformedHistory);
  run(['status'], {
    registry: malformedHistoryRegistry,
    code: 1,
    stderrIncludes: expected,
    env: lifecycleEnv
  });
}
const terminalMissingEvidenceRegistry = registryPath('terminal-missing-evidence');
const terminalMissingEvidence = JSON.parse(fs.readFileSync(lifecycleRegistry, 'utf8'));
delete terminalMissingEvidence.tasks[0].release;
writeRegistry(terminalMissingEvidenceRegistry, terminalMissingEvidence);
run(['status'], {
  registry: terminalMissingEvidenceRegistry,
  code: 1,
  stderrIncludes: 'does not match release evidence',
  env: lifecycleEnv
});
const terminalMalformedEvidenceRegistry = registryPath('terminal-malformed-evidence');
const terminalMalformedEvidence = JSON.parse(fs.readFileSync(lifecycleRegistry, 'utf8'));
terminalMalformedEvidence.tasks[0].release.finalRegression = 'claimed';
writeRegistry(terminalMalformedEvidenceRegistry, terminalMalformedEvidence);
run(['archive', '--task', 'lifecycle-task', '--actor', '00', '--result', 'success',
  '--next', 'none', '--reason', 'Malformed terminal evidence must not archive.',
  '--sidebar-state', 'absent'], {
  registry: terminalMalformedEvidenceRegistry,
  code: 1,
  stderrIncludes: 'Integrated release evidence',
  env: lifecycleEnv
});
const terminalNonexistentCommitRegistry = registryPath('terminal-nonexistent-commit');
const terminalNonexistentCommit = JSON.parse(fs.readFileSync(lifecycleRegistry, 'utf8'));
terminalNonexistentCommit.tasks[0].release.integrationCommit = '0'.repeat(40);
writeRegistry(terminalNonexistentCommitRegistry, terminalNonexistentCommit);
run(['status'], {
  registry: terminalNonexistentCommitRegistry,
  code: 1,
  stderrIncludes: 'existing Git commit object',
  env: lifecycleEnv
});
const terminalLiveRegistry = registryPath('terminal-live-visibility');
const terminalLive = JSON.parse(fs.readFileSync(lifecycleRegistry, 'utf8'));
terminalLive.tasks[0].external.executionVisibility = 'DESKTOP_LIVE';
terminalLive.tasks[0].external.desktopLiveObserved = true;
terminalLive.tasks[0].external.turnState = 'started';
terminalLive.tasks[0].external.turnOwner = 'desktop';
terminalLive.tasks[0].external.sidebarState = 'present';
writeRegistry(terminalLiveRegistry, terminalLive);
run(['status'], {
  registry: terminalLiveRegistry,
  code: 1,
  stderrIncludes: 'Stop verification no longer matches',
  env: lifecycleEnv
});
run([
  'reserve',
  '--task', 'lifecycle-task',
  '--title', 'lifecycle-task',
  '--owner', '04',
  '--request-key', 'post-archive-lifecycle-task',
  '--source', integrationBase,
  '--modules', 'testing',
  '--files', 'lifecycle-task.md'
], {
  registry: lifecycleRegistry,
  code: 2,
  includes: 'duplicate-task',
  env: lifecycleEnv
});

console.log('· REVIEW 完整有序提交集与中央一对一顺序映射 fail closed');
const orderedRoot = path.join(temporary, 'ordered-integration-git');
fs.mkdirSync(orderedRoot, { recursive: true });
execFileSync('git', ['init', '-b', 'central'], { cwd: orderedRoot, stdio: 'ignore' });
execFileSync('git', ['config', 'user.name', 'Coordination Test'], { cwd: orderedRoot });
execFileSync('git', ['config', 'user.email', 'coordination@example.invalid'], { cwd: orderedRoot });
fs.writeFileSync(path.join(orderedRoot, 'base.txt'), 'base\n');
execFileSync('git', ['add', '.'], { cwd: orderedRoot });
execFileSync('git', ['commit', '-m', 'base'], { cwd: orderedRoot, stdio: 'ignore' });
const orderedBase = execFileSync('git', ['rev-parse', 'HEAD'], {
  cwd: orderedRoot,
  encoding: 'utf8'
}).trim();
execFileSync('git', ['checkout', '-b', 'task/ordered'], { cwd: orderedRoot, stdio: 'ignore' });
fs.writeFileSync(path.join(orderedRoot, 'a.txt'), 'A\n');
execFileSync('git', ['add', 'a.txt'], { cwd: orderedRoot });
execFileSync('git', ['commit', '-m', 'task A'], { cwd: orderedRoot, stdio: 'ignore' });
const orderedA = execFileSync('git', ['rev-parse', 'HEAD'], {
  cwd: orderedRoot,
  encoding: 'utf8'
}).trim();
fs.writeFileSync(path.join(orderedRoot, 'b.txt'), 'B\n');
execFileSync('git', ['add', 'b.txt'], { cwd: orderedRoot });
execFileSync('git', ['commit', '-m', 'task B'], { cwd: orderedRoot, stdio: 'ignore' });
const orderedB = execFileSync('git', ['rev-parse', 'HEAD'], {
  cwd: orderedRoot,
  encoding: 'utf8'
}).trim();
execFileSync('git', ['checkout', 'central'], { cwd: orderedRoot, stdio: 'ignore' });
execFileSync('git', ['cherry-pick', orderedB], { cwd: orderedRoot, stdio: 'ignore' });
execFileSync('git', ['cherry-pick', orderedA], { cwd: orderedRoot, stdio: 'ignore' });
const wrongOrderHead = execFileSync('git', ['rev-parse', 'HEAD'], {
  cwd: orderedRoot,
  encoding: 'utf8'
}).trim();
const orderedRegistry = registryPath('ordered-review-release');
const orderedLifecycle = beginGitLifecycle({
  taskId: 'ordered-review-release',
  registry: orderedRegistry,
  gitDirectory: orderedRoot,
  source: orderedBase,
  branch: 'task/ordered',
  files: ['a.txt', 'b.txt']
});
run(transitionArgs('ordered-review-release', 'REVIEW', 'worker:ordered-review-release',
  'reviewer:ordered-review-release', 'A subset must not be accepted.',
  ['--task-commit', orderedB]), {
  registry: orderedRegistry,
  code: 1,
  stderrIncludes: 'complete ordered baseline..task HEAD',
  env: orderedLifecycle.env
});
run(transitionArgs('ordered-review-release', 'REVIEW', 'worker:ordered-review-release',
  'reviewer:ordered-review-release', 'A reordered list must not be accepted.',
  ['--task-commits', `${orderedB},${orderedA}`]), {
  registry: orderedRegistry,
  code: 1,
  stderrIncludes: 'ordered descendant chain',
  env: orderedLifecycle.env
});
run(transitionArgs('ordered-review-release', 'REVIEW', 'worker:ordered-review-release',
  'reviewer:ordered-review-release', 'Duplicate commit input must not be accepted.',
  ['--task-commits', `${orderedA},${orderedA},${orderedB}`]), {
  registry: orderedRegistry,
  code: 1,
  stderrIncludes: 'must not contain duplicate commits',
  env: orderedLifecycle.env
});
run(transitionArgs('ordered-review-release', 'REVIEW', 'worker:ordered-review-release',
  'reviewer:ordered-review-release', 'Freeze the complete ordered task commit list.',
  ['--task-commits', `${orderedA},${orderedB}`]), {
  registry: orderedRegistry,
  code: 0,
  env: orderedLifecycle.env
});
run(transitionArgs('ordered-review-release', 'HANDED_OFF', 'reviewer:ordered-review-release',
  '00-integration', 'Independent review accepted the exact complete list.',
  ['--review-accepted', 'yes', '--task-commits', `${orderedA},${orderedB}`]), {
  registry: orderedRegistry,
  code: 0,
  env: orderedLifecycle.env
});
execFileSync('git', ['checkout', 'central'], { cwd: orderedRoot, stdio: 'ignore' });
run(transitionArgs('ordered-review-release', 'INTEGRATING', '00', '00-final-regression',
  '00 began integration verification.'), {
  registry: orderedRegistry,
  code: 0,
  env: orderedLifecycle.env
});
run([
  'release',
  '--task', 'ordered-review-release',
  '--actor', '00',
  '--outcome', 'integrated',
  '--task-commits', `${orderedA},${orderedB}`,
  '--integration-commit', wrongOrderHead,
  '--final-regression', 'passed',
  '--next', '00-archive',
  '--reason', 'Central commits are present but reversed.'
], {
  registry: orderedRegistry,
  code: 1,
  stderrIncludes: 'missing, reordered, or reuses a commit',
  env: orderedLifecycle.env
});

const repeatedRoot = path.join(temporary, 'repeated-patch-git');
fs.mkdirSync(repeatedRoot, { recursive: true });
execFileSync('git', ['init', '-b', 'central'], { cwd: repeatedRoot, stdio: 'ignore' });
execFileSync('git', ['config', 'user.name', 'Coordination Test'], { cwd: repeatedRoot });
execFileSync('git', ['config', 'user.email', 'coordination@example.invalid'], { cwd: repeatedRoot });
fs.writeFileSync(path.join(repeatedRoot, 'repeat.txt'), 'base\n');
execFileSync('git', ['add', '.'], { cwd: repeatedRoot });
execFileSync('git', ['commit', '-m', 'base'], { cwd: repeatedRoot, stdio: 'ignore' });
const repeatedBase = execFileSync('git', ['rev-parse', 'HEAD'], {
  cwd: repeatedRoot,
  encoding: 'utf8'
}).trim();
execFileSync('git', ['checkout', '-b', 'task/repeated'], { cwd: repeatedRoot, stdio: 'ignore' });
fs.appendFileSync(path.join(repeatedRoot, 'repeat.txt'), 'added\n');
execFileSync('git', ['add', 'repeat.txt'], { cwd: repeatedRoot });
execFileSync('git', ['commit', '-m', 'add'], { cwd: repeatedRoot, stdio: 'ignore' });
const repeatedAdd = execFileSync('git', ['rev-parse', 'HEAD'], {
  cwd: repeatedRoot,
  encoding: 'utf8'
}).trim();
execFileSync('git', ['revert', '--no-edit', repeatedAdd], { cwd: repeatedRoot, stdio: 'ignore' });
const repeatedRevert = execFileSync('git', ['rev-parse', 'HEAD'], {
  cwd: repeatedRoot,
  encoding: 'utf8'
}).trim();
execFileSync('git', ['cherry-pick', repeatedAdd], { cwd: repeatedRoot, stdio: 'ignore' });
const repeatedAddAgain = execFileSync('git', ['rev-parse', 'HEAD'], {
  cwd: repeatedRoot,
  encoding: 'utf8'
}).trim();
execFileSync('git', ['checkout', 'central'], { cwd: repeatedRoot, stdio: 'ignore' });
execFileSync('git', ['cherry-pick', repeatedAdd], { cwd: repeatedRoot, stdio: 'ignore' });
execFileSync('git', ['cherry-pick', repeatedRevert], { cwd: repeatedRoot, stdio: 'ignore' });
const incompleteRepeatedHead = execFileSync('git', ['rev-parse', 'HEAD'], {
  cwd: repeatedRoot,
  encoding: 'utf8'
}).trim();
const repeatedRegistry = registryPath('repeated-patch-release');
const repeatedLifecycle = beginGitLifecycle({
  taskId: 'repeated-patch-release',
  registry: repeatedRegistry,
  gitDirectory: repeatedRoot,
  source: repeatedBase,
  branch: 'task/repeated',
  files: ['repeat.txt']
});
const repeatedList = `${repeatedAdd},${repeatedRevert},${repeatedAddAgain}`;
run(transitionArgs('repeated-patch-release', 'REVIEW', 'worker:repeated-patch-release',
  'reviewer:repeated-patch-release', 'Freeze add-revert-add as a complete ordered sequence.',
  ['--task-commits', repeatedList]), {
  registry: repeatedRegistry,
  code: 0,
  env: repeatedLifecycle.env
});
run(transitionArgs('repeated-patch-release', 'HANDED_OFF', 'reviewer:repeated-patch-release',
  '00-integration', 'Independent review accepted the complete repeated-patch sequence.',
  ['--review-accepted', 'yes', '--task-commits', repeatedList]), {
  registry: repeatedRegistry,
  code: 0,
  env: repeatedLifecycle.env
});
execFileSync('git', ['checkout', 'central'], { cwd: repeatedRoot, stdio: 'ignore' });
run(transitionArgs('repeated-patch-release', 'INTEGRATING', '00', '00-final-regression',
  '00 began repeated-patch integration verification.'), {
  registry: repeatedRegistry,
  code: 0,
  env: repeatedLifecycle.env
});
run([
  'release',
  '--task', 'repeated-patch-release',
  '--actor', '00',
  '--outcome', 'integrated',
  '--task-commits', repeatedList,
  '--integration-commit', incompleteRepeatedHead,
  '--final-regression', 'passed',
  '--next', '00-archive',
  '--reason', 'Central integration omitted the final repeated add.'
], {
  registry: repeatedRegistry,
  code: 1,
  stderrIncludes: 'must contain exactly 2 distinct ordered stable patch-id matches',
  env: repeatedLifecycle.env
});
currentOraclePasses.push('complete-ordered-review-and-one-to-one-integration');

console.log('· 最终树校验用 NUL 路径和完整 tree entry 覆盖中文路径与 rename source');
const netDiffRoot = path.join(temporary, 'tree-entry-net-diff-git');
fs.mkdirSync(path.join(netDiffRoot, '文档'), { recursive: true });
execFileSync('git', ['init', '-b', 'base'], { cwd: netDiffRoot, stdio: 'ignore' });
execFileSync('git', ['config', 'user.name', 'Coordination Test'], { cwd: netDiffRoot });
execFileSync('git', ['config', 'user.email', 'coordination@example.invalid'], { cwd: netDiffRoot });
fs.writeFileSync(path.join(netDiffRoot, '文档', '说明.md'), '基线\n');
fs.writeFileSync(path.join(netDiffRoot, 'rename-source.txt'), 'rename source\n');
execFileSync('git', ['add', '.'], { cwd: netDiffRoot });
execFileSync('git', ['commit', '-m', 'net diff base'], { cwd: netDiffRoot, stdio: 'ignore' });
const netDiffBase = execFileSync('git', ['rev-parse', 'HEAD'], {
  cwd: netDiffRoot,
  encoding: 'utf8'
}).trim();
execFileSync('git', ['checkout', '-b', 'task/net-diff'], { cwd: netDiffRoot, stdio: 'ignore' });
fs.writeFileSync(path.join(netDiffRoot, '文档', '说明.md'), '任务最终内容\n');
execFileSync('git', ['mv', 'rename-source.txt', 'rename-destination.txt'], {
  cwd: netDiffRoot,
  stdio: 'ignore'
});
execFileSync('git', ['add', '-A'], { cwd: netDiffRoot });
execFileSync('git', ['commit', '-m', 'task unicode and rename'], {
  cwd: netDiffRoot,
  stdio: 'ignore'
});
const netDiffTaskCommit = execFileSync('git', ['rev-parse', 'HEAD'], {
  cwd: netDiffRoot,
  encoding: 'utf8'
}).trim();
const netDiffFiles = ['文档/说明.md', 'rename-source.txt', 'rename-destination.txt'];

function rejectTamperedNetDiff(taskId, centralBranch, tamper) {
  execFileSync('git', ['checkout', '-b', centralBranch, netDiffBase], {
    cwd: netDiffRoot,
    stdio: 'ignore'
  });
  fs.writeFileSync(path.join(netDiffRoot, `${taskId}-central-prelude.txt`), 'central prelude\n');
  execFileSync('git', ['add', '.'], { cwd: netDiffRoot });
  execFileSync('git', ['commit', '-m', `${taskId} central prelude`], {
    cwd: netDiffRoot,
    stdio: 'ignore'
  });
  execFileSync('git', ['cherry-pick', netDiffTaskCommit], { cwd: netDiffRoot, stdio: 'ignore' });
  tamper();
  execFileSync('git', ['add', '-A'], { cwd: netDiffRoot });
  execFileSync('git', ['commit', '-m', `${taskId} central tamper`], {
    cwd: netDiffRoot,
    stdio: 'ignore'
  });
  const integrationHead = execFileSync('git', ['rev-parse', 'HEAD'], {
    cwd: netDiffRoot,
    encoding: 'utf8'
  }).trim();
  const registry = registryPath(taskId);
  const lifecycle = beginGitLifecycle({
    taskId,
    registry,
    gitDirectory: netDiffRoot,
    source: netDiffBase,
    branch: 'task/net-diff',
    files: netDiffFiles
  });
  run(transitionArgs(taskId, 'REVIEW', `worker:${taskId}`, `reviewer:${taskId}`,
    'Freeze the exact Unicode and rename task commit.',
    ['--task-commit', netDiffTaskCommit]), {
    registry,
    code: 0,
    env: lifecycle.env
  });
  run(transitionArgs(taskId, 'HANDED_OFF', `reviewer:${taskId}`, '00-integration',
    'Accept the exact task commit for integration.',
    ['--review-accepted', 'yes', '--task-commit', netDiffTaskCommit]), {
    registry,
    code: 0,
    env: lifecycle.env
  });
  execFileSync('git', ['checkout', centralBranch], { cwd: netDiffRoot, stdio: 'ignore' });
  run(transitionArgs(taskId, 'INTEGRATING', '00', '00-final-regression',
    'Verify central tree entries for every task path.'), {
    registry,
    code: 0,
    env: lifecycle.env
  });
  const releaseArgs = [
    'release',
    '--task', taskId,
    '--actor', '00',
    '--outcome', 'integrated',
    '--task-commit', netDiffTaskCommit,
    '--integration-commit', integrationHead,
    '--final-regression', 'passed',
    '--next', '00-archive',
    '--reason', 'Tampered central tree entries must fail before release.'
  ];
  const rejectedRegistry = `${registry}.rejected-r4`;
  fs.copyFileSync(registry, rejectedRegistry);
  fs.chmodSync(rejectedRegistry, 0o600);
  const rejectedResult = runRejectedR4(releaseArgs, rejectedRegistry, netDiffRoot);
  assert(rejectedResult.status === 0,
    `${rejectedR4Commit.slice(0, 7)} 必须复现 ${taskId} 最终净差异漏检，actual=${rejectedResult.stderr.trim()}`);
  rejectedR4OracleFailures.push(taskId);
  run(releaseArgs, {
    registry,
    code: 1,
    stderrIncludes: 'final tree/net diff is not equivalent',
    env: lifecycle.env
  });
}

rejectTamperedNetDiff('unicode-net-diff', 'central/unicode-net-diff', () => {
  fs.writeFileSync(path.join(netDiffRoot, '文档', '说明.md'), '中央错误内容\n');
});
currentOraclePasses.push('unicode-path-tree-entry-net-diff');
rejectTamperedNetDiff('rename-source-net-diff', 'central/rename-source-net-diff', () => {
  fs.writeFileSync(path.join(netDiffRoot, 'rename-source.txt'), 'illegally restored source\n');
});
currentOraclePasses.push('rename-source-tree-entry-net-diff');

console.log('· Git replace refs 不得伪造 patch 映射或最终 tree 证据');
const replaceRoot = path.join(temporary, 'replace-ref-release-git');
fs.mkdirSync(replaceRoot, { recursive: true });
execFileSync('git', ['init', '-b', 'central'], { cwd: replaceRoot, stdio: 'ignore' });
execFileSync('git', ['config', 'user.name', 'Coordination Test'], { cwd: replaceRoot });
execFileSync('git', ['config', 'user.email', 'coordination@example.invalid'], { cwd: replaceRoot });
fs.writeFileSync(path.join(replaceRoot, 'replace.txt'), 'base\n');
execFileSync('git', ['add', '.'], { cwd: replaceRoot });
execFileSync('git', ['commit', '-m', 'replace base'], { cwd: replaceRoot, stdio: 'ignore' });
const replaceBase = execFileSync('git', ['rev-parse', 'HEAD'], {
  cwd: replaceRoot,
  encoding: 'utf8'
}).trim();
execFileSync('git', ['checkout', '-b', 'task/replace'], { cwd: replaceRoot, stdio: 'ignore' });
fs.writeFileSync(path.join(replaceRoot, 'replace.txt'), 'task result\n');
execFileSync('git', ['add', 'replace.txt'], { cwd: replaceRoot });
execFileSync('git', ['commit', '-m', 'task result'], { cwd: replaceRoot, stdio: 'ignore' });
const replaceTaskCommit = execFileSync('git', ['rev-parse', 'HEAD'], {
  cwd: replaceRoot,
  encoding: 'utf8'
}).trim();
execFileSync('git', ['checkout', 'central'], { cwd: replaceRoot, stdio: 'ignore' });
fs.writeFileSync(path.join(replaceRoot, 'central.txt'), 'central prelude\n');
execFileSync('git', ['add', 'central.txt'], { cwd: replaceRoot });
execFileSync('git', ['commit', '-m', 'central prelude'], { cwd: replaceRoot, stdio: 'ignore' });
execFileSync('git', ['cherry-pick', replaceTaskCommit], { cwd: replaceRoot, stdio: 'ignore' });
fs.writeFileSync(path.join(replaceRoot, 'replace.txt'), 'tampered after integration\n');
execFileSync('git', ['add', 'replace.txt'], { cwd: replaceRoot });
execFileSync('git', ['commit', '-m', 'tamper central result'], {
  cwd: replaceRoot,
  stdio: 'ignore'
});
const replaceCentralHead = execFileSync('git', ['rev-parse', 'HEAD'], {
  cwd: replaceRoot,
  encoding: 'utf8'
}).trim();
const replaceRegistry = registryPath('replace-ref-release');
const replaceLifecycle = beginGitLifecycle({
  taskId: 'replace-ref-release',
  registry: replaceRegistry,
  gitDirectory: replaceRoot,
  source: replaceBase,
  branch: 'task/replace',
  files: ['replace.txt']
});
run(transitionArgs('replace-ref-release', 'REVIEW', 'worker:replace-ref-release',
  'reviewer:replace-ref-release', 'Freeze the real task object before replace-ref testing.',
  ['--task-commit', replaceTaskCommit]), {
  registry: replaceRegistry,
  code: 0,
  env: replaceLifecycle.env
});
run(transitionArgs('replace-ref-release', 'HANDED_OFF', 'reviewer:replace-ref-release',
  '00-integration', 'Accept the real task object before replace-ref testing.',
  ['--review-accepted', 'yes', '--task-commit', replaceTaskCommit]), {
  registry: replaceRegistry,
  code: 0,
  env: replaceLifecycle.env
});
execFileSync('git', ['checkout', 'central'], { cwd: replaceRoot, stdio: 'ignore' });
run(transitionArgs('replace-ref-release', 'INTEGRATING', '00', '00-final-regression',
  'Evaluate the actual central objects without replacement refs.'), {
  registry: replaceRegistry,
  code: 0,
  env: replaceLifecycle.env
});
execFileSync('git', ['replace', replaceCentralHead, replaceTaskCommit], {
  cwd: replaceRoot,
  stdio: 'ignore'
});
const replaceReleaseArgs = [
  'release',
  '--task', 'replace-ref-release',
  '--actor', '00',
  '--outcome', 'integrated',
  '--task-commit', replaceTaskCommit,
  '--integration-commit', replaceCentralHead,
  '--final-regression', 'passed',
  '--next', '00-archive',
  '--reason', 'A replace ref must not hide the tampered central tree.'
];
const rejectedReplaceRegistry = `${replaceRegistry}.rejected-r5`;
fs.copyFileSync(replaceRegistry, rejectedReplaceRegistry);
fs.chmodSync(rejectedReplaceRegistry, 0o600);
const rejectedReplace = runRejectedR5(
  replaceReleaseArgs,
  rejectedReplaceRegistry,
  replaceRoot
);
assert(rejectedReplace.status === 0,
  `${rejectedR5Commit.slice(0, 7)} 必须复现 replace ref 伪造后 release 成功，actual=${rejectedReplace.stderr.trim()}`);
rejectedR5OracleFailures.push('git-replace-authoritative-evidence');
const replaceRegistryBytes = fs.readFileSync(replaceRegistry);
run(replaceReleaseArgs, {
  registry: replaceRegistry,
  code: 1,
  stderrIncludes: 'final tree/net diff is not equivalent',
  env: replaceLifecycle.env
});
assert(replaceRegistryBytes.equals(fs.readFileSync(replaceRegistry)),
  'replace-ref 拒绝必须保持 INTEGRATING 登记字节不变');
execFileSync('git', ['replace', '-d', replaceCentralHead], {
  cwd: replaceRoot,
  stdio: 'ignore'
});
const replaceStatus = parseJson(run(['status', '--json'], {
  registry: replaceRegistry,
  code: 0,
  env: replaceLifecycle.env
}), 'replace-ref rejected release status');
assert(replaceStatus.tasks[0].state === 'INTEGRATING' &&
  replaceStatus.claims.length === 1 && replaceStatus.claims[0].mode === 'write' &&
  replaceStatus.slots.occupied === 1,
  'replace-ref 拒绝后必须保持 INTEGRATING、claim 与 occupied slot');
currentOraclePasses.push('git-replace-disabled-for-authoritative-evidence');

console.log('· reviewer PASS 后仅允许严格三文件机械 closeout');
const closeoutRoot = path.join(temporary, 'mechanical-closeout-git');
fs.mkdirSync(path.join(closeoutRoot, 'docs', 'plans', 'active'), { recursive: true });
fs.mkdirSync(path.join(closeoutRoot, 'docs', 'plans', 'completed'), { recursive: true });
execFileSync('git', ['init', '-b', 'central'], { cwd: closeoutRoot, stdio: 'ignore' });
execFileSync('git', ['config', 'user.name', 'Coordination Test'], { cwd: closeoutRoot });
execFileSync('git', ['config', 'user.email', 'coordination@example.invalid'], { cwd: closeoutRoot });
const closeoutName = '2026-07-17-closeout-fixture.md';
const closeoutActive = `docs/plans/active/${closeoutName}`;
const closeoutCompleted = `docs/plans/completed/${closeoutName}`;
const closeoutSiblingName = '2026-07-17-closeout-sibling.md';
const closeoutSiblingActive = `docs/plans/active/${closeoutSiblingName}`;
const closeoutSiblingCompleted = `docs/plans/completed/${closeoutSiblingName}`;
fs.writeFileSync(path.join(closeoutRoot, closeoutActive), '# Fixture\n\n- 状态：active\n');
fs.writeFileSync(path.join(closeoutRoot, closeoutSiblingActive), '# Sibling\n\n- 状态：active\n');
fs.writeFileSync(path.join(closeoutRoot, 'docs', 'plans', 'completed', 'README.md'), '# Completed\n');
fs.writeFileSync(path.join(closeoutRoot, 'implementation.txt'), 'base\n');
execFileSync('git', ['add', '.'], { cwd: closeoutRoot });
execFileSync('git', ['commit', '-m', 'base'], { cwd: closeoutRoot, stdio: 'ignore' });
const closeoutBase = execFileSync('git', ['rev-parse', 'HEAD'], {
  cwd: closeoutRoot,
  encoding: 'utf8'
}).trim();
execFileSync('git', ['checkout', '-b', 'task/closeout'], { cwd: closeoutRoot, stdio: 'ignore' });
fs.appendFileSync(path.join(closeoutRoot, 'implementation.txt'), 'reviewed implementation\n');
execFileSync('git', ['add', 'implementation.txt'], { cwd: closeoutRoot });
execFileSync('git', ['commit', '-m', 'reviewed implementation'], {
  cwd: closeoutRoot,
  stdio: 'ignore'
});
const closeoutReviewed = execFileSync('git', ['rev-parse', 'HEAD'], {
  cwd: closeoutRoot,
  encoding: 'utf8'
}).trim();
const closeoutRegistry = registryPath('mechanical-closeout');
const closeoutLifecycle = beginGitLifecycle({
  taskId: 'mechanical-closeout',
  registry: closeoutRegistry,
  gitDirectory: closeoutRoot,
  source: closeoutBase,
  branch: 'task/closeout',
  files: [
    'implementation.txt',
    closeoutActive,
    closeoutCompleted,
    'docs/plans/completed/README.md'
  ]
});
run(transitionArgs('mechanical-closeout', 'REVIEW', 'worker:mechanical-closeout',
  'reviewer:mechanical-closeout', 'Freeze the reviewed implementation before closeout.',
  ['--task-commit', closeoutReviewed]), {
  registry: closeoutRegistry,
  code: 0,
  env: closeoutLifecycle.env
});
execFileSync('git', ['checkout', '-b', 'mixed-closeout'], {
  cwd: closeoutRoot,
  stdio: 'ignore'
});
fs.renameSync(path.join(closeoutRoot, closeoutActive), path.join(closeoutRoot, closeoutCompleted));
fs.writeFileSync(path.join(closeoutRoot, closeoutCompleted), '# Fixture\n\n- 状态：completed\n');
fs.appendFileSync(
  path.join(closeoutRoot, 'docs', 'plans', 'completed', 'README.md'),
  `- [Closeout fixture](${closeoutName})\n`
);
fs.appendFileSync(path.join(closeoutRoot, 'implementation.txt'), 'unreviewed business change\n');
execFileSync('git', ['add', '-A'], { cwd: closeoutRoot });
execFileSync('git', ['commit', '-m', 'mixed closeout'], { cwd: closeoutRoot, stdio: 'ignore' });
const mixedCloseout = execFileSync('git', ['rev-parse', 'HEAD'], {
  cwd: closeoutRoot,
  encoding: 'utf8'
}).trim();
run(transitionArgs('mechanical-closeout', 'HANDED_OFF', 'reviewer:mechanical-closeout',
  '00-integration', 'A closeout mixed with implementation changes must fail.',
  ['--review-accepted', 'yes', '--task-commit', closeoutReviewed,
    '--closeout-commit', mixedCloseout]), {
  registry: closeoutRegistry,
  code: 1,
  stderrIncludes: 'may only move the canonical acceptance',
  env: closeoutLifecycle.env
});
execFileSync('git', ['checkout', 'task/closeout'], { cwd: closeoutRoot, stdio: 'ignore' });
execFileSync('git', ['checkout', '-b', 'rewritten-acceptance-closeout'], {
  cwd: closeoutRoot,
  stdio: 'ignore'
});
fs.renameSync(path.join(closeoutRoot, closeoutActive), path.join(closeoutRoot, closeoutCompleted));
fs.writeFileSync(
  path.join(closeoutRoot, closeoutCompleted),
  '# Fixture\n\n- 状态：completed\n\nUnreviewed acceptance rewrite.\n'
);
fs.appendFileSync(
  path.join(closeoutRoot, 'docs', 'plans', 'completed', 'README.md'),
  `- [Closeout fixture](${closeoutName})\n`
);
execFileSync('git', ['add', '-A'], { cwd: closeoutRoot });
execFileSync('git', ['commit', '-m', 'rewrite acceptance during closeout'], {
  cwd: closeoutRoot,
  stdio: 'ignore'
});
const rewrittenAcceptanceCloseout = execFileSync('git', ['rev-parse', 'HEAD'], {
  cwd: closeoutRoot,
  encoding: 'utf8'
}).trim();
const rewrittenAcceptanceArgs = transitionArgs('mechanical-closeout', 'HANDED_OFF', 'reviewer:mechanical-closeout',
  '00-integration', 'A closeout must not rewrite the reviewed acceptance content.',
  ['--review-accepted', 'yes', '--task-commit', closeoutReviewed,
    '--closeout-commit', rewrittenAcceptanceCloseout]);
const rejectedAcceptanceRegistry = `${closeoutRegistry}.rejected-acceptance`;
fs.copyFileSync(closeoutRegistry, rejectedAcceptanceRegistry);
fs.chmodSync(rejectedAcceptanceRegistry, 0o600);
const rejectedAcceptanceResult = runRejectedR4(
  rewrittenAcceptanceArgs,
  rejectedAcceptanceRegistry,
  closeoutRoot
);
assert(rejectedAcceptanceResult.status === 0,
  `${rejectedR4Commit.slice(0, 7)} 必须复现 reviewer 后验收单内容可重写`);
rejectedR4OracleFailures.push('closeout-acceptance-rewrite');
run(rewrittenAcceptanceArgs, {
  registry: closeoutRegistry,
  code: 1,
  stderrIncludes: 'must equal reviewed active content',
  env: closeoutLifecycle.env
});
execFileSync('git', ['checkout', 'task/closeout'], { cwd: closeoutRoot, stdio: 'ignore' });
execFileSync('git', ['checkout', '-b', 'rewritten-index-closeout'], {
  cwd: closeoutRoot,
  stdio: 'ignore'
});
fs.renameSync(path.join(closeoutRoot, closeoutActive), path.join(closeoutRoot, closeoutCompleted));
fs.writeFileSync(path.join(closeoutRoot, closeoutCompleted), '# Fixture\n\n- 状态：completed\n');
fs.writeFileSync(
  path.join(closeoutRoot, 'docs', 'plans', 'completed', 'README.md'),
  `# Rewritten Completed\n- [Closeout fixture](${closeoutName})\n`
);
execFileSync('git', ['add', '-A'], { cwd: closeoutRoot });
execFileSync('git', ['commit', '-m', 'rewrite completed index during closeout'], {
  cwd: closeoutRoot,
  stdio: 'ignore'
});
const rewrittenIndexCloseout = execFileSync('git', ['rev-parse', 'HEAD'], {
  cwd: closeoutRoot,
  encoding: 'utf8'
}).trim();
const rewrittenIndexArgs = transitionArgs('mechanical-closeout', 'HANDED_OFF', 'reviewer:mechanical-closeout',
  '00-integration', 'A closeout must preserve the existing completed index bytes.',
  ['--review-accepted', 'yes', '--task-commit', closeoutReviewed,
    '--closeout-commit', rewrittenIndexCloseout]);
const rejectedIndexRegistry = `${closeoutRegistry}.rejected-index`;
fs.copyFileSync(closeoutRegistry, rejectedIndexRegistry);
fs.chmodSync(rejectedIndexRegistry, 0o600);
const rejectedIndexResult = runRejectedR4(rewrittenIndexArgs, rejectedIndexRegistry, closeoutRoot);
assert(rejectedIndexResult.status === 0,
  `${rejectedR4Commit.slice(0, 7)} 必须复现 reviewer 后 completed 索引可重写`);
rejectedR4OracleFailures.push('closeout-index-rewrite');
run(rewrittenIndexArgs, {
  registry: closeoutRegistry,
  code: 1,
  stderrIncludes: 'may only append one canonical link',
  env: closeoutLifecycle.env
});

function rejectCloseoutModeChange(branch, oracle, mutate) {
  execFileSync('git', ['checkout', 'task/closeout'], { cwd: closeoutRoot, stdio: 'ignore' });
  execFileSync('git', ['checkout', '-b', branch], { cwd: closeoutRoot, stdio: 'ignore' });
  const completedPath = path.join(closeoutRoot, closeoutCompleted);
  const indexPath = path.join(closeoutRoot, 'docs', 'plans', 'completed', 'README.md');
  fs.renameSync(path.join(closeoutRoot, closeoutActive), completedPath);
  fs.writeFileSync(completedPath, '# Fixture\n\n- 状态：completed\n');
  fs.appendFileSync(indexPath, `- [Closeout fixture](${closeoutName})\n`);
  mutate({ completedPath, indexPath });
  execFileSync('git', ['add', '-A'], { cwd: closeoutRoot });
  execFileSync('git', ['commit', '-m', `${oracle} closeout`], {
    cwd: closeoutRoot,
    stdio: 'ignore'
  });
  const commit = execFileSync('git', ['rev-parse', 'HEAD'], {
    cwd: closeoutRoot,
    encoding: 'utf8'
  }).trim();
  const transition = transitionArgs(
    'mechanical-closeout',
    'HANDED_OFF',
    'reviewer:mechanical-closeout',
    '00-integration',
    'Executable or non-regular Markdown closeout entries must fail closed.',
    ['--review-accepted', 'yes', '--task-commit', closeoutReviewed, '--closeout-commit', commit]
  );
  const rejectedRegistry = `${closeoutRegistry}.${oracle}.rejected-r5`;
  fs.copyFileSync(closeoutRegistry, rejectedRegistry);
  fs.chmodSync(rejectedRegistry, 0o600);
  const rejected = runRejectedR5(transition, rejectedRegistry, closeoutRoot);
  assert(rejected.status === 0,
    `${rejectedR5Commit.slice(0, 7)} 必须复现 ${oracle} 仍可 HANDED_OFF`);
  rejectedR5OracleFailures.push(oracle);
  run(transition, {
    registry: closeoutRegistry,
    code: 1,
    stderrIncludes: 'regular 100644 Markdown blobs',
    env: closeoutLifecycle.env
  });
}

rejectCloseoutModeChange('executable-plan-closeout', 'closeout-plan-mode', ({ completedPath }) => {
  fs.chmodSync(completedPath, 0o755);
});
rejectCloseoutModeChange('executable-index-closeout', 'closeout-index-mode-type', ({ indexPath }) => {
  fs.chmodSync(indexPath, 0o755);
});
execFileSync('git', ['checkout', 'task/closeout'], { cwd: closeoutRoot, stdio: 'ignore' });
fs.renameSync(path.join(closeoutRoot, closeoutActive), path.join(closeoutRoot, closeoutCompleted));
fs.writeFileSync(path.join(closeoutRoot, closeoutCompleted), '# Fixture\n\n- 状态：completed\n');
fs.appendFileSync(
  path.join(closeoutRoot, 'docs', 'plans', 'completed', 'README.md'),
  `- [Closeout fixture](${closeoutName})\n`
);
execFileSync('git', ['add', '-A'], { cwd: closeoutRoot });
execFileSync('git', ['commit', '-m', 'mechanical acceptance closeout'], {
  cwd: closeoutRoot,
  stdio: 'ignore'
});
const cleanCloseout = execFileSync('git', ['rev-parse', 'HEAD'], {
  cwd: closeoutRoot,
  encoding: 'utf8'
}).trim();
run(transitionArgs('mechanical-closeout', 'HANDED_OFF', 'reviewer:mechanical-closeout',
  '00-integration', 'Accept the reviewed implementation plus strict mechanical closeout.',
  ['--review-accepted', 'yes', '--task-commit', closeoutReviewed,
    '--closeout-commit', cleanCloseout]), {
  registry: closeoutRegistry,
  code: 0,
  env: closeoutLifecycle.env
});
const closeoutStatus = parseJson(run(['status', '--json'], {
  registry: closeoutRegistry,
  code: 0,
  env: closeoutLifecycle.env
}), 'mechanical closeout status');
assert(closeoutStatus.tasks[0].reviewEvidence.closeout.commit === cleanCloseout &&
  closeoutStatus.tasks[0].reviewEvidence.closeout.files.length === 3,
  '纯机械 closeout 必须作为独立证据绑定 reviewed HEAD，进入 handoff/release 证据而非未受审任意提交');

execFileSync('git', ['checkout', '-b', 'task/sibling-closeout', closeoutReviewed], {
  cwd: closeoutRoot,
  stdio: 'ignore'
});
execFileSync('git', ['checkout', '-b', 'sibling-acceptance-closeout'], {
  cwd: closeoutRoot,
  stdio: 'ignore'
});
fs.renameSync(
  path.join(closeoutRoot, closeoutSiblingActive),
  path.join(closeoutRoot, closeoutSiblingCompleted)
);
fs.writeFileSync(
  path.join(closeoutRoot, closeoutSiblingCompleted),
  '# Sibling\n\n- 状态：completed\n'
);
fs.appendFileSync(
  path.join(closeoutRoot, 'docs', 'plans', 'completed', 'README.md'),
  `- [Closeout sibling](${closeoutSiblingName})\n`
);
execFileSync('git', ['add', '-A'], { cwd: closeoutRoot });
execFileSync('git', ['commit', '-m', 'sibling acceptance closeout'], {
  cwd: closeoutRoot,
  stdio: 'ignore'
});
const siblingCloseout = execFileSync('git', ['rev-parse', 'HEAD'], {
  cwd: closeoutRoot,
  encoding: 'utf8'
}).trim();
const siblingRegistry = registryPath('mechanical-closeout-sibling');
const siblingLifecycle = beginGitLifecycle({
  taskId: 'mechanical-closeout-sibling',
  registry: siblingRegistry,
  gitDirectory: closeoutRoot,
  source: closeoutBase,
  branch: 'task/sibling-closeout',
  files: [
    'implementation.txt',
    closeoutSiblingActive,
    closeoutSiblingCompleted,
    'docs/plans/completed/README.md'
  ]
});
run(transitionArgs('mechanical-closeout-sibling', 'REVIEW', 'worker:mechanical-closeout-sibling',
  'reviewer:mechanical-closeout-sibling', 'Freeze the sibling acceptance scope.',
  ['--task-commit', closeoutReviewed]), {
  registry: siblingRegistry,
  code: 0,
  env: siblingLifecycle.env
});
execFileSync('git', ['checkout', 'sibling-acceptance-closeout'], {
  cwd: closeoutRoot,
  stdio: 'ignore'
});
run(transitionArgs('mechanical-closeout-sibling', 'HANDED_OFF',
  'reviewer:mechanical-closeout-sibling', '00-integration',
  'Accept the sibling closeout only for its own declared scope.',
  ['--review-accepted', 'yes', '--task-commit', closeoutReviewed,
    '--closeout-commit', siblingCloseout]), {
  registry: siblingRegistry,
  code: 0,
  env: siblingLifecycle.env
});
const siblingEvidence = JSON.parse(fs.readFileSync(siblingRegistry, 'utf8'))
  .tasks[0].reviewEvidence.closeout;
const scopeSwapRegistry = `${closeoutRegistry}.sibling-scope-swap`;
const scopeSwapValue = JSON.parse(fs.readFileSync(closeoutRegistry, 'utf8'));
scopeSwapValue.tasks[0].reviewEvidence.closeout = siblingEvidence;
writeRegistry(scopeSwapRegistry, scopeSwapValue);
const rejectedScopeSwap = runRejectedR5(['status', '--json'], scopeSwapRegistry, closeoutRoot);
assert(rejectedScopeSwap.status === 0,
  `${rejectedR5Commit.slice(0, 7)} 必须复现 sibling closeout evidence 移植后 status 仍成功`);
rejectedR5OracleFailures.push('closeout-sibling-scope-swap');
const scopeSwapBytes = fs.readFileSync(scopeSwapRegistry);
run(['status', '--json'], {
  registry: scopeSwapRegistry,
  code: 1,
  stderrIncludes: 'does not declare the exact active/completed acceptance pair',
  env: closeoutLifecycle.env
});
const scopeSwapAfter = JSON.parse(fs.readFileSync(scopeSwapRegistry, 'utf8'));
assert(scopeSwapBytes.equals(fs.readFileSync(scopeSwapRegistry)) &&
  scopeSwapAfter.tasks[0].state === 'HANDED_OFF' &&
  scopeSwapAfter.claims.length === 1 && scopeSwapAfter.claims[0].mode === 'write' &&
  scopeSwapAfter.reservations.length === 0,
  'sibling closeout scope 复验失败必须保持 lifecycle、claim、slot 登记字节不变');
currentOraclePasses.push('closeout-current-claim-scope-binding');

const terminalCloseoutRegistry = `${closeoutRegistry}.terminal-scope-snapshot`;
fs.copyFileSync(closeoutRegistry, terminalCloseoutRegistry);
fs.chmodSync(terminalCloseoutRegistry, 0o600);
run([
  'release',
  '--task', 'mechanical-closeout',
  '--actor', '00',
  '--outcome', 'cancelled',
  '--cancel-confirmed', 'yes',
  '--next', '00-archive',
  '--reason', 'Persist the immutable claimed scope for terminal closeout revalidation.'
], {
  registry: terminalCloseoutRegistry,
  code: 0,
  env: closeoutLifecycle.env
});
const terminalCloseoutStatus = parseJson(run(['status', '--json'], {
  registry: terminalCloseoutRegistry,
  code: 0,
  env: closeoutLifecycle.env
}), 'terminal closeout scope status');
assert(terminalCloseoutStatus.tasks[0].state === 'RELEASED' &&
  terminalCloseoutStatus.claims.length === 0 &&
  terminalCloseoutStatus.tasks[0].release.scopeSnapshot.files.includes(closeoutActive),
  '终态 closeout 必须使用 release 保存的不可漂移 scope snapshot 复验');
const tamperedTerminalScope = JSON.parse(fs.readFileSync(terminalCloseoutRegistry, 'utf8'));
tamperedTerminalScope.tasks[0].release.scopeSnapshot.files = [
  'implementation.txt',
  closeoutSiblingActive,
  closeoutSiblingCompleted,
  'docs/plans/completed/README.md'
];
writeRegistry(terminalCloseoutRegistry, tamperedTerminalScope);
run(['status', '--json'], {
  registry: terminalCloseoutRegistry,
  code: 1,
  stderrIncludes: 'Release scope fingerprint mismatch',
  env: closeoutLifecycle.env
});
currentOraclePasses.push('closeout-terminal-release-scope-snapshot');

const tamperedCloseoutRegistry = JSON.parse(fs.readFileSync(closeoutRegistry, 'utf8'));
tamperedCloseoutRegistry.tasks[0].reviewEvidence.closeout.files[0] = 'docs/plans/active/tampered.md';
writeRegistry(closeoutRegistry, tamperedCloseoutRegistry);
const rejectedTamperedStatus = runRejectedR4(['status', '--json'], closeoutRegistry, closeoutRoot);
assert(rejectedTamperedStatus.status === 0,
  `${rejectedR4Commit.slice(0, 7)} 必须复现持久化 closeout files 篡改后 status 仍成功`);
rejectedR4OracleFailures.push('persisted-closeout-evidence-not-revalidated');
run(['status', '--json'], {
  registry: closeoutRegistry,
  code: 1,
  stderrIncludes: 'drifted from Git object facts',
  env: closeoutLifecycle.env
});
currentOraclePasses.push('strict-mechanical-closeout');
currentOraclePasses.push('persisted-closeout-git-revalidation');

console.log('· canonical thread 不能跨活跃 task 复用，client id 可单独复用');
const threadDedupRegistry = registryPath('canonical-thread-dedup');
const threadDedupA = reserve('thread-dedup-a', '01', 'display', threadDedupRegistry);
const threadDedupB = reserve('thread-dedup-b', '02', 'camera', threadDedupRegistry);
establishWaiting(
  'thread-dedup-a',
  '01',
  threadDedupA.token,
  'shared-canonical-thread',
  'shared-client-id',
  threadDedupRegistry
);
run(transitionArgs('thread-dedup-b', 'RESERVED', '02', '02-waiting-checkpoint',
  'A second task must not reuse the first canonical thread.',
  [
    '--reservation', threadDedupB.token,
    '--thread-id', 'shared-canonical-thread',
    '--client-id', 'shared-client-id',
    '--rollout-state', 'present',
    '--thread-record-state', 'present',
    '--sidebar-state', 'present',
    '--name-state', 'set',
    '--turn-state', 'started',
    '--turn-owner', 'background',
    '--execution-visibility', 'BACKGROUND_ONLY'
  ]),
{
  registry: threadDedupRegistry,
  code: 1,
  stderrIncludes: 'Canonical thread shared-canonical-thread is reused'
});
establishWaiting(
  'thread-dedup-b',
  '02',
  threadDedupB.token,
  'second-canonical-thread',
  'shared-client-id',
  threadDedupRegistry
);
const threadDedupStatus = parseJson(run(['status', '--json'], {
  registry: threadDedupRegistry,
  code: 0
}), 'canonical thread dedup status');
assert(threadDedupStatus.tasks.every(item => item.state === 'WAITING') &&
  new Set(threadDedupStatus.tasks.map(item => item.external.threadId)).size === 2 &&
  threadDedupStatus.tasks.every(item => item.external.clientId === 'shared-client-id') &&
  threadDedupStatus.slots.occupied === 2,
  '失败的 thread 复用不得丢 reservation；client 单独复用不应被误判为 duplicate');
for (const [optionName, value, expected] of [
  ['--thread-id', '', 'must not be empty'],
  ['--thread-id', 'replacement-thread', 'cannot change'],
  ['--client-id', '', 'must not be empty'],
  ['--client-id', 'replacement-client', 'cannot change']
]) {
  run(transitionArgs(
    'thread-dedup-a',
    'WAITING',
    '01',
    '01-start-signal',
    'Canonical external identity must not be cleared or replaced.',
    ['--reservation', threadDedupA.token, optionName, value]
  ), {
    registry: threadDedupRegistry,
    code: 1,
    stderrIncludes: expected
  });
}
const canonicalIdentityPreserved = parseJson(run(['status', '--json'], {
  registry: threadDedupRegistry,
  code: 0
}), 'canonical identity preservation status');
const canonicalTask = canonicalIdentityPreserved.tasks.find(item => item.taskId === 'thread-dedup-a');
assert(canonicalTask.external.threadId === 'shared-canonical-thread' &&
  canonicalTask.external.clientId === 'shared-client-id',
  'canonical thread/client 一旦建立，失败的清空或替换不得改变权威登记');

console.log('· WAITING 过期后恢复同一任务并原子续期');
const waitingRenewRegistry = registryPath('waiting-renew');
const waitingRenew = reserve('waiting-renew', '02', 'project', waitingRenewRegistry);
establishWaiting(
  'waiting-renew',
  '02',
  waitingRenew.token,
  'thread-waiting-renew',
  'client-waiting-renew',
  waitingRenewRegistry
);
const waitingRenewRaw = JSON.parse(fs.readFileSync(waitingRenewRegistry, 'utf8'));
waitingRenewRaw.reservations[0].createdAt = '2000-01-01T00:00:00.000Z';
waitingRenewRaw.reservations[0].expiresAt = '2000-01-01T00:30:00.000Z';
writeRegistry(waitingRenewRegistry, waitingRenewRaw);
run(transitionArgs('waiting-renew', 'WAITING', '02', '00-start-signal',
  'Renew the same visible task instead of creating a duplicate.',
  ['--reservation', waitingRenew.token, '--ttl-minutes', '30']),
{ registry: waitingRenewRegistry, code: 0 });
const waitingRenewStatus = parseJson(run(['status', '--json'], {
  registry: waitingRenewRegistry,
  code: 0
}), 'waiting renew status');
assert(waitingRenewStatus.slots.occupied === 1 &&
  waitingRenewStatus.reservations[0].status === 'active' &&
  waitingRenewStatus.tasks[0].external.threadId === 'thread-waiting-renew',
  '过期 WAITING 必须在锁内重新检查后续期同一 thread，而不是创建副本');

console.log('· 过期 reservation 释放槽但保留可取消记录');
const expiredRegistry = registryPath('expired');
const expired = reserve('expired-task', '03', 'actor', expiredRegistry);
const expiredRaw = JSON.parse(fs.readFileSync(expiredRegistry, 'utf8'));
expiredRaw.reservations[0].createdAt = '2000-01-01T00:00:00.000Z';
expiredRaw.reservations[0].expiresAt = '2000-01-01T00:30:00.000Z';
writeRegistry(expiredRegistry, expiredRaw);
run(claimArgs('expired-task', 'actor', expired.token), {
  registry: expiredRegistry,
  code: 1,
  stderrIncludes: 'Reservation expired'
});
const expiredStatus = parseJson(run(['status', '--json'], {
  registry: expiredRegistry,
  code: 0
}), 'expired status');
assert(expiredStatus.slots.occupied === 0 && expiredStatus.slots.expiredReservations === 1 &&
  expiredStatus.reservations[0].status === 'expired',
  '过期 reservation 必须释放槽、保留记录且明确显示 expired');
run(['reserve', ...writeArgs('expired-task', '04', 'testing')], {
  registry: expiredRegistry,
  code: 2,
  includes: 'duplicate-task'
});
run(cancellationArgs(expired.token, 'expired-task'), {
  registry: expiredRegistry,
  code: 0,
  includes: 'CANCELLED RESERVATION'
});
const expiredCancelled = parseJson(run(['status', '--json'], {
  registry: expiredRegistry,
  code: 0
}), 'expired cancel status');
assert(expiredCancelled.reservations.length === 0 && expiredCancelled.slots.occupied === 0,
  '过期 reservation 可显式 cancel 并恢复干净登记');
run(['reserve', ...writeArgs('expired-task', '03', 'actor')], {
  registry: expiredRegistry,
  code: 1,
  stderrIncludes: 'cannot be replayed'
});
const expiredRedispatch = reserve('expired-task', '04', 'testing', expiredRegistry);
assert(expiredRedispatch.reservation.reservationId !== expired.reservation.reservationId,
  '过期 reservation 补偿取消后同 task ID 可用新 request key 重派，旧 request 不得复活');
currentOraclePasses.push('cancelled-task-id-safe-redispatch');
run(cancellationArgs(expiredRedispatch.token, 'expired-task'), {
  registry: expiredRegistry,
  code: 0
});

console.log('· 跨部门硬冲突和文件软冲突包含 owner、后果与顺序');
const conflictRegistry = registryPath('conflicts');
reserve('layout-owner-01', '01', 'layout', conflictRegistry, '预见PreVision.html');
run(['check', ...writeArgs('layout-owner-03', '03', 'layout', 'other.html')], {
  registry: conflictRegistry,
  code: 2,
  includes: 'owner=01'
});
const hardConflict = run(['check', ...writeArgs('layout-owner-03b', '03', 'layout', 'other-b.html')], {
  registry: conflictRegistry,
  code: 2
});
assert(hardConflict.stdout.includes('modules: layout') &&
  hardConflict.stdout.includes('Cross-department') &&
  hardConflict.stdout.includes('Escalate to 00') &&
  hardConflict.stdout.includes('No active task claims.') &&
  hardConflict.stdout.includes('Task reservations: 1'),
  'check 必须同时展示 claim/reservation，并报告跨部门重叠、后果和推荐顺序');
const softConflict = run(['check', ...writeArgs('camera-owner-02', '02', 'camera', '预见PreVision.html')], {
  registry: conflictRegistry,
  code: 0,
  includes: 'SOFT CONFLICT'
});
assert(softConflict.stdout.includes('owner=01') && softConflict.stdout.includes('Notify 00'),
  '仅文件重叠必须保持软冲突并给出 owner 与机械集成顺序');

console.log('· legacy active claim 有明确兼容路径');
const legacyRegistry = registryPath('legacy');
writeRegistry(legacyRegistry, {
  schemaVersion: 1,
  claims: [{
    taskId: 'legacy-claim',
    title: 'legacy-claim',
    branch: 'fix/legacy-claim',
    sourceCommit: baseline,
    mode: 'write',
    modules: ['repository'],
    uiSurfaces: [],
    dataAreas: ['qa-metadata'],
    files: ['legacy-claim.md'],
    updatedAt: new Date().toISOString()
  }]
});
run([
  'claim', '--task', 'legacy-claim', '--title', 'legacy-claim',
  '--branch', 'fix/legacy-claim', '--source', baseline,
  '--modules', 'repository', '--data', 'qa-metadata', '--files', 'legacy-claim.md'
], {
  registry: legacyRegistry,
  code: 0,
  includes: 'LEGACY CLAIM RETAINED'
});
run([
  'claim', '--task', 'legacy-claim', '--title', 'legacy-claim',
  '--branch', 'fix/legacy-claim', '--source', baseline,
  '--modules', 'testing', '--data', 'qa-metadata', '--files', 'legacy-claim.md'
], {
  registry: legacyRegistry,
  code: 1,
  stderrIncludes: 'already has an active claim'
});
const legacyStatus = parseJson(run(['status', '--json'], {
  registry: legacyRegistry,
  code: 0
}), 'legacy status');
assert(legacyStatus.claims.length === 1 && legacyStatus.claims[0].modules[0] === 'repository' &&
  legacyStatus.tasks[0].external.executionVisibility === 'UNKNOWN',
  'legacy 兼容重试和错误范围不得改写原 active claim，缺失可见性必须 fail closed 为 UNKNOWN');

console.log('· 真实 c037 旧脚本可创建 legacy claim，但不得修改升级后的 v3 登记');
const realLegacyRegistry = registryPath('real-c037-compatibility');
const realLegacyClaimArgs = [
  'claim',
  '--task', 'real-c037-claim',
  '--title', 'real-c037-claim',
  '--branch', 'fix/real-c037-claim',
  '--source', baseline,
  '--modules', 'repository',
  '--data', 'qa-metadata',
  '--files', 'real-c037.md',
  '--json'
];
const initialOldClaim = runLegacy(realLegacyClaimArgs, realLegacyRegistry);
assert(initialOldClaim.status === 0, '真实 c037 脚本必须仍能产生升级前 claims-only legacy 登记');
const migratedLegacyStatus = parseJson(run(['status', '--json'], {
  registry: realLegacyRegistry,
  code: 0
}), 'real legacy migration status');
assert(migratedLegacyStatus.claims[0]?.legacy === true &&
  migratedLegacyStatus.tasks[0]?.state === 'ACTIVE',
  '新版必须保留真实旧 claim 并合成 ACTIVE lifecycle，不破坏在途任务');
run(transitionArgs(
  'real-c037-claim',
  'ACTIVE',
  'legacy-migration',
  'legacy-worker',
  'Persist the in-flight legacy claim under strict schema v3 without changing its slot.'
), { registry: realLegacyRegistry, code: 0 });
const legacyGuardDirectory = `${realLegacyRegistry}.lock`;
const legacyGuardMarker = path.join(legacyGuardDirectory, 'guard.json');
assert(fs.lstatSync(legacyGuardDirectory).isDirectory() &&
  (fs.lstatSync(legacyGuardDirectory).mode & 0o777) === 0o700 &&
  (fs.lstatSync(legacyGuardMarker).mode & 0o777) === 0o600,
  'legacy write guard 必须是旧脚本无法 unlink 的 0700 目录和 0600 marker');
const oldGuardTime = new Date(Date.now() - 60 * 60 * 1000);
fs.utimesSync(legacyGuardDirectory, oldGuardTime, oldGuardTime);
const v3BytesBeforeOldWriters = fs.readFileSync(realLegacyRegistry);
const blockedOldClaim = runLegacy([
  'claim',
  '--task', 'old-third-claim',
  '--title', 'old-third-claim',
  '--branch', 'fix/old-third-claim',
  '--source', baseline,
  '--modules', 'camera',
  '--files', 'old-third.md',
  '--json'
], realLegacyRegistry);
const blockedOldRelease = runLegacy([
  'release',
  '--task', 'real-c037-claim',
  '--json'
], realLegacyRegistry);
assert(blockedOldClaim.status !== 0 && blockedOldRelease.status !== 0,
  '真实 c037 claim/release 在 v3 legacy guard 启用后必须 fail closed');
assert(v3BytesBeforeOldWriters.equals(fs.readFileSync(realLegacyRegistry)),
  '真实 c037 claim/release 失败后 v3 登记字节必须完全不变');
const afterBlockedOldWriters = parseJson(run(['status', '--json'], {
  registry: realLegacyRegistry,
  code: 0
}), 'blocked old writer status');
assert(afterBlockedOldWriters.claims.length === 1 &&
  afterBlockedOldWriters.claims[0].taskId === 'real-c037-claim' &&
  afterBlockedOldWriters.tasks[0].state === 'ACTIVE',
  '旧脚本失败不得第三 claim、release 或遗留新的 lifecycle 损坏');
const directOldStatus = runLegacy(['status', '--json'], realLegacyRegistry);
assert(directOldStatus.status === 0 &&
  JSON.parse(directOldStatus.stdout).claims.length === 0,
  '真实 c037 直接 status 的已知旧行为会把 v3 误报为空，不能作为权威只读入口');
const launcherCreatorRoot = path.join(temporary, 'launcher-creator');
fs.mkdirSync(path.join(launcherCreatorRoot, 'scripts'), { recursive: true });
fs.mkdirSync(path.join(launcherCreatorRoot, 'qa'), { recursive: true });
fs.copyFileSync(script, path.join(launcherCreatorRoot, 'scripts', 'task-coordination.mjs'));
fs.copyFileSync(
  path.join(root, 'qa', 'task-scope-taxonomy.json'),
  path.join(launcherCreatorRoot, 'qa', 'task-scope-taxonomy.json')
);
const legacyPackageFile = path.join(legacyRoot, 'package.json');
const trustedLegacyPackageBytes = fs.readFileSync(legacyPackageFile);
const trustedLegacyScriptBytes = fs.readFileSync(legacyScript);
const modifiedLegacyPackage = JSON.parse(trustedLegacyPackageBytes.toString('utf8'));
modifiedLegacyPackage.scripts['task:claim'] = 'node scripts/untrusted-writer.mjs claim';
modifiedLegacyPackage.scripts['task:release'] = 'node scripts/untrusted-writer.mjs release';
fs.writeFileSync(legacyPackageFile, `${JSON.stringify(modifiedLegacyPackage, null, 2)}\n`);
const rejectedLegacyMigrationArgs = [
  'migrate-legacy-worktree',
  '--worktree', legacyRoot,
  '--legacy-source', legacyBaseline,
  '--actor', '00',
  '--json'
];
const rejectedLegacyMigration = runRejectedR4(
  rejectedLegacyMigrationArgs,
  realLegacyRegistry,
  root
);
assert(rejectedLegacyMigration.status === 0,
  `${rejectedR4Commit.slice(0, 7)} 必须复现只篡改 task:claim/task:release 仍可迁移`);
rejectedR4OracleFailures.push('legacy-partial-task-script-migration');
fs.writeFileSync(legacyScript, trustedLegacyScriptBytes);
const rejectedModifiedLegacyEntry = spawnSync(process.execPath, [
  path.join(launcherCreatorRoot, 'scripts', 'task-coordination.mjs'),
  'migrate-legacy-worktree',
  '--worktree', legacyRoot,
  '--legacy-source', legacyBaseline,
  '--actor', '00',
  '--json'
], {
  cwd: launcherCreatorRoot,
  env: {
    ...process.env,
    PREVISION_TASK_REGISTRY: realLegacyRegistry,
    PREVISION_COORDINATION_GIT_ROOT: root
  },
  encoding: 'utf8'
});
assert(rejectedModifiedLegacyEntry.status !== 0 &&
  rejectedModifiedLegacyEntry.stderr.includes('Every legacy Worktree task:* npm entry must exactly match'),
  '旧 Worktree 即使 HEAD 与主协调脚本未变，只要 task:claim/task:release 被改写也必须拒绝迁移');
fs.writeFileSync(legacyPackageFile, trustedLegacyPackageBytes);
const migratedLegacyEntry = spawnSync(process.execPath, [
  path.join(launcherCreatorRoot, 'scripts', 'task-coordination.mjs'),
  'migrate-legacy-worktree',
  '--worktree', legacyRoot,
  '--legacy-source', legacyBaseline,
  '--actor', '00',
  '--json'
], {
  cwd: launcherCreatorRoot,
  env: {
    ...process.env,
    PREVISION_TASK_REGISTRY: realLegacyRegistry,
    PREVISION_COORDINATION_GIT_ROOT: root
  },
  encoding: 'utf8'
});
assert(migratedLegacyEntry.status === 0,
  `显式旧 Worktree 迁移必须成功：${migratedLegacyEntry.stderr.trim()}`);
currentOraclePasses.push('legacy-all-task-entry-and-clean-migration-gate');
const sharedLauncherDirectory = path.join(
  path.dirname(realLegacyRegistry),
  'prevision-task-coordination-launcher-v3'
);
const launcherPointer = JSON.parse(fs.readFileSync(
  path.join(sharedLauncherDirectory, 'active.json'),
  'utf8'
));
const sharedLauncherScript = path.join(
  sharedLauncherDirectory,
  'versions',
  launcherPointer.digest,
  'scripts',
  'task-coordination.mjs'
);
assert(fs.lstatSync(sharedLauncherScript).isFile() &&
  (fs.lstatSync(sharedLauncherScript).mode & 0o777) === 0o600 &&
  !fs.readFileSync(path.join(legacyRoot, 'scripts', 'task-coordination.mjs'), 'utf8')
    .includes(launcherCreatorRoot),
  '共享 launcher 必须版本化存于 common-dir 等价位置，shim 不得绑定创建任务 Worktree 绝对路径');
fs.rmSync(launcherCreatorRoot, { recursive: true, force: true });
const migratedOldStatus = spawnSync('npm', ['run', 'task:status', '--', '--json'], {
  cwd: legacyRoot,
  env: { ...process.env, PREVISION_TASK_REGISTRY: realLegacyRegistry },
  encoding: 'utf8'
});
const migratedOldStatusJson = JSON.parse(migratedOldStatus.stdout.slice(
  migratedOldStatus.stdout.indexOf('{')
));
assert(migratedOldStatus.status === 0 &&
  migratedOldStatusJson.claims[0]?.taskId === 'real-c037-claim',
  '迁移后真实 c037 原始 npm run task:status 必须自动路由并看到权威 v3 claim');
const migratedOldCheck = spawnSync('npm', [
  'run', 'task:check', '--',
  '--task', 'wrapped-old-check',
  '--title', 'wrapped-old-check',
  '--source', baseline,
  '--modules', 'repository',
  '--files', 'wrapped-old-check.md',
  '--json'
], {
  cwd: legacyRoot,
  env: { ...process.env, PREVISION_TASK_REGISTRY: realLegacyRegistry },
  encoding: 'utf8'
});
const migratedOldCheckJson = JSON.parse(migratedOldCheck.stdout.slice(
  migratedOldCheck.stdout.indexOf('{')
));
assert(migratedOldCheck.status === 2 &&
  migratedOldCheckJson.hard.some(item => item.type === 'scope-overlap'),
  '迁移后真实 c037 原始 npm run task:check 必须使用权威 v3 硬冲突视图');
const migratedOldWrite = spawnSync('npm', [
  'run', 'task:claim', '--',
  '--task', 'forbidden-old-write'
], {
  cwd: legacyRoot,
  env: { ...process.env, PREVISION_TASK_REGISTRY: realLegacyRegistry },
  encoding: 'utf8'
});
assert(migratedOldWrite.status !== 0 &&
  migratedOldWrite.stderr.includes('read-only for coordination'),
  '显式迁移后的旧 Worktree 标准写入口必须 fail closed');

const legacyOrphanRegistry = registryPath('legacy-release-orphan-migration');
const orphanSource = JSON.parse(fs.readFileSync(realLegacyRegistry, 'utf8'));
orphanSource.schemaVersion = 1;
delete orphanSource.revision;
delete orphanSource.updatedAt;
orphanSource.claims = [];
writeRegistry(legacyOrphanRegistry, orphanSource);
const orphanMigration = parseJson(run(['status', '--json'], {
  registry: legacyOrphanRegistry,
  code: 0
}), 'legacy release orphan migration');
assert(orphanMigration.claims.length === 0 && orphanMigration.tasks.length === 0 &&
  orphanMigration.integrityIssues.some(item =>
    item.type === 'legacy-release-lifecycle-orphan' &&
    item.taskId === 'real-c037-claim'),
  '升级前旧 release 遗留 lifecycle 必须转为可查询 integrity issue，不得伪造 RELEASED');
const nonLegacyOrphanRegistry = registryPath('non-legacy-release-orphan-migration');
const nonLegacyOrphanSource = JSON.parse(fs.readFileSync(realLegacyRegistry, 'utf8'));
nonLegacyOrphanSource.schemaVersion = 1;
delete nonLegacyOrphanSource.revision;
delete nonLegacyOrphanSource.updatedAt;
nonLegacyOrphanSource.claims = [];
nonLegacyOrphanSource.tasks[0].owner = '04';
nonLegacyOrphanSource.tasks[0].history =
  nonLegacyOrphanSource.tasks[0].history.map(entry => ({ ...entry, owner: '04' }));
writeRegistry(nonLegacyOrphanRegistry, nonLegacyOrphanSource);
const nonLegacyOrphanMigration = parseJson(run(['status', '--json'], {
  registry: nonLegacyOrphanRegistry,
  code: 0
}), 'non-legacy release orphan migration');
assert(nonLegacyOrphanMigration.integrityIssues.some(item =>
  item.taskId === 'real-c037-claim' && item.owner === '04') &&
  nonLegacyOrphanMigration.tasks.length === 0,
  '旧 release 删除新版 owner claim 后也必须按结构转 integrity issue，不能留下 ACTIVE-without-claim');
run(['reserve', ...writeArgs('orphan-overflow-a', '01', 'display')], {
  registry: nonLegacyOrphanRegistry,
  code: 2,
  includes: 'unresolved-active-orphan'
});
const orphanBlockedStatus = parseJson(run(['status', '--json'], {
  registry: nonLegacyOrphanRegistry,
  code: 0
}), 'orphan slot block status');
assert(orphanBlockedStatus.slots.occupied === 1 &&
  orphanBlockedStatus.slots.unresolvedOrphans === 1 &&
  orphanBlockedStatus.slots.integrityBlocked === true,
  'ACTIVE-without-claim orphan 必须占用隔离槽并全局 fail closed，不能再 reserve 两项超发');
run([
  'resolve-integrity',
  '--task', 'real-c037-claim',
  '--actor', '04',
  '--reason', 'Non-central resolution must fail.',
  '--stop-evidence', 'No valid 00 evidence.'
], {
  registry: nonLegacyOrphanRegistry,
  code: 1,
  stderrIncludes: 'Only 00'
});
run([
  'resolve-integrity',
  '--task', 'real-c037-claim',
  '--actor', '00',
  '--reason', '00 verified the former writer stopped and preserved the orphan audit record.',
  '--stop-evidence', 'Process, Worktree and canonical thread were independently verified stopped.'
], {
  registry: nonLegacyOrphanRegistry,
  code: 0,
  includes: 'INTEGRITY ISSUE RESOLVED'
});
const afterOrphanResolution = reserve(
  'orphan-resolution-capacity',
  '01',
  'display',
  nonLegacyOrphanRegistry
);
assert(afterOrphanResolution.slots.occupied === 1,
  '00 的可审计 stop evidence 解决 orphan 后才恢复写槽');
run(cancellationArgs(afterOrphanResolution.token, 'orphan-resolution-capacity'), {
  registry: nonLegacyOrphanRegistry,
  code: 0
});

console.log('· regular-file preview guard 禁止在线换型且没有 c037 路径空窗');
const previewGuardRegistry = registryPath('preview-guard-offline-only');
writeRegistry(previewGuardRegistry, { schemaVersion: 2, claims: [], reservations: [] });
const previewGuardFile = `${previewGuardRegistry}.lock`;
writeRegistry(previewGuardFile, {
  schemaVersion: 1,
  kind: 'prevision-task-coordination-v3-legacy-guard',
  registrySchemaVersion: 3,
  createdAt: new Date().toISOString()
});
const previewGuardStat = fs.lstatSync(previewGuardFile);
const previewGuardBytes = fs.readFileSync(previewGuardFile);
const previewOldClaimArgs = [
  'claim',
  '--task', 'preview-window-old-claim',
  '--title', 'preview-window-old-claim',
  '--branch', 'fix/preview-window-old-claim',
  '--source', baseline,
  '--modules', 'repository',
  '--files', 'preview-window-old-claim.md',
  '--json'
];
const [blockedPreviewMigration, blockedPreviewOldWriter] = await Promise.all([
  runAsync(['status', '--json'], previewGuardRegistry),
  runLegacyAsync(previewOldClaimArgs, previewGuardRegistry)
]);
assert(blockedPreviewMigration.status === 1 &&
  blockedPreviewMigration.stderr.includes('Automatic file-to-directory migration is forbidden'),
  '新版遇到 regular-file preview guard 必须要求离线迁移，不能执行双 rename');
assert(blockedPreviewOldWriter.status !== 0,
  '新旧脚本并发时 fresh preview guard 必须继续挡住真实 c037 writer');
const previewGuardAfter = fs.lstatSync(previewGuardFile);
assert(previewGuardAfter.isFile() &&
  previewGuardAfter.dev === previewGuardStat.dev &&
  previewGuardAfter.ino === previewGuardStat.ino &&
  previewGuardBytes.equals(fs.readFileSync(previewGuardFile)) &&
  !fs.readdirSync(temporary).some(name =>
    name.startsWith(`${path.basename(previewGuardFile)}.directory-`) ||
    name.startsWith(`${path.basename(previewGuardFile)}.file-`)),
  '失败/崩溃点不得移走 preview guard、改变 inode/bytes 或留下在线换型产物');

console.log('· malformed、symlink、权限异常与残留锁安全处理');
const malformedRegistry = registryPath('malformed');
fs.writeFileSync(malformedRegistry, '{not-json', { mode: 0o600 });
run(['status'], {
  registry: malformedRegistry,
  code: 1,
  stderrIncludes: 'malformed'
});
const structuralRegistry = registryPath('structural-malformed');
writeRegistry(structuralRegistry, {
  schemaVersion: 1,
  coordinationVersion: 2,
  claims: [],
  reservations: [{
    reservationId: 'not-a-uuid',
    tokenHash: 'a'.repeat(64),
    taskId: 'bad-structure',
    title: 'bad-structure',
    owner: '01',
    sourceCommit: baseline,
    modules: ['display'],
    uiSurfaces: [],
    dataAreas: [],
    files: ['bad.md'],
    createdAt: '2026-07-16T00:00:00.000Z',
    expiresAt: '2026-07-16T00:30:00.000Z'
  }]
});
run(['status'], {
  registry: structuralRegistry,
  code: 1,
  stderrIncludes: 'Malformed reservation id'
});
const previewIntegrityRegistry = registryPath('preview-integrity-preserved');
writeRegistry(previewIntegrityRegistry, {
  schemaVersion: 1,
  coordinationVersion: 3,
  claims: [],
  reservations: [],
  tasks: [],
  integrityIssues: [{
    type: 'reservation-cancellation-tombstone',
    taskId: 'preview-cancelled-task',
    title: 'preview-cancelled-task',
    owner: '04',
    previousState: 'RESERVED',
    observedAt: new Date().toISOString(),
    actor: '04',
    reason: 'Preview cancellation was explicitly compensated.',
    evidence: 'Three-way absence was verified.',
    reservationId: crypto.randomUUID()
  }]
});
const previewIntegrityStatus = parseJson(run(['status', '--json'], {
  registry: previewIntegrityRegistry,
  code: 0
}), 'preview integrity migration');
assert(previewIntegrityStatus.integrityIssues[0]?.taskId === 'preview-cancelled-task',
  '精确 schema1 preview 迁移必须完整保留 integrityIssues，不能静默丢失');
const previewExtraRegistry = registryPath('preview-extra-critical-key');
const previewExtra = JSON.parse(fs.readFileSync(previewIntegrityRegistry, 'utf8'));
previewExtra.releaseEvidence = { forged: true };
writeRegistry(previewExtraRegistry, previewExtra);
run(['status'], {
  registry: previewExtraRegistry,
  code: 1,
  stderrIncludes: 'Unsupported or malformed task registry schema'
});
const legacyMissingBaselineRegistry = registryPath('legacy-missing-baseline');
writeRegistry(legacyMissingBaselineRegistry, {
  schemaVersion: 1,
  claims: [{
    taskId: 'legacy-missing-baseline',
    title: 'legacy-missing-baseline',
    branch: 'fix/legacy-missing-baseline',
    sourceCommit: 'a'.repeat(40),
    mode: 'write',
    modules: ['repository'],
    uiSurfaces: [],
    dataAreas: [],
    files: ['legacy-missing-baseline.md'],
    updatedAt: new Date().toISOString()
  }]
});
run(['status'], {
  registry: legacyMissingBaselineRegistry,
  code: 1,
  stderrIncludes: 'existing Git commit object'
});
const malformedLifecycleRegistry = registryPath('malformed-lifecycle');
reserve('malformed-lifecycle-task', '04', 'testing', malformedLifecycleRegistry);
const malformedLifecycleRaw = JSON.parse(fs.readFileSync(malformedLifecycleRegistry, 'utf8'));
malformedLifecycleRaw.tasks[0].state = 'BROKEN';
writeRegistry(malformedLifecycleRegistry, malformedLifecycleRaw);
run(['status'], {
  registry: malformedLifecycleRegistry,
  code: 1,
  stderrIncludes: 'Malformed lifecycle state'
});
const malformedVisibilityRegistry = registryPath('malformed-visibility');
reserve('malformed-visibility-task', '04', 'testing', malformedVisibilityRegistry);
const malformedVisibilityRaw = JSON.parse(fs.readFileSync(malformedVisibilityRegistry, 'utf8'));
malformedVisibilityRaw.tasks[0].external.executionVisibility = 'BROKEN';
writeRegistry(malformedVisibilityRegistry, malformedVisibilityRaw);
run(['status'], {
  registry: malformedVisibilityRegistry,
  code: 1,
  stderrIncludes: 'Malformed execution visibility'
});
for (const [name, value] of [
  ['null', null],
  ['object', {}],
  ['string', 'not-an-array']
]) {
  for (const field of ['reservations', 'tasks']) {
    const malformedV3Registry = registryPath(`malformed-v3-${field}-${name}`);
    const source = JSON.parse(fs.readFileSync(malformedLifecycleRegistry, 'utf8'));
    source[field] = value;
    writeRegistry(malformedV3Registry, source);
    run(['status'], {
      registry: malformedV3Registry,
      code: 1,
      stderrIncludes: 'Malformed coordinationVersion 3'
    });
  }
}
for (const field of ['reservations', 'tasks']) {
  const missingV3Registry = registryPath(`malformed-v3-${field}-missing`);
  const source = JSON.parse(fs.readFileSync(malformedLifecycleRegistry, 'utf8'));
  delete source[field];
  writeRegistry(missingV3Registry, source);
  run(['status'], {
    registry: missingV3Registry,
    code: 1,
    stderrIncludes: 'Malformed coordinationVersion 3'
  });
}
const symlinkTarget = registryPath('symlink-target');
writeRegistry(symlinkTarget, { schemaVersion: 2, claims: [], reservations: [] });
const symlinkRegistry = registryPath('symlink');
fs.symlinkSync(symlinkTarget, symlinkRegistry);
run(['status'], {
  registry: symlinkRegistry,
  code: 1,
  stderrIncludes: 'must not be a symbolic link'
});
const danglingSymlinkRegistry = registryPath('dangling-symlink');
fs.symlinkSync(registryPath('missing-symlink-target'), danglingSymlinkRegistry);
run(['status'], {
  registry: danglingSymlinkRegistry,
  code: 1,
  stderrIncludes: 'must not be a symbolic link'
});
const permissionRegistry = registryPath('permission');
writeRegistry(permissionRegistry, { schemaVersion: 2, claims: [], reservations: [] });
fs.chmodSync(permissionRegistry, 0o644);
run(['status'], {
  registry: permissionRegistry,
  code: 1,
  stderrIncludes: 'permissions must be 0600'
});
const ownerExecuteRegistry = registryPath('owner-execute-permission');
writeRegistry(ownerExecuteRegistry, { schemaVersion: 2, claims: [], reservations: [] });
fs.chmodSync(ownerExecuteRegistry, 0o700);
run(['status'], {
  registry: ownerExecuteRegistry,
  code: 1,
  stderrIncludes: 'permissions must be 0600'
});
const staleRegistry = registryPath('stale-lock');
const staleLock = `${staleRegistry}.coordination-v3.lock`;
writeRegistry(staleLock, lockMarker(999999, canonicalDeadIdentity));
run(['status'], {
  registry: staleRegistry,
  code: 0,
  includes: 'Write slots: 0/2'
});
assert(!fs.existsSync(staleLock), '仅在 owner 进程缺失且 identity/inode 复核一致时才可恢复 stale v3 lock');
const lockSymlinkRegistry = registryPath('lock-symlink');
const lockSymlinkTarget = registryPath('lock-symlink-target');
writeRegistry(lockSymlinkTarget, lockMarker(999999, canonicalDeadIdentity));
fs.symlinkSync(lockSymlinkTarget, `${lockSymlinkRegistry}.coordination-v3.lock`);
run(['status'], {
  registry: lockSymlinkRegistry,
  code: 1,
  stderrIncludes: 'Task registry lock must not be a symbolic link'
});
const lockExecuteRegistry = registryPath('lock-owner-execute');
writeRegistry(`${lockExecuteRegistry}.coordination-v3.lock`,
  lockMarker(999999, canonicalDeadIdentity));
fs.chmodSync(`${lockExecuteRegistry}.coordination-v3.lock`, 0o700);
run(['status'], {
  registry: lockExecuteRegistry,
  code: 1,
  stderrIncludes: 'permissions must be 0600'
});
const legacyGuardSymlinkRegistry = registryPath('legacy-guard-symlink');
const legacyGuardSymlinkTarget = `${legacyGuardSymlinkRegistry}.guard-target`;
fs.mkdirSync(legacyGuardSymlinkTarget, { mode: 0o700 });
fs.symlinkSync(legacyGuardSymlinkTarget, `${legacyGuardSymlinkRegistry}.lock`);
run(['status'], {
  registry: legacyGuardSymlinkRegistry,
  code: 1,
  stderrIncludes: 'Legacy task coordination write guard must not be a symbolic link'
});
const legacyGuardPermissionRegistry = registryPath('legacy-guard-permission');
fs.mkdirSync(`${legacyGuardPermissionRegistry}.lock`, { mode: 0o755 });
run(['status'], {
  registry: legacyGuardPermissionRegistry,
  code: 1,
  stderrIncludes: 'must be a 0700 directory'
});
const malformedLockRegistry = registryPath('malformed-lock');
fs.writeFileSync(`${malformedLockRegistry}.coordination-v3.lock`, '{}\n', { mode: 0o600 });
run(['status'], {
  registry: malformedLockRegistry,
  code: 1,
  stderrIncludes: 'malformed; refusing automatic recovery'
});
const previousIdentityLockRegistry = registryPath('previous-identity-lock');
const previousIdentityLock = `${previousIdentityLockRegistry}.coordination-v3.lock`;
writeRegistry(previousIdentityLock, {
  schemaVersion: 1,
  kind: 'prevision-task-coordination-v3-lock',
  pid: process.pid,
  ownerIdentity: `${processIdentity()} node task-coordination.mjs --reservation sensitive-token`,
  nonce: crypto.randomBytes(24).toString('hex'),
  acquiredAt: new Date().toISOString()
});
run(['status'], {
  registry: previousIdentityLockRegistry,
  code: 1,
  stderrIncludes: 'malformed; refusing automatic recovery'
});
assert(fs.existsSync(previousIdentityLock),
  '旧 identity schema 的活锁必须 fail closed 保留，不能因新旧 identity 格式不同被当 stale 删除');
const malformedRecoveryRegistry = registryPath('malformed-recovery-lock');
fs.writeFileSync(`${malformedRecoveryRegistry}.coordination-v3.lock.recovery`, '{}\n', {
  mode: 0o600
});
run(['status'], {
  registry: malformedRecoveryRegistry,
  code: 1,
  stderrIncludes: 'malformed; refusing automatic recovery'
});

console.log('· 崩溃遗留 lock candidate/hardlink 安全清理且不误删活候选');
const staleCandidateRegistry = registryPath('stale-lock-candidate');
const staleCandidateNonce = crypto.randomBytes(24).toString('hex');
const staleCandidate = `${staleCandidateRegistry}.coordination-v3.lock.candidate-999999-${staleCandidateNonce}`;
writeRegistry(staleCandidate,
  lockMarker(999999, canonicalDeadIdentity, staleCandidateNonce));
run(['status'], {
  registry: staleCandidateRegistry,
  code: 0,
  includes: 'Write slots: 0/2'
});
assert(!fs.existsSync(staleCandidate),
  '无活 owner 的完整 candidate 必须在持有主锁后安全清理');
const liveCandidateRegistry = registryPath('live-lock-candidate');
const liveCandidateNonce = crypto.randomBytes(24).toString('hex');
const liveCandidate = `${liveCandidateRegistry}.coordination-v3.lock.candidate-${process.pid}-${liveCandidateNonce}`;
writeRegistry(liveCandidate,
  lockMarker(process.pid, processIdentity(), liveCandidateNonce));
run(['status'], {
  registry: liveCandidateRegistry,
  code: 0,
  includes: 'Write slots: 0/2'
});
assert(fs.existsSync(liveCandidate),
  '活 PID candidate 即使暂时半写或等待发布也不得被竞争者误删');
fs.unlinkSync(liveCandidate);
const hardlinkCandidateRegistry = registryPath('stale-hardlink-candidate');
const hardlinkNonce = crypto.randomBytes(24).toString('hex');
const hardlinkCandidate =
  `${hardlinkCandidateRegistry}.coordination-v3.lock.candidate-999999-${hardlinkNonce}`;
const hardlinkPublished = `${hardlinkCandidateRegistry}.coordination-v3.lock`;
writeRegistry(hardlinkCandidate,
  lockMarker(999999, canonicalDeadIdentity, hardlinkNonce));
fs.linkSync(hardlinkCandidate, hardlinkPublished);
run(['status'], {
  registry: hardlinkCandidateRegistry,
  code: 0,
  includes: 'Write slots: 0/2'
});
assert(!fs.existsSync(hardlinkCandidate) && !fs.existsSync(hardlinkPublished),
  '发布后崩溃留下的 stale lock+candidate hardlink 必须由 recovery guard 收敛清理');

console.log('· 活跃 owner 超过旧阈值仍保持互斥，stale 接管与迟到释放按 identity/inode 安全');
const rejectedLockRegistry = registryPath('rejected-r3-cross-timezone-lock');
const rejectedLockHolder = startRejectedR3(['status', '--json'], rejectedLockRegistry, {
  LC_ALL: 'C',
  LANG: 'C',
  TZ: 'Asia/Shanghai',
  PREVISION_COORDINATION_TEST_HOLD_LOCK_MS: '500'
});
const rejectedLockFile = `${rejectedLockRegistry}.coordination-v3.lock`;
await waitFor(() => fs.existsSync(rejectedLockFile),
  '真实 2f6 跨时区失败 fixture 应先持有锁');
const rejectedContenderStarted = Date.now();
const rejectedLockContender = await startRejectedR3(['status', '--json'], rejectedLockRegistry, {
  LC_ALL: 'C',
  LANG: 'C',
  TZ: 'UTC0'
}).completed;
const rejectedContenderElapsed = Date.now() - rejectedContenderStarted;
const rejectedLockHolderResult = await rejectedLockHolder.completed;
const rejectedLockUnsafe = rejectedLockHolderResult.status === 0 &&
  rejectedLockContender.status === 0 &&
  rejectedContenderElapsed < 350;
assert(rejectedLockUnsafe,
  '真实 2f6cd51 必须复现跨 TZ identity 不同导致 contender 在活 holder 退出前成功的旧失败 oracle');
if (rejectedLockUnsafe) {
  rejectedR3OracleFailures.push('cross-timezone-live-lock-theft');
}

const crossVersionLockRegistry = registryPath('cross-version-live-lock');
const rejectedHolder = startRejectedR3(['status', '--json'], crossVersionLockRegistry, {
  LC_ALL: 'C',
  LANG: 'C',
  TZ: 'Asia/Shanghai',
  PREVISION_COORDINATION_TEST_HOLD_LOCK_MS: '500'
});
const rejectedHolderLock = `${crossVersionLockRegistry}.coordination-v3.lock`;
await waitFor(() => fs.existsSync(rejectedHolderLock),
  '真实 2f6 holder 应创建 schema2 v3 lock');
const crossVersionStarted = Date.now();
const currentContender = runAsync(['status', '--json'], crossVersionLockRegistry, {
  LC_ALL: 'C',
  LANG: 'C',
  TZ: 'UTC0'
});
const [rejectedHolderResult, currentContenderResult] = await Promise.all([
  rejectedHolder.completed,
  currentContender
]);
assert(rejectedHolderResult.status === 0 && currentContenderResult.status === 0 &&
  Date.now() - crossVersionStarted >= 300,
  '真实 2f6 活 PID 即使跨 TZ identity 不匹配，当前 contender 也必须等待，禁止偷锁或丢更新');
currentOraclePasses.push('cross-version-live-pid-lock-preserved');

const localeIdentityRegistry = registryPath('locale-independent-lock-identity');
const localeIdentityReservation = reserve(
  'locale-identity-task',
  '04',
  'testing',
  localeIdentityRegistry
);
const secretThreadId = 'thread-sensitive-example';
const secretClientId = 'client-sensitive-example';
const localeIdentityClaim = claimArgs(
  'locale-identity-task',
  'testing',
  localeIdentityReservation.token
);
localeIdentityClaim[localeIdentityClaim.indexOf('thread-locale-identity-task')] = secretThreadId;
localeIdentityClaim[localeIdentityClaim.indexOf('client-locale-identity-task')] = secretClientId;
const localeHolder = startAsync(localeIdentityClaim, localeIdentityRegistry, {
  LC_ALL: 'zh_CN.UTF-8',
  LANG: 'zh_CN.UTF-8',
  TZ: 'Asia/Shanghai',
  PREVISION_COORDINATION_TEST_HOLD_LOCK_MS: '400'
});
const localeHolderLock = `${localeIdentityRegistry}.coordination-v3.lock`;
await waitFor(() => fs.existsSync(localeHolderLock),
  '跨 locale holder 应创建 v3 lock');
const localeMarkerBytes = fs.readFileSync(localeHolderLock, 'utf8');
const localeMarker = JSON.parse(localeMarkerBytes);
assert(localeMarker.ownerIdentity === processIdentity(localeHolder.child.pid),
  'lock owner identity 必须固定 LC_ALL=C，并在不同调用 locale 下保持一致');
assert(!localeMarkerBytes.includes(localeIdentityReservation.token) &&
  !localeMarkerBytes.includes(secretThreadId) &&
  !localeMarkerBytes.includes(secretClientId) &&
  !localeMarkerBytes.includes('claim'),
  '残留 lock bytes 不得包含 reservation token、thread/client id 或 argv/command');
const localeContender = runAsync(['status', '--json'], localeIdentityRegistry, {
  LC_ALL: 'C',
  LANG: 'C',
  TZ: 'UTC0'
});
const [localeHolderResult, localeContenderResult] = await Promise.all([
  localeHolder.completed,
  localeContender
]);
assert(localeHolderResult.status === 0 && localeContenderResult.status === 0,
  '跨 locale/TZ holder 与 contender 必须识别同一活进程，不得误删活锁');
const crossTimezoneRegistry = registryPath('cross-timezone-reserve');
const crossTimezoneResults = await Promise.all([
  runAsync([
    'reserve',
    ...writeArgs('timezone-a', '01', 'display'),
    '--json'
  ], crossTimezoneRegistry, { TZ: 'Asia/Shanghai' }),
  runAsync([
    'reserve',
    ...writeArgs('timezone-b', '02', 'camera'),
    '--json'
  ], crossTimezoneRegistry, { TZ: 'UTC0' })
]);
assert(crossTimezoneResults.every(result => result.status === 0),
  '跨 TZ 并发 reserve 不得因 ps lstart 身份差异误删活锁');
const crossTimezoneStatus = parseJson(run(['status', '--json'], {
  registry: crossTimezoneRegistry,
  code: 0,
  env: { TZ: 'Pacific/Honolulu' }
}), 'cross timezone status');
assert(crossTimezoneStatus.reservations.length === 2 &&
  crossTimezoneStatus.slots.occupied === 2,
  '跨 TZ 并发 reserve 的两个成功 token 必须对应两条完整登记，不能丢更新');

const fdRaceRegistry = registryPath('fd-lock-read-after-release');
const fdRaceLock = `${fdRaceRegistry}.coordination-v3.lock`;
const fdRaceSignal = path.join(temporary, 'fd-race-opened.signal');
const fdRaceProceed = path.join(temporary, 'fd-race-proceed.signal');
const fdRaceHolder = startAsync(['status', '--json'], fdRaceRegistry, {
  PREVISION_COORDINATION_TEST_HOLD_LOCK_MS: '300'
});
await waitFor(() => fs.existsSync(fdRaceLock),
  'fd TOCTOU holder 应创建 lock');
const fdRaceContender = runAsync(['status', '--json'], fdRaceRegistry, {
  PREVISION_COORDINATION_TEST_LOCK_READ_SIGNAL: fdRaceSignal,
  PREVISION_COORDINATION_TEST_LOCK_READ_PROCEED: fdRaceProceed
});
await waitFor(() => fs.existsSync(fdRaceSignal),
  '竞争者必须在打开 holder lock 后进入确定性 hook');
const fdRaceHolderResult = await fdRaceHolder.completed;
fs.writeFileSync(fdRaceProceed, 'continue\n', { mode: 0o600 });
const fdRaceContenderResult = await fdRaceContender;
assert(fdRaceHolderResult.status === 0 && fdRaceContenderResult.status === 0 &&
  !fdRaceContenderResult.stderr.includes('malformed'),
  'lstat/open 后 holder unlink 的 TOCTOU 必须通过 fd/inode 重试收敛，不能包装成 malformed');

const pausedHolderRegistry = registryPath('paused-holder');
const pausedHolderLock = `${pausedHolderRegistry}.coordination-v3.lock`;
const pausedHolder = startAsync(['status', '--json'], pausedHolderRegistry, {
  PREVISION_COORDINATION_TEST_HOLD_LOCK_MS: '400'
});
await waitFor(() => fs.existsSync(pausedHolderLock),
  '活跃 holder 应创建 v3 lock');
const veryOld = new Date(Date.now() - 60 * 60 * 1000);
fs.utimesSync(pausedHolderLock, veryOld, veryOld);
const pausedContenderStarted = Date.now();
const pausedContender = runAsync(['status', '--json'], pausedHolderRegistry);
const [pausedHolderResult, pausedContenderResult] = await Promise.all([
  pausedHolder.completed,
  pausedContender
]);
assert(pausedHolderResult.status === 0 && pausedContenderResult.status === 0,
  '合法持锁进程即使 mtime 远超旧阈值也不得被接管');
assert(Date.now() - pausedContenderStarted >= 250,
  '竞争者必须等待活跃 owner 释放，不得仅凭 mtime unlink');

const takeoverRegistry = registryPath('stale-takeover-three-process');
writeRegistry(`${takeoverRegistry}.coordination-v3.lock`,
  lockMarker(999999, canonicalDeadIdentity));
const takeoverResults = await Promise.all([
  runAsync(['reserve', ...writeArgs('takeover-a', '01', 'display'), '--json'], takeoverRegistry),
  runAsync(['reserve', ...writeArgs('takeover-b', '02', 'camera'), '--json'], takeoverRegistry),
  runAsync(['reserve', ...writeArgs('takeover-c', '03', 'actor'), '--json'], takeoverRegistry)
]);
assert(takeoverResults.filter(result => result.status === 0).length === 2 &&
  takeoverResults.filter(result => result.status === 2).length === 1,
  'stale-check 与新 holder 接管竞态中的三进程 reserve 仍必须恰好两个成功');
const takeoverStatus = parseJson(run(['status', '--json'], {
  registry: takeoverRegistry,
  code: 0
}), 'stale takeover status');
assert(takeoverStatus.slots.occupied === 2 &&
  takeoverStatus.reservations.length === 2,
  'stale 接管后的登记不得超发或丢更新');

const lateReleaseRegistry = registryPath('late-release');
const lateReleaseLock = `${lateReleaseRegistry}.coordination-v3.lock`;
const oldHolder = startAsync(['status', '--json'], lateReleaseRegistry, {
  PREVISION_COORDINATION_TEST_HOLD_LOCK_MS: '500'
});
await waitFor(() => fs.existsSync(lateReleaseLock),
  '迟到释放测试的旧 holder 应持有 lock');
const oldHolderStat = fs.lstatSync(lateReleaseLock);
fs.unlinkSync(lateReleaseLock);
writeRegistry(lateReleaseLock, lockMarker(process.pid, processIdentity()));
const replacementStat = fs.lstatSync(lateReleaseLock);
assert(replacementStat.ino !== oldHolderStat.ino,
  '确定性 fixture 必须以不同 inode 模拟已验证的新 holder');
const oldHolderResult = await oldHolder.completed;
assert(oldHolderResult.status === 0 && fs.existsSync(lateReleaseLock) &&
  fs.lstatSync(lateReleaseLock).ino === replacementStat.ino,
  '旧 holder 迟到释放只能检查自己的 identity/inode，不得删除新 holder lock');
fs.unlinkSync(lateReleaseLock);

console.log('· 并发 reserve/cancel/claim/status 不损坏登记');
const operationsRegistry = registryPath('operations');
const operationA = reserve('operation-a', '01', 'display', operationsRegistry);
const operationB = reserve('operation-b', '02', 'camera', operationsRegistry);
const operationResults = await Promise.all([
  runAsync(claimArgs('operation-a', 'display', operationA.token), operationsRegistry),
  runAsync([...cancellationArgs(operationB.token, 'operation-b'), '--json'], operationsRegistry),
  runAsync(['status', '--json'], operationsRegistry),
  runAsync(['status', '--json'], operationsRegistry)
]);
assert(operationResults.every(result => result.status === 0),
  `并发 claim、cancel 与 status 均应在同一锁协议下成功：${operationResults
    .map(result => `${result.status}:${result.stderr.trim()}`)
    .join(' | ')}`);
const operationStatus = parseJson(run(['status', '--json'], {
  registry: operationsRegistry,
  code: 0
}), 'operations final status');
assert(operationStatus.claims.length === 1 && operationStatus.claims[0].taskId === 'operation-a' &&
  operationStatus.reservations.length === 0 && operationStatus.slots.occupied === 1,
  '并发操作后登记必须保持一个 active claim、零 reservation 且 JSON 完整');
const concurrentLifecycleResults = await Promise.all([
  runAsync(transitionArgs(
    'operation-a',
    'ACTIVE',
    'worker:operation-a',
    'worker:operation-a',
    'Concurrent ACTIVE checkpoint preserves the same canonical writer.'
  ), operationsRegistry),
  runAsync(['status', '--json'], operationsRegistry),
  runAsync(['status', '--json'], operationsRegistry)
]);
assert(concurrentLifecycleResults.every(result => result.status === 0),
  `并发 transition/status 必须共用同一锁并保持登记完整：${concurrentLifecycleResults
    .map(result => `${result.status}:${result.stderr.trim()}`)
    .join(' | ')}`);
const concurrentLifecycleStatus = parseJson(run(['status', '--json'], {
  registry: operationsRegistry,
  code: 0
}), 'concurrent lifecycle final status');
assert(concurrentLifecycleStatus.tasks.find(item => item.taskId === 'operation-a')?.state === 'ACTIVE' &&
  concurrentLifecycleStatus.claims.length === 1 &&
  concurrentLifecycleStatus.slots.occupied === 1,
  '并发状态更新后 ACTIVE checkpoint 必须可见且 active claim 继续占槽');

console.log('· 模拟侧栏创建失败的补偿事务恢复写槽');
const compensationRegistry = registryPath('compensation');
const compensation = reserve('sidebar-create-failure', '04', 'testing', compensationRegistry);
const beforeCancel = parseJson(run(['status', '--json'], {
  registry: compensationRegistry,
  code: 0
}), 'compensation before');
assert(beforeCancel.slots.occupied === 1, '模拟侧栏创建前 reserve 必须先占一个槽');
run(['cancel-reservation',
  '--reservation', compensation.token,
  '--task', 'sidebar-create-failure',
  '--compensation-confirmed', 'yes',
  '--actor', '04',
  '--reason', 'Triage is incomplete.',
  '--evidence', 'External state remains unknown.'], {
  registry: compensationRegistry,
  code: 1,
  stderrIncludes: 'requires explicit rollout=missing'
});
run(cancellationArgs(compensation.token, 'sidebar-create-failure'), {
  registry: compensationRegistry,
  code: 0,
  includes: 'CANCELLED RESERVATION'
});
const afterCancel = parseJson(run(['status', '--json'], {
  registry: compensationRegistry,
  code: 0
}), 'compensation after');
assert(afterCancel.slots.occupied === 0 && afterCancel.reservations.length === 0,
  '模拟创建失败后 cancel 必须完整恢复写槽且不制造 active claim');

const runningGhostRegistry = registryPath('running-ghost-cancel-refusal');
const runningGhost = reserve('running-ghost', '04', 'testing', runningGhostRegistry);
run(transitionArgs('running-ghost', 'RESERVED', '04', '04-owner-check',
  'A background turn started before creation outcome became uncertain.',
  [
    '--reservation', runningGhost.token,
    '--thread-id', 'thread-running-ghost',
    '--client-id', 'client-running-ghost',
    '--rollout-state', 'present',
    '--thread-record-state', 'present',
    '--sidebar-state', 'present',
    '--name-state', 'set',
    '--turn-state', 'started',
    '--turn-owner', 'background',
    '--execution-visibility', 'BACKGROUND_ONLY'
  ]), {
  registry: runningGhostRegistry,
  code: 0
});
run(['cancel-reservation',
  '--reservation', runningGhost.token,
  '--task', 'running-ghost',
  '--compensation-confirmed', 'yes',
  '--rollout-state', 'missing',
  '--thread-record-state', 'missing',
  '--sidebar-state', 'absent',
  '--actor', '04',
  '--reason', 'Three stores are absent but a started turn remains.',
  '--evidence', 'The persisted turn is still started.'], {
  registry: runningGhostRegistry,
  code: 1,
  stderrIncludes: 'explicitly non-running turn'
});
const runningGhostStatus = parseJson(run(['status', '--json'], {
  registry: runningGhostRegistry,
  code: 0
}), 'running ghost preserved status');
assert(runningGhostStatus.reservations.length === 1 &&
  runningGhostStatus.slots.occupied === 1,
  'started background owner 即使三方 missing 也必须保留 reservation，禁止直接 cancel');

console.log('· 外部侧栏部分成功与 ghost task 使用三方核对后补偿');
const partialCreateRegistry = registryPath('partial-create');
const partialCreate = reserve('partial-create', '01', 'repository', partialCreateRegistry);
run(transitionArgs('partial-create', 'RESERVED', '01', '01-sidebar-recovery',
  'thread/start succeeded but thread/name/set failed; preserve the reservation and same thread.',
  [
    '--reservation', partialCreate.token,
    '--thread-id', 'thread-partial-create',
    '--client-id', 'client-partial-create',
    '--rollout-state', 'present',
    '--thread-record-state', 'present',
    '--sidebar-state', 'present',
    '--name-state', 'failed',
    '--turn-state', 'not-started',
    '--turn-owner', 'none'
  ]
), { registry: partialCreateRegistry, code: 0 });
run([
  'cancel-reservation',
  '--reservation', partialCreate.token,
  '--task', 'partial-create',
  '--actor', '01',
  '--reason', 'Compensation was requested before triage confirmation.',
  '--evidence', 'The same reservation must be preserved.'
], {
  registry: partialCreateRegistry,
  code: 1,
  stderrIncludes: 'requires --compensation-confirmed yes'
});
run(transitionArgs('partial-create', 'RESERVED', '00-manual-recovery', '01-reserve-compensation',
  'Three-way triage confirmed no rollout, no thread/list DB record, and no sidebar atom.',
  [
    '--reservation', partialCreate.token,
    '--rollout-state', 'missing',
    '--thread-record-state', 'missing',
    '--sidebar-state', 'absent',
    '--name-state', 'failed',
    '--turn-state', 'not-started',
    '--turn-owner', 'none'
  ]
), { registry: partialCreateRegistry, code: 0 });
run(cancellationArgs(partialCreate.token, 'partial-create'), {
  registry: partialCreateRegistry,
  code: 0,
  includes: 'CANCELLED RESERVATION'
});

const ghostRegistry = registryPath('ghost-task');
const ghostId = 'simulated-ghost-task';
const ghost = reserve(ghostId, '04', 'testing', ghostRegistry);
establishWaiting(
  ghostId,
  '04',
  ghost.token,
  ghostId,
  'ghost-client-id',
  ghostRegistry
);
run(transitionArgs(ghostId, 'WAITING', '00-ghost-triage', '00-manual-recovery',
  'Rollout and thread/list DB record are absent while renderer sidebar atoms remain stale.',
  [
    '--reservation', ghost.token,
    '--rollout-state', 'missing',
    '--thread-record-state', 'missing',
    '--sidebar-state', 'stale',
    '--turn-state', 'disconnected'
  ]
), { registry: ghostRegistry, code: 0 });
run(['cancel-reservation', '--reservation', ghost.token, '--task', ghostId,
  '--compensation-confirmed', 'yes',
  '--rollout-state', 'missing',
  '--thread-record-state', 'missing',
  '--sidebar-state', 'stale',
  '--actor', '00-ghost-triage',
  '--reason', 'A stale renderer entry remains.',
  '--evidence', 'rollout and DB are missing; sidebar is stale.'], {
  registry: ghostRegistry,
  code: 1,
  stderrIncludes: 'sidebar=absent'
});
run(transitionArgs(ghostId, 'WAITING', '00-manual-recovery', '04-reserve-compensation',
  'After backup and exact orphan-key cleanup, restart verified the sidebar atom is absent.',
  [
    '--reservation', ghost.token,
    '--rollout-state', 'missing',
    '--thread-record-state', 'missing',
    '--sidebar-state', 'absent',
    '--turn-state', 'disconnected'
  ]
), { registry: ghostRegistry, code: 0 });
run(['cancel-reservation', '--reservation', ghost.token, '--task', ghostId,
  '--compensation-confirmed', 'yes',
  '--rollout-state', 'missing',
  '--thread-record-state', 'missing',
  '--sidebar-state', 'absent',
  '--turn-state', 'disconnected',
  '--turn-owner', 'background',
  '--actor', '00-manual-recovery',
  '--reason', 'Attempted one-command state overwrite.',
  '--evidence', 'This must be rejected.'], {
  registry: ghostRegistry,
  code: 1,
  stderrIncludes: 'cannot rewrite turn state or owner'
});
run([
  'verify-stop',
  '--task', ghostId,
  '--reservation', ghost.token,
  '--actor', '00-manual-recovery',
  '--next', '04-reserve-compensation',
  '--reason', 'The former background owner was verified stopped before compensation.',
  '--evidence', 'The same canonical turn emitted turn/completed after reconnect and the owner stopped.',
  '--turn-state', 'completed',
  '--json'
], { registry: ghostRegistry, code: 0 });
run(cancellationArgs(ghost.token, ghostId), {
  registry: ghostRegistry,
  code: 0,
  includes: 'CANCELLED RESERVATION'
});
const ghostStatus = parseJson(run(['status', '--json'], {
  registry: ghostRegistry,
  code: 0
}), 'ghost compensation status');
assert(ghostStatus.slots.occupied === 0 && ghostStatus.tasks.length === 0 &&
  ghostStatus.integrityIssues.some(item =>
    item.type === 'reservation-cancellation-tombstone' &&
    item.taskId === ghostId && item.actor === '04'),
  'ghost task 只能在三方核对、精确孤立键清理和缺失验证后补偿取消');

assert(rejectedR3OracleFailures.length === 2 &&
  currentOraclePasses.length >= 5,
  '同一第三轮 oracle 集必须真实记录 2f6cd51 失败集合与当前版通过集合');
const expectedRejectedR4Failures = [
  'unicode-net-diff',
  'rename-source-net-diff',
  'closeout-acceptance-rewrite',
  'closeout-index-rewrite',
  'persisted-closeout-evidence-not-revalidated',
  'legacy-partial-task-script-migration'
];
assert(sameMembers(rejectedR4OracleFailures, expectedRejectedR4Failures),
  '同一 R4 oracle 集必须真实记录 5dd075c 的六个具体失败反例');
const expectedRejectedR5Failures = [
  'closeout-plan-mode',
  'closeout-index-mode-type',
  'closeout-sibling-scope-swap',
  'git-replace-authoritative-evidence'
];
assert(sameMembers(rejectedR5OracleFailures, expectedRejectedR5Failures),
  '同一 R5 oracle 集必须真实记录 40d4d71 的四个具体失败反例');
console.log(`· 2f6cd51 真实失败集合: ${rejectedR3OracleFailures.join(', ')}`);
console.log(`· 5dd075c R4 真实失败集合: ${rejectedR4OracleFailures.join(', ')}`);
console.log(`· 40d4d71 R5 真实失败集合: ${rejectedR5OracleFailures.join(', ')}`);
console.log(`· 当前版通过集合: ${currentOraclePasses.join(', ')}`);
execFileSync('git', ['worktree', 'remove', '--force', legacyRoot], {
  cwd: root,
  stdio: 'ignore'
});
legacyWorktreeRegistered = false;
fs.rmSync(temporary, { recursive: true, force: true });
console.log(`\n并行任务协调结果: ${passed} 通过, ${failed} 失败`);
process.exit(failed ? 1 : 0);
