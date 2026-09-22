import { useEffect, useState } from 'react';
import es from '@shared/i18n/es.json';
import type { DestructivePreview } from '@shared/types/safety';
import type { TrashOutcome } from '@shared/types/safety';
import styles from './ConfirmDestructiveDialog.module.css';

export interface ConfirmDestructiveDialogProps {
  command: string;
  reason: string;
  onRun: () => void;
  onDismiss: () => void;
  /** Called right after files are successfully moved to the trash, before the dialog's success sub-view shows — the parent uses this to discard the now-stale typed command from the real shell's input line. */
  onTrashed: () => void;
}

type Phase = 'confirm' | 'trashing' | 'trashed' | 'restoring';

export function ConfirmDestructiveDialog({ command, reason, onRun, onDismiss, onTrashed }: ConfirmDestructiveDialogProps) {
  const [preview, setPreview] = useState<DestructivePreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(true);
  const [phase, setPhase] = useState<Phase>('confirm');
  const [trashOutcomes, setTrashOutcomes] = useState<TrashOutcome[]>([]);

  useEffect(() => {
    let cancelled = false;
    setPreviewLoading(true);
    void window.shellmate.safety.previewDestructive(command).then((result) => {
      if (!cancelled) {
        setPreview(result);
        setPreviewLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [command]);

  const handleMoveToTrash = async (): Promise<void> => {
    if (!preview) return;
    const paths = preview.targets.flatMap((target) => target.matches);
    if (paths.length === 0) return;

    setPhase('trashing');
    const outcomes = await window.shellmate.safety.moveToTrash(paths);
    setTrashOutcomes(outcomes);
    setPhase('trashed');
    onTrashed();
  };

  const handleUndo = async (): Promise<void> => {
    const names = trashOutcomes
      .filter((outcome): outcome is TrashOutcome & { trashedName: string } => outcome.success && !!outcome.trashedName)
      .map((outcome) => outcome.trashedName);
    setPhase('restoring');
    await window.shellmate.safety.restoreFromTrash(names);
    onDismiss();
  };

  if (phase === 'trashed') {
    const succeeded = trashOutcomes.filter((outcome) => outcome.success);
    const failed = trashOutcomes.filter((outcome) => !outcome.success);
    return (
      <div className={styles.overlay} role="alertdialog" aria-modal="true">
        <div className={styles.dialog}>
          <h2 className={styles.title}>{es.safety.movedToTrash}</h2>
          {succeeded.length > 0 && (
            <ul className={styles.previewList}>
              {succeeded.map((outcome) => (
                <li key={outcome.originalPath} className={styles.previewMatch}>
                  {outcome.originalPath}
                </li>
              ))}
            </ul>
          )}
          {failed.length > 0 && (
            <div className={styles.trashFailures}>
              <p className={styles.reason}>{es.safety.movedToTrashFailed}:</p>
              <ul className={styles.previewList}>
                {failed.map((outcome) => (
                  <li key={outcome.originalPath} className={styles.previewMissing}>
                    {outcome.originalPath} — {outcome.error}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div className={styles.actions}>
            <button type="button" className={styles.cancel} onClick={onDismiss} autoFocus>
              {es.terminal.confirmDestructive.cancel}
            </button>
            <button type="button" className={styles.confirm} onClick={() => void handleUndo()}>
              {es.safety.undo}
            </button>
          </div>
        </div>
      </div>
    );
  }

  const isRmDelete = preview?.action === 'delete';
  const busy = phase === 'trashing' || phase === 'restoring';

  return (
    <div className={styles.overlay} role="alertdialog" aria-modal="true" aria-labelledby="confirm-destructive-title">
      <div className={styles.dialog}>
        <span className={styles.badge}>{es.danger.destructive}</span>
        <h2 id="confirm-destructive-title" className={styles.title}>
          {es.terminal.confirmDestructive.title}
        </h2>
        <code className={styles.command}>{command}</code>
        <p className={styles.reason}>{reason}</p>

        {previewLoading && <p className={styles.previewLoading}>{es.terminal.confirmDestructive.previewLoading}</p>}
        {preview && (
          <div className={styles.preview}>
            {preview.destination && (
              <p className={styles.destination}>
                {es.terminal.confirmDestructive.destination}: <code>{preview.destination}</code>
              </p>
            )}
            <ul className={styles.previewList}>
              {preview.targets.map((target) =>
                target.missing ? (
                  <li key={target.pattern} className={styles.previewMissing}>
                    {target.pattern} ({es.terminal.confirmDestructive.previewMissing})
                  </li>
                ) : target.matches.length === 0 ? (
                  <li key={target.pattern} className={styles.previewMissing}>
                    {target.pattern} ({es.terminal.confirmDestructive.previewNoMatches})
                  </li>
                ) : (
                  target.matches.map((match) => (
                    <li key={match} className={styles.previewMatch}>
                      {match}
                    </li>
                  ))
                ),
              )}
            </ul>
          </div>
        )}

        <div className={styles.actions}>
          <button type="button" className={styles.cancel} onClick={onDismiss} autoFocus disabled={busy}>
            {es.terminal.confirmDestructive.cancel}
          </button>
          {isRmDelete && (
            <button type="button" className={styles.trash} onClick={() => void handleMoveToTrash()} disabled={busy}>
              {es.terminal.confirmDestructive.moveToTrash}
            </button>
          )}
          <button type="button" className={styles.confirm} onClick={onRun} disabled={busy}>
            {es.terminal.confirmDestructive.confirm}
          </button>
        </div>
      </div>
    </div>
  );
}
