import '@xterm/xterm/css/xterm.css';
import { forwardRef, useCallback, useImperativeHandle, useRef, useState } from 'react';
import { extractCommandName } from '@shared/command-text';
import es from '@shared/i18n/es.json';
import type { CommandAnalysis, DangerLevel } from '@shared/types/command';
import { ConfirmDestructiveDialog } from './ConfirmDestructiveDialog';
import { parseTabularOutput } from './table-parsers';
import { PipelineView } from './PipelineView';
import { TableView } from './TableView';
import styles from './TerminalPane.module.css';
import { type ConfirmDestructiveDetails, type UseTerminalHandle, useTerminal } from './useTerminal';

export interface TerminalPaneProps {
  onAnalysisChange: (analysis: CommandAnalysis | null) => void;
}

export type TerminalPaneHandle = UseTerminalHandle;

interface PendingConfirmation extends ConfirmDestructiveDetails {
  resolve: (confirmed: boolean) => void;
}

interface LastCommandOutput {
  command: string | null;
  raw: string;
}

export const TerminalPane = forwardRef<TerminalPaneHandle, TerminalPaneProps>(function TerminalPane(
  { onAnalysisChange },
  ref,
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dangerLevel, setDangerLevel] = useState<DangerLevel | null>(null);
  const [latestAnalysis, setLatestAnalysis] = useState<CommandAnalysis | null>(null);
  const [pendingConfirmation, setPendingConfirmation] = useState<PendingConfirmation | null>(null);
  const [pipelineViewOpen, setPipelineViewOpen] = useState(false);
  const [lastOutput, setLastOutput] = useState<LastCommandOutput | null>(null);
  const [tableViewOpen, setTableViewOpen] = useState(false);

  const handleAnalysisChange = useCallback(
    (analysis: CommandAnalysis | null) => {
      setDangerLevel(analysis?.danger.level ?? null);
      setLatestAnalysis(analysis);
      onAnalysisChange(analysis);
    },
    [onAnalysisChange],
  );

  const handleConfirmDestructive = useCallback((details: ConfirmDestructiveDetails) => {
    return new Promise<boolean>((resolve) => {
      setPendingConfirmation({ ...details, resolve });
    });
  }, []);

  const handleCommandFinished = useCallback((command: string | null, rawOutput: string) => {
    setLastOutput({ command, raw: rawOutput });
    setTableViewOpen(false);
  }, []);

  const terminalHandle = useTerminal(containerRef, {
    onAnalysisChange: handleAnalysisChange,
    onConfirmDestructive: handleConfirmDestructive,
    onCommandFinished: handleCommandFinished,
  });

  useImperativeHandle(ref, () => terminalHandle, [terminalHandle]);

  const resolveConfirmation = (confirmed: boolean): void => {
    pendingConfirmation?.resolve(confirmed);
    setPendingConfirmation(null);
  };

  const handleTrashed = (): void => {
    terminalHandle.clearCurrentLine();
  };

  const table = lastOutput ? parseTabularOutput(extractCommandName(lastOutput.command ?? ''), lastOutput.raw) : null;
  const canPreviewPipeline = (latestAnalysis?.parsed.segments.length ?? 0) > 1;

  return (
    <div className={styles.wrapper}>
      <div className={styles.terminalFrame} data-danger={dangerLevel ?? 'none'}>
        <div ref={containerRef} className={styles.terminal} />

        <div className={styles.toolbar}>
          {canPreviewPipeline && (
            <button type="button" className={styles.toolbarButton} onClick={() => setPipelineViewOpen(true)}>
              {es.terminal.pipeline.button}
            </button>
          )}
          {table && (
            <button type="button" className={styles.toolbarButton} onClick={() => setTableViewOpen(true)}>
              {es.terminal.table.button}
            </button>
          )}
        </div>

        {tableViewOpen && table && <TableView table={table} onClose={() => setTableViewOpen(false)} />}
        {pipelineViewOpen && latestAnalysis && (
          <PipelineView raw={latestAnalysis.parsed.raw} onClose={() => setPipelineViewOpen(false)} />
        )}
      </div>
      {pendingConfirmation && (
        <ConfirmDestructiveDialog
          command={pendingConfirmation.command}
          reason={pendingConfirmation.reason}
          onRun={() => resolveConfirmation(true)}
          onDismiss={() => resolveConfirmation(false)}
          onTrashed={handleTrashed}
        />
      )}
    </div>
  );
});
