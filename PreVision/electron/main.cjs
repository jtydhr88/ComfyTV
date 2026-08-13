const { app, BrowserWindow, dialog, ipcMain, Menu, shell } = require('electron');
const { randomUUID } = require('node:crypto');
const path = require('node:path');
const fs = require('node:fs/promises');
const { t } = require('../i18n/node.cjs');

app.setName(t('app.brand'));

let mainWindow = null;
const CAPTURE_GRANT_TTL_MS = 12 * 60 * 60 * 1000;
const captureGrants = new Map();

const captureKinds = Object.freeze({
  screenshot: Object.freeze({
    fallbackName: 'PreVision_workspace.png',
    titleKey: 'desktop.dialog.saveScreenshot',
    filterKey: 'desktop.filter.png',
    extensions: ['png']
  }),
  recording: Object.freeze({
    fallbackName: 'PreVision_workspace_record.webm',
    titleKey: 'desktop.dialog.saveRecording',
    filterKey: 'desktop.filter.video',
    extensions: ['mp4', 'webm']
  })
});

function safeName(name, fallback = 'PreVision-export.bin') {
  const base = path.basename(String(name || fallback)).replace(/[\\/:*?"<>|\u0000-\u001F]/g, '_').trim();
  return base || fallback;
}

function captureExtension(config, suggestedName) {
  const requested = path.extname(suggestedName).slice(1).toLowerCase();
  return config.extensions.includes(requested) ? requested : config.extensions[0];
}

function withCaptureExtension(filePath, extension) {
  const parsed = path.parse(filePath);
  if (parsed.ext.toLowerCase() === `.${extension}`) return filePath;
  return path.join(parsed.dir, `${parsed.name}.${extension}`);
}

function exportDirectory() {
  return path.join(app.getPath('documents'), t('desktop.path.productFolder'), t('desktop.path.exportFolder'));
}

async function ensureExportDirectory() {
  const dir = exportDirectory();
  await fs.mkdir(dir, { recursive: true });
  return dir;
}

async function uniquePath(dir, filename) {
  const parsed = path.parse(filename);
  let target = path.join(dir, filename);
  for (let index = 1; index < 10000; index += 1) {
    try {
      await fs.access(target);
      target = path.join(dir, `${parsed.name} (${index})${parsed.ext}`);
    } catch {
      return target;
    }
  }
  throw new Error(t('desktop.error.uniqueExportName'));
}

function invalidCaptureTargetError() {
  return new Error(t('desktop.error.captureTargetInvalid'));
}

function pruneCaptureGrants(now = Date.now()) {
  for (const [token, grant] of captureGrants) {
    if (grant.expiresAt <= now) captureGrants.delete(token);
  }
}

function consumeCaptureGrant(event, token, expectedKind = null) {
  const normalizedToken = typeof token === 'string' ? token : '';
  const grant = captureGrants.get(normalizedToken);
  const now = Date.now();
  if (grant?.expiresAt <= now) captureGrants.delete(normalizedToken);
  if (!grant || grant.expiresAt <= now || grant.senderId !== event.sender.id || (expectedKind && grant.kind !== expectedKind)) {
    throw invalidCaptureTargetError();
  }
  captureGrants.delete(normalizedToken);
  return grant;
}

function createMenu() {
  const isMac = process.platform === 'darwin';
  const template = [
    ...(isMac ? [{
      label: t('desktop.menu.app'),
      submenu: [
        { role: 'about', label: t('desktop.menu.aboutApp') },
        { type: 'separator' },
        { role: 'hide', label: t('desktop.menu.hideApp') },
        { role: 'hideOthers', label: t('desktop.menu.hideOthers') },
        { role: 'unhide', label: t('desktop.menu.unhide') },
        { type: 'separator' },
        { role: 'quit', label: t('desktop.menu.quitApp') }
      ]
    }] : []),
    {
      label: t('desktop.menu.file'),
      submenu: [
        { label: t('desktop.menu.openProject'), accelerator: 'CmdOrCtrl+O', click: () => mainWindow?.webContents.send('menu:open-project') },
        { label: t('desktop.menu.saveProject'), accelerator: 'CmdOrCtrl+S', click: () => mainWindow?.webContents.send('menu:save-project') },
        { type: 'separator' },
        { label: t('desktop.menu.openExportFolder'), click: async () => shell.openPath(await ensureExportDirectory()) },
        ...(!isMac ? [{ type: 'separator' }, { role: 'quit', label: t('desktop.menu.quit') }] : [])
      ]
    },
    { role: 'editMenu', label: t('desktop.menu.edit') },
    {
      label: t('desktop.menu.view'),
      submenu: [
        { role: 'reload', label: t('desktop.menu.reload') },
        { role: 'forceReload', label: t('desktop.menu.forceReload') },
        { role: 'toggleDevTools', label: t('desktop.menu.developerTools') },
        { type: 'separator' },
        { role: 'resetZoom', label: t('desktop.menu.actualSize') },
        { role: 'zoomIn', label: t('desktop.menu.zoomIn') },
        { role: 'zoomOut', label: t('desktop.menu.zoomOut') },
        { type: 'separator' },
        { role: 'togglefullscreen', label: t('desktop.menu.toggleFullscreen') }
      ]
    },
    { role: 'windowMenu', label: t('desktop.menu.window') }
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1680,
    height: 1050,
    minWidth: 1100,
    minHeight: 700,
    title: t('desktop.window.title'),
    backgroundColor: '#0C0D10',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      spellcheck: false
    }
  });

  mainWindow.loadFile(path.join(__dirname, '..', '预见PreVision.html'));
  mainWindow.once('ready-to-show', () => mainWindow?.show());
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/i.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  mainWindow.webContents.on('will-navigate', event => event.preventDefault());
  mainWindow.on('closed', () => { mainWindow = null; });
}

ipcMain.handle('desktop:get-paths', async () => ({
  exports: await ensureExportDirectory(),
  userData: app.getPath('userData'),
  documents: app.getPath('documents')
}));

ipcMain.handle('project:save', async (event, payload = {}) => {
  const suggestedName = safeName(payload.suggestedName, t('desktop.file.untitledProject'));
  const result = await dialog.showSaveDialog(BrowserWindow.fromWebContents(event.sender), {
    title: t('desktop.dialog.saveProject'),
    defaultPath: path.join(app.getPath('documents'), suggestedName),
    filters: [
      { name: t('desktop.filter.project'), extensions: ['json', 'previz'] },
      { name: t('desktop.filter.allFiles'), extensions: ['*'] }
    ]
  });
  if (result.canceled || !result.filePath) return { canceled: true };
  await fs.writeFile(result.filePath, String(payload.contents || ''), 'utf8');
  return { canceled: false, path: result.filePath };
});

ipcMain.handle('project:open', async event => {
  const result = await dialog.showOpenDialog(BrowserWindow.fromWebContents(event.sender), {
    title: t('desktop.dialog.openProject'),
    properties: ['openFile'],
    filters: [
      { name: t('desktop.filter.project'), extensions: ['json', 'previz'] },
      { name: t('desktop.filter.allFiles'), extensions: ['*'] }
    ]
  });
  if (result.canceled || !result.filePaths[0]) return { canceled: true };
  const filePath = result.filePaths[0];
  return { canceled: false, path: filePath, contents: await fs.readFile(filePath, 'utf8') };
});

ipcMain.handle('export:save', async (event, payload = {}) => {
  const dir = await ensureExportDirectory();
  const target = await uniquePath(dir, safeName(payload.name));
  const bytes = payload.bytes instanceof Uint8Array ? payload.bytes : new Uint8Array(payload.bytes || []);
  await fs.writeFile(target, bytes);
  return { canceled: false, path: target };
});

ipcMain.handle('capture:choose-target', async (event, payload = {}) => {
  const kind = typeof payload.kind === 'string' ? payload.kind : '';
  const config = captureKinds[kind];
  if (!config) throw invalidCaptureTargetError();
  pruneCaptureGrants();
  const dir = await ensureExportDirectory();
  const suggestedName = safeName(payload.suggestedName, config.fallbackName);
  const extension = captureExtension(config, suggestedName);
  const result = await dialog.showSaveDialog(BrowserWindow.fromWebContents(event.sender), {
    title: t(config.titleKey),
    defaultPath: path.join(dir, suggestedName),
    filters: [{ name: t(config.filterKey), extensions: [extension] }]
  });
  if (result.canceled || !result.filePath) return { canceled: true };
  const targetPath = withCaptureExtension(result.filePath, extension);
  const token = randomUUID();
  captureGrants.set(token, {
    senderId: event.sender.id,
    kind,
    path: targetPath,
    expiresAt: Date.now() + CAPTURE_GRANT_TTL_MS
  });
  return { canceled: false, token, path: targetPath };
});

ipcMain.handle('capture:save-target', async (event, payload = {}) => {
  const grant = consumeCaptureGrant(event, payload.token);
  const bytes = payload.bytes instanceof Uint8Array ? payload.bytes : new Uint8Array(payload.bytes || []);
  await fs.writeFile(grant.path, bytes);
  return { canceled: false, path: grant.path };
});

ipcMain.handle('workspace:capture', async (event, token) => {
  const grant = consumeCaptureGrant(event, token, 'screenshot');
  const win = BrowserWindow.fromWebContents(event.sender);
  const image = await win.webContents.capturePage();
  await fs.writeFile(grant.path, image.toPNG());
  return { canceled: false, path: grant.path };
});

app.whenReady().then(() => {
  createMenu();
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
