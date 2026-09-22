import es from '@shared/i18n/es.json';
import { HELP_LEVELS, type HelpLevel } from '@shared/types/help-level';
import { useHelpLevel } from '../app-state/HelpLevelContext';
import styles from './HelpLevelSlider.module.css';

const LABELS: Record<HelpLevel, string> = {
  high: es.helpLevel.high,
  medium: es.helpLevel.medium,
  low: es.helpLevel.low,
};

export function HelpLevelSlider() {
  const { level, setLevel } = useHelpLevel();

  return (
    <div className={styles.group} role="radiogroup" aria-label={es.helpLevel.label}>
      <span className={styles.groupLabel}>{es.helpLevel.label}</span>
      {HELP_LEVELS.map((candidate) => (
        <button
          key={candidate}
          type="button"
          role="radio"
          aria-checked={candidate === level}
          className={styles.option}
          data-active={candidate === level}
          onClick={() => setLevel(candidate)}
        >
          {LABELS[candidate]}
        </button>
      ))}
    </div>
  );
}
