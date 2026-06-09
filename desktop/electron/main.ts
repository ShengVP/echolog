// Electron 主进程 —— 创建窗口 + 注册 IPC handler + native menu + 窗口状态持久化
import { app, BrowserWindow, ipcMain, shell, Menu, MenuItemConstructorOptions, dialog } from 'electron';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { registerIpcHandlers } from './ipc';
import { initUpdater, manualCheckForUpdates, quitAndInstall } from './updater';

const dirname = typeof __dirname !== 'undefined'
  ? __dirname
  : path.dirname(fileURLToPath(import.meta.url));

// 项目根目录定位：
//   - 显式 ECHOLOG_ROOT env 优先
//   - 打包后（.app 在 /Applications）默认指向 ~/echolog（源码安装位置）
//   - 开发态用相对路径（desktop 的上级 = 仓库根）
const PROJECT_ROOT = process.env.ECHOLOG_ROOT
  || (app.isPackaged ? path.join(app.getPath('home'), 'echolog') : path.resolve(dirname, '..', '..'));
process.env.ECHOLOG_ROOT = PROJECT_ROOT;

const isDev = !!process.env.VITE_DEV_SERVER_URL;
let mainWindow: BrowserWindow | null = null;

// ============================================================================
// 窗口状态持久化（位置 / 尺寸）—— 存到 userData/window-state.json
// ============================================================================
interface WindowState { x?: number; y?: number; width: number; height: number; isMaximized?: boolean }

function loadWindowState(): WindowState {
  try {
    const fp = path.join(app.getPath('userData'), 'window-state.json');
    if (fs.existsSync(fp)) {
      const s = JSON.parse(fs.readFileSync(fp, 'utf8'));
      if (typeof s.width === 'number' && typeof s.height === 'number') return s;
    }
  } catch {}
  return { width: 1280, height: 820 };
}

function saveWindowState(win: BrowserWindow) {
  try {
    const fp = path.join(app.getPath('userData'), 'window-state.json');
    const bounds = win.getBounds();
    const s: WindowState = {
      x: bounds.x,
      y: bounds.y,
      width: bounds.width,
      height: bounds.height,
      isMaximized: win.isMaximized(),
    };
    fs.mkdirSync(path.dirname(fp), { recursive: true });
    fs.writeFileSync(fp, JSON.stringify(s, null, 2));
  } catch (err) {
    console.error('[saveWindowState]', err);
  }
}

// ============================================================================
// 窗口创建
// ============================================================================
function createWindow() {
  const ws = loadWindowState();
  mainWindow = new BrowserWindow({
    x: ws.x,
    y: ws.y,
    width: ws.width,
    height: ws.height,
    minWidth: 960,
    minHeight: 640,
    titleBarStyle: 'hiddenInset',
    backgroundColor: '#09090b',
    webPreferences: {
      preload: path.join(dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });
  if (ws.isMaximized) mainWindow.maximize();

  if (isDev && process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    mainWindow.loadFile(path.join(dirname, '..', 'dist', 'index.html'));
  }

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  // 持久化窗口状态（debounce 简单实现：每次 resize/move 都写）
  let saveTimer: NodeJS.Timeout | null = null;
  const scheduleSave = () => {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => mainWindow && saveWindowState(mainWindow), 500);
  };
  mainWindow.on('resize', scheduleSave);
  mainWindow.on('move', scheduleSave);
  mainWindow.on('maximize', scheduleSave);
  mainWindow.on('unmaximize', scheduleSave);
  mainWindow.on('close', () => mainWindow && saveWindowState(mainWindow));

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// ============================================================================
// macOS native menu
// ============================================================================
function buildAppMenu() {
  const isMac = process.platform === 'darwin';
  const template: MenuItemConstructorOptions[] = [
    // App menu (macOS)
    ...(isMac ? [{
      label: 'echolog',
      submenu: [
        { role: 'about' as const },
        { type: 'separator' as const },
        { label: '偏好设置...', accelerator: 'Cmd+,', click: () => sendNavigate('config') },
        { type: 'separator' as const },
        { role: 'services' as const },
        { type: 'separator' as const },
        { role: 'hide' as const },
        { role: 'hideOthers' as const },
        { role: 'unhide' as const },
        { type: 'separator' as const },
        { role: 'quit' as const },
      ],
    } as MenuItemConstructorOptions] : []),

    {
      label: '文件',
      submenu: [
        { label: '在 Finder 中打开 Vault', accelerator: 'Cmd+Shift+O', click: () => {
          shell.showItemInFolder(path.join(PROJECT_ROOT, 'Daily_Vault'));
        } },
        { type: 'separator' },
        isMac ? { role: 'close' } : { role: 'quit' },
      ],
    },

    {
      label: '编辑',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' },
      ],
    },

    {
      label: '视图',
      submenu: [
        { label: '日记浏览',    accelerator: 'Cmd+1', click: () => sendNavigate('diary') },
        { label: '选题 & 草稿',  accelerator: 'Cmd+2', click: () => sendNavigate('drafts') },
        { label: '搜索',         accelerator: 'Cmd+3', click: () => sendNavigate('search') },
        { label: 'Prompt 编辑',  accelerator: 'Cmd+4', click: () => sendNavigate('prompts') },
        { label: '配置',         accelerator: 'Cmd+5', click: () => sendNavigate('config') },
        { label: '状态',         accelerator: 'Cmd+6', click: () => sendNavigate('status') },
        { type: 'separator' },
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
      ],
    },

    {
      label: '窗口',
      submenu: [
        { role: 'minimize' },
        { role: 'zoom' },
        ...(isMac ? [{ type: 'separator' as const }, { role: 'front' as const }] : [{ role: 'close' as const }]),
      ],
    },

    {
      label: '帮助',
      submenu: [
        { label: '检查更新...', click: async () => {
          const r = await manualCheckForUpdates();
          if (mainWindow) {
            if (!r.ok) dialog.showMessageBox(mainWindow, { type: 'info', message: `检查失败：${r.error}`, buttons: ['确定'] });
            // 成功的反馈靠 updater 事件
          }
        } },
        { type: 'separator' },
        { label: '查看 README', click: () => shell.openExternal('https://github.com/BillLucky/echolog') },
        { label: '提交 Issue', click: () => shell.openExternal('https://github.com/BillLucky/echolog/issues') },
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

function sendNavigate(view: string) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('menu:navigate', view);
  }
}

// ============================================================================
// App lifecycle
// ============================================================================
app.whenReady().then(() => {
  registerIpcHandlers(ipcMain, PROJECT_ROOT);
  buildAppMenu();
  createWindow();

  // 在线更新
  if (mainWindow) initUpdater(mainWindow);

  // 手动「检查更新」入口（菜单 / 状态视图按钮）
  ipcMain.handle('updater:check', () => manualCheckForUpdates());
  ipcMain.handle('updater:install', () => { quitAndInstall(); });
  ipcMain.handle('app:version', () => app.getVersion());

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

export { PROJECT_ROOT };
