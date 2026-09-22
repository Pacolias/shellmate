import type { AiGenerateResult, AiStatus } from './types/ai';
import type { CommandAnalysis } from './types/command';
import type { CommandDictionaryEntry } from './types/command-dictionary';
import type { ListDirectoryResult } from './types/filesystem';
import type { HistoryEntry } from './types/history';
import type { CommandFailedEvent, PtyExitEvent, PtyStartRequest } from './ipc-contract';
import type { PipelinePreviewResult } from './types/pipeline';
import type { DestructivePreview, TrashOutcome } from './types/safety';
import type { ShellEvent } from './types/shell-events';

/**
 * The API the preload script exposes on `window.shellmate`. This is the
 * *only* surface the renderer can use to reach the main process — see
 * PLAN.md §2 for why (contextIsolation on, nodeIntegration off).
 */
export interface ShellmateBridge {
  pty: {
    start(options: PtyStartRequest): Promise<void>;
    write(data: string): void;
    resize(cols: number, rows: number): void;
    onData(listener: (chunk: string) => void): () => void;
    onExit(listener: (event: PtyExitEvent) => void): () => void;
  };
  shell: {
    onEvent(listener: (event: ShellEvent) => void): () => void;
    onCommandFailed(listener: (event: CommandFailedEvent) => void): () => void;
  };
  command: {
    analyze(input: string): Promise<CommandAnalysis>;
    dictionaryEntry(name: string): Promise<CommandDictionaryEntry | null>;
  };
  filesystem: {
    listDirectory(path: string): Promise<ListDirectoryResult>;
  };
  history: {
    list(): Promise<HistoryEntry[]>;
    saveRecipe(id: string, name: string): Promise<HistoryEntry | null>;
    onChanged(listener: (entry: HistoryEntry) => void): () => void;
  };
  ai: {
    status(): Promise<AiStatus>;
    generateCommand(prompt: string): Promise<AiGenerateResult>;
  };
  pipeline: {
    preview(raw: string): Promise<PipelinePreviewResult>;
  };
  safety: {
    previewDestructive(raw: string): Promise<DestructivePreview | null>;
    moveToTrash(paths: string[]): Promise<TrashOutcome[]>;
    restoreFromTrash(trashedNames: string[]): Promise<TrashOutcome[]>;
  };
}

declare global {
  interface Window {
    shellmate: ShellmateBridge;
  }
}
