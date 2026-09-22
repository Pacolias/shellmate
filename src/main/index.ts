import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { app, BrowserWindow, shell } from 'electron';
import { electronApp, is, optimizer } from '@electron-toolkit/utils';
import { registerAiHandlers } from './ipc/ai.handlers';
import { registerCommandHandlers } from './ipc/command.handlers';
import { registerFilesystemHandlers } from './ipc/filesystem.handlers';
import { registerHistoryHandlers } from './ipc/history.handlers';
import { registerPipelineHandlers } from './ipc/pipeline.handlers';
import { registerPtyHandlers } from './ipc/pty.handlers';
import { HistoryStore } from './history/history.store';

// Package.json declares "type": "module", so electron-vite builds main and
// preload as real ESM (out/main/index.mjs, out/preload/index.mjs) — no
// __dirname global, hence the fileURLToPath dance every Node ESM file needs.
const moduleDir = path.dirname(fileURLToPath(import.meta.url));

function createWindow(historyStore: HistoryStore): void {
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 600,
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(moduleDir, '../preload/index.mjs'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // Any link the renderer tries to open in a new window is handed to the
  // user's actual browser instead of opening inside the app.
  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url);
    return { action: 'deny' };
  });

  const getWebContents = (): Electron.WebContents | null => mainWindow.webContents;
  registerPtyHandlers(getWebContents, historyStore);
  registerHistoryHandlers(historyStore, getWebContents);

  if (is.dev && process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    mainWindow.loadFile(path.join(moduleDir, '../renderer/index.html'));
  }
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('dev.shellmate.app');

  app.on('browser-window-created', (_event, window) => {
    optimizer.watchWindowShortcuts(window);
  });

  registerCommandHandlers();
  registerFilesystemHandlers();
  registerAiHandlers();
  registerPipelineHandlers();

  const historyStore = new HistoryStore(path.join(app.getPath('userData'), 'history.json'));

  createWindow(historyStore);
});

app.on('window-all-closed', () => {
  app.quit();
});
