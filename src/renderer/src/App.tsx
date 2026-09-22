import { useEffect, useState } from 'react';
import type { CommandFailedEvent } from '@shared/ipc-contract';
import type { CommandAnalysis } from '@shared/types/command';
import { ThreeColumnLayout } from './layout/ThreeColumnLayout';
import { CheatsheetPlaceholder } from './modules/copilot-cheatsheet/CheatsheetPlaceholder';
import { ErrorCard } from './modules/copilot-errors/ErrorCard';
import { NaturalLanguagePlaceholder } from './modules/copilot-natural-lang/NaturalLanguagePlaceholder';
import { SubtitlesPanel } from './modules/copilot-subtitles/SubtitlesPanel';
import { FilesystemMapPlaceholder } from './modules/context-map/FilesystemMapPlaceholder';
import { HistoryDiaryPlaceholder } from './modules/history-diary/HistoryDiaryPlaceholder';
import { TerminalPane } from './modules/terminal/TerminalPane';

export function App() {
  const [analysis, setAnalysis] = useState<CommandAnalysis | null>(null);
  const [lastFailure, setLastFailure] = useState<CommandFailedEvent | null>(null);

  useEffect(() => {
    return window.shellmate.shell.onCommandFailed(setLastFailure);
  }, []);

  return (
    <ThreeColumnLayout
      contextColumn={
        <>
          <FilesystemMapPlaceholder />
          <HistoryDiaryPlaceholder />
        </>
      }
      terminalColumn={<TerminalPane onAnalysisChange={setAnalysis} />}
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
