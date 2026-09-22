import { ipcMain } from 'electron';
import { IpcChannel, type AiGenerateCommandRequest } from '@shared/ipc-contract';
import { generateCommand, getAiStatus } from '../ai/ai-service';
import { currentSessionState } from '../pty/current-session-state';

export function registerAiHandlers(): void {
  ipcMain.handle(IpcChannel.AiStatus, () => getAiStatus());

  ipcMain.handle(IpcChannel.AiGenerateCommand, (_event, request: AiGenerateCommandRequest) => {
    return generateCommand(request.prompt, currentSessionState.cwd);
  });
}
