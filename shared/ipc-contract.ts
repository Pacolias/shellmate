import type { CommandAnalysis } from './types/command';
import type { ErrorMatch } from './types/errors';
import type { ShellEvent } from './types/shell-events';

/**
 * Every IPC channel name in the app, in one place, so main/preload/renderer
 * never disagree on a string literal.
 */
export const IpcChannel = {
  PtyStart: 'pty:start',
  PtyWrite: 'pty:write',
  PtyResize: 'pty:resize',
  PtyData: 'pty:data',
  PtyExit: 'pty:exit',
  ShellEvent: 'shell:event',
  CommandAnalyze: 'command:analyze',
  ErrorLookup: 'error:lookup',
} as const;

export interface PtyStartRequest {
  cols: number;
  rows: number;
}

export interface PtyWriteMessage {
  data: string;
}

export interface PtyResizeMessage {
  cols: number;
  rows: number;
}

export interface PtyExitEvent {
  exitCode: number;
}

export interface CommandAnalyzeRequest {
  input: string;
}

export interface ErrorLookupRequest {
  /** The command that failed, if known — narrows which catalog entries apply. */
  command: string | null;
  stderr: string;
}

/** Renderer → main, request/response (`ipcRenderer.invoke` / `ipcMain.handle`). */
export interface IpcInvokeMap {
  [IpcChannel.PtyStart]: { request: PtyStartRequest; response: void };
  [IpcChannel.CommandAnalyze]: { request: CommandAnalyzeRequest; response: CommandAnalysis };
  [IpcChannel.ErrorLookup]: { request: ErrorLookupRequest; response: ErrorMatch | null };
}

/** Renderer → main, fire-and-forget (`ipcRenderer.send` / `ipcMain.on`). */
export interface IpcSendMap {
  [IpcChannel.PtyWrite]: PtyWriteMessage;
  [IpcChannel.PtyResize]: PtyResizeMessage;
}

/** Main → renderer, fire-and-forget (`webContents.send` / `ipcRenderer.on`). */
export interface IpcEventMap {
  [IpcChannel.PtyData]: string;
  [IpcChannel.PtyExit]: PtyExitEvent;
  [IpcChannel.ShellEvent]: ShellEvent;
}

export type IpcInvokeChannel = keyof IpcInvokeMap;
export type IpcSendChannel = keyof IpcSendMap;
export type IpcEventChannel = keyof IpcEventMap;
