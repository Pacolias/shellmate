import { randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { HistoryEntry } from '@shared/types/history';

// A diary going back further than this is more clutter than useful; oldest
// entries are dropped first. Recipes aren't exempt — if someone relies on a
// recipe long-term they'll want it somewhere more durable than the diary
// anyway (this is phase 2's diary, not a permanent recipe book).
const MAX_ENTRIES = 500;

export interface NewHistoryEntryInput {
  command: string;
  cwd: string | null;
  label: string | null;
  exitCode: number;
  startedAt: number;
  durationMs: number;
}

/**
 * Persists command history as a flat JSON file. Takes an explicit file
 * path instead of reaching for Electron's `app.getPath('userData')`
 * itself, so it's usable in tests without an Electron context — the
 * caller decides where that file lives.
 */
export class HistoryStore {
  private entries: HistoryEntry[] = [];
  private loaded = false;

  constructor(private readonly filePath: string) {}

  async list(): Promise<HistoryEntry[]> {
    await this.ensureLoaded();
    return this.entries;
  }

  async add(input: NewHistoryEntryInput): Promise<HistoryEntry> {
    await this.ensureLoaded();
    const entry: HistoryEntry = { id: randomUUID(), recipeName: null, ...input };
    this.entries.unshift(entry);
    if (this.entries.length > MAX_ENTRIES) {
      this.entries.length = MAX_ENTRIES;
    }
    await this.persist();
    return entry;
  }

  async saveRecipe(id: string, name: string): Promise<HistoryEntry | null> {
    await this.ensureLoaded();
    const entry = this.entries.find((candidate) => candidate.id === id);
    if (!entry) return null;
    entry.recipeName = name;
    await this.persist();
    return entry;
  }

  private async ensureLoaded(): Promise<void> {
    if (this.loaded) return;
    try {
      const raw = await readFile(this.filePath, 'utf8');
      this.entries = JSON.parse(raw) as HistoryEntry[];
    } catch (error) {
      if (!isEnoent(error)) throw error;
      this.entries = [];
    }
    this.loaded = true;
  }

  private async persist(): Promise<void> {
    await mkdir(path.dirname(this.filePath), { recursive: true });
    await writeFile(this.filePath, JSON.stringify(this.entries, null, 2), 'utf8');
  }
}

function isEnoent(error: unknown): boolean {
  return !!error && typeof error === 'object' && 'code' in error && (error as NodeJS.ErrnoException).code === 'ENOENT';
}
