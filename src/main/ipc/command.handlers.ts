import { ipcMain } from 'electron';
import { IpcChannel, type CommandAnalyzeRequest } from '@shared/ipc-contract';
import type { CommandAnalysis } from '@shared/types/command';
import { parseCommand } from '../command-analysis/bash-parser';
import { annotateCommand } from '../command-analysis/command-dictionary';
import { classifyCommand } from '../command-analysis/danger-classifier';

export function registerCommandHandlers(): void {
  ipcMain.handle(
    IpcChannel.CommandAnalyze,
    async (_event, request: CommandAnalyzeRequest): Promise<CommandAnalysis> => {
      const parsed = await parseCommand(request.input);
      const danger = classifyCommand(parsed);
      return { parsed: annotateCommand(parsed), danger };
    },
  );
}
