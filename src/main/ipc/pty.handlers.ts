import { ipcMain, type IpcMainInvokeEvent, type WebContents } from 'electron';
import { IpcChannel, type PtyResizeMessage, type PtyStartRequest, type PtyWriteMessage } from '@shared/ipc-contract';
import { PtySession } from '../pty/pty-session';
import { OscStreamParser } from '../shell-events/osc-parser';

/**
 * Wires a single PtySession to IPC: pty:start/write/resize from the
 * renderer, and pty:data/pty:exit/shell:event back to it. The pty's raw
 * output is always routed through OscStreamParser first, so the renderer
 * never sees our own OSC 133/7 sequences mixed into the terminal stream.
 */
export function registerPtyHandlers(getWebContents: () => WebContents | null): void {
  const session = new PtySession();
  const oscParser = new OscStreamParser({
    onData: (chunk) => getWebContents()?.send(IpcChannel.PtyData, chunk),
    onShellEvent: (event) => getWebContents()?.send(IpcChannel.ShellEvent, event),
  });

  session.onData((chunk) => oscParser.feed(chunk));
  session.onExit((exitCode) => getWebContents()?.send(IpcChannel.PtyExit, { exitCode }));

  ipcMain.handle(IpcChannel.PtyStart, (_event: IpcMainInvokeEvent, request: PtyStartRequest) => {
    session.start({ cols: request.cols, rows: request.rows });
  });

  ipcMain.on(IpcChannel.PtyWrite, (_event, message: PtyWriteMessage) => {
    session.write(message.data);
  });

  ipcMain.on(IpcChannel.PtyResize, (_event, message: PtyResizeMessage) => {
    session.resize(message.cols, message.rows);
  });
}
