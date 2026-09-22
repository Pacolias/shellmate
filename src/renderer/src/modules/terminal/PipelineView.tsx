import { useEffect, useState } from 'react';
import es from '@shared/i18n/es.json';
import type { PipelinePreviewResult } from '@shared/types/pipeline';
import styles from './PipelineView.module.css';

export interface PipelineViewProps {
  raw: string;
  onClose: () => void;
}

export function PipelineView({ raw, onClose }: PipelineViewProps) {
  const [result, setResult] = useState<PipelinePreviewResult | null>(null);

  useEffect(() => {
    let cancelled = false;
    void window.shellmate.pipeline.preview(raw).then((response) => {
      if (!cancelled) setResult(response);
    });
    return () => {
      cancelled = true;
    };
  }, [raw]);

  return (
    <div className={styles.overlay}>
      <div className={styles.panel}>
        <div className={styles.header}>
          <span className={styles.title}>{es.terminal.pipeline.title}</span>
          <button type="button" className={styles.closeButton} onClick={onClose}>
            {es.terminal.pipeline.close}
          </button>
        </div>
        <div className={styles.body}>
          {!result && <p className={styles.loading}>{es.terminal.pipeline.loading}</p>}
          {result?.status === 'not-eligible' && <p className={styles.notice}>{result.reason}</p>}
          {result?.status === 'error' && <p className={styles.notice}>{result.message}</p>}
          {result?.status === 'ok' &&
            result.stages.map((stage, index) => (
              <div key={index} className={styles.stage}>
                <div className={styles.stageHeader}>
                  <span className={styles.stageLabel}>
                    {es.terminal.pipeline.stage} {index + 1}
                  </span>
                  <code className={styles.stageCommand}>{stage.command}</code>
                </div>
                <pre className={styles.stageOutput}>{stage.output || '(sin salida)'}</pre>
                {stage.truncated && <p className={styles.truncated}>{es.terminal.pipeline.truncated}</p>}
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}
