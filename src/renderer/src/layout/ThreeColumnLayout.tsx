import type { ReactNode } from 'react';
import es from '@shared/i18n/es.json';
import { HelpLevelSlider } from './HelpLevelSlider';
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
        <div className={styles.headerSpacer} />
        <HelpLevelSlider />
      </header>
      <div className={styles.columns}>
        <aside className={styles.side}>{contextColumn}</aside>
        <main className={styles.center}>{terminalColumn}</main>
        <aside className={styles.side}>{copilotColumn}</aside>
      </div>
    </div>
  );
}
