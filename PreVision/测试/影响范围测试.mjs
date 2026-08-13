/*
 * 根据 Git 变化和 qa/test-impact-map.yaml 选择最小安全测试范围。
 * 用法:
 *   npm run test:impact
 *   npm run test:impact -- --base main
 *   npm run test:impact -- --base main --module camera
 *   npm run test:impact -- --base main --dry-run
 */
import fs from 'fs';
import path from 'path';
import { execFileSync, spawnSync } from 'child_process';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const baseIndex = args.indexOf('--base');
const base = baseIndex >= 0 ? args[baseIndex + 1] : null;
const moduleIndex = args.indexOf('--module');
const requestedModule = moduleIndex >= 0 ? args[moduleIndex + 1] : null;
const dryRun = args.includes('--dry-run') || args.includes('--list-only');

function gitPaths(gitArgs, required = true) {
  try {
    return execFileSync('git', gitArgs, { cwd: root, encoding: 'utf8' }).split('\0').filter(Boolean);
  } catch (error) {
    if (required) {
      console.error(`无法执行 git ${gitArgs.join(' ')}。请检查基线提交或分支是否存在。`);
      process.exit(2);
    }
    return [];
  }
}

if (baseIndex >= 0 && !base) {
  console.error('--base 后必须提供提交或分支名称。');
  process.exit(2);
}

const changed = new Set();
if (base) gitPaths(['diff', '--name-only', '-z', `${base}...HEAD`]).forEach(file => changed.add(file));
gitPaths(['diff', '--name-only', '-z', 'HEAD']).forEach(file => changed.add(file));
gitPaths(['ls-files', '--others', '--exclude-standard', '-z']).forEach(file => changed.add(file));

const files = [...changed].sort();
if (files.length === 0) {
  console.log('没有检测到相对当前基线的文件变化；无需运行影响测试。');
  process.exit(0);
}

const map = JSON.parse(fs.readFileSync(path.join(root, 'qa', 'test-impact-map.yaml'), 'utf8'));
if (moduleIndex >= 0 && (!requestedModule || !map.appModules?.[requestedModule])) {
  console.error(`未知主应用模块: ${requestedModule || '(空)'}。可用模块: ${Object.keys(map.appModules || {}).join(', ')}`);
  process.exit(2);
}
const selectedModules = new Map();
const unknownFiles = [];
let buildRequired = false;

for (const file of files) {
  const matches = map.modules.filter(candidate => candidate.patterns.some(pattern => new RegExp(pattern).test(file)));
  if (!matches.length) unknownFiles.push(file);
  else {
    matches.forEach(module => {
      for (const appModule of module.appModules || []) {
        if (!map.appModules?.[appModule]?.command) {
          console.error(`影响映射 ${module.id} 引用了未知主应用模块: ${appModule}`);
          process.exit(2);
        }
      }
      selectedModules.set(module.id, module);
      if (module.buildRequired) buildRequired = true;
    });
  }
}

let commands;
if (unknownFiles.length) {
  commands = [...map.fallback.commands];
} else {
  const commandSet = new Set();
  selectedModules.forEach(module => {
    module.commands.forEach(command => commandSet.add(command));
    (module.appModules || []).forEach(appModule => commandSet.add(map.appModules[appModule].command));
  });
  if (requestedModule && selectedModules.has('main-app') && !selectedModules.has('app-test')) {
    commandSet.delete('npm run test:app');
    commandSet.add(map.appModules[requestedModule].command);
  }
  const preferredOrder = ['npm run test:app', 'npm run test:desktop', 'npm run test:local-install', 'npm run test:foundation'];
  const rank = command => {
    if (command.startsWith('npm run test:module -- ')) return 0;
    const index = preferredOrder.indexOf(command);
    return index < 0 ? 99 : index + 1;
  };
  commands = [...commandSet].sort((a, b) => {
    return rank(a) - rank(b) || a.localeCompare(b);
  });
}

console.log(`检测到 ${files.length} 个变化文件。`);
console.log(`命中模块: ${[...selectedModules.keys()].join(', ') || '无'}`);
if (requestedModule) {
  console.log(selectedModules.has('main-app') && !selectedModules.has('app-test')
    ? `主应用范围: ${requestedModule}（使用模块测试）`
    : `主应用范围参数: ${requestedModule}（当前变化不允许替代完整应用测试）`);
}
if (unknownFiles.length) {
  console.log('未识别文件（已升级为全量回归）:');
  unknownFiles.forEach(file => console.log(`  - ${file}`));
}
console.log('将运行:');
commands.forEach(command => console.log(`  - ${command}`));
if (buildRequired) console.log('提示: 构建配置或资源有变化，发布前还必须执行 RELEASE_PROCESS.md 的构建与真机检查。');

if (dryRun) process.exit(0);

for (const command of commands) {
  const started = Date.now();
  const result = spawnSync(command, { cwd: root, shell: true, stdio: 'inherit', env: process.env });
  const seconds = ((Date.now() - started) / 1000).toFixed(2);
  if (result.status !== 0) {
    console.error(`影响测试失败: ${command}（${seconds}s，退出码 ${result.status ?? 'unknown'}）`);
    process.exit(result.status || 1);
  }
  console.log(`影响测试通过: ${command}（${seconds}s）`);
}
