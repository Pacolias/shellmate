import { useEffect, useState, type FormEvent } from 'react';
import es from '@shared/i18n/es.json';
import type { AiGenerateResult, AiStatus } from '@shared/types/ai';
import { useHelpLevel } from '../../app-state/HelpLevelContext';
import { DangerBadge } from '../../components/DangerBadge';
import styles from './NaturalLanguagePanel.module.css';

export interface NaturalLanguagePanelProps {
  /** Inserts text into the terminal's current line — see TerminalPaneHandle.insertText. Only called at help level 'high'. */
  onInsertCommand: (command: string) => void;
}

export function NaturalLanguagePanel({ onInsertCommand }: NaturalLanguagePanelProps) {
  const { level } = useHelpLevel();
  const [status, setStatus] = useState<AiStatus | null>(null);
  const [prompt, setPrompt] = useState('');
  const [result, setResult] = useState<AiGenerateResult | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    void window.shellmate.ai.status().then(setStatus);
  }, []);

  const handleSubmit = (event: FormEvent): void => {
    event.preventDefault();
    const trimmed = prompt.trim();
    if (!trimmed || loading) return;

    setLoading(true);
    setResult(null);
    void window.shellmate.ai.generateCommand(trimmed).then((response) => {
      setResult(response);
      setLoading(false);
      if (response.status === 'ok' && response.command && level === 'high') {
        onInsertCommand(response.command);
      }
    });
  };

  return (
    <section className={styles.panel} aria-label={es.copilot.naturalLanguage.title}>
      <h2 className={styles.heading}>{es.copilot.naturalLanguage.title}</h2>

      {status && !status.configured ? (
        <div className={styles.setup}>
          <p className={styles.setupTitle}>{es.copilot.naturalLanguage.setupTitle}</p>
          <p className={styles.setupBody}>{es.copilot.naturalLanguage.setupBody}</p>
          <code className={styles.envVar}>{status.envVarName}</code>
        </div>
      ) : (
        <>
          <form className={styles.form} onSubmit={handleSubmit}>
            <input
              className={styles.input}
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              placeholder={es.copilot.naturalLanguage.placeholder}
              disabled={loading}
            />
            <button type="submit" className={styles.askButton} disabled={loading || !prompt.trim()}>
              {es.copilot.naturalLanguage.ask}
            </button>
          </form>

          {loading && <p className={styles.loading}>{es.copilot.naturalLanguage.loading}</p>}
          {result && <ResultView result={result} level={level} />}
        </>
      )}
    </section>
  );
}

function ResultView({ result, level }: { result: AiGenerateResult; level: 'high' | 'medium' | 'low' }) {
  if (result.status === 'no-api-key') {
    return (
      <div className={styles.setup}>
        <p className={styles.setupTitle}>{es.copilot.naturalLanguage.setupTitle}</p>
        <code className={styles.envVar}>{result.envVarName}</code>
      </div>
    );
  }

  if (result.status === 'error') {
    return (
      <p className={styles.error}>
        {es.copilot.naturalLanguage.errorPrefix}: {result.message}
      </p>
    );
  }

  if (!result.command) {
    return <p className={styles.explanation}>{result.explanation || es.copilot.naturalLanguage.noCommand}</p>;
  }

  if (level === 'low') {
    return (
      <div className={styles.result}>
        <p className={styles.explanation}>{result.explanation}</p>
        <p className={styles.hint}>{es.copilot.naturalLanguage.lowHelpNote}</p>
      </div>
    );
  }

  return (
    <div className={styles.result}>
      <DangerBadge level={result.danger.level} reason={result.danger.reason} />
      <code className={styles.command}>{result.command}</code>
      <p className={styles.explanation}>{result.explanation}</p>
      <p className={styles.hint}>
        {level === 'high' ? es.copilot.naturalLanguage.insertedNote : es.copilot.naturalLanguage.typeItYourself}
      </p>
    </div>
  );
}
