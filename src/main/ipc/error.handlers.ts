import { ipcMain } from 'electron';
import { IpcChannel, type ErrorLookupRequest } from '@shared/ipc-contract';
import type { ErrorMatch } from '@shared/types/errors';
import { lookupError } from '../command-analysis/error-catalog';

export function registerErrorHandlers(): void {
  ipcMain.handle(IpcChannel.ErrorLookup, (_event, request: ErrorLookupRequest): ErrorMatch | null => {
    return lookupError(request.stderr, request.command);
  });
}
