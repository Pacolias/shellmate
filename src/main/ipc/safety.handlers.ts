import { ipcMain } from 'electron';
import {
  IpcChannel,
  type SafetyMoveToTrashRequest,
  type SafetyPreviewRequest,
  type SafetyRestoreFromTrashRequest,
} from '@shared/ipc-contract';
import { currentSessionState } from '../pty/current-session-state';
import { previewDestructiveCommand } from '../safety/preview.service';
import type { TrashService } from '../safety/trash.service';

export function registerSafetyHandlers(trashService: TrashService): void {
  ipcMain.handle(IpcChannel.SafetyPreviewDestructive, (_event, request: SafetyPreviewRequest) => {
    return previewDestructiveCommand(request.raw, currentSessionState.cwd);
  });

  ipcMain.handle(IpcChannel.SafetyMoveToTrash, (_event, request: SafetyMoveToTrashRequest) => {
    return trashService.moveToTrash(request.paths);
  });

  ipcMain.handle(IpcChannel.SafetyRestoreFromTrash, (_event, request: SafetyRestoreFromTrashRequest) => {
    return trashService.restoreFromTrash(request.trashedNames);
  });
}
