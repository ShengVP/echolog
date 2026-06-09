// 在线更新 —— 用 electron-updater 读 GitHub Releases
//
// 工作流：
// 1. 开发者 git tag v0.x.x + push → GitHub Action 跑 release workflow，构建 + 上传 dmg + latest-mac.yml 到 release
// 2. 用户的 app 启动 ~30s 后 autoUpdater.checkForUpdates()
// 3. 发现新版本 → 后台下载 → 提示用户「重启安装」
//
// dev 环境跳过（autoUpdater 会因为 app 没签名 / 不在打包后路径而 throw）

import type { BrowserWindow } from 'electron';

let isDev = false;

export function initUpdater(mainWindow: BrowserWindow) {
  isDev = !!process.env.VITE_DEV_SERVER_URL;
  if (isDev) {
    console.log('[updater] dev 模式跳过自动更新');
    return;
  }

  // 动态 require —— 避免 dev 环境 import 时报 "app is not packaged"
  let autoUpdater: any;
  try {
    autoUpdater = require('electron-updater').autoUpdater;
  } catch (err) {
    console.error('[updater] electron-updater 加载失败:', err);
    return;
  }

  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('checking-for-update', () => {
    console.log('[updater] 检查更新中...');
  });

  autoUpdater.on('update-available', (info: any) => {
    console.log(`[updater] 发现新版本 ${info.version}`);
    mainWindow.webContents.send('updater:available', { version: info.version });
  });

  autoUpdater.on('update-not-available', () => {
    console.log('[updater] 当前已是最新版本');
    mainWindow.webContents.send('updater:not-available', {});
  });

  autoUpdater.on('error', (err: any) => {
    console.error('[updater] 错误:', err?.message || err);
    mainWindow.webContents.send('updater:error', { message: err?.message || String(err) });
  });

  autoUpdater.on('download-progress', (p: any) => {
    mainWindow.webContents.send('updater:progress', {
      percent: p.percent,
      bytesPerSecond: p.bytesPerSecond,
      transferred: p.transferred,
      total: p.total,
    });
  });

  autoUpdater.on('update-downloaded', (info: any) => {
    console.log(`[updater] 新版本 ${info.version} 已下载，等待重启安装`);
    mainWindow.webContents.send('updater:downloaded', { version: info.version });
  });

  // 启动后 30s 静默检查（避免影响启动时间）
  setTimeout(() => {
    autoUpdater.checkForUpdates().catch((err: any) => {
      console.error('[updater] checkForUpdates 失败:', err?.message || err);
    });
  }, 30_000);

  return autoUpdater;
}

export function manualCheckForUpdates() {
  if (isDev) return Promise.resolve({ ok: false, error: 'dev 模式不支持' });
  try {
    const { autoUpdater } = require('electron-updater');
    return autoUpdater.checkForUpdates().then((r: any) => ({ ok: true, info: r?.updateInfo }))
      .catch((err: any) => ({ ok: false, error: err?.message || String(err) }));
  } catch (err: any) {
    return Promise.resolve({ ok: false, error: err.message });
  }
}

export function quitAndInstall() {
  if (isDev) return;
  try {
    const { autoUpdater } = require('electron-updater');
    autoUpdater.quitAndInstall(false, true);
  } catch (err) {
    console.error('[updater] quitAndInstall 失败:', err);
  }
}
