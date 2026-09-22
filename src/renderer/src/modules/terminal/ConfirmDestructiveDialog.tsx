import es from '@shared/i18n/es.json';
import styles from './ConfirmDestructiveDialog.module.css';

export interface ConfirmDestructiveDialogProps {
  command: string;
  reason: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDestructiveDialog({
  command,
  reason,
  onConfirm,
  onCancel,
}: ConfirmDestructiveDialogProps) {
  return (
    <div className={styles.overlay} role="alertdialog" aria-modal="true" aria-labelledby="confirm-destructive-title">
      <div className={styles.dialog}>
        <span className={styles.badge}>{es.danger.destructive}</span>
        <h2 id="confirm-destructive-title" className={styles.title}>
          {es.terminal.confirmDestructive.title}
        </h2>
        <code className={styles.command}>{command}</code>
        <p className={styles.reason}>{reason}</p>
        <div className={styles.actions}>
          {/* The safe action gets focus by default, not the destructive one. */}
          <button type="button" className={styles.cancel} onClick={onCancel} autoFocus>
            {es.terminal.confirmDestructive.cancel}
          </button>
          <button type="button" className={styles.confirm} onClick={onConfirm}>
            {es.terminal.confirmDestructive.confirm}
          </button>
        </div>
      </div>
    </div>
  );
}
