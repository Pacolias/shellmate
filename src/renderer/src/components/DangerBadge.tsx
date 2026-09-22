import es from '@shared/i18n/es.json';
import type { DangerLevel } from '@shared/types/command';
import styles from './DangerBadge.module.css';

export interface DangerBadgeProps {
  level: DangerLevel;
  reason?: string;
}

const LABELS: Record<DangerLevel, string> = {
  safe: es.danger.safe,
  caution: es.danger.caution,
  destructive: es.danger.destructive,
};

export function DangerBadge({ level, reason }: DangerBadgeProps) {
  return (
    <div className={styles.badge} data-level={level}>
      <span className={styles.dot} aria-hidden="true" />
      <span className={styles.label}>{LABELS[level]}</span>
      {reason && <span className={styles.reason}>{reason}</span>}
    </div>
  );
}
