import { ipcMain } from 'electron';
import { IpcChannel, type PipelinePreviewRequest } from '@shared/ipc-contract';
import { previewPipeline } from '../pipeline/pipeline-preview.service';
import { currentSessionState } from '../pty/current-session-state';

export function registerPipelineHandlers(): void {
  ipcMain.handle(IpcChannel.PipelinePreview, (_event, request: PipelinePreviewRequest) => {
    return previewPipeline(request.raw, currentSessionState.cwd);
  });
}
