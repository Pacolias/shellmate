import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { app, BrowserWindow, shell } from 'electron';
import { electronApp, is, optimizer } from '@electron-toolkit/utils';
import { registerCommandHandlers } from './ipc/command.handlers';
import { registerErrorHandlers } from './ipc/error.handlers';
import { registerPtyHandlers } from './ipc/pty.handlers';

// Package.json declares "type": "module", so electron-vite builds main and
// preload as real ESM (out/main/index.mjs, out/preload/index.mjs) — no
// __dirname global, hence the fileURLToPath dance every Node ESM file needs.
const moduleDir = path.dirname(fileURLToPath(import.meta.url));

function createWindow(): void {
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

  registerPtyHandlers(() => mainWindow.webContents);

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
  registerErrorHandlers();

  createWindow();
});

app.on('window-all-closed', () => {
  app.quit();
});
