// Must run before anything else — populates process.env.GEMINI_API_KEY /
// ANTHROPIC_API_KEY / AI_PROVIDER from a .env file at the project root
// (dotenv defaults to reading it from process.cwd(), which `npm run dev`/
// `npm start` already set there) before ai-service.ts ever checks them.
// A missing .env is a silent no-op, not an error — the app works the same
// either way, see ai-service.ts's no-api-key path.
import 'dotenv/config';

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
import { registerSafetyHandlers } from './ipc/safety.handlers';
import { HistoryStore } from './history/history.store';
import { TrashService } from './safety/trash.service';

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
  registerSafetyHandlers(new TrashService());

  const historyStore = new HistoryStore(path.join(app.getPath('userData'), 'history.json'));

  createWindow(historyStore);
});

app.on('window-all-closed', () => {
  app.quit();
});
