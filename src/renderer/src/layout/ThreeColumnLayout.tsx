import type { ReactNode } from 'react';
import es from '@shared/i18n/es.json';
import styles from './ThreeColumnLayout.module.css';

export interface ThreeColumnLayoutProps {
  contextColumn: ReactNode;
  terminalColumn: ReactNode;
  copilotColumn: ReactNode;
}

export function ThreeColumnLayout({ contextColumn, terminalColumn, copilotColumn }: ThreeColumnLayoutProps) {
  return (
    <div className={styles.app}>
      <header className={styles.header}>
        <span className={styles.wordmark}>{es.app.title}</span>
      </header>
      <div className={styles.columns}>
        <aside className={styles.side}>{contextColumn}</aside>
        <main className={styles.center}>{terminalColumn}</main>
        <aside className={styles.side}>{copilotColumn}</aside>
      </div>
    </div>
  );
}
