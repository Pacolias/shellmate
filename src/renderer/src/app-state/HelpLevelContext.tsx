import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { DEFAULT_HELP_LEVEL, HELP_LEVELS, type HelpLevel } from '@shared/types/help-level';

const STORAGE_KEY = 'shellmate.helpLevel';

interface HelpLevelContextValue {
  level: HelpLevel;
  setLevel: (level: HelpLevel) => void;
}

const HelpLevelContext = createContext<HelpLevelContextValue | null>(null);

function readStoredLevel(): HelpLevel {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored && (HELP_LEVELS as readonly string[]).includes(stored)) {
      return stored as HelpLevel;
    }
  } catch {
    // localStorage can throw in a locked-down environment (rare in
    // Electron, but cheap to guard) — fall back to the default silently.
  }
  return DEFAULT_HELP_LEVEL;
}

/**
 * The one piece of cross-cutting state every module reads (PLAN.md §4.10).
 * The context only exposes the value and a setter — it never tells a
 * module *how* to behave at a given level, each module decides that
 * itself.
 */
export function HelpLevelProvider({ children }: { children: ReactNode }) {
  const [level, setLevelState] = useState<HelpLevel>(readStoredLevel);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, level);
    } catch {
      // Non-fatal — the level just won't survive a restart this time.
    }
  }, [level]);

  const value = useMemo<HelpLevelContextValue>(() => ({ level, setLevel: setLevelState }), [level]);

  return <HelpLevelContext.Provider value={value}>{children}</HelpLevelContext.Provider>;
}

export function useHelpLevel(): HelpLevelContextValue {
  const context = useContext(HelpLevelContext);
  if (!context) {
    throw new Error('useHelpLevel must be used within a HelpLevelProvider');
  }
  return context;
}
