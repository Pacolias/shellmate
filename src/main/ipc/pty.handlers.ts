import { ipcMain, type IpcMainInvokeEvent, type WebContents } from 'electron';
import { IpcChannel, type PtyResizeMessage, type PtyStartRequest, type PtyWriteMessage } from '@shared/ipc-contract';
import { parseCommand } from '../command-analysis/bash-parser';
import { annotateCommand } from '../command-analysis/command-dictionary';
import { lookupError } from '../command-analysis/error-catalog';
import { deriveHistoryLabel } from '../command-analysis/history-label';
import type { HistoryStore } from '../history/history.store';
import { currentSessionState } from '../pty/current-session-state';
import { PtySession } from '../pty/pty-session';
import { OscStreamParser } from '../shell-events/osc-parser';
import { RecentOutputTracker } from '../shell-events/recent-output-tracker';

/**
 * Wires a single PtySession to IPC: pty:start/write/resize from the
 * renderer, and pty:data/pty:exit/shell:event back to it. The pty's raw
 * output is always routed through OscStreamParser first, so the renderer
 * never sees our own OSC 133/7 sequences mixed into the terminal stream.
 *
 * Also owns two flows end to end, pushing to the renderer rather than
 * waiting for it to ask:
 * - Translated errors: tracks the output produced since the command
 *   started, and on a non-zero exit pushes a CommandFailed event with
 *   whatever error-catalog.ts matched.
 * - History diary: on every finished command, records an entry (command,
 *   cwd, a dictionary-derived label, exit code, duration) and pushes it.
 */
export function registerPtyHandlers(getWebContents: () => WebContents | null, historyStore: HistoryStore): void {
  const session = new PtySession();
  const outputTracker = new RecentOutputTracker();
  let lastCommandRaw: string | null = null;
  let commandStartedAt: number | null = null;

  const oscParser = new OscStreamParser({
    onData: (chunk) => {
      outputTracker.append(chunk);
      getWebContents()?.send(IpcChannel.PtyData, chunk);
    },
    onShellEvent: (event) => {
      if (event.type === 'cwd-changed') {
        currentSessionState.cwd = event.cwd;
      }

      if (event.type === 'command-started') {
        lastCommandRaw = event.command;
        commandStartedAt = Date.now();
        outputTracker.reset();
      }

      if (event.type === 'command-finished') {
        const commandName = lastCommandRaw ? extractCommandName(lastCommandRaw) : null;

        if (event.exitCode !== 0) {
          const rawOutput = outputTracker.snapshot();
          getWebContents()?.send(IpcChannel.CommandFailed, {
            command: commandName,
            exitCode: event.exitCode,
            rawOutput,
            match: lookupError(rawOutput, commandName),
          });
        }

        void recordHistoryEntry(
          historyStore,
          getWebContents,
          lastCommandRaw,
          currentSessionState.cwd,
          event.exitCode,
          commandStartedAt,
        );
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

async function recordHistoryEntry(
  historyStore: HistoryStore,
  getWebContents: () => WebContents | null,
  command: string | null,
  cwd: string | null,
  exitCode: number,
  startedAt: number | null,
): Promise<void> {
  const trimmed = command?.trim();
  if (!trimmed) return; // A blank Enter has nothing worth recording.

  const parsed = await parseCommand(trimmed);
  const label = deriveHistoryLabel(annotateCommand(parsed));

  const entry = await historyStore.add({
    command: trimmed,
    cwd,
    label,
    exitCode,
    startedAt: startedAt ?? Date.now(),
    durationMs: startedAt ? Date.now() - startedAt : 0,
  });

  getWebContents()?.send(IpcChannel.HistoryChanged, entry);
}
