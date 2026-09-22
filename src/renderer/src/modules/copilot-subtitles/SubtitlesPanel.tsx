import es from '@shared/i18n/es.json';
import type { CommandAnalysis } from '@shared/types/command';
import { DangerBadge } from '../../components/DangerBadge';
import styles from './SubtitlesPanel.module.css';

export interface SubtitlesPanelProps {
  analysis: CommandAnalysis | null;
}

export function SubtitlesPanel({ analysis }: SubtitlesPanelProps) {
  const hasContent = analysis && analysis.parsed.segments.length > 0;

  return (
    <section className={styles.panel} aria-label={es.copilot.subtitles.title}>
      <h2 className={styles.heading}>{es.copilot.subtitles.title}</h2>
      {!hasContent ? (
        <p className={styles.emptyState}>{es.copilot.subtitles.emptyState}</p>
      ) : (
        <div className={styles.content}>
          <DangerBadge level={analysis.danger.level} reason={analysis.danger.reason} />
          {analysis.parsed.segments.map((segment, segmentIndex) => (
            // Segments have no stable id, and the whole list is replaced on every keystroke anyway.
            <div key={segmentIndex} className={styles.segment}>
              {segment.commandSummary && <p className={styles.summary}>{segment.commandSummary}</p>}
              <ul className={styles.tokenList}>
                {segment.tokens.map((token, tokenIndex) => (
                  <li key={tokenIndex} className={styles.token} data-kind={token.kind}>
                    <code className={styles.tokenText}>{token.text}</code>
                    {token.description && <span className={styles.tokenDescription}>{token.description}</span>}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
