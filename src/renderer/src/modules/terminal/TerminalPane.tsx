import '@xterm/xterm/css/xterm.css';
import { useCallback, useRef, useState } from 'react';
import type { CommandAnalysis, DangerLevel } from '@shared/types/command';
import { ConfirmDestructiveDialog } from './ConfirmDestructiveDialog';
import styles from './TerminalPane.module.css';
import { type ConfirmDestructiveDetails, useTerminal } from './useTerminal';

export interface TerminalPaneProps {
  onAnalysisChange: (analysis: CommandAnalysis | null) => void;
}

interface PendingConfirmation extends ConfirmDestructiveDetails {
  resolve: (confirmed: boolean) => void;
}

export function TerminalPane({ onAnalysisChange }: TerminalPaneProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dangerLevel, setDangerLevel] = useState<DangerLevel | null>(null);
  const [pendingConfirmation, setPendingConfirmation] = useState<PendingConfirmation | null>(null);

  const handleAnalysisChange = useCallback(
    (analysis: CommandAnalysis | null) => {
      setDangerLevel(analysis?.danger.level ?? null);
      onAnalysisChange(analysis);
    },
    [onAnalysisChange],
  );

  const handleConfirmDestructive = useCallback((details: ConfirmDestructiveDetails) => {
    return new Promise<boolean>((resolve) => {
      setPendingConfirmation({ ...details, resolve });
    });
  }, []);

  useTerminal(containerRef, {
    onAnalysisChange: handleAnalysisChange,
    onConfirmDestructive: handleConfirmDestructive,
  });

  const resolveConfirmation = (confirmed: boolean): void => {
    pendingConfirmation?.resolve(confirmed);
    setPendingConfirmation(null);
  };

  return (
    <div className={styles.wrapper}>
      <div className={styles.terminalFrame} data-danger={dangerLevel ?? 'none'}>
        <div ref={containerRef} className={styles.terminal} />
      </div>
      {pendingConfirmation && (
        <ConfirmDestructiveDialog
          command={pendingConfirmation.command}
          reason={pendingConfirmation.reason}
          onConfirm={() => resolveConfirmation(true)}
          onCancel={() => resolveConfirmation(false)}
        />
      )}
    </div>
  );
}
