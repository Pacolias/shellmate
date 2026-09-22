import { ipcMain, type IpcMainInvokeEvent, type WebContents } from 'electron';
import { IpcChannel, type PtyResizeMessage, type PtyStartRequest, type PtyWriteMessage } from '@shared/ipc-contract';
import { lookupError } from '../command-analysis/error-catalog';
import { PtySession } from '../pty/pty-session';
import { OscStreamParser } from '../shell-events/osc-parser';
import { RecentOutputTracker } from '../shell-events/recent-output-tracker';

/**
 * Wires a single PtySession to IPC: pty:start/write/resize from the
 * renderer, and pty:data/pty:exit/shell:event back to it. The pty's raw
 * output is always routed through OscStreamParser first, so the renderer
 * never sees our own OSC 133/7 sequences mixed into the terminal stream.
 *
 * Also owns the "translated errors" flow end to end: it tracks the last
 * command (from OSC 133;C) and the output produced since it started, and
 * on a non-zero exit pushes a CommandFailed event with whatever
 * error-catalog.ts matched — the renderer never has to ask.
 */
export function registerPtyHandlers(getWebContents: () => WebContents | null): void {
  const session = new PtySession();
  const outputTracker = new RecentOutputTracker();
  let lastCommand: string | null = null;

  const oscParser = new OscStreamParser({
    onData: (chunk) => {
      outputTracker.append(chunk);
      getWebContents()?.send(IpcChannel.PtyData, chunk);
    },
    onShellEvent: (event) => {
      if (event.type === 'command-started') {
        lastCommand = extractCommandName(event.command);
        outputTracker.reset();
      }

      if (event.type === 'command-finished' && event.exitCode !== 0) {
        const rawOutput = outputTracker.snapshot();
        getWebContents()?.send(IpcChannel.CommandFailed, {
          command: lastCommand,
          exitCode: event.exitCode,
          rawOutput,
          match: lookupError(rawOutput, lastCommand),
        });
      }

      getWebContents()?.send(IpcChannel.ShellEvent, event);
    },
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

/** "sudo apt install git" → "apt", "ls -la" → "ls" — mirrors how the danger classifier unwraps sudo, but string-based since we only need the bare name here, not a full parse. */
function extractCommandName(raw: string): string | null {
  const tokens = raw.trim().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return null;
  if (tokens[0] === 'sudo' && tokens.length > 1) return tokens[1] ?? null;
  return tokens[0] ?? null;
}
