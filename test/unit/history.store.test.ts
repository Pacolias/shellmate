import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { HistoryStore } from '../../src/main/history/history.store';

let tmpDir: string;
let filePath: string;

beforeEach(async () => {
  tmpDir = await mkdtemp(path.join(os.tmpdir(), 'shellmate-history-'));
  filePath = path.join(tmpDir, 'history.json');
});

afterEach(async () => {
  await rm(tmpDir, { recursive: true, force: true });
});

function entry(overrides: Partial<Parameters<HistoryStore['add']>[0]> = {}) {
  return {
    command: 'ls',
    cwd: '/home',
    label: null,
    exitCode: 0,
    startedAt: 1,
    durationMs: 10,
    ...overrides,
  };
}

describe('HistoryStore', () => {
  it('starts empty when no file exists yet', async () => {
    const store = new HistoryStore(filePath);
    expect(await store.list()).toEqual([]);
  });

  it('adds entries newest-first', async () => {
    const store = new HistoryStore(filePath);
    await store.add(entry({ command: 'ls' }));
    await store.add(entry({ command: 'pwd' }));

    const entries = await store.list();
    expect(entries.map((e) => e.command)).toEqual(['pwd', 'ls']);
    expect(entries[0]?.recipeName).toBeNull();
    expect(entries[0]?.id).toBeTypeOf('string');
  });

  it('persists across a new store instance reading the same file', async () => {
    const store = new HistoryStore(filePath);
    await store.add(entry({ command: 'ls' }));

    const reopened = new HistoryStore(filePath);
    expect((await reopened.list()).map((e) => e.command)).toEqual(['ls']);
  });

  it('saves a recipe name onto an existing entry by id', async () => {
    const store = new HistoryStore(filePath);
    const added = await store.add(entry({ command: 'git status' }));

    const updated = await store.saveRecipe(added.id, 'check repo');
    expect(updated?.recipeName).toBe('check repo');

    const entries = await store.list();
    expect(entries[0]?.recipeName).toBe('check repo');
  });

  it('returns null when saving a recipe for an unknown id', async () => {
    const store = new HistoryStore(filePath);
    expect(await store.saveRecipe('nonexistent', 'name')).toBeNull();
  });

  it('caps stored entries at 500, dropping the oldest', async () => {
    const store = new HistoryStore(filePath);
    for (let i = 0; i < 505; i++) {
      await store.add(entry({ command: `cmd-${i}`, startedAt: i }));
    }

    const entries = await store.list();
    expect(entries).toHaveLength(500);
    expect(entries[0]?.command).toBe('cmd-504');
    expect(entries[entries.length - 1]?.command).toBe('cmd-5');
  });
});
