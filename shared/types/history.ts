export interface HistoryEntry {
  id: string;
  command: string;
  cwd: string | null;
  /** Plain-language label derived from the command dictionary (same source as subtitles). Null when no segment matched a known command. */
  label: string | null;
  exitCode: number;
  startedAt: number;
  durationMs: number;
  /** Set once the user names this entry as a recipe from the diary. */
  recipeName: string | null;
}
