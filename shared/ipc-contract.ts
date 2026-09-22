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
  CommandFailed: 'command:failed',
  CommandAnalyze: 'command:analyze',
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

/**
 * Pushed by main whenever a command finishes with a non-zero exit code —
 * main already tracks the command text (from OSC 133;C) and the terminal
 * output since it started, so it looks the error up itself instead of
 * waiting for the renderer to ask. `match` is null when nothing in the
 * catalog matched `rawOutput`; the UI shows the raw output as a fallback
 * rather than inventing an explanation.
 */
export interface CommandFailedEvent {
  command: string | null;
  exitCode: number;
  rawOutput: string;
  match: ErrorMatch | null;
}

/** Renderer → main, request/response (`ipcRenderer.invoke` / `ipcMain.handle`). */
export interface IpcInvokeMap {
  [IpcChannel.PtyStart]: { request: PtyStartRequest; response: void };
  [IpcChannel.CommandAnalyze]: { request: CommandAnalyzeRequest; response: CommandAnalysis };
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
  [IpcChannel.CommandFailed]: CommandFailedEvent;
}

export type IpcInvokeChannel = keyof IpcInvokeMap;
export type IpcSendChannel = keyof IpcSendMap;
export type IpcEventChannel = keyof IpcEventMap;
