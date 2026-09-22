import { useEffect, useState } from 'react';
import es from '@shared/i18n/es.json';
import type { HistoryEntry } from '@shared/types/history';
import { useHelpLevel } from '../../app-state/HelpLevelContext';
import styles from './HistoryDiary.module.css';

export interface HistoryDiaryProps {
  /** Inserts a recipe's command into the terminal input, going through the same live analysis/confirmation as typing it by hand (see TerminalPaneHandle.insertText). */
  onRunCommand: (command: string) => void;
}

// The diary shows recent activity, not a full audit log — the store itself
// keeps up to 500 for the recipe feature to reach back into.
const DIARY_VISIBLE_COUNT = 30;

export function HistoryDiary({ onRunCommand }: HistoryDiaryProps) {
  const { level } = useHelpLevel();
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [namingId, setNamingId] = useState<string | null>(null);
  const [nameDraft, setNameDraft] = useState('');

  useEffect(() => {
    let cancelled = false;
    void window.shellmate.history.list().then((initial) => {
      if (!cancelled) setEntries(initial);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    return window.shellmate.history.onChanged((changed) => {
      setEntries((previous) => {
        const index = previous.findIndex((entry) => entry.id === changed.id);
        if (index === -1) return [changed, ...previous];
        const next = [...previous];
        next[index] = changed;
        return next;
      });
    });
  }, []);

  const recipes = entries.filter((entry) => entry.recipeName);
  const diary = entries.slice(0, DIARY_VISIBLE_COUNT);

  const startNaming = (id: string): void => {
    setNamingId(id);
    setNameDraft('');
  };

  const confirmNaming = async (id: string): Promise<void> => {
    const name = nameDraft.trim();
    if (!name) return;
    await window.shellmate.history.saveRecipe(id, name);
    setNamingId(null);
  };

  return (
    <section className={styles.panel} aria-label={es.context.history.title}>
      <h2 className={styles.heading}>{es.context.history.title}</h2>
      {entries.length === 0 ? (
        <p className={styles.emptyState}>{es.context.history.emptyState}</p>
      ) : (
        <div className={styles.content}>
          {recipes.length > 0 && (
            <div className={styles.section}>
              <h3 className={styles.sectionTitle}>{es.context.history.recipesTitle}</h3>
              <ul className={styles.list}>
                {recipes.map((entry) => (
                  <li key={entry.id} className={styles.recipeItem}>
                    <div className={styles.recipeInfo}>
                      <span className={styles.recipeName}>{entry.recipeName}</span>
                      <code className={styles.command}>{entry.command}</code>
                    </div>
                    <button type="button" className={styles.runButton} onClick={() => onRunCommand(entry.command)}>
                      {es.context.history.run}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className={styles.section}>
            <h3 className={styles.sectionTitle}>{es.context.history.diaryTitle}</h3>
            <ul className={styles.list}>
              {diary.map((entry) => (
                <li key={entry.id} className={styles.diaryItem} data-failed={entry.exitCode !== 0 || undefined}>
                  <div className={styles.diaryMain}>
                    <code className={styles.command}>{entry.command}</code>
                    {level !== 'low' && entry.label && <span className={styles.label}>{entry.label}</span>}
                  </div>
                  {namingId === entry.id ? (
                    <div className={styles.namingRow}>
                      <input
                        className={styles.nameInput}
                        value={nameDraft}
                        onChange={(event) => setNameDraft(event.target.value)}
                        placeholder={es.context.history.recipeNamePrompt}
                        autoFocus
                      />
                      <button type="button" onClick={() => void confirmNaming(entry.id)}>
                        {es.context.history.save}
                      </button>
                      <button type="button" onClick={() => setNamingId(null)}>
                        {es.context.history.cancel}
                      </button>
                    </div>
                  ) : (
                    !entry.recipeName && (
                      <button type="button" className={styles.saveRecipeButton} onClick={() => startNaming(entry.id)}>
                        {es.context.history.saveAsRecipe}
                      </button>
                    )
                  )}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </section>
  );
}
