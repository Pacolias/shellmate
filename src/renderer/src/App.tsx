import { useCallback, useEffect, useRef, useState } from 'react';
import type { CommandFailedEvent } from '@shared/ipc-contract';
import type { CommandAnalysis } from '@shared/types/command';
import { ThreeColumnLayout } from './layout/ThreeColumnLayout';
import { CheatsheetPlaceholder } from './modules/copilot-cheatsheet/CheatsheetPlaceholder';
import { ErrorCard } from './modules/copilot-errors/ErrorCard';
import { NaturalLanguagePlaceholder } from './modules/copilot-natural-lang/NaturalLanguagePlaceholder';
import { SubtitlesPanel } from './modules/copilot-subtitles/SubtitlesPanel';
import { FilesystemMap } from './modules/context-map/FilesystemMap';
import { HistoryDiary } from './modules/history-diary/HistoryDiary';
import { TerminalPane, type TerminalPaneHandle } from './modules/terminal/TerminalPane';

export function App() {
  const [analysis, setAnalysis] = useState<CommandAnalysis | null>(null);
  const [lastFailure, setLastFailure] = useState<CommandFailedEvent | null>(null);
  const terminalRef = useRef<TerminalPaneHandle>(null);

  useEffect(() => {
    return window.shellmate.shell.onCommandFailed(setLastFailure);
  }, []);

  const runCommand = useCallback((command: string) => {
    void terminalRef.current?.insertText(command);
  }, []);

  return (
    <ThreeColumnLayout
      contextColumn={
        <>
          <FilesystemMap />
          <HistoryDiary onRunCommand={runCommand} />
        </>
      }
      terminalColumn={<TerminalPane ref={terminalRef} onAnalysisChange={setAnalysis} />}
      copilotColumn={
        <>
          <SubtitlesPanel analysis={analysis} />
          <ErrorCard failure={lastFailure} />
          <CheatsheetPlaceholder />
          <NaturalLanguagePlaceholder />
        </>
      }
    />
  );
}
