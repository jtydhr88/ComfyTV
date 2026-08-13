import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = name => fs.readFileSync(path.join(root, name), 'utf8');
let passed = 0;
let failed = 0;
const assert = (condition, message) => {
  if (condition) passed += 1;
  else { failed += 1; console.error('  ✗ FAIL: ' + message); }
};

const pkg = JSON.parse(read('package.json'));
const main = read('electron/main.cjs');
const preload = read('electron/preload.cjs');
const forge = read('forge.config.cjs');
const html = read('预见PreVision.html');

console.log('· Electron 桌面壳结构');
assert(pkg.main === 'electron/main.cjs', 'package 主进程入口正确');
assert(pkg.devDependencies.electron && pkg.devDependencies['@electron-forge/cli'], 'Electron 与 Forge 版本已固定');
assert(pkg.scripts.start === 'electron-forge start' && pkg.scripts.make, '开发启动与发行打包脚本存在');
assert(pkg.scripts.package.includes('--platform=darwin') && pkg.scripts.package.includes('--arch=arm64'), '本机 App 构建显式锁定 macOS Apple Silicon');
assert(pkg.scripts['app:update'] === 'node scripts/update-local-app.mjs' && pkg.scripts['test:local-install'], '固定本机 App 更新与回归命令存在');
assert(fs.existsSync(path.join(root, 'forge.config.cjs')), 'Forge 配置存在');
assert(forge.includes("new MakerZIP({}, ['darwin'])") && !forge.includes('MakerSquirrel'), '当前打包范围仅保留 macOS，暂停 Windows 构建依赖');
assert(forge.includes("icon: './assets/PreVisionIcon.icns'") && fs.existsSync(path.join(root, 'assets/PreVisionIcon.icns')), 'macOS 应用包使用预见品牌图标');
assert(html.includes('class="app-brand"') && html.includes('assets/PreVisionIcon-128.png') && fs.existsSync(path.join(root, 'assets/PreVisionIcon-128.png')), '应用左上角使用同一品牌图标');
assert(fs.existsSync(path.join(root, 'vendor/html2canvas.min.js')), '离线工作区录制依赖会随应用分发');

console.log('· Electron 安全与生命周期');
assert(main.includes('contextIsolation: true') && main.includes('nodeIntegration: false'), '渲染器启用上下文隔离并关闭 Node 注入');
assert(main.includes("setWindowOpenHandler") && main.includes("will-navigate"), '阻止应用内任意新窗口和页面跳转');
assert(main.includes("app.on('window-all-closed'") && main.includes("app.on('activate'"), 'macOS 窗口关闭与重新激活生命周期已处理');
assert(!preload.includes('exposeInMainWorld(\'electron\'') && preload.includes("exposeInMainWorld('previsionDesktop'"), '预加载仅暴露受限预见 API');

console.log('· 原生文件桥接');
assert(main.includes("ipcMain.handle('project:save'") && main.includes("ipcMain.handle('project:open'"), '项目原生打开/保存 IPC 存在');
assert(main.includes("ipcMain.handle('export:save'") && main.includes("t('desktop.path.productFolder')") && main.includes("t('desktop.path.exportFolder')"), '导出写入统一文档目录');
assert(main.includes("require('../i18n/node.cjs')") && main.includes("t('desktop.menu.openProject')"), 'Electron 用户界面文案通过 language key 获取');
assert(main.includes("ipcMain.handle('capture:choose-target'") && main.includes('showSaveDialog'), '截图与录屏先通过系统对话框选择保存位置');
assert(main.includes("ipcMain.handle('capture:save-target'") && main.includes("ipcMain.handle('workspace:capture'") && main.includes('capturePage()'), '桌面捕获仅写入一次性授权目标');
assert(/CAPTURE_GRANT_TTL_MS\s*=\s*12\s*\*\s*60\s*\*\s*60\s*\*\s*1000/.test(main) && main.includes('withCaptureExtension'), '捕获授权覆盖长录屏时长且保存路径强制匹配实际文件后缀');
assert(preload.includes('chooseCaptureTarget:') && preload.includes('saveCaptureTarget:') && preload.includes('captureWorkspace:'), '受限桥接覆盖捕获目标选择、写入和工作区截图');
assert(html.includes('const desktop=window.previsionDesktop||null') && html.includes('desktop.saveProject') && html.includes('desktop.saveExport'), '现有编辑器已接入桌面桥接并保留浏览器回退');
assert(main.includes("accelerator: 'CmdOrCtrl+O'")&&main.includes("accelerator: 'CmdOrCtrl+S'")&&
  html.includes('bridge.onMenuOpenProject(()=>runWorkspaceCommand(commands.open))')&&
  html.includes('bridge.onMenuSaveProject(()=>runWorkspaceCommand(commands.save))'),
  'Electron 项目 open/save accelerator 进入 renderer 后复用 modal 命令所有权门禁');
const desktopBindingSource=html.match(/function bindDesktopProjectCommands\(bridge=desktop,commands=\{open:openDesktopProject,save:saveProjectFile\}\)\{[\s\S]*?\n\}/)?.[0];
assert(!!desktopBindingSource,'可提取 renderer Electron 项目命令绑定入口做执行回归');
if(desktopBindingSource){
  const callbacks={},calls=[];
  let modalOpen=true;
  const mockBridge={
    onMenuOpenProject(callback){callbacks.open=callback;},
    onMenuSaveProject(callback){callbacks.save=callback;},
  };
  const commands={open:()=>calls.push('open'),save:()=>calls.push('save')};
  vm.runInNewContext(`${desktopBindingSource}\nbindDesktopProjectCommands(mockBridge,commands);`,{
    mockBridge,commands,runWorkspaceCommand(command){return modalOpen?false:command();},
  });
  callbacks.open();callbacks.save();
  assert(calls.length===0,'modal 打开时 renderer 实际注册的 Electron open/save 回调均不执行项目命令');
  modalOpen=false;callbacks.open();callbacks.save();
  assert(JSON.stringify(calls)===JSON.stringify(['open','save']),'modal 关闭后同一组 Electron open/save 回调恢复既有项目命令');
}
assert(html.includes('id="desktopBadge"') && html.includes('DESKTOP'), '桌面运行状态在界面可识别');

console.log('· 捕获保存授权');
const captureHandlers = new Map();
const saveDialogQueue = [];
const saveDialogCalls = [];
const captureWrites = [];
let capturePageCalls = 0;
let captureTokenIndex = 0;
let captureNow = 1_000_000;
let nextCaptureWriteError = null;
class CaptureDate extends Date { static now() { return captureNow; } }
const fakeCaptureFs = {
  mkdir: async () => {},
  access: async () => { throw new Error('ENOENT'); },
  writeFile: async (target, bytes) => {
    if (nextCaptureWriteError) { const error = nextCaptureWriteError; nextCaptureWriteError = null; throw error; }
    captureWrites.push({ target, bytes: Array.from(bytes) });
  },
  readFile: async () => ''
};
function FakeBrowserWindow() {}
FakeBrowserWindow.fromWebContents = sender => sender.testWindow;
FakeBrowserWindow.getAllWindows = () => [];
const fakeElectron = {
  app: {
    setName: () => {},
    getPath: name => `/virtual/${name}`,
    whenReady: () => ({ then: () => {} }),
    on: () => {},
    quit: () => {}
  },
  BrowserWindow: FakeBrowserWindow,
  dialog: {
    showSaveDialog: async (owner, options) => {
      saveDialogCalls.push({ owner, options });
      return saveDialogQueue.shift() || { canceled: true };
    },
    showOpenDialog: async () => ({ canceled: true, filePaths: [] })
  },
  ipcMain: { handle: (channel, handler) => captureHandlers.set(channel, handler) },
  Menu: { setApplicationMenu: () => {}, buildFromTemplate: template => template },
  shell: { openPath: async () => {}, openExternal: async () => {} }
};
vm.runInNewContext(main, {
  require: specifier => {
    if (specifier === 'electron') return fakeElectron;
    if (specifier === 'node:path') return path;
    if (specifier === 'node:fs/promises') return fakeCaptureFs;
    if (specifier === 'node:crypto') return { randomUUID: () => `capture-token-${++captureTokenIndex}` };
    if (specifier === '../i18n/node.cjs') return { t: key => key };
    throw new Error(`Unexpected main require: ${specifier}`);
  },
  __dirname: path.join(root, 'electron'),
  __filename: path.join(root, 'electron/main.cjs'),
  console,
  process,
  Date: CaptureDate,
  Uint8Array
});

const captureImageBytes = new Uint8Array([137, 80, 78, 71]);
const ownerWindow = { webContents: { capturePage: async () => {
  capturePageCalls += 1;
  return { toPNG: () => captureImageBytes };
} } };
const ownerEvent = { sender: { id: 41, testWindow: ownerWindow } };
const otherEvent = { sender: { id: 42, testWindow: ownerWindow } };
const chooseCaptureTarget = captureHandlers.get('capture:choose-target');
const saveCaptureTarget = captureHandlers.get('capture:save-target');
const captureWorkspace = captureHandlers.get('workspace:capture');
assert(typeof chooseCaptureTarget === 'function' && typeof saveCaptureTarget === 'function' && typeof captureWorkspace === 'function', '捕获三段式 IPC 处理器均已注册');

let invalidKindRejected = false;
try { await chooseCaptureTarget(ownerEvent, { kind: 'document', suggestedName: 'bad.bin' }); }
catch (error) { invalidKindRejected = error.message === 'desktop.error.captureTargetInvalid'; }
assert(invalidKindRejected && saveDialogCalls.length === 0, '未知捕获类型在打开对话框前被拒绝');

saveDialogQueue.push({ canceled: true });
const canceledCapture = await chooseCaptureTarget(ownerEvent, { kind: 'screenshot', suggestedName: '../unsafe?.png' });
const writesBeforeCanceledUse = captureWrites.length;
let canceledGrantRejected = false;
try { await saveCaptureTarget(ownerEvent, { token: canceledCapture.token, bytes: new Uint8Array([1]) }); }
catch (error) { canceledGrantRejected = error.message === 'desktop.error.captureTargetInvalid'; }
assert(canceledCapture.canceled === true && canceledGrantRejected && captureWrites.length === writesBeforeCanceledUse, '取消保存对话框不产生 grant 也不写入文件');
assert(saveDialogCalls[0].options.title === 'desktop.dialog.saveScreenshot' && saveDialogCalls[0].options.filters[0].name === 'desktop.filter.png', '截图对话框使用主进程国际化标题与 PNG 过滤器');
assert(path.basename(saveDialogCalls[0].options.defaultPath) === 'unsafe_.png', '捕获建议文件名通过 safeName 清理');

const recordingPath = '/chosen/PreVision_record.mp4';
saveDialogQueue.push({ canceled: false, filePath: recordingPath });
const recordingGrant = await chooseCaptureTarget(ownerEvent, { kind: 'recording', suggestedName: 'PreVision_record.mp4' });
assert(recordingGrant.canceled === false && recordingGrant.token === 'capture-token-1' && recordingGrant.path === recordingPath, '录屏目标返回随机一次性 token 与授权路径');
assert(saveDialogCalls[1].options.title === 'desktop.dialog.saveRecording' && saveDialogCalls[1].options.filters[0].name === 'desktop.filter.video', '录屏对话框使用主进程国际化标题与视频过滤器');

const capturesBeforeWrongKind = capturePageCalls;
let wrongKindRejected = false;
try { await captureWorkspace(ownerEvent, recordingGrant.token); }
catch (error) { wrongKindRejected = error.message === 'desktop.error.captureTargetInvalid'; }
assert(wrongKindRejected && capturePageCalls === capturesBeforeWrongKind, '录屏 grant 不能越权调用工作区截图，且在 capturePage 前拒绝');

let otherSenderRejected = false;
try { await saveCaptureTarget(otherEvent, { token: recordingGrant.token, bytes: new Uint8Array([1, 2]) }); }
catch (error) { otherSenderRejected = error.message === 'desktop.error.captureTargetInvalid'; }
assert(otherSenderRejected && captureWrites.length === 0, 'grant 绑定创建它的 renderer 且越权尝试不消费 token');
await saveCaptureTarget(ownerEvent, { token: recordingGrant.token, bytes: new Uint8Array([3, 4, 5]) });
let reusedGrantRejected = false;
try { await saveCaptureTarget(ownerEvent, { token: recordingGrant.token, bytes: new Uint8Array([6]) }); }
catch (error) { reusedGrantRejected = error.message === 'desktop.error.captureTargetInvalid'; }
assert(captureWrites.length === 1 && captureWrites[0].target === recordingPath && captureWrites[0].bytes.join(',') === '3,4,5', '录屏字节仅写入系统对话框授权的路径');
assert(reusedGrantRejected && captureWrites.length === 1, 'grant 成功写入后立即消费，不可重放');

const screenshotPath = '/chosen/PreVision_workspace.png';
saveDialogQueue.push({ canceled: false, filePath: '/chosen/PreVision_workspace' });
const screenshotGrant = await chooseCaptureTarget(ownerEvent, { kind: 'screenshot', suggestedName: 'PreVision_workspace.png' });
const screenshotResult = await captureWorkspace(ownerEvent, screenshotGrant.token);
let reusedScreenshotRejected = false;
try { await captureWorkspace(ownerEvent, screenshotGrant.token); }
catch (error) { reusedScreenshotRejected = error.message === 'desktop.error.captureTargetInvalid'; }
assert(screenshotGrant.path === screenshotPath && screenshotResult.path === screenshotPath && capturePageCalls === 1 && captureWrites[1].target === screenshotPath, '工作区 capturePage 仅写入预先授权的截图路径，并在用户省略时补齐 PNG 后缀');
assert(reusedScreenshotRejected && capturePageCalls === 1, '工作区截图同样不可重放已消费 token');

saveDialogQueue.push({ canceled: false, filePath: '/chosen/custom-name.mov' });
const normalizedRecordingGrant = await chooseCaptureTarget(ownerEvent, { kind: 'recording', suggestedName: 'PreVision_record.webm' });
assert(normalizedRecordingGrant.path === '/chosen/custom-name.webm' && saveDialogCalls.at(-1).options.filters[0].extensions.join(',') === 'webm',
  '录屏保存路径会把用户输入的其他后缀规范为实际预选容器');
nextCaptureWriteError = new Error('disk full');
let writeFailed = false;
try { await saveCaptureTarget(ownerEvent, { token: normalizedRecordingGrant.token, bytes: new Uint8Array([9]) }); }
catch (error) { writeFailed = error.message === 'disk full'; }
let failedWriteReplayRejected = false;
try { await saveCaptureTarget(ownerEvent, { token: normalizedRecordingGrant.token, bytes: new Uint8Array([9]) }); }
catch (error) { failedWriteReplayRejected = error.message === 'desktop.error.captureTargetInvalid'; }
assert(writeFailed && failedWriteReplayRejected, '写入失败仍消费一次性 grant，避免批准路径被重复利用');

saveDialogQueue.push({ canceled: false, filePath: '/chosen/expired.png' });
const expiringGrant = await chooseCaptureTarget(ownerEvent, { kind: 'screenshot', suggestedName: 'expired.png' });
captureNow += 12 * 60 * 60 * 1000 + 1;
let expiredGrantRejected = false;
try { await saveCaptureTarget(ownerEvent, { token: expiringGrant.token, bytes: new Uint8Array([1]) }); }
catch (error) { expiredGrantRejected = error.message === 'desktop.error.captureTargetInvalid'; }
assert(expiredGrantRejected, '捕获 grant 在长录屏窗口之后按真实时间过期，不能继续写入');

const bridgeInvocations = [];
let bridgedApi = null;
vm.runInNewContext(preload, {
  require: specifier => {
    if (specifier !== 'electron') throw new Error(`Unexpected preload require: ${specifier}`);
    return {
      contextBridge: { exposeInMainWorld: (name, api) => { if (name === 'previsionDesktop') bridgedApi = api; } },
      ipcRenderer: {
        invoke: (channel, payload) => { bridgeInvocations.push({ channel, payload }); return Promise.resolve({}); },
        on: () => {}
      }
    };
  },
  process
});
await bridgedApi.chooseCaptureTarget('screenshot', 'shot.png');
await bridgedApi.saveCaptureTarget('token', new Uint8Array([7]));
await bridgedApi.captureWorkspace('token');
assert(Object.isFrozen(bridgedApi) && !('ipcRenderer' in bridgedApi) && !('invoke' in bridgedApi), '预加载桥接仅暴露冻结的受限 API');
assert(bridgeInvocations.map(call => call.channel).join(',') === 'capture:choose-target,capture:save-target,workspace:capture', '捕获桥接只路由到三个白名单 IPC 通道');

console.log('· JavaScript 语法');
for (const file of ['electron/main.cjs', 'electron/preload.cjs']) {
  const checked = spawnSync(process.execPath, ['--check', path.join(root, file)], { encoding: 'utf8' });
  assert(checked.status === 0, `${file} 语法检查通过${checked.stderr ? ': ' + checked.stderr : ''}`);
}

console.log(`\n桌面壳结果: ${passed} 通过, ${failed} 失败`);
if (failed) process.exit(1);
