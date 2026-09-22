import es from '@shared/i18n/es.json';
import type { CommandFailedEvent } from '@shared/ipc-contract';
import { useHelpLevel } from '../../app-state/HelpLevelContext';
import styles from './ErrorCard.module.css';

export interface ErrorCardProps {
  failure: CommandFailedEvent | null;
}

export function ErrorCard({ failure }: ErrorCardProps) {
  const { level } = useHelpLevel();

  return (
    <section className={styles.panel} aria-label={es.copilot.errors.title}>
      <h2 className={styles.heading}>{es.copilot.errors.title}</h2>
      {!failure ? (
        <p className={styles.emptyState}>{es.copilot.errors.emptyState}</p>
      ) : level === 'low' ? (
        // At low help, the real error is already right there in the
        // terminal — this panel just flags that something failed instead
        // of repeating/translating it.
        <p className={styles.emptyState}>{es.copilot.errors.minimalAtLowHelp}</p>
      ) : (
        <div className={styles.content}>
          {failure.command && <code className={styles.command}>{failure.command}</code>}
          {failure.match ? (
            <>
              <p className={styles.explanation}>{failure.match.explanation}</p>
              {level === 'high' && <p className={styles.suggestion}>{failure.match.suggestion}</p>}
            </>
          ) : (
            <pre className={styles.rawOutput}>{failure.rawOutput.trim()}</pre>
          )}
        </div>
      )}
    </section>
  );
}
