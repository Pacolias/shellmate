import { ipcMain } from 'electron';
import { IpcChannel, type ListDirectoryRequest } from '@shared/ipc-contract';
import type { ListDirectoryResult } from '@shared/types/filesystem';
import { listDirectory } from '../filesystem/fs-tree.service';

export function registerFilesystemHandlers(): void {
  ipcMain.handle(
    IpcChannel.FilesystemListDirectory,
    (_event, request: ListDirectoryRequest): Promise<ListDirectoryResult> => listDirectory(request.path),
  );
}
