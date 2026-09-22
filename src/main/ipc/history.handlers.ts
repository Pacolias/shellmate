import { ipcMain, type WebContents } from 'electron';
import { IpcChannel, type SaveRecipeRequest } from '@shared/ipc-contract';
import type { HistoryStore } from '../history/history.store';

export function registerHistoryHandlers(historyStore: HistoryStore, getWebContents: () => WebContents | null): void {
  ipcMain.handle(IpcChannel.HistoryList, () => historyStore.list());

  ipcMain.handle(IpcChannel.HistorySaveRecipe, async (_event, request: SaveRecipeRequest) => {
    const updated = await historyStore.saveRecipe(request.id, request.name);
    if (updated) getWebContents()?.send(IpcChannel.HistoryChanged, updated);
    return updated;
  });
}
