import { useCallback, useEffect, useRef, useState } from 'react';
import type { CommandFailedEvent } from '@shared/ipc-contract';
import type { CommandAnalysis } from '@shared/types/command';
import { ThreeColumnLayout } from './layout/ThreeColumnLayout';
import { CheatsheetPanel } from './modules/copilot-cheatsheet/CheatsheetPanel';
import { ErrorCard } from './modules/copilot-errors/ErrorCard';
import { NaturalLanguagePanel } from './modules/copilot-natural-lang/NaturalLanguagePanel';
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

  const insertCommand = useCallback((command: string) => {
    void terminalRef.current?.insertText(command);
  }, []);

  const insertFlag = useCallback((flag: string) => {
    void terminalRef.current?.insertText(` ${flag}`);
  }, []);

  const primaryCommand = analysis?.parsed.segments[0]?.command ?? null;

  return (
    <ThreeColumnLayout
      contextColumn={
        <>
          <FilesystemMap />
          <HistoryDiary onRunCommand={insertCommand} />
        </>
      }
      terminalColumn={<TerminalPane ref={terminalRef} onAnalysisChange={setAnalysis} />}
      copilotColumn={
        <>
          <SubtitlesPanel analysis={analysis} />
          <ErrorCard failure={lastFailure} />
          <CheatsheetPanel commandName={primaryCommand} onInsertFlag={insertFlag} />
          <NaturalLanguagePanel onInsertCommand={insertCommand} />
        </>
      }
    />
  );
}
