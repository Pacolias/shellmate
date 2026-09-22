import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron';
import type { ShellmateBridge } from '@shared/bridge-api';
import { IpcChannel, type CommandFailedEvent, type PtyExitEvent } from '@shared/ipc-contract';
import type { HistoryEntry } from '@shared/types/history';
import type { ShellEvent } from '@shared/types/shell-events';

function onIpc<TPayload>(channel: string, listener: (payload: TPayload) => void): () => void {
  const handler = (_event: IpcRendererEvent, payload: TPayload): void => listener(payload);
  ipcRenderer.on(channel, handler);
  return () => ipcRenderer.removeListener(channel, handler);
}

/**
 * The only surface the renderer can reach the main process through — see
 * PLAN.md §2. Every method here is a thin, typed wrapper around a single
 * IPC channel from shared/ipc-contract.ts.
 */
const bridge: ShellmateBridge = {
  pty: {
    start: (options) => ipcRenderer.invoke(IpcChannel.PtyStart, options),
    write: (data) => ipcRenderer.send(IpcChannel.PtyWrite, { data }),
    resize: (cols, rows) => ipcRenderer.send(IpcChannel.PtyResize, { cols, rows }),
    onData: (listener) => onIpc<string>(IpcChannel.PtyData, listener),
    onExit: (listener) => onIpc<PtyExitEvent>(IpcChannel.PtyExit, listener),
  },
  shell: {
    onEvent: (listener) => onIpc<ShellEvent>(IpcChannel.ShellEvent, listener),
    onCommandFailed: (listener) => onIpc<CommandFailedEvent>(IpcChannel.CommandFailed, listener),
  },
  command: {
    analyze: (input) => ipcRenderer.invoke(IpcChannel.CommandAnalyze, { input }),
  },
  filesystem: {
    listDirectory: (path) => ipcRenderer.invoke(IpcChannel.FilesystemListDirectory, { path }),
  },
  history: {
    list: () => ipcRenderer.invoke(IpcChannel.HistoryList),
    saveRecipe: (id, name) => ipcRenderer.invoke(IpcChannel.HistorySaveRecipe, { id, name }),
    onChanged: (listener) => onIpc<HistoryEntry>(IpcChannel.HistoryChanged, listener),
  },
};

contextBridge.exposeInMainWorld('shellmate', bridge);
