import { useEffect, useState } from 'react';
import es from '@shared/i18n/es.json';
import type { CommandDictionaryEntry } from '@shared/types/command-dictionary';
import styles from './CheatsheetPanel.module.css';

export interface CheatsheetPanelProps {
  /** The primary command currently typed in the terminal (first segment's command name), or null when there isn't one. */
  commandName: string | null;
  /** Appends a flag to the terminal's current line — see TerminalPaneHandle.insertText. */
  onInsertFlag: (flag: string) => void;
}

export function CheatsheetPanel({ commandName, onInsertFlag }: CheatsheetPanelProps) {
  const [entry, setEntry] = useState<CommandDictionaryEntry | null>(null);

  useEffect(() => {
    if (!commandName) {
      setEntry(null);
      return;
    }
    let cancelled = false;
    void window.shellmate.command.dictionaryEntry(commandName).then((result) => {
      if (!cancelled) setEntry(result);
    });
    return () => {
      cancelled = true;
    };
  }, [commandName]);

  const flagEntries = entry ? Object.entries(entry.flags) : [];

  return (
    <section className={styles.panel} aria-label={es.copilot.cheatsheet.title}>
      <h2 className={styles.heading}>{es.copilot.cheatsheet.title}</h2>
      {!entry ? (
        <p className={styles.emptyState}>{es.copilot.cheatsheet.emptyState}</p>
      ) : (
        <div className={styles.content}>
          {entry.examples.length > 0 && (
            <div className={styles.section}>
              <h3 className={styles.sectionTitle}>{es.copilot.cheatsheet.examplesTitle}</h3>
              <ul className={styles.examplesList}>
                {entry.examples.map((example) => (
                  <li key={example}>
                    <code className={styles.example}>{example}</code>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {flagEntries.length > 0 && (
            <div className={styles.section}>
              <h3 className={styles.sectionTitle}>{es.copilot.cheatsheet.flagsTitle}</h3>
              <div className={styles.flagList}>
                {flagEntries.map(([flag, description]) => (
                  <button
                    key={flag}
                    type="button"
                    className={styles.flagChip}
                    title={description}
                    onClick={() => onInsertFlag(flag)}
                  >
                    <code>{flag}</code>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
