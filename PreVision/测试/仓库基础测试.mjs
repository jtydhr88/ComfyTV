/*
 * 预见 PreVision 仓库基础测试
 * 验证项目交接文档、机器可读 QA 登记、忽略规则和公开提交边界。
 * 只报告风险文件路径与类型，不输出任何可疑内容。
 */
import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) passed++;
  else {
    failed++;
    console.error(`  ✗ FAIL: ${message}`);
  }
}

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

function readJsonYaml(relativePath) {
  try {
    return JSON.parse(read(relativePath));
  } catch {
    assert(false, `${relativePath} 必须是可由 Node 直接解析的 JSON 兼容 YAML 1.2`);
    return null;
  }
}

function gitFiles(args) {
  try {
    const output = execFileSync('git', args, { cwd: root, encoding: 'utf8' });
    return output.split('\0').filter(Boolean);
  } catch {
    assert(false, `git ${args.join(' ')} 无法执行`);
    return [];
  }
}

console.log('· 必需交接文件');
const requiredFiles = [
  'AGENTS.md',
  'docs/INDEX.md',
  'docs/CURRENT_STATE.md',
  'docs/ARCHITECTURE.md',
  'docs/WEB_RUNTIME.md',
  'docs/WEB_PERFORMANCE.md',
  'docs/qa/web-cross-platform-stress/environment-audit.json',
  'docs/qa/web-cross-platform-stress/evidence/macos-chrome-standard.json',
  'docs/DEVELOPMENT_WORKFLOW.md',
  'docs/CODEX_MODEL_ROUTING.md',
  'docs/FEATURE_REGISTRY.md',
  'docs/TEST_STRATEGY.md',
  'docs/KNOWN_ISSUES.md',
  'docs/HISTORICAL_DECISIONS.md',
  'docs/RELEASE_PROCESS.md',
  'docs/CODE_REVIEW.md',
  'docs/TASK_TEMPLATE.md',
  'docs/decisions/README.md',
  'docs/decisions/0005-department-autonomous-dispatch-and-atomic-write-reservations.md',
  'docs/plans/active/README.md',
  'docs/plans/completed/README.md',
  'qa/feature-registry.yaml',
  'qa/core-flows.yaml',
  'qa/test-impact-map.yaml',
  'qa/task-scope-taxonomy.json',
  'qa/i18n-policy.json',
  'qa/local-delivery-policy.json',
  'i18n/locales/zh-CN.js',
  'i18n/locales/en-US.js',
  'i18n/runtime.js',
  'i18n/node.cjs',
  'scripts/update-local-app.mjs',
  'scripts/build-provenance.cjs',
  'scripts/deliver-local-app.mjs',
  'scripts/local-app-status.mjs',
  'scripts/task-coordination.mjs',
  'scripts/web-runtime-lib.mjs',
  'scripts/build-web.mjs',
  'scripts/preview-web.mjs',
  'scripts/web-stress-lib.mjs',
  'scripts/run-web-stress.mjs',
  'web/runtime-contract.json',
  'qa/web-stress-matrix.json',
  'qa/web-stress-evidence-schema.json',
  '测试/国际化测试.mjs',
  '测试/本地应用安装测试.mjs',
  '测试/本地交付门禁测试.mjs',
  '测试/并行任务协调测试.mjs',
  '测试/Web运行底座测试.mjs',
  '测试/Web压力测试工装测试.mjs'
];
requiredFiles.forEach(file => assert(fs.existsSync(path.join(root, file)), `缺少 ${file}`));

console.log('· 固定入口与临时工治理契约');
const agentsPolicy = read('AGENTS.md');
const workflowPolicy = read('docs/DEVELOPMENT_WORKFLOW.md');
const adrPolicy = read('docs/decisions/0005-department-autonomous-dispatch-and-atomic-write-reservations.md');
const modelRoutingPolicy = read('docs/CODEX_MODEL_ROUTING.md');
const reviewPolicy = read('docs/CODE_REVIEW.md');
const taskTemplate = read('docs/TASK_TEMPLATE.md');
const currentState = read('docs/CURRENT_STATE.md');
const coordinationAcceptanceName = '2026-07-16-autonomous-dispatch-model-routing.md';
const coordinationAcceptanceCandidates = [
  `docs/plans/active/${coordinationAcceptanceName}`,
  `docs/plans/completed/${coordinationAcceptanceName}`
].filter(file => fs.existsSync(path.join(root, file)));
assert(coordinationAcceptanceCandidates.length === 1,
  '04.9 验收单必须在 active/completed 中恰有一个 canonical 副本');
const coordinationAcceptancePath = coordinationAcceptanceCandidates[0] || '';
const activeCoordinationAcceptance = coordinationAcceptancePath ? read(coordinationAcceptancePath) : '';
assert(
  (coordinationAcceptancePath.includes('/active/') &&
    activeCoordinationAcceptance.includes('- 状态：active')) ||
  (coordinationAcceptancePath.includes('/completed/') &&
    activeCoordinationAcceptance.includes('- 状态：completed')),
  '04.9 验收单目录必须与其状态字段一致'
);
const lifecycleMatch = activeCoordinationAcceptance.match(/- 权威生命周期：([A-Z_]+)/);
assert(Boolean(lifecycleMatch) &&
  currentState.includes(`处于 ${lifecycleMatch?.[1]}`),
  'CURRENT_STATE 必须与 04.9 canonical 验收单的权威生命周期一致');
const completedIndex = read('docs/plans/completed/README.md');
const completedAcceptanceFiles = fs.readdirSync(path.join(root, 'docs', 'plans', 'completed'))
  .filter(name => name.endsWith('.md') && name !== 'README.md');
assert(completedAcceptanceFiles.every(name => completedIndex.includes(name)),
  '每个 completed 验收单都必须进入 docs/plans/completed/README.md 索引');
const normativePolicies = [agentsPolicy, workflowPolicy, adrPolicy];
const persistedPolicies = [...normativePolicies, currentState];
assert(persistedPolicies.every(content => content.includes('分管自治')), '仓库事实必须一致采用分管自治、中央集成');
assert(normativePolicies.every(content => content.includes('固定 `01`–`04`')), '核心规范必须一致覆盖固定 01–04');
assert(normativePolicies.every(content => content.includes('自治派发')), '固定 01–04 必须可在分管范围自治派发');
assert(normativePolicies.every(content => content.includes('固定 `00`') && content.includes('机械集成')),
  '固定 00 必须只保留中央机械集成与交付职责');
assert(normativePolicies.every(content => content.includes('**MUST NOT**') && content.includes('write claim')),
  '固定 00–04 不得实现或持有 write claim 必须是 MUST NOT 规则');
assert(persistedPolicies.every(content => content.includes('独立短期临时工')), '所有实际开发必须路由到独立短期临时工');
assert(normativePolicies.every(content => content.includes('用户侧栏可见')), '所有实际写任务必须在用户 Codex 项目侧栏可见');
assert(normativePolicies.every(content => content.includes('Codex 项目 Worktree')), '分管入口必须通过 Codex 项目 Worktree 创建写任务');
assert(normativePolicies.every(content => content.includes('侧栏可见任务') &&
  content.includes('侧栏可见运行') && content.includes('DESKTOP_LIVE') &&
  content.includes('BACKGROUND_ONLY')),
  '核心规范必须区分任务条目存在、Desktop 实时运行和后台施工');
assert(normativePolicies.every(content => content.includes('turn/completed') &&
  content.includes('不') && content.includes('Desktop')),
  '核心规范不得把 turn/completed 等同于 Desktop live 或侧栏圆圈');
assert(normativePolicies.every(content => content.includes('内部 collaboration/sub-agent') &&
  content.includes('只读审计、代码审查、测试复核和调研') &&
  content.includes('write claim')),
  '内部 collaboration/sub-agent 只能只读且不得修改、提交或持有写声明');
assert(normativePolicies.every(content => content.includes('不预建空任务')),
  '侧栏可见短期任务必须按需创建');
assert(normativePolicies.every(content => content.includes('reserve') && content.includes('cancel')),
  '核心规范必须覆盖原子 reservation 和侧栏失败补偿');
assert(normativePolicies.every(content => content.includes('停滞') && content.includes('重复任务')),
  '核心规范必须覆盖停滞恢复与重复任务去重');
assert(normativePolicies.every(content => content.includes('active claim') && content.includes('永不自动过期')),
  'active claim 必须明确不受 reservation TTL 影响');
assert(normativePolicies.every(content => content.includes('用户原则上只') &&
  content.includes('大部分时间保持可对话') && content.includes('管理忙')),
  '核心规范必须让用户主要与 00 讨论，并让 01–04 保持管理职责');
assert(normativePolicies.every(content => content.includes('`00`') && content.includes('release') && content.includes('归档')),
  '任务完成或取消后必须由 00 release 并归档侧栏任务');
assert(normativePolicies.every(content => content.includes('WAITING') && content.includes('HANDED_OFF') &&
  content.includes('INTEGRATING') && content.includes('ARCHIVE_PENDING')),
  '核心规范必须持久化可恢复任务生命周期');
assert(normativePolicies.every(content => content.includes('thread/start') &&
  content.includes('thread/name/set') && content.includes('turn/completed')),
  '核心规范必须定义 app-server 侧栏启动和通知消费协议');
assert(normativePolicies.every(content => content.includes('taskId') &&
  content.includes('client') && content.includes('thread')),
  '核心规范必须记录 task/client/thread 去重身份');
assert(workflowPolicy.includes('去敏的真实 ghost 故障样本') &&
  adrPolicy.includes('去敏的真实 ghost 故障样本') &&
  workflowPolicy.includes('heartbeat permission') &&
  workflowPolicy.includes('thread description') &&
  workflowPolicy.includes('thread-client-id') &&
  workflowPolicy.includes('不提交真实 task/thread 标识') &&
  adrPolicy.includes('不保存真实标识'),
  '流程和 ADR 必须以去敏方式覆盖真实 ghost task 三类 renderer atom 故障模式');
assert(reviewPolicy.includes('rollout') && reviewPolicy.includes('thread/list') &&
  reviewPolicy.includes('sidebar atom') && reviewPolicy.includes('renderer 全局状态文件'),
  '评审规范必须检查 ghost task 三方核对且禁止仓库脚本修改全局配置');
assert(reviewPolicy.includes('DESKTOP_LIVE') && reviewPolicy.includes('BACKGROUND_ONLY') &&
  reviewPolicy.includes('圆圈') && reviewPolicy.includes('后台施工'),
  '评审规范必须核查 Desktop live 证据与后台施工降级');
assert(normativePolicies.every(content => content.includes('schemaVersion: 3') &&
  content.includes('legacy write guard') &&
  content.includes('identity') &&
  content.includes('inode')),
  '核心规范必须覆盖严格 v3、旧 writer 护栏和 identity/inode 锁所有权');
assert(normativePolicies.every(content => content.includes('LC_ALL=C') &&
  content.includes('TZ=UTC0') &&
  content.includes('command') && content.includes('argv') &&
  content.includes('ENOENT') && content.includes('ESTALE')),
  '核心规范必须覆盖 locale-independent 无 argv lock identity 与 fd/inode 瞬时重试');
assert(normativePolicies.every(content => content.includes('regular-file') &&
  content.includes('离线') && content.includes('fsync')),
  '核心规范必须禁止 preview guard 在线换型并定义离线迁移边界');
assert(workflowPolicy.includes('persistence=uncertain') &&
  reviewPolicy.includes('persistence=uncertain') &&
  taskTemplate.includes('persistence=confirmed | uncertain'),
  '流程、评审和模板必须覆盖 rename 后目录 fsync 不确定提交的 revision 恢复');
assert(normativePolicies.every(content => content.includes('missing') &&
  content.includes('UNKNOWN') && content.includes('compensation-confirmed')),
  '核心规范必须禁止把 UNKNOWN ghost 状态当作可取消的 absent');
assert(normativePolicies.every(content => content.includes('not-started') &&
  content.includes('started') && content.includes('disconnected')),
  '核心规范必须把 turn 运行状态纳入 ghost cancel 门禁');
assert(normativePolicies.every(content => content.includes('canonical') &&
  content.includes('thread') && content.includes('read claim')),
  '核心规范必须禁止跨 task 复用 canonical thread 且只读 reviewer 不持久化 claim');
assert(normativePolicies.every(content => content.includes('request-key') &&
  content.includes('task:verify-stop') && content.includes('tombstone')),
  '核心规范必须覆盖 stdout 断连恢复、独立停止核验和取消 tombstone');
assert(normativePolicies.every(content => content.includes('migrate-legacy-worktree') &&
  content.includes('common-dir') && content.includes('只读 launcher')),
  '核心规范必须定义旧 Worktree 的显式迁移门禁与 common-dir 稳定只读 launcher');
assert(normativePolicies.every(content => content.includes('ACTIVE-without-claim') &&
  content.includes('停止证据')),
  '核心规范必须让 active orphan 占槽并由 00 以停止证据解决');
assert(reviewPolicy.includes('release outcome/evidence') &&
  workflowPolicy.includes('release evidence') &&
  reviewPolicy.includes('task commit') && reviewPolicy.includes('stable patch-id'),
  '评审与流程必须拒绝缺失或伪造 terminal release evidence');
assert(normativePolicies.every(content => content.includes('固定 `05`') && content.includes('`99`') &&
  content.includes('只读')), '固定 05/99 必须继续只读');
assert(modelRoutingPolicy.includes('R0') && modelRoutingPolicy.includes('R1') &&
  modelRoutingPolicy.includes('R2') && modelRoutingPolicy.includes('R3'),
  '模型路由必须覆盖 R0-R3');
assert(modelRoutingPolicy.includes('Luna') && modelRoutingPolicy.includes('Terra') &&
  modelRoutingPolicy.includes('Sol'), '模型路由必须登记 Luna、Terra、Sol');
const routingRows = new Map(
  modelRoutingPolicy.split(/\r?\n/)
    .filter(line => /^\| R[0-3] \|/.test(line))
    .map(line => {
      const cells = line.split('|').slice(1, -1).map(cell => cell.trim());
      return [cells[0], { model: cells[2], reasoning: cells[3] }];
    })
);
assert(routingRows.get('R0')?.model === 'Luna' &&
  routingRows.get('R0')?.reasoning === 'Medium' &&
  routingRows.get('R1')?.model === 'Terra' &&
  routingRows.get('R1')?.reasoning.includes('Medium') &&
  routingRows.get('R1')?.reasoning.includes('High') &&
  routingRows.get('R2')?.model === 'Sol' &&
  routingRows.get('R2')?.reasoning === 'High' &&
  routingRows.get('R3')?.model === 'Sol' &&
  routingRows.get('R3')?.reasoning === 'XHigh',
  'R0–R3 必须语义映射为 Luna/Medium、Terra/Medium-or-High、Sol/High、Sol/XHigh');
assert(modelRoutingPolicy.includes('Fast/priority 默认关闭') && modelRoutingPolicy.includes('Ultra 默认关闭') &&
  modelRoutingPolicy.includes('标准或 Flex'), '模型路由必须默认关闭 Fast/Ultra 并优先标准/Flex');
assert(modelRoutingPolicy.includes('模型等级') && modelRoutingPolicy.includes('不得作为验收证据'),
  '模型等级不得作为验收证据');
assert(activeCoordinationAcceptance.includes('reasoning（请求）：High（任务启动时用户明确）') &&
  activeCoordinationAcceptance.includes('reasoning（实际）：不可观察，未验证') &&
  activeCoordinationAcceptance.includes('规范默认：R3 使用 Sol/XHigh') &&
  !activeCoordinationAcceptance.includes('按规范提升 reasoning 到 R3 默认 XHigh'),
  '04.9 验收单必须区分用户请求、不可观察的实际 reasoning 与 R3 规范默认，不能伪造运行时升级');
assert(reviewPolicy.includes('独立只读 reviewer') && reviewPolicy.includes('R2/R3 reviewer 不得'),
  '代码评审必须要求独立 reviewer 且 R2/R3 不得降级');
for (const field of ['风险档', '请求模型', '实际模型', '请求 reasoning', '实际 selected reasoning',
  'Fast/priority', 'Ultra',
  '独立只读 reviewer', '权威生命周期', '当前 actor / 下一责任人', '侧栏去重证据',
  '外部三方状态', '执行可见性', 'Desktop live 证据', '失败补偿', '中断/恢复']) {
  assert(taskTemplate.includes(field), `任务模板必须包含 ${field} 字段`);
}

console.log('· QA 登记结构');
const features = readJsonYaml('qa/feature-registry.yaml');
const flows = readJsonYaml('qa/core-flows.yaml');
const impact = readJsonYaml('qa/test-impact-map.yaml');
const taskTaxonomy = readJsonYaml('qa/task-scope-taxonomy.json');
const allowedStatuses = new Set(['VERIFIED', 'IMPLEMENTED_UNVERIFIED', 'PARTIAL', 'PLANNED']);
if (features) {
  assert(features.schemaVersion === 1, '功能登记 schemaVersion 必须为 1');
  assert(Array.isArray(features.features) && features.features.length >= 20, '功能登记必须包含当前主要功能');
  const ids = (features.features || []).map(item => item.id);
  assert(new Set(ids).size === ids.length, '功能登记 ID 必须唯一');
  assert((features.features || []).every(item => item.id && item.module && item.name && allowedStatuses.has(item.status) && Array.isArray(item.evidence)),
    '每个功能必须包含 id、module、name、有效 status 和 evidence');
}
if (flows) {
  assert(flows.schemaVersion === 1, '核心流程 schemaVersion 必须为 1');
  assert(Array.isArray(flows.flows) && flows.flows.length >= 5, '核心流程必须覆盖主要创作与发布路径');
  assert((flows.flows || []).every(flow => flow.id && flow.name && flow.risk && Array.isArray(flow.automated) && Array.isArray(flow.manual)),
    '每个核心流程必须包含风险、自动测试和人工验证');
}
if (taskTaxonomy) {
  assert(taskTaxonomy.schemaVersion === 1, '任务范围分类 schemaVersion 必须为 1');
  assert(taskTaxonomy.maxConcurrentWriteTasks === 2, '单文件架构最多允许两个并行写任务');
  assert(JSON.stringify(taskTaxonomy.dispatchOwners) === JSON.stringify(['01', '02', '03', '04']),
    '自治派发 owner 必须固定为 01–04');
  assert(taskTaxonomy.reservationPolicy?.defaultTtlMinutes === 30 &&
    taskTaxonomy.reservationPolicy?.activeClaimsExpire === false,
    'reservation 默认 TTL 必须为 30 分钟且 active claim 不过期');
  assert(taskTaxonomy.coordinationRegistry?.schemaVersion === 3 &&
    taskTaxonomy.coordinationRegistry?.coordinationVersion === 3,
  '任务范围分类必须声明被协调器消费的严格登记版本');
  assert(JSON.stringify(taskTaxonomy.taskLifecycle?.states) === JSON.stringify([
    'RESERVED', 'WAITING', 'ACTIVE', 'REVIEW', 'HANDED_OFF',
    'INTEGRATING', 'RELEASED', 'ARCHIVE_PENDING', 'ARCHIVED'
  ]), '任务范围分类必须定义完整权威生命周期');
  assert(taskTaxonomy.taskLifecycle?.externalStates?.turn?.includes('disconnected') &&
    taskTaxonomy.taskLifecycle?.externalStates?.sidebar?.includes('stale') &&
    taskTaxonomy.taskLifecycle?.externalStates?.turnOwner?.includes('desktop') &&
    taskTaxonomy.taskLifecycle?.externalStates?.turnOwner?.includes('background') &&
    taskTaxonomy.taskLifecycle?.externalStates?.turnOwner?.includes('none'),
  '任务范围分类必须能表示客户端断连和 ghost sidebar 状态');
  assert(JSON.stringify(taskTaxonomy.taskLifecycle?.executionVisibility?.values) === JSON.stringify([
    'DESKTOP_LIVE', 'BACKGROUND_ONLY', 'WAITING', 'UNKNOWN'
  ]) && taskTaxonomy.taskLifecycle?.executionVisibility?.default === 'UNKNOWN',
  '任务范围分类必须定义 fail-closed 的 execution visibility');
  assert(Array.isArray(taskTaxonomy.modules) && taskTaxonomy.modules.length >= 10, '任务范围必须覆盖主要模块');
  assert(Array.isArray(taskTaxonomy.uiSurfaces) && taskTaxonomy.uiSurfaces.length >= 5, '任务范围必须覆盖主要 UI 表面');
  assert(Array.isArray(taskTaxonomy.dataAreas) && taskTaxonomy.dataAreas.length >= 5, '任务范围必须覆盖主要数据边界');
}

const packageJson = JSON.parse(read('package.json'));
if (impact) {
  assert(impact.schemaVersion === 1, '影响映射 schemaVersion 必须为 1');
  assert(Array.isArray(impact.modules) && impact.modules.length > 0, '影响映射必须包含模块');
  let patternsValid = true;
  for (const module of impact.modules || []) {
    if (!module.id || !Array.isArray(module.patterns) || !Array.isArray(module.commands)) patternsValid = false;
    for (const pattern of module.patterns || []) {
      try { new RegExp(pattern); } catch { patternsValid = false; }
    }
    for (const command of module.commands || []) {
      const match = command.match(/^npm run ([\w:-]+)$/);
      if (!match || !packageJson.scripts[match[1]]) patternsValid = false;
    }
  }
  assert(patternsValid, '影响映射的模块、正则和命令必须有效');
  assert(Array.isArray(impact.fallback?.commands) && impact.fallback.commands.includes('npm run test:full'),
    '无法识别的变化必须回退到全量测试');
  const appModuleEntries = Object.entries(impact.appModules || {});
  const appModulesValid = appModuleEntries.length >= 10 && appModuleEntries.every(([id, config]) => {
    const match = config.command?.match(/^npm run ([\w:-]+) -- ([\w-]+)$/);
    return id && match && packageJson.scripts[match[1]] && match[2] === id && Array.isArray(config.covers) && config.covers.length > 0;
  });
  assert(appModulesValid, '主应用模块测试必须提供有效命令和覆盖说明');
  let runtimeModules = [];
  try {
    runtimeModules = execFileSync(process.execPath, [path.join(root, '测试', '冒烟测试.mjs'), '--list-modules'], {
      cwd: root,
      encoding: 'utf8'
    }).trim().split(/\r?\n/).filter(Boolean).sort();
  } catch {
    // 由下一条断言统一报告，不泄露子进程输出。
  }
  assert(JSON.stringify(runtimeModules) === JSON.stringify(appModuleEntries.map(([id]) => id).sort()),
    '运行时模块列表必须与影响映射完全一致');
}

console.log('· package scripts 与忽略规则');
const requiredScripts = ['test', 'test:core', 'test:module', 'test:app', 'test:desktop', 'test:local-install', 'test:i18n', 'test:web', 'test:web:stress-harness', 'test:coordination', 'test:foundation', 'test:full', 'test:impact', 'web:build', 'web:preview', 'web:stress:check', 'web:stress', 'app:update', 'app:status', 'app:deliver', 'task:status', 'task:check', 'task:reserve', 'task:claim', 'task:transition', 'task:verify-stop', 'task:cancel-reservation', 'task:resolve-integrity', 'task:migrate-legacy-worktree', 'task:release', 'task:archive'];
assert(requiredScripts.every(name => packageJson.scripts[name]), 'package.json 必须提供分层测试命令');
assert(packageJson.private === true, '未选择许可证和发布策略前 package 必须保持 private');
const gitignore = read('.gitignore');
for (const rule of ['node_modules/', 'out/', 'dist/', '.env', '.env.*', '.claude/', '日志/', '*.key', '*.pem', '*.log']) {
  assert(gitignore.includes(rule), `.gitignore 缺少 ${rule}`);
}

console.log('· 提交边界与敏感风险');
const tracked = gitFiles(['ls-files', '-z']);
const publicCandidates = gitFiles(['ls-files', '-co', '--exclude-standard', '-z']);
const forbiddenTracked = tracked.filter(file =>
  /^(node_modules|out|dist|日志|\.claude)(\/|$)/.test(file) ||
  /(^|\/)(\.env(?:\..*)?|CLAUDE\.md)$/.test(file) ||
  /\.(?:p12|pfx|cer|key|pem|log)$/i.test(file)
);
forbiddenTracked.forEach(file => console.error(`  风险文件: ${file} [禁止提交路径或类型]`));
assert(forbiddenTracked.length === 0, 'Git 索引不能包含依赖、构建产物、私有记录、环境文件或密钥材料');

const unexpectedCandidates = publicCandidates.filter(file => /(^|\/)\.DS_Store$/.test(file));
unexpectedCandidates.forEach(file => console.error(`  风险文件: ${file} [系统缓存]`));
assert(unexpectedCandidates.length === 0, '公开候选文件不能包含系统缓存');

const textExtensions = new Set(['', '.cjs', '.css', '.html', '.js', '.json', '.md', '.mjs', '.txt', '.yaml', '.yml']);
const secretPatterns = [
  { type: 'private-key', regex: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/ },
  { type: 'github-token', regex: /(?:ghp|github_pat)_[A-Za-z0-9_]{24,}/ },
  { type: 'openai-style-token', regex: /\bsk-[A-Za-z0-9_-]{20,}\b/ },
  { type: 'aws-access-key', regex: /\bAKIA[A-Z0-9]{16}\b/ }
];
const risks = [];
for (const relativePath of publicCandidates) {
  const fullPath = path.join(root, relativePath);
  let stat;
  try { stat = fs.statSync(fullPath); } catch { continue; }
  if (!stat.isFile()) continue;
  if (stat.size > 20 * 1024 * 1024) risks.push({ file: relativePath, type: '超过 20MB 的公开候选文件' });
  if (stat.size > 5 * 1024 * 1024 || !textExtensions.has(path.extname(relativePath).toLowerCase())) continue;
  const content = fs.readFileSync(fullPath, 'utf8');
  if (/\/Users\/[^/]+\//.test(content) || /[A-Za-z]:\\Users\\[^\\]+\\/.test(content) || /\/var\/folders\//.test(content)) {
    risks.push({ file: relativePath, type: '本机绝对路径' });
  }
  for (const pattern of secretPatterns) {
    if (pattern.regex.test(content)) risks.push({ file: relativePath, type: pattern.type });
  }
}
risks.forEach(risk => console.error(`  风险文件: ${risk.file} [${risk.type}]`));
assert(risks.length === 0, '公开候选文件不能包含大型产物、本机绝对路径或高置信度密钥');

console.log(`\n仓库基础结果: ${passed} 通过, ${failed} 失败`);
process.exit(failed ? 1 : 0);
